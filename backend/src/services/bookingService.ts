import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import crypto from "crypto";
import { pool } from "../config/database";
import { extractOpenClose, isWithinOpeningHours } from "../utils/openingHours";
import type { OpeningHoursRaw } from "../utils/openingHours";
import { publishToUsers, type RealtimeEvent } from "../utils/realtime";
import {
  computeOwnerReservationWindowStart,
  computeTableReservationEnd,
  ensureBookingTableReservationsSchema,
} from "../utils/tableReservations";

export type BookingSource = "web" | "mobile" | "admin";
export type BookingStatus = "pending" | "confirmed" | "cancelled" | "completed";

type VoucherDiscountType = "percent" | "amount";
type VoucherServiceScope = "all" | "room" | "food" | "ticket" | "other";
type VoucherLocationScope =
  | "all"
  | "hotel"
  | "restaurant"
  | "tourist"
  | "cafe"
  | "resort"
  | "other";

type ServiceType = "room" | "table" | "ticket" | "food" | "combo" | "other";

const PREPAY_UNCONFIRMED_MARKER = "PREPAY_UNCONFIRMED";

export interface CreateBookingInput {
  userId: number;
  locationId: number;
  serviceId?: number | null;
  checkInDate: string;
  checkOutDate?: string | null;
  quantity: number;
  source?: BookingSource;
  contactName?: string | null;
  contactPhone?: string | null;
  notes?: string | null;
  voucherCode?: string | null;

  // If true: create booking + payment QR, but reserve table/room only after user confirms transfer.
  reserveOnConfirm?: boolean;

  // Table booking extensions
  tableIds?: number[] | null;
  preorderItems?: Array<{ serviceId: number; quantity: number }> | null;

  // Ticket booking extension: allow buying multiple ticket service types in one booking/payment
  ticketItems?: Array<{ serviceId: number; quantity: number }> | null;
}

export interface CreateBookingResult {
  bookingId: number;
  totalAmount: number;
  discountAmount: number;
  finalAmount: number;
  voucherCode: string | null;
  payment?: {
    paymentId: number;
    status: string;
    amount: number;
    transactionCode: string | null;
    qrData: unknown;
  } | null;
}

export interface CreateBookingBatchInput {
  userId: number;
  locationId: number;
  serviceIds: number[];
  checkInDate: string;
  checkOutDate?: string | null;
  source?: BookingSource;
  notes?: string | null;

  // If true: create bookings + payment QR, but reserve rooms only after user confirms transfer.
  reserveOnConfirm?: boolean;
}

const withPrepayUnconfirmedMarker = (raw: string | null | undefined) => {
  const base = String(raw || "").trim();
  if (base.includes(PREPAY_UNCONFIRMED_MARKER)) return base;
  return base
    ? `${base}\n${PREPAY_UNCONFIRMED_MARKER}`
    : PREPAY_UNCONFIRMED_MARKER;
};

export const reserveHotelStaysForBookingsIfMissing = async (params: {
  connection: any;
  bookingIds: number[];
  userId?: number;
}): Promise<void> => {
  const bookingIds = Array.from(
    new Set(
      (Array.isArray(params.bookingIds) ? params.bookingIds : [])
        .map((x) => Number(x))
        .filter((x) => Number.isFinite(x) && x > 0),
    ),
  );
  if (bookingIds.length === 0) return;

  const placeholders = bookingIds.map(() => "?").join(",");
  const [rows] = await params.connection.query(
    `SELECT b.booking_id,
            b.user_id,
            b.location_id,
            b.service_id,
            b.check_in_date,
            b.check_out_date,
            b.total_amount,
            b.discount_amount,
            b.final_amount,
            s.service_name,
            s.service_type,
            l.location_type,
            COALESCE(c.sort_order, 0) as category_sort_order
     FROM bookings b
     JOIN services s ON s.service_id = b.service_id
     JOIN locations l ON l.location_id = b.location_id
     LEFT JOIN service_categories c
       ON c.category_id = s.category_id AND c.deleted_at IS NULL
     WHERE b.booking_id IN (${placeholders})
     FOR UPDATE`,
    bookingIds,
  );

  const list = Array.isArray(rows) ? (rows as any[]) : [];
  for (const r of list) {
    if (String(r.service_type || "") !== "room") continue;
    if (!isHotelLikeLocationType(String(r.location_type || ""))) continue;

    const bookingId = Number(r.booking_id);
    const roomId = Number(r.service_id);
    const locationId = Number(r.location_id);
    const userId = Number(r.user_id);

    const [stayRows] = await params.connection.query(
      `SELECT stay_id
       FROM hotel_stays
       WHERE booking_id = ?
       LIMIT 1
       FOR UPDATE`,
      [bookingId],
    );
    if (Array.isArray(stayRows) && stayRows.length > 0) continue;

    const expectedIn = formatMysqlDateTime(new Date(r.check_in_date));
    const expectedOut = r.check_out_date
      ? formatMysqlDateTime(new Date(r.check_out_date))
      : formatMysqlDateTime(
          new Date(new Date(r.check_in_date).getTime() + 24 * 60 * 60 * 1000),
        );

    await ensureHotelRoomAndReserveWithConn({
      connection: params.connection,
      locationId,
      serviceId: roomId,
      serviceName: String(r.service_name || ""),
      derivedFloor: Number(r.category_sort_order ?? 0),
      userId,
      bookingId,
      expectedCheckinMysql: expectedIn,
      expectedCheckoutMysql: expectedOut,
      subtotalAmount: toNumber(r.total_amount),
      discountAmount: toNumber(r.discount_amount),
      finalAmount: toNumber(r.final_amount),
    });
  }
};

const publishPosUpdatedForLocation = async (params: {
  locationId: number;
  ownerId: number;
  event: RealtimeEvent;
}) => {
  const { locationId, ownerId, event } = params;
  try {
    const ids = new Set<number>();
    if (Number.isFinite(ownerId)) ids.add(ownerId);

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT employee_id
       FROM employee_locations
       WHERE owner_id = ? AND location_id = ? AND status = 'active'`,
      [ownerId, locationId],
    );

    for (const r of rows) {
      const id = Number((r as any).employee_id);
      if (Number.isFinite(id)) ids.add(id);
    }

    publishToUsers(Array.from(ids), event);
  } catch {
    // ignore realtime failures
  }
};

const publishHotelUpdatedForLocation = async (params: {
  locationId: number;
  ownerId: number;
  userIds?: number[];
  payload?: Record<string, unknown>;
}) => {
  const { locationId, ownerId, userIds = [], payload = {} } = params;
  try {
    const ids = new Set<number>();
    if (Number.isFinite(ownerId)) ids.add(ownerId);

    for (const uid of userIds) {
      const id = Number(uid);
      if (Number.isFinite(id) && id > 0) ids.add(id);
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT employee_id
       FROM employee_locations
       WHERE owner_id = ? AND location_id = ? AND status = 'active'`,
      [ownerId, locationId],
    );

    for (const r of rows) {
      const id = Number((r as any).employee_id);
      if (Number.isFinite(id)) ids.add(id);
    }

    if (ids.size === 0) return;
    publishToUsers(Array.from(ids), {
      type: "hotel_updated",
      location_id: locationId,
      ...payload,
    });
  } catch {
    // ignore realtime failures
  }
};

export interface CreateBookingBatchResult {
  bookingIds: number[];
  totalAmount: number;
  discountAmount: number;
  finalAmount: number;
  voucherCode: string | null;
}

export interface ConfirmTicketTransferResult {
  bookingId: number;
  paymentId: number;
  paymentStatus: string;
  issuedCount: number;
  issuedTickets: Array<{
    ticketId: number;
    serviceId: number;
    ticketCode: string;
    status: string;
    issuedAt: string | null;
  }>;
}

export interface ConfirmTableTransferResult {
  bookingId: number;
  paymentId: number;
  paymentStatus: string;
}

export interface ConfirmRoomTransferResult {
  bookingId: number;
  paymentId: number;
  paymentStatus: string;
}

export interface TableBookingReservationSummary {
  bookingId: number;
  locationId: number;
  locationName: string | null;
  bookingStatus: string;
  paymentStatus: string | null;
  checkInDate: string;
  startTime: string;
  endTime: string;
  tableIds: number[];
  tableNames: string[];
  contactName: string | null;
  contactPhone: string | null;
  canCancel: boolean;
  canPreorder: boolean;
  posOrderId: number | null;
}

export interface AttachTablePreorderResult {
  bookingId: number;
  posOrderId: number;
  preorderAmount: number;
}

interface ServiceAndLocationRow extends RowDataPacket {
  service_id: number;
  location_id: number;
  service_name?: string | null;
  category_sort_order?: number | null;
  service_type: ServiceType;
  price: string | number;
  service_status: string;
  admin_status: string;
  location_type: VoucherLocationScope;
  location_status: string;
  opening_hours?: OpeningHoursRaw;
  owner_id?: number;
}

const isHotelLikeLocationType = (
  t: unknown,
): t is Extract<VoucherLocationScope, "hotel" | "resort"> => {
  return t === "hotel" || t === "resort";
};

const ensureHotelRoomAndReserveWithConn = async (params: {
  connection: PoolConnection;
  locationId: number;
  serviceId: number;
  serviceName: string | null | undefined;
  derivedFloor: number;
  userId: number;
  bookingId: number;
  expectedCheckinMysql: string;
  expectedCheckoutMysql: string;
  subtotalAmount: number;
  discountAmount: number;
  finalAmount: number;
}): Promise<void> => {
  const {
    connection,
    locationId,
    serviceId,
    serviceName,
    derivedFloor,
    userId,
    bookingId,
    expectedCheckinMysql,
    expectedCheckoutMysql,
    subtotalAmount,
    discountAmount,
    finalAmount,
  } = params;

  const fullName = String(serviceName || "").trim();
  const roomNameRaw = fullName || `Phòng ${serviceId}`;
  const roomName =
    roomNameRaw.length > 20 ? roomNameRaw.slice(0, 20) : roomNameRaw;
  const floorNumber = Number.isFinite(derivedFloor) ? derivedFloor : 0;

  // Ensure room row exists (unique by location_id + service_id)
  let roomId: number | null = null;
  let roomStatus: string | null = null;

  const [roomRows] = await connection.query<RowDataPacket[]>(
    `SELECT room_id, status
     FROM hotel_rooms
     WHERE location_id = ? AND service_id = ?
     LIMIT 1
     FOR UPDATE`,
    [locationId, serviceId],
  );

  if (roomRows[0]) {
    roomId = Number(roomRows[0].room_id);
    roomStatus = String(roomRows[0].status || "");
  } else {
    try {
      await connection.query(
        `INSERT INTO hotel_rooms (location_id, service_id, area_id, floor_number, room_number, status)
         VALUES (?, ?, NULL, ?, ?, 'vacant')`,
        [locationId, serviceId, floorNumber, roomName],
      );
    } catch (e: any) {
      const msg = String(e?.message || "");
      // In race conditions, the room might be created by another transaction.
      if (!msg.includes("Duplicate")) throw e;
    }

    const [roomRows2] = await connection.query<RowDataPacket[]>(
      `SELECT room_id, status
       FROM hotel_rooms
       WHERE location_id = ? AND service_id = ?
       LIMIT 1
       FOR UPDATE`,
      [locationId, serviceId],
    );
    if (!roomRows2[0]) {
      throw new BookingError("Không thể khởi tạo phòng PMS", 500);
    }
    roomId = Number(roomRows2[0].room_id);
    roomStatus = String(roomRows2[0].status || "");
  }

  if (!Number.isFinite(roomId as number)) {
    throw new BookingError("room_id không hợp lệ", 500);
  }

  // Conflict check against PMS stays (owner may operate PMS without creating bookings)
  const [stayConflict] = await connection.query<RowDataPacket[]>(
    `SELECT stay_id
     FROM hotel_stays
     WHERE room_id = ?
       AND status IN ('reserved','inhouse')
       AND expected_checkin IS NOT NULL
       AND expected_checkout IS NOT NULL
       AND expected_checkin < ?
       AND expected_checkout > ?
     LIMIT 1
     FOR UPDATE`,
    [roomId, expectedCheckoutMysql, expectedCheckinMysql],
  );
  if (Array.isArray(stayConflict) && stayConflict.length > 0) {
    throw new BookingError(
      "Phòng đã có người đặt/đang ở trong thời gian này",
      409,
    );
  }

  // Occupied rooms should not be reserved.
  if (roomStatus === "occupied") {
    throw new BookingError("Phòng đang có khách", 409);
  }

  // Ensure stay exists for this booking
  const [stayRows] = await connection.query<RowDataPacket[]>(
    `SELECT stay_id, status
     FROM hotel_stays
     WHERE booking_id = ?
     LIMIT 1
     FOR UPDATE`,
    [bookingId],
  );

  if (!stayRows[0]) {
    await connection.query(
      `INSERT INTO hotel_stays (
        location_id,
        room_id,
        user_id,
        booking_id,
        status,
        checkin_time,
        expected_checkin,
        expected_checkout,
        subtotal_amount,
        discount_amount,
        final_amount,
        notes,
        created_by
      ) VALUES (?, ?, ?, ?, 'reserved', NULL, ?, ?, ?, ?, ?, ?, NULL)`,
      [
        locationId,
        roomId,
        userId,
        bookingId,
        expectedCheckinMysql,
        expectedCheckoutMysql,
        subtotalAmount,
        discountAmount,
        finalAmount,
        JSON.stringify({ source: "online_booking", booking_id: bookingId }),
      ],
    );
  } else {
    const cur = String(stayRows[0].status || "");
    if (cur !== "reserved") {
      // keep existing status if already checked-in by PMS; just sync expectations/amounts
    }
    await connection.query(
      `UPDATE hotel_stays
       SET user_id = COALESCE(user_id, ?),
           room_id = ?,
           expected_checkin = COALESCE(expected_checkin, ?),
           expected_checkout = COALESCE(expected_checkout, ?),
           subtotal_amount = ?,
           discount_amount = ?,
           final_amount = ?
       WHERE booking_id = ?`,
      [
        userId,
        roomId,
        expectedCheckinMysql,
        expectedCheckoutMysql,
        subtotalAmount,
        discountAmount,
        finalAmount,
        bookingId,
      ],
    );
  }

  // Mark room reserved (unless already occupied).
  await connection.query(
    `UPDATE hotel_rooms
     SET status = 'reserved'
     WHERE room_id = ? AND status <> 'occupied'`,
    [roomId],
  );
};

