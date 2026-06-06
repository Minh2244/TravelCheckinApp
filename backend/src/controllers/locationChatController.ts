import { Request, Response } from "express";
import { pool } from "../config/database";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

export const getLocationChatHistory = async (req: Request, res: Response): Promise<void> => {
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

    let customerId: number;
    if (isMerchant) {
      // Nếu là merchant của địa điểm này, lấy customerId từ query
      customerId = Number(req.query.customerId);
      if (!Number.isFinite(customerId)) {
        res.status(400).json({ success: false, message: "Thiếu ID khách hàng để lấy lịch sử chat" });
        return;
      }
    } else {
      // Nếu không phải, chỉ được xem chat của chính mình (nhập vai trò khách hàng)
      customerId = requesterId;
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT 
         m.message_id, m.location_id, m.customer_id, m.sender_id, m.sender_name, m.sender_role, m.content, m.image_data, m.created_at,
         u.avatar_url, u.avatar_path, u.avatar_source
       FROM location_chat_messages m
       LEFT JOIN users u ON u.user_id = m.customer_id
       WHERE m.location_id = ? AND m.customer_id = ?
       ORDER BY m.created_at ASC`,
      [locationId, customerId]
    );

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
        created_at: row.created_at,
        customer_avatar: customerAvatar
      };
    });

    res.json({ success: true, data: formattedData });
  } catch (error) {
    console.error("❌ Lỗi khi lấy lịch sử chat địa điểm:", error);
    res.status(500).json({ success: false, message: "Lỗi server khi lấy lịch sử chat" });
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
      // Tạo payload nhẹ cho socket: KHÔNG gửi image_data (có thể rất lớn, gây drop frame)
      // Frontend sẽ tự fetch lịch sử nếu has_image = true
      const socketPayload = {
        message_id: newMessage.message_id,
        location_id: newMessage.location_id,
        customer_id: newMessage.customer_id,
        sender_id: newMessage.sender_id,
        sender_name: newMessage.sender_name,
        sender_role: newMessage.sender_role,
        content: newMessage.content,
        image_data: null,               // Không gửi ảnh qua socket
        has_image: !!imageData,         // Flag báo frontend tự fetch
        created_at: newMessage.created_at,
        customer_avatar: newMessage.customer_avatar,
      };

      // Gửi vào phòng chat riêng tư
      const room = `location_${locationId}_customer_${customerId}`;
      console.log(`[Socket] Phát tin tới phòng chat riêng tư: ${room}, has_image: ${socketPayload.has_image}`);
      io.to(room).emit("location_chat_message", socketPayload);

      // Nếu không phải là chủ tiệm / nhân viên của địa điểm này gửi -> báo động cho các Owner
      if (!isMerchant) {
        const ownerRoom = `location_${locationId}_owners`;
        console.log(`[Socket] Phát cảnh báo tới phòng owner: ${ownerRoom}`);
        io.to(ownerRoom).emit("location_new_message_alert", socketPayload);
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
         m.message_id, m.customer_id, m.sender_id, m.sender_name, m.sender_role, m.content, m.created_at,
         u.full_name as customer_name, u.avatar_url, u.avatar_path, u.avatar_source
       FROM location_chat_messages m
       LEFT JOIN users u ON u.user_id = m.customer_id
       WHERE m.location_id = ? AND m.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
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
          lastMessage: msg.content,
          lastMessageAt: msg.created_at,
          unreadCount: 0,
        };
      } else {
        sessionsMap[customerId].lastMessage = msg.content;
        sessionsMap[customerId].lastMessageAt = msg.created_at;
        if (avatar) {
          sessionsMap[customerId].customerAvatar = avatar;
        }
      }

      // Tính số tin nhắn chưa trả lời của khách hàng
      if (msg.sender_role === "user") {
        sessionsMap[customerId].unreadCount += 1;
      } else {
        sessionsMap[customerId].unreadCount = 0;
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

