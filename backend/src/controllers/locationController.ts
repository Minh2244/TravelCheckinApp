// backend/src/controllers/locationController.ts
import { Request, Response } from "express";
import { pool } from "../config/database";
import {
  computeTableReservationEnd,
  ensureBookingTableReservationsSchema,
  formatMysqlDateTime,
} from "../utils/tableReservations";

const PREPAY_UNCONFIRMED_MARKER = "PREPAY_UNCONFIRMED";

const getActiveFoodLocationId = async (
  locationId: number,
): Promise<number | null> => {
  const [rows] = await pool.query(
    `SELECT location_id
     FROM locations
     WHERE location_id = ?
       AND status = 'active'
       AND location_type IN ('restaurant', 'cafe')
     LIMIT 1`,
    [locationId],
  );

  const row = Array.isArray(rows) ? (rows[0] as any) : null;
  const resolved = Number(row?.location_id);
  return Number.isFinite(resolved) ? resolved : null;
};

export const getLocations = async (req: Request, res: Response) => {
  try {
    const { type, keyword, province, source } = req.query as {
      type?: string;
      keyword?: string;
      province?: string;
      source?: string;
    };

    let query = "SELECT * FROM locations";
    const params: Array<string> = [];
    const filters: string[] = [];

    if (type) {
      filters.push("location_type = ?");
      params.push(type);
    }

    if (province) {
      filters.push("province = ?");
      params.push(province);
    }

    if (keyword) {
      filters.push("(location_name LIKE ? OR address LIKE ?)");
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    const effectiveSource = (source ?? "web").toLowerCase();
    const isPublicConsumer =
      effectiveSource === "web" || effectiveSource === "mobile";
    if (isPublicConsumer) {
      filters.push("status = 'active'");
    }

    if (filters.length > 0) {
      query += ` WHERE ${filters.join(" AND ")}`;
    }

    const [rows] = await pool.query(query, params);

    void source;

    res.json({
      success: true,
      message: "Lấy danh sách địa điểm thành công",
      count: Array.isArray(rows) ? rows.length : 0,
      data: rows,
    });
  } catch (error) {
    console.error("Lỗi lấy danh sách địa điểm:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server nội bộ khi lấy dữ liệu địa điểm",
    });
  }
};

export const getLocationById = async (req: Request, res: Response) => {
  try {
    const locationId = Number(req.params.id);
    const { source } = req.query as { source?: string };

    if (!Number.isFinite(locationId)) {
      res
        .status(400)
        .json({ success: false, message: "Location ID không hợp lệ" });
      return;
    }

    const [rows] = await pool.query(
      "SELECT * FROM locations WHERE location_id = ? LIMIT 1",
      [locationId],
    );

    const location = Array.isArray(rows) ? rows[0] : null;
    if (!location) {
      res
        .status(404)
        .json({ success: false, message: "Không tìm thấy địa điểm" });
      return;
    }

    // location_views đã bị loại bỏ trong DB rút gọn
    void source;

    res.json({ success: true, data: location });
  } catch (error) {
    console.error("Lỗi lấy chi tiết địa điểm:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server nội bộ khi lấy chi tiết địa điểm",
    });
  }
};