interface VoucherRow extends RowDataPacket {
  voucher_id: number;
  code: string;
  discount_type: VoucherDiscountType;
  discount_value: string | number;
  apply_to_service_type: VoucherServiceScope;
  apply_to_location_type: VoucherLocationScope;
  min_order_value: string | number;
  max_discount_amount: string | number | null;
  usage_limit: number;
  used_count: number;
  max_uses_per_user: number;
}

interface UserSnapshotRow extends RowDataPacket {
  full_name: string | null;
  email: string | null;
}

class BookingError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

const normalizeServiceTypeForVoucher = (
  serviceType: ServiceType,
): VoucherServiceScope => {
  // Vì sao: DB services.service_type có thêm 'combo'/'table' nhưng voucher chỉ hỗ trợ room/food/ticket/other.
  // Quy ước: 'combo' và 'table' được xem là 'other'.
  if (serviceType === "room") return "room";
  if (serviceType === "food") return "food";
  if (serviceType === "ticket") return "ticket";
  return "other";
};

const toNumber = (v: string | number | null | undefined): number => {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const toUniquePositiveInts = (value: unknown): number[] => {
  if (!Array.isArray(value)) return [];
  const out: number[] = [];
  const seen = new Set<number>();
  for (const x of value) {
    const n = Number(x);
    if (!Number.isFinite(n) || n <= 0) continue;
    const v = Math.trunc(n);
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
};

const normalizePreorderItems = (
  value: unknown,
): Array<{ serviceId: number; quantity: number }> => {
  if (!Array.isArray(value)) return [];
  const map = new Map<number, number>();
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const sid = Number((raw as any).serviceId ?? (raw as any).service_id);
    const qty = Number((raw as any).quantity);
    if (!Number.isFinite(sid) || sid <= 0) continue;
    if (!Number.isFinite(qty) || qty <= 0) continue;
    const s = Math.trunc(sid);
    const q = Math.trunc(qty);
    map.set(s, (map.get(s) ?? 0) + q);
  }
  return Array.from(map.entries()).map(([serviceId, quantity]) => ({
    serviceId,
    quantity,
  }));
};

const ensureBookingPreorderItemsSchema = async (): Promise<void> => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS booking_preorder_items (
      preorder_item_id INT AUTO_INCREMENT PRIMARY KEY,
      booking_id INT NOT NULL,
      location_id INT NOT NULL,
      service_id INT NOT NULL,
      service_name_snapshot VARCHAR(255) NULL,
      quantity INT NOT NULL DEFAULT 1,
      unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
      line_total DECIMAL(12,2) NOT NULL DEFAULT 0,
      source VARCHAR(32) NOT NULL DEFAULT 'preorder',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_booking_preorder_booking (booking_id),
      KEY idx_booking_preorder_location (location_id),
      KEY idx_booking_preorder_service (service_id)
    )
  `);
};

const ensureTableServiceForLocation = async (params: {
  locationId: number;
}): Promise<number> => {
  const { locationId } = params;
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT service_id
     FROM services
     WHERE location_id = ?
       AND service_type = 'table'
       AND deleted_at IS NULL
     ORDER BY service_id ASC
     LIMIT 1`,
    [locationId],
  );
  if (rows?.[0]) {
    const id = Number(rows[0].service_id);
    if (Number.isFinite(id)) return id;
  }

  // Create a default "Đặt bàn" service for this location.
  // Notes: keep it approved/available so public booking can work out-of-the-box.
  const [ins] = await pool.query<any>(
    `INSERT INTO services (
       location_id,
       category_id,
       service_name,
       service_type,
       description,
       price,
       quantity,
       unit,
       status,
       images,
       admin_status,
       admin_reviewed_by,
       admin_reviewed_at
     ) VALUES (?, NULL, 'Đặt bàn', 'table', NULL, 0.00, 9999, 'Bàn', 'available', NULL, 'approved', NULL, NOW())`,
    [locationId],
  );
  const insertId = Number(ins?.insertId);
  if (!Number.isFinite(insertId)) {
    throw new BookingError("Không thể khởi tạo dịch vụ đặt bàn", 500);
  }
  return insertId;
};

const roundMoney = (v: number): number => {
  return Math.round(v * 100) / 100;
};

const PERSON_NAME_PATTERN = /^[A-Za-zÀ-ỹ]+(?:\s+[A-Za-zÀ-ỹ]+)*$/u;
const PHONE_PATTERN = /^0\d{9}$/;

const normalizePersonName = (value: string | null | undefined): string => {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
};

const isValidPersonName = (value: string): boolean => {
  return PERSON_NAME_PATTERN.test(normalizePersonName(value));
};

const isValidPhoneNumber = (value: string): boolean => {
  return PHONE_PATTERN.test(String(value || "").trim());
};

const pad2 = (n: number): string => String(n).padStart(2, "0");

const formatMysqlDateTime = (d: Date): string => {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
};

const parseLocalDateTimeInput = (
  raw: string,
): { date: Date; mysql: string } => {
  const s = String(raw ?? "").trim();
  if (!s) throw new BookingError("Thời gian không hợp lệ", 400);

  const mDate =
    /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(s) ??
    /^([0-9]{4})-([0-9]{2})-([0-9]{2})[T ]([0-9]{2}):([0-9]{2})(?::([0-9]{2}))?$/.exec(
      s,
    );

  if (!mDate) {
    throw new BookingError("Thời gian không hợp lệ", 400);
  }

  const year = Number(mDate[1]);
  const month = Number(mDate[2]);
  const day = Number(mDate[3]);
  const hour = mDate[4] == null ? 0 : Number(mDate[4]);
  const minute = mDate[5] == null ? 0 : Number(mDate[5]);
  const second = mDate[6] == null ? 0 : Number(mDate[6]);

  const ok =
    Number.isInteger(year) &&
    Number.isInteger(month) &&
    Number.isInteger(day) &&
    Number.isInteger(hour) &&
    Number.isInteger(minute) &&
    Number.isInteger(second) &&
    year >= 1970 &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= 31 &&
    hour >= 0 &&
    hour <= 23 &&
    minute >= 0 &&
    minute <= 59 &&
    second >= 0 &&
    second <= 59;

  if (!ok) throw new BookingError("Thời gian không hợp lệ", 400);

  const d = new Date(year, month - 1, day, hour, minute, second, 0);
  if (Number.isNaN(d.getTime()))
    throw new BookingError("Thời gian không hợp lệ", 400);

  // Guard against JS Date overflow (e.g., 2026-02-31)
  if (
    d.getFullYear() !== year ||
    d.getMonth() !== month - 1 ||
    d.getDate() !== day ||
    d.getHours() !== hour ||
    d.getMinutes() !== minute
  ) {
    throw new BookingError("Thời gian không hợp lệ", 400);
  }

  return { date: d, mysql: formatMysqlDateTime(d) };
};

const getMaxAdvanceLimitEnd = (now: Date): Date => {
  // Cho phép đặt trong hôm nay + 3 ngày tới (tính theo ngày dương lịch địa phương)
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const end = new Date(startOfToday);
  end.setDate(end.getDate() + 4); // start of day (today+4)
  end.setMilliseconds(end.getMilliseconds() - 1); // end of (today+3)
  return end;
};

const computeTicketValidUntil = (
  openingHours: OpeningHoursRaw,
  useDate: Date,
): Date => {
  // Vé chỉ có hạn trong 1 ngày, hết hạn khi tới giờ đóng cửa.
  const oc = extractOpenClose(openingHours, useDate);
  if (!oc) {
    return new Date(
      useDate.getFullYear(),
      useDate.getMonth(),
      useDate.getDate(),
      23,
      59,
      59,
      0,
    );
  }

  const [oh, om] = oc.open.split(":").map((x) => Number(x));
  const [ch, cm] = oc.close.split(":").map((x) => Number(x));

  const openMin = oh * 60 + om;
  const closeMin = ch * 60 + cm;

  if (openMin === closeMin) {
    return new Date(
      useDate.getFullYear(),
      useDate.getMonth(),
      useDate.getDate(),
      23,
      59,
      59,
      0,
    );
  }

  const close = new Date(
    useDate.getFullYear(),
    useDate.getMonth(),
    useDate.getDate(),
    ch,
    cm,
    0,
    0,
  );

  // overnight schedule: close is on the next day
  if (openMin > closeMin) close.setDate(close.getDate() + 1);
  return close;
};

