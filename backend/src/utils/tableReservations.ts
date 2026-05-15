import type { PoolConnection } from "mysql2/promise";
import { pool } from "../config/database";

export const TABLE_RESERVATION_SLOT_MINUTES = 60;
export const TABLE_RESERVATION_OWNER_WINDOW_MINUTES = 60;

type SqlExecutor = Pick<PoolConnection, "query">;

let ensureSchemaPromise: Promise<void> | null = null;

export const formatMysqlDateTime = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  const hour = String(value.getHours()).padStart(2, "0");
  const minute = String(value.getMinutes()).padStart(2, "0");
  const second = String(value.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
};

export const computeTableReservationEnd = (checkIn: Date): Date => {
  return new Date(
    checkIn.getTime() + TABLE_RESERVATION_SLOT_MINUTES * 60 * 1000,
  );
};

export const computeOwnerReservationWindowStart = (checkIn: Date): Date => {
  return new Date(
    checkIn.getTime() - TABLE_RESERVATION_OWNER_WINDOW_MINUTES * 60 * 1000,
  );
};

export const ensureBookingTableReservationsSchema = async (): Promise<void> => {
  if (ensureSchemaPromise) return ensureSchemaPromise;

  ensureSchemaPromise = (async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS booking_table_reservations (
        reservation_id BIGINT NOT NULL AUTO_INCREMENT,
        booking_id INT NOT NULL,
        table_id INT NOT NULL,
        location_id INT NOT NULL,
        start_time DATETIME NOT NULL,
        end_time DATETIME NOT NULL,
        status ENUM('active','checked_in','cancelled','no_show','released') NOT NULL DEFAULT 'active',
        checked_in_at DATETIME NULL DEFAULT NULL,
        actual_end_time DATETIME NULL DEFAULT NULL,
        cancelled_at DATETIME NULL DEFAULT NULL,
        cancelled_by_user_id INT NULL DEFAULT NULL,
        created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (reservation_id),
        UNIQUE KEY uniq_booking_table_reservation (booking_id, table_id),
        KEY idx_table_reservation_lookup (table_id, status, start_time, end_time),
        KEY idx_booking_table_reservation_booking (booking_id),
        KEY idx_booking_table_reservation_location (location_id, status, start_time),
        CONSTRAINT booking_table_reservations_fk_booking FOREIGN KEY (booking_id) REFERENCES bookings (booking_id) ON DELETE CASCADE,
        CONSTRAINT booking_table_reservations_fk_table FOREIGN KEY (table_id) REFERENCES pos_tables (table_id) ON DELETE RESTRICT,
        CONSTRAINT booking_table_reservations_fk_location FOREIGN KEY (location_id) REFERENCES locations (location_id) ON DELETE CASCADE,
        CONSTRAINT booking_table_reservations_fk_cancelled_by FOREIGN KEY (cancelled_by_user_id) REFERENCES users (user_id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    const [legacyRows] = await pool.query<any[]>(
      `SELECT COUNT(*) AS cnt
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'booking_pos_tables'`,
    );
    const hasLegacyTable = Number(legacyRows?.[0]?.cnt || 0) > 0;

    if (hasLegacyTable) {
      await pool.query(
        `
        INSERT INTO booking_table_reservations (
          booking_id,
          table_id,
          location_id,
          start_time,
          end_time,
          status,
          created_at,
          updated_at
        )
        SELECT
          bpt.booking_id,
          bpt.table_id,
          b.location_id,
          b.check_in_date,
          DATE_ADD(b.check_in_date, INTERVAL ? MINUTE),
          CASE
            WHEN b.status = 'cancelled' THEN 'cancelled'
            WHEN b.status = 'completed' THEN 'released'
            ELSE 'active'
          END,
          COALESCE(bpt.created_at, b.created_at, CURRENT_TIMESTAMP),
          COALESCE(b.updated_at, b.created_at, CURRENT_TIMESTAMP)
        FROM booking_pos_tables bpt
        JOIN bookings b ON b.booking_id = bpt.booking_id
        LEFT JOIN booking_table_reservations r
          ON r.booking_id = bpt.booking_id
         AND r.table_id = bpt.table_id
        WHERE r.reservation_id IS NULL
      `,
        [TABLE_RESERVATION_SLOT_MINUTES],
      );

      await pool.query(`DROP TABLE IF EXISTS booking_pos_tables`);
    }
  })().catch((error) => {
    ensureSchemaPromise = null;
    throw error;
  });

  return ensureSchemaPromise;
};

export const releaseTableReservations = async (
  executor: SqlExecutor,
  params: {
    bookingId?: number | null;
    tableId?: number | null;
    actualEndTime?: Date;
  },
): Promise<void> => {
  const { bookingId, tableId, actualEndTime } = params;
  const filters: string[] = [
    "status IN ('active','checked_in')",
    "actual_end_time IS NULL",
  ];
  const queryParams: Array<number | string> = [];

  if (Number.isFinite(Number(bookingId))) {
    filters.push("booking_id = ?");
    queryParams.push(Number(bookingId));
  }
  if (Number.isFinite(Number(tableId))) {
    filters.push("table_id = ?");
    queryParams.push(Number(tableId));
  }
  if (queryParams.length === 0) return;

  await executor.query(
    `UPDATE booking_table_reservations
     SET status = 'released',
         actual_end_time = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE ${filters.join(" AND ")}`,
    [formatMysqlDateTime(actualEndTime ?? new Date()), ...queryParams],
  );
};
