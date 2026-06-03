import { Request, Response } from "express";
import { pool } from "../config/database";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

export const getLocationChatHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const locationId = Number(req.params.locationId);
    if (!Number.isFinite(locationId)) {
      res.status(400).json({ success: false, message: "ID địa điểm không hợp lệ" });
      return;
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT message_id, location_id, sender_id, sender_name, sender_role, content, created_at
       FROM location_chat_messages
       WHERE location_id = ?
       ORDER BY created_at ASC`,
      [locationId]
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("❌ Lỗi khi lấy lịch sử chat địa điểm:", error);
    res.status(500).json({ success: false, message: "Lỗi server khi lấy lịch sử chat" });
  }
};

export const postLocationChatMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const locationId = Number(req.params.locationId);
    const userId = req.userId;
    const { content } = req.body as { content?: string };

    if (!Number.isFinite(locationId)) {
      res.status(400).json({ success: false, message: "ID địa điểm không hợp lệ" });
      return;
    }
    if (!userId) {
      res.status(401).json({ success: false, message: "Chưa xác thực người dùng" });
      return;
    }
    if (!content || !content.trim()) {
      res.status(400).json({ success: false, message: "Nội dung tin nhắn trống" });
      return;
    }

    // Lấy thông tin người gửi từ DB
    const [userRows] = await pool.query<RowDataPacket[]>(
      `SELECT full_name, role FROM users WHERE user_id = ? LIMIT 1`,
      [userId]
    );

    const user = userRows[0];
    if (!user) {
      res.status(404).json({ success: false, message: "Không tìm thấy người dùng" });
      return;
    }

    const senderName = String(user.full_name || "Người dùng");
    const senderRole = String(user.role || "user");

    // Thêm tin nhắn vào cơ sở dữ liệu
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO location_chat_messages (location_id, sender_id, sender_name, sender_role, content)
       VALUES (?, ?, ?, ?, ?)`,
      [locationId, userId, senderName, senderRole, content.trim()]
    );

    const newMessage = {
      message_id: result.insertId,
      location_id: locationId,
      sender_id: userId,
      sender_name: senderName,
      sender_role: senderRole,
      content: content.trim(),
      created_at: new Date().toISOString()
    };

    // Phát tin nhắn thời gian thực qua socket
    const io = req.app.get("socketio");
    if (io) {
      const room = `location_${locationId}`;
      io.to(room).emit("location_chat_message", newMessage);
    }

    res.json({ success: true, data: newMessage });
  } catch (error) {
    console.error("❌ Lỗi khi gửi tin nhắn chat địa điểm:", error);
    res.status(500).json({ success: false, message: "Lỗi server khi gửi tin nhắn" });
  }
};
