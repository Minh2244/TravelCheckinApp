import { Request, Response } from "express";
import { pool } from "../config/database";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { saveImageToDB, linkImageToEntity, removeEntityImages } from "../utils/uploadImage";
import { messaging } from "../config/firebase";
import { isWithinOpeningHours } from "../utils/openingHours";

interface AuthenticatedRequest extends Request {
  userId?: number;
}

interface CreateDiaryBody {
  location_id?: number | null;
  location_name?: string | null;
  mood?: "happy" | "excited" | "neutral" | "sad" | "angry" | "tired";
  notes?: string | null;
  images?: string[] | null;
}


interface CreateCheckinBody {
  location_id?: number;
  checkin_latitude?: number | null;
  checkin_longitude?: number | null;
  notes?: string | null;
  action?: "checkin" | "save";
  location_name?: string | null;
  location_address?: string | null;
  location_type?:
  | "hotel"
  | "restaurant"
  | "tourist"
  | "cafe"
  | "resort"
  | "other";
}

interface CreateReportBody {
  location_id?: number;
  description?: string | null;
  report_type?: "spam" | "inappropriate" | "fraud" | "other";
  severity?: "low" | "medium" | "high" | "critical";
}

interface CreateReviewBody {
  location_id?: number;
  rating?: number | string;
  comment?: string | null;
  images?: string[] | null;
}


interface UpdateUserCreatedLocationBody {
  location_name?: string;
  location_type?:
  | "hotel"
  | "restaurant"
  | "tourist"
  | "cafe"
  | "resort"
  | "other";
  description?: string | null;
  address?: string;
  province?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  status?: "active" | "inactive";
}

interface UpdateFavoriteBody {
  note?: string | null;
  tags?: string | null;
}

interface RecommendLocationsQuery {
  limit?: string;
}

interface UpdateProfileBody {
  full_name?: string;
  phone?: string | null;
  avatar_url?: string | null;
  skip_avatar?: boolean;
  background_url?: string | null;
  skip_background?: boolean;
  address?: string | null;
  username?: string | null;
}

// Vì sao: đảm bảo chỉ lấy dữ liệu của user đã đăng nhập
const getUserId = (req: AuthenticatedRequest, res: Response): number | null => {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ success: false, message: "Chưa đăng nhập" });
    return null;
  }
  return userId;
};

const userTopic = (userId: number) => `user_${userId}`;

const ensureUserNotificationReadsSchema = async (): Promise<void> => {
  // Moved to DB migrations
};

