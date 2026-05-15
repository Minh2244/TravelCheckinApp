// backend/src/controllers/adminController.ts
import { Request, Response } from "express";
import axios from "axios";
import bcrypt from "bcrypt";
import fs from "fs/promises";
import path from "path";
import { pool } from "../config/database";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { sendPushNotification } from "../services/adminService";
import crypto from "crypto";
import { sendOwnerTermsEmail } from "../utils/emailService";
import { saveUploadedImageToUploads } from "../utils/uploadImage";
import { publishToUser } from "../utils/realtime";

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

const ensureAccountBlacklistSchema = async (): Promise<void> => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS account_blacklist (
      blacklist_id BIGINT NOT NULL AUTO_INCREMENT,
      user_id INT NULL,
      email VARCHAR(255) NULL,
      phone VARCHAR(30) NULL,
      reason VARCHAR(255) NULL,
      source_report_id INT NULL,
      banned_by INT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (blacklist_id),
      UNIQUE KEY uniq_account_blacklist_email (email),
      UNIQUE KEY uniq_account_blacklist_phone (phone),
      KEY idx_account_blacklist_user (user_id),
      CONSTRAINT fk_account_blacklist_user
        FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON DELETE SET NULL,
      CONSTRAINT fk_account_blacklist_admin
        FOREIGN KEY (banned_by) REFERENCES users(user_id)
        ON DELETE SET NULL,
      CONSTRAINT fk_account_blacklist_report
        FOREIGN KEY (source_report_id) REFERENCES reports(report_id)
        ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `);
};

// ==================== DASHBOARD STATS ====================
export const getDashboardStats = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const rangeRaw = req.query.range;
    const dateRaw = req.query.date ?? req.query.revenue_date;
    const date =
      typeof dateRaw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateRaw)
        ? dateRaw
        : null;

    const allowedRanges = ["today", "week", "month", "year", "all"] as const;
    type RangePreset = (typeof allowedRanges)[number];
    const isAllowedRange = (v: unknown): v is RangePreset => {
      return (
        typeof v === "string" &&
        (allowedRanges as readonly string[]).includes(v)
      );
    };
    const range: RangePreset = isAllowedRange(rangeRaw) ? rangeRaw : "all";
    const mode: "date" | RangePreset = date ? "date" : range;

    const periodFilter = (
      column: string,
    ): { sql: string; params: unknown[] } => {
      if (mode === "date") {
        return { sql: ` AND DATE(${column}) = ?`, params: [date] };
      }
      if (mode === "today") {
        return { sql: ` AND DATE(${column}) = CURDATE()`, params: [] };
      }
      if (mode === "week") {
        return {
          sql: ` AND ${column} >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)`,
          params: [],
        };
      }
      if (mode === "month") {
        return {
          sql: ` AND ${column} >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH)`,
          params: [],
        };
      }
      if (mode === "year") {
        return {
          sql: ` AND ${column} >= DATE_SUB(CURDATE(), INTERVAL 1 YEAR)`,
          params: [],
        };
      }
      return { sql: "", params: [] };
    };

    // Tổng số User (chỉ tính tài khoản đăng ký thực sự, không tính khách đặt chỗ)
    const [userRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as count
       FROM users u
       WHERE u.role = 'user'
         AND u.deleted_at IS NULL
         AND (
           u.email IS NOT NULL
           OR u.password_hash IS NOT NULL
           OR u.google_id IS NOT NULL
           OR u.facebook_id IS NOT NULL
         )`,
    );
    const totalUsers = userRows[0]?.count || 0;

    // Tổng số Owner
    const [ownerRows] = await pool.query<RowDataPacket[]>(
      "SELECT COUNT(*) as count FROM users WHERE role = 'owner'",
    );
    const totalOwners = ownerRows[0]?.count || 0;

    // Tổng số Employee
    const [employeeRows] = await pool.query<RowDataPacket[]>(
      "SELECT COUNT(*) as count FROM users WHERE role = 'employee'",
    );
    const totalEmployees = employeeRows[0]?.count || 0;

    // Tổng số địa điểm đang hoạt động
    const [locationRows] = await pool.query<RowDataPacket[]>(
      "SELECT COUNT(*) as count FROM locations WHERE status = 'active'",
    );
    const totalLocations = locationRows[0]?.count || 0;

    // Số lịch trình được tạo
    const [itineraryRows] = await pool.query<RowDataPacket[]>(
      "SELECT COUNT(*) as count FROM itineraries",
    );
    const totalItineraries = itineraryRows[0]?.count || 0;

    // Số lượt check-in theo kỳ
    const checkinFilter = periodFilter("checkin_time");
    const [checkinRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as count
       FROM checkins
       WHERE 1=1${checkinFilter.sql}`,
      checkinFilter.params,
    );
    const todayCheckins = checkinRows[0]?.count || 0;

    // Số báo cáo vi phạm cần xử lý
    const [reportRows] = await pool.query<RowDataPacket[]>(
      "SELECT COUNT(*) as count FROM reports WHERE status = 'pending'",
    );
    const pendingReports = reportRows[0]?.count || 0;

    // Tổng doanh thu theo kỳ (payments completed)
    const paymentFilter = periodFilter("payment_time");
    const [revenueRows] = await pool.query<RowDataPacket[]>(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM payments
       WHERE status = 'completed'${paymentFilter.sql}`,
      paymentFilter.params,
    );
    const totalRevenue = Number(revenueRows[0]?.total || 0);

    // Tổng hoa hồng thu được theo kỳ (paid commissions)
    const commissionFilter = periodFilter("paid_at");
    const [commissionRows] = await pool.query<RowDataPacket[]>(
      `SELECT COALESCE(SUM(commission_amount), 0) as total
       FROM commissions
       WHERE status = 'paid'${commissionFilter.sql}`,
      commissionFilter.params,
    );
    const totalCommissions = Number(commissionRows[0]?.total || 0);

    // Tỷ lệ hoa hồng / tổng doanh thu
    const commissionRate =
      totalRevenue > 0
        ? ((totalCommissions / totalRevenue) * 100).toFixed(2)
        : "0.00";

    // Hoa hồng theo kỳ & kỳ trước để tính % tăng trưởng (dựa trên paid_at)
    let commissionGrowthQuery = "";
    let commissionGrowthParams: unknown[] = [];
    if (mode === "date") {
      commissionGrowthQuery = `SELECT
        COALESCE(SUM(CASE WHEN DATE(paid_at) = ? THEN commission_amount END), 0) as current_total,
        COALESCE(SUM(CASE WHEN DATE(paid_at) = DATE_SUB(?, INTERVAL 1 DAY) THEN commission_amount END), 0) as prev_total
       FROM commissions
       WHERE status = 'paid'`;
      commissionGrowthParams = [date, date];
    } else if (mode === "today") {
      commissionGrowthQuery = `SELECT
        COALESCE(SUM(CASE WHEN DATE(paid_at) = CURDATE() THEN commission_amount END), 0) as current_total,
        COALESCE(SUM(CASE WHEN DATE(paid_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY) THEN commission_amount END), 0) as prev_total
       FROM commissions
       WHERE status = 'paid'`;
    } else if (mode === "week") {
      commissionGrowthQuery = `SELECT
        COALESCE(SUM(CASE WHEN paid_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) THEN commission_amount END), 0) as current_total,
        COALESCE(SUM(CASE WHEN paid_at >= DATE_SUB(CURDATE(), INTERVAL 13 DAY) AND paid_at < DATE_SUB(CURDATE(), INTERVAL 6 DAY) THEN commission_amount END), 0) as prev_total
       FROM commissions
       WHERE status = 'paid'`;
    } else if (mode === "month") {
      commissionGrowthQuery = `SELECT
        COALESCE(SUM(CASE WHEN paid_at >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) THEN commission_amount END), 0) as current_total,
        COALESCE(SUM(CASE WHEN paid_at >= DATE_SUB(CURDATE(), INTERVAL 2 MONTH) AND paid_at < DATE_SUB(CURDATE(), INTERVAL 1 MONTH) THEN commission_amount END), 0) as prev_total
       FROM commissions
       WHERE status = 'paid'`;
    } else if (mode === "year") {
      commissionGrowthQuery = `SELECT
        COALESCE(SUM(CASE WHEN paid_at >= DATE_SUB(CURDATE(), INTERVAL 1 YEAR) THEN commission_amount END), 0) as current_total,
        COALESCE(SUM(CASE WHEN paid_at >= DATE_SUB(CURDATE(), INTERVAL 2 YEAR) AND paid_at < DATE_SUB(CURDATE(), INTERVAL 1 YEAR) THEN commission_amount END), 0) as prev_total
       FROM commissions
       WHERE status = 'paid'`;
    }

    let currentPeriodCommission = totalCommissions;
    let prevPeriodCommission = 0;
    if (commissionGrowthQuery) {
      const [growthRows] = await pool.query<RowDataPacket[]>(
        commissionGrowthQuery,
        commissionGrowthParams,
      );
      currentPeriodCommission = Number(growthRows[0]?.current_total || 0);
      prevPeriodCommission = Number(growthRows[0]?.prev_total || 0);
    }

    const monthCommissionGrowth =
      prevPeriodCommission > 0
        ? (
            ((currentPeriodCommission - prevPeriodCommission) /
              prevPeriodCommission) *
            100
          ).toFixed(2)
        : "0.00";

    // Số user mới theo kỳ (chỉ tính tài khoản đăng ký thực sự)
    const userCreatedFilter = periodFilter("created_at");
    const [newUsersTodayRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as count
       FROM users u
       WHERE u.role = 'user'
         AND u.deleted_at IS NULL
         AND (
           u.email IS NOT NULL
           OR u.password_hash IS NOT NULL
           OR u.google_id IS NOT NULL
           OR u.facebook_id IS NOT NULL
         )${userCreatedFilter.sql}`,
      userCreatedFilter.params,
    );
    const newUsersToday = newUsersTodayRows[0]?.count || 0;

    // Thống kê trạng thái địa điểm
    const [locationStatusRows] = await pool.query<RowDataPacket[]>(
      `SELECT status, COUNT(*) as count
       FROM locations
       GROUP BY status`,
    );
    let activeLocations = 0;
    let inactiveLocations = 0;
    let pendingLocationsCount = 0;
    locationStatusRows.forEach((row) => {
      if (row.status === "active") activeLocations = row.count;
      if (row.status === "inactive") inactiveLocations = row.count;
      if (row.status === "pending") pendingLocationsCount = row.count;
    });

    // Số lượt bình luận tổng
    const [reviewRows] = await pool.query<RowDataPacket[]>(
      "SELECT COUNT(*) as count FROM reviews WHERE status = 'active'",
    );
    const totalReviews = reviewRows[0]?.count || 0;

    // Thống kê theo khu vực (từ locations)
    const [regionRows] = await pool.query<RowDataPacket[]>(
      `SELECT 
        CASE 
          WHEN latitude >= 23.0 THEN 'Miền Bắc'
          WHEN latitude >= 16.0 THEN 'Miền Trung'
          ELSE 'Miền Nam'
        END as region,
        COUNT(*) as count
       FROM locations 
       WHERE status = 'active' AND latitude IS NOT NULL
       GROUP BY region`,
    );

    // Vì sao: cần thống kê theo tỉnh để Admin nắm vùng tập trung hoạt động
    const [provinceRows] = await pool.query<RowDataPacket[]>(
      `SELECT COALESCE(province, 'Khác') as province, COUNT(*) as count
       FROM locations
       GROUP BY COALESCE(province, 'Khác')
       ORDER BY count DESC`,
    );

    // Danh sách rút gọn địa điểm đang chờ duyệt
    const [pendingLocationRows] = await pool.query<RowDataPacket[]>(
      `SELECT 
         l.location_id,
         l.location_name,
         l.location_type,
         l.address,
         l.created_at,
         l.latitude,
         l.longitude,
         l.first_image,
         u.user_id as owner_id,
         u.full_name as owner_name,
         u.email as owner_email
       FROM locations l
       JOIN users u ON l.owner_id = u.user_id
       WHERE l.status = 'pending'
       ORDER BY l.created_at DESC
       LIMIT 5`,
    );

    // Danh sách rút gọn commission quá hạn
    const [overdueCommissionRows] = await pool.query<RowDataPacket[]>(
      `SELECT 
         c.commission_id,
         c.owner_id,
         c.total_due,
         c.due_date,
         c.status,
         u.full_name as owner_name,
         u.email as owner_email
       FROM commissions c
       JOIN users u ON c.owner_id = u.user_id
       WHERE c.status = 'overdue'
       ORDER BY c.due_date ASC
       LIMIT 5`,
    );

    // Biểu đồ: doanh thu 6 tháng gần nhất
    const [revenueTrendRows] = await pool.query<RowDataPacket[]>(
      `SELECT 
         DATE_FORMAT(payment_time, '%Y-%m') as month,
         SUM(amount) as total
       FROM payments
       WHERE status = 'completed'
         AND payment_time >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
       GROUP BY DATE_FORMAT(payment_time, '%Y-%m')
       ORDER BY month ASC`,
    );

    // Biểu đồ: cơ cấu loại hình dịch vụ
    const [serviceTypeRows] = await pool.query<RowDataPacket[]>(
      `SELECT 
         service_type,
         COUNT(*) as count
       FROM services
       GROUP BY service_type`,
    );

    // search_history/location_views đã được loại bỏ trong DB rút gọn
    const searchCountRows = [{ total: 0, today: 0 }];
    const viewCountRows = [{ total: 0, today: 0 }];

    // Vì sao: biểu đồ theo ngày/tháng/năm để theo dõi xu hướng check-in
    const [dailyCheckinRows] = await pool.query<RowDataPacket[]>(
      `SELECT DATE(checkin_time) as label, COUNT(*) as total
       FROM checkins
       WHERE checkin_time >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)
       GROUP BY DATE(checkin_time)
       ORDER BY label ASC`,
    );
    const [monthlyCheckinRows] = await pool.query<RowDataPacket[]>(
      `SELECT DATE_FORMAT(checkin_time, '%Y-%m') as label, COUNT(*) as total
       FROM checkins
       WHERE checkin_time >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
       GROUP BY DATE_FORMAT(checkin_time, '%Y-%m')
       ORDER BY label ASC`,
    );
    const [yearlyCheckinRows] = await pool.query<RowDataPacket[]>(
      `SELECT YEAR(checkin_time) as label, COUNT(*) as total
       FROM checkins
       GROUP BY YEAR(checkin_time)
       ORDER BY label ASC`,
    );

    // Vì sao: Top user/owner hoạt động để Admin ưu tiên chăm sóc/kiểm soát
    const checkinJoinFilter = periodFilter("c.checkin_time");
    const paymentJoinFilterForUsers = periodFilter("p.payment_time");
    const paymentJoinFilterForOwners = periodFilter("p.payment_time");
    const topUserParams = [
      ...checkinJoinFilter.params,
      ...paymentJoinFilterForUsers.params,
    ];
    const topOwnerParams = [...paymentJoinFilterForOwners.params];

    const [topUsersRows] = await pool.query<RowDataPacket[]>(
      `SELECT
         u.user_id,
         u.full_name,
         u.email,
         COUNT(c.checkin_id) as total_checkins,
         COALESCE(SUM(p.amount), 0) as total_spent
       FROM users u
       LEFT JOIN checkins c ON c.user_id = u.user_id${checkinJoinFilter.sql}
       LEFT JOIN payments p ON p.user_id = u.user_id AND p.status = 'completed'${paymentJoinFilterForUsers.sql}
       WHERE u.role = 'user'
         AND u.deleted_at IS NULL
         AND (
           u.email IS NOT NULL
           OR u.password_hash IS NOT NULL
           OR u.google_id IS NOT NULL
           OR u.facebook_id IS NOT NULL
         )
       GROUP BY u.user_id
       ORDER BY total_checkins DESC, total_spent DESC
       LIMIT 5`,
      topUserParams,
    );
    const [topOwnersRows] = await pool.query<RowDataPacket[]>(
      `SELECT
         u.user_id,
         u.full_name,
         u.email,
         COUNT(l.location_id) as total_locations,
         COALESCE(SUM(p.amount), 0) as total_revenue
       FROM users u
       LEFT JOIN locations l ON l.owner_id = u.user_id
       LEFT JOIN payments p ON p.location_id = l.location_id AND p.status = 'completed'${paymentJoinFilterForOwners.sql}
       WHERE u.role = 'owner' AND u.deleted_at IS NULL
       GROUP BY u.user_id
       ORDER BY total_revenue DESC, total_locations DESC
       LIMIT 5`,
      topOwnerParams,
    );

    res.json({
      success: true,
      data: {
        totalUsers,
        totalOwners,
        totalEmployees,
        totalLocations: activeLocations,
        totalItineraries,
        todayCheckins,
        pendingReports,
        totalRevenue,
        totalCommissions,
        commissionRate,
        totalReviews,
        regions: regionRows,
        provinces: provinceRows,
        searches: {
          total: Number(searchCountRows[0]?.total || 0),
          today: Number(searchCountRows[0]?.today || 0),
        },
        visits: {
          total: Number(viewCountRows[0]?.total || 0),
          today: Number(viewCountRows[0]?.today || 0),
        },
        kpis: {
          monthCommission: currentPeriodCommission,
          monthCommissionGrowth,
          newUsersToday,
          activeLocations,
          inactiveLocations,
          pendingLocations: pendingLocationsCount,
        },
        actionable: {
          pendingLocations: pendingLocationRows,
          overdueCommissions: overdueCommissionRows,
        },
        charts: {
          revenueTrend: revenueTrendRows,
          serviceTypeDistribution: serviceTypeRows,
          checkinTrends: {
            daily: dailyCheckinRows,
            monthly: monthlyCheckinRows,
            yearly: yearlyCheckinRows,
          },
        },
        top: {
          users: topUsersRows,
          owners: topOwnersRows,
        },
      },
    });
  } catch (error: unknown) {
    console.error("Lỗi lấy thống kê dashboard:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy thống kê",
    });
  }
};

// ==================== ADMIN PROFILE ====================
export const getAdminProfile = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const adminId = req.userId;

    if (!adminId) {
      res.status(401).json({ success: false, message: "Chưa xác thực" });
      return;
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT u.user_id, u.email, u.phone, u.full_name, u.avatar_url, u.avatar_path, u.avatar_source, u.role, u.status, u.created_at, u.updated_at,
              (u.password_hash IS NOT NULL) AS has_password
       FROM users u
       WHERE u.user_id = ? AND u.role = 'admin'
       LIMIT 1`,
      [adminId],
    );

    if (!rows[0]) {
      res.status(404).json({
        success: false,
        message: "Không tìm thấy tài khoản admin",
      });
      return;
    }

    const row = rows[0] as {
      user_id: number;
      email: string | null;
      phone: string | null;
      full_name: string;
      avatar_url: string | null;
      avatar_path: string | null;
      avatar_source: "upload" | "url" | null;
      role: string;
      status: string;
      created_at: string;
      updated_at: string;
      has_password?: 0 | 1 | boolean | null;
    };

    // Compute effective avatar URL based on source
    let effectiveAvatarUrl: string | null = null;
    if (row.avatar_source === "upload" && row.avatar_path) {
      effectiveAvatarUrl = row.avatar_path;
    } else if (row.avatar_url) {
      effectiveAvatarUrl = row.avatar_url;
    }

    const hasAvatarUrl =
      typeof effectiveAvatarUrl === "string" &&
      effectiveAvatarUrl.trim().length > 0;

    res.json({
      success: true,
      data: {
        user_id: row.user_id,
        email: row.email,
        phone: row.phone,
        full_name: row.full_name,
        avatar_url: effectiveAvatarUrl,
        avatar_source: row.avatar_source || "url",
        has_avatar_blob: false,
        has_avatar_url: hasAvatarUrl,
        has_password: Boolean(row.has_password),
        role: row.role,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
      },
    });
  } catch (error: unknown) {
    console.error("Lỗi lấy profile admin:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy thông tin admin",
    });
  }
};

export const updateAdminProfile = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const adminId = req.userId;
    if (!adminId) {
      res.status(401).json({ success: false, message: "Chưa xác thực" });
      return;
    }
    const { full_name, phone, avatar_url, skip_avatar } = req.body as {
      full_name?: string;
      phone?: string | null;
      avatar_url?: string | null;
      skip_avatar?: boolean; // If true, don't touch avatar at all
    };

    const normalizedFullName = normalizePersonName(full_name);
    if (!normalizedFullName) {
      res.status(400).json({
        success: false,
        message: "Vui lòng nhập họ tên",
      });
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

    // If skip_avatar is true, only update name and phone
    if (skip_avatar) {
      await pool.query(
        `UPDATE users SET full_name = ?, phone = ? WHERE user_id = ? AND role = 'admin'`,
        [normalizedFullName, normalizedPhone, adminId],
      );

      await pool.query(
        `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
        [
          adminId,
          "UPDATE_ADMIN_PROFILE",
          JSON.stringify({
            full_name: normalizedFullName,
            phone: normalizedPhone,
            skip_avatar: true,
            timestamp: new Date(),
          }),
        ],
      );

      res.json({
        success: true,
        message: "Cập nhật thông tin admin thành công",
      });
      return;
    }

    const normalizedAvatarUrl =
      typeof avatar_url === "string" ? avatar_url.trim() : null;
    if (typeof normalizedAvatarUrl === "string" && normalizedAvatarUrl.length) {
      const lower = normalizedAvatarUrl.toLowerCase();

      if (lower.startsWith("data:")) {
        res.status(400).json({
          success: false,
          message:
            "Avatar URL không hợp lệ. Vui lòng dùng URL http/https hoặc upload ảnh (không hỗ trợ data URL).",
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

    // Handle avatar based on source
    // If avatar_url is provided (URL), set avatar_source='url' and clear avatar_path
    // If avatar_url is null/empty, check if we should clear avatar entirely
    if (normalizedAvatarUrl && normalizedAvatarUrl.length) {
      // Check if it's a local upload path (starts with /uploads/)
      const isLocalUpload = normalizedAvatarUrl.startsWith("/uploads/");
      if (isLocalUpload) {
        // This is a path from upload, set as upload source
        await pool.query(
          `UPDATE users
           SET full_name = ?, phone = ?, avatar_path = ?, avatar_source = 'upload', avatar_url = NULL
           WHERE user_id = ? AND role = 'admin'`,
          [normalizedFullName, normalizedPhone, normalizedAvatarUrl, adminId],
        );
      } else {
        // This is an external URL, set as url source
        await pool.query(
          `UPDATE users
           SET full_name = ?, phone = ?, avatar_url = ?, avatar_source = 'url', avatar_path = NULL
           WHERE user_id = ? AND role = 'admin'`,
          [normalizedFullName, normalizedPhone, normalizedAvatarUrl, adminId],
        );
      }
    } else {
      // Clear avatar entirely
      await pool.query(
        `UPDATE users
         SET full_name = ?, phone = ?, avatar_url = NULL, avatar_path = NULL, avatar_source = 'url'
         WHERE user_id = ? AND role = 'admin'`,
        [normalizedFullName, normalizedPhone, adminId],
      );
    }

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
      [
        adminId,
        "UPDATE_ADMIN_PROFILE",
        JSON.stringify({
          full_name: normalizedFullName,
          phone: normalizedPhone,
          avatar_url:
            normalizedAvatarUrl && normalizedAvatarUrl.length
              ? normalizedAvatarUrl
              : null,
          timestamp: new Date(),
        }),
      ],
    );

    res.json({
      success: true,
      message: "Cập nhật thông tin admin thành công",
    });
  } catch (error: unknown) {
    console.error("Lỗi cập nhật profile admin:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi cập nhật thông tin admin",
    });
  }
};

export const uploadAdminAvatar = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const adminId = req.userId;
    if (!adminId) {
      res.status(401).json({ success: false, message: "Chưa xác thực" });
      return;
    }

    const file = (req as unknown as { file?: Express.Multer.File }).file;
    if (!file) {
      res.status(400).json({ success: false, message: "Vui lòng chọn ảnh" });
      return;
    }

    const avatarPath = (
      await saveUploadedImageToUploads({
        file,
        folder: "avatars",
        fileNamePrefix: `avatar-${adminId}`,
      })
    ).urlPath;
    // Update both avatar_path and avatar_source='upload', clear avatar_url
    await pool.query(
      `UPDATE users SET avatar_path = ?, avatar_source = 'upload', avatar_url = NULL, updated_at = NOW() WHERE user_id = ? AND role = 'admin'`,
      [avatarPath, adminId],
    );

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
      [
        adminId,
        "UPLOAD_ADMIN_AVATAR",
        JSON.stringify({
          mimetype: file.mimetype,
          size: file.size,
          avatar_path: avatarPath,
          timestamp: new Date(),
        }),
      ],
    );

    res.json({
      success: true,
      message: "Đã cập nhật ảnh đại diện",
      data: { avatar_url: avatarPath },
    });
  } catch (error: unknown) {
    console.error("Lỗi upload avatar admin:", error);
    const err = error as { message?: string };
    res.status(500).json({
      success: false,
      message:
        err?.message ||
        "Không thể lưu ảnh đại diện. Vui lòng thử ảnh nhỏ hơn hoặc đổi định dạng.",
    });
  }
};

export const changeAdminPassword = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const adminId = req.userId;
    if (!adminId) {
      res.status(401).json({ success: false, message: "Chưa xác thực" });
      return;
    }
    const { current_password, new_password } = req.body as {
      current_password?: string;
      new_password?: string;
    };

    if (
      !new_password ||
      typeof new_password !== "string" ||
      new_password.length < 6
    ) {
      res.status(400).json({
        success: false,
        message: "Mật khẩu mới phải có ít nhất 6 ký tự",
      });
      return;
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT password_hash FROM users WHERE user_id = ? AND role = 'admin' LIMIT 1`,
      [adminId],
    );

    if (!rows[0]) {
      res.status(404).json({
        success: false,
        message: "Không tìm thấy tài khoản admin",
      });
      return;
    }

    const passwordHash = rows[0].password_hash as string | null;
    if (!passwordHash) {
      res.status(400).json({
        success: false,
        message:
          "Tài khoản chưa có mật khẩu, vui lòng dùng đăng nhập OAuth hoặc đặt lại mật khẩu",
      });
      return;
    }

    if (!current_password || typeof current_password !== "string") {
      res.status(400).json({
        success: false,
        message: "Vui lòng nhập mật khẩu hiện tại",
      });
      return;
    }

    const ok = await bcrypt.compare(current_password, passwordHash);
    if (!ok) {
      res.status(400).json({
        success: false,
        message: "Mật khẩu hiện tại không đúng",
      });
      return;
    }

    const newHash = await bcrypt.hash(new_password, 10);
    await pool.query(
      `UPDATE users SET password_hash = ? WHERE user_id = ? AND role = 'admin'`,
      [newHash, adminId],
    );

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
      [
        adminId,
        "CHANGE_ADMIN_PASSWORD",
        JSON.stringify({ timestamp: new Date() }),
      ],
    );

    res.json({
      success: true,
      message: "Đổi mật khẩu thành công",
    });
  } catch (error: unknown) {
    console.error("Lỗi đổi mật khẩu admin:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi đổi mật khẩu",
    });
  }
};

export const getAdminLoginHistory = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const adminId = req.userId;
    if (!adminId) {
      res.status(401).json({ success: false, message: "Chưa xác thực" });
      return;
    }

    const { page = "1", limit = "20" } = req.query;
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT login_id, user_id, email, role, success, ip_address, user_agent, device_info, created_at
       FROM login_history
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [adminId, limitNum, offset],
    );

    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM login_history WHERE user_id = ?`,
      [adminId],
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
  } catch (error: unknown) {
    console.error("Lỗi lấy lịch sử đăng nhập admin:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy lịch sử đăng nhập",
    });
  }
};

export const getUserLoginHistory = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = Number(req.params.id);
    if (!Number.isFinite(userId)) {
      res.status(400).json({ success: false, message: "User ID không hợp lệ" });
      return;
    }

    const { page = "1", limit = "20" } = req.query;
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT login_id, user_id, email, role, success, ip_address, user_agent, device_info, created_at
       FROM login_history
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [userId, limitNum, offset],
    );

    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM login_history WHERE user_id = ?`,
      [userId],
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
  } catch (error: unknown) {
    console.error("Lỗi lấy lịch sử đăng nhập user:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy lịch sử đăng nhập",
    });
  }
};

export const getUserSearchHistory = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = Number(req.params.id);
    if (!Number.isFinite(userId)) {
      res.status(400).json({ success: false, message: "User ID không hợp lệ" });
      return;
    }

    const { page = "1", limit = "20", from, to } = req.query;
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
    // search_history đã bị loại bỏ trong DB rút gọn
    void from;
    void to;
    void userId;

    res.json({
      success: true,
      data: [],
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: 0,
      },
    });
  } catch (error: unknown) {
    console.error("Lỗi lấy lịch sử tìm kiếm:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy lịch sử tìm kiếm",
    });
  }
};

export const getUserTravelHistory = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = Number(req.params.id);
    if (!Number.isFinite(userId)) {
      res.status(400).json({ success: false, message: "User ID không hợp lệ" });
      return;
    }

    const { page = "1", limit = "20" } = req.query;
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
         c.checkin_id,
         c.checkin_time,
         c.status,
         l.location_id,
         l.location_name,
         l.address,
         l.province,
         l.location_type
       FROM checkins c
       JOIN locations l ON c.location_id = l.location_id
       WHERE c.user_id = ?
       ORDER BY c.checkin_time DESC
       LIMIT ? OFFSET ?`,
      [userId, limitNum, offset],
    );

    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM checkins WHERE user_id = ?`,
      [userId],
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
  } catch (error: unknown) {
    console.error("Lỗi lấy lịch sử nơi đã đi:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy lịch sử nơi đã đi",
    });
  }
};

export const getUserReviewHistory = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = Number(req.params.id);
    if (!Number.isFinite(userId)) {
      res.status(400).json({ success: false, message: "User ID không hợp lệ" });
      return;
    }

    const { page = "1", limit = "20" } = req.query;
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
         r.review_id,
         r.rating,
         r.comment,
         r.status,
         r.created_at,
         r.updated_at,
         r.deleted_at,
         l.location_id,
         l.location_name
       FROM reviews r
       JOIN locations l ON r.location_id = l.location_id
       WHERE r.user_id = ?
       ORDER BY r.created_at DESC
       LIMIT ? OFFSET ?`,
      [userId, limitNum, offset],
    );

    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM reviews WHERE user_id = ?`,
      [userId],
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
  } catch (error: unknown) {
    console.error("Lỗi lấy lịch sử đánh giá:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy lịch sử đánh giá",
    });
  }
};

export const getUserFavoriteLocations = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = Number(req.params.id);
    if (!Number.isFinite(userId)) {
      res.status(400).json({ success: false, message: "User ID không hợp lệ" });
      return;
    }

    const { page = "1", limit = "20" } = req.query;
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
         l.location_id,
         l.location_name,
         l.address,
         l.province,
         l.location_type,
         l.first_image
       FROM favorite_locations fl
       JOIN locations l ON fl.location_id = l.location_id
       WHERE fl.user_id = ?
       ORDER BY fl.id DESC
       LIMIT ? OFFSET ?`,
      [userId, limitNum, offset],
    );

    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM favorite_locations WHERE user_id = ?`,
      [userId],
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
  } catch (error: unknown) {
    console.error("Lỗi lấy danh sách yêu thích:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy danh sách yêu thích",
    });
  }
};

export const getOwnerEmployees = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const ownerId = Number(req.params.id);
    if (!Number.isFinite(ownerId)) {
      res
        .status(400)
        .json({ success: false, message: "Owner ID không hợp lệ" });
      return;
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
         u.user_id,
         u.full_name,
         u.phone,
         u.role,
         l.location_id,
         l.location_name,
         el.position,
         el.status as assignment_status
       FROM employee_locations el
       JOIN users u ON el.employee_id = u.user_id
       JOIN locations l ON l.location_id = el.location_id
       WHERE el.owner_id = ?
       ORDER BY u.full_name ASC, l.location_name ASC`,
      [ownerId],
    );

    res.json({ success: true, data: rows });
  } catch (error: unknown) {
    console.error("Lỗi lấy danh sách employee:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy danh sách employee",
    });
  }
};

export const getOwnerViolations = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const ownerId = Number(req.params.id);
    if (!Number.isFinite(ownerId)) {
      res
        .status(400)
        .json({ success: false, message: "Owner ID không hợp lệ" });
      return;
    }

    const { page = "1", limit = "20" } = req.query;
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT violation_id, title, description, severity, created_by, created_at
       FROM owner_violations
       WHERE owner_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [ownerId, limitNum, offset],
    );

    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM owner_violations WHERE owner_id = ?`,
      [ownerId],
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
  } catch (error: unknown) {
    console.error("Lỗi lấy lịch sử vi phạm owner:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy lịch sử vi phạm",
    });
  }
};