const randomTransactionCode = (bookingId: number): string => {
  return `BK-${bookingId}-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
};

const validateVoucherForBooking = async (params: {
  connection: PoolConnection;
  userId: number;
  voucherCode: string;
  locationId: number;
  locationType: VoucherLocationScope;
  serviceType: ServiceType;
  totalAmount: number;
  consumeUsage: boolean;
}): Promise<{
  discountAmount: number;
  finalAmount: number;
  voucherId: number;
}> => {
  const {
    connection,
    userId,
    voucherCode,
    locationId,
    locationType,
    serviceType,
    totalAmount,
    consumeUsage,
  } = params;

  // Vì sao:
  // - Voucher hệ thống: do admin tạo (users.role='admin'), có thể global (location_id NULL) hoặc gắn riêng 1 location.
  // - Voucher của owner: do owner tạo (users.role='owner'), chỉ áp dụng cho đúng location thuộc owner đó.
  let voucherRows: VoucherRow[] = [];
  try {
    const [rows] = await connection.query<VoucherRow[]>(
      `SELECT
         v.voucher_id,
         v.code,
         v.discount_type,
         v.discount_value,
         v.apply_to_service_type,
         v.apply_to_location_type,
         v.min_order_value,
         v.max_discount_amount,
         v.usage_limit,
         v.used_count,
         v.max_uses_per_user
       FROM vouchers v
       JOIN users u ON v.owner_id = u.user_id
       WHERE v.code = ?
         AND v.status = 'active'
         AND (
           (
             u.role = 'admin'
             AND (
               v.location_id = ?
               OR (
                 v.location_id IS NULL
                 AND (
                   NOT EXISTS (
                     SELECT 1 FROM voucher_locations vl
                     WHERE vl.voucher_id = v.voucher_id
                   )
                   OR EXISTS (
                     SELECT 1 FROM voucher_locations vl
                     WHERE vl.voucher_id = v.voucher_id AND vl.location_id = ?
                   )
                 )
               )
             )
           )
           OR
           (
             u.role = 'owner'
             AND (
               v.location_id = ?
               OR (
                 v.location_id IS NULL
                 AND EXISTS (
                   SELECT 1 FROM voucher_locations vl
                   WHERE vl.voucher_id = v.voucher_id AND vl.location_id = ?
                 )
               )
             )
             AND EXISTS (
               SELECT 1 FROM locations l
               WHERE l.location_id = ? AND l.owner_id = u.user_id
             )
           )
         )
         AND v.start_date <= NOW()
         AND v.end_date >= NOW()
       FOR UPDATE`,
      [voucherCode, locationId, locationId, locationId, locationId, locationId],
    );
    voucherRows = rows;
  } catch (err: any) {
    const isMissingVoucherLocationsTable =
      err?.code === "ER_NO_SUCH_TABLE" &&
      String(err?.message || "").includes("voucher_locations");
    if (!isMissingVoucherLocationsTable) throw err;

    // Backward-compatible fallback (single location_id / all)
    const [rows] = await connection.query<VoucherRow[]>(
      `SELECT
         v.voucher_id,
         v.code,
         v.discount_type,
         v.discount_value,
         v.apply_to_service_type,
         v.apply_to_location_type,
         v.min_order_value,
         v.max_discount_amount,
         v.usage_limit,
         v.used_count,
         v.max_uses_per_user
       FROM vouchers v
       JOIN users u ON v.owner_id = u.user_id
       WHERE v.code = ?
         AND v.status = 'active'
         AND (
           (u.role = 'admin' AND (v.location_id IS NULL OR v.location_id = ?))
           OR
           (u.role = 'owner' AND v.location_id = ? AND EXISTS (
              SELECT 1 FROM locations l
              WHERE l.location_id = ? AND l.owner_id = u.user_id
           ))
         )
         AND v.start_date <= NOW()
         AND v.end_date >= NOW()
       FOR UPDATE`,
      [voucherCode, locationId, locationId, locationId],
    );
    voucherRows = rows;
  }

  if (voucherRows.length === 0) {
    throw new BookingError("Voucher không hợp lệ hoặc đã hết hạn", 400);
  }

  const voucher = voucherRows[0];

  if (voucher.used_count >= voucher.usage_limit) {
    throw new BookingError("Voucher đã hết lượt sử dụng", 400);
  }

  if (
    voucher.apply_to_location_type !== "all" &&
    voucher.apply_to_location_type !== locationType
  ) {
    throw new BookingError("Voucher không áp dụng cho loại địa điểm này", 400);
  }

  const normalizedServiceType = normalizeServiceTypeForVoucher(serviceType);
  if (
    voucher.apply_to_service_type !== "all" &&
    voucher.apply_to_service_type !== normalizedServiceType
  ) {
    throw new BookingError("Voucher không áp dụng cho dịch vụ này", 400);
  }

  const minOrderValue = toNumber(voucher.min_order_value);
  if (totalAmount < minOrderValue) {
    throw new BookingError(
      "Giá trị đơn hàng chưa đạt mức tối thiểu để áp voucher",
      400,
    );
  }

  // Vì sao: Ràng buộc max_uses_per_user giúp tránh 1 user lạm dụng voucher.
  const [usedCountRows] = await connection.query<RowDataPacket[]>(
    `SELECT COUNT(*) as cnt
     FROM bookings
     WHERE user_id = ?
       AND voucher_code = ?
       AND status IN ('pending','confirmed','completed')`,
    [userId, voucherCode],
  );

  const usedByUser = Number(usedCountRows[0]?.cnt || 0);
  const maxUsesPerUser = Number(voucher.max_uses_per_user || 1);
  if (usedByUser >= maxUsesPerUser) {
    throw new BookingError("Bạn đã dùng voucher này quá số lần cho phép", 400);
  }

  const discountValue = toNumber(voucher.discount_value);
  const maxDiscountAmount =
    voucher.max_discount_amount == null
      ? null
      : toNumber(voucher.max_discount_amount);

  let discountAmount = 0;

  if (voucher.discount_type === "percent") {
    discountAmount = (totalAmount * discountValue) / 100;
    if (maxDiscountAmount != null) {
      discountAmount = Math.min(discountAmount, maxDiscountAmount);
    }
  } else {
    discountAmount = discountValue;
  }

  discountAmount = Math.min(discountAmount, totalAmount);
  discountAmount = roundMoney(discountAmount);

  const finalAmount = roundMoney(totalAmount - discountAmount);

  if (consumeUsage) {
    await connection.query(
      `UPDATE vouchers SET used_count = used_count + 1 WHERE voucher_id = ?`,
      [voucher.voucher_id],
    );
  }

  return { discountAmount, finalAmount, voucherId: voucher.voucher_id };
};

export const createBooking = async (
  input: CreateBookingInput,
): Promise<CreateBookingResult> => {
  await ensureBookingTableReservationsSchema();
  await ensureBookingPreorderItemsSchema();

  const {
    userId,
    locationId,
    serviceId: rawServiceId,
    checkInDate,
    checkOutDate = null,
    quantity: rawQuantity,
    source = "mobile",
    contactName: rawContactName = null,
    contactPhone: rawContactPhone = null,
    notes = null,
    voucherCode = null,
    reserveOnConfirm = false,
    tableIds: rawTableIds = null,
    preorderItems: rawPreorderItems = null,
    ticketItems: rawTicketItems = null,
  } = input;

  const tableIds = toUniquePositiveInts(rawTableIds);
  const preorderItems = normalizePreorderItems(rawPreorderItems);
  const ticketItems = normalizePreorderItems(rawTicketItems);

  const totalTicketQty = ticketItems.reduce((sum, it) => sum + it.quantity, 0);
  if (ticketItems.length > 0 && totalTicketQty > 50) {
    throw new BookingError("Chỉ được mua tối đa 50 vé mỗi lần", 400);
  }

  const effectiveServiceId =
    ticketItems.length > 0
      ? Number(ticketItems[0].serviceId)
      : rawServiceId != null && Number.isFinite(Number(rawServiceId))
        ? Number(rawServiceId) > 0
          ? Number(rawServiceId)
          : NaN
        : tableIds.length > 0
          ? await ensureTableServiceForLocation({ locationId })
          : NaN;

  if (!Number.isFinite(effectiveServiceId)) {
    throw new BookingError("Thiếu serviceId", 400);
  }

  let quantity = Number(rawQuantity);
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new BookingError("quantity không hợp lệ", 400);
  }

  if (ticketItems.length > 0) {
    quantity = totalTicketQty;
  }

  const serviceRows: ServiceAndLocationRow[] = await (async () => {
    if (ticketItems.length > 0) {
      const uniqTicketServiceIds = Array.from(
        new Set(ticketItems.map((it) => Number(it.serviceId))),
      ).filter((x) => Number.isFinite(x));
      const placeholders = uniqTicketServiceIds.map(() => "?").join(",");
      const [rows] = await pool.query<ServiceAndLocationRow[]>(
        `SELECT
           s.service_id,
           s.location_id,
           s.service_name,
           s.service_type,
           s.price,
           s.status as service_status,
           s.admin_status,
           l.location_type,
           l.status as location_status,
           l.opening_hours,
           l.owner_id,
           c.sort_order as category_sort_order
         FROM services s
         LEFT JOIN service_categories c
           ON c.category_id = s.category_id AND c.deleted_at IS NULL
         JOIN locations l ON l.location_id = s.location_id
         WHERE s.location_id = ?
           AND s.service_id IN (${placeholders})`,
        [locationId, ...uniqTicketServiceIds],
      );

      if (rows.length !== uniqTicketServiceIds.length) {
        throw new BookingError(
          "Có loại vé không tồn tại hoặc không thuộc địa điểm",
          400,
        );
      }
      return rows;
    }

    const [rows] = await pool.query<ServiceAndLocationRow[]>(
      `SELECT
         s.service_id,
         s.location_id,
         s.service_name,
         s.service_type,
         s.price,
         s.status as service_status,
         s.admin_status,
         l.location_type,
         l.status as location_status,
         l.opening_hours,
         l.owner_id,
         c.sort_order as category_sort_order
       FROM services s
       LEFT JOIN service_categories c
         ON c.category_id = s.category_id AND c.deleted_at IS NULL
       JOIN locations l ON l.location_id = s.location_id
       WHERE s.service_id = ? AND l.location_id = ?
       LIMIT 1`,
      [effectiveServiceId, locationId],
    );
    return rows;
  })();

  if (serviceRows.length === 0) {
    throw new BookingError("Không tìm thấy dịch vụ hoặc địa điểm", 404);
  }

  const svc = serviceRows[0];

  if (ticketItems.length > 0) {
    const bad = serviceRows.find(
      (r) =>
        String(r.location_status || "") !== "active" ||
        String(r.service_status || "") !== "available" ||
        String(r.admin_status || "") !== "approved" ||
        String(r.service_type || "") !== "ticket",
    );
    if (bad) {
      throw new BookingError("Có loại vé không khả dụng để mua", 400);
    }
  }

  if (svc.location_status !== "active") {
    throw new BookingError("Địa điểm chưa sẵn sàng để đặt", 400);
  }

  if (svc.service_status !== "available") {
    throw new BookingError("Dịch vụ hiện không khả dụng", 400);
  }

  if (String(svc.admin_status || "") !== "approved") {
    throw new BookingError("Dịch vụ chưa được duyệt", 400);
  }

  const parsedIn = parseLocalDateTimeInput(checkInDate);
  let normalizedCheckIn = parsedIn.mysql;
  let checkInLocal = parsedIn.date;

  // Ticket: chọn ngày sử dụng (date-only semantics)
  let normalizedCheckOut: string | null = checkOutDate ?? null;
  let checkOutLocal: Date | null = null;

  if (svc.service_type === "ticket") {
    // normalize to local 00:00 of selected day
    checkInLocal = new Date(
      checkInLocal.getFullYear(),
      checkInLocal.getMonth(),
      checkInLocal.getDate(),
      0,
      0,
      0,
      0,
    );
    normalizedCheckIn = formatMysqlDateTime(checkInLocal);
    const validUntil = computeTicketValidUntil(svc.opening_hours, checkInLocal);
    checkOutLocal = validUntil;
    normalizedCheckOut = formatMysqlDateTime(validUntil);
  } else if (checkOutDate) {
    const parsedOut = parseLocalDateTimeInput(checkOutDate);
    checkOutLocal = parsedOut.date;
    normalizedCheckOut = parsedOut.mysql;
  } else {
    normalizedCheckOut = null;
  }

  if (svc.service_type === "room") {
    if (!normalizedCheckOut || !checkOutLocal) {
      // UI chỉ nhập giờ check-in: tự mặc định 24h để tránh trùng phòng và phục vụ reminder/cancel.
      checkOutLocal = new Date(checkInLocal.getTime() + 24 * 60 * 60 * 1000);
      normalizedCheckOut = formatMysqlDateTime(checkOutLocal);
    }
    if (checkOutLocal <= checkInLocal) {
      throw new BookingError("Ngày check-out phải sau ngày check-in", 400);
    }
    if (quantity !== 1) {
      throw new BookingError(
        "Dịch vụ phòng chỉ đặt được 1 phòng mỗi booking",
        400,
      );
    }
  }

  if (svc.service_type === "table") {
    const contactName = normalizePersonName(rawContactName);
    const contactPhone = String(rawContactPhone || "").trim();
    const normalizedContactName = contactName ? contactName.slice(0, 100) : "";
    const normalizedContactPhone = contactPhone
      ? contactPhone.slice(0, 30)
      : "";

    // Direction A: table bookings only allow reserve_on_confirm when preorder exists.
    // This prevents bookings from getting stuck in released state without a payable flow.
    if (reserveOnConfirm && preorderItems.length === 0) {
      throw new BookingError(
        "Đặt bàn chỉ hỗ trợ giữ chỗ sau xác nhận khi có món đặt trước",
        400,
      );
    }

    // Public table bookings must have contact info (owner can still create via admin flows).
    if (source !== "admin") {
      if (!normalizedContactName) {
        throw new BookingError("Vui lòng nhập họ tên", 400);
      }
      if (!isValidPersonName(normalizedContactName)) {
        throw new BookingError("Họ tên không được chứa ký tự đặc biệt", 400);
      }
      if (!normalizedContactPhone) {
        throw new BookingError("Vui lòng nhập số điện thoại", 400);
      }
      if (!isValidPhoneNumber(normalizedContactPhone)) {
        throw new BookingError(
          "Số điện thoại phải gồm 10 số, bắt đầu bằng 0 và không chứa ký tự đặc biệt",
          400,
        );
      }
    }

    if (tableIds.length > 0) {
      // Multi-select tables: store count as quantity for reporting.
      quantity = tableIds.length;
    } else if (quantity !== 1) {
      throw new BookingError("Đặt bàn chỉ đặt 1 bàn mỗi booking", 400);
    }
    if (normalizedCheckOut != null) {
      throw new BookingError("Đặt bàn không cần check-out", 400);
    }
  }

  if (svc.service_type === "ticket") {
    if (normalizedCheckOut == null) {
      // Should not happen because we always compute it
      throw new BookingError("Không thể xác định hạn sử dụng vé", 400);
    }
  }

  // Check opening hours against requested arrival time for table bookings.
  // Note: Do not block room/ticket creation based on current time.
  if (
    source !== "admin" &&
    svc.service_type === "table" &&
    !isWithinOpeningHours(svc.opening_hours, checkInLocal)
  ) {
    throw new BookingError(
      "Địa điểm đóng cửa vào thời gian bạn chọn. Vui lòng chọn trong giờ mở cửa.",
      400,
    );
  }

  // Quy tắc đặt trước tối đa 3 ngày
  if (source !== "admin") {
    const now = new Date();
    const nowFloorMinute = new Date(now);
    nowFloorMinute.setSeconds(0, 0);
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const limitEnd = getMaxAdvanceLimitEnd(now);

    if (svc.service_type === "ticket") {
      if (checkInLocal < startOfToday) {
        throw new BookingError("Ngày sử dụng vé không hợp lệ", 400);
      }
    } else {
      if (checkInLocal.getTime() < nowFloorMinute.getTime()) {
        throw new BookingError(
          "Vui lòng chọn thời gian tới trong tương lai",
          400,
        );
      }
    }

    if (checkInLocal.getTime() > limitEnd.getTime()) {
      throw new BookingError("Chỉ được đặt trước tối đa 3 ngày", 400);
    }
  }

  const unitPrice = toNumber(svc.price);
  const roomStayHours =
    svc.service_type === "room" && checkOutLocal
      ? Math.max(
          1,
          Math.ceil(
            (checkOutLocal.getTime() - checkInLocal.getTime()) /
              (60 * 60 * 1000),
          ),
        )
      : 1;
  const baseAmount =
    ticketItems.length > 0 && svc.service_type === "ticket"
      ? roundMoney(
          ticketItems.reduce((sum, it) => {
            const row = serviceRows.find(
              (r) => Number(r.service_id) === Number(it.serviceId),
            );
            const p = row ? toNumber(row.price) : 0;
            return sum + p * it.quantity;
          }, 0),
        )
      : roundMoney(unitPrice * quantity * roomStayHours);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Reserve POS tables (table bookings)
    if (svc.service_type === "table" && tableIds.length > 0) {
      const reservationEnd = computeTableReservationEnd(checkInLocal);
      const reservationEndMysql = formatMysqlDateTime(reservationEnd);
      const placeholders = tableIds.map(() => "?").join(",");

      const [tRows] = await connection.query<RowDataPacket[]>(
        `SELECT table_id, table_name, status
         FROM pos_tables
         WHERE location_id = ? AND table_id IN (${placeholders})
         FOR UPDATE`,
        [locationId, ...tableIds],
      );
      if (!Array.isArray(tRows) || tRows.length !== tableIds.length) {
        throw new BookingError(
          "Bàn không hợp lệ hoặc không thuộc địa điểm",
          400,
        );
      }
      const notFree = (tRows as any[]).filter((r) => {
        const st = String(r.status || "");
        return st !== "free";
      });
      if (notFree.length > 0) {
        const details = notFree
          .map((r) => {
            const name = String(r.table_name || r.table_id);
            const st = String(r.status || "");
            const label =
              st === "reserved" ? "đã được giữ chỗ" : "đang có khách";
            return `Bàn ${name} (${label})`;
          })
          .join(", ");
        throw new BookingError(
          `Có bàn đã có khách/đã được giữ chỗ: ${details}`,
          409,
        );
      }

      const [occRows] = await connection.query<RowDataPacket[]>(
        `SELECT o.table_id, t.table_name
         FROM pos_orders o
         JOIN pos_tables t ON t.table_id = o.table_id
         LEFT JOIN bookings ob ON ob.pos_order_id = o.order_id
         JOIN (
           SELECT order_id, COALESCE(SUM(quantity), 0) AS total_qty
           FROM pos_order_items
           GROUP BY order_id
         ) oi ON oi.order_id = o.order_id
         WHERE t.location_id = ?
           AND o.table_id IN (${placeholders})
           AND o.status = 'open'
           AND oi.total_qty > 0
           AND (
             ob.booking_id IS NULL
             OR (
               ob.status IN ('pending','confirmed')
               AND NOT (
                 ob.status = 'pending'
                 AND ob.notes LIKE ?
               )
             )
           )
         LIMIT 1
         FOR UPDATE`,
        [locationId, ...tableIds, `%${PREPAY_UNCONFIRMED_MARKER}%`],
      );
      if (Array.isArray(occRows) && occRows.length > 0) {
        const r = occRows[0] as any;
        const name = String(r.table_name || r.table_id);
        throw new BookingError(`Bàn ${name} đang có khách`, 409);
      }

      const [reservationConflictRows] = await connection.query<RowDataPacket[]>(
        `SELECT r.table_id, t.table_name
         FROM booking_table_reservations r
         JOIN pos_tables t ON t.table_id = r.table_id
         LEFT JOIN bookings rb ON rb.booking_id = r.booking_id
         WHERE r.location_id = ?
           AND r.table_id IN (${placeholders})
           AND r.status = 'active'
           AND (
             rb.booking_id IS NULL
             OR (
               rb.status IN ('pending','confirmed')
               AND NOT (
                 rb.status = 'pending'
                 AND rb.notes LIKE ?
               )
             )
           )
           AND r.actual_end_time IS NULL
           AND r.start_time < ?
           AND r.end_time > ?
         FOR UPDATE`,
        [
          locationId,
          ...tableIds,
          `%${PREPAY_UNCONFIRMED_MARKER}%`,
          reservationEndMysql,
          normalizedCheckIn,
        ],
      );

      if (
        Array.isArray(reservationConflictRows) &&
        reservationConflictRows.length > 0
      ) {
        const details = reservationConflictRows
          .map((row: any) => String(row.table_name || row.table_id))
          .filter(Boolean)
          .join(", ");
        throw new BookingError(
          `Có bàn đã được giữ chỗ trong khung giờ này: ${details}`,
          409,
        );
      }
    }

    // Compute preorder subtotal for table bookings
    let preorderSubtotal = 0;
    if (svc.service_type === "table" && preorderItems.length > 0) {
      if (tableIds.length !== 1) {
        throw new BookingError(
          "Đặt món trước chỉ hỗ trợ khi chọn đúng 1 bàn",
          400,
        );
      }
      const menuIds = preorderItems.map((x) => x.serviceId);
      const placeholders = menuIds.map(() => "?").join(",");
      const [mRows] = await connection.query<RowDataPacket[]>(
        `SELECT service_id, price, status, admin_status, service_type
         FROM services
         WHERE location_id = ?
           AND service_id IN (${placeholders})
           AND deleted_at IS NULL
         FOR UPDATE`,
        [locationId, ...menuIds],
      );
      const priceMap = new Map<number, number>();
      for (const r of mRows as any[]) {
        const sid = Number(r.service_id);
        const st = String(r.status || "");
        const admin = String(r.admin_status || "");
        const t = String(r.service_type || "");
        if (!Number.isFinite(sid)) continue;
        if (!["food", "combo", "other"].includes(t)) {
          throw new BookingError("Món đặt trước không hợp lệ", 400);
        }
        if (admin !== "approved" || !["available", "reserved"].includes(st)) {
          throw new BookingError("Món đặt trước hiện không khả dụng", 409);
        }
        priceMap.set(sid, toNumber(r.price));
      }
      if (priceMap.size !== menuIds.length) {
        throw new BookingError("Món đặt trước không hợp lệ", 400);
      }
      for (const it of preorderItems) {
        preorderSubtotal += roundMoney(
          (priceMap.get(it.serviceId) ?? 0) * it.quantity,
        );
      }
      preorderSubtotal = roundMoney(preorderSubtotal);
    }

    const totalAmount = roundMoney(baseAmount + preorderSubtotal);

    if (svc.service_type === "room") {
      const isHotelLike = isHotelLikeLocationType(
        String(svc.location_type || ""),
      );
      if (isHotelLike) {
        // Hotel/resort room availability should follow active PMS stays.
        // This correctly handles early checkout where booking.check_out_date may still be far in the future.
        const [stayConflictRows] = await connection.query<RowDataPacket[]>(
          `SELECT stay_id
           FROM hotel_stays
           WHERE location_id = ?
             AND room_id = ?
             AND status IN ('reserved','inhouse')
             AND expected_checkin < ?
             AND expected_checkout > ?
           LIMIT 1
           FOR UPDATE`,
          [
            locationId,
            effectiveServiceId,
            normalizedCheckOut,
            normalizedCheckIn,
          ],
        );
        if (Array.isArray(stayConflictRows) && stayConflictRows.length > 0) {
          throw new BookingError(
            "Phòng đã có người đặt trong thời gian này",
            409,
          );
        }
      } else {
        const [conflictRows] = await connection.query<RowDataPacket[]>(
          `SELECT booking_id
           FROM bookings
           WHERE service_id = ?
             AND location_id = ?
             AND status IN ('pending','confirmed')
             AND (notes IS NULL OR notes NOT LIKE ?)
             AND check_in_date < ?
             AND (check_out_date IS NULL OR check_out_date > ?)
           LIMIT 1
           FOR UPDATE`,
          [
            effectiveServiceId,
            locationId,
            `%${PREPAY_UNCONFIRMED_MARKER}%`,
            normalizedCheckOut,
            normalizedCheckIn,
          ],
        );
        if (Array.isArray(conflictRows) && conflictRows.length > 0) {
          throw new BookingError(
            "Phòng đã có người đặt trong thời gian này",
            409,
          );
        }
      }
    }

    let discountAmount = 0;
    let finalAmount = totalAmount;
    let normalizedVoucherCode: string | null = null;
    let appliedVoucherId: number | null = null;

    if (voucherCode && String(voucherCode).trim() !== "") {
      normalizedVoucherCode = String(voucherCode).trim();

      const calc = await validateVoucherForBooking({
        connection,
        userId,
        voucherCode: normalizedVoucherCode,
        locationId,
        locationType: svc.location_type,
        serviceType: svc.service_type,
        totalAmount,
        consumeUsage: true,
      });

      discountAmount = calc.discountAmount;
      finalAmount = calc.finalAmount;
      appliedVoucherId = calc.voucherId;
    }

    const contactName = String(rawContactName || "").trim();
    const contactPhone = String(rawContactPhone || "").trim();
    const normalizedContactName = contactName
      ? contactName.slice(0, 100)
      : null;
    const normalizedContactPhone = contactPhone
      ? contactPhone.slice(0, 30)
      : null;

    const storedNotes =
      reserveOnConfirm &&
      (svc.service_type === "room" || svc.service_type === "table")
        ? withPrepayUnconfirmedMarker(notes)
        : notes;

    const [result] = await connection.query<RowDataPacket[]>(
      `INSERT INTO bookings (
        user_id,
        service_id,
        location_id,
        check_in_date,
        check_out_date,
        quantity,
        total_amount,
        discount_amount,
        final_amount,
        voucher_code,
        status,
        source,
        contact_name,
        contact_phone,
        notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        effectiveServiceId,
        locationId,
        normalizedCheckIn,
        normalizedCheckOut,
        quantity,
        totalAmount,
        discountAmount,
        finalAmount,
        normalizedVoucherCode,
        "pending" as BookingStatus,
        source,
        normalizedContactName,
        normalizedContactPhone,
        storedNotes,
      ],
    );

    const insertId = (result as unknown as { insertId: number }).insertId;

    if (svc.service_type === "table" && tableIds.length > 0) {
      const reservationEnd = computeTableReservationEnd(checkInLocal);
      const reserveNow = !(reserveOnConfirm || preorderItems.length > 0);
      const reservationStatus = reserveNow ? "active" : "released";
      const reservationValues = tableIds
        .map(() => "(?, ?, ?, ?, ?, ?)")
        .join(",");
      const reservationParams: Array<number | string> = [];
      for (const tid of tableIds) {
        reservationParams.push(
          insertId,
          tid,
          locationId,
          normalizedCheckIn,
          formatMysqlDateTime(reservationEnd),
          reservationStatus,
        );
      }
      await connection.query(
        `INSERT INTO booking_table_reservations (
           booking_id,
           table_id,
           location_id,
           start_time,
           end_time,
           status
         ) VALUES ${reservationValues}`,
        reservationParams,
      );
    }

    // Create POS order for preorder (optional)
    if (svc.service_type === "table" && preorderItems.length > 0) {
      const primaryTableId = tableIds[0] ?? null;
      const [oIns] = await connection.query<any>(
        `INSERT INTO pos_orders (
           location_id,
           table_id,
           status,
           order_source,
           subtotal_amount,
           discount_amount,
           final_amount,
           created_by
         ) VALUES (?, ?, 'open', 'online_booking', ?, 0.00, ?, ?)`,
        [
          locationId,
          primaryTableId,
          preorderSubtotal,
          preorderSubtotal,
          userId,
        ],
      );
      const orderId = Number(oIns?.insertId);
      if (!Number.isFinite(orderId)) {
        throw new BookingError("Không thể tạo đơn đặt món trước", 500);
      }

      const itemIds = preorderItems.map((x) => x.serviceId);
      const placeholders = itemIds.map(() => "?").join(",");
      const [pRows] = await connection.query<RowDataPacket[]>(
        `SELECT service_id, service_name, price
         FROM services
         WHERE location_id = ? AND service_id IN (${placeholders})
           AND deleted_at IS NULL`,
        [locationId, ...itemIds],
      );
      const priceMap = new Map<number, number>();
      const serviceNameMap = new Map<number, string>();
      for (const r of pRows as any[]) {
        priceMap.set(Number(r.service_id), toNumber(r.price));
        serviceNameMap.set(
          Number(r.service_id),
          String(r.service_name || "").trim(),
        );
      }

      for (const it of preorderItems) {
        const unit = roundMoney(priceMap.get(it.serviceId) ?? 0);
        const line = roundMoney(unit * it.quantity);
        await connection.query(
          `INSERT INTO pos_order_items (order_id, service_id, quantity, unit_price, line_total)
           VALUES (?, ?, ?, ?, ?)`,
          [orderId, it.serviceId, it.quantity, unit, line],
        );
      }

      await connection.query(
        `UPDATE bookings SET pos_order_id = ? WHERE booking_id = ?`,
        [orderId, insertId],
      );

      await connection.query(
        `DELETE FROM booking_preorder_items
         WHERE booking_id = ?
           AND source = 'preorder'`,
        [insertId],
      );

      for (const it of preorderItems) {
        const unit = roundMoney(priceMap.get(it.serviceId) ?? 0);
        const line = roundMoney(unit * it.quantity);
        await connection.query(
          `INSERT INTO booking_preorder_items (
             booking_id,
             location_id,
             service_id,
             service_name_snapshot,
             quantity,
             unit_price,
             line_total,
             source
           ) VALUES (?, ?, ?, ?, ?, ?, ?, 'preorder')`,
          [
            insertId,
            locationId,
            it.serviceId,
            serviceNameMap.get(it.serviceId) || null,
            it.quantity,
            unit,
            line,
          ],
        );
      }
    }

    // PMS sync for hotel/resort room bookings: create reserved stay + mark room reserved
    if (
      svc.service_type === "room" &&
      isHotelLikeLocationType(svc.location_type) &&
      !reserveOnConfirm
    ) {
      const derivedFloor = Number(svc.category_sort_order ?? 0);
      await ensureHotelRoomAndReserveWithConn({
        connection,
        locationId,
        serviceId: effectiveServiceId,
        serviceName: svc.service_name,
        derivedFloor,
        userId,
        bookingId: insertId,
        expectedCheckinMysql: normalizedCheckIn,
        expectedCheckoutMysql: normalizedCheckOut as string,
        subtotalAmount: totalAmount,
        discountAmount,
        finalAmount,
      });
    }

    // Voucher usage history (snapshot name/email at the moment of usage)
    if (normalizedVoucherCode && appliedVoucherId != null) {
      const [userRows] = await connection.query<UserSnapshotRow[]>(
        `SELECT full_name, email FROM users WHERE user_id = ? LIMIT 1`,
        [userId],
      );
      const userFullName = String(userRows?.[0]?.full_name ?? "");
      const userEmail = String(userRows?.[0]?.email ?? "");

      await connection.query(
        `INSERT INTO voucher_usage_history (
          voucher_id,
          voucher_code,
          user_id,
          user_full_name,
          user_email,
          booking_id,
          location_id,
          total_amount,
          discount_amount,
          final_amount,
          source
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'booking')`,
        [
          appliedVoucherId,
          normalizedVoucherCode,
          userId,
          userFullName,
          userEmail,
          insertId,
          locationId,
          totalAmount,
          discountAmount,
          finalAmount,
        ],
      );
    }

    // Ticket issuance moved to explicit user confirmation step.
    // Vì sao: user phải bấm “Xác nhận đã chuyển khoản” thì mới coi là mua vé và trừ số lượng.

    // Ticket payments: bắt buộc chuyển khoản (VietQR). Tạo payment pending ngay khi đặt vé.
    let createdPayment: {
      paymentId: number;
      status: string;
      amount: number;
      transactionCode: string | null;
      qrData: unknown;
    } | null = null;

    if (svc.service_type === "ticket") {
      const [settingsRows] = await connection.query<RowDataPacket[]>(
        `SELECT setting_key, setting_value FROM system_settings
         WHERE setting_key IN ('default_commission_rate','vat_rate')`,
      );
      const settings: Record<string, string | null> = {};
      for (const r of settingsRows)
        settings[String(r.setting_key)] = r.setting_value;

      const [locRateRows] = await connection.query<RowDataPacket[]>(
        `SELECT commission_rate, owner_id, location_name FROM locations WHERE location_id = ? LIMIT 1`,
        [locationId],
      );

      const ownerId = Number(locRateRows[0]?.owner_id ?? svc.owner_id);
      if (!Number.isFinite(ownerId)) {
        throw new BookingError(
          "Không xác định được chủ địa điểm để thanh toán",
          400,
        );
      }

      const [ownerRows] = await connection.query<RowDataPacket[]>(
        `SELECT bank_account, bank_name, account_holder
         FROM owner_profiles WHERE owner_id = ? LIMIT 1`,
        [ownerId],
      );

      const bankAccount = ownerRows[0]?.bank_account
        ? String(ownerRows[0].bank_account)
        : "";
      const bankName = ownerRows[0]?.bank_name
        ? String(ownerRows[0].bank_name)
        : "";
      const accountHolder = ownerRows[0]?.account_holder
        ? String(ownerRows[0].account_holder)
        : "";

      if (!bankAccount || !bankName || !accountHolder) {
        throw new BookingError(
          "Chủ địa điểm chưa cập nhật thông tin ngân hàng để thanh toán",
          400,
        );
      }

      const commissionRate = Number(
        locRateRows[0]?.commission_rate ??
          settings.default_commission_rate ??
          2.5,
      );
      const vatRate = Number(settings.vat_rate ?? 10);

      const amount = Number(finalAmount);
      const safeCommissionRate = Number.isFinite(commissionRate)
        ? commissionRate
        : 2.5;
      const safeVatRate = Number.isFinite(vatRate) ? vatRate : 10;

      const commissionAmount = +((amount * safeCommissionRate) / 100).toFixed(
        2,
      );
      const vatAmount = +((commissionAmount * safeVatRate) / 100).toFixed(2);
      const ownerReceivable = +(amount - commissionAmount - vatAmount).toFixed(
        2,
      );

      const tx = randomTransactionCode(insertId);
      const locationName = String(locRateRows[0]?.location_name ?? "").trim();
      const qrContent = locationName ? `Mua vé - ${locationName}` : "Mua vé";

      const issuance =
        ticketItems.length > 0
          ? ticketItems
          : [{ serviceId: effectiveServiceId, quantity }];

      const qrData = {
        bank_name: bankName,
        bank_account: bankAccount,
        account_holder: accountHolder,
        amount,
        content: qrContent,
        transaction_code: tx,
        // For verification on confirm step
        ticket_items: issuance.map((it) => ({
          service_id: Number(it.serviceId),
          quantity: Number(it.quantity),
        })),
        use_date: normalizedCheckIn,
      };

      const paymentMethod = "VietQR";

      const [payInsert] = await connection.query<RowDataPacket[]>(
        `INSERT INTO payments (
          user_id,
          location_id,
          booking_id,
          amount,
          transaction_source,
          commission_rate,
          commission_amount,
          vat_rate,
          vat_amount,
          owner_receivable,
          payment_method,
          transaction_code,
          qr_data,
          status,
          notes
        ) VALUES (?, ?, ?, ?, 'online_booking', ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
        [
          userId,
          locationId,
          insertId,
          amount,
          safeCommissionRate,
          commissionAmount,
          safeVatRate,
          vatAmount,
          ownerReceivable,
          paymentMethod,
          tx,
          JSON.stringify(qrData),
          JSON.stringify({
            transaction_source: "online_booking",
            service_type: "ticket",
            booking_id: insertId,
            location_id: locationId,
            created_at: new Date().toISOString(),
            reminder:
              "Đã thanh toán nếu có vấn đề phát sinh hay không tới bị hủy thì tiền không được hoàn lại",
          }),
        ],
      );

      const paymentId = (payInsert as unknown as { insertId: number }).insertId;
      createdPayment = {
        paymentId,
        status: "pending",
        amount,
        transactionCode: tx,
        qrData,
      };
    }

    await connection.commit();

    // Realtime: notify owner/employee POS screens to refresh table status.
    if (svc.service_type === "table" && tableIds.length > 0) {
      const ownerId = Number(svc.owner_id);
      if (Number.isFinite(ownerId)) {
        void publishPosUpdatedForLocation({
          locationId,
          ownerId,
          event: {
            type: "pos_updated",
            location_id: locationId,
            action: "table_booking_created",
            booking_id: insertId,
          },
        });
      }
    }

    // Realtime: notify owner/employee hotel screens to refresh room/booking state.
    if (svc.service_type === "room") {
      const ownerId = Number(svc.owner_id);
      if (Number.isFinite(ownerId) && ownerId > 0) {
        void publishHotelUpdatedForLocation({
          locationId,
          ownerId,
          userIds: [userId],
          payload: {
            action: "room_booking_created",
            booking_id: insertId,
          },
        });
      }
    }

    return {
      bookingId: insertId,
      totalAmount,
      discountAmount,
      finalAmount,
      voucherCode: normalizedVoucherCode,
      payment: createdPayment,
    };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};

export const createBookingBatch = async (
  input: CreateBookingBatchInput,
): Promise<CreateBookingBatchResult> => {
  const {
    userId,
    locationId,
    serviceIds,
    checkInDate,
    checkOutDate,
    source = "web",
    notes = null,
    reserveOnConfirm = false,
  } = input;

  const uniqIds = Array.from(
    new Set((serviceIds || []).map((x) => Number(x)).filter(Number.isFinite)),
  );

  if (!Number.isFinite(locationId)) {
    throw new BookingError("location_id không hợp lệ", 400);
  }

  if (uniqIds.length === 0) {
    throw new BookingError("Vui lòng chọn ít nhất 1 phòng", 400);
  }

  if (uniqIds.length > 20) {
    throw new BookingError("Chọn tối đa 20 phòng mỗi lần đặt", 400);
  }

  const parsedIn = parseLocalDateTimeInput(checkInDate);
  const inDate = parsedIn.date;
  const parsedOut =
    checkOutDate && String(checkOutDate).trim() !== ""
      ? parseLocalDateTimeInput(checkOutDate)
      : null;
  const outDate =
    parsedOut?.date ?? new Date(inDate.getTime() + 24 * 60 * 60 * 1000);
  const outMysql = parsedOut?.mysql ?? formatMysqlDateTime(outDate);
  if (outDate <= inDate) {
    throw new BookingError("Ngày check-out phải sau ngày check-in", 400);
  }

  // Quy tắc đặt trước tối đa 3 ngày (theo ngày dương lịch địa phương)
  if (source !== "admin") {
    const now = new Date();
    const nowFloorMinute = new Date(now);
    nowFloorMinute.setSeconds(0, 0);
    const limitEnd = getMaxAdvanceLimitEnd(now);
    if (inDate.getTime() < nowFloorMinute.getTime()) {
      throw new BookingError(
        "Vui lòng chọn thời gian tới trong tương lai",
        400,
      );
    }
    if (inDate.getTime() > limitEnd.getTime()) {
      throw new BookingError("Chỉ được đặt trước tối đa 3 ngày", 400);
    }
  }

  const placeholders = uniqIds.map(() => "?").join(",");
  const [svcRows] = await pool.query<ServiceAndLocationRow[]>(
    `SELECT
       s.service_id,
       s.location_id,
       s.service_name,
       s.service_type,
       s.price,
       s.status as service_status,
       s.admin_status,
       l.location_type,
       l.status as location_status,
       l.opening_hours,
       c.sort_order as category_sort_order
     FROM services s
     LEFT JOIN service_categories c
       ON c.category_id = s.category_id AND c.deleted_at IS NULL
     JOIN locations l ON l.location_id = s.location_id
     WHERE s.location_id = ?
       AND s.service_id IN (${placeholders})`,
    [locationId, ...uniqIds],
  );

  if (svcRows.length !== uniqIds.length) {
    throw new BookingError(
      "Có phòng không tồn tại hoặc không thuộc địa điểm",
      400,
    );
  }

  const bad = svcRows.find(
    (s) =>
      String(s.location_status || "") !== "active" ||
      String(s.service_status || "") !== "available" ||
      String(s.admin_status || "") !== "approved" ||
      s.service_type !== "room",
  );
  if (bad) {
    throw new BookingError("Có phòng không khả dụng để đặt", 400);
  }

  // Note: Do not block room bookings based on current opening hours.

  const roomStayHours = Math.max(
    1,
    Math.ceil((outDate.getTime() - inDate.getTime()) / (60 * 60 * 1000)),
  );

  const totalAmount = roundMoney(
    svcRows.reduce((sum, r) => sum + toNumber(r.price) * roomStayHours, 0),
  );

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const isHotelLike = isHotelLikeLocationType(
      String((svcRows as any)?.[0]?.location_type || ""),
    );

    // Lock potential conflicts per room
    for (const sid of uniqIds) {
      if (isHotelLike) {
        const [stayConflictRows] = await connection.query<RowDataPacket[]>(
          `SELECT stay_id
           FROM hotel_stays
           WHERE location_id = ?
             AND room_id = ?
             AND status IN ('reserved','inhouse')
             AND expected_checkin < ?
             AND expected_checkout > ?
           LIMIT 1
           FOR UPDATE`,
          [locationId, sid, outMysql, parsedIn.mysql],
        );
        if (Array.isArray(stayConflictRows) && stayConflictRows.length > 0) {
          throw new BookingError(
            "Có phòng đã được đặt trong thời gian này",
            409,
          );
        }
      } else {
        const [conflictRows] = await connection.query<RowDataPacket[]>(
          `SELECT booking_id
           FROM bookings
           WHERE service_id = ?
             AND location_id = ?
             AND status IN ('pending','confirmed')
             AND (notes IS NULL OR notes NOT LIKE ?)
             AND check_in_date < ?
             AND (check_out_date IS NULL OR check_out_date > ?)
           LIMIT 1
           FOR UPDATE`,
          [
            sid,
            locationId,
            `%${PREPAY_UNCONFIRMED_MARKER}%`,
            outMysql,
            parsedIn.mysql,
          ],
        );
        if (Array.isArray(conflictRows) && conflictRows.length > 0) {
          throw new BookingError(
            "Có phòng đã được đặt trong thời gian này",
            409,
          );
        }
      }
    }

    const bookingIds: number[] = [];
    for (const row of svcRows) {
      const unitPrice = toNumber(row.price);
      const perTotal = roundMoney(unitPrice * roomStayHours);

      const storedNotes = reserveOnConfirm
        ? withPrepayUnconfirmedMarker(notes)
        : notes;

      const [result] = await connection.query<RowDataPacket[]>(
        `INSERT INTO bookings (
          user_id,
          service_id,
          location_id,
          check_in_date,
          check_out_date,
          quantity,
          total_amount,
          discount_amount,
          final_amount,
          voucher_code,
          status,
          source,
          notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          Number(row.service_id),
          locationId,
          parsedIn.mysql,
          outMysql,
          1,
          perTotal,
          0,
          perTotal,
          null,
          "pending" as BookingStatus,
          source,
          storedNotes,
        ],
      );
      const insertId = (result as unknown as { insertId: number }).insertId;
      bookingIds.push(insertId);

      if (isHotelLikeLocationType(row.location_type) && !reserveOnConfirm) {
        const derivedFloor = Number(row.category_sort_order ?? 0);
        await ensureHotelRoomAndReserveWithConn({
          connection,
          locationId,
          serviceId: Number(row.service_id),
          serviceName: row.service_name,
          derivedFloor,
          userId,
          bookingId: insertId,
          expectedCheckinMysql: parsedIn.mysql,
          expectedCheckoutMysql: outMysql,
          subtotalAmount: perTotal,
          discountAmount: 0,
          finalAmount: perTotal,
        });
      }
    }

    await connection.commit();

    // Realtime: notify hotel screens to refresh without manual reload.
    try {
      const [locRows] = await pool.query<RowDataPacket[]>(
        `SELECT owner_id
         FROM locations
         WHERE location_id = ?
         LIMIT 1`,
        [locationId],
      );
      const ownerId = Number((locRows as any)?.[0]?.owner_id);
      if (Number.isFinite(ownerId) && ownerId > 0) {
        await publishHotelUpdatedForLocation({
          locationId,
          ownerId,
          userIds: [userId],
          payload: { action: "room_booking_batch_created" },
        });
      }
    } catch {
      // ignore realtime failures
    }

    return {
      bookingIds,
      totalAmount,
      discountAmount: 0,
      finalAmount: totalAmount,
      voucherCode: null,
    };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};