const ensureUserNotificationDismissedSchema = async (): Promise<void> => {
  // Moved to DB migrations
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

const ensureUserHasValidPhoneForCheckin = async (
  userId: number,
): Promise<string | null> => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT phone FROM users WHERE user_id = ? LIMIT 1`,
    [userId],
  );
  const phone = String(rows?.[0]?.phone || "").trim();
  if (!isValidPhoneNumber(phone)) {
    return "Trước khi check-in, bạn phải cập nhật số điện thoại hợp lệ gồm 10 số, bắt đầu bằng 0 và không chứa ký tự đặc biệt.";
  }
  return null;
};

export const getUserCheckins = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = getUserId(req as AuthenticatedRequest, res);
    if (!userId) return;

    const queries: Array<{ sql: string; params: Array<number> }> = [
      // Best-effort with optional columns, but avoids schema-specific flags.
      {
        sql: `SELECT c.checkin_id, c.checkin_time, c.status, c.location_id,
                    c.checkin_latitude, c.checkin_longitude,
                    l.location_name, l.address,
                    l.first_image,
                    l.owner_id AS location_owner_id,
                    CASE WHEN l.owner_id = ? THEN 1 ELSE 0 END AS is_user_created,
                    l.status AS location_status,
                    l.latitude AS location_latitude,
                    l.longitude AS location_longitude
             FROM checkins c
             JOIN locations l ON l.location_id = c.location_id
             WHERE c.user_id = ?
             ORDER BY c.checkin_time DESC`,
        params: [userId, userId],
      },

      // Without first_image.
      {
        sql: `SELECT c.checkin_id, c.checkin_time, c.status, c.location_id,
                    c.checkin_latitude, c.checkin_longitude,
                    l.location_name, l.address,
                    l.owner_id AS location_owner_id,
                    CASE WHEN l.owner_id = ? THEN 1 ELSE 0 END AS is_user_created,
                    l.status AS location_status,
                    l.latitude AS location_latitude,
                    l.longitude AS location_longitude
             FROM checkins c
             JOIN locations l ON l.location_id = c.location_id
             WHERE c.user_id = ?
             ORDER BY c.checkin_time DESC`,
        params: [userId, userId],
      },

      // Ultra-minimal: always succeeds if core columns exist.
      {
        sql: `SELECT c.checkin_id, c.checkin_time, c.status, c.location_id,
                    c.checkin_latitude, c.checkin_longitude,
                    l.location_name, l.address,
                    l.owner_id AS location_owner_id,
                    CASE WHEN l.owner_id = ? THEN 1 ELSE 0 END AS is_user_created
             FROM checkins c
             JOIN locations l ON l.location_id = c.location_id
             WHERE c.user_id = ?
             ORDER BY c.checkin_time DESC`,
        params: [userId, userId],
      },
    ];

    let rows: RowDataPacket[] = [];
    let lastError: unknown = null;
    for (const q of queries) {
      try {
        const [data] = await pool.query<RowDataPacket[]>(q.sql, q.params);
        rows = data;
        lastError = null;
        break;
      } catch (e) {
        lastError = e;
      }
    }

    if (lastError) {
      console.error("Lỗi query check-ins:", lastError);
      res.status(500).json({ success: false, message: "Lỗi server" });
      return;
    }

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Lỗi lấy check-in user:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const deleteUserCheckin = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = getUserId(req as AuthenticatedRequest, res);
    if (!userId) return;

    const checkinId = Number((req.params as Record<string, string>)?.id);
    if (!Number.isFinite(checkinId)) {
      res
        .status(400)
        .json({ success: false, message: "Check-in không hợp lệ" });
      return;
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT c.checkin_id, c.location_id,
              l.owner_id AS location_owner_id
       FROM checkins c
       JOIN locations l ON l.location_id = c.location_id
       WHERE c.checkin_id = ? AND c.user_id = ?
       LIMIT 1`,
      [checkinId, userId],
    );

    if (rows.length === 0) {
      res
        .status(404)
        .json({ success: false, message: "Không tìm thấy check-in" });
      return;
    }

    const row = rows[0] as {
      location_id: number | string;
      location_owner_id?: number | string | null;
    };
    const locationId = Number(row.location_id);
    const locationOwnerId =
      row.location_owner_id == null ? null : Number(row.location_owner_id);
    const isUserCreated = locationOwnerId === userId;

    await pool.query<ResultSetHeader>(
      `DELETE FROM checkins WHERE checkin_id = ? AND user_id = ?`,
      [checkinId, userId],
    );

    // Nếu là địa điểm do chính user tạo (check-in tự do) thì xoá luôn địa điểm (soft delete).
    if (
      isUserCreated &&
      locationOwnerId === userId &&
      Number.isFinite(locationId)
    ) {
      let deletedLocation = false;

      try {
        const [deleteRes] = await pool.query<ResultSetHeader>(
          `DELETE FROM locations WHERE location_id = ? AND owner_id = ?`,
          [locationId, userId],
        );
        deletedLocation = deleteRes.affectedRows > 0;
      } catch {
        // fallback soft delete
      }

      if (!deletedLocation) {
        try {
          await pool.query<ResultSetHeader>(
            `UPDATE locations
             SET previous_status = status,
                 status = 'inactive',
                 deleted_at = NOW(),
                 source = 'owner'
             WHERE location_id = ? AND owner_id = ? AND status <> 'inactive'`,
            [locationId, userId],
          );
        } catch {
          await pool.query<ResultSetHeader>(
            `UPDATE locations
             SET previous_status = status,
                 status = 'inactive'
             WHERE location_id = ? AND owner_id = ? AND is_user_created = 1 AND status <> 'inactive'`,
            [locationId, userId],
          );
        }
      }
    }

    res.json({ success: true, data: null, message: "Đã xoá check-in" });
  } catch (error) {
    console.error("Lỗi xoá check-in user:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const createUserCheckin = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = getUserId(req as AuthenticatedRequest, res);
    if (!userId) return;

    const body = req.body as CreateCheckinBody;
    const action = body?.action === "save" ? "save" : "checkin";
    if (action === "checkin") {
      const phoneError = await ensureUserHasValidPhoneForCheckin(userId);
      if (phoneError) {
        res.status(400).json({ success: false, message: phoneError });
        return;
      }
    }
    const latRaw = body?.checkin_latitude;
    const lngRaw = body?.checkin_longitude;
    const lat = Number(latRaw);
    const lng = Number(lngRaw);
    const hasCoords =
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      Math.abs(lat) <= 90 &&
      Math.abs(lng) <= 180;

    const isWithinVietnam = (latValue: number, lngValue: number) => {
      return (
        latValue >= 8 &&
        latValue <= 23.5 &&
        lngValue >= 102 &&
        lngValue <= 110.5
      );
    };

    if (hasCoords && !isWithinVietnam(lat, lng)) {
      res.status(400).json({
        success: false,
        message: "Chỉ hỗ trợ check-in trong phạm vi Việt Nam.",
      });
      return;
    }

    const parsedLocationId = Number(body?.location_id);
    const hasLocationId = Number.isFinite(parsedLocationId);

    if (!hasLocationId && !hasCoords) {
      res.status(400).json({
        success: false,
        message: "Thiếu địa điểm hoặc tọa độ check-in",
      });
      return;
    }

    let locationId = hasLocationId ? parsedLocationId : null;

    let locationCoords: {
      latitude: number | null;
      longitude: number | null;
    } | null = null;
    if (locationId) {
      const [locationRows] = await pool.query<RowDataPacket[]>(
        "SELECT location_id, latitude, longitude FROM locations WHERE location_id = ? LIMIT 1",
        [locationId],
      );

      if (locationRows.length === 0) {
        res
          .status(404)
          .json({ success: false, message: "Địa điểm không tồn tại" });
        return;
      }

      const row = locationRows[0] as
        | {
          latitude: number | string | null;
          longitude: number | string | null;
        }
        | undefined;
      if (row) {
        const lat2 = row.latitude == null ? null : Number(row.latitude);
        const lng2 = row.longitude == null ? null : Number(row.longitude);
        locationCoords = {
          latitude: Number.isFinite(lat2) ? lat2 : null,
          longitude: Number.isFinite(lng2) ? lng2 : null,
        };
      }

      if (
        locationCoords?.latitude != null &&
        locationCoords?.longitude != null &&
        !isWithinVietnam(locationCoords.latitude, locationCoords.longitude)
      ) {
        res.status(400).json({
          success: false,
          message: "Địa điểm ngoài phạm vi Việt Nam.",
        });
        return;
      }
    }

    const NEARBY_RADIUS_METERS = 80;
    if (!locationId && hasCoords) {
      const [nearRows] = await pool.query<RowDataPacket[]>(
        `SELECT location_id,
                (6371000 * 2 * ASIN(SQRT(
                  POWER(SIN(RADIANS(? - latitude) / 2), 2) +
                  COS(RADIANS(latitude)) * COS(RADIANS(?)) *
                  POWER(SIN(RADIANS(? - longitude) / 2), 2)
                ))) AS distance_m
         FROM locations
         WHERE latitude IS NOT NULL AND longitude IS NOT NULL
         HAVING distance_m <= ?
         ORDER BY distance_m ASC
         LIMIT 1`,
        [lat, lat, lng, NEARBY_RADIUS_METERS],
      );

      if (nearRows.length > 0) {
        locationId = Number(nearRows[0]?.location_id);

        const [locationRows] = await pool.query<RowDataPacket[]>(
          "SELECT latitude, longitude FROM locations WHERE location_id = ? LIMIT 1",
          [locationId],
        );
        const row = locationRows[0] as
          | {
            latitude: number | string | null;
            longitude: number | string | null;
          }
          | undefined;
        if (row) {
          const lat2 = row.latitude == null ? null : Number(row.latitude);
          const lng2 = row.longitude == null ? null : Number(row.longitude);
          locationCoords = {
            latitude: Number.isFinite(lat2) ? lat2 : null,
            longitude: Number.isFinite(lng2) ? lng2 : null,
          };
        }
      }
    }

    if (!locationId && hasCoords) {
      const MAX_CREATE_LOCATIONS_PER_DAY = 20;
      let createdTodayRows: RowDataPacket[] = [];
      try {
        const [rows] = await pool.query<RowDataPacket[]>(
          `SELECT COUNT(*) AS cnt
           FROM locations
           WHERE owner_id = ?
             AND source = 'owner'
             AND (deleted_at IS NULL)
             AND created_at >= (NOW() - INTERVAL 1 DAY)`,
          [userId],
        );
        createdTodayRows = rows;
      } catch {
        const [rows] = await pool.query<RowDataPacket[]>(
          `SELECT COUNT(*) AS cnt
           FROM locations
           WHERE owner_id = ? AND is_user_created = 1
             AND created_at >= (NOW() - INTERVAL 1 DAY)`,
          [userId],
        );
        createdTodayRows = rows;
      }
      const createdToday = Number(createdTodayRows?.[0]?.cnt ?? 0);
      if (
        Number.isFinite(createdToday) &&
        createdToday >= MAX_CREATE_LOCATIONS_PER_DAY
      ) {
        res.status(429).json({
          success: false,
          message:
            "Bạn đã tạo quá nhiều địa điểm trong 24h qua. Vui lòng thử lại sau.",
        });
        return;
      }

      const allowedTypes = new Set([
        "hotel",
        "restaurant",
        "tourist",
        "cafe",
        "resort",
        "other",
      ]);
      const rawName = body?.location_name?.trim() ?? "";
      const rawAddress = body?.location_address?.trim() ?? "";
      const locationName = rawName.length >= 3 ? rawName : "Vị trí tự do";
      const locationAddress =
        rawAddress || `(${lat.toFixed(6)}, ${lng.toFixed(6)})`;
      const locationType =
        body?.location_type && allowedTypes.has(body.location_type)
          ? body.location_type
          : "other";

      let insertResult: ResultSetHeader;
      try {
        const [result] = await pool.query<ResultSetHeader>(
          `INSERT INTO locations
           (owner_id, location_name, location_type, description, address, province,
            latitude, longitude, is_eco_friendly, status, source)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'active', 'owner')`,
          [
            userId,
            locationName,
            locationType,
            "User created location",
            locationAddress,
            null,
            lat,
            lng,
          ],
        );
        insertResult = result;
      } catch {
        const [result] = await pool.query<ResultSetHeader>(
          `INSERT INTO locations
           (owner_id, location_name, location_type, description, address, province,
            latitude, longitude, is_eco_friendly, status, is_user_created)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'active', 1)`,
          [
            userId,
            locationName,
            locationType,
            "User created location",
            locationAddress,
            null,
            lat,
            lng,
          ],
        );
        insertResult = result;
      }
      locationId = insertResult.insertId;
      locationCoords = { latitude: lat, longitude: lng };
    }

    if (!locationId) {
      res
        .status(400)
        .json({ success: false, message: "Không xác định được địa điểm" });
      return;
    }

    if (action === "save") {
      await pool.query<ResultSetHeader>(
        `INSERT IGNORE INTO favorite_locations (user_id, location_id)
         VALUES (?, ?)`,
        [userId, locationId],
      );

      res.status(201).json({
        success: true,
        data: { action, location_id: locationId },
        message: "Đã lưu địa điểm",
      });
      return;
    }

    // Enforce opening hours (if configured)
    const [locRows] = await pool.query<RowDataPacket[]>(
      `SELECT status, opening_hours
       FROM locations
       WHERE location_id = ?
       LIMIT 1`,
      [locationId],
    );
    const loc = locRows?.[0];
    if (!loc || String(loc.status || "") !== "active") {
      res.status(400).json({
        success: false,
        message: "Địa điểm hiện không khả dụng để check-in",
      });
      return;
    }
    if (!isWithinOpeningHours((loc as any).opening_hours, new Date())) {
      res.status(400).json({
        success: false,
        message:
          "Địa điểm hiện đang đóng cửa. Vui lòng check-in trong giờ mở cửa.",
      });
      return;
    }

    const MIN_GLOBAL_INTERVAL_SECONDS = 30;
    const [globalRecentRows] = await pool.query<RowDataPacket[]>(
      `SELECT checkin_id
       FROM checkins
       WHERE user_id = ?
         AND checkin_time >= (NOW() - INTERVAL ? SECOND)
       LIMIT 1`,
      [userId, MIN_GLOBAL_INTERVAL_SECONDS],
    );
    if (globalRecentRows.length > 0) {
      res.status(429).json({
        success: false,
        message: "Bạn thao tác quá nhanh. Vui lòng thử lại sau vài giây.",
      });
      return;
    }

    const MAX_CHECKINS_PER_HOUR = 20;
    const [hourRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt
       FROM checkins
       WHERE user_id = ?
         AND checkin_time >= (NOW() - INTERVAL 1 HOUR)`,
      [userId],
    );
    const hourCount = Number(hourRows?.[0]?.cnt ?? 0);
    if (Number.isFinite(hourCount) && hourCount >= MAX_CHECKINS_PER_HOUR) {
      res.status(429).json({
        success: false,
        message:
          "Bạn đã check-in quá nhiều trong 1 giờ qua. Vui lòng thử lại sau.",
      });
      return;
    }

    const MAX_CHECKINS_PER_DAY = 100;
    const [dayRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt
       FROM checkins
       WHERE user_id = ?
         AND checkin_time >= (NOW() - INTERVAL 1 DAY)`,
      [userId],
    );
    const dayCount = Number(dayRows?.[0]?.cnt ?? 0);
    if (Number.isFinite(dayCount) && dayCount >= MAX_CHECKINS_PER_DAY) {
      res.status(429).json({
        success: false,
        message:
          "Bạn đã check-in quá nhiều trong 24h qua. Vui lòng thử lại sau.",
      });
      return;
    }

    const MIN_CHECKIN_INTERVAL_MINUTES = 2;
    const [recentRows] = await pool.query<RowDataPacket[]>(
      `SELECT checkin_id
       FROM checkins
       WHERE user_id = ?
         AND location_id = ?
         AND checkin_time >= (NOW() - INTERVAL ? MINUTE)
       LIMIT 1`,
      [userId, locationId, MIN_CHECKIN_INTERVAL_MINUTES],
    );

    if (recentRows.length > 0) {
      res.status(429).json({
        success: false,
        message: "Bạn vừa check-in gần đây, vui lòng thử lại sau ít phút.",
      });
      return;
    }

    if (
      hasCoords &&
      locationCoords?.latitude != null &&
      locationCoords?.longitude != null
    ) {
      const toRad = (deg: number) => (deg * Math.PI) / 180;
      const R = 6371000;
      const dLat = toRad(locationCoords.latitude - lat);
      const dLng = toRad(locationCoords.longitude - lng);
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat)) *
        Math.cos(toRad(locationCoords.latitude)) *
        Math.sin(dLng / 2) ** 2;
      const distanceM = 2 * R * Math.asin(Math.sqrt(a));

      const MAX_DISTANCE_METERS = 500;
      if (Number.isFinite(distanceM) && distanceM > MAX_DISTANCE_METERS) {
        res.status(400).json({
          success: false,
          message:
            "Tọa độ check-in quá xa địa điểm. Vui lòng bật định vị và thử lại.",
        });
        return;
      }
    }

    const rawAgent = req.headers["user-agent"];
    const deviceInfo = Array.isArray(rawAgent)
      ? rawAgent.join(" ")
      : (rawAgent ?? null);

    let result: ResultSetHeader;
    try {
      const [r] = await pool.query<ResultSetHeader>(
        `INSERT INTO checkins
         (user_id, location_id, checkin_latitude, checkin_longitude, notes, device_info, status)
         VALUES (?, ?, ?, ?, ?, ?, 'verified')`,
        [
          userId,
          locationId,
          hasCoords ? lat : null,
          hasCoords ? lng : null,
          body.notes ?? null,
          deviceInfo,
        ],
      );
      result = r;
    } catch {
      const [r] = await pool.query<ResultSetHeader>(
        `INSERT INTO checkins
         (user_id, location_id, checkin_latitude, checkin_longitude, notes, device_info)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          userId,
          locationId,
          hasCoords ? lat : null,
          hasCoords ? lng : null,
          body.notes ?? null,
          deviceInfo,
        ],
      );
      result = r;
    }

    const now = new Date();
    const hour = now.getHours();
    const isNight = hour >= 22 || hour <= 5;

    let safetyWarning: { enabled: boolean; message: string | null } = {
      enabled: false,
      message: null,
    };

    if (isNight) {
      safetyWarning = {
        enabled: true,
        message:
          "Cảnh báo an toàn: Bạn đang check-in vào khung giờ đêm. Hãy chú ý môi trường xung quanh và chia sẻ vị trí với người thân nếu cần.",
      };

      // Best-effort push notification to the same user (if they registered device tokens)
      try {
        await pool.query<ResultSetHeader>(
          `INSERT INTO push_notifications (title, body, target_audience, target_user_id, sent_by)
           VALUES (?, ?, 'specific_user', ?, NULL)`,
          [
            "Cảnh báo an toàn",
            "Bạn vừa check-in vào khung giờ đêm. Hãy chú ý an toàn.",
            userId,
          ],
        );
      } catch {
        // ignore - table may exist but constraints vary
      }

      try {
        // Không dùng push_device_tokens (không có trong schema SQL).
        // Quy ước: client subscribe topic user_{userId}.
        await messaging.send({
          topic: userTopic(userId),
          notification: {
            title: "Cảnh báo an toàn",
            body: "Bạn vừa check-in vào khung giờ đêm. Hãy chú ý an toàn.",
          },
          data: {
            type: "night_checkin_warning",
            location_id: String(locationId),
            checkin_id: String(result.insertId),
          },
        });
      } catch {
        // ignore if FCM fails
      }
    }

    res.status(201).json({
      success: true,
      data: {
        checkin_id: result.insertId,
        location_id: locationId,
        action,
        safety_warning: safetyWarning.enabled,
        safety_message: safetyWarning.message,
      },
    });
  } catch (error) {
    console.error("Lỗi tạo check-in user:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const createUserCheckinWithPhoto = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = getUserId(req as AuthenticatedRequest, res);
    if (!userId) return;

    const phoneError = await ensureUserHasValidPhoneForCheckin(userId);
    if (phoneError) {
      res.status(400).json({ success: false, message: phoneError });
      return;
    }

    const file = (req as unknown as { file?: Express.Multer.File }).file;
    if (!file) {
      res.status(400).json({ success: false, message: "Vui lòng chọn ảnh" });
      return;
    }

    const body = req.body as CreateCheckinBody;

    // Save photo to database
    const imgResult = await saveImageToDB(file, "checkin_photo", userId, "user");
    const urlPath = imgResult.url;

    const latRaw = body?.checkin_latitude;
    const lngRaw = body?.checkin_longitude;
    const lat = Number(latRaw);
    const lng = Number(lngRaw);
    const hasCoords =
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      Math.abs(lat) <= 90 &&
      Math.abs(lng) <= 180;

    const parsedLocationId = Number(body?.location_id);
    const hasLocationId = Number.isFinite(parsedLocationId);

    if (!hasLocationId && !hasCoords) {
      res.status(400).json({
        success: false,
        message: "Thiếu địa điểm hoặc tọa độ check-in",
      });
      return;
    }

    // Use existing createUserCheckin logic by calling same endpoint would be messy; do minimal here.
    // Validate location_id exists if provided
    let locationId = hasLocationId ? parsedLocationId : null;
    if (locationId) {
      const [locationRows] = await pool.query<RowDataPacket[]>(
        "SELECT location_id FROM locations WHERE location_id = ? LIMIT 1",
        [locationId],
      );
      if (locationRows.length === 0) {
        res
          .status(404)
          .json({ success: false, message: "Địa điểm không tồn tại" });
        return;
      }
    }

    if (!locationId && hasCoords) {
      // Reuse the nearest-location selection (same radius)
      const NEARBY_RADIUS_METERS = 80;
      const [nearRows] = await pool.query<RowDataPacket[]>(
        `SELECT location_id,
                (6371000 * 2 * ASIN(SQRT(
                  POWER(SIN(RADIANS(? - latitude) / 2), 2) +
                  COS(RADIANS(latitude)) * COS(RADIANS(?)) *
                  POWER(SIN(RADIANS(? - longitude) / 2), 2)
                ))) AS distance_m
         FROM locations
         WHERE latitude IS NOT NULL AND longitude IS NOT NULL
         HAVING distance_m <= ?
         ORDER BY distance_m ASC
         LIMIT 1`,
        [lat, lat, lng, NEARBY_RADIUS_METERS],
      );
      if (nearRows.length > 0) {
        locationId = Number(nearRows[0]?.location_id);
      }
    }

    if (!locationId && hasCoords) {
      // Create a user-created location (same behavior)
      const allowedTypes = new Set([
        "hotel",
        "restaurant",
        "tourist",
        "cafe",
        "resort",
        "other",
      ]);
      const rawName = body?.location_name?.trim() ?? "";
      const rawAddress = body?.location_address?.trim() ?? "";
      const locationName = rawName.length >= 3 ? rawName : "Vị trí tự do";
      const locationAddress =
        rawAddress || `(${lat.toFixed(6)}, ${lng.toFixed(6)})`;
      const locationType =
        body?.location_type && allowedTypes.has(body.location_type)
          ? body.location_type
          : "other";

      let insertResult: ResultSetHeader;
      try {
        const [result] = await pool.query<ResultSetHeader>(
          `INSERT INTO locations
           (owner_id, location_name, location_type, description, address, province,
            latitude, longitude, is_eco_friendly, status, source)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'active', 'owner')`,
          [
            userId,
            locationName,
            locationType,
            "User created location",
            locationAddress,
            null,
            lat,
            lng,
          ],
        );
        insertResult = result;
      } catch {
        const [result] = await pool.query<ResultSetHeader>(
          `INSERT INTO locations
           (owner_id, location_name, location_type, description, address, province,
            latitude, longitude, is_eco_friendly, status, is_user_created)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'active', 1)`,
          [
            userId,
            locationName,
            locationType,
            "User created location",
            locationAddress,
            null,
            lat,
            lng,
          ],
        );
        insertResult = result;
      }
      locationId = insertResult.insertId;
    }

    if (!locationId) {
      res
        .status(400)
        .json({ success: false, message: "Không xác định được địa điểm" });
      return;
    }

    // Enforce opening hours (if configured)
    const [locRows] = await pool.query<RowDataPacket[]>(
      `SELECT status, opening_hours
       FROM locations
       WHERE location_id = ?
       LIMIT 1`,
      [locationId],
    );
    const loc = locRows?.[0];
    if (!loc || String(loc.status || "") !== "active") {
      res.status(400).json({
        success: false,
        message: "Địa điểm hiện không khả dụng để check-in",
      });
      return;
    }
    if (!isWithinOpeningHours((loc as any).opening_hours, new Date())) {
      res.status(400).json({
        success: false,
        message:
          "Địa điểm hiện đang đóng cửa. Vui lòng check-in trong giờ mở cửa.",
      });
      return;
    }

    const rawAgent = req.headers["user-agent"];
    const deviceInfo = Array.isArray(rawAgent)
      ? rawAgent.join(" ")
      : (rawAgent ?? null);

    // Insert checkin with image_url if column exists; fallback by embedding into notes JSON.
    const noteText = body.notes ?? null;
    let checkinId: number;
    try {
      const [result] = await pool.query<ResultSetHeader>(
        `INSERT INTO checkins
         (user_id, location_id, checkin_latitude, checkin_longitude, notes, device_info, image_url, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'verified')`,
        [
          userId,
          locationId,
          hasCoords ? lat : null,
          hasCoords ? lng : null,
          noteText,
          deviceInfo,
          urlPath,
        ],
      );
      checkinId = result.insertId;
    } catch {
      const mergedNotes = JSON.stringify({
        text: noteText,
        image_url: urlPath,
      });
      try {
        const [result] = await pool.query<ResultSetHeader>(
          `INSERT INTO checkins
           (user_id, location_id, checkin_latitude, checkin_longitude, notes, device_info, status)
           VALUES (?, ?, ?, ?, ?, ?, 'verified')`,
          [
            userId,
            locationId,
            hasCoords ? lat : null,
            hasCoords ? lng : null,
            mergedNotes,
            deviceInfo,
          ],
        );
        checkinId = result.insertId;
      } catch {
        const [result] = await pool.query<ResultSetHeader>(
          `INSERT INTO checkins
           (user_id, location_id, checkin_latitude, checkin_longitude, notes, device_info)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            userId,
            locationId,
            hasCoords ? lat : null,
            hasCoords ? lng : null,
            mergedNotes,
            deviceInfo,
          ],
        );
        checkinId = result.insertId;
      }
    }

    res.status(201).json({
      success: true,
      data: {
        checkin_id: checkinId,
        location_id: locationId,
        image_url: urlPath,
      },
    });
  } catch (error) {
    console.error("Lỗi tạo check-in kèm ảnh:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const deleteUserCreatedLocation = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = getUserId(req as AuthenticatedRequest, res);
    if (!userId) return;

    const locationId = Number(req.params.id);
    if (!Number.isFinite(locationId)) {
      res
        .status(400)
        .json({ success: false, message: "locationId không hợp lệ" });
      return;
    }

    let rows: RowDataPacket[] = [];
    try {
      const [r] = await pool.query<RowDataPacket[]>(
        `SELECT location_id, owner_id, source, deleted_at
         FROM locations
         WHERE location_id = ?
         LIMIT 1`,
        [locationId],
      );
      rows = r;
    } catch {
      const [r] = await pool.query<RowDataPacket[]>(
        `SELECT location_id, owner_id, is_user_created
         FROM locations
         WHERE location_id = ?
         LIMIT 1`,
        [locationId],
      );
      rows = r;
    }

    if (rows.length === 0) {
      res
        .status(404)
        .json({ success: false, message: "Địa điểm không tồn tại" });
      return;
    }

    const row = rows[0] as {
      owner_id: number | null;
      is_user_created?: number | boolean | null;
      source?: string | null;
      deleted_at?: string | null;
    };

    const ownerId = row.owner_id == null ? null : Number(row.owner_id);
    const isOwner = ownerId === userId;
    const isSoftDeleted = Boolean(row.deleted_at);

    const isOwnedSource =
      typeof row.source === "string" ? row.source === "owner" : false;
    const isLegacyUserCreated = Number(row.is_user_created) === 1;

    const allowed =
      isOwner && !isSoftDeleted && (isOwnedSource || isLegacyUserCreated);
    if (!allowed) {
      res.status(403).json({
        success: false,
        message: "Bạn không có quyền xóa địa điểm này",
      });
      return;
    }

    // Prefer hard delete (nếu FK đang CASCADE sẽ tự xoá checkins/booking liên quan).
    // Nếu fail do FK RESTRICT hoặc schema khác, fallback soft delete.
    try {
      await pool.query<ResultSetHeader>(
        `DELETE FROM locations WHERE location_id = ? AND owner_id = ?`,
        [locationId, userId],
      );
      res.json({ success: true, data: null, message: "Đã xóa địa điểm" });
      return;
    } catch {
      // fallback soft delete
    }

    // Prefer soft delete when schema supports it.
    // Lưu ý: schema hiện tại (TravelCheckinApp.sql) không có deleted_at/source, nên cần fallback.
    try {
      await pool.query<ResultSetHeader>(
        `UPDATE locations
         SET deleted_at = NOW(), status = 'inactive', updated_at = NOW()
         WHERE location_id = ? AND owner_id = ? AND source = 'owner' AND deleted_at IS NULL`,
        [locationId, userId],
      );
      res.json({ success: true, data: null, message: "Đã xóa địa điểm" });
      return;
    } catch {
      // schema không có deleted_at/source
    }

    // Fallback: schema legacy chỉ có status/previous_status/is_user_created.
    await pool.query<ResultSetHeader>(
      `UPDATE locations
       SET previous_status = status, status = 'inactive'
       WHERE location_id = ? AND owner_id = ? AND is_user_created = 1 AND status <> 'inactive'`,
      [locationId, userId],
    );

    res.json({ success: true, data: null, message: "Đã xóa địa điểm" });
  } catch (error) {
    console.error("Lỗi xóa địa điểm user tạo:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const uploadUserReviewImage = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = getUserId(req as AuthenticatedRequest, res);
    if (!userId) return;

    const file = (req as unknown as { file?: Express.Multer.File }).file;
    if (!file) {
      res.status(400).json({ success: false, message: "Vui lòng chọn ảnh" });
      return;
    }

    const result = await saveImageToDB(file, "review_image", userId, "user");

    res.json({ success: true, data: { image_url: result.url } });
  } catch (error) {
    console.error("Lỗi upload ảnh review:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const createUserReview = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = getUserId(req as AuthenticatedRequest, res);
    if (!userId) return;

    const body = req.body as CreateReviewBody;
    const locationId = Number(body?.location_id);
    const rating = Number(body?.rating);
    const comment = body?.comment?.trim() ?? null;
    const images = Array.isArray(body?.images)
      ? body.images.filter((item) => typeof item === "string")
      : null;

    if (!Number.isFinite(locationId)) {
      res.status(400).json({ success: false, message: "Thiếu location_id" });
      return;
    }

    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      res.status(400).json({ success: false, message: "Rating không hợp lệ" });
      return;
    }

    if (!Number.isInteger(rating * 2)) {
      res.status(400).json({
        success: false,
        message: "Rating phải theo bước 0.5",
      });
      return;
    }

    const halfStep = Math.round(rating * 2) / 2;

    const [locationRows] = await pool.query<RowDataPacket[]>(
      `SELECT rating, total_reviews FROM locations WHERE location_id = ? LIMIT 1`,
      [locationId],
    );

    if (locationRows.length === 0) {
      res
        .status(404)
        .json({ success: false, message: "Địa điểm không tồn tại" });
      return;
    }

    const [insertResult] = await pool.query<ResultSetHeader>(
      `INSERT INTO reviews (user_id, location_id, rating, comment, images)
       VALUES (?, ?, ?, ?, ?)`,
      [
        userId,
        locationId,
        halfStep,
        comment,
        images ? JSON.stringify(images) : null,
      ],
    );

    const currentRating = Number(locationRows[0]?.rating ?? 0);
    const totalReviews = Number(locationRows[0]?.total_reviews ?? 0);
    const newTotal = totalReviews + 1;
    const newRating =
      newTotal > 0
        ? Math.round(
          ((currentRating * totalReviews + halfStep) / newTotal) * 10,
        ) / 10
        : halfStep;

    await pool.query<ResultSetHeader>(
      `UPDATE locations SET rating = ?, total_reviews = ? WHERE location_id = ?`,
      [newRating, newTotal, locationId],
    );

    try {
      const [ownerRows] = await pool.query<RowDataPacket[]>(
        `SELECT l.owner_id, l.location_name, u.full_name AS reviewer_name
         FROM locations l
         LEFT JOIN users u ON u.user_id = ?
         WHERE l.location_id = ?
         LIMIT 1`,
        [userId, locationId],
      );
      const ownerId = Number(ownerRows[0]?.owner_id || 0);
      if (ownerId > 0) {
        const locationName = String(
          ownerRows[0]?.location_name || "địa điểm",
        ).trim();
        const reviewerName = String(
          ownerRows[0]?.reviewer_name || "Khách",
        ).trim();
        const title = "Có đánh giá mới";
        const body = `[owner:reviews] ${reviewerName} vừa đánh giá ${locationName} (${halfStep}/5).`;
        await pool.query(
          `INSERT INTO push_notifications (title, body, target_audience, target_user_id, sent_by)
           VALUES (?, ?, 'specific_user', ?, ?)`,
          [title, body, ownerId, userId],
        );
      }
    } catch (notifyError) {
      console.warn("Không thể tạo thông báo review cho owner:", notifyError);
    }

    res.status(201).json({
      success: true,
      data: {
        review_id: insertResult.insertId,
        rating: newRating,
        total_reviews: newTotal,
      },
      message: "Đã gửi đánh giá",
    });
  } catch (error) {
    console.error("Lỗi tạo review:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const deleteUserReview = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = getUserId(req as AuthenticatedRequest, res);
    if (!userId) return;

    const reviewId = Number(req.params.id);
    if (!reviewId) {
      res.status(400).json({ success: false, message: "Thiếu review ID" });
      return;
    }

    // Kiểm tra review tồn tại và thuộc về user
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT review_id, user_id, location_id, rating FROM reviews
       WHERE review_id = ? AND status = 'active' LIMIT 1`,
      [reviewId],
    );

    if (rows.length === 0) {
      res.status(404).json({ success: false, message: "Không tìm thấy đánh giá" });
      return;
    }

    if (Number(rows[0].user_id) !== userId) {
      res.status(403).json({ success: false, message: "Không có quyền xóa đánh giá này" });
      return;
    }

    const locationId = rows[0].location_id;

    // Soft-delete
    await pool.query(
      `UPDATE reviews SET status = 'deleted', deleted_at = NOW(), deleted_by = ? WHERE review_id = ?`,
      [userId, reviewId],
    );

    // Tính lại rating
    const [statsRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt, COALESCE(AVG(rating), 0) AS avg_rating
       FROM reviews WHERE location_id = ? AND status = 'active'`,
      [locationId],
    );

    const newCount = Number(statsRows[0]?.cnt ?? 0);
    const newAvg = Math.round(Number(statsRows[0]?.avg_rating ?? 0) * 10) / 10;

    await pool.query(
      `UPDATE locations SET rating = ?, total_reviews = ? WHERE location_id = ?`,
      [newAvg, newCount, locationId],
    );

    res.json({ success: true, message: "Đã xóa đánh giá" });
  } catch (error) {
    console.error("Lỗi xóa review:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const userReplyToReview = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = getUserId(req as AuthenticatedRequest, res);
    if (!userId) return;

    const reviewId = Number(req.params.id);
    const { content, images } = req.body as {
      content?: string;
      images?: string[];
    };

    if (!reviewId || typeof content !== "string" || !content.trim()) {
      res.status(400).json({ success: false, message: "Dữ liệu không hợp lệ" });
      return;
    }

    // Kiem tra review ton tai
    const [reviewRows] = await pool.query<RowDataPacket[]>(
      `SELECT review_id, user_id FROM reviews WHERE review_id = ? AND status = 'active' LIMIT 1`,
      [reviewId],
    );

    if (reviewRows.length === 0) {
      res.status(404).json({ success: false, message: "Không tìm thấy đánh giá" });
      return;
    }

    // Luu anh dang JSON array
    const imagesJson =
      Array.isArray(images) && images.length > 0
        ? JSON.stringify(images.filter((img) => typeof img === "string" && img.trim()))
        : null;

    // Upsert: neu user da reply thi update
    const [existing] = await pool.query<RowDataPacket[]>(
      `SELECT reply_id FROM review_replies WHERE review_id = ? AND role = 'user' AND created_by = ? LIMIT 1`,
      [reviewId, userId],
    );

    if (existing.length > 0) {
      await pool.query(
        `UPDATE review_replies SET content = ?, images = ?, updated_at = NOW() WHERE reply_id = ?`,
        [content.trim(), imagesJson, existing[0].reply_id],
      );
    } else {
      await pool.query(
        `INSERT INTO review_replies (review_id, content, images, role, created_by) VALUES (?, ?, ?, 'user', ?)`,
        [reviewId, content.trim(), imagesJson, userId],
      );
    }

    res.status(201).json({ success: true, message: "Đã phản hồi" });
  } catch (error) {
    console.error("Lỗi user reply:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const getUserFavorites = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = getUserId(req as AuthenticatedRequest, res);
    if (!userId) return;

    // Prefer note/tags columns if migrated; fallback to basic favorites list.
    try {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT f.location_id, f.added_at, f.note, f.tags,
                l.location_name, l.address, l.location_type, l.first_image, l.status
         FROM favorite_locations f
         JOIN locations l ON l.location_id = f.location_id
         WHERE f.user_id = ?
         ORDER BY f.added_at DESC`,
        [userId],
      );
      res.json({ success: true, data: rows });
      return;
    } catch {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT f.location_id, f.added_at,
                l.location_name, l.address, l.location_type, l.first_image, l.status
         FROM favorite_locations f
         JOIN locations l ON l.location_id = f.location_id
         WHERE f.user_id = ?
         ORDER BY f.added_at DESC`,
        [userId],
      );
      res.json({
        success: true,
        data: rows,
        message:
          "favorites chưa có note/tags trong DB. Hãy migrate để dùng tag/ghi chú.",
      });
      return;
    }
  } catch (error) {
    console.error("Lỗi lấy favorites:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const updateUserFavorite = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = getUserId(req as AuthenticatedRequest, res);
    if (!userId) return;

    const locationId = Number(req.params.locationId);
    if (!Number.isFinite(locationId)) {
      res
        .status(400)
        .json({ success: false, message: "locationId không hợp lệ" });
      return;
    }

    const body = req.body as UpdateFavoriteBody;
    const note = body.note === undefined ? undefined : (body.note ?? null);
    const tags = body.tags === undefined ? undefined : (body.tags ?? null);

    // Ensure favorite exists
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id FROM favorite_locations WHERE user_id = ? AND location_id = ? LIMIT 1`,
      [userId, locationId],
    );
    const hasFavorite = rows.length > 0;

    // If client only wants "save" action, allow empty note/tags.
    const noteValue = note === undefined ? null : note;
    const tagsValue = tags === undefined ? null : tags;

    if (!hasFavorite) {
      try {
        await pool.query(
          `INSERT INTO favorite_locations (user_id, location_id, note, tags)
           VALUES (?, ?, ?, ?)`,
          [userId, locationId, noteValue, tagsValue],
        );
      } catch {
        // Backward-compatible schema without note/tags columns.
        await pool.query(
          `INSERT IGNORE INTO favorite_locations (user_id, location_id)
           VALUES (?, ?)`,
          [userId, locationId],
        );
      }
    } else {
      const updates: string[] = [];
      const params: Array<string | number | null> = [];

      // If request has no note/tags, keep existing metadata and just confirm saved state.
      if (note !== undefined) {
        updates.push("note = ?");
        params.push(noteValue);
      }
      if (tags !== undefined) {
        updates.push("tags = ?");
        params.push(tagsValue);
      }

      if (updates.length > 0) {
        try {
          await pool.query(
            `UPDATE favorite_locations SET ${updates.join(", ")} WHERE user_id = ? AND location_id = ?`,
            [...params, userId, locationId],
          );
        } catch {
          // Backward-compatible schema without note/tags columns.
        }
      }
    }

    res.json({
      success: true,
      message: hasFavorite ? "Đã cập nhật favorite" : "Đã lưu địa điểm",
    });
  } catch (error) {
    console.error("Lỗi cập nhật favorite:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const removeUserFavoriteLocation = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = getUserId(req as AuthenticatedRequest, res);
    if (!userId) return;

    const locationId = Number(req.params.locationId);
    if (!Number.isFinite(locationId)) {
      res
        .status(400)
        .json({ success: false, message: "locationId không hợp lệ" });
      return;
    }

    await pool.query(
      `DELETE FROM favorite_locations WHERE user_id = ? AND location_id = ?`,
      [userId, locationId],
    );

    res.json({ success: true, message: "Đã bỏ lưu địa điểm" });
  } catch (error) {
    console.error("Lỗi xoá favorite:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const getUserLocationRecommendations = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = getUserId(req as AuthenticatedRequest, res);
    if (!userId) return;

    const { limit } = (req.query ?? {}) as RecommendLocationsQuery;
    const finalLimit = Math.min(Math.max(Number(limit ?? 12) || 12, 5), 30);

    const [favoriteRows] = await pool.query<RowDataPacket[]>(
      `SELECT f.location_id, f.added_at,
              l.location_name, l.address, l.location_type, l.first_image, l.rating
       FROM favorite_locations f
       JOIN locations l ON l.location_id = f.location_id
       WHERE f.user_id = ?
       ORDER BY f.added_at DESC
       LIMIT 10`,
      [userId],
    );

    const [recentRows] = await pool.query<RowDataPacket[]>(
      `SELECT c.location_id, MAX(c.checkin_time) AS last_checkin,
              l.location_name, l.address, l.location_type, l.first_image, l.rating
       FROM checkins c
       JOIN locations l ON l.location_id = c.location_id
       WHERE c.user_id = ?
         AND c.checkin_time >= (NOW() - INTERVAL 60 DAY)
       GROUP BY c.location_id
       ORDER BY last_checkin DESC
       LIMIT 10`,
      [userId],
    );

    const [topTypesRows] = await pool.query<RowDataPacket[]>(
      `SELECT l.location_type, COUNT(*) AS cnt
       FROM checkins c
       JOIN locations l ON l.location_id = c.location_id
       WHERE c.user_id = ?
         AND c.checkin_time >= (NOW() - INTERVAL 90 DAY)
       GROUP BY l.location_type
       ORDER BY cnt DESC
       LIMIT 3`,
      [userId],
    );

    const preferredTypes = topTypesRows
      .map((r) =>
        typeof r.location_type === "string" ? r.location_type : null,
      )
      .filter((t): t is string => Boolean(t));

    const excludedIds = new Set<number>();
    favoriteRows.forEach((r) => excludedIds.add(Number(r.location_id)));
    recentRows.forEach((r) => excludedIds.add(Number(r.location_id)));

    let recommended: RowDataPacket[] = [];
    if (preferredTypes.length > 0) {
      const placeholders = preferredTypes.map(() => "?").join(",");
      // NOTE: Exclusion by set is handled in JS to keep query simple.
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT location_id, location_name, address, location_type, first_image, rating
         FROM locations
         WHERE status = 'active'
           AND location_type IN (${placeholders})
         ORDER BY rating DESC, total_checkins DESC
         LIMIT 50`,
        preferredTypes,
      );

      recommended = rows.filter((r) => !excludedIds.has(Number(r.location_id)));
    }

    res.json({
      success: true,
      data: {
        favorites: favoriteRows,
        recent: recentRows,
        recommended: recommended.slice(0, finalLimit),
      },
    });
  } catch (error) {
    console.error("Lỗi gợi ý địa điểm:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const getUserCreatedLocations = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = getUserId(req as AuthenticatedRequest, res);
    if (!userId) return;

    let rows: RowDataPacket[] = [];
    try {
      const [r] = await pool.query<RowDataPacket[]>(
        `SELECT *
         FROM locations
         WHERE owner_id = ? AND source = 'owner' AND deleted_at IS NULL
         ORDER BY updated_at DESC, location_id DESC`,
        [userId],
      );
      rows = r;
    } catch {
      const [r] = await pool.query<RowDataPacket[]>(
        `SELECT *
         FROM locations
         WHERE owner_id = ? AND is_user_created = 1
         ORDER BY updated_at DESC, location_id DESC`,
        [userId],
      );
      rows = r;
    }

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Lỗi lấy user-created locations:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const updateUserCreatedLocation = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = getUserId(req as AuthenticatedRequest, res);
    if (!userId) return;

    const locationId = Number(req.params.id);
    if (!Number.isFinite(locationId)) {
      res
        .status(400)
        .json({ success: false, message: "Location ID không hợp lệ" });
      return;
    }

    let rows: RowDataPacket[] = [];
    try {
      const [r] = await pool.query<RowDataPacket[]>(
        `SELECT location_id
         FROM locations
         WHERE location_id = ? AND owner_id = ? AND source = 'owner' AND deleted_at IS NULL
         LIMIT 1`,
        [locationId, userId],
      );
      rows = r;
    } catch {
      const [r] = await pool.query<RowDataPacket[]>(
        `SELECT location_id
         FROM locations
         WHERE location_id = ? AND owner_id = ? AND is_user_created = 1
         LIMIT 1`,
        [locationId, userId],
      );
      rows = r;
    }
    if (rows.length === 0) {
      res.status(404).json({
        success: false,
        message: "Không tìm thấy địa điểm hoặc bạn không có quyền",
      });
      return;
    }

    const body = req.body as UpdateUserCreatedLocationBody;
    const allowedTypes = new Set([
      "hotel",
      "restaurant",
      "tourist",
      "cafe",
      "resort",
      "other",
    ]);

    const updates: string[] = [];
    const params: Array<string | number | null> = [];

    if (typeof body.location_name === "string") {
      const name = body.location_name.trim();
      if (name.length < 3) {
        res.status(400).json({ success: false, message: "Tên quá ngắn" });
        return;
      }
      updates.push("location_name = ?");
      params.push(name);
    }

    if (body.location_type && allowedTypes.has(body.location_type)) {
      updates.push("location_type = ?");
      params.push(body.location_type);
    } else if (body.location_type) {
      res
        .status(400)
        .json({ success: false, message: "Loại địa điểm không hợp lệ" });
      return;
    }

    if (body.address !== undefined) {
      const address = (body.address ?? "").trim();
      if (!address) {
        res
          .status(400)
          .json({ success: false, message: "Địa chỉ không được rỗng" });
        return;
      }
      updates.push("address = ?");
      params.push(address);
    }

    if (body.description !== undefined) {
      updates.push("description = ?");
      params.push(body.description ?? null);
    }

    if (body.province !== undefined) {
      const province = body.province?.trim() || null;
      updates.push("province = ?");
      params.push(province);
    }

    if (body.latitude !== undefined) {
      const v = body.latitude;
      if (v != null && (!Number.isFinite(v) || Math.abs(v) > 90)) {
        res
          .status(400)
          .json({ success: false, message: "Latitude không hợp lệ" });
        return;
      }
      updates.push("latitude = ?");
      params.push(v ?? null);
    }

    if (body.longitude !== undefined) {
      const v = body.longitude;
      if (v != null && (!Number.isFinite(v) || Math.abs(v) > 180)) {
        res
          .status(400)
          .json({ success: false, message: "Longitude không hợp lệ" });
        return;
      }
      updates.push("longitude = ?");
      params.push(v ?? null);
    }

    if (body.status !== undefined) {
      if (body.status !== "active" && body.status !== "inactive") {
        res
          .status(400)
          .json({ success: false, message: "Status không hợp lệ" });
        return;
      }
      updates.push("status = ?");
      params.push(body.status);
    }

    if (updates.length === 0) {
      res
        .status(400)
        .json({ success: false, message: "Không có trường nào để cập nhật" });
      return;
    }

    try {
      await pool.query<ResultSetHeader>(
        `UPDATE locations
         SET ${updates.join(", ")}, updated_at = NOW()
         WHERE location_id = ? AND owner_id = ? AND source = 'owner' AND deleted_at IS NULL`,
        [...params, locationId, userId],
      );
    } catch {
      await pool.query<ResultSetHeader>(
        `UPDATE locations
         SET ${updates.join(", ")}, updated_at = NOW()
         WHERE location_id = ? AND owner_id = ? AND is_user_created = 1`,
        [...params, locationId, userId],
      );
    }

    const [afterRows] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM locations WHERE location_id = ? LIMIT 1",
      [locationId],
    );
    res.json({ success: true, data: afterRows[0] ?? null });
  } catch (error) {
    console.error("Lỗi cập nhật user-created location:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const getUserProfile = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = getUserId(req as AuthenticatedRequest, res);
    if (!userId) return;

    const queries: Array<{ sql: string; params: Array<number> }> = [
      {
        sql: `SELECT user_id, email, phone, full_name, address, username,
                     avatar_url, avatar_path, avatar_source,
                     background_url, background_path, background_source,
                     role, status, created_at, updated_at
              FROM users
              WHERE user_id = ? AND role = 'user'
              LIMIT 1`,
        params: [userId],
      },
      {
        sql: `SELECT user_id, email, phone, full_name,
                     avatar_url, avatar_path, avatar_source,
                     role, status, created_at, updated_at
              FROM users
              WHERE user_id = ? AND role = 'user'
              LIMIT 1`,
        params: [userId],
      },
    ];

    let rows: RowDataPacket[] = [];
    let lastError: unknown = null;
    for (const q of queries) {
      try {
        const [data] = await pool.query<RowDataPacket[]>(q.sql, q.params);
        rows = data;
        lastError = null;
        break;
      } catch (e) {
        lastError = e;
      }
    }

    if (lastError) {
      console.error("Lỗi lấy profile user:", lastError);
      res.status(500).json({ success: false, message: "Lỗi server" });
      return;
    }

    if (rows.length === 0) {
      res.status(404).json({ success: false, message: "Không tìm thấy user" });
      return;
    }

    const row = rows[0] as
      | {
        user_id: number;
        email: string | null;
        phone: string | null;
        full_name: string;
        address?: string | null;
        username?: string | null;
        avatar_url: string | null;
        avatar_path: string | null;
        avatar_source: "upload" | "url" | null;
        background_url?: string | null;
        background_path?: string | null;
        background_source?: "upload" | "url" | null;
        role: string;
        status: string;
        created_at: string;
        updated_at: string;
      }
      | undefined;

    if (!row) {
      res.status(404).json({ success: false, message: "Không tìm thấy user" });
      return;
    }

    let effectiveAvatarUrl: string | null = null;
    if (row.avatar_source === "upload" && row.avatar_path) {
      effectiveAvatarUrl = row.avatar_path;
    } else if (row.avatar_url) {
      effectiveAvatarUrl = row.avatar_url;
    }

    const hasBackgroundColumns =
      Object.prototype.hasOwnProperty.call(row, "background_url") ||
      Object.prototype.hasOwnProperty.call(row, "background_path") ||
      Object.prototype.hasOwnProperty.call(row, "background_source");

    let effectiveBackgroundUrl: string | null = null;
    const bgSource = row.background_source ?? null;
    const bgPath = row.background_path ?? null;
    const bgUrl = row.background_url ?? null;
    if (bgSource === "upload" && bgPath) {
      effectiveBackgroundUrl = bgPath;
    } else if (bgUrl) {
      effectiveBackgroundUrl = bgUrl;
    }

    // --- Bắt đầu tính toán Stats động cho User ---
    const [[{ total_orders }]] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total_orders FROM bookings WHERE user_id = ? AND status != 'cancelled'`,
      [userId]
    );

    const [[{ total_spending }]] = await pool.query<RowDataPacket[]>(
      `SELECT COALESCE(SUM(p.amount), 0) AS total_spending
       FROM payments p
       INNER JOIN bookings b ON p.booking_id = b.booking_id
       WHERE b.user_id = ? AND p.status = 'completed'`,
      [userId]
    );

    const [[{ latest_order_date }]] = await pool.query<RowDataPacket[]>(
      `SELECT MAX(created_at) AS latest_order_date FROM bookings WHERE user_id = ? AND status != 'cancelled'`,
      [userId]
    );

    const [favRows] = await pool.query<RowDataPacket[]>(
      `SELECT b.location_id, l.location_name, COUNT(b.booking_id) AS visit_count,
              COALESCE(SUM(p.amount), 0) AS total_spent, MAX(b.created_at) AS latest_visit,
              l.first_image
       FROM bookings b
       JOIN locations l ON b.location_id = l.location_id
       LEFT JOIN payments p ON p.booking_id = b.booking_id AND p.status = 'completed'
       WHERE b.user_id = ? AND b.status = 'completed'
       GROUP BY b.location_id, l.location_name, l.first_image
       ORDER BY visit_count DESC, total_spent DESC
       LIMIT 1`,
      [userId]
    );
    const favorite_location = favRows.length > 0 ? favRows[0] : null;

    const [[{ checkin_count }]] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS checkin_count FROM checkins WHERE user_id = ?`,
      [userId]
    );

    let member_tier = "Newbie 🌟";
    if (checkin_count > 30) {
      member_tier = "Diamond Pathfinder 💎";
    } else if (checkin_count > 15) {
      member_tier = "Gold Explorer 🥇";
    } else if (checkin_count >= 5) {
      member_tier = "Silver Traveler 🥈";
    }
    // --- Kết thúc tính toán Stats động ---

    res.json({
      success: true,
      data: {
        ...row,
        avatar_url: effectiveAvatarUrl,
        avatar_source: row.avatar_source || "url",
        ...(hasBackgroundColumns
          ? {
            background_url: effectiveBackgroundUrl,
            background_source: bgSource || "url",
          }
          : {}),
        stats: {
          total_orders: Number(total_orders || 0),
          total_spending: Number(total_spending || 0),
          latest_order_date: latest_order_date ? new Date(latest_order_date).toISOString() : null,
          favorite_location: favorite_location ? {
            location_name: favorite_location.location_name,
            visit_count: Number(favorite_location.visit_count || 0),
            total_spent: Number(favorite_location.total_spent || 0),
            latest_visit: favorite_location.latest_visit ? new Date(favorite_location.latest_visit).toISOString() : null,
            first_image: favorite_location.first_image,
          } : null,
          member_tier,
          checkin_count: Number(checkin_count || 0),
        }
      },
    });
  } catch (error) {
    console.error("Lỗi lấy profile user:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const updateUserProfile = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = getUserId(req as AuthenticatedRequest, res);
    if (!userId) return;

    const body = req.body as UpdateProfileBody;
    const fullName = normalizePersonName(body.full_name);
    if (!fullName) {
      res.status(400).json({ success: false, message: "Thiếu họ tên" });
      return;
    }
    if (!isValidPersonName(fullName)) {
      res.status(400).json({
        success: false,
        message: "Họ tên không được chứa ký tự đặc biệt",
      });
      return;
    }

    const phone = body.phone?.trim() ? body.phone.trim() : null;
    if (phone && !isValidPhoneNumber(phone)) {
      res.status(400).json({
        success: false,
        message:
          "Số điện thoại phải gồm 10 số, bắt đầu bằng 0 và không chứa ký tự đặc biệt",
      });
      return;
    }
    const address = body.address?.trim() ? body.address.trim() : null;
    const skipAvatar = Boolean(body.skip_avatar);
    const avatarUrl = body.avatar_url?.trim() ? body.avatar_url.trim() : null;

    const sets: string[] = ["full_name = ?", "phone = ?", "address = ?", "updated_at = NOW()"];
    const params: Array<string | null | number> = [fullName, phone, address];

    if (!skipAvatar) {
      sets.push(
        "avatar_url = ?",
        "avatar_path = NULL",
        "avatar_source = 'url'",
        "avatar_updated_at = NOW()",
      );
      params.push(avatarUrl);
    }

    try {
      await pool.query<ResultSetHeader>(
        `UPDATE users
         SET ${sets.join(", ")}
         WHERE user_id = ?`,
        [...params, userId],
      );
    } catch (e) {
      if (skipAvatar) {
        await pool.query<ResultSetHeader>(
          `UPDATE users
           SET full_name = ?, phone = ?, address = ?, updated_at = NOW()
           WHERE user_id = ?`,
          [fullName, phone, address, userId],
        );
      } else {
        await pool.query<ResultSetHeader>(
          `UPDATE users
           SET full_name = ?,
               phone = ?,
               address = ?,
               avatar_url = ?,
               avatar_path = NULL,
               avatar_source = 'url',
               avatar_updated_at = NOW(),
               updated_at = NOW()
           WHERE user_id = ?`,
          [fullName, phone, address, avatarUrl, userId],
        );
      }
    }

    const selectQueries: Array<{ sql: string; params: Array<number> }> = [
      {
        sql: `SELECT user_id, email, phone, full_name, address, username,
                     avatar_url, avatar_path, avatar_source,
                     background_url, background_path, background_source,
                     role, status, created_at, updated_at
              FROM users
              WHERE user_id = ?
              LIMIT 1`,
        params: [userId],
      },
      {
        sql: `SELECT user_id, email, phone, full_name,
                     avatar_url, avatar_path, avatar_source,
                     role, status, created_at, updated_at
              FROM users
              WHERE user_id = ?
              LIMIT 1`,
        params: [userId],
      },
    ];

    let rows: RowDataPacket[] = [];
    let lastSelectError: unknown = null;
    for (const q of selectQueries) {
      try {
        const [data] = await pool.query<RowDataPacket[]>(q.sql, q.params);
        rows = data;
        lastSelectError = null;
        break;
      } catch (e) {
        lastSelectError = e;
      }
    }

    if (lastSelectError) {
      console.error("Lỗi lấy profile user sau update:", lastSelectError);
      res.status(500).json({ success: false, message: "Lỗi server" });
      return;
    }

    const row = rows[0] as
      | {
        user_id: number;
        email: string | null;
        phone: string | null;
        full_name: string;
        address?: string | null;
        username?: string | null;
        avatar_url: string | null;
        avatar_path: string | null;
        avatar_source: "upload" | "url" | null;
        background_url?: string | null;
        background_path?: string | null;
        background_source?: "upload" | "url" | null;
        role: string;
        status: string;
        created_at: string;
        updated_at: string;
      }
      | undefined;

    if (!row) {
      res.status(404).json({ success: false, message: "Không tìm thấy user" });
      return;
    }

    let effectiveAvatarUrl: string | null = null;
    if (row.avatar_source === "upload" && row.avatar_path) {
      effectiveAvatarUrl = row.avatar_path;
    } else if (row.avatar_url) {
      effectiveAvatarUrl = row.avatar_url;
    }

    const hasBackgroundColumns =
      Object.prototype.hasOwnProperty.call(row, "background_url") ||
      Object.prototype.hasOwnProperty.call(row, "background_path") ||
      Object.prototype.hasOwnProperty.call(row, "background_source");

    let effectiveBackgroundUrl: string | null = null;
    const bgSource = row.background_source ?? null;
    const bgPath = row.background_path ?? null;
    const bgUrl = row.background_url ?? null;
    if (bgSource === "upload" && bgPath) {
      effectiveBackgroundUrl = bgPath;
    } else if (bgUrl) {
      effectiveBackgroundUrl = bgUrl;
    }

    res.json({
      success: true,
      data: {
        ...row,
        avatar_url: effectiveAvatarUrl,
        avatar_source: row.avatar_source || "url",
        ...(hasBackgroundColumns
          ? {
            background_url: effectiveBackgroundUrl,
            background_source: bgSource || "url",
          }
          : {}),
      },
    });
  } catch (error) {
    console.error("Lỗi cập nhật profile user:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const uploadUserBackground = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = getUserId(req as AuthenticatedRequest, res);
    if (!userId) return;

    const file = (req as unknown as { file?: Express.Multer.File }).file;
    if (!file) {
      res.status(400).json({ success: false, message: "Vui lòng chọn ảnh" });
      return;
    }

    const result = await saveImageToDB(file, "user_background", userId, "user");

    await removeEntityImages("user", userId, "background");
    await linkImageToEntity(result.imageId, "user", userId, "background", 0, true);

    await pool.query(
      `UPDATE users
       SET background_path = ?, background_source = 'upload', background_url = ?,
           background_updated_at = NOW(), updated_at = NOW()
       WHERE user_id = ? AND role = 'user'`,
      [result.url, result.url, userId],
    );

    res.json({
      success: true,
      message: "Đã cập nhật ảnh nền",
      data: { background_url: result.url },
    });
  } catch (error: unknown) {
    console.error("Lỗi upload background user:", error);
    const err = error as { message?: string };
    res.status(500).json({
      success: false,
      message:
        err?.message ||
        "Không thể lưu ảnh nền. Vui lòng thử ảnh nhỏ hơn hoặc đổi định dạng.",
    });
  }
};

export const uploadUserAvatar = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = getUserId(req as AuthenticatedRequest, res);
    if (!userId) return;

    const file = (req as unknown as { file?: Express.Multer.File }).file;
    if (!file) {
      res.status(400).json({ success: false, message: "Vui lòng chọn ảnh" });
      return;
    }

    const result = await saveImageToDB(file, "avatar_user", userId, "user");

    await removeEntityImages("user", userId, "avatar");
    await linkImageToEntity(result.imageId, "user", userId, "avatar", 0, true);

    await pool.query(
      `UPDATE users
       SET avatar_path = ?, avatar_source = 'upload', avatar_url = ?, avatar_updated_at = NOW(), updated_at = NOW()
       WHERE user_id = ? AND role = 'user'`,
      [result.url, result.url, userId],
    );

    res.json({
      success: true,
      message: "Đã cập nhật ảnh đại diện",
      data: { avatar_url: result.url },
    });
  } catch (error: unknown) {
    console.error("Lỗi upload avatar user:", error);
    const err = error as { message?: string };
    res.status(500).json({
      success: false,
      message:
        err?.message ||
        "Không thể lưu ảnh đại diện. Vui lòng thử ảnh nhỏ hơn hoặc đổi định dạng.",
    });
  }
};

export const getUserTouristTickets = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = getUserId(req as AuthenticatedRequest, res);
    if (!userId) return;

    const locationIdRaw = Number((req.query as any)?.location_id);
    const locationId = Number.isFinite(locationIdRaw) ? locationIdRaw : null;

    const where: string[] = ["b.user_id = ?", "s.service_type = 'ticket'"];
    const params: Array<number | string> = [userId];

    if (locationId != null) {
      where.push("b.location_id = ?");
      params.push(locationId);
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
         s.price AS service_price,
         s.images AS service_images,
         b.booking_id,
         b.check_in_date AS use_date,
         b.location_id,
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
       JOIN locations l ON l.location_id = b.location_id
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
  } catch (error) {
    console.error("Lỗi lấy vé du lịch user:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const getUserLoginHistory = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = getUserId(req as AuthenticatedRequest, res);
    if (!userId) return;

    const {
      page = "1",
      limit = "5",
      success,
      from,
      to,
      q,
    } = req.query as {
      page?: string;
      limit?: string;
      success?: string;
      from?: string;
      to?: string;
      q?: string;
    };
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(50, Math.max(1, Number(limit) || 5));
    const offset = (pageNum - 1) * limitNum;

    const where: string[] = ["user_id = ?"];
    const params: Array<string | number> = [userId];

    const successNorm =
      success === "1" || success === "true"
        ? 1
        : success === "0" || success === "false"
          ? 0
          : null;
    if (successNorm !== null) {
      where.push("success = ?");
      params.push(successNorm);
    }
    if (typeof from === "string" && from.trim()) {
      where.push("created_at >= ?");
      params.push(from.trim());
    }
    if (typeof to === "string" && to.trim()) {
      where.push("created_at <= ?");
      params.push(to.trim());
    }
    if (typeof q === "string" && q.trim()) {
      where.push(
        "(ip_address LIKE ? OR user_agent LIKE ? OR device_info LIKE ?)",
      );
      const pattern = `%${q.trim()}%`;
      params.push(pattern, pattern, pattern);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT login_id, success, ip_address, user_agent, device_info, created_at
       FROM login_history
       ${whereSql}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limitNum, offset],
    );

    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM login_history ${whereSql}`,
      params,
    );

    res.json({
      success: true,
      data: rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: countRows[0]?.total || 0,
      },
    });
  } catch (error) {
    console.error("Lỗi lấy login history user:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};


export const claimVoucher = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req as AuthenticatedRequest, res);
    if (!userId) return;
    const voucherId = Number(req.params.id);
    if (!Number.isFinite(voucherId) || voucherId <= 0) {
      res.status(400).json({ success: false, message: "voucherId không hợp lệ" });
      return;
    }
    const [vRows] = await pool.query<RowDataPacket[]>(
      `SELECT voucher_id, code, status, end_date, usage_limit, used_count, max_uses_per_user
       FROM vouchers WHERE voucher_id = ? AND owner_deleted_at IS NULL`,
      [voucherId],
    );
    if (!vRows[0]) {
      res.status(404).json({ success: false, message: "Không tìm thấy voucher" });
      return;
    }
    const v = vRows[0];
    if (v.status !== 'active') {
      res.status(400).json({ success: false, message: "Voucher không khả dụng" });
      return;
    }
    if (new Date(v.end_date) < new Date()) {
      res.status(400).json({ success: false, message: "Voucher đã hết hạn" });
      return;
    }
    if (v.used_count >= v.usage_limit) {
      res.status(400).json({ success: false, message: "Voucher đã hết lượt" });
      return;
    }

    // Check if already claimed in wallet
    const [walletRows] = await pool.query<RowDataPacket[]>(
      `SELECT wallet_id FROM user_voucher_wallet WHERE user_id = ? AND voucher_id = ?`,
      [userId, voucherId],
    );
    if (walletRows.length > 0) {
      res.status(400).json({ success: false, message: "Voucher này đã có trong kho của bạn" });
      return;
    }

    // Check if user has used this voucher up to the max_uses_per_user limit
    const [usedCountRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as cnt
       FROM bookings
       WHERE user_id = ?
         AND voucher_code = ?
         AND status IN ('pending','confirmed','completed')`,
      [userId, v.code],
    );
    const userUsedCount = Number(usedCountRows[0]?.cnt || 0);
    const maxUsesPerUser = Number(v.max_uses_per_user || 1);
    if (maxUsesPerUser > 0 && userUsedCount >= maxUsesPerUser) {
      res.status(400).json({ success: false, message: "Bạn đã dùng hết số lượt của voucher này" });
      return;
    }

    await pool.query(
      `INSERT IGNORE INTO user_voucher_wallet (user_id, voucher_id) VALUES (?, ?)`,
      [userId, voucherId],
    );
    res.json({ success: true, message: "Đã lưu voucher" });
  } catch (error) {
    console.error("Lỗi claim voucher:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const getMySavedVouchers = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req as AuthenticatedRequest, res);
    if (!userId) return;

    let rows: RowDataPacket[];
    try {
      [rows] = await pool.query<RowDataPacket[]>(
        `SELECT v.voucher_id, v.code, v.campaign_name, v.campaign_description,
                v.discount_type, v.discount_value, v.min_order_value,
                v.max_discount_amount, v.start_date, v.end_date,
                v.apply_to_service_type, v.location_id, v.max_uses_per_user,
                l.location_name,
                w.claimed_at,
                (SELECT COUNT(*) FROM bookings b
                 WHERE b.user_id = w.user_id
                   AND b.voucher_code = v.code
                   AND b.status IN ('pending','confirmed','completed')
                ) as user_used_count,
                (SELECT JSON_ARRAYAGG(vl.location_id) FROM voucher_locations vl WHERE vl.voucher_id = v.voucher_id) as location_ids,
                (SELECT JSON_ARRAYAGG(l2.location_name) FROM voucher_locations vl2 JOIN locations l2 ON l2.location_id = vl2.location_id WHERE vl2.voucher_id = v.voucher_id) as location_names
         FROM user_voucher_wallet w
         JOIN vouchers v ON v.voucher_id = w.voucher_id
         LEFT JOIN locations l ON l.location_id = v.location_id
         WHERE w.user_id = ?
           AND v.owner_deleted_at IS NULL
           AND v.status = 'active'
           AND v.end_date >= NOW()
           AND (
             v.max_uses_per_user IS NULL
             OR v.max_uses_per_user <= 0
             OR (SELECT COUNT(*) FROM bookings b2
                 WHERE b2.user_id = w.user_id
                   AND b2.voucher_code = v.code
                   AND b2.status IN ('pending','confirmed','completed')
                ) < v.max_uses_per_user
           )
         ORDER BY w.claimed_at DESC`,
        [userId],
      );
    } catch (e: any) {
      const isMissing =
        e?.code === "ER_NO_SUCH_TABLE" &&
        String(e?.message || "").includes("voucher_locations");
      if (!isMissing) throw e;

      [rows] = await pool.query<RowDataPacket[]>(
        `SELECT v.voucher_id, v.code, v.campaign_name, v.campaign_description,
                v.discount_type, v.discount_value, v.min_order_value,
                v.max_discount_amount, v.start_date, v.end_date,
                v.apply_to_service_type, v.location_id, v.max_uses_per_user,
                l.location_name,
                w.claimed_at,
                (SELECT COUNT(*) FROM bookings b
                 WHERE b.user_id = w.user_id
                   AND b.voucher_code = v.code
                   AND b.status IN ('pending','confirmed','completed')
                ) as user_used_count,
                NULL as location_ids,
                NULL as location_names
         FROM user_voucher_wallet w
         JOIN vouchers v ON v.voucher_id = w.voucher_id
         LEFT JOIN locations l ON l.location_id = v.location_id
         WHERE w.user_id = ?
           AND v.owner_deleted_at IS NULL
           AND v.status = 'active'
           AND v.end_date >= NOW()
           AND (
             v.max_uses_per_user IS NULL
             OR v.max_uses_per_user <= 0
             OR (SELECT COUNT(*) FROM bookings b2
                 WHERE b2.user_id = w.user_id
                   AND b2.voucher_code = v.code
                   AND b2.status IN ('pending','confirmed','completed')
                ) < v.max_uses_per_user
           )
         ORDER BY w.claimed_at DESC`,
        [userId],
      );
    }

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Lỗi lấy saved vouchers:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const getVouchersByLocation = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req as AuthenticatedRequest, res);
    if (!userId) return;

    const locationId = Number(req.params.locationId);
    if (!Number.isFinite(locationId)) {
      res.status(400).json({ success: false, message: "locationId không hợp lệ" });
      return;
    }
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT v.voucher_id, v.campaign_name, v.campaign_description,
              v.discount_type, v.discount_value, v.min_order_value,
              v.max_discount_amount, v.start_date, v.end_date,
              v.usage_limit, v.used_count, v.max_uses_per_user,
              (v.usage_limit - v.used_count) as remaining,
              v.apply_to_location_type,
              EXISTS(
                SELECT 1 FROM user_voucher_wallet w
                WHERE w.user_id = ? AND w.voucher_id = v.voucher_id
              ) as is_claimed,
              (
                SELECT COUNT(*) FROM bookings b
                WHERE b.user_id = ?
                  AND b.voucher_code = v.code
                  AND b.status IN ('pending','confirmed','completed')
              ) as user_used_count
       FROM vouchers v
       CROSS JOIN (SELECT location_type FROM locations WHERE location_id = ? LIMIT 1) loc
       WHERE v.status = 'active'
         AND v.owner_deleted_at IS NULL
         AND v.start_date <= NOW()
         AND v.end_date >= NOW()
         AND (v.apply_to_location_type = 'all' OR v.apply_to_location_type = loc.location_type)
         AND (
           v.location_id = ?
           OR (
             v.location_id IS NULL
             AND (
               NOT EXISTS (SELECT 1 FROM voucher_locations vl WHERE vl.voucher_id = v.voucher_id)
               OR EXISTS (SELECT 1 FROM voucher_locations vl WHERE vl.voucher_id = v.voucher_id AND vl.location_id = ?)
             )
           )
         )
       ORDER BY v.end_date ASC`,
      [userId, userId, locationId, locationId, locationId],
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Lỗi lấy voucher theo location:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const getUserDiaries = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = getUserId(req as AuthenticatedRequest, res);
    if (!userId) return;

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT d.*, l.location_name
       FROM user_diary d
       LEFT JOIN locations l ON l.location_id = d.location_id
       WHERE d.user_id = ?
       ORDER BY d.created_at DESC`,
      [userId],
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Lỗi lấy nhật ký user:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const createUserDiary = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = getUserId(req as AuthenticatedRequest, res);
    if (!userId) return;

    const body = req.body as CreateDiaryBody;
    const mood = body.mood ?? "happy";
    const images = body.images ? JSON.stringify(body.images) : null;

    if (body.location_id) {
      // Nếu có location_name truyền lên, kiểm tra xem địa điểm này có phải tự check-in (is_user_created = 1) để cho phép đổi tên
      if (body.location_name && body.location_name.trim().length > 0) {
        const [loc] = await pool.query<RowDataPacket[]>(
          `SELECT owner_id FROM locations WHERE location_id = ?`,
          [body.location_id]
        );
        if (loc.length > 0 && Number(loc[0].owner_id) === userId) {
          await pool.query(
            `UPDATE locations SET location_name = ? WHERE location_id = ?`,
            [body.location_name.trim(), body.location_id]
          );
        }
      }

      const [existing] = await pool.query<RowDataPacket[]>(
        `SELECT diary_id FROM user_diary WHERE user_id = ? AND location_id = ?`,
        [userId, body.location_id]
      );
      if (existing.length > 0) {
        await pool.query(
          `UPDATE user_diary SET images = ?, mood = ?, notes = ?, created_at = NOW() WHERE diary_id = ?`,
          [images, mood, body.notes ?? null, existing[0].diary_id]
        );
        res.json({ success: true, message: "Cập nhật nhật ký thành công" });
        return;
      }
    }

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO user_diary (user_id, location_id, images, mood, notes)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, body.location_id ?? null, images, mood, body.notes ?? null],
    );

    res
      .status(201)
      .json({ success: true, data: { diary_id: result.insertId } });
  } catch (error) {
    console.error("Lỗi tạo nhật ký:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const deleteUserDiary = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = getUserId(req as AuthenticatedRequest, res);
    if (!userId) return;

    const diaryId = Number(req.params.id);
    if (!Number.isFinite(diaryId)) {
      res.status(400).json({ success: false, message: "ID nhật ký không hợp lệ" });
      return;
    }

    const [result] = await pool.query<ResultSetHeader>(
      `DELETE FROM user_diary WHERE diary_id = ? AND user_id = ?`,
      [diaryId, userId]
    );

    if (result.affectedRows === 0) {
      res.status(404).json({ success: false, message: "Không tìm thấy nhật ký" });
      return;
    }

    res.json({ success: true, message: "Đã xóa nhật ký" });
  } catch (error) {
    console.error("Lỗi xóa nhật ký:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};



export const reportLocationIssue = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = getUserId(req as AuthenticatedRequest, res);
    if (!userId) return;

    const body = req.body as CreateReportBody;
    const locationId = Number(body.location_id);
    if (!Number.isFinite(locationId)) {
      res.status(400).json({ success: false, message: "Thiếu địa điểm" });
      return;
    }

    const reportType =
      body.report_type &&
        ["spam", "inappropriate", "fraud", "other"].includes(body.report_type)
        ? body.report_type
        : "other";
    const severity =
      body.severity &&
        ["low", "medium", "high", "critical"].includes(body.severity)
        ? body.severity
        : "medium";
    const description = String(body.description ?? "").trim();
    if (!description) {
      res
        .status(400)
        .json({ success: false, message: "Vui lòng mô tả vấn đề" });
      return;
    }

    await pool.query<ResultSetHeader>(
      `INSERT INTO reports
       (reporter_id, reported_location_id, report_type, severity, description)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, locationId, reportType, severity, description],
    );

    res.status(201).json({ success: true, message: "Đã gửi báo cáo" });
  } catch (error) {
    console.error("Lỗi báo cáo địa điểm:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const getLeaderboard = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { province, month } = req.query;

    const now = new Date();
    let start = new Date(now.getFullYear(), now.getMonth(), 1);
    let end = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    if (typeof month === "string" && /^\d{4}-\d{2}$/.test(month)) {
      const [y, m] = month.split("-").map(Number);
      if (Number.isFinite(y) && Number.isFinite(m)) {
        start = new Date(y, m - 1, 1);
        end = new Date(y, m, 1);
      }
    }

    const params: Array<string | number> = [
      start.toISOString().slice(0, 19).replace("T", " "),
      end.toISOString().slice(0, 19).replace("T", " "),
    ];

    let provinceSql = "";
    if (typeof province === "string" && province.trim() !== "") {
      provinceSql = " AND l.province = ?";
      params.push(province.trim());
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
         u.user_id,
         u.full_name,
         u.avatar_url,
         COUNT(c.checkin_id) AS checkin_count
       FROM checkins c
       JOIN users u ON c.user_id = u.user_id
       JOIN locations l ON c.location_id = l.location_id
       WHERE c.checkin_time >= ?
         AND c.checkin_time < ?
         ${provinceSql}
       GROUP BY u.user_id
       ORDER BY checkin_count DESC
       LIMIT 50`,
      params,
    );

    res.json({
      success: true,
      data: rows,
      meta: {
        month: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`,
        province: typeof province === "string" ? province : null,
      },
    });
  } catch (error) {
    console.error("Lỗi lấy leaderboard:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const getBookingReminders = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = getUserId(req as AuthenticatedRequest, res);
    if (!userId) return;

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
         b.booking_id,
         b.check_in_date,
         b.check_out_date,
         b.status,
         b.notes,
         l.location_name,
         l.address,
         l.province,
         l.location_type
       FROM bookings b
       JOIN locations l ON b.location_id = l.location_id
       WHERE b.user_id = ?
         AND b.status IN ('pending','confirmed','cancelled','completed')
         AND b.check_in_date >= (NOW() - INTERVAL 30 DAY)
         AND b.check_in_date <= (NOW() + INTERVAL 30 DAY)
       ORDER BY b.check_in_date ASC`,
      [userId],
    );

    const result = [] as Array<Record<string, unknown>>;
    for (const row of rows) {
      const bookingId = Number(row.booking_id);
      const [sentRows] = await pool.query<RowDataPacket[]>(
        `SELECT notification_id
         FROM push_notifications
         WHERE target_user_id = ?
           AND body LIKE ?
         LIMIT 1`,
        [userId, `%[booking:${bookingId}]%`],
      );
      result.push({
        ...row,
        reminder_sent: sentRows.length > 0,
      });
    }

    res.json({ success: true, data: result });
  } catch (error) {
    console.error("Lỗi lấy booking reminders:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const getUserNotifications = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = getUserId(req as AuthenticatedRequest, res);
    if (!userId) return;

    await ensureUserNotificationReadsSchema();
    await ensureUserNotificationDismissedSchema();

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
       LEFT JOIN user_notification_reads nr
         ON nr.notification_id = pn.notification_id
        AND nr.user_id = ?
       LEFT JOIN user_notification_dismissed nd
         ON nd.notification_id = pn.notification_id
        AND nd.user_id = ?
       WHERE (
         pn.target_audience = 'all_users'
         OR (pn.target_audience = 'specific_user' AND pn.target_user_id = ?)
       )
         AND nd.notification_id IS NULL
       ORDER BY created_at DESC
       LIMIT 20`,
      [userId, userId, userId],
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Lỗi lấy thông báo user:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const markUserNotificationsReadAll = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = getUserId(req as AuthenticatedRequest, res);
    if (!userId) return;

    await ensureUserNotificationReadsSchema();
    await ensureUserNotificationDismissedSchema();

    await pool.query(
      `INSERT INTO user_notification_reads (notification_id, user_id, read_at)
       SELECT pn.notification_id, ?, NOW()
       FROM push_notifications pn
       LEFT JOIN user_notification_reads nr
         ON nr.notification_id = pn.notification_id
        AND nr.user_id = ?
       LEFT JOIN user_notification_dismissed nd
         ON nd.notification_id = pn.notification_id
        AND nd.user_id = ?
       WHERE (
         pn.target_audience = 'all_users'
         OR (pn.target_audience = 'specific_user' AND pn.target_user_id = ?)
       )
         AND nr.notification_id IS NULL
         AND nd.notification_id IS NULL`,
      [userId, userId, userId, userId],
    );

    res.json({ success: true, message: "Đã đánh dấu đã đọc" });
  } catch (error) {
    console.error("Lỗi cập nhật trạng thái thông báo:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const deleteUserNotificationsAll = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = getUserId(req as AuthenticatedRequest, res);
    if (!userId) return;

    await ensureUserNotificationReadsSchema();
    await ensureUserNotificationDismissedSchema();

    await pool.query(
      `INSERT INTO user_notification_dismissed (notification_id, user_id, dismissed_at)
       SELECT pn.notification_id, ?, NOW()
       FROM push_notifications pn
       LEFT JOIN user_notification_dismissed nd
         ON nd.notification_id = pn.notification_id
        AND nd.user_id = ?
       WHERE (
         pn.target_audience = 'all_users'
         OR (pn.target_audience = 'specific_user' AND pn.target_user_id = ?)
       )
         AND nd.notification_id IS NULL`,
      [userId, userId, userId],
    );

    await pool.query(
      `DELETE unr
       FROM user_notification_reads unr
       JOIN user_notification_dismissed und
         ON und.notification_id = unr.notification_id
        AND und.user_id = unr.user_id
       WHERE unr.user_id = ?`,
      [userId],
    );

    res.json({ success: true, message: "Đã xóa toàn bộ thông báo" });
  } catch (error) {
    console.error("Lỗi xóa toàn bộ thông báo:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const createUserLocationInvite = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = getUserId(req as AuthenticatedRequest, res);
    if (!userId) return;

    const locationId = Number(
      (req.body as { location_id?: number }).location_id,
    );
    if (!Number.isFinite(locationId)) {
      res
        .status(400)
        .json({ success: false, message: "location_id không hợp lệ" });
      return;
    }

    const [locationRows] = await pool.query<RowDataPacket[]>(
      `SELECT location_id, location_name, status
       FROM locations
       WHERE location_id = ?
       LIMIT 1`,
      [locationId],
    );
    const location = locationRows[0];
    if (!location || String(location.status || "") !== "active") {
      res
        .status(404)
        .json({ success: false, message: "Địa điểm không khả dụng" });
      return;
    }

    const [userRows] = await pool.query<RowDataPacket[]>(
      `SELECT full_name FROM users WHERE user_id = ? LIMIT 1`,
      [userId],
    );
    const inviterName = String(userRows[0]?.full_name || "Bạn").trim() || "Bạn";

    const title = "Lời mời khám phá địa điểm";
    const body = `[invite:location:${locationId}] ${inviterName} vừa gửi lại địa điểm ${String(location.location_name || "").trim()}.`;

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO push_notifications (title, body, target_audience, target_user_id, sent_by)
       VALUES (?, ?, 'specific_user', ?, ?)`,
      [title, body, userId, userId],
    );

    try {
      await messaging.send({
        topic: userTopic(userId),
        notification: {
          title,
          body: `${inviterName} vừa gửi lại địa điểm ${String(location.location_name || "").trim()}`,
        },
        data: {
          type: "location_invite",
          location_id: String(locationId),
          notification_id: String(result.insertId),
        },
      });
    } catch (error) {
      console.warn("Gửi FCM invite thất bại:", error);
    }

    res.status(201).json({
      success: true,
      message: "Đã gửi lời mời tới thiết bị của bạn",
      data: { notification_id: result.insertId },
    });
  } catch (error) {
    console.error("Lỗi tạo invite địa điểm:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

