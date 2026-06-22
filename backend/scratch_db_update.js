const mysql = require('mysql2/promise');

async function run() {
  const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'Minhmap3367@',
    database: 'TravelCheckinApp'
  });
  
  try {
    console.log("Creating location_invoice_sequences table...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS location_invoice_sequences (
        location_id INT PRIMARY KEY,
        last_seq INT NOT NULL DEFAULT 0
      )
    `);
    console.log("Table created.");

    console.log("Adding invoice_seq to payments...");
    await pool.query('ALTER TABLE payments ADD COLUMN invoice_seq INT DEFAULT NULL');
    console.log("Column added.");
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log("Column already exists.");
    } else {
      console.error(err);
    }
  }
  
  process.exit(0);
}
run();
