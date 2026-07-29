import { pool } from "./config/database";
import bcrypt from "bcryptjs";

async function run() {
  try {
    const hash = await bcrypt.hash("123456", 10);
    const [result] = await pool.query(
      "UPDATE users SET password_hash = ? WHERE email = ?",
      [hash, "memory3367@gmail.com"]
    );
    console.log("Password updated successfully:", result);
  } catch (err: any) {
    console.error("Error updating password:", err);
  } finally {
    await pool.end();
  }
}

run();
