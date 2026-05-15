import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import crypto from "crypto";
import { pool } from "../config/database";
import {
  isBookingError,
  reserveHotelStaysForBookingsIfMissing,
} from "./bookingService";

class BookingPaymentError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

export const isBookingPaymentError = (e: unknown): e is BookingPaymentError => {
  return (
    typeof e === "object" &&
    e !== null &&
    "statusCode" in e &&
    typeof (e as any).statusCode === "number" &&
    "message" in e
  );
};

const randomTransactionCode = (bookingId: number): string => {
  return `BK-${bookingId}-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
};

export type BookingPaymentRow = {
  payment_id: number;
  booking_id: number | null;
  location_id: number;
  user_id: number | null;
  amount: number;
  status: string;
  payment_method: string | null;
  transaction_code: string | null;
  qr_data: unknown;
  payment_time: string | null;
};

const randomBatchTransactionCode = (key: string): string => {
  return `BKB-${key}-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
};

export const createOrGetUserPaymentForBookingBatch = async (params: {
  userId: number;
  bookingIds: number[];
}): Promise<BookingPaymentRow> => {
  const { userId } = params;
  const bookingIds = Array.from(
    new Set(
      (Array.isArray(params.bookingIds) ? params.bookingIds : [])
        .map((x) => Number(x))
        .filter((x) => Number.isFinite(x) && x > 0),
    ),
  );

  if (!Number.isFinite(userId)) {
    throw new BookingPaymentError("Chưa đăng nhập", 401);
  }
  if (bookingIds.length === 0) {
    throw new BookingPaymentError("booking_ids không hợp lệ", 400);
  }

  const bookingKey = bookingIds
    .slice()
    .sort((a, b) => a - b)
    .join(",");
  const batchNote = `BATCH_BOOKINGS:${bookingKey}`;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [existingRows] = await conn.query<RowDataPacket[]>(
      `SELECT *
       FROM payments
       WHERE user_id = ?
         AND transaction_source = 'online_booking'
         AND notes = ?
       ORDER BY payment_id DESC
       LIMIT 1
       FOR UPDATE`,
      [userId, batchNote],
    );
    const existing = Array.isArray(existingRows) ? existingRows[0] : null;
    if (
      existing &&
      !["failed", "refunded"].includes(String(existing.status || ""))
    ) {
      await conn.commit();
      return existing as BookingPaymentRow;
    }

    const placeholders = bookingIds.map(() => "?").join(",");
    const [bookingRows] = await conn.query<RowDataPacket[]>(
      `SELECT b.booking_id, b.user_id, b.location_id, b.final_amount, b.status AS booking_status,
              s.service_type,
              l.owner_id,
              l.location_name,
              l.commission_rate
       FROM bookings b
       JOIN services s ON s.service_id = b.service_id
       JOIN locations l ON l.location_id = b.location_id
       WHERE b.booking_id IN (${placeholders})
       FOR UPDATE`,
      bookingIds,
    );

    if (
      !Array.isArray(bookingRows) ||
      bookingRows.length !== bookingIds.length
    ) {
      throw new BookingPaymentError("Không tìm thấy đủ booking", 404);
    }

    const locationId = Number(bookingRows[0].location_id);
    const ownerId = Number(bookingRows[0].owner_id);
    const locationName = String(bookingRows[0].location_name || "").trim();
    if (!Number.isFinite(locationId) || locationId <= 0) {
      throw new BookingPaymentError("location_id không hợp lệ", 400);
    }
    if (!Number.isFinite(ownerId) || ownerId <= 0) {
      throw new BookingPaymentError("Không xác định được chủ địa điểm", 400);
    }

    let totalAmount = 0;
    for (const br of bookingRows) {
      if (Number(br.user_id) !== Number(userId)) {
        throw new BookingPaymentError(
          "Bạn không có quyền thanh toán booking này",
          403,
        );
      }
      if (Number(br.location_id) !== locationId) {
        throw new BookingPaymentError(
          "Các booking phải cùng một địa điểm",
          400,
        );
      }
      if (String(br.service_type || "") !== "room") {
        throw new BookingPaymentError(
          "Chỉ hỗ trợ gộp thanh toán đặt phòng",
          400,
        );
      }
      const st = String(br.booking_status || "");
      if (!["pending", "confirmed"].includes(st)) {
        throw new BookingPaymentError(
          "Có booking không còn ở trạng thái có thể thanh toán",
          400,
        );
      }
      const amount = Number(br.final_amount || 0);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new BookingPaymentError("Số tiền booking không hợp lệ", 400);
      }
      totalAmount += amount;
    }

    const [ownerRows] = await conn.query<RowDataPacket[]>(
      `SELECT bank_account, bank_name, account_holder
       FROM owner_profiles
       WHERE owner_id = ?
       LIMIT 1`,
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
      throw new BookingPaymentError(
        "Chủ địa điểm chưa cập nhật thông tin ngân hàng để thanh toán",
        400,
      );
    }

    const [settingsRows] = await conn.query<RowDataPacket[]>(
      `SELECT setting_key, setting_value
       FROM system_settings
       WHERE setting_key IN ('default_commission_rate','vat_rate')`,
    );
    const settings: Record<string, string | null> = {};
    for (const r of settingsRows) {
      settings[String(r.setting_key)] = r.setting_value;
    }

    const commissionRate = Number(
      bookingRows[0]?.commission_rate ??
        settings.default_commission_rate ??
        2.5,
    );
    const vatRate = Number(settings.vat_rate ?? 10);
    const safeCommissionRate = Number.isFinite(commissionRate)
      ? commissionRate
      : 2.5;
    const safeVatRate = Number.isFinite(vatRate) ? vatRate : 10;

    const commissionAmount = +(
      (totalAmount * safeCommissionRate) /
      100
    ).toFixed(2);
    const vatAmount = +((commissionAmount * safeVatRate) / 100).toFixed(2);
    const ownerReceivable = +(
      totalAmount -
      commissionAmount -
      vatAmount
    ).toFixed(2);

    const tx = randomBatchTransactionCode(bookingIds.join("-"));
    const qrData = {
      bank_name: bankName,
      bank_account: bankAccount,
      account_holder: accountHolder,
      amount: totalAmount,
      content: locationName
        ? `Thanh toán đặt phòng - ${locationName}`
        : "Thanh toán đặt phòng",
      transaction_code: tx,
      booking_ids: bookingIds,
      booking_scope: "room_batch",
    };

    const [insert] = await conn.query<ResultSetHeader>(
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
        notes,
        performed_by_user_id,
        performed_by_role
      ) VALUES (?, ?, NULL, ?, 'online_booking', ?, ?, ?, ?, ?, 'VietQR', ?, ?, 'pending', ?, ?, 'user')`,
      [
        userId,
        locationId,
        totalAmount,
        safeCommissionRate,
        commissionAmount,
        safeVatRate,
        vatAmount,
        ownerReceivable,
        tx,
        JSON.stringify(qrData),
        batchNote,
        userId,
      ],
    );

    const [newRows] = await conn.query<RowDataPacket[]>(
      `SELECT * FROM payments WHERE payment_id = ? LIMIT 1`,
      [insert.insertId],
    );

    await conn.commit();
    return (newRows?.[0] as BookingPaymentRow) || ({} as BookingPaymentRow);
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

export const confirmRoomBatchBankTransfer = async (params: {
  userId: number;
  paymentId: number;
}): Promise<{
  paymentId: number;
  paymentStatus: string;
  bookingIds: number[];
}> => {
  const { userId, paymentId } = params;

  if (!Number.isFinite(userId)) {
    throw new BookingPaymentError("Chưa đăng nhập", 401);
  }
  if (!Number.isFinite(paymentId) || paymentId <= 0) {
    throw new BookingPaymentError("payment_id không hợp lệ", 400);
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [payRows] = await conn.query<RowDataPacket[]>(
      `SELECT payment_id, user_id, status, notes
       FROM payments
       WHERE payment_id = ?
         AND transaction_source = 'online_booking'
       LIMIT 1
       FOR UPDATE`,
      [paymentId],
    );
    const payment = Array.isArray(payRows) ? payRows[0] : null;
    if (!payment) {
      throw new BookingPaymentError("Không tìm thấy payment", 404);
    }
    if (Number(payment.user_id) !== Number(userId)) {
      throw new BookingPaymentError("Không có quyền xác nhận payment này", 403);
    }

    const note = String(payment.notes || "");
    if (!note.startsWith("BATCH_BOOKINGS:")) {
      throw new BookingPaymentError(
        "Payment này không phải gói đặt phòng",
        400,
      );
    }

    const idsRaw = note.slice("BATCH_BOOKINGS:".length).trim();
    const bookingIds = idsRaw
      .split(",")
      .map((x) => Number(x))
      .filter((x) => Number.isFinite(x) && x > 0);

    if (bookingIds.length === 0) {
      throw new BookingPaymentError("Payment thiếu danh sách booking", 400);
    }

    const placeholders = bookingIds.map(() => "?").join(",");
    const [bookingRows] = await conn.query<RowDataPacket[]>(
      `SELECT b.booking_id, b.user_id, b.status AS booking_status, s.service_type
       FROM bookings b
       JOIN services s ON s.service_id = b.service_id
       WHERE b.booking_id IN (${placeholders})
       FOR UPDATE`,
      bookingIds,
    );

    if (
      !Array.isArray(bookingRows) ||
      bookingRows.length !== bookingIds.length
    ) {
      throw new BookingPaymentError("Không tìm thấy đủ booking", 404);
    }

    for (const br of bookingRows) {
      if (Number(br.user_id) !== Number(userId)) {
        throw new BookingPaymentError(
          "Bạn không có quyền booking trong gói",
          403,
        );
      }
      if (String(br.service_type || "") !== "room") {
        throw new BookingPaymentError(
          "Gói có booking không phải đặt phòng",
          400,
        );
      }
      const st = String(br.booking_status || "");
      if (!["pending", "confirmed"].includes(st)) {
        throw new BookingPaymentError(
          "Có booking không còn ở trạng thái có thể xác nhận",
          400,
        );
      }
    }

    const paymentStatus = String(payment.status || "pending");
    if (!["pending", "completed"].includes(paymentStatus)) {
      throw new BookingPaymentError(
        "Payment không còn ở trạng thái có thể xác nhận",
        400,
      );
    }

    // If booking creation deferred actual room reservation until confirm-time,
    // reserve missing hotel stays now (idempotent for bookings that already reserved).
    try {
      await reserveHotelStaysForBookingsIfMissing({
        connection: conn,
        bookingIds,
      });
    } catch (e) {
      if (isBookingError(e)) {
        throw new BookingPaymentError(e.message, e.statusCode);
      }
      throw e;
    }

    if (paymentStatus !== "completed") {
      await conn.query(
        `UPDATE payments
         SET status = 'completed',
             payment_time = CURRENT_TIMESTAMP,
             performed_by_user_id = ?,
             performed_by_role = 'user'
         WHERE payment_id = ?`,
        [userId, paymentId],
      );

      await conn.query(
        `UPDATE bookings
         SET status = 'confirmed'
         WHERE booking_id IN (${placeholders})`,
        bookingIds,
      );
    }

    await conn.commit();
    return {
      paymentId,
      paymentStatus: "completed",
      bookingIds,
    };
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

export const createOrGetUserPaymentForBooking = async (params: {
  userId: number;
  bookingId: number;
}): Promise<BookingPaymentRow> => {
  const { userId, bookingId } = params;

  if (!Number.isFinite(userId)) {
    throw new BookingPaymentError("Chưa đăng nhập", 401);
  }
  if (!Number.isFinite(bookingId)) {
    throw new BookingPaymentError("bookingId không hợp lệ", 400);
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [bookingRows] = await conn.query<RowDataPacket[]>(
      `SELECT
         b.booking_id,
         b.user_id,
         b.location_id,
         b.final_amount,
         b.pos_order_id,
         b.status as booking_status,
         s.service_type,
         s.service_name,
         l.owner_id,
         l.location_name
       FROM bookings b
       JOIN services s ON s.service_id = b.service_id
       JOIN locations l ON l.location_id = b.location_id
       WHERE b.booking_id = ?
       LIMIT 1
       FOR UPDATE`,
      [bookingId],
    );

    const booking = bookingRows?.[0];
    if (!booking) {
      throw new BookingPaymentError("Không tìm thấy booking", 404);
    }

    if (Number(booking.user_id) !== userId) {
      throw new BookingPaymentError(
        "Bạn không có quyền thanh toán booking này",
        403,
      );
    }

    const bookingStatus = String(booking.booking_status || "");
    if (!["pending", "confirmed"].includes(bookingStatus)) {
      throw new BookingPaymentError(
        "Booking không còn ở trạng thái có thể thanh toán",
        400,
      );
    }

    const serviceType = String(booking.service_type || "");

    // Only support transfer prepay for room/ticket, and table when user chose preorder.
    if (!["room", "ticket", "table"].includes(serviceType)) {
      throw new BookingPaymentError(
        "Dịch vụ này không hỗ trợ thanh toán trước",
        400,
      );
    }

    if (serviceType === "table") {
      const hasPreorder = booking.pos_order_id != null;
      if (!hasPreorder) {
        throw new BookingPaymentError(
          "Đặt bàn không hỗ trợ thanh toán trước",
          400,
        );
      }
    }

    const [existingPaymentRows] = await conn.query<RowDataPacket[]>(
      `SELECT * FROM payments WHERE booking_id = ? ORDER BY payment_id DESC LIMIT 1 FOR UPDATE`,
      [bookingId],
    );

    const existingPayment = existingPaymentRows?.[0];
    if (
      existingPayment &&
      !["failed", "refunded"].includes(String(existingPayment.status || ""))
    ) {
      await conn.commit();
      return existingPayment as BookingPaymentRow;
    }

    const ownerId = Number(booking.owner_id);
    if (!Number.isFinite(ownerId)) {
      throw new BookingPaymentError(
        "Không xác định được chủ địa điểm để thanh toán",
        400,
      );
    }

    const [ownerRows] = await conn.query<RowDataPacket[]>(
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
      throw new BookingPaymentError(
        "Chủ địa điểm chưa cập nhật thông tin ngân hàng để thanh toán",
        400,
      );
    }

    const [settingsRows] = await conn.query<RowDataPacket[]>(
      `SELECT setting_key, setting_value FROM system_settings
       WHERE setting_key IN ('default_commission_rate','vat_rate')`,
    );

    const settings: Record<string, string | null> = {};
    for (const r of settingsRows)
      settings[String(r.setting_key)] = r.setting_value;

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
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BookingPaymentError("Số tiền thanh toán không hợp lệ", 400);
    }

    const safeCommissionRate = Number.isFinite(commissionRate)
      ? commissionRate
      : 2.5;
    const safeVatRate = Number.isFinite(vatRate) ? vatRate : 10;

    const commissionAmount = +((amount * safeCommissionRate) / 100).toFixed(2);
    const vatAmount = +((commissionAmount * safeVatRate) / 100).toFixed(2);
    const ownerReceivable = +(amount - commissionAmount - vatAmount).toFixed(2);

    const tx = randomTransactionCode(bookingId);
    const locationName = String(booking.location_name || "").trim();
    const serviceName = String(booking.service_name || "").trim();

    const qrContent =
      serviceType === "table"
        ? locationName || serviceName
          ? `${locationName || serviceName} - Cảm ơn quý khách`
          : "Cảm ơn quý khách"
        : serviceName
          ? `Thanh toán - ${serviceName}`
          : locationName
            ? `Thanh toán - ${locationName}`
            : "Thanh toán";

    const qrData = {
      bank_name: bankName,
      bank_account: bankAccount,
      account_holder: accountHolder,
      amount,
      content: qrContent,
      transaction_code: tx,
    };

    let tableNames: string | null = null;
    if (serviceType === "table") {
      try {
        const [tRows] = await conn.query<RowDataPacket[]>(
          `SELECT t.table_name
           FROM booking_table_reservations r
           JOIN pos_tables t ON t.table_id = r.table_id
           WHERE r.booking_id = ?
           ORDER BY t.table_name ASC`,
          [bookingId],
        );
        const names = (Array.isArray(tRows) ? tRows : [])
          .map((r: any) => String(r.table_name || "").trim())
          .filter(Boolean);
        if (names.length > 0) tableNames = names.join(", ");
      } catch {
        // ignore
      }
    }

    const notes = {
      transaction_source: "online_booking",
      service_type: serviceType,
      booking_id: bookingId,
      location_id: Number(booking.location_id),
      table_names: tableNames,
      invoice_ready: serviceType === "table" ? false : true,
      created_at: new Date().toISOString(),
      reminder:
        "Đã thanh toán nếu có vấn đề phát sinh hay không tới bị hủy thì tiền không được hoàn lại",
    };

    const [insert] = await conn.query<ResultSetHeader>(
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
        notes,
        performed_by_user_id,
        performed_by_role
      ) VALUES (?, ?, ?, ?, 'online_booking', ?, ?, ?, ?, ?, 'VietQR', ?, ?, 'pending', ?, ?, 'user')`,
      [
        userId,
        Number(booking.location_id),
        bookingId,
        amount,
        safeCommissionRate,
        commissionAmount,
        safeVatRate,
        vatAmount,
        ownerReceivable,
        tx,
        JSON.stringify(qrData),
        JSON.stringify(notes),
        userId,
      ],
    );

    const [newRows] = await conn.query<RowDataPacket[]>(
      `SELECT * FROM payments WHERE payment_id = ? LIMIT 1`,
      [insert.insertId],
    );

    await conn.commit();
    return (newRows?.[0] as BookingPaymentRow) || ({} as BookingPaymentRow);
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
