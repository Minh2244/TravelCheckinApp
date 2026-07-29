import pool from "../config/database";

async function main() {
  try {
    const [cols] = await pool.query<any[]>("SHOW COLUMNS FROM push_notifications");
    console.log("push_notifications columns:", cols.map(c => c.Field));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
