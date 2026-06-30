import { pool } from "../config/database";

export const ensureChatSchema = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        message_id BIGINT AUTO_INCREMENT PRIMARY KEY,
        location_id BIGINT NOT NULL,
        sender_id BIGINT NOT NULL,
        receiver_id BIGINT NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_location (location_id),
        INDEX idx_participants (sender_id, receiver_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log("Chat messages schema initialized.");
  } catch (error) {
    console.error("Error initializing chat schema:", error);
  }
};