export const createOwnerViolation = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const ownerId = Number(req.params.id);
    const adminId = req.userId;
    const { title, description, severity } = req.body as {
      title?: string;
      description?: string | null;
      severity?: "low" | "medium" | "high" | "critical";
    };

    if (!Number.isFinite(ownerId)) {
      res
        .status(400)
        .json({ success: false, message: "Owner ID không hợp lệ" });
      return;
    }
    if (!adminId) {
      res.status(401).json({ success: false, message: "Chưa xác thực" });
      return;
    }
    if (!title || title.trim().length < 3) {
      res.status(400).json({ success: false, message: "Tiêu đề không hợp lệ" });
      return;
    }

    await pool.query(
      `INSERT INTO owner_violations (owner_id, title, description, severity, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      [
        ownerId,
        title.trim(),
        description ?? null,
        severity || "medium",
        adminId,
      ],
    );

    res.json({ success: true, message: "Đã ghi nhận vi phạm" });
  } catch (error: unknown) {
    console.error("Lỗi tạo vi phạm owner:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi tạo vi phạm",
    });
  }
};

export const sendOwnerTermsEmailToOwner = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const ownerId = Number(req.params.id);
    if (!Number.isFinite(ownerId)) {
      res
        .status(400)
        .json({ success: false, message: "Owner ID không hợp lệ" });
      return;
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT user_id, email, full_name FROM users WHERE user_id = ? AND role = 'owner'`,
      [ownerId],
    );
    if (!rows[0]) {
      res.status(404).json({ success: false, message: "Không tìm thấy owner" });
      return;
    }

    const token = crypto.randomBytes(24).toString("hex");
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await pool.query(
      `UPDATE owner_profiles
       SET terms_token = ?, terms_token_expires = ?
       WHERE owner_id = ?`,
      [token, expires, ownerId],
    );

    const baseUrl =
      process.env.WEB_URL ||
      process.env.FRONTEND_URL ||
      "http://localhost:5173";
    const confirmUrl = `${baseUrl.replace(
      /\/$/,
      "",
    )}/auth/owner-terms/confirm?token=${token}`;

    await sendOwnerTermsEmail(rows[0].email, rows[0].full_name, confirmUrl);

    res.json({ success: true, message: "Đã gửi email điều khoản" });
  } catch (error: unknown) {
    console.error("Lỗi gửi email điều khoản:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const markOwnerTermsAccepted = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const ownerId = Number(req.params.id);
    if (!Number.isFinite(ownerId)) {
      res
        .status(400)
        .json({ success: false, message: "Owner ID không hợp lệ" });
      return;
    }

    const { ip, user_agent } = req.body as {
      ip?: string;
      user_agent?: string;
    };

    await pool.query(
      `UPDATE owner_profiles
       SET terms_accepted_at = NOW(),
           terms_accepted_ip = ?,
           terms_accepted_user_agent = ?,
           terms_token = NULL,
           terms_token_expires = NULL
       WHERE owner_id = ?`,
      [ip ?? null, user_agent ?? null, ownerId],
    );

    res.json({ success: true, message: "Đã ghi nhận xác nhận điều khoản" });
  } catch (error: unknown) {
    console.error("Lỗi ghi nhận điều khoản:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const getAiSettings = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT setting_key, setting_value FROM system_settings
       WHERE setting_key IN ('ai_enabled','ai_maintenance','ai_maintenance_note','ai_fallback_enabled')`,
    );

    const settings: Record<string, string | null> = {
      ai_enabled: null,
      ai_maintenance: null,
      ai_maintenance_note: null,
      ai_fallback_enabled: null,
    };

    rows.forEach((row) => {
      settings[String(row.setting_key)] = row.setting_value as string | null;
    });

    res.json({ success: true, data: settings });
  } catch (error: unknown) {
    console.error("Lỗi lấy cấu hình AI:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const updateAiSettings = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const adminId = req.userId;
    if (!adminId) {
      res.status(401).json({ success: false, message: "Chưa xác thực" });
      return;
    }

    const body = req.body as Record<string, string | number | boolean | null>;
    const allowedKeys = [
      "ai_enabled",
      "ai_maintenance",
      "ai_maintenance_note",
      "ai_fallback_enabled",
    ];

    const updates = Object.entries(body).filter(([key]) =>
      allowedKeys.includes(key),
    );

    for (const [key, value] of updates) {
      await pool.query(
        `INSERT INTO system_settings (setting_key, setting_value)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [key, value === null ? null : String(value)],
      );
    }

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
      [
        adminId,
        "ADMIN_UPDATE_AI_SETTINGS",
        JSON.stringify({
          updatedKeys: updates.map(([k]) => k),
          timestamp: new Date(),
        }),
      ],
    );

    res.json({ success: true, message: "Đã cập nhật cấu hình AI" });
  } catch (error: unknown) {
    console.error("Lỗi cập nhật cấu hình AI:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const getAiLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = "1", limit = "20" } = req.query;
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
    res.json({
      success: true,
      data: [],
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: 0,
      },
    });
  } catch (error: unknown) {
    console.error("Lỗi lấy AI logs:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const getAiChatHistory = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { page = "1", limit = "20", user_id } = req.query;
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

    const params: Array<string | number> = [];
    let where = "WHERE 1=1";
    if (typeof user_id === "string" && user_id.trim() !== "") {
      where += " AND user_id = ?";
      params.push(Number(user_id));
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT history_id, user_id, prompt as message, response, created_at
       FROM ai_chat_history
       ${where}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limitNum, offset],
    );

    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM ai_chat_history ${where}`,
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
  } catch (error: unknown) {
    console.error("Lỗi lấy lịch sử AI chat:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const getBackgroundSchedules = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    // Auto-expire schedules: when end_date passed, force is_active=0
    // This keeps UI status correct without needing schema changes.
    await pool.query(
      `UPDATE background_schedules
       SET is_active = 0, updated_at = NOW()
       WHERE is_active = 1 AND end_date <= NOW()`,
    );

    const { page = "1", limit = "20" } = req.query;
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT schedule_id, title, image_url, start_date, end_date, is_active, created_by, created_at, updated_at
       FROM background_schedules
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [limitNum, offset],
    );

    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM background_schedules`,
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
  } catch (error: unknown) {
    console.error("Lỗi lấy danh sách background:", error);
    const err = error as { code?: string };
    if (err?.code === "ER_NO_SUCH_TABLE") {
      res.json({
        success: true,
        data: [],
        pagination: { page: 1, limit: 20, total: 0 },
      });
      return;
    }
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const createBackgroundSchedule = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const adminId = req.userId;
    if (!adminId) {
      res.status(401).json({ success: false, message: "Chưa xác thực" });
      return;
    }

    const {
      title,
      image_url,
      start_date,
      end_date,
      is_active,
      applied_to_setting,
    } = req.body as {
      title?: string;
      image_url?: string;
      start_date?: string;
      end_date?: string;
      is_active?: boolean;
      applied_to_setting?: string;
    };

    const toMysqlDateTime = (value?: string): string | null => {
      if (!value || typeof value !== "string") return null;
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return null;
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    };

    const startDate = toMysqlDateTime(start_date);
    const endDate = toMysqlDateTime(end_date);

    if (!title || !image_url || !startDate || !endDate) {
      res.status(400).json({ success: false, message: "Thiếu dữ liệu" });
      return;
    }

    const normalizedImageUrl = image_url.trim();
    const imagePath = normalizedImageUrl.startsWith("/uploads/")
      ? normalizedImageUrl
      : null;

    const normalizedAppliedRaw = applied_to_setting
      ? applied_to_setting.trim()
      : "";
    const normalizedApplied =
      normalizedAppliedRaw === "app"
        ? "app_background"
        : normalizedAppliedRaw === "login"
          ? "login_background"
          : normalizedAppliedRaw;
    const appliedValue =
      normalizedApplied === "app_background" ||
      normalizedApplied === "login_background"
        ? normalizedApplied
        : "login_background";

    await pool.query(
      `INSERT INTO background_schedules (title, image_url, image_path, applied_to_setting, start_date, end_date, is_active, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title.trim(),
        normalizedImageUrl,
        imagePath,
        appliedValue,
        startDate,
        endDate,
        is_active ? 1 : 0,
        adminId,
      ],
    );

    res.json({ success: true, message: "Đã tạo lịch nền" });
  } catch (error: unknown) {
    console.error("Lỗi tạo lịch nền:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const updateBackgroundSchedule = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const scheduleId = Number(req.params.id);
    if (!Number.isFinite(scheduleId)) {
      res.status(400).json({ success: false, message: "ID không hợp lệ" });
      return;
    }

    const {
      title,
      image_url,
      start_date,
      end_date,
      is_active,
      applied_to_setting,
    } = req.body as {
      title?: string;
      image_url?: string;
      start_date?: string;
      end_date?: string;
      is_active?: boolean;
      applied_to_setting?: string;
    };

    const toMysqlDateTime = (value?: string): string | null => {
      if (!value || typeof value !== "string") return null;
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return null;
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    };

    const startDate = start_date ? toMysqlDateTime(start_date) : null;
    const endDate = end_date ? toMysqlDateTime(end_date) : null;

    const normalizedImageUrl = image_url ? image_url.trim() : null;
    const imagePath =
      normalizedImageUrl && normalizedImageUrl.startsWith("/uploads/")
        ? normalizedImageUrl
        : null;

    const normalizedAppliedRaw = applied_to_setting
      ? applied_to_setting.trim()
      : "";
    const normalizedApplied =
      normalizedAppliedRaw === "app"
        ? "app_background"
        : normalizedAppliedRaw === "login"
          ? "login_background"
          : normalizedAppliedRaw;
    const appliedValue =
      normalizedApplied === "app_background" ||
      normalizedApplied === "login_background"
        ? normalizedApplied
        : null;

    await pool.query(
      `UPDATE background_schedules
       SET title = COALESCE(?, title),
           image_url = COALESCE(?, image_url),
           image_path = COALESCE(?, image_path),
           applied_to_setting = COALESCE(?, applied_to_setting),
           start_date = COALESCE(?, start_date),
           end_date = COALESCE(?, end_date),
           is_active = COALESCE(?, is_active)
       WHERE schedule_id = ?`,
      [
        title ?? null,
        normalizedImageUrl ?? null,
        imagePath ?? null,
        appliedValue ?? null,
        startDate ?? null,
        endDate ?? null,
        typeof is_active === "boolean" ? (is_active ? 1 : 0) : null,
        scheduleId,
      ],
    );

    res.json({ success: true, message: "Đã cập nhật lịch nền" });
  } catch (error: unknown) {
    console.error("Lỗi cập nhật lịch nền:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const getBackgroundHistory = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const type = String(req.query.type || "app");
    if (!"app,login".includes(type)) {
      res.status(400).json({ success: false, message: "type không hợp lệ" });
      return;
    }
    // background_image_history đã bị loại bỏ trong DB rút gọn
    res.json({ success: true, data: [] });
  } catch (error: unknown) {
    console.error("Lỗi lấy lịch sử nền:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const uploadBackgroundImage = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const adminId = req.userId;
    if (!adminId) {
      res.status(401).json({ success: false, message: "Chưa xác thực" });
      return;
    }

    const body = req.body as { type?: string; apply?: string | boolean };
    const type = String(body.type || "app");
    if (!"app,login".includes(type)) {
      res.status(400).json({ success: false, message: "type không hợp lệ" });
      return;
    }

    const file = (req as unknown as { file?: Express.Multer.File }).file;
    if (!file) {
      res.status(400).json({ success: false, message: "Vui lòng chọn ảnh" });
      return;
    }

    const imageUrl = (
      await saveUploadedImageToUploads({
        file,
        folder: "backgrounds",
        fileNamePrefix: `bg-${type}`,
      })
    ).urlPath;
    const key = type === "app" ? "app_background_url" : "login_background_url";

    const applySetting =
      body.apply === undefined || body.apply === null
        ? true
        : String(body.apply) !== "0" &&
          String(body.apply).toLowerCase() !== "false";

    if (applySetting) {
      // Update system_settings with file path and type='image'
      await pool.query(
        `INSERT INTO system_settings (setting_key, setting_value, setting_value_file, setting_type)
         VALUES (?, ?, ?, 'image')
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), setting_value_file = VALUES(setting_value_file), setting_type = 'image'`,
        [key, imageUrl, imageUrl],
      );
    }

    res.json({
      success: true,
      message: "Đã upload ảnh nền",
      data: { image_url: imageUrl },
    });
  } catch (error: unknown) {
    console.error("Lỗi upload nền:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const setBackgroundUrl = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const adminId = req.userId;
    if (!adminId) {
      res.status(401).json({ success: false, message: "Chưa xác thực" });
      return;
    }

    const { type, url } = req.body as { type?: string; url?: string };
    const backgroundType = String(type || "app");
    if (!"app,login".includes(backgroundType)) {
      res.status(400).json({ success: false, message: "type không hợp lệ" });
      return;
    }

    if (!url || typeof url !== "string") {
      res.status(400).json({ success: false, message: "URL không hợp lệ" });
      return;
    }

    const trimmed = url.trim();
    if (!/^https?:\/\//i.test(trimmed)) {
      res
        .status(400)
        .json({ success: false, message: "URL phải bắt đầu bằng http/https" });
      return;
    }

    const key =
      backgroundType === "app" ? "app_background_url" : "login_background_url";
    // For URL: set setting_value to URL, clear setting_value_file, type='image'
    await pool.query(
      `INSERT INTO system_settings (setting_key, setting_value, setting_value_file, setting_type)
       VALUES (?, ?, NULL, 'image')
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), setting_value_file = NULL, setting_type = 'image'`,
      [key, trimmed],
    );

    res.json({
      success: true,
      message: "Đã cập nhật ảnh nền",
      data: { image_url: trimmed },
    });
  } catch (error: unknown) {
    console.error("Lỗi set URL nền:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const useBackgroundFromHistory = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    void req;
    res.status(410).json({
      success: false,
      message: "Tính năng chọn nền từ lịch sử đã bị tắt (DB rút gọn)",
    });
  } catch (error: unknown) {
    console.error("Lỗi chọn nền từ lịch sử:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const toggleBackgroundSchedule = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const scheduleId = Number(req.params.id);
    if (!Number.isFinite(scheduleId)) {
      res.status(400).json({ success: false, message: "ID không hợp lệ" });
      return;
    }

    await pool.query(
      `UPDATE background_schedules SET is_active = NOT is_active WHERE schedule_id = ?`,
      [scheduleId],
    );

    res.json({ success: true, message: "Đã cập nhật trạng thái lịch nền" });
  } catch (error: unknown) {
    console.error("Lỗi cập nhật trạng thái lịch nền:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const deleteBackgroundSchedule = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const scheduleId = Number(req.params.id);
    if (!Number.isFinite(scheduleId)) {
      res.status(400).json({ success: false, message: "ID không hợp lệ" });
      return;
    }

    const [result] = await pool.query<RowDataPacket[]>(
      `DELETE FROM background_schedules WHERE schedule_id = ?`,
      [scheduleId],
    );

    const affectedRows =
      (result as unknown as { affectedRows?: number })?.affectedRows || 0;
    if (affectedRows === 0) {
      res
        .status(404)
        .json({ success: false, message: "Không tìm thấy lịch nền" });
      return;
    }

    res.json({ success: true, message: "Đã xóa lịch nền" });
  } catch (error: unknown) {
    console.error("Lỗi xóa lịch nền:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

// ==================== QUẢN LÝ USER ====================
export const getUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { search, status, role, page = "1", limit = "20" } = req.query;
    const minSpent = req.query.min_spent;
    const maxSpent = req.query.max_spent;
    const province = req.query.province;
    const offset = (Number(page) - 1) * Number(limit);

    const allowedRoles = ["user", "owner", "employee"] as const;
    const isAllowedRole = (r: unknown): r is (typeof allowedRoles)[number] => {
      return (
        typeof r === "string" && (allowedRoles as readonly string[]).includes(r)
      );
    };
    const params: Array<string | number> = [];

    let query = `
      SELECT
        u.user_id,
        u.role,
        u.email,
        u.phone,
        u.full_name,
        u.avatar_url,
        u.status,
        u.is_verified,
        u.created_at,
        (
          SELECT COUNT(*)
          FROM bookings b
          WHERE b.user_id = u.user_id
        ) as total_bookings,
        (
          SELECT COALESCE(SUM(p.amount), 0)
          FROM payments p
          WHERE p.user_id = u.user_id AND p.status = 'completed'
        ) as total_spent,
        (
          SELECT COUNT(*)
          FROM locations l
          WHERE l.owner_id = u.user_id
        ) as total_locations,
        (
          SELECT COUNT(*)
          FROM employee_locations el
          WHERE el.employee_id = u.user_id
        ) as total_employee_locations,
        (
          SELECT GROUP_CONCAT(DISTINCT l.location_name SEPARATOR ', ')
          FROM employee_locations el
          JOIN locations l ON el.location_id = l.location_id
          WHERE el.employee_id = u.user_id AND el.status = 'active'
        ) as employee_work_locations,
        (
          SELECT GROUP_CONCAT(DISTINCT ou.full_name SEPARATOR ', ')
          FROM employee_locations el
          JOIN users ou ON el.owner_id = ou.user_id
          WHERE el.employee_id = u.user_id
        ) as employee_owners
      FROM users u
      WHERE u.role IN ('user','owner','employee')
        AND u.deleted_at IS NULL
        AND (
          u.role <> 'user'
          OR u.email IS NOT NULL
          OR u.password_hash IS NOT NULL
          OR u.google_id IS NOT NULL
          OR u.facebook_id IS NOT NULL
        )
    `;

    if (search) {
      query += ` AND (u.email LIKE ? OR u.full_name LIKE ? OR u.phone LIKE ?)`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (isAllowedRole(role)) {
      query += ` AND u.role = ?`;
      params.push(role);
    }

    if (typeof status === "string") {
      query += ` AND u.status = ?`;
      params.push(status);
    }

    // Vì sao: lọc chi tiêu để Admin nhanh khoanh vùng nhóm user quan trọng
    if (typeof minSpent === "string" && minSpent.trim() !== "") {
      query += ` AND (
        SELECT COALESCE(SUM(p.amount), 0)
        FROM payments p
        WHERE p.user_id = u.user_id AND p.status = 'completed'
      ) >= ?`;
      params.push(Number(minSpent));
    }

    if (typeof maxSpent === "string" && maxSpent.trim() !== "") {
      query += ` AND (
        SELECT COALESCE(SUM(p.amount), 0)
        FROM payments p
        WHERE p.user_id = u.user_id AND p.status = 'completed'
      ) <= ?`;
      params.push(Number(maxSpent));
    }

    // Vì sao: lọc theo tỉnh dựa trên lịch sử đặt chỗ để đánh giá vùng hoạt động
    if (typeof province === "string" && province.trim() !== "") {
      query += ` AND EXISTS (
        SELECT 1
        FROM bookings b
        JOIN locations l ON b.location_id = l.location_id
        WHERE b.user_id = u.user_id AND l.province = ?
      )`;
      params.push(province.trim());
    }

    query += ` ORDER BY u.created_at DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), offset);

    const [rows] = await pool.query<RowDataPacket[]>(query, params);

    // Đếm tổng số records
    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total
       FROM users u
       WHERE u.role IN ('user','owner','employee')
         AND u.deleted_at IS NULL
         AND (
           u.role <> 'user'
           OR u.email IS NOT NULL
           OR u.password_hash IS NOT NULL
           OR u.google_id IS NOT NULL
           OR u.facebook_id IS NOT NULL
         )
       ${
         search
           ? `AND (u.email LIKE ? OR u.full_name LIKE ? OR u.phone LIKE ?)`
           : ""
       }
       ${isAllowedRole(role) ? "AND u.role = ?" : ""}
       ${typeof status === "string" ? "AND u.status = ?" : ""}
       ${
         typeof minSpent === "string" && minSpent.trim() !== ""
           ? `AND (
                SELECT COALESCE(SUM(p.amount), 0)
                FROM payments p
                WHERE p.user_id = u.user_id AND p.status = 'completed'
              ) >= ?`
           : ""
       }
       ${
         typeof maxSpent === "string" && maxSpent.trim() !== ""
           ? `AND (
                SELECT COALESCE(SUM(p.amount), 0)
                FROM payments p
                WHERE p.user_id = u.user_id AND p.status = 'completed'
              ) <= ?`
           : ""
       }
       ${
         typeof province === "string" && province.trim() !== ""
           ? `AND EXISTS (
                SELECT 1
                FROM bookings b
                JOIN locations l ON b.location_id = l.location_id
                WHERE b.user_id = u.user_id AND l.province = ?
              )`
           : ""
       }`,
      (() => {
        const p: Array<string | number> = [];
        if (search) {
          const st = `%${search}%`;
          p.push(st, st, st);
        }
        if (isAllowedRole(role)) {
          p.push(role);
        }
        if (typeof status === "string") {
          p.push(status);
        }
        if (typeof minSpent === "string" && minSpent.trim() !== "") {
          p.push(Number(minSpent));
        }
        if (typeof maxSpent === "string" && maxSpent.trim() !== "") {
          p.push(Number(maxSpent));
        }
        if (typeof province === "string" && province.trim() !== "") {
          p.push(province.trim());
        }
        return p;
      })(),
    );

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: countRows[0]?.total || 0,
        page: Number(page),
        limit: Number(limit),
      },
    });
  } catch (error: unknown) {
    console.error("Lỗi lấy danh sách users:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy danh sách người dùng",
    });
  }
};

export const getUserById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;

    // Lấy thông tin tài khoản (không cho thao tác với admin)
    const [userRows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM users WHERE user_id = ? AND role IN ('user','owner','employee')`,
      [id],
    );

    if (userRows.length === 0) {
      res.status(404).json({
        success: false,
        message: "Không tìm thấy tài khoản",
      });
      return;
    }

    const user = userRows[0];

    if (user.role === "owner") {
      const [profileRows] = await pool.query<RowDataPacket[]>(
        `SELECT * FROM owner_profiles WHERE owner_id = ? LIMIT 1`,
        [id],
      );

      const [locationRows] = await pool.query<RowDataPacket[]>(
        `SELECT * FROM locations WHERE owner_id = ? ORDER BY created_at DESC`,
        [id],
      );

      res.json({
        success: true,
        data: {
          user,
          owner_profile: profileRows[0] || null,
          locations: locationRows,
        },
      });
      return;
    }

    if (user.role === "employee") {
      const [assignedRows] = await pool.query<RowDataPacket[]>(
        `SELECT
           el.*,
           l.location_name,
           l.address,
           l.latitude,
           l.longitude,
           l.status as location_status
         FROM employee_locations el
         JOIN locations l ON el.location_id = l.location_id
         WHERE el.employee_id = ?
         ORDER BY el.assigned_at DESC`,
        [id],
      );

      res.json({
        success: true,
        data: {
          user,
          assigned_locations: assignedRows,
        },
      });
      return;
    }

    // Lấy thống kê booking
    const [bookingRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total, SUM(final_amount) as total_amount 
       FROM bookings WHERE user_id = ?`,
      [id],
    );

    // Lấy danh sách địa điểm yêu thích
    const [favoriteRows] = await pool.query<RowDataPacket[]>(
      `SELECT l.* FROM favorite_locations fl
       JOIN locations l ON fl.location_id = l.location_id
       WHERE fl.user_id = ?`,
      [id],
    );

    // Lấy lịch sử check-in
    const [checkinRows] = await pool.query<RowDataPacket[]>(
      `SELECT c.*, l.location_name 
       FROM checkins c
       JOIN locations l ON c.location_id = l.location_id
       WHERE c.user_id = ?
       ORDER BY c.checkin_time DESC
       LIMIT 10`,
      [id],
    );

    res.json({
      success: true,
      data: {
        user,
        stats: {
          totalBookings: bookingRows[0]?.total || 0,
          totalAmount: parseFloat(bookingRows[0]?.total_amount || "0"),
          favoriteLocations: favoriteRows.length,
        },
        favorites: favoriteRows,
        recentCheckins: checkinRows,
      },
    });
  } catch (error: unknown) {
    console.error("Lỗi lấy chi tiết user:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy chi tiết người dùng",
    });
  }
};

export const updateUserStatus = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const adminId = req.userId;

    if (!["active", "locked", "pending"].includes(status)) {
      res.status(400).json({
        success: false,
        message: "Trạng thái không hợp lệ",
      });
      return;
    }

    // Vì sao: Admin có thể khóa/mở khóa cả user/owner/employee, nhưng không được sửa admin.
    const [result] = await pool.query(
      `UPDATE users
       SET status = ?, updated_at = NOW()
       WHERE user_id = ? AND role IN ('user','owner','employee')`,
      [status, id],
    );

    const affected = (result as unknown as { affectedRows: number })
      .affectedRows;
    if (!affected) {
      res
        .status(404)
        .json({ success: false, message: "Không tìm thấy tài khoản" });
      return;
    }

    if (!adminId) {
      res.status(401).json({ success: false, message: "Chưa xác thực" });
      return;
    }

    // Ghi log
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
      [
        adminId,
        "UPDATE_USER_STATUS",
        JSON.stringify({ userId: id, status, timestamp: new Date() }),
      ],
    );

    res.json({
      success: true,
      message: "Cập nhật trạng thái người dùng thành công",
    });
  } catch (error: unknown) {
    console.error("Lỗi cập nhật trạng thái user:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi cập nhật trạng thái",
    });
  }
};

export const promoteUserToOwner = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = Number(req.params.id);
    const adminId = req.userId;

    if (!Number.isFinite(userId)) {
      res.status(400).json({ success: false, message: "User ID không hợp lệ" });
      return;
    }

    if (!adminId) {
      res.status(401).json({ success: false, message: "Chưa xác thực" });
      return;
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT user_id, role, full_name FROM users WHERE user_id = ? LIMIT 1`,
      [userId],
    );
    if (!rows[0]) {
      res.status(404).json({ success: false, message: "Không tìm thấy user" });
      return;
    }

    if (rows[0].role !== "user") {
      res.status(400).json({
        success: false,
        message: "Chỉ có thể chuyển từ role user sang owner",
      });
      return;
    }

    await pool.query(
      `UPDATE users SET role = 'owner', status = 'active', updated_at = NOW()
       WHERE user_id = ?`,
      [userId],
    );

    const [profileRows] = await pool.query<RowDataPacket[]>(
      `SELECT owner_id FROM owner_profiles WHERE owner_id = ? LIMIT 1`,
      [userId],
    );

    if (!profileRows[0]) {
      const [settingRows] = await pool.query<RowDataPacket[]>(
        `SELECT setting_value FROM system_settings WHERE setting_key = 'default_commission_rate' LIMIT 1`,
      );
      const commissionRate = Number(settingRows[0]?.setting_value || 2.5);

      await pool.query(
        `INSERT INTO owner_profiles (
          owner_id,
          bank_account,
          bank_name,
          account_holder,
          contact_info,
          membership_level,
          commission_rate,
          total_revenue,
          approval_status,
          approved_at,
          approved_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'approved', NOW(), ?)`,
        [
          userId,
          "Chưa cập nhật",
          "Chưa cập nhật",
          rows[0].full_name || "Owner",
          null,
          "basic",
          Number.isFinite(commissionRate) ? commissionRate : 2.5,
          0,
          adminId,
        ],
      );
    }

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
      [
        adminId,
        "PROMOTE_USER_TO_OWNER",
        JSON.stringify({ userId, timestamp: new Date() }),
      ],
    );

    res.json({ success: true, message: "Đã chuyển user thành owner" });
  } catch (error: unknown) {
    console.error("Lỗi chuyển user thành owner:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const updateOwnerStatus = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const ownerId = Number(req.params.id);
    const { status } = req.body as { status?: string };
    const adminId = req.userId;

    if (!Number.isFinite(ownerId)) {
      res
        .status(400)
        .json({ success: false, message: "Owner ID không hợp lệ" });
      return;
    }

    if (!adminId) {
      res.status(401).json({ success: false, message: "Chưa xác thực" });
      return;
    }

    if (!status || !["active", "locked", "pending"].includes(status)) {
      res
        .status(400)
        .json({ success: false, message: "Trạng thái không hợp lệ" });
      return;
    }

    const [result] = await pool.query(
      `UPDATE users SET status = ?, updated_at = NOW()
       WHERE user_id = ? AND role = 'owner'`,
      [status, ownerId],
    );

    const affected = (result as unknown as { affectedRows: number })
      .affectedRows;
    if (!affected) {
      res.status(404).json({ success: false, message: "Không tìm thấy owner" });
      return;
    }

    const buildOwnerLockSnapshot = async (): Promise<{
      employees: Array<{ user_id: number; status: string }>;
    }> => {
      const [employeeRows] = await pool.query<RowDataPacket[]>(
        `SELECT DISTINCT u.user_id, u.status
         FROM users u
         JOIN employee_locations el ON el.employee_id = u.user_id
         WHERE el.owner_id = ? AND u.role = 'employee'
           AND u.status IN ('active','pending')`,
        [ownerId],
      );

      return {
        employees: employeeRows.map((row) => ({
          user_id: Number(row.user_id),
          status: String(row.status),
        })),
      };
    };

    const getLatestOwnerLockSnapshot = async (): Promise<{
      employees: Array<{ user_id: number; status: string }>;
    } | null> => {
      const [logs] = await pool.query<RowDataPacket[]>(
        `SELECT details
         FROM audit_logs
         WHERE action IN ('UPDATE_OWNER_STATUS','LOCK_OWNER_FOR_DEBT')
         ORDER BY created_at DESC
         LIMIT 30`,
      );

      for (const log of logs) {
        const raw = log.details as string | null;
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw) as {
            ownerId?: number;
            lock_snapshot?: {
              employees?: Array<{ user_id: number; status: string }>;
            };
          };

          if (Number(parsed.ownerId) !== ownerId) continue;
          if (!parsed.lock_snapshot) continue;

          const employees = Array.isArray(parsed.lock_snapshot.employees)
            ? parsed.lock_snapshot.employees
            : [];

          return { employees };
        } catch {
          continue;
        }
      }

      return null;
    };

    const restoreOwnerFromSnapshot = async (snapshot: {
      employees: Array<{ user_id: number; status: string }>;
    }): Promise<void> => {
      if (snapshot.employees.length > 0) {
        const employeeIds = snapshot.employees.map((e) => e.user_id);
        const caseParts = snapshot.employees
          .map(() => "WHEN ? THEN ?")
          .join(" ");
        const caseParams = snapshot.employees.flatMap((e) => [
          e.user_id,
          e.status,
        ]);
        const inParams = employeeIds.map(() => "?").join(",");

        await pool.query(
          `UPDATE users
           SET status = CASE user_id ${caseParts} ELSE status END,
               updated_at = NOW()
           WHERE role = 'employee' AND status = 'locked' AND user_id IN (${inParams})`,
          [...caseParams, ...employeeIds],
        );
      }
    };

    // Vì sao: khi owner bị khóa, toàn bộ địa điểm và nhân viên thuộc owner phải bị khóa theo.
    let lockSnapshot: {
      employees: Array<{ user_id: number; status: string }>;
    } | null = null;

    if (status === "locked") {
      lockSnapshot = await buildOwnerLockSnapshot();

      await pool.query(
        `UPDATE locations
         SET previous_status = status,
             status = 'inactive',
             updated_at = NOW()
         WHERE owner_id = ? AND status IN ('active','pending')`,
        [ownerId],
      );

      if (lockSnapshot.employees.length > 0) {
        const employeeIds = lockSnapshot.employees.map((e) => e.user_id);
        const placeholders = employeeIds.map(() => "?").join(",");
        await pool.query(
          `UPDATE users
           SET status = 'locked', updated_at = NOW()
           WHERE role = 'employee' AND status IN ('active','pending')
             AND user_id IN (${placeholders})`,
          employeeIds,
        );
      }
    }

    if (status === "active") {
      const snapshot = await getLatestOwnerLockSnapshot();
      if (snapshot) {
        await restoreOwnerFromSnapshot(snapshot);
      }

      await pool.query(
        `UPDATE locations
         SET status = previous_status,
             previous_status = NULL,
             updated_at = NOW()
         WHERE owner_id = ? AND previous_status IS NOT NULL`,
        [ownerId],
      );
    }

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
      [
        adminId,
        "UPDATE_OWNER_STATUS",
        JSON.stringify({
          ownerId,
          status,
          lock_snapshot: lockSnapshot ?? undefined,
          timestamp: new Date(),
        }),
      ],
    );

    res.json({ success: true, message: "Đã cập nhật trạng thái owner" });
  } catch (error: unknown) {
    console.error("Lỗi cập nhật trạng thái owner:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const deleteUser = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const adminId = (req as any).userId;

    if (String(adminId) === String(id)) {
      res.status(400).json({
        success: false,
        message: "Không thể xóa chính tài khoản đang đăng nhập",
      });
      return;
    }

    // Vì sao: nút Xóa phải xóa thật; Khóa/Mở khóa dùng endpoint updateUserStatus.
    const [roleRows] = await pool.query<RowDataPacket[]>(
      `SELECT role FROM users WHERE user_id = ? LIMIT 1`,
      [id],
    );

    if (roleRows.length === 0) {
      res
        .status(404)
        .json({ success: false, message: "Không tìm thấy tài khoản" });
      return;
    }

    if (roleRows[0].role === "admin") {
      res
        .status(403)
        .json({ success: false, message: "Không thể xóa tài khoản admin" });
      return;
    }

    const [delResult] = await pool.query(
      `DELETE FROM users WHERE user_id = ? AND role IN ('user','owner','employee')`,
      [id],
    );

    const affected = (delResult as unknown as { affectedRows: number })
      .affectedRows;
    if (!affected) {
      res
        .status(404)
        .json({ success: false, message: "Không tìm thấy tài khoản" });
      return;
    }

    // Ghi log
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
      [
        adminId,
        "DELETE_USER",
        JSON.stringify({ userId: id, timestamp: new Date() }),
      ],
    );

    res.json({
      success: true,
      message: "Xóa tài khoản thành công",
    });
  } catch (error: any) {
    console.error("Lỗi xóa user:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi xóa tài khoản",
    });
  }
};

