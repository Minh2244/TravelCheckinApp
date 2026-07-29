import { Request, Response } from "express";
import { pool } from "../config/database";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { publishToUser } from "../utils/realtime";

export const getLocationChatHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const locationId = Number(req.params.locationId);
    const requesterId = req.userId;
    // afterId: chỉ trả về tin nhắn có message_id > afterId (dùng để tải nhanh sau khi đã biết baseline)
    const afterId = req.query.afterId !== undefined ? Number(req.query.afterId) : undefined;
    const includeImages =
      req.query.includeImages === "1" || req.query.includeImages === "true";
    const unreadOnly =
      req.query.unreadOnly === "1" || req.query.unreadOnly === "true";
    const imageSelect = includeImages
      ? "m.image_data, (m.image_data IS NOT NULL) AS has_image"
      : "NULL AS image_data, (m.image_data IS NOT NULL) AS has_image";

    if (!Number.isFinite(locationId)) {
      res.status(400).json({ success: false, message: "ID địa điểm không hợp lệ" });
      return;
    }
    if (!requesterId) {
      res.status(401).json({ success: false, message: "Chưa xác thực người dùng" });
      return;
    }

    // ✅ Chạy song song 2 query kiểm tra quyền thay vì tuần tự → nhanh gần 2x
    const [locRows, empRows] = await Promise.all([
      pool.query<RowDataPacket[]>(
        `SELECT owner_id FROM locations WHERE location_id = ? LIMIT 1`,
        [locationId]
      ),
      pool.query<RowDataPacket[]>(
        `SELECT employee_id FROM employee_locations WHERE employee_id = ? AND location_id = ? LIMIT 1`,
        [requesterId, locationId]
      ),
    ]);

    const locationObj = (locRows[0] as RowDataPacket[])?.[0];
    const isOwnerOfLoc = locationObj && Number(locationObj.owner_id) === Number(requesterId);
    const isEmployeeOfLoc = (empRows[0] as RowDataPacket[]).length > 0;
    const isMerchant = isOwnerOfLoc || isEmployeeOfLoc;

    let customerId: number;
    if (isMerchant) {
      customerId = Number(req.query.customerId);
      if (!Number.isFinite(customerId)) {
        res.status(400).json({ success: false, message: "Thiếu ID khách hàng để lấy lịch sử chat" });
        return;
      }
    } else {
      customerId = requesterId;
    }

    const unreadClause = unreadOnly
      ? isMerchant
        ? ` AND m.sender_role = "user" AND m.is_read = 0`
        : ` AND m.sender_role IN ("owner", "employee") AND m.is_read = 0`
      : "";

    const deletedClause = isMerchant ? ` AND m.is_deleted_for_owner = 0` : ` AND m.is_deleted_for_customer = 0`;

    // ✅ Nếu có afterId: chỉ lấy tin nhắn mới hơn → rất nhanh khi đã biết baseline
    let rows: RowDataPacket[];
    if (afterId !== undefined && Number.isFinite(afterId)) {
      [rows] = await pool.query<RowDataPacket[]>(
        `SELECT 
           m.message_id, m.location_id, m.customer_id, m.sender_id, m.sender_name, m.sender_role, m.content, ${imageSelect}, m.is_read, m.created_at,
           u.avatar_url, u.avatar_path, u.avatar_source
         FROM location_chat_messages m
         LEFT JOIN users u ON u.user_id = m.customer_id
         WHERE m.location_id = ? AND m.customer_id = ? AND m.message_id > ?${unreadClause}${deletedClause}
         ORDER BY m.created_at ASC`,
        [locationId, customerId, afterId]
      );
    } else {
      [rows] = await pool.query<RowDataPacket[]>(
        `SELECT 
           m.message_id, m.location_id, m.customer_id, m.sender_id, m.sender_name, m.sender_role, m.content, ${imageSelect}, m.is_read, m.created_at,
           u.avatar_url, u.avatar_path, u.avatar_source
         FROM location_chat_messages m
         LEFT JOIN users u ON u.user_id = m.customer_id
         WHERE m.location_id = ? AND m.customer_id = ?${unreadClause}${deletedClause}
         ORDER BY m.created_at ASC`,
        [locationId, customerId]
      );
    }

    if (isMerchant && rows.length === 0) {
      const afterClause = afterId !== undefined && Number.isFinite(afterId)
        ? " AND m.message_id > ?"
        : "";
      const params: Array<number> = [customerId, locationId, customerId, customerId];
      if (afterClause) {
        params.push(afterId as number);
      }
      [rows] = await pool.query<RowDataPacket[]>(
        `SELECT 
           m.message_id, m.location_id, m.customer_id, m.sender_id, m.sender_name, m.sender_role, m.content, ${imageSelect}, m.is_read, m.created_at,
           u.avatar_url, u.avatar_path, u.avatar_source
         FROM location_chat_messages m
         LEFT JOIN users u ON u.user_id = ?
         WHERE m.location_id = ? AND (m.customer_id = ? OR m.sender_id = ?)${afterClause}${unreadClause}${deletedClause}
         ORDER BY m.created_at ASC`,
        params
      );
    }

    const formattedData = rows.map((row) => {
      let customerAvatar: string | null = null;
      if (row.avatar_source === "upload" && row.avatar_path) {
        customerAvatar = row.avatar_path;
      } else if (row.avatar_url) {
        customerAvatar = row.avatar_url;
      }
      return {
        message_id: row.message_id,
        location_id: row.location_id,
        customer_id: row.customer_id,
        sender_id: row.sender_id,
        sender_name: row.sender_name,
        sender_role: row.sender_role,
        content: row.content,
        image_data: row.image_data,
        has_image: Boolean(row.has_image),
        is_read: row.is_read,
        created_at: row.created_at,
        customer_avatar: customerAvatar,
      };
    });

    // ✅ Cache-Control: không cache phía client (chat cần real-time)
    res.setHeader("Cache-Control", "no-store");
    res.json({ success: true, data: formattedData });
  } catch (error) {
    console.error("❌ Lỗi khi lấy lịch sử chat địa điểm:", error);
    res.status(500).json({ success: false, message: "Lỗi server khi lấy lịch sử chat" });
  }
};

