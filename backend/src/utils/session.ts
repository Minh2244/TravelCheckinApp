import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../config/database";

export const getActiveSessionId = async (
  userId: number,
): Promise<string | null> => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT session_id FROM user_active_sessions WHERE user_id = ? LIMIT 1`,
    [userId],
  );
  const row = rows?.[0] as { session_id?: string } | undefined;
  return row?.session_id || null;
};

export const setActiveSessionId = async (
  userId: number,
  sessionId: string,
): Promise<void> => {
  await pool.query(
    `INSERT INTO user_active_sessions (user_id, session_id)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE session_id = VALUES(session_id), updated_at = NOW()`,
    [userId, sessionId],
  );
};

export const clearActiveSessionId = async (
  userId: number,
  sessionId?: string,
): Promise<void> => {
  if (sessionId) {
    await pool.query(
      `DELETE FROM user_active_sessions WHERE user_id = ? AND session_id = ?`,
      [userId, sessionId],
    );
    return;
  }
  await pool.query(`DELETE FROM user_active_sessions WHERE user_id = ?`, [
    userId,
  ]);
};