// ==================== QUẢN LÝ OWNER ====================
export const getOwners = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      search,
      approval_status,
      location_status,
      page = "1",
      limit = "20",
    } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    // locations.status in DB: enum('active','inactive','pending')
    // Backward-compat: accept old query values approved/rejected and map them.
    const allowedLocationStatus = [
      "pending",
      "active",
      "inactive",
      "approved",
      "rejected",
    ] as const;
    const isAllowedLocationStatus = (
      v: unknown,
    ): v is (typeof allowedLocationStatus)[number] =>
      typeof v === "string" &&
      (allowedLocationStatus as readonly string[]).includes(v);

    const normalizeLocationStatus = (v: string): string => {
      if (v === "approved") return "active";
      if (v === "rejected") return "inactive";
      return v;
    };

    let query = `
      SELECT 
        u.user_id,
        u.email,
        u.phone,
        u.full_name,
        u.avatar_url,
        u.status,
        u.created_at,
        COALESCE(op.approval_status, 'pending') as approval_status,
        COALESCE(op.commission_rate, 2.5) as commission_rate,
        COALESCE(op.total_revenue, 0) as total_revenue,
        COALESCE(op.membership_level, 'basic') as membership_level,
        (
          SELECT COUNT(*)
          FROM locations l
          WHERE l.owner_id = u.user_id
        ) as total_locations
        ,(
          SELECT COALESCE(SUM(CASE WHEN l.status = 'pending' THEN 1 ELSE 0 END), 0)
          FROM locations l
          WHERE l.owner_id = u.user_id
        ) as pending_locations
        ,(
          SELECT COALESCE(SUM(CASE WHEN l.status = 'active' THEN 1 ELSE 0 END), 0)
          FROM locations l
          WHERE l.owner_id = u.user_id
        ) as approved_locations
        ,(
          SELECT COALESCE(SUM(CASE WHEN l.status = 'inactive' THEN 1 ELSE 0 END), 0)
          FROM locations l
          WHERE l.owner_id = u.user_id
        ) as rejected_locations
      FROM users u
      LEFT JOIN owner_profiles op ON u.user_id = op.owner_id
      WHERE u.role = 'owner'
    `;
    const params: any[] = [];

    if (search) {
      query += ` AND (u.email LIKE ? OR u.full_name LIKE ? OR u.phone LIKE ?)`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (approval_status) {
      query += ` AND COALESCE(op.approval_status, 'pending') = ?`;
      params.push(approval_status);
    }

    if (isAllowedLocationStatus(location_status)) {
      query += ` AND EXISTS (
        SELECT 1 FROM locations lx
        WHERE lx.owner_id = u.user_id AND lx.status = ?
      )`;
      params.push(normalizeLocationStatus(location_status));
    }

    query += ` ORDER BY u.created_at DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), offset);

    const [rows] = await pool.query<RowDataPacket[]>(query, params);

    let countQuery = `
      SELECT COUNT(DISTINCT u.user_id) as total
      FROM users u
      LEFT JOIN owner_profiles op ON u.user_id = op.owner_id
      WHERE u.role = 'owner'
    `;
    const countParams: Array<string | number> = [];

    if (search) {
      countQuery += ` AND (u.email LIKE ? OR u.full_name LIKE ? OR u.phone LIKE ?)`;
      const searchTerm = `%${search}%`;
      countParams.push(searchTerm, searchTerm, searchTerm);
    }
    if (approval_status) {
      countQuery += ` AND COALESCE(op.approval_status, 'pending') = ?`;
      countParams.push(String(approval_status));
    }

    if (isAllowedLocationStatus(location_status)) {
      countQuery += ` AND EXISTS (
        SELECT 1 FROM locations lx
        WHERE lx.owner_id = u.user_id AND lx.status = ?
      )`;
      countParams.push(normalizeLocationStatus(location_status));
    }

    const [countRows] = await pool.query<RowDataPacket[]>(
      countQuery,
      countParams,
    );

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: countRows[0]?.total || 0,
        page: Number(page),
        limit: Number(limit),
      },
    });
  } catch (error: any) {
    console.error("Lỗi lấy danh sách owners:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy danh sách owner",
    });
  }
};

export const deleteOwner = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const adminId = (req as any).userId;

    let delResult: unknown;
    try {
      const [result] = await pool.query(
        `UPDATE users
         SET deleted_at = NOW()
         WHERE user_id = ? AND role = 'owner' AND deleted_at IS NULL`,
        [id],
      );
      delResult = result;
    } catch {
      const [result] = await pool.query(
        `DELETE FROM users WHERE user_id = ? AND role = 'owner'`,
        [id],
      );
      delResult = result;
    }

    const affected = (delResult as unknown as { affectedRows: number })
      .affectedRows;
    if (!affected) {
      res.status(404).json({ success: false, message: "Không tìm thấy owner" });
      return;
    }

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
      [
        adminId,
        "DELETE_OWNER",
        JSON.stringify({ ownerId: id, timestamp: new Date() }),
      ],
    );

    res.json({ success: true, message: "Xóa owner thành công" });
  } catch (error: any) {
    console.error("Lỗi xóa owner:", error);
    res
      .status(500)
      .json({ success: false, message: "Lỗi server khi xóa owner" });
  }
};

export const deleteLocation = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const adminId = (req as any).userId;

    let delResult: unknown;
    try {
      const [result] = await pool.query(
        `UPDATE locations
         SET deleted_at = NOW(), status = 'inactive', updated_at = NOW()
         WHERE location_id = ? AND deleted_at IS NULL`,
        [id],
      );
      delResult = result;
    } catch {
      const [result] = await pool.query(
        `DELETE FROM locations WHERE location_id = ?`,
        [id],
      );
      delResult = result;
    }

    const affected = (delResult as unknown as { affectedRows: number })
      .affectedRows;
    if (!affected) {
      res
        .status(404)
        .json({ success: false, message: "Không tìm thấy địa điểm" });
      return;
    }

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
      [
        adminId,
        "DELETE_LOCATION",
        JSON.stringify({ locationId: id, timestamp: new Date() }),
      ],
    );

    res.json({ success: true, message: "Xóa địa điểm thành công" });
  } catch (error: any) {
    console.error("Lỗi xóa location:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi xóa địa điểm",
    });
  }
};

export const updateLocationCommissionRate = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const locationId = Number(req.params.id);
    const { new_rate } = req.body as { new_rate?: number };
    const adminId = req.userId;

    if (!adminId) {
      res.status(401).json({ success: false, message: "Chưa xác thực" });
      return;
    }
    if (!Number.isFinite(locationId)) {
      res
        .status(400)
        .json({ success: false, message: "Location ID không hợp lệ" });
      return;
    }

    const newRate = Number(new_rate);
    if (!Number.isFinite(newRate) || newRate <= 0) {
      res
        .status(400)
        .json({ success: false, message: "Tỷ lệ hoa hồng không hợp lệ" });
      return;
    }

    const [oldRows] = await pool.query<RowDataPacket[]>(
      `SELECT commission_rate, owner_id, location_name
       FROM locations
       WHERE location_id = ?
       LIMIT 1`,
      [locationId],
    );
    if (!oldRows[0]) {
      res
        .status(404)
        .json({ success: false, message: "Không tìm thấy địa điểm" });
      return;
    }

    const oldRate =
      oldRows[0]?.commission_rate != null
        ? Number(oldRows[0].commission_rate)
        : null;

    await pool.query(
      `UPDATE locations SET commission_rate = ?, updated_at = NOW() WHERE location_id = ?`,
      [newRate, locationId],
    );

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
      [
        adminId,
        "UPDATE_LOCATION_COMMISSION_RATE",
        JSON.stringify({
          locationId,
          oldRate,
          newRate,
          timestamp: new Date(),
        }),
      ],
    );

    const ownerId = Number(oldRows[0]?.owner_id || 0);
    if (ownerId > 0) {
      const locationName = String(
        oldRows[0]?.location_name || "địa điểm",
      ).trim();
      await pool.query(
        `INSERT INTO push_notifications (title, body, target_audience, target_user_id, sent_by)
         VALUES (?, ?, 'specific_user', ?, ?)`,
        [
          "Admin đã cập nhật thông tin",
          `[owner:settings] Admin vừa cập nhật hoa hồng tại ${locationName}: ${oldRate ?? "chưa có"}% -> ${newRate}%.`,
          ownerId,
          adminId,
        ],
      );
    }

    res.json({ success: true, message: "Đã cập nhật hoa hồng địa điểm" });
  } catch (error: unknown) {
    console.error("Lỗi updateLocationCommissionRate:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

// ==================== QUẢN LÝ CHECK-IN (ADMIN) ====================
export const getCheckins = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const {
      search,
      status,
      booking_only,
      page = "1",
      limit = "20",
    } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const bookingOnlyRaw = Array.isArray(booking_only)
      ? booking_only[0]
      : booking_only;
    const isBookingOnly =
      typeof bookingOnlyRaw === "string" &&
      ["1", "true", "yes"].includes(bookingOnlyRaw.toLowerCase());

    let query = `
      SELECT
        c.checkin_id,
        c.user_id,
        c.location_id,
        c.booking_id,
        c.checkin_time,
        c.status,
        c.verified_by,
        c.device_info,
        c.notes,
        c.checkin_latitude,
        c.checkin_longitude,
        u.full_name as user_name,
        u.email as user_email,
        u.phone as user_phone,
        l.location_name,
        l.address,
        l.status as location_status,
        l.latitude as location_latitude,
        l.longitude as location_longitude,
        vb.full_name as verified_by_name,
        vb.email as verified_by_email
      FROM checkins c
      JOIN users u ON c.user_id = u.user_id
      JOIN locations l ON c.location_id = l.location_id
      LEFT JOIN users vb ON c.verified_by = vb.user_id
      WHERE 1=1
    `;

    const params: Array<string | number> = [];

    if (status) {
      query += ` AND c.status = ?`;
      params.push(String(status));
    }

    if (isBookingOnly) {
      query += ` AND c.booking_id IS NOT NULL`;
    }

    if (search) {
      query += ` AND (
        u.email LIKE ? OR u.full_name LIKE ? OR u.phone LIKE ? OR
        l.location_name LIKE ? OR l.address LIKE ?
      )`;
      const st = `%${search}%`;
      params.push(st, st, st, st, st);
    }

    query += ` ORDER BY c.checkin_time DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), offset);

    const [rows] = await pool.query<RowDataPacket[]>(query, params);

    const toNumberOrNull = (value: unknown): number | null => {
      // MySQL DECIMAL thường trả về string, cần parse về number trước khi tính toán
      if (typeof value === "number" && Number.isFinite(value)) return value;
      if (typeof value === "string") {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
      }
      return null;
    };

    const haversineDistanceKm = (
      aLat: number,
      aLng: number,
      bLat: number,
      bLng: number,
    ): number => {
      // Tính khoảng cách 2 điểm GPS để phục vụ admin xác thực check-in
      const toRad = (deg: number) => (deg * Math.PI) / 180;
      const R = 6371;
      const dLat = toRad(bLat - aLat);
      const dLng = toRad(bLng - aLng);
      const lat1 = toRad(aLat);
      const lat2 = toRad(bLat);
      const h =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1) *
          Math.cos(lat2) *
          Math.sin(dLng / 2) *
          Math.sin(dLng / 2);
      return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
    };

    const data = rows.map((r) => {
      const locationLat = toNumberOrNull(r.location_latitude);
      const locationLng = toNumberOrNull(r.location_longitude);
      const checkinLat = toNumberOrNull(r.checkin_latitude);
      const checkinLng = toNumberOrNull(r.checkin_longitude);

      const registered_location =
        locationLat !== null && locationLng !== null
          ? {
              latitude: locationLat,
              longitude: locationLng,
            }
          : null;

      const actual_checkin_location =
        checkinLat !== null && checkinLng !== null
          ? {
              latitude: checkinLat,
              longitude: checkinLng,
            }
          : null;

      const distance_km =
        registered_location && actual_checkin_location
          ? Number(
              haversineDistanceKm(
                registered_location.latitude,
                registered_location.longitude,
                actual_checkin_location.latitude,
                actual_checkin_location.longitude,
              ).toFixed(3),
            )
          : null;

      return {
        ...r,
        verification_status: r.status,
        registered_location,
        actual_checkin_location,
        can_view_location: registered_location !== null,
        distance_km,
      };
    });

    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total
       FROM checkins c
       JOIN users u ON c.user_id = u.user_id
       JOIN locations l ON c.location_id = l.location_id
       WHERE 1=1
       ${status ? `AND c.status = ?` : ""}
       ${isBookingOnly ? `AND c.booking_id IS NOT NULL` : ""}
       ${
         search
           ? `AND (
                u.email LIKE ? OR u.full_name LIKE ? OR u.phone LIKE ? OR
                l.location_name LIKE ? OR l.address LIKE ?
              )`
           : ""
       }`,
      (() => {
        const p: Array<string | number> = [];
        if (status) p.push(String(status));
        if (search) {
          const st = `%${search}%`;
          p.push(st, st, st, st, st);
        }
        return p;
      })(),
    );

    res.json({
      success: true,
      data,
      pagination: {
        total: countRows[0]?.total || 0,
        page: Number(page),
        limit: Number(limit),
      },
    });
  } catch (error: any) {
    console.error("Lỗi lấy checkins:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy danh sách check-in",
    });
  }
};

export const getLocationCheckinHistory = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { range, page = "1", limit = "20" } = req.query;

    const locationId = Number(id);
    if (!Number.isFinite(locationId)) {
      res
        .status(400)
        .json({ success: false, message: "location_id không hợp lệ" });
      return;
    }

    const allowedRanges = ["today", "week", "month", "year", "all"] as const;
    type RangePreset = (typeof allowedRanges)[number];
    const mode: RangePreset =
      typeof range === "string" &&
      (allowedRanges as readonly string[]).includes(range)
        ? (range as RangePreset)
        : "all";

    const periodFilter = (column: string): string => {
      if (mode === "today") return ` AND DATE(${column}) = CURDATE()`;
      if (mode === "week")
        return ` AND ${column} >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)`;
      if (mode === "month")
        return ` AND ${column} >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH)`;
      if (mode === "year")
        return ` AND ${column} >= DATE_SUB(CURDATE(), INTERVAL 1 YEAR)`;
      return "";
    };

    const offset = (Number(page) - 1) * Number(limit);

    const filterSql = periodFilter("c.checkin_time");

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
        c.checkin_id,
        c.user_id,
        c.location_id,
        c.booking_id,
        c.checkin_time,
        c.status,
        u.full_name as user_name,
        u.email as user_email
       FROM checkins c
       JOIN users u ON c.user_id = u.user_id
       WHERE c.location_id = ?${filterSql}
       ORDER BY c.checkin_time DESC
       LIMIT ? OFFSET ?`,
      [locationId, Number(limit), offset],
    );

    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total
       FROM checkins c
       WHERE c.location_id = ?${filterSql}`,
      [locationId],
    );

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: countRows[0]?.total || 0,
        page: Number(page),
        limit: Number(limit),
      },
    });
  } catch (error: unknown) {
    console.error("Lỗi getLocationCheckinHistory:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

type AdminHistoryRangePreset = "today" | "week" | "month" | "year" | "all";

const parseJsonLoose = (raw: unknown): any | null => {
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  if (Buffer.isBuffer(raw)) {
    try {
      return JSON.parse(raw.toString("utf8"));
    } catch {
      return null;
    }
  }
  const s = String(raw);
  if (!s.trim()) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
};

const getPresetRange = (
  mode: AdminHistoryRangePreset,
): { start: Date | null; end: Date | null } => {
  if (mode === "all") return { start: null, end: null };
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  if (mode === "today") return { start, end };

  if (mode === "week") {
    start.setDate(start.getDate() - 6);
    return { start, end };
  }

  if (mode === "month") {
    start.setMonth(start.getMonth() - 1);
    return { start, end };
  }

  // year
  start.setFullYear(start.getFullYear() - 1);
  return { start, end };
};

export const getAdminLocationPosPaymentsHistory = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { range, date } = req.query;

    const locationId = Number(id);
    if (!Number.isFinite(locationId)) {
      res
        .status(400)
        .json({ success: false, message: "location_id không hợp lệ" });
      return;
    }

    const allowedRanges: AdminHistoryRangePreset[] = [
      "today",
      "week",
      "month",
      "year",
      "all",
    ];
    const mode: AdminHistoryRangePreset =
      typeof range === "string" && allowedRanges.includes(range as any)
        ? (range as AdminHistoryRangePreset)
        : "all";

    const selectedDate =
      typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)
        ? date
        : null;
    const { start, end } = selectedDate
      ? {
          start: new Date(`${selectedDate}T00:00:00.000Z`),
          end: new Date(`${selectedDate}T23:59:59.999Z`),
        }
      : getPresetRange(mode);

    const where: string[] = [
      "p.location_id = ?",
      "p.status = 'completed'",
      "(p.notes LIKE '%\"service_type\":\"food\"%' OR p.notes LIKE '%\"service_type\":\"table\"%' OR p.notes LIKE 'HOTEL_STAY:%' OR p.notes LIKE 'HOTEL_STAYS:%')",
    ];
    const params: any[] = [locationId];
    if (start && end) {
      where.push("p.payment_time >= ? AND p.payment_time < ?");
      params.push(start);
      params.push(end);
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT p.payment_id,
              p.payment_time,
              p.amount,
              p.payment_method,
              p.booking_id,
              p.notes,
              p.qr_data,
              p.transaction_source,
              p.performed_by_user_id,
              p.performed_by_role,
              p.performed_by_name,
              COALESCE(NULLIF(b.contact_name, ''), bu.full_name) AS booking_contact_name,
              COALESCE(NULLIF(b.contact_phone, ''), bu.phone) AS booking_contact_phone
       FROM payments p
       LEFT JOIN bookings b ON b.booking_id = p.booking_id
       LEFT JOIN users bu ON bu.user_id = b.user_id
       WHERE ${where.join(" AND ")}
       ORDER BY p.payment_time DESC
       LIMIT 2000`,
      params,
    );

    const toIsoOrNull = (v: unknown): string | null => {
      if (!v) return null;
      const d = v instanceof Date ? v : new Date(String(v));
      return Number.isFinite(d.getTime()) ? d.toISOString() : null;
    };

    const history = rows
      .map((r) => {
        const paymentId = Number(r.payment_id);
        if (!Number.isFinite(paymentId)) return null;

        const notesRaw = (r as any).notes;
        const notes = parseJsonLoose(notesRaw);
        const notesStr = String(notesRaw || "");
        const isFood =
          Boolean(notes) &&
          String((notes as any).service_type || "") === "food";
        const isTable =
          Boolean(notes) &&
          String((notes as any).service_type || "") === "table";
        const isHotelSingle = notesStr.startsWith("HOTEL_STAY:");
        const isHotelBatch = notesStr.startsWith("HOTEL_STAYS:");
        const isHotel = isHotelSingle || isHotelBatch;
        if (!isFood && !isTable && !isHotel) return null;

        const amount = Number((r as any).amount || 0);
        const paymentMethod = String((r as any).payment_method || "");
        const bookingIdRaw = (r as any).booking_id;
        const bookingId = bookingIdRaw == null ? null : Number(bookingIdRaw);
        const paymentTime =
          toIsoOrNull((r as any).payment_time) || new Date().toISOString();
        const transactionSource = String((r as any).transaction_source || "");

        const performedUserIdFromNotes =
          (notes as any)?.performed_by?.user_id != null
            ? Number((notes as any).performed_by.user_id)
            : null;
        const performedUserIdFromColumn =
          (r as any).performed_by_user_id != null
            ? Number((r as any).performed_by_user_id)
            : null;
        const performedUserId = Number.isFinite(performedUserIdFromNotes as any)
          ? (performedUserIdFromNotes as number)
          : Number.isFinite(performedUserIdFromColumn as any)
            ? (performedUserIdFromColumn as number)
            : null;

        const performedRole =
          (notes as any)?.performed_by?.role === "owner" ||
          (notes as any)?.performed_by?.role === "employee" ||
          (notes as any)?.performed_by?.role === "user"
            ? ((notes as any).performed_by.role as any)
            : ((r as any).performed_by_role as any) || null;

        const performedName =
          ((notes as any)?.performed_by?.name
            ? String((notes as any).performed_by.name)
            : null) ||
          ((r as any).performed_by_name
            ? String((r as any).performed_by_name)
            : null);

        const performedPhone =
          performedRole === "user" && (notes as any)?.performed_by?.phone
            ? String((notes as any).performed_by.phone)
            : null;

        const processedName = (notes as any)?.processed_by?.name
          ? String((notes as any).processed_by.name)
          : null;

        const itemsRaw: any[] =
          (isFood || isTable) && notes && Array.isArray((notes as any).items)
            ? ((notes as any).items as any[])
            : [];
        const items = itemsRaw
          .map((it: any) => ({
            service_id: Number(it.service_id),
            service_name: String(it.service_name || ""),
            quantity: Number(it.quantity || 0),
            unit_price: Number(it.unit_price || 0),
            line_total: Number(it.line_total || 0),
          }))
          .filter(
            (it) =>
              Number.isFinite(it.service_id) &&
              Boolean(String(it.service_name || "").trim()) &&
              Number.isFinite(it.quantity) &&
              Number.isFinite(it.unit_price) &&
              Number.isFinite(it.line_total),
          );

        const totalQtyRaw =
          (isFood || isTable) && notes && (notes as any).total_qty != null
            ? Number((notes as any).total_qty)
            : NaN;
        const totalQty = Number.isFinite(totalQtyRaw)
          ? totalQtyRaw
          : items.reduce((s: number, x: any) => s + Number(x.quantity || 0), 0);

        const tableName =
          isFood && (notes as any)?.table_name
            ? String((notes as any).table_name)
            : isTable && (notes as any)?.table_names
              ? String((notes as any).table_names)
              : null;

        const bookingContactNameRaw = (r as any).booking_contact_name;
        const bookingContactPhoneRaw = (r as any).booking_contact_phone;
        const bookingContactName =
          bookingContactNameRaw != null && String(bookingContactNameRaw).trim()
            ? String(bookingContactNameRaw)
            : null;
        const bookingContactPhone =
          bookingContactPhoneRaw != null &&
          String(bookingContactPhoneRaw).trim()
            ? String(bookingContactPhoneRaw)
            : null;

        const isPrepaidSegment =
          (isFood || isTable) &&
          Boolean((notes as any)?.invoice_ready === true);
        const isOnsiteSegment =
          (isFood || isTable) &&
          !Boolean((notes as any)?.invoice_ready === true);

        // Hotel snapshot in qr_data
        let hotel: any | null = null;
        let hotelRooms: any[] | null = null;
        if (isHotel) {
          const qrParsed = parseJsonLoose((r as any).qr_data);
          const snapAny =
            qrParsed && typeof qrParsed === "object" ? (qrParsed as any) : null;
          const snap = isHotelSingle
            ? snapAny?.hotel_invoice
            : Array.isArray(snapAny?.hotel_invoices)
              ? (snapAny.hotel_invoices as any[])[0]
              : null;
          const snapObj = snap && typeof snap === "object" ? snap : null;

          if (isHotelBatch && Array.isArray(snapAny?.hotel_invoices)) {
            hotelRooms = (snapAny.hotel_invoices as any[])
              .map((x: any) => {
                const totalAmountRaw =
                  x?.total_amount != null ? Number(x.total_amount) : NaN;
                return {
                  stay_id: x?.stay_id == null ? null : Number(x.stay_id),
                  room_number:
                    x?.room_number == null ? null : String(x.room_number),
                  guest_name:
                    x?.guest_name == null ? null : String(x.guest_name),
                  guest_phone:
                    x?.guest_phone == null ? null : String(x.guest_phone),
                  checkin_time: toIsoOrNull(x?.checkin_time),
                  checkout_time: toIsoOrNull(x?.checkout_time),
                  total_amount: Number.isFinite(totalAmountRaw)
                    ? totalAmountRaw
                    : null,
                };
              })
              .filter(
                (x: any) =>
                  Boolean(String(x.room_number || "").trim()) ||
                  x.stay_id != null,
              );
            if (hotelRooms.length === 0) hotelRooms = null;
          }

          if (isHotelSingle && snapObj) {
            const totalAmountRaw =
              (snapObj as any).total_amount != null
                ? Number((snapObj as any).total_amount)
                : NaN;
            hotelRooms = [
              {
                stay_id:
                  (snapObj as any).stay_id != null
                    ? Number((snapObj as any).stay_id)
                    : null,
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
                total_amount: Number.isFinite(totalAmountRaw)
                  ? totalAmountRaw
                  : null,
              },
            ];
          }

          let roomNumberDisplay: string | null = null;
          if (isHotelBatch && Array.isArray(snapAny?.hotel_invoices)) {
            const nums = (snapAny.hotel_invoices as any[])
              .map((x: any) =>
                x && x.room_number ? String(x.room_number) : "",
              )
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
            stay_id:
              (snapObj as any)?.stay_id != null
                ? Number((snapObj as any).stay_id)
                : null,
            room_number:
              roomNumberDisplay ||
              ((snapObj as any)?.room_number != null
                ? String((snapObj as any).room_number)
                : null),
            guest_name:
              (snapObj as any)?.guest_name != null
                ? String((snapObj as any).guest_name)
                : null,
            guest_phone:
              (snapObj as any)?.guest_phone != null
                ? String((snapObj as any).guest_phone)
                : null,
            checkin_time: checkinIso,
            checkout_time: checkoutIso,
            actual_minutes: actualMinutes,
          };
        }

        return {
          payment_id: paymentId,
          payment_time: paymentTime,
          amount: Number.isFinite(amount) ? amount : 0,
          payment_method: paymentMethod,
          transaction_source: transactionSource,
          booking_id: Number.isFinite(bookingId as any) ? bookingId : null,
          table_name: tableName,
          booking_contact_name: bookingContactName,
          booking_contact_phone: bookingContactPhone,
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
          },
          items,
          prepaid_items: isPrepaidSegment ? items : [],
          onsite_items: isOnsiteSegment ? items : [],
          prepaid_amount: isPrepaidSegment ? amount : 0,
          onsite_amount: isOnsiteSegment ? amount : 0,
          prepaid_payment_method: isPrepaidSegment ? paymentMethod : null,
          onsite_payment_method: isOnsiteSegment ? paymentMethod : null,
          segment_type: isPrepaidSegment
            ? "prepaid"
            : isOnsiteSegment
              ? "onsite"
              : null,
        };
      })
      .filter(Boolean) as Array<{
      payment_id: number;
      payment_time: string;
      amount: number;
      payment_method: string;
      transaction_source?: string;
      booking_id?: number | null;
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
        total_amount: number | null;
      }> | null;
      performed_by: {
        role: "owner" | "employee" | "user" | null;
        user_id?: number | null;
        name: string | null;
        phone: string | null;
      };
      processed_by: { name: string | null };
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
    }>;

    const mergedHistory = history.reduce<typeof history>((acc, row) => {
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

      existing.amount = Number(existing.amount || 0) + Number(row.amount || 0);
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
      existing.prepaid_amount =
        Number(existing.prepaid_amount || 0) + Number(row.prepaid_amount || 0);
      existing.onsite_amount =
        Number(existing.onsite_amount || 0) + Number(row.onsite_amount || 0);
      existing.prepaid_payment_method =
        existing.prepaid_payment_method || row.prepaid_payment_method || null;
      existing.onsite_payment_method =
        existing.onsite_payment_method || row.onsite_payment_method || null;
      existing.booking_contact_name =
        existing.booking_contact_name || row.booking_contact_name || null;
      existing.booking_contact_phone =
        existing.booking_contact_phone || row.booking_contact_phone || null;
      existing.segment_type =
        Number(existing.prepaid_amount || 0) > 0 &&
        Number(existing.onsite_amount || 0) > 0
          ? null
          : existing.segment_type || row.segment_type;
      return acc;
    }, []);

    res.json({
      success: true,
      data: {
        history: mergedHistory,
      },
    });
  } catch (error: unknown) {
    console.error("Lỗi getAdminLocationPosPaymentsHistory:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const getAdminLocationTouristTicketInvoices = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { range, date } = req.query;

    const locationId = Number(id);
    if (!Number.isFinite(locationId)) {
      res
        .status(400)
        .json({ success: false, message: "location_id không hợp lệ" });
      return;
    }

    const allowedRanges: AdminHistoryRangePreset[] = [
      "today",
      "week",
      "month",
      "year",
      "all",
    ];
    const mode: AdminHistoryRangePreset =
      typeof range === "string" && allowedRanges.includes(range as any)
        ? (range as AdminHistoryRangePreset)
        : "all";

    const selectedDate =
      typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)
        ? date
        : null;
    const { start, end } = selectedDate
      ? {
          start: new Date(`${selectedDate}T00:00:00.000Z`),
          end: new Date(`${selectedDate}T23:59:59.999Z`),
        }
      : getPresetRange(mode);

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
      const qr = parseJsonLoose((r as any).qr_data);
      const inv = qr?.tourist_invoice;
      const itemsRaw: any[] = Array.isArray(inv?.items) ? inv.items : [];

      const items = itemsRaw
        .map((it: any) => {
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
        .filter(Boolean);

      const totalQty = (items as any[]).reduce(
        (sum, item) => sum + Number(item.quantity || 0),
        0,
      );
      const totalAmount =
        Number(inv?.total_amount || 0) ||
        (items as any[]).reduce(
          (sum, item) => sum + Number(item.line_total || 0),
          0,
        ) ||
        Number((r as any).amount || 0);

      posInvoices.push({
        source: "pos",
        payment_id: Number((r as any).payment_id),
        booking_id: null,
        payment_time: toIso((r as any).payment_time),
        payment_method: String((r as any).payment_method || ""),
        seller_name: String((r as any).performed_by_name || "").trim() || null,
        seller_user_id: (r as any).performed_by_user_id ?? null,
        seller_role: (r as any).performed_by_role ?? null,
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

    const bookingById = new Map<number, any>();
    for (const r of bookingItemRows) {
      const bookingId = Number((r as any).booking_id);
      if (!Number.isFinite(bookingId)) continue;

      const qty = Number((r as any).quantity || 0);
      const unitPrice = Number((r as any).unit_price || 0);
      const lineTotal = Number(unitPrice * qty);
      if (!Number.isFinite(qty) || qty <= 0) continue;

      const inv = bookingById.get(bookingId) ?? {
        source: "booking" as const,
        payment_id:
          (r as any).payment_id != null ? Number((r as any).payment_id) : null,
        booking_id: bookingId,
        payment_time: toIso((r as any).payment_time || (r as any).issued_at),
        payment_method: (r as any).payment_method
          ? String((r as any).payment_method)
          : null,
        buyer_id:
          (r as any).buyer_id != null ? Number((r as any).buyer_id) : null,
        buyer_name: (r as any).buyer_name
          ? String((r as any).buyer_name)
          : null,
        buyer_phone: (r as any).buyer_phone
          ? String((r as any).buyer_phone)
          : null,
        total_qty: 0,
        total_amount: 0,
        items: [],
      };

      const candidateTime = toIso(
        (r as any).payment_time || (r as any).issued_at,
      );
      if (
        candidateTime &&
        (!inv.payment_time || inv.payment_time < candidateTime)
      ) {
        inv.payment_time = candidateTime;
      }

      inv.payment_id =
        (r as any).payment_id != null
          ? Number((r as any).payment_id)
          : inv.payment_id;
      inv.payment_method = (r as any).payment_method
        ? String((r as any).payment_method)
        : (inv.payment_method ?? null);
      inv.total_qty += qty;
      inv.total_amount += lineTotal;
      inv.items.push({
        service_id: Number((r as any).service_id),
        service_name: String((r as any).service_name || "-"),
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
        invoices,
      },
    });
  } catch (error: unknown) {
    console.error("Lỗi getAdminLocationTouristTicketInvoices:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const getCheckinById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
        c.checkin_id,
        c.user_id,
        c.location_id,
        c.booking_id,
        c.checkin_time,
        c.status,
        c.verified_by,
        c.device_info,
        c.notes,
        c.checkin_latitude,
        c.checkin_longitude,
        u.full_name as user_name,
        u.email as user_email,
        u.phone as user_phone,
        l.location_name,
        l.address,
        l.status as location_status,
        l.latitude as location_latitude,
        l.longitude as location_longitude,
        vb.full_name as verified_by_name,
        vb.email as verified_by_email
      FROM checkins c
      JOIN users u ON c.user_id = u.user_id
      JOIN locations l ON c.location_id = l.location_id
      LEFT JOIN users vb ON c.verified_by = vb.user_id
      WHERE c.checkin_id = ?
      LIMIT 1`,
      [id],
    );

    if (rows.length === 0) {
      res
        .status(404)
        .json({ success: false, message: "Không tìm thấy check-in" });
      return;
    }

    const toNumberOrNull = (value: unknown): number | null => {
      if (typeof value === "number" && Number.isFinite(value)) return value;
      if (typeof value === "string") {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
      }
      return null;
    };

    const haversineDistanceKm = (
      aLat: number,
      aLng: number,
      bLat: number,
      bLng: number,
    ): number => {
      const toRad = (deg: number) => (deg * Math.PI) / 180;
      const R = 6371;
      const dLat = toRad(bLat - aLat);
      const dLng = toRad(bLng - aLng);
      const lat1 = toRad(aLat);
      const lat2 = toRad(bLat);
      const h =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1) *
          Math.cos(lat2) *
          Math.sin(dLng / 2) *
          Math.sin(dLng / 2);
      return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
    };

    const r = rows[0];
    const locationLat = toNumberOrNull(r.location_latitude);
    const locationLng = toNumberOrNull(r.location_longitude);
    const checkinLat = toNumberOrNull(r.checkin_latitude);
    const checkinLng = toNumberOrNull(r.checkin_longitude);

    const registered_location =
      locationLat !== null && locationLng !== null
        ? { latitude: locationLat, longitude: locationLng }
        : null;

    const actual_checkin_location =
      checkinLat !== null && checkinLng !== null
        ? { latitude: checkinLat, longitude: checkinLng }
        : null;

    const distance_km =
      registered_location && actual_checkin_location
        ? Number(
            haversineDistanceKm(
              registered_location.latitude,
              registered_location.longitude,
              actual_checkin_location.latitude,
              actual_checkin_location.longitude,
            ).toFixed(3),
          )
        : null;

    res.json({
      success: true,
      data: {
        ...r,
        verification_status: r.status,
        registered_location,
        actual_checkin_location,
        can_view_location: registered_location !== null,
        distance_km,
      },
    });
  } catch (error: unknown) {
    console.error("Lỗi lấy checkin chi tiết:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy check-in",
    });
  }
};

export const verifyCheckin = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { notes } = req.body || {};
    const adminId = (req as any).userId;

    const [result] = await pool.query(
      `UPDATE checkins
       SET status = 'verified', verified_by = ?, notes = ?,
           checkin_time = COALESCE(checkin_time, NOW())
       WHERE checkin_id = ?`,
      [adminId, notes || null, id],
    );

    const affected = (result as unknown as { affectedRows: number })
      .affectedRows;
    if (!affected) {
      res
        .status(404)
        .json({ success: false, message: "Không tìm thấy check-in" });
      return;
    }

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
      [
        adminId,
        "VERIFY_CHECKIN",
        JSON.stringify({ checkinId: id, timestamp: new Date() }),
      ],
    );

    res.json({ success: true, message: "Xác thực check-in thành công" });
  } catch (error: any) {
    console.error("Lỗi verify checkin:", error);
    res
      .status(500)
      .json({ success: false, message: "Lỗi server khi xác thực check-in" });
  }
};

export const failCheckin = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};
    const adminId = (req as any).userId;

    const [result] = await pool.query(
      `UPDATE checkins
       SET status = 'failed', verified_by = ?, notes = ?
       WHERE checkin_id = ?`,
      [adminId, reason || null, id],
    );

    const affected = (result as unknown as { affectedRows: number })
      .affectedRows;
    if (!affected) {
      res
        .status(404)
        .json({ success: false, message: "Không tìm thấy check-in" });
      return;
    }

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
      [
        adminId,
        "FAIL_CHECKIN",
        JSON.stringify({ checkinId: id, reason, timestamp: new Date() }),
      ],
    );

    res.json({ success: true, message: "Đã đánh dấu check-in thất bại" });
  } catch (error: any) {
    console.error("Lỗi fail checkin:", error);
    res
      .status(500)
      .json({ success: false, message: "Lỗi server khi cập nhật check-in" });
  }
};

export const toggleCheckinLock = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { notes } = req.body as { notes?: string };
    const adminId = req.userId;

    if (!adminId) {
      res.status(401).json({ success: false, message: "Chưa xác thực" });
      return;
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT status FROM checkins WHERE checkin_id = ? LIMIT 1`,
      [id],
    );

    if (rows.length === 0) {
      res
        .status(404)
        .json({ success: false, message: "Không tìm thấy check-in" });
      return;
    }

    const currentStatus = String(rows[0].status || "").toLowerCase();
    if (currentStatus === "verified") {
      res.status(400).json({
        success: false,
        message: "Không thể khóa check-in đã xác thực",
      });
      return;
    }

    const nextStatus = currentStatus === "failed" ? "pending" : "failed";
    const nextVerifiedBy = nextStatus === "failed" ? adminId : null;
    const nextNotes = nextStatus === "failed" ? notes?.trim() || null : null;

    await pool.query(
      `UPDATE checkins
       SET status = ?, verified_by = ?, notes = ?
       WHERE checkin_id = ?`,
      [nextStatus, nextVerifiedBy, nextNotes, id],
    );

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
      [
        adminId,
        nextStatus === "failed" ? "LOCK_CHECKIN" : "UNLOCK_CHECKIN",
        JSON.stringify({
          checkinId: id,
          status: nextStatus,
          timestamp: new Date(),
        }),
      ],
    );

    res.json({
      success: true,
      message:
        nextStatus === "failed" ? "Đã khóa check-in" : "Đã mở khóa check-in",
    });
  } catch (error: unknown) {
    console.error("Lỗi khóa/mở check-in:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi cập nhật check-in",
    });
  }
};

export const updateCheckinLocationStatus = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body as { status?: "active" | "inactive" };
    const adminId = req.userId;

    if (!adminId) {
      res.status(401).json({ success: false, message: "Chưa xác thực" });
      return;
    }

    if (!status || !["active", "inactive"].includes(status)) {
      res.status(400).json({
        success: false,
        message: "Trạng thái địa điểm không hợp lệ",
      });
      return;
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT l.location_id, l.status as location_status, u.status as owner_status
       FROM checkins c
       JOIN locations l ON c.location_id = l.location_id
       JOIN users u ON l.owner_id = u.user_id
       WHERE c.checkin_id = ?
       LIMIT 1`,
      [id],
    );

    if (rows.length === 0) {
      res.status(404).json({
        success: false,
        message: "Không tìm thấy check-in hoặc địa điểm liên quan",
      });
      return;
    }

    const locationStatus = String(rows[0].location_status || "");
    const ownerStatus = String(rows[0].owner_status || "");

    if (status === "active" && ownerStatus === "locked") {
      res.status(400).json({
        success: false,
        message: "Owner đang bị khóa, không thể mở địa điểm",
      });
      return;
    }
    if (locationStatus === "pending" && status === "active") {
      res.status(400).json({
        success: false,
        message: "Địa điểm đang chờ duyệt, không thể mở khóa",
      });
      return;
    }

    await pool.query(
      `UPDATE locations SET status = ?, updated_at = NOW() WHERE location_id = ?`,
      [status, rows[0].location_id],
    );

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
      [
        adminId,
        "UPDATE_LOCATION_STATUS_FROM_CHECKIN",
        JSON.stringify({
          checkinId: id,
          locationId: rows[0].location_id,
          status,
          timestamp: new Date(),
        }),
      ],
    );

    res.json({
      success: true,
      message: "Đã cập nhật trạng thái địa điểm",
    });
  } catch (error: unknown) {
    console.error("Lỗi cập nhật trạng thái địa điểm từ check-in:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi cập nhật địa điểm",
    });
  }
};

export const deleteCheckin = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const adminId = req.userId;

    if (!adminId) {
      res.status(401).json({ success: false, message: "Chưa xác thực" });
      return;
    }

    const [result] = await pool.query(
      `DELETE FROM checkins WHERE checkin_id = ?`,
      [id],
    );

    const affected = (result as unknown as { affectedRows: number })
      .affectedRows;
    if (!affected) {
      res
        .status(404)
        .json({ success: false, message: "Không tìm thấy check-in" });
      return;
    }

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
      [
        adminId,
        "DELETE_CHECKIN",
        JSON.stringify({ checkinId: id, timestamp: new Date() }),
      ],
    );

    res.json({ success: true, message: "Đã xóa check-in" });
  } catch (error: unknown) {
    console.error("Lỗi xóa check-in:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi xóa check-in",
    });
  }
};

export const getOwnerById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;

    // NOTE: Avoid `SELECT u.*, op.*` to prevent column collisions and to
    // ensure fallback defaults (commission_rate=2.5, approval_status='pending').
    const [ownerRows] = await pool.query<RowDataPacket[]>(
      `SELECT
         u.user_id,
         u.email,
         u.phone,
         u.full_name,
         u.avatar_url,
         u.is_verified,
         u.status,
         u.created_at,
         COALESCE(op.approval_status, 'pending') AS approval_status,
         COALESCE(op.commission_rate, 2.5) AS commission_rate,
         COALESCE(op.total_revenue, 0) AS total_revenue,
         COALESCE(op.membership_level, 'basic') AS membership_level,
         (
           SELECT COUNT(*)
           FROM locations l
           WHERE l.owner_id = u.user_id
         ) AS total_locations
       FROM users u
       LEFT JOIN owner_profiles op ON u.user_id = op.owner_id
       WHERE u.user_id = ? AND u.role = 'owner'
       LIMIT 1`,
      [Number(id)],
    );

    if (!ownerRows[0]) {
      res.status(404).json({ success: false, message: "Không tìm thấy owner" });
      return;
    }

    const [profileRows] = await pool.query<RowDataPacket[]>(
      `SELECT
         bank_account,
         bank_name,
         account_holder,
         business_license,
         cccd_number,
         cccd_front_url,
         cccd_back_url,
         terms_accepted_at,
         terms_accepted_ip
       FROM owner_profiles
       WHERE owner_id = ?
       LIMIT 1`,
      [Number(id)],
    );

    res.json({
      success: true,
      data: {
        owner: ownerRows[0],
        owner_profile: profileRows[0] || null,
      },
    });
  } catch (error: any) {
    console.error("Lỗi lấy chi tiết owner:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy chi tiết owner",
    });
  }
};

export const approveOwner = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const adminId = (req as any).userId;

    const ownerId = Number(id);
    if (!Number.isFinite(ownerId)) {
      res
        .status(400)
        .json({ success: false, message: "Owner ID không hợp lệ" });
      return;
    }

    // Update profile row; if missing, create with placeholder bank fields (schema requires NOT NULL).
    const [updateResult] = await pool.query(
      `UPDATE owner_profiles
       SET approval_status = 'approved',
           approved_at = NOW(),
           approved_by = ?
       WHERE owner_id = ?`,
      [adminId, ownerId],
    );

    const affectedRows = (updateResult as unknown as { affectedRows?: number })
      .affectedRows;
    if (!affectedRows) {
      const [uRows] = await pool.query<RowDataPacket[]>(
        `SELECT full_name FROM users WHERE user_id = ? AND role = 'owner' LIMIT 1`,
        [ownerId],
      );
      const holder = String(uRows?.[0]?.full_name || "Owner");

      await pool.query(
        `INSERT INTO owner_profiles (
          owner_id,
          bank_account,
          bank_name,
          account_holder,
          contact_info,
          membership_level,
          commission_rate,
          total_revenue,
          approval_status,
          approved_at,
          approved_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'approved', NOW(), ?)`,
        [
          ownerId,
          "Chưa cập nhật",
          "Chưa cập nhật",
          holder,
          null,
          "basic",
          2.5,
          0,
          adminId,
        ],
      );
    }

    // Vì sao: owner đã được admin duyệt thì trạng thái user chuyển sang active (nếu đang pending)
    await pool.query(
      `UPDATE users
       SET status = CASE WHEN status = 'pending' THEN 'active' ELSE status END,
           updated_at = NOW()
       WHERE user_id = ? AND role = 'owner'`,
      [ownerId],
    );

    // Ghi log
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
      [
        adminId,
        "APPROVE_OWNER",
        JSON.stringify({ ownerId: id, timestamp: new Date() }),
      ],
    );

    res.json({
      success: true,
      message: "Duyệt owner thành công",
    });
  } catch (error: any) {
    console.error("Lỗi duyệt owner:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi duyệt owner",
    });
  }
};

export const rejectOwner = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = (req as any).userId;

    const ownerId = Number(id);
    if (!Number.isFinite(ownerId)) {
      res
        .status(400)
        .json({ success: false, message: "Owner ID không hợp lệ" });
      return;
    }

    const [updateResult] = await pool.query(
      `UPDATE owner_profiles
       SET approval_status = 'rejected',
           approved_by = ?
       WHERE owner_id = ?`,
      [adminId, ownerId],
    );

    const affectedRows = (updateResult as unknown as { affectedRows?: number })
      .affectedRows;
    if (!affectedRows) {
      const [uRows] = await pool.query<RowDataPacket[]>(
        `SELECT full_name FROM users WHERE user_id = ? AND role = 'owner' LIMIT 1`,
        [ownerId],
      );
      const holder = String(uRows?.[0]?.full_name || "Owner");

      await pool.query(
        `INSERT INTO owner_profiles (
          owner_id,
          bank_account,
          bank_name,
          account_holder,
          contact_info,
          membership_level,
          commission_rate,
          total_revenue,
          approval_status,
          approved_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'rejected', ?)`,
        [
          ownerId,
          "Chưa cập nhật",
          "Chưa cập nhật",
          holder,
          null,
          "basic",
          2.5,
          0,
          adminId,
        ],
      );
    }

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
      [
        adminId,
        "REJECT_OWNER",
        JSON.stringify({ ownerId: id, reason, timestamp: new Date() }),
      ],
    );

    res.json({
      success: true,
      message: "Từ chối owner thành công",
    });
  } catch (error: any) {
    console.error("Lỗi từ chối owner:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi từ chối owner",
    });
  }
};

export const getOwnerLocations = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM locations WHERE owner_id = ? ORDER BY created_at DESC`,
      [id],
    );

    res.json({
      success: true,
      data: rows,
    });
  } catch (error: any) {
    console.error("Lỗi lấy danh sách locations:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy danh sách địa điểm",
    });
  }
};