export const getLocationChatLatestMessageId = async (req: Request, res: Response): Promise<void> => {
  try {
    const locationId = Number(req.params.locationId);
    const requesterId = req.userId;

    if (!Number.isFinite(locationId)) {
      res.status(400).json({ success: false, message: "ID địa điểm không hợp lệ" });
      return;
    }
    if (!requesterId) {
      res.status(401).json({ success: false, message: "Chưa xác thực người dùng" });
      return;
    }

    const [locRows, empRows] = await Promise.all([
      pool.query<RowDataPacket[]>(
        `SELECT owner_id FROM locations WHERE location_id = ? LIMIT 1`,
        [locationId]
      ),
      pool.query<RowDataPacket[]>(
        `SELECT employee_id FROM employee_locations WHERE employee_id = ? AND location_id = ? LIMIT 1`,
        [requesterId, locationId]
      ),
    ]);

    const locationObj = (locRows[0] as RowDataPacket[])?.[0];
    const isOwnerOfLoc = locationObj && Number(locationObj.owner_id) === Number(requesterId);
    const isEmployeeOfLoc = (empRows[0] as RowDataPacket[]).length > 0;
    const isMerchant = isOwnerOfLoc || isEmployeeOfLoc;

    const customerId = isMerchant ? Number(req.query.customerId) : Number(requesterId);
    if (!Number.isFinite(customerId)) {
      res.status(400).json({ success: false, message: "Thiếu ID khách hàng" });
      return;
    }
    if (!isMerchant && Number(customerId) !== Number(requesterId)) {
      res.status(403).json({ success: false, message: "Không có quyền" });
      return;
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT COALESCE(MAX(message_id), 0) AS latestMessageId
       FROM location_chat_messages
       WHERE location_id = ? AND customer_id = ?`,
      [locationId, customerId]
    );

    res.setHeader("Cache-Control", "no-store");
    res.json({ success: true, data: { latestMessageId: Number(rows[0]?.latestMessageId || 0) } });
  } catch (error) {
    console.error("❌ Lỗi khi lấy latest message id:", error);
    res.status(500).json({ success: false, message: "Lỗi server khi lấy mốc chat" });
  }
};

export const getLocationChatMessageImage = async (req: Request, res: Response): Promise<void> => {
  try {
    const locationId = Number(req.params.locationId);
    const messageId = Number(req.params.messageId);
    const requesterId = req.userId;

    if (!Number.isFinite(locationId) || !Number.isFinite(messageId)) {
      res.status(400).json({ success: false, message: "ID không hợp lệ" });
      return;
    }
    if (!requesterId) {
      res.status(401).json({ success: false, message: "Chưa xác thực người dùng" });
      return;
    }

    const [[locRows], [msgRows], [empRows]] = await Promise.all([
      pool.query<RowDataPacket[]>(
        `SELECT owner_id FROM locations WHERE location_id = ? LIMIT 1`,
        [locationId]
      ),
      pool.query<RowDataPacket[]>(
        `SELECT message_id, location_id, customer_id, sender_id, image_data
         FROM location_chat_messages
         WHERE location_id = ? AND message_id = ?
         LIMIT 1`,
        [locationId, messageId]
      ),
      pool.query<RowDataPacket[]>(
        `SELECT employee_id FROM employee_locations WHERE employee_id = ? AND location_id = ? LIMIT 1`,
        [requesterId, locationId]
      ),
    ]);

    const locationObj = locRows?.[0];
    const msg = msgRows?.[0];
    if (!msg) {
      res.status(404).json({ success: false, message: "Không tìm thấy tin nhắn" });
      return;
    }

    const isOwnerOfLoc = locationObj && Number(locationObj.owner_id) === Number(requesterId);
    const isEmployeeOfLoc = empRows.length > 0;
    const isCustomer = Number(msg.customer_id) === Number(requesterId);
    if (!isOwnerOfLoc && !isEmployeeOfLoc && !isCustomer) {
      res.status(403).json({ success: false, message: "Không có quyền xem ảnh này" });
      return;
    }

    if (!msg.image_data) {
      res.status(404).json({ success: false, message: "Tin nhắn không có ảnh" });
      return;
    }

    res.setHeader("Cache-Control", "private, max-age=300");
    res.json({
      success: true,
      data: {
        message_id: msg.message_id,
        image_data: msg.image_data,
      },
    });
  } catch (error) {
    console.error("❌ Lỗi khi lấy ảnh chat địa điểm:", error);
    res.status(500).json({ success: false, message: "Lỗi server khi lấy ảnh chat" });
  }
};

export const postLocationChatMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const locationId = Number(req.params.locationId);
    const userId = req.userId;
    const { content, customerId: reqCustomerId, imageData } = req.body as {
      content?: string;
      customerId?: number;
      imageData?: string;
    };

    if (!Number.isFinite(locationId)) {
      res.status(400).json({ success: false, message: "ID địa điểm không hợp lệ" });
      return;
    }
    if (!userId) {
      res.status(401).json({ success: false, message: "Chưa xác thực người dùng" });
      return;
    }
    if ((!content || !content.trim()) && !imageData) {
      res.status(400).json({ success: false, message: "Nội dung tin nhắn trống" });
      return;
    }

    // Kiểm tra mối quan hệ thực tế của người gửi đối với địa điểm này
    const [locRows] = await pool.query<RowDataPacket[]>(
      `SELECT owner_id FROM locations WHERE location_id = ? LIMIT 1`,
      [locationId]
    );
    const locationObj = locRows?.[0];
    const isOwnerOfLoc = locationObj && Number(locationObj.owner_id) === Number(userId);

    let isEmployeeOfLoc = false;
    if (!isOwnerOfLoc) {
      const [empRows] = await pool.query<RowDataPacket[]>(
        `SELECT employee_id FROM employee_locations WHERE employee_id = ? AND location_id = ? LIMIT 1`,
        [userId, locationId]
      );
      isEmployeeOfLoc = empRows.length > 0;
    }

    const isMerchant = isOwnerOfLoc || isEmployeeOfLoc;

    let customerId: number;
    if (isMerchant) {
      if (!reqCustomerId) {
        res.status(400).json({ success: false, message: "Thiếu ID khách hàng để gửi tin nhắn" });
        return;
      }
      customerId = reqCustomerId;
    } else {
      // Người gửi đang đóng vai trò khách hàng tại địa điểm này
      customerId = userId;
    }

    // Lấy thông tin người gửi từ DB
    const [userRows] = await pool.query<RowDataPacket[]>(
      `SELECT full_name FROM users WHERE user_id = ? LIMIT 1`,
      [userId]
    );

    const user = userRows[0];
    if (!user) {
      res.status(404).json({ success: false, message: "Không tìm thấy người dùng" });
      return;
    }

    const senderName = String(user.full_name || "Người dùng");
    const senderRole = isMerchant ? (isOwnerOfLoc ? "owner" : "employee") : "user";

    // Lấy avatar của khách hàng để gửi cho owner hiển thị
    const [custRows] = await pool.query<RowDataPacket[]>(
      `SELECT avatar_url, avatar_path, avatar_source FROM users WHERE user_id = ? LIMIT 1`,
      [customerId]
    );
    const custUser = custRows?.[0];
    let customerAvatar: string | null = null;
    if (custUser) {
      if (custUser.avatar_source === "upload" && custUser.avatar_path) {
        customerAvatar = custUser.avatar_path;
      } else if (custUser.avatar_url) {
        customerAvatar = custUser.avatar_url;
      }
    }

    // Thêm tin nhắn vào cơ sở dữ liệu
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO location_chat_messages (location_id, customer_id, sender_id, sender_name, sender_role, content, image_data)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        locationId,
        customerId,
        userId,
        senderName,
        senderRole,
        (content || "").trim(),
        imageData || null,
      ]
    );

    const newMessage = {
      message_id: result.insertId,
      location_id: locationId,
      customer_id: customerId,
      sender_id: userId,
      sender_name: senderName,
      sender_role: senderRole,
      content: (content || "").trim(),
      image_data: imageData || null,
      created_at: new Date().toISOString(),
      customer_avatar: customerAvatar
    };

    // Phát tin nhắn thời gian thực qua socket
    const io = req.app.get("socketio");
    if (io) {
      // Tạo payload nhẹ cho socket: không gửi image_data vì base64 ảnh rất lớn.
      // UI chỉ cần has_image để hiện placeholder; ảnh vẫn được lưu trong DB.
      const socketPayload = {
        message_id: newMessage.message_id,
        location_id: newMessage.location_id,
        customer_id: newMessage.customer_id,
        sender_id: newMessage.sender_id,
        sender_name: newMessage.sender_name,
        sender_role: newMessage.sender_role,
        content: newMessage.content,
        image_data: null,               // Không gửi ảnh qua socket
        has_image: !!imageData,         // Flag để UI hiện placeholder ảnh
        created_at: newMessage.created_at,
        customer_avatar: newMessage.customer_avatar,
      };

      // Gửi vào phòng chat riêng tư
      const room = `location_${locationId}_customer_${customerId}`;
      console.log(`[Socket] Phát tin tới phòng chat riêng tư: ${room}, has_image: ${socketPayload.has_image}`);
      io.to(room).emit("location_chat_message", socketPayload);

      // LUÔN gửi tin nhắn cho các Owner đang mở trang Vận hành để họ đồng bộ realtime (ngay cả khi họ tự gửi từ tab khác hoặc test)
      const ownerRoom = `location_${locationId}_owners`;
      io.to(ownerRoom).emit("location_new_message_alert", socketPayload);

      // Nếu KHÁCH HÀNG gửi -> đẩy thêm thông báo notification hệ thống cho Owner
      if (!isMerchant) {
        if (locationObj && locationObj.owner_id) {
          publishToUser(Number(locationObj.owner_id), {
            type: "new_message",
            message: "Có tin nhắn mới",
            location_id: locationId,
            customer_id: customerId
          });
        }
      } else {
        publishToUser(customerId, {
          type: "new_message",
          message: "Bạn có tin nhắn mới",
          location_id: locationId
        });
      }
    }

    res.json({ success: true, data: newMessage });
  } catch (error) {
    console.error("❌ Lỗi khi gửi tin nhắn chat địa điểm:", error);
    res.status(500).json({ success: false, message: "Lỗi server khi gửi tin nhắn" });
  }
};

export const getLocationActiveSessions = async (req: Request, res: Response): Promise<void> => {
  try {
    const locationId = Number(req.params.locationId);
    const requesterId = req.userId;

    if (!Number.isFinite(locationId)) {
      res.status(400).json({ success: false, message: "ID địa điểm không hợp lệ" });
      return;
    }
    if (!requesterId) {
      res.status(401).json({ success: false, message: "Chưa xác thực người dùng" });
      return;
    }

    // Kiểm tra xem người yêu cầu có phải chủ sở hữu hoặc nhân viên của địa điểm này không
    const [locRows] = await pool.query<RowDataPacket[]>(
      `SELECT owner_id FROM locations WHERE location_id = ? LIMIT 1`,
      [locationId]
    );
    const locationObj = locRows?.[0];
    const isOwnerOfLoc = locationObj && Number(locationObj.owner_id) === Number(requesterId);

    let isEmployeeOfLoc = false;
    if (!isOwnerOfLoc) {
      const [empRows] = await pool.query<RowDataPacket[]>(
        `SELECT employee_id FROM employee_locations WHERE employee_id = ? AND location_id = ? LIMIT 1`,
        [requesterId, locationId]
      );
      isEmployeeOfLoc = empRows.length > 0;
    }

    const isMerchant = isOwnerOfLoc || isEmployeeOfLoc;
    if (!isMerchant) {
      res.status(403).json({ success: false, message: "Bạn không có quyền quản lý địa điểm này" });
      return;
    }

    // Lấy tin nhắn của địa điểm này trong vòng 30 ngày qua để phân tích các cuộc trò chuyện đang hoạt động
    const [messages] = await pool.query<RowDataPacket[]>(
      `SELECT 
         m.message_id, m.customer_id, m.sender_id, m.sender_name, m.sender_role, m.content, m.created_at, m.is_read, (m.image_data IS NOT NULL) AS has_image,
         u.full_name as customer_name, u.avatar_url, u.avatar_path, u.avatar_source
       FROM location_chat_messages m
       LEFT JOIN users u ON u.user_id = m.customer_id
       WHERE m.location_id = ? AND m.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) AND m.is_deleted_for_owner = 0
       ORDER BY m.customer_id, m.created_at ASC`,
      [locationId]
    );

    // Group các tin nhắn theo customer_id
    const sessionsMap: Record<number, {
      customerId: number;
      customerName: string;
      customerAvatar: string | null;
      lastMessage: string;
      lastMessageAt: string;
      unreadCount: number;
    }> = {};

    for (const msg of messages) {
      const customerId = Number(msg.customer_id);
      
      let avatar: string | null = null;
      if (msg.avatar_source === "upload" && msg.avatar_path) {
        avatar = msg.avatar_path;
      } else if (msg.avatar_url) {
        avatar = msg.avatar_url;
      }

      if (!sessionsMap[customerId]) {
        sessionsMap[customerId] = {
          customerId,
          customerName: msg.customer_name || msg.sender_name || `Khách hàng #${customerId}`,
          customerAvatar: avatar,
          lastMessage: msg.has_image ? "🖼️ Hình ảnh" : (msg.content || ""),
          lastMessageAt: msg.created_at,
          unreadCount: 0,
        };
      } else {
        sessionsMap[customerId].lastMessage = msg.has_image ? "🖼️ Hình ảnh" : (msg.content || "");
        sessionsMap[customerId].lastMessageAt = msg.created_at;
        if (avatar) {
          sessionsMap[customerId].customerAvatar = avatar;
        }
      }

      // Tính số tin nhắn chưa đọc của khách hàng
      if (msg.sender_role === "user" && msg.is_read === 0) {
        sessionsMap[customerId].unreadCount += 1;
      }
    }

    const sessions = Object.values(sessionsMap).sort(
      (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    );

    res.json({ success: true, data: sessions });
  } catch (error) {
    console.error("❌ Lỗi khi lấy danh sách chat active:", error);
    res.status(500).json({ success: false, message: "Lỗi server khi lấy danh sách chat" });
  }
};

