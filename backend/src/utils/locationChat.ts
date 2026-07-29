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

    // Thêm cột customer_id nếu chưa tồn tại
    try {
      const [columns]: any = await pool.query(`
        SHOW COLUMNS FROM location_chat_messages LIKE 'customer_id'
      `);
      if (columns.length === 0) {
        await pool.query(`
          ALTER TABLE location_chat_messages 
          ADD COLUMN customer_id INT NULL
        `);
        await pool.query(`
          UPDATE location_chat_messages 
          SET customer_id = sender_id
        `);
        await pool.query(`
          ALTER TABLE location_chat_messages 
          MODIFY COLUMN customer_id INT NOT NULL
        `);
        console.log("✅ Đã bổ sung cột customer_id vào bảng location_chat_messages!");
      }
    } catch (colError) {
      console.error("⚠️ Lỗi khi nâng cấp cột customer_id:", colError);
    }

    // Thêm cột image_data nếu chưa tồn tại
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

    // ✅ Thêm index composite (location_id, customer_id, message_id) để tăng tốc query afterId
    try {
      const [indexes]: any = await pool.query(`
        SHOW INDEX FROM location_chat_messages WHERE Key_name = 'idx_loc_cust_msgid'
      `);
      if (indexes.length === 0) {
        await pool.query(`
          ALTER TABLE location_chat_messages
          ADD INDEX idx_loc_cust_msgid (location_id, customer_id, message_id)
        `);
        console.log("✅ Đã thêm index idx_loc_cust_msgid vào bảng location_chat_messages!");
      }
    } catch (idxError) {
      console.error("⚠️ Lỗi khi thêm index idx_loc_cust_msgid:", idxError);
    }

    // Thêm cột is_deleted_for_customer nếu chưa tồn tại
    try {
      const [columns]: any = await pool.query(`
        SHOW COLUMNS FROM location_chat_messages LIKE 'is_deleted_for_customer'
      `);
      if (columns.length === 0) {
        await pool.query(`
          ALTER TABLE location_chat_messages 
          ADD COLUMN is_deleted_for_customer BOOLEAN DEFAULT FALSE,
          ADD COLUMN is_deleted_for_owner BOOLEAN DEFAULT FALSE
        `);
        console.log("✅ Đã bổ sung cột is_deleted_for_customer và is_deleted_for_owner vào bảng location_chat_messages!");
      }
    } catch (colError) {
      console.error("⚠️ Lỗi khi nâng cấp cột soft delete:", colError);
    }

    console.log("✅ Khởi tạo cấu trúc bảng location_chat_messages thành công!");
  } catch (error) {
    console.error("❌ Lỗi khi khởi tạo schema location_chat_messages:", error);
  }
};

