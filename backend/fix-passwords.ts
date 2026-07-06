import bcrypt from "bcrypt";
import mysql from "mysql2/promise";
import * as dotenv from "dotenv";

dotenv.config();

async function run() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "TravelCheckinApp",
  });

  try {
    const [users] = await pool.query<any[]>(
      "SELECT user_id, phone FROM users WHERE role = 'employee'"
    );

    for (const user of users) {
      if (user.phone) {
        const hash = await bcrypt.hash(user.phone, 10);
        await pool.query(
          "UPDATE users SET password_hash = ? WHERE user_id = ?",
          [hash, user.user_id]
        );
        console.log(`Updated user_id ${user.user_id} with phone ${user.phone}`);
      }
    }
    console.log("Xong! Đã cập nhật mật khẩu cho tất cả nhân viên.");
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

run();