export const getAdminLocations = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const {
      status,
      search,
      owner_id,
      page = "1",
      limit = "20",
    } = req.query as {
      status?: string;
      search?: string;
      owner_id?: string;
      page?: string;
      limit?: string;
    };

    const offset = (Number(page) - 1) * Number(limit);

    const allowedStatus = [
      "pending",
      "active",
      "inactive",
      // Backward-compat
      "approved",
      "rejected",
    ] as const;

    const isAllowedStatus = (v: unknown): v is (typeof allowedStatus)[number] =>
      typeof v === "string" && (allowedStatus as readonly string[]).includes(v);

    const normalizeStatus = (v: string): string => {
      if (v === "approved") return "active";
      if (v === "rejected") return "inactive";
      return v;
    };

    let query = `
      SELECT
        l.location_id,
        l.owner_id,
        COALESCE(l.commission_rate, 2.5) AS commission_rate,
        u.full_name as owner_name,
        u.email as owner_email,
        l.location_name,
        l.location_type,
        l.first_image,
        l.address,
        l.province,
        l.latitude,
        l.longitude,
        l.opening_hours,
        l.status,
        l.rejection_reason,
        l.created_at,
        l.updated_at
      FROM locations l
      JOIN users u ON l.owner_id = u.user_id
      WHERE 1=1
    `;
    const params: Array<string | number> = [];

    if (isAllowedStatus(status)) {
      query += ` AND l.status = ?`;
      params.push(normalizeStatus(status));
    }

    if (typeof owner_id === "string" && owner_id.trim() !== "") {
      const oid = Number(owner_id);
      if (Number.isFinite(oid)) {
        query += ` AND l.owner_id = ?`;
        params.push(oid);
      }
    }

    if (typeof search === "string" && search.trim() !== "") {
      const st = `%${search.trim()}%`;
      query += ` AND (
        l.location_name LIKE ? OR l.address LIKE ? OR l.province LIKE ? OR
        u.full_name LIKE ? OR u.email LIKE ?
      )`;
      params.push(st, st, st, st, st);
    }

    query += ` ORDER BY l.created_at DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), offset);

    const [rows] = await pool.query<RowDataPacket[]>(query, params);

    let countQuery = `
      SELECT COUNT(*) as total
      FROM locations l
      JOIN users u ON l.owner_id = u.user_id
      WHERE 1=1
    `;
    const countParams: Array<string | number> = [];

    if (isAllowedStatus(status)) {
      countQuery += ` AND l.status = ?`;
      countParams.push(normalizeStatus(status));
    }

    if (typeof owner_id === "string" && owner_id.trim() !== "") {
      const oid = Number(owner_id);
      if (Number.isFinite(oid)) {
        countQuery += ` AND l.owner_id = ?`;
        countParams.push(oid);
      }
    }

    if (typeof search === "string" && search.trim() !== "") {
      const st = `%${search.trim()}%`;
      countQuery += ` AND (
        l.location_name LIKE ? OR l.address LIKE ? OR l.province LIKE ? OR
        u.full_name LIKE ? OR u.email LIKE ?
      )`;
      countParams.push(st, st, st, st, st);
    }

    const [countRows] = await pool.query<RowDataPacket[]>(
      countQuery,
      countParams,
    );

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: countRows[0]?.total || 0,
        page: Number(page),
        limit: Number(limit),
      },
    });
  } catch (error: unknown) {
    console.error("Lỗi lấy danh sách locations (admin):", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy danh sách địa điểm",
    });
  }
};

export const approveLocation = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const adminId = (req as any).userId;

    const [ownerRows] = await pool.query<RowDataPacket[]>(
      `SELECT u.status as owner_status, u.user_id as owner_id, l.location_name
       FROM locations l
       JOIN users u ON l.owner_id = u.user_id
       WHERE l.location_id = ?
       LIMIT 1`,
      [id],
    );

    if (ownerRows.length === 0) {
      res
        .status(404)
        .json({ success: false, message: "Không tìm thấy địa điểm" });
      return;
    }

    if (String(ownerRows[0].owner_status) === "locked") {
      res.status(400).json({
        success: false,
        message: "Owner đang bị khóa, không thể mở địa điểm",
      });
      return;
    }

    await pool.query(
      `UPDATE locations
       SET status = 'active', previous_status = NULL, updated_at = NOW()
       WHERE location_id = ?`,
      [id],
    );

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
      [
        adminId,
        "APPROVE_LOCATION",
        JSON.stringify({ locationId: id, timestamp: new Date() }),
      ],
    );

    const ownerId = Number(ownerRows[0]?.owner_id || 0);
    if (Number.isFinite(ownerId) && ownerId > 0) {
      try {
        await sendPushNotification({
          title: "Địa điểm đã được duyệt",
          body: `${String(ownerRows[0]?.location_name || "Địa điểm")} đã được Admin duyệt hoạt động.`,
          targetAudience: "specific_user",
          targetUserId: ownerId,
          sentBy: adminId,
        });
      } catch (notifyError) {
        console.error("Không gửi được thông báo duyệt địa điểm:", notifyError);
      }
    }

    res.json({
      success: true,
      message: "Duyệt địa điểm thành công",
    });
  } catch (error: any) {
    console.error("Lỗi duyệt location:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi duyệt địa điểm",
    });
  }
};

export const rejectLocation = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = (req as any).userId;

    const [ownerRows] = await pool.query<RowDataPacket[]>(
      `SELECT l.location_name, u.user_id as owner_id
       FROM locations l
       JOIN users u ON l.owner_id = u.user_id
       WHERE l.location_id = ?
       LIMIT 1`,
      [id],
    );

    await pool.query(
      `UPDATE locations 
       SET status = 'inactive', 
           rejection_reason = ?, 
           updated_at = NOW() 
       WHERE location_id = ?`,
      [reason, id],
    );

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
      [
        adminId,
        "REJECT_LOCATION",
        JSON.stringify({ locationId: id, reason, timestamp: new Date() }),
      ],
    );

    const ownerId = Number(ownerRows[0]?.owner_id || 0);
    if (Number.isFinite(ownerId) && ownerId > 0) {
      try {
        await sendPushNotification({
          title: "Địa điểm bị từ chối",
          body: `${String(ownerRows[0]?.location_name || "Địa điểm")} bị từ chối duyệt. ${reason ? `Lý do: ${String(reason)}` : ""}`.trim(),
          targetAudience: "specific_user",
          targetUserId: ownerId,
          sentBy: adminId,
        });
      } catch (notifyError) {
        console.error(
          "Không gửi được thông báo từ chối địa điểm:",
          notifyError,
        );
      }
    }

    res.json({
      success: true,
      message: "Từ chối địa điểm thành công",
    });
  } catch (error: any) {
    console.error("Lỗi từ chối location:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi từ chối địa điểm",
    });
  }
};

export const hideLocation = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const adminId = (req as any).userId;

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT location_id, status, location_name, owner_id
       FROM locations
       WHERE location_id = ? AND deleted_at IS NULL
       LIMIT 1`,
      [id],
    );

    if (!rows[0]) {
      res
        .status(404)
        .json({ success: false, message: "Không tìm thấy địa điểm" });
      return;
    }

    const currentStatus = String((rows[0] as any).status || "");
    if (currentStatus !== "active") {
      res.status(400).json({
        success: false,
        message: "Chỉ có thể tạm ẩn địa điểm đang hoạt động",
      });
      return;
    }

    await pool.query(
      `UPDATE locations
       SET status = 'inactive', previous_status = 'active', rejection_reason = NULL, updated_at = NOW()
       WHERE location_id = ? AND deleted_at IS NULL`,
      [id],
    );

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
      [
        adminId,
        "HIDE_LOCATION",
        JSON.stringify({ locationId: id, timestamp: new Date() }),
      ],
    );

    const ownerId = Number(rows[0]?.owner_id || 0);
    if (Number.isFinite(ownerId) && ownerId > 0) {
      try {
        await sendPushNotification({
          title: "Admin đã tạm ẩn địa điểm",
          body: `Địa điểm ${String(rows[0]?.location_name || "")} đã được Admin tạm ẩn để kiểm duyệt/bảo trì thông tin.`,
          targetAudience: "specific_user",
          targetUserId: ownerId,
          sentBy: adminId,
        });
      } catch (notifyError) {
        console.error("Không gửi được thông báo tạm ẩn địa điểm:", notifyError);
      }
    }

    res.json({ success: true, message: "Đã tạm ẩn địa điểm" });
  } catch (error: any) {
    console.error("Lỗi hideLocation:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi tạm ẩn địa điểm",
    });
  }
};

export const getAdminOwnerRevenueSummary = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const ownerId = Number(req.params.id);
    const locationIdRaw = req.query.location_id;
    const rangeRaw = req.query.range;
    const dateRaw = req.query.date;

    if (!Number.isFinite(ownerId)) {
      res
        .status(400)
        .json({ success: false, message: "owner_id không hợp lệ" });
      return;
    }

    const locationId =
      locationIdRaw == null || String(locationIdRaw).trim() === ""
        ? null
        : Number(locationIdRaw);
    if (locationId !== null && !Number.isFinite(locationId)) {
      res
        .status(400)
        .json({ success: false, message: "location_id không hợp lệ" });
      return;
    }

    const allowedRanges = ["today", "week", "month", "year", "all"] as const;
    type RangePreset = (typeof allowedRanges)[number];
    const range: RangePreset =
      typeof rangeRaw === "string" &&
      (allowedRanges as readonly string[]).includes(rangeRaw)
        ? (rangeRaw as RangePreset)
        : "all";

    const date =
      typeof dateRaw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateRaw)
        ? dateRaw
        : null;

    const where: string[] = ["p.status = 'completed'", "l.owner_id = ?"];
    const params: Array<string | number> = [ownerId];

    if (locationId !== null) {
      where.push("p.location_id = ?");
      params.push(locationId);
    }

    if (date) {
      where.push("DATE(p.payment_time) = ?");
      params.push(date);
    } else if (range === "today") {
      where.push("DATE(p.payment_time) = CURDATE()");
    } else if (range === "week") {
      where.push("p.payment_time >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)");
    } else if (range === "month") {
      where.push("p.payment_time >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH)");
    } else if (range === "year") {
      where.push("p.payment_time >= DATE_SUB(CURDATE(), INTERVAL 1 YEAR)");
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
         COALESCE(NULLIF(b.contact_name, ''), bu.full_name) AS booking_contact_name,
         COALESCE(NULLIF(b.contact_phone, ''), bu.phone) AS booking_contact_phone
       FROM payments p
       JOIN locations l ON l.location_id = p.location_id
       LEFT JOIN bookings b ON b.booking_id = p.booking_id
       LEFT JOIN users bu ON bu.user_id = b.user_id
       WHERE ${where.join(" AND ")}`,
      params,
    );

    type RevenueAccumulator = {
      total: { amount: number; cash: number; transfer: number };
      onsite: { amount: number; cash: number; transfer: number };
      booking: { amount: number; cash: number; transfer: number };
    };

    const createAccumulator = (): RevenueAccumulator => ({
      total: { amount: 0, cash: 0, transfer: 0 },
      onsite: { amount: 0, cash: 0, transfer: 0 },
      booking: { amount: 0, cash: 0, transfer: 0 },
    });

    const ownerSummary = createAccumulator();
    const locationMap = new Map<
      number,
      { location_name: string; summary: RevenueAccumulator }
    >();

    const normalizeText = (value: unknown): string =>
      String(value || "")
        .trim()
        .toLowerCase();

    const normalizePaymentMethod = (
      value: unknown,
    ): "cash" | "transfer" | "other" => {
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

    const hasText = (value: unknown): boolean =>
      Boolean(String(value || "").trim());

    const hasBookerFromQr = (qrRaw: unknown): boolean => {
      const qr = parseLooseJson(qrRaw);
      if (!qr) return false;

      const hotelInvoice = qr.hotel_invoice as
        | Record<string, unknown>
        | undefined;
      if (hotelInvoice) {
        if (
          hasText(hotelInvoice.guest_name) ||
          hasText(hotelInvoice.guest_phone)
        ) {
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

      const touristInvoice = qr.tourist_invoice as
        | Record<string, unknown>
        | undefined;
      if (touristInvoice) {
        if (
          hasText(touristInvoice.buyer_name) ||
          hasText(touristInvoice.buyer_phone)
        ) {
          return true;
        }
      }

      return false;
    };

    const addToSummary = (
      acc: RevenueAccumulator,
      bucket: "onsite" | "booking",
      amount: number,
      method: "cash" | "transfer" | "other",
    ) => {
      acc.total.amount += amount;
      if (method === "cash") acc.total.cash += amount;
      if (method === "transfer") acc.total.transfer += amount;

      acc[bucket].amount += amount;
      if (method === "cash") acc[bucket].cash += amount;
      if (method === "transfer") acc[bucket].transfer += amount;
    };

    for (const row of paymentRows) {
      const locationIdInRow = Number(row.location_id);
      if (!Number.isFinite(locationIdInRow)) continue;

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

      // Quy tắc nghiệp vụ mới:
      // - Không có người đặt trước => tại địa điểm
      // - Có người đặt trước => đặt trước (kể cả hóa đơn gộp: có thể tách cash/transfer theo từng dòng chi tiết)
      const bucket: "onsite" | "booking" = hasBookerInfo ? "booking" : "onsite";

      const methodSource =
        (row as any).payment_method ||
        (notes as any)?.payment_method ||
        (isFoodOrTable
          ? (notes as any)?.prepaid_payment_method ||
            (notes as any)?.onsite_payment_method
          : null);
      const method = normalizePaymentMethod(methodSource);

      addToSummary(ownerSummary, bucket, amount, method);

      if (!locationMap.has(locationIdInRow)) {
        locationMap.set(locationIdInRow, {
          location_name: String(row.location_name || ""),
          summary: createAccumulator(),
        });
      }
      addToSummary(
        locationMap.get(locationIdInRow)!.summary,
        bucket,
        amount,
        method,
      );
    }

    const toMoney = (n: number) => Number(n.toFixed(2));
    const normalizeSummary = (acc: RevenueAccumulator) => ({
      total: {
        amount: toMoney(acc.total.amount),
        cash: toMoney(acc.total.cash),
        transfer: toMoney(acc.total.transfer),
      },
      onsite: {
        amount: toMoney(acc.onsite.amount),
        cash: toMoney(acc.onsite.cash),
        transfer: toMoney(acc.onsite.transfer),
      },
      booking: {
        amount: toMoney(acc.booking.amount),
        cash: toMoney(acc.booking.cash),
        transfer: toMoney(acc.booking.transfer),
      },
    });

    const location_summaries = Array.from(locationMap.entries())
      .map(([locId, data]) => ({
        location_id: locId,
        location_name: data.location_name,
        ...normalizeSummary(data.summary),
      }))
      .sort((a, b) => a.location_name.localeCompare(b.location_name, "vi"));

    res.json({
      success: true,
      data: {
        owner_id: ownerId,
        location_id: locationId,
        range,
        date,
        owner_summary: normalizeSummary(ownerSummary),
        location_summaries,
      },
    });
  } catch (error: unknown) {
    console.error("Lỗi getAdminOwnerRevenueSummary:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy tổng hợp doanh thu",
    });
  }
};

const normalizeLocationName = (value: string): string => {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
};

interface LocationDupRow extends RowDataPacket {
  location_id: number;
  location_name: string;
  location_type: string;
  province: string | null;
  address: string;
  latitude: number | string | null;
  longitude: number | string | null;
}

const jaccardSimilarity = (a: string, b: string): number => {
  const tokensA = new Set(a.split(" ").filter(Boolean));
  const tokensB = new Set(b.split(" ").filter(Boolean));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let inter = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) inter += 1;
  }
  const union = tokensA.size + tokensB.size - inter;
  return union === 0 ? 0 : inter / union;
};

const haversineMeters = (
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number => {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sin1 = Math.sin(dLat / 2);
  const sin2 = Math.sin(dLng / 2);
  const h = sin1 * sin1 + Math.cos(lat1) * Math.cos(lat2) * sin2 * sin2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
};

export const getLocationDuplicates = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const distance = Number(req.query.distance ?? 200);
    const similarity = Number(req.query.similarity ?? 0.7);
    const maxDistance = Number.isFinite(distance) ? distance : 200;
    const minSimilarity = Number.isFinite(similarity) ? similarity : 0.7;

    const [rows] = await pool.query<LocationDupRow[]>(
      `SELECT location_id, location_name, location_type, province, address, latitude, longitude
       FROM locations
       WHERE latitude IS NOT NULL AND longitude IS NOT NULL`,
    );

    const normalized = rows.map((r) => ({
      ...r,
      normalized: normalizeLocationName(String(r.location_name || "")),
    })) as Array<LocationDupRow & { normalized: string }>;

    const pairs: Array<Record<string, unknown>> = [];
    for (let i = 0; i < normalized.length; i += 1) {
      for (let j = i + 1; j < normalized.length; j += 1) {
        const a = normalized[i];
        const b = normalized[j];
        if (!a || !b) continue;

        if (a.location_type !== b.location_type) continue;
        if (a.province && b.province && a.province !== b.province) continue;

        const latA = Number(a.latitude);
        const lngA = Number(a.longitude);
        const latB = Number(b.latitude);
        const lngB = Number(b.longitude);
        if (!Number.isFinite(latA) || !Number.isFinite(lngA)) continue;
        if (!Number.isFinite(latB) || !Number.isFinite(lngB)) continue;

        const dist = haversineMeters(
          { lat: latA, lng: lngA },
          { lat: latB, lng: lngB },
        );
        if (dist > maxDistance) continue;

        const sim = jaccardSimilarity(a.normalized, b.normalized);
        if (sim < minSimilarity) continue;

        pairs.push({
          source: a,
          target: b,
          distance_m: Math.round(dist),
          similarity: Number(sim.toFixed(2)),
        });
      }
    }

    res.json({ success: true, data: pairs });
  } catch (error) {
    console.error("Lỗi tìm địa điểm trùng:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const mergeLocations = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { source_id, target_id } = req.body as {
      source_id?: number;
      target_id?: number;
    };
    const adminId = (req as any).userId;

    const sourceId = Number(source_id);
    const targetId = Number(target_id);
    if (!Number.isFinite(sourceId) || !Number.isFinite(targetId)) {
      res.status(400).json({ success: false, message: "Thiếu ID hợp lệ" });
      return;
    }
    if (sourceId === targetId) {
      res.status(400).json({ success: false, message: "ID không hợp lệ" });
      return;
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM locations WHERE location_id IN (?, ?)`,
      [sourceId, targetId],
    );

    const source = rows.find((r) => Number(r.location_id) === sourceId);
    const target = rows.find((r) => Number(r.location_id) === targetId);

    if (!source || !target) {
      res
        .status(404)
        .json({ success: false, message: "Không tìm thấy địa điểm" });
      return;
    }

    const sourceReviews = Number(source.total_reviews || 0);
    const targetReviews = Number(target.total_reviews || 0);
    const sourceRating = Number(source.rating || 0);
    const targetRating = Number(target.rating || 0);
    const totalReviews = sourceReviews + targetReviews;
    const mergedRating =
      totalReviews > 0
        ? (sourceRating * sourceReviews + targetRating * targetReviews) /
          totalReviews
        : Math.max(sourceRating, targetRating);
    const totalCheckins =
      Number(source.total_checkins || 0) + Number(target.total_checkins || 0);

    const merged = {
      description: target.description || source.description || null,
      images: target.images || source.images || null,
      opening_hours: target.opening_hours || source.opening_hours || null,
      phone: target.phone || source.phone || null,
      email: target.email || source.email || null,
      website: target.website || source.website || null,
      is_eco_friendly: target.is_eco_friendly || source.is_eco_friendly || 0,
    };

    await pool.query(
      `UPDATE locations
       SET description = ?,
           images = ?,
           opening_hours = ?,
           phone = ?,
           email = ?,
           website = ?,
           is_eco_friendly = ?,
           total_reviews = ?,
           total_checkins = ?,
           rating = ?,
           updated_at = NOW()
       WHERE location_id = ?`,
      [
        merged.description,
        merged.images,
        merged.opening_hours,
        merged.phone,
        merged.email,
        merged.website,
        merged.is_eco_friendly,
        totalReviews,
        totalCheckins,
        Number.isFinite(mergedRating) ? mergedRating : targetRating,
        targetId,
      ],
    );

    const tables = [
      { table: "checkins", column: "location_id" },
      { table: "bookings", column: "location_id" },
      { table: "employee_locations", column: "location_id" },
      { table: "favorite_locations", column: "location_id" },
      { table: "payments", column: "location_id" },
      { table: "reports", column: "reported_location_id" },
      { table: "reviews", column: "location_id" },
      { table: "services", column: "location_id" },
      { table: "user_diary", column: "location_id" },
      { table: "vouchers", column: "location_id" },
    ];

    for (const t of tables) {
      await pool.query(
        `UPDATE ${t.table} SET ${t.column} = ? WHERE ${t.column} = ?`,
        [targetId, sourceId],
      );
    }

    try {
      await pool.query(
        `UPDATE locations
         SET deleted_at = NOW(), status = 'inactive', updated_at = NOW()
         WHERE location_id = ? AND deleted_at IS NULL`,
        [sourceId],
      );
    } catch {
      await pool.query(`DELETE FROM locations WHERE location_id = ?`, [
        sourceId,
      ]);
    }

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
      [
        adminId,
        "MERGE_LOCATIONS",
        JSON.stringify({ sourceId, targetId, timestamp: new Date() }),
      ],
    );

    res.json({ success: true, message: "Đã gộp địa điểm" });
  } catch (error) {
    console.error("Lỗi gộp địa điểm:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const getCheckinAnalytics = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { from, to } = req.query;
    const endDate = typeof to === "string" ? new Date(to) : new Date();
    const startDate =
      typeof from === "string"
        ? new Date(from)
        : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    const fromSql = startDate.toISOString().slice(0, 19).replace("T", " ");
    const toSql = endDate.toISOString().slice(0, 19).replace("T", " ");

    const [byDay] = await pool.query<RowDataPacket[]>(
      `SELECT DATE(c.checkin_time) as date, COUNT(*) as total
       FROM checkins c
       WHERE c.checkin_time BETWEEN ? AND ?
       GROUP BY DATE(c.checkin_time)
       ORDER BY DATE(c.checkin_time) ASC`,
      [fromSql, toSql],
    );

    const [byProvince] = await pool.query<RowDataPacket[]>(
      `SELECT COALESCE(l.province, 'Không rõ') as province, COUNT(*) as total
       FROM checkins c
       JOIN locations l ON c.location_id = l.location_id
       WHERE c.checkin_time BETWEEN ? AND ?
       GROUP BY l.province
       ORDER BY total DESC`,
      [fromSql, toSql],
    );

    const [byType] = await pool.query<RowDataPacket[]>(
      `SELECT l.location_type, COUNT(*) as total
       FROM checkins c
       JOIN locations l ON c.location_id = l.location_id
       WHERE c.checkin_time BETWEEN ? AND ?
       GROUP BY l.location_type
       ORDER BY total DESC`,
      [fromSql, toSql],
    );

    res.json({
      success: true,
      data: {
        from: fromSql,
        to: toSql,
        by_day: byDay,
        by_province: byProvince,
        by_type: byType,
      },
    });
  } catch (error) {
    console.error("Lỗi lấy analytics:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

// ==================== QUẢN LÝ COMMISSION ====================
export const getCommissions = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const {
      status,
      owner_id,
      from,
      to,
      export: exportFormat,
      page = "1",
      limit = "20",
    } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = `
      SELECT 
        c.*,
        u.user_id as owner_id,
        u.full_name as owner_name,
        u.email as owner_email,
        u.status as owner_status,
        p.amount as payment_amount
      FROM commissions c
      JOIN users u ON c.owner_id = u.user_id
      JOIN payments p ON c.payment_id = p.payment_id
    `;
    const params: Array<string | number> = [];

    let hasWhere = false;
    const addWhere = (
      clause: string,
      ...clauseParams: Array<string | number>
    ) => {
      query += hasWhere ? ` AND ${clause}` : ` WHERE ${clause}`;
      params.push(...clauseParams);
      hasWhere = true;
    };

    if (status) {
      addWhere(`c.status = ?`, String(status));
    }

    if (
      owner_id !== undefined &&
      owner_id !== null &&
      String(owner_id).trim()
    ) {
      const ownerIdNum = Number(owner_id);
      if (!Number.isFinite(ownerIdNum)) {
        res.status(400).json({
          success: false,
          message: "Owner ID không hợp lệ",
        });
        return;
      }
      addWhere(`c.owner_id = ?`, ownerIdNum);
    }

    if (from) {
      addWhere(`c.due_date >= ?`, String(from));
    }

    if (to) {
      addWhere(`c.due_date <= ?`, String(to));
    }

    // Vì sao: export CSV phục vụ báo cáo tổng hợp theo thời gian.
    if (exportFormat === "csv") {
      query += ` ORDER BY c.due_date DESC`;
      const [csvRows] = await pool.query<RowDataPacket[]>(query, params);

      const header =
        "commission_id,owner_name,owner_email,commission_amount,vat_amount,total_due,paid_amount,due_date,status\n";
      const escape = (v: unknown): string => {
        const s = String(v ?? "");
        const escaped = s.replace(/\r?\n/g, " ").replace(/"/g, '""');
        return `"${escaped}"`;
      };
      const lines = csvRows
        .map((r) =>
          [
            r.commission_id,
            r.owner_name,
            r.owner_email,
            r.commission_amount,
            r.vat_amount,
            r.total_due,
            r.paid_amount,
            r.due_date,
            r.status,
          ]
            .map(escape)
            .join(","),
        )
        .join("\n");

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="commissions_${new Date()
          .toISOString()
          .slice(0, 10)}.csv"`,
      );
      res.status(200).send(header + lines + "\n");
      return;
    }

    query += ` ORDER BY c.due_date DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), offset);

    const [rows] = await pool.query<RowDataPacket[]>(query, params);

    // Tổng hợp số tiền theo trạng thái nên nằm ở backend để:
    // - Website chỉ render (tránh sai lệch do tính trên 1 page)
    // - Mobile sau này dùng lại đúng cùng một nguồn dữ liệu
    const toNumberOrZero = (value: unknown): number => {
      // MySQL DECIMAL thường trả về string, nên cần parse an toàn
      if (typeof value === "number" && Number.isFinite(value)) return value;
      if (typeof value === "string") {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
      }
      return 0;
    };

    const summaryWhereParts: string[] = [];
    const summaryParams: Array<string> = [];
    if (status) {
      summaryWhereParts.push("status = ?");
      summaryParams.push(String(status));
    }
    if (
      owner_id !== undefined &&
      owner_id !== null &&
      String(owner_id).trim()
    ) {
      summaryWhereParts.push("owner_id = ?");
      summaryParams.push(String(owner_id));
    }
    if (from) {
      summaryWhereParts.push("due_date >= ?");
      summaryParams.push(String(from));
    }
    if (to) {
      summaryWhereParts.push("due_date <= ?");
      summaryParams.push(String(to));
    }
    const summaryWhere = summaryWhereParts.length
      ? `WHERE ${summaryWhereParts.join(" AND ")}`
      : "";
    const [summaryRows] = await pool.query<RowDataPacket[]>(
      `SELECT
         COALESCE(SUM(CASE WHEN status = 'pending' THEN total_due ELSE 0 END), 0) AS total_pending,
         COALESCE(SUM(CASE WHEN status = 'paid' THEN paid_amount ELSE 0 END), 0) AS total_paid,
         COALESCE(SUM(CASE WHEN status = 'overdue' THEN total_due ELSE 0 END), 0) AS total_overdue
       FROM commissions
       ${summaryWhere}`,
      summaryParams,
    );

    const summaryRow = summaryRows[0] || ({} as RowDataPacket);
    const summary = {
      total_pending: toNumberOrZero(summaryRow.total_pending),
      total_paid: toNumberOrZero(summaryRow.total_paid),
      total_overdue: toNumberOrZero(summaryRow.total_overdue),
    };

    const countWhereParts: string[] = [];
    const countParams: Array<string> = [];
    if (status) {
      countWhereParts.push("status = ?");
      countParams.push(String(status));
    }
    if (
      owner_id !== undefined &&
      owner_id !== null &&
      String(owner_id).trim()
    ) {
      countWhereParts.push("owner_id = ?");
      countParams.push(String(owner_id));
    }
    if (from) {
      countWhereParts.push("due_date >= ?");
      countParams.push(String(from));
    }
    if (to) {
      countWhereParts.push("due_date <= ?");
      countParams.push(String(to));
    }
    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM commissions ${
        countWhereParts.length ? `WHERE ${countWhereParts.join(" AND ")}` : ""
      }`,
      countParams,
    );

    res.json({
      success: true,
      data: rows,
      summary,
      pagination: {
        total: countRows[0]?.total || 0,
        page: Number(page),
        limit: Number(limit),
      },
    });
  } catch (error: unknown) {
    console.error("Lỗi lấy danh sách commissions:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy danh sách hoa hồng",
    });
  }
};

