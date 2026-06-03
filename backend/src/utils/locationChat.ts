import { pool } from "../config/database";

export const ensureLocationChatSchema = async (): Promise<void> => {
  try {
    // Tạo bảng lưu trữ tin nhắn chat của địa điểm
    await pool.query(`
      CREATE TABLE IF NOT EXISTS location_chat_messages (
        message_id INT AUTO_INCREMENT PRIMARY KEY,
        location_id INT NOT NULL,
        sender_id INT NOT NULL,
        sender_name VARCHAR(255) NOT NULL,
        sender_role VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_location_created (location_id, created_at)
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    `);
    console.log("✅ Khởi tạo cấu trúc bảng location_chat_messages thành công!");
  } catch (error) {
    console.error("❌ Lỗi khi khởi tạo schema location_chat_messages:", error);
  }
};