export const getLocationReviewsPublic = async (req: Request, res: Response) => {
  try {
    const locationId = Number(req.params.id);

    if (!Number.isFinite(locationId)) {
      res
        .status(400)
        .json({ success: false, message: "Location ID không hợp lệ" });
      return;
    }

    const [locRows] = await pool.query(
      `SELECT location_id, status FROM locations WHERE location_id = ? LIMIT 1`,
      [locationId],
    );
    const loc = Array.isArray(locRows) ? (locRows as any[])[0] : null;
    if (!loc || String(loc.status || "") !== "active") {
      res
        .status(404)
        .json({ success: false, message: "Địa điểm không khả dụng" });
      return;
    }

    const [rows] = await pool.query(
      `SELECT
         r.review_id,
         r.location_id,
         r.rating,
         r.comment,
         r.images,
         r.created_at,
         u.full_name AS user_name,
         u.avatar_url AS user_avatar,
         rr.content AS reply_content,
         rr.created_at AS reply_created_at
       FROM reviews r
       JOIN users u ON u.user_id = r.user_id
       LEFT JOIN review_replies rr ON rr.review_id = r.review_id
       WHERE r.location_id = ?
         AND r.status = 'active'
       ORDER BY r.created_at DESC
       LIMIT 100`,
      [locationId],
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Lỗi lấy review địa điểm:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const getLocationServicesPublic = async (
  req: Request,
  res: Response,
) => {
  try {
    const locationId = Number(req.params.id);
    const { type } = req.query as { type?: string };

    if (!Number.isFinite(locationId)) {
      res
        .status(400)
        .json({ success: false, message: "Location ID không hợp lệ" });
      return;
    }

    const [locRows] = await pool.query(
      `SELECT location_id, status FROM locations WHERE location_id = ? LIMIT 1`,
      [locationId],
    );
    const loc = Array.isArray(locRows) ? (locRows as any[])[0] : null;
    if (!loc) {
      res
        .status(404)
        .json({ success: false, message: "Không tìm thấy địa điểm" });
      return;
    }
    if (String(loc.status || "") !== "active") {
      res
        .status(404)
        .json({ success: false, message: "Địa điểm không khả dụng" });
      return;
    }

    const allowedTypes = new Set([
      "room",
      "table",
      "ticket",
      "food",
      "combo",
      "other",
    ]);

    const params: any[] = [locationId];
    const whereType =
      type && allowedTypes.has(String(type)) ? " AND s.service_type = ?" : "";
    if (whereType) params.push(String(type));

    const [rows] = await pool.query(
      `SELECT
         s.service_id,
         s.location_id,
         s.category_id,
         s.service_name,
         s.service_type,
         s.description,
         s.price,
         s.quantity,
         s.unit,
         s.status,
         s.images,
         r.status AS room_status,
         c.category_name,
         c.category_type,
         c.sort_order as category_sort_order
       FROM services s
       LEFT JOIN hotel_rooms r
         ON r.location_id = s.location_id AND r.service_id = s.service_id
       LEFT JOIN service_categories c
         ON c.category_id = s.category_id AND c.deleted_at IS NULL
       WHERE s.location_id = ?
         AND s.deleted_at IS NULL
         AND s.admin_status = 'approved'
         AND (
           s.status = 'available'
           OR (s.service_type IN ('food','combo','other') AND s.status = 'reserved')
         )
         ${whereType}
       ORDER BY c.sort_order ASC, s.created_at DESC`,
      params,
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Lỗi lấy danh sách dịch vụ theo location:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server nội bộ khi lấy dịch vụ",
    });
  }
};

export const getLocationPosTablesPublic = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    await ensureBookingTableReservationsSchema();

    const locationId = Number(req.params.id);
    const areaIdRaw = String((req.query as any)?.area_id || "").trim();
    const checkInRaw = String((req.query as any)?.check_in_date || "").trim();
    if (!Number.isFinite(locationId)) {
      res
        .status(400)
        .json({ success: false, message: "Location ID không hợp lệ" });
      return;
    }

    const resolvedLocationId = await getActiveFoodLocationId(locationId);
    if (!resolvedLocationId) {
      res
        .status(404)
        .json({ success: false, message: "Địa điểm không khả dụng" });
      return;
    }

    const params: Array<number | string> = [resolvedLocationId];
    let areaWhere = "";
    let reservationJoin = "";
    let reservationStatusCase = "";
    if (areaIdRaw && areaIdRaw !== "all") {
      const areaId = Number(areaIdRaw);
      if (Number.isFinite(areaId)) {
        areaWhere = " AND t.area_id = ?";
        params.push(areaId);
      }
    }

    if (checkInRaw) {
      const checkInDate = new Date(checkInRaw);
      if (!Number.isNaN(checkInDate.getTime())) {
        const reservationEnd = computeTableReservationEnd(checkInDate);
        reservationJoin = `
       LEFT JOIN (
         SELECT table_id, MAX(reservation_id) AS reservation_id
         FROM booking_table_reservations r
         LEFT JOIN bookings b ON b.booking_id = r.booking_id
         WHERE r.location_id = ?
           AND r.status = 'active'
           AND (
             b.booking_id IS NULL
             OR (
               b.status IN ('pending','confirmed')
               AND NOT (
                 b.status = 'pending'
                 AND b.notes LIKE ?
               )
             )
           )
           AND r.actual_end_time IS NULL
           AND r.start_time < ?
           AND r.end_time > ?
         GROUP BY table_id
       ) r_active
         ON r_active.table_id = t.table_id`;
        reservationStatusCase =
          "WHEN r_active.reservation_id IS NOT NULL THEN 'reserved'";
        params.unshift(
          resolvedLocationId,
          `%${PREPAY_UNCONFIRMED_MARKER}%`,
          formatMysqlDateTime(reservationEnd),
          formatMysqlDateTime(checkInDate),
        );
      }
    }

    const [rows] = await pool.query(
      `SELECT
         t.table_id,
         t.location_id,
         t.area_id,
         t.table_name,
         t.shape,
         CASE
           WHEN t.status = 'occupied' THEN 'occupied'
           WHEN o.order_id IS NOT NULL AND COALESCE(oi.total_qty, 0) > 0 THEN 'occupied'
           ${reservationStatusCase}
           WHEN t.status = 'reserved' THEN 'reserved'
           ELSE 'free'
         END AS status
       FROM pos_tables t
       LEFT JOIN pos_areas a
         ON a.area_id = t.area_id
       ${reservationJoin}
       LEFT JOIN pos_orders o
         ON o.order_id = (
           SELECT MAX(o2.order_id)
           FROM pos_orders o2
           WHERE o2.table_id = t.table_id
             AND o2.status = 'open'
             AND (o2.order_source IS NULL OR o2.order_source <> 'online_booking')
         )
       LEFT JOIN (
         SELECT order_id, COALESCE(SUM(quantity), 0) AS total_qty
         FROM pos_order_items
         GROUP BY order_id
       ) oi
         ON oi.order_id = o.order_id
       WHERE t.location_id = ?
         ${areaWhere}
       ORDER BY COALESCE(a.sort_order, 999999) ASC, t.table_name ASC`,
      params,
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Lỗi lấy danh sách bàn theo location:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server nội bộ khi lấy bàn",
    });
  }
};

export const getLocationPosAreasPublic = async (
  req: Request,
  res: Response,
) => {
  try {
    const locationId = Number(req.params.id);

    if (!Number.isFinite(locationId)) {
      res
        .status(400)
        .json({ success: false, message: "Location ID không hợp lệ" });
      return;
    }

    const resolvedLocationId = await getActiveFoodLocationId(locationId);
    if (!resolvedLocationId) {
      res
        .status(404)
        .json({ success: false, message: "Địa điểm không khả dụng" });
      return;
    }

    const [rows] = await pool.query(
      `SELECT area_id, area_name, sort_order
       FROM pos_areas
       WHERE location_id = ?
       ORDER BY sort_order ASC, area_id ASC`,
      [resolvedLocationId],
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Lỗi lấy danh sách khu theo location:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server nội bộ khi lấy khu",
    });
  }
};