export const remindCommission = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const adminId = (req as any).userId;

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT c.commission_id, c.owner_id, c.total_due, c.status,
              u.full_name, u.email
       FROM commissions c
       JOIN users u ON c.owner_id = u.user_id
       WHERE c.commission_id = ?`,
      [id],
    );

    if (rows.length === 0) {
      res.status(404).json({
        success: false,
        message: "Không tìm thấy commission",
      });
      return;
    }

    const commission = rows[0];

    await pool.query(
      `INSERT INTO push_notifications (title, body, target_audience, sent_by)
       VALUES (?, ?, ?, ?)`,
      [
        "Nhắc nhở thanh toán hoa hồng",
        JSON.stringify({
          owner_id: commission.owner_id,
          commission_id: commission.commission_id,
          total_due: commission.total_due,
        }),
        "specific_user",
        adminId,
      ],
    );

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details)
       VALUES (?, ?, ?)`,
      [
        adminId,
        "REMIND_COMMISSION_DEBT",
        JSON.stringify({
          commissionId: commission.commission_id,
          ownerId: commission.owner_id,
          totalDue: commission.total_due,
          timestamp: new Date(),
        }),
      ],
    );

    res.json({
      success: true,
      message: "Đã gửi nhắc nhở thanh toán hoa hồng",
    });
  } catch (error: any) {
    console.error("Lỗi nhắc nhở commission:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi nhắc nhở commission",
    });
  }
};

export const hideCommissionLocation = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const adminId = (req as any).userId;

    // Lấy location_id từ commission -> payments
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT c.commission_id, c.owner_id, p.location_id
       FROM commissions c
       JOIN payments p ON c.payment_id = p.payment_id
       WHERE c.commission_id = ?`,
      [id],
    );

    if (rows.length === 0) {
      res.status(404).json({
        success: false,
        message: "Không tìm thấy commission hoặc location liên quan",
      });
      return;
    }

    const data = rows[0];

    await pool.query(
      `UPDATE locations 
       SET status = 'inactive', updated_at = NOW()
       WHERE location_id = ?`,
      [data.location_id],
    );

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details)
       VALUES (?, ?, ?)`,
      [
        adminId,
        "HIDE_LOCATION_FOR_DEBT",
        JSON.stringify({
          commissionId: data.commission_id,
          ownerId: data.owner_id,
          locationId: data.location_id,
          timestamp: new Date(),
        }),
      ],
    );

    res.json({
      success: true,
      message: "Đã tạm ẩn địa điểm liên quan đến commission này",
    });
  } catch (error: any) {
    console.error("Lỗi tạm ẩn địa điểm:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi tạm ẩn địa điểm",
    });
  }
};

export const lockCommissionOwner = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const adminId = (req as any).userId;

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT owner_id
       FROM commissions
       WHERE commission_id = ?`,
      [id],
    );

    if (rows.length === 0) {
      res.status(404).json({
        success: false,
        message: "Không tìm thấy commission",
      });
      return;
    }

    const ownerId = rows[0].owner_id;

    const [employeeRows] = await pool.query<RowDataPacket[]>(
      `SELECT DISTINCT u.user_id, u.status
       FROM users u
       JOIN employee_locations el ON el.employee_id = u.user_id
       WHERE el.owner_id = ? AND u.role = 'employee'
         AND u.status IN ('active','pending')`,
      [ownerId],
    );

    const lockSnapshot = {
      employees: employeeRows.map((row) => ({
        user_id: Number(row.user_id),
        status: String(row.status),
      })),
    };

    await pool.query(
      `UPDATE users
       SET status = 'locked', updated_at = NOW()
       WHERE user_id = ? AND role = 'owner'`,
      [ownerId],
    );

    // Vì sao: khóa owner do nợ hoa hồng thì phải tắt các địa điểm liên quan.
    await pool.query(
      `UPDATE locations
       SET previous_status = status,
           status = 'inactive',
           updated_at = NOW()
       WHERE owner_id = ? AND status IN ('active','pending')`,
      [ownerId],
    );

    if (lockSnapshot.employees.length > 0) {
      const employeeIds = lockSnapshot.employees.map((e) => e.user_id);
      const placeholders = employeeIds.map(() => "?").join(",");
      await pool.query(
        `UPDATE users
         SET status = 'locked', updated_at = NOW()
         WHERE role = 'employee' AND status IN ('active','pending')
           AND user_id IN (${placeholders})`,
        employeeIds,
      );
    }

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details)
       VALUES (?, ?, ?)`,
      [
        adminId,
        "LOCK_OWNER_FOR_DEBT",
        JSON.stringify({
          ownerId,
          commissionId: id,
          lock_snapshot: lockSnapshot,
          timestamp: new Date(),
        }),
      ],
    );

    res.json({
      success: true,
      message: "Đã khóa tài khoản Owner liên quan đến commission này",
    });
  } catch (error: any) {
    console.error("Lỗi khóa owner:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi khóa tài khoản owner",
    });
  }
};

export const getCommissionDetails = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT c.*, u.full_name as owner_name 
       FROM commissions c
       JOIN users u ON c.owner_id = u.user_id
       WHERE c.commission_id = ?`,
      [id],
    );

    if (rows.length === 0) {
      res.status(404).json({
        success: false,
        message: "Không tìm thấy commission",
      });
      return;
    }

    res.json({
      success: true,
      data: rows[0],
    });
  } catch (error: any) {
    console.error("Lỗi lấy chi tiết commission:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy chi tiết hoa hồng",
    });
  }
};

export const deleteCommission = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const adminId = req.userId;

    if (!adminId) {
      res.status(401).json({ success: false, message: "Chưa xác thực" });
      return;
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT status, paid_amount
       FROM commissions
       WHERE commission_id = ?
       LIMIT 1`,
      [id],
    );

    if (rows.length === 0) {
      res.status(404).json({
        success: false,
        message: "Không tìm thấy commission",
      });
      return;
    }

    const status = String(rows[0].status || "");
    const paidAmount = Number(rows[0].paid_amount || 0);
    if (status === "paid" || paidAmount > 0) {
      res.status(400).json({
        success: false,
        message: "Không thể xóa commission đã thanh toán",
      });
      return;
    }

    const [delResult] = await pool.query(
      `DELETE FROM commissions WHERE commission_id = ?`,
      [id],
    );

    const affected = (delResult as unknown as { affectedRows: number })
      .affectedRows;
    if (!affected) {
      res.status(404).json({
        success: false,
        message: "Không tìm thấy commission",
      });
      return;
    }

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
      [
        adminId,
        "DELETE_COMMISSION",
        JSON.stringify({ commissionId: id, timestamp: new Date() }),
      ],
    );

    res.json({ success: true, message: "Đã xóa commission" });
  } catch (error: unknown) {
    console.error("Lỗi xóa commission:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi xóa commission",
    });
  }
};

export const updateCommissionRate = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { owner_id, new_rate, reason } = req.body;
    const adminId = (req as any).userId;

    const ownerId = Number(owner_id);
    const newRate = Number(new_rate);
    if (!Number.isFinite(ownerId)) {
      res
        .status(400)
        .json({ success: false, message: "Owner ID không hợp lệ" });
      return;
    }
    if (!Number.isFinite(newRate) || newRate <= 0) {
      res
        .status(400)
        .json({ success: false, message: "Tỷ lệ hoa hồng không hợp lệ" });
      return;
    }

    // Lấy rate cũ
    const [oldRows] = await pool.query<RowDataPacket[]>(
      `SELECT commission_rate FROM owner_profiles WHERE owner_id = ?`,
      [ownerId],
    );

    const oldRate =
      oldRows && oldRows[0] && oldRows[0].commission_rate != null
        ? Number(oldRows[0].commission_rate)
        : null;

    const [updateResult] = await pool.query(
      `UPDATE owner_profiles SET commission_rate = ? WHERE owner_id = ?`,
      [newRate, ownerId],
    );

    const affectedRows = (updateResult as unknown as { affectedRows?: number })
      .affectedRows;
    if (!affectedRows) {
      const [uRows] = await pool.query<RowDataPacket[]>(
        `SELECT full_name FROM users WHERE user_id = ? AND role = 'owner' LIMIT 1`,
        [ownerId],
      );
      const holder = String(uRows?.[0]?.full_name || "Owner");

      await pool.query(
        `INSERT INTO owner_profiles (
          owner_id,
          bank_account,
          bank_name,
          account_holder,
          contact_info,
          membership_level,
          commission_rate,
          total_revenue,
          approval_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [
          ownerId,
          "Chưa cập nhật",
          "Chưa cập nhật",
          holder,
          null,
          "basic",
          newRate,
          0,
        ],
      );
    }

    // Lưu lịch sử
    await pool.query(
      `INSERT INTO commission_history (owner_id, old_rate, new_rate, changed_by, reason) 
       VALUES (?, ?, ?, ?, ?)`,
      [ownerId, oldRate, newRate, adminId, reason || null],
    );

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
      [
        adminId,
        "UPDATE_COMMISSION_RATE",
        JSON.stringify({
          ownerId,
          oldRate,
          newRate,
          reason: reason || null,
          timestamp: new Date(),
        }),
      ],
    );

    res.json({
      success: true,
      message: "Cập nhật tỷ lệ hoa hồng thành công",
    });
  } catch (error: any) {
    console.error("Lỗi cập nhật commission rate:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi cập nhật tỷ lệ hoa hồng",
    });
  }
};

// ==================== COMMISSION HISTORY ====================
export const getCommissionHistory = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { page = "1", limit = "20" } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
         ch.id,
         ch.owner_id,
         ch.old_rate,
         ch.new_rate,
         ch.changed_by,
         ch.changed_at,
         ch.reason,
         u.full_name as changed_by_name,
         u.email as changed_by_email
       FROM commission_history ch
       LEFT JOIN users u ON ch.changed_by = u.user_id
       WHERE ch.owner_id = ?
       ORDER BY ch.changed_at DESC
       LIMIT ? OFFSET ?`,
      [Number(id), Number(limit), offset],
    );

    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM commission_history WHERE owner_id = ?`,
      [Number(id)],
    );

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: countRows[0]?.total || 0,
        page: Number(page),
        limit: Number(limit),
      },
    });
  } catch (error: unknown) {
    console.error("Lỗi lấy lịch sử hoa hồng:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy lịch sử hoa hồng",
    });
  }
};

// ==================== COMMISSION PAYMENT REQUESTS ====================
export const getCommissionPaymentRequests = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { page = "1", limit = "20" } = req.query as {
      page?: string;
      limit?: string;
    };

    const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const safePage = Math.max(Number(page) || 1, 1);
    const offset = (safePage - 1) * safeLimit;

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
         al.log_id,
         al.user_id AS owner_id,
         u.full_name AS owner_name,
         u.email AS owner_email,
         al.details,
         al.created_at
       FROM audit_logs al
       JOIN users u ON u.user_id = al.user_id
       WHERE al.action = 'COMMISSION_PAYMENT_REQUEST'
       ORDER BY al.created_at DESC
       LIMIT ? OFFSET ?`,
      [safeLimit, offset],
    );

    const requests = rows.map((r) => {
      let details: any = null;
      try {
        details = r.details ? JSON.parse(String(r.details)) : null;
      } catch {
        details = null;
      }

      const commissionIds = Array.isArray(details?.commission_ids)
        ? details.commission_ids
            .map((x: any) => Number(x))
            .filter(Number.isFinite)
        : [];

      return {
        request_id: Number(r.log_id),
        owner_id: Number(r.owner_id),
        owner_name: String(r.owner_name || ""),
        owner_email: String(r.owner_email || ""),
        total_due: Number(details?.total_due || 0),
        transfer_note: details?.transfer_note || null,
        note: details?.note || null,
        commission_ids: commissionIds,
        created_at: r.created_at,
      };
    });

    // Determine whether each request has been fully paid already.
    const allCommissionIds = Array.from(
      new Set(
        requests.flatMap((r: any) => (r.commission_ids as number[]) || []),
      ),
    );

    let commissionStatusMap = new Map<number, string>();
    if (allCommissionIds.length > 0) {
      const placeholders = allCommissionIds.map(() => "?").join(",");
      const [cRows] = await pool.query<RowDataPacket[]>(
        `SELECT commission_id, status
         FROM commissions
         WHERE commission_id IN (${placeholders})`,
        allCommissionIds,
      );
      commissionStatusMap = new Map(
        cRows.map((c) => [Number(c.commission_id), String(c.status || "")]),
      );
    }

    const enriched = requests.map((r: any) => {
      const ids = (r.commission_ids as number[]) || [];
      const unpaid = ids.filter((id) => commissionStatusMap.get(id) !== "paid");
      return {
        ...r,
        unpaid_count: unpaid.length,
        is_fully_paid: ids.length > 0 && unpaid.length === 0,
      };
    });

    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total
       FROM audit_logs
       WHERE action = 'COMMISSION_PAYMENT_REQUEST'`,
    );

    res.json({
      success: true,
      data: enriched,
      pagination: {
        total: Number(countRows?.[0]?.total || 0),
        page: safePage,
        limit: safeLimit,
      },
    });
  } catch (error: any) {
    console.error("Lỗi lấy danh sách yêu cầu thanh toán:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy danh sách yêu cầu thanh toán",
    });
  }
};

export const markCommissionsPaid = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const adminId = req.userId;
    if (!adminId) {
      res.status(401).json({ success: false, message: "Chưa xác thực" });
      return;
    }

    const commissionIds = Array.isArray((req.body as any)?.commission_ids)
      ? ((req.body as any).commission_ids as any[])
          .map((x) => Number(x))
          .filter(Number.isFinite)
      : [];

    if (commissionIds.length === 0) {
      res
        .status(400)
        .json({ success: false, message: "commission_ids không hợp lệ" });
      return;
    }

    const placeholders = commissionIds.map(() => "?").join(",");
    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE commissions
       SET status = 'paid',
           paid_amount = total_due,
           paid_at = NOW()
       WHERE commission_id IN (${placeholders})
         AND status IN ('pending','overdue')`,
      commissionIds,
    );

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
      [
        adminId,
        "MARK_COMMISSIONS_PAID",
        JSON.stringify({
          commission_ids: commissionIds,
          updated: result.affectedRows,
          timestamp: new Date(),
        }),
      ],
    );

    res.json({
      success: true,
      message: "Đã cập nhật trạng thái commission",
      data: { updated: result.affectedRows },
    });
  } catch (error: any) {
    console.error("Lỗi mark commissions paid:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi cập nhật trạng thái commission",
    });
  }
};

export const confirmCommissionPaymentRequest = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const adminId = req.userId;
    if (!adminId) {
      res.status(401).json({ success: false, message: "Chưa xác thực" });
      return;
    }

    const requestId = Number(req.params.id);
    if (!Number.isFinite(requestId)) {
      res
        .status(400)
        .json({ success: false, message: "request_id không hợp lệ" });
      return;
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT log_id, user_id, details
       FROM audit_logs
       WHERE log_id = ? AND action = 'COMMISSION_PAYMENT_REQUEST'
       LIMIT 1`,
      [requestId],
    );
    if (!rows[0]) {
      res
        .status(404)
        .json({ success: false, message: "Không tìm thấy yêu cầu" });
      return;
    }

    let details: any = null;
    try {
      details = rows[0].details ? JSON.parse(String(rows[0].details)) : null;
    } catch {
      details = null;
    }

    const commissionIds = Array.isArray(details?.commission_ids)
      ? details.commission_ids
          .map((x: any) => Number(x))
          .filter(Number.isFinite)
      : [];

    if (commissionIds.length === 0) {
      res.status(400).json({
        success: false,
        message: "Yêu cầu không có commission_ids hợp lệ",
      });
      return;
    }

    const placeholders = commissionIds.map(() => "?").join(",");
    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE commissions
       SET status = 'paid',
           paid_amount = total_due,
           paid_at = NOW()
       WHERE commission_id IN (${placeholders})
         AND status IN ('pending','overdue')`,
      commissionIds,
    );

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
      [
        adminId,
        "COMMISSION_PAYMENT_CONFIRMED",
        JSON.stringify({
          request_id: requestId,
          owner_id: Number(rows[0].user_id),
          commission_ids: commissionIds,
          updated: result.affectedRows,
          timestamp: new Date(),
        }),
      ],
    );

    res.json({
      success: true,
      message: "Đã xác nhận thanh toán",
      data: { updated: result.affectedRows },
    });
  } catch (error: any) {
    console.error("Lỗi xác nhận yêu cầu thanh toán:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi xác nhận yêu cầu thanh toán",
    });
  }
};

// ==================== QUẢN LÝ REPORTS ====================
export const getReports = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const {
      status,
      report_type,
      severity,
      from,
      to,
      export: exportFormat,
      page = "1",
      limit = "20",
    } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = `
      SELECT 
        r.*,
        u1.full_name as reporter_name,
        u2.full_name as reported_user_name,
        l.location_name as reported_location_name
      FROM reports r
      LEFT JOIN users u1 ON r.reporter_id = u1.user_id
      LEFT JOIN users u2 ON r.reported_user_id = u2.user_id
      LEFT JOIN locations l ON r.reported_location_id = l.location_id
      WHERE 1=1
    `;
    const params: Array<string | number> = [];

    if (status) {
      query += ` AND r.status = ?`;
      params.push(String(status));
    }

    if (report_type) {
      query += ` AND r.report_type = ?`;
      params.push(String(report_type));
    }

    // severity là optional; nếu DB chưa có cột thì sẽ fail → cần migration.
    if (severity) {
      query += ` AND r.severity = ?`;
      params.push(String(severity));
    }

    if (from) {
      query += ` AND r.created_at >= ?`;
      params.push(String(from));
    }
    if (to) {
      query += ` AND r.created_at <= ?`;
      params.push(String(to));
    }

    // Export CSV (không phân trang)
    if (exportFormat === "csv") {
      query += ` ORDER BY r.created_at DESC`;
      const [csvRows] = await pool.query<RowDataPacket[]>(query, params);

      const header =
        "report_id,reporter_name,report_type,severity,status,description,created_at\n";
      const escape = (v: unknown): string => {
        const s = String(v ?? "");
        const escaped = s.replace(/\r?\n/g, " ").replace(/"/g, '""');
        return `"${escaped}"`;
      };
      const lines = csvRows
        .map((r) =>
          [
            r.report_id,
            r.reporter_name,
            r.report_type,
            r.severity ?? "",
            r.status,
            r.description,
            r.created_at,
          ]
            .map(escape)
            .join(","),
        )
        .join("\n");

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="reports_${new Date()
          .toISOString()
          .slice(0, 10)}.csv"`,
      );
      res.status(200).send(header + lines + "\n");
      return;
    }

    query += ` ORDER BY r.created_at DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), offset);

    const [rows] = await pool.query<RowDataPacket[]>(query, params);

    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM reports 
       WHERE 1=1 
       ${status ? "AND status = ?" : ""} 
       ${report_type ? "AND report_type = ?" : ""}
       ${severity ? "AND severity = ?" : ""}
       ${from ? "AND created_at >= ?" : ""}
       ${to ? "AND created_at <= ?" : ""}`,
      [status, report_type, severity, from, to].filter(
        (v): v is string => typeof v === "string" && v.length > 0,
      ),
    );

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: countRows[0]?.total || 0,
        page: Number(page),
        limit: Number(limit),
      },
    });
  } catch (error: unknown) {
    console.error("Lỗi lấy danh sách reports:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy danh sách báo cáo",
    });
  }
};

export const getReportById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT r.*, u1.full_name as reporter_name 
       FROM reports r
       LEFT JOIN users u1 ON r.reporter_id = u1.user_id
       WHERE r.report_id = ?`,
      [id],
    );

    if (rows.length === 0) {
      res.status(404).json({
        success: false,
        message: "Không tìm thấy báo cáo",
      });
      return;
    }

    res.json({
      success: true,
      data: rows[0],
    });
  } catch (error: any) {
    console.error("Lỗi lấy chi tiết report:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy chi tiết báo cáo",
    });
  }
};

export const resolveReport = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, resolution_notes, enforcement } = req.body as {
      status?: "resolved" | "rejected";
      resolution_notes?: string;
      enforcement?: "none" | "ban";
    };
    const adminId = req.userId;

    if (!adminId) {
      res.status(401).json({ success: false, message: "Chưa xác thực" });
      return;
    }

    const nextStatus = String(status || "");
    if (!["resolved", "rejected"].includes(nextStatus)) {
      res.status(400).json({
        success: false,
        message: "Trạng thái không hợp lệ",
      });
      return;
    }

    await pool.query(
      `UPDATE reports 
       SET status = ?, 
           resolved_by = ?, 
           resolved_at = NOW(), 
           resolution_notes = ? 
       WHERE report_id = ?`,
      [nextStatus, adminId, resolution_notes, id],
    );

    if (nextStatus === "resolved" && enforcement === "ban") {
      await ensureAccountBlacklistSchema();

      const [reportRows] = await pool.query<RowDataPacket[]>(
        `SELECT reported_user_id, reported_review_id
         FROM reports
         WHERE report_id = ?
         LIMIT 1`,
        [id],
      );

      let targetUserId = Number(reportRows?.[0]?.reported_user_id || 0);
      if (
        (!Number.isFinite(targetUserId) || targetUserId <= 0) &&
        reportRows?.[0]?.reported_review_id
      ) {
        const [reviewRows] = await pool.query<RowDataPacket[]>(
          `SELECT user_id FROM reviews WHERE review_id = ? LIMIT 1`,
          [reportRows[0].reported_review_id],
        );
        targetUserId = Number(reviewRows?.[0]?.user_id || 0);
      }

      if (Number.isFinite(targetUserId) && targetUserId > 0) {
        const [userRows] = await pool.query<RowDataPacket[]>(
          `SELECT user_id, email, phone FROM users WHERE user_id = ? LIMIT 1`,
          [targetUserId],
        );

        if (userRows.length > 0) {
          const email =
            typeof userRows[0].email === "string" && userRows[0].email.trim()
              ? String(userRows[0].email).trim()
              : null;
          const phone =
            typeof userRows[0].phone === "string" && userRows[0].phone.trim()
              ? String(userRows[0].phone).trim()
              : null;

          await pool.query(
            `UPDATE users SET status = 'locked', updated_at = NOW() WHERE user_id = ?`,
            [targetUserId],
          );

          await pool.query(
            `INSERT INTO account_blacklist (user_id, email, phone, reason, source_report_id, banned_by)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               user_id = VALUES(user_id),
               reason = VALUES(reason),
               source_report_id = VALUES(source_report_id),
               banned_by = VALUES(banned_by),
               created_at = NOW()`,
            [
              targetUserId,
              email,
              phone,
              resolution_notes || "Bị cấm từ xử lý báo cáo",
              Number(id),
              adminId,
            ],
          );

          await sendPushNotification({
            title: "Tài khoản đã bị cấm",
            body: "Tài khoản của bạn đã bị cấm do vi phạm quy định cộng đồng.",
            targetAudience: "specific_user",
            targetUserId,
            sentBy: adminId,
          });

          await pool.query(
            `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
            [
              adminId,
              "BAN_REPORTED_USER",
              JSON.stringify({
                reportId: id,
                targetUserId,
                email,
                phone,
                timestamp: new Date(),
              }),
            ],
          );
        }
      }
    }

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
      [
        adminId,
        "RESOLVE_REPORT",
        JSON.stringify({
          reportId: id,
          status: nextStatus,
          timestamp: new Date(),
        }),
      ],
    );

    res.json({
      success: true,
      message: "Xử lý báo cáo thành công",
    });
  } catch (error: unknown) {
    console.error("Lỗi xử lý report:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi xử lý báo cáo",
    });
  }
};

