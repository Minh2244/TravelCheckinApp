import { pool } from "./config/database";

async function run() {
  console.log("--- START GETOWNERBOOKINGS TEST ---");
  const userId = 4; // Owner ID
  const locationId = 1;

  try {
    const start = Date.now();

    // 1. Run getOwnerBookings query
    const [bookings] = await pool.query(
      `SELECT
        b.*,
        u.full_name as user_name,
        u.email as user_email,
        u.phone as user_phone,
        l.location_name,
        l.address,
        l.location_type,
        l.owner_id,
        s.service_name,
        s.service_type,
        p.payment_id as latest_payment_id,
        p.status as latest_payment_status,
        p.amount as latest_payment_amount,
        p.notes as latest_payment_notes,
        pay.total_completed_paid_amount,
        pay.has_completed_transfer_payment,
        ck.has_verified_arrival
      FROM bookings b
      JOIN users u ON u.user_id = b.user_id
      JOIN locations l ON l.location_id = b.location_id
      JOIN services s ON s.service_id = b.service_id
      LEFT JOIN payments p
        ON p.payment_id = (
          SELECT p2.payment_id
          FROM payments p2
          WHERE p2.booking_id = b.booking_id
          ORDER BY p2.payment_id DESC
          LIMIT 1
        )
      LEFT JOIN (
        SELECT
          booking_id,
          COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0) AS total_completed_paid_amount,
          MAX(
            CASE
              WHEN status = 'completed' AND (
                LOWER(COALESCE(payment_method, '')) LIKE '%transfer%'
                OR LOWER(COALESCE(payment_method, '')) LIKE '%bank%'
                OR LOWER(COALESCE(payment_method, '')) LIKE '%chuyen%'
                OR LOWER(COALESCE(payment_method, '')) LIKE '%chuyển%'
                OR LOWER(COALESCE(payment_method, '')) LIKE '%vietqr%'
                OR LOWER(COALESCE(payment_method, '')) LIKE '%qr%'
                OR LOWER(COALESCE(payment_method, '')) LIKE '%thanh toan truoc%'
                OR LOWER(COALESCE(payment_method, '')) LIKE '%thanh toán trước%'
              )
              THEN 1 ELSE 0
            END
          ) AS has_completed_transfer_payment
        FROM payments
        WHERE booking_id IS NOT NULL
        GROUP BY booking_id
      ) pay ON pay.booking_id = b.booking_id
      LEFT JOIN (
        SELECT
          booking_id,
          MAX(CASE WHEN status = 'verified' THEN 1 ELSE 0 END) AS has_verified_arrival
        FROM checkins
        WHERE booking_id IS NOT NULL
        GROUP BY booking_id
      ) ck ON ck.booking_id = b.booking_id
      WHERE 1=1 AND (b.notes IS NULL OR b.notes NOT LIKE '%PREPAY_UNCONFIRMED%')
        AND l.owner_id = ?
        AND b.status = 'pending'
        AND b.location_id = ?
      ORDER BY b.created_at DESC
      LIMIT 200`,
      [userId, locationId]
    );

    console.log(`Main query loaded ${Array.isArray(bookings) ? bookings.length : 0} bookings in ${Date.now() - start}ms`);

    const bookingIds = (bookings as any[])
      .map((row) => Number((row as any).booking_id))
      .filter((id) => Number.isFinite(id));

    if (bookingIds.length > 0) {
      const startEnrich = Date.now();
      const [tableRows] = await pool.query(
        `SELECT r.booking_id, t.table_name
         FROM booking_table_reservations r
         JOIN pos_tables t ON t.table_id = r.table_id
         WHERE r.booking_id IN (?)
           AND r.status <> 'cancelled'
         ORDER BY t.table_name ASC`,
        [bookingIds]
      );
      console.log(`Enrich tables query loaded ${Array.isArray(tableRows) ? tableRows.length : 0} tables in ${Date.now() - startEnrich}ms`);
    }

  } catch (err: any) {
    console.error("Test failed:", err);
  } finally {
    await pool.end();
    console.log("--- END GETOWNERBOOKINGS TEST ---");
  }
}

run();
