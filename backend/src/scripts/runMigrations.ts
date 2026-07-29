import { pool } from "../config/database";

async function main() {
  try {
    await pool.query("ALTER TABLE locations ADD COLUMN pending_updates JSON NULL;");
    console.log("Added pending_updates to locations");
  } catch (err: any) {
    if (err.code !== 'ER_DUP_FIELDNAME') console.error(err);
  }

  try {
    await pool.query("ALTER TABLE locations ADD COLUMN temp_close_type ENUM('scheduled', 'manual') NULL;");
    console.log("Added temp_close_type to locations");
  } catch (err: any) {
    if (err.code !== 'ER_DUP_FIELDNAME') console.error(err);
  }

  try {
    await pool.query("ALTER TABLE locations ADD COLUMN temp_close_until DATETIME NULL;");
    console.log("Added temp_close_until to locations");
  } catch (err: any) {
    if (err.code !== 'ER_DUP_FIELDNAME') console.error(err);
  }

  try {
    await pool.query("ALTER TABLE services ADD COLUMN pending_updates JSON NULL;");
    console.log("Added pending_updates to services");
  } catch (err: any) {
    if (err.code !== 'ER_DUP_FIELDNAME') console.error(err);
  }

  console.log("Migrations done");
  process.exit(0);
}

main();