export const updateReportLockStatus = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body as { status?: "pending" | "reviewing" };
    const adminId = req.userId;

    if (!adminId) {
      res.status(401).json({ success: false, message: "Chưa xác thực" });
      return;
    }

    if (!status || !["pending", "reviewing"].includes(status)) {
      res.status(400).json({
        success: false,
        message: "Trạng thái không hợp lệ",
      });
      return;
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT status FROM reports WHERE report_id = ? LIMIT 1`,
      [id],
    );

    if (rows.length === 0) {
      res.status(404).json({
        success: false,
        message: "Không tìm thấy báo cáo",
      });
      return;
    }

    const currentStatus = String(rows[0].status || "");
    if (["resolved", "rejected"].includes(currentStatus)) {
      res.status(400).json({
        success: false,
        message: "Báo cáo đã xử lý, không thể khóa/mở",
      });
      return;
    }

    await pool.query(`UPDATE reports SET status = ? WHERE report_id = ?`, [
      status,
      id,
    ]);

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
      [
        adminId,
        status === "reviewing" ? "LOCK_REPORT" : "UNLOCK_REPORT",
        JSON.stringify({ reportId: id, status, timestamp: new Date() }),
      ],
    );

    res.json({
      success: true,
      message: "Đã cập nhật trạng thái báo cáo",
    });
  } catch (error: unknown) {
    console.error("Lỗi khóa/mở báo cáo:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi cập nhật báo cáo",
    });
  }
};

export const remindReport = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, body } = req.body as { title?: string; body?: string };
    const adminId = req.userId;

    if (!adminId) {
      res.status(401).json({ success: false, message: "Chưa xác thực" });
      return;
    }

    const [reportRows] = await pool.query<RowDataPacket[]>(
      `SELECT reported_user_id, reported_location_id, reported_review_id
       FROM reports WHERE report_id = ? LIMIT 1`,
      [id],
    );

    if (reportRows.length === 0) {
      res.status(404).json({
        success: false,
        message: "Không tìm thấy báo cáo",
      });
      return;
    }

    let targetUserId: number | null = reportRows[0].reported_user_id ?? null;

    if (!targetUserId && reportRows[0].reported_location_id) {
      const [locRows] = await pool.query<RowDataPacket[]>(
        `SELECT owner_id FROM locations WHERE location_id = ? LIMIT 1`,
        [reportRows[0].reported_location_id],
      );
      targetUserId = locRows[0]?.owner_id ?? null;
    }

    if (!targetUserId && reportRows[0].reported_review_id) {
      const [reviewRows] = await pool.query<RowDataPacket[]>(
        `SELECT l.owner_id
         FROM reviews r
         JOIN locations l ON r.location_id = l.location_id
         WHERE r.review_id = ? LIMIT 1`,
        [reportRows[0].reported_review_id],
      );
      targetUserId = reviewRows[0]?.owner_id ?? null;
    }

    if (!targetUserId) {
      res.status(400).json({
        success: false,
        message: "Không xác định được user/owner liên quan để nhắc nhở",
      });
      return;
    }

    const result = await sendPushNotification({
      title: title || "Nhắc nhở xử lý báo cáo",
      body:
        body ||
        "Báo cáo liên quan cần được phối hợp xử lý. Vui lòng kiểm tra thông tin.",
      targetAudience: "specific_user",
      sentBy: adminId,
      targetUserId,
    });

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
      [
        adminId,
        "REMIND_REPORT",
        JSON.stringify({
          reportId: id,
          targetUserId,
          notificationId: result.notificationId,
          timestamp: new Date(),
        }),
      ],
    );

    res.json({
      success: true,
      message: "Đã gửi nhắc nhở",
    });
  } catch (error: unknown) {
    console.error("Lỗi nhắc nhở báo cáo:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi gửi nhắc nhở",
    });
  }
};

export const deleteReport = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const adminId = req.userId;

    if (!adminId) {
      res.status(401).json({ success: false, message: "Chưa xác thực" });
      return;
    }

    const [delResult] = await pool.query(
      `DELETE FROM reports WHERE report_id = ?`,
      [id],
    );

    const affected = (delResult as unknown as { affectedRows: number })
      .affectedRows;
    if (!affected) {
      res.status(404).json({
        success: false,
        message: "Không tìm thấy báo cáo",
      });
      return;
    }

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
      [
        adminId,
        "DELETE_REPORT",
        JSON.stringify({ reportId: id, timestamp: new Date() }),
      ],
    );

    res.json({ success: true, message: "Đã xóa báo cáo" });
  } catch (error: unknown) {
    console.error("Lỗi xóa báo cáo:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi xóa báo cáo",
    });
  }
};

export const warnReportedUser = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, body } = req.body as { title?: string; body?: string };
    const adminId = req.userId;

    if (!adminId) {
      res.status(401).json({ success: false, message: "Chưa xác thực" });
      return;
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT reported_user_id FROM reports WHERE report_id = ? LIMIT 1`,
      [id],
    );

    const targetUserId = rows[0]?.reported_user_id as number | null;
    if (!targetUserId) {
      res
        .status(400)
        .json({ success: false, message: "Report không có user bị báo cáo" });
      return;
    }

    const result = await sendPushNotification({
      title: title || "Cảnh báo vi phạm",
      body:
        body ||
        "Tài khoản của bạn có báo cáo vi phạm. Vui lòng kiểm tra và tuân thủ quy định.",
      targetAudience: "specific_user",
      sentBy: adminId,
      targetUserId,
    });

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
      [
        adminId,
        "WARN_REPORTED_USER",
        JSON.stringify({
          reportId: id,
          targetUserId,
          notificationId: result.notificationId,
          timestamp: new Date(),
        }),
      ],
    );

    res.json({ success: true, message: "Đã cảnh báo user" });
  } catch (error: unknown) {
    console.error("Lỗi cảnh báo user:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const warnReportedOwner = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, body } = req.body as { title?: string; body?: string };
    const adminId = req.userId;

    if (!adminId) {
      res.status(401).json({ success: false, message: "Chưa xác thực" });
      return;
    }

    const [reportRows] = await pool.query<RowDataPacket[]>(
      `SELECT reported_location_id, reported_review_id FROM reports WHERE report_id = ? LIMIT 1`,
      [id],
    );

    if (!reportRows[0]) {
      res
        .status(404)
        .json({ success: false, message: "Không tìm thấy báo cáo" });
      return;
    }

    let ownerId: number | null = null;
    if (reportRows[0].reported_location_id) {
      const [locRows] = await pool.query<RowDataPacket[]>(
        `SELECT owner_id FROM locations WHERE location_id = ? LIMIT 1`,
        [reportRows[0].reported_location_id],
      );
      ownerId = locRows[0]?.owner_id ?? null;
    } else if (reportRows[0].reported_review_id) {
      const [reviewRows] = await pool.query<RowDataPacket[]>(
        `SELECT l.owner_id
         FROM reviews r
         JOIN locations l ON r.location_id = l.location_id
         WHERE r.review_id = ? LIMIT 1`,
        [reportRows[0].reported_review_id],
      );
      ownerId = reviewRows[0]?.owner_id ?? null;
    }

    if (!ownerId) {
      res.status(400).json({
        success: false,
        message: "Không xác định được owner liên quan",
      });
      return;
    }

    const result = await sendPushNotification({
      title: title || "Cảnh báo vi phạm",
      body:
        body ||
        "Địa điểm của bạn bị báo cáo. Vui lòng kiểm tra và xử lý theo quy định.",
      targetAudience: "specific_user",
      sentBy: adminId,
      targetUserId: ownerId,
    });

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
      [
        adminId,
        "WARN_REPORTED_OWNER",
        JSON.stringify({
          reportId: id,
          ownerId,
          notificationId: result.notificationId,
          timestamp: new Date(),
        }),
      ],
    );

    res.json({ success: true, message: "Đã cảnh báo owner" });
  } catch (error: unknown) {
    console.error("Lỗi cảnh báo owner:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const deleteReportedReview = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const adminId = req.userId;

    if (!adminId) {
      res.status(401).json({ success: false, message: "Chưa xác thực" });
      return;
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT reported_review_id FROM reports WHERE report_id = ? LIMIT 1`,
      [id],
    );

    const reviewId = rows[0]?.reported_review_id as number | null;
    if (!reviewId) {
      res
        .status(400)
        .json({ success: false, message: "Report không có review để xóa" });
      return;
    }

    await pool.query(
      `UPDATE reviews
       SET status = 'deleted', deleted_at = NOW(), deleted_by = ?
       WHERE review_id = ?`,
      [adminId, reviewId],
    );

    const [locRows] = await pool.query<RowDataPacket[]>(
      `SELECT location_id FROM reviews WHERE review_id = ? LIMIT 1`,
      [reviewId],
    );
    const locationId = Number(locRows?.[0]?.location_id || 0);
    if (Number.isFinite(locationId) && locationId > 0) {
      const [summaryRows] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS total_reviews, ROUND(COALESCE(AVG(rating), 0), 1) AS avg_rating
         FROM reviews
         WHERE location_id = ? AND status = 'active'`,
        [locationId],
      );

      await pool.query(
        `UPDATE locations
         SET rating = ?, total_reviews = ?, updated_at = NOW()
         WHERE location_id = ?`,
        [
          Number(summaryRows?.[0]?.avg_rating ?? 0),
          Number(summaryRows?.[0]?.total_reviews ?? 0),
          locationId,
        ],
      );
    }

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
      [
        adminId,
        "DELETE_REPORTED_REVIEW",
        JSON.stringify({ reportId: id, reviewId, timestamp: new Date() }),
      ],
    );

    res.json({ success: true, message: "Đã xóa đánh giá vi phạm" });
  } catch (error: unknown) {
    console.error("Lỗi xóa review vi phạm:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const getAdminReviews = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const {
      owner_id,
      location_id,
      rating,
      status,
      range,
      date,
      page = "1",
      limit = "100",
    } = req.query as Record<string, string | undefined>;

    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(200, Math.max(1, Number(limit) || 100));
    const offset = (safePage - 1) * safeLimit;

    const where: string[] = ["1=1"];
    const params: Array<string | number> = [];

    if (owner_id && Number.isFinite(Number(owner_id))) {
      where.push("l.owner_id = ?");
      params.push(Number(owner_id));
    }
    if (location_id && Number.isFinite(Number(location_id))) {
      where.push("r.location_id = ?");
      params.push(Number(location_id));
    }
    if (rating && Number.isFinite(Number(rating))) {
      where.push("r.rating = ?");
      params.push(Number(rating));
    }
    if (status && ["active", "hidden", "deleted", "pending"].includes(status)) {
      where.push("r.status = ?");
      params.push(status);
    }

    const selectedDate =
      typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)
        ? date
        : null;
    if (selectedDate) {
      where.push("DATE(r.created_at) = ?");
      params.push(selectedDate);
    } else {
      const validRanges = ["today", "week", "month", "year", "all"];
      const mode =
        typeof range === "string" && validRanges.includes(range)
          ? range
          : "all";
      if (mode === "today") {
        where.push("DATE(r.created_at) = CURDATE()");
      } else if (mode === "week") {
        where.push("r.created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)");
      } else if (mode === "month") {
        where.push("r.created_at >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH)");
      } else if (mode === "year") {
        where.push("r.created_at >= DATE_SUB(CURDATE(), INTERVAL 1 YEAR)");
      }
    }

    const sql = `
      SELECT
        r.review_id,
        r.location_id,
        r.user_id,
        r.rating,
        r.comment,
        r.images,
        r.status,
        r.created_at,
        l.location_name,
        l.owner_id,
        ow.full_name AS owner_name,
        ow.email AS owner_email,
        ow.phone AS owner_phone,
        u.full_name AS user_name,
        u.email AS user_email,
        u.phone AS user_phone,
        rr.reply_id,
        rr.content AS reply_content,
        rr.created_at AS reply_created_at,
        rr.created_by AS reply_created_by
      FROM reviews r
      JOIN locations l ON l.location_id = r.location_id
      JOIN users u ON u.user_id = r.user_id
      LEFT JOIN users ow ON ow.user_id = l.owner_id
      LEFT JOIN review_replies rr ON rr.review_id = r.review_id
      WHERE ${where.join(" AND ")}
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?`;

    const [rows] = await pool.query<RowDataPacket[]>(sql, [
      ...params,
      safeLimit,
      offset,
    ]);

    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total
       FROM reviews r
       JOIN locations l ON l.location_id = r.location_id
       WHERE ${where.join(" AND ")}`,
      params,
    );

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: Number(countRows?.[0]?.total ?? 0),
        page: safePage,
        limit: safeLimit,
      },
    });
  } catch (error) {
    console.error("Lỗi lấy danh sách review (admin):", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const deleteAdminReview = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const adminId = req.userId;
    const reviewId = Number(req.params.id);
    if (!adminId) {
      res.status(401).json({ success: false, message: "Chưa xác thực" });
      return;
    }
    if (!Number.isFinite(reviewId)) {
      res.status(400).json({ success: false, message: "Review không hợp lệ" });
      return;
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT location_id FROM reviews WHERE review_id = ? LIMIT 1`,
      [reviewId],
    );
    const locationId = Number(rows?.[0]?.location_id || 0);
    if (!locationId) {
      res
        .status(404)
        .json({ success: false, message: "Không tìm thấy review" });
      return;
    }

    await pool.query(
      `UPDATE reviews
       SET status = 'deleted', deleted_at = NOW(), deleted_by = ?
       WHERE review_id = ?`,
      [adminId, reviewId],
    );

    const [summaryRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total_reviews, ROUND(COALESCE(AVG(rating), 0), 1) AS avg_rating
       FROM reviews
       WHERE location_id = ? AND status = 'active'`,
      [locationId],
    );

    await pool.query(
      `UPDATE locations
       SET rating = ?, total_reviews = ?, updated_at = NOW()
       WHERE location_id = ?`,
      [
        Number(summaryRows?.[0]?.avg_rating ?? 0),
        Number(summaryRows?.[0]?.total_reviews ?? 0),
        locationId,
      ],
    );

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
      [
        adminId,
        "ADMIN_DELETE_REVIEW",
        JSON.stringify({ reviewId, locationId, timestamp: new Date() }),
      ],
    );

    res.json({ success: true, message: "Đã xóa đánh giá" });
  } catch (error) {
    console.error("Lỗi xóa review (admin):", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const reportReviewUserByAdmin = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const adminId = req.userId;
    const reviewId = Number(req.params.id);
    const reason = String((req.body as { reason?: string })?.reason || "")
      .trim()
      .slice(0, 2000);

    if (!adminId) {
      res.status(401).json({ success: false, message: "Chưa xác thực" });
      return;
    }
    if (!Number.isFinite(reviewId)) {
      res.status(400).json({ success: false, message: "Review không hợp lệ" });
      return;
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT r.review_id, r.user_id, r.location_id, r.comment, l.location_name
       FROM reviews r
       JOIN locations l ON l.location_id = r.location_id
       WHERE r.review_id = ?
       LIMIT 1`,
      [reviewId],
    );

    const target = rows[0];
    if (!target) {
      res
        .status(404)
        .json({ success: false, message: "Không tìm thấy review" });
      return;
    }

    const description = [
      "Admin báo cáo review có dấu hiệu vi phạm.",
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
        adminId,
        Number(target.user_id),
        Number(target.location_id),
        reviewId,
        description,
      ],
    );

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
      [
        adminId,
        "ADMIN_REPORT_REVIEW_USER",
        JSON.stringify({ reviewId, timestamp: new Date() }),
      ],
    );

    res.status(201).json({ success: true, message: "Đã tạo báo cáo vi phạm" });
  } catch (error) {
    console.error("Lỗi báo cáo review (admin):", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const deleteOwnerReplyByAdmin = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const adminId = req.userId;
    const reviewId = Number(req.params.id);

    if (!adminId) {
      res.status(401).json({ success: false, message: "Chưa xác thực" });
      return;
    }
    if (!Number.isFinite(reviewId)) {
      res.status(400).json({ success: false, message: "Review không hợp lệ" });
      return;
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT reply_id FROM review_replies WHERE review_id = ? LIMIT 1`,
      [reviewId],
    );
    if (!rows[0]?.reply_id) {
      res
        .status(404)
        .json({ success: false, message: "Không tìm thấy phản hồi của owner" });
      return;
    }

    await pool.query(`DELETE FROM review_replies WHERE review_id = ?`, [
      reviewId,
    ]);

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
      [
        adminId,
        "ADMIN_DELETE_OWNER_REVIEW_REPLY",
        JSON.stringify({ reviewId, timestamp: new Date() }),
      ],
    );

    res.json({ success: true, message: "Đã xóa phản hồi của owner" });
  } catch (error) {
    console.error("Lỗi xóa phản hồi owner (admin):", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const reportOwnerReplyByAdmin = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const adminId = req.userId;
    const reviewId = Number(req.params.id);
    const reason = String((req.body as { reason?: string })?.reason || "")
      .trim()
      .slice(0, 2000);

    if (!adminId) {
      res.status(401).json({ success: false, message: "Chưa xác thực" });
      return;
    }
    if (!Number.isFinite(reviewId)) {
      res.status(400).json({ success: false, message: "Review không hợp lệ" });
      return;
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT r.review_id,
              r.user_id,
              r.location_id,
              r.comment,
              l.location_name,
              l.owner_id,
              ow.full_name AS owner_name,
              rr.content AS reply_content
       FROM reviews r
       JOIN locations l ON l.location_id = r.location_id
       JOIN users ow ON ow.user_id = l.owner_id
       LEFT JOIN review_replies rr ON rr.review_id = r.review_id
       WHERE r.review_id = ?
       LIMIT 1`,
      [reviewId],
    );

    const target = rows[0];
    if (!target) {
      res
        .status(404)
        .json({ success: false, message: "Không tìm thấy review" });
      return;
    }
    if (!target.owner_id) {
      res.status(400).json({ success: false, message: "Không tìm thấy owner" });
      return;
    }

    const description = [
      "Admin báo cáo phản hồi của owner có dấu hiệu vi phạm.",
      `Review ID: ${reviewId}`,
      `Địa điểm: ${String(target.location_name || "-")}`,
      `Owner: ${String(target.owner_name || "-")}`,
      `Nội dung đánh giá user: ${String(target.comment || "(trống)")}`,
      `Phản hồi owner: ${String(target.reply_content || "(trống)")}`,
      reason ? `Lý do bổ sung: ${reason}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    await pool.query<ResultSetHeader>(
      `INSERT INTO reports
       (reporter_id, reported_user_id, reported_owner_id, reported_location_id, reported_review_id, report_type, severity, description)
       VALUES (?, ?, ?, ?, ?, 'inappropriate', 'high', ?)`,
      [
        adminId,
        Number(target.owner_id),
        Number(target.owner_id),
        Number(target.location_id),
        reviewId,
        description,
      ],
    );

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
      [
        adminId,
        "ADMIN_REPORT_OWNER_REVIEW_REPLY",
        JSON.stringify({
          reviewId,
          ownerId: Number(target.owner_id),
          timestamp: new Date(),
        }),
      ],
    );

    res.status(201).json({ success: true, message: "Đã báo cáo owner" });
  } catch (error) {
    console.error("Lỗi báo cáo owner từ review (admin):", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

// ==================== SYSTEM LOGS ====================
export const getSystemLogs = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const {
      user_id,
      action,
      from,
      to,
      export: exportFormat,
      page = "1",
      limit = "50",
    } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = `
      SELECT 
        al.*,
        u.full_name as user_name,
        u.email as user_email
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.user_id
      WHERE 1=1
    `;
    const params: Array<string | number> = [];

    if (user_id) {
      query += ` AND al.user_id = ?`;
      params.push(Number(user_id));
    }

    if (action) {
      query += ` AND al.action LIKE ?`;
      params.push(`%${action}%`);
    }

    if (from) {
      query += ` AND al.created_at >= ?`;
      params.push(String(from));
    }
    if (to) {
      query += ` AND al.created_at <= ?`;
      params.push(String(to));
    }

    // Export CSV (không phân trang)
    if (exportFormat === "csv") {
      query += ` ORDER BY al.created_at DESC`;
      const [csvRows] = await pool.query<RowDataPacket[]>(query, params);

      const header =
        "log_id,user_id,user_name,user_email,action,details,created_at\n";
      const escape = (v: unknown): string => {
        const s = String(v ?? "");
        const escaped = s.replace(/\r?\n/g, " ").replace(/"/g, '""');
        return `"${escaped}"`;
      };
      const lines = csvRows
        .map((r) =>
          [
            r.log_id,
            r.user_id ?? "",
            r.user_name ?? "",
            r.user_email ?? "",
            r.action,
            r.details,
            r.created_at,
          ]
            .map(escape)
            .join(","),
        )
        .join("\n");

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="system_logs_${new Date()
          .toISOString()
          .slice(0, 10)}.csv"`,
      );
      res.status(200).send(header + lines + "\n");
      return;
    }

    query += ` ORDER BY al.created_at DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), offset);

    const [rows] = await pool.query<RowDataPacket[]>(query, params);

    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM audit_logs 
       WHERE 1=1 
       ${user_id ? "AND user_id = ?" : ""} 
       ${action ? "AND action LIKE ?" : ""}
       ${from ? "AND created_at >= ?" : ""}
       ${to ? "AND created_at <= ?" : ""}`,
      [
        user_id ? Number(user_id) : undefined,
        action ? `%${String(action)}%` : undefined,
        from ? String(from) : undefined,
        to ? String(to) : undefined,
      ].filter(
        (v): v is string | number =>
          typeof v === "string" || typeof v === "number",
      ),
    );

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: countRows[0]?.total || 0,
        page: Number(page),
        limit: Number(limit),
      },
    });
  } catch (error: unknown) {
    console.error("Lỗi lấy system logs:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy nhật ký hệ thống",
    });
  }
};

export const getOwnerChatHistory = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { owner_id, user_id, from, to, page = "1", limit = "20" } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = `
      SELECT 
        cm.message_id,
        cm.sender_id,
        cm.receiver_id,
        cm.conversation_id,
        cm.content,
        cm.status,
        cm.created_at,
        su.full_name as sender_name,
        su.role as sender_role,
        ru.full_name as receiver_name,
        ru.role as receiver_role
      FROM chat_messages cm
      JOIN users su ON cm.sender_id = su.user_id
      JOIN users ru ON cm.receiver_id = ru.user_id
      WHERE 1=1
    `;
    const params: Array<string | number> = [];

    if (owner_id) {
      query += ` AND (cm.sender_id = ? OR cm.receiver_id = ?)`;
      params.push(Number(owner_id), Number(owner_id));
    }

    if (user_id) {
      query += ` AND (cm.sender_id = ? OR cm.receiver_id = ?)`;
      params.push(Number(user_id), Number(user_id));
    }

    // chỉ lấy hội thoại giữa owner và user
    query += ` AND (
      (su.role = 'owner' AND ru.role = 'user') OR (su.role = 'user' AND ru.role = 'owner')
    )`;

    if (from) {
      query += ` AND cm.created_at >= ?`;
      params.push(String(from));
    }
    if (to) {
      query += ` AND cm.created_at <= ?`;
      params.push(String(to));
    }

    query += ` ORDER BY cm.created_at DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), offset);

    const [rows] = await pool.query<RowDataPacket[]>(query, params);

    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total
       FROM chat_messages cm
       JOIN users su ON cm.sender_id = su.user_id
       JOIN users ru ON cm.receiver_id = ru.user_id
       WHERE 1=1
         ${owner_id ? "AND (cm.sender_id = ? OR cm.receiver_id = ?)" : ""}
         ${user_id ? "AND (cm.sender_id = ? OR cm.receiver_id = ?)" : ""}
         AND ((su.role = 'owner' AND ru.role = 'user') OR (su.role = 'user' AND ru.role = 'owner'))
         ${from ? "AND cm.created_at >= ?" : ""}
         ${to ? "AND cm.created_at <= ?" : ""}`,
      [
        ...(owner_id ? [Number(owner_id), Number(owner_id)] : []),
        ...(user_id ? [Number(user_id), Number(user_id)] : []),
        ...(from ? [String(from)] : []),
        ...(to ? [String(to)] : []),
      ],
    );

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: countRows[0]?.total || 0,
        page: Number(page),
        limit: Number(limit),
      },
    });
  } catch (error: unknown) {
    console.error("Lỗi lấy lịch sử chat owner-user:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

// ==================== SYSTEM SETTINGS ====================
export const getSystemSettings = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT setting_key, setting_value, setting_value_file, setting_type FROM system_settings",
    );

    const settings: Record<string, string | null> = {};
    rows.forEach((row) => {
      const k = row.setting_key as string | unknown;
      const v = row.setting_value as string | null | unknown;
      const vFile = row.setting_value_file as string | null | unknown;
      const vType = row.setting_type as string | null | unknown;

      if (typeof k === "string") {
        // For image type, prefer file path over URL
        if (
          vType === "image" &&
          typeof vFile === "string" &&
          vFile.length > 0
        ) {
          settings[k] = vFile;
        } else if (typeof v === "string") {
          settings[k] = v;
        } else {
          settings[k] = v === null ? null : String(v);
        }
      }
    });

    res.json({
      success: true,
      data: settings,
    });
  } catch (error: unknown) {
    console.error("Lỗi lấy system settings:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy cài đặt hệ thống",
    });
  }
};

export const updateSystemSettings = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const settings = req.body as Record<string, unknown>;
    const adminId = req.userId;

    if (!adminId) {
      res.status(401).json({ success: false, message: "Chưa xác thực" });
      return;
    }

    const imageKeys = new Set(["login_background_url", "app_background_url"]);

    for (const [key, value] of Object.entries(settings)) {
      const normalized =
        value === undefined || value === null ? null : String(value);
      if (imageKeys.has(key)) {
        if (normalized && normalized.trim().length) {
          const trimmed = normalized.trim();
          const isLocalUpload = trimmed.startsWith("/uploads/");
          const settingValue = isLocalUpload ? null : trimmed;
          const settingValueFile = isLocalUpload ? trimmed : null;
          const imageSource = isLocalUpload ? "upload" : "url";
          await pool.query(
            `INSERT INTO system_settings (setting_key, setting_value, setting_value_file, setting_type, image_source)
             VALUES (?, ?, ?, 'image', ?)
             ON DUPLICATE KEY UPDATE 
               setting_value = VALUES(setting_value),
               setting_value_file = VALUES(setting_value_file),
               setting_type = 'image',
               image_source = VALUES(image_source),
               updated_at = NOW()`,
            [key, settingValue, settingValueFile, imageSource],
          );
        } else {
          await pool.query(
            `INSERT INTO system_settings (setting_key, setting_value, setting_value_file, setting_type, image_source)
             VALUES (?, NULL, NULL, 'image', 'url')
             ON DUPLICATE KEY UPDATE 
               setting_value = NULL,
               setting_value_file = NULL,
               setting_type = 'image',
               image_source = 'url',
               updated_at = NOW()`,
            [key],
          );
        }
      } else {
        await pool.query(
          `INSERT INTO system_settings (setting_key, setting_value) 
           VALUES (?, ?) 
           ON DUPLICATE KEY UPDATE setting_value = ?, updated_at = NOW()`,
          [key, normalized, normalized],
        );
      }
    }

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
      [
        adminId,
        "UPDATE_SYSTEM_SETTINGS",
        JSON.stringify({ settings, timestamp: new Date() }),
      ],
    );

    res.json({
      success: true,
      message: "Cập nhật cài đặt hệ thống thành công",
    });
  } catch (error: unknown) {
    console.error("Lỗi cập nhật system settings:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi cập nhật cài đặt hệ thống",
    });
  }
};

// ==================== ADMIN BANK (PLATFORM BANK) ====================
const normalizeBankKeyForBin = (input: string): string => {
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

const buildVietQrUrl = (args: {
  bankName: string;
  bankAccount: string;
  bankBinInput?: string;
  note?: string;
}): { bank_bin: string | null; qr_code: string | null } => {
  const bankName = (args.bankName || "").trim();
  const bankAccount = (args.bankAccount || "").trim();
  const bankBinInput = (args.bankBinInput || "").trim();
  const note = (args.note || "Checkin").trim() || "Checkin";

  const inferredBin = bankName
    ? bankBinMap[normalizeBankKeyForBin(bankName)]
    : "";
  const resolvedBin = bankBinInput || inferredBin;

  const qrCodeUrl =
    resolvedBin && bankAccount
      ? `https://img.vietqr.io/image/${resolvedBin}-${encodeURIComponent(
          bankAccount,
        )}-qr_only.png?addInfo=${encodeURIComponent(note)}`
      : null;

  return {
    bank_bin: resolvedBin || null,
    qr_code: qrCodeUrl,
  };
};

export const getAdminBank = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const adminId = req.userId;
    if (!adminId) {
      res.status(401).json({ success: false, message: "Chưa xác thực" });
      return;
    }

    const keys = [
      "admin_bank_name",
      "admin_bank_account",
      "admin_bank_holder",
      "admin_bank_bin",
      "admin_bank_contact_info",
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
    const contactInfo = (map.get("admin_bank_contact_info") || "").trim();

    const { bank_bin, qr_code } = buildVietQrUrl({
      bankName,
      bankAccount,
      bankBinInput,
      note: "Checkin",
    });

    res.json({
      success: true,
      data: {
        bank_name: bankName || null,
        bank_account: bankAccount || null,
        bank_holder: bankHolder || null,
        bank_bin,
        contact_info: contactInfo || null,
        qr_code,
      },
    });
  } catch (error: unknown) {
    console.error("Lỗi lấy ngân hàng admin:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const updateAdminBank = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const adminId = req.userId;
    if (!adminId) {
      res.status(401).json({ success: false, message: "Chưa xác thực" });
      return;
    }

    const body = req.body as {
      bank_account?: string;
      bank_name?: string;
      bank_holder?: string;
      bank_bin?: string;
      contact_info?: string;
    };

    const bank_account = String(body.bank_account || "").trim();
    const bank_name = String(body.bank_name || "").trim();
    const bank_holder = String(body.bank_holder || "").trim();
    const bank_bin = String(body.bank_bin || "").trim();
    const contact_info = String(body.contact_info || "").trim();

    if (!bank_account || !bank_name || !bank_holder) {
      res.status(400).json({
        success: false,
        message:
          "Thiếu thông tin ngân hàng (bank_account/bank_name/bank_holder)",
      });
      return;
    }

    const entries: Array<[string, string | null]> = [
      ["admin_bank_name", bank_name],
      ["admin_bank_account", bank_account],
      ["admin_bank_holder", bank_holder],
      ["admin_bank_bin", bank_bin || null],
      ["admin_bank_contact_info", contact_info || null],
    ];

    for (const [k, v] of entries) {
      await pool.query(
        `INSERT INTO system_settings (setting_key, setting_value)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()`,
        [k, v],
      );
    }

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
      [
        adminId,
        "UPDATE_ADMIN_BANK",
        JSON.stringify({
          bank_name,
          bank_account_last4: bank_account.slice(-4),
          timestamp: new Date(),
        }),
      ],
    );

    const { bank_bin: resolved_bin, qr_code } = buildVietQrUrl({
      bankName: bank_name,
      bankAccount: bank_account,
      bankBinInput: bank_bin,
      note: "Checkin",
    });

    res.json({
      success: true,
      message: "Đã cập nhật ngân hàng admin",
      data: {
        bank_name,
        bank_account,
        bank_holder,
        bank_bin: resolved_bin,
        contact_info: contact_info || null,
        qr_code,
      },
    });
  } catch (error: unknown) {
    console.error("Lỗi cập nhật ngân hàng admin:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

// ==================== SOS ALERTS ====================
export const getSosAlerts = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { status, page = "1", limit = "20" } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = `
      SELECT 
        sa.alert_id,
        sa.user_id,
        sa.location_text,
        sa.message,
        sa.status,
        sa.resolved_at,
        sa.created_at,
        ST_Y(sa.location_coordinates) as latitude,
        ST_X(sa.location_coordinates) as longitude,
        u.full_name as user_name,
        u.phone as user_phone
      FROM sos_alerts sa
      LEFT JOIN users u ON sa.user_id = u.user_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status) {
      query += ` AND sa.status = ?`;
      params.push(status);
    }

    query += ` ORDER BY sa.created_at DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), offset);

    const [rows] = await pool.query<RowDataPacket[]>(query, params);

    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM sos_alerts ${
        status ? "WHERE status = ?" : ""
      }`,
      status ? [status] : [],
    );

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: countRows[0]?.total || 0,
        page: Number(page),
        limit: Number(limit),
      },
    });
  } catch (error: any) {
    console.error("Lỗi lấy SOS alerts:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy danh sách SOS",
    });
  }
};

export const updateSosAlertStatus = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body as {
      status?: "pending" | "processing" | "resolved";
    };
    const adminId = (req as any).userId;

    if (!status || !["pending", "processing", "resolved"].includes(status)) {
      res.status(400).json({
        success: false,
        message: "Trạng thái SOS không hợp lệ",
      });
      return;
    }

    await pool.query(
      `UPDATE sos_alerts
       SET status = ?, resolved_at = CASE WHEN ? = 'resolved' THEN NOW() ELSE NULL END
       WHERE alert_id = ?`,
      [status, status, id],
    );

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
      [
        adminId,
        "UPDATE_SOS_ALERT_STATUS",
        JSON.stringify({ alertId: id, status, timestamp: new Date() }),
      ],
    );

    res.json({
      success: true,
      message: "Cập nhật trạng thái SOS thành công",
    });
  } catch (error: any) {
    console.error("Lỗi cập nhật trạng thái SOS:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi cập nhật trạng thái SOS",
    });
  }
};

// ==================== OWNER SERVICES (ADMIN APPROVAL) ====================
export const getOwnerServicesAdmin = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const {
      status,
      search,
      owner_ids,
      service_types,
      page = "1",
      limit = "20",
    } = req.query as any;
    const safeLimit = Math.min(200, Math.max(1, Number(limit || 20)));
    const safePage = Math.max(1, Number(page || 1));
    const offset = (safePage - 1) * safeLimit;

    const normalizeIds = (raw: unknown): number[] => {
      const arr = Array.isArray(raw) ? raw : [];
      return Array.from(
        new Set(
          arr
            .map((x) => Number(x))
            .filter((n) => Number.isFinite(n))
            .map((n) => Math.trunc(n))
            .filter((n) => n > 0),
        ),
      );
    };

    const parseIdList = (raw: unknown): number[] => {
      if (Array.isArray(raw)) return normalizeIds(raw);
      if (typeof raw === "string") return normalizeIds(raw.split(","));
      return [];
    };

    const parseStringList = (raw: unknown, cap = 20): string[] => {
      const arr = Array.isArray(raw)
        ? raw
        : typeof raw === "string"
          ? raw.split(",")
          : [];
      const normalized = arr.map((x) => String(x ?? "").trim()).filter(Boolean);
      return Array.from(new Set(normalized)).slice(0, cap);
    };

    const ownerIds = parseIdList(owner_ids);
    const serviceTypes = parseStringList(service_types);

    let query = `
      SELECT
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
        s.admin_status,
        s.admin_reviewed_by,
        s.admin_reviewed_at,
        s.admin_reject_reason,
        s.created_at,
        l.location_name,
        l.location_type,
        u.user_id as owner_id,
        u.full_name as owner_name,
        u.email as owner_email,
        c.category_name,
        c.category_type
      FROM services s
      JOIN locations l ON l.location_id = s.location_id
      JOIN users u ON u.user_id = l.owner_id
      LEFT JOIN service_categories c ON c.category_id = s.category_id AND c.deleted_at IS NULL
      WHERE s.deleted_at IS NULL
        AND u.role = 'owner'
    `;

    const params: any[] = [];
    if (
      status &&
      ["pending", "approved", "rejected"].includes(String(status))
    ) {
      query += ` AND s.admin_status = ?`;
      params.push(String(status));
    }

    if (search && String(search).trim()) {
      const q = `%${String(search).trim()}%`;
      query += ` AND (
        s.service_name LIKE ?
        OR l.location_name LIKE ?
        OR u.full_name LIKE ?
        OR u.email LIKE ?
        OR c.category_name LIKE ?
      )`;
      params.push(q, q, q, q, q);
    }

    if (ownerIds.length > 0) {
      query += ` AND u.user_id IN (?)`;
      params.push(ownerIds);
    }

    if (serviceTypes.length > 0) {
      query += ` AND s.service_type IN (?)`;
      params.push(serviceTypes);
    }

    query += ` ORDER BY s.created_at DESC LIMIT ? OFFSET ?`;
    params.push(safeLimit, offset);

    const [rows] = await pool.query<RowDataPacket[]>(query, params);

    // count
    let countSql = `
      SELECT COUNT(*) as total
      FROM services s
      JOIN locations l ON l.location_id = s.location_id
      JOIN users u ON u.user_id = l.owner_id
      LEFT JOIN service_categories c ON c.category_id = s.category_id AND c.deleted_at IS NULL
      WHERE s.deleted_at IS NULL
        AND u.role = 'owner'
    `;
    const countParams: any[] = [];
    if (
      status &&
      ["pending", "approved", "rejected"].includes(String(status))
    ) {
      countSql += ` AND s.admin_status = ?`;
      countParams.push(String(status));
    }
    if (search && String(search).trim()) {
      const q = `%${String(search).trim()}%`;
      countSql += ` AND (
        s.service_name LIKE ?
        OR l.location_name LIKE ?
        OR u.full_name LIKE ?
        OR u.email LIKE ?
        OR c.category_name LIKE ?
      )`;
      countParams.push(q, q, q, q, q);
    }

    if (ownerIds.length > 0) {
      countSql += ` AND u.user_id IN (?)`;
      countParams.push(ownerIds);
    }

    if (serviceTypes.length > 0) {
      countSql += ` AND s.service_type IN (?)`;
      countParams.push(serviceTypes);
    }
    const [countRows] = await pool.query<RowDataPacket[]>(
      countSql,
      countParams,
    );

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: Number(countRows?.[0]?.total ?? 0),
        page: safePage,
        limit: safeLimit,
      },
    });
  } catch (error: any) {
    console.error("Lỗi getOwnerServicesAdmin:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const updateOwnerServiceApprovalAdmin = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const adminId = (req as any).userId;
    const serviceId = Number(req.params.id);
    if (!Number.isFinite(serviceId)) {
      res
        .status(400)
        .json({ success: false, message: "serviceId không hợp lệ" });
      return;
    }

    const { status, reason } = req.body as {
      status?: "approved" | "rejected" | "pending";
      reason?: string;
    };

    if (!status || !["approved", "rejected"].includes(status)) {
      res.status(400).json({ success: false, message: "status không hợp lệ" });
      return;
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT s.service_id, s.admin_status, s.service_name, l.location_name, u.user_id as owner_id
       FROM services s
       JOIN locations l ON l.location_id = s.location_id
       JOIN users u ON u.user_id = l.owner_id
       WHERE s.service_id = ? AND s.deleted_at IS NULL
       LIMIT 1`,
      [serviceId],
    );
    if (!rows[0]) {
      res
        .status(404)
        .json({ success: false, message: "Không tìm thấy dịch vụ" });
      return;
    }

    if (status === "rejected") {
      const r = String(reason || "").trim();
      if (!r) {
        res.status(400).json({
          success: false,
          message: "Vui lòng nhập lý do từ chối",
        });
        return;
      }

      await pool.query(
        `UPDATE services
         SET admin_status = 'rejected', admin_reviewed_by = ?, admin_reviewed_at = NOW(), admin_reject_reason = ?
         WHERE service_id = ?`,
        [adminId, r, serviceId],
      );
    } else {
      await pool.query(
        `UPDATE services
         SET admin_status = 'approved', admin_reviewed_by = ?, admin_reviewed_at = NOW(), admin_reject_reason = NULL
         WHERE service_id = ?`,
        [adminId, serviceId],
      );
    }

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
      [
        adminId,
        "UPDATE_OWNER_SERVICE_APPROVAL",
        JSON.stringify({
          service_id: serviceId,
          status,
          reason: reason ?? null,
          timestamp: new Date(),
        }),
      ],
    );

    const ownerId = Number(rows[0]?.owner_id || 0);
    if (Number.isFinite(ownerId) && ownerId > 0) {
      try {
        await sendPushNotification({
          title:
            status === "approved"
              ? "Dịch vụ đã được duyệt"
              : "Dịch vụ bị từ chối",
          body:
            status === "approved"
              ? `Dịch vụ ${String(rows[0]?.service_name || "")} tại ${String(rows[0]?.location_name || "địa điểm của bạn")} đã được duyệt.`
              : `Dịch vụ ${String(rows[0]?.service_name || "")} bị từ chối. ${String(reason || "")}`.trim(),
          targetAudience: "specific_user",
          targetUserId: ownerId,
          sentBy: adminId,
        });
      } catch (notifyError) {
        console.error("Không gửi được thông báo duyệt dịch vụ:", notifyError);
      }
    }

    res.json({ success: true, message: "Cập nhật duyệt dịch vụ thành công" });
  } catch (error: any) {
    console.error("Lỗi updateOwnerServiceApprovalAdmin:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const bulkUpdateOwnerServiceApprovalAdmin = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const adminId = (req as any).userId;

    const { scope, service_ids, filter, exclude_service_ids, status, reason } =
      req.body as {
        scope?: "ids" | "filter";
        service_ids?: unknown;
        filter?: {
          status?: unknown;
          search?: unknown;
          owner_ids?: unknown;
          service_types?: unknown;
        };
        exclude_service_ids?: unknown;
        status?: "approved" | "rejected";
        reason?: string;
      };

    if (!status || !["approved", "rejected"].includes(status)) {
      res.status(400).json({ success: false, message: "status không hợp lệ" });
      return;
    }

    const normalizedReason = String(reason || "").trim();
    if (status === "rejected" && !normalizedReason) {
      res.status(400).json({
        success: false,
        message: "Vui lòng nhập lý do từ chối",
      });
      return;
    }

    const normalizeIds = (raw: unknown): number[] => {
      const arr = Array.isArray(raw) ? raw : [];
      return Array.from(
        new Set(
          arr
            .map((x) => Number(x))
            .filter((n) => Number.isFinite(n))
            .map((n) => Math.trunc(n))
            .filter((n) => n > 0),
        ),
      );
    };

    const parseIdList = (raw: unknown): number[] => {
      if (Array.isArray(raw)) return normalizeIds(raw);
      if (typeof raw === "string") return normalizeIds(raw.split(","));
      return [];
    };

    const parseStringList = (raw: unknown, cap = 20): string[] => {
      const arr = Array.isArray(raw)
        ? raw
        : typeof raw === "string"
          ? raw.split(",")
          : [];
      const normalized = arr.map((x) => String(x ?? "").trim()).filter(Boolean);
      return Array.from(new Set(normalized)).slice(0, cap);
    };

    const requestedScope: "ids" | "filter" =
      scope === "ids" || scope === "filter"
        ? scope
        : Array.isArray(service_ids)
          ? "ids"
          : "filter";

    const excludedIds = normalizeIds(exclude_service_ids);

    // Shared SET clause
    const newRejectReason = status === "rejected" ? normalizedReason : null;
    const setSql =
      status === "rejected"
        ? `s.admin_status = 'rejected', s.admin_reviewed_by = ?, s.admin_reviewed_at = NOW(), s.admin_reject_reason = ?`
        : `s.admin_status = 'approved', s.admin_reviewed_by = ?, s.admin_reviewed_at = NOW(), s.admin_reject_reason = NULL`;
    const setParams =
      status === "rejected" ? [adminId, newRejectReason] : [adminId];

    let updateSql = `
      UPDATE services s
      JOIN locations l ON l.location_id = s.location_id
      JOIN users u ON u.user_id = l.owner_id
      LEFT JOIN service_categories c ON c.category_id = s.category_id AND c.deleted_at IS NULL
      SET ${setSql}
      WHERE s.deleted_at IS NULL
        AND u.role = 'owner'
    `;
    const updateParams: any[] = [...setParams];

    let effectiveFilter: {
      status?: string;
      search?: string;
      owner_ids?: number[];
      service_types?: string[];
    } | null = null;
    let targetIds: number[] = [];

    if (requestedScope === "ids") {
      targetIds = normalizeIds(service_ids);
      if (targetIds.length === 0) {
        res.status(400).json({
          success: false,
          message: "Vui lòng chọn ít nhất 1 dịch vụ",
        });
        return;
      }

      updateSql += ` AND s.service_id IN (?)`;
      updateParams.push(targetIds);

      if (excludedIds.length > 0) {
        updateSql += ` AND s.service_id NOT IN (?)`;
        updateParams.push(excludedIds);
      }
    } else {
      // filter scope
      const rawStatus = filter?.status != null ? String(filter.status) : "";
      const rawSearch = filter?.search != null ? String(filter.search) : "";
      const trimmedSearch = rawSearch.trim();

      const ownerIds = parseIdList(filter?.owner_ids);
      const serviceTypes = parseStringList(filter?.service_types);

      effectiveFilter = {
        status:
          rawStatus && ["pending", "approved", "rejected"].includes(rawStatus)
            ? rawStatus
            : undefined,
        search: trimmedSearch || undefined,
        owner_ids: ownerIds.length > 0 ? ownerIds : undefined,
        service_types: serviceTypes.length > 0 ? serviceTypes : undefined,
      };

      if (effectiveFilter.status) {
        updateSql += ` AND s.admin_status = ?`;
        updateParams.push(effectiveFilter.status);
      }

      if (effectiveFilter.search) {
        const q = `%${effectiveFilter.search}%`;
        updateSql += ` AND (
          s.service_name LIKE ?
          OR l.location_name LIKE ?
          OR u.full_name LIKE ?
          OR u.email LIKE ?
          OR c.category_name LIKE ?
        )`;
        updateParams.push(q, q, q, q, q);
      }

      if (ownerIds.length > 0) {
        updateSql += ` AND u.user_id IN (?)`;
        updateParams.push(ownerIds);
      }

      if (serviceTypes.length > 0) {
        updateSql += ` AND s.service_type IN (?)`;
        updateParams.push(serviceTypes);
      }

      if (excludedIds.length > 0) {
        updateSql += ` AND s.service_id NOT IN (?)`;
        updateParams.push(excludedIds);
      }
    }

    const [updateResult] = await pool.query<ResultSetHeader>(
      updateSql,
      updateParams,
    );

    const affected = Number(updateResult?.affectedRows ?? 0);

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
      [
        adminId,
        "BULK_UPDATE_OWNER_SERVICE_APPROVAL",
        JSON.stringify({
          scope: requestedScope,
          status,
          reason: status === "rejected" ? normalizedReason : null,
          filter: effectiveFilter,
          service_ids: requestedScope === "ids" ? targetIds : null,
          exclude_service_ids: excludedIds,
          affected,
          timestamp: new Date(),
        }),
      ],
    );

    res.json({
      success: true,
      message: "Cập nhật duyệt dịch vụ hàng loạt thành công",
      affected,
    });
  } catch (error: any) {
    console.error("Lỗi bulkUpdateOwnerServiceApprovalAdmin:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const deleteOwnerServiceAdmin = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const adminId = (req as any).userId;
    const serviceId = Number(req.params.id);
    if (!Number.isFinite(serviceId)) {
      res
        .status(400)
        .json({ success: false, message: "serviceId không hợp lệ" });
      return;
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT s.service_id, s.service_name, s.admin_status,
              l.location_name, l.owner_id
       FROM services s
       JOIN locations l ON l.location_id = s.location_id
       WHERE s.service_id = ? AND s.deleted_at IS NULL
       LIMIT 1`,
      [serviceId],
    );
    if (!rows[0]) {
      res
        .status(404)
        .json({ success: false, message: "Không tìm thấy dịch vụ" });
      return;
    }

    await pool.query(
      `UPDATE services
       SET deleted_at = NOW(), updated_at = NOW()
       WHERE service_id = ? AND deleted_at IS NULL`,
      [serviceId],
    );

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
      [
        adminId,
        "DELETE_OWNER_SERVICE_ADMIN",
        JSON.stringify({
          service_id: serviceId,
          service_name: rows[0]?.service_name ?? null,
          admin_status: rows[0]?.admin_status ?? null,
          timestamp: new Date(),
        }),
      ],
    );

    const ownerId = Number(rows[0]?.owner_id || 0);
    if (Number.isFinite(ownerId) && ownerId > 0) {
      try {
        await sendPushNotification({
          title: "Admin đã chỉnh sửa dịch vụ",
          body: `Dịch vụ ${String(rows[0]?.service_name || "")} tại ${String(rows[0]?.location_name || "địa điểm của bạn")} đã được Admin cập nhật/xóa khỏi hệ thống.`,
          targetAudience: "specific_user",
          targetUserId: ownerId,
          sentBy: adminId,
        });
      } catch (notifyError) {
        console.error("Không gửi được thông báo xóa dịch vụ:", notifyError);
      }
    }

    res.json({ success: true, message: "Đã xóa dịch vụ" });
  } catch (error: any) {
    console.error("Lỗi deleteOwnerServiceAdmin:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

// ==================== SYSTEM VOUCHERS (ADMIN) ====================
export const getSystemVouchers = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { status, search, page = "1", limit = "20" } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    // Backend tự động tính trạng thái 'expired' dựa trên end_date để frontend chỉ render
    const queryWithLocationCount = `
      SELECT 
        v.*,
        u.full_name as created_by_name,
        u.email as created_by_email,
        l.location_name,
        l.location_type,
        (SELECT COUNT(*) FROM voucher_locations vl WHERE vl.voucher_id = v.voucher_id) as location_count,
        CASE 
          WHEN v.end_date < NOW() THEN 'expired'
          ELSE v.status
        END as computed_status
      FROM vouchers v
      JOIN users u ON v.owner_id = u.user_id
      LEFT JOIN locations l ON l.location_id = v.location_id
      WHERE u.role = 'admin'
    `;

    const queryFallback = `
      SELECT 
        v.*,
        u.full_name as created_by_name,
        u.email as created_by_email,
        l.location_name,
        l.location_type,
        0 as location_count,
        CASE 
          WHEN v.end_date < NOW() THEN 'expired'
          ELSE v.status
        END as computed_status
      FROM vouchers v
      JOIN users u ON v.owner_id = u.user_id
      LEFT JOIN locations l ON l.location_id = v.location_id
      WHERE u.role = 'admin'
    `;

    let query = queryWithLocationCount;
    const params: any[] = [];

    if (status) {
      query += " AND v.status = ?";
      params.push(status);
    }

    if (search) {
      query += " AND (v.code LIKE ? OR v.campaign_name LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }

    query += " ORDER BY v.created_at DESC LIMIT ? OFFSET ?";
    params.push(Number(limit), offset);

    let rows: RowDataPacket[] = [];
    try {
      const [r] = await pool.query<RowDataPacket[]>(query, params);
      rows = r;
    } catch (e: any) {
      const isMissingVoucherLocationsTable =
        e?.code === "ER_NO_SUCH_TABLE" &&
        String(e?.message || "").includes("voucher_locations");
      if (!isMissingVoucherLocationsTable) throw e;

      query = queryFallback;
      const [r] = await pool.query<RowDataPacket[]>(query, params);
      rows = r;
    }

    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total
       FROM vouchers v
       JOIN users u ON v.owner_id = u.user_id
       WHERE u.role = 'admin'
       ${status ? "AND v.status = ?" : ""}
       ${search ? "AND (v.code LIKE ? OR v.campaign_name LIKE ?)" : ""}`,
      [
        ...(status ? [status] : []),
        ...(search ? [`%${search}%`, `%${search}%`] : []),
      ],
    );

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: countRows[0]?.total || 0,
        page: Number(page),
        limit: Number(limit),
      },
    });
  } catch (error: any) {
    console.error("Lỗi lấy system vouchers:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy danh sách voucher hệ thống",
    });
  }
};

