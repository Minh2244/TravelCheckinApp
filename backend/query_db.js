const mysql = require('mysql2/promise');

async function main() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'Minhmap3367@',
    database: 'TravelCheckinApp'
  });

  try {
    const [rows] = await connection.query('SELECT * FROM pos_tables WHERE table_id = 21');
    console.log(rows[0]);
  } catch (err) {
    console.error(err);
  } finally {
    await connection.end();
  }
}

main();
