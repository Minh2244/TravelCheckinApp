const mysql = require('mysql2');
const dotenv = require('dotenv');
dotenv.config();

async function main() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "Minhmap3367@",
    database: process.env.DB_NAME || "TravelCheckinApp",
    charset: "utf8mb4",
  }).promise();

  try {
    console.log('=== TIẾN HÀNH DỌN DẸP DATABASE DỊCH VỤ ĂN UỐNG ===\n');

    // 1. Chuyển trạng thái các đơn POS 'open' rác trên các bàn đang trống sang 'cancelled'
    const [cancelOpenOrders] = await pool.query(`
      UPDATE pos_orders o
      JOIN pos_tables t ON t.table_id = o.table_id
      SET o.status = 'cancelled', o.updated_at = CURRENT_TIMESTAMP
      WHERE o.status = 'open' AND t.status IN ('free', 'reserved')
    `);
    console.log(`- Đã hủy ${cancelOpenOrders.affectedRows} đơn POS 'open' rác của các bàn trống.`);

    // 2. Chuyển trạng thái các đơn pre-order 'open' của các booking đã hủy/hoàn thành sang 'cancelled'
    const [cancelStalePreorders] = await pool.query(`
      UPDATE pos_orders o
      JOIN bookings b ON b.pos_order_id = o.order_id
      SET o.status = 'cancelled', o.updated_at = CURRENT_TIMESTAMP
      WHERE o.status = 'open' AND b.status IN ('cancelled', 'completed')
    `);
    console.log(`- Đã hủy ${cancelStalePreorders.affectedRows} đơn pre-order rác liên kết booking đã hủy/hoàn thành.`);

    // 3. Giải phóng đặt bàn 'active' quá hạn hơn 6 tiếng chưa check-in
    const [cancelStaleReservations] = await pool.query(`
      UPDATE booking_table_reservations
      SET status = 'cancelled', actual_end_time = NOW(), updated_at = CURRENT_TIMESTAMP
      WHERE status = 'active' AND start_time < DATE_SUB(NOW(), INTERVAL 6 HOUR)
    `);
    console.log(`- Đã hủy ${cancelStaleReservations.affectedRows} đặt bàn stale quá hạn chưa check-in.`);

    console.log('\n=== DỌN DẸP HOÀN THÀNH! DATABASE SẠCH SẼ 100% ===');
  } catch (err) {
    console.error('Lỗi khi thực hiện dọn dẹp:', err);
  } finally {
    await pool.end();
  }
}

main();
