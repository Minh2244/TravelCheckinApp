// backend/src/controllers/locationController.ts
import { Request, Response } from "express";
import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../config/database";
import {
  computeTableReservationEnd,
  ensureBookingTableReservationsSchema,
  formatMysqlDateTime,
} from "../utils/tableReservations";
import { getEntityImageUrls, getPrimaryImageUrl } from "../utils/uploadImage";

/**
 * Get location images from entity_images table, falling back to JSON column
 */
async function getLocationImages(locationId: number): Promise<{ images: string[]; first_image: string | null }> {
  const images = await getEntityImageUrls("location", locationId, "gallery");
  if (images.length > 0) {
    const primary = await getPrimaryImageUrl("location", locationId);
    return { images, first_image: primary || images[0] };
  }
  return { images: [], first_image: null };
}

const PREPAY_UNCONFIRMED_MARKER = "PREPAY_UNCONFIRMED";

const getOptionalUserId = (req: Request): number | null => {
  const userId = Number((req as any).userId || (req as any).user?.user_id);
  return Number.isFinite(userId) && userId > 0 ? userId : null;
};

const getActiveFoodLocationId = async (
  locationId: number,
): Promise<number | null> => {
  const [rows] = await pool.query(
    `SELECT location_id
     FROM locations
     WHERE location_id = ?
       AND (status = 'active' OR (status = 'pending' AND previous_status = 'active'))
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

    let query = "SELECT l.* FROM locations l LEFT JOIN users u ON u.user_id = l.owner_id";
    const params: Array<any> = [];
    const filters: string[] = [];

    if (type) {
      filters.push("l.location_type = ?");
      params.push(type);
    }

    if (province) {
      filters.push("l.province = ?");
      params.push(province);
    }

    if (keyword) {
      filters.push("(l.location_name LIKE ? OR l.address LIKE ?)");
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    const effectiveSource = (source ?? "web").toLowerCase();
    const isPublicConsumer =
      effectiveSource === "web" || effectiveSource === "mobile";
    if (isPublicConsumer) {
      filters.push("(l.status = 'active' OR (l.status = 'pending' AND l.previous_status = 'active'))");
      // Chỉ hiện địa điểm owner/admin tạo, bỏ qua OSM và địa điểm tự tạo của user
      filters.push("l.source IN ('owner', 'admin')");
      filters.push("l.location_name != 'Vị trí tự do'");
      filters.push("(l.owner_id IS NULL OR u.role != 'user')");
    }

    if (filters.length > 0) {
      query += ` WHERE ${filters.join(" AND ")}`;
    }

    query += ` ORDER BY l.location_id DESC`;

    const [rows] = await pool.query(query, params);

    void source;

    // Removed buggy entity_images override
    let locations = Array.isArray(rows) ? rows : [];

    if (isPublicConsumer) {
      locations = locations.map((loc) => {
        const l = loc as Record<string, any>;
        if (l.status === "pending" && l.backup_data) {
          try {
            const backup = typeof l.backup_data === "string" ? JSON.parse(l.backup_data) : l.backup_data;
            return { ...l, ...backup, status: "active", backup_data: undefined };
          } catch {
            return l;
          }
        }
        return l;
      });
    }

    res.json({
      success: true,
      message: "Lấy danh sách địa điểm thành công",
      count: locations.length,
      data: locations,
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

    const effectiveSource = (source ?? "web").toLowerCase();
    const isPublicConsumer =
      effectiveSource === "web" || effectiveSource === "mobile";

    const userId = getOptionalUserId(req);
    let query = `SELECT l.*, upl.user_id AS private_user_id,
                        CASE WHEN upl.location_id IS NULL THEN 0 ELSE 1 END AS is_private_location
                 FROM locations l
                 LEFT JOIN user_private_locations upl ON upl.location_id = l.location_id
                 WHERE l.location_id = ? `;
    if (isPublicConsumer) {
      query += `AND (
        (upl.location_id IS NULL AND (l.status = 'active' OR (l.status = 'pending' AND l.previous_status = 'active')))
        OR (upl.user_id = ? AND l.deleted_at IS NULL)
      ) `;
    }
    query += "LIMIT 1";

    const [rows] = await pool.query<RowDataPacket[]>(
      query,
      isPublicConsumer ? [locationId, userId || 0] : [locationId],
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

    // Removed buggy entity_images override
    let finalLocation = location as Record<string, any>;
    if (isPublicConsumer && finalLocation.status === "pending" && finalLocation.backup_data) {
      try {
        const backup = typeof finalLocation.backup_data === "string" 
          ? JSON.parse(finalLocation.backup_data) 
          : finalLocation.backup_data;
        finalLocation = { ...finalLocation, ...backup, status: "active", backup_data: undefined };
      } catch {
        // ignore error
      }
    }

    res.json({ success: true, data: finalLocation });
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
      `SELECT location_id, status, previous_status FROM locations WHERE location_id = ? LIMIT 1`,
      [locationId],
    );
    const loc = Array.isArray(locRows) ? (locRows as any[])[0] : null;
    const isAvailable =
      loc &&
      (String(loc.status || "") === "active" ||
        (String(loc.status || "") === "pending" &&
          String(loc.previous_status || "") === "active"));
    if (!isAvailable) {
      res
        .status(404)
        .json({ success: false, message: "Địa điểm không khả dụng" });
      return;
    }

    const [rows] = await pool.query(
      `SELECT
         r.review_id,
         r.user_id,
         r.location_id,
         r.rating,
         r.comment,
         r.images,
         r.created_at,
         u.full_name AS user_name,
         u.avatar_url AS user_avatar,
         rro.content AS reply_content,
         rro.created_at AS reply_created_at,
         rro.images AS reply_images,
         rru.content AS user_reply_content,
         rru.created_at AS user_reply_created_at,
         rru.created_by AS user_reply_user_id,
         rru.images AS user_reply_images
       FROM reviews r
       JOIN users u ON u.user_id = r.user_id
       LEFT JOIN review_replies rro ON rro.review_id = r.review_id AND rro.role = 'owner'
       LEFT JOIN review_replies rru ON rru.review_id = r.review_id AND rru.role = 'user'
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
      `SELECT location_id, status, previous_status FROM locations WHERE location_id = ? LIMIT 1`,
      [locationId],
    );
    const loc = Array.isArray(locRows) ? (locRows as any[])[0] : null;
    if (!loc) {
      res
        .status(404)
        .json({ success: false, message: "Không tìm thấy địa điểm" });
      return;
    }
    const isAvailable =
      loc &&
      (String(loc.status || "") === "active" ||
        (String(loc.status || "") === "pending" &&
          String(loc.previous_status || "") === "active"));
    if (!isAvailable) {
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

    const params: any[] = [];
    const whereType =
      type && allowedTypes.has(String(type)) ? " AND s.service_type = ?" : "";
    if (whereType) params.push(String(type));

    const getLocalDateString = (dateVal: Date = new Date()): string => {
      const year = dateVal.getFullYear();
      const month = String(dateVal.getMonth() + 1).padStart(2, "0");
      const day = String(dateVal.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };
    const todayStr = getLocalDateString();

    const [rows] = await pool.query(
      `SELECT
         s.service_id,
         s.location_id,
         s.category_id,
         s.service_name,
         s.service_type,
         s.description,
         s.price,
         s.pending_updates,
         s.admin_status,
         CASE
           WHEN s.service_type = 'ticket' AND s.quantity IS NOT NULL THEN
             GREATEST(0,
               CAST(s.quantity AS SIGNED)
               - COALESCE(bt_sold.cnt, 0)
               - COALESCE(pt_sold.cnt, 0)
             )
           ELSE s.quantity
         END AS quantity,
         s.unit,
         s.status,
         s.images,
         CASE
           WHEN pb.is_booked_now = 1 THEN 'reserved'
           ELSE r.status
         END AS room_status,
         c.category_name,
         c.category_type,
         c.sort_order as category_sort_order
       FROM services s
       LEFT JOIN hotel_rooms r
         ON r.location_id = s.location_id AND r.service_id = s.service_id
       LEFT JOIN service_categories c
         ON c.category_id = s.category_id AND c.deleted_at IS NULL
       LEFT JOIN (
         SELECT bt.service_id, COUNT(*) AS cnt
         FROM booking_tickets bt
         JOIN bookings b ON b.booking_id = bt.booking_id
         WHERE bt.location_id = ?
           AND bt.status <> 'void'
           AND b.check_in_date >= ? AND b.check_in_date < DATE_ADD(?, INTERVAL 1 DAY)
         GROUP BY bt.service_id
       ) bt_sold ON bt_sold.service_id = s.service_id AND s.service_type = 'ticket'
       LEFT JOIN (
         SELECT pt2.service_id, COUNT(*) AS cnt
         FROM pos_tickets pt2
         WHERE pt2.location_id = ?
           AND pt2.status <> 'void'
           AND pt2.sold_at >= ? AND pt2.sold_at < DATE_ADD(?, INTERVAL 1 DAY)
         GROUP BY pt2.service_id
       ) pt_sold ON pt_sold.service_id = s.service_id AND s.service_type = 'ticket'
       LEFT JOIN (
         SELECT b.service_id, 1 AS is_booked_now
         FROM bookings b
         WHERE b.location_id = ?
           AND b.status IN ('pending', 'confirmed')
           AND (b.notes IS NULL OR b.notes NOT LIKE '%PREPAY_UNCONFIRMED%')
           AND b.check_in_date < DATE_ADD(?, INTERVAL 1 DAY)
           AND (b.check_out_date IS NULL OR b.check_out_date >= DATE_ADD(?, INTERVAL 1 DAY))
         GROUP BY b.service_id
       ) pb ON pb.service_id = s.service_id AND s.service_type = 'room'
       WHERE s.location_id = ?
         AND s.deleted_at IS NULL
         AND (
           s.admin_status = 'approved'
           OR (s.admin_status = 'pending' AND s.pending_updates IS NOT NULL)
         )
         AND (
           s.status = 'available'
           OR (s.service_type IN ('food','combo','other') AND s.status = 'reserved')
         )
         ${whereType}
       ORDER BY c.sort_order ASC, s.created_at DESC`,
      [locationId, todayStr, todayStr, locationId, todayStr, todayStr, locationId, todayStr, todayStr, locationId, ...params],
    );
    const mergedRows = (rows as any[]).map((svc: any) => {
      if (svc.admin_status === "pending" && svc.pending_updates) {
        try {
          const pending = typeof svc.pending_updates === "string" ? JSON.parse(svc.pending_updates) : svc.pending_updates;
          return { ...svc, ...pending, admin_status: "pending", pending_updates: undefined, is_pending_update: true };
        } catch {
          return svc;
        }
      }
      return svc;
    });

    res.json({ success: true, data: mergedRows });
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

    // Auto-repair stale reserved tables
    await pool.query(
      `UPDATE pos_tables t
       SET t.status = 'free'
       WHERE t.status = 'reserved'
         AND t.location_id = ?
         AND t.table_id NOT IN (
           SELECT r.table_id
           FROM booking_table_reservations r
           JOIN bookings b ON b.booking_id = r.booking_id
           WHERE r.status = 'active'
             AND r.actual_end_time IS NULL
             AND (b.status = 'confirmed' OR (b.status = 'pending' AND b.created_at >= DATE_SUB(NOW(), INTERVAL 30 MINUTE)))
         )`,
      [resolvedLocationId]
    );

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
         SELECT r.table_id, MAX(r.reservation_id) AS reservation_id
         FROM booking_table_reservations r
         LEFT JOIN bookings b ON b.booking_id = r.booking_id
         WHERE r.location_id = ?
           AND r.status = 'active'
           AND (
             b.booking_id IS NULL
             OR b.status = 'confirmed'
             OR (
               b.status = 'pending'
               AND b.created_at >= DATE_SUB(NOW(), INTERVAL 30 MINUTE)
               AND NOT (
                 b.status = 'pending'
                 AND b.notes LIKE ?
               )
             )
           )
           AND r.actual_end_time IS NULL
           AND r.start_time < ?
           AND r.end_time > ?
         GROUP BY r.table_id
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

export const getLocationTicketsStock = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const locationId = Number(req.params.id);

    if (!Number.isFinite(locationId)) {
      res
        .status(400)
        .json({ success: false, message: "Location ID không hợp lệ" });
      return;
    }

    const getLocalDateString = (dateVal: Date = new Date()): string => {
      const year = dateVal.getFullYear();
      const month = String(dateVal.getMonth() + 1).padStart(2, "0");
      const day = String(dateVal.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };
    const todayStr = getLocalDateString();

    const [rows] = await pool.query(
      `SELECT
         s.service_id,
         s.service_type,
         s.quantity,
         s.admin_status,
         s.pending_updates,
         COALESCE(bt_sold.cnt, 0) + COALESCE(pt_sold.cnt, 0) AS sold_today
       FROM services s
       LEFT JOIN (
         SELECT bt.service_id, COUNT(*) AS cnt
         FROM booking_tickets bt
         JOIN bookings b ON b.booking_id = bt.booking_id
         WHERE bt.location_id = ?
           AND bt.status <> 'void'
           AND b.check_in_date >= ? AND b.check_in_date < DATE_ADD(?, INTERVAL 1 DAY)
         GROUP BY bt.service_id
       ) bt_sold ON bt_sold.service_id = s.service_id AND s.service_type = 'ticket'
       LEFT JOIN (
         SELECT pt2.service_id, COUNT(*) AS cnt
         FROM pos_tickets pt2
         WHERE pt2.location_id = ?
           AND pt2.status <> 'void'
           AND pt2.sold_at >= ? AND pt2.sold_at < DATE_ADD(?, INTERVAL 1 DAY)
         GROUP BY pt2.service_id
       ) pt_sold ON pt_sold.service_id = s.service_id AND s.service_type = 'ticket'
       WHERE s.location_id = ?
         AND s.service_type = 'ticket'
         AND s.deleted_at IS NULL
         AND (
           s.admin_status = 'approved'
           OR (s.admin_status = 'pending' AND s.pending_updates IS NOT NULL)
         )
         AND s.status = 'available'`,
      [locationId, todayStr, todayStr, locationId, todayStr, todayStr, locationId],
    );

    const mergedRows = (rows as any[]).map((row) => {
      let qty = row.quantity;
      if (row.admin_status === "pending" && row.pending_updates) {
        try {
          const pending = typeof row.pending_updates === "string" ? JSON.parse(row.pending_updates) : row.pending_updates;
          if (pending.quantity !== undefined) {
             qty = pending.quantity;
          }
        } catch {}
      }
      
      let remaining_today = qty;
      if (qty !== null && qty !== undefined) {
         remaining_today = Math.max(0, Number(qty) - Number(row.sold_today));
      }
      
      return {
         service_id: row.service_id,
         service_type: row.service_type,
         remaining_today
      };
    });

    res.json({ success: true, data: mergedRows });
  } catch (error) {
    console.error("Lỗi lấy realtime stock:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const createCustomLocation = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = Number((req as any).userId || (req as any).user?.user_id);
    if (!Number.isFinite(userId) || userId <= 0) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const { location_name, latitude, longitude } = req.body;
    if (latitude === undefined || longitude === undefined) {
      res.status(400).json({ success: false, message: "Missing coordinates" });
      return;
    }

    const name = location_name?.trim() || "Vị trí tự do";
    const address = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;

    const [result] = await pool.query<any>(
      `INSERT INTO locations (
        location_name, location_type, address, latitude, longitude,
        status, source, owner_id, created_by_user_id
      ) VALUES (?, 'other', ?, ?, ?, 'active', 'user', NULL, ?)`,
      [name, address, latitude, longitude, userId]
    );

    const insertId = result.insertId;

    await pool.query(
      `INSERT IGNORE INTO user_private_locations (location_id, user_id)
       VALUES (?, ?)`,
      [insertId, userId],
    );

    // Tự động đưa vào danh sách Đã lưu
    await pool.query(
      `INSERT IGNORE INTO favorite_locations (user_id, location_id)
       VALUES (?, ?)`,
      [userId, insertId]
    );

    res.json({ success: true, location_id: insertId, message: "Đã tạo vị trí tự do" });
  } catch (error) {
    console.error("[createCustomLocation] Error:", error);
    res.status(500).json({ success: false, message: "Lỗi máy chủ" });
  }
};

export const updateCustomLocationName = async (req: Request, res: Response): Promise<void> => {
  try {
    const locationId = Number(req.params.id);
    const userId = Number((req as any).userId || (req as any).user?.user_id);
    const { location_name } = req.body;

    if (!Number.isFinite(locationId) || !Number.isFinite(userId) || userId <= 0) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    if (!location_name || !location_name.trim()) {
      res.status(400).json({ success: false, message: "Tên địa điểm không được để trống" });
      return;
    }

    const [result] = await pool.query<any>(
      `UPDATE locations 
       SET location_name = ? 
       WHERE location_id = ?
         AND location_id IN (
           SELECT upl.location_id FROM user_private_locations upl WHERE upl.user_id = ?
         )`,
      [location_name.trim(), locationId, userId]
    );

    if (result.affectedRows === 0) {
      res.status(404).json({ success: false, message: "Không tìm thấy vị trí tự do hoặc bạn không có quyền sửa" });
      return;
    }

    res.json({ success: true, message: "Đã cập nhật tên vị trí tự do" });
  } catch (error) {
    console.error("[updateCustomLocationName] Error:", error);
    res.status(500).json({ success: false, message: "Lỗi máy chủ" });
  }
};
