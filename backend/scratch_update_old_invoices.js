const mysql = require("mysql2/promise");
require("dotenv").config();

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "Minhmap3367@",
    database: process.env.DB_NAME || "TravelCheckinApp",
  });

  console.log("Connected to DB. Starting backfill of invoice_code...");

  // 1. Reset sequences table to 0
  await conn.query(`TRUNCATE TABLE location_invoice_sequences`);

  // 2. Fetch all completed payments ordered by payment_id
  const [payments] = await conn.query(`
    SELECT p.payment_id, p.location_id, p.payment_time, b.service_id, s.service_type
    FROM payments p
    LEFT JOIN bookings b ON p.booking_id = b.booking_id
    LEFT JOIN services s ON b.service_id = s.service_id
    WHERE p.status = 'completed' AND p.invoice_code IS NULL
    ORDER BY p.payment_id ASC
  `);

  console.log(`Found ${payments.length} old payments to update.`);

  for (const p of payments) {
    const paymentId = p.payment_id;
    const locationId = p.location_id || 0;
    const paymentTime = p.payment_time || new Date();
    
    // Determine prefix based on location details
    let prefix = "DV";
    const [locRows] = await conn.query(`SELECT location_type FROM locations WHERE location_id = ?`, [locationId]);
    if (locRows.length > 0) {
      const type = locRows[0].location_type;
      if (type === "hotel" || type === "resort") {
        prefix = "KS";
      } else if (type === "restaurant" || type === "cafe") {
        prefix = "NH";
      } else if (type === "tourist") {
        prefix = "DL";
      }
    }

    // YYMMDD
    const d = new Date(paymentTime);
    const yy = String(d.getFullYear()).slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const dateStr = `${yy}${mm}${dd}`;

    // Get sequence
    await conn.query(
      `INSERT INTO location_invoice_sequences (location_id, last_seq) VALUES (?, 1)
       ON DUPLICATE KEY UPDATE last_seq = last_seq + 1`,
      [locationId]
    );

    const [seqRows] = await conn.query(
      `SELECT last_seq FROM location_invoice_sequences WHERE location_id = ?`,
      [locationId]
    );
    const seq = seqRows[0].last_seq;

    const invoiceCode = `${prefix}-${dateStr}-${seq}`;

    await conn.query(
      `UPDATE payments SET invoice_code = ? WHERE payment_id = ?`,
      [invoiceCode, paymentId]
    );

    console.log(`Updated payment_id ${paymentId} with invoice_code ${invoiceCode}`);
  }

  await conn.end();
  console.log("Done backfilling invoice_code.");
}

main().catch(console.error);
