import { Request, Response } from "express";
import pool from "../config/database";
import { RowDataPacket } from "mysql2";

const parseLooseJson = (raw: unknown): Record<string, unknown> | null => {
  if (raw == null) return null;
  if (typeof raw === "object" && !Buffer.isBuffer(raw)) {
    return raw as Record<string, unknown>;
  }
  if (Buffer.isBuffer(raw)) {
    try {
      return JSON.parse(raw.toString("utf8"));
    } catch {
      return null;
    }
  }
  const text = String(raw || "").trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const normalizeText = (value: unknown): string =>
  String(value || "")
    .trim()
    .toLowerCase();

const hasText = (value: unknown): boolean =>
  Boolean(String(value || "").trim());

const hasBookerFromQr = (qrRaw: unknown): boolean => {
  const qr = parseLooseJson(qrRaw);
  if (!qr) return false;

  const hotelInvoice = qr.hotel_invoice as Record<string, unknown> | undefined;
  if (hotelInvoice) {
    if (hasText(hotelInvoice.guest_name) || hasText(hotelInvoice.guest_phone)) {
      return true;
    }
  }

  const hotelInvoices = Array.isArray(qr.hotel_invoices)
    ? (qr.hotel_invoices as Array<Record<string, unknown>>)
    : [];
  for (const item of hotelInvoices) {
    if (hasText(item?.guest_name) || hasText(item?.guest_phone)) {
      return true;
    }
  }

  const touristInvoice = qr.tourist_invoice as Record<string, unknown> | undefined;
  if (touristInvoice) {
    if (hasText(touristInvoice.buyer_name) || hasText(touristInvoice.buyer_phone)) {
      return true;
    }
  }

  return false;
};

const normalizePaymentMethod = (value: unknown): "cash" | "transfer" | "other" => {
  const raw = normalizeText(value);
  if (!raw) return "other";
  const isCash =
    raw === "cash" ||
    raw.includes("cash") ||
    raw.includes("tien mat") ||
    raw.includes("tiền mặt");
  if (isCash) return "cash";

  const isTransfer =
    raw === "transfer" ||
    raw.includes("transfer") ||
    raw.includes("bank") ||
    raw.includes("chuyen") ||
    raw.includes("chuyển") ||
    raw.includes("vietqr") ||
    raw.includes("qr") ||
    raw.includes("thanh toan truoc") ||
    raw.includes("thanh toán trước");
  if (isTransfer) return "transfer";

  return "other";
};

type RevenueAccumulator = {
  total: { amount: number; cash: number; transfer: number; count: number };
  onsite: { amount: number; cash: number; transfer: number; count: number };
  booking: { amount: number; cash: number; transfer: number; count: number };
};

const createAccumulator = (): RevenueAccumulator => ({
  total: { amount: 0, cash: 0, transfer: 0, count: 0 },
  onsite: { amount: 0, cash: 0, transfer: 0, count: 0 },
  booking: { amount: 0, cash: 0, transfer: 0, count: 0 },
});

const addToSummary = (
  acc: RevenueAccumulator,
  bucket: "onsite" | "booking",
  amount: number,
  method: "cash" | "transfer" | "other",
) => {
  acc.total.amount += amount;
  acc.total.count += 1;
  if (method === "cash") acc.total.cash += amount;
  if (method === "transfer") acc.total.transfer += amount;

  acc[bucket].amount += amount;
  acc[bucket].count += 1;
  if (method === "cash") acc[bucket].cash += amount;
  if (method === "transfer") acc[bucket].transfer += amount;
};

export const getAdminHistoryRevenueSummary = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const ownerIdsRaw = req.query.owner_ids as string;
    const locationIdsRaw = req.query.location_ids as string;
    const from = req.query.from as string;
    const to = req.query.to as string;

    const where: string[] = ["p.status = 'completed'"];
    const params: Array<string | number> = [];

    if (ownerIdsRaw) {
      const ownerIds = ownerIdsRaw.split(",").map(Number).filter(Number.isFinite);
      if (ownerIds.length > 0) {
        where.push(`l.owner_id IN (${ownerIds.map(() => "?").join(",")})`);
        params.push(...ownerIds);
      }
    }

    if (locationIdsRaw) {
      const locationIds = locationIdsRaw.split(",").map(Number).filter(Number.isFinite);
      if (locationIds.length > 0) {
        where.push(`p.location_id IN (${locationIds.map(() => "?").join(",")})`);
        params.push(...locationIds);
      }
    }

    if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
      where.push("DATE(p.payment_time) >= ?");
      params.push(from);
    }
    if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
      where.push("DATE(p.payment_time) <= ?");
      params.push(to);
    }

    const [paymentRows] = await pool.query<RowDataPacket[]>(
      `SELECT
         p.location_id,
         l.location_name,
         p.amount,
         p.payment_method,
         p.booking_id,
         p.transaction_source,
         p.notes,
         p.qr_data,
         p.performed_by_role,
         p.performed_by_name,
         b.status AS booking_status,
         COALESCE(NULLIF(b.contact_name, ''), bu.full_name) AS booking_contact_name,
         COALESCE(NULLIF(b.contact_phone, ''), bu.phone) AS booking_contact_phone
       FROM payments p
       JOIN locations l ON l.location_id = p.location_id
       LEFT JOIN bookings b ON b.booking_id = p.booking_id
       LEFT JOIN users bu ON bu.user_id = b.user_id
       WHERE ${where.length > 0 ? where.join(" AND ") : "1=1"}`,
      params,
    );

    const summary = createAccumulator();

    for (const row of paymentRows) {
      if (row.booking_status === "cancelled") continue;

      const amount = Number(row.amount || 0);
      if (!Number.isFinite(amount) || amount <= 0) continue;

      const notes = parseLooseJson((row as any).notes);
      const serviceType = normalizeText(notes?.service_type);
      const isFoodOrTable = serviceType === "food" || serviceType === "table";

      const notesPerformedBy =
        notes?.performed_by && typeof notes.performed_by === "object"
          ? (notes.performed_by as Record<string, unknown>)
          : null;
      const performedByRole = normalizeText(
        notesPerformedBy?.role || (row as any).performed_by_role,
      );

      const hasBookerViaPerformedByUser =
        performedByRole === "user" &&
        (hasText(notesPerformedBy?.name) ||
          hasText(notesPerformedBy?.phone) ||
          hasText((row as any).performed_by_name));

      const hasBookerInfo =
        Boolean(String((row as any).booking_contact_name || "").trim()) ||
        Boolean(String((row as any).booking_contact_phone || "").trim()) ||
        hasBookerViaPerformedByUser ||
        hasBookerFromQr((row as any).qr_data);

      const bucket: "onsite" | "booking" = hasBookerInfo ? "booking" : "onsite";

      const methodSource =
        (row as any).payment_method ||
        (notes as any)?.payment_method ||
        (isFoodOrTable
          ? (notes as any)?.prepaid_payment_method ||
            (notes as any)?.onsite_payment_method
          : null);
      const method = normalizePaymentMethod(methodSource);

      addToSummary(summary, bucket, amount, method);
    }

    res.json({
      success: true,
      data: summary,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error?.message || "Lỗi server" });
  }
};

