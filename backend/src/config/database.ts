// backend/src/config/database.ts
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

// 👇 QUAN TRỌNG: Thêm chữ 'export' vào đây để các file khác lấy được biến pool
export const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "TravelCheckinApp", // Đảm bảo tên DB đúng trong MySQL của bạn
  charset: "utf8mb4",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

pool.on("connection", (connection) => {
  void connection.query("SET NAMES utf8mb4 COLLATE utf8mb4_0900_ai_ci");
});

export const checkDatabaseConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log("✅ KẾT NỐI DATABASE MYSQL THÀNH CÔNG! 🚀");
    connection.release();
  } catch (error) {
    console.error("❌ KẾT NỐI DATABASE THẤT BẠI:", error);
    process.exit(1);
  }
};

export default pool;