export const updateMyRoomBookingBatchContact = async (params: {
  userId: number;
  bookingIds: number[];
  contactName: string;
  contactPhone: string;
}): Promise<{
  bookingIds: number[];
  contactName: string;
  contactPhone: string;
}> => {
  const { userId } = params;
  const bookingIds = Array.from(
    new Set(
      (Array.isArray(params.bookingIds) ? params.bookingIds : [])
        .map((x) => Number(x))
        .filter((x) => Number.isFinite(x) && x > 0),
    ),
  );
  const contactName = normalizePersonName(params.contactName);
  const contactPhone = String(params.contactPhone || "").trim();

  if (!Number.isFinite(userId) || userId <= 0) {
    throw new BookingError("Chưa đăng nhập", 401);
  }
  if (bookingIds.length === 0) {
    throw new BookingError("booking_ids không hợp lệ", 400);
  }
  if (!contactName) {
    throw new BookingError("Vui lòng nhập họ tên người đặt", 400);
  }
  if (!isValidPersonName(contactName)) {
    throw new BookingError("Họ tên không được chứa ký tự đặc biệt", 400);
  }
  if (!contactPhone) {
    throw new BookingError("Vui lòng nhập số điện thoại người đặt", 400);
  }
  if (!isValidPhoneNumber(contactPhone)) {
    throw new BookingError(
      "Số điện thoại phải gồm 10 số, bắt đầu bằng 0 và không chứa ký tự đặc biệt",
      400,
    );
  }

  const placeholders = bookingIds.map(() => "?").join(",");
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT b.booking_id, b.user_id, b.location_id, b.status AS booking_status,
              s.service_type,
              l.owner_id
       FROM bookings b
       JOIN services s ON s.service_id = b.service_id
       JOIN locations l ON l.location_id = b.location_id
       WHERE b.booking_id IN (${placeholders})
       FOR UPDATE`,
      bookingIds,
    );

    if (!Array.isArray(rows) || rows.length !== bookingIds.length) {
      throw new BookingError("Không tìm thấy đủ booking", 404);
    }

    const locationId = Number((rows as any)?.[0]?.location_id);
    const ownerId = Number((rows as any)?.[0]?.owner_id);
    for (const r of rows as any[]) {
      if (Number(r.user_id) !== Number(userId)) {
        throw new BookingError("Bạn không có quyền cập nhật booking này", 403);
      }
      if (String(r.service_type || "") !== "room") {
        throw new BookingError("Chỉ hỗ trợ cập nhật liên hệ đặt phòng", 400);
      }
      if (Number(r.location_id) !== locationId) {
        throw new BookingError("Các booking phải cùng một địa điểm", 400);
      }
      const st = String(r.booking_status || "");
      if (!["pending", "confirmed"].includes(st)) {
        throw new BookingError(
          "Có booking không còn ở trạng thái có thể cập nhật",
          400,
        );
      }
    }

    await conn.query(
      `UPDATE bookings
       SET contact_name = ?, contact_phone = ?
       WHERE user_id = ?
         AND booking_id IN (${placeholders})`,
      [contactName, contactPhone, userId, ...bookingIds],
    );

    await conn.commit();

    if (
      Number.isFinite(locationId) &&
      locationId > 0 &&
      Number.isFinite(ownerId) &&
      ownerId > 0
    ) {
      void publishHotelUpdatedForLocation({
        locationId,
        ownerId,
        userIds: [userId],
        payload: {
          action: "room_booking_contact_updated",
          booking_ids: bookingIds,
        },
      });
    }

    return { bookingIds, contactName, contactPhone };
  } catch (e) {
    try {
      await conn.rollback();
    } catch {
      // ignore
    }
    throw e;
  } finally {
    conn.release();
  }
};

export const confirmTicketBankTransfer = async (params: {
  userId: number;
  bookingId: number;
}): Promise<ConfirmTicketTransferResult> => {
  const { userId, bookingId } = params;

  if (!Number.isFinite(userId) || userId <= 0) {
    throw new BookingError("Chưa đăng nhập", 401);
  }
  if (!Number.isFinite(bookingId) || bookingId <= 0) {
    throw new BookingError("bookingId không hợp lệ", 400);
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [bRows] = await connection.query<RowDataPacket[]>(
      `SELECT b.booking_id, b.user_id, b.location_id, b.service_id, b.quantity,
              b.status AS booking_status,
              s.service_type
       FROM bookings b
       JOIN services s ON s.service_id = b.service_id
       WHERE b.booking_id = ?
       LIMIT 1
       FOR UPDATE`,
      [bookingId],
    );
    const booking = Array.isArray(bRows) ? bRows[0] : null;
    if (!booking) {
      throw new BookingError("Không tìm thấy booking", 404);
    }
    if (Number(booking.user_id) !== Number(userId)) {
      throw new BookingError("Không có quyền thao tác booking này", 403);
    }
    if (String(booking.service_type || "") !== "ticket") {
      throw new BookingError("Booking này không phải vé du lịch", 400);
    }

    const bookingStatus = String(booking.booking_status || "");
    if (!["pending", "confirmed"].includes(bookingStatus)) {
      throw new BookingError(
        "Booking không còn ở trạng thái có thể xác nhận",
        400,
      );
    }

    const [payRows] = await connection.query<RowDataPacket[]>(
      `SELECT payment_id, status, qr_data
       FROM payments
       WHERE booking_id = ? AND transaction_source = 'online_booking'
       ORDER BY payment_id DESC
       LIMIT 1
       FOR UPDATE`,
      [bookingId],
    );
    const payment = Array.isArray(payRows) ? payRows[0] : null;
    if (!payment) {
      throw new BookingError("Không tìm thấy payment cho booking", 404);
    }

    const paymentId = Number(payment.payment_id);
    const paymentStatus = String(payment.status || "pending");

    if (!["pending", "completed"].includes(paymentStatus)) {
      throw new BookingError(
        "Payment không còn ở trạng thái có thể xác nhận",
        400,
      );
    }

    const [existingTickets] = await connection.query<RowDataPacket[]>(
      `SELECT ticket_id, service_id, ticket_code, status, issued_at
       FROM booking_tickets
       WHERE booking_id = ?
       ORDER BY ticket_id ASC
       FOR UPDATE`,
      [bookingId],
    );

    if (paymentStatus === "completed") {
      await connection.commit();
      return {
        bookingId,
        paymentId,
        paymentStatus,
        issuedCount: Array.isArray(existingTickets)
          ? existingTickets.length
          : 0,
        issuedTickets: (Array.isArray(existingTickets)
          ? existingTickets
          : []
        ).map((t: any) => ({
          ticketId: Number(t.ticket_id),
          serviceId: Number(t.service_id),
          ticketCode: String(t.ticket_code || ""),
          status: String(t.status || "unused"),
          issuedAt: t.issued_at ? new Date(t.issued_at).toISOString() : null,
        })),
      };
    }

    // Backward compatibility: older flows might have issued tickets at booking creation.
    // In that case, do NOT decrement stock again.
    if (Array.isArray(existingTickets) && existingTickets.length > 0) {
      await connection.query(
        `UPDATE payments
         SET status = 'completed',
             performed_by_user_id = ?,
             performed_by_role = 'user',
             payment_time = CURRENT_TIMESTAMP
         WHERE payment_id = ?`,
        [userId, paymentId],
      );

      await connection.query(
        `UPDATE bookings
         SET status = 'confirmed'
         WHERE booking_id = ?`,
        [bookingId],
      );

      await connection.commit();

      return {
        bookingId,
        paymentId,
        paymentStatus: "completed",
        issuedCount: existingTickets.length,
        issuedTickets: existingTickets.map((t: any) => ({
          ticketId: Number(t.ticket_id),
          serviceId: Number(t.service_id),
          ticketCode: String(t.ticket_code || ""),
          status: String(t.status || "unused"),
          issuedAt: t.issued_at ? new Date(t.issued_at).toISOString() : null,
        })),
      };
    }

    // Determine issuance items from qr_data (preferred), existing tickets, or booking fallback.
    const items: Array<{ serviceId: number; quantity: number }> = [];
    const qrRaw = payment.qr_data;
    if (typeof qrRaw === "string" && qrRaw.trim()) {
      try {
        const parsed = JSON.parse(qrRaw) as any;
        const rawItems = Array.isArray(parsed?.ticket_items)
          ? parsed.ticket_items
          : [];
        for (const it of rawItems) {
          const sid = Number(it?.service_id);
          const qty = Number(it?.quantity);
          if (!Number.isFinite(sid) || sid <= 0) continue;
          if (!Number.isFinite(qty) || qty <= 0) continue;
          items.push({ serviceId: sid, quantity: Math.trunc(qty) });
        }
      } catch {
        // ignore
      }
    }

    if (
      items.length === 0 &&
      Array.isArray(existingTickets) &&
      existingTickets.length
    ) {
      const map = new Map<number, number>();
      for (const t of existingTickets as any[]) {
        const sid = Number(t.service_id);
        if (!Number.isFinite(sid) || sid <= 0) continue;
        map.set(sid, (map.get(sid) ?? 0) + 1);
      }
      for (const [sid, qty] of map.entries())
        items.push({ serviceId: sid, quantity: qty });
    }

    if (items.length === 0) {
      const sid = Number(booking.service_id);
      const qty = Number(booking.quantity ?? 1);
      items.push({
        serviceId: sid,
        quantity: Number.isFinite(qty) && qty > 0 ? Math.trunc(qty) : 1,
      });
    }

    // Lock services and check stock
    const uniqServiceIds = Array.from(
      new Set(items.map((x) => Number(x.serviceId))),
    );
    const placeholders = uniqServiceIds.map(() => "?").join(",");
    const [svcRows] = await connection.query<RowDataPacket[]>(
      `SELECT service_id, location_id, service_type, quantity
       FROM services
       WHERE service_id IN (${placeholders})
       FOR UPDATE`,
      uniqServiceIds,
    );

    const svcMap = new Map<number, any>();
    for (const r of svcRows as any[]) {
      svcMap.set(Number(r.service_id), r);
    }
    for (const it of items) {
      const row = svcMap.get(Number(it.serviceId));
      if (!row) {
        throw new BookingError("Loại vé không tồn tại", 400);
      }
      if (Number(row.location_id) !== Number(booking.location_id)) {
        throw new BookingError("Loại vé không thuộc địa điểm", 400);
      }
      if (String(row.service_type || "") !== "ticket") {
        throw new BookingError("Dịch vụ không phải vé", 400);
      }
      const stock = Number(row.quantity ?? 0);
      if (!Number.isFinite(stock) || stock < it.quantity) {
        throw new BookingError("Số lượng vé không đủ", 409);
      }
    }

    // Decrement stock
    for (const it of items) {
      await connection.query(
        `UPDATE services
         SET quantity = quantity - ?
         WHERE service_id = ? AND quantity >= ?`,
        [it.quantity, it.serviceId, it.quantity],
      );
    }

    // Issue tickets if not already issued
    if (!Array.isArray(existingTickets) || existingTickets.length === 0) {
      for (const it of items) {
        for (let i = 0; i < it.quantity; i++) {
          const code = `BT-${bookingId}-${Date.now()}-${crypto
            .randomBytes(4)
            .toString("hex")}`;
          await connection.query(
            `INSERT INTO booking_tickets (booking_id, location_id, service_id, ticket_code, status)
             VALUES (?, ?, ?, ?, 'unused')`,
            [
              bookingId,
              Number(booking.location_id),
              Number(it.serviceId),
              code,
            ],
          );
        }
      }
    }

    await connection.query(
      `UPDATE payments
       SET status = 'completed',
           performed_by_user_id = ?,
           performed_by_role = 'user',
           payment_time = CURRENT_TIMESTAMP
       WHERE payment_id = ?`,
      [userId, paymentId],
    );

    await connection.query(
      `UPDATE bookings
       SET status = 'confirmed'
       WHERE booking_id = ?`,
      [bookingId],
    );

    const [issuedRows] = await connection.query<RowDataPacket[]>(
      `SELECT ticket_id, service_id, ticket_code, status, issued_at
       FROM booking_tickets
       WHERE booking_id = ?
       ORDER BY ticket_id ASC`,
      [bookingId],
    );

    await connection.commit();

    return {
      bookingId,
      paymentId,
      paymentStatus: "completed",
      issuedCount: Array.isArray(issuedRows) ? issuedRows.length : 0,
      issuedTickets: (Array.isArray(issuedRows) ? issuedRows : []).map(
        (t: any) => ({
          ticketId: Number(t.ticket_id),
          serviceId: Number(t.service_id),
          ticketCode: String(t.ticket_code || ""),
          status: String(t.status || "unused"),
          issuedAt: t.issued_at ? new Date(t.issued_at).toISOString() : null,
        }),
      ),
    };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};

export const confirmTableBankTransfer = async (params: {
  userId: number;
  bookingId: number;
}): Promise<ConfirmTableTransferResult> => {
  await ensureBookingTableReservationsSchema();

  const { userId, bookingId } = params;

  if (!Number.isFinite(userId) || userId <= 0) {
    throw new BookingError("Chưa đăng nhập", 401);
  }
  if (!Number.isFinite(bookingId) || bookingId <= 0) {
    throw new BookingError("bookingId không hợp lệ", 400);
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [bRows] = await connection.query<RowDataPacket[]>(
      `SELECT b.booking_id, b.user_id, b.location_id, b.service_id, b.pos_order_id,
              b.check_in_date,
              b.status AS booking_status,
              s.service_type
       FROM bookings b
       JOIN services s ON s.service_id = b.service_id
       WHERE b.booking_id = ?
       LIMIT 1
       FOR UPDATE`,
      [bookingId],
    );
    const booking = Array.isArray(bRows) ? bRows[0] : null;
    if (!booking) {
      throw new BookingError("Không tìm thấy booking", 404);
    }
    if (Number(booking.user_id) !== Number(userId)) {
      throw new BookingError("Không có quyền thao tác booking này", 403);
    }
    if (String(booking.service_type || "") !== "table") {
      throw new BookingError("Booking này không phải đặt bàn", 400);
    }
    if (booking.pos_order_id == null) {
      throw new BookingError("Booking này không có đặt món trước", 400);
    }

    const bookingStatus = String(booking.booking_status || "");
    if (!["pending", "confirmed"].includes(bookingStatus)) {
      throw new BookingError(
        "Booking không còn ở trạng thái có thể xác nhận",
        400,
      );
    }

    const [payRows] = await connection.query<RowDataPacket[]>(
      `SELECT payment_id, status
       FROM payments
       WHERE booking_id = ? AND transaction_source = 'online_booking'
       ORDER BY payment_id DESC
       LIMIT 1
       FOR UPDATE`,
      [bookingId],
    );
    const payment = Array.isArray(payRows) ? payRows[0] : null;
    if (!payment) {
      throw new BookingError("Không tìm thấy payment cho booking", 404);
    }

    const paymentId = Number(payment.payment_id);
    const paymentStatus = String(payment.status || "pending");

    if (!["pending", "completed"].includes(paymentStatus)) {
      throw new BookingError(
        "Payment không còn ở trạng thái có thể xác nhận",
        400,
      );
    }

    // Prepay flow: tables are only locked after user confirmation.
    // During booking creation we store table rows with status='released'.
    const [rRows] = await connection.query<RowDataPacket[]>(
      `SELECT reservation_id, table_id, status
       FROM booking_table_reservations
       WHERE booking_id = ?
       FOR UPDATE`,
      [bookingId],
    );
    const reservations = Array.isArray(rRows) ? (rRows as any[]) : [];
    if (reservations.length === 0) {
      throw new BookingError("Booking này không có thông tin bàn", 400);
    }
    const tableIds = Array.from(
      new Set(
        reservations
          .map((r) => Number(r.table_id))
          .filter((x) => Number.isFinite(x) && x > 0),
      ),
    );
    if (tableIds.length === 0) {
      throw new BookingError("Booking này không có thông tin bàn", 400);
    }

    const needActivate = reservations.some(
      (r) => String(r.status || "") !== "active",
    );

    if (needActivate) {
      const placeholders = tableIds.map(() => "?").join(",");
      const startTime = formatMysqlDateTime(new Date(booking.check_in_date));
      const reservationEnd = computeTableReservationEnd(
        new Date(booking.check_in_date),
      );
      const endTime = formatMysqlDateTime(reservationEnd);

      const [occRows] = await connection.query<RowDataPacket[]>(
        `SELECT o.table_id, t.table_name
         FROM pos_orders o
         JOIN pos_tables t ON t.table_id = o.table_id
         LEFT JOIN bookings ob ON ob.pos_order_id = o.order_id
         JOIN (
           SELECT order_id, COALESCE(SUM(quantity), 0) AS total_qty
           FROM pos_order_items
           GROUP BY order_id
         ) oi ON oi.order_id = o.order_id
         WHERE t.location_id = ?
           AND o.table_id IN (${placeholders})
           AND o.status = 'open'
           AND oi.total_qty > 0
           AND (
             ob.booking_id IS NULL
             OR (
               ob.status IN ('pending','confirmed')
               AND ob.booking_id <> ?
               AND NOT (
                 ob.status = 'pending'
                 AND ob.notes LIKE ?
               )
             )
           )
         LIMIT 1
         FOR UPDATE`,
        [
          Number(booking.location_id),
          ...tableIds,
          bookingId,
          `%${PREPAY_UNCONFIRMED_MARKER}%`,
        ],
      );
      if (Array.isArray(occRows) && occRows.length > 0) {
        const r = occRows[0] as any;
        const name = String(r.table_name || r.table_id);
        throw new BookingError(`Bàn ${name} đang có khách`, 409);
      }

      const [conflictRows] = await connection.query<RowDataPacket[]>(
        `SELECT r.table_id, t.table_name
         FROM booking_table_reservations r
         JOIN pos_tables t ON t.table_id = r.table_id
         LEFT JOIN bookings rb ON rb.booking_id = r.booking_id
         WHERE r.location_id = ?
           AND r.table_id IN (${placeholders})
           AND r.status = 'active'
           AND r.booking_id <> ?
           AND (
             rb.booking_id IS NULL
             OR (
               rb.status IN ('pending','confirmed')
               AND NOT (
                 rb.status = 'pending'
                 AND rb.notes LIKE ?
               )
             )
           )
           AND r.actual_end_time IS NULL
           AND r.start_time < ?
           AND r.end_time > ?
         LIMIT 1
         FOR UPDATE`,
        [
          Number(booking.location_id),
          ...tableIds,
          bookingId,
          `%${PREPAY_UNCONFIRMED_MARKER}%`,
          endTime,
          startTime,
        ],
      );
      if (Array.isArray(conflictRows) && conflictRows.length > 0) {
        const details = conflictRows
          .map((row: any) => String(row.table_name || row.table_id))
          .filter(Boolean)
          .join(", ");
        throw new BookingError(
          `Có bàn đã được giữ chỗ trong khung giờ này: ${details}`,
          409,
        );
      }

      await connection.query(
        `UPDATE booking_table_reservations
         SET status = 'active',
             start_time = ?,
             end_time = ?
         WHERE booking_id = ?
           AND status <> 'active'`,
        [startTime, endTime, bookingId],
      );
    }

    if (paymentStatus !== "completed") {
      await connection.query(
        `UPDATE payments
         SET status = 'completed',
             performed_by_user_id = ?,
             performed_by_role = 'user',
             payment_time = CURRENT_TIMESTAMP
         WHERE payment_id = ?`,
        [userId, paymentId],
      );

      await connection.query(
        `UPDATE bookings
         SET status = 'confirmed'
         WHERE booking_id = ?`,
        [bookingId],
      );
    }

    await connection.commit();
    return {
      bookingId,
      paymentId,
      paymentStatus: "completed",
    };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};

export const confirmRoomBankTransfer = async (params: {
  userId: number;
  bookingId: number;
}): Promise<ConfirmRoomTransferResult> => {
  const { userId, bookingId } = params;

  if (!Number.isFinite(userId) || userId <= 0) {
    throw new BookingError("Chưa đăng nhập", 401);
  }
  if (!Number.isFinite(bookingId) || bookingId <= 0) {
    throw new BookingError("bookingId không hợp lệ", 400);
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [bRows] = await connection.query<RowDataPacket[]>(
      `SELECT b.booking_id, b.user_id, b.status AS booking_status,
              s.service_type
       FROM bookings b
       JOIN services s ON s.service_id = b.service_id
       WHERE b.booking_id = ?
       LIMIT 1
       FOR UPDATE`,
      [bookingId],
    );
    const booking = Array.isArray(bRows) ? bRows[0] : null;
    if (!booking) {
      throw new BookingError("Không tìm thấy booking", 404);
    }
    if (Number(booking.user_id) !== Number(userId)) {
      throw new BookingError("Không có quyền thao tác booking này", 403);
    }
    if (String(booking.service_type || "") !== "room") {
      throw new BookingError("Booking này không phải đặt phòng", 400);
    }

    const bookingStatus = String(booking.booking_status || "");
    if (!["pending", "confirmed"].includes(bookingStatus)) {
      throw new BookingError(
        "Booking không còn ở trạng thái có thể xác nhận",
        400,
      );
    }

    const [payRows] = await connection.query<RowDataPacket[]>(
      `SELECT payment_id, status
       FROM payments
       WHERE booking_id = ? AND transaction_source = 'online_booking'
       ORDER BY payment_id DESC
       LIMIT 1
       FOR UPDATE`,
      [bookingId],
    );
    const payment = Array.isArray(payRows) ? payRows[0] : null;
    if (!payment) {
      throw new BookingError("Không tìm thấy payment cho booking", 404);
    }

    const paymentId = Number(payment.payment_id);
    const paymentStatus = String(payment.status || "pending");

    if (!["pending", "completed"].includes(paymentStatus)) {
      throw new BookingError(
        "Payment không còn ở trạng thái có thể xác nhận",
        400,
      );
    }

    // If booking creation deferred actual room reservation until confirm-time,
    // reserve missing hotel stay now (idempotent for bookings that already reserved).
    await reserveHotelStaysForBookingsIfMissing({
      connection,
      bookingIds: [bookingId],
    });

    if (paymentStatus !== "completed") {
      await connection.query(
        `UPDATE payments
         SET status = 'completed',
             performed_by_user_id = ?,
             performed_by_role = 'user',
             payment_time = CURRENT_TIMESTAMP
         WHERE payment_id = ?`,
        [userId, paymentId],
      );

      await connection.query(
        `UPDATE bookings
         SET status = 'confirmed'
         WHERE booking_id = ?`,
        [bookingId],
      );
    }

    await connection.commit();
    return {
      bookingId,
      paymentId,
      paymentStatus: "completed",
    };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};

export const listMyTableReservations = async (params: {
  userId: number;
  locationId?: number | null;
}): Promise<TableBookingReservationSummary[]> => {
  await ensureBookingTableReservationsSchema();

  const { userId, locationId } = params;
  if (!Number.isFinite(userId) || userId <= 0) {
    throw new BookingError("Chưa đăng nhập", 401);
  }

  const queryParams: Array<number> = [userId];
  let locationWhere = "";
  if (Number.isFinite(Number(locationId)) && Number(locationId) > 0) {
    locationWhere = " AND b.location_id = ?";
    queryParams.push(Number(locationId));
  }

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
       b.booking_id,
       b.location_id,
       l.location_name,
       b.status AS booking_status,
       b.check_in_date,
       b.contact_name,
       b.contact_phone,
       b.pos_order_id,
       r.start_time,
       r.end_time,
       t.table_id,
       t.table_name,
       p.status AS payment_status
     FROM booking_table_reservations r
     JOIN bookings b ON b.booking_id = r.booking_id
     JOIN locations l ON l.location_id = b.location_id
     JOIN services s ON s.service_id = b.service_id
     JOIN pos_tables t ON t.table_id = r.table_id
     LEFT JOIN payments p
       ON p.payment_id = (
         SELECT p2.payment_id
         FROM payments p2
         WHERE p2.booking_id = b.booking_id
         ORDER BY p2.payment_id DESC
         LIMIT 1
       )
     WHERE b.user_id = ?
       AND s.service_type = 'table'
       AND b.status IN ('pending','confirmed')
       AND r.status = 'active'
       ${locationWhere}
     ORDER BY b.check_in_date ASC, t.table_name ASC`,
    queryParams,
  );

  const now = new Date();
  const byBooking = new Map<number, TableBookingReservationSummary>();

  for (const row of rows) {
    const bookingId = Number(row.booking_id);
    if (!Number.isFinite(bookingId)) continue;
    const checkInDate = formatMysqlDateTime(new Date(row.check_in_date));
    const startTime = formatMysqlDateTime(new Date(row.start_time));
    const endTime = formatMysqlDateTime(new Date(row.end_time));
    const existing = byBooking.get(bookingId);
    if (!existing) {
      const windowOpenAt = computeOwnerReservationWindowStart(
        new Date(row.start_time),
      );
      byBooking.set(bookingId, {
        bookingId,
        locationId: Number(row.location_id),
        locationName: row.location_name ? String(row.location_name) : null,
        bookingStatus: String(row.booking_status || "pending"),
        paymentStatus: row.payment_status ? String(row.payment_status) : null,
        checkInDate,
        startTime,
        endTime,
        tableIds: [],
        tableNames: [],
        contactName: row.contact_name ? String(row.contact_name) : null,
        contactPhone: row.contact_phone ? String(row.contact_phone) : null,
        canCancel: now.getTime() < windowOpenAt.getTime(),
        canPreorder: Number(row.pos_order_id) == null,
        posOrderId: row.pos_order_id == null ? null : Number(row.pos_order_id),
      });
    }

    const item = byBooking.get(bookingId);
    if (!item) continue;
    const tableId = Number(row.table_id);
    if (Number.isFinite(tableId) && !item.tableIds.includes(tableId)) {
      item.tableIds.push(tableId);
    }
    const tableName = String(row.table_name || "").trim();
    if (tableName && !item.tableNames.includes(tableName)) {
      item.tableNames.push(tableName);
    }
    item.canPreorder = item.tableIds.length === 1;
    if (item.paymentStatus === "completed") {
      item.canPreorder = false;
    }
  }

  return Array.from(byBooking.values());
};

