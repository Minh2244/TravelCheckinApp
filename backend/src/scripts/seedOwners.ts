import mysql from "mysql2/promise";
import dotenv from "dotenv";
import path from "path";

// Tải cấu hình biến môi trường
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const names = [
  "Thành", "Đạt", "Phúc", "Khang", "Tùng",
  "Ly", "Hân", "Mai", "Như", "Chi"
];

function getRandomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const removeAccents = (str: string) => {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
};

async function run() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "TravelCheckinApp",
  });

  console.log("Đã kết nối database!");

  try {
    // 0. Dọn dẹp tài khoản Owner ảo cũ
    console.log("Đang dọn dẹp các tài khoản Owner ảo cũ...");
    const [oldOwners] = await connection.execute<any>(
      "SELECT user_id FROM users WHERE role = 'owner' AND email LIKE '%@owner.demo.com'"
    );

    if (oldOwners.length > 0) {
      const ownerIds = oldOwners.map((u: any) => u.user_id).join(',');
      await connection.execute(`DELETE FROM owner_profiles WHERE owner_id IN (${ownerIds})`);
      await connection.execute(`DELETE FROM users WHERE user_id IN (${ownerIds})`);
    }

    // 1. Chuẩn bị Hash mật khẩu chung: "123456"
    const bcrypt = require("bcrypt");
    const defaultPasswordHash = await bcrypt.hash("123456", 10);

    // 2. Tạo 10 tài khoản Owner ảo mới
    console.log("Đang tạo thêm tài khoản Owner ảo...");
    
    for (const name of names) {
      const randomNum = getRandomInt(10, 99);
      const baseName = removeAccents(name.toLowerCase());
      const naturalUsername = `owner.${baseName}.${getRandomItem(["nguyen", "tran", "le", "pham"])}${randomNum}`;
      const email = `${naturalUsername}@owner.demo.com`; // Email riêng cho owner
      
      // Tạo User (role: owner)
      const [result] = await connection.execute<any>(
        `INSERT INTO users (
          full_name, email, username, password_hash, role, status, is_verified, verified_at
        ) VALUES (?, ?, ?, ?, 'owner', 'active', 1, CURRENT_TIMESTAMP)`,
        [name, email, naturalUsername, defaultPasswordHash]
      );
      
      const ownerId = result.insertId;

      // Chú ý: Ở Backend, Owner BẮT BUỘC phải có owner_profiles và approval_status = 'approved' mới login được
      await connection.execute(
        `INSERT INTO owner_profiles (
          owner_id, bank_account, bank_name, account_holder, approval_status, approved_at
        ) VALUES (?, '123456789', 'MB Bank', ?, 'approved', CURRENT_TIMESTAMP)`,
        [ownerId, name.toUpperCase()]
      );
    }

    console.log("Hoàn thành tạo 10 tài khoản Owner mẫu!");
    
  } catch (error) {
    console.error("Có lỗi xảy ra:", error);
  } finally {
    await connection.end();
  }
}

run();
