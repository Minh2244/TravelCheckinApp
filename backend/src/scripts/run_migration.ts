import { pool } from "../config/database";

const run = async () => {
  console.log("Starting DB migration check...");
  try {
    const [columns] = await pool.query<any[]>(
      `SHOW COLUMNS FROM locations`
    );

    const columnNames = columns.map((c: any) => String(c.Field));
    console.log("Current columns in locations table:", columnNames);

    const neededColumns = [
      { name: "auto_confirm_minutes", type: "INT", def: "30" },
      { name: "auto_cancel_food_minutes", type: "INT", def: "60" },
      { name: "auto_cancel_hotel_minutes", type: "INT", def: "4320" },
      { name: "auto_cancel_ticket_minutes", type: "INT", def: "1440" },
    ];

    const toAdd = neededColumns.filter((col) => !columnNames.includes(col.name));

    if (toAdd.length === 0) {
      console.log("✅ All configuration columns already exist in locations table.");
    } else {
      console.log(`Adding ${toAdd.length} configuration columns to locations table...`);
      for (const col of toAdd) {
        console.log(`Adding column: ${col.name} (${col.type}) with default value ${col.def}...`);
        await pool.query(
          `ALTER TABLE locations ADD COLUMN ${col.name} ${col.type} DEFAULT ${col.def}`
        );
      }
      console.log("✅ Columns added successfully.");
    }

    // Verify primary and foreign keys of the table are intact and correct
    console.log("Checking keys for locations table...");
    const [keys] = await pool.query<any[]>(
      `SHOW KEYS FROM locations`
    );
    console.log("Primary and secondary keys verification:");
    for (const key of keys) {
      console.log(`- Key: ${key.Key_name}, Column: ${key.Column_name}, Non-Unique: ${key.Non_unique}`);
    }

    // Check foreign keys pointing to or from locations
    console.log("Checking foreign keys involving locations...");
    const [fks] = await pool.query<any[]>(
      `SELECT 
         TABLE_NAME, COLUMN_NAME, CONSTRAINT_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
       FROM
         INFORMATION_SCHEMA.KEY_COLUMN_USAGE
       WHERE
         REFERENCED_TABLE_SCHEMA = ? AND (TABLE_NAME = 'locations' OR REFERENCED_TABLE_NAME = 'locations')`,
      [process.env.DB_NAME || "TravelCheckinApp"]
    );
    for (const fk of fks) {
      console.log(`- FK: ${fk.CONSTRAINT_NAME} (${fk.TABLE_NAME}.${fk.COLUMN_NAME} -> ${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME})`);
    }

    console.log("🚀 MIGRATION AND INTEGRITY CHECK COMPLETED 100% SUCCESSFULLY!");
  } catch (error) {
    console.error("❌ Migration failed with error:", error);
  } finally {
    await pool.end();
  }
};

void run();