export const getUnreadChatCounts = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }
    const specificLocationId = req.query.locationId ? Number(req.query.locationId) : null;

    const [locations] = await pool.query<RowDataPacket[]>(
      'SELECT location_id FROM locations WHERE owner_id = ? UNION SELECT location_id FROM employee_locations WHERE employee_id = ?',
      [userId, userId]
    );
    const locationIds = locations.map(l => l.location_id);

    let ownerUnread = 0;
    if (locationIds.length > 0) {
      const [ownerRows] = await pool.query<RowDataPacket[]>(
        'SELECT COUNT(*) as count FROM location_chat_messages WHERE location_id IN (?) AND sender_role = "user" AND is_read = 0',
        [locationIds]
      );
      ownerUnread = ownerRows[0].count;
    }

    let userUnreadQuery = 'SELECT COUNT(*) as count FROM location_chat_messages WHERE customer_id = ? AND sender_role IN ("owner", "employee") AND is_read = 0';
    const userUnreadParams: any[] = [userId];
    
    if (specificLocationId) {
      userUnreadQuery += ' AND location_id = ?';
      userUnreadParams.push(specificLocationId);
    }

    const [userRows] = await pool.query<RowDataPacket[]>(userUnreadQuery, userUnreadParams);
    const userUnread = userRows[0].count;

    res.json({ success: true, ownerUnread, userUnread });
  } catch (error) {
    console.error('Error fetching unread counts:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const markLocationChatRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const locationId = Number(req.params.locationId);
    const userId = req.userId;
    const { customerId, asCustomer } = req.body;

    if (!userId || !locationId) {
      res.status(400).json({ success: false, message: 'Missing params' });
      return;
    }

    const [locRows] = await pool.query<RowDataPacket[]>(
      `SELECT owner_id FROM locations WHERE location_id = ? LIMIT 1`,
      [locationId]
    );
    const isOwnerOfLoc = locRows?.[0] && Number(locRows[0].owner_id) === Number(userId);

    let isEmployeeOfLoc = false;
    if (!isOwnerOfLoc) {
      const [empRows] = await pool.query<RowDataPacket[]>(
        `SELECT employee_id FROM employee_locations WHERE employee_id = ? AND location_id = ? LIMIT 1`,
        [userId, locationId]
      );
      isEmployeeOfLoc = empRows.length > 0;
    }

    const isMerchant = isOwnerOfLoc || isEmployeeOfLoc;

    if (isMerchant && customerId && !asCustomer) {
      // Owner marking messages from user as read
      await pool.query(
        'UPDATE location_chat_messages SET is_read = 1 WHERE location_id = ? AND customer_id = ? AND sender_role = "user" AND is_read = 0',
        [locationId, customerId]
      );
    } else {
      // User marking messages from owner as read
      // Nếu là User, bỏ qua customerId truyền từ body, luôn dùng userId của họ
      await pool.query(
        'UPDATE location_chat_messages SET is_read = 1 WHERE location_id = ? AND customer_id = ? AND sender_role IN ("owner", "employee") AND is_read = 0',
        [locationId, userId]
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking read:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const softDeleteMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const locationId = Number(req.params.locationId);
    const messageId = Number(req.params.messageId);
    const requesterId = req.userId;

    if (!Number.isFinite(locationId) || !Number.isFinite(messageId)) {
      res.status(400).json({ success: false, message: "ID không hợp lệ" });
      return;
    }
    if (!requesterId) {
      res.status(401).json({ success: false, message: "Chưa xác thực" });
      return;
    }

    const [[locRows], [empRows]] = await Promise.all([
      pool.query<RowDataPacket[]>(
        `SELECT owner_id FROM locations WHERE location_id = ? LIMIT 1`,
        [locationId]
      ),
      pool.query<RowDataPacket[]>(
        `SELECT employee_id FROM employee_locations WHERE employee_id = ? AND location_id = ? LIMIT 1`,
        [requesterId, locationId]
      ),
    ]);

    const isOwnerOfLoc = locRows.length > 0 && Number((locRows as any)[0].owner_id) === Number(requesterId);
    const isEmployeeOfLoc = empRows.length > 0;
    const isMerchant = isOwnerOfLoc || isEmployeeOfLoc;

    if (isMerchant) {
      await pool.query(
        "UPDATE location_chat_messages SET is_deleted_for_owner = 1 WHERE location_id = ? AND message_id = ?",
        [locationId, messageId]
      );
    } else {
      await pool.query(
        "UPDATE location_chat_messages SET is_deleted_for_customer = 1 WHERE location_id = ? AND message_id = ? AND customer_id = ?",
        [locationId, messageId, requesterId]
      );
    }

    res.json({ success: true, message: "Đã xóa tin nhắn" });
  } catch (error) {
    console.error("Lỗi khi xóa tin nhắn:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const clearLocationChatHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const locationId = Number(req.params.locationId);
    const requesterId = req.userId;

    if (!Number.isFinite(locationId)) {
      res.status(400).json({ success: false, message: "ID không hợp lệ" });
      return;
    }
    if (!requesterId) {
      res.status(401).json({ success: false, message: "Chưa xác thực" });
      return;
    }

    const [[locRows], [empRows]] = await Promise.all([
      pool.query<RowDataPacket[]>(
        `SELECT owner_id FROM locations WHERE location_id = ? LIMIT 1`,
        [locationId]
      ),
      pool.query<RowDataPacket[]>(
        `SELECT employee_id FROM employee_locations WHERE employee_id = ? AND location_id = ? LIMIT 1`,
        [requesterId, locationId]
      ),
    ]);

    const isOwnerOfLoc = locRows.length > 0 && Number((locRows as any)[0].owner_id) === Number(requesterId);
    const isEmployeeOfLoc = empRows.length > 0;
    const isMerchant = isOwnerOfLoc || isEmployeeOfLoc;

    if (isMerchant) {
      const customerId = Number(req.query.customerId);
      if (!Number.isFinite(customerId)) {
        res.status(400).json({ success: false, message: "Thiếu ID khách hàng" });
        return;
      }
      await pool.query(
        "UPDATE location_chat_messages SET is_deleted_for_owner = 1 WHERE location_id = ? AND customer_id = ?",
        [locationId, customerId]
      );
    } else {
      await pool.query(
        "UPDATE location_chat_messages SET is_deleted_for_customer = 1 WHERE location_id = ? AND customer_id = ?",
        [locationId, requesterId]
      );
    }

    res.json({ success: true, message: "Đã xóa toàn bộ lịch sử chat" });
  } catch (error) {
    console.error("Lỗi khi xóa lịch sử chat:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};