export const getVoucherUsageHistoryAdmin = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
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
    console.error("Lỗi getVoucherUsageHistoryAdmin:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const getVoucherLocationsAdmin = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const voucherId = Number(req.params.id);
    if (!Number.isFinite(voucherId)) {
      res
        .status(400)
        .json({ success: false, message: "voucherId không hợp lệ" });
      return;
    }

    const [voucherRows] = await pool.query<RowDataPacket[]>(
      `SELECT voucher_id, location_id FROM vouchers WHERE voucher_id = ? LIMIT 1`,
      [voucherId],
    );
    const voucher = voucherRows?.[0] as
      | { voucher_id: number; location_id: number | null }
      | undefined;
    if (!voucher) {
      res
        .status(404)
        .json({ success: false, message: "Không tìm thấy voucher" });
      return;
    }

    if (voucher.location_id != null) {
      res.json({
        success: true,
        data: { location_scope: "single", location_ids: [voucher.location_id] },
      });
      return;
    }

    try {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT location_id FROM voucher_locations WHERE voucher_id = ? ORDER BY location_id ASC`,
        [voucherId],
      );
      const locationIds = rows
        .map((r) => Number(r.location_id))
        .filter(Number.isFinite);
      res.json({
        success: true,
        data: {
          location_scope: locationIds.length > 0 ? "multiple" : "all",
          location_ids: locationIds,
        },
      });
      return;
    } catch (e: any) {
      const isMissingVoucherLocationsTable =
        e?.code === "ER_NO_SUCH_TABLE" &&
        String(e?.message || "").includes("voucher_locations");
      if (!isMissingVoucherLocationsTable) throw e;
      res.json({
        success: true,
        data: { location_scope: "all", location_ids: [] },
      });
    }
  } catch (error: any) {
    console.error("Lỗi getVoucherLocationsAdmin:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const createSystemVoucher = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const adminId = (req as any).userId;
    const {
      code,
      location_id,
      location_scope,
      location_ids,
      campaign_name = null,
      campaign_description = null,
      discount_type,
      discount_value,
      apply_to_service_type = "all",
      apply_to_location_type = "all",
      min_order_value = 0,
      max_discount_amount = null,
      start_date,
      end_date,
      usage_limit = 100,
      max_uses_per_user = 1,
      status = "active",
    } = req.body;

    const normalizeDateTimeInput = (value: unknown): string | null => {
      if (value === null || value === undefined) return null;
      if (typeof value !== "string") return null;
      const trimmed = value.trim();
      if (!trimmed) return null;

      let match = trimmed.match(
        /^(\d{2})\/(\d{2})\/(\d{4})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/,
      );
      if (match) {
        const [, dd, mm, yyyy, hh, min, ss] = match;
        const normalized = `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss ?? "00"}`;
        if (!Number.isNaN(Date.parse(normalized.replace(" ", "T")))) {
          return normalized;
        }
      }

      match = trimmed.match(
        /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/,
      );
      if (match) {
        const [, yyyy, mm, dd, hh, min, ss] = match;
        const normalized = `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss ?? "00"}`;
        if (!Number.isNaN(Date.parse(normalized.replace(" ", "T")))) {
          return normalized;
        }
      }

      match = trimmed.match(
        /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/,
      );
      if (match) {
        const [, yyyy, mm, dd, hh, min, ss] = match;
        const normalized = `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss ?? "00"}`;
        if (!Number.isNaN(Date.parse(normalized.replace(" ", "T")))) {
          return normalized;
        }
      }

      return null;
    };

    if (
      !code ||
      !discount_type ||
      discount_value == null ||
      !start_date ||
      !end_date
    ) {
      res.status(400).json({
        success: false,
        message:
          "Thiếu dữ liệu bắt buộc (code, discount_type, discount_value, start_date, end_date)",
      });
      return;
    }

    if (!["percent", "amount"].includes(discount_type)) {
      res
        .status(400)
        .json({ success: false, message: "discount_type không hợp lệ" });
      return;
    }

    if (
      !["all", "room", "food", "ticket", "other"].includes(
        apply_to_service_type,
      )
    ) {
      res.status(400).json({
        success: false,
        message: "apply_to_service_type không hợp lệ",
      });
      return;
    }

    if (
      ![
        "all",
        "hotel",
        "restaurant",
        "tourist",
        "cafe",
        "resort",
        "other",
      ].includes(apply_to_location_type)
    ) {
      res.status(400).json({
        success: false,
        message: "apply_to_location_type không hợp lệ",
      });
      return;
    }

    if (typeof max_uses_per_user !== "number" || max_uses_per_user < 1) {
      res.status(400).json({
        success: false,
        message: "max_uses_per_user không hợp lệ",
      });
      return;
    }

    // Tránh trùng code trong nhóm admin (unique_code_owner)
    const [exists] = await pool.query<RowDataPacket[]>(
      `SELECT voucher_id FROM vouchers WHERE owner_id = ? AND code = ? LIMIT 1`,
      [adminId, code],
    );
    if (exists.length > 0) {
      res.status(400).json({
        success: false,
        message: "Mã voucher đã tồn tại (trùng code trong hệ thống)",
      });
      return;
    }

    const normalizedStart = normalizeDateTimeInput(start_date);
    const normalizedEnd = normalizeDateTimeInput(end_date);
    if (!normalizedStart || !normalizedEnd) {
      res.status(400).json({
        success: false,
        message: "Ngày bắt đầu/kết thúc không đúng định dạng DD/MM/YYYY HH:mm",
      });
      return;
    }

    const rawScope = String(location_scope ?? "").trim();
    const inferredScope = Array.isArray(location_ids)
      ? "multiple"
      : location_id === null || location_id === "" || location_id === "all"
        ? "all"
        : "single";
    const finalScope =
      rawScope === "all" || rawScope === "single" || rawScope === "multiple"
        ? rawScope
        : inferredScope;

    const parseId = (v: unknown): number | null => {
      if (v === null || v === undefined) return null;
      if (v === "" || v === "all") return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    let parsedLocationId: number | null = null;
    let parsedLocationIds: number[] = [];

    if (finalScope === "single") {
      parsedLocationId = parseId(location_id);
      if (parsedLocationId == null) {
        res
          .status(400)
          .json({ success: false, message: "Vui lòng chọn 1 địa điểm" });
        return;
      }
    }

    if (finalScope === "multiple") {
      const rawIds = Array.isArray(location_ids) ? location_ids : [];
      parsedLocationIds = Array.from(
        new Set(
          rawIds
            .map((x) => Number(x))
            .filter((n) => Number.isFinite(n))
            .map((n) => Math.trunc(n)),
        ),
      );

      if (parsedLocationIds.length === 0) {
        res.status(400).json({
          success: false,
          message: "Vui lòng chọn ít nhất 1 địa điểm",
        });
        return;
      }
    }

    // Validate location existence
    if (finalScope === "single" && parsedLocationId != null) {
      const [locRows] = await pool.query<RowDataPacket[]>(
        `SELECT location_id FROM locations WHERE location_id = ? LIMIT 1`,
        [parsedLocationId],
      );
      if (!locRows[0]) {
        res
          .status(404)
          .json({ success: false, message: "Địa điểm không tồn tại" });
        return;
      }
    }

    if (finalScope === "multiple") {
      const [locRows] = await pool.query<RowDataPacket[]>(
        `SELECT location_id FROM locations WHERE location_id IN (?)`,
        [parsedLocationIds],
      );
      const foundIds = new Set(locRows.map((r) => Number(r.location_id)));
      const missing = parsedLocationIds.filter((id) => !foundIds.has(id));
      if (missing.length > 0) {
        res.status(404).json({
          success: false,
          message: `Địa điểm không tồn tại: ${missing.join(", ")}`,
        });
        return;
      }
    }

    const insertLocationId = finalScope === "single" ? parsedLocationId : null;

    const [insertResult] = await pool.query<ResultSetHeader>(
      `INSERT INTO vouchers (
        owner_id, location_id, code, campaign_name, campaign_description,
        discount_type, discount_value,
        apply_to_service_type, apply_to_location_type,
        min_order_value, max_discount_amount,
        start_date, end_date,
        usage_limit, max_uses_per_user,
        used_count, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      [
        adminId,
        insertLocationId,
        code,
        campaign_name,
        campaign_description,
        discount_type,
        discount_value,
        apply_to_service_type,
        apply_to_location_type,
        min_order_value,
        max_discount_amount,
        normalizedStart,
        normalizedEnd,
        usage_limit,
        max_uses_per_user,
        status,
      ],
    );

    const voucherId = Number(insertResult.insertId);

    if (finalScope === "multiple") {
      try {
        const valuesSql = parsedLocationIds.map(() => "(?, ?)").join(", ");
        const flatParams = parsedLocationIds.flatMap((id) => [voucherId, id]);
        await pool.query(
          `INSERT INTO voucher_locations (voucher_id, location_id) VALUES ${valuesSql}`,
          flatParams,
        );
      } catch (e: any) {
        const isMissingVoucherLocationsTable =
          e?.code === "ER_NO_SUCH_TABLE" &&
          String(e?.message || "").includes("voucher_locations");
        if (isMissingVoucherLocationsTable) {
          res.status(500).json({
            success: false,
            message:
              "Thiếu bảng voucher_locations. Vui lòng chạy migration docs/migrations/2026-02-01-vouchers-bank.sql",
          });
          return;
        }
        throw e;
      }
    }

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
      [
        adminId,
        "CREATE_SYSTEM_VOUCHER",
        JSON.stringify({
          code,
          campaign_name,
          discount_type,
          discount_value,
          start_date,
          end_date,
          timestamp: new Date(),
        }),
      ],
    );

    res.status(201).json({
      success: true,
      message: "Tạo voucher hệ thống thành công",
    });
  } catch (error: any) {
    console.error("Lỗi tạo system voucher:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi tạo voucher hệ thống",
    });
  }
};

