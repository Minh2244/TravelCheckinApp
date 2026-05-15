import { Request, Response } from "express";
import { pool } from "../config/database";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

interface AuthenticatedRequest extends Request {
  userId?: number;
}

interface AiChatBody {
  prompt?: string;
}

// Vì sao: hiện chưa kết nối AI Service nên chỉ lưu log và trả trạng thái bảo trì
export const chatWithAi = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    if (!userId) {
      res.status(401).json({ success: false, message: "Chưa đăng nhập" });
      return;
    }

    const body = req.body as AiChatBody;
    if (!body?.prompt || body.prompt.trim().length < 2) {
      res.status(400).json({ success: false, message: "Prompt không hợp lệ" });
      return;
    }

    const responseText = "AI đang bảo trì, vui lòng thử lại sau.";

    await pool.query<ResultSetHeader>(
      `INSERT INTO ai_chat_history (user_id, ai_model, prompt, response)
       VALUES (?, ?, ?, ?)`,
      [userId, "Gemini", body.prompt.trim(), responseText],
    );

    res.json({
      success: true,
      message: "AI tạm thời chưa sẵn sàng",
      data: { response: responseText },
    });
  } catch (error) {
    console.error("Lỗi chat AI:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const getAiHistory = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    if (!userId) {
      res.status(401).json({ success: false, message: "Chưa đăng nhập" });
      return;
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT history_id, prompt, response, created_at
       FROM ai_chat_history
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [userId],
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Lỗi lấy lịch sử AI:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};
