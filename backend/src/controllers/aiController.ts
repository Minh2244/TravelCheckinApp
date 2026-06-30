import { Request, Response } from "express";
import { pool } from "../config/database";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { processChat } from "../services/ai-services/customer-assistant/chat.service";

interface AuthenticatedRequest extends Request {
  userId?: number;
}

interface AiChatBody {
  prompt?: string;
  conversationId?: number;
  context?: {
    current_location?: {
      lat?: number;
      lng?: number;
      city?: string | null;
      province?: string | null;
    } | null;
    weather?: {
      temperature?: number | null;
      condition?: string | null;
    } | null;
  };
}

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

    const result = await processChat({
      userId,
      prompt: body.prompt.trim(),
      conversationId: body.conversationId,
      context: body.context,
    });

    res.json({
      success: true,
      message: "Thành công",
      data: result,
    });
  } catch (error) {
    console.error("Lỗi chat AI:", error);
    res.status(500).json({ success: false, message: "Lỗi server nội bộ" });
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
      `SELECT history_id, conversation_id, prompt, response, response_type, metadata, created_at
       FROM ai_chat_history
       WHERE user_id = ?
       ORDER BY created_at ASC`,
      [userId],
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Lỗi lấy lịch sử AI:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};
