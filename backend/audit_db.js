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
    console.log('=== HỆ THỐNG KIỂM TRA TOÀN DIỆN DATABASE DỊCH VỤ ĂN UỐNG ===\n');

    // 1. Kiểm tra cấu trúc các bảng liên quan đến POS
    console.log('1. Kiểm tra Schema POS & Bookings:');
    const [tables] = await pool.query('SHOW TABLES');
    const tableNames = tables.map(t => Object.values(t)[0]);
    console.log('- Các bảng hiện có:', tableNames.filter(name => name.startsWith('pos_') || name === 'bookings' || name === 'payments' || name === 'booking_table_reservations' || name === 'checkins'));

    // Kiểm tra cấu trúc pos_orders
    const [colsOrders] = await pool.query('DESCRIBE pos_orders');
    const orderCols = colsOrders.map(c => c.Field);
    console.log('- Các cột trong pos_orders:', orderCols);
    console.log('  * Có cột order_source:', orderCols.includes('order_source'));

    // Kiểm tra cấu trúc payments
    const [colsPayments] = await pool.query('DESCRIBE payments');
    const paymentCols = colsPayments.map(c => c.Field);
    console.log('- Các cột trong payments:', paymentCols);

    // 2. Tìm đơn hàng POS bị bỏ hoang hoặc không hợp lệ (stale orders)
    console.log('\n2. Quét Đơn Hàng POS Rác (Stale/Discarded Orders):');
    
    // Đơn hàng POS ở trạng thái 'open' nhưng bàn tương ứng đang 'free' hoặc 'reserved' (không có ai ngồi)
    const [staleOpenOrders] = await pool.query(`
      SELECT o.order_id, o.table_id, t.table_name, t.status AS table_status, o.created_at, o.subtotal_amount
      FROM pos_orders o
      JOIN pos_tables t ON t.table_id = o.table_id
      WHERE o.status = 'open' AND t.status IN ('free', 'reserved')
    `);
    console.log(`- Tìm thấy ${staleOpenOrders.length} đơn hàng 'open' rác trên bàn đang trống hoặc đặt trước:`);
    if (staleOpenOrders.length > 0) {
      console.log(staleOpenOrders.map(o => `  * Order #${o.order_id} trên ${o.table_name} (Trạng thái bàn: ${o.table_status}, tạo lúc: ${o.created_at}, tiền: ${o.subtotal_amount}đ)`).join('\n'));
    }

    // Đơn hàng pre-order online ở trạng thái 'open' nhưng booking tương ứng đã bị huỷ hoặc hoàn thành
    const [stalePreorders] = await pool.query(`
      SELECT o.order_id, b.booking_id, b.status AS booking_status, o.status AS order_status
      FROM pos_orders o
      JOIN bookings b ON b.pos_order_id = o.order_id
      WHERE o.status = 'open' AND b.status IN ('cancelled', 'completed')
    `);
    console.log(`- Tìm thấy ${stalePreorders.length} đơn pre-order 'open' nhưng booking đã huỷ/hoàn thành:`);
    if (stalePreorders.length > 0) {
      console.log(stalePreorders.map(o => `  * Order #${o.order_id} liên kết Booking #${o.booking_id} (Trạng thái Booking: ${o.booking_status})`).join('\n'));
    }

    // 3. Kiểm tra các reservation đặt bàn stale
    console.log('\n3. Quét Đặt Bàn Stale (Stale Reservations):');
    // Các đặt bàn có status 'active' nhưng thời gian bắt đầu đã trôi qua quá 6 tiếng mà chưa check-in
    const [staleReservations] = await pool.query(`
      SELECT r.reservation_id, r.booking_id, r.table_id, r.start_time, r.status
      FROM booking_table_reservations r
      WHERE r.status = 'active' AND r.start_time < DATE_SUB(NOW(), INTERVAL 6 HOUR)
    `);
    console.log(`- Tìm thấy ${staleReservations.length} đặt bàn 'active' quá hạn chưa check-in (quá 6 tiếng):`);
    if (staleReservations.length > 0) {
      console.log(staleReservations.map(r => `  * Reservation #${r.reservation_id} (Booking #${r.booking_id}, Table #${r.table_id}, bắt đầu: ${r.start_time})`).join('\n'));
    }

    // 4. Kiểm tra các thanh toán (payments) và đối soát doanh thu
    console.log('\n4. Kiểm tra Dữ Liệu Thanh Toán (Payments Audit):');
    // Các payment có amount = 0 của nhà hàng
    const [zeroPayments] = await pool.query(`
      SELECT p.payment_id, p.booking_id, p.amount, p.payment_time, p.notes
      FROM payments p
      WHERE p.status = 'completed' AND p.amount = 0 AND p.notes LIKE '%"service_type":"food"%'
    `);
    console.log(`- Tìm thấy ${zeroPayments.length} giao dịch thanh toán nhà hàng trị giá 0đ:`);
    if (zeroPayments.length > 0) {
      console.log(zeroPayments.slice(0, 10).map(p => `  * Payment #${p.payment_id} (Booking #${p.booking_id}, ngày: ${p.payment_time})`).join('\n'));
    }

  } catch (err) {
    console.error('Lỗi khi thực hiện audit:', err);
  } finally {
    await pool.end();
  }
}

main();
