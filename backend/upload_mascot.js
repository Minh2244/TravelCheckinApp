const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function run() {
  console.log('Đang kết nối tới Database...');
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    // 1. Tạo danh mục (Category)
    const categoryName = 'Mascot_Mobile';
    let [rows] = await connection.execute('SELECT id FROM image_categories WHERE name = ?', [categoryName]);
    let categoryId;
    if (rows.length === 0) {
      const [result] = await connection.execute(
        'INSERT INTO image_categories (name, max_width, max_height, quality, max_file_size) VALUES (?, ?, ?, ?, ?)',
        [categoryName, 800, 800, 90, 5242880]
      );
      categoryId = result.insertId;
      console.log('✅ Đã tạo danh mục ảnh mới:', categoryName, '(ID:', categoryId, ')');
    } else {
      categoryId = rows[0].id;
      console.log('✅ Đã tìm thấy danh mục:', categoryName, '(ID:', categoryId, ')');
    }

    // 2. Đọc ảnh từ thư mục lưu trữ của hệ thống
    const imagePath = 'C:\\Users\\admin\\.gemini\\antigravity-ide\\brain\\ab7271ff-643b-4f00-ab6f-4a4450442c59\\media__1781750735728.jpg';
    if (!fs.existsSync(imagePath)) {
        throw new Error("Không tìm thấy file ảnh tại đường dẫn: " + imagePath);
    }
    const imageBuffer = fs.readFileSync(imagePath);
    const mimeType = 'image/jpeg';
    const fileSize = imageBuffer.length;
    
    // 3. Insert ảnh vào DB (upload_by = 1 giả định là Admin)
    const [imgResult] = await connection.execute(
      'INSERT INTO images (category_id, original_name, mime_type, file_size, data, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)',
      [categoryId, 'robot_mascot_login.jpg', mimeType, fileSize, imageBuffer, 1] // Giả sử user ID 1 là admin
    );
    console.log('✅ Đã chèn ảnh Mascot vào Database thành công! Image ID:', imgResult.insertId);

  } catch (error) {
    console.error('❌ Lỗi:', error);
  } finally {
    await connection.end();
  }
}

run();