export const getAdminHistoryInvoices = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const ownerIdsRaw = req.query.owner_ids as string;
    const locationIdsRaw = req.query.location_ids as string;
    const from = req.query.from as string;
    const to = req.query.to as string;

    const where: string[] = ["p.status = 'completed'"];
    const params: Array<string | number> = [];

    if (ownerIdsRaw) {
      const ownerIds = ownerIdsRaw.split(",").map(Number).filter(Number.isFinite);
      if (ownerIds.length > 0) {
        where.push(`l.owner_id IN (${ownerIds.map(() => "?").join(",")})`);
        params.push(...ownerIds);
      }
    }

    if (locationIdsRaw) {
      const locationIds = locationIdsRaw.split(",").map(Number).filter(Number.isFinite);
      if (locationIds.length > 0) {
        where.push(`p.location_id IN (${locationIds.map(() => "?").join(",")})`);
        params.push(...locationIds);
      }
    }

    if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
      where.push("DATE(p.payment_time) >= ?");
      params.push(from);
    }
    if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
      where.push("DATE(p.payment_time) <= ?");
      params.push(to);
    }

    const sql = `
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
        b.final_amount as booking_final_amount,
        b.voucher_code as booking_voucher_code,
        b.discount_amount as booking_discount_amount
      FROM payments p
      JOIN locations l ON l.location_id = p.location_id
      LEFT JOIN bookings b ON b.booking_id = p.booking_id
      LEFT JOIN users u ON u.user_id = p.user_id
      LEFT JOIN users bu ON bu.user_id = b.user_id
      LEFT JOIN services s ON s.service_id = b.service_id
      WHERE ${where.length > 0 ? where.join(" AND ") : "1=1"}
      ORDER BY p.payment_time DESC LIMIT 1000
    `;

    const [rows] = await pool.query<RowDataPacket[]>(sql, params);
    res.json({ success: true, data: rows });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error?.message || "Lỗi server" });
  }
};
