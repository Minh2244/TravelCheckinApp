const mysql = require('mysql2/promise');

async function run() {
  const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'Minhmap3367@',
    database: 'TravelCheckinApp'
  });
  
  try {
    await pool.query('ALTER TABLE payments ADD COLUMN invoice_code VARCHAR(50) UNIQUE DEFAULT NULL');
    console.log("Success");
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log("Column already exists");
    } else {
      console.error(err);
    }
  }
  
  process.exit(0);
}
run();