// ==================== OWNER VOUCHERS (ADMIN APPROVAL) ====================
export const getOwnerVouchersAdmin = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { status, search, page = "1", limit = "20" } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const queryWithAll = `
      SELECT
        v.*,
        u.full_name as owner_name,
        u.email as owner_email,
        l.location_name,
        (SELECT COUNT(*) FROM voucher_locations vl WHERE vl.voucher_id = v.voucher_id) as location_count,
        vr.approval_status,
        vr.rejection_reason,
        CASE
          WHEN v.end_date < NOW() THEN 'expired'
          ELSE v.status
        END as computed_status
      FROM vouchers v
      JOIN users u ON v.owner_id = u.user_id
      LEFT JOIN locations l ON l.location_id = v.location_id
      LEFT JOIN voucher_reviews vr ON vr.voucher_id = v.voucher_id
      WHERE u.role = 'owner'
        AND v.owner_deleted_at IS NULL
    `;

    const queryFallbackNoLocations = `
      SELECT
        v.*,
        u.full_name as owner_name,
        u.email as owner_email,
        l.location_name,
        0 as location_count,
        vr.approval_status,
        vr.rejection_reason,
        CASE
          WHEN v.end_date < NOW() THEN 'expired'
          ELSE v.status
        END as computed_status
      FROM vouchers v
      JOIN users u ON v.owner_id = u.user_id
      LEFT JOIN locations l ON l.location_id = v.location_id
      LEFT JOIN voucher_reviews vr ON vr.voucher_id = v.voucher_id
      WHERE u.role = 'owner'
        AND v.owner_deleted_at IS NULL
    `;

    const queryFallbackNoReviews = `
      SELECT
        v.*,
        u.full_name as owner_name,
        u.email as owner_email,
        l.location_name,
        (SELECT COUNT(*) FROM voucher_locations vl WHERE vl.voucher_id = v.voucher_id) as location_count,
        'pending' as approval_status,
        NULL as rejection_reason,
        CASE
          WHEN v.end_date < NOW() THEN 'expired'
          ELSE v.status
        END as computed_status
      FROM vouchers v
      JOIN users u ON v.owner_id = u.user_id
      LEFT JOIN locations l ON l.location_id = v.location_id
      WHERE u.role = 'owner'
        AND v.owner_deleted_at IS NULL
    `;

    const queryFallbackNoBoth = `
      SELECT
        v.*,
        u.full_name as owner_name,
        u.email as owner_email,
        l.location_name,
        0 as location_count,
        'pending' as approval_status,
        NULL as rejection_reason,
        CASE
          WHEN v.end_date < NOW() THEN 'expired'
          ELSE v.status
        END as computed_status
      FROM vouchers v
      JOIN users u ON v.owner_id = u.user_id
      LEFT JOIN locations l ON l.location_id = v.location_id
      WHERE u.role = 'owner'
        AND v.owner_deleted_at IS NULL
    `;

    let query = queryWithAll;
    const params: any[] = [];

    if (status) {
      query += " AND v.status = ?";
      params.push(status);
    }

    if (search) {
      query +=
        " AND (v.code LIKE ? OR v.campaign_name LIKE ? OR u.full_name LIKE ?)";
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += " ORDER BY v.created_at DESC LIMIT ? OFFSET ?";
    params.push(Number(limit), offset);

    let rows: RowDataPacket[] = [];
    try {
      const [r] = await pool.query<RowDataPacket[]>(query, params);
      rows = r;
    } catch (e: any) {
      const msg = String(e?.message || "");
      const isMissingVoucherLocationsTable =
        e?.code === "ER_NO_SUCH_TABLE" && msg.includes("voucher_locations");
      const isMissingVoucherReviewsTable =
        e?.code === "ER_NO_SUCH_TABLE" && msg.includes("voucher_reviews");

      if (isMissingVoucherLocationsTable && isMissingVoucherReviewsTable) {
        query = queryFallbackNoBoth;
      } else if (isMissingVoucherLocationsTable) {
        query = queryFallbackNoLocations;
      } else if (isMissingVoucherReviewsTable) {
        query = queryFallbackNoReviews;
      } else {
        throw e;
      }

      const [r] = await pool.query<RowDataPacket[]>(query, params);
      rows = r;
    }

    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total
       FROM vouchers v
       JOIN users u ON v.owner_id = u.user_id
       WHERE u.role = 'owner'
         AND v.owner_deleted_at IS NULL
       ${status ? "AND v.status = ?" : ""}
       ${search ? "AND (v.code LIKE ? OR v.campaign_name LIKE ? OR u.full_name LIKE ?)" : ""}`,
      [
        ...(status ? [status] : []),
        ...(search ? [`%${search}%`, `%${search}%`, `%${search}%`] : []),
      ],
    );

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: countRows[0]?.total || 0,
        page: Number(page),
        limit: Number(limit),
      },
    });
  } catch (error: any) {
    console.error("Lỗi lấy owner vouchers:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy danh sách voucher của owner",
    });
  }
};

export const updateOwnerVoucherStatusAdmin = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const adminId = (req as any).userId;
    const voucherId = Number(req.params.id);
    const { status } = req.body as { status?: "active" | "inactive" };

    if (!Number.isFinite(voucherId)) {
      res
        .status(400)
        .json({ success: false, message: "voucherId không hợp lệ" });
      return;
    }

    if (!status || (status !== "active" && status !== "inactive")) {
      res.status(400).json({ success: false, message: "status không hợp lệ" });
      return;
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT v.voucher_id, v.owner_id
       FROM vouchers v
       JOIN users u ON v.owner_id = u.user_id
       WHERE v.voucher_id = ? AND u.role = 'owner'
       LIMIT 1`,
      [voucherId],
    );

    if (!rows[0]) {
      res
        .status(404)
        .json({ success: false, message: "Không tìm thấy voucher" });
      return;
    }

    await pool.query(`UPDATE vouchers SET status = ? WHERE voucher_id = ?`, [
      status,
      voucherId,
    ]);

    if (status === "active") {
      try {
        await pool.query(
          `INSERT INTO voucher_reviews (voucher_id, approval_status, rejection_reason, reviewed_by, reviewed_at)
           VALUES (?, 'approved', NULL, ?, NOW())
           ON DUPLICATE KEY UPDATE
             approval_status = 'approved',
             rejection_reason = NULL,
             reviewed_by = VALUES(reviewed_by),
             reviewed_at = VALUES(reviewed_at)`,
          [voucherId, adminId],
        );
      } catch (e: any) {
        const isMissingVoucherReviewsTable =
          e?.code === "ER_NO_SUCH_TABLE" &&
          String(e?.message || "").includes("voucher_reviews");
        if (!isMissingVoucherReviewsTable) throw e;
      }
    }

    const ownerId = Number((rows[0] as any)?.owner_id);
    if (Number.isFinite(ownerId)) {
      publishToUser(ownerId, {
        type: "owner_voucher_updated",
        voucher_id: voucherId,
        status,
      });
    }

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
      [
        adminId,
        "UPDATE_OWNER_VOUCHER_STATUS_ADMIN",
        JSON.stringify({
          voucher_id: voucherId,
          status,
          timestamp: new Date(),
        }),
      ],
    );

    res.json({
      success: true,
      message: "Cập nhật trạng thái voucher thành công",
    });
  } catch (error: any) {
    console.error("Lỗi updateOwnerVoucherStatusAdmin:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const deleteOwnerVoucherAdmin = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const adminId = (req as any).userId;
    const voucherId = Number(req.params.id);

    if (!Number.isFinite(voucherId)) {
      res
        .status(400)
        .json({ success: false, message: "voucherId không hợp lệ" });
      return;
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT v.voucher_id, v.owner_id, v.status, v.end_date, v.used_count, v.usage_limit
       FROM vouchers v
       JOIN users u ON v.owner_id = u.user_id
       WHERE v.voucher_id = ? AND u.role = 'owner'
       LIMIT 1`,
      [voucherId],
    );

    const row = rows?.[0] as
      | {
          voucher_id: number;
          owner_id: number;
          status: string;
          end_date: Date;
          used_count: number;
          usage_limit: number;
        }
      | undefined;

    if (!row) {
      res
        .status(404)
        .json({ success: false, message: "Không tìm thấy voucher" });
      return;
    }

    const usedCount = Number(row.used_count || 0);
    const usageLimit = Number(row.usage_limit || 0);
    const isUsedUp = usageLimit > 0 && usedCount >= usageLimit;

    // eligible if expired (status persisted OR end_date passed) or used up
    const isExpired =
      String(row.status) === "expired" ||
      (row.end_date ? new Date(row.end_date).getTime() < Date.now() : false);

    const canHardDelete = isExpired || isUsedUp;

    if (canHardDelete) {
      await pool.query(`DELETE FROM vouchers WHERE voucher_id = ?`, [
        voucherId,
      ]);
    } else {
      await pool.query(
        `UPDATE vouchers SET owner_deleted_at = NOW() WHERE voucher_id = ?`,
        [voucherId],
      );
    }

    publishToUser(row.owner_id, {
      type: "owner_voucher_deleted",
      voucher_id: voucherId,
    });

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
      [
        adminId,
        "DELETE_OWNER_VOUCHER_ADMIN",
        JSON.stringify({
          voucher_id: voucherId,
          owner_id: row.owner_id,
          used_count: usedCount,
          usage_limit: usageLimit,
          status: row.status,
          end_date: row.end_date,
          timestamp: new Date(),
        }),
      ],
    );

    res.json({
      success: true,
      message: canHardDelete
        ? "Đã xóa voucher của owner"
        : "Đã ẩn (xóa mềm) voucher của owner",
    });
  } catch (error: any) {
    console.error("Lỗi deleteOwnerVoucherAdmin:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const reviewOwnerVoucherAdmin = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const adminId = (req as any).userId;
    const voucherId = Number(req.params.id);
    const action = String((req.body as any)?.action || "").trim();
    const reason = (req.body as any)?.reason;

    if (!Number.isFinite(voucherId)) {
      res
        .status(400)
        .json({ success: false, message: "voucherId không hợp lệ" });
      return;
    }

    if (!action) {
      res.status(400).json({ success: false, message: "Thiếu action" });
      return;
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT v.voucher_id, v.owner_id, v.status, v.end_date
       FROM vouchers v
       JOIN users u ON v.owner_id = u.user_id
       WHERE v.voucher_id = ? AND u.role = 'owner' AND v.owner_deleted_at IS NULL
       LIMIT 1`,
      [voucherId],
    );
    const voucher = rows?.[0] as
      | { voucher_id: number; owner_id: number; status: string; end_date: Date }
      | undefined;

    if (!voucher) {
      res
        .status(404)
        .json({ success: false, message: "Không tìm thấy voucher" });
      return;
    }

    const computedExpired = voucher.end_date
      ? new Date(voucher.end_date).getTime() < Date.now()
      : false;

    const ensureVoucherReviews = async () => {
      try {
        await pool.query(`SELECT 1 FROM voucher_reviews LIMIT 1`);
      } catch (e: any) {
        const isMissing =
          e?.code === "ER_NO_SUCH_TABLE" &&
          String(e?.message || "").includes("voucher_reviews");
        if (isMissing) {
          res.status(500).json({
            success: false,
            message:
              "Thiếu bảng voucher_reviews. Vui lòng chạy migration docs/migrations/2026-02-01-vouchers-bank.sql",
          });
          return false;
        }
        throw e;
      }
      return true;
    };

    if (action === "approve") {
      if (computedExpired) {
        res.status(400).json({
          success: false,
          message: "Voucher đã hết hạn nên không thể duyệt",
        });
        return;
      }

      const ok = await ensureVoucherReviews();
      if (!ok) return;

      await pool.query(
        `UPDATE vouchers SET status = 'active' WHERE voucher_id = ?`,
        [voucherId],
      );

      await pool.query(
        `INSERT INTO voucher_reviews (voucher_id, approval_status, rejection_reason, reviewed_by, reviewed_at)
         VALUES (?, 'approved', NULL, ?, NOW())
         ON DUPLICATE KEY UPDATE
           approval_status = 'approved',
           rejection_reason = NULL,
           reviewed_by = VALUES(reviewed_by),
           reviewed_at = VALUES(reviewed_at)`,
        [voucherId, adminId],
      );

      publishToUser(Number(voucher.owner_id), {
        type: "owner_voucher_reviewed",
        voucher_id: voucherId,
        approval_status: "approved",
      });
    } else if (action === "reject") {
      const rejectionReason = String(reason || "").trim();
      if (!rejectionReason) {
        res
          .status(400)
          .json({ success: false, message: "Vui lòng nhập lý do từ chối" });
        return;
      }

      const ok = await ensureVoucherReviews();
      if (!ok) return;

      await pool.query(
        `UPDATE vouchers SET status = 'inactive' WHERE voucher_id = ?`,
        [voucherId],
      );

      await pool.query(
        `INSERT INTO voucher_reviews (voucher_id, approval_status, rejection_reason, reviewed_by, reviewed_at)
         VALUES (?, 'rejected', ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
           approval_status = 'rejected',
           rejection_reason = VALUES(rejection_reason),
           reviewed_by = VALUES(reviewed_by),
           reviewed_at = VALUES(reviewed_at)`,
        [voucherId, rejectionReason, adminId],
      );

      publishToUser(Number(voucher.owner_id), {
        type: "owner_voucher_reviewed",
        voucher_id: voucherId,
        approval_status: "rejected",
        rejection_reason: rejectionReason,
      });
    } else if (action === "hide" || action === "deactivate") {
      await pool.query(
        `UPDATE vouchers SET status = 'inactive' WHERE voucher_id = ?`,
        [voucherId],
      );

      publishToUser(Number(voucher.owner_id), {
        type: "owner_voucher_updated",
        voucher_id: voucherId,
        status: "inactive",
      });
    } else if (action === "activate") {
      if (computedExpired) {
        res.status(400).json({
          success: false,
          message: "Voucher đã hết hạn nên không thể bật",
        });
        return;
      }

      // Only allow activate if approved
      const ok = await ensureVoucherReviews();
      if (!ok) return;

      const [reviewRows] = await pool.query<RowDataPacket[]>(
        `SELECT approval_status FROM voucher_reviews WHERE voucher_id = ? LIMIT 1`,
        [voucherId],
      );
      const approvalStatus = String(
        reviewRows?.[0]?.approval_status || "pending",
      );
      if (approvalStatus !== "approved") {
        res.status(400).json({
          success: false,
          message: "Voucher chưa được duyệt nên không thể bật",
        });
        return;
      }

      await pool.query(
        `UPDATE vouchers SET status = 'active' WHERE voucher_id = ?`,
        [voucherId],
      );

      publishToUser(Number(voucher.owner_id), {
        type: "owner_voucher_updated",
        voucher_id: voucherId,
        status: "active",
      });
    } else {
      res.status(400).json({
        success: false,
        message:
          "action không hợp lệ (approve/reject/hide/activate/deactivate)",
      });
      return;
    }

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
      [
        adminId,
        "REVIEW_OWNER_VOUCHER_ADMIN",
        JSON.stringify({
          voucher_id: voucherId,
          action,
          reason: reason ?? null,
          timestamp: new Date(),
        }),
      ],
    );

    res.json({ success: true, message: "Đã cập nhật voucher" });
  } catch (error: any) {
    console.error("Lỗi reviewOwnerVoucherAdmin:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const updateOwnerVoucherAdmin = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const adminId = (req as any).userId;
    const voucherId = Number(req.params.id);
    const body = (req.body || {}) as any;

    if (!Number.isFinite(voucherId)) {
      res
        .status(400)
        .json({ success: false, message: "voucherId không hợp lệ" });
      return;
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT v.voucher_id, v.owner_id, v.status
       FROM vouchers v
       JOIN users u ON v.owner_id = u.user_id
       WHERE v.voucher_id = ? AND u.role = 'owner' AND v.owner_deleted_at IS NULL
       LIMIT 1`,
      [voucherId],
    );
    const voucher = rows?.[0] as
      | { voucher_id: number; owner_id: number; status: string }
      | undefined;

    if (!voucher) {
      res
        .status(404)
        .json({ success: false, message: "Không tìm thấy voucher" });
      return;
    }

    const normalizeNumber = (value: unknown): number | null => {
      if (value === null || value === undefined || value === "") return null;
      if (typeof value === "number")
        return Number.isFinite(value) ? value : null;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };

    const normalizeDateTimeInput = (value: unknown): string | null => {
      if (value === null || value === undefined) return null;
      if (typeof value !== "string") return null;
      const trimmed = value.trim();
      if (!trimmed) return null;

      let match = trimmed.match(
        /^(\d{2})\/(\d{2})\/(\d{4})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/,
      );
      if (match) {
        const [, dd, mm, yyyy, hh, min, ss] = match;
        const normalized = `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss ?? "00"}`;
        if (!Number.isNaN(Date.parse(normalized.replace(" ", "T"))))
          return normalized;
      }

      match = trimmed.match(
        /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/,
      );
      if (match) {
        const [, yyyy, mm, dd, hh, min, ss] = match;
        const normalized = `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss ?? "00"}`;
        if (!Number.isNaN(Date.parse(normalized.replace(" ", "T"))))
          return normalized;
      }

      match = trimmed.match(
        /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/,
      );
      if (match) {
        const [, yyyy, mm, dd, hh, min, ss] = match;
        const normalized = `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss ?? "00"}`;
        if (!Number.isNaN(Date.parse(normalized.replace(" ", "T"))))
          return normalized;
      }

      return null;
    };

    // Detect core changes => force pending review + inactive
    const willChangeCore =
      "discount_type" in body ||
      "discount_value" in body ||
      "apply_to_service_type" in body ||
      "apply_to_location_type" in body ||
      "min_order_value" in body ||
      "max_discount_amount" in body ||
      "start_date" in body ||
      "end_date" in body ||
      "usage_limit" in body ||
      "max_uses_per_user" in body ||
      "location_id" in body ||
      "location_scope" in body ||
      "location_ids" in body;

    const allowedFields = [
      "campaign_name",
      "campaign_description",
      "discount_type",
      "discount_value",
      "apply_to_service_type",
      "apply_to_location_type",
      "min_order_value",
      "max_discount_amount",
      "start_date",
      "end_date",
      "usage_limit",
      "max_uses_per_user",
    ];

    const setClauses: string[] = [];
    const params: any[] = [];

    for (const key of allowedFields) {
      if (body[key] === undefined) continue;
      let value = body[key];

      if (key === "discount_value") {
        const normalized = normalizeNumber(value);
        if (normalized == null) {
          res
            .status(400)
            .json({ success: false, message: "discount_value không hợp lệ" });
          return;
        }
        value = normalized;
      }

      if (key === "min_order_value") {
        const normalized = normalizeNumber(value);
        value = normalized == null ? 0 : normalized;
      }

      if (key === "max_discount_amount") {
        if (value === null || value === "") {
          value = null;
        } else {
          const normalized = normalizeNumber(value);
          if (normalized == null) {
            res.status(400).json({
              success: false,
              message: "max_discount_amount không hợp lệ",
            });
            return;
          }
          value = normalized;
        }
      }

      if (key === "usage_limit" || key === "max_uses_per_user") {
        const normalized = normalizeNumber(value);
        if (normalized == null || normalized < 1) {
          res.status(400).json({
            success: false,
            message: `${key} không hợp lệ`,
          });
          return;
        }
        value = normalized;
      }

      if (key === "start_date" || key === "end_date") {
        const normalized = normalizeDateTimeInput(value);
        if (!normalized) {
          res.status(400).json({
            success: false,
            message: `${key} không đúng định dạng DD/MM/YYYY HH:mm`,
          });
          return;
        }
        value = normalized;
      }

      setClauses.push(`${key} = ?`);
      params.push(value);
    }

    // Location scope update for owner vouchers
    const wantsScopeUpdate =
      body.location_scope !== undefined ||
      body.location_ids !== undefined ||
      body.location_id !== undefined;

    let desiredScope: "all" | "single" | "multiple" | null = null;
    let desiredLocationId: number | null = null;
    let desiredLocationIds: number[] = [];

    if (wantsScopeUpdate) {
      const rawScope = String(body.location_scope ?? "").trim();
      if (
        rawScope === "all" ||
        rawScope === "single" ||
        rawScope === "multiple"
      ) {
        desiredScope = rawScope;
      } else if (Array.isArray(body.location_ids)) {
        desiredScope = "multiple";
      } else {
        desiredScope = "all";
      }

      if (desiredScope === "single") {
        const n = Number(body.location_id);
        desiredLocationId = Number.isFinite(n) ? n : null;
        if (desiredLocationId == null) {
          res.status(400).json({
            success: false,
            message: "Vui lòng chọn 1 địa điểm",
          });
          return;
        }
      }

      if (desiredScope === "multiple") {
        const rawIds = Array.isArray(body.location_ids)
          ? body.location_ids
          : [];
        desiredLocationIds = Array.from(
          new Set(
            rawIds
              .map((x: any) => Number(x))
              .filter((n: number) => Number.isFinite(n))
              .map((n: number) => Math.trunc(n)),
          ),
        );
        if (desiredLocationIds.length === 0) {
          res.status(400).json({
            success: false,
            message: "Vui lòng chọn ít nhất 1 địa điểm",
          });
          return;
        }
      }

      // Validate locations belong to owner
      if (desiredScope === "single" && desiredLocationId != null) {
        const [locRows] = await pool.query<RowDataPacket[]>(
          `SELECT location_id FROM locations WHERE location_id = ? AND owner_id = ? LIMIT 1`,
          [desiredLocationId, voucher.owner_id],
        );
        if (!locRows[0]) {
          res.status(403).json({
            success: false,
            message: "Địa điểm không thuộc owner",
          });
          return;
        }
      }

      if (desiredScope === "multiple") {
        const [locRows] = await pool.query<RowDataPacket[]>(
          `SELECT location_id FROM locations WHERE owner_id = ? AND location_id IN (?)`,
          [voucher.owner_id, desiredLocationIds],
        );
        const foundIds = new Set(locRows.map((r) => Number(r.location_id)));
        const missing = desiredLocationIds.filter((id) => !foundIds.has(id));
        if (missing.length > 0) {
          res.status(403).json({
            success: false,
            message: `Địa điểm không thuộc owner: ${missing.join(", ")}`,
          });
          return;
        }
      }

      // Column update for scope
      const locationIdValue =
        desiredScope === "single" ? desiredLocationId : null;
      setClauses.push(`location_id = ?`);
      params.push(locationIdValue);
    }

    if (setClauses.length === 0 && !wantsScopeUpdate) {
      res
        .status(400)
        .json({ success: false, message: "Không có dữ liệu cập nhật" });
      return;
    }

    if (willChangeCore) {
      // Force to inactive while waiting for (re)approval
      setClauses.push(`status = 'inactive'`);
    }

    params.push(voucherId);
    await pool.query(
      `UPDATE vouchers SET ${setClauses.join(", ")} WHERE voucher_id = ?`,
      params,
    );

    // Apply voucher_locations changes if needed
    if (wantsScopeUpdate && desiredScope) {
      try {
        await pool.query(`DELETE FROM voucher_locations WHERE voucher_id = ?`, [
          voucherId,
        ]);
        if (desiredScope === "multiple") {
          const valuesSql = desiredLocationIds.map(() => "(?, ?)").join(", ");
          const flatParams = desiredLocationIds.flatMap((id) => [
            voucherId,
            id,
          ]);
          await pool.query(
            `INSERT INTO voucher_locations (voucher_id, location_id) VALUES ${valuesSql}`,
            flatParams,
          );
        }
      } catch (e: any) {
        const isMissingVoucherLocationsTable =
          e?.code === "ER_NO_SUCH_TABLE" &&
          String(e?.message || "").includes("voucher_locations");
        if (isMissingVoucherLocationsTable) {
          res.status(500).json({
            success: false,
            message:
              "Thiếu bảng voucher_locations. Vui lòng chạy migration docs/migrations/2026-02-01-vouchers-bank.sql",
          });
          return;
        }
        throw e;
      }
    }

    // Reset approval status to pending if core changed
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
        const isMissingVoucherReviewsTable =
          e?.code === "ER_NO_SUCH_TABLE" &&
          String(e?.message || "").includes("voucher_reviews");
        if (isMissingVoucherReviewsTable) {
          res.status(500).json({
            success: false,
            message:
              "Thiếu bảng voucher_reviews. Vui lòng chạy migration docs/migrations/2026-02-01-vouchers-bank.sql",
          });
          return;
        }
        throw e;
      }
    }

    publishToUser(Number(voucher.owner_id), {
      type: "owner_voucher_updated",
      voucher_id: voucherId,
      status: "inactive",
    });

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
      [
        adminId,
        "UPDATE_OWNER_VOUCHER_ADMIN",
        JSON.stringify({ voucher_id: voucherId, timestamp: new Date() }),
      ],
    );

    res.json({
      success: true,
      message: willChangeCore
        ? "Đã cập nhật voucher (chờ duyệt lại)"
        : "Đã cập nhật voucher",
    });
  } catch (error: any) {
    console.error("Lỗi updateOwnerVoucherAdmin:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const updateSystemVoucher = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const adminId = (req as any).userId;
    const { id } = req.params;
    const voucherId = Number(id);
    const updates = req.body || {};

    if (!Number.isFinite(voucherId)) {
      res.status(400).json({
        success: false,
        message: "voucher_id không hợp lệ",
      });
      return;
    }

    if (
      updates.discount_type !== undefined &&
      !["percent", "amount"].includes(updates.discount_type)
    ) {
      res.status(400).json({
        success: false,
        message: "discount_type không hợp lệ",
      });
      return;
    }

    if (
      updates.apply_to_service_type !== undefined &&
      !["all", "room", "food", "ticket", "other"].includes(
        updates.apply_to_service_type,
      )
    ) {
      res.status(400).json({
        success: false,
        message: "apply_to_service_type không hợp lệ",
      });
      return;
    }

    if (
      updates.apply_to_location_type !== undefined &&
      ![
        "all",
        "hotel",
        "restaurant",
        "tourist",
        "cafe",
        "resort",
        "other",
      ].includes(updates.apply_to_location_type)
    ) {
      res.status(400).json({
        success: false,
        message: "apply_to_location_type không hợp lệ",
      });
      return;
    }

    if (
      updates.status !== undefined &&
      !["active", "inactive", "expired"].includes(updates.status)
    ) {
      res.status(400).json({
        success: false,
        message: "status không hợp lệ",
      });
      return;
    }

    const normalizeNumber = (value: unknown): number | null => {
      if (value === null || value === undefined || value === "") return null;
      if (typeof value === "number")
        return Number.isFinite(value) ? value : null;
      if (typeof value === "string") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
      }
      return null;
    };

    if (updates.max_uses_per_user !== undefined) {
      const normalized = normalizeNumber(updates.max_uses_per_user);
      if (normalized === null) {
        delete updates.max_uses_per_user;
      } else if (normalized < 1) {
        res.status(400).json({
          success: false,
          message: "max_uses_per_user không hợp lệ",
        });
        return;
      } else {
        updates.max_uses_per_user = normalized;
      }
    }

    if (updates.discount_value !== undefined) {
      const normalized = normalizeNumber(updates.discount_value);
      if (normalized === null) {
        res.status(400).json({
          success: false,
          message: "discount_value không hợp lệ",
        });
        return;
      }
      updates.discount_value = normalized;
    }

    if (updates.min_order_value !== undefined) {
      const normalized = normalizeNumber(updates.min_order_value);
      // Vì sao: cho phép reset về 0 nếu admin xóa giá trị nhập
      updates.min_order_value = normalized === null ? 0 : normalized;
    }

    if (updates.max_discount_amount !== undefined) {
      const rawValue = updates.max_discount_amount;
      const normalized = normalizeNumber(rawValue);
      if (rawValue === null || rawValue === "") {
        updates.max_discount_amount = null;
      } else if (normalized === null) {
        res.status(400).json({
          success: false,
          message: "max_discount_amount không hợp lệ",
        });
        return;
      } else {
        updates.max_discount_amount = normalized;
      }
    }

    if (updates.usage_limit !== undefined) {
      const normalized = normalizeNumber(updates.usage_limit);
      if (normalized === null) {
        delete updates.usage_limit;
      } else if (normalized < 1) {
        res.status(400).json({
          success: false,
          message: "usage_limit không hợp lệ",
        });
        return;
      } else {
        updates.usage_limit = normalized;
      }
    }

    if (updates.start_date !== undefined) {
      const normalizeDateTimeInput = (value: unknown): string | null => {
        if (value === null || value === undefined) return null;
        if (typeof value !== "string") return null;
        const trimmed = value.trim();
        if (!trimmed) return null;

        let match = trimmed.match(
          /^(\d{2})\/(\d{2})\/(\d{4})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/,
        );
        if (match) {
          const [, dd, mm, yyyy, hh, min, ss] = match;
          const normalized = `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss ?? "00"}`;
          if (!Number.isNaN(Date.parse(normalized.replace(" ", "T")))) {
            return normalized;
          }
        }

        match = trimmed.match(
          /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/,
        );
        if (match) {
          const [, yyyy, mm, dd, hh, min, ss] = match;
          const normalized = `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss ?? "00"}`;
          if (!Number.isNaN(Date.parse(normalized.replace(" ", "T")))) {
            return normalized;
          }
        }

        match = trimmed.match(
          /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/,
        );
        if (match) {
          const [, yyyy, mm, dd, hh, min, ss] = match;
          const normalized = `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss ?? "00"}`;
          if (!Number.isNaN(Date.parse(normalized.replace(" ", "T")))) {
            return normalized;
          }
        }

        return null;
      };

      const normalized = normalizeDateTimeInput(updates.start_date);
      if (!normalized) {
        res.status(400).json({
          success: false,
          message: "start_date không đúng định dạng DD/MM/YYYY HH:mm",
        });
        return;
      }
      updates.start_date = normalized;
    }

    if (updates.end_date !== undefined) {
      const normalizeDateTimeInput = (value: unknown): string | null => {
        if (value === null || value === undefined) return null;
        if (typeof value !== "string") return null;
        const trimmed = value.trim();
        if (!trimmed) return null;

        let match = trimmed.match(
          /^(\d{2})\/(\d{2})\/(\d{4})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/,
        );
        if (match) {
          const [, dd, mm, yyyy, hh, min, ss] = match;
          const normalized = `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss ?? "00"}`;
          if (!Number.isNaN(Date.parse(normalized.replace(" ", "T")))) {
            return normalized;
          }
        }

        match = trimmed.match(
          /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/,
        );
        if (match) {
          const [, yyyy, mm, dd, hh, min, ss] = match;
          const normalized = `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss ?? "00"}`;
          if (!Number.isNaN(Date.parse(normalized.replace(" ", "T")))) {
            return normalized;
          }
        }

        match = trimmed.match(
          /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/,
        );
        if (match) {
          const [, yyyy, mm, dd, hh, min, ss] = match;
          const normalized = `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss ?? "00"}`;
          if (!Number.isNaN(Date.parse(normalized.replace(" ", "T")))) {
            return normalized;
          }
        }

        return null;
      };

      const normalized = normalizeDateTimeInput(updates.end_date);
      if (!normalized) {
        res.status(400).json({
          success: false,
          message: "end_date không đúng định dạng DD/MM/YYYY HH:mm",
        });
        return;
      }
      updates.end_date = normalized;
    }

    // Optional location scope update (all/single/multiple)
    // - all: location_id = NULL and clear voucher_locations
    // - single: location_id = <id> and clear voucher_locations
    // - multiple: location_id = NULL and set voucher_locations
    const wantsScopeUpdate =
      updates.location_scope !== undefined ||
      updates.location_ids !== undefined;

    const parseId = (v: unknown): number | null => {
      if (v === null || v === undefined) return null;
      if (v === "" || v === "all") return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    let desiredScope: "all" | "single" | "multiple" | null = null;
    let desiredLocationId: number | null = null;
    let desiredLocationIds: number[] = [];

    if (wantsScopeUpdate) {
      const rawScope = String(updates.location_scope ?? "").trim();
      if (
        rawScope === "all" ||
        rawScope === "single" ||
        rawScope === "multiple"
      ) {
        desiredScope = rawScope;
      } else if (Array.isArray(updates.location_ids)) {
        desiredScope = "multiple";
      } else {
        desiredScope = "all";
      }

      if (desiredScope === "single") {
        desiredLocationId = parseId(updates.location_id);
        if (desiredLocationId == null) {
          res
            .status(400)
            .json({ success: false, message: "Vui lòng chọn 1 địa điểm" });
          return;
        }
      }

      if (desiredScope === "multiple") {
        const rawIds = Array.isArray(updates.location_ids)
          ? updates.location_ids
          : [];
        desiredLocationIds = Array.from(
          new Set(
            rawIds
              .map((x: any) => Number(x))
              .filter((n: number) => Number.isFinite(n))
              .map((n: number) => Math.trunc(n)),
          ),
        );
        if (desiredLocationIds.length === 0) {
          res.status(400).json({
            success: false,
            message: "Vui lòng chọn ít nhất 1 địa điểm",
          });
          return;
        }
      }

      // Validate location existence
      if (desiredScope === "single" && desiredLocationId != null) {
        const [locRows] = await pool.query<RowDataPacket[]>(
          `SELECT location_id FROM locations WHERE location_id = ? LIMIT 1`,
          [desiredLocationId],
        );
        if (!locRows[0]) {
          res
            .status(404)
            .json({ success: false, message: "Địa điểm không tồn tại" });
          return;
        }
      }

      if (desiredScope === "multiple") {
        const [locRows] = await pool.query<RowDataPacket[]>(
          `SELECT location_id FROM locations WHERE location_id IN (?)`,
          [desiredLocationIds],
        );
        const foundIds = new Set(locRows.map((r) => Number(r.location_id)));
        const missing = desiredLocationIds.filter((id) => !foundIds.has(id));
        if (missing.length > 0) {
          res.status(404).json({
            success: false,
            message: `Địa điểm không tồn tại: ${missing.join(", ")}`,
          });
          return;
        }
      }

      // Materialize to column update
      updates.location_id =
        desiredScope === "single" ? desiredLocationId : null;
    } else if (updates.location_id !== undefined) {
      // Backward-compatible: allow updating location_id directly
      const parsedLocationId = parseId(updates.location_id);
      if (
        updates.location_id !== null &&
        updates.location_id !== "" &&
        parsedLocationId == null
      ) {
        res
          .status(400)
          .json({ success: false, message: "location_id không hợp lệ" });
        return;
      }
      if (parsedLocationId != null) {
        const [locRows] = await pool.query<RowDataPacket[]>(
          `SELECT location_id FROM locations WHERE location_id = ? LIMIT 1`,
          [parsedLocationId],
        );
        if (!locRows[0]) {
          res
            .status(404)
            .json({ success: false, message: "Địa điểm không tồn tại" });
          return;
        }
      }
      updates.location_id = parsedLocationId;
    }

    // Chỉ cho phép update vài field an toàn
    const allowedFields = [
      "location_id",
      "campaign_name",
      "campaign_description",
      "discount_type",
      "discount_value",
      "apply_to_service_type",
      "apply_to_location_type",
      "min_order_value",
      "max_discount_amount",
      "start_date",
      "end_date",
      "usage_limit",
      "max_uses_per_user",
      "status",
    ];

    const setClauses: string[] = [];
    const params: any[] = [];

    for (const key of allowedFields) {
      if (updates[key] !== undefined) {
        setClauses.push(`${key} = ?`);
        params.push(updates[key]);
      }
    }

    if (setClauses.length === 0) {
      res
        .status(400)
        .json({ success: false, message: "Không có dữ liệu cập nhật hợp lệ" });
      return;
    }

    // đảm bảo voucher thuộc admin
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT v.voucher_id
       FROM vouchers v
       JOIN users u ON v.owner_id = u.user_id
       WHERE v.voucher_id = ? AND u.role = 'admin'`,
      [voucherId],
    );
    if (rows.length === 0) {
      res
        .status(404)
        .json({ success: false, message: "Không tìm thấy voucher hệ thống" });
      return;
    }

    const sql = `UPDATE vouchers SET ${setClauses.join(
      ", ",
    )} WHERE voucher_id = ?`;
    params.push(voucherId);

    await pool.query(sql, params);

    // Apply voucher_locations changes if scope update requested
    if (wantsScopeUpdate && desiredScope) {
      try {
        // Clear existing
        await pool.query(`DELETE FROM voucher_locations WHERE voucher_id = ?`, [
          voucherId,
        ]);

        if (desiredScope === "multiple") {
          const valuesSql = desiredLocationIds.map(() => "(?, ?)").join(", ");
          const flatParams = desiredLocationIds.flatMap((id) => [
            voucherId,
            id,
          ]);
          await pool.query(
            `INSERT INTO voucher_locations (voucher_id, location_id) VALUES ${valuesSql}`,
            flatParams,
          );
        }
      } catch (e: any) {
        const isMissingVoucherLocationsTable =
          e?.code === "ER_NO_SUCH_TABLE" &&
          String(e?.message || "").includes("voucher_locations");
        if (isMissingVoucherLocationsTable) {
          res.status(500).json({
            success: false,
            message:
              "Thiếu bảng voucher_locations. Vui lòng chạy migration docs/migrations/2026-02-01-vouchers-bank.sql",
          });
          return;
        }
        throw e;
      }
    }

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
      [
        adminId,
        "UPDATE_SYSTEM_VOUCHER",
        JSON.stringify({ voucherId: id, updates, timestamp: new Date() }),
      ],
    );

    res.json({
      success: true,
      message: "Cập nhật voucher hệ thống thành công",
    });
  } catch (error: any) {
    console.error("Lỗi update system voucher:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi cập nhật voucher hệ thống",
    });
  }
};

export const deleteSystemVoucher = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const adminId = (req as any).userId;
    const { id } = req.params;

    // đảm bảo voucher thuộc admin
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT v.voucher_id,
              v.status,
              v.end_date,
              CASE WHEN v.end_date < NOW() THEN 'expired' ELSE v.status END as computed_status
       FROM vouchers v
       JOIN users u ON v.owner_id = u.user_id
       WHERE v.voucher_id = ? AND u.role = 'admin'`,
      [id],
    );

    if (rows.length === 0) {
      res
        .status(404)
        .json({ success: false, message: "Không tìm thấy voucher hệ thống" });
      return;
    }

    const computedStatus = String(rows[0]?.computed_status || "");
    if (computedStatus === "active") {
      res.status(400).json({
        success: false,
        message:
          "Voucher đang hoạt động nên không thể xóa. Vui lòng chuyển sang trạng thái 'inactive' hoặc để hết hạn.",
      });
      return;
    }

    await pool.query(`DELETE FROM vouchers WHERE voucher_id = ?`, [id]);

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
      [
        adminId,
        "DELETE_SYSTEM_VOUCHER",
        JSON.stringify({ voucherId: id, timestamp: new Date() }),
      ],
    );

    res.json({ success: true, message: "Đã xóa voucher hệ thống" });
  } catch (error: any) {
    console.error("Lỗi delete system voucher:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi xóa voucher hệ thống",
    });
  }
};

// ==================== PUSH NOTIFICATIONS (ADMIN) ====================
export const createPushNotification = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const adminId = (req as any).userId;
    const { title, body, target_audience, target_user_id } = req.body as {
      title?: string;
      body?: string;
      target_audience?: string;
      target_user_id?: number;
    };

    if (!title || !body || !target_audience) {
      res.status(400).json({
        success: false,
        message: "Thiếu dữ liệu bắt buộc (title, body, target_audience)",
      });
      return;
    }

    const allowed = ["all_users", "all_owners", "specific_user"];
    if (!allowed.includes(target_audience)) {
      res
        .status(400)
        .json({ success: false, message: "target_audience không hợp lệ" });
      return;
    }

    if (target_audience === "specific_user" && !target_user_id) {
      res.status(400).json({
        success: false,
        message: "Cần target_user_id khi gửi cho user cụ thể",
      });
      return;
    }

    const result = await sendPushNotification({
      title,
      body,
      targetAudience: target_audience as
        | "all_users"
        | "all_owners"
        | "specific_user",
      sentBy: adminId,
      targetUserId: target_user_id ?? null,
    });

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
      [
        adminId,
        "CREATE_PUSH_NOTIFICATION",
        JSON.stringify({
          title,
          target_audience,
          notificationId: result.notificationId,
          fcmSent: result.fcmSent,
          timestamp: new Date(),
        }),
      ],
    );

    res.status(201).json({
      success: true,
      message: "Đã tạo thông báo đẩy",
      data: {
        notification_id: result.notificationId,
        fcm: {
          sent: result.fcmSent,
          message_id: result.fcmMessageId,
        },
      },
    });
  } catch (error: any) {
    console.error("Lỗi tạo push notification:", error);
    res
      .status(500)
      .json({ success: false, message: "Lỗi server khi tạo thông báo đẩy" });
  }
};

export const getPushNotifications = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { page = "1", limit = "20" } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT 
         pn.*,
         u.full_name as sent_by_name,
         u.email as sent_by_email
       FROM push_notifications pn
       LEFT JOIN users u ON pn.sent_by = u.user_id
       ORDER BY pn.created_at DESC
       LIMIT ? OFFSET ?`,
      [Number(limit), offset],
    );

    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM push_notifications`,
    );

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: countRows[0]?.total || 0,
        page: Number(page),
        limit: Number(limit),
      },
    });
  } catch (error: any) {
    console.error("Lỗi lấy push notifications:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy danh sách thông báo",
    });
  }
};

export const deletePushNotification = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const adminId = req.userId;

    if (!adminId) {
      res.status(401).json({ success: false, message: "Chưa xác thực" });
      return;
    }

    const [delResult] = await pool.query(
      `DELETE FROM push_notifications WHERE notification_id = ?`,
      [id],
    );

    const affected = (delResult as unknown as { affectedRows: number })
      .affectedRows;
    if (!affected) {
      res.status(404).json({
        success: false,
        message: "Không tìm thấy thông báo",
      });
      return;
    }

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
      [
        adminId,
        "DELETE_PUSH_NOTIFICATION",
        JSON.stringify({ notificationId: id, timestamp: new Date() }),
      ],
    );

    res.json({ success: true, message: "Đã xóa thông báo" });
  } catch (error: unknown) {
    console.error("Lỗi xóa push notification:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi xóa thông báo",
    });
  }
};

// ==================== AVATAR (URL/FILESYSTEM) (ADMIN) ====================
export const getAdminAvatarCurrent = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const adminId = req.userId;
    if (!adminId) {
      res.status(401).json({ success: false, message: "Chưa xác thực" });
      return;
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT avatar_url FROM users WHERE user_id = ? AND role = 'admin' LIMIT 1`,
      [adminId],
    );

    const avatarUrl = rows[0]?.avatar_url as string | null | undefined;
    if (!avatarUrl) {
      res.status(204).end();
      return;
    }

    // Trả về redirect để tương thích với client đang gọi endpoint lấy ảnh
    res.setHeader("Cache-Control", "no-store");
    res.redirect(302, avatarUrl);
  } catch (error: unknown) {
    console.error("Lỗi getAdminAvatarCurrent:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const getAdminAvatarHistory = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const adminId = req.userId;
    if (!adminId) {
      res.status(401).json({ success: false, message: "Chưa xác thực" });
      return;
    }

    // user_avatar_history đã bị loại bỏ trong DB rút gọn
    res.json({ success: true, data: [] });
  } catch (error: unknown) {
    console.error("Lỗi getAdminAvatarHistory:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const getAdminAvatarHistoryFile = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const adminId = req.userId;
    if (!adminId) {
      res.status(401).json({ success: false, message: "Chưa xác thực" });
      return;
    }

    // user_avatar_history đã bị loại bỏ trong DB rút gọn
    res.status(410).json({
      success: false,
      message: "Tính năng lịch sử avatar đã bị tắt trong DB rút gọn",
    });
  } catch (error: unknown) {
    console.error("Lỗi getAdminAvatarHistoryFile:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const useAdminAvatarFromHistory = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const adminId = req.userId;
    if (!adminId) {
      res.status(401).json({ success: false, message: "Chưa xác thực" });
      return;
    }

    // user_avatar_history đã bị loại bỏ trong DB rút gọn
    res.status(410).json({
      success: false,
      message: "Tính năng chọn avatar cũ đã bị tắt trong DB rút gọn",
    });
  } catch (error: unknown) {
    console.error("Lỗi useAdminAvatarFromHistory:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

// ==================== PAYMENT CONFIRM -> COMMISSION + VAT (ADMIN) ====================
export const confirmPaymentAndCreateCommission = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const paymentId = Number(req.params.id);
  const adminId = req.userId;
  const { due_days } = req.body as { due_days?: number };

  if (!Number.isFinite(paymentId)) {
    res.status(400).json({ success: false, message: "paymentId không hợp lệ" });
    return;
  }
  if (!adminId) {
    res.status(401).json({ success: false, message: "Chưa xác thực" });
    return;
  }

  const dueDays =
    Number.isFinite(due_days) && (due_days as number) >= 0
      ? Math.floor(due_days as number)
      : 7;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [paymentRows] = await conn.query<RowDataPacket[]>(
      `SELECT p.payment_id, p.amount, p.location_id, p.booking_id, p.status,
              p.commission_rate, p.commission_amount, p.vat_rate, p.vat_amount,
              l.owner_id
       FROM payments p
       JOIN locations l ON l.location_id = p.location_id
       WHERE p.payment_id = ?
       FOR UPDATE`,
      [paymentId],
    );

    if (!paymentRows[0]) {
      await conn.rollback();
      res
        .status(404)
        .json({ success: false, message: "Không tìm thấy payment" });
      return;
    }

    const payment = paymentRows[0] as {
      payment_id: number;
      amount: string;
      location_id: number;
      booking_id: number | null;
      status: "pending" | "completed" | "failed" | "refunded";
      owner_id: number;
      commission_rate: string | number | null;
      commission_amount: string | number | null;
      vat_rate: string | number | null;
      vat_amount: string | number | null;
    };

    const [existingCommissionRows] = await conn.query<RowDataPacket[]>(
      `SELECT commission_id FROM commissions WHERE payment_id = ? LIMIT 1 FOR UPDATE`,
      [paymentId],
    );
    if (existingCommissionRows[0]) {
      await conn.commit();
      res.json({
        success: true,
        message: "Payment đã được confirm trước đó",
        data: { commission_id: existingCommissionRows[0].commission_id },
      });
      return;
    }

    const safeCommissionRate = Number.isFinite(Number(payment.commission_rate))
      ? Number(payment.commission_rate)
      : 2.5;
    const safeVatRate = Number.isFinite(Number(payment.vat_rate))
      ? Number(payment.vat_rate)
      : 10;
    const commissionAmount = Number(payment.commission_amount || 0);
    const vatAmount = Number(payment.vat_amount || 0);
    const totalDue = +(commissionAmount + vatAmount).toFixed(2);

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + dueDays);
    const dueDateStr = dueDate.toISOString().slice(0, 10);

    const [insertCommissionResult] = await conn.query<any>(
      `INSERT INTO commissions (owner_id, payment_id, booking_id, commission_amount, vat_amount, total_due, due_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        payment.owner_id,
        paymentId,
        payment.booking_id,
        commissionAmount,
        vatAmount,
        totalDue,
        dueDateStr,
      ],
    );

    await conn.query(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
      [
        adminId,
        "CONFIRM_PAYMENT_CREATE_COMMISSION",
        JSON.stringify({
          payment_id: paymentId,
          owner_id: payment.owner_id,
          commission_rate: safeCommissionRate,
          vat_rate: safeVatRate,
          commission_amount: commissionAmount,
          vat_amount: vatAmount,
          total_due: totalDue,
          due_date: dueDateStr,
          timestamp: new Date(),
        }),
      ],
    );

    await conn.commit();

    res.status(201).json({
      success: true,
      message: "Đã confirm payment và tạo commission",
      data: {
        commission_id: insertCommissionResult?.insertId,
        owner_id: payment.owner_id,
        payment_id: paymentId,
        booking_id: payment.booking_id,
        commission_rate: safeCommissionRate,
        vat_rate: safeVatRate,
        commission_amount: commissionAmount,
        vat_amount: vatAmount,
        total_due: totalDue,
        due_date: dueDateStr,
      },
    });
  } catch (error: unknown) {
    try {
      await conn.rollback();
    } catch {
      // ignore
    }
    console.error("Lỗi confirmPaymentAndCreateCommission:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  } finally {
    conn.release();
  }
};
