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

    // Thêm cột customer_id nếu chưa tồn tại (để phân biệt phòng chat riêng tư của từng khách hàng với địa điểm)
    try {
      const [columns]: any = await pool.query(`
        SHOW COLUMNS FROM location_chat_messages LIKE 'customer_id'
      `);
      if (columns.length === 0) {
        await pool.query(`
          ALTER TABLE location_chat_messages 
          ADD COLUMN customer_id INT NULL
        `);
        // Điền dữ liệu cho các dòng cũ
        await pool.query(`
          UPDATE location_chat_messages 
          SET customer_id = sender_id
        `);
        // Chuyển sang NOT NULL
        await pool.query(`
          ALTER TABLE location_chat_messages 
          MODIFY COLUMN customer_id INT NOT NULL
        `);
        console.log("✅ Đã bổ sung cột customer_id vào bảng location_chat_messages!");
      }
    } catch (colError) {
      console.error("⚠️ Lỗi khi nâng cấp cột customer_id:", colError);
    }

    // Thêm cột image_data nếu chưa tồn tại (lưu dữ liệu ảnh base64 trực tiếp vào database)
    try {
      const [columns]: any = await pool.query(`
        SHOW COLUMNS FROM location_chat_messages LIKE 'image_data'
      `);
      if (columns.length === 0) {
        await pool.query(`
          ALTER TABLE location_chat_messages 
          ADD COLUMN image_data LONGTEXT NULL
        `);
        console.log("✅ Đã bổ sung cột image_data vào bảng location_chat_messages!");
      }
    } catch (colError) {
      console.error("⚠️ Lỗi khi nâng cấp cột image_data:", colError);
    }

    console.log("✅ Khởi tạo cấu trúc bảng location_chat_messages thành công!");
  } catch (error) {
    console.error("❌ Lỗi khi khởi tạo schema location_chat_messages:", error);
  }
};