export const cancelMyTableBooking = async (params: {
  userId: number;
  bookingId: number;
}): Promise<{ bookingId: number }> => {
  await ensureBookingTableReservationsSchema();

  const { userId, bookingId } = params;
  if (!Number.isFinite(userId) || userId <= 0) {
    throw new BookingError("Chưa đăng nhập", 401);
  }
  if (!Number.isFinite(bookingId) || bookingId <= 0) {
    throw new BookingError("bookingId không hợp lệ", 400);
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [bookingRows] = await conn.query<RowDataPacket[]>(
      `SELECT b.booking_id, b.user_id, b.location_id, b.status, b.pos_order_id, l.owner_id
       FROM bookings b
       JOIN services s ON s.service_id = b.service_id
       JOIN locations l ON l.location_id = b.location_id
       WHERE b.booking_id = ?
         AND s.service_type = 'table'
       LIMIT 1
       FOR UPDATE`,
      [bookingId],
    );

    const booking = Array.isArray(bookingRows) ? bookingRows[0] : null;
    if (!booking) {
      throw new BookingError("Không tìm thấy booking", 404);
    }
    if (Number(booking.user_id) !== userId) {
      throw new BookingError("Không có quyền hủy booking này", 403);
    }
    if (!["pending", "confirmed"].includes(String(booking.status || ""))) {
      throw new BookingError("Booking không còn ở trạng thái có thể hủy", 400);
    }

    const [reservationRows] = await conn.query<RowDataPacket[]>(
      `SELECT reservation_id, start_time, table_id
       FROM booking_table_reservations
       WHERE booking_id = ?
         AND status = 'active'
       FOR UPDATE`,
      [bookingId],
    );

    if (!Array.isArray(reservationRows) || reservationRows.length === 0) {
      throw new BookingError("Booking không còn bàn giữ chỗ để hủy", 400);
    }

    const earliestStart = reservationRows
      .map((row) => new Date(row.start_time))
      .reduce((min, current) =>
        current.getTime() < min.getTime() ? current : min,
      );
    const cancelDeadline = computeOwnerReservationWindowStart(earliestStart);
    if (Date.now() >= cancelDeadline.getTime()) {
      throw new BookingError(
        "Không thể hủy khi đã vào khung giờ nhận bàn",
        400,
      );
    }

    await conn.query(
      `UPDATE booking_table_reservations
       SET status = 'cancelled',
           cancelled_at = NOW(),
           cancelled_by_user_id = ?,
           actual_end_time = NOW()
       WHERE booking_id = ?
         AND status = 'active'`,
      [userId, bookingId],
    );

    await conn.query(
      `UPDATE bookings
       SET status = 'cancelled',
           cancelled_at = NOW(),
           cancelled_by = ?
       WHERE booking_id = ?`,
      [userId, bookingId],
    );

    if (booking.pos_order_id != null) {
      await conn.query(
        `UPDATE pos_orders
         SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
         WHERE order_id = ? AND status = 'open'`,
        [Number(booking.pos_order_id)],
      );
    }

    const [tableRows] = await conn.query<RowDataPacket[]>(
      `SELECT table_id
       FROM booking_table_reservations
       WHERE booking_id = ?`,
      [bookingId],
    );
    const tableIds = tableRows
      .map((row) => Number(row.table_id))
      .filter((id) => Number.isFinite(id));
    if (tableIds.length > 0) {
      const placeholders = tableIds.map(() => "?").join(",");
      await conn.query(
        `UPDATE pos_tables
         SET status = 'free'
         WHERE table_id IN (${placeholders})
           AND status = 'reserved'`,
        tableIds,
      );
    }

    await conn.commit();

    const ownerId = Number(booking.owner_id);
    if (Number.isFinite(ownerId)) {
      void publishPosUpdatedForLocation({
        locationId: Number(booking.location_id),
        ownerId,
        event: {
          type: "pos_updated",
          location_id: Number(booking.location_id),
          action: "table_booking_cancelled",
          booking_id: bookingId,
        },
      });
    }

    return { bookingId };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

export const attachPreorderToMyTableBooking = async (params: {
  userId: number;
  bookingId: number;
  items: Array<{ serviceId: number; quantity: number }>;
}): Promise<AttachTablePreorderResult> => {
  await ensureBookingTableReservationsSchema();
  await ensureBookingPreorderItemsSchema();

  const { userId, bookingId, items } = params;
  if (!Number.isFinite(userId) || userId <= 0) {
    throw new BookingError("Chưa đăng nhập", 401);
  }
  if (!Number.isFinite(bookingId) || bookingId <= 0) {
    throw new BookingError("bookingId không hợp lệ", 400);
  }
  if (!Array.isArray(items) || items.length === 0) {
    throw new BookingError("Vui lòng chọn ít nhất 1 món đặt trước", 400);
  }

  const normalizedItems = items
    .map((item) => ({
      serviceId: Number(item.serviceId),
      quantity: Math.max(1, Math.floor(Number(item.quantity || 0))),
    }))
    .filter(
      (item) =>
        Number.isFinite(item.serviceId) &&
        item.serviceId > 0 &&
        Number.isFinite(item.quantity) &&
        item.quantity > 0,
    );

  if (normalizedItems.length === 0) {
    throw new BookingError("Vui lòng chọn ít nhất 1 món đặt trước", 400);
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [bookingRows] = await conn.query<RowDataPacket[]>(
      `SELECT b.booking_id, b.user_id, b.location_id, b.status, b.total_amount, b.final_amount,
              b.discount_amount, b.pos_order_id, l.owner_id
       FROM bookings b
       JOIN services s ON s.service_id = b.service_id
       JOIN locations l ON l.location_id = b.location_id
       WHERE b.booking_id = ?
         AND s.service_type = 'table'
       LIMIT 1
       FOR UPDATE`,
      [bookingId],
    );

    const booking = Array.isArray(bookingRows) ? bookingRows[0] : null;
    if (!booking) throw new BookingError("Không tìm thấy booking", 404);
    if (Number(booking.user_id) !== userId) {
      throw new BookingError("Không có quyền thao tác booking này", 403);
    }
    if (!["pending", "confirmed"].includes(String(booking.status || ""))) {
      throw new BookingError(
        "Booking không còn ở trạng thái có thể đặt món",
        400,
      );
    }

    const [reservationRows] = await conn.query<RowDataPacket[]>(
      `SELECT table_id
       FROM booking_table_reservations
       WHERE booking_id = ?
         AND status = 'active'
         AND actual_end_time IS NULL
       FOR UPDATE`,
      [bookingId],
    );
    const tableIds = reservationRows
      .map((row) => Number(row.table_id))
      .filter((id) => Number.isFinite(id));

    if (tableIds.length !== 1) {
      throw new BookingError("Chỉ hỗ trợ đặt món sau khi giữ đúng 1 bàn", 400);
    }

    const menuIds = normalizedItems.map((item) => item.serviceId);
    const placeholders = menuIds.map(() => "?").join(",");
    const [menuRows] = await conn.query<RowDataPacket[]>(
      `SELECT service_id, service_name, price, status, admin_status, service_type
       FROM services
       WHERE location_id = ?
         AND service_id IN (${placeholders})
         AND deleted_at IS NULL
       FOR UPDATE`,
      [Number(booking.location_id), ...menuIds],
    );

    const priceMap = new Map<number, number>();
    const serviceNameMap = new Map<number, string>();
    for (const row of menuRows as any[]) {
      const serviceId = Number(row.service_id);
      const serviceType = String(row.service_type || "");
      const status = String(row.status || "");
      const adminStatus = String(row.admin_status || "");
      if (!["food", "combo", "other"].includes(serviceType)) {
        throw new BookingError("Món đặt trước không hợp lệ", 400);
      }
      if (
        adminStatus !== "approved" ||
        !["available", "reserved"].includes(status)
      ) {
        throw new BookingError("Món đặt trước hiện không khả dụng", 409);
      }
      priceMap.set(serviceId, toNumber(row.price));
      serviceNameMap.set(serviceId, String(row.service_name || "").trim());
    }

    if (priceMap.size !== menuIds.length) {
      throw new BookingError("Món đặt trước không hợp lệ", 400);
    }

    let preorderAmount = 0;
    for (const item of normalizedItems) {
      preorderAmount += roundMoney(
        (priceMap.get(item.serviceId) ?? 0) * item.quantity,
      );
    }
    preorderAmount = roundMoney(preorderAmount);

    const primaryTableId = tableIds[0];
    let posOrderId =
      booking.pos_order_id == null ? null : Number(booking.pos_order_id);

    if (Number.isFinite(posOrderId)) {
      const [orderRows] = await conn.query<RowDataPacket[]>(
        `SELECT order_id, status
         FROM pos_orders
         WHERE order_id = ?
         LIMIT 1
         FOR UPDATE`,
        [posOrderId],
      );
      const orderRow = Array.isArray(orderRows) ? orderRows[0] : null;
      if (!orderRow || String(orderRow.status || "") !== "open") {
        throw new BookingError(
          "Booking này không còn order mở để cập nhật món đặt trước",
          400,
        );
      }
      await conn.query(`DELETE FROM pos_order_items WHERE order_id = ?`, [
        posOrderId,
      ]);
    } else {
      const [insertOrder] = await conn.query<any>(
        `INSERT INTO pos_orders (
           location_id,
           table_id,
           status,
           order_source,
           subtotal_amount,
           discount_amount,
           final_amount,
           created_by
         ) VALUES (?, ?, 'open', 'online_booking', ?, 0.00, ?, ?)`,
        [
          Number(booking.location_id),
          primaryTableId,
          preorderAmount,
          preorderAmount,
          userId,
        ],
      );
      posOrderId = Number(insertOrder?.insertId);
      if (!Number.isFinite(posOrderId)) {
        throw new BookingError("Không thể tạo order đặt món trước", 500);
      }
    }

    for (const item of normalizedItems) {
      const unitPrice = roundMoney(priceMap.get(item.serviceId) ?? 0);
      const lineTotal = roundMoney(unitPrice * item.quantity);
      await conn.query(
        `INSERT INTO pos_order_items (order_id, service_id, quantity, unit_price, line_total)
         VALUES (?, ?, ?, ?, ?)`,
        [posOrderId, item.serviceId, item.quantity, unitPrice, lineTotal],
      );
    }

    await conn.query(
      `UPDATE pos_orders
       SET subtotal_amount = ?,
           final_amount = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE order_id = ?`,
      [preorderAmount, preorderAmount, posOrderId],
    );

    const currentTotal = roundMoney(Number(booking.total_amount || 0));
    const currentFinal = roundMoney(Number(booking.final_amount || 0));
    await conn.query(
      `UPDATE bookings
       SET pos_order_id = ?,
           total_amount = ?,
           final_amount = ?
       WHERE booking_id = ?`,
      [
        posOrderId,
        roundMoney(currentTotal + preorderAmount),
        roundMoney(currentFinal + preorderAmount),
        bookingId,
      ],
    );

    await conn.query(
      `DELETE FROM booking_preorder_items
       WHERE booking_id = ?
         AND source = 'preorder'`,
      [bookingId],
    );

    for (const item of normalizedItems) {
      const unitPrice = roundMoney(priceMap.get(item.serviceId) ?? 0);
      const lineTotal = roundMoney(unitPrice * item.quantity);
      await conn.query(
        `INSERT INTO booking_preorder_items (
           booking_id,
           location_id,
           service_id,
           service_name_snapshot,
           quantity,
           unit_price,
           line_total,
           source
         ) VALUES (?, ?, ?, ?, ?, ?, ?, 'preorder')`,
        [
          bookingId,
          Number(booking.location_id),
          item.serviceId,
          serviceNameMap.get(item.serviceId) || null,
          item.quantity,
          unitPrice,
          lineTotal,
        ],
      );
    }

    await conn.commit();

    const ownerId = Number(booking.owner_id);
    if (Number.isFinite(ownerId)) {
      void publishPosUpdatedForLocation({
        locationId: Number(booking.location_id),
        ownerId,
        event: {
          type: "pos_updated",
          location_id: Number(booking.location_id),
          action: "table_booking_preorder_updated",
          booking_id: bookingId,
        },
      });
    }

    return {
      bookingId,
      posOrderId: Number(posOrderId),
      preorderAmount,
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

export const isBookingError = (err: unknown): err is BookingError => {
  return err instanceof BookingError;
};
