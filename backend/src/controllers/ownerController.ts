import type { Request, Response } from "express";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import bcrypt from "bcrypt";
import crypto from "crypto";

import { pool } from "../config/database";
import {
  ensureBookingTableReservationsSchema,
  releaseTableReservations,
} from "../utils/tableReservations";
import { saveUploadedImageToUploads } from "../utils/uploadImage";
import {
  publishToUser,
  publishToUsers,
  type RealtimeEvent,
} from "../utils/realtime";

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

const normalizePhoneNumber = (
  value: string | null | undefined,
): string | null => {
  const normalized = String(value || "").trim();
  return normalized ? normalized : null;
};

const isValidPhoneNumber = (value: string): boolean => {
  return PHONE_PATTERN.test(String(value || "").trim());
};
let posOrdersHasOrderSourceColumn: boolean | null = null;

type PosTicketsSchemaSupport = {
  hasSoldBy: boolean;
};

let posTicketsSchemaSupport: PosTicketsSchemaSupport | null = null;

type PaymentsSchemaSupport = {
  userIdNullable: boolean;
  hasTransactionSource: boolean;
  hasPerformedByUserId: boolean;
  hasPerformedByRole: boolean;
  hasPerformedByName: boolean;
};

let paymentsSchemaSupport: PaymentsSchemaSupport | null = null;

const getPaymentsSchemaSupport = async (): Promise<PaymentsSchemaSupport> => {
  if (paymentsSchemaSupport) return paymentsSchemaSupport;

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COLUMN_NAME, IS_NULLABLE
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'payments'
       AND COLUMN_NAME IN (
         'user_id',
         'transaction_source',
         'performed_by_user_id',
         'performed_by_role',
         'performed_by_name'
       )`,
  );

  const byName = new Map<string, { isNullable: boolean }>();
  for (const r of rows) {
    const col = String(r.COLUMN_NAME || "");
    byName.set(col, {
      isNullable: String(r.IS_NULLABLE || "").toUpperCase() === "YES",
    });
  }

  paymentsSchemaSupport = {
    userIdNullable: byName.get("user_id")?.isNullable ?? false,
    hasTransactionSource: byName.has("transaction_source"),
    hasPerformedByUserId: byName.has("performed_by_user_id"),
    hasPerformedByRole: byName.has("performed_by_role"),
    hasPerformedByName: byName.has("performed_by_name"),
  };

  return paymentsSchemaSupport;
};

const getUserSnapshotWithConn = async (
  conn: any,
  userId: number,
): Promise<{ full_name: string | null; phone: string | null }> => {
  const [rows] = await conn.query(
    `SELECT full_name, phone FROM users WHERE user_id = ? LIMIT 1`,
    [userId],
  );

  return {
    full_name: rows[0]?.full_name ? String(rows[0].full_name) : null,
    phone: rows[0]?.phone ? String(rows[0].phone) : null,
  };
};

const formatBookingActorDisplay = (p: {
  full_name: string | null;
  phone: string | null;
  bookedAt: string | null;
}): string => {
  const name = String(p.full_name || "").trim();
  const phone = String(p.phone || "").trim();
  const bookedAt = String(p.bookedAt || "").trim();

  if (name && phone && bookedAt) return `${name} - ${phone} - ${bookedAt}`;
  if (name && phone) return `${name} - ${phone}`;
  if (name && bookedAt) return `${name} - ${bookedAt}`;
  return name || phone || bookedAt || "";
};

const getPosOrdersHasOrderSourceColumn = async (): Promise<boolean> => {
  if (posOrdersHasOrderSourceColumn != null)
    return posOrdersHasOrderSourceColumn;
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'pos_orders'
       AND COLUMN_NAME = 'order_source'`,
  );
  posOrdersHasOrderSourceColumn = Number(rows[0]?.cnt || 0) > 0;
  return posOrdersHasOrderSourceColumn;
};

const getPosTicketsSchemaSupport =
  async (): Promise<PosTicketsSchemaSupport> => {
    if (posTicketsSchemaSupport) return posTicketsSchemaSupport;

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT COLUMN_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'pos_tickets'
       AND COLUMN_NAME IN ('sold_by')`,
    );

    const cols = new Set<string>();
    for (const r of rows) cols.add(String(r.COLUMN_NAME || ""));

    posTicketsSchemaSupport = {
      hasSoldBy: cols.has("sold_by"),
    };

    return posTicketsSchemaSupport;
  };

type Role = "owner" | "employee";

type PermissionKey =
  | "can_manage_locations"
  | "can_manage_services"
  | "can_manage_bookings"
  | "can_manage_vouchers"
  | "can_manage_reviews"
  | "can_chat"
  | "can_scan"
  | "view_revenue";

const getAuth = async (
  req: Request,
): Promise<{ userId: number; role: Role }> => {
  const userId = req.userId;
  const role = req.userRole as Role | undefined;

  if (!userId || (role !== "owner" && role !== "employee")) {
    throw Object.assign(new Error("Chưa xác thực"), { statusCode: 401 });
  }

  return { userId, role };
};

const getOwnerIdForEmployee = async (employeeId: number): Promise<number> => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT DISTINCT owner_id FROM employee_locations WHERE employee_id = ? LIMIT 1`,
    [employeeId],
  );

  const ownerId = rows[0]?.owner_id;
  if (!ownerId) {
    throw Object.assign(new Error("Tài khoản nhân viên chưa được gán owner"), {
      statusCode: 403,
    });
  }

  return Number(ownerId);
};

const recalcLocationRatingFromReviews = async (
  locationId: number,
): Promise<void> => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
       COUNT(*) AS total_reviews,
       ROUND(COALESCE(AVG(rating), 0), 1) AS avg_rating
     FROM reviews
     WHERE location_id = ?
       AND status = 'active'`,
    [locationId],
  );

  const totalReviews = Number(rows?.[0]?.total_reviews ?? 0);
  const avgRating = Number(rows?.[0]?.avg_rating ?? 0);

  await pool.query(
    `UPDATE locations
     SET rating = ?, total_reviews = ?, updated_at = NOW()
     WHERE location_id = ?`,
    [avgRating, totalReviews, locationId],
  );
};

const ensureOwnerNotificationReadsSchema = async (): Promise<void> => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS owner_notification_reads (
      notification_id INT NOT NULL,
      owner_user_id INT NOT NULL,
      read_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (notification_id, owner_user_id),
      KEY idx_owner_notification_reads_user (owner_user_id),
      CONSTRAINT fk_owner_notification_reads_notification
        FOREIGN KEY (notification_id) REFERENCES push_notifications(notification_id)
        ON DELETE CASCADE,
      CONSTRAINT fk_owner_notification_reads_user
        FOREIGN KEY (owner_user_id) REFERENCES users(user_id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `);
};

const ensureOwnerNotificationDismissedSchema = async (): Promise<void> => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS owner_notification_dismissed (
      notification_id INT NOT NULL,
      owner_user_id INT NOT NULL,
      dismissed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (notification_id, owner_user_id),
      KEY idx_owner_notification_dismissed_user (owner_user_id),
      CONSTRAINT fk_owner_notification_dismissed_notification
        FOREIGN KEY (notification_id) REFERENCES push_notifications(notification_id)
        ON DELETE CASCADE,
      CONSTRAINT fk_owner_notification_dismissed_user
        FOREIGN KEY (owner_user_id) REFERENCES users(user_id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `);
};

const employeeHasPermission = (
  permissions: unknown,
  key: PermissionKey,
): boolean => {
  if (!permissions || typeof permissions !== "object") return false;
  return Boolean((permissions as Record<string, unknown>)[key]);
};

const ensureLocationAccess = async (params: {
  auth: { userId: number; role: Role };
  locationId: number;
  requiredPermission?: PermissionKey;
}): Promise<{ ownerId: number }> => {
  const { auth, locationId, requiredPermission } = params;

  if (!Number.isFinite(locationId)) {
    throw Object.assign(new Error("locationId không hợp lệ"), {
      statusCode: 400,
    });
  }

  if (auth.role === "owner") {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT owner_id FROM locations WHERE location_id = ? LIMIT 1`,
      [locationId],
    );

    const ownerId = rows[0]?.owner_id;
    if (!ownerId) {
      throw Object.assign(new Error("Không tìm thấy địa điểm"), {
        statusCode: 404,
      });
    }

    if (Number(ownerId) !== auth.userId) {
      throw Object.assign(new Error("Không có quyền với địa điểm này"), {
        statusCode: 403,
      });
    }

    return { ownerId: auth.userId };
  }

  const ownerId = await getOwnerIdForEmployee(auth.userId);

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT permissions, status FROM employee_locations
     WHERE employee_id = ? AND owner_id = ? AND location_id = ?
     LIMIT 1`,
    [auth.userId, ownerId, locationId],
  );

  const assignment = rows[0];
  if (!assignment || assignment.status !== "active") {
    throw Object.assign(new Error("Bạn chưa được phân quyền địa điểm này"), {
      statusCode: 403,
    });
  }

  if (requiredPermission) {
    const permissions = assignment.permissions;
    if (!employeeHasPermission(permissions, requiredPermission)) {
      throw Object.assign(new Error("Bạn không có quyền thao tác"), {
        statusCode: 403,
      });
    }
  }

  return { ownerId };
};

const getRealtimeRecipientsForLocation = async (
  db: { query: (sql: string, params?: any[]) => Promise<any> },
  locationId: number,
  ownerId: number,
): Promise<number[]> => {
  const ids = new Set<number>();
  if (Number.isFinite(ownerId)) ids.add(ownerId);

  const [rows] = (await db.query(
    `SELECT employee_id
     FROM employee_locations
     WHERE owner_id = ? AND location_id = ? AND status = 'active'`,
    [ownerId, locationId],
  )) as [any[]];

  for (const r of rows) {
    const id = Number((r as any).employee_id);
    if (Number.isFinite(id)) ids.add(id);
  }

  const [bookingUserRows] = (await db.query(
    `SELECT DISTINCT b.user_id
     FROM bookings b
     JOIN services s ON s.service_id = b.service_id
     WHERE b.location_id = ?
       AND b.user_id IS NOT NULL
       AND b.status IN ('pending','confirmed')
       AND s.service_type IN ('table','room')`,
    [locationId],
  )) as [any[]];

  for (const r of bookingUserRows) {
    const id = Number((r as any).user_id);
    if (Number.isFinite(id)) ids.add(id);
  }

  return Array.from(ids);
};

const publishLocationEvent = async (
  db: { query: (sql: string, params?: any[]) => Promise<any> },
  locationId: number,
  ownerId: number,
  event: RealtimeEvent,
) => {
  try {
    const userIds = await getRealtimeRecipientsForLocation(
      db,
      locationId,
      ownerId,
    );
    publishToUsers(userIds, event);
  } catch {
    // ignore realtime failures
  }
};
type PosPaymentsRange = "day" | "week" | "month" | "year" | "all";

const toDateRange = (params: {
  range: PosPaymentsRange;
  date?: string | null;
  from?: string | null;
  to?: string | null;
}): { start: Date | null; end: Date | null } => {
  const { range } = params;
  const from = String(params.from || "").trim();
  const to = String(params.to || "").trim();
  const date = String(params.date || "").trim();

  // Custom explicit range wins
  if (from && to) {
    const s = new Date(from);
    const e = new Date(to);
    if (!Number.isNaN(s.getTime()) && !Number.isNaN(e.getTime())) {
      return { start: s, end: e };
    }
  }

  const now = new Date();
  if (range === "all") return { start: null, end: null };

  const base = date ? new Date(`${date}T00:00:00`) : new Date(now);
  const baseValid = !Number.isNaN(base.getTime());

  const clampStartOfDay = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  };

  if (range === "day") {
    if (!baseValid) return { start: null, end: null };
    const start = clampStartOfDay(base);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
  }

  if (range === "week") {
    const ref = baseValid ? base : now;
    const refDay = new Date(ref);
    // getDay(): 0=Sun, 1=Mon ... 6=Sat. We want Monday as start.
    const dow = refDay.getDay();
    const diffFromMonday = (dow + 6) % 7;

    const start = clampStartOfDay(refDay);
    start.setDate(start.getDate() - diffFromMonday);

    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return { start, end };
  }

  if (range === "month") {
    const ref = baseValid ? base : now;
    const start = clampStartOfDay(ref);
    start.setDate(1);

    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    return { start, end };
  }

  if (range === "year") {
    const ref = baseValid ? base : now;
    const start = clampStartOfDay(ref);
    start.setMonth(0, 1);

    const end = new Date(start);
    end.setFullYear(end.getFullYear() + 1);
    return { start, end };
  }

  return { start: null, end: null };
};

const parsePaymentNotesJson = (raw: unknown): any | null => {
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  const s = String(raw);
  if (!s.trim()) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
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

export const getPosPaymentsHistory = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    const locationId = Number((req.query as any).location_id);
    if (!Number.isFinite(locationId)) {
      res
        .status(400)
        .json({ success: false, message: "location_id không hợp lệ" });
      return;
    }

    const { ownerId } = await ensureLocationAccess({ auth, locationId });

    // Commission % is configured by admin per location
    const [locRows] = await pool.query<RowDataPacket[]>(
      `SELECT commission_rate
       FROM locations
       WHERE location_id = ? AND owner_id = ?
       LIMIT 1`,
      [locationId, ownerId],
    );
    const commissionRateRaw = Number(locRows?.[0]?.commission_rate ?? 0);
    const commissionRate = Number.isFinite(commissionRateRaw)
      ? commissionRateRaw
      : 0;

    const range = String((req.query as any).range || "day")
      .trim()
      .toLowerCase() as PosPaymentsRange;
    const date = (req.query as any).date as string | undefined;
    const from = (req.query as any).from as string | undefined;
    const to = (req.query as any).to as string | undefined;
    const { start, end } = toDateRange({ range, date, from, to });

    const where: string[] = [
      "p.location_id = ?",
      "p.status = 'completed'",
      // POS food invoices OR hotel stay invoices
      "(p.notes LIKE '%\"service_type\":\"food\"%' OR p.notes LIKE '%\"service_type\":\"table\"%' OR p.notes LIKE 'HOTEL_STAY:%' OR p.notes LIKE 'HOTEL_STAYS:%' OR p.notes LIKE 'TOURIST_TICKETS:%')",
    ];
    const params: any[] = [locationId];
    if (start && end) {
      where.push("p.payment_time >= ? AND p.payment_time < ?");
      params.push(start);
      params.push(end);
    }

    const support = await getPaymentsSchemaSupport();

    const selectCols: string[] = [
      "p.payment_id",
      "p.payment_time",
      "p.amount",
      "p.payment_method",
      "p.booking_id",
      "p.notes",
      "p.qr_data",
    ];
    if (support.hasTransactionSource) selectCols.push("p.transaction_source");
    if (support.hasPerformedByUserId) selectCols.push("p.performed_by_user_id");
    if (support.hasPerformedByRole) selectCols.push("p.performed_by_role");
    if (support.hasPerformedByName) selectCols.push("p.performed_by_name");

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT ${selectCols.join(", ")}
       FROM payments p
       WHERE ${where.join(" AND ")}
       ORDER BY p.payment_time DESC
       LIMIT 2000`,
      params,
    );

    const history: Array<{
      payment_id: number;
      payment_ids?: number[];
      payment_time: string;
      amount: number;
      payment_method: string;
      transaction_source: string;
      booking_id: number | null;
      booking_contact_name?: string | null;
      booking_contact_phone?: string | null;
      table_name: string | null;
      total_qty: number;
      items_count: number;
      hotel?: {
        stay_id: number | null;
        room_number: string | null;
        guest_name: string | null;
        guest_phone: string | null;
        checkin_time: string | null;
        checkout_time: string | null;
        actual_minutes: number | null;
      } | null;
      hotel_rooms?: Array<{
        stay_id: number | null;
        room_number: string | null;
        guest_name: string | null;
        guest_phone: string | null;
        checkin_time: string | null;
        checkout_time: string | null;
        gross_amount: number | null;
        prepaid_amount: number | null;
        onsite_amount: number | null;
        total_amount: number | null;
      }> | null;
      performed_by: {
        role: "owner" | "employee" | "user" | null;
        user_id: number | null;
        name: string | null;
        phone: string | null;
      };
      processed_by: {
        name: string | null;
        role: "owner" | "employee" | "user" | null;
      };
      items: Array<{
        service_id: number;
        service_name: string;
        quantity: number;
        unit_price: number;
        line_total: number;
      }>;
      prepaid_items?: Array<{
        service_id: number;
        service_name: string;
        quantity: number;
        unit_price: number;
        line_total: number;
      }>;
      onsite_items?: Array<{
        service_id: number;
        service_name: string;
        quantity: number;
        unit_price: number;
        line_total: number;
      }>;
      prepaid_amount?: number;
      onsite_amount?: number;
      prepaid_payment_method?: string | null;
      onsite_payment_method?: string | null;
      segment_type?: "prepaid" | "onsite" | null;
    }> = [];

    let total = 0;
    let totalCash = 0;
    let totalTransfer = 0;

    // Commission only applies to pre-booked users (online_booking)
    let bookingBaseTotal = 0;

    const pad2 = (n: number) => String(Math.floor(n)).padStart(2, "0");
    const formatYmd = (d: Date) =>
      `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    const formatYm = (d: Date) =>
      `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;

    const getBucketKey = (d: Date): string => {
      if (range === "day") {
        return `${formatYmd(d)}T${pad2(d.getHours())}:00`;
      }
      if (range === "week" || range === "month") {
        return formatYmd(d);
      }
      // year/all
      return formatYm(d);
    };

    // Chart series bucketed by range (hour/day/month)
    const byBucket = new Map<string, { total: number; booking_base: number }>();

    const bookingUserIds = new Set<number>();
    const bookingIds = new Set<number>();
    const hotelStayIds = new Set<number>();

    const toIsoOrNull = (v: unknown): string | null => {
      if (!v) return null;
      const d = v instanceof Date ? v : new Date(String(v));
      return Number.isFinite(d.getTime()) ? d.toISOString() : null;
    };

    for (const r of rows) {
      const paymentId = Number(r.payment_id);
      if (!Number.isFinite(paymentId)) continue;

      const rawNotes = r.notes;
      const notes = parsePaymentNotesJson(rawNotes);
      const isFood =
        Boolean(notes) && String(notes.service_type || "") === "food";
      const isTable =
        Boolean(notes) && String(notes.service_type || "") === "table";
      const notesStr = String(rawNotes || "");
      const isHotelSingle = notesStr.startsWith("HOTEL_STAY:");
      const isHotelBatch = notesStr.startsWith("HOTEL_STAYS:");
      const isHotel = isHotelSingle || isHotelBatch;
      const isTourist = notesStr.startsWith("TOURIST_TICKETS:");
      if (!isFood && !isTable && !isHotel && !isTourist) continue;

      const amount = Number(r.amount || 0);
      const pm = String(r.payment_method || "");
      const transactionSource = support.hasTransactionSource
        ? String((r as any).transaction_source || "")
        : "";
      const bookingIdRaw = (r as any).booking_id;
      const bookingId =
        bookingIdRaw == null ? null : Number((r as any).booking_id);

      if (Number.isFinite(bookingId as number) && (bookingId as number) > 0) {
        bookingIds.add(bookingId as number);
      }

      const paymentTimeRaw = r.payment_time;
      const paymentTime = paymentTimeRaw
        ? new Date(paymentTimeRaw).toISOString()
        : new Date().toISOString();

      const qrParsed =
        isHotel || isTourist ? parsePaymentNotesJson((r as any).qr_data) : null;
      const touristSnap =
        isTourist && qrParsed && typeof qrParsed === "object"
          ? (qrParsed as any).tourist_invoice
          : null;

      const itemsRaw =
        (isFood || isTable) && notes && Array.isArray(notes.items)
          ? notes.items
          : isTourist &&
              touristSnap &&
              Array.isArray((touristSnap as any).items)
            ? (touristSnap as any).items
            : [];
      if (
        isTable &&
        transactionSource === "online_booking" &&
        notes?.invoice_ready !== true
      ) {
        continue;
      }
      const items = itemsRaw
        .map((it: any) => ({
          service_id: Number(it.service_id),
          service_name: String(it.service_name || ""),
          quantity: Number(it.quantity || 0),
          unit_price: Number(it.unit_price || 0),
          line_total: Number(it.line_total || 0),
        }))
        .filter(
          (it: any) =>
            Number.isFinite(it.service_id) &&
            Boolean(it.service_name) &&
            Number.isFinite(it.quantity) &&
            Number.isFinite(it.unit_price) &&
            Number.isFinite(it.line_total),
        );

      const totalQty = Number(
        (isFood && notes ? notes.total_qty : null) ||
          (isTourist && touristSnap && (touristSnap as any).total_qty != null
            ? Number((touristSnap as any).total_qty)
            : null) ||
          items.reduce((s: number, x: any) => s + Number(x.quantity || 0), 0) ||
          0,
      );
      const tableName =
        isFood && notes?.table_name
          ? String(notes.table_name)
          : isTable && notes?.table_names
            ? String(notes.table_names)
            : isTourist
              ? "Vé du lịch"
              : null;

      const performedUserIdFromNotes =
        notes?.performed_by?.user_id != null
          ? Number(notes.performed_by.user_id)
          : null;
      const performedUserIdFromColumn = support.hasPerformedByUserId
        ? (r as any).performed_by_user_id != null
          ? Number((r as any).performed_by_user_id)
          : null
        : null;
      const performedUserId = Number.isFinite(
        performedUserIdFromNotes as number,
      )
        ? (performedUserIdFromNotes as number)
        : Number.isFinite(performedUserIdFromColumn as number)
          ? (performedUserIdFromColumn as number)
          : null;

      const performedRole =
        notes?.performed_by?.role === "owner" ||
        notes?.performed_by?.role === "employee" ||
        notes?.performed_by?.role === "user"
          ? (notes.performed_by.role as "owner" | "employee" | "user")
          : support.hasPerformedByRole
            ? ((r as any).performed_by_role as any) || null
            : null;

      const performedName =
        (notes?.performed_by?.name ? String(notes.performed_by.name) : null) ||
        (support.hasPerformedByName && (r as any).performed_by_name
          ? String((r as any).performed_by_name)
          : null);

      const performedPhone =
        performedRole === "user" && notes?.performed_by?.phone
          ? String(notes.performed_by.phone)
          : null;

      const processedName = notes?.processed_by?.name
        ? String(notes.processed_by.name)
        : null;
      const processedRole =
        notes?.processed_by?.role === "owner" ||
        notes?.processed_by?.role === "employee" ||
        notes?.processed_by?.role === "user"
          ? (notes.processed_by.role as "owner" | "employee" | "user")
          : null;

      // Hotel invoice details
      let hotel: {
        stay_id: number | null;
        room_number: string | null;
        guest_name: string | null;
        guest_phone: string | null;
        checkin_time: string | null;
        checkout_time: string | null;
        actual_minutes: number | null;
      } | null = null;

      let hotelRooms: Array<{
        stay_id: number | null;
        room_number: string | null;
        guest_name: string | null;
        guest_phone: string | null;
        checkin_time: string | null;
        checkout_time: string | null;
        gross_amount: number | null;
        prepaid_payment_method: string | null;
        prepaid_amount: number | null;
        onsite_amount: number | null;
        total_amount: number | null;
      }> | null = null;
      let hotelPrepaidAmount = 0;
      let hotelOnsiteAmount = 0;
      let hotelPrepaidPaymentMethod: string | null = null;
      if (isHotel) {
        const stayIds: number[] = [];
        if (isHotelSingle) {
          const stayIdRaw = notesStr.split(":").pop();
          const stayId = stayIdRaw != null ? Number(stayIdRaw) : NaN;
          if (Number.isFinite(stayId)) stayIds.push(stayId);
        } else {
          const listRaw = notesStr.split(":").slice(1).join(":");
          for (const part of String(listRaw || "").split(",")) {
            const n = Number(String(part || "").trim());
            if (Number.isFinite(n)) stayIds.push(n);
          }
        }
        for (const sid of stayIds) hotelStayIds.add(sid);

        const qrParsed = parsePaymentNotesJson((r as any).qr_data);
        const snapAny =
          qrParsed && typeof qrParsed === "object" ? (qrParsed as any) : null;
        const snap = isHotelSingle
          ? snapAny?.hotel_invoice
          : Array.isArray(snapAny?.hotel_invoices)
            ? (snapAny.hotel_invoices as any[])[0]
            : null;
        const snapObj = snap && typeof snap === "object" ? snap : null;

        if (isHotelBatch && Array.isArray(snapAny?.hotel_invoices)) {
          const prepaidMethods = new Set<string>();
          hotelRooms = (snapAny.hotel_invoices as any[])
            .map((x: any) => {
              const checkinIso = toIsoOrNull(x?.checkin_time);
              const checkoutIso = toIsoOrNull(x?.checkout_time);
              const totalAmountRaw =
                x?.total_amount != null ? Number(x.total_amount) : NaN;
              const prepaidMethodRaw =
                x?.prepaid_payment_method != null
                  ? String(x.prepaid_payment_method).trim()
                  : "";
              const prepaidAmountRaw = Number(x?.prepaid_amount || 0);
              if (
                prepaidMethodRaw &&
                Number.isFinite(prepaidAmountRaw) &&
                prepaidAmountRaw > 0
              ) {
                prepaidMethods.add(prepaidMethodRaw);
              }
              return {
                stay_id: x?.stay_id == null ? null : Number(x.stay_id),
                room_number:
                  x?.room_number == null ? null : String(x.room_number),
                guest_name: x?.guest_name == null ? null : String(x.guest_name),
                guest_phone:
                  x?.guest_phone == null ? null : String(x.guest_phone),
                checkin_time: checkinIso,
                checkout_time: checkoutIso,
                gross_amount:
                  x?.gross_amount == null ? null : Number(x.gross_amount),
                prepaid_payment_method: prepaidMethodRaw || null,
                prepaid_amount:
                  x?.prepaid_amount == null ? null : Number(x.prepaid_amount),
                onsite_amount:
                  x?.onsite_amount == null ? null : Number(x.onsite_amount),
                total_amount: Number.isFinite(totalAmountRaw)
                  ? totalAmountRaw
                  : null,
              };
            })
            .filter(
              (x) =>
                Boolean(String(x.room_number || "").trim()) ||
                x.stay_id != null,
            );

          for (const x of snapAny.hotel_invoices as any[]) {
            const p = Number(x?.prepaid_amount || 0);
            const o = Number(x?.onsite_amount || x?.total_amount || 0);
            if (Number.isFinite(p) && p > 0) hotelPrepaidAmount += p;
            if (Number.isFinite(o) && o > 0) hotelOnsiteAmount += o;
          }

          if (prepaidMethods.size === 1) {
            hotelPrepaidPaymentMethod = Array.from(prepaidMethods)[0];
          }

          if (hotelRooms.length === 0) hotelRooms = null;
        }

        if (isHotelSingle && snapObj) {
          const snapPrepaidRaw = Number((snapObj as any).prepaid_amount || 0);
          if (Number.isFinite(snapPrepaidRaw) && snapPrepaidRaw > 0) {
            hotelPrepaidAmount = snapPrepaidRaw;
            const methodRaw =
              (snapObj as any).prepaid_payment_method != null
                ? String((snapObj as any).prepaid_payment_method).trim()
                : "";
            hotelPrepaidPaymentMethod = methodRaw || null;
          }
          const snapOnsiteRaw = Number(
            (snapObj as any).onsite_amount ??
              (snapObj as any).total_amount ??
              0,
          );
          if (Number.isFinite(snapOnsiteRaw) && snapOnsiteRaw > 0) {
            hotelOnsiteAmount = snapOnsiteRaw;
          }

          const totalAmountRaw =
            (snapObj as any).total_amount != null
              ? Number((snapObj as any).total_amount)
              : NaN;
          hotelRooms = [
            {
              stay_id: stayIds.length > 0 ? stayIds[0] : null,
              room_number:
                (snapObj as any).room_number != null
                  ? String((snapObj as any).room_number)
                  : null,
              guest_name:
                (snapObj as any).guest_name != null
                  ? String((snapObj as any).guest_name)
                  : null,
              guest_phone:
                (snapObj as any).guest_phone != null
                  ? String((snapObj as any).guest_phone)
                  : null,
              checkin_time: toIsoOrNull((snapObj as any).checkin_time),
              checkout_time: toIsoOrNull((snapObj as any).checkout_time),
              gross_amount:
                (snapObj as any).gross_amount == null
                  ? null
                  : Number((snapObj as any).gross_amount),
              prepaid_payment_method:
                (snapObj as any).prepaid_payment_method == null
                  ? null
                  : String((snapObj as any).prepaid_payment_method),
              prepaid_amount:
                (snapObj as any).prepaid_amount == null
                  ? null
                  : Number((snapObj as any).prepaid_amount),
              onsite_amount:
                (snapObj as any).onsite_amount == null
                  ? null
                  : Number((snapObj as any).onsite_amount),
              total_amount: Number.isFinite(totalAmountRaw)
                ? totalAmountRaw
                : null,
            },
          ];
        }

        let roomNumberDisplay: string | null = null;
        if (isHotelBatch && Array.isArray(snapAny?.hotel_invoices)) {
          const nums = (snapAny.hotel_invoices as any[])
            .map((x: any) => (x && x.room_number ? String(x.room_number) : ""))
            .map((x: string) => x.trim())
            .filter(Boolean);
          if (nums.length > 0) roomNumberDisplay = nums.join(", ");
        }

        const checkinIso = snapObj
          ? toIsoOrNull((snapObj as any).checkin_time)
          : null;
        const checkoutIso = snapObj
          ? toIsoOrNull((snapObj as any).checkout_time)
          : null;
        const actualMinutesRaw = snapObj
          ? Number((snapObj as any).actual_minutes)
          : NaN;
        const actualMinutes = Number.isFinite(actualMinutesRaw)
          ? Math.max(0, Math.floor(actualMinutesRaw))
          : checkinIso && checkoutIso
            ? Math.max(
                0,
                Math.floor(
                  (new Date(checkoutIso).getTime() -
                    new Date(checkinIso).getTime()) /
                    60000,
                ),
              )
            : null;

        hotel = {
          stay_id: stayIds.length > 0 ? stayIds[0] : null,
          room_number:
            roomNumberDisplay ||
            (snapObj && (snapObj as any).room_number
              ? String((snapObj as any).room_number)
              : null),
          guest_name:
            snapObj && (snapObj as any).guest_name
              ? String((snapObj as any).guest_name)
              : null,
          guest_phone:
            snapObj && (snapObj as any).guest_phone
              ? String((snapObj as any).guest_phone)
              : null,
          checkin_time: checkinIso,
          checkout_time: checkoutIso,
          actual_minutes: actualMinutes,
        };
      }

      const isPrebookedUser =
        performedRole === "user" ||
        transactionSource === "online_booking" ||
        bookingId != null;

      if (isPrebookedUser && performedUserId != null) {
        bookingUserIds.add(performedUserId);
      }

      history.push({
        payment_id: paymentId,
        payment_ids: [paymentId],
        payment_time: paymentTime,
        amount,
        payment_method: pm,
        transaction_source: transactionSource,
        booking_id: Number.isFinite(bookingId as number) ? bookingId : null,
        booking_contact_name: null,
        booking_contact_phone: null,
        table_name: tableName,
        total_qty: Number.isFinite(totalQty) ? totalQty : 0,
        items_count: items.length,
        hotel,
        hotel_rooms: hotelRooms,
        performed_by: {
          role: performedRole,
          user_id: performedUserId,
          name: performedName,
          phone: performedPhone,
        },
        processed_by: {
          name:
            processedName ||
            (performedRole === "owner" || performedRole === "employee"
              ? performedName
              : null),
          role:
            processedRole ||
            (performedRole === "owner" || performedRole === "employee"
              ? performedRole
              : null),
        },
        items,
        prepaid_items:
          isFood || isTable ? (notes?.invoice_ready === true ? items : []) : [],
        onsite_items:
          isFood || isTable ? (notes?.invoice_ready === true ? [] : items) : [],
        prepaid_amount:
          isFood || isTable
            ? notes?.invoice_ready === true
              ? amount
              : 0
            : isHotel
              ? toMoney(hotelPrepaidAmount)
              : 0,
        onsite_amount:
          isFood || isTable
            ? notes?.invoice_ready === true
              ? 0
              : amount
            : isHotel
              ? toMoney(hotelOnsiteAmount)
              : 0,
        prepaid_payment_method:
          isFood || isTable
            ? notes?.invoice_ready === true
              ? pm
              : null
            : isHotel
              ? hotelPrepaidAmount > 0
                ? hotelPrepaidPaymentMethod
                : null
              : null,
        onsite_payment_method:
          isFood || isTable
            ? notes?.invoice_ready === true
              ? null
              : pm
            : isHotel
              ? hotelOnsiteAmount > 0
                ? pm
                : null
              : null,
        segment_type:
          isFood || isTable
            ? notes?.invoice_ready === true
              ? "prepaid"
              : "onsite"
            : null,
      });

      total += amount;
      if (pm === "Cash") totalCash += amount;
      else if (pm === "BankTransfer") totalTransfer += amount;

      if (isPrebookedUser) bookingBaseTotal += amount;

      const paymentTimeRawLocal = paymentTimeRaw
        ? new Date(paymentTimeRaw)
        : null;
      const paymentDate =
        paymentTimeRawLocal && Number.isFinite(paymentTimeRawLocal.getTime())
          ? paymentTimeRawLocal
          : new Date();
      const bucketKey = getBucketKey(paymentDate);
      const prev = byBucket.get(bucketKey) || { total: 0, booking_base: 0 };
      byBucket.set(bucketKey, {
        total: prev.total + amount,
        booking_base: prev.booking_base + (isPrebookedUser ? amount : 0),
      });
    }

    // Enrich booking contact info so restaurant/table history can always show guest name + phone
    if (bookingIds.size > 0) {
      const ids = Array.from(bookingIds.values()).filter((x) => x > 0);
      if (ids.length > 0) {
        const placeholders = ids.map(() => "?").join(",");
        const [bRows] = await pool.query<RowDataPacket[]>(
          `SELECT b.booking_id,
                  COALESCE(NULLIF(b.contact_name, ''), u.full_name) AS contact_name,
                  COALESCE(NULLIF(b.contact_phone, ''), u.phone) AS contact_phone
           FROM bookings b
           LEFT JOIN users u ON u.user_id = b.user_id
           WHERE b.booking_id IN (${placeholders})`,
          ids,
        );

        const byBookingId = new Map<
          number,
          { contact_name: string | null; contact_phone: string | null }
        >();
        for (const br of bRows) {
          const bid = Number((br as any).booking_id);
          if (!Number.isFinite(bid)) continue;
          const rawName = (br as any).contact_name;
          const rawPhone = (br as any).contact_phone;
          byBookingId.set(bid, {
            contact_name:
              rawName != null && String(rawName).trim()
                ? String(rawName)
                : null,
            contact_phone:
              rawPhone != null && String(rawPhone).trim()
                ? String(rawPhone)
                : null,
          });
        }

        for (const h of history) {
          if (!h.booking_id) continue;
          const info = byBookingId.get(h.booking_id);
          if (!info) continue;
          h.booking_contact_name = info.contact_name;
          h.booking_contact_phone = info.contact_phone;

          // Backward-compatible fallback (some UI columns still use performed_by.*)
          if (h.performed_by?.role === "user") {
            h.performed_by.name = h.performed_by.name || info.contact_name;
            h.performed_by.phone = h.performed_by.phone || info.contact_phone;
          }
        }
      }
    }

    // Enrich booking user info to show full name + phone consistently
    if (bookingUserIds.size > 0) {
      const ids = Array.from(bookingUserIds.values()).filter((x) => x > 0);
      if (ids.length > 0) {
        const placeholders = ids.map(() => "?").join(",");
        const [uRows] = await pool.query<RowDataPacket[]>(
          `SELECT user_id, full_name, phone
           FROM users
           WHERE user_id IN (${placeholders})`,
          ids,
        );
        const byId = new Map<
          number,
          { full_name: string | null; phone: string | null }
        >();
        for (const ur of uRows) {
          const id = Number((ur as any).user_id);
          if (!Number.isFinite(id)) continue;
          byId.set(id, {
            full_name: (ur as any).full_name
              ? String((ur as any).full_name)
              : null,
            phone: (ur as any).phone ? String((ur as any).phone) : null,
          });
        }

        for (const h of history) {
          if (h.performed_by.role !== "user") continue;
          const uid = h.performed_by.user_id;
          if (!uid) continue;
          const u = byId.get(uid);
          if (!u) continue;
          h.performed_by.name = u.full_name;
          h.performed_by.phone = h.performed_by.phone || u.phone;
        }
      }
    }

    // Enrich hotel stay info (room/guest/checkin/checkout) for completeness
    if (hotelStayIds.size > 0) {
      const ids = Array.from(hotelStayIds.values()).filter((x) => x > 0);
      if (ids.length > 0) {
        const placeholders = ids.map(() => "?").join(",");
        const [sRows] = await pool.query<RowDataPacket[]>(
          `SELECT hs.stay_id, hs.checkin_time, hs.checkout_time,
                  r.room_number,
                  u.full_name AS guest_name,
                  u.phone AS guest_phone
           FROM hotel_stays hs
           LEFT JOIN hotel_rooms r ON r.room_id = hs.room_id
           LEFT JOIN users u ON u.user_id = hs.user_id
           WHERE hs.stay_id IN (${placeholders})`,
          ids,
        );
        const byStayId = new Map<
          number,
          {
            room_number: string | null;
            guest_name: string | null;
            guest_phone: string | null;
            checkin_time: string | null;
            checkout_time: string | null;
          }
        >();
        for (const sr of sRows) {
          const sid = Number((sr as any).stay_id);
          if (!Number.isFinite(sid)) continue;
          byStayId.set(sid, {
            room_number:
              (sr as any).room_number == null
                ? null
                : String((sr as any).room_number),
            guest_name:
              (sr as any).guest_name == null
                ? null
                : String((sr as any).guest_name),
            guest_phone:
              (sr as any).guest_phone == null
                ? null
                : String((sr as any).guest_phone),
            checkin_time: toIsoOrNull((sr as any).checkin_time),
            checkout_time: toIsoOrNull((sr as any).checkout_time),
          });
        }

        for (const h of history) {
          if (!h.hotel || !h.hotel.stay_id) continue;
          const info = byStayId.get(h.hotel.stay_id);
          if (!info) continue;
          h.hotel.room_number = h.hotel.room_number || info.room_number;
          h.hotel.guest_name = h.hotel.guest_name || info.guest_name;
          h.hotel.guest_phone = h.hotel.guest_phone || info.guest_phone;
          h.hotel.checkin_time = h.hotel.checkin_time || info.checkin_time;
          h.hotel.checkout_time = h.hotel.checkout_time || info.checkout_time;

          if (
            h.hotel.actual_minutes == null &&
            h.hotel.checkin_time &&
            h.hotel.checkout_time
          ) {
            h.hotel.actual_minutes = Math.max(
              0,
              Math.floor(
                (new Date(h.hotel.checkout_time).getTime() -
                  new Date(h.hotel.checkin_time).getTime()) /
                  60000,
              ),
            );
          }
        }
      }
    }

    const toMoney2 = (n: number) => +Number(n || 0).toFixed(2);

    const buildBucketKeys = (): string[] => {
      // We prefer using the server-calculated date range as the bucket anchor.
      if (range === "day") {
        const anchor = start
          ? new Date(start)
          : date
            ? new Date(date)
            : new Date();
        const base = Number.isFinite(anchor.getTime()) ? anchor : new Date();
        const ymd = formatYmd(base);
        return Array.from({ length: 24 }).map(
          (_x, h) => `${ymd}T${pad2(h)}:00`,
        );
      }

      if (range === "week") {
        const anchor = start
          ? new Date(start)
          : date
            ? new Date(date)
            : new Date();
        const base = Number.isFinite(anchor.getTime()) ? anchor : new Date();
        return Array.from({ length: 7 }).map((_x, i) => {
          const d = new Date(base);
          d.setDate(d.getDate() + i);
          return formatYmd(d);
        });
      }

      if (range === "month") {
        const anchor = start
          ? new Date(start)
          : date
            ? new Date(date)
            : new Date();
        const base = Number.isFinite(anchor.getTime()) ? anchor : new Date();
        const y = base.getFullYear();
        const m = base.getMonth();
        const daysInMonth = new Date(y, m + 1, 0).getDate();
        return Array.from({ length: daysInMonth }).map((_x, idx) => {
          const day = idx + 1;
          return `${y}-${pad2(m + 1)}-${pad2(day)}`;
        });
      }

      if (range === "year") {
        const anchor = start
          ? new Date(start)
          : date
            ? new Date(date)
            : new Date();
        const base = Number.isFinite(anchor.getTime()) ? anchor : new Date();
        const y = base.getFullYear();
        return Array.from({ length: 12 }).map((_x, idx) => {
          const month = idx + 1;
          return `${y}-${pad2(month)}`;
        });
      }

      // all: derive from data range (month buckets)
      const keys = Array.from(byBucket.keys())
        .map((k) => String(k || "").trim())
        .filter((k) => /^\d{4}-\d{2}$/.test(k))
        .sort();

      if (keys.length === 0) {
        const now = new Date();
        const startMonth = new Date(now.getFullYear(), now.getMonth() - 11, 1);
        return Array.from({ length: 12 }).map((_x, i) => {
          const d = new Date(
            startMonth.getFullYear(),
            startMonth.getMonth() + i,
            1,
          );
          return formatYm(d);
        });
      }

      const minKey = keys[0];
      const maxKey = keys[keys.length - 1];
      const [minY, minM] = minKey.split("-").map((x) => Number(x));
      const [maxY, maxM] = maxKey.split("-").map((x) => Number(x));
      if (!Number.isFinite(minY) || !Number.isFinite(minM)) return keys;
      if (!Number.isFinite(maxY) || !Number.isFinite(maxM)) return keys;

      const out: string[] = [];
      let y = minY;
      let m = minM;
      while (y < maxY || (y === maxY && m <= maxM)) {
        out.push(`${y}-${pad2(m)}`);
        m += 1;
        if (m > 12) {
          m = 1;
          y += 1;
        }
        if (out.length > 240) break; // safety guard
      }
      return out;
    };

    const bucketKeys = buildBucketKeys();
    const series = bucketKeys.map((bucketKey) => {
      const v = byBucket.get(bucketKey) || { total: 0, booking_base: 0 };
      const bookingBase = Number(v?.booking_base || 0);
      const commission = (bookingBase * commissionRate) / 100;
      const totalBucket = Number(v?.total || 0);
      const afterCommission = totalBucket - commission;
      return {
        day: bucketKey,
        total: toMoney2(totalBucket),
        commission: toMoney2(commission),
        after_commission: toMoney2(afterCommission),
      };
    });

    const displayHistory = history.reduce<typeof history>((acc, row) => {
      const canMergeFoodBooking =
        row.booking_id != null &&
        !row.hotel &&
        (row.segment_type === "prepaid" || row.segment_type === "onsite");

      if (!canMergeFoodBooking) {
        acc.push(row);
        return acc;
      }

      const existing = acc.find(
        (item) =>
          item.booking_id === row.booking_id &&
          !item.hotel &&
          (item.segment_type === "prepaid" ||
            item.segment_type === "onsite" ||
            (Number(item.prepaid_amount || 0) > 0 &&
              Number(item.onsite_amount || 0) > 0)),
      );

      if (!existing) {
        acc.push({
          ...row,
          items: [...row.items],
          prepaid_items: [...(row.prepaid_items || [])],
          onsite_items: [...(row.onsite_items || [])],
        });
        return acc;
      }

      existing.payment_ids = [
        ...(existing.payment_ids || [existing.payment_id]),
        ...(row.payment_ids || [row.payment_id]),
      ];
      existing.amount = toMoney2(
        Number(existing.amount || 0) + Number(row.amount || 0),
      );
      existing.total_qty =
        Number(existing.total_qty || 0) + Number(row.total_qty || 0);
      existing.items_count =
        Number(existing.items_count || 0) + Number(row.items_count || 0);
      existing.items = [...existing.items, ...row.items];
      existing.prepaid_items = [
        ...(existing.prepaid_items || []),
        ...(row.prepaid_items || []),
      ];
      existing.onsite_items = [
        ...(existing.onsite_items || []),
        ...(row.onsite_items || []),
      ];
      existing.prepaid_amount = toMoney2(
        Number(existing.prepaid_amount || 0) + Number(row.prepaid_amount || 0),
      );
      existing.onsite_amount = toMoney2(
        Number(existing.onsite_amount || 0) + Number(row.onsite_amount || 0),
      );
      existing.prepaid_payment_method =
        existing.prepaid_payment_method || row.prepaid_payment_method || null;
      existing.onsite_payment_method =
        existing.onsite_payment_method || row.onsite_payment_method || null;
      existing.table_name = existing.table_name || row.table_name;
      existing.booking_contact_name =
        existing.booking_contact_name || row.booking_contact_name;
      existing.booking_contact_phone =
        existing.booking_contact_phone || row.booking_contact_phone;
      existing.segment_type =
        Number(existing.prepaid_amount || 0) > 0 &&
        Number(existing.onsite_amount || 0) > 0
          ? null
          : existing.segment_type || row.segment_type;
      return acc;
    }, []);

    const commissionAmountTotal = (bookingBaseTotal * commissionRate) / 100;
    const ownerReceivableTotal = total - commissionAmountTotal;

    res.json({
      success: true,
      data: {
        range,
        start: start ? start.toISOString() : null,
        end: end ? end.toISOString() : null,
        summary: {
          total: toMoney2(total),
          cash: toMoney2(totalCash),
          transfer: toMoney2(totalTransfer),
          commission_rate: toMoney2(commissionRate),
          commission_amount: toMoney2(commissionAmountTotal),
          owner_receivable: toMoney2(ownerReceivableTotal),
        },
        series,
        history: displayHistory,
      },
    });
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const getHotelPaymentsRecent = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    const locationId = Number((req.query as any).location_id);
    if (!Number.isFinite(locationId)) {
      res
        .status(400)
        .json({ success: false, message: "location_id không hợp lệ" });
      return;
    }

    await ensureLocationAccess({ auth, locationId });

    const posSupport = await getPosTicketsSchemaSupport();

    const limitRaw = Number((req.query as any).limit ?? 10);
    const limit =
      Number.isFinite(limitRaw) && limitRaw > 0
        ? Math.min(50, Math.floor(limitRaw))
        : 10;

    const support = await getPaymentsSchemaSupport();

    const selectCols: string[] = [
      "p.payment_id",
      "p.payment_time",
      "p.amount",
      "p.payment_method",
      "p.notes",
      "p.qr_data",
      "r.room_number",
      "u.full_name AS guest_name",
      "u.phone AS guest_phone",
    ];
    if (support.hasPerformedByUserId) selectCols.push("p.performed_by_user_id");
    if (support.hasPerformedByRole) selectCols.push("p.performed_by_role");
    if (support.hasPerformedByName) selectCols.push("p.performed_by_name");

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT ${selectCols.join(", ")}
       FROM payments p
       LEFT JOIN hotel_stays hs
         ON hs.stay_id = CAST(SUBSTRING_INDEX(p.notes, ':', -1) AS UNSIGNED)
       LEFT JOIN hotel_rooms r ON r.room_id = hs.room_id
       LEFT JOIN users u ON u.user_id = hs.user_id
       WHERE p.location_id = ?
         AND p.status = 'completed'
         AND (p.notes LIKE 'HOTEL_STAY:%' OR p.notes LIKE 'HOTEL_STAYS:%')
       ORDER BY p.payment_time DESC
       LIMIT ?`,
      [locationId, limit],
    );

    const history = rows
      .map((r) => {
        const paymentId = Number(r.payment_id);
        if (!Number.isFinite(paymentId)) return null;

        const paymentTimeRaw = r.payment_time;
        const paymentTime = paymentTimeRaw
          ? new Date(paymentTimeRaw).toISOString()
          : new Date().toISOString();

        const notesStr = String((r as any).notes || "");
        let roomNumber: string | null =
          r.room_number == null ? null : String(r.room_number);
        let guestName: string | null =
          (r as any).guest_name == null ? null : String((r as any).guest_name);
        let guestPhone: string | null =
          (r as any).guest_phone == null
            ? null
            : String((r as any).guest_phone);

        if (notesStr.startsWith("HOTEL_STAYS:")) {
          const qrParsed = parsePaymentNotesJson((r as any).qr_data);
          const snapAny =
            qrParsed && typeof qrParsed === "object" ? (qrParsed as any) : null;
          if (Array.isArray(snapAny?.hotel_invoices)) {
            const nums = (snapAny.hotel_invoices as any[])
              .map((x: any) =>
                x && x.room_number ? String(x.room_number) : "",
              )
              .map((x: string) => x.trim())
              .filter(Boolean);
            if (nums.length > 0) roomNumber = nums.join(", ");
            const first = (snapAny.hotel_invoices as any[])[0];
            if (guestName == null && first?.guest_name)
              guestName = String(first.guest_name);
            if (guestPhone == null && first?.guest_phone)
              guestPhone = String(first.guest_phone);
          }
        }

        return {
          payment_id: paymentId,
          payment_time: paymentTime,
          amount: Number(r.amount || 0),
          payment_method: String(r.payment_method || ""),
          room_number: roomNumber,
          guest_name: guestName,
          guest_phone: guestPhone,
          performed_by: {
            user_id: support.hasPerformedByUserId
              ? (r as any).performed_by_user_id != null
                ? Number((r as any).performed_by_user_id)
                : null
              : null,
            role: support.hasPerformedByRole
              ? ((r as any).performed_by_role as any) || null
              : null,
            name: support.hasPerformedByName
              ? (r as any).performed_by_name
                ? String((r as any).performed_by_name)
                : null
              : null,
          },
        };
      })
      .filter(Boolean);

    res.json({ success: true, data: history });
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

const publishPosUpdated = async (
  db: { query: (sql: string, params?: any[]) => Promise<any> },
  locationId: number,
  ownerId: number,
  payload: Record<string, unknown> = {},
) => {
  await publishLocationEvent(db, locationId, ownerId, {
    type: "pos_updated",
    location_id: locationId,
    ...payload,
  });
};

const publishHotelUpdated = async (
  db: { query: (sql: string, params?: any[]) => Promise<any> },
  locationId: number,
  ownerId: number,
  payload: Record<string, unknown> = {},
) => {
  await publishLocationEvent(db, locationId, ownerId, {
    type: "hotel_updated",
    location_id: locationId,
    ...payload,
  });
};

const publishTouristUpdated = async (
  db: { query: (sql: string, params?: any[]) => Promise<any> },
  locationId: number,
  ownerId: number,
  payload: Record<string, unknown> = {},
) => {
  await publishLocationEvent(db, locationId, ownerId, {
    type: "tourist_updated",
    location_id: locationId,
    ...payload,
  });
};

const logAudit = async (
  userId: number | null,
  action: string,
  details: any,
) => {
  try {
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
      [userId, action, JSON.stringify(details ?? {})],
    );
  } catch {
    // ignore audit failures
  }
};

const logAuditWithConn = async (
  conn: { query: (sql: string, params?: any[]) => Promise<any> },
  userId: number | null,
  action: string,
  details: any,
) => {
  try {
    await conn.query(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
      [userId, action, JSON.stringify(details ?? {})],
    );
  } catch {
    // ignore audit failures
  }
};

export const getOwnerMe = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    const ownerId =
      auth.role === "owner"
        ? auth.userId
        : await getOwnerIdForEmployee(auth.userId);

    const [userRows] = await pool.query<RowDataPacket[]>(
      `SELECT user_id, email, phone, full_name, avatar_url, role, status, created_at
       FROM users WHERE user_id = ? LIMIT 1`,
      [auth.userId],
    );

    const [profileRows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM owner_profiles WHERE owner_id = ? LIMIT 1`,
      [ownerId],
    );

    const employee_context =
      auth.role === "employee"
        ? ((
            await pool.query<RowDataPacket[]>(
              `SELECT el.location_id, el.owner_id, el.permissions, el.position,
                      l.location_name, l.location_type
               FROM employee_locations el
               JOIN locations l ON l.location_id = el.location_id
               WHERE el.employee_id = ? AND el.status = 'active'
               ORDER BY el.assigned_at DESC
               LIMIT 1`,
              [auth.userId],
            )
          )[0]?.[0] ?? null)
        : null;

    res.json({
      success: true,
      data: {
        actor: userRows[0] || null,
        owner_id: ownerId,
        owner_profile: profileRows[0] || null,
        employee_context,
      },
    });
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const getOwnerProfile = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    if (auth.role !== "owner") {
      res.status(403).json({ success: false, message: "Chỉ owner được phép" });
      return;
    }

    const [userRows] = await pool.query<RowDataPacket[]>(
      `SELECT user_id, email, phone, full_name, avatar_url, role, status, created_at
       FROM users WHERE user_id = ? LIMIT 1`,
      [auth.userId],
    );

    const [profileRows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM owner_profiles WHERE owner_id = ? LIMIT 1`,
      [auth.userId],
    );

    res.json({
      success: true,
      data: {
        user: userRows[0] || null,
        owner_profile: profileRows[0] || null,
      },
    });
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const updateOwnerProfile = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    if (auth.role !== "owner") {
      res.status(403).json({ success: false, message: "Chỉ owner được phép" });
      return;
    }

    const { full_name, phone, avatar_url, skip_avatar } = req.body as {
      full_name?: string;
      phone?: string | null;
      avatar_url?: string | null;
      skip_avatar?: boolean;
    };

    const normalizedFullName = normalizePersonName(full_name);
    if (!normalizedFullName) {
      res.status(400).json({ success: false, message: "Vui lòng nhập họ tên" });
      return;
    }

    if (!isValidPersonName(normalizedFullName)) {
      res.status(400).json({
        success: false,
        message: "Họ tên không được chứa ký tự đặc biệt",
      });
      return;
    }

    const normalizedPhone = normalizePhoneNumber(phone);
    if (normalizedPhone && !isValidPhoneNumber(normalizedPhone)) {
      res.status(400).json({
        success: false,
        message:
          "Số điện thoại phải gồm 10 số, bắt đầu bằng 0 và không chứa ký tự đặc biệt",
      });
      return;
    }

    const normalizedAvatarUrl =
      typeof avatar_url === "string" ? avatar_url.trim() : null;

    if (normalizedAvatarUrl) {
      const lower = normalizedAvatarUrl.toLowerCase();
      if (lower.startsWith("data:")) {
        res.status(400).json({
          success: false,
          message:
            "Avatar URL không hợp lệ. Vui lòng dùng URL http/https hoặc upload ảnh từ thiết bị.",
        });
        return;
      }
      if (normalizedAvatarUrl.length > 2048) {
        res.status(400).json({
          success: false,
          message: "Avatar URL quá dài. Vui lòng dùng URL hợp lệ.",
        });
        return;
      }
      const isHttp = /^https?:\/\//i.test(normalizedAvatarUrl);
      const isLocalUpload = normalizedAvatarUrl.startsWith("/uploads/");
      if (!isHttp && !isLocalUpload) {
        res.status(400).json({
          success: false,
          message:
            "Avatar URL phải bắt đầu bằng http://, https:// hoặc /uploads/...",
        });
        return;
      }
    }

    if (skip_avatar) {
      await pool.query(
        `UPDATE users
         SET full_name = ?, phone = ?
         WHERE user_id = ?`,
        [normalizedFullName, normalizedPhone, auth.userId],
      );
    } else if (normalizedAvatarUrl) {
      if (normalizedAvatarUrl.startsWith("/uploads/")) {
        await pool.query(
          `UPDATE users
           SET full_name = ?, phone = ?, avatar_url = ?, avatar_path = ?, avatar_source = 'upload', avatar_updated_at = NOW()
           WHERE user_id = ?`,
          [
            normalizedFullName,
            normalizedPhone,
            normalizedAvatarUrl,
            normalizedAvatarUrl,
            auth.userId,
          ],
        );
      } else {
        await pool.query(
          `UPDATE users
           SET full_name = ?, phone = ?, avatar_url = ?, avatar_path = NULL, avatar_source = 'url', avatar_updated_at = NOW()
           WHERE user_id = ?`,
          [
            normalizedFullName,
            normalizedPhone,
            normalizedAvatarUrl,
            auth.userId,
          ],
        );
      }
    } else {
      await pool.query(
        `UPDATE users
         SET full_name = ?, phone = ?, avatar_url = NULL, avatar_path = NULL, avatar_source = 'url', avatar_updated_at = NOW()
         WHERE user_id = ?`,
        [normalizedFullName, normalizedPhone, auth.userId],
      );
    }

    await logAudit(auth.userId, "UPDATE_OWNER_PROFILE", {
      full_name: normalizedFullName,
      phone: normalizedPhone,
      avatar_url: skip_avatar ? "[giữ nguyên]" : normalizedAvatarUrl,
      skip_avatar: Boolean(skip_avatar),
      timestamp: new Date(),
    });

    res.json({ success: true, message: "Cập nhật thông tin thành công" });
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const uploadOwnerAvatar = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    if (auth.role !== "owner") {
      res.status(403).json({ success: false, message: "Chỉ owner được phép" });
      return;
    }

    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) {
      res.status(400).json({ success: false, message: "Thiếu file avatar" });
      return;
    }

    const saved = await saveUploadedImageToUploads({
      file,
      folder: "avatars",
      fileNamePrefix: `avatar-${auth.userId}`,
    });

    await pool.query(
      `UPDATE users
       SET avatar_url = ?, avatar_path = ?, avatar_source = 'upload', avatar_updated_at = NOW()
       WHERE user_id = ?`,
      [saved.urlPath, saved.urlPath, auth.userId],
    );

    await logAudit(auth.userId, "UPLOAD_OWNER_AVATAR", {
      mimetype: file.mimetype,
      size: file.size,
      avatar_path: saved.urlPath,
      timestamp: new Date(),
    });

    res.status(201).json({
      success: true,
      message: "Upload avatar thành công",
      data: { avatar_url: saved.urlPath },
    });
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const uploadOwnerBackground = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    if (auth.role !== "owner") {
      res.status(403).json({ success: false, message: "Chỉ owner được phép" });
      return;
    }

    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) {
      res.status(400).json({ success: false, message: "Thiếu file ảnh nền" });
      return;
    }

    const saved = await saveUploadedImageToUploads({
      file,
      folder: "backgrounds",
      fileNamePrefix: `background-${auth.userId}`,
    });

    await logAudit(auth.userId, "UPLOAD_OWNER_BACKGROUND", {
      mimetype: file.mimetype,
      size: file.size,
      background_path: saved.urlPath,
      timestamp: new Date(),
    });

    res.status(201).json({
      success: true,
      message: "Upload ảnh nền thành công",
      data: { background_url: saved.urlPath },
    });
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const uploadOwnerServiceImage = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    if (auth.role !== "owner") {
      res.status(403).json({ success: false, message: "Chỉ owner được phép" });
      return;
    }

    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) {
      res.status(400).json({ success: false, message: "Thiếu file ảnh" });
      return;
    }

    const saved = await saveUploadedImageToUploads({
      file,
      folder: "services",
      fileNamePrefix: `service-${auth.userId}`,
    });

    await logAudit(auth.userId, "UPLOAD_OWNER_SERVICE_IMAGE", {
      mimetype: file.mimetype,
      size: file.size,
      image_path: saved.urlPath,
      timestamp: new Date(),
    });

    res.status(201).json({
      success: true,
      message: "Upload ảnh dịch vụ thành công",
      data: { url: saved.urlPath },
    });
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const changeOwnerPassword = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    if (auth.role !== "owner") {
      res.status(403).json({ success: false, message: "Chỉ owner được phép" });
      return;
    }

    const { old_password, new_password } = req.body as {
      old_password?: string;
      new_password?: string;
    };

    if (typeof new_password !== "string" || new_password.length < 6) {
      res.status(400).json({
        success: false,
        message: "Mật khẩu mới phải có ít nhất 6 ký tự",
      });
      return;
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT password_hash FROM users WHERE user_id = ? LIMIT 1`,
      [auth.userId],
    );

    const passwordHash = rows[0]?.password_hash as string | null;
    if (!passwordHash) {
      res.status(400).json({
        success: false,
        message: "Tài khoản này không có mật khẩu (đăng nhập mạng xã hội)",
      });
      return;
    }

    if (typeof old_password !== "string") {
      res.status(400).json({ success: false, message: "Thiếu old_password" });
      return;
    }

    const ok = await bcrypt.compare(old_password, passwordHash);
    if (!ok) {
      res
        .status(400)
        .json({ success: false, message: "Mật khẩu cũ không đúng" });
      return;
    }

    const newHash = await bcrypt.hash(new_password, 10);

    await pool.query(`UPDATE users SET password_hash = ? WHERE user_id = ?`, [
      newHash,
      auth.userId,
    ]);

    await logAudit(auth.userId, "CHANGE_OWNER_PASSWORD", {
      timestamp: new Date(),
    });

    res.json({ success: true, message: "Đổi mật khẩu thành công" });
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const getOwnerLoginHistory = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    if (auth.role !== "owner") {
      res.status(403).json({ success: false, message: "Chỉ owner được phép" });
      return;
    }

    const { limit = "50" } = req.query as { limit?: string };
    const lim = Math.min(200, Math.max(1, Number(limit) || 50));

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT login_id, success, ip_address, user_agent, device_info, created_at
       FROM login_history
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [auth.userId, lim],
    );

    res.json({ success: true, data: rows });
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const getOwnerBank = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    const ownerId =
      auth.role === "owner"
        ? auth.userId
        : await getOwnerIdForEmployee(auth.userId);

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT bank_account, bank_name, account_holder, qr_code, contact_info, approval_status
       FROM owner_profiles WHERE owner_id = ? LIMIT 1`,
      [ownerId],
    );

    res.json({ success: true, data: rows[0] || null });
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const updateOwnerBank = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    if (auth.role !== "owner") {
      res.status(403).json({ success: false, message: "Chỉ owner được phép" });
      return;
    }

    const { bank_account, bank_name, account_holder, contact_info, bank_bin } =
      req.body as {
        bank_account?: string;
        bank_name?: string;
        account_holder?: string;
        contact_info?: string | null;
        bank_bin?: string | null;
      };

    if (!bank_account || !bank_name || !account_holder) {
      res.status(400).json({
        success: false,
        message:
          "Thiếu thông tin ngân hàng (bank_account/bank_name/account_holder)",
      });
      return;
    }

    const normalizeBankKey = (input: string): string => {
      return input
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "");
    };

    const bankBinMap: Record<string, string> = {
      vietcombank: "970436",
      vcb: "970436",
      vietinbank: "970415",
      bidv: "970418",
      agribank: "970405",
      mb: "970422",
      mbbank: "970422",
      acb: "970416",
      techcombank: "970407",
      tcb: "970407",
      sacombank: "970403",
      scb: "970429",
      vpbank: "970432",
      tpbank: "970423",
      vib: "970441",
      shb: "970443",
      hdbank: "970437",
      ocb: "970448",
      msb: "970426",
      eximbank: "970431",
      seabank: "970440",
    };

    const cleanedBin = typeof bank_bin === "string" ? bank_bin.trim() : "";
    const inferredBin = bankBinMap[normalizeBankKey(bank_name)] || "";
    const resolvedBin = cleanedBin || inferredBin;

    if (!resolvedBin) {
      res.status(400).json({
        success: false,
        message:
          "Không xác định được mã BIN ngân hàng. Vui lòng nhập 'Mã BIN' (vd Vietcombank: 970436).",
      });
      return;
    }

    // NOTE: Use QR-only template to avoid rendering an "amount" line like "0đ".
    // Keep addInfo embedded in the payload so banking apps still show the transfer note.
    const qrNote = "Checkin";
    const qrCodeUrl = `https://img.vietqr.io/image/${resolvedBin}-${encodeURIComponent(
      bank_account,
    )}-qr_only.png?addInfo=${encodeURIComponent(qrNote)}`;

    await pool.query(
      `INSERT INTO owner_profiles (
         owner_id, bank_account, bank_name, account_holder, contact_info,
         qr_code, approval_status
       )
       VALUES (?, ?, ?, ?, ?, ?, 'pending')
       ON DUPLICATE KEY UPDATE
         bank_account = VALUES(bank_account),
         bank_name = VALUES(bank_name),
         account_holder = VALUES(account_holder),
         contact_info = VALUES(contact_info),
         qr_code = VALUES(qr_code)`,
      [
        auth.userId,
        bank_account,
        bank_name,
        account_holder,
        contact_info ?? null,
        qrCodeUrl,
      ],
    );

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT approval_status
       FROM owner_profiles
       WHERE owner_id = ?
       LIMIT 1`,
      [auth.userId],
    );
    const approvalStatus = String(rows?.[0]?.approval_status || "pending");

    await logAudit(auth.userId, "UPDATE_OWNER_BANK", {
      bank_name,
      bank_account_last4: bank_account.slice(-4),
      timestamp: new Date(),
    });

    res.json({
      success: true,
      message: "Cập nhật thông tin ngân hàng thành công",
      data: {
        qr_code: qrCodeUrl,
        approval_status: approvalStatus,
      },
    });
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const getAdminBankInfo = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    // Any authenticated owner/employee can view admin bank info for commission payments.
    await getAuth(req);

    const keys = [
      "admin_bank_name",
      "admin_bank_account",
      "admin_bank_holder",
      "admin_bank_bin",
    ];

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT setting_key, setting_value
       FROM system_settings
       WHERE setting_key IN (${keys.map(() => "?").join(",")})`,
      keys,
    );

    const map = new Map<string, string>();
    for (const row of rows) {
      const k = String(row.setting_key || "");
      const v = row.setting_value;
      if (k) map.set(k, v === null || v === undefined ? "" : String(v));
    }

    const bankName = (map.get("admin_bank_name") || "").trim();
    const bankAccount = (map.get("admin_bank_account") || "").trim();
    const bankHolder = (map.get("admin_bank_holder") || "").trim();
    const bankBinInput = (map.get("admin_bank_bin") || "").trim();

    const normalizeBankKey = (input: string): string => {
      return input
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "");
    };

    const bankBinMap: Record<string, string> = {
      vietcombank: "970436",
      vcb: "970436",
      vietinbank: "970415",
      bidv: "970418",
      agribank: "970405",
      mb: "970422",
      mbbank: "970422",
      acb: "970416",
      techcombank: "970407",
      tcb: "970407",
      sacombank: "970403",
      scb: "970429",
      vpbank: "970432",
      tpbank: "970423",
      vib: "970441",
      shb: "970443",
      hdbank: "970437",
      ocb: "970448",
      msb: "970426",
      eximbank: "970431",
      seabank: "970440",
    };

    const inferredBin = bankName ? bankBinMap[normalizeBankKey(bankName)] : "";
    const resolvedBin = bankBinInput || inferredBin;

    const qrNote = "Checkin";
    const qrCodeUrl =
      resolvedBin && bankAccount
        ? `https://img.vietqr.io/image/${resolvedBin}-${encodeURIComponent(
            bankAccount,
          )}-qr_only.png?addInfo=${encodeURIComponent(qrNote)}`
        : null;

    res.json({
      success: true,
      data: {
        bank_name: bankName || null,
        bank_account: bankAccount || null,
        bank_holder: bankHolder || null,
        bank_bin: resolvedBin || null,
        qr_code: qrCodeUrl,
      },
    });
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const getOwnerLocations = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);

    const { status, q } = req.query as { status?: string; q?: string };

    if (auth.role === "owner") {
      const params: any[] = [auth.userId];
      let sql = `
        SELECT l.*, COALESCE(l.commission_rate, 2.5) AS commission_rate
        FROM locations l
        WHERE l.owner_id = ?
      `;
      if (status) {
        sql += ` AND l.status = ?`;
        params.push(status);
      }
      if (q) {
        sql += ` AND (l.location_name LIKE ? OR l.address LIKE ?)`;
        params.push(`%${q}%`, `%${q}%`);
      }
      sql += ` ORDER BY l.created_at DESC`;

      const [rows] = await pool.query<RowDataPacket[]>(sql, params);
      res.json({ success: true, data: rows });
      return;
    }

    const ownerId = await getOwnerIdForEmployee(auth.userId);
    const params: any[] = [auth.userId, ownerId];

    let sql = `
      SELECT l.*, el.permissions, COALESCE(l.commission_rate, 2.5) AS commission_rate
      FROM employee_locations el
      JOIN locations l ON l.location_id = el.location_id
      WHERE el.employee_id = ? AND el.owner_id = ? AND el.status = 'active'
    `;

    if (status) {
      sql += ` AND l.status = ?`;
      params.push(status);
    }
    if (q) {
      sql += ` AND (l.location_name LIKE ? OR l.address LIKE ?)`;
      params.push(`%${q}%`, `%${q}%`);
    }

    sql += ` ORDER BY el.assigned_at DESC`;

    const [rows] = await pool.query<RowDataPacket[]>(sql, params);
    res.json({ success: true, data: rows });
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const createOwnerCommissionPaymentRequest = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    if (auth.role !== "owner") {
      res.status(403).json({ success: false, message: "Chỉ owner được phép" });
      return;
    }

    const note = String((req.body as any)?.note || "").trim();

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT commission_id, total_due, status
       FROM commissions
       WHERE owner_id = ?
         AND status IN ('pending', 'overdue')
       ORDER BY created_at DESC
       LIMIT 500`,
      [auth.userId],
    );

    const commissionIds = rows
      .map((r) => Number(r.commission_id))
      .filter((v) => Number.isFinite(v));

    if (commissionIds.length === 0) {
      res.status(400).json({
        success: false,
        message: "Bạn không có khoản hoa hồng/VAT nào cần thanh toán.",
      });
      return;
    }

    const totalDue = rows.reduce((sum, r) => {
      const v = Number(r.total_due || 0);
      return sum + (Number.isFinite(v) ? v : 0);
    }, 0);

    const transferNote = `TC-${auth.userId}-${Date.now()}`;

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO audit_logs (user_id, action, details)
       VALUES (?, ?, ?)`,
      [
        auth.userId,
        "COMMISSION_PAYMENT_REQUEST",
        JSON.stringify({
          owner_id: auth.userId,
          commission_ids: commissionIds,
          total_due: totalDue,
          transfer_note: transferNote,
          note: note || null,
        }),
      ],
    );

    res.json({
      success: true,
      message:
        "Đã tạo yêu cầu thanh toán. Vui lòng chuyển khoản theo thông tin Admin.",
      data: {
        request_id: result.insertId,
        commission_ids: commissionIds,
        total_due: totalDue,
        transfer_note: transferNote,
      },
    });
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const createOwnerLocation = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    if (auth.role !== "owner") {
      res.status(403).json({ success: false, message: "Chỉ owner được phép" });
      return;
    }

    const [ownerRows] = await pool.query<RowDataPacket[]>(
      `SELECT email, phone FROM users WHERE user_id = ? LIMIT 1`,
      [auth.userId],
    );
    const ownerEmail = String(ownerRows[0]?.email || "").trim();
    const ownerPhone = String(ownerRows[0]?.phone || "").trim();
    if (!ownerPhone) {
      res.status(400).json({
        success: false,
        code: "PHONE_REQUIRED",
        message:
          "Bạn cần cập nhật SĐT trong Thông tin cá nhân trước khi tạo địa điểm.",
      });
      return;
    }

    const body = req.body as any;
    const multipartFiles = ((
      req as unknown as { files?: Record<string, Express.Multer.File[]> }
    ).files || {}) as Record<string, Express.Multer.File[]>;
    const uploadedFiles = [
      ...(Array.isArray(multipartFiles.images) ? multipartFiles.images : []),
      ...(req.file ? [req.file] : []),
      ...(Array.isArray(multipartFiles.image) ? multipartFiles.image : []),
    ].filter(Boolean);

    if (uploadedFiles.length === 0) {
      res.status(400).json({
        success: false,
        message: "Bạn cần upload ít nhất 1 ảnh địa điểm để tạo địa điểm",
      });
      return;
    }
    const location_name = String(body.location_name || "").trim();
    const location_type = String(body.location_type || "").trim();
    const address = String(body.address || "").trim();

    if (!location_name || !location_type || !address) {
      res.status(400).json({
        success: false,
        message: "Thiếu location_name/location_type/address",
      });
      return;
    }

    const images: string[] = [];
    for (const file of uploadedFiles) {
      const { urlPath } = await saveUploadedImageToUploads({
        file,
        folder: "locations",
        fileNamePrefix: `location-${auth.userId}`,
      });
      if (urlPath) images.push(urlPath);
    }
    const rawOpeningHours = body.opening_hours ?? null;
    let opening_hours: unknown = rawOpeningHours;
    if (typeof rawOpeningHours === "string") {
      const trimmed = rawOpeningHours.trim();
      if (!trimmed) {
        opening_hours = null;
      } else {
        try {
          opening_hours = JSON.parse(trimmed);
        } catch {
          res.status(400).json({
            success: false,
            message: "opening_hours không hợp lệ (cần JSON)",
          });
          return;
        }
      }
    }

    const resolvedPhone = String(body.phone || "").trim() || ownerPhone;
    const resolvedEmail = String(body.email || "").trim() || ownerEmail || null;

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO locations (
        owner_id, location_name, location_type, description, address, province,
        latitude, longitude, images, opening_hours, phone, email, website, is_eco_friendly,
        source, osm_type, osm_id,
        status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'owner', NULL, NULL, 'pending')`,
      [
        auth.userId,
        location_name,
        location_type,
        String(body.description || "").trim()
          ? String(body.description).trim()
          : null,
        address,
        String(body.province || "").trim()
          ? String(body.province).trim()
          : null,
        body.latitude === undefined ||
        body.latitude === null ||
        body.latitude === ""
          ? null
          : Number(body.latitude),
        body.longitude === undefined ||
        body.longitude === null ||
        body.longitude === ""
          ? null
          : Number(body.longitude),
        JSON.stringify(images),
        opening_hours ? JSON.stringify(opening_hours) : null,
        resolvedPhone,
        resolvedEmail,
        String(body.website || "").trim() ? String(body.website).trim() : null,
        body.is_eco_friendly === "1" ||
        body.is_eco_friendly === "true" ||
        body.is_eco_friendly === 1
          ? 1
          : 0,
      ],
    );

    await logAudit(auth.userId, "CREATE_OWNER_LOCATION", {
      location_id: result.insertId,
      location_name,
      location_type,
      image_url: images[0] || null,
      gallery_count: images.length,
      timestamp: new Date(),
    });

    res.status(201).json({
      success: true,
      message: "Tạo địa điểm thành công (đang chờ duyệt)",
      data: { location_id: result.insertId },
    });
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const updateOwnerLocation = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    const locationId = Number(req.params.id);

    const { ownerId } = await ensureLocationAccess({
      auth,
      locationId,
      requiredPermission:
        auth.role === "employee" ? "can_manage_locations" : undefined,
    });

    const body = req.body as any;
    const multipartFiles = ((
      req as unknown as { files?: Record<string, Express.Multer.File[]> }
    ).files || {}) as Record<string, Express.Multer.File[]>;
    const uploadedFiles = [
      ...(Array.isArray(multipartFiles.images) ? multipartFiles.images : []),
      ...(Array.isArray(multipartFiles.image) ? multipartFiles.image : []),
    ].filter(Boolean);

    if (typeof body.images === "string") {
      try {
        body.images = JSON.parse(body.images);
      } catch {
        body.images = undefined;
      }
    }

    let existingImages: string[] = [];
    if (typeof body.existing_images === "string") {
      try {
        const parsed = JSON.parse(body.existing_images);
        if (Array.isArray(parsed)) {
          existingImages = parsed
            .map((item) => String(item || "").trim())
            .filter(Boolean);
        }
      } catch {
        existingImages = [];
      }
    }

    if (uploadedFiles.length > 0) {
      const uploadedPaths: string[] = [];
      for (const file of uploadedFiles) {
        const { urlPath } = await saveUploadedImageToUploads({
          file,
          folder: "locations",
          fileNamePrefix: `location-${ownerId}`,
        });
        if (urlPath) uploadedPaths.push(urlPath);
      }
      body.images = [...existingImages, ...uploadedPaths];
    } else if (existingImages.length > 0) {
      body.images = existingImages;
    }

    const allowedFields: Array<
      [string, (v: any) => any, { sensitive?: boolean; json?: boolean }?]
    > = [
      ["location_name", (v) => (typeof v === "string" ? v.trim() : undefined)],
      ["description", (v) => v ?? null],
      [
        "address",
        (v) => (typeof v === "string" ? v.trim() : undefined),
        { sensitive: true },
      ],
      ["province", (v) => v ?? null],
      [
        "latitude",
        (v) => (v === null || v === undefined ? null : Number(v)),
        { sensitive: true },
      ],
      [
        "longitude",
        (v) => (v === null || v === undefined ? null : Number(v)),
        { sensitive: true },
      ],
      ["images", (v) => (Array.isArray(v) ? v : undefined), { json: true }],
      ["opening_hours", (v) => v ?? undefined, { json: true }],
      ["phone", (v) => v ?? null],
      ["email", (v) => v ?? null],
      ["website", (v) => v ?? null],
      ["is_eco_friendly", (v) => (v ? 1 : 0)],
    ];

    const updates: string[] = [];
    const params: any[] = [];

    let hasSensitiveChange = false;

    for (const [field, transform, opts] of allowedFields) {
      if (!(field in body)) continue;
      const value = transform(body[field]);
      if (value === undefined) continue;

      updates.push(`${field} = ?`);
      params.push(opts?.json ? JSON.stringify(value) : value);
      if (opts?.sensitive) hasSensitiveChange = true;
    }

    if (updates.length === 0) {
      res
        .status(400)
        .json({ success: false, message: "Không có dữ liệu cập nhật" });
      return;
    }

    const [curRows] = await pool.query<RowDataPacket[]>(
      `SELECT status FROM locations WHERE location_id = ? AND owner_id = ? LIMIT 1`,
      [locationId, ownerId],
    );
    if (!curRows[0]) {
      res
        .status(404)
        .json({ success: false, message: "Không tìm thấy địa điểm" });
      return;
    }

    const curStatus = String(curRows[0].status);

    // Nếu đang active/inactive mà sửa thông tin nhạy cảm => chuyển pending (chờ duyệt lại)
    if (
      hasSensitiveChange &&
      (curStatus === "active" || curStatus === "inactive")
    ) {
      updates.push(`previous_status = status`);
      updates.push(`status = 'pending'`);
      updates.push(`rejection_reason = NULL`);
    }

    params.push(locationId, ownerId);

    await pool.query(
      `UPDATE locations SET ${updates.join(", ")} WHERE location_id = ? AND owner_id = ?`,
      params,
    );

    await logAudit(auth.userId, "UPDATE_OWNER_LOCATION", {
      location_id: locationId,
      has_sensitive_change: hasSensitiveChange,
      timestamp: new Date(),
    });

    res.json({
      success: true,
      message: hasSensitiveChange
        ? "Cập nhật thành công (đang chờ duyệt lại)"
        : "Cập nhật thành công",
    });
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const updateOwnerLocationStatus = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    const locationId = Number(req.params.id);
    const { status } = req.body as { status?: "active" | "inactive" };

    if (!status || (status !== "active" && status !== "inactive")) {
      res.status(400).json({ success: false, message: "status không hợp lệ" });
      return;
    }

    const { ownerId } = await ensureLocationAccess({
      auth,
      locationId,
      requiredPermission:
        auth.role === "employee" ? "can_manage_locations" : undefined,
    });

    const [curRows] = await pool.query<RowDataPacket[]>(
      `SELECT status, previous_status
       FROM locations
       WHERE location_id = ? AND owner_id = ? AND deleted_at IS NULL
       LIMIT 1`,
      [locationId, ownerId],
    );
    if (!curRows[0]) {
      res
        .status(404)
        .json({ success: false, message: "Không tìm thấy địa điểm" });
      return;
    }

    const curStatus = String(curRows[0].status || "");
    const prevStatus = curRows[0].previous_status
      ? String(curRows[0].previous_status)
      : null;

    if (curStatus === "pending") {
      res.status(400).json({
        success: false,
        message: "Địa điểm đang chờ duyệt nên không thể đổi trạng thái",
      });
      return;
    }

    // Admin tạm ẩn sẽ set: status='inactive', previous_status='active'
    if (
      curStatus === "inactive" &&
      prevStatus === "active" &&
      status === "active"
    ) {
      res.status(403).json({
        success: false,
        message:
          "Địa điểm đang bị admin tạm ẩn, bạn không có quyền bật lại. Chỉ có thể bật lại nếu chính bạn đã tắt.",
      });
      return;
    }

    await pool.query(
      `UPDATE locations SET status = ? WHERE location_id = ? AND owner_id = ?`,
      [status, locationId, ownerId],
    );

    await logAudit(auth.userId, "UPDATE_OWNER_LOCATION_STATUS", {
      location_id: locationId,
      status,
      timestamp: new Date(),
    });

    res.json({
      success: true,
      message: "Cập nhật trạng thái địa điểm thành công",
    });
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const getServicesByLocation = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    const locationId = Number(req.params.locationId);

    await ensureLocationAccess({
      auth,
      locationId,
      requiredPermission:
        auth.role === "employee" ? "can_manage_services" : undefined,
    });

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
         s.*, 
         c.category_name,
         c.category_type
       FROM services s
       LEFT JOIN service_categories c
         ON c.category_id = s.category_id AND c.deleted_at IS NULL
       WHERE s.location_id = ?
         AND s.deleted_at IS NULL
       ORDER BY s.created_at DESC`,
      [locationId],
    );

    res.json({ success: true, data: rows });
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const getServiceCategoriesByLocation = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    const locationId = Number(req.params.locationId);
    const { type } = req.query as { type?: string };

    await ensureLocationAccess({
      auth,
      locationId,
      requiredPermission:
        auth.role === "employee" ? "can_manage_services" : undefined,
    });

    const [locRows] = await pool.query<RowDataPacket[]>(
      `SELECT status FROM locations WHERE location_id = ? LIMIT 1`,
      [locationId],
    );
    const locationStatus = String(locRows?.[0]?.status || "");
    if (locationStatus !== "active") {
      res.status(400).json({
        success: false,
        message:
          "Địa điểm chưa được duyệt/kích hoạt nên không thể quản lý danh mục",
      });
      return;
    }

    const whereType =
      type && ["menu", "room", "other"].includes(String(type))
        ? " AND category_type = ?"
        : "";
    const params: any[] = [locationId];
    if (whereType) params.push(String(type));

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT category_id, location_id, category_type, category_name, sort_order
       FROM service_categories
       WHERE location_id = ?
         AND deleted_at IS NULL
         ${whereType}
       ORDER BY sort_order ASC, category_id ASC`,
      params,
    );

    res.json({ success: true, data: rows });
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const createServiceCategoryForLocation = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    const locationId = Number(req.params.locationId);

    await ensureLocationAccess({
      auth,
      locationId,
      requiredPermission:
        auth.role === "employee" ? "can_manage_services" : undefined,
    });

    const { category_type, category_name, sort_order } = req.body as {
      category_type?: string;
      category_name?: string;
      sort_order?: number;
    };

    const [locRows] = await pool.query<RowDataPacket[]>(
      `SELECT location_type, status FROM locations WHERE location_id = ? LIMIT 1`,
      [locationId],
    );
    const locationType = String(locRows?.[0]?.location_type || "");
    const locationStatus = String(locRows?.[0]?.status || "");
    if (locationStatus !== "active") {
      res.status(400).json({
        success: false,
        message:
          "Địa điểm chưa được duyệt/kích hoạt nên không thể tạo danh mục",
      });
      return;
    }

    const requiredCategoryType =
      locationType === "restaurant" || locationType === "cafe"
        ? "menu"
        : locationType === "hotel" || locationType === "resort"
          ? "room"
          : "other";

    const type = String(category_type || "").trim();
    const name = String(category_name || "").trim();
    const rawSort = Number.isFinite(Number(sort_order))
      ? Number(sort_order)
      : 0;
    const sort = Math.max(0, rawSort);

    if (!name || !["menu", "room", "other"].includes(type)) {
      res.status(400).json({
        success: false,
        message: "Thiếu category_name hoặc category_type không hợp lệ",
      });
      return;
    }

    if (type !== requiredCategoryType) {
      res.status(400).json({
        success: false,
        message: "Loại danh mục không hợp lệ cho loại địa điểm này",
      });
      return;
    }

    const [insert] = await pool.query<ResultSetHeader>(
      `INSERT INTO service_categories (location_id, category_type, category_name, sort_order)
       VALUES (?, ?, ?, ?)`,
      [locationId, type, name, sort],
    );

    res.status(201).json({
      success: true,
      message: "Tạo danh mục thành công",
      data: { category_id: insert.insertId },
    });
  } catch (error: any) {
    const msg = String(error?.message || "");
    if (msg.includes("Duplicate")) {
      res.status(409).json({ success: false, message: "Danh mục đã tồn tại" });
      return;
    }
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const updateServiceCategory = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    const categoryId = Number(req.params.categoryId);
    if (!Number.isFinite(categoryId)) {
      res
        .status(400)
        .json({ success: false, message: "categoryId không hợp lệ" });
      return;
    }

    const [catRows] = await pool.query<RowDataPacket[]>(
      `SELECT location_id
       FROM service_categories
       WHERE category_id = ?
         AND deleted_at IS NULL
       LIMIT 1`,
      [categoryId],
    );
    if (!catRows[0]) {
      res
        .status(404)
        .json({ success: false, message: "Không tìm thấy danh mục" });
      return;
    }

    const locationId = Number(catRows[0].location_id);
    await ensureLocationAccess({
      auth,
      locationId,
      requiredPermission:
        auth.role === "employee" ? "can_manage_services" : undefined,
    });

    const [locRows] = await pool.query<RowDataPacket[]>(
      `SELECT location_type, status FROM locations WHERE location_id = ? LIMIT 1`,
      [locationId],
    );
    const locationStatus = String(locRows?.[0]?.status || "");
    if (locationStatus !== "active") {
      res.status(400).json({
        success: false,
        message:
          "Địa điểm chưa được duyệt/kích hoạt nên không thể cập nhật danh mục",
      });
      return;
    }

    const body = req.body as any;
    const updates: string[] = [];
    const params: any[] = [];

    let newCategoryName: string | null = null;

    if ("category_name" in body) {
      const name = String(body.category_name || "").trim();
      if (!name) {
        res
          .status(400)
          .json({ success: false, message: "category_name không hợp lệ" });
        return;
      }
      updates.push("category_name = ?");
      params.push(name);
      newCategoryName = name;
    }
    if ("sort_order" in body) {
      const sort = Number(body.sort_order);
      if (!Number.isFinite(sort)) {
        res
          .status(400)
          .json({ success: false, message: "sort_order không hợp lệ" });
        return;
      }
      updates.push("sort_order = ?");
      params.push(Math.max(0, sort));
    }

    if (updates.length === 0) {
      res
        .status(400)
        .json({ success: false, message: "Không có dữ liệu cập nhật" });
      return;
    }

    params.push(categoryId);
    await pool.query(
      `UPDATE service_categories SET ${updates.join(", ")} WHERE category_id = ?`,
      params,
    );

    // Keep services grouping string in sync with category name.
    // Note: services list pages already join category_name, but pos_group is used
    // in some POS grouping logic; updating it helps avoid drift.
    if (newCategoryName) {
      await pool.query(
        `UPDATE services
         SET pos_group = ?
         WHERE category_id = ?
           AND deleted_at IS NULL`,
        [newCategoryName, categoryId],
      );
    }

    res.json({ success: true, message: "Cập nhật danh mục thành công" });
  } catch (error: any) {
    const msg = String(error?.message || "");
    if (msg.includes("Duplicate")) {
      res.status(409).json({ success: false, message: "Danh mục đã tồn tại" });
      return;
    }
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const deleteServiceCategory = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    const categoryId = Number(req.params.categoryId);
    if (!Number.isFinite(categoryId)) {
      res
        .status(400)
        .json({ success: false, message: "categoryId không hợp lệ" });
      return;
    }

    const [catRows] = await pool.query<RowDataPacket[]>(
      `SELECT location_id
       FROM service_categories
       WHERE category_id = ?
         AND deleted_at IS NULL
       LIMIT 1`,
      [categoryId],
    );
    if (!catRows[0]) {
      res
        .status(404)
        .json({ success: false, message: "Không tìm thấy danh mục" });
      return;
    }

    const locationId = Number(catRows[0].location_id);
    await ensureLocationAccess({
      auth,
      locationId,
      requiredPermission:
        auth.role === "employee" ? "can_manage_services" : undefined,
    });

    const [locRows] = await pool.query<RowDataPacket[]>(
      `SELECT status FROM locations WHERE location_id = ? LIMIT 1`,
      [locationId],
    );
    const locationStatus = String(locRows?.[0]?.status || "");
    if (locationStatus !== "active") {
      res.status(400).json({
        success: false,
        message:
          "Địa điểm chưa được duyệt/kích hoạt nên không thể xóa danh mục",
      });
      return;
    }

    const [svcRows] = await pool.query<RowDataPacket[]>(
      `SELECT service_id
       FROM services
       WHERE category_id = ?
         AND deleted_at IS NULL
       LIMIT 1`,
      [categoryId],
    );
    if (svcRows[0]) {
      res.status(400).json({
        success: false,
        message:
          "Danh mục đang có dịch vụ. Vui lòng chuyển dịch vụ sang danh mục khác trước khi xóa.",
      });
      return;
    }

    await pool.query(
      `UPDATE service_categories SET deleted_at = NOW() WHERE category_id = ?`,
      [categoryId],
    );

    res.json({ success: true, message: "Đã xóa danh mục" });
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const createServiceForLocation = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    const locationId = Number(req.params.locationId);

    const { ownerId } = await ensureLocationAccess({
      auth,
      locationId,
      requiredPermission:
        auth.role === "employee" ? "can_manage_services" : undefined,
    });

    const body = req.body as any;

    const service_name = String(body.service_name || "").trim();
    const service_type = String(body.service_type || "").trim();
    const price = Number(body.price);

    if (!service_name || !service_type || !Number.isFinite(price)) {
      res.status(400).json({
        success: false,
        message: "Thiếu service_name/service_type/price",
      });
      return;
    }

    const images = Array.isArray(body.images) ? body.images : null;

    const categoryId =
      body.category_id === null || typeof body.category_id === "undefined"
        ? null
        : Number(body.category_id);

    const [locRows] = await pool.query<RowDataPacket[]>(
      `SELECT location_type, status FROM locations WHERE location_id = ? LIMIT 1`,
      [locationId],
    );
    const locationType = String(locRows[0]?.location_type || "");
    const locationStatus = String(locRows[0]?.status || "");
    if (locationStatus !== "active") {
      res.status(400).json({
        success: false,
        message: "Địa điểm chưa được duyệt/kích hoạt nên không thể tạo dịch vụ",
      });
      return;
    }
    const requiredCategoryType =
      locationType === "restaurant" || locationType === "cafe"
        ? "menu"
        : locationType === "hotel" || locationType === "resort"
          ? "room"
          : "other";

    if (!Number.isFinite(Number(categoryId))) {
      res.status(400).json({
        success: false,
        message: "Vui lòng chọn danh mục trước khi tạo dịch vụ",
      });
      return;
    }

    let categoryName: string | null = null;
    if (Number.isFinite(Number(categoryId))) {
      const [catRows] = await pool.query<RowDataPacket[]>(
        `SELECT category_id, category_name
         FROM service_categories
         WHERE category_id = ?
           AND location_id = ?
           AND category_type = ?
           AND deleted_at IS NULL
         LIMIT 1`,
        [Number(categoryId), locationId, requiredCategoryType],
      );
      if (!catRows[0]) {
        res
          .status(400)
          .json({ success: false, message: "Danh mục không hợp lệ" });
        return;
      }
      categoryName = String(catRows[0].category_name || "").trim() || null;
    }

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO services (
        location_id, category_id, service_name, service_type, description, price, quantity, unit, status, images, pos_group, admin_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        locationId,
        Number.isFinite(Number(categoryId)) ? Number(categoryId) : null,
        service_name,
        service_type,
        body.description ?? null,
        price,
        Number.isFinite(Number(body.quantity)) ? Number(body.quantity) : 1,
        body.unit ?? null,
        body.status ?? "available",
        images ? JSON.stringify(images) : null,
        categoryName ? categoryName : (body.pos_group ?? null),
        "pending",
      ],
    );

    await logAudit(auth.userId, "CREATE_OWNER_SERVICE", {
      owner_id: ownerId,
      location_id: locationId,
      service_id: result.insertId,
      timestamp: new Date(),
    });

    res.status(201).json({
      success: true,
      message: "Tạo dịch vụ thành công",
      data: { service_id: result.insertId },
    });
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const updateService = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    const serviceId = Number(req.params.id);

    if (!Number.isFinite(serviceId)) {
      res
        .status(400)
        .json({ success: false, message: "serviceId không hợp lệ" });
      return;
    }

    const [svcRows] = await pool.query<RowDataPacket[]>(
      `SELECT s.location_id, l.owner_id
       FROM services s
       JOIN locations l ON l.location_id = s.location_id
       WHERE s.service_id = ?
         AND s.deleted_at IS NULL
       LIMIT 1`,
      [serviceId],
    );

    if (!svcRows[0]) {
      res
        .status(404)
        .json({ success: false, message: "Không tìm thấy dịch vụ" });
      return;
    }

    const locationId = Number(svcRows[0].location_id);

    await ensureLocationAccess({
      auth,
      locationId,
      requiredPermission:
        auth.role === "employee" ? "can_manage_services" : undefined,
    });

    const body = req.body as any;
    const updates: string[] = [];
    const params: any[] = [];

    const shouldResetAdminApproval =
      "service_name" in body ||
      "service_type" in body ||
      "description" in body ||
      "price" in body ||
      "unit" in body ||
      "images" in body ||
      "category_id" in body;

    const up = (field: string, value: any, json = false) => {
      if (value === undefined) return;
      updates.push(`${field} = ?`);
      params.push(json ? JSON.stringify(value) : value);
    };

    if ("service_name" in body)
      up("service_name", String(body.service_name || "").trim());
    if ("service_type" in body)
      up("service_type", String(body.service_type || "").trim());
    if ("description" in body) up("description", body.description ?? null);
    if ("price" in body) up("price", Number(body.price));
    if ("quantity" in body) up("quantity", Number(body.quantity));
    if ("unit" in body) up("unit", body.unit ?? null);
    if ("status" in body) up("status", body.status);
    if ("images" in body)
      up("images", Array.isArray(body.images) ? body.images : null, true);

    if ("category_id" in body) {
      const categoryId =
        body.category_id === null || typeof body.category_id === "undefined"
          ? null
          : Number(body.category_id);
      if (categoryId === null) {
        res.status(400).json({
          success: false,
          message: "Dịch vụ bắt buộc phải có danh mục",
        });
        return;
      }

      if (!Number.isFinite(Number(categoryId))) {
        res
          .status(400)
          .json({ success: false, message: "category_id không hợp lệ" });
        return;
      }

      const [locRows] = await pool.query<RowDataPacket[]>(
        `SELECT location_type, status FROM locations WHERE location_id = ? LIMIT 1`,
        [locationId],
      );
      const locationType = String(locRows?.[0]?.location_type || "");
      const locationStatus = String(locRows?.[0]?.status || "");
      if (locationStatus !== "active") {
        res.status(400).json({
          success: false,
          message:
            "Địa điểm chưa được duyệt/kích hoạt nên không thể cập nhật dịch vụ",
        });
        return;
      }
      const requiredCategoryType =
        locationType === "restaurant" || locationType === "cafe"
          ? "menu"
          : locationType === "hotel" || locationType === "resort"
            ? "room"
            : "other";

      if (Number.isFinite(Number(categoryId))) {
        const [catRows] = await pool.query<RowDataPacket[]>(
          `SELECT category_id, category_name
           FROM service_categories
           WHERE category_id = ?
             AND location_id = ?
             AND category_type = ?
             AND deleted_at IS NULL
           LIMIT 1`,
          [Number(categoryId), locationId, requiredCategoryType],
        );
        if (!catRows[0]) {
          res
            .status(400)
            .json({ success: false, message: "Danh mục không hợp lệ" });
          return;
        }
        up("category_id", Number(categoryId));
        // Keep pos_group in sync for POS screens
        up("pos_group", String(catRows[0].category_name || "").trim());
      }
    }

    if (updates.length === 0) {
      res
        .status(400)
        .json({ success: false, message: "Không có dữ liệu cập nhật" });
      return;
    }

    if (shouldResetAdminApproval) {
      up("admin_status", "pending");
      up("admin_reviewed_by", null);
      up("admin_reviewed_at", null);
      up("admin_reject_reason", null);
    }

    params.push(serviceId);

    await pool.query(
      `UPDATE services SET ${updates.join(", ")} WHERE service_id = ?`,
      params,
    );

    await logAudit(auth.userId, "UPDATE_OWNER_SERVICE", {
      service_id: serviceId,
      timestamp: new Date(),
    });

    res.json({ success: true, message: "Cập nhật dịch vụ thành công" });
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const deleteService = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    const serviceId = Number(req.params.id);

    if (!Number.isFinite(serviceId)) {
      res
        .status(400)
        .json({ success: false, message: "serviceId không hợp lệ" });
      return;
    }

    const [svcRows] = await pool.query<RowDataPacket[]>(
      `SELECT s.location_id
       FROM services s
       JOIN locations l ON l.location_id = s.location_id
       WHERE s.service_id = ?
       AND l.owner_id = ?
       LIMIT 1`,
      [
        serviceId,
        auth.role === "owner"
          ? auth.userId
          : await getOwnerIdForEmployee(auth.userId),
      ],
    );

    if (!svcRows[0]) {
      res
        .status(404)
        .json({ success: false, message: "Không tìm thấy dịch vụ" });
      return;
    }

    const locationId = Number(svcRows[0].location_id);

    await ensureLocationAccess({
      auth,
      locationId,
      requiredPermission:
        auth.role === "employee" ? "can_manage_services" : undefined,
    });

    // If service has historical references, we cannot hard-delete due to FK RESTRICT.
    // In that case, do a soft delete (deleted_at + status='unavailable') to preserve history.
    const [refRows] = await pool.query<RowDataPacket[]>(
      `SELECT
         (SELECT COUNT(*) FROM bookings WHERE service_id = ?) AS bookings,
         (SELECT COUNT(*) FROM booking_tickets WHERE service_id = ?) AS booking_tickets,
         (SELECT COUNT(*) FROM hotel_stay_items WHERE service_id = ?) AS hotel_stay_items,
         (SELECT COUNT(*) FROM pos_order_items WHERE service_id = ?) AS pos_order_items,
         (SELECT COUNT(*) FROM pos_tickets WHERE service_id = ?) AS pos_tickets`,
      [serviceId, serviceId, serviceId, serviceId, serviceId],
    );

    const refs = refRows[0] || ({} as any);
    const hasRefs =
      Number(refs.bookings || 0) > 0 ||
      Number(refs.booking_tickets || 0) > 0 ||
      Number(refs.hotel_stay_items || 0) > 0 ||
      Number(refs.pos_order_items || 0) > 0 ||
      Number(refs.pos_tickets || 0) > 0;

    if (hasRefs) {
      await pool.query(
        `UPDATE services
         SET deleted_at = NOW(), status = 'unavailable'
         WHERE service_id = ?`,
        [serviceId],
      );

      await logAudit(auth.userId, "SOFT_DELETE_OWNER_SERVICE", {
        service_id: serviceId,
        reason: "FK_RESTRICT_HAS_HISTORY",
        refs,
        timestamp: new Date(),
      });

      res.json({
        success: true,
        message:
          "Dịch vụ đã có lịch sử giao dịch/đơn hàng nên được chuyển sang trạng thái ngừng kinh doanh.",
      });
      return;
    }

    await pool.query(`DELETE FROM services WHERE service_id = ?`, [serviceId]);

    await logAudit(auth.userId, "DELETE_OWNER_SERVICE", {
      service_id: serviceId,
      timestamp: new Date(),
    });

    res.json({ success: true, message: "Xóa dịch vụ thành công" });
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const getOwnerBookings = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);

    const { status, location_id } = req.query as {
      status?: string;
      location_id?: string;
    };

    const params: any[] = [];

    let sql = `
      SELECT
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
      WHERE 1=1
    `;

    if (auth.role === "owner") {
      sql += ` AND l.owner_id = ?`;
      params.push(auth.userId);
    } else {
      const ownerId = await getOwnerIdForEmployee(auth.userId);
      sql += ` AND EXISTS (
        SELECT 1 FROM employee_locations el
        WHERE el.employee_id = ? AND el.owner_id = ?
          AND el.location_id = b.location_id
          AND el.status = 'active'
      )`;
      params.push(auth.userId, ownerId);
    }

    if (status) {
      sql += ` AND b.status = ?`;
      params.push(status);
    }

    if (location_id && Number.isFinite(Number(location_id))) {
      sql += ` AND b.location_id = ?`;
      params.push(Number(location_id));
    }

    sql += ` ORDER BY b.created_at DESC LIMIT 200`;

    const [rows] = await pool.query<RowDataPacket[]>(sql, params);

    const bookingIds = rows
      .map((row) => Number((row as any).booking_id))
      .filter((id) => Number.isFinite(id));

    const tableNamesByBooking = new Map<number, string[]>();
    const roomNamesByBooking = new Map<number, string[]>();
    const ticketItemsByBooking = new Map<
      number,
      Array<{ name: string; quantity: number }>
    >();
    const menuItemsByBooking = new Map<
      number,
      Array<{ name: string; quantity: number }>
    >();

    if (bookingIds.length > 0) {
      try {
        const [tableRows] = await pool.query<RowDataPacket[]>(
          `SELECT r.booking_id, t.table_name
           FROM booking_table_reservations r
           JOIN pos_tables t ON t.table_id = r.table_id
           WHERE r.booking_id IN (?)
             AND r.status <> 'cancelled'
           ORDER BY t.table_name ASC`,
          [bookingIds],
        );

        for (const row of tableRows) {
          const bookingId = Number((row as any).booking_id);
          const tableName = String((row as any).table_name || "").trim();
          if (!Number.isFinite(bookingId) || !tableName) continue;
          const cur = tableNamesByBooking.get(bookingId) || [];
          if (!cur.includes(tableName)) cur.push(tableName);
          tableNamesByBooking.set(bookingId, cur);
        }
      } catch (error) {
        console.warn("Skip table detail enrichment:", error);
      }

      try {
        const [roomRows] = await pool.query<RowDataPacket[]>(
          `SELECT hs.booking_id, hr.room_number
           FROM hotel_stays hs
           LEFT JOIN hotel_rooms hr ON hr.room_id = hs.room_id
           WHERE hs.booking_id IN (?)
           ORDER BY hr.room_number ASC`,
          [bookingIds],
        );

        for (const row of roomRows) {
          const bookingId = Number((row as any).booking_id);
          const roomName = String((row as any).room_number || "").trim();
          if (!Number.isFinite(bookingId) || !roomName) continue;
          const cur = roomNamesByBooking.get(bookingId) || [];
          if (!cur.includes(roomName)) cur.push(roomName);
          roomNamesByBooking.set(bookingId, cur);
        }
      } catch (error) {
        console.warn("Skip room detail enrichment:", error);
      }

      try {
        const [ticketRows] = await pool.query<RowDataPacket[]>(
          `SELECT bt.booking_id, s.service_name, COUNT(*) AS quantity
           FROM booking_tickets bt
           JOIN services s ON s.service_id = bt.service_id
           WHERE bt.booking_id IN (?)
           GROUP BY bt.booking_id, bt.service_id, s.service_name
           ORDER BY s.service_name ASC`,
          [bookingIds],
        );

        for (const row of ticketRows) {
          const bookingId = Number((row as any).booking_id);
          const name = String((row as any).service_name || "").trim();
          const quantity = Number((row as any).quantity || 0);
          if (!Number.isFinite(bookingId) || !name || quantity <= 0) continue;
          const cur = ticketItemsByBooking.get(bookingId) || [];
          cur.push({ name, quantity });
          ticketItemsByBooking.set(bookingId, cur);
        }
      } catch (error) {
        console.warn("Skip ticket detail enrichment:", error);
      }

      try {
        const [menuRows] = await pool.query<RowDataPacket[]>(
          `SELECT b.booking_id, s.service_name, SUM(oi.quantity) AS quantity
           FROM pos_orders o
           JOIN bookings b ON b.pos_order_id = o.order_id
           JOIN pos_order_items oi ON oi.order_id = o.order_id
           JOIN services s ON s.service_id = oi.service_id
           WHERE b.booking_id IN (?)
           GROUP BY b.booking_id, oi.service_id, s.service_name
           ORDER BY s.service_name ASC`,
          [bookingIds],
        );

        for (const row of menuRows) {
          const bookingId = Number((row as any).booking_id);
          const name = String((row as any).service_name || "").trim();
          const quantity = Number((row as any).quantity || 0);
          if (!Number.isFinite(bookingId) || !name || quantity <= 0) continue;
          const cur = menuItemsByBooking.get(bookingId) || [];
          cur.push({ name, quantity });
          menuItemsByBooking.set(bookingId, cur);
        }
      } catch (error) {
        console.warn("Skip menu detail enrichment:", error);
      }
    }

    const data = rows.map((row) => {
      const bookingId = Number((row as any).booking_id);
      const statusValue = String(row.status || "").toLowerCase();
      const locationType = String(row.location_type || "").toLowerCase();
      const serviceType = String(row.service_type || "").toLowerCase();
      const baseQty = Math.max(1, Number((row as any).quantity || 1));

      const isTouristService =
        locationType === "tourist" ||
        serviceType === "ticket" ||
        serviceType === "tour";

      const hasCompletedTransfer =
        Number(row.has_completed_transfer_payment || 0) === 1;
      const hasVerifiedArrival = Number(row.has_verified_arrival || 0) === 1;

      const canConfirm =
        !isTouristService && statusValue === "pending" && !hasVerifiedArrival;
      const canComplete = !isTouristService && statusValue === "confirmed";
      const canCancel =
        !isTouristService &&
        statusValue !== "cancelled" &&
        statusValue !== "completed" &&
        !hasCompletedTransfer;
      const canCreatePayment =
        !isTouristService &&
        statusValue !== "cancelled" &&
        statusValue !== "completed";

      const actionWarning = hasCompletedTransfer
        ? "Khách đã thanh toán. Không thể tự hủy. Nếu gặp sự cố bất khả kháng, vui lòng gọi Hotline Admin để được hỗ trợ."
        : isTouristService
          ? "Dịch vụ du lịch chỉ tập trung luồng xuất/bán vé, không thao tác trạng thái tại mục Đặt chỗ."
          : null;

      const tableNames = Number.isFinite(bookingId)
        ? tableNamesByBooking.get(bookingId) || []
        : [];
      const roomNames = Number.isFinite(bookingId)
        ? roomNamesByBooking.get(bookingId) || []
        : [];
      const ticketItems = Number.isFinite(bookingId)
        ? ticketItemsByBooking.get(bookingId) || []
        : [];
      const menuItems = Number.isFinite(bookingId)
        ? menuItemsByBooking.get(bookingId) || []
        : [];
      const latestPaymentNotes = parsePaymentNotesJson(
        (row as any).latest_payment_notes,
      );
      const paymentMenuItems = Array.isArray(latestPaymentNotes?.items)
        ? (latestPaymentNotes.items as any[])
            .map((item: any) => ({
              name: String(item?.service_name || item?.name || "").trim(),
              quantity: Number(item?.quantity || 0),
            }))
            .filter((item: any) => Boolean(item.name) && item.quantity > 0)
        : [];
      const mergedMenuItems =
        menuItems.length > 0 ? menuItems : paymentMenuItems;

      const detailItems: Array<{
        kind: "table" | "room" | "ticket" | "menu" | "service";
        name: string;
        quantity: number;
      }> = [];

      if (serviceType === "table") {
        for (const tableName of tableNames) {
          detailItems.push({ kind: "table", name: tableName, quantity: 1 });
        }
        for (const item of mergedMenuItems) {
          detailItems.push({
            kind: "menu",
            name: item.name,
            quantity: item.quantity,
          });
        }
        if (detailItems.length === 0) {
          detailItems.push({
            kind: "service",
            name: String(row.service_name || "Dịch vụ"),
            quantity: baseQty,
          });
        }
      } else if (serviceType === "room") {
        for (const roomName of roomNames) {
          detailItems.push({ kind: "room", name: roomName, quantity: 1 });
        }
        if (detailItems.length === 0) {
          detailItems.push({
            kind: "service",
            name: String(row.service_name || "Phòng"),
            quantity: baseQty,
          });
        }
      } else if (isTouristService) {
        for (const item of ticketItems) {
          detailItems.push({
            kind: "ticket",
            name: item.name,
            quantity: item.quantity,
          });
        }
        if (detailItems.length === 0) {
          detailItems.push({
            kind: "service",
            name: String(row.service_name || "Vé"),
            quantity: baseQty,
          });
        }
      } else {
        detailItems.push({
          kind: "service",
          name: String(row.service_name || "Dịch vụ"),
          quantity: baseQty,
        });
      }

      return {
        ...row,
        total_completed_paid_amount: Number(
          row.total_completed_paid_amount || 0,
        ),
        has_completed_transfer_payment: hasCompletedTransfer ? 1 : 0,
        has_verified_arrival: hasVerifiedArrival ? 1 : 0,
        can_confirm: canConfirm,
        can_complete: canComplete,
        can_cancel: canCancel,
        can_create_payment: canCreatePayment,
        action_warning: actionWarning,
        table_names: tableNames,
        room_names: roomNames,
        detail_items: detailItems,
      };
    });

    res.json({ success: true, data });
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const getOwnerBookingFoodItems = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    const bookingId = Number(req.params.id);
    if (!Number.isFinite(bookingId) || bookingId <= 0) {
      res
        .status(400)
        .json({ success: false, message: "bookingId không hợp lệ" });
      return;
    }

    const [bookingRows] = await pool.query<RowDataPacket[]>(
      `SELECT b.booking_id, b.location_id, b.pos_order_id,
              b.service_id, l.owner_id, l.location_type,
              s.service_type,
              p.notes AS latest_payment_notes
       FROM bookings b
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
       WHERE b.booking_id = ?
       LIMIT 1`,
      [bookingId],
    );

    const booking = bookingRows?.[0];
    if (!booking) {
      res
        .status(404)
        .json({ success: false, message: "Không tìm thấy booking" });
      return;
    }

    if (auth.role === "owner") {
      if (Number(booking.owner_id) !== auth.userId) {
        res
          .status(403)
          .json({ success: false, message: "Không có quyền truy cập" });
        return;
      }
    } else {
      const ownerId = await getOwnerIdForEmployee(auth.userId);
      const [allowRows] = await pool.query<RowDataPacket[]>(
        `SELECT 1
         FROM employee_locations
         WHERE employee_id = ?
           AND owner_id = ?
           AND location_id = ?
           AND status = 'active'
         LIMIT 1`,
        [auth.userId, ownerId, Number(booking.location_id)],
      );
      if (!allowRows?.[0]) {
        res
          .status(403)
          .json({ success: false, message: "Không có quyền truy cập" });
        return;
      }
    }

    const serviceType = String(booking.service_type || "").toLowerCase();
    const locationType = String(booking.location_type || "").toLowerCase();
    const isFoodLike = serviceType === "table" || locationType === "food";

    if (!isFoodLike) {
      res.json({ success: true, data: [] });
      return;
    }

    const itemMap = new Map<
      string,
      { service_name: string; quantity: number }
    >();
    const mergeItem = (nameRaw: unknown, qtyRaw: unknown) => {
      const serviceName = String(nameRaw || "").trim();
      const quantity = Number(qtyRaw || 0);
      if (!serviceName || !Number.isFinite(quantity) || quantity <= 0) return;
      const key = serviceName.toLowerCase();
      const prev = itemMap.get(key);
      if (prev) {
        prev.quantity += Math.max(1, Math.floor(quantity));
      } else {
        itemMap.set(key, {
          service_name: serviceName,
          quantity: Math.max(1, Math.floor(quantity)),
        });
      }
    };

    await ensureBookingPreorderItemsSchema();

    try {
      const [snapshotRows] = await pool.query<RowDataPacket[]>(
        `SELECT service_name_snapshot, quantity
         FROM booking_preorder_items
         WHERE booking_id = ?
         ORDER BY preorder_item_id ASC`,
        [bookingId],
      );
      for (const row of snapshotRows) {
        mergeItem((row as any).service_name_snapshot, (row as any).quantity);
      }
    } catch (error) {
      console.warn("Skip booking_preorder_items lookup:", error);
    }

    try {
      const [orderRows] = await pool.query<RowDataPacket[]>(
        `SELECT s.service_name, SUM(oi.quantity) AS quantity
         FROM pos_orders o
         JOIN pos_order_items oi ON oi.order_id = o.order_id
         JOIN services s ON s.service_id = oi.service_id
         WHERE o.booking_id = ?
         GROUP BY oi.service_id, s.service_name
         ORDER BY s.service_name ASC`,
        [bookingId],
      );
      for (const row of orderRows) {
        mergeItem((row as any).service_name, (row as any).quantity);
      }
    } catch (error) {
      console.warn("Skip pos_order_items lookup:", error);
    }

    const latestPaymentNotes = parsePaymentNotesJson(
      (booking as any).latest_payment_notes,
    );
    if (Array.isArray(latestPaymentNotes?.items)) {
      for (const item of latestPaymentNotes.items) {
        mergeItem(item?.service_name ?? item?.name, item?.quantity);
      }
    }

    const data = Array.from(itemMap.values()).sort((a, b) =>
      a.service_name.localeCompare(b.service_name, "vi"),
    );

    res.json({ success: true, data });
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const updateBookingStatus = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    const bookingId = Number(req.params.id);
    const { status, notes } = req.body as {
      status?: "confirmed" | "cancelled" | "completed";
      notes?: string | null;
    };

    if (!Number.isFinite(bookingId)) {
      res
        .status(400)
        .json({ success: false, message: "bookingId không hợp lệ" });
      return;
    }

    if (!status || !["confirmed", "cancelled", "completed"].includes(status)) {
      res.status(400).json({ success: false, message: "status không hợp lệ" });
      return;
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT b.location_id,
              b.user_id,
              b.status as cur_status,
              l.owner_id,
              l.location_type,
              s.service_type,
              COALESCE(pay.has_completed_transfer_payment, 0) AS has_completed_transfer_payment
       FROM bookings b
       JOIN locations l ON l.location_id = b.location_id
       JOIN services s ON s.service_id = b.service_id
       LEFT JOIN (
         SELECT
           booking_id,
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
       WHERE b.booking_id = ?
       LIMIT 1`,
      [bookingId],
    );

    if (!rows[0]) {
      res
        .status(404)
        .json({ success: false, message: "Không tìm thấy booking" });
      return;
    }

    const locationId = Number(rows[0].location_id);
    const bookingUserIdRaw = (rows[0] as any).user_id;
    const bookingUserId =
      bookingUserIdRaw == null ? null : Number(bookingUserIdRaw);
    const locationType = String(rows[0].location_type || "").toLowerCase();
    const serviceType = String(rows[0].service_type || "").toLowerCase();
    const isTouristService =
      locationType === "tourist" ||
      serviceType === "ticket" ||
      serviceType === "tour";
    const hasCompletedTransferPayment =
      Number(rows[0].has_completed_transfer_payment || 0) === 1;

    const { ownerId } = await ensureLocationAccess({
      auth,
      locationId,
      requiredPermission:
        auth.role === "employee" ? "can_manage_bookings" : undefined,
    });

    if (isTouristService) {
      res.status(400).json({
        success: false,
        message:
          "Dịch vụ du lịch không thao tác trạng thái tại mục Đặt chỗ. Vui lòng xử lý trong luồng xuất/bán vé.",
      });
      return;
    }

    if (status === "cancelled") {
      if (!String(notes || "").trim()) {
        res.status(400).json({
          success: false,
          message: "Vui lòng nhập lý do hủy trước khi thực hiện.",
        });
        return;
      }

      if (hasCompletedTransferPayment) {
        res.status(400).json({
          success: false,
          message:
            "Khách đã thanh toán. Không thể tự hủy. Nếu gặp sự cố bất khả kháng, vui lòng gọi Hotline Admin để được hỗ trợ.",
        });
        return;
      }
    }

    if (status === "cancelled") {
      await pool.query(
        `UPDATE bookings
         SET status = 'cancelled', cancelled_at = NOW(), cancelled_by = ?, notes = COALESCE(?, notes)
         WHERE booking_id = ?`,
        [auth.userId, notes ?? null, bookingId],
      );

      // Notify the booking user (if any) so user-side UI can clear notices.
      if (bookingUserId != null && Number.isFinite(bookingUserId)) {
        publishToUser(Number(bookingUserId), {
          type: "booking_cancelled",
          booking_id: bookingId,
          location_id: locationId,
        });
      }
    } else {
      await pool.query(
        `UPDATE bookings SET status = ?, notes = COALESCE(?, notes) WHERE booking_id = ?`,
        [status, notes ?? null, bookingId],
      );
    }

    // PMS sync (hotel/resort room bookings): keep hotel_stays + hotel_rooms in sync
    try {
      const [bRows] = await pool.query<RowDataPacket[]>(
        `SELECT
           b.booking_id,
           b.location_id,
           b.service_id,
           b.user_id,
           b.check_in_date,
           b.check_out_date,
           b.total_amount,
           b.discount_amount,
           b.final_amount,
           s.service_type,
           s.service_name,
           c.sort_order as category_sort_order,
           l.location_type
         FROM bookings b
         JOIN services s ON s.service_id = b.service_id
         JOIN locations l ON l.location_id = b.location_id
         LEFT JOIN service_categories c
           ON c.category_id = s.category_id AND c.deleted_at IS NULL
         WHERE b.booking_id = ?
         LIMIT 1`,
        [bookingId],
      );

      const b = bRows[0];
      const locationType = String(b?.location_type || "");
      const serviceType = String(b?.service_type || "");

      if (
        b &&
        serviceType === "room" &&
        (locationType === "hotel" || locationType === "resort")
      ) {
        const serviceId = Number(b.service_id);
        const userId = b.user_id == null ? null : Number(b.user_id);
        const expectedCheckin = b.check_in_date
          ? String(b.check_in_date)
          : null;
        const expectedCheckout = b.check_out_date
          ? String(b.check_out_date)
          : null;
        const derivedFloor = Number(b.category_sort_order ?? 0);
        const svcName = b.service_name ? String(b.service_name) : null;
        const roomNameRaw =
          String(svcName || "").trim() || `Phòng ${serviceId}`;
        const roomName =
          roomNameRaw.length > 20 ? roomNameRaw.slice(0, 20) : roomNameRaw;

        const conn = await pool.getConnection();
        try {
          await conn.beginTransaction();

          // Ensure room exists (unique by location_id + service_id)
          let roomId: number | null = null;
          const [roomRows] = await conn.query<RowDataPacket[]>(
            `SELECT room_id
             FROM hotel_rooms
             WHERE location_id = ? AND service_id = ?
             LIMIT 1
             FOR UPDATE`,
            [locationId, serviceId],
          );
          if (roomRows[0]) {
            roomId = Number(roomRows[0].room_id);
          } else {
            try {
              await conn.query(
                `INSERT INTO hotel_rooms (location_id, service_id, area_id, floor_number, room_number, status)
                 VALUES (?, ?, NULL, ?, ?, 'vacant')`,
                [locationId, serviceId, derivedFloor, roomName],
              );
            } catch (e: any) {
              const msg = String(e?.message || "");
              if (!msg.includes("Duplicate")) throw e;
            }
            const [roomRows2] = await conn.query<RowDataPacket[]>(
              `SELECT room_id
               FROM hotel_rooms
               WHERE location_id = ? AND service_id = ?
               LIMIT 1
               FOR UPDATE`,
              [locationId, serviceId],
            );
            if (roomRows2[0]) roomId = Number(roomRows2[0].room_id);
          }

          if (Number.isFinite(roomId as number)) {
            // Ensure stay exists for this booking (helps backfill old bookings)
            const [stayRows] = await conn.query<RowDataPacket[]>(
              `SELECT stay_id, status
               FROM hotel_stays
               WHERE booking_id = ?
               LIMIT 1
               FOR UPDATE`,
              [bookingId],
            );

            if (!stayRows[0] && status !== "cancelled") {
              await conn.query(
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
                  expectedCheckin,
                  expectedCheckout,
                  Number(b.total_amount || 0),
                  Number(b.discount_amount || 0),
                  Number(b.final_amount || 0),
                  JSON.stringify({
                    source: "online_booking_backfill",
                    booking_id: bookingId,
                  }),
                ],
              );
            }

            if (status === "cancelled") {
              await conn.query(
                `UPDATE hotel_stays
                 SET status = 'cancelled', checkout_time = NOW(), closed_by = ?
                 WHERE booking_id = ? AND status IN ('reserved','inhouse')`,
                [auth.userId, bookingId],
              );
            } else if (status === "completed") {
              await conn.query(
                `UPDATE hotel_stays
                 SET status = 'checked_out', checkout_time = NOW(), closed_by = ?
                 WHERE booking_id = ? AND status IN ('reserved','inhouse')`,
                [auth.userId, bookingId],
              );
            } else if (status === "confirmed") {
              await conn.query(
                `UPDATE hotel_stays
                 SET status = 'reserved'
                 WHERE booking_id = ? AND status = 'cancelled'`,
                [bookingId],
              );
            }

            // Recompute room status from active stays
            const [activeStay] = await conn.query<RowDataPacket[]>(
              `SELECT stay_id
               FROM hotel_stays
               WHERE room_id = ? AND status IN ('reserved','inhouse')
               LIMIT 1`,
              [roomId],
            );

            if (activeStay[0]) {
              await conn.query(
                `UPDATE hotel_rooms
                 SET status = 'reserved'
                 WHERE room_id = ? AND status <> 'occupied'`,
                [roomId],
              );
            } else {
              await conn.query(
                `UPDATE hotel_rooms
                 SET status = 'vacant'
                 WHERE room_id = ? AND status = 'reserved'`,
                [roomId],
              );
            }

            await publishHotelUpdated(conn, locationId, ownerId, {
              booking_id: bookingId,
              room_id: roomId,
              status,
            });
          }

          await conn.commit();
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
      }
    } catch {
      // ignore PMS sync failures here to not block booking status updates
    }

    await logAudit(auth.userId, "UPDATE_OWNER_BOOKING_STATUS", {
      booking_id: bookingId,
      status,
      timestamp: new Date(),
    });

    res.json({ success: true, message: "Cập nhật booking thành công" });
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const getOwnerCheckins = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    const { status, location_id } = req.query as {
      status?: string;
      location_id?: string;
    };

    const params: any[] = [];

    let sql = `
      SELECT
        c.*, u.full_name as user_name, u.email as user_email, u.phone as user_phone,
        l.location_name, l.location_type
      FROM checkins c
      JOIN users u ON u.user_id = c.user_id
      JOIN locations l ON l.location_id = c.location_id
      WHERE 1=1
    `;

    if (auth.role === "owner") {
      sql += ` AND l.owner_id = ?`;
      params.push(auth.userId);
    } else {
      const ownerId = await getOwnerIdForEmployee(auth.userId);
      sql += ` AND EXISTS (
        SELECT 1 FROM employee_locations el
        WHERE el.employee_id = ? AND el.owner_id = ?
          AND el.location_id = c.location_id
          AND el.status = 'active'
      )`;
      params.push(auth.userId, ownerId);
    }

    if (status) {
      sql += ` AND c.status = ?`;
      params.push(status);
    }

    if (location_id && Number.isFinite(Number(location_id))) {
      sql += ` AND c.location_id = ?`;
      params.push(Number(location_id));
    }

    sql += ` ORDER BY c.checkin_time DESC LIMIT 200`;

    const [rows] = await pool.query<RowDataPacket[]>(sql, params);
    res.json({ success: true, data: rows });
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const verifyOwnerCheckin = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    const checkinId = Number(req.params.id);
    const { notes } = req.body as { notes?: string | null };

    if (!Number.isFinite(checkinId)) {
      res
        .status(400)
        .json({ success: false, message: "checkinId không hợp lệ" });
      return;
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT c.location_id,
              c.booking_id,
              c.status,
              l.location_type,
              s.service_type,
              b.status AS booking_status
       FROM checkins c
       JOIN locations l ON l.location_id = c.location_id
       LEFT JOIN bookings b ON b.booking_id = c.booking_id
       LEFT JOIN services s ON s.service_id = b.service_id
       WHERE c.checkin_id = ?
       LIMIT 1`,
      [checkinId],
    );

    if (!rows[0]) {
      res
        .status(404)
        .json({ success: false, message: "Không tìm thấy check-in" });
      return;
    }

    const locationId = Number(rows[0].location_id);

    await ensureLocationAccess({
      auth,
      locationId,
      requiredPermission: auth.role === "employee" ? "can_scan" : undefined,
    });

    await pool.query(
      `UPDATE checkins
       SET status = 'verified', verified_by = ?, notes = COALESCE(?, notes),
           checkin_time = COALESCE(checkin_time, NOW())
       WHERE checkin_id = ?`,
      [auth.userId, notes ?? null, checkinId],
    );

    const bookingId = Number(rows[0].booking_id || 0);
    const bookingStatus = String(rows[0].booking_status || "").toLowerCase();
    const locationType = String(rows[0].location_type || "").toLowerCase();
    const serviceType = String(rows[0].service_type || "").toLowerCase();

    const shouldAutoConfirm =
      bookingId > 0 &&
      bookingStatus === "pending" &&
      (locationType === "food" ||
        locationType === "hotel" ||
        serviceType === "table");

    if (shouldAutoConfirm) {
      await pool.query(
        `UPDATE bookings
         SET status = 'confirmed',
             notes = CONCAT(IFNULL(notes, ''), IF(IFNULL(notes, '') = '', '', '\n'), '[AUTO] Đã xác nhận khi chủ cơ sở xác thực khách đến')
         WHERE booking_id = ? AND status = 'pending'`,
        [bookingId],
      );
    }

    await logAudit(auth.userId, "VERIFY_OWNER_CHECKIN", {
      checkin_id: checkinId,
      timestamp: new Date(),
    });

    res.json({ success: true, message: "Xác thực check-in thành công" });
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const failOwnerCheckin = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    const checkinId = Number(req.params.id);
    const { reason } = req.body as { reason?: string | null };

    if (!Number.isFinite(checkinId)) {
      res
        .status(400)
        .json({ success: false, message: "checkinId không hợp lệ" });
      return;
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT c.location_id, c.status
       FROM checkins c
       WHERE c.checkin_id = ?
       LIMIT 1`,
      [checkinId],
    );

    if (!rows[0]) {
      res
        .status(404)
        .json({ success: false, message: "Không tìm thấy check-in" });
      return;
    }

    const locationId = Number(rows[0].location_id);

    await ensureLocationAccess({
      auth,
      locationId,
      requiredPermission: auth.role === "employee" ? "can_scan" : undefined,
    });

    await pool.query(
      `UPDATE checkins
       SET status = 'failed', verified_by = ?, notes = COALESCE(?, notes)
       WHERE checkin_id = ?`,
      [auth.userId, reason ?? null, checkinId],
    );

    await logAudit(auth.userId, "FAIL_OWNER_CHECKIN", {
      checkin_id: checkinId,
      timestamp: new Date(),
    });

    res.json({ success: true, message: "Đã đánh dấu check-in thất bại" });
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

const randomTransactionCode = (bookingId: number) => {
  return `BK${bookingId}-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
};

export const createOrGetPaymentForBooking = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    const bookingId = Number(req.params.bookingId);

    if (!Number.isFinite(bookingId)) {
      res
        .status(400)
        .json({ success: false, message: "bookingId không hợp lệ" });
      return;
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [bookingRows] = await conn.query<RowDataPacket[]>(
        `SELECT b.booking_id, b.user_id, b.service_id, b.location_id, b.final_amount,
          b.created_at,
                l.owner_id, l.location_name,
                s.service_name, s.service_type
         FROM bookings b
         JOIN locations l ON l.location_id = b.location_id
         JOIN services s ON s.service_id = b.service_id
         WHERE b.booking_id = ?
         FOR UPDATE`,
        [bookingId],
      );

      if (!bookingRows[0]) {
        await conn.rollback();
        res
          .status(404)
          .json({ success: false, message: "Không tìm thấy booking" });
        return;
      }

      const booking = bookingRows[0] as any;
      const locationId = Number(booking.location_id);

      await ensureLocationAccess({
        auth,
        locationId,
        requiredPermission:
          auth.role === "employee" ? "can_manage_bookings" : undefined,
      });

      const [existingPaymentRows] = await conn.query<RowDataPacket[]>(
        `SELECT * FROM payments WHERE booking_id = ? ORDER BY payment_id DESC LIMIT 1 FOR UPDATE`,
        [bookingId],
      );

      if (existingPaymentRows[0]) {
        await conn.commit();
        res.json({ success: true, data: existingPaymentRows[0] });
        return;
      }

      const [settingsRows] = await conn.query<RowDataPacket[]>(
        `SELECT setting_key, setting_value FROM system_settings
         WHERE setting_key IN ('default_commission_rate','vat_rate')`,
      );
      const settings: Record<string, string | null> = {};
      for (const r of settingsRows)
        settings[String(r.setting_key)] = r.setting_value;

      const [ownerRows] = await conn.query<RowDataPacket[]>(
        `SELECT bank_account, bank_name, account_holder
         FROM owner_profiles WHERE owner_id = ? LIMIT 1`,
        [booking.owner_id],
      );

      const [locRateRows] = await conn.query<RowDataPacket[]>(
        `SELECT commission_rate FROM locations WHERE location_id = ? LIMIT 1`,
        [booking.location_id],
      );

      const commissionRate = Number(
        locRateRows[0]?.commission_rate ??
          settings.default_commission_rate ??
          2.5,
      );
      const vatRate = Number(settings.vat_rate ?? 10);

      const amount = Number(booking.final_amount);
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

      const tx = randomTransactionCode(bookingId);

      // qr_data: demo payload to build VietQR on client
      const locationName = String(booking.location_name || "").trim();
      const serviceOrLocationName =
        String(booking.service_name || "").trim() || locationName;

      const serviceType = String(booking.service_type || "").trim();
      const qrContent =
        serviceType === "table"
          ? locationName
            ? `${locationName} - Cảm ơn quý khách`
            : "Cảm ơn quý khách"
          : serviceOrLocationName
            ? `Checkin + dịch vụ + ${serviceOrLocationName}`
            : "Checkin";

      const qrData = {
        bank_name: ownerRows[0]?.bank_name ?? null,
        bank_account: ownerRows[0]?.bank_account ?? null,
        account_holder: ownerRows[0]?.account_holder ?? null,
        amount,
        content: qrContent,
        transaction_code: tx,
      };

      const support = await getPaymentsSchemaSupport();
      const bookingUserId = Number(booking.user_id);
      const bookingUser = await getUserSnapshotWithConn(conn, bookingUserId);
      const bookedAt = booking.created_at
        ? new Date(booking.created_at).toISOString()
        : null;

      const paymentNotes = {
        transaction_source: "online_booking",
        service_type: "booking",
        booking_id: booking.booking_id,
        location_id: booking.location_id,
        location_name: booking.location_name ?? null,
        service_id: booking.service_id ?? null,
        service_name: booking.service_name ?? null,
        booking_user: {
          user_id: bookingUserId,
          full_name: bookingUser.full_name,
          phone: bookingUser.phone,
          booked_at: bookedAt,
        },
        processed_by: {
          user_id: auth.userId,
          role: auth.role,
        },
        created_at: new Date().toISOString(),
      };

      const performedByDisplay = formatBookingActorDisplay({
        full_name: bookingUser.full_name,
        phone: bookingUser.phone,
        bookedAt,
      });

      const columns = [
        "user_id",
        "location_id",
        "booking_id",
        "amount",
        "commission_rate",
        "commission_amount",
        "vat_rate",
        "vat_amount",
        "owner_receivable",
        "payment_method",
        "transaction_code",
        "qr_data",
        "status",
        "notes",
      ];
      const values = [
        "?",
        "?",
        "?",
        "?",
        "?",
        "?",
        "?",
        "?",
        "?",
        "'VietQR'",
        "?",
        "?",
        "'pending'",
        "?",
      ];
      const params: any[] = [
        bookingUserId,
        booking.location_id,
        booking.booking_id,
        amount,
        safeCommissionRate,
        commissionAmount,
        safeVatRate,
        vatAmount,
        ownerReceivable,
        tx,
        JSON.stringify(qrData),
        JSON.stringify(paymentNotes),
      ];

      if (support.hasTransactionSource) {
        columns.splice(4, 0, "transaction_source");
        values.splice(4, 0, "?");
        params.splice(4, 0, "online_booking");
      }

      if (support.hasPerformedByUserId) {
        columns.push("performed_by_user_id");
        values.push("?");
        params.push(bookingUserId);
      }
      if (support.hasPerformedByRole) {
        columns.push("performed_by_role");
        values.push("?");
        params.push("user");
      }
      if (support.hasPerformedByName) {
        columns.push("performed_by_name");
        values.push("?");
        params.push(performedByDisplay || bookingUser.full_name || null);
      }

      const [insert] = await conn.query<ResultSetHeader>(
        `INSERT INTO payments (\n          ${columns.join(", ")}\n        ) VALUES (${values.join(", ")})`,
        params,
      );

      const [newRows] = await conn.query<RowDataPacket[]>(
        `SELECT * FROM payments WHERE payment_id = ? LIMIT 1`,
        [insert.insertId],
      );

      await logAudit(auth.userId, "CREATE_OWNER_PAYMENT", {
        payment_id: insert.insertId,
        booking_id: bookingId,
        amount,
        timestamp: new Date(),
      });

      await conn.commit();
      res.status(201).json({ success: true, data: newRows[0] || null });
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
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const getOwnerPayments = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    const { status } = req.query as { status?: string };

    const params: any[] = [];
    let sql = `
      SELECT
        p.*, 
        l.location_name,
        l.owner_id,
        b.status as booking_status,
        u.full_name as user_full_name,
        u.phone as user_phone,
        bu.full_name as booked_full_name,
        bu.phone as booked_phone,
        s.service_name as booking_service_name,
        s.service_type as booking_service_type,
        b.check_in_date as booking_check_in_date,
        b.check_out_date as booking_check_out_date,
        b.final_amount as booking_final_amount
      FROM payments p
      JOIN locations l ON l.location_id = p.location_id
      LEFT JOIN bookings b ON b.booking_id = p.booking_id
      LEFT JOIN users u ON u.user_id = p.user_id
      LEFT JOIN users bu ON bu.user_id = b.user_id
      LEFT JOIN services s ON s.service_id = b.service_id
      WHERE 1=1
    `;

    if (auth.role === "owner") {
      sql += ` AND l.owner_id = ?`;
      params.push(auth.userId);
    } else {
      const ownerId = await getOwnerIdForEmployee(auth.userId);
      sql += ` AND EXISTS (
        SELECT 1 FROM employee_locations el
        WHERE el.employee_id = ? AND el.owner_id = ? AND el.location_id = p.location_id AND el.status = 'active'
      )`;
      params.push(auth.userId, ownerId);
    }

    if (status) {
      sql += ` AND p.status = ?`;
      params.push(status);
    }

    sql += ` ORDER BY p.payment_time DESC LIMIT 200`;

    const [rows] = await pool.query<RowDataPacket[]>(sql, params);
    res.json({ success: true, data: rows });
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const markOwnerPaymentCompleted = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    const paymentId = Number(req.params.id);

    if (!Number.isFinite(paymentId)) {
      res
        .status(400)
        .json({ success: false, message: "paymentId không hợp lệ" });
      return;
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT p.payment_id, p.location_id
       FROM payments p
       WHERE p.payment_id = ?
       LIMIT 1`,
      [paymentId],
    );

    if (!rows[0]) {
      res
        .status(404)
        .json({ success: false, message: "Không tìm thấy payment" });
      return;
    }

    const locationId = Number(rows[0].location_id);
    await ensureLocationAccess({
      auth,
      locationId,
      requiredPermission:
        auth.role === "employee" ? "can_manage_bookings" : undefined,
    });

    await pool.query(
      `UPDATE payments SET status = 'completed' WHERE payment_id = ?`,
      [paymentId],
    );

    await logAudit(auth.userId, "OWNER_MARK_PAYMENT_COMPLETED", {
      payment_id: paymentId,
      timestamp: new Date(),
    });

    res.json({ success: true, message: "Đã cập nhật payment completed" });
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const getOwnerCommissions = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    if (auth.role !== "owner") {
      res.status(403).json({ success: false, message: "Chỉ owner được phép" });
      return;
    }

    const { status } = req.query as { status?: string };

    const params: any[] = [auth.userId];
    let sql = `
      SELECT c.*, p.amount as payment_amount, p.status as payment_status, l.location_name
      FROM commissions c
      LEFT JOIN payments p ON p.payment_id = c.payment_id
      LEFT JOIN locations l ON l.location_id = p.location_id
      WHERE c.owner_id = ?
    `;

    if (status) {
      sql += ` AND c.status = ?`;
      params.push(status);
    }

    sql += ` ORDER BY c.created_at DESC LIMIT 200`;

    const [rows] = await pool.query<RowDataPacket[]>(sql, params);
    res.json({ success: true, data: rows });
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const getOwnerVouchers = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    if (auth.role !== "owner") {
      res.status(403).json({ success: false, message: "Chỉ owner được phép" });
      return;
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT v.*, l.location_name,
              COALESCE(l.location_name, 'Tất cả') as location_name,
              CASE WHEN v.end_date < NOW() THEN 'expired' ELSE v.status END as computed_status
       FROM vouchers v
       LEFT JOIN locations l ON l.location_id = v.location_id
       WHERE v.owner_id = ?
         AND v.owner_deleted_at IS NULL
       ORDER BY v.created_at DESC`,
      [auth.userId],
    );

    res.json({ success: true, data: rows });
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const createOwnerVoucher = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    if (auth.role !== "owner") {
      res.status(403).json({ success: false, message: "Chỉ owner được phép" });
      return;
    }

    const body = req.body as any;

    // Require explicit selection: either a specific location_id or "all" (null)
    if (!("location_id" in body)) {
      res.status(400).json({
        success: false,
        message: "Vui lòng chọn Địa điểm áp dụng (hoặc 'Tất cả')",
      });
      return;
    }

    const code = String(body.code || "").trim();
    if (!code) {
      res.status(400).json({ success: false, message: "Thiếu code" });
      return;
    }

    const rawLocation = body.location_id;
    const locationId =
      rawLocation === "all" || rawLocation === null || rawLocation === ""
        ? null
        : Number(rawLocation);
    if (locationId != null && !Number.isFinite(locationId)) {
      res
        .status(400)
        .json({ success: false, message: "location_id không hợp lệ" });
      return;
    }

    if (locationId != null) {
      const [locRows] = await pool.query<RowDataPacket[]>(
        `SELECT location_id FROM locations WHERE location_id = ? AND owner_id = ? LIMIT 1`,
        [locationId, auth.userId],
      );
      if (!locRows[0]) {
        res
          .status(403)
          .json({ success: false, message: "Địa điểm không thuộc owner" });
        return;
      }
    }

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO vouchers (
        owner_id, location_id, code, campaign_name, campaign_description,
        discount_type, discount_value, apply_to_service_type, apply_to_location_type,
        min_order_value, max_discount_amount, start_date, end_date,
        usage_limit, max_uses_per_user, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'inactive')`,
      [
        auth.userId,
        locationId,
        code,
        body.campaign_name ?? null,
        body.campaign_description ?? null,
        body.discount_type,
        body.discount_value,
        body.apply_to_service_type ?? "all",
        body.apply_to_location_type ?? "all",
        body.min_order_value ?? 0,
        body.max_discount_amount ?? null,
        body.start_date,
        body.end_date,
        body.usage_limit ?? 100,
        body.max_uses_per_user ?? 1,
      ],
    );

    // Track approval state for admin (pending by default).
    try {
      await pool.query(
        `INSERT INTO voucher_reviews (voucher_id, approval_status)
         VALUES (?, 'pending')
         ON DUPLICATE KEY UPDATE approval_status = VALUES(approval_status)`,
        [result.insertId],
      );
    } catch (e: any) {
      // Backward-compatible: ignore if voucher_reviews table doesn't exist.
      if (
        !(
          e?.code === "ER_NO_SUCH_TABLE" &&
          String(e?.message || "").includes("voucher_reviews")
        )
      ) {
        throw e;
      }
    }

    await logAudit(auth.userId, "CREATE_OWNER_VOUCHER", {
      voucher_id: result.insertId,
      code,
      location_id: locationId,
      timestamp: new Date(),
    });

    res.status(201).json({
      success: true,
      message: "Tạo voucher thành công (đang chờ admin duyệt)",
      data: { voucher_id: result.insertId },
    });
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const updateOwnerVoucher = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    if (auth.role !== "owner") {
      res.status(403).json({ success: false, message: "Chỉ owner được phép" });
      return;
    }

    const voucherId = Number(req.params.id);
    if (!Number.isFinite(voucherId)) {
      res
        .status(400)
        .json({ success: false, message: "voucherId không hợp lệ" });
      return;
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT voucher_id, status FROM vouchers WHERE voucher_id = ? AND owner_id = ? AND owner_deleted_at IS NULL LIMIT 1`,
      [voucherId, auth.userId],
    );

    if (!rows[0]) {
      res
        .status(404)
        .json({ success: false, message: "Không tìm thấy voucher" });
      return;
    }

    const curStatus = String(rows[0].status);

    const body = req.body as any;
    const updates: string[] = [];
    const params: any[] = [];

    const up = (field: string, value: any) => {
      if (value === undefined) return;
      updates.push(`${field} = ?`);
      params.push(value);
    };

    // Nếu voucher đang active mà sửa => set inactive để chờ duyệt lại
    const willChangeCore =
      "discount_type" in body ||
      "discount_value" in body ||
      "apply_to_service_type" in body ||
      "apply_to_location_type" in body ||
      "min_order_value" in body ||
      "max_discount_amount" in body ||
      "start_date" in body ||
      "end_date" in body;

    up("campaign_name", body.campaign_name);
    up("campaign_description", body.campaign_description);
    up("discount_type", body.discount_type);
    up("discount_value", body.discount_value);
    up("apply_to_service_type", body.apply_to_service_type);
    up("apply_to_location_type", body.apply_to_location_type);
    up("min_order_value", body.min_order_value);
    up("max_discount_amount", body.max_discount_amount);
    up("start_date", body.start_date);
    up("end_date", body.end_date);
    up("usage_limit", body.usage_limit);
    up("max_uses_per_user", body.max_uses_per_user);

    if (updates.length === 0) {
      res
        .status(400)
        .json({ success: false, message: "Không có dữ liệu cập nhật" });
      return;
    }

    if (curStatus === "active" && willChangeCore) {
      updates.push(`status = 'inactive'`);
    }

    params.push(voucherId, auth.userId);

    await pool.query(
      `UPDATE vouchers SET ${updates.join(", ")} WHERE voucher_id = ? AND owner_id = ?`,
      params,
    );

    // If core fields changed, force re-approval.
    if (willChangeCore) {
      try {
        await pool.query(
          `INSERT INTO voucher_reviews (voucher_id, approval_status, rejection_reason, reviewed_by, reviewed_at)
           VALUES (?, 'pending', NULL, NULL, NULL)
           ON DUPLICATE KEY UPDATE
             approval_status = 'pending',
             rejection_reason = NULL,
             reviewed_by = NULL,
             reviewed_at = NULL`,
          [voucherId],
        );
      } catch (e: any) {
        if (
          !(
            e?.code === "ER_NO_SUCH_TABLE" &&
            String(e?.message || "").includes("voucher_reviews")
          )
        ) {
          throw e;
        }
      }
    }

    await logAudit(auth.userId, "UPDATE_OWNER_VOUCHER", {
      voucher_id: voucherId,
      timestamp: new Date(),
    });

    res.json({
      success: true,
      message:
        curStatus === "active" && willChangeCore
          ? "Cập nhật voucher thành công (đang chờ duyệt lại)"
          : "Cập nhật voucher thành công",
    });
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const deleteOwnerVoucher = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    if (auth.role !== "owner") {
      res.status(403).json({ success: false, message: "Chỉ owner được phép" });
      return;
    }

    const voucherId = Number(req.params.id);
    if (!Number.isFinite(voucherId)) {
      res
        .status(400)
        .json({ success: false, message: "voucherId không hợp lệ" });
      return;
    }

    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE vouchers
       SET owner_deleted_at = NOW()
       WHERE voucher_id = ? AND owner_id = ? AND owner_deleted_at IS NULL`,
      [voucherId, auth.userId],
    );

    if (result.affectedRows === 0) {
      res
        .status(404)
        .json({ success: false, message: "Không tìm thấy voucher" });
      return;
    }

    await logAudit(auth.userId, "DELETE_OWNER_VOUCHER", {
      voucher_id: voucherId,
      timestamp: new Date(),
    });

    res.json({ success: true, message: "Đã xóa voucher" });
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const getOwnerVoucherUsageHistory = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    if (auth.role !== "owner") {
      res.status(403).json({ success: false, message: "Chỉ owner được phép" });
      return;
    }

    const voucherId = Number(req.params.id);
    if (!Number.isFinite(voucherId)) {
      res
        .status(400)
        .json({ success: false, message: "voucherId không hợp lệ" });
      return;
    }

    const page = Number((req.query as any)?.page ?? 1);
    const limit = Math.min(
      200,
      Math.max(1, Number((req.query as any)?.limit ?? 50)),
    );
    const safePage = Number.isFinite(page) && page > 0 ? page : 1;
    const offset = (safePage - 1) * limit;

    const [voucherRows] = await pool.query<RowDataPacket[]>(
      `SELECT voucher_id FROM vouchers WHERE voucher_id = ? AND owner_id = ? LIMIT 1`,
      [voucherId, auth.userId],
    );
    if (!voucherRows[0]) {
      res
        .status(404)
        .json({ success: false, message: "Không tìm thấy voucher" });
      return;
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
         usage_id,
         voucher_id,
         voucher_code,
         user_id,
         user_full_name,
         user_email,
         used_at,
         booking_id,
         location_id,
         total_amount,
         discount_amount,
         final_amount,
         source
       FROM voucher_usage_history
       WHERE voucher_id = ?
       ORDER BY used_at DESC
       LIMIT ? OFFSET ?`,
      [voucherId, limit, offset],
    );

    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM voucher_usage_history WHERE voucher_id = ?`,
      [voucherId],
    );

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: Number(countRows?.[0]?.total ?? 0),
        page: safePage,
        limit,
      },
    });
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const getOwnerReviews = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);

    const { location_id } = req.query as { location_id?: string };
    const params: any[] = [];

    let sql = `
      SELECT
        r.*, u.full_name as user_name, u.avatar_url as user_avatar,
        l.location_name,
        rr.reply_id, rr.content as reply_content, rr.created_at as reply_created_at,
        rr.created_by as reply_created_by
      FROM reviews r
      JOIN users u ON u.user_id = r.user_id
      JOIN locations l ON l.location_id = r.location_id
      LEFT JOIN review_replies rr ON rr.review_id = r.review_id
      WHERE 1=1
    `;

    if (auth.role === "owner") {
      sql += ` AND l.owner_id = ?`;
      params.push(auth.userId);
    } else {
      const ownerId = await getOwnerIdForEmployee(auth.userId);
      sql += ` AND EXISTS (
        SELECT 1 FROM employee_locations el
        WHERE el.employee_id = ? AND el.owner_id = ? AND el.location_id = r.location_id AND el.status = 'active'
      )`;
      params.push(auth.userId, ownerId);
    }

    if (location_id && Number.isFinite(Number(location_id))) {
      sql += ` AND r.location_id = ?`;
      params.push(Number(location_id));
    }

    sql += ` ORDER BY r.created_at DESC LIMIT 200`;

    const [rows] = await pool.query<RowDataPacket[]>(sql, params);
    res.json({ success: true, data: rows });
  } catch (error: any) {
    const msg =
      error?.code === "ER_NO_SUCH_TABLE"
        ? "Thiếu bảng review_replies. Vui lòng chạy migration owner_extensions.sql"
        : error?.message || "Lỗi server";

    res.status(error?.statusCode || 500).json({ success: false, message: msg });
  }
};

export const replyToReview = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    const reviewId = Number(req.params.id);

    const { content } = req.body as { content?: string };
    if (
      !Number.isFinite(reviewId) ||
      typeof content !== "string" ||
      !content.trim()
    ) {
      res.status(400).json({ success: false, message: "Dữ liệu không hợp lệ" });
      return;
    }

    // Validate owner access through location
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT r.location_id
       FROM reviews r
       JOIN locations l ON l.location_id = r.location_id
       WHERE r.review_id = ?
       AND (
         ( ? = 'owner' AND l.owner_id = ? )
         OR
         ( ? = 'employee' AND EXISTS (
            SELECT 1 FROM employee_locations el
            WHERE el.employee_id = ? AND el.location_id = r.location_id AND el.status = 'active'
         ))
       )
       LIMIT 1`,
      [reviewId, auth.role, auth.userId, auth.role, auth.userId],
    );

    if (!rows[0]) {
      res.status(403).json({ success: false, message: "Không có quyền" });
      return;
    }

    await pool.query(
      `INSERT INTO review_replies (review_id, content, created_by)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         content = VALUES(content),
         created_by = VALUES(created_by),
         updated_at = NOW()`,
      [reviewId, content.trim(), auth.userId],
    );

    await logAudit(auth.userId, "REPLY_REVIEW", {
      review_id: reviewId,
      timestamp: new Date(),
    });

    res.status(201).json({ success: true, message: "Đã phản hồi đánh giá" });
  } catch (error: any) {
    const msg =
      error?.code === "ER_NO_SUCH_TABLE"
        ? "Thiếu bảng review_replies. Vui lòng chạy migration owner_extensions.sql"
        : error?.message || "Lỗi server";

    res.status(error?.statusCode || 500).json({ success: false, message: msg });
  }
};

export const hideReview = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    const reviewId = Number(req.params.id);
    const { hidden } = req.body as { hidden?: boolean };

    if (!Number.isFinite(reviewId) || typeof hidden !== "boolean") {
      res.status(400).json({ success: false, message: "Dữ liệu không hợp lệ" });
      return;
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT r.review_id
              ,r.location_id
       FROM reviews r
       JOIN locations l ON l.location_id = r.location_id
       WHERE r.review_id = ?
       AND (
         ( ? = 'owner' AND l.owner_id = ? )
         OR
         ( ? = 'employee' AND EXISTS (
            SELECT 1 FROM employee_locations el
            WHERE el.employee_id = ? AND el.location_id = r.location_id AND el.status = 'active'
         ))
       )
       LIMIT 1`,
      [reviewId, auth.role, auth.userId, auth.role, auth.userId],
    );

    if (!rows[0]) {
      res.status(403).json({ success: false, message: "Không có quyền" });
      return;
    }

    await pool.query(
      `UPDATE reviews
       SET status = ?, hidden_by = ?, updated_at = NOW()
       WHERE review_id = ?`,
      [hidden ? "hidden" : "active", hidden ? auth.userId : null, reviewId],
    );

    await recalcLocationRatingFromReviews(Number(rows[0].location_id));

    await logAudit(auth.userId, "HIDE_REVIEW", {
      review_id: reviewId,
      hidden,
      timestamp: new Date(),
    });

    res.json({
      success: true,
      message: "Cập nhật trạng thái review thành công",
    });
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const deleteOwnerReview = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    const reviewId = Number(req.params.id);

    if (!Number.isFinite(reviewId)) {
      res.status(400).json({ success: false, message: "Review không hợp lệ" });
      return;
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT r.review_id, r.location_id
       FROM reviews r
       JOIN locations l ON l.location_id = r.location_id
       WHERE r.review_id = ?
       AND (
         ( ? = 'owner' AND l.owner_id = ? )
         OR
         ( ? = 'employee' AND EXISTS (
            SELECT 1 FROM employee_locations el
            WHERE el.employee_id = ? AND el.location_id = r.location_id AND el.status = 'active'
         ))
       )
       LIMIT 1`,
      [reviewId, auth.role, auth.userId, auth.role, auth.userId],
    );

    const target = rows[0];
    if (!target) {
      res.status(403).json({ success: false, message: "Không có quyền" });
      return;
    }

    await pool.query(
      `UPDATE reviews
       SET status = 'deleted', deleted_at = NOW(), deleted_by = ?
       WHERE review_id = ?`,
      [auth.userId, reviewId],
    );

    await recalcLocationRatingFromReviews(Number(target.location_id));

    await logAudit(auth.userId, "OWNER_DELETE_REVIEW", {
      review_id: reviewId,
      location_id: Number(target.location_id),
      timestamp: new Date(),
    });

    res.json({ success: true, message: "Đã xóa đánh giá" });
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const reportReviewUserByOwner = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    const reviewId = Number(req.params.id);
    const reason = String((req.body as { reason?: string })?.reason || "")
      .trim()
      .slice(0, 2000);

    if (!Number.isFinite(reviewId)) {
      res.status(400).json({ success: false, message: "Review không hợp lệ" });
      return;
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT r.review_id, r.user_id, r.location_id, r.comment, l.location_name
       FROM reviews r
       JOIN locations l ON l.location_id = r.location_id
       WHERE r.review_id = ?
       AND (
         ( ? = 'owner' AND l.owner_id = ? )
         OR
         ( ? = 'employee' AND EXISTS (
            SELECT 1 FROM employee_locations el
            WHERE el.employee_id = ? AND el.location_id = r.location_id AND el.status = 'active'
         ))
       )
       LIMIT 1`,
      [reviewId, auth.role, auth.userId, auth.role, auth.userId],
    );

    const target = rows[0];
    if (!target) {
      res.status(403).json({ success: false, message: "Không có quyền" });
      return;
    }

    const description = [
      "Owner báo cáo review có dấu hiệu ngôn từ thô tục.",
      `Review ID: ${reviewId}`,
      `Địa điểm: ${String(target.location_name || "-")}`,
      `Nội dung review: ${String(target.comment || "(trống)")}`,
      reason ? `Lý do bổ sung: ${reason}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    await pool.query<ResultSetHeader>(
      `INSERT INTO reports
       (reporter_id, reported_user_id, reported_location_id, reported_review_id, report_type, severity, description)
       VALUES (?, ?, ?, ?, 'inappropriate', 'high', ?)`,
      [
        auth.userId,
        Number(target.user_id),
        Number(target.location_id),
        reviewId,
        description,
      ],
    );

    await logAudit(auth.userId, "OWNER_REPORT_REVIEW_USER", {
      review_id: reviewId,
      reported_user_id: Number(target.user_id),
      location_id: Number(target.location_id),
      timestamp: new Date(),
    });

    res
      .status(201)
      .json({ success: true, message: "Đã gửi báo cáo tới admin" });
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const getOwnerNotifications = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);

    await ensureOwnerNotificationReadsSchema();
    await ensureOwnerNotificationDismissedSchema();

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
         pn.notification_id,
         pn.title,
         pn.body,
         pn.target_audience,
         pn.target_user_id,
         pn.created_at,
         nr.read_at,
         CASE WHEN nr.read_at IS NULL THEN 0 ELSE 1 END AS is_read
       FROM push_notifications pn
       LEFT JOIN owner_notification_reads nr
         ON nr.notification_id = pn.notification_id
        AND nr.owner_user_id = ?
       LEFT JOIN owner_notification_dismissed nd
         ON nd.notification_id = pn.notification_id
        AND nd.owner_user_id = ?
       WHERE (
         pn.target_audience = 'all_owners'
         OR (pn.target_audience = 'specific_user' AND pn.target_user_id = ?)
       )
         AND nd.notification_id IS NULL
       ORDER BY pn.created_at DESC
       LIMIT 30`,
      [auth.userId, auth.userId, auth.userId],
    );

    res.json({ success: true, data: rows });
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const markOwnerNotificationsReadAll = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);

    await ensureOwnerNotificationReadsSchema();
    await ensureOwnerNotificationDismissedSchema();

    await pool.query(
      `INSERT INTO owner_notification_reads (notification_id, owner_user_id, read_at)
       SELECT pn.notification_id, ?, NOW()
       FROM push_notifications pn
       LEFT JOIN owner_notification_reads nr
         ON nr.notification_id = pn.notification_id
        AND nr.owner_user_id = ?
       LEFT JOIN owner_notification_dismissed nd
         ON nd.notification_id = pn.notification_id
        AND nd.owner_user_id = ?
       WHERE (
         pn.target_audience = 'all_owners'
         OR (pn.target_audience = 'specific_user' AND pn.target_user_id = ?)
       )
         AND nr.notification_id IS NULL
         AND nd.notification_id IS NULL`,
      [auth.userId, auth.userId, auth.userId, auth.userId],
    );

    res.json({ success: true, message: "Đã đánh dấu đã đọc" });
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const deleteOwnerNotificationsAll = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);

    await ensureOwnerNotificationReadsSchema();
    await ensureOwnerNotificationDismissedSchema();

    await pool.query(
      `INSERT INTO owner_notification_dismissed (notification_id, owner_user_id, dismissed_at)
       SELECT pn.notification_id, ?, NOW()
       FROM push_notifications pn
       LEFT JOIN owner_notification_dismissed nd
         ON nd.notification_id = pn.notification_id
        AND nd.owner_user_id = ?
       WHERE (
         pn.target_audience = 'all_owners'
         OR (pn.target_audience = 'specific_user' AND pn.target_user_id = ?)
       )
         AND nd.notification_id IS NULL`,
      [auth.userId, auth.userId, auth.userId],
    );

    await pool.query(
      `DELETE onr
       FROM owner_notification_reads onr
       JOIN owner_notification_dismissed ond
         ON ond.notification_id = onr.notification_id
        AND ond.owner_user_id = onr.owner_user_id
       WHERE onr.owner_user_id = ?`,
      [auth.userId],
    );

    res.json({ success: true, message: "Đã xóa toàn bộ thông báo" });
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const getOwnerEmployees = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    if (auth.role !== "owner") {
      res.status(403).json({ success: false, message: "Chỉ owner được phép" });
      return;
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT u.user_id, u.email, u.phone, u.full_name, u.status, u.created_at,
              a.location_id, l.location_name, a.position
       FROM (
         SELECT DISTINCT el0.employee_id
         FROM employee_locations el0
         WHERE el0.owner_id = ?
       ) e
       JOIN users u ON u.user_id = e.employee_id
       LEFT JOIN (
         SELECT el1.employee_id, el1.location_id, el1.position
         FROM employee_locations el1
         JOIN (
           SELECT employee_id, MAX(assigned_at) AS max_assigned
           FROM employee_locations
           WHERE owner_id = ? AND status = 'active'
           GROUP BY employee_id
         ) m ON m.employee_id = el1.employee_id AND m.max_assigned = el1.assigned_at
         WHERE el1.owner_id = ? AND el1.status = 'active'
       ) a ON a.employee_id = u.user_id
       LEFT JOIN locations l ON l.location_id = a.location_id
       WHERE u.role = 'employee' AND u.deleted_at IS NULL
       ORDER BY u.created_at DESC`,
      [auth.userId, auth.userId, auth.userId],
    );

    res.json({ success: true, data: rows });
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const getOwnerEmployeeDetail = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    if (auth.role !== "owner") {
      res.status(403).json({ success: false, message: "Chỉ owner được phép" });
      return;
    }

    const employeeId = Number(req.params.id);
    if (!Number.isFinite(employeeId)) {
      res
        .status(400)
        .json({ success: false, message: "employeeId không hợp lệ" });
      return;
    }

    const [userRows] = await pool.query<RowDataPacket[]>(
      `SELECT user_id, email, phone, full_name, status, created_at
       FROM users
       WHERE user_id = ? AND role = 'employee'
       LIMIT 1`,
      [employeeId],
    );

    if (!userRows[0]) {
      res
        .status(404)
        .json({ success: false, message: "Không tìm thấy nhân viên" });
      return;
    }

    const [assignRows] = await pool.query<RowDataPacket[]>(
      `SELECT el.*, l.location_name
       FROM employee_locations el
       JOIN locations l ON l.location_id = el.location_id
       WHERE el.owner_id = ? AND el.employee_id = ?
       ORDER BY el.assigned_at DESC`,
      [auth.userId, employeeId],
    );

    res.json({
      success: true,
      data: { employee: userRows[0], assignments: assignRows },
    });
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const createOwnerEmployee = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    if (auth.role !== "owner") {
      res.status(403).json({ success: false, message: "Chỉ owner được phép" });
      return;
    }

    const body = req.body as any;

    // Owner must have at least one location before creating employees
    const [ownerLocRows] = await pool.query<RowDataPacket[]>(
      `SELECT location_id FROM locations WHERE owner_id = ? LIMIT 1`,
      [auth.userId],
    );
    if (!ownerLocRows[0]) {
      res.status(400).json({
        success: false,
        message:
          "Bạn chưa có địa điểm. Vui lòng tạo địa điểm trước khi tạo nhân viên.",
      });
      return;
    }

    const full_name = String(body.full_name || "").trim();
    const email = body.email != null ? String(body.email).trim() : null;
    const phone = body.phone != null ? String(body.phone).trim() : null;

    const location_id_raw =
      body.location_id ??
      (Array.isArray(body.location_ids) ? body.location_ids[0] : undefined);
    const location_id =
      location_id_raw == null ? null : Number(String(location_id_raw));

    const location_ids: number[] =
      location_id != null && Number.isFinite(location_id) ? [location_id] : [];

    const position =
      typeof body.position === "string" && body.position.trim()
        ? body.position.trim()
        : null;

    // App rule: permissions are not user-editable from UI
    const permissions = {
      can_scan: true,
      can_manage_bookings: true,
      can_manage_services: true,
    };

    const password =
      typeof body.password === "string" ? String(body.password).trim() : "";

    if (!full_name) {
      res.status(400).json({ success: false, message: "Thiếu full_name" });
      return;
    }

    if (!password || password.length < 6) {
      res.status(400).json({
        success: false,
        message: "Mật khẩu phải có ít nhất 6 ký tự",
      });
      return;
    }

    if (location_ids.length !== 1) {
      res.status(400).json({
        success: false,
        message: "Cần chọn đúng 1 địa điểm cho nhân viên",
      });
      return;
    }

    const [locRows] = await pool.query<RowDataPacket[]>(
      `SELECT location_id, location_type
       FROM locations
       WHERE owner_id = ? AND location_id = ?
       LIMIT 1`,
      [auth.userId, location_ids[0]],
    );

    if (!locRows[0]) {
      res.status(400).json({
        success: false,
        message: "Địa điểm không thuộc owner hoặc không tồn tại",
      });
      return;
    }

    const locationType = String(locRows[0].location_type || "").toLowerCase();
    const allowedPositionsByType: Record<string, string[]> = {
      hotel: ["Lễ tân", "Buồng phòng"],
      resort: ["Lễ tân", "Buồng phòng"],
      restaurant: ["Thu ngân", "Phục vụ"],
      cafe: ["Thu ngân", "Phục vụ"],
      tourist: ["Soát vé", "Hướng dẫn"],
    };

    const allowedPositions = allowedPositionsByType[locationType] ?? [
      "Thu ngân",
      "Phục vụ",
    ];

    if (!position || !allowedPositions.includes(position)) {
      res.status(400).json({
        success: false,
        message: `Vui lòng chọn Chức vụ hợp lệ (${allowedPositions.join(", ")})`,
      });
      return;
    }

    const hash = await bcrypt.hash(password, 10);

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [insertUser] = await conn.query<ResultSetHeader>(
        `INSERT INTO users (email, phone, password_hash, full_name, role, status, is_verified)
         VALUES (?, ?, ?, ?, 'employee', 'active', 1)`,
        [email, phone, hash, full_name],
      );

      const employeeId = insertUser.insertId;

      for (const locationId of location_ids) {
        await conn.query(
          `INSERT INTO employee_locations (employee_id, location_id, owner_id, permissions, position, status)
           VALUES (?, ?, ?, ?, ?, 'active')
           ON DUPLICATE KEY UPDATE
             owner_id = VALUES(owner_id),
             permissions = VALUES(permissions),
             position = VALUES(position),
             status = 'active'`,
          [
            employeeId,
            locationId,
            auth.userId,
            JSON.stringify(permissions),
            position,
          ],
        );
      }

      await conn.commit();

      await logAudit(auth.userId, "CREATE_OWNER_EMPLOYEE", {
        employee_id: employeeId,
        location_ids,
        timestamp: new Date(),
      });

      res.status(201).json({
        success: true,
        message: "Tạo nhân viên thành công",
        data: { employee_id: employeeId },
      });
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
  } catch (error: any) {
    const msg =
      error?.code === "ER_DUP_ENTRY"
        ? "Email đã tồn tại"
        : error?.message || "Lỗi server";

    res.status(error?.statusCode || 500).json({ success: false, message: msg });
  }
};

export const updateOwnerEmployeeAssignments = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    if (auth.role !== "owner") {
      res.status(403).json({ success: false, message: "Chỉ owner được phép" });
      return;
    }

    const employeeId = Number(req.params.id);
    if (!Number.isFinite(employeeId)) {
      res
        .status(400)
        .json({ success: false, message: "employeeId không hợp lệ" });
      return;
    }

    const body = req.body as any;
    const location_id_raw =
      body.location_id ??
      (Array.isArray(body.location_ids) ? body.location_ids[0] : undefined);
    const locationId =
      location_id_raw == null ? null : Number(String(location_id_raw));

    const position =
      typeof body.position === "string" && body.position.trim()
        ? body.position.trim()
        : null;

    if (locationId == null || !Number.isFinite(locationId)) {
      res
        .status(400)
        .json({ success: false, message: "Cần chọn đúng 1 địa điểm" });
      return;
    }

    const [locRows] = await pool.query<RowDataPacket[]>(
      `SELECT location_id, location_type
       FROM locations
       WHERE owner_id = ? AND location_id = ?
       LIMIT 1`,
      [auth.userId, locationId],
    );

    if (!locRows[0]) {
      res
        .status(400)
        .json({ success: false, message: "Địa điểm không hợp lệ" });
      return;
    }

    const locationType = String(locRows[0].location_type || "").toLowerCase();
    const allowedPositionsByType: Record<string, string[]> = {
      hotel: ["Lễ tân", "Buồng phòng"],
      resort: ["Lễ tân", "Buồng phòng"],
      restaurant: ["Thu ngân", "Phục vụ"],
      cafe: ["Thu ngân", "Phục vụ"],
      tourist: ["Soát vé", "Hướng dẫn"],
    };

    const allowedPositions = allowedPositionsByType[locationType] ?? [
      "Thu ngân",
      "Phục vụ",
    ];

    if (!position || !allowedPositions.includes(position)) {
      res.status(400).json({
        success: false,
        message: `Vui lòng chọn Chức vụ hợp lệ (${allowedPositions.join(", ")})`,
      });
      return;
    }

    const permissions = {
      can_scan: true,
      can_manage_bookings: true,
      can_manage_services: true,
    };

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Deactivate all old assignments
      await conn.query(
        `UPDATE employee_locations
         SET status = 'inactive'
         WHERE owner_id = ? AND employee_id = ?`,
        [auth.userId, employeeId],
      );

      await conn.query(
        `INSERT INTO employee_locations (employee_id, location_id, owner_id, permissions, position, status)
         VALUES (?, ?, ?, ?, ?, 'active')
         ON DUPLICATE KEY UPDATE
           owner_id = VALUES(owner_id),
           permissions = VALUES(permissions),
           position = VALUES(position),
           status = 'active'`,
        [
          employeeId,
          locationId,
          auth.userId,
          JSON.stringify(permissions),
          position,
        ],
      );

      await conn.commit();

      await logAudit(auth.userId, "UPDATE_OWNER_EMPLOYEE_ASSIGNMENTS", {
        employee_id: employeeId,
        location_id: locationId,
        position,
        timestamp: new Date(),
      });

      res.json({ success: true, message: "Cập nhật nhân viên thành công" });
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
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const updateOwnerEmployee = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    if (auth.role !== "owner") {
      res.status(403).json({ success: false, message: "Chỉ owner được phép" });
      return;
    }

    const employeeId = Number(req.params.id);
    if (!Number.isFinite(employeeId)) {
      res
        .status(400)
        .json({ success: false, message: "employeeId không hợp lệ" });
      return;
    }

    const body = req.body as any;
    const full_name = String(body.full_name || "").trim();
    const email = body.email != null ? String(body.email).trim() : null;
    const phone = body.phone != null ? String(body.phone).trim() : null;
    const passwordInput =
      body.password != null ? String(body.password).trim() : "";
    const PASSWORD_MASK = "********";

    const locationId = Number(body.location_id);
    const position =
      typeof body.position === "string" && body.position.trim()
        ? body.position.trim()
        : null;

    if (!full_name) {
      res.status(400).json({ success: false, message: "Thiếu full_name" });
      return;
    }
    if (!Number.isFinite(locationId)) {
      res
        .status(400)
        .json({ success: false, message: "Cần chọn đúng 1 địa điểm" });
      return;
    }

    // Ownership check: employee must belong to this owner
    const [ownRows] = await pool.query<RowDataPacket[]>(
      `SELECT 1 FROM employee_locations WHERE owner_id = ? AND employee_id = ? LIMIT 1`,
      [auth.userId, employeeId],
    );
    if (!ownRows[0]) {
      res.status(403).json({ success: false, message: "Không có quyền" });
      return;
    }

    const [locRows] = await pool.query<RowDataPacket[]>(
      `SELECT location_id, location_type
       FROM locations
       WHERE owner_id = ? AND location_id = ?
       LIMIT 1`,
      [auth.userId, locationId],
    );
    if (!locRows[0]) {
      res
        .status(400)
        .json({ success: false, message: "Địa điểm không hợp lệ" });
      return;
    }

    const locationType = String(locRows[0].location_type || "").toLowerCase();
    const allowedPositionsByType: Record<string, string[]> = {
      hotel: ["Lễ tân", "Buồng phòng"],
      resort: ["Lễ tân", "Buồng phòng"],
      restaurant: ["Thu ngân", "Phục vụ"],
      cafe: ["Thu ngân", "Phục vụ"],
      tourist: ["Soát vé", "Hướng dẫn"],
    };

    const allowedPositions = allowedPositionsByType[locationType] ?? [
      "Thu ngân",
      "Phục vụ",
    ];

    if (!position || !allowedPositions.includes(position)) {
      res.status(400).json({
        success: false,
        message: `Vui lòng chọn Chức vụ hợp lệ (${allowedPositions.join(", ")})`,
      });
      return;
    }

    const permissions = {
      can_scan: true,
      can_manage_bookings: true,
      can_manage_services: true,
    };

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      if (
        passwordInput &&
        passwordInput !== PASSWORD_MASK &&
        passwordInput.length < 6
      ) {
        await conn.rollback();
        res.status(400).json({
          success: false,
          message: "Mật khẩu phải có ít nhất 6 ký tự",
        });
        return;
      }

      if (passwordInput && passwordInput !== PASSWORD_MASK) {
        const hash = await bcrypt.hash(passwordInput, 10);
        await conn.query(
          `UPDATE users
           SET password_hash = ?, updated_at = NOW()
           WHERE user_id = ? AND role = 'employee' AND deleted_at IS NULL`,
          [hash, employeeId],
        );
      }

      await conn.query(
        `UPDATE users
         SET full_name = ?, email = ?, phone = ?, updated_at = NOW()
         WHERE user_id = ? AND role = 'employee' AND deleted_at IS NULL`,
        [full_name, email, phone, employeeId],
      );

      // Deactivate all old assignments
      await conn.query(
        `UPDATE employee_locations
         SET status = 'inactive'
         WHERE owner_id = ? AND employee_id = ?`,
        [auth.userId, employeeId],
      );

      await conn.query(
        `INSERT INTO employee_locations (employee_id, location_id, owner_id, permissions, position, status)
         VALUES (?, ?, ?, ?, ?, 'active')
         ON DUPLICATE KEY UPDATE
           owner_id = VALUES(owner_id),
           permissions = VALUES(permissions),
           position = VALUES(position),
           status = 'active',
           assigned_at = NOW()`,
        [
          employeeId,
          locationId,
          auth.userId,
          JSON.stringify(permissions),
          position,
        ],
      );

      await conn.commit();

      await logAudit(auth.userId, "UPDATE_OWNER_EMPLOYEE", {
        employee_id: employeeId,
        location_id: locationId,
        position,
        timestamp: new Date(),
      });

      res.json({ success: true, message: "Cập nhật nhân viên thành công" });
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
  } catch (error: any) {
    const msg =
      error?.code === "ER_DUP_ENTRY"
        ? "Email đã tồn tại"
        : error?.message || "Lỗi server";
    res.status(error?.statusCode || 500).json({ success: false, message: msg });
  }
};

export const deleteOwnerEmployee = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    if (auth.role !== "owner") {
      res.status(403).json({ success: false, message: "Chỉ owner được phép" });
      return;
    }

    const employeeId = Number(req.params.id);
    if (!Number.isFinite(employeeId)) {
      res
        .status(400)
        .json({ success: false, message: "employeeId không hợp lệ" });
      return;
    }

    const [ownRows] = await pool.query<RowDataPacket[]>(
      `SELECT 1 FROM employee_locations WHERE owner_id = ? AND employee_id = ? LIMIT 1`,
      [auth.userId, employeeId],
    );
    if (!ownRows[0]) {
      res.status(403).json({ success: false, message: "Không có quyền" });
      return;
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      await conn.query(
        `UPDATE employee_locations
         SET status = 'inactive'
         WHERE owner_id = ? AND employee_id = ?`,
        [auth.userId, employeeId],
      );

      // Soft-delete to keep history, block login (auth checks deleted_at IS NULL)
      await conn.query(
        `UPDATE users
         SET status = 'locked', deleted_at = NOW(), updated_at = NOW()
         WHERE user_id = ? AND role = 'employee'`,
        [employeeId],
      );

      await conn.commit();

      await logAudit(auth.userId, "DELETE_OWNER_EMPLOYEE", {
        employee_id: employeeId,
        timestamp: new Date(),
      });

      res.json({ success: true, message: "Đã xóa nhân viên" });
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
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const getOwnerAuditLogs = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);

    const ownerId =
      auth.role === "owner"
        ? auth.userId
        : await getOwnerIdForEmployee(auth.userId);

    const { limit = "100" } = req.query as { limit?: string };
    const lim = Math.min(200, Math.max(1, Number(limit) || 100));

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT log_id, user_id, action, details, created_at
       FROM audit_logs
       WHERE user_id IN (?, ?)
       ORDER BY created_at DESC
       LIMIT ?`,
      [ownerId, auth.userId, lim],
    );

    res.json({ success: true, data: rows });
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

const toMoney = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
};

const roundPayableVnd = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  const vnd = Math.max(0, Math.round(n));
  return Math.ceil(vnd / 1000) * 1000;
};

const assertLocationType = (locationType: string, allowed: string[]) => {
  if (!allowed.includes(String(locationType))) {
    throw Object.assign(new Error("Loại hình địa điểm không hỗ trợ"), {
      statusCode: 400,
    });
  }
};

export const getFrontOfficeContext = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    const locationId = Number((req.query as any).location_id);
    if (!Number.isFinite(locationId)) {
      res
        .status(400)
        .json({ success: false, message: "location_id không hợp lệ" });
      return;
    }

    await ensureLocationAccess({ auth, locationId });

    const [locRows] = await pool.query<RowDataPacket[]>(
      `SELECT location_id, location_name, location_type, status
       FROM locations WHERE location_id = ? LIMIT 1`,
      [locationId],
    );
    if (!locRows[0]) {
      res
        .status(404)
        .json({ success: false, message: "Không tìm thấy địa điểm" });
      return;
    }

    const location = locRows[0];

    if (String(location.status) !== "active") {
      res.status(400).json({ success: false, message: "Địa điểm chưa active" });
      return;
    }

    const locationType = String(location.location_type);

    // For UI routing convenience
    if (locationType === "hotel" || locationType === "resort") {
      const [floorRows] = await pool.query<RowDataPacket[]>(
        `SELECT DISTINCT floor_number
         FROM hotel_rooms
         WHERE location_id = ?
         ORDER BY floor_number ASC`,
        [locationId],
      );

      res.json({
        success: true,
        data: {
          location,
          pos: {
            floors: floorRows.map((r) => Number(r.floor_number)),
          },
        },
      });
      return;
    }

    if (locationType === "restaurant" || locationType === "cafe") {
      const [areas] = await pool.query<RowDataPacket[]>(
        `SELECT area_id, area_name, sort_order
         FROM pos_areas
         WHERE location_id = ?
         ORDER BY sort_order ASC, area_id ASC`,
        [locationId],
      );

      res.json({
        success: true,
        data: {
          location,
          pos: { areas },
        },
      });
      return;
    }

    if (locationType === "tourist") {
      const [ticketServices] = await pool.query<RowDataPacket[]>(
        `SELECT service_id, service_name, price, pos_group, pos_sort
         FROM services
         WHERE location_id = ? AND service_type = 'ticket'
           AND admin_status = 'approved'
           AND deleted_at IS NULL
         ORDER BY COALESCE(pos_sort, 9999) ASC, service_id ASC`,
        [locationId],
      );

      res.json({
        success: true,
        data: {
          location,
          pos: { ticket_services: ticketServices },
        },
      });
      return;
    }

    res.json({
      success: true,
      data: {
        location,
        pos: {},
      },
    });
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

// -------------------- HOTEL (rooms / stays) --------------------

export const getHotelRooms = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    const { location_id, floor } = req.query as {
      location_id?: string;
      floor?: string;
    };

    const locationId = Number(location_id);
    if (!Number.isFinite(locationId)) {
      res
        .status(400)
        .json({ success: false, message: "location_id không hợp lệ" });
      return;
    }

    await ensureLocationAccess({ auth, locationId });

    const [loc] = await pool.query<RowDataPacket[]>(
      `SELECT location_type FROM locations WHERE location_id = ? LIMIT 1`,
      [locationId],
    );
    assertLocationType(String(loc[0]?.location_type || ""), [
      "hotel",
      "resort",
    ]);

    // Auto-sync rooms from room services (source of truth for name + price)
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [roomSvcRows] = await conn.query<RowDataPacket[]>(
        `SELECT s.service_id, s.service_name,
                c.sort_order as category_sort_order
         FROM services s
         LEFT JOIN service_categories c
           ON c.category_id = s.category_id AND c.deleted_at IS NULL
         WHERE s.location_id = ?
           AND s.deleted_at IS NULL
           AND s.service_type = 'room'
           AND s.admin_status = 'approved'
         ORDER BY s.service_id ASC`,
        [locationId],
      );

      for (const row of roomSvcRows) {
        const serviceId = Number(row.service_id);
        if (!Number.isFinite(serviceId)) continue;
        const fullName = String(row.service_name || "").trim();
        if (!fullName) continue;
        const roomName =
          fullName.length > 20 ? fullName.slice(0, 20) : fullName;
        const floorNumber = Number(row.category_sort_order);
        const derivedFloor = Number.isFinite(floorNumber) ? floorNumber : 0;

        // Link existing room rows by name
        await conn.query(
          `UPDATE hotel_rooms
           SET service_id = ?
           WHERE location_id = ?
             AND service_id IS NULL
             AND room_number = ?`,
          [serviceId, locationId, roomName],
        );

        // Keep name/floor synced with service/category
        await conn.query(
          `UPDATE hotel_rooms
           SET room_number = ?, floor_number = ?
           WHERE location_id = ? AND service_id = ?`,
          [roomName, derivedFloor, locationId, serviceId],
        );

        const [exists] = await conn.query<RowDataPacket[]>(
          `SELECT room_id
           FROM hotel_rooms
           WHERE location_id = ? AND service_id = ?
           LIMIT 1`,
          [locationId, serviceId],
        );

        if (!exists[0]) {
          try {
            await conn.query(
              `INSERT INTO hotel_rooms (location_id, service_id, area_id, floor_number, room_number, status)
               VALUES (?, ?, NULL, ?, ?, 'vacant')`,
              [locationId, serviceId, derivedFloor, roomName],
            );
          } catch (e: any) {
            const msg = String(e?.message || "");
            if (!msg.includes("Duplicate")) throw e;
          }
        }
      }

      await conn.commit();
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

    const params: any[] = [locationId];
    let whereFloor = "";
    if (floor && floor !== "all") {
      const f = Number(floor);
      if (Number.isFinite(f)) {
        whereFloor = " AND r.floor_number = ?";
        params.push(f);
      }
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
         r.room_id,
         r.location_id,
         r.service_id,
         r.area_id,
         a.area_name,
         r.floor_number,
         r.room_number,
         r.pos_x,
         r.pos_y,
         r.status,
         srv.price,
         srv.images,
         srv.category_id,
         sc.category_name,
         sc.sort_order as category_sort_order,
         s.stay_id,
         s.status as stay_status,
         s.checkin_time,
         s.expected_checkin,
         s.expected_checkout,
         s.booking_id,
         s.final_amount,
         s.notes,
         COALESCE(pp.prepaid_amount, 0) AS prepaid_amount,
         pp.prepaid_payment_method,
         u.full_name as guest_name,
         u.phone as guest_phone
       FROM hotel_rooms r
       LEFT JOIN pos_areas a ON a.area_id = r.area_id
       LEFT JOIN services srv
         ON srv.service_id = r.service_id
         AND srv.deleted_at IS NULL
        AND srv.admin_status = 'approved'
       LEFT JOIN service_categories sc
         ON sc.category_id = srv.category_id
         AND sc.deleted_at IS NULL
       LEFT JOIN hotel_stays s
         ON s.room_id = r.room_id
         AND s.status IN ('reserved','inhouse')
       LEFT JOIN (
         SELECT
           p.booking_id,
           SUM(
             CASE
               WHEN p.status = 'completed'
                AND LOWER(COALESCE(p.transaction_source, '')) = 'online_booking'
               THEN COALESCE(p.amount, 0)
               ELSE 0
             END
           ) AS prepaid_amount,
           MAX(
             CASE
               WHEN p.status = 'completed'
                AND LOWER(COALESCE(p.transaction_source, '')) = 'online_booking'
               THEN p.payment_method
               ELSE NULL
             END
           ) AS prepaid_payment_method
         FROM payments p
         WHERE p.booking_id IS NOT NULL
         GROUP BY p.booking_id
       ) pp ON pp.booking_id = s.booking_id
       LEFT JOIN users u ON u.user_id = s.user_id
       WHERE r.location_id = ?
         AND r.service_id IS NOT NULL
         AND srv.service_id IS NOT NULL
         ${whereFloor}
       ORDER BY r.floor_number ASC, r.room_number ASC`,
      params,
    );

    const dataRows = rows.map((row) => ({
      ...row,
      prepaid_amount: Number((row as any).prepaid_amount || 0),
      prepaid_payment_method:
        (row as any).prepaid_payment_method == null
          ? null
          : String((row as any).prepaid_payment_method),
    }));

    const bookingIds = Array.from(
      new Set(
        dataRows
          .map((row) => Number((row as any).booking_id))
          .filter((x) => Number.isFinite(x) && x > 0),
      ),
    );

    if (bookingIds.length > 0) {
      const [bookingRows] = await pool.query<RowDataPacket[]>(
        `SELECT booking_id, final_amount, notes
         FROM bookings
         WHERE booking_id IN (?)`,
        [bookingIds],
      );

      const bookingFinalById = new Map<number, number>();
      const bookingNotesById = new Map<number, string | null>();
      for (const br of bookingRows) {
        const bid = Number((br as any).booking_id);
        if (!Number.isFinite(bid) || bid <= 0) continue;
        const finalAmount = Number((br as any).final_amount || 0);
        bookingFinalById.set(
          bid,
          Number.isFinite(finalAmount) && finalAmount > 0 ? finalAmount : 0,
        );
        bookingNotesById.set(bid, (br as any).notes || null);
      }

      const [payRows] = await pool.query<RowDataPacket[]>(
        `SELECT payment_id, booking_id, payment_method, notes, transaction_source, amount
         FROM payments
         WHERE location_id = ?
           AND status = 'completed'
           AND (booking_id IN (?) OR notes LIKE 'BATCH_BOOKINGS:%')
         ORDER BY payment_time DESC, payment_id DESC
         LIMIT 500`,
        [locationId, bookingIds],
      );

      const includesBookingInBatchNote = (
        note: unknown,
        bookingId: number,
      ): boolean => {
        if (!Number.isFinite(bookingId) || bookingId <= 0) return false;
        const s = String(note || "").trim();
        if (!s.startsWith("BATCH_BOOKINGS:")) return false;
        const parts = s
          .slice("BATCH_BOOKINGS:".length)
          .split(",")
          .map((x) => Number(String(x).trim()));
        return parts.some((x) => x === bookingId);
      };

      const matchedByBooking = new Map<
        number,
        {
          payment_id: number;
          payment_method: string | null;
          paid_amount: number;
        }
      >();

      for (const bid of bookingIds) {
        const matched = payRows.find((pr) => {
          const pBookingId = Number((pr as any).booking_id);
          const note = String((pr as any).notes || "");
          const txSource = String((pr as any).transaction_source || "")
            .trim()
            .toLowerCase();
          const byId = Number.isFinite(pBookingId) && pBookingId === bid;
          const byBatch = includesBookingInBatchNote(note, bid);
          if (!byId && !byBatch) return false;

          // Treat user prepay records as valid even for legacy rows where transaction_source may be empty.
          if (byBatch) return true;
          if (txSource === "online_booking") return true;
          return (
            !note.startsWith("HOTEL_STAY:") && !note.startsWith("HOTEL_STAYS:")
          );
        });

        if (!matched) continue;
        const paidAmount = Number((matched as any).amount || 0);
        matchedByBooking.set(bid, {
          payment_id: Number((matched as any).payment_id || 0),
          payment_method:
            (matched as any).payment_method == null
              ? null
              : String((matched as any).payment_method),
          paid_amount:
            Number.isFinite(paidAmount) && paidAmount > 0 ? paidAmount : 0,
        });
      }

      for (const row of dataRows) {
        const bid = Number((row as any).booking_id);
        if (!Number.isFinite(bid) || bid <= 0) continue;
        const matched = matchedByBooking.get(bid);
        if (!matched) continue;

        const bookingFinal = bookingFinalById.get(bid) || 0;
        const bookingNotes = bookingNotesById.get(bid) || null;
        if (bookingNotes) {
          (row as any).booking_notes = bookingNotes;
        }
        const prepaidAmount =
          bookingFinal > 0 ? bookingFinal : Number(matched.paid_amount || 0);
        if (prepaidAmount > 0) {
          (row as any).prepaid_amount = prepaidAmount;
          if (!(row as any).prepaid_payment_method && matched.payment_method) {
            (row as any).prepaid_payment_method = matched.payment_method;
          }
          // Thêm payment_id để frontend nhóm phòng cùng 1 giao dịch thanh toán
          if (matched.payment_id > 0) {
            (row as any).prepaid_payment_id = matched.payment_id;
          }
        }
      }
    }

    res.json({ success: true, data: dataRows });
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const updateHotelRoom = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    if (auth.role !== "owner") {
      res.status(403).json({ success: false, message: "Chỉ owner được phép" });
      return;
    }

    const roomId = Number(req.params.roomId);
    if (!Number.isFinite(roomId)) {
      res.status(400).json({ success: false, message: "roomId không hợp lệ" });
      return;
    }

    const body = req.body as {
      area_id?: number | null;
      floor_number?: number;
      room_number?: string;
    };

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT room_id, location_id FROM hotel_rooms WHERE room_id = ? LIMIT 1`,
      [roomId],
    );
    if (!rows[0]) {
      res.status(404).json({ success: false, message: "Không tìm thấy phòng" });
      return;
    }

    const locationId = Number(rows[0].location_id);
    await ensureLocationAccess({ auth, locationId });

    const [loc] = await pool.query<RowDataPacket[]>(
      `SELECT location_type FROM locations WHERE location_id = ? LIMIT 1`,
      [locationId],
    );
    assertLocationType(String(loc[0]?.location_type || ""), [
      "hotel",
      "resort",
    ]);

    const updates: string[] = [];
    const params: any[] = [];

    if ("floor_number" in body) {
      const f = Number(body.floor_number);
      if (!Number.isFinite(f)) {
        res
          .status(400)
          .json({ success: false, message: "floor_number không hợp lệ" });
        return;
      }
      updates.push("floor_number = ?");
      params.push(f);
    }

    if ("room_number" in body) {
      const num = String(body.room_number || "").trim();
      if (!num) {
        res
          .status(400)
          .json({ success: false, message: "room_number không hợp lệ" });
        return;
      }
      updates.push("room_number = ?");
      params.push(num);
    }

    if ("area_id" in body) {
      const areaId = body.area_id == null ? null : Number(body.area_id);
      if (areaId != null && !Number.isFinite(areaId)) {
        res
          .status(400)
          .json({ success: false, message: "area_id không hợp lệ" });
        return;
      }
      if (areaId != null) {
        const [aRows] = await pool.query<RowDataPacket[]>(
          `SELECT area_id FROM pos_areas WHERE area_id = ? AND location_id = ? LIMIT 1`,
          [areaId, locationId],
        );
        if (!aRows[0]) {
          res
            .status(400)
            .json({ success: false, message: "Khu không thuộc địa điểm" });
          return;
        }
      }
      updates.push("area_id = ?");
      params.push(areaId);
    }

    if (updates.length === 0) {
      res
        .status(400)
        .json({ success: false, message: "Không có dữ liệu cập nhật" });
      return;
    }

    params.push(roomId);
    await pool.query(
      `UPDATE hotel_rooms SET ${updates.join(", ")} WHERE room_id = ?`,
      params,
    );

    res.json({ success: true, message: "Cập nhật phòng thành công" });
  } catch (error: any) {
    const msg = String(error?.message || "");
    if (msg.includes("Duplicate")) {
      res.status(409).json({ success: false, message: "Phòng đã tồn tại" });
      return;
    }
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const updateHotelRoomPosition = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    if (auth.role !== "owner") {
      res.status(403).json({ success: false, message: "Chỉ owner được phép" });
      return;
    }

    const roomId = Number(req.params.roomId);
    const { pos_x, pos_y } = req.body as { pos_x?: number; pos_y?: number };
    if (!Number.isFinite(roomId)) {
      res.status(400).json({ success: false, message: "roomId không hợp lệ" });
      return;
    }

    const x = Number(pos_x);
    const y = Number(pos_y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      res
        .status(400)
        .json({ success: false, message: "pos_x/pos_y không hợp lệ" });
      return;
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT room_id, location_id FROM hotel_rooms WHERE room_id = ? LIMIT 1`,
      [roomId],
    );
    if (!rows[0]) {
      res.status(404).json({ success: false, message: "Không tìm thấy phòng" });
      return;
    }

    const locationId = Number(rows[0].location_id);
    await ensureLocationAccess({ auth, locationId });

    await pool.query(
      `UPDATE hotel_rooms SET pos_x = ?, pos_y = ? WHERE room_id = ?`,
      [Math.round(x), Math.round(y), roomId],
    );

    res.json({ success: true });
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const deleteHotelRoom = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    if (auth.role !== "owner") {
      res.status(403).json({ success: false, message: "Chỉ owner được phép" });
      return;
    }

    const roomId = Number(req.params.roomId);
    if (!Number.isFinite(roomId)) {
      res.status(400).json({ success: false, message: "roomId không hợp lệ" });
      return;
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT room_id, location_id FROM hotel_rooms WHERE room_id = ? LIMIT 1`,
      [roomId],
    );
    if (!rows[0]) {
      res.status(404).json({ success: false, message: "Không tìm thấy phòng" });
      return;
    }

    const locationId = Number(rows[0].location_id);
    await ensureLocationAccess({ auth, locationId });

    const [refRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as stay_count
       FROM hotel_stays
       WHERE room_id = ?`,
      [roomId],
    );
    if (Number(refRows?.[0]?.stay_count || 0) > 0) {
      res.status(400).json({
        success: false,
        message:
          "Phòng đã có lịch sử lưu trú nên không thể xóa. Bạn có thể ngừng kinh doanh dịch vụ phòng ở mục Dịch vụ.",
      });
      return;
    }

    await pool.query(`DELETE FROM hotel_rooms WHERE room_id = ?`, [roomId]);

    res.json({ success: true, message: "Đã xóa phòng" });
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const createHotelRoom = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    if (auth.role !== "owner") {
      res.status(403).json({ success: false, message: "Chỉ owner được phép" });
      return;
    }

    const { location_id, service_id, area_id, floor_number, room_number } =
      req.body as {
        location_id?: number;
        service_id?: number | null;
        area_id?: number | null;
        floor_number?: number;
        room_number?: string;
      };

    const locationId = Number(location_id);
    const serviceId =
      service_id == null || service_id === ("" as any)
        ? null
        : Number(service_id);
    const areaId =
      area_id == null || area_id === ("" as any) ? null : Number(area_id);
    const floorNumber = Number(floor_number);
    const roomNumber = String(room_number || "").trim();

    if (
      !Number.isFinite(locationId) ||
      !Number.isFinite(floorNumber) ||
      !roomNumber
    ) {
      res.status(400).json({
        success: false,
        message: "Thiếu location_id/floor_number/room_number",
      });
      return;
    }

    await ensureLocationAccess({ auth, locationId });

    const [loc] = await pool.query<RowDataPacket[]>(
      `SELECT location_type FROM locations WHERE location_id = ? LIMIT 1`,
      [locationId],
    );
    assertLocationType(String(loc[0]?.location_type || ""), [
      "hotel",
      "resort",
    ]);

    if (areaId != null) {
      if (!Number.isFinite(areaId)) {
        res
          .status(400)
          .json({ success: false, message: "area_id không hợp lệ" });
        return;
      }
      const [aRows] = await pool.query<RowDataPacket[]>(
        `SELECT area_id FROM pos_areas WHERE area_id = ? AND location_id = ? LIMIT 1`,
        [areaId, locationId],
      );
      if (!aRows[0]) {
        res
          .status(400)
          .json({ success: false, message: "Khu không thuộc địa điểm" });
        return;
      }
    }

    if (serviceId != null) {
      if (!Number.isFinite(serviceId)) {
        res
          .status(400)
          .json({ success: false, message: "service_id không hợp lệ" });
        return;
      }

      const [svc] = await pool.query<RowDataPacket[]>(
        `SELECT service_id
         FROM services
         WHERE service_id = ?
           AND location_id = ?
           AND deleted_at IS NULL
           AND service_type = 'room'
           AND admin_status = 'approved'
         LIMIT 1`,
        [serviceId, locationId],
      );
      if (!svc[0]) {
        res.status(400).json({
          success: false,
          message: "Dịch vụ phòng không hợp lệ/không thuộc địa điểm",
        });
        return;
      }
    }

    const [insert] = await pool.query<ResultSetHeader>(
      `INSERT INTO hotel_rooms (location_id, service_id, area_id, floor_number, room_number, status)
       VALUES (?, ?, ?, ?, ?, 'vacant')`,
      [locationId, serviceId, areaId, floorNumber, roomNumber],
    );

    await logAudit(auth.userId, "CREATE_HOTEL_ROOM", {
      location_id: locationId,
      area_id: areaId,
      floor_number: floorNumber,
      room_number: roomNumber,
      room_id: insert.insertId,
      timestamp: new Date(),
    });

    res.status(201).json({ success: true, data: { room_id: insert.insertId } });
  } catch (error: any) {
    const msg = String(error?.message || "");
    if (msg.includes("Duplicate")) {
      res.status(409).json({ success: false, message: "Phòng đã tồn tại" });
      return;
    }
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const setHotelRoomStatus = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    const roomId = Number(req.params.roomId);
    const { status } = req.body as { status?: string };

    if (!Number.isFinite(roomId)) {
      res.status(400).json({ success: false, message: "roomId không hợp lệ" });
      return;
    }

    const nextStatus = String(status || "");
    if (!["vacant", "occupied", "reserved", "cleaning"].includes(nextStatus)) {
      res.status(400).json({ success: false, message: "status không hợp lệ" });
      return;
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT location_id FROM hotel_rooms WHERE room_id = ? LIMIT 1`,
      [roomId],
    );
    if (!rows[0]) {
      res.status(404).json({ success: false, message: "Không tìm thấy phòng" });
      return;
    }

    const locationId = Number(rows[0].location_id);
    const { ownerId } = await ensureLocationAccess({
      auth,
      locationId,
      requiredPermission:
        auth.role === "employee" ? "can_manage_bookings" : undefined,
    });

    await pool.query(`UPDATE hotel_rooms SET status = ? WHERE room_id = ?`, [
      nextStatus,
      roomId,
    ]);

    await logAudit(auth.userId, "SET_HOTEL_ROOM_STATUS", {
      room_id: roomId,
      status: nextStatus,
      timestamp: new Date(),
    });

    await publishHotelUpdated(pool, locationId, ownerId, {
      room_id: roomId,
      status: nextStatus,
    });

    res.json({ success: true });
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const checkinHotelRoom = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    const roomId = Number(req.params.roomId);
    const {
      room_ids,
      user_id,
      notes,
      guest_full_name,
      guest_phone,
      stay_nights,
    } = req.body as {
      room_ids?: number[];
      user_id?: number;
      notes?: string;
      guest_full_name?: string;
      guest_phone?: string;
      stay_nights?: number;
    };

    const roomIds: number[] = Array.isArray(room_ids)
      ? room_ids.map((x) => Number(x)).filter((x) => Number.isFinite(x))
      : [];
    if (roomIds.length === 0) {
      if (!Number.isFinite(roomId)) {
        res
          .status(400)
          .json({ success: false, message: "roomId không hợp lệ" });
        return;
      }
      roomIds.push(roomId);
    }
    const uniqueRoomIds = Array.from(new Set(roomIds));
    if (uniqueRoomIds.length === 0) {
      res
        .status(400)
        .json({ success: false, message: "room_ids không hợp lệ" });
      return;
    }

    const trimmedGuestName =
      typeof guest_full_name === "string" ? guest_full_name.trim() : "";
    const normalizePhone = (raw: string): string => {
      let digits = String(raw || "").replace(/\D/g, "");
      if (digits.startsWith("84")) digits = `0${digits.slice(2)}`;
      return digits;
    };
    const trimmedGuestPhoneRaw =
      typeof guest_phone === "string" ? guest_phone.trim() : "";
    const trimmedGuestPhone = normalizePhone(trimmedGuestPhoneRaw);
    const hasGuestProfile =
      Boolean(trimmedGuestName) || Boolean(trimmedGuestPhone);

    // PMS check-in duration input is in days.
    const stayDaysRaw =
      stay_nights == null ? 1 : Math.floor(Number(stay_nights));
    const stayDays = Number.isFinite(stayDaysRaw) ? stayDaysRaw : 1;
    if (stayDays <= 0) {
      res
        .status(400)
        .json({ success: false, message: "stay_nights không hợp lệ" });
      return;
    }

    const stayHours = stayDays * 24;

    let userId: number | null = null;
    if (user_id != null) {
      const parsed = Number(user_id);
      if (!Number.isFinite(parsed)) {
        res
          .status(400)
          .json({ success: false, message: "user_id không hợp lệ" });
        return;
      }
      userId = parsed;
    } else if (hasGuestProfile) {
      if (!trimmedGuestName) {
        res
          .status(400)
          .json({ success: false, message: "guest_full_name không hợp lệ" });
        return;
      }
      const guestNameNormalized = trimmedGuestName.replace(/\s+/g, " ").trim();
      if (!/^[\p{L}\s]+$/u.test(guestNameNormalized)) {
        res.status(400).json({
          success: false,
          message: "guest_full_name không hợp lệ (không ký tự đặc biệt)",
        });
        return;
      }
      if (!trimmedGuestPhone) {
        res
          .status(400)
          .json({ success: false, message: "guest_phone là bắt buộc" });
        return;
      }
      if (!/^0\d{9,10}$/.test(trimmedGuestPhone)) {
        res.status(400).json({
          success: false,
          message: "guest_phone không đúng định dạng",
        });
        return;
      }
      if (trimmedGuestPhone.length > 20) {
        res
          .status(400)
          .json({ success: false, message: "guest_phone không hợp lệ" });
        return;
      }
    } else {
      res.status(400).json({
        success: false,
        message:
          "Thiếu thông tin khách (guest_full_name/guest_phone) hoặc user_id",
      });
      return;
    }

    // Resolve location access from the first room
    const [firstRoomRows] = await pool.query<RowDataPacket[]>(
      `SELECT r.room_id, r.location_id
       FROM hotel_rooms r
       WHERE r.room_id = ?
       LIMIT 1`,
      [uniqueRoomIds[0]],
    );
    if (!firstRoomRows[0]) {
      res.status(404).json({ success: false, message: "Không tìm thấy phòng" });
      return;
    }

    const locationId = Number(firstRoomRows[0].location_id);
    const { ownerId } = await ensureLocationAccess({
      auth,
      locationId,
      requiredPermission: auth.role === "employee" ? "can_scan" : undefined,
    });

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const placeholders = uniqueRoomIds.map(() => "?").join(",");
      const [roomRows] = await conn.query<RowDataPacket[]>(
        `SELECT r.room_id, r.location_id, r.status, r.service_id,
                s.service_name, s.price, s.admin_status
         FROM hotel_rooms r
         LEFT JOIN services s ON s.service_id = r.service_id AND s.deleted_at IS NULL
         WHERE r.room_id IN (${placeholders})
         FOR UPDATE`,
        uniqueRoomIds,
      );

      const roomMap = new Map<number, RowDataPacket>();
      for (const rr of roomRows) {
        const rid = Number((rr as any).room_id);
        if (Number.isFinite(rid)) roomMap.set(rid, rr);
      }

      const missing = uniqueRoomIds.filter((rid) => !roomMap.has(rid));
      if (missing.length > 0) {
        await conn.rollback();
        res.status(404).json({
          success: false,
          message: `Không tìm thấy phòng: ${missing.join(", ")}`,
        });
        return;
      }

      for (const rid of uniqueRoomIds) {
        const rr = roomMap.get(rid)!;
        const rrLocationId = Number((rr as any).location_id);
        if (rrLocationId !== locationId) {
          await conn.rollback();
          res.status(400).json({
            success: false,
            message: "room_ids phải thuộc cùng một địa điểm",
          });
          return;
        }

        if (!(rr as any).service_id || !(rr as any).service_name) {
          await conn.rollback();
          res.status(400).json({
            success: false,
            message: "Có phòng chưa liên kết dịch vụ",
          });
          return;
        }

        if (String((rr as any).admin_status || "") !== "approved") {
          await conn.rollback();
          res.status(400).json({
            success: false,
            message: `Dịch vụ phòng của phòng ${rid} chưa được admin duyệt`,
          });
          return;
        }

        const st = String((rr as any).status || "");
        if (!["vacant", "reserved"].includes(st)) {
          await conn.rollback();
          res.status(409).json({
            success: false,
            message: `Phòng ${String((rr as any).room_id)} không ở trạng thái có thể nhận phòng`,
          });
          return;
        }
      }

      // Lock current stays (reserved/inhouse) for these rooms, and detect pre-booked user.
      const stayPlaceholders = uniqueRoomIds.map(() => "?").join(",");
      const [stayRows] = await conn.query<RowDataPacket[]>(
        `SELECT room_id, stay_id, status, user_id, booking_id, expected_checkin, expected_checkout
         FROM hotel_stays
         WHERE room_id IN (${stayPlaceholders})
           AND status IN ('reserved','inhouse')
         ORDER BY room_id ASC, stay_id DESC
         FOR UPDATE`,
        uniqueRoomIds,
      );

      const activeStayByRoomId = new Map<
        number,
        {
          stay_id: number;
          status: string;
          user_id: number | null;
          booking_id: number | null;
          expected_checkin: string | null;
          expected_checkout: string | null;
        }
      >();

      for (const sr of stayRows) {
        const rid = Number((sr as any).room_id);
        if (!Number.isFinite(rid)) continue;
        if (activeStayByRoomId.has(rid)) continue;
        activeStayByRoomId.set(rid, {
          stay_id: Number((sr as any).stay_id),
          status: String((sr as any).status || ""),
          user_id:
            (sr as any).user_id == null ? null : Number((sr as any).user_id),
          booking_id:
            (sr as any).booking_id == null
              ? null
              : Number((sr as any).booking_id),
          expected_checkin:
            (sr as any).expected_checkin == null
              ? null
              : String((sr as any).expected_checkin),
          expected_checkout:
            (sr as any).expected_checkout == null
              ? null
              : String((sr as any).expected_checkout),
        });
      }

      for (const rid of uniqueRoomIds) {
        const active = activeStayByRoomId.get(rid);
        if (active && String(active.status || "") === "inhouse") {
          await conn.rollback();
          res.status(409).json({
            success: false,
            message: `Phòng ${rid} đang có khách, không thể nhận phòng`,
          });
          return;
        }
      }

      // Preload booking -> user mapping (more reliable than hotel_stays.user_id)
      const bookingIdsForLookup = Array.from(
        new Set(
          Array.from(activeStayByRoomId.values())
            .map((x) => (x.booking_id != null ? Number(x.booking_id) : null))
            .filter(
              (x): x is number => x != null && Number.isFinite(x) && x > 0,
            ),
        ),
      );
      const bookingUserIdByBookingId = new Map<number, number>();
      if (bookingIdsForLookup.length > 0) {
        const ph = bookingIdsForLookup.map(() => "?").join(",");
        const [bRows] = await conn.query<RowDataPacket[]>(
          `SELECT booking_id, user_id
           FROM bookings
           WHERE booking_id IN (${ph})
           FOR UPDATE`,
          bookingIdsForLookup,
        );
        for (const br of bRows) {
          const bid = Number((br as any).booking_id);
          const uid = Number((br as any).user_id);
          if (
            Number.isFinite(bid) &&
            bid > 0 &&
            Number.isFinite(uid) &&
            uid > 0
          ) {
            bookingUserIdByBookingId.set(bid, uid);
          }
        }
      }

      // If this is a pre-booked room and user_id wasn't provided, reuse the booking user.
      if (userId == null) {
        const prebookUserIds = new Set<number>();
        for (const active of activeStayByRoomId.values()) {
          if (String(active.status || "") !== "reserved") continue;
          const uidFromStay = active.user_id;
          if (uidFromStay != null && Number.isFinite(uidFromStay)) {
            prebookUserIds.add(uidFromStay);
          }
          const bid = active.booking_id;
          const uidFromBooking =
            bid != null && Number.isFinite(bid)
              ? bookingUserIdByBookingId.get(Number(bid))
              : undefined;
          if (uidFromBooking != null && Number.isFinite(uidFromBooking)) {
            prebookUserIds.add(uidFromBooking);
          }
        }

        if (prebookUserIds.size === 1) {
          userId = Array.from(prebookUserIds.values())[0];
        } else if (prebookUserIds.size > 1) {
          await conn.rollback();
          res.status(409).json({
            success: false,
            message: "Các phòng đang được đặt trước bởi nhiều khách khác nhau",
          });
          return;
        }
      }

      // Create a guest user if user_id still not resolved.
      // Important: allow duplicate guest phone/name => do NOT reuse by phone.
      if (userId == null) {
        const [insertGuest] = await conn.query<ResultSetHeader>(
          `INSERT INTO users (email, phone, password_hash, full_name, role, status, is_verified)
           VALUES (NULL, ?, NULL, ?, 'user', 'active', 0)`,
          [trimmedGuestPhone || null, trimmedGuestName],
        );
        userId = insertGuest.insertId;
      }

      const now = new Date();
      const expectedCheckout = new Date(
        now.getTime() + stayHours * 60 * 60 * 1000,
      );

      const createdStays: Array<{
        room_id: number;
        stay_id: number;
        checkin_id: number;
        amount: number;
        expected_checkout: Date;
        booking_id: number | null;
        booking_user_id: number | null;
      }> = [];

      for (const rid of uniqueRoomIds) {
        // Allow pre-booked rooms: if there's a reserved stay, convert it to inhouse.
        const active = activeStayByRoomId.get(rid);

        let expectedCheckoutByRoom = expectedCheckout;
        if (active && String(active.status || "") === "reserved") {
          const reservedExpectedCheckin = active.expected_checkin
            ? new Date(String(active.expected_checkin))
            : null;
          const reservedExpectedCheckout = active.expected_checkout
            ? new Date(String(active.expected_checkout))
            : null;

          // Preserve originally booked duration even when check-in happens earlier/later.
          let plannedDurationMs = stayHours * 60 * 60 * 1000;
          if (
            reservedExpectedCheckin &&
            reservedExpectedCheckout &&
            Number.isFinite(reservedExpectedCheckin.getTime()) &&
            Number.isFinite(reservedExpectedCheckout.getTime())
          ) {
            const bookedDurationMs =
              reservedExpectedCheckout.getTime() -
              reservedExpectedCheckin.getTime();
            if (bookedDurationMs > 0) {
              plannedDurationMs = bookedDurationMs;
            }
          }

          expectedCheckoutByRoom = new Date(now.getTime() + plannedDurationMs);
        }

        const rr = roomMap.get(rid)!;
        const serviceName = String((rr as any).service_name || "").trim();
        const unitPrice = Number((rr as any).price ?? 0);
        const safeUnitPrice =
          Number.isFinite(unitPrice) && unitPrice > 0 ? unitPrice : 0;
        const amount = +((safeUnitPrice * stayHours) as number).toFixed(2);
        const qrText = serviceName
          ? `Cảm ơn quý khách đã dùng dịch vụ ${serviceName}`
          : `Cảm ơn quý khách đã dùng dịch vụ`;

        const stayNotes: Record<string, unknown> = {
          guest_full_name: trimmedGuestName || null,
          guest_phone: trimmedGuestPhone || null,
          stay_days: Math.max(1, Math.ceil(stayHours / 24)),
          stay_nights: Math.max(
            1,
            Math.ceil(
              (expectedCheckoutByRoom.getTime() - now.getTime()) /
                (60 * 60 * 1000),
            ),
          ),
          room_unit_price: safeUnitPrice,
          room_amount: amount,
          extra_notes: notes ?? null,
          source: active ? "prebook" : "walkin",
        };

        const bookingIdForCheckin =
          active?.booking_id != null ? Number(active.booking_id) : null;
        const bookingUserIdForCheckin =
          bookingIdForCheckin != null
            ? (bookingUserIdByBookingId.get(Number(bookingIdForCheckin)) ??
              (active?.user_id != null ? Number(active.user_id) : null))
            : null;

        const [checkinInsert] = await conn.query<ResultSetHeader>(
          `INSERT INTO checkins (user_id, location_id, booking_id, status, verified_by, notes)
           VALUES (?, ?, ?, 'verified', ?, ?)`,
          [userId, locationId, bookingIdForCheckin, auth.userId, qrText],
        );

        if (active) {
          // Convert reserved stay to inhouse
          await conn.query(
            `UPDATE hotel_stays
             SET status = 'inhouse',
                 checkin_time = ?,
                 expected_checkin = COALESCE(expected_checkin, ?),
                 expected_checkout = ?,
                 user_id = COALESCE(user_id, ?),
                 created_by = COALESCE(created_by, ?),
                 notes = COALESCE(notes, ?)
             WHERE stay_id = ? AND status = 'reserved'`,
            [
              now,
              now,
              expectedCheckoutByRoom,
              userId,
              auth.userId,
              JSON.stringify(stayNotes),
              Number(active.stay_id),
            ],
          );

          await conn.query(
            `UPDATE hotel_rooms SET status = 'occupied' WHERE room_id = ?`,
            [rid],
          );

          createdStays.push({
            room_id: rid,
            stay_id: Number(active.stay_id),
            checkin_id: checkinInsert.insertId,
            amount,
            expected_checkout: expectedCheckoutByRoom,
            booking_id: bookingIdForCheckin,
            booking_user_id: bookingUserIdForCheckin,
          });
        } else {
          const [stayInsert] = await conn.query<ResultSetHeader>(
            `INSERT INTO hotel_stays (
               location_id, room_id, user_id, booking_id, status,
               checkin_time, expected_checkin, expected_checkout,
               notes, created_by,
               subtotal_amount, discount_amount, final_amount
             ) VALUES (?, ?, ?, NULL, 'inhouse', ?, ?, ?, ?, ?, 0.00, 0.00, 0.00)`,
            [
              locationId,
              rid,
              userId,
              now,
              now,
              expectedCheckoutByRoom,
              JSON.stringify(stayNotes),
              auth.userId,
            ],
          );

          await conn.query(
            `UPDATE hotel_rooms SET status = 'occupied' WHERE room_id = ?`,
            [rid],
          );

          createdStays.push({
            room_id: rid,
            stay_id: stayInsert.insertId,
            checkin_id: checkinInsert.insertId,
            amount,
            expected_checkout: expectedCheckoutByRoom,
            booking_id: null,
            booking_user_id: null,
          });
        }
      }

      await conn.commit();

      for (const st of createdStays) {
        await publishHotelUpdated(conn, locationId, ownerId, {
          room_id: st.room_id,
          stay_id: st.stay_id,
        });

        // Notify the booking user (if any) so user-side UI can sync.
        const recipientUserId =
          st.booking_user_id != null && Number.isFinite(st.booking_user_id)
            ? Number(st.booking_user_id)
            : null;
        if (
          st.booking_id != null &&
          Number.isFinite(st.booking_id) &&
          recipientUserId
        ) {
          publishToUser(recipientUserId, {
            type: "booking_checked_in",
            booking_id: Number(st.booking_id),
            stay_id: Number(st.stay_id),
            room_id: Number(st.room_id),
            location_id: Number(locationId),
          });
        }
      }

      await logAudit(auth.userId, "HOTEL_ROOM_CHECKIN", {
        location_id: locationId,
        room_ids: uniqueRoomIds,
        stay_days: stayDays,
        stay_nights: stayHours,
        user_id: userId,
        timestamp: new Date(),
      });

      const first = createdStays[0];
      res.status(201).json({
        success: true,
        data: {
          stay_id: first?.stay_id ?? null,
          checkin_id: first?.checkin_id ?? null,
          checkin_time: now,
          expected_checkout: first?.expected_checkout ?? expectedCheckout,
          stays: createdStays,
        },
      });
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
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const addHotelStayItems = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    const stayId = Number(req.params.stayId);
    if (!Number.isFinite(stayId)) {
      res.status(400).json({ success: false, message: "stayId không hợp lệ" });
      return;
    }

    const { items } = req.body as {
      items?: Array<{ service_id: number; quantity?: number }>;
    };

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ success: false, message: "items không hợp lệ" });
      return;
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [stayRows] = await conn.query<RowDataPacket[]>(
        `SELECT stay_id, location_id, status
         FROM hotel_stays
         WHERE stay_id = ?
         LIMIT 1
         FOR UPDATE`,
        [stayId],
      );
      if (!stayRows[0]) {
        await conn.rollback();
        res
          .status(404)
          .json({ success: false, message: "Không tìm thấy stay" });
        return;
      }
      if (String(stayRows[0].status) !== "inhouse") {
        await conn.rollback();
        res
          .status(400)
          .json({ success: false, message: "Stay không ở trạng thái inhouse" });
        return;
      }

      const locationId = Number(stayRows[0].location_id);
      const { ownerId } = await ensureLocationAccess({
        auth,
        locationId,
        requiredPermission:
          auth.role === "employee" ? "can_manage_bookings" : undefined,
      });

      const merged = new Map<number, number>();
      for (const it of items) {
        const serviceId = Number((it as any)?.service_id);
        const qtyRaw = Number((it as any)?.quantity ?? 1);
        const qty = Math.max(1, Math.floor(qtyRaw));
        if (!Number.isFinite(serviceId)) {
          await conn.rollback();
          res.status(400).json({
            success: false,
            message: "items có service_id không hợp lệ",
          });
          return;
        }
        if (!Number.isFinite(qty) || qty < 1) {
          await conn.rollback();
          res.status(400).json({
            success: false,
            message: "items có quantity không hợp lệ",
          });
          return;
        }
        merged.set(serviceId, (merged.get(serviceId) ?? 0) + qty);
      }

      const serviceIds = Array.from(merged.keys());
      const [svcRows] = await conn.query<RowDataPacket[]>(
        `SELECT service_id, price, admin_status
         FROM services
         WHERE location_id = ?
           AND deleted_at IS NULL
           AND service_id IN (?)
         FOR UPDATE`,
        [locationId, serviceIds],
      );
      const svcById = new Map<
        number,
        { price: number; admin_status: string | null }
      >();
      for (const r of svcRows) {
        svcById.set(Number(r.service_id), {
          price: toMoney(r.price),
          admin_status: r.admin_status == null ? null : String(r.admin_status),
        });
      }

      for (const serviceId of serviceIds) {
        const svc = svcById.get(serviceId);
        if (!svc) {
          await conn.rollback();
          res.status(400).json({
            success: false,
            message: `Không tìm thấy dịch vụ (service_id=${serviceId})`,
          });
          return;
        }
        if (String(svc.admin_status || "") !== "approved") {
          await conn.rollback();
          res.status(400).json({
            success: false,
            message: "Dịch vụ chưa được admin duyệt",
          });
          return;
        }
      }

      for (const [serviceId, qty] of merged.entries()) {
        const svc = svcById.get(serviceId);
        if (!svc) continue;
        const unitPrice = toMoney(svc.price);
        const lineTotal = toMoney(unitPrice * qty);
        await conn.query(
          `INSERT INTO hotel_stay_items (stay_id, service_id, quantity, unit_price, line_total)
           VALUES (?, ?, ?, ?, ?)`,
          [stayId, serviceId, qty, unitPrice, lineTotal],
        );
      }

      const [sumRows] = await conn.query<RowDataPacket[]>(
        `SELECT COALESCE(SUM(line_total), 0) as subtotal
         FROM hotel_stay_items
         WHERE stay_id = ?`,
        [stayId],
      );
      const itemsSubtotal = toMoney(sumRows[0]?.subtotal);

      const [baseRows] = await conn.query<RowDataPacket[]>(
        `SELECT hs.room_id, hs.notes,
                s.price AS room_unit_price
         FROM hotel_stays hs
         LEFT JOIN hotel_rooms r ON r.room_id = hs.room_id
         LEFT JOIN services s ON s.service_id = r.service_id AND s.deleted_at IS NULL
         WHERE hs.stay_id = ?
         LIMIT 1
         FOR UPDATE`,
        [stayId],
      );

      const baseRow = baseRows[0] || ({} as any);
      let stayHours = 1;
      try {
        const n = baseRow?.notes ? JSON.parse(String(baseRow.notes)) : null;
        const daysRaw = n?.stay_days;
        const days = Math.floor(Number(daysRaw));
        if (Number.isFinite(days) && days > 0) {
          stayHours = days * 24;
        } else {
          const hoursRaw = n?.stay_nights;
          const hours = Math.floor(Number(hoursRaw));
          if (Number.isFinite(hours) && hours > 0) stayHours = hours;
        }
      } catch {
        // ignore
      }

      const unitPrice = Number((baseRow as any).room_unit_price ?? 0);
      const safeUnitPrice =
        Number.isFinite(unitPrice) && unitPrice > 0 ? unitPrice : 0;
      const roomAmount = toMoney(safeUnitPrice * stayHours);

      const subtotal = toMoney(roomAmount + itemsSubtotal);
      const finalAmount = subtotal; // discount not implemented yet

      await conn.query(
        `UPDATE hotel_stays
         SET subtotal_amount = ?, discount_amount = 0.00, final_amount = ?
         WHERE stay_id = ?`,
        [subtotal, finalAmount, stayId],
      );

      await conn.commit();

      await publishHotelUpdated(conn, locationId, ownerId, { stay_id: stayId });

      await logAudit(auth.userId, "HOTEL_STAY_ADD_ITEMS", {
        stay_id: stayId,
        location_id: locationId,
        timestamp: new Date(),
      });

      res.json({
        success: true,
        data: {
          stay_id: stayId,
          room_amount: roomAmount,
          items_amount: itemsSubtotal,
          subtotal,
          final_amount: finalAmount,
        },
      });
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
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const extendHotelStay = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    const stayId = Number(req.params.stayId);
    if (!Number.isFinite(stayId) || stayId <= 0) {
      res.status(400).json({ success: false, message: "stayId không hợp lệ" });
      return;
    }

    const { preset, custom_hours, custom_days } = req.body as {
      preset?: "day" | "week" | "month" | "custom";
      custom_hours?: number;
      custom_days?: number;
    };

    const normalizedPreset = String(preset || "day") as
      | "day"
      | "week"
      | "month"
      | "custom";

    let extendHours = 24;
    if (normalizedPreset === "week") extendHours = 24 * 7;
    else if (normalizedPreset === "month") extendHours = 24 * 30;
    else if (normalizedPreset === "custom") {
      const d = Math.floor(Number(custom_days));
      const h = Math.floor(Number(custom_hours));
      if (Number.isFinite(d) && d > 0) {
        extendHours = d * 24;
      } else if (Number.isFinite(h) && h > 0) {
        // backward-compat for older clients still sending custom_hours
        extendHours = h;
      } else {
        res
          .status(400)
          .json({ success: false, message: "custom_days không hợp lệ" });
        return;
      }
    }

    if (extendHours <= 0 || extendHours > 24 * 180) {
      res
        .status(400)
        .json({ success: false, message: "Thời gian gia hạn không hợp lệ" });
      return;
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [stayRows] = await conn.query<RowDataPacket[]>(
        `SELECT stay_id, location_id, room_id, status, checkin_time, expected_checkout, notes
         FROM hotel_stays
         WHERE stay_id = ?
         LIMIT 1
         FOR UPDATE`,
        [stayId],
      );

      const stay = stayRows[0];
      if (!stay) {
        await conn.rollback();
        res
          .status(404)
          .json({ success: false, message: "Không tìm thấy stay" });
        return;
      }

      if (String(stay.status || "") !== "inhouse") {
        await conn.rollback();
        res.status(400).json({
          success: false,
          message: "Chỉ gia hạn cho phòng đang ở (inhouse)",
        });
        return;
      }

      const locationId = Number(stay.location_id);
      const { ownerId } = await ensureLocationAccess({
        auth,
        locationId,
        requiredPermission:
          auth.role === "employee" ? "can_manage_bookings" : undefined,
      });

      const now = new Date();
      const currentExpected =
        stay.expected_checkout == null
          ? null
          : new Date(String(stay.expected_checkout));
      const expectedIsValid =
        currentExpected != null && Number.isFinite(currentExpected.getTime());
      const base =
        expectedIsValid && currentExpected!.getTime() > now.getTime()
          ? currentExpected!
          : now;

      const nextExpected = new Date(
        base.getTime() + extendHours * 60 * 60 * 1000,
      );

      let nextNotes: any = {};
      try {
        nextNotes = stay.notes ? JSON.parse(String(stay.notes)) : {};
      } catch {
        nextNotes = {};
      }

      const checkinTime =
        stay.checkin_time == null ? null : new Date(String(stay.checkin_time));
      if (checkinTime && Number.isFinite(checkinTime.getTime())) {
        const totalHours = Math.ceil(
          (nextExpected.getTime() - checkinTime.getTime()) / (60 * 60 * 1000),
        );
        if (Number.isFinite(totalHours) && totalHours > 0) {
          nextNotes.stay_days = Math.max(1, Math.ceil(totalHours / 24));
          nextNotes.stay_nights = totalHours;
        }
      }

      const extensionLog = Array.isArray(nextNotes.extension_history)
        ? nextNotes.extension_history
        : [];
      extensionLog.push({
        at: now.toISOString(),
        by_user_id: auth.userId,
        preset: normalizedPreset,
        extend_days: Math.max(1, Math.ceil(extendHours / 24)),
        extend_hours: extendHours,
        previous_expected_checkout: expectedIsValid
          ? currentExpected!.toISOString()
          : null,
        next_expected_checkout: nextExpected.toISOString(),
      });
      nextNotes.extension_history = extensionLog;

      await conn.query(
        `UPDATE hotel_stays
         SET expected_checkout = ?, notes = ?
         WHERE stay_id = ?`,
        [nextExpected, JSON.stringify(nextNotes), stayId],
      );

      await conn.commit();

      await publishHotelUpdated(conn, locationId, ownerId, {
        stay_id: stayId,
        room_id: Number(stay.room_id),
      });

      await logAudit(auth.userId, "HOTEL_STAY_EXTEND", {
        stay_id: stayId,
        location_id: locationId,
        extend_days: Math.max(1, Math.ceil(extendHours / 24)),
        extend_hours: extendHours,
        preset: normalizedPreset,
        expected_checkout: nextExpected,
        timestamp: new Date(),
      });

      res.json({
        success: true,
        data: {
          stay_id: stayId,
          extend_days: Math.max(1, Math.ceil(extendHours / 24)),
          extend_hours: extendHours,
          expected_checkout: nextExpected,
        },
      });
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
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const checkoutHotelStay = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    const safeNum = (v: unknown): number => {
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? n : 0;
    };
    const stayId = Number(req.params.stayId);
    if (!Number.isFinite(stayId)) {
      res.status(400).json({ success: false, message: "stayId không hợp lệ" });
      return;
    }

    const { payment_method, step, payment_id } = req.body as {
      payment_method?: "cash" | "transfer";
      step?: "init" | "complete";
      payment_id?: number;
    };
    const pm = payment_method == null ? null : String(payment_method);
    if (pm !== "cash" && pm !== "transfer") {
      res
        .status(400)
        .json({ success: false, message: "payment_method không hợp lệ" });
      return;
    }

    const flowStep: "init" | "complete" =
      step === "init"
        ? "init"
        : step === "complete"
          ? "complete"
          : pm === "transfer"
            ? "init"
            : "complete";

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [stayRows] = await conn.query<RowDataPacket[]>(
        `SELECT hs.stay_id, hs.location_id, hs.room_id, hs.user_id, hs.status, hs.notes,
            hs.checkin_time, hs.checkout_time, hs.expected_checkout, hs.booking_id,
                r.room_number, r.service_id,
            s.service_name, s.price AS room_unit_price,
            b.final_amount AS booking_final_amount
         FROM hotel_stays hs
         LEFT JOIN hotel_rooms r ON r.room_id = hs.room_id
         LEFT JOIN services s ON s.service_id = r.service_id AND s.deleted_at IS NULL
          LEFT JOIN bookings b ON b.booking_id = hs.booking_id
         WHERE hs.stay_id = ?
         LIMIT 1
         FOR UPDATE`,
        [stayId],
      );

      if (!stayRows[0]) {
        await conn.rollback();
        res
          .status(404)
          .json({ success: false, message: "Không tìm thấy stay" });
        return;
      }
      const locationId = Number(stayRows[0].location_id);
      const roomId = Number(stayRows[0].room_id);
      const userId =
        stayRows[0].user_id == null ? null : Number(stayRows[0].user_id);
      const bookingIdRaw = Number((stayRows[0] as any).booking_id);
      const bookingId =
        Number.isFinite(bookingIdRaw) && bookingIdRaw > 0 ? bookingIdRaw : null;
      const bookingFinalRaw = Number((stayRows[0] as any).booking_final_amount);
      const bookingFinalAmount =
        Number.isFinite(bookingFinalRaw) && bookingFinalRaw > 0
          ? bookingFinalRaw
          : 0;
      const roomNumber = String((stayRows[0] as any).room_number || "").trim();

      const { ownerId } = await ensureLocationAccess({
        auth,
        locationId,
        requiredPermission:
          auth.role === "employee" ? "can_manage_bookings" : undefined,
      });

      const [locNameRows] = await conn.query<RowDataPacket[]>(
        `SELECT location_name FROM locations WHERE location_id = ? LIMIT 1`,
        [locationId],
      );
      const locationName = String(locNameRows[0]?.location_name || "").trim();

      const [ownerRows] = await conn.query<RowDataPacket[]>(
        `SELECT full_name FROM users WHERE user_id = ? LIMIT 1`,
        [ownerId],
      );
      const ownerName = String(ownerRows[0]?.full_name || "").trim();

      // Guest snapshot (name/phone) for invoice/history display
      let guestName: string | null = null;
      let guestPhone: string | null = null;
      try {
        if (userId != null && Number.isFinite(Number(userId))) {
          const [gRows] = await conn.query<RowDataPacket[]>(
            `SELECT full_name, phone FROM users WHERE user_id = ? LIMIT 1`,
            [userId],
          );
          guestName = gRows[0]?.full_name ? String(gRows[0].full_name) : null;
          guestPhone = gRows[0]?.phone ? String(gRows[0].phone) : null;
        }
      } catch {
        // ignore
      }
      if (!guestName || !guestPhone) {
        try {
          const n = stayRows[0].notes
            ? JSON.parse(String(stayRows[0].notes))
            : null;
          if (!guestName && n?.guest_full_name)
            guestName = String(n.guest_full_name);
          if (!guestPhone && n?.guest_phone) guestPhone = String(n.guest_phone);
        } catch {
          // ignore
        }
      }

      if (String(stayRows[0].status) !== "inhouse") {
        await conn.rollback();
        res
          .status(400)
          .json({ success: false, message: "Stay không ở trạng thái inhouse" });
        return;
      }

      const unitPrice = Number((stayRows[0] as any).room_unit_price ?? 0);
      const safeUnitPrice =
        Number.isFinite(unitPrice) && unitPrice > 0 ? unitPrice : 0;

      const toDateSafe = (v: any): Date | null => {
        if (!v) return null;
        if (v instanceof Date) return Number.isFinite(v.getTime()) ? v : null;
        const d = new Date(String(v));
        return Number.isFinite(d.getTime()) ? d : null;
      };

      const checkinTime = toDateSafe((stayRows[0] as any).checkin_time);
      const expectedCheckout = toDateSafe(
        (stayRows[0] as any).expected_checkout,
      );
      if (!checkinTime) {
        await conn.rollback();
        res.status(400).json({
          success: false,
          message: "Thiếu checkin_time để tính tiền theo thời gian thực",
        });
        return;
      }

      // Registered duration (planned) in minutes
      let plannedMinutes: number | null = null;
      if (expectedCheckout) {
        const diff = Math.ceil(
          (expectedCheckout.getTime() - checkinTime.getTime()) / 60000,
        );
        if (Number.isFinite(diff) && diff > 0) plannedMinutes = diff;
      }
      if (plannedMinutes == null) {
        // Fallback: stored preset in notes
        try {
          const n = stayRows[0].notes
            ? JSON.parse(String(stayRows[0].notes))
            : null;
          const daysRaw = n?.stay_days;
          const days = Math.floor(Number(daysRaw));
          if (Number.isFinite(days) && days > 0) {
            plannedMinutes = days * 24 * 60;
          } else {
            const hoursRaw = n?.stay_nights;
            const hours = Math.floor(Number(hoursRaw));
            if (Number.isFinite(hours) && hours > 0)
              plannedMinutes = hours * 60;
          }
        } catch {
          // ignore
        }
      }

      // Real-time billing: < 1 hour => per minute; >= 1 hour => per hour (ceil).
      // Over registered duration => +10% per extra hour.
      const now = new Date();
      const elapsedMinutes = Math.max(
        1,
        Math.ceil((now.getTime() - checkinTime.getTime()) / 60000),
      );

      const elapsedHoursCeil = Math.max(1, Math.ceil(elapsedMinutes / 60));
      const plannedHoursCeil =
        plannedMinutes != null && plannedMinutes > 0
          ? Math.max(1, Math.ceil(plannedMinutes / 60))
          : null;
      const overtimeHours =
        plannedHoursCeil != null
          ? Math.max(0, elapsedHoursCeil - plannedHoursCeil)
          : 0;
      const surchargeRaw = safeUnitPrice * 0.1 * overtimeHours;
      const surchargeAmount = toMoney(surchargeRaw);

      let roomAmountRaw = 0;
      if (elapsedMinutes < 60) {
        roomAmountRaw = safeUnitPrice * (elapsedMinutes / 60);
      } else {
        if (plannedMinutes != null && plannedMinutes > 0) {
          const withinHours = Math.min(elapsedHoursCeil, plannedHoursCeil!);
          const baseAmount = safeUnitPrice * withinHours;
          const overtimeAmount = safeUnitPrice * 1.1 * overtimeHours;
          roomAmountRaw = baseAmount + overtimeAmount;
        } else {
          roomAmountRaw = safeUnitPrice * elapsedHoursCeil;
        }
      }

      const roomAmount = toMoney(roomAmountRaw);

      const [sumRows] = await conn.query<RowDataPacket[]>(
        `SELECT COALESCE(SUM(line_total), 0) as subtotal
         FROM hotel_stay_items
         WHERE stay_id = ?`,
        [stayId],
      );
      const itemsSubtotal = toMoney(sumRows[0]?.subtotal);
      const subtotal = toMoney(roomAmount + itemsSubtotal);

      const noteHasBookingId = (note: unknown, id: number): boolean => {
        if (!Number.isFinite(id) || id <= 0) return false;
        const s = String(note || "").trim();
        if (!s.startsWith("BATCH_BOOKINGS:")) return false;
        return s
          .slice("BATCH_BOOKINGS:".length)
          .split(",")
          .map((x) => Number(String(x).trim()))
          .some((x) => x === id);
      };

      let prepaidPaymentId: number | null = null;
      let prepaidPaymentMethod: string | null = null;
      let prepaidCandidate = 0;

      if (bookingId != null) {
        const [prepaidRows] = await conn.query<RowDataPacket[]>(
          `SELECT payment_id, payment_method, booking_id, notes, amount
           FROM payments
           WHERE location_id = ?
             AND status = 'completed'
             AND transaction_source = 'online_booking'
             AND (booking_id = ? OR notes LIKE 'BATCH_BOOKINGS:%')
           ORDER BY payment_time DESC, payment_id DESC
           LIMIT 100`,
          [locationId, bookingId],
        );

        for (const pr of prepaidRows) {
          const pBookingId = Number((pr as any).booking_id);
          const matched =
            pBookingId === bookingId ||
            noteHasBookingId((pr as any).notes, bookingId);
          if (!matched) continue;
          prepaidPaymentId = Number((pr as any).payment_id);
          prepaidPaymentMethod = (pr as any).payment_method
            ? String((pr as any).payment_method)
            : null;
          const paidAmount = Number((pr as any).amount || 0);
          prepaidCandidate =
            bookingFinalAmount > 0
              ? bookingFinalAmount
              : Number.isFinite(paidAmount) && paidAmount > 0
                ? paidAmount
                : 0;
          break;
        }
      }

      const prepaidAmount = toMoney(
        Math.min(subtotal, Math.max(0, prepaidCandidate)),
      );
      const onsiteSubtotal = toMoney(subtotal - prepaidAmount);
      const finalAmount = roundPayableVnd(onsiteSubtotal);

      // Legacy schema uses DECIMAL(10,2) for money columns (max 99,999,999.99).
      // Large hourly totals (e.g., long stays) will overflow unless the DB is migrated.
      const LEGACY_DECIMAL10_MAX = 99_999_999.99;
      if (
        subtotal > LEGACY_DECIMAL10_MAX ||
        finalAmount > LEGACY_DECIMAL10_MAX
      ) {
        await conn.rollback();
        res.status(400).json({
          success: false,
          code: "AMOUNT_OUT_OF_RANGE",
          message:
            `Tổng tiền quá lớn để lưu vào DB hiện tại (DECIMAL(10,2) max ${LEGACY_DECIMAL10_MAX}). ` +
            `subtotal=${subtotal}, final_amount=${finalAmount}. ` +
            `Vui lòng chạy migration để nâng cột tiền (payments.amount/owner_receivable, hotel_stays.subtotal_amount/final_amount, ...) lên DECIMAL(15,2).`,
        });
        return;
      }

      const invoiceSnapshot = {
        payment_id: null as number | null,
        booking_id: bookingId,
        location_name: locationName || null,
        owner_name: ownerName || null,
        room_number: roomNumber || null,
        guest_name: guestName,
        guest_phone: guestPhone,
        checkin_time: checkinTime,
        checkout_time: now,
        room_unit_price: safeUnitPrice,
        actual_minutes: elapsedMinutes,
        actual_hours_ceil: elapsedHoursCeil,
        planned_hours_ceil: plannedHoursCeil,
        overtime_hours: overtimeHours,
        surcharge_amount: surchargeAmount,
        room_amount: roomAmount,
        items_amount: itemsSubtotal,
        subtotal,
        gross_amount: subtotal,
        prepaid_payment_id: prepaidPaymentId,
        prepaid_payment_method: prepaidPaymentMethod,
        prepaid_amount: prepaidAmount,
        onsite_amount: finalAmount,
        total_amount: finalAmount,
      };

      // Prepare VietQR (transfer) and base qr_data payload
      const baseQrData: any = {
        content: "HOTEL_CHECKOUT",
        stay_id: stayId,
        room_id: roomId,
        location_id: locationId,
        amount: finalAmount,
        method: pm,
        hotel_invoice: invoiceSnapshot,
      };

      let transferQr: any | null = null;
      if (pm === "transfer") {
        const normalizeBankKey = (input: string): string => {
          return input
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]/g, "");
        };

        const bankBinMap: Record<string, string> = {
          vietcombank: "970436",
          vcb: "970436",
          vietinbank: "970415",
          bidv: "970418",
          agribank: "970405",
          mb: "970422",
          mbbank: "970422",
          acb: "970416",
          techcombank: "970407",
          tcb: "970407",
          sacombank: "970403",
          scb: "970429",
          vpbank: "970432",
          tpbank: "970423",
          vib: "970441",
          shb: "970443",
          hdbank: "970437",
          ocb: "970448",
          msb: "970426",
          eximbank: "970431",
          seabank: "970440",
        };

        const [bankRows] = await conn.query<RowDataPacket[]>(
          `SELECT bank_account, bank_name, account_holder
           FROM owner_profiles
           WHERE owner_id = ?
           LIMIT 1`,
          [ownerId],
        );
        const bankAccount = String(bankRows[0]?.bank_account || "").trim();
        const bankName = String(bankRows[0]?.bank_name || "").trim();
        const accountHolder = String(bankRows[0]?.account_holder || "").trim();
        if (!bankAccount || !bankName || !accountHolder) {
          await conn.rollback();
          res.status(400).json({
            success: false,
            message:
              "Owner chưa cập nhật đủ thông tin ngân hàng (bank_account/bank_name/account_holder)",
          });
          return;
        }
        const resolvedBin = bankBinMap[normalizeBankKey(bankName)] || "";
        if (!resolvedBin) {
          await conn.rollback();
          res.status(400).json({
            success: false,
            message:
              "Không xác định được mã BIN ngân hàng từ bank_name. Vui lòng cập nhật bank_name hợp lệ.",
          });
          return;
        }

        const qrNote = locationName
          ? `${locationName} - Cảm ơn quý khách`
          : "Cảm ơn quý khách";
        const qrAmount = Math.max(0, Math.round(Number(finalAmount || 0)));
        const qrCodeUrl = `https://img.vietqr.io/image/${resolvedBin}-${encodeURIComponent(
          bankAccount,
        )}-qr_only.png?amount=${encodeURIComponent(String(qrAmount))}&addInfo=${encodeURIComponent(
          qrNote,
        )}`;
        transferQr = {
          qr_code_url: qrCodeUrl,
          bank_name: bankName,
          bank_account: bankAccount,
          account_holder: accountHolder,
          bank_bin: resolvedBin,
          amount: qrAmount,
          note: qrNote,
        };
        baseQrData.bank = transferQr;
      }

      // ---- INIT: chỉ hiển thị, KHÔNG trả phòng / KHÔNG lưu lịch sử completed ----
      if (flowStep === "init") {
        if (pm === "cash") {
          await conn.commit();
          res.json({
            success: true,
            data: {
              context: {
                location_name: locationName || null,
                owner_name: ownerName || null,
                room_number: roomNumber || null,
                checkin_time: checkinTime,
                checkout_time: now,
                room_unit_price: safeUnitPrice,
                actual_minutes: elapsedMinutes,
                overtime_hours: overtimeHours,
                surcharge_amount: surchargeAmount,
                gross_amount: subtotal,
                prepaid_amount: prepaidAmount,
                prepaid_payment_method: prepaidPaymentMethod,
                onsite_amount: finalAmount,
                total_amount: finalAmount,
              },
            },
          });
          return;
        }

        // Transfer init: create (or reuse) pending payment, but do NOT checkout the stay
        const support = await getPaymentsSchemaSupport();
        const staff = await getUserSnapshotWithConn(conn, auth.userId);

        const [pendingRows] = await conn.query<RowDataPacket[]>(
          `SELECT payment_id
           FROM payments
           WHERE location_id = ?
             AND status = 'pending'
             AND notes = ?
           ORDER BY payment_id DESC
           LIMIT 1
           FOR UPDATE`,
          [locationId, `HOTEL_STAY:${stayId}`],
        );

        let paymentId: number;
        if (pendingRows[0]?.payment_id) {
          paymentId = Number(pendingRows[0].payment_id);
          const setParts: string[] = [
            "amount = ?",
            "owner_receivable = ?",
            "qr_data = ?",
            "payment_method = ?",
          ];
          const setParams: any[] = [
            finalAmount,
            finalAmount,
            JSON.stringify(baseQrData),
            "BankTransfer",
          ];
          if (support.hasPerformedByUserId) {
            setParts.push("performed_by_user_id = ?");
            setParams.push(auth.userId);
          }
          if (support.hasPerformedByRole) {
            setParts.push("performed_by_role = ?");
            setParams.push(auth.role);
          }
          if (support.hasPerformedByName) {
            setParts.push("performed_by_name = ?");
            setParams.push(staff.full_name || null);
          }
          setParams.push(paymentId);
          await conn.query(
            `UPDATE payments SET ${setParts.join(", ")} WHERE payment_id = ?`,
            setParams,
          );
        } else {
          const columns = [
            "user_id",
            "location_id",
            "booking_id",
            "amount",
            "commission_rate",
            "commission_amount",
            "vat_rate",
            "vat_amount",
            "owner_receivable",
            "payment_method",
            "transaction_code",
            "qr_data",
            "status",
            "notes",
          ];
          const values = [
            "?",
            "?",
            "NULL",
            "?",
            "0.00",
            "0.00",
            "0.00",
            "0.00",
            "?",
            "?",
            "NULL",
            "?",
            "?",
            "?",
          ];
          const params: any[] = [
            userId,
            locationId,
            finalAmount,
            finalAmount,
            "BankTransfer",
            JSON.stringify(baseQrData),
            "pending",
            `HOTEL_STAY:${stayId}`,
          ];
          if (support.hasPerformedByUserId) {
            columns.push("performed_by_user_id");
            values.push("?");
            params.push(auth.userId);
          }
          if (support.hasPerformedByRole) {
            columns.push("performed_by_role");
            values.push("?");
            params.push(auth.role);
          }
          if (support.hasPerformedByName) {
            columns.push("performed_by_name");
            values.push("?");
            params.push(staff.full_name || null);
          }

          const [paymentInsert] = await conn.query<ResultSetHeader>(
            `INSERT INTO payments (\n          ${columns.join(", ")}\n        ) VALUES (${values.join(", ")})`,
            params,
          );
          paymentId = paymentInsert.insertId;
        }

        await conn.commit();
        res.json({
          success: true,
          data: {
            payment_id: paymentId,
            qr: transferQr,
            context: {
              location_name: locationName || null,
              owner_name: ownerName || null,
              room_number: roomNumber || null,
              checkin_time: checkinTime,
              checkout_time: now,
              room_unit_price: safeUnitPrice,
              actual_minutes: elapsedMinutes,
              overtime_hours: overtimeHours,
              surcharge_amount: surchargeAmount,
              gross_amount: subtotal,
              prepaid_amount: prepaidAmount,
              prepaid_payment_method: prepaidPaymentMethod,
              onsite_amount: finalAmount,
              total_amount: finalAmount,
            },
          },
        });
        return;
      }

      // ---- COMPLETE: bấm xác nhận mới trả phòng + lưu lịch sử ----
      const support = await getPaymentsSchemaSupport();
      const staff = await getUserSnapshotWithConn(conn, auth.userId);
      let paymentId: number;
      let paymentTime: Date = now;

      if (pm === "transfer") {
        const pid = Number(payment_id);
        if (!Number.isFinite(pid)) {
          await conn.rollback();
          res
            .status(400)
            .json({ success: false, message: "payment_id không hợp lệ" });
          return;
        }

        const [payRows] = await conn.query<RowDataPacket[]>(
          `SELECT payment_id, location_id, status, notes
           FROM payments
           WHERE payment_id = ?
           LIMIT 1
           FOR UPDATE`,
          [pid],
        );
        if (!payRows[0]) {
          await conn.rollback();
          res
            .status(404)
            .json({ success: false, message: "Không tìm thấy payment" });
          return;
        }
        if (Number(payRows[0].location_id) !== locationId) {
          await conn.rollback();
          res.status(400).json({
            success: false,
            message: "Payment không thuộc location hiện tại",
          });
          return;
        }
        if (String(payRows[0].notes || "") !== `HOTEL_STAY:${stayId}`) {
          await conn.rollback();
          res.status(400).json({
            success: false,
            message: "Payment không khớp stay",
          });
          return;
        }
        if (String(payRows[0].status || "") !== "pending") {
          await conn.rollback();
          res.status(400).json({
            success: false,
            message: "Payment không ở trạng thái pending",
          });
          return;
        }

        const setParts: string[] = [
          "status = 'completed'",
          "amount = ?",
          "owner_receivable = ?",
          "payment_method = ?",
          "qr_data = ?",
        ];
        const setParams: any[] = [
          finalAmount,
          finalAmount,
          "BankTransfer",
          JSON.stringify(baseQrData),
        ];
        if (support.hasPerformedByUserId) {
          setParts.push("performed_by_user_id = ?");
          setParams.push(auth.userId);
        }
        if (support.hasPerformedByRole) {
          setParts.push("performed_by_role = ?");
          setParams.push(auth.role);
        }
        if (support.hasPerformedByName) {
          setParts.push("performed_by_name = ?");
          setParams.push(staff.full_name || null);
        }
        setParams.push(pid);
        await conn.query(
          `UPDATE payments SET ${setParts.join(", ")} WHERE payment_id = ?`,
          setParams,
        );

        paymentId = pid;
      } else {
        // Cash complete: insert completed payment at confirmation time
        const columns = [
          "user_id",
          "location_id",
          "booking_id",
          "amount",
          "commission_rate",
          "commission_amount",
          "vat_rate",
          "vat_amount",
          "owner_receivable",
          "payment_method",
          "transaction_code",
          "qr_data",
          "status",
          "notes",
        ];
        const values = [
          "?",
          "?",
          "NULL",
          "?",
          "0.00",
          "0.00",
          "0.00",
          "0.00",
          "?",
          "?",
          "NULL",
          "?",
          "?",
          "?",
        ];
        const params: any[] = [
          userId,
          locationId,
          finalAmount,
          finalAmount,
          "Cash",
          JSON.stringify(baseQrData),
          "completed",
          `HOTEL_STAY:${stayId}`,
        ];
        if (support.hasPerformedByUserId) {
          columns.push("performed_by_user_id");
          values.push("?");
          params.push(auth.userId);
        }
        if (support.hasPerformedByRole) {
          columns.push("performed_by_role");
          values.push("?");
          params.push(auth.role);
        }
        if (support.hasPerformedByName) {
          columns.push("performed_by_name");
          values.push("?");
          params.push(staff.full_name || null);
        }

        const [paymentInsert] = await conn.query<ResultSetHeader>(
          `INSERT INTO payments (\n          ${columns.join(", ")}\n        ) VALUES (${values.join(", ")})`,
          params,
        );
        paymentId = paymentInsert.insertId;
      }

      invoiceSnapshot.payment_id = paymentId;

      await conn.query(
        `UPDATE hotel_stays
         SET subtotal_amount = ?, discount_amount = 0.00, final_amount = ?,
             status = 'checked_out', checkout_time = ?, closed_by = ?
         WHERE stay_id = ?`,
        [subtotal, finalAmount, now, auth.userId, stayId],
      );

      await conn.query(
        `UPDATE hotel_rooms SET status = 'cleaning' WHERE room_id = ?`,
        [roomId],
      );

      await conn.commit();

      await publishHotelUpdated(conn, locationId, ownerId, {
        stay_id: stayId,
        room_id: roomId,
      });

      await logAudit(auth.userId, "HOTEL_STAY_CHECKOUT", {
        stay_id: stayId,
        location_id: locationId,
        room_id: roomId,
        payment_id: paymentId,
        amount: finalAmount,
        payment_method: pm,
        timestamp: new Date(),
      });

      res.json({
        success: true,
        data: {
          invoice: {
            payment_id: paymentId,
            location_name: locationName || null,
            owner_name: ownerName || null,
            room_number: roomNumber || null,
            payment_time: paymentTime,
            checkin_time: checkinTime,
            checkout_time: now,
            room_unit_price: safeUnitPrice,
            actual_minutes: elapsedMinutes,
            overtime_hours: overtimeHours,
            surcharge_amount: surchargeAmount,
            gross_amount: subtotal,
            prepaid_amount: prepaidAmount,
            prepaid_payment_method: prepaidPaymentMethod,
            onsite_amount: finalAmount,
            total_amount: finalAmount,
          },
        },
      });
      return;
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
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const checkoutHotelStaysBatch = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);

    const { stay_ids, payment_method, step, payment_id } = req.body as {
      stay_ids?: number[];
      payment_method?: "transfer" | "cash";
      step?: "init" | "complete";
      payment_id?: number;
    };

    const pm = payment_method == null ? null : String(payment_method);
    if (pm !== "transfer" && pm !== "cash") {
      res
        .status(400)
        .json({ success: false, message: "payment_method không hợp lệ" });
      return;
    }

    const flowStep: "init" | "complete" =
      step === "init"
        ? "init"
        : step === "complete"
          ? "complete"
          : pm === "transfer"
            ? "init"
            : "complete";

    const idsRaw = Array.isArray(stay_ids) ? stay_ids : [];
    const stayIds = Array.from(
      new Set(
        idsRaw.map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0),
      ),
    );
    if (stayIds.length < 2) {
      res.status(400).json({
        success: false,
        message: "stay_ids không hợp lệ (cần >= 2 phòng)",
      });
      return;
    }

    const stayIdsSorted = [...stayIds].sort((a, b) => a - b);
    const noteKey = `HOTEL_STAYS:${stayIdsSorted.join(",")}`;

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [stayRows] = await conn.query<RowDataPacket[]>(
        `SELECT hs.stay_id, hs.location_id, hs.room_id, hs.user_id, hs.status, hs.notes,
                hs.checkin_time, hs.expected_checkout, hs.booking_id,
                r.room_number, r.service_id,
                s.price AS room_unit_price,
                b.final_amount AS booking_final_amount
         FROM hotel_stays hs
         LEFT JOIN hotel_rooms r ON r.room_id = hs.room_id
         LEFT JOIN services s ON s.service_id = r.service_id AND s.deleted_at IS NULL
         LEFT JOIN bookings b ON b.booking_id = hs.booking_id
         WHERE hs.stay_id IN (?)
         FOR UPDATE`,
        [stayIdsSorted],
      );

      if (
        !Array.isArray(stayRows) ||
        stayRows.length !== stayIdsSorted.length
      ) {
        await conn.rollback();
        res
          .status(404)
          .json({ success: false, message: "Không tìm thấy đủ stay" });
        return;
      }

      const locationId = Number(stayRows[0].location_id);
      if (!Number.isFinite(locationId)) {
        await conn.rollback();
        res
          .status(400)
          .json({ success: false, message: "location_id không hợp lệ" });
        return;
      }

      for (const sr of stayRows) {
        if (Number(sr.location_id) !== locationId) {
          await conn.rollback();
          res.status(400).json({
            success: false,
            message: "Các phòng không cùng location",
          });
          return;
        }
        if (String(sr.status || "") !== "inhouse") {
          await conn.rollback();
          res.status(400).json({
            success: false,
            message: "Có phòng không ở trạng thái inhouse",
          });
          return;
        }
      }

      const { ownerId } = await ensureLocationAccess({
        auth,
        locationId,
        requiredPermission:
          auth.role === "employee" ? "can_manage_bookings" : undefined,
      });

      const [locNameRows] = await conn.query<RowDataPacket[]>(
        `SELECT location_name FROM locations WHERE location_id = ? LIMIT 1`,
        [locationId],
      );
      const locationName = String(locNameRows[0]?.location_name || "").trim();

      const [ownerRows] = await conn.query<RowDataPacket[]>(
        `SELECT full_name FROM users WHERE user_id = ? LIMIT 1`,
        [ownerId],
      );
      const ownerName = String(ownerRows[0]?.full_name || "").trim();

      const now = new Date();

      // Preload items subtotal per stay
      const [itemSumRows] = await conn.query<RowDataPacket[]>(
        `SELECT stay_id, COALESCE(SUM(line_total), 0) as subtotal
         FROM hotel_stay_items
         WHERE stay_id IN (?)
         GROUP BY stay_id`,
        [stayIdsSorted],
      );
      const itemsByStay = new Map<number, number>();
      for (const ir of itemSumRows) {
        const sid = Number((ir as any).stay_id);
        if (!Number.isFinite(sid)) continue;
        itemsByStay.set(sid, toMoney((ir as any).subtotal));
      }

      const toDateSafe = (v: any): Date | null => {
        if (!v) return null;
        if (v instanceof Date) return Number.isFinite(v.getTime()) ? v : null;
        const d = new Date(String(v));
        return Number.isFinite(d.getTime()) ? d : null;
      };

      const noteHasBookingId = (note: unknown, id: number): boolean => {
        if (!Number.isFinite(id) || id <= 0) return false;
        const s = String(note || "").trim();
        if (!s.startsWith("BATCH_BOOKINGS:")) return false;
        return s
          .slice("BATCH_BOOKINGS:".length)
          .split(",")
          .map((x) => Number(String(x).trim()))
          .some((x) => x === id);
      };

      const bookingIdsInStays = Array.from(
        new Set(
          stayRows
            .map((x) => Number((x as any).booking_id))
            .filter((x) => Number.isFinite(x) && x > 0),
        ),
      );
      const prepaidByBooking = new Map<
        number,
        { payment_id: number; payment_method: string | null; amount: number }
      >();
      if (bookingIdsInStays.length > 0) {
        const [prepaidRows] = await conn.query<RowDataPacket[]>(
          `SELECT payment_id, payment_method, booking_id, notes, amount
           FROM payments
           WHERE location_id = ?
             AND status = 'completed'
             AND transaction_source = 'online_booking'
             AND (booking_id IN (?) OR notes LIKE 'BATCH_BOOKINGS:%')
           ORDER BY payment_time DESC, payment_id DESC
           LIMIT 300`,
          [locationId, bookingIdsInStays],
        );

        for (const pr of prepaidRows) {
          const pBookingId = Number((pr as any).booking_id);
          const byId =
            Number.isFinite(pBookingId) &&
            bookingIdsInStays.includes(pBookingId)
              ? pBookingId
              : null;
          if (byId != null && !prepaidByBooking.has(byId)) {
            prepaidByBooking.set(byId, {
              payment_id: Number((pr as any).payment_id),
              payment_method: (pr as any).payment_method
                ? String((pr as any).payment_method)
                : null,
              amount: Number((pr as any).amount || 0),
            });
            continue;
          }

          for (const bid of bookingIdsInStays) {
            if (prepaidByBooking.has(bid)) continue;
            if (!noteHasBookingId((pr as any).notes, bid)) continue;
            prepaidByBooking.set(bid, {
              payment_id: Number((pr as any).payment_id),
              payment_method: (pr as any).payment_method
                ? String((pr as any).payment_method)
                : null,
              amount: Number((pr as any).amount || 0),
            });
          }
        }
      }

      const computeOne = async (sr: any) => {
        const stayId = Number(sr.stay_id);
        const roomId = Number(sr.room_id);
        const roomNumber = String(sr.room_number || "").trim();
        const bookingIdRaw = Number(sr.booking_id);
        const bookingId =
          Number.isFinite(bookingIdRaw) && bookingIdRaw > 0
            ? bookingIdRaw
            : null;
        const bookingFinalRaw = Number(sr.booking_final_amount);
        const bookingFinalAmount =
          Number.isFinite(bookingFinalRaw) && bookingFinalRaw > 0
            ? bookingFinalRaw
            : 0;

        const unitPrice = Number(sr.room_unit_price ?? 0);
        const safeUnitPrice =
          Number.isFinite(unitPrice) && unitPrice > 0 ? unitPrice : 0;

        const checkinTime = toDateSafe(sr.checkin_time);
        const expectedCheckout = toDateSafe(sr.expected_checkout);
        if (!checkinTime) {
          throw Object.assign(
            new Error("Thiếu checkin_time để tính tiền theo thời gian thực"),
            { statusCode: 400 },
          );
        }

        let plannedMinutes: number | null = null;
        if (expectedCheckout) {
          const diff = Math.ceil(
            (expectedCheckout.getTime() - checkinTime.getTime()) / 60000,
          );
          if (Number.isFinite(diff) && diff > 0) plannedMinutes = diff;
        }
        if (plannedMinutes == null) {
          try {
            const n = sr.notes ? JSON.parse(String(sr.notes)) : null;
            const daysRaw = n?.stay_days;
            const days = Math.floor(Number(daysRaw));
            if (Number.isFinite(days) && days > 0) {
              plannedMinutes = days * 24 * 60;
            } else {
              const hoursRaw = n?.stay_nights;
              const hours = Math.floor(Number(hoursRaw));
              if (Number.isFinite(hours) && hours > 0)
                plannedMinutes = hours * 60;
            }
          } catch {
            // ignore
          }
        }

        const elapsedMinutes = Math.max(
          1,
          Math.ceil((now.getTime() - checkinTime.getTime()) / 60000),
        );

        const elapsedHoursCeil = Math.max(1, Math.ceil(elapsedMinutes / 60));
        const plannedHoursCeil =
          plannedMinutes != null && plannedMinutes > 0
            ? Math.max(1, Math.ceil(plannedMinutes / 60))
            : null;
        const overtimeHours =
          plannedHoursCeil != null
            ? Math.max(0, elapsedHoursCeil - plannedHoursCeil)
            : 0;
        const surchargeRaw = safeUnitPrice * 0.1 * overtimeHours;
        const surchargeAmount = toMoney(surchargeRaw);

        let roomAmountRaw = 0;
        if (elapsedMinutes < 60) {
          roomAmountRaw = safeUnitPrice * (elapsedMinutes / 60);
        } else {
          if (plannedMinutes != null && plannedMinutes > 0) {
            const withinHours = Math.min(elapsedHoursCeil, plannedHoursCeil!);
            const baseAmount = safeUnitPrice * withinHours;
            const overtimeAmount = safeUnitPrice * 1.1 * overtimeHours;
            roomAmountRaw = baseAmount + overtimeAmount;
          } else {
            roomAmountRaw = safeUnitPrice * elapsedHoursCeil;
          }
        }
        const roomAmount = toMoney(roomAmountRaw);
        const itemsSubtotal = itemsByStay.get(stayId) ?? 0;
        const subtotal = toMoney(roomAmount + itemsSubtotal);
        const prepaidMeta =
          bookingId != null ? prepaidByBooking.get(bookingId) : null;
        const prepaidCandidate = prepaidMeta
          ? bookingFinalAmount > 0
            ? bookingFinalAmount
            : Number.isFinite(Number(prepaidMeta.amount || 0))
              ? Number(prepaidMeta.amount || 0)
              : 0
          : 0;
        const prepaidAmount = toMoney(
          Math.min(subtotal, Math.max(0, prepaidCandidate)),
        );
        const onsiteSubtotal = toMoney(subtotal - prepaidAmount);
        const finalAmount = roundPayableVnd(onsiteSubtotal);

        // guest snapshot
        let guestName: string | null = null;
        let guestPhone: string | null = null;
        const userId = sr.user_id == null ? null : Number(sr.user_id);
        try {
          if (userId != null && Number.isFinite(Number(userId))) {
            const [gRows] = await conn.query<RowDataPacket[]>(
              `SELECT full_name, phone FROM users WHERE user_id = ? LIMIT 1`,
              [userId],
            );
            guestName = gRows[0]?.full_name ? String(gRows[0].full_name) : null;
            guestPhone = gRows[0]?.phone ? String(gRows[0].phone) : null;
          }
        } catch {
          // ignore
        }
        if (!guestName || !guestPhone) {
          try {
            const n = sr.notes ? JSON.parse(String(sr.notes)) : null;
            if (!guestName && n?.guest_full_name)
              guestName = String(n.guest_full_name);
            if (!guestPhone && n?.guest_phone)
              guestPhone = String(n.guest_phone);
          } catch {
            // ignore
          }
        }

        return {
          stay_id: stayId,
          room_id: roomId,
          room_number: roomNumber || null,
          guest_name: guestName,
          guest_phone: guestPhone,
          checkin_time: checkinTime,
          checkout_time: now,
          room_unit_price: safeUnitPrice,
          actual_minutes: elapsedMinutes,
          overtime_hours: overtimeHours,
          surcharge_amount: surchargeAmount,
          items_amount: itemsSubtotal,
          subtotal,
          gross_amount: subtotal,
          prepaid_payment_id: prepaidMeta?.payment_id ?? null,
          prepaid_payment_method: prepaidMeta?.payment_method ?? null,
          prepaid_amount: prepaidAmount,
          onsite_amount: finalAmount,
          total_amount: finalAmount,
        };
      };

      const perRooms = [] as any[];
      for (const sr of stayRows) {
        perRooms.push(await computeOne(sr));
      }

      const LEGACY_DECIMAL10_MAX = 99_999_999.99;
      for (const x of perRooms) {
        if (
          Number(x.subtotal) > LEGACY_DECIMAL10_MAX ||
          Number(x.total_amount) > LEGACY_DECIMAL10_MAX
        ) {
          await conn.rollback();
          res.status(400).json({
            success: false,
            code: "AMOUNT_OUT_OF_RANGE",
            message:
              `Tổng tiền quá lớn để lưu vào DB hiện tại (DECIMAL(10,2) max ${LEGACY_DECIMAL10_MAX}). ` +
              `Vui lòng chạy migration để nâng cột tiền lên DECIMAL(15,2).`,
          });
          return;
        }
      }

      const totalAmount = roundPayableVnd(
        perRooms.reduce((s, x) => s + Number(x.total_amount || 0), 0),
      );

      const baseQrData: any = {
        content: "HOTEL_CHECKOUT_BATCH",
        stay_ids: stayIdsSorted,
        location_id: locationId,
        amount: totalAmount,
        method: pm,
        hotel_invoices: perRooms,
      };

      let transferQr: {
        qr_code_url: string;
        bank_name: string;
        bank_account: string;
        account_holder: string;
        bank_bin: string;
        amount: number;
        note: string;
      } | null = null;

      if (pm === "transfer") {
        // Build VietQR URL from owner_profiles
        const normalizeBankKey = (input: string): string => {
          return input
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]/g, "");
        };
        const bankBinMap: Record<string, string> = {
          vietcombank: "970436",
          vcb: "970436",
          vietinbank: "970415",
          bidv: "970418",
          agribank: "970405",
          mb: "970422",
          mbbank: "970422",
          acb: "970416",
          techcombank: "970407",
          tcb: "970407",
          sacombank: "970403",
          scb: "970429",
          vpbank: "970432",
          tpbank: "970423",
          vib: "970441",
          shb: "970443",
          hdbank: "970437",
          ocb: "970448",
          msb: "970426",
          eximbank: "970431",
          seabank: "970440",
        };

        const [bankRows] = await conn.query<RowDataPacket[]>(
          `SELECT bank_account, bank_name, account_holder
           FROM owner_profiles
           WHERE owner_id = ?
           LIMIT 1`,
          [ownerId],
        );
        const bankAccount = String(bankRows[0]?.bank_account || "").trim();
        const bankName = String(bankRows[0]?.bank_name || "").trim();
        const accountHolder = String(bankRows[0]?.account_holder || "").trim();
        if (!bankAccount || !bankName || !accountHolder) {
          await conn.rollback();
          res.status(400).json({
            success: false,
            message:
              "Owner chưa cập nhật đủ thông tin ngân hàng (bank_account/bank_name/account_holder)",
          });
          return;
        }
        const resolvedBin = bankBinMap[normalizeBankKey(bankName)] || "";
        if (!resolvedBin) {
          await conn.rollback();
          res.status(400).json({
            success: false,
            message:
              "Không xác định được mã BIN ngân hàng từ bank_name. Vui lòng cập nhật bank_name hợp lệ.",
          });
          return;
        }

        const qrNote = locationName
          ? `${locationName} - Cảm ơn quý khách`
          : "Cảm ơn quý khách";
        const qrAmount = Math.max(0, Math.round(Number(totalAmount || 0)));
        const qrCodeUrl = `https://img.vietqr.io/image/${resolvedBin}-${encodeURIComponent(
          bankAccount,
        )}-qr_only.png?amount=${encodeURIComponent(String(qrAmount))}&addInfo=${encodeURIComponent(
          qrNote,
        )}`;

        transferQr = {
          qr_code_url: qrCodeUrl,
          bank_name: bankName,
          bank_account: bankAccount,
          account_holder: accountHolder,
          bank_bin: resolvedBin,
          amount: qrAmount,
          note: qrNote,
        };
        baseQrData.bank = transferQr;
      }

      const support = await getPaymentsSchemaSupport();
      const staff = await getUserSnapshotWithConn(conn, auth.userId);

      if (flowStep === "init") {
        if (pm === "cash") {
          await conn.commit();
          res.json({
            success: true,
            data: {
              context: {
                location_name: locationName || null,
                owner_name: ownerName || null,
                rooms: perRooms.map((x) => ({
                  stay_id: x.stay_id,
                  room_number: x.room_number,
                  checkin_time: x.checkin_time,
                  checkout_time: x.checkout_time,
                  room_unit_price: x.room_unit_price,
                  actual_minutes: x.actual_minutes,
                  overtime_hours: x.overtime_hours,
                  surcharge_amount: x.surcharge_amount,
                  gross_amount: x.gross_amount,
                  prepaid_payment_method: x.prepaid_payment_method,
                  prepaid_amount: x.prepaid_amount,
                  onsite_amount: x.onsite_amount,
                  total_amount: x.total_amount,
                })),
                total_amount: totalAmount,
              },
            },
          });
          return;
        }

        // reuse existing pending payment if any
        const [pendingRows] = await conn.query<RowDataPacket[]>(
          `SELECT payment_id
           FROM payments
           WHERE location_id = ?
             AND status = 'pending'
             AND notes = ?
           ORDER BY payment_id DESC
           LIMIT 1
           FOR UPDATE`,
          [locationId, noteKey],
        );

        let paymentId: number;
        if (pendingRows[0]?.payment_id) {
          paymentId = Number(pendingRows[0].payment_id);
          const setParts: string[] = [
            "amount = ?",
            "owner_receivable = ?",
            "qr_data = ?",
            "payment_method = ?",
          ];
          const setParams: any[] = [
            totalAmount,
            totalAmount,
            JSON.stringify(baseQrData),
            "BankTransfer",
          ];
          if (support.hasPerformedByUserId) {
            setParts.push("performed_by_user_id = ?");
            setParams.push(auth.userId);
          }
          if (support.hasPerformedByRole) {
            setParts.push("performed_by_role = ?");
            setParams.push(auth.role);
          }
          if (support.hasPerformedByName) {
            setParts.push("performed_by_name = ?");
            setParams.push(staff.full_name || null);
          }
          setParams.push(paymentId);
          await conn.query(
            `UPDATE payments SET ${setParts.join(", ")} WHERE payment_id = ?`,
            setParams,
          );
        } else {
          const columns = [
            "user_id",
            "location_id",
            "booking_id",
            "amount",
            "commission_rate",
            "commission_amount",
            "vat_rate",
            "vat_amount",
            "owner_receivable",
            "payment_method",
            "transaction_code",
            "qr_data",
            "status",
            "notes",
          ];
          const values = [
            "NULL",
            "?",
            "NULL",
            "?",
            "0.00",
            "0.00",
            "0.00",
            "0.00",
            "?",
            "?",
            "NULL",
            "?",
            "?",
            "?",
          ];
          const params: any[] = [
            locationId,
            totalAmount,
            totalAmount,
            "BankTransfer",
            JSON.stringify(baseQrData),
            "pending",
            noteKey,
          ];
          if (support.hasPerformedByUserId) {
            columns.push("performed_by_user_id");
            values.push("?");
            params.push(auth.userId);
          }
          if (support.hasPerformedByRole) {
            columns.push("performed_by_role");
            values.push("?");
            params.push(auth.role);
          }
          if (support.hasPerformedByName) {
            columns.push("performed_by_name");
            values.push("?");
            params.push(staff.full_name || null);
          }

          const [paymentInsert] = await conn.query<ResultSetHeader>(
            `INSERT INTO payments (\n          ${columns.join(", ")}\n        ) VALUES (${values.join(", ")})`,
            params,
          );
          paymentId = paymentInsert.insertId;
        }

        await conn.commit();
        res.json({
          success: true,
          data: {
            payment_id: paymentId,
            qr: transferQr,
            context: {
              location_name: locationName || null,
              owner_name: ownerName || null,
              rooms: perRooms.map((x) => ({
                stay_id: x.stay_id,
                room_number: x.room_number,
                checkin_time: x.checkin_time,
                checkout_time: x.checkout_time,
                room_unit_price: x.room_unit_price,
                actual_minutes: x.actual_minutes,
                overtime_hours: x.overtime_hours,
                surcharge_amount: x.surcharge_amount,
                gross_amount: x.gross_amount,
                prepaid_payment_method: x.prepaid_payment_method,
                prepaid_amount: x.prepaid_amount,
                onsite_amount: x.onsite_amount,
                total_amount: x.total_amount,
              })),
              total_amount: totalAmount,
            },
          },
        });
        return;
      }

      // complete
      let pid: number;

      if (pm === "transfer") {
        pid = Number(payment_id);
        if (!Number.isFinite(pid)) {
          await conn.rollback();
          res
            .status(400)
            .json({ success: false, message: "payment_id không hợp lệ" });
          return;
        }

        const [payRows] = await conn.query<RowDataPacket[]>(
          `SELECT payment_id, location_id, status, notes
           FROM payments
           WHERE payment_id = ?
           LIMIT 1
           FOR UPDATE`,
          [pid],
        );
        if (!payRows[0]) {
          await conn.rollback();
          res
            .status(404)
            .json({ success: false, message: "Không tìm thấy payment" });
          return;
        }
        if (Number(payRows[0].location_id) !== locationId) {
          await conn.rollback();
          res.status(400).json({
            success: false,
            message: "Payment không thuộc location hiện tại",
          });
          return;
        }
        if (String(payRows[0].notes || "") !== noteKey) {
          await conn.rollback();
          res.status(400).json({
            success: false,
            message: "Payment không khớp danh sách stay",
          });
          return;
        }
        if (String(payRows[0].status || "") !== "pending") {
          await conn.rollback();
          res.status(400).json({
            success: false,
            message: "Payment không ở trạng thái pending",
          });
          return;
        }

        const setParts: string[] = [
          "status = 'completed'",
          "amount = ?",
          "owner_receivable = ?",
          "payment_method = ?",
          "qr_data = ?",
        ];
        const setParams: any[] = [
          totalAmount,
          totalAmount,
          "BankTransfer",
          JSON.stringify(baseQrData),
        ];
        if (support.hasPerformedByUserId) {
          setParts.push("performed_by_user_id = ?");
          setParams.push(auth.userId);
        }
        if (support.hasPerformedByRole) {
          setParts.push("performed_by_role = ?");
          setParams.push(auth.role);
        }
        if (support.hasPerformedByName) {
          setParts.push("performed_by_name = ?");
          setParams.push(staff.full_name || null);
        }
        setParams.push(pid);
        await conn.query(
          `UPDATE payments SET ${setParts.join(", ")} WHERE payment_id = ?`,
          setParams,
        );
      } else {
        const hasSingleUser =
          new Set(
            stayRows
              .map((x) => (x.user_id == null ? null : Number(x.user_id)))
              .filter((x) => x != null && Number.isFinite(x) && x > 0),
          ).size === 1;

        const uniqueUserId = hasSingleUser
          ? Number(
              stayRows.find(
                (x) => x.user_id != null && Number.isFinite(Number(x.user_id)),
              )?.user_id,
            )
          : null;

        const columns = [
          "user_id",
          "location_id",
          "booking_id",
          "amount",
          "commission_rate",
          "commission_amount",
          "vat_rate",
          "vat_amount",
          "owner_receivable",
          "payment_method",
          "transaction_code",
          "qr_data",
          "status",
          "notes",
        ];
        const values = [
          uniqueUserId != null ? "?" : "NULL",
          "?",
          "NULL",
          "?",
          "0.00",
          "0.00",
          "0.00",
          "0.00",
          "?",
          "?",
          "NULL",
          "?",
          "?",
          "?",
        ];
        const params: any[] = [];
        if (uniqueUserId != null) params.push(uniqueUserId);
        params.push(
          locationId,
          totalAmount,
          totalAmount,
          "Cash",
          JSON.stringify(baseQrData),
          "completed",
          noteKey,
        );
        if (support.hasPerformedByUserId) {
          columns.push("performed_by_user_id");
          values.push("?");
          params.push(auth.userId);
        }
        if (support.hasPerformedByRole) {
          columns.push("performed_by_role");
          values.push("?");
          params.push(auth.role);
        }
        if (support.hasPerformedByName) {
          columns.push("performed_by_name");
          values.push("?");
          params.push(staff.full_name || null);
        }

        const [paymentInsert] = await conn.query<ResultSetHeader>(
          `INSERT INTO payments (\n          ${columns.join(", ")}\n        ) VALUES (${values.join(", ")})`,
          params,
        );
        pid = paymentInsert.insertId;
      }

      // Update stays & rooms
      for (const x of perRooms) {
        await conn.query(
          `UPDATE hotel_stays
           SET subtotal_amount = ?, discount_amount = 0.00, final_amount = ?,
               status = 'checked_out', checkout_time = ?, closed_by = ?
           WHERE stay_id = ?`,
          [x.subtotal, x.total_amount, now, auth.userId, x.stay_id],
        );
      }
      const roomIds = perRooms
        .map((x) => Number(x.room_id))
        .filter((x) => Number.isFinite(x) && x > 0);
      if (roomIds.length > 0) {
        await conn.query(
          `UPDATE hotel_rooms SET status = 'cleaning' WHERE room_id IN (?)`,
          [roomIds],
        );
      }

      await conn.commit();

      for (const x of perRooms) {
        await publishHotelUpdated(conn, locationId, ownerId, {
          stay_id: x.stay_id,
          room_id: x.room_id,
        });
      }

      await logAudit(auth.userId, "HOTEL_STAY_CHECKOUT_BATCH", {
        stay_ids: stayIdsSorted,
        location_id: locationId,
        payment_id: pid,
        amount: totalAmount,
        payment_method: pm,
        timestamp: new Date(),
      });

      res.json({
        success: true,
        data: {
          invoice: {
            payment_id: pid,
            location_name: locationName || null,
            owner_name: ownerName || null,
            payment_time: now,
            rooms: perRooms.map((x) => ({
              stay_id: x.stay_id,
              room_number: x.room_number,
              checkin_time: x.checkin_time,
              checkout_time: x.checkout_time,
              room_unit_price: x.room_unit_price,
              actual_minutes: x.actual_minutes,
              overtime_hours: x.overtime_hours,
              surcharge_amount: x.surcharge_amount,
              gross_amount: x.gross_amount,
              prepaid_payment_method: x.prepaid_payment_method,
              prepaid_amount: x.prepaid_amount,
              onsite_amount: x.onsite_amount,
              total_amount: x.total_amount,
            })),
            total_amount: totalAmount,
          },
        },
      });
      return;
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
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

// -------------------- RESTAURANT/CAFE (areas / tables / orders) --------------------

export const getPosAreas = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    const locationId = Number((req.query as any).location_id);
    if (!Number.isFinite(locationId)) {
      res
        .status(400)
        .json({ success: false, message: "location_id không hợp lệ" });
      return;
    }
    await ensureLocationAccess({ auth, locationId });

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT area_id, area_name, sort_order
       FROM pos_areas
       WHERE location_id = ?
       ORDER BY sort_order ASC, area_id ASC`,
      [locationId],
    );
    res.json({ success: true, data: rows });
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const createPosArea = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    if (auth.role !== "owner") {
      res.status(403).json({ success: false, message: "Chỉ owner được phép" });
      return;
    }
    const { location_id, area_name, sort_order } = req.body as {
      location_id?: number;
      area_name?: string;
      sort_order?: number;
    };

    const locationId = Number(location_id);
    const name = String(area_name || "").trim();
    const sort = Number.isFinite(Number(sort_order)) ? Number(sort_order) : 0;
    if (!Number.isFinite(locationId) || !name) {
      res
        .status(400)
        .json({ success: false, message: "Thiếu location_id/area_name" });
      return;
    }

    await ensureLocationAccess({ auth, locationId });
    const [insert] = await pool.query<ResultSetHeader>(
      `INSERT INTO pos_areas (location_id, area_name, sort_order) VALUES (?, ?, ?)`,
      [locationId, name, sort],
    );

    await publishPosUpdated(pool, locationId, auth.userId, {
      action: "area_created",
      area_id: insert.insertId,
    });
    res.status(201).json({ success: true, data: { area_id: insert.insertId } });
  } catch (error: any) {
    const msg = String(error?.message || "");
    if (msg.includes("Duplicate")) {
      res.status(409).json({ success: false, message: "Khu vực đã tồn tại" });
      return;
    }
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const updatePosArea = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    if (auth.role !== "owner") {
      res.status(403).json({ success: false, message: "Chỉ owner được phép" });
      return;
    }

    const areaId = Number(req.params.areaId);
    if (!Number.isFinite(areaId)) {
      res.status(400).json({ success: false, message: "areaId không hợp lệ" });
      return;
    }

    const body = req.body as { area_name?: string; sort_order?: number };
    const updates: string[] = [];
    const params: any[] = [];

    if ("area_name" in body) {
      const name = String(body.area_name || "").trim();
      if (!name) {
        res
          .status(400)
          .json({ success: false, message: "area_name không hợp lệ" });
        return;
      }
      updates.push("area_name = ?");
      params.push(name);
    }
    if ("sort_order" in body) {
      const sort = Number(body.sort_order);
      if (!Number.isFinite(sort)) {
        res
          .status(400)
          .json({ success: false, message: "sort_order không hợp lệ" });
        return;
      }
      updates.push("sort_order = ?");
      params.push(sort);
    }

    if (updates.length === 0) {
      res
        .status(400)
        .json({ success: false, message: "Không có dữ liệu cập nhật" });
      return;
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT location_id FROM pos_areas WHERE area_id = ? LIMIT 1`,
      [areaId],
    );
    if (!rows[0]) {
      res.status(404).json({ success: false, message: "Không tìm thấy khu" });
      return;
    }
    const locationId = Number(rows[0].location_id);
    await ensureLocationAccess({ auth, locationId });

    params.push(areaId);
    await pool.query(
      `UPDATE pos_areas SET ${updates.join(", ")} WHERE area_id = ?`,
      params,
    );

    await publishPosUpdated(pool, locationId, auth.userId, {
      action: "area_updated",
      area_id: areaId,
    });

    res.json({ success: true, message: "Cập nhật khu thành công" });
  } catch (error: any) {
    const msg = String(error?.message || "");
    if (msg.includes("Duplicate")) {
      res.status(409).json({ success: false, message: "Khu vực đã tồn tại" });
      return;
    }
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const deletePosArea = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    if (auth.role !== "owner") {
      res.status(403).json({ success: false, message: "Chỉ owner được phép" });
      return;
    }

    const areaId = Number(req.params.areaId);
    if (!Number.isFinite(areaId)) {
      res.status(400).json({ success: false, message: "areaId không hợp lệ" });
      return;
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT location_id FROM pos_areas WHERE area_id = ? LIMIT 1`,
      [areaId],
    );
    if (!rows[0]) {
      res.status(404).json({ success: false, message: "Không tìm thấy khu" });
      return;
    }
    const locationId = Number(rows[0].location_id);
    await ensureLocationAccess({ auth, locationId });

    await pool.query(`DELETE FROM pos_areas WHERE area_id = ?`, [areaId]);

    await publishPosUpdated(pool, locationId, auth.userId, {
      action: "area_deleted",
      area_id: areaId,
    });

    res.json({
      success: true,
      message: "Đã xóa khu (các bàn thuộc khu sẽ tự chuyển sang khu = NULL)",
    });
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const getPosTables = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    await ensureBookingTableReservationsSchema();

    const auth = await getAuth(req);
    const { location_id, area_id } = req.query as {
      location_id?: string;
      area_id?: string;
    };
    const locationId = Number(location_id);
    if (!Number.isFinite(locationId)) {
      res
        .status(400)
        .json({ success: false, message: "location_id không hợp lệ" });
      return;
    }
    await ensureLocationAccess({ auth, locationId });

    const hasOrderSourceColumn = await getPosOrdersHasOrderSourceColumn();

    const params: any[] = [locationId];
    let whereArea = "";
    if (area_id && area_id !== "all") {
      const aid = Number(area_id);
      if (Number.isFinite(aid)) {
        whereArea = " AND t.area_id = ?";
        params.push(aid);
      }
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
         t.table_id,
         t.location_id,
         t.area_id,
         t.table_name,
         t.shape,
         t.pos_x,
         t.pos_y,
         CASE
           WHEN t.status = 'occupied' THEN 'occupied'
           WHEN o_non_booking.order_id IS NOT NULL AND COALESCE(oi_non_booking.total_qty, 0) > 0 THEN 'occupied'
           WHEN r_current.reservation_status = 'active' THEN 'reserved'
           WHEN t.status = 'reserved' THEN 'reserved'
           ELSE 'free'
         END AS status,
         CASE
           WHEN t.status = 'occupied' OR r_current.reservation_id IS NOT NULL
             THEN COALESCE(o_non_booking.order_id, o_booking.order_id)
           ELSE o_non_booking.order_id
         END AS order_id,
         CASE
           WHEN t.status = 'occupied' OR r_current.reservation_id IS NOT NULL
             THEN COALESCE(o_non_booking.final_amount, o_booking.final_amount)
           ELSE o_non_booking.final_amount
         END AS final_amount,
         rb.booking_id AS reservation_booking_id,
         rb.contact_name AS reservation_contact_name,
         rb.contact_phone AS reservation_contact_phone,
         rb.check_in_date AS reservation_check_in_date,
         rb.notes AS reservation_notes
       FROM pos_tables t
       LEFT JOIN (
         SELECT table_id,
                MAX(reservation_id) AS reservation_id,
                SUBSTRING_INDEX(
                  GROUP_CONCAT(status ORDER BY start_time DESC, reservation_id DESC),
                  ',',
                  1
                ) AS reservation_status
         FROM booking_table_reservations
         WHERE location_id = ?
           AND status IN ('active', 'checked_in')
           AND actual_end_time IS NULL
           AND NOW() BETWEEN DATE_SUB(start_time, INTERVAL 1 HOUR) AND DATE_ADD(start_time, INTERVAL 1 HOUR)
         GROUP BY table_id
       ) r_current
         ON r_current.table_id = t.table_id
       LEFT JOIN booking_table_reservations r_meta
         ON r_meta.reservation_id = r_current.reservation_id
       LEFT JOIN bookings rb
         ON rb.booking_id = r_meta.booking_id
       LEFT JOIN pos_orders o_non_booking
         ON o_non_booking.order_id = (
           SELECT MAX(o2.order_id)
           FROM pos_orders o2
           WHERE o2.table_id = t.table_id
             AND o2.status = 'open'
             ${hasOrderSourceColumn ? "AND (o2.order_source IS NULL OR o2.order_source <> 'online_booking')" : ""}
         )
       LEFT JOIN pos_orders o_booking
         ON o_booking.order_id = (
           SELECT MAX(o3.order_id)
           FROM pos_orders o3
           WHERE o3.table_id = t.table_id
             AND o3.status = 'open'
             ${hasOrderSourceColumn ? "AND o3.order_source = 'online_booking'" : ""}
         )
       LEFT JOIN (
         SELECT order_id, COALESCE(SUM(quantity), 0) AS total_qty
         FROM pos_order_items
         GROUP BY order_id
       ) oi_non_booking
         ON oi_non_booking.order_id = o_non_booking.order_id
       WHERE t.location_id = ?
         ${whereArea}
       ORDER BY t.table_name ASC`,
      [locationId, ...params],
    );

    res.json({ success: true, data: rows });
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const createPosTable = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    if (auth.role !== "owner") {
      res.status(403).json({ success: false, message: "Chỉ owner được phép" });
      return;
    }
    const { location_id, area_id, table_name, shape } = req.body as {
      location_id?: number;
      area_id?: number | null;
      table_name?: string;
      shape?: string;
    };

    const locationId = Number(location_id);
    const areaId =
      area_id === null || typeof area_id === "undefined"
        ? null
        : Number(area_id);
    const tableName = String(table_name || "").trim();
    const tableShape = String(shape || "square");

    if (!Number.isFinite(locationId) || !tableName) {
      res
        .status(400)
        .json({ success: false, message: "Thiếu location_id/table_name" });
      return;
    }
    if (!["square", "round"].includes(tableShape)) {
      res.status(400).json({ success: false, message: "shape không hợp lệ" });
      return;
    }

    await ensureLocationAccess({ auth, locationId });

    const [insert] = await pool.query<ResultSetHeader>(
      `INSERT INTO pos_tables (location_id, area_id, table_name, shape, status)
       VALUES (?, ?, ?, ?, 'free')`,
      [locationId, areaId, tableName, tableShape],
    );

    await publishPosUpdated(pool, locationId, auth.userId, {
      action: "table_created",
      table_id: insert.insertId,
    });

    res
      .status(201)
      .json({ success: true, data: { table_id: insert.insertId } });
  } catch (error: any) {
    const msg = String(error?.message || "");
    if (msg.includes("Duplicate")) {
      res.status(409).json({ success: false, message: "Bàn đã tồn tại" });
      return;
    }
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const updatePosTable = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    if (auth.role !== "owner") {
      res.status(403).json({ success: false, message: "Chỉ owner được phép" });
      return;
    }

    const tableId = Number(req.params.tableId);
    if (!Number.isFinite(tableId)) {
      res.status(400).json({ success: false, message: "tableId không hợp lệ" });
      return;
    }

    const [tRows] = await pool.query<RowDataPacket[]>(
      `SELECT location_id FROM pos_tables WHERE table_id = ? LIMIT 1`,
      [tableId],
    );
    if (!tRows[0]) {
      res.status(404).json({ success: false, message: "Không tìm thấy bàn" });
      return;
    }

    const locationId = Number(tRows[0].location_id);
    await ensureLocationAccess({ auth, locationId });

    const body = req.body as {
      area_id?: number | null;
      table_name?: string;
      shape?: string;
    };

    const updates: string[] = [];
    const params: any[] = [];

    if ("area_id" in body) {
      const areaId =
        body.area_id === null || typeof body.area_id === "undefined"
          ? null
          : Number(body.area_id);
      if (areaId !== null && !Number.isFinite(areaId)) {
        res
          .status(400)
          .json({ success: false, message: "area_id không hợp lệ" });
        return;
      }
      updates.push("area_id = ?");
      params.push(areaId);
    }

    if ("table_name" in body) {
      const name = String(body.table_name || "").trim();
      if (!name) {
        res
          .status(400)
          .json({ success: false, message: "table_name không hợp lệ" });
        return;
      }
      updates.push("table_name = ?");
      params.push(name);
    }

    if ("shape" in body) {
      const shape = String(body.shape || "").trim();
      if (!shape || !["square", "round"].includes(shape)) {
        res.status(400).json({ success: false, message: "shape không hợp lệ" });
        return;
      }
      updates.push("shape = ?");
      params.push(shape);
    }

    if (updates.length === 0) {
      res
        .status(400)
        .json({ success: false, message: "Không có dữ liệu cập nhật" });
      return;
    }

    params.push(tableId);
    await pool.query(
      `UPDATE pos_tables SET ${updates.join(", ")} WHERE table_id = ?`,
      params,
    );

    await publishPosUpdated(pool, locationId, auth.userId, {
      action: "table_updated",
      table_id: tableId,
    });

    res.json({ success: true, message: "Cập nhật bàn thành công" });
  } catch (error: any) {
    const msg = String(error?.message || "");
    if (msg.includes("Duplicate")) {
      res.status(409).json({ success: false, message: "Bàn đã tồn tại" });
      return;
    }
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const updatePosTablePosition = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    if (auth.role !== "owner") {
      res.status(403).json({ success: false, message: "Chỉ owner được phép" });
      return;
    }

    const tableId = Number(req.params.tableId);
    const { pos_x, pos_y } = req.body as {
      pos_x?: number;
      pos_y?: number;
    };

    if (!Number.isFinite(tableId)) {
      res.status(400).json({ success: false, message: "tableId không hợp lệ" });
      return;
    }

    const x = Number(pos_x);
    const y = Number(pos_y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      res
        .status(400)
        .json({ success: false, message: "pos_x/pos_y không hợp lệ" });
      return;
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT table_id, location_id
       FROM pos_tables
       WHERE table_id = ?
       LIMIT 1`,
      [tableId],
    );
    if (!rows[0]) {
      res.status(404).json({ success: false, message: "Không tìm thấy bàn" });
      return;
    }

    const locationId = Number(rows[0].location_id);
    await ensureLocationAccess({ auth, locationId });

    await pool.query(
      `UPDATE pos_tables SET pos_x = ?, pos_y = ? WHERE table_id = ?`,
      [Math.round(x), Math.round(y), tableId],
    );

    await publishPosUpdated(pool, locationId, auth.userId, {
      action: "table_position_updated",
      table_id: tableId,
    });

    res.json({ success: true });
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const deletePosTable = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    if (auth.role !== "owner") {
      res.status(403).json({ success: false, message: "Chỉ owner được phép" });
      return;
    }

    const tableId = Number(req.params.tableId);
    if (!Number.isFinite(tableId)) {
      res.status(400).json({ success: false, message: "tableId không hợp lệ" });
      return;
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT table_id, location_id
       FROM pos_tables
       WHERE table_id = ?
       LIMIT 1`,
      [tableId],
    );
    if (!rows[0]) {
      res.status(404).json({ success: false, message: "Không tìm thấy bàn" });
      return;
    }

    const locationId = Number(rows[0].location_id);
    await ensureLocationAccess({ auth, locationId });

    const [openRows] = await pool.query<RowDataPacket[]>(
      `SELECT order_id
       FROM pos_orders
       WHERE table_id = ? AND status = 'open'
       LIMIT 1`,
      [tableId],
    );
    if (openRows[0]) {
      res.status(400).json({
        success: false,
        message: "Bàn đang có order mở. Vui lòng thanh toán/huỷ trước khi xóa.",
      });
      return;
    }

    await pool.query(`DELETE FROM pos_tables WHERE table_id = ?`, [tableId]);

    await publishPosUpdated(pool, locationId, auth.userId, {
      action: "table_deleted",
      table_id: tableId,
    });

    res.json({ success: true, message: "Đã xóa bàn" });
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const getPosMenu = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    const locationId = Number((req.query as any).location_id);
    if (!Number.isFinite(locationId)) {
      res
        .status(400)
        .json({ success: false, message: "location_id không hợp lệ" });
      return;
    }

    await ensureLocationAccess({ auth, locationId });

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
         s.service_id,
         s.service_name,
         s.service_type,
         s.price,
         s.status,
         s.images,
         COALESCE(c.category_name, s.pos_group) AS pos_group,
         s.pos_sort,
         s.category_id,
         c.category_name
       FROM services s
       LEFT JOIN service_categories c
         ON c.category_id = s.category_id AND c.deleted_at IS NULL
       WHERE s.location_id = ?
         AND s.deleted_at IS NULL
         AND s.admin_status = 'approved'
         AND s.service_type IN ('food','combo','other')
         AND s.status IN ('available','reserved')
       ORDER BY COALESCE(c.sort_order, 9999) ASC, COALESCE(c.category_name,'') ASC,
                COALESCE(s.pos_sort, 9999) ASC, s.service_id ASC`,
      [locationId],
    );
    res.json({ success: true, data: rows });
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const openPosTable = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    const tableId = Number(req.params.tableId);
    if (!Number.isFinite(tableId)) {
      res.status(400).json({ success: false, message: "tableId không hợp lệ" });
      return;
    }

    // IMPORTANT: do access checks BEFORE opening a transaction connection.
    // Otherwise, if the pool is small, calling pool.query while holding conn can hang.
    const [tPreRows] = await pool.query<RowDataPacket[]>(
      `SELECT location_id FROM pos_tables WHERE table_id = ? LIMIT 1`,
      [tableId],
    );
    if (!tPreRows[0]) {
      res.status(404).json({ success: false, message: "Không tìm thấy bàn" });
      return;
    }
    const preLocationId = Number(tPreRows[0].location_id);
    const { ownerId } = await ensureLocationAccess({
      auth,
      locationId: preLocationId,
      requiredPermission:
        auth.role === "employee" ? "can_manage_bookings" : undefined,
    });

    const hasOrderSourceColumn = await getPosOrdersHasOrderSourceColumn();

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [tRows] = await conn.query<RowDataPacket[]>(
        `SELECT table_id, location_id, status
         FROM pos_tables
         WHERE table_id = ?
         LIMIT 1
         FOR UPDATE`,
        [tableId],
      );
      if (!tRows[0]) {
        await conn.rollback();
        res.status(404).json({ success: false, message: "Không tìm thấy bàn" });
        return;
      }

      const locationId = Number(tRows[0].location_id);

      const tableStatus = String(tRows[0].status || "");
      const [openOrders] = await conn.query<RowDataPacket[]>(
        `SELECT order_id FROM pos_orders
         WHERE table_id = ?
           AND status = 'open'
           AND (
             ${hasOrderSourceColumn ? "order_source IS NULL OR order_source <> 'online_booking' OR ? IN ('occupied','reserved')" : "? IN ('occupied','reserved')"}
           )
         ORDER BY order_id DESC
         LIMIT 1
         FOR UPDATE`,
        [tableId, tableStatus],
      );
      if (openOrders[0]) {
        await conn.commit();
        res.json({ success: true, data: { order_id: openOrders[0].order_id } });
        return;
      }
      const orderSource: "online_booking" | "onsite_pos" =
        tableStatus === "reserved" ? "online_booking" : "onsite_pos";

      const [insert] = hasOrderSourceColumn
        ? await conn.query<ResultSetHeader>(
            `INSERT INTO pos_orders (location_id, table_id, status, order_source, subtotal_amount, discount_amount, final_amount, created_by)
             VALUES (?, ?, 'open', ?, 0.00, 0.00, 0.00, ?)`,
            [locationId, tableId, orderSource, auth.userId],
          )
        : await conn.query<ResultSetHeader>(
            `INSERT INTO pos_orders (location_id, table_id, status, subtotal_amount, discount_amount, final_amount, created_by)
             VALUES (?, ?, 'open', 0.00, 0.00, 0.00, ?)`,
            [locationId, tableId, auth.userId],
          );

      await conn.commit();
      await publishPosUpdated(conn, locationId, ownerId, {
        action: "order_opened",
        table_id: tableId,
        order_id: insert.insertId,
      });
      res
        .status(201)
        .json({ success: true, data: { order_id: insert.insertId } });
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
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const reservePosTable = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    const tableId = Number(req.params.tableId);
    if (!Number.isFinite(tableId)) {
      res.status(400).json({ success: false, message: "tableId không hợp lệ" });
      return;
    }
    const [tRows] = await pool.query<RowDataPacket[]>(
      `SELECT location_id, status FROM pos_tables WHERE table_id = ? LIMIT 1`,
      [tableId],
    );
    if (!tRows[0]) {
      res.status(404).json({ success: false, message: "Không tìm thấy bàn" });
      return;
    }
    const locationId = Number(tRows[0].location_id);
    const { ownerId } = await ensureLocationAccess({
      auth,
      locationId,
      requiredPermission:
        auth.role === "employee" ? "can_manage_bookings" : undefined,
    });
    await pool.query(
      `UPDATE pos_tables SET status = 'reserved' WHERE table_id = ? AND status = 'free'`,
      [tableId],
    );

    await publishPosUpdated(pool, locationId, ownerId, {
      action: "table_reserved",
      table_id: tableId,
    });
    res.json({ success: true });
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const arrivePosTable = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    await ensureBookingTableReservationsSchema();

    const auth = await getAuth(req);
    const tableId = Number(req.params.tableId);
    if (!Number.isFinite(tableId)) {
      res.status(400).json({ success: false, message: "tableId không hợp lệ" });
      return;
    }

    // Access checks before tx connection
    const [tPreRows] = await pool.query<RowDataPacket[]>(
      `SELECT location_id FROM pos_tables WHERE table_id = ? LIMIT 1`,
      [tableId],
    );
    if (!tPreRows[0]) {
      res.status(404).json({ success: false, message: "Không tìm thấy bàn" });
      return;
    }
    const preLocationId = Number(tPreRows[0].location_id);
    const { ownerId } = await ensureLocationAccess({
      auth,
      locationId: preLocationId,
      requiredPermission:
        auth.role === "employee" ? "can_manage_bookings" : undefined,
    });

    const hasOrderSourceColumn = await getPosOrdersHasOrderSourceColumn();

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [tRows] = await conn.query<RowDataPacket[]>(
        `SELECT table_id, location_id, status
         FROM pos_tables
         WHERE table_id = ?
         LIMIT 1
         FOR UPDATE`,
        [tableId],
      );
      if (!tRows[0]) {
        await conn.rollback();
        res.status(404).json({ success: false, message: "Không tìm thấy bàn" });
        return;
      }

      const locationId = Number(tRows[0].location_id);
      const status = String(tRows[0].status || "");

      // Find latest active table booking for this reserved table (if any)
      const [bRows] = await conn.query<RowDataPacket[]>(
        `SELECT b.booking_id, b.user_id, b.pos_order_id
         FROM booking_table_reservations r
         JOIN bookings b ON b.booking_id = r.booking_id
         JOIN services s ON s.service_id = b.service_id
         WHERE r.table_id = ?
           AND r.location_id = ?
           AND r.status = 'active'
           AND r.actual_end_time IS NULL
           AND NOW() BETWEEN DATE_SUB(r.start_time, INTERVAL 1 HOUR) AND DATE_ADD(r.start_time, INTERVAL 1 HOUR)
           AND s.service_type = 'table'
           AND b.status IN ('pending','confirmed')
         ORDER BY r.start_time ASC, r.reservation_id ASC
         LIMIT 1
         FOR UPDATE`,
        [tableId, locationId],
      );
      const booking = Array.isArray(bRows) ? (bRows[0] as any) : null;
      const bookingId = booking ? Number(booking.booking_id) : null;
      const bookingUserId = booking ? Number(booking.user_id) : null;
      const preorderOrderIdRaw = booking ? booking.pos_order_id : null;
      const preorderOrderId =
        preorderOrderIdRaw == null ? null : Number(preorderOrderIdRaw);

      // If this is a booking-backed reservation, mark all its tables occupied.
      if (bookingId && Number.isFinite(bookingId)) {
        const paymentsSupport = await getPaymentsSchemaSupport();
        const staff = await getUserSnapshotWithConn(conn, auth.userId);
        const [btRows] = await conn.query<RowDataPacket[]>(
          `SELECT table_id
           FROM booking_table_reservations
           WHERE booking_id = ?
           FOR UPDATE`,
          [bookingId],
        );
        const bookingTableIds = (Array.isArray(btRows) ? btRows : [])
          .map((r: any) => Number(r.table_id))
          .filter((n: number) => Number.isFinite(n) && n > 0);
        if (bookingTableIds.length > 0) {
          const placeholders = bookingTableIds.map(() => "?").join(",");
          await conn.query(
            `UPDATE pos_tables
             SET status = 'occupied'
             WHERE location_id = ?
               AND table_id IN (${placeholders})
               AND status <> 'occupied'`,
            [locationId, ...bookingTableIds],
          );
          await conn.query(
            `UPDATE booking_table_reservations
             SET status = 'checked_in',
                 checked_in_at = NOW(),
                 updated_at = CURRENT_TIMESTAMP
             WHERE booking_id = ?
               AND status = 'active'`,
            [bookingId],
          );
        }

        // Create a verified checkin record for the booking user.
        if (bookingUserId && Number.isFinite(bookingUserId)) {
          await conn.query(
            `INSERT INTO checkins (user_id, location_id, booking_id, status, verified_by, notes)
             VALUES (?, ?, ?, 'verified', ?, ?)`,
            [
              bookingUserId,
              locationId,
              bookingId,
              auth.userId,
              "Check-in đặt bàn",
            ],
          );
        }

        // Close prepaid preorder order (so it won't be paid twice)
        let primaryTableIdForExtras: number = tableId;
        let bookingTableNames: string | null = null;
        if (bookingTableIds.length > 0) {
          const placeholders = bookingTableIds.map(() => "?").join(",");
          const [tableNameRows] = await conn.query<RowDataPacket[]>(
            `SELECT table_name
             FROM pos_tables
             WHERE table_id IN (${placeholders})
             ORDER BY table_name ASC`,
            bookingTableIds,
          );
          const names = (Array.isArray(tableNameRows) ? tableNameRows : [])
            .map((row: any) => String(row.table_name || "").trim())
            .filter(Boolean);
          bookingTableNames = names.length > 0 ? names.join(", ") : null;
        }

        if (preorderOrderId && Number.isFinite(preorderOrderId)) {
          const [oRows] = await conn.query<RowDataPacket[]>(
            `SELECT order_id, table_id, status
             FROM pos_orders
             WHERE order_id = ?
             LIMIT 1
             FOR UPDATE`,
            [preorderOrderId],
          );
          if (oRows[0]) {
            const otid = oRows[0].table_id;
            const oTableId = otid == null ? null : Number(otid);
            if (oTableId && Number.isFinite(oTableId))
              primaryTableIdForExtras = oTableId;

            const oStatus = String(oRows[0].status || "");
            const [itemRows] = await conn.query<RowDataPacket[]>(
              `SELECT oi.service_id, s.service_name, oi.quantity, oi.unit_price, oi.line_total
               FROM pos_order_items oi
               JOIN services s ON s.service_id = oi.service_id
               WHERE oi.order_id = ?
               ORDER BY oi.order_item_id ASC`,
              [preorderOrderId],
            );
            const preorderItems = (Array.isArray(itemRows) ? itemRows : [])
              .map((row: any) => ({
                service_id: Number(row.service_id),
                service_name: String(row.service_name || "").trim(),
                quantity: Number(row.quantity || 0),
                unit_price: Number(row.unit_price || 0),
                line_total: Number(row.line_total || 0),
              }))
              .filter(
                (item) =>
                  Number.isFinite(item.service_id) &&
                  Boolean(item.service_name) &&
                  Number.isFinite(item.quantity) &&
                  Number.isFinite(item.unit_price) &&
                  Number.isFinite(item.line_total),
              );
            const preorderTotalQty = preorderItems.reduce(
              (sum, item) => sum + Number(item.quantity || 0),
              0,
            );

            const [paymentRows] = await conn.query<RowDataPacket[]>(
              `SELECT payment_id, status, notes
               FROM payments
               WHERE booking_id = ? AND transaction_source = 'online_booking'
               ORDER BY payment_id DESC
               LIMIT 1
               FOR UPDATE`,
              [bookingId],
            );
            const paymentRow = Array.isArray(paymentRows)
              ? paymentRows[0]
              : null;
            if (paymentRow?.payment_id) {
              const oldNotes = parsePaymentNotesJson(paymentRow.notes);
              const updatedNotes = {
                ...(oldNotes && typeof oldNotes === "object" ? oldNotes : {}),
                transaction_source: "online_booking",
                service_type: "table",
                booking_id: bookingId,
                location_id: locationId,
                pos_order_id: preorderOrderId,
                table_id: primaryTableIdForExtras,
                table_name: bookingTableNames,
                table_names: bookingTableNames,
                items: preorderItems,
                total_qty: preorderTotalQty,
                invoice_ready: true,
                arrived_at: new Date().toISOString(),
                performed_by: {
                  role: auth.role,
                  user_id: auth.userId,
                  name: staff.full_name || null,
                  phone: null,
                },
                processed_by: {
                  user_id: auth.userId,
                  role: auth.role,
                  name: staff.full_name || null,
                },
              };

              const paymentUpdateCols = [
                "notes = ?",
                "payment_time = CASE WHEN status = 'completed' THEN CURRENT_TIMESTAMP ELSE payment_time END",
              ];
              const paymentUpdateParams: any[] = [JSON.stringify(updatedNotes)];

              if (paymentsSupport.hasPerformedByUserId) {
                paymentUpdateCols.push("performed_by_user_id = ?");
                paymentUpdateParams.push(auth.userId);
              }
              if (paymentsSupport.hasPerformedByRole) {
                paymentUpdateCols.push("performed_by_role = ?");
                paymentUpdateParams.push(auth.role);
              }
              if (paymentsSupport.hasPerformedByName) {
                paymentUpdateCols.push("performed_by_name = ?");
                paymentUpdateParams.push(staff.full_name || null);
              }

              paymentUpdateParams.push(Number(paymentRow.payment_id));
              await conn.query(
                `UPDATE payments
                 SET ${paymentUpdateCols.join(", ")}
                 WHERE payment_id = ?`,
                paymentUpdateParams,
              );
            }

            if (oStatus === "open") {
              await conn.query(
                `UPDATE pos_orders
                 SET status = 'paid', closed_by = ?, updated_at = CURRENT_TIMESTAMP
                 WHERE order_id = ?`,
                [auth.userId, preorderOrderId],
              );
            }
          }
        }

        // Open a new order for extras. Reuse only an online_booking order
        // to avoid pulling stale onsite open orders that prefill unrelated items.
        if (hasOrderSourceColumn) {
          const [openOrders] = await conn.query<RowDataPacket[]>(
            `SELECT o.order_id,
                    COALESCE(SUM(oi.quantity), 0) AS total_qty
             FROM pos_orders o
             LEFT JOIN pos_order_items oi ON oi.order_id = o.order_id
             WHERE o.table_id = ?
               AND o.status = 'open'
               AND o.order_source = 'online_booking'
             GROUP BY o.order_id
             HAVING COALESCE(SUM(oi.quantity), 0) = 0
             ORDER BY o.order_id DESC
             LIMIT 1
             FOR UPDATE`,
            [primaryTableIdForExtras],
          );
          if (openOrders[0]) {
            await conn.commit();
            const existingOrderId = Number(openOrders[0].order_id);
            await publishPosUpdated(conn, locationId, ownerId, {
              action: "order_opened",
              table_id: primaryTableIdForExtras,
              order_id: existingOrderId,
            });
            if (bookingUserId && Number.isFinite(bookingUserId)) {
              try {
                publishToUser(bookingUserId, {
                  type: "booking_checked_in",
                  booking_id: bookingId,
                  location_id: locationId,
                  table_id: primaryTableIdForExtras,
                  order_id: existingOrderId,
                });
              } catch {
                // ignore
              }
            }
            res.json({ success: true, data: { order_id: existingOrderId } });
            return;
          }
        }

        const [insert] = hasOrderSourceColumn
          ? await conn.query<ResultSetHeader>(
              `INSERT INTO pos_orders (location_id, table_id, status, order_source, subtotal_amount, discount_amount, final_amount, created_by)
               VALUES (?, ?, 'open', 'online_booking', 0.00, 0.00, 0.00, ?)`,
              [locationId, primaryTableIdForExtras, auth.userId],
            )
          : await conn.query<ResultSetHeader>(
              `INSERT INTO pos_orders (location_id, table_id, status, subtotal_amount, discount_amount, final_amount, created_by)
               VALUES (?, ?, 'open', 0.00, 0.00, 0.00, ?)`,
              [locationId, primaryTableIdForExtras, auth.userId],
            );

        await conn.commit();
        await publishPosUpdated(conn, locationId, ownerId, {
          action: "order_opened",
          table_id: primaryTableIdForExtras,
          order_id: insert.insertId,
        });
        if (bookingUserId && Number.isFinite(bookingUserId)) {
          try {
            publishToUser(bookingUserId, {
              type: "booking_checked_in",
              booking_id: bookingId,
              location_id: locationId,
              table_id: primaryTableIdForExtras,
              order_id: insert.insertId,
            });
          } catch {
            // ignore
          }
        }
        res
          .status(201)
          .json({ success: true, data: { order_id: insert.insertId } });
        return;
      }

      // No booking found: still treat reserved->occupied and open a normal order.
      if (status === "reserved") {
        await conn.query(
          `UPDATE pos_tables SET status = 'occupied' WHERE table_id = ? AND status = 'reserved'`,
          [tableId],
        );
      }

      const [openOrders] = await conn.query<RowDataPacket[]>(
        `SELECT order_id FROM pos_orders
         WHERE table_id = ? AND status = 'open'
         ${hasOrderSourceColumn ? "AND (order_source IS NULL OR order_source <> 'online_booking')" : ""}
         ORDER BY order_id DESC
         LIMIT 1
         FOR UPDATE`,
        [tableId],
      );
      if (openOrders[0]) {
        await conn.commit();
        const existingOrderId = Number(openOrders[0].order_id);
        await publishPosUpdated(conn, locationId, ownerId, {
          action: "order_opened",
          table_id: tableId,
          order_id: existingOrderId,
        });
        res.json({ success: true, data: { order_id: existingOrderId } });
        return;
      }

      const orderSource: "online_booking" | "onsite_pos" =
        status === "reserved" ? "online_booking" : "onsite_pos";

      const [insert] = hasOrderSourceColumn
        ? await conn.query<ResultSetHeader>(
            `INSERT INTO pos_orders (location_id, table_id, status, order_source, subtotal_amount, discount_amount, final_amount, created_by)
             VALUES (?, ?, 'open', ?, 0.00, 0.00, 0.00, ?)`,
            [locationId, tableId, orderSource, auth.userId],
          )
        : await conn.query<ResultSetHeader>(
            `INSERT INTO pos_orders (location_id, table_id, status, subtotal_amount, discount_amount, final_amount, created_by)
             VALUES (?, ?, 'open', 0.00, 0.00, 0.00, ?)`,
            [locationId, tableId, auth.userId],
          );

      await conn.commit();
      await publishPosUpdated(conn, locationId, ownerId, {
        action: "order_opened",
        table_id: tableId,
        order_id: insert.insertId,
      });
      res
        .status(201)
        .json({ success: true, data: { order_id: insert.insertId } });
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
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const getPosOrderDetail = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    const orderId = Number(req.params.orderId);
    if (!Number.isFinite(orderId)) {
      res.status(400).json({ success: false, message: "orderId không hợp lệ" });
      return;
    }

    const [oRows] = await pool.query<RowDataPacket[]>(
      `SELECT o.*, t.table_name
       FROM pos_orders o
       LEFT JOIN pos_tables t ON t.table_id = o.table_id
       WHERE o.order_id = ?
       LIMIT 1`,
      [orderId],
    );
    if (!oRows[0]) {
      res.status(404).json({ success: false, message: "Không tìm thấy order" });
      return;
    }
    const locationId = Number(oRows[0].location_id);
    await ensureLocationAccess({ auth, locationId });

    const [items] = await pool.query<RowDataPacket[]>(
      `SELECT i.*, s.service_name
       FROM pos_order_items i
       JOIN services s ON s.service_id = i.service_id
       WHERE i.order_id = ?
       ORDER BY i.created_at ASC, i.order_item_id ASC`,
      [orderId],
    );

    let prepaid: {
      booking_id: number;
      payment_id: number | null;
      payment_method: string | null;
      notes: string | null;
      contact_name: string | null;
      contact_phone: string | null;
      total_qty: number;
      total_amount: number;
      items: Array<{
        service_id: number;
        service_name: string;
        quantity: number;
        unit_price: number;
        line_total: number;
      }>;
    } | null = null;

    const tableId =
      oRows[0].table_id == null ? null : Number(oRows[0].table_id || 0);
    if (tableId && Number.isFinite(tableId)) {
      const [reservationRows] = await pool.query<RowDataPacket[]>(
        `SELECT r.booking_id,
                b.notes,
                COALESCE(NULLIF(b.contact_name, ''), u.full_name) AS contact_name,
                COALESCE(NULLIF(b.contact_phone, ''), u.phone) AS contact_phone
         FROM booking_table_reservations r
         JOIN bookings b ON b.booking_id = r.booking_id
         LEFT JOIN users u ON u.user_id = b.user_id
         WHERE r.table_id = ?
           AND r.status IN ('active', 'checked_in')
           AND r.actual_end_time IS NULL
           AND NOW() BETWEEN DATE_SUB(r.start_time, INTERVAL 1 HOUR) AND DATE_ADD(r.start_time, INTERVAL 1 HOUR)
         ORDER BY r.reservation_id DESC
         LIMIT 1`,
        [tableId],
      );

      const reservationRow = Array.isArray(reservationRows)
        ? reservationRows[0]
        : null;
      const reservationBookingId = Number(reservationRow?.booking_id || 0);

      if (Number.isFinite(reservationBookingId) && reservationBookingId > 0) {
        const [paymentRows] = await pool.query<RowDataPacket[]>(
          `SELECT payment_id, amount, payment_method, notes
           FROM payments
           WHERE booking_id = ?
             AND status = 'completed'
             AND transaction_source = 'online_booking'
           ORDER BY payment_id DESC
           LIMIT 10`,
          [reservationBookingId],
        );

        const matchedPayment = (
          Array.isArray(paymentRows) ? paymentRows : []
        ).find((row) => {
          const notes = parsePaymentNotesJson(row.notes);
          const itemsRaw = Array.isArray(notes?.items) ? notes.items : [];
          const linkedOrderId = Number(notes?.pos_order_id || 0);
          return (
            itemsRaw.length > 0 &&
            notes?.invoice_ready === true &&
            linkedOrderId !== orderId
          );
        });

        if (matchedPayment) {
          const paymentNotes = parsePaymentNotesJson(matchedPayment.notes);
          const itemsRaw = Array.isArray(paymentNotes?.items)
            ? paymentNotes.items
            : [];
          const mappedItems: Array<{
            service_id: number;
            service_name: string;
            quantity: number;
            unit_price: number;
            line_total: number;
          }> = itemsRaw
            .map((item: any) => ({
              service_id: Number(item.service_id),
              service_name: String(item.service_name || "").trim(),
              quantity: Number(item.quantity || 0),
              unit_price: Number(item.unit_price || 0),
              line_total: Number(item.line_total || 0),
            }))
            .filter(
              (item: {
                service_id: number;
                service_name: string;
                quantity: number;
              }) =>
                Number.isFinite(item.service_id) &&
                Boolean(item.service_name) &&
                Number.isFinite(item.quantity),
            );

          prepaid = {
            booking_id: reservationBookingId,
            payment_id: Number(matchedPayment.payment_id || 0) || null,
            payment_method:
              matchedPayment.payment_method == null
                ? null
                : String(matchedPayment.payment_method),
            notes:
              reservationRow?.notes == null
                ? null
                : String(reservationRow.notes),
            contact_name:
              reservationRow?.contact_name == null
                ? null
                : String(reservationRow.contact_name),
            contact_phone:
              reservationRow?.contact_phone == null
                ? null
                : String(reservationRow.contact_phone),
            total_qty: mappedItems.reduce(
              (sum: number, item) => sum + Number(item.quantity || 0),
              0,
            ),
            total_amount: Number(matchedPayment.amount || 0),
            items: mappedItems,
          };
        }
      }
    }

    res.json({ success: true, data: { order: oRows[0], items, prepaid } });
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const addPosOrderItem = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    const orderId = Number(req.params.orderId);
    const { service_id, quantity } = req.body as {
      service_id?: number;
      quantity?: number;
    };
    if (!Number.isFinite(orderId)) {
      res.status(400).json({ success: false, message: "orderId không hợp lệ" });
      return;
    }
    const serviceId = Number(service_id);
    const qty = Math.max(1, Number(quantity ?? 1));
    if (!Number.isFinite(serviceId)) {
      res
        .status(400)
        .json({ success: false, message: "service_id không hợp lệ" });
      return;
    }

    // IMPORTANT: do access checks BEFORE opening a transaction connection.
    // Otherwise, if the pool is small, calling pool.query while holding conn can hang.
    const [preOrderRows] = await pool.query<RowDataPacket[]>(
      `SELECT location_id FROM pos_orders WHERE order_id = ? LIMIT 1`,
      [orderId],
    );
    if (!preOrderRows[0]) {
      res.status(404).json({ success: false, message: "Không tìm thấy order" });
      return;
    }
    const preLocationId = Number(preOrderRows[0].location_id);
    const { ownerId } = await ensureLocationAccess({
      auth,
      locationId: preLocationId,
      requiredPermission:
        auth.role === "employee" ? "can_manage_bookings" : undefined,
    });

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [oRows] = await conn.query<RowDataPacket[]>(
        `SELECT order_id, location_id, table_id, status
         FROM pos_orders
         WHERE order_id = ?
         LIMIT 1
         FOR UPDATE`,
        [orderId],
      );
      if (!oRows[0]) {
        await conn.rollback();
        res
          .status(404)
          .json({ success: false, message: "Không tìm thấy order" });
        return;
      }
      if (String(oRows[0].status) !== "open") {
        await conn.rollback();
        res.status(400).json({ success: false, message: "Order không còn mở" });
        return;
      }
      const locationId = Number(oRows[0].location_id);
      const tableId = oRows[0].table_id ? Number(oRows[0].table_id) : null;

      const [svcRows] = await conn.query<RowDataPacket[]>(
        `SELECT price, admin_status, deleted_at, service_type, status
         FROM services
         WHERE service_id = ? AND location_id = ?
         LIMIT 1`,
        [serviceId, locationId],
      );
      if (!svcRows[0]) {
        await conn.rollback();
        res.status(404).json({ success: false, message: "Không tìm thấy món" });
        return;
      }

      if ((svcRows[0] as any).deleted_at != null) {
        await conn.rollback();
        res.status(404).json({
          success: false,
          message: "Dịch vụ đã bị xóa",
        });
        return;
      }

      const svcType = String((svcRows[0] as any).service_type || "");
      if (!["food", "combo", "other"].includes(svcType)) {
        await conn.rollback();
        res.status(400).json({
          success: false,
          message: "Dịch vụ không hợp lệ cho POS",
        });
        return;
      }

      const svcStatus = String((svcRows[0] as any).status || "");
      if (!["available", "reserved"].includes(svcStatus)) {
        await conn.rollback();
        res.status(400).json({
          success: false,
          message: "Dịch vụ hiện không khả dụng",
        });
        return;
      }

      if (String(svcRows[0].admin_status || "") !== "approved") {
        await conn.rollback();
        res.status(400).json({
          success: false,
          message: "Dịch vụ chưa được admin duyệt",
        });
        return;
      }
      const unitPrice = toMoney(svcRows[0].price);
      // If the item already exists in this order, increase quantity instead of inserting a new row.
      const [existingRows] = await conn.query<RowDataPacket[]>(
        `SELECT order_item_id, quantity
         FROM pos_order_items
         WHERE order_id = ? AND service_id = ?
         ORDER BY order_item_id DESC
         LIMIT 1
         FOR UPDATE`,
        [orderId, serviceId],
      );

      if (existingRows[0]) {
        const orderItemId = Number(existingRows[0].order_item_id);
        const currentQty = Math.max(0, Number(existingRows[0].quantity || 0));
        const newQty = Math.max(1, currentQty + qty);
        const lineTotal = toMoney(unitPrice * newQty);
        await conn.query(
          `UPDATE pos_order_items
           SET quantity = ?, unit_price = ?, line_total = ?
           WHERE order_item_id = ? AND order_id = ?`,
          [newQty, unitPrice, lineTotal, orderItemId, orderId],
        );
      } else {
        const lineTotal = toMoney(unitPrice * qty);
        await conn.query(
          `INSERT INTO pos_order_items (order_id, service_id, quantity, unit_price, line_total)
           VALUES (?, ?, ?, ?, ?)`,
          [orderId, serviceId, qty, unitPrice, lineTotal],
        );
      }

      const [sumRows] = await conn.query<RowDataPacket[]>(
        `SELECT COALESCE(SUM(line_total), 0) as subtotal
         FROM pos_order_items
         WHERE order_id = ?`,
        [orderId],
      );
      const subtotal = toMoney(sumRows[0]?.subtotal);
      const finalAmount = subtotal;

      await conn.query(
        `UPDATE pos_orders
         SET subtotal_amount = ?, discount_amount = 0.00, final_amount = ?
         WHERE order_id = ?`,
        [subtotal, finalAmount, orderId],
      );

      if (tableId) {
        await conn.query(
          `UPDATE pos_tables
           SET status = 'occupied'
           WHERE table_id = ?`,
          [tableId],
        );
      }

      await conn.commit();

      await publishPosUpdated(conn, locationId, ownerId, {
        action: "order_item_added",
        order_id: orderId,
        table_id: tableId,
      });
      res.status(201).json({
        success: true,
        data: { order_id: orderId, subtotal, final_amount: finalAmount },
      });
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
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const updatePosOrderItem = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    const orderId = Number(req.params.orderId);
    const orderItemId = Number(req.params.orderItemId);
    const { quantity } = req.body as { quantity?: number };

    if (!Number.isFinite(orderId)) {
      res.status(400).json({ success: false, message: "orderId không hợp lệ" });
      return;
    }
    if (!Number.isFinite(orderItemId)) {
      res
        .status(400)
        .json({ success: false, message: "orderItemId không hợp lệ" });
      return;
    }
    const qty = Math.max(1, Number(quantity ?? 1));

    // IMPORTANT: do access checks BEFORE opening a transaction connection.
    // Otherwise, if the pool is small, calling pool.query while holding conn can hang.
    const [preOrderRows] = await pool.query<RowDataPacket[]>(
      `SELECT location_id FROM pos_orders WHERE order_id = ? LIMIT 1`,
      [orderId],
    );
    if (!preOrderRows[0]) {
      res.status(404).json({ success: false, message: "Không tìm thấy order" });
      return;
    }
    const preLocationId = Number(preOrderRows[0].location_id);
    const { ownerId } = await ensureLocationAccess({
      auth,
      locationId: preLocationId,
      requiredPermission:
        auth.role === "employee" ? "can_manage_bookings" : undefined,
    });

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [oRows] = await conn.query<RowDataPacket[]>(
        `SELECT order_id, location_id, status
         FROM pos_orders
         WHERE order_id = ?
         LIMIT 1
         FOR UPDATE`,
        [orderId],
      );
      if (!oRows[0]) {
        await conn.rollback();
        res
          .status(404)
          .json({ success: false, message: "Không tìm thấy order" });
        return;
      }
      if (String(oRows[0].status) !== "open") {
        await conn.rollback();
        res.status(400).json({ success: false, message: "Order không còn mở" });
        return;
      }
      const locationId = Number(oRows[0].location_id);

      const [iRows] = await conn.query<RowDataPacket[]>(
        `SELECT order_item_id, service_id
         FROM pos_order_items
         WHERE order_item_id = ? AND order_id = ?
         LIMIT 1
         FOR UPDATE`,
        [orderItemId, orderId],
      );
      if (!iRows[0]) {
        await conn.rollback();
        res
          .status(404)
          .json({ success: false, message: "Không tìm thấy món trong order" });
        return;
      }
      const serviceId = Number(iRows[0].service_id);

      const [svcRows] = await conn.query<RowDataPacket[]>(
        `SELECT price
         FROM services
         WHERE service_id = ? AND location_id = ?
         LIMIT 1`,
        [serviceId, locationId],
      );
      if (!svcRows[0]) {
        await conn.rollback();
        res.status(404).json({ success: false, message: "Không tìm thấy món" });
        return;
      }

      const unitPrice = toMoney(svcRows[0].price);
      const lineTotal = toMoney(unitPrice * qty);

      await conn.query(
        `UPDATE pos_order_items
         SET quantity = ?, unit_price = ?, line_total = ?
         WHERE order_item_id = ? AND order_id = ?`,
        [qty, unitPrice, lineTotal, orderItemId, orderId],
      );

      const [sumRows] = await conn.query<RowDataPacket[]>(
        `SELECT COALESCE(SUM(line_total), 0) as subtotal
         FROM pos_order_items
         WHERE order_id = ?`,
        [orderId],
      );
      const subtotal = toMoney(sumRows[0]?.subtotal);
      const finalAmount = subtotal;

      await conn.query(
        `UPDATE pos_orders
         SET subtotal_amount = ?, discount_amount = 0.00, final_amount = ?
         WHERE order_id = ?`,
        [subtotal, finalAmount, orderId],
      );

      await conn.commit();

      await publishPosUpdated(conn, locationId, ownerId, {
        action: "order_item_updated",
        order_id: orderId,
      });
      res.json({
        success: true,
        data: { order_id: orderId, subtotal, final_amount: finalAmount },
      });
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
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const deletePosOrderItem = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    const orderId = Number(req.params.orderId);
    const orderItemId = Number(req.params.orderItemId);

    if (!Number.isFinite(orderId)) {
      res.status(400).json({ success: false, message: "orderId không hợp lệ" });
      return;
    }
    if (!Number.isFinite(orderItemId)) {
      res
        .status(400)
        .json({ success: false, message: "orderItemId không hợp lệ" });
      return;
    }

    // IMPORTANT: do access checks BEFORE opening a transaction connection.
    // Otherwise, if the pool is small, calling pool.query while holding conn can hang.
    const [preOrderRows] = await pool.query<RowDataPacket[]>(
      `SELECT location_id FROM pos_orders WHERE order_id = ? LIMIT 1`,
      [orderId],
    );
    if (!preOrderRows[0]) {
      res.status(404).json({ success: false, message: "Không tìm thấy order" });
      return;
    }
    const preLocationId = Number(preOrderRows[0].location_id);
    const { ownerId } = await ensureLocationAccess({
      auth,
      locationId: preLocationId,
      requiredPermission:
        auth.role === "employee" ? "can_manage_bookings" : undefined,
    });

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [oRows] = await conn.query<RowDataPacket[]>(
        `SELECT order_id, location_id, table_id, status
         FROM pos_orders
         WHERE order_id = ?
         LIMIT 1
         FOR UPDATE`,
        [orderId],
      );
      if (!oRows[0]) {
        await conn.rollback();
        res
          .status(404)
          .json({ success: false, message: "Không tìm thấy order" });
        return;
      }
      if (String(oRows[0].status) !== "open") {
        await conn.rollback();
        res.status(400).json({ success: false, message: "Order không còn mở" });
        return;
      }
      const locationId = Number(oRows[0].location_id);
      const tableId = oRows[0].table_id ? Number(oRows[0].table_id) : null;

      const [delRes] = await conn.query<ResultSetHeader>(
        `DELETE FROM pos_order_items WHERE order_item_id = ? AND order_id = ?`,
        [orderItemId, orderId],
      );
      if (!delRes.affectedRows) {
        await conn.rollback();
        res
          .status(404)
          .json({ success: false, message: "Không tìm thấy món trong order" });
        return;
      }

      const [sumRows] = await conn.query<RowDataPacket[]>(
        `SELECT COALESCE(SUM(line_total), 0) as subtotal
         FROM pos_order_items
         WHERE order_id = ?`,
        [orderId],
      );
      const subtotal = toMoney(sumRows[0]?.subtotal);
      const finalAmount = subtotal;

      await conn.query(
        `UPDATE pos_orders
         SET subtotal_amount = ?, discount_amount = 0.00, final_amount = ?
         WHERE order_id = ?`,
        [subtotal, finalAmount, orderId],
      );

      if (tableId) {
        const [cntRows] = await conn.query<RowDataPacket[]>(
          `SELECT COUNT(*) AS cnt
           FROM pos_order_items
           WHERE order_id = ?`,
          [orderId],
        );
        const cnt = Number(cntRows[0]?.cnt || 0);
        if (cnt <= 0) {
          const [reservationRows] = await conn.query<RowDataPacket[]>(
            `SELECT COUNT(*) AS cnt
             FROM booking_table_reservations r
             WHERE r.table_id = ?
               AND r.location_id = ?
               AND r.status = 'checked_in'
               AND r.actual_end_time IS NULL`,
            [tableId, locationId],
          );
          const hasCheckedInReservation =
            Number(reservationRows[0]?.cnt || 0) > 0;

          await conn.query(
            `UPDATE pos_tables
             SET status = ?
             WHERE table_id = ?`,
            [hasCheckedInReservation ? "occupied" : "free", tableId],
          );
        }
      }

      await conn.commit();

      await publishPosUpdated(conn, locationId, ownerId, {
        action: "order_item_deleted",
        order_id: orderId,
        table_id: tableId,
      });
      res.json({
        success: true,
        data: { order_id: orderId, subtotal, final_amount: finalAmount },
      });
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
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const payPosOrder = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    const orderId = Number(req.params.orderId);
    if (!Number.isFinite(orderId)) {
      res.status(400).json({ success: false, message: "orderId không hợp lệ" });
      return;
    }

    const {
      payment_method,
      step,
      payment_id,
      transaction_source,
      booking_id,
      voucher_code,
    } = (req.body || {}) as {
      payment_method?: "cash" | "transfer";
      step?: "init" | "complete";
      payment_id?: number;
      transaction_source?: "online_booking" | "onsite_pos";
      booking_id?: number;
      voucher_code?: string | null;
    };

    const pm = payment_method == null ? null : String(payment_method);
    if (pm !== "cash" && pm !== "transfer") {
      res
        .status(400)
        .json({ success: false, message: "payment_method không hợp lệ" });
      return;
    }

    const flowStep = pm === "transfer" ? String(step || "init") : "complete";
    if (pm === "transfer" && flowStep !== "init" && flowStep !== "complete") {
      res.status(400).json({ success: false, message: "step không hợp lệ" });
      return;
    }

    let txSource: "online_booking" | "onsite_pos" =
      transaction_source === "online_booking" ? "online_booking" : "onsite_pos";

    // IMPORTANT: do access checks BEFORE opening a transaction connection.
    // Otherwise, if the pool is small, calling pool.query while holding conn can hang.
    const [preOrderRows] = await pool.query<RowDataPacket[]>(
      `SELECT location_id FROM pos_orders WHERE order_id = ? LIMIT 1`,
      [orderId],
    );
    if (!preOrderRows[0]) {
      res.status(404).json({ success: false, message: "Không tìm thấy order" });
      return;
    }
    const preLocationId = Number(preOrderRows[0].location_id);
    await ensureLocationAccess({
      auth,
      locationId: preLocationId,
      requiredPermission:
        auth.role === "employee" ? "can_manage_bookings" : undefined,
    });

    const hasOrderSourceColumn =
      transaction_source == null
        ? await getPosOrdersHasOrderSourceColumn()
        : false;

    const bookingId = booking_id == null ? null : Number(booking_id);
    if (booking_id != null && !Number.isFinite(bookingId)) {
      res
        .status(400)
        .json({ success: false, message: "booking_id không hợp lệ" });
      return;
    }

    const voucherCode =
      voucher_code == null ? null : String(voucher_code).trim() || null;

    const normalizeBankKey = (input: string): string => {
      return input
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "");
    };

    const bankBinMap: Record<string, string> = {
      vietcombank: "970436",
      vcb: "970436",
      vietinbank: "970415",
      bidv: "970418",
      agribank: "970405",
      mb: "970422",
      mbbank: "970422",
      acb: "970416",
      techcombank: "970407",
      tcb: "970407",
      sacombank: "970403",
      scb: "970429",
      vpbank: "970432",
      tpbank: "970423",
      vib: "970441",
      shb: "970443",
      hdbank: "970437",
      ocb: "970448",
      msb: "970426",
      eximbank: "970431",
      seabank: "970440",
    };

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [oRows] = await conn.query<RowDataPacket[]>(
        `SELECT order_id, location_id, table_id, status
         FROM pos_orders
         WHERE order_id = ?
         LIMIT 1
         FOR UPDATE`,
        [orderId],
      );
      if (!oRows[0]) {
        await conn.rollback();
        res
          .status(404)
          .json({ success: false, message: "Không tìm thấy order" });
        return;
      }
      const locationId = Number(oRows[0].location_id);
      const tableId = oRows[0].table_id ? Number(oRows[0].table_id) : null;

      if (transaction_source == null && hasOrderSourceColumn) {
        const [srcRows] = await conn.query<RowDataPacket[]>(
          `SELECT order_source FROM pos_orders WHERE order_id = ? LIMIT 1`,
          [orderId],
        );
        const s = String(srcRows[0]?.order_source || "");
        if (s === "online_booking" || s === "onsite_pos") {
          txSource = s;
        }
      }

      let effectiveBookingId =
        bookingId != null && Number.isFinite(bookingId) ? bookingId : null;
      if (
        txSource === "online_booking" &&
        effectiveBookingId == null &&
        tableId != null
      ) {
        const [linkedBookingRows] = await conn.query<RowDataPacket[]>(
          `SELECT r.booking_id
           FROM booking_table_reservations r
           WHERE r.table_id = ?
             AND r.status IN ('active', 'checked_in')
             AND r.actual_end_time IS NULL
             AND NOW() BETWEEN DATE_SUB(r.start_time, INTERVAL 1 HOUR) AND DATE_ADD(r.start_time, INTERVAL 1 HOUR)
           ORDER BY CASE WHEN r.status = 'checked_in' THEN 0 ELSE 1 END,
                    r.reservation_id DESC
           LIMIT 1`,
          [tableId],
        );
        const linkedBookingId = Number(linkedBookingRows?.[0]?.booking_id || 0);
        if (Number.isFinite(linkedBookingId) && linkedBookingId > 0) {
          effectiveBookingId = linkedBookingId;
        }
      }

      // If this POS order is linked to a booking, treat settlement as online booking
      // even when the UI did not preserve order_source after a reload.
      if (effectiveBookingId != null && txSource !== "online_booking") {
        txSource = "online_booking";
      }

      if (String(oRows[0].status) !== "open") {
        await conn.rollback();
        res
          .status(400)
          .json({ success: false, message: "Order không ở trạng thái open" });
        return;
      }

      const [locRows] = await conn.query<RowDataPacket[]>(
        `SELECT l.location_id, l.location_name, l.owner_id,
                u.full_name AS owner_name,
                op.bank_account, op.bank_name, op.account_holder
         FROM locations l
         JOIN users u ON u.user_id = l.owner_id
         LEFT JOIN owner_profiles op ON op.owner_id = l.owner_id
         WHERE l.location_id = ?
         LIMIT 1`,
        [locationId],
      );
      if (!locRows[0]) {
        await conn.rollback();
        res
          .status(404)
          .json({ success: false, message: "Không tìm thấy địa điểm" });
        return;
      }

      const locationName = String(locRows[0].location_name || "").trim();
      const ownerId = Number(locRows[0].owner_id);
      const ownerName = String(locRows[0].owner_name || "").trim();

      const [tableRows] = tableId
        ? await conn.query<RowDataPacket[]>(
            `SELECT table_name FROM pos_tables WHERE table_id = ? LIMIT 1`,
            [tableId],
          )
        : ([[]] as any);
      const tableName = tableId
        ? String(tableRows?.[0]?.table_name || "").trim()
        : "";

      const [itemRows] = await conn.query<RowDataPacket[]>(
        `SELECT oi.service_id, s.service_name, oi.quantity, oi.unit_price, oi.line_total
         FROM pos_order_items oi
         JOIN services s ON s.service_id = oi.service_id
         WHERE oi.order_id = ?
         ORDER BY oi.order_item_id ASC`,
        [orderId],
      );

      const items = (itemRows || []).map((r: any) => {
        const qty = Number(r.quantity || 0);
        const unit = toMoney(r.unit_price);
        const line = toMoney(r.line_total);
        return {
          service_id: Number(r.service_id),
          service_name: String(r.service_name || "").trim(),
          quantity: Number.isFinite(qty) ? qty : 0,
          unit_price: unit,
          line_total: line,
        };
      });
      const subtotal = toMoney(
        items.reduce((sum, it) => sum + Number(it.line_total || 0), 0),
      );
      const totalQty = items.reduce(
        (sum, it) => sum + Number(it.quantity || 0),
        0,
      );

      await conn.query(
        `UPDATE pos_orders
         SET subtotal_amount = ?, discount_amount = 0.00, final_amount = ?
         WHERE order_id = ?`,
        [subtotal, subtotal, orderId],
      );

      // Commission: only apply to online_booking. Onsite POS has 0 commission.
      let commissionRate = 0;
      let vatRate = 0;
      if (txSource === "online_booking") {
        const [settingsRows] = await conn.query<RowDataPacket[]>(
          `SELECT setting_key, setting_value FROM system_settings
           WHERE setting_key IN ('default_commission_rate','vat_rate')`,
        );
        const settings: Record<string, string | null> = {};
        for (const r of settingsRows) {
          settings[String(r.setting_key)] = r.setting_value;
        }
        const [locRateRows] = await conn.query<RowDataPacket[]>(
          `SELECT commission_rate FROM locations WHERE location_id = ? LIMIT 1`,
          [locationId],
        );
        commissionRate = Number(
          locRateRows[0]?.commission_rate ??
            settings.default_commission_rate ??
            2.5,
        );
        vatRate = Number(settings.vat_rate ?? 10);
        if (!Number.isFinite(commissionRate)) commissionRate = 2.5;
        if (!Number.isFinite(vatRate)) vatRate = 10;
      }

      const safeCommissionRate = Number.isFinite(commissionRate)
        ? commissionRate
        : 0;
      const safeVatRate = Number.isFinite(vatRate) ? vatRate : 0;
      const amount = Number(subtotal || 0);
      const commissionAmount =
        txSource === "online_booking"
          ? +((amount * safeCommissionRate) / 100).toFixed(2)
          : 0;
      const vatAmount =
        txSource === "online_booking"
          ? +((commissionAmount * safeVatRate) / 100).toFixed(2)
          : 0;
      const ownerReceivable = +(amount - commissionAmount - vatAmount).toFixed(
        2,
      );

      const support = await getPaymentsSchemaSupport();
      const staff = await getUserSnapshotWithConn(conn, auth.userId);

      let bookingUser: {
        user_id: number;
        full_name: string | null;
        phone: string | null;
        booked_at: string | null;
      } | null = null;
      if (txSource === "online_booking" && effectiveBookingId != null) {
        const [bUserRows] = await conn.query<RowDataPacket[]>(
          `SELECT b.user_id, b.created_at, u.full_name, u.phone
           FROM bookings b
           JOIN users u ON u.user_id = b.user_id
           WHERE b.booking_id = ?
           LIMIT 1`,
          [effectiveBookingId],
        );
        if (bUserRows[0]?.user_id) {
          bookingUser = {
            user_id: Number(bUserRows[0].user_id),
            full_name: bUserRows[0].full_name
              ? String(bUserRows[0].full_name)
              : null,
            phone: bUserRows[0].phone ? String(bUserRows[0].phone) : null,
            booked_at: bUserRows[0].created_at
              ? new Date(bUserRows[0].created_at).toISOString()
              : null,
          };
        }
      }

      const paymentUserId =
        txSource === "online_booking" && bookingUser?.user_id
          ? bookingUser.user_id
          : support.userIdNullable
            ? null
            : auth.userId;

      const performedByRole =
        txSource === "online_booking" && bookingUser?.user_id
          ? "user"
          : auth.role;
      const performedByUserId =
        performedByRole === "user"
          ? (bookingUser?.user_id ?? null)
          : auth.userId;
      const performedByName =
        performedByRole === "user"
          ? formatBookingActorDisplay({
              full_name: bookingUser?.full_name ?? null,
              phone: bookingUser?.phone ?? null,
              bookedAt: bookingUser?.booked_at ?? null,
            }) ||
            bookingUser?.full_name ||
            null
          : staff.full_name || null;

      let prepaidInvoiceItems: Array<{
        service_id: number;
        service_name: string;
        quantity: number;
        unit_price: number;
        line_total: number;
      }> = [];
      let prepaidInvoiceAmount = 0;
      if (txSource === "online_booking" && effectiveBookingId != null) {
        const [prepaidPaymentRows] = await conn.query<RowDataPacket[]>(
          `SELECT payment_id, amount, notes
           FROM payments
           WHERE booking_id = ?
             AND status = 'completed'
             AND transaction_source = 'online_booking'
           ORDER BY payment_id DESC
           LIMIT 10`,
          [effectiveBookingId],
        );

        const prepaidPayment = (
          Array.isArray(prepaidPaymentRows) ? prepaidPaymentRows : []
        ).find((row) => {
          const parsed = parsePaymentNotesJson(row.notes);
          const parsedItems = Array.isArray(parsed?.items) ? parsed.items : [];
          return parsed?.invoice_ready === true && parsedItems.length > 0;
        });

        if (prepaidPayment) {
          const parsed = parsePaymentNotesJson(prepaidPayment.notes);
          prepaidInvoiceItems = (
            Array.isArray(parsed?.items) ? parsed.items : []
          )
            .map((item: any) => ({
              service_id: Number(item.service_id),
              service_name: String(item.service_name || "").trim(),
              quantity: Number(item.quantity || 0),
              unit_price: Number(item.unit_price || 0),
              line_total: Number(item.line_total || 0),
            }))
            .filter(
              (item: {
                service_id: number;
                service_name: string;
                quantity: number;
              }) =>
                Number.isFinite(item.service_id) &&
                Boolean(item.service_name) &&
                Number.isFinite(item.quantity),
            );
          prepaidInvoiceAmount = Number(prepaidPayment.amount || 0);
        }
      }

      const paymentNotes = {
        transaction_source: txSource,
        service_type: "food",
        location_id: locationId,
        location_name: locationName || null,
        owner_id: ownerId,
        owner_name: ownerName || null,
        booking_id: effectiveBookingId,
        pos_order_id: orderId,
        table_id: tableId,
        table_name: tableName || null,
        voucher_code: voucherCode,
        amount,
        items,
        total_qty: totalQty,
        performed_by: {
          role: performedByRole,
          user_id: performedByUserId,
          name: performedByName,
          phone:
            performedByRole === "user" ? (bookingUser?.phone ?? null) : null,
          booked_at:
            performedByRole === "user"
              ? (bookingUser?.booked_at ?? null)
              : null,
        },
        processed_by: {
          user_id: auth.userId,
          role: auth.role,
          name: staff.full_name || null,
        },
        created_by: auth.userId,
      };

      const now = new Date();

      const invoice = {
        payment_id: null as number | null,
        location_name: locationName || null,
        owner_name: ownerName || null,
        payment_time: now.toISOString(),
        table_name: tableName || null,
        items,
        total_qty: totalQty,
        total_amount: subtotal,
        prepaid_items: prepaidInvoiceItems,
        prepaid_amount: prepaidInvoiceAmount,
        onsite_items: items,
        onsite_amount: subtotal,
      };

      if (pm === "cash") {
        const columns = [
          "user_id",
          "location_id",
          "booking_id",
          "amount",
          "commission_rate",
          "commission_amount",
          "vat_rate",
          "vat_amount",
          "owner_receivable",
          "payment_method",
          "transaction_code",
          "qr_data",
          "status",
          "notes",
        ];
        const values = [
          "?",
          "?",
          "?",
          "?",
          "?",
          "?",
          "?",
          "?",
          "?",
          "'Cash'",
          "NULL",
          "NULL",
          "'completed'",
          "?",
        ];
        const params: any[] = [
          paymentUserId,
          locationId,
          effectiveBookingId,
          amount,
          safeCommissionRate,
          commissionAmount,
          safeVatRate,
          vatAmount,
          ownerReceivable,
          JSON.stringify(paymentNotes),
        ];

        if (support.hasTransactionSource) {
          columns.splice(4, 0, "transaction_source");
          values.splice(4, 0, "?");
          params.splice(4, 0, txSource);
        }
        if (support.hasPerformedByUserId) {
          columns.push("performed_by_user_id");
          values.push("?");
          params.push(performedByUserId);
        }
        if (support.hasPerformedByRole) {
          columns.push("performed_by_role");
          values.push("?");
          params.push(performedByRole);
        }
        if (support.hasPerformedByName) {
          columns.push("performed_by_name");
          values.push("?");
          params.push(performedByName);
        }

        const [paymentInsert] = await conn.query<ResultSetHeader>(
          `INSERT INTO payments (\n            ${columns.join(", ")}\n          ) VALUES (${values.join(", ")})`,
          params,
        );

        const paymentId = paymentInsert.insertId;
        invoice.payment_id = paymentId;

        await conn.query(
          `UPDATE pos_orders SET status = 'paid', closed_by = ? WHERE order_id = ?`,
          [auth.userId, orderId],
        );
        if (tableId) {
          await conn.query(
            `UPDATE pos_tables SET status = 'free' WHERE table_id = ?`,
            [tableId],
          );
          await releaseTableReservations(conn, {
            bookingId: Number.isFinite(Number(effectiveBookingId))
              ? Number(effectiveBookingId)
              : null,
            tableId,
          });
        }

        await logAuditWithConn(conn, auth.userId, "POS_ORDER_PAID", {
          order_id: orderId,
          payment_id: paymentId,
          payment_method: "cash",
          amount,
          transaction_source: txSource,
          commission_rate: safeCommissionRate,
          commission_amount: commissionAmount,
          vat_rate: safeVatRate,
          vat_amount: vatAmount,
          timestamp: new Date(),
        });

        await conn.commit();
        await publishPosUpdated(conn, locationId, ownerId, {
          action: "order_paid",
          order_id: orderId,
          table_id: tableId,
          payment_method: "cash",
        });
        res.json({ success: true, data: { invoice } });
        return;
      }

      // Transfer flow
      const allowZeroPrepaidSettlement =
        amount <= 0 && effectiveBookingId != null;
      const bankAccount = String(locRows[0].bank_account || "").trim();
      const bankName = String(locRows[0].bank_name || "").trim();
      const accountHolder = String(locRows[0].account_holder || "").trim();
      if (
        !allowZeroPrepaidSettlement &&
        (!bankAccount || !bankName || !accountHolder)
      ) {
        await conn.rollback();
        res.status(400).json({
          success: false,
          message:
            "Owner chưa cập nhật đủ thông tin ngân hàng (bank_account/bank_name/account_holder)",
        });
        return;
      }
      const resolvedBin = bankBinMap[normalizeBankKey(bankName)] || "";
      if (!allowZeroPrepaidSettlement && !resolvedBin) {
        await conn.rollback();
        res.status(400).json({
          success: false,
          message:
            "Không xác định được mã BIN ngân hàng từ bank_name. Vui lòng cập nhật bank_name hợp lệ.",
        });
        return;
      }

      const qrNote = locationName
        ? `${locationName} - Cảm ơn quý khách`
        : "Cảm ơn quý khách";
      const qrAmount = Math.max(0, Math.round(Number(subtotal || 0)));
      const qrCodeUrl = `https://img.vietqr.io/image/${resolvedBin}-${encodeURIComponent(
        bankAccount,
      )}-qr_only.png?amount=${encodeURIComponent(String(qrAmount))}&addInfo=${encodeURIComponent(
        qrNote,
      )}`;

      if (flowStep === "init") {
        // reuse pending payment for this order if exists
        const [existing] = await conn.query<RowDataPacket[]>(
          `SELECT payment_id, status
           FROM payments
           WHERE location_id = ? AND status = 'pending' AND notes = ?
           ORDER BY payment_id DESC
           LIMIT 1
           FOR UPDATE`,
          [locationId, `POS_ORDER:${orderId}`],
        );

        let paymentId: number;
        if (existing[0]?.payment_id) {
          paymentId = Number(existing[0].payment_id);

          const qrData = {
            bank_name: bankName,
            bank_account: bankAccount,
            account_holder: accountHolder,
            bank_bin: resolvedBin,
            amount,
            add_info: qrNote,
            qr_code_url: qrCodeUrl,
            pos_order_id: orderId,
          };

          const setParts: string[] = [
            "user_id = ?",
            "booking_id = ?",
            "amount = ?",
            "commission_rate = ?",
            "commission_amount = ?",
            "vat_rate = ?",
            "vat_amount = ?",
            "owner_receivable = ?",
            "qr_data = ?",
          ];
          const updateParams: any[] = [
            paymentUserId,
            effectiveBookingId,
            amount,
            safeCommissionRate,
            commissionAmount,
            safeVatRate,
            vatAmount,
            ownerReceivable,
            JSON.stringify(qrData),
          ];
          if (support.hasTransactionSource) {
            setParts.push("transaction_source = ?");
            updateParams.push(txSource);
          }
          if (support.hasPerformedByUserId) {
            setParts.push("performed_by_user_id = ?");
            updateParams.push(performedByUserId);
          }
          if (support.hasPerformedByRole) {
            setParts.push("performed_by_role = ?");
            updateParams.push(performedByRole);
          }
          if (support.hasPerformedByName) {
            setParts.push("performed_by_name = ?");
            updateParams.push(performedByName);
          }
          updateParams.push(paymentId);

          await conn.query(
            `UPDATE payments SET ${setParts.join(", ")} WHERE payment_id = ?`,
            updateParams,
          );
        } else {
          const qrData = {
            bank_name: bankName,
            bank_account: bankAccount,
            account_holder: accountHolder,
            bank_bin: resolvedBin,
            amount,
            add_info: qrNote,
            qr_code_url: qrCodeUrl,
            pos_order_id: orderId,
          };

          const columns = [
            "user_id",
            "location_id",
            "booking_id",
            "amount",
            "commission_rate",
            "commission_amount",
            "vat_rate",
            "vat_amount",
            "owner_receivable",
            "payment_method",
            "transaction_code",
            "qr_data",
            "status",
            "notes",
          ];
          const values = [
            "?",
            "?",
            "?",
            "?",
            "?",
            "?",
            "?",
            "?",
            "?",
            "'BankTransfer'",
            "NULL",
            "?",
            "'pending'",
            "?",
          ];
          const params: any[] = [
            paymentUserId,
            locationId,
            effectiveBookingId,
            amount,
            safeCommissionRate,
            commissionAmount,
            safeVatRate,
            vatAmount,
            ownerReceivable,
            JSON.stringify(qrData),
            `POS_ORDER:${orderId}`,
          ];

          if (support.hasTransactionSource) {
            columns.splice(4, 0, "transaction_source");
            values.splice(4, 0, "?");
            params.splice(4, 0, txSource);
          }
          if (support.hasPerformedByUserId) {
            columns.push("performed_by_user_id");
            values.push("?");
            params.push(performedByUserId);
          }
          if (support.hasPerformedByRole) {
            columns.push("performed_by_role");
            values.push("?");
            params.push(performedByRole);
          }
          if (support.hasPerformedByName) {
            columns.push("performed_by_name");
            values.push("?");
            params.push(performedByName);
          }

          const [paymentInsert] = await conn.query<ResultSetHeader>(
            `INSERT INTO payments (\n              ${columns.join(", ")}\n            ) VALUES (${values.join(", ")})`,
            params,
          );
          paymentId = paymentInsert.insertId;
        }

        await conn.commit();
        await publishPosUpdated(conn, locationId, ownerId, {
          action: "payment_pending",
          order_id: orderId,
          table_id: tableId,
          payment_method: "transfer",
        });
        res.json({
          success: true,
          data: {
            payment_id: paymentId,
            qr: {
              qr_code_url: qrCodeUrl,
              bank_name: bankName,
              bank_account: bankAccount,
              account_holder: accountHolder,
              amount,
              note: qrNote,
            },
            context: {
              location_name: locationName || null,
              owner_name: ownerName || null,
              payment_time: now.toISOString(),
              table_name: tableName || null,
              items,
              total_qty: totalQty,
              total_amount: subtotal,
            },
          },
        });
        return;
      }

      // complete transfer
      const paymentIdInput = Number(payment_id);
      let paymentIdResolved: number | null = null;
      let paymentStatusResolved = "completed";

      if (Number.isFinite(paymentIdInput)) {
        const [pRows] = await conn.query<RowDataPacket[]>(
          `SELECT payment_id, status, notes
           FROM payments
           WHERE payment_id = ?
           LIMIT 1
           FOR UPDATE`,
          [paymentIdInput],
        );
        if (!pRows[0]) {
          await conn.rollback();
          res
            .status(404)
            .json({ success: false, message: "Không tìm thấy payment" });
          return;
        }

        const notesRaw = String(pRows[0].notes || "");
        const marker = `POS_ORDER:${orderId}`;
        let matchOrder = notesRaw === marker;
        if (!matchOrder) {
          try {
            const parsed = JSON.parse(notesRaw);
            const parsedOrderId = Number((parsed as any)?.pos_order_id);
            if (Number.isFinite(parsedOrderId) && parsedOrderId === orderId) {
              matchOrder = true;
            }
          } catch {
            // ignore
          }
        }

        if (!matchOrder) {
          await conn.rollback();
          res.status(400).json({
            success: false,
            message: "payment_id không khớp với order hiện tại",
          });
          return;
        }

        paymentIdResolved = Number(pRows[0].payment_id);
        paymentStatusResolved = String(pRows[0].status || "completed");
      } else if (!allowZeroPrepaidSettlement) {
        await conn.rollback();
        res
          .status(400)
          .json({ success: false, message: "payment_id không hợp lệ" });
        return;
      }

      if (paymentIdResolved == null && allowZeroPrepaidSettlement) {
        const columns = [
          "user_id",
          "location_id",
          "booking_id",
          "amount",
          "commission_rate",
          "commission_amount",
          "vat_rate",
          "vat_amount",
          "owner_receivable",
          "payment_method",
          "transaction_code",
          "qr_data",
          "status",
          "notes",
        ];
        const values = [
          "?",
          "?",
          "?",
          "?",
          "?",
          "?",
          "?",
          "?",
          "?",
          "'BankTransfer'",
          "NULL",
          "NULL",
          "'completed'",
          "?",
        ];
        const params: any[] = [
          paymentUserId,
          locationId,
          effectiveBookingId,
          amount,
          safeCommissionRate,
          commissionAmount,
          safeVatRate,
          vatAmount,
          ownerReceivable,
          JSON.stringify({
            ...paymentNotes,
            settlement_type: "prepaid_only",
          }),
        ];

        if (support.hasTransactionSource) {
          columns.splice(4, 0, "transaction_source");
          values.splice(4, 0, "?");
          params.splice(4, 0, txSource);
        }
        if (support.hasPerformedByUserId) {
          columns.push("performed_by_user_id");
          values.push("?");
          params.push(performedByUserId);
        }
        if (support.hasPerformedByRole) {
          columns.push("performed_by_role");
          values.push("?");
          params.push(performedByRole);
        }
        if (support.hasPerformedByName) {
          columns.push("performed_by_name");
          values.push("?");
          params.push(performedByName);
        }

        const [paymentInsert] = await conn.query<ResultSetHeader>(
          `INSERT INTO payments (\n            ${columns.join(", ")}\n          ) VALUES (${values.join(", ")})`,
          params,
        );
        paymentIdResolved = Number(paymentInsert.insertId);
        paymentStatusResolved = "completed";
      }

      if (paymentIdResolved != null && paymentStatusResolved !== "completed") {
        const setParts: string[] = [
          "status = 'completed'",
          "payment_time = NOW()",
          "user_id = ?",
          "booking_id = ?",
          "amount = ?",
          "commission_rate = ?",
          "commission_amount = ?",
          "vat_rate = ?",
          "vat_amount = ?",
          "owner_receivable = ?",
          "notes = ?",
        ];
        const updateParams: any[] = [
          paymentUserId,
          effectiveBookingId,
          amount,
          safeCommissionRate,
          commissionAmount,
          safeVatRate,
          vatAmount,
          ownerReceivable,
          JSON.stringify(paymentNotes),
        ];
        if (support.hasTransactionSource) {
          setParts.push("transaction_source = ?");
          updateParams.push(txSource);
        }
        if (support.hasPerformedByUserId) {
          setParts.push("performed_by_user_id = ?");
          updateParams.push(performedByUserId);
        }
        if (support.hasPerformedByRole) {
          setParts.push("performed_by_role = ?");
          updateParams.push(performedByRole);
        }
        if (support.hasPerformedByName) {
          setParts.push("performed_by_name = ?");
          updateParams.push(performedByName);
        }
        updateParams.push(paymentIdResolved);

        await conn.query(
          `UPDATE payments SET ${setParts.join(", ")} WHERE payment_id = ?`,
          updateParams,
        );
      }

      invoice.payment_id = paymentIdResolved;
      if (amount <= 0 && prepaidInvoiceItems.length > 0) {
        invoice.items = [];
        invoice.total_qty = prepaidInvoiceItems.reduce(
          (sum, item) => sum + Number(item.quantity || 0),
          0,
        );
        invoice.total_amount = 0;
        invoice.onsite_items = [];
        invoice.onsite_amount = 0;
      }

      await conn.query(
        `UPDATE pos_orders SET status = 'paid', closed_by = ? WHERE order_id = ?`,
        [auth.userId, orderId],
      );
      if (tableId) {
        await conn.query(
          `UPDATE pos_tables SET status = 'free' WHERE table_id = ?`,
          [tableId],
        );
        await releaseTableReservations(conn, {
          bookingId: Number.isFinite(Number(effectiveBookingId))
            ? Number(effectiveBookingId)
            : null,
          tableId,
        });
      }

      await logAuditWithConn(conn, auth.userId, "POS_ORDER_PAID", {
        order_id: orderId,
        payment_id: paymentIdResolved,
        payment_method: "transfer",
        amount,
        transaction_source: txSource,
        commission_rate: safeCommissionRate,
        commission_amount: commissionAmount,
        vat_rate: safeVatRate,
        vat_amount: vatAmount,
        timestamp: new Date(),
      });

      await conn.commit();
      await publishPosUpdated(conn, locationId, ownerId, {
        action: "order_paid",
        order_id: orderId,
        table_id: tableId,
        payment_method: "transfer",
      });
      res.json({ success: true, data: { invoice } });
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
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

// -------------------- TOURIST (ticket scan + walk-in sell) --------------------

export const getTouristTicketToday = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    const locationId = Number((req.query as any).location_id);
    const dateRaw = String(((req.query as any).date ?? "") as any).trim();
    const todayStr = new Date().toISOString().slice(0, 10);
    const targetDate = dateRaw ? dateRaw : todayStr;
    if (dateRaw && !/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) {
      res.status(400).json({ success: false, message: "date không hợp lệ" });
      return;
    }
    if (!Number.isFinite(locationId)) {
      res
        .status(400)
        .json({ success: false, message: "location_id không hợp lệ" });
      return;
    }

    await ensureLocationAccess({ auth, locationId });

    const posSupport = await getPosTicketsSchemaSupport();

    const [services] = await pool.query<RowDataPacket[]>(
      `SELECT service_id, service_name, price, quantity
       FROM services
       WHERE location_id = ?
         AND service_type = 'ticket'
         AND admin_status = 'approved'
         AND deleted_at IS NULL
       ORDER BY service_id ASC`,
      [locationId],
    );

    const [soldBooking] = await pool.query<RowDataPacket[]>(
      `SELECT service_id, COUNT(*) AS sold_booking
       FROM booking_tickets
       WHERE location_id = ?
         AND status <> 'void'
         AND DATE(issued_at) = ?
       GROUP BY service_id`,
      [locationId, targetDate],
    );

    const [soldPos] = await pool.query<RowDataPacket[]>(
      `SELECT service_id, COUNT(*) AS sold_pos
       FROM pos_tickets
       WHERE location_id = ?
         AND status <> 'void'
         AND DATE(sold_at) = ?
       GROUP BY service_id`,
      [locationId, targetDate],
    );

    const [usedBooking] = await pool.query<RowDataPacket[]>(
      `SELECT service_id, COUNT(*) AS used_booking
       FROM booking_tickets
       WHERE location_id = ?
         AND status = 'used'
         AND used_at IS NOT NULL
         AND DATE(used_at) = ?
       GROUP BY service_id`,
      [locationId, targetDate],
    );

    const [usedPos] = await pool.query<RowDataPacket[]>(
      `SELECT service_id, COUNT(*) AS used_pos
       FROM pos_tickets
       WHERE location_id = ?
         AND status = 'used'
         AND used_at IS NOT NULL
         AND DATE(used_at) = ?
       GROUP BY service_id`,
      [locationId, targetDate],
    );

    const soldBookingByService = new Map<number, number>();
    for (const r of soldBooking) {
      soldBookingByService.set(
        Number(r.service_id),
        Number(r.sold_booking || 0),
      );
    }
    const soldPosByService = new Map<number, number>();
    for (const r of soldPos) {
      soldPosByService.set(Number(r.service_id), Number(r.sold_pos || 0));
    }
    const usedBookingByService = new Map<number, number>();
    for (const r of usedBooking) {
      usedBookingByService.set(
        Number(r.service_id),
        Number(r.used_booking || 0),
      );
    }
    const usedPosByService = new Map<number, number>();
    for (const r of usedPos) {
      usedPosByService.set(Number(r.service_id), Number(r.used_pos || 0));
    }

    const serviceStats = (services || []).map((s) => {
      const serviceId = Number(s.service_id);
      const total = Math.max(0, Number(s.quantity || 0));
      const soldToday =
        (soldBookingByService.get(serviceId) ?? 0) +
        (soldPosByService.get(serviceId) ?? 0);
      const usedToday =
        (usedBookingByService.get(serviceId) ?? 0) +
        (usedPosByService.get(serviceId) ?? 0);
      const remainingToday = Math.max(0, total - soldToday);

      return {
        service_id: serviceId,
        service_name: String(s.service_name || ""),
        price: Number(s.price || 0),
        total_today: total,
        sold_today: soldToday,
        used_today: usedToday,
        remaining_today: remainingToday,
      };
    });

    const inferPosSellerIdSql = `(
      SELECT al.user_id
      FROM audit_logs al
      WHERE al.action IN ('SELL_POS_TICKETS', 'SELL_POS_TICKETS_BATCH')
        AND CAST(JSON_UNQUOTE(JSON_EXTRACT(al.details, '$.location_id')) AS UNSIGNED) = pt.location_id
        AND ABS(TIMESTAMPDIFF(SECOND, al.created_at, pt.sold_at)) <= 30
        AND (
          (al.action = 'SELL_POS_TICKETS'
            AND CAST(JSON_UNQUOTE(JSON_EXTRACT(al.details, '$.service_id')) AS UNSIGNED) = pt.service_id)
          OR al.action = 'SELL_POS_TICKETS_BATCH'
        )
      ORDER BY ABS(TIMESTAMPDIFF(SECOND, al.created_at, pt.sold_at)) ASC
      LIMIT 1
    )`;

    const inferPosSellerNameSql = `(
      SELECT u2.full_name
      FROM audit_logs al
      LEFT JOIN users u2 ON u2.user_id = al.user_id
      WHERE al.action IN ('SELL_POS_TICKETS', 'SELL_POS_TICKETS_BATCH')
        AND CAST(JSON_UNQUOTE(JSON_EXTRACT(al.details, '$.location_id')) AS UNSIGNED) = pt.location_id
        AND ABS(TIMESTAMPDIFF(SECOND, al.created_at, pt.sold_at)) <= 30
        AND (
          (al.action = 'SELL_POS_TICKETS'
            AND CAST(JSON_UNQUOTE(JSON_EXTRACT(al.details, '$.service_id')) AS UNSIGNED) = pt.service_id)
          OR al.action = 'SELL_POS_TICKETS_BATCH'
        )
      ORDER BY ABS(TIMESTAMPDIFF(SECOND, al.created_at, pt.sold_at)) ASC
      LIMIT 1
    )`;

    const posSellerIdExpr = posSupport.hasSoldBy
      ? `COALESCE(pt.sold_by, ${inferPosSellerIdSql})`
      : `${inferPosSellerIdSql}`;

    const posSellerNameExpr = posSupport.hasSoldBy
      ? `COALESCE(us_sold.full_name, ${inferPosSellerNameSql})`
      : `${inferPosSellerNameSql}`;

    const posSoldJoin = posSupport.hasSoldBy
      ? `LEFT JOIN users us_sold ON us_sold.user_id = pt.sold_by`
      : ``;

    const historySql = `(
        SELECT 'sold' AS action,
               'booking' AS source,
               bt.ticket_code,
               bt.issued_at AS at,
               NULL AS used_by,
               s.service_name,
               s.price AS unit_price,
               bu.user_id AS buyer_id,
               bu.full_name AS buyer_name,
               bu.phone AS buyer_phone,
               NULL AS performed_name,
               NULL AS seller_id,
               NULL AS seller_name
        FROM booking_tickets bt
        JOIN services s ON s.service_id = bt.service_id
        JOIN bookings b ON b.booking_id = bt.booking_id
        JOIN users bu ON bu.user_id = b.user_id
        WHERE bt.location_id = ?
          AND bt.status <> 'void'
          AND DATE(bt.issued_at) = ?
      )
      UNION ALL
      (
        SELECT 'sold' AS action,
               'pos' AS source,
               pt.ticket_code,
               pt.sold_at AS at,
               NULL AS used_by,
               s.service_name,
               s.price AS unit_price,
               NULL AS buyer_id,
               NULL AS buyer_name,
               NULL AS buyer_phone,
               NULL AS performed_name,
               ${posSellerIdExpr} AS seller_id,
               ${posSellerNameExpr} AS seller_name
        FROM pos_tickets pt
        JOIN services s ON s.service_id = pt.service_id
        ${posSoldJoin}
        WHERE pt.location_id = ?
          AND pt.status <> 'void'
          AND DATE(pt.sold_at) = ?
      )
      UNION ALL
      (
        SELECT 'used' AS action,
               'booking' AS source,
               bt.ticket_code,
               bt.used_at AS at,
               bt.used_by,
               s.service_name,
               s.price AS unit_price,
               bu.user_id AS buyer_id,
               bu.full_name AS buyer_name,
               bu.phone AS buyer_phone,
               u.full_name AS performed_name,
               NULL AS seller_id,
               NULL AS seller_name
        FROM booking_tickets bt
        JOIN services s ON s.service_id = bt.service_id
        JOIN bookings b ON b.booking_id = bt.booking_id
        JOIN users bu ON bu.user_id = b.user_id
        LEFT JOIN users u ON u.user_id = bt.used_by
        WHERE bt.location_id = ?
          AND bt.status = 'used'
          AND bt.used_at IS NOT NULL
          AND DATE(bt.used_at) = ?
      )
      UNION ALL
      (
        SELECT 'used' AS action,
               'pos' AS source,
               pt.ticket_code,
               pt.used_at AS at,
               pt.used_by,
               s.service_name,
               s.price AS unit_price,
               NULL AS buyer_id,
               NULL AS buyer_name,
               NULL AS buyer_phone,
               u.full_name AS performed_name,
               ${posSellerIdExpr} AS seller_id,
               ${posSellerNameExpr} AS seller_name
        FROM pos_tickets pt
        JOIN services s ON s.service_id = pt.service_id
        LEFT JOIN users u ON u.user_id = pt.used_by
        ${posSoldJoin}
        WHERE pt.location_id = ?
          AND pt.status = 'used'
          AND pt.used_at IS NOT NULL
          AND DATE(pt.used_at) = ?
      )
      ORDER BY at DESC
      LIMIT 300`;

    const [history] = await pool.query<RowDataPacket[]>(historySql, [
      locationId,
      targetDate,
      locationId,
      targetDate,
      locationId,
      targetDate,
      locationId,
      targetDate,
    ]);

    res.json({
      success: true,
      data: {
        date: targetDate,
        services: serviceStats,
        history,
      },
    });
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const getTouristTicketInvoices = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    const locationId = Number((req.query as any).location_id);
    const rangeRaw = String((req.query as any).range || "day")
      .trim()
      .toLowerCase();
    const dateRaw = String(((req.query as any).date ?? "") as any).trim();
    const fromRaw = String(((req.query as any).from ?? "") as any).trim();
    const toRaw = String(((req.query as any).to ?? "") as any).trim();

    const todayStr = new Date().toISOString().slice(0, 10);
    const dateAnchor = dateRaw ? dateRaw : todayStr;

    const allowedRanges: PosPaymentsRange[] = [
      "day",
      "week",
      "month",
      "year",
      "all",
    ];
    const range = (
      allowedRanges.includes(rangeRaw as any)
        ? (rangeRaw as PosPaymentsRange)
        : "day"
    ) as PosPaymentsRange;

    if (dateRaw && !/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) {
      res.status(400).json({ success: false, message: "date không hợp lệ" });
      return;
    }
    if (!Number.isFinite(locationId)) {
      res
        .status(400)
        .json({ success: false, message: "location_id không hợp lệ" });
      return;
    }

    await ensureLocationAccess({ auth, locationId });

    const { start, end } = toDateRange({
      range,
      date: dateAnchor,
      from: fromRaw,
      to: toRaw,
    });

    const toIso = (v: any): string => {
      if (!v) return "";
      const d = v instanceof Date ? v : new Date(v);
      if (!Number.isFinite(d.getTime())) return String(v);
      return d.toISOString();
    };

    // POS invoices are stored as payments with notes TOURIST_TICKETS:* and qr_data.tourist_invoice
    const posWhere: string[] = [
      "location_id = ?",
      "status = 'completed'",
      "notes LIKE 'TOURIST_TICKETS:%'",
    ];
    const posParams: any[] = [locationId];
    if (start && end) {
      posWhere.push("payment_time >= ? AND payment_time < ?");
      posParams.push(start);
      posParams.push(end);
    }

    const [posPayRows] = await pool.query<RowDataPacket[]>(
      `SELECT payment_id,
              amount,
              payment_method,
              payment_time,
              performed_by_name,
              performed_by_user_id,
              performed_by_role,
              qr_data,
              notes
       FROM payments
       WHERE ${posWhere.join(" AND ")}
       ORDER BY payment_time DESC
       LIMIT 2000`,
      posParams,
    );

    const posInvoices: any[] = [];
    for (const r of posPayRows) {
      let qr: any = null;
      try {
        if (!r.qr_data) {
          qr = null;
        } else if (typeof r.qr_data === "string") {
          qr = JSON.parse(r.qr_data);
        } else if (Buffer.isBuffer(r.qr_data)) {
          qr = JSON.parse(r.qr_data.toString("utf8"));
        } else if (typeof r.qr_data === "object") {
          qr = r.qr_data;
        } else {
          qr = null;
        }
      } catch {
        qr = null;
      }

      const inv = qr?.tourist_invoice;
      const itemsRaw: any[] = Array.isArray(inv?.items) ? inv.items : [];

      type PosInvoiceItem = {
        service_id: number | null;
        service_name: string;
        quantity: number;
        unit_price: number;
        line_total: number;
      };

      const items: PosInvoiceItem[] = itemsRaw
        .map((it: any): PosInvoiceItem | null => {
          const serviceId = Number(it?.service_id);
          const serviceName = String(it?.service_name || "").trim();
          const qty = Number(it?.quantity || 0);
          const unitPrice = Number(it?.unit_price || 0);
          const lineTotal = Number(it?.line_total || unitPrice * qty || 0);
          if (!Number.isFinite(qty) || qty <= 0) return null;
          return {
            service_id: Number.isFinite(serviceId) ? serviceId : null,
            service_name: serviceName || "-",
            quantity: qty,
            unit_price: unitPrice,
            line_total: lineTotal,
          };
        })
        .filter((x: PosInvoiceItem | null): x is PosInvoiceItem => Boolean(x));

      const totalQty = items.reduce((sum, item) => sum + item.quantity, 0);
      const totalAmount =
        Number(inv?.total_amount || 0) ||
        items.reduce((sum, item) => sum + item.line_total, 0) ||
        Number(r.amount || 0);

      posInvoices.push({
        source: "pos",
        payment_id: Number(r.payment_id),
        booking_id: null,
        payment_time: toIso(r.payment_time),
        payment_method: String(r.payment_method || ""),
        seller_name: String(r.performed_by_name || "").trim() || null,
        seller_user_id: r.performed_by_user_id ?? null,
        seller_role: r.performed_by_role ?? null,
        buyer_id: null,
        buyer_name: null,
        buyer_phone: null,
        total_qty: totalQty,
        total_amount: totalAmount,
        items,
      });
    }

    // Online invoices: group booking_tickets by booking_id
    const btWhere: string[] = ["bt.location_id = ?", "bt.status <> 'void'"];
    const btParams: any[] = [locationId];
    if (start && end) {
      btWhere.push("bt.issued_at >= ? AND bt.issued_at < ?");
      btParams.push(start);
      btParams.push(end);
    }

    const [bookingItemRows] = await pool.query<RowDataPacket[]>(
      `SELECT bt.booking_id,
              MAX(bt.issued_at) AS issued_at,
              MAX(b.user_id) AS buyer_id,
              MAX(u.full_name) AS buyer_name,
              MAX(u.phone) AS buyer_phone,
              MAX(p.payment_id) AS payment_id,
              MAX(p.payment_time) AS payment_time,
              MAX(p.payment_method) AS payment_method,
              bt.service_id,
              MAX(s.service_name) AS service_name,
              MAX(s.price) AS unit_price,
              COUNT(*) AS quantity
       FROM booking_tickets bt
       JOIN bookings b ON b.booking_id = bt.booking_id
       JOIN users u ON u.user_id = b.user_id
       JOIN services s ON s.service_id = bt.service_id
       LEFT JOIN (
         SELECT booking_id,
                MAX(payment_id) AS payment_id,
                MAX(payment_time) AS payment_time,
                MAX(payment_method) AS payment_method
         FROM payments
         WHERE status = 'completed'
           AND booking_id IS NOT NULL
         GROUP BY booking_id
       ) p ON p.booking_id = bt.booking_id
       WHERE ${btWhere.join(" AND ")}
       GROUP BY bt.booking_id, bt.service_id
       ORDER BY issued_at DESC
       LIMIT 5000`,
      btParams,
    );

    const bookingById = new Map<
      number,
      {
        source: "booking";
        payment_id: number | null;
        booking_id: number;
        payment_time: string;
        payment_method?: string | null;
        buyer_id: number | null;
        buyer_name: string | null;
        buyer_phone: string | null;
        total_qty: number;
        total_amount: number;
        items: Array<{
          service_id: number;
          service_name: string;
          quantity: number;
          unit_price: number;
          line_total: number;
        }>;
      }
    >();

    for (const r of bookingItemRows) {
      const bookingId = Number(r.booking_id);
      if (!Number.isFinite(bookingId)) continue;

      const qty = Number(r.quantity || 0);
      const unitPrice = Number(r.unit_price || 0);
      const lineTotal = Number(unitPrice * qty);
      if (!Number.isFinite(qty) || qty <= 0) continue;

      const inv = bookingById.get(bookingId) ?? {
        source: "booking" as const,
        payment_id: r.payment_id != null ? Number(r.payment_id) : null,
        booking_id: bookingId,
        payment_time: toIso(r.payment_time || r.issued_at),
        payment_method: r.payment_method ? String(r.payment_method) : null,
        buyer_id: r.buyer_id != null ? Number(r.buyer_id) : null,
        buyer_name: r.buyer_name ? String(r.buyer_name) : null,
        buyer_phone: r.buyer_phone ? String(r.buyer_phone) : null,
        total_qty: 0,
        total_amount: 0,
        items: [],
      };

      // Prefer payment_time if available
      const candidateTime = toIso(r.payment_time || r.issued_at);
      if (
        candidateTime &&
        (!inv.payment_time || inv.payment_time < candidateTime)
      ) {
        inv.payment_time = candidateTime;
      }

      inv.payment_id =
        r.payment_id != null ? Number(r.payment_id) : inv.payment_id;
      inv.payment_method = r.payment_method
        ? String(r.payment_method)
        : (inv.payment_method ?? null);
      inv.total_qty += qty;
      inv.total_amount += lineTotal;
      inv.items.push({
        service_id: Number(r.service_id),
        service_name: String(r.service_name || "-"),
        quantity: qty,
        unit_price: unitPrice,
        line_total: lineTotal,
      });

      bookingById.set(bookingId, inv);
    }

    const bookingInvoices = Array.from(bookingById.values());

    const invoices = [...posInvoices, ...bookingInvoices].sort(
      (a: any, b: any) => {
        const ta = new Date(String(a.payment_time || "")).getTime();
        const tb = new Date(String(b.payment_time || "")).getTime();
        return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
      },
    );

    res.json({
      success: true,
      data: {
        date: dateAnchor,
        invoices,
      },
    });
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const getTouristTicketsByUser = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    const locationIdRaw = Number((req.query as any)?.location_id);
    const userIdRaw = Number((req.query as any)?.user_id);

    const locationId = Number.isFinite(locationIdRaw) ? locationIdRaw : null;
    if (!locationId) {
      res
        .status(400)
        .json({ success: false, message: "Thiếu location_id" });
      return;
    }

    await ensureLocationAccess({
      auth,
      locationId,
      requiredPermission: auth.role === "employee" ? "can_scan" : undefined,
    });

    const where: string[] = ["bt.location_id = ?", "s.service_type = 'ticket'"];
    const params: Array<number | string> = [locationId];

    if (Number.isFinite(userIdRaw)) {
      where.push("b.user_id = ?");
      params.push(userIdRaw);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
         bt.ticket_id,
         bt.ticket_code,
         bt.status,
         bt.issued_at,
         bt.used_at,
         bt.service_id,
         s.service_name,
         s.images AS service_images,
         b.booking_id,
         b.check_in_date AS use_date,
         b.user_id,
         u.full_name,
         u.phone,
         l.location_id,
         l.location_name,
         (
           SELECT p.status
           FROM payments p
           WHERE p.booking_id = b.booking_id
             AND p.transaction_source = 'online_booking'
           ORDER BY p.payment_id DESC
           LIMIT 1
         ) AS payment_status
       FROM booking_tickets bt
       JOIN bookings b ON b.booking_id = bt.booking_id
       JOIN services s ON s.service_id = bt.service_id
       JOIN locations l ON l.location_id = bt.location_id
       LEFT JOIN users u ON u.user_id = b.user_id
       ${whereSql}
         AND (
           EXISTS (
             SELECT 1
             FROM payments p
             WHERE p.booking_id = b.booking_id
               AND p.transaction_source = 'online_booking'
               AND p.status = 'completed'
           )
           OR b.status IN ('confirmed','completed')
         )
       ORDER BY bt.issued_at DESC, bt.ticket_id DESC`,
      params,
    );

    res.json({ success: true, data: rows || [] });
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const scanTouristTicket = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    const { location_id, ticket_code } = req.body as {
      location_id?: number;
      ticket_code?: string;
    };

    const locationId = Number(location_id);
    const rawCode = String(ticket_code || "").trim();

    const normalizeTicketCode = (input: string): string => {
      const trimmed = input.trim();
      if (!trimmed) return "";

      if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
        try {
          const parsed = JSON.parse(trimmed) as any;
          if (parsed && typeof parsed.ticket_code === "string") {
            return String(parsed.ticket_code).trim();
          }
        } catch {
          // ignore
        }
      }

      if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
        try {
          const url = new URL(trimmed);
          const codeParam =
            url.searchParams.get("ticket_code") ||
            url.searchParams.get("code") ||
            url.searchParams.get("ticket") ||
            "";
          if (codeParam) return codeParam.trim();
        } catch {
          // ignore
        }
      }

      const match = trimmed.match(/ticket_code=([A-Za-z0-9_-]+)/i);
      if (match && match[1]) return match[1].trim();

      return trimmed;
    };

    const code = normalizeTicketCode(rawCode);
    if (!Number.isFinite(locationId) || !code) {
      res
        .status(400)
        .json({ success: false, message: "Thiếu location_id/ticket_code" });
      return;
    }

    const { ownerId } = await ensureLocationAccess({
      auth,
      locationId,
      requiredPermission: auth.role === "employee" ? "can_scan" : undefined,
    });

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Try booking ticket first
      const [btRows] = await conn.query<RowDataPacket[]>(
        `SELECT bt.ticket_id, bt.booking_id, bt.service_id, bt.status, s.service_name
         FROM booking_tickets bt
         JOIN services s ON s.service_id = bt.service_id
         WHERE bt.location_id = ? AND bt.ticket_code = ?
         LIMIT 1
         FOR UPDATE`,
        [locationId, code],
      );

      if (btRows[0]) {
        if (String(btRows[0].status) !== "unused") {
          await conn.rollback();
          res.status(400).json({
            success: false,
            message: "Vé đã được sử dụng/không hợp lệ",
          });
          return;
        }

        // Basic paid/valid check
        const [payRows] = await conn.query<RowDataPacket[]>(
          `SELECT b.status as booking_status,
                  (SELECT COUNT(*) FROM payments p WHERE p.booking_id = b.booking_id AND p.status = 'completed') as paid_count
           FROM bookings b
           WHERE b.booking_id = ?
           LIMIT 1`,
          [btRows[0].booking_id],
        );

        const paidCount = Number(payRows[0]?.paid_count || 0);
        const bookingStatus = String(payRows[0]?.booking_status || "");
        const isPaid =
          paidCount > 0 ||
          bookingStatus === "confirmed" ||
          bookingStatus === "completed";
        if (!isPaid) {
          await conn.rollback();
          res.status(400).json({
            success: false,
            message: "Vé chưa thanh toán/booking chưa xác nhận",
          });
          return;
        }

        await conn.query(
          `UPDATE booking_tickets
           SET status = 'used', used_at = CURRENT_TIMESTAMP, used_by = ?
           WHERE ticket_id = ?`,
          [auth.userId, btRows[0].ticket_id],
        );

        const serviceName = String(btRows[0].service_name || "");

        await conn.commit();
        await publishTouristUpdated(conn, locationId, ownerId, {
          action: "ticket_used",
          source: "booking",
        });
        res.json({
          success: true,
          data: {
            source: "booking",
            ticket_code: code,
            service_name: serviceName,
          },
        });
        return;
      }

      // Try POS ticket
      const [ptRows] = await conn.query<RowDataPacket[]>(
        `SELECT pt.pos_ticket_id, pt.status, pt.service_id, s.service_name
         FROM pos_tickets pt
         JOIN services s ON s.service_id = pt.service_id
         WHERE pt.location_id = ? AND pt.ticket_code = ?
         LIMIT 1
         FOR UPDATE`,
        [locationId, code],
      );

      if (!ptRows[0]) {
        await conn.rollback();
        res.status(404).json({ success: false, message: "Không tìm thấy vé" });
        return;
      }

      if (String(ptRows[0].status) !== "unused") {
        await conn.rollback();
        res
          .status(400)
          .json({ success: false, message: "Vé đã được sử dụng/không hợp lệ" });
        return;
      }

      await conn.query(
        `UPDATE pos_tickets
         SET status = 'used', used_at = CURRENT_TIMESTAMP, used_by = ?
         WHERE pos_ticket_id = ?`,
        [auth.userId, ptRows[0].pos_ticket_id],
      );

      const serviceName = String(ptRows[0].service_name || "");

      await conn.commit();
      await publishTouristUpdated(conn, locationId, ownerId, {
        action: "ticket_used",
        source: "pos",
      });
      res.json({
        success: true,
        data: {
          source: "pos",
          ticket_code: code,
          service_name: serviceName,
        },
      });
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
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const sellTouristPosTickets = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    const { location_id, service_id, quantity } = req.body as {
      location_id?: number;
      service_id?: number;
      quantity?: number;
    };

    const locationId = Number(location_id);
    const serviceId = Number(service_id);
    const qty = Math.max(1, Math.min(200, Number(quantity ?? 1)));

    if (!Number.isFinite(locationId) || !Number.isFinite(serviceId)) {
      res
        .status(400)
        .json({ success: false, message: "Thiếu location_id/service_id" });
      return;
    }

    const { ownerId } = await ensureLocationAccess({
      auth,
      locationId,
      requiredPermission:
        auth.role === "employee" ? "can_manage_bookings" : undefined,
    });

    const posSupport = await getPosTicketsSchemaSupport();

    const [svcRows] = await pool.query<RowDataPacket[]>(
      `SELECT service_id, service_name, quantity, admin_status
       FROM services
       WHERE service_id = ? AND location_id = ? AND service_type = 'ticket'
       LIMIT 1`,
      [serviceId, locationId],
    );
    if (!svcRows[0]) {
      res
        .status(404)
        .json({ success: false, message: "Không tìm thấy dịch vụ vé" });
      return;
    }

    if (String(svcRows[0].admin_status || "") !== "approved") {
      res.status(400).json({
        success: false,
        message: "Dịch vụ vé chưa được admin duyệt",
      });
      return;
    }

    const serviceName = String(svcRows[0]?.service_name || "");

    const totalToday = Math.max(0, Number(svcRows[0].quantity || 0));
    const [[soldAgg]] = await pool.query<RowDataPacket[]>(
      `SELECT
         (SELECT COUNT(*)
          FROM booking_tickets bt
          WHERE bt.location_id = ?
            AND bt.service_id = ?
            AND bt.status <> 'void'
            AND DATE(bt.issued_at) = CURDATE())
         +
         (SELECT COUNT(*)
          FROM pos_tickets pt
          WHERE pt.location_id = ?
            AND pt.service_id = ?
            AND pt.status <> 'void'
            AND DATE(pt.sold_at) = CURDATE())
         AS sold_today`,
      [locationId, serviceId, locationId, serviceId],
    );
    const soldToday = Number(soldAgg?.sold_today || 0);
    const remainingToday = Math.max(0, totalToday - soldToday);
    if (qty > remainingToday) {
      res.status(400).json({
        success: false,
        message: "Không đủ vé hôm nay",
        data: {
          total_today: totalToday,
          sold_today: soldToday,
          remaining_today: remainingToday,
        },
      });
      return;
    }

    const codes: string[] = [];
    let ticketRows: RowDataPacket[] = [];
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const insertSql = posSupport.hasSoldBy
        ? `INSERT INTO pos_tickets (location_id, service_id, ticket_code, status, sold_by)
           VALUES (?, ?, ?, 'unused', ?)`
        : `INSERT INTO pos_tickets (location_id, service_id, ticket_code, status)
           VALUES (?, ?, ?, 'unused')`;
      for (let i = 0; i < qty; i++) {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, "0");
        const d = String(now.getDate()).padStart(2, "0");
        const hh = String(now.getHours()).padStart(2, "0");
        const mm = String(now.getMinutes()).padStart(2, "0");
        const ss = String(now.getSeconds()).padStart(2, "0");
        const stamp = `${y}${m}${d}-${hh}${mm}${ss}`;
        const code = `PT-${locationId}-${serviceId}-${stamp}-${crypto.randomBytes(3).toString("hex")}`;
        codes.push(code);
        await conn.query(
          insertSql,
          posSupport.hasSoldBy
            ? [locationId, serviceId, code, auth.userId]
            : [locationId, serviceId, code],
        );
      }

      const [rows] = await conn.query<RowDataPacket[]>(
        `SELECT ticket_code, sold_at
         FROM pos_tickets
         WHERE location_id = ? AND service_id = ? AND ticket_code IN (?)
         ORDER BY sold_at ASC`,
        [locationId, serviceId, codes],
      );
      ticketRows = rows;

      await conn.commit();
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

    await publishTouristUpdated(pool, locationId, ownerId, {
      action: "tickets_sold",
      service_id: serviceId,
      quantity: qty,
    });

    await logAudit(auth.userId, "SELL_POS_TICKETS", {
      location_id: locationId,
      service_id: serviceId,
      quantity: qty,
      timestamp: new Date(),
    });

    res.status(201).json({
      success: true,
      data: {
        ticket_codes: codes,
        tickets: (ticketRows || []).map((r) => ({
          ticket_code: String(r.ticket_code || ""),
          sold_at: r.sold_at,
          service_id: serviceId,
          service_name: serviceName,
        })),
      },
    });
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const sellTouristPosTicketsBatch = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    const { location_id, items } = req.body as {
      location_id?: number;
      items?: Array<{ service_id?: number; quantity?: number }>;
    };

    const locationId = Number(location_id);
    if (!Number.isFinite(locationId)) {
      res.status(400).json({ success: false, message: "Thiếu location_id" });
      return;
    }

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ success: false, message: "Thiếu items" });
      return;
    }

    const { ownerId } = await ensureLocationAccess({
      auth,
      locationId,
      requiredPermission:
        auth.role === "employee" ? "can_manage_bookings" : undefined,
    });

    const posSupport = await getPosTicketsSchemaSupport();

    const merged = new Map<number, number>();
    for (const it of items) {
      const serviceId = Number((it as any)?.service_id);
      const qty = Math.max(
        1,
        Math.min(200, Number((it as any)?.quantity ?? 1)),
      );
      if (!Number.isFinite(serviceId)) {
        res.status(400).json({
          success: false,
          message: "items có service_id không hợp lệ",
        });
        return;
      }
      if (!Number.isFinite(qty) || qty < 1) {
        res.status(400).json({
          success: false,
          message: "items có quantity không hợp lệ",
        });
        return;
      }
      merged.set(serviceId, (merged.get(serviceId) ?? 0) + qty);
    }

    const serviceIds = Array.from(merged.keys());
    const totalRequested = Array.from(merged.values()).reduce(
      (sum, v) => sum + v,
      0,
    );
    if (totalRequested > 500) {
      res.status(400).json({
        success: false,
        message: "Số vé tối đa cho 1 lần thanh toán là 500",
      });
      return;
    }

    const [svcRows] = await pool.query<RowDataPacket[]>(
      `SELECT service_id, service_name, quantity, admin_status
       FROM services
       WHERE location_id = ?
         AND service_type = 'ticket'
         AND deleted_at IS NULL
         AND service_id IN (?)`,
      [locationId, serviceIds],
    );

    const svcById = new Map<
      number,
      { service_name: string; quantity: number; admin_status: string }
    >();
    for (const r of svcRows) {
      svcById.set(Number(r.service_id), {
        service_name: String(r.service_name || ""),
        quantity: Math.max(0, Number(r.quantity || 0)),
        admin_status: String((r as any).admin_status || ""),
      });
    }
    for (const id of serviceIds) {
      if (!svcById.has(id)) {
        res.status(404).json({
          success: false,
          message: `Không tìm thấy dịch vụ vé (service_id=${id})`,
        });
        return;
      }
      if (String(svcById.get(id)!.admin_status) !== "approved") {
        res.status(400).json({
          success: false,
          message: `Dịch vụ vé (service_id=${id}) chưa được admin duyệt`,
        });
        return;
      }
    }

    const [soldRows] = await pool.query<RowDataPacket[]>(
      `SELECT service_id, SUM(cnt) AS sold_today
       FROM (
         SELECT service_id, COUNT(*) AS cnt
         FROM booking_tickets
         WHERE location_id = ?
           AND status <> 'void'
           AND DATE(issued_at) = CURDATE()
           AND service_id IN (?)
         GROUP BY service_id
         UNION ALL
         SELECT service_id, COUNT(*) AS cnt
         FROM pos_tickets
         WHERE location_id = ?
           AND status <> 'void'
           AND DATE(sold_at) = CURDATE()
           AND service_id IN (?)
         GROUP BY service_id
       ) t
       GROUP BY service_id`,
      [locationId, serviceIds, locationId, serviceIds],
    );

    const soldByService = new Map<number, number>();
    for (const r of soldRows) {
      soldByService.set(Number(r.service_id), Number(r.sold_today || 0));
    }

    const insufficient: Array<{
      service_id: number;
      service_name: string;
      total_today: number;
      sold_today: number;
      remaining_today: number;
      requested: number;
    }> = [];

    for (const [serviceId, qty] of merged) {
      const svc = svcById.get(serviceId)!;
      const totalToday = svc.quantity;
      const soldToday = soldByService.get(serviceId) ?? 0;
      const remainingToday = Math.max(0, totalToday - soldToday);
      if (qty > remainingToday) {
        insufficient.push({
          service_id: serviceId,
          service_name: svc.service_name,
          total_today: totalToday,
          sold_today: soldToday,
          remaining_today: remainingToday,
          requested: qty,
        });
      }
    }

    if (insufficient.length > 0) {
      res.status(400).json({
        success: false,
        message: "Không đủ vé hôm nay",
        data: { insufficient },
      });
      return;
    }

    const codes: string[] = [];
    let ticketRows: RowDataPacket[] = [];
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const insertSql = posSupport.hasSoldBy
        ? `INSERT INTO pos_tickets (location_id, service_id, ticket_code, status, sold_by)
          VALUES (?, ?, ?, 'unused', ?)`
        : `INSERT INTO pos_tickets (location_id, service_id, ticket_code, status)
          VALUES (?, ?, ?, 'unused')`;

      for (const [serviceId, qty] of merged) {
        for (let i = 0; i < qty; i++) {
          const now = new Date();
          const y = now.getFullYear();
          const m = String(now.getMonth() + 1).padStart(2, "0");
          const d = String(now.getDate()).padStart(2, "0");
          const hh = String(now.getHours()).padStart(2, "0");
          const mm = String(now.getMinutes()).padStart(2, "0");
          const ss = String(now.getSeconds()).padStart(2, "0");
          const stamp = `${y}${m}${d}-${hh}${mm}${ss}`;
          const code = `PT-${locationId}-${serviceId}-${stamp}-${crypto
            .randomBytes(3)
            .toString("hex")}`;
          codes.push(code);
          await conn.query(
            insertSql,
            posSupport.hasSoldBy
              ? [locationId, serviceId, code, auth.userId]
              : [locationId, serviceId, code],
          );
        }
      }

      const [rows] = await conn.query<RowDataPacket[]>(
        `SELECT service_id, ticket_code, sold_at
         FROM pos_tickets
         WHERE location_id = ?
           AND ticket_code IN (?)
         ORDER BY sold_at ASC`,
        [locationId, codes],
      );
      ticketRows = rows;

      await conn.commit();
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

    await publishTouristUpdated(pool, locationId, ownerId, {
      action: "tickets_sold_batch",
      items: Array.from(merged.entries()).map(([service_id, quantity]) => ({
        service_id,
        quantity,
      })),
    });

    await logAudit(auth.userId, "SELL_POS_TICKETS_BATCH", {
      location_id: locationId,
      items: Array.from(merged.entries()).map(([service_id, quantity]) => ({
        service_id,
        quantity,
      })),
      timestamp: new Date(),
    });

    res.status(201).json({
      success: true,
      data: {
        ticket_codes: codes,
        tickets: (ticketRows || []).map((r) => {
          const sid = Number(r.service_id);
          const svc = svcById.get(sid);
          return {
            ticket_code: String(r.ticket_code || ""),
            sold_at: r.sold_at,
            service_id: sid,
            service_name: svc?.service_name ?? "",
          };
        }),
      },
    });
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const payTouristPosTicketsBatch = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const auth = await getAuth(req);
    const { location_id, items, payment_method, step, payment_id } =
      req.body as {
        location_id?: number;
        items?: Array<{ service_id?: number; quantity?: number }>;
        payment_method?: "cash" | "transfer";
        step?: "init" | "complete";
        payment_id?: number;
      };

    const locationId = Number(location_id);
    if (!Number.isFinite(locationId)) {
      res.status(400).json({ success: false, message: "Thiếu location_id" });
      return;
    }
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ success: false, message: "Thiếu items" });
      return;
    }

    const pm = String(payment_method || "");
    if (pm !== "cash" && pm !== "transfer") {
      res
        .status(400)
        .json({ success: false, message: "payment_method không hợp lệ" });
      return;
    }
    const flowStep: "init" | "complete" =
      step === "complete" ? "complete" : "init";

    const { ownerId } = await ensureLocationAccess({
      auth,
      locationId,
      requiredPermission:
        auth.role === "employee" ? "can_manage_bookings" : undefined,
    });

    const posSupport = await getPosTicketsSchemaSupport();

    const merged = new Map<number, number>();
    for (const it of items) {
      const serviceId = Number((it as any)?.service_id);
      const qty = Math.max(
        1,
        Math.min(200, Number((it as any)?.quantity ?? 1)),
      );
      if (!Number.isFinite(serviceId)) {
        res.status(400).json({
          success: false,
          message: "items có service_id không hợp lệ",
        });
        return;
      }
      if (!Number.isFinite(qty) || qty < 1) {
        res.status(400).json({
          success: false,
          message: "items có quantity không hợp lệ",
        });
        return;
      }
      merged.set(serviceId, (merged.get(serviceId) ?? 0) + qty);
    }

    const serviceIds = Array.from(merged.keys());
    const totalRequested = Array.from(merged.values()).reduce(
      (sum, v) => sum + v,
      0,
    );
    if (totalRequested > 500) {
      res.status(400).json({
        success: false,
        message: "Số vé tối đa cho 1 lần thanh toán là 500",
      });
      return;
    }

    const sortedKeyParts = [...merged.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([sid, qty]) => `${sid}x${qty}`);
    const noteKey = `TOURIST_TICKETS:${sortedKeyParts.join(",")}`;

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [locRows] = await conn.query<RowDataPacket[]>(
        `SELECT location_name
         FROM locations
         WHERE location_id = ?
         LIMIT 1`,
        [locationId],
      );
      const locationName = String(locRows[0]?.location_name || "").trim();

      const [ownerRows] = await conn.query<RowDataPacket[]>(
        `SELECT full_name FROM users WHERE user_id = ? LIMIT 1`,
        [ownerId],
      );
      const ownerName = String(ownerRows[0]?.full_name || "").trim();

      // Lock ticket services for consistent remaining checks
      const [svcRows] = await conn.query<RowDataPacket[]>(
        `SELECT service_id, service_name, price, quantity, admin_status
         FROM services
         WHERE location_id = ?
           AND service_type = 'ticket'
           AND deleted_at IS NULL
           AND service_id IN (?)
         FOR UPDATE`,
        [locationId, serviceIds],
      );

      const svcById = new Map<
        number,
        {
          service_name: string;
          price: number;
          quantity: number;
          admin_status: string;
        }
      >();
      for (const r of svcRows) {
        svcById.set(Number(r.service_id), {
          service_name: String(r.service_name || ""),
          price: toMoney((r as any).price),
          quantity: Math.max(0, Number((r as any).quantity || 0)),
          admin_status: String((r as any).admin_status || ""),
        });
      }

      for (const id of serviceIds) {
        if (!svcById.has(id)) {
          await conn.rollback();
          res.status(404).json({
            success: false,
            message: `Không tìm thấy dịch vụ vé (service_id=${id})`,
          });
          return;
        }
        if (String(svcById.get(id)!.admin_status) !== "approved") {
          await conn.rollback();
          res.status(400).json({
            success: false,
            message: `Dịch vụ vé (service_id=${id}) chưa được admin duyệt`,
          });
          return;
        }
      }

      const [soldRows] = await conn.query<RowDataPacket[]>(
        `SELECT service_id, SUM(cnt) AS sold_today
         FROM (
           SELECT service_id, COUNT(*) AS cnt
           FROM booking_tickets
           WHERE location_id = ?
             AND status <> 'void'
             AND DATE(issued_at) = CURDATE()
             AND service_id IN (?)
           GROUP BY service_id
           UNION ALL
           SELECT service_id, COUNT(*) AS cnt
           FROM pos_tickets
           WHERE location_id = ?
             AND status <> 'void'
             AND DATE(sold_at) = CURDATE()
             AND service_id IN (?)
           GROUP BY service_id
         ) t
         GROUP BY service_id`,
        [locationId, serviceIds, locationId, serviceIds],
      );
      const soldByService = new Map<number, number>();
      for (const r of soldRows) {
        soldByService.set(Number(r.service_id), Number(r.sold_today || 0));
      }

      const insufficient: Array<{
        service_id: number;
        service_name: string;
        total_today: number;
        sold_today: number;
        remaining_today: number;
        requested: number;
      }> = [];

      for (const [serviceId, qty] of merged) {
        const svc = svcById.get(serviceId)!;
        const totalToday = svc.quantity;
        const soldToday = soldByService.get(serviceId) ?? 0;
        const remainingToday = Math.max(0, totalToday - soldToday);
        if (qty > remainingToday) {
          insufficient.push({
            service_id: serviceId,
            service_name: svc.service_name,
            total_today: totalToday,
            sold_today: soldToday,
            remaining_today: remainingToday,
            requested: qty,
          });
        }
      }

      if (insufficient.length > 0) {
        await conn.rollback();
        res.status(400).json({
          success: false,
          message: "Không đủ vé hôm nay",
          data: { insufficient },
        });
        return;
      }

      const itemsSnap = [...merged.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([serviceId, qty]) => {
          const svc = svcById.get(serviceId)!;
          const unitPrice = toMoney(svc.price);
          const lineTotal = toMoney(unitPrice * qty);
          return {
            service_id: serviceId,
            service_name: svc.service_name,
            quantity: qty,
            unit_price: unitPrice,
            line_total: lineTotal,
          };
        });

      const totalQty = itemsSnap.reduce(
        (s, x) => s + Number(x.quantity || 0),
        0,
      );
      const totalAmount = toMoney(
        itemsSnap.reduce((s, x) => s + Number(x.line_total || 0), 0),
      );

      const now = new Date();

      const invoiceSnapshot = {
        payment_id: null as number | null,
        location_name: locationName || null,
        owner_name: ownerName || null,
        payment_time: now.toISOString(),
        items: itemsSnap,
        total_qty: totalQty,
        total_amount: totalAmount,
      };

      const baseQrData: any = {
        content: "TOURIST_TICKETS",
        location_id: locationId,
        amount: totalAmount,
        method: pm,
        tourist_invoice: invoiceSnapshot,
      };

      const makeTicketCode = (serviceId: number) => {
        const ts = new Date();
        const y = ts.getFullYear();
        const m = String(ts.getMonth() + 1).padStart(2, "0");
        const d = String(ts.getDate()).padStart(2, "0");
        const hh = String(ts.getHours()).padStart(2, "0");
        const mm = String(ts.getMinutes()).padStart(2, "0");
        const ss = String(ts.getSeconds()).padStart(2, "0");
        const stamp = `${y}${m}${d}-${hh}${mm}${ss}`;
        return `PT-${locationId}-${serviceId}-${stamp}-${crypto
          .randomBytes(3)
          .toString("hex")}`;
      };

      const issueTickets = async () => {
        const codes: string[] = [];
        const insertSql = posSupport.hasSoldBy
          ? `INSERT INTO pos_tickets (location_id, service_id, ticket_code, status, sold_by)
             VALUES (?, ?, ?, 'unused', ?)`
          : `INSERT INTO pos_tickets (location_id, service_id, ticket_code, status)
             VALUES (?, ?, ?, 'unused')`;
        for (const it of itemsSnap) {
          const serviceId = Number(it.service_id);
          const qty = Math.max(1, Number(it.quantity || 1));
          for (let i = 0; i < qty; i++) {
            const code = makeTicketCode(serviceId);
            codes.push(code);
            await conn.query(
              insertSql,
              posSupport.hasSoldBy
                ? [locationId, serviceId, code, auth.userId]
                : [locationId, serviceId, code],
            );
          }
        }

        const [ticketRows] = await conn.query<RowDataPacket[]>(
          `SELECT service_id, ticket_code, sold_at
           FROM pos_tickets
           WHERE location_id = ? AND ticket_code IN (?)
           ORDER BY sold_at ASC`,
          [locationId, codes],
        );

        return {
          ticket_codes: codes,
          tickets: (ticketRows || []).map((r) => {
            const sid = Number((r as any).service_id);
            const svc = svcById.get(sid);
            return {
              ticket_code: String((r as any).ticket_code || ""),
              sold_at: (r as any).sold_at,
              service_id: sid,
              service_name: svc?.service_name ?? "",
            };
          }),
        };
      };

      // Cash: one-step like POS food
      if (pm === "cash") {
        const support = await getPaymentsSchemaSupport();
        const staff = await getUserSnapshotWithConn(conn, auth.userId);

        const columns = [
          "user_id",
          "location_id",
          "booking_id",
          "amount",
          "commission_rate",
          "commission_amount",
          "vat_rate",
          "vat_amount",
          "owner_receivable",
          "payment_method",
          "transaction_code",
          "qr_data",
          "status",
          "notes",
        ];
        const values = [
          "NULL",
          "?",
          "NULL",
          "?",
          "0.00",
          "0.00",
          "0.00",
          "0.00",
          "?",
          "'Cash'",
          "NULL",
          "?",
          "'completed'",
          "?",
        ];
        const params: any[] = [
          locationId,
          totalAmount,
          totalAmount,
          JSON.stringify(baseQrData),
          noteKey,
        ];

        if (support.hasPerformedByUserId) {
          columns.push("performed_by_user_id");
          values.push("?");
          params.push(auth.userId);
        }
        if (support.hasPerformedByRole) {
          columns.push("performed_by_role");
          values.push("?");
          params.push(auth.role);
        }
        if (support.hasPerformedByName) {
          columns.push("performed_by_name");
          values.push("?");
          params.push(staff.full_name || null);
        }

        const [paymentInsert] = await conn.query<ResultSetHeader>(
          `INSERT INTO payments (\n            ${columns.join(", ")}\n          ) VALUES (${values.join(", ")})`,
          params,
        );
        const paymentId = paymentInsert.insertId;
        invoiceSnapshot.payment_id = paymentId;

        const issued = await issueTickets();

        await logAuditWithConn(conn, auth.userId, "SELL_POS_TICKETS_BATCH", {
          location_id: locationId,
          payment_id: paymentId,
          items: Array.from(merged.entries()).map(([service_id, quantity]) => ({
            service_id,
            quantity,
          })),
          payment_method: "cash",
          amount: totalAmount,
          timestamp: new Date(),
        });

        await conn.commit();
        await publishTouristUpdated(pool, locationId, ownerId, {
          action: "tickets_sold_batch",
          items: Array.from(merged.entries()).map(([service_id, quantity]) => ({
            service_id,
            quantity,
          })),
        });

        res.status(201).json({
          success: true,
          data: {
            invoice: invoiceSnapshot,
            ...issued,
          },
        });
        return;
      }

      // Transfer: init/complete
      const normalizeBankKey = (input: string): string => {
        return input
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]/g, "");
      };
      const bankBinMap: Record<string, string> = {
        vietcombank: "970436",
        vcb: "970436",
        vietinbank: "970415",
        bidv: "970418",
        agribank: "970405",
        mb: "970422",
        mbbank: "970422",
        acb: "970416",
        techcombank: "970407",
        tcb: "970407",
        sacombank: "970403",
        scb: "970429",
        vpbank: "970432",
        tpbank: "970423",
        vib: "970441",
        shb: "970443",
        hdbank: "970437",
        ocb: "970448",
        msb: "970426",
        eximbank: "970431",
        seabank: "970440",
      };

      const [bankRows] = await conn.query<RowDataPacket[]>(
        `SELECT bank_account, bank_name, account_holder
         FROM owner_profiles
         WHERE owner_id = ?
         LIMIT 1`,
        [ownerId],
      );
      const bankAccount = String(bankRows[0]?.bank_account || "").trim();
      const bankName = String(bankRows[0]?.bank_name || "").trim();
      const accountHolder = String(bankRows[0]?.account_holder || "").trim();
      if (!bankAccount || !bankName || !accountHolder) {
        await conn.rollback();
        res.status(400).json({
          success: false,
          message:
            "Owner chưa cập nhật đủ thông tin ngân hàng (bank_account/bank_name/account_holder)",
        });
        return;
      }
      const resolvedBin = bankBinMap[normalizeBankKey(bankName)] || "";
      if (!resolvedBin) {
        await conn.rollback();
        res.status(400).json({
          success: false,
          message:
            "Không xác định được mã BIN ngân hàng từ bank_name. Vui lòng cập nhật bank_name hợp lệ.",
        });
        return;
      }

      const qrNote = locationName
        ? `${locationName} - Cảm ơn quý khách`
        : "Cảm ơn quý khách";
      const qrAmount = Math.max(0, Math.round(Number(totalAmount || 0)));
      const qrCodeUrl = `https://img.vietqr.io/image/${resolvedBin}-${encodeURIComponent(
        bankAccount,
      )}-qr_only.png?amount=${encodeURIComponent(String(qrAmount))}&addInfo=${encodeURIComponent(
        qrNote,
      )}`;

      const transferQr = {
        qr_code_url: qrCodeUrl,
        bank_name: bankName,
        bank_account: bankAccount,
        account_holder: accountHolder,
        bank_bin: resolvedBin,
        amount: qrAmount,
        note: qrNote,
      };
      baseQrData.bank = transferQr;

      const support = await getPaymentsSchemaSupport();
      const staff = await getUserSnapshotWithConn(conn, auth.userId);

      if (flowStep === "init") {
        const [pendingRows] = await conn.query<RowDataPacket[]>(
          `SELECT payment_id
           FROM payments
           WHERE location_id = ?
             AND status = 'pending'
             AND notes = ?
           ORDER BY payment_id DESC
           LIMIT 1
           FOR UPDATE`,
          [locationId, noteKey],
        );

        let paymentId: number;
        if (pendingRows[0]?.payment_id) {
          paymentId = Number(pendingRows[0].payment_id);
          const setParts: string[] = [
            "amount = ?",
            "owner_receivable = ?",
            "qr_data = ?",
            "payment_method = ?",
          ];
          const setParams: any[] = [
            totalAmount,
            totalAmount,
            JSON.stringify(baseQrData),
            "BankTransfer",
          ];
          if (support.hasPerformedByUserId) {
            setParts.push("performed_by_user_id = ?");
            setParams.push(auth.userId);
          }
          if (support.hasPerformedByRole) {
            setParts.push("performed_by_role = ?");
            setParams.push(auth.role);
          }
          if (support.hasPerformedByName) {
            setParts.push("performed_by_name = ?");
            setParams.push(staff.full_name || null);
          }
          setParams.push(paymentId);
          await conn.query(
            `UPDATE payments SET ${setParts.join(", ")} WHERE payment_id = ?`,
            setParams,
          );
        } else {
          const columns = [
            "user_id",
            "location_id",
            "booking_id",
            "amount",
            "commission_rate",
            "commission_amount",
            "vat_rate",
            "vat_amount",
            "owner_receivable",
            "payment_method",
            "transaction_code",
            "qr_data",
            "status",
            "notes",
          ];
          const values = [
            "NULL",
            "?",
            "NULL",
            "?",
            "0.00",
            "0.00",
            "0.00",
            "0.00",
            "?",
            "?",
            "NULL",
            "?",
            "?",
            "?",
          ];
          const params: any[] = [
            locationId,
            totalAmount,
            totalAmount,
            "BankTransfer",
            JSON.stringify(baseQrData),
            "pending",
            noteKey,
          ];

          if (support.hasPerformedByUserId) {
            columns.push("performed_by_user_id");
            values.push("?");
            params.push(auth.userId);
          }
          if (support.hasPerformedByRole) {
            columns.push("performed_by_role");
            values.push("?");
            params.push(auth.role);
          }
          if (support.hasPerformedByName) {
            columns.push("performed_by_name");
            values.push("?");
            params.push(staff.full_name || null);
          }

          const [paymentInsert] = await conn.query<ResultSetHeader>(
            `INSERT INTO payments (\n          ${columns.join(", ")}\n        ) VALUES (${values.join(", ")})`,
            params,
          );
          paymentId = paymentInsert.insertId;
        }

        await conn.commit();
        res.json({
          success: true,
          data: {
            payment_id: paymentId,
            qr: transferQr,
            context: {
              location_name: locationName || null,
              owner_name: ownerName || null,
              payment_time: now.toISOString(),
              items: itemsSnap,
              total_qty: totalQty,
              total_amount: totalAmount,
            },
          },
        });
        return;
      }

      // complete
      const pid = Number(payment_id);
      if (!Number.isFinite(pid)) {
        await conn.rollback();
        res
          .status(400)
          .json({ success: false, message: "payment_id không hợp lệ" });
        return;
      }

      const [payRows] = await conn.query<RowDataPacket[]>(
        `SELECT payment_id, location_id, status, notes
         FROM payments
         WHERE payment_id = ?
         LIMIT 1
         FOR UPDATE`,
        [pid],
      );
      if (!payRows[0]) {
        await conn.rollback();
        res
          .status(404)
          .json({ success: false, message: "Không tìm thấy payment" });
        return;
      }
      if (Number(payRows[0].location_id) !== locationId) {
        await conn.rollback();
        res.status(400).json({
          success: false,
          message: "Payment không thuộc location hiện tại",
        });
        return;
      }
      if (String(payRows[0].notes || "") !== noteKey) {
        await conn.rollback();
        res.status(400).json({
          success: false,
          message: "Payment không khớp giỏ vé hiện tại",
        });
        return;
      }
      if (String(payRows[0].status || "") !== "pending") {
        await conn.rollback();
        res.status(400).json({
          success: false,
          message: "Payment không ở trạng thái pending",
        });
        return;
      }

      const setParts: string[] = [
        "status = 'completed'",
        "amount = ?",
        "owner_receivable = ?",
        "payment_method = ?",
        "qr_data = ?",
      ];
      const setParams: any[] = [
        totalAmount,
        totalAmount,
        "BankTransfer",
        JSON.stringify(baseQrData),
      ];
      if (support.hasPerformedByUserId) {
        setParts.push("performed_by_user_id = ?");
        setParams.push(auth.userId);
      }
      if (support.hasPerformedByRole) {
        setParts.push("performed_by_role = ?");
        setParams.push(auth.role);
      }
      if (support.hasPerformedByName) {
        setParts.push("performed_by_name = ?");
        setParams.push(staff.full_name || null);
      }
      setParams.push(pid);
      await conn.query(
        `UPDATE payments SET ${setParts.join(", ")} WHERE payment_id = ?`,
        setParams,
      );

      invoiceSnapshot.payment_id = pid;
      const issued = await issueTickets();

      await logAuditWithConn(conn, auth.userId, "SELL_POS_TICKETS_BATCH", {
        location_id: locationId,
        payment_id: pid,
        items: Array.from(merged.entries()).map(([service_id, quantity]) => ({
          service_id,
          quantity,
        })),
        payment_method: "transfer",
        amount: totalAmount,
        timestamp: new Date(),
      });

      await conn.commit();
      await publishTouristUpdated(pool, locationId, ownerId, {
        action: "tickets_sold_batch",
        items: Array.from(merged.entries()).map(([service_id, quantity]) => ({
          service_id,
          quantity,
        })),
      });

      res.json({
        success: true,
        data: {
          invoice: invoiceSnapshot,
          ...issued,
        },
      });
      return;
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
  } catch (error: any) {
    res
      .status(error?.statusCode || 500)
      .json({ success: false, message: error?.message || "Lỗi server" });
  }
};
