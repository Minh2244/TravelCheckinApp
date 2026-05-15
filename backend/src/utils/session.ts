import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../config/database";

const ensureUserSessionSchema = async () => {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS user_active_sessions (
       user_id INT PRIMARY KEY,
       session_id VARCHAR(64) NOT NULL,
       created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
       updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  );
};

export const getActiveSessionId = async (
  userId: number,
): Promise<string | null> => {
  await ensureUserSessionSchema();
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
  await ensureUserSessionSchema();
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
  await ensureUserSessionSchema();
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
