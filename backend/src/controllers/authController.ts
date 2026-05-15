import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { pool } from "../config/database";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import {
  clearActiveSessionId,
  getActiveSessionId,
  setActiveSessionId,
} from "../utils/session";
import { emitSessionRevoked } from "../utils/socketHub";
import {
  sendOTPEmail,
  sendOwnerTermsAcceptedEmail,
} from "../utils/emailService";

interface User extends RowDataPacket {
  user_id: number;
  email: string;
  phone: string | null;
  password_hash: string | null;
  full_name: string;
  role: string;
  status: string;
  avatar_url: string | null;
  avatar_path?: string | null;
  avatar_source?: "upload" | "url" | null;
  is_verified: number;
  google_id: string | null;
  facebook_id: string | null;
  refresh_token: string | null;
  deleted_at?: string | null;
}

// ==================== HELPER FUNCTIONS ====================
const generateToken = (
  userId: number,
  role: string,
  sessionId: string,
): string => {
  return jwt.sign(
    { userId, role, sessionId },
    process.env.JWT_SECRET || "your-secret-key",
    { expiresIn: "7d" }, // ✅ FIX: Hardcode string literal thay vì process.env
  );
};

const generateRefreshToken = (userId: number): string => {
  return jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET || "your-refresh-secret",
    { expiresIn: "30d" }, // ✅ FIX: Hardcode string literal
  );
};

const getRoleRedirectUrl = (role: string): string => {
  const redirectMap: { [key: string]: string } = {
    admin: "/admin/dashboard",
    owner: "/owner/dashboard",
    employee: "/employee/front-office",
    user: "/user/dashboard",
  };
  return redirectMap[role] || "/user/dashboard";
};

const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const getEffectiveAvatarUrl = (user: User): string | null => {
  const avatarPath =
    typeof user.avatar_path === "string" && user.avatar_path.trim().length
      ? user.avatar_path.trim()
      : null;
  const avatarUrl =
    typeof user.avatar_url === "string" && user.avatar_url.trim().length
      ? user.avatar_url.trim()
      : null;

  // Prefer uploaded local path when available (admin upload flow stores avatar_url=NULL)
  if (user.avatar_source === "upload" && avatarPath) return avatarPath;

  // Backward/defensive: if avatar_source missing but avatar_path exists, still use it
  if (!user.avatar_source && avatarPath) return avatarPath;

  return avatarUrl;
};

const saveOTP = async (
  email: string,
  otp: string,
  type: "REGISTER" | "FORGOT_PASSWORD",
): Promise<void> => {
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  await pool.query(
    `INSERT INTO otp_codes (email, otp_code, type, expires_at) 
     VALUES (?, ?, ?, ?)`,
    [email, otp, type, expiresAt],
  );
};

const verifyOTPCode = async (
  email: string,
  otp: string,
  type: "REGISTER" | "FORGOT_PASSWORD",
): Promise<boolean> => {
  const [rows]: any = await pool.query(
    `SELECT * FROM otp_codes 
     WHERE email = ? AND otp_code = ? AND type = ? 
     AND expires_at > NOW() AND is_used = 0
     ORDER BY created_at DESC LIMIT 1`,
    [email, otp, type],
  );

  if (rows.length === 0) {
    return false;
  }

  await pool.query(`UPDATE otp_codes SET is_used = 1 WHERE id = ?`, [
    rows[0].id,
  ]);

  return true;
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

const isCredentialBlacklisted = async (params: {
  email?: string | null;
  phone?: string | null;
}): Promise<boolean> => {
  await ensureAccountBlacklistSchema();

  const email = typeof params.email === "string" ? params.email.trim() : "";
  const phone = typeof params.phone === "string" ? params.phone.trim() : "";

  if (!email && !phone) return false;

  const where: string[] = [];
  const values: string[] = [];

  if (email) {
    where.push("email = ?");
    values.push(email);
  }
  if (phone) {
    where.push("phone = ?");
    values.push(phone);
  }

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT blacklist_id FROM account_blacklist WHERE ${where.join(" OR ")} LIMIT 1`,
    values,
  );

  return rows.length > 0;
};

// ==================== ĐĂNG KÝ TÀI KHOẢN ====================
export const register = async (req: Request, res: Response): Promise<void> => {
  const connection = await pool.getConnection();

  try {
    const { email, phone, password, full_name } = req.body;

    // Validation
    if (!email && !phone) {
      res.status(400).json({
        success: false,
        message: "Phải có ít nhất Email HOẶC Số điện thoại",
      });
      return;
    }

    if (!password || !full_name) {
      res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp đầy đủ thông tin",
      });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({
        success: false,
        message: "Mật khẩu phải có ít nhất 6 ký tự",
      });
      return;
    }

    if (
      await isCredentialBlacklisted({
        email: email || null,
        phone: phone || null,
      })
    ) {
      res.status(403).json({
        success: false,
        message:
          "Thông tin email hoặc số điện thoại này đã bị cấm đăng ký. Vui lòng liên hệ admin.",
      });
      return;
    }

    // Kiểm tra user đã tồn tại
    const [existingUsers] = await connection.query<User[]>(
      "SELECT * FROM users WHERE email = ? OR phone = ?",
      [email || null, phone || null],
    );

    if (existingUsers.length > 0) {
      res.status(400).json({
        success: false,
        message: "Email hoặc số điện thoại đã được sử dụng",
      });
      return;
    }

    // Hash mật khẩu
    const hashedPassword = await bcrypt.hash(password, 10);

    // Tạo user mới (status = pending, is_verified = 0)
    await connection.query(
      `INSERT INTO users (email, phone, password_hash, full_name, role, status, is_verified) 
       VALUES (?, ?, ?, ?, 'user', 'pending', 0)`,
      [email || null, phone || null, hashedPassword, full_name.trim()],
    );

    // Gửi OTP qua email
    if (email) {
      const otp = generateOTP();
      await saveOTP(email, otp, "REGISTER");
      await sendOTPEmail(email, otp, "REGISTER");
    }

    res.status(201).json({
      success: true,
      message:
        "Đăng ký thành công! Vui lòng kiểm tra email để xác thực tài khoản.",
    });
  } catch (error: any) {
    console.error("❌ Register error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi đăng ký",
      error: error.message,
    });
  } finally {
    connection.release();
  }
};

// ==================== XÁC THỰC OTP ====================
export const verifyOTP = async (req: Request, res: Response): Promise<void> => {
  const connection = await pool.getConnection();

  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp email và mã OTP",
      });
      return;
    }

    // Xác thực OTP
    const isValid = await verifyOTPCode(email, otp, "REGISTER");

    if (!isValid) {
      res.status(400).json({
        success: false,
        message: "Mã OTP không đúng hoặc đã hết hạn",
      });
      return;
    }

    // User thường chỉ cần xác thực OTP, không cần admin duyệt
    await connection.query(
      "UPDATE users SET is_verified = 1, verified_at = NOW(), status = CASE WHEN status = 'locked' THEN 'locked' ELSE 'active' END WHERE email = ?",
      [email],
    );

    res.status(200).json({
      success: true,
      message: "Xác thực thành công! Bạn có thể đăng nhập.",
    });
  } catch (error: any) {
    console.error("❌ Verify OTP error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi xác thực OTP",
      error: error.message,
    });
  } finally {
    connection.release();
  }
};

// ==================== QUÊN MẬT KHẨU ====================
export const forgotPassword = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const connection = await pool.getConnection();

  try {
    const { email, phone } = req.body;

    if (!email || !phone) {
      res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp email và số điện thoại",
      });
      return;
    }

    // Kiểm tra user tồn tại
    const [users] = await connection.query<User[]>(
      "SELECT * FROM users WHERE email = ? AND phone = ?",
      [email, phone],
    );

    if (users.length === 0) {
      res.status(404).json({
        success: false,
        message: "Không tìm thấy tài khoản với thông tin này",
      });
      return;
    }

    // Gửi OTP
    const otp = generateOTP();
    await saveOTP(email, otp, "FORGOT_PASSWORD");
    await sendOTPEmail(email, otp, "FORGOT_PASSWORD");

    res.status(200).json({
      success: true,
      message: "Mã OTP đã được gửi đến email của bạn",
    });
  } catch (error: any) {
    console.error("❌ Forgot password error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server",
      error: error.message,
    });
  } finally {
    connection.release();
  }
};

// ==================== XÁC THỰC OTP RESET ====================
export const verifyResetOTP = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      res.status(400).json({
        success: false,
        message: "Thiếu email hoặc OTP",
      });
      return;
    }

    const isValid = await verifyOTPCode(email, otp, "FORGOT_PASSWORD");

    if (!isValid) {
      res.status(400).json({
        success: false,
        message: "Mã OTP không đúng hoặc đã hết hạn",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Mã OTP hợp lệ. Vui lòng đặt mật khẩu mới.",
    });
  } catch (error: any) {
    console.error("❌ Verify reset OTP error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server",
      error: error.message,
    });
  }
};

// ==================== ĐẶT LẠI MẬT KHẨU ====================
export const resetPassword = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const connection = await pool.getConnection();

  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      res.status(400).json({
        success: false,
        message: "Thiếu thông tin bắt buộc",
      });
      return;
    }

    // Xác thực lại OTP (không đánh dấu used lần nữa)
    const [rows]: any = await connection.query(
      `SELECT * FROM otp_codes 
       WHERE email = ? AND otp_code = ? AND type = 'FORGOT_PASSWORD'
       AND expires_at > NOW() AND is_used = 1
       ORDER BY created_at DESC LIMIT 1`,
      [email, otp],
    );

    if (rows.length === 0) {
      res.status(400).json({
        success: false,
        message: "Mã OTP không hợp lệ hoặc đã hết hạn",
      });
      return;
    }

    // Hash mật khẩu mới
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Cập nhật mật khẩu
    await connection.query(
      "UPDATE users SET password_hash = ? WHERE email = ?",
      [hashedPassword, email],
    );

    res.status(200).json({
      success: true,
      message: "Đổi mật khẩu thành công!",
    });
  } catch (error: any) {
    console.error("❌ Reset password error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server",
      error: error.message,
    });
  } finally {
    connection.release();
  }
};

// ==================== ĐĂNG NHẬP THƯỜNG ====================
export const login = async (req: Request, res: Response): Promise<void> => {
  const connection = await pool.getConnection();

  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: "Vui lòng nhập đầy đủ email và mật khẩu",
      });
      return;
    }

    const trimmedEmail = email.trim();

    // Chống brute-force: khóa tạm nếu sai quá 5 lần trong thời gian ngắn
    const [attemptRows] = await connection.query<RowDataPacket[]>(
      `SELECT attempts, locked_until
       FROM login_attempts
       WHERE email = ?
       LIMIT 1`,
      [trimmedEmail],
    );

    if (attemptRows.length > 0) {
      const lockedUntil = attemptRows[0].locked_until as unknown as
        | string
        | Date
        | null;
      if (lockedUntil) {
        const until = new Date(lockedUntil);
        if (!Number.isNaN(until.getTime()) && until.getTime() > Date.now()) {
          res.status(403).json({
            success: false,
            message:
              "Bạn đã đăng nhập sai quá nhiều lần. Vui lòng thử lại sau ít phút.",
          });
          return;
        }
      }
    }

    const [users] = await connection.query<User[]>(
      "SELECT * FROM users WHERE email = ? AND deleted_at IS NULL",
      [trimmedEmail],
    );

    if (users.length === 0) {
      await connection.query(
        `INSERT INTO login_attempts (email, attempts, locked_until)
         VALUES (?, 1, NULL)
         ON DUPLICATE KEY UPDATE
           attempts = CASE
             WHEN locked_until IS NOT NULL AND locked_until > NOW() THEN attempts
             ELSE attempts + 1
           END,
           locked_until = CASE
             WHEN (locked_until IS NOT NULL AND locked_until > NOW()) THEN locked_until
             WHEN (
               CASE
                 WHEN locked_until IS NOT NULL AND locked_until > NOW() THEN attempts
                 ELSE attempts + 1
               END
             ) >= 5 THEN DATE_ADD(NOW(), INTERVAL 5 MINUTE)
             ELSE NULL
           END,
           updated_at = NOW()`,
        [trimmedEmail],
      );

      // Lưu login history (fail - email không tồn tại)
      await connection.query(
        `INSERT INTO login_history (user_id, email, role, success, ip_address, user_agent, device_info)
         VALUES (NULL, ?, NULL, 0, ?, ?, ?)`,
        [
          trimmedEmail,
          (req.headers["x-forwarded-for"] as string | undefined) || req.ip,
          req.headers["user-agent"] || null,
          req.headers["x-device-info"] || null,
        ],
      );

      res.status(401).json({
        success: false,
        message: "Email hoặc mật khẩu không chính xác",
      });
      return;
    }

    const user = users[0];

    // ⚠️ KIỂM TRA CASE SENSITIVITY
    if (user.email !== trimmedEmail) {
      res.status(401).json({
        success: false,
        message:
          "Email không chính xác. Vui lòng nhập đúng chữ hoa, chữ thường.",
        hint: `Gợi ý: Có thể bạn muốn nhập "${user.email}"?`,
      });
      return;
    }

    // Kiểm tra tài khoản bị khóa
    if (user.status === "locked") {
      res.status(403).json({
        success: false,
        message: "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ admin.",
      });
      return;
    }

    if (user.status === "pending") {
      if (user.role === "user") {
        if (!user.is_verified) {
          res.status(403).json({
            success: false,
            message: "Vui lòng xác thực email để đăng nhập.",
          });
          return;
        }

        await connection.query(
          "UPDATE users SET status = 'active' WHERE user_id = ?",
          [user.user_id],
        );
      } else {
        res.status(403).json({
          success: false,
          message: "Tài khoản đang chờ admin xác thực.",
        });
        return;
      }
    }

    // Kiểm tra user đăng nhập thường
    if (!user.password_hash) {
      res.status(401).json({
        success: false,
        message:
          "Tài khoản này được đăng ký qua mạng xã hội. Vui lòng đăng nhập bằng Google/Facebook.",
      });
      return;
    }

    // Kiểm tra mật khẩu
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      await connection.query(
        `INSERT INTO login_attempts (email, attempts, locked_until)
         VALUES (?, 1, NULL)
         ON DUPLICATE KEY UPDATE
           attempts = CASE
             WHEN locked_until IS NOT NULL AND locked_until > NOW() THEN attempts
             ELSE attempts + 1
           END,
           locked_until = CASE
             WHEN (locked_until IS NOT NULL AND locked_until > NOW()) THEN locked_until
             WHEN (
               CASE
                 WHEN locked_until IS NOT NULL AND locked_until > NOW() THEN attempts
                 ELSE attempts + 1
               END
             ) >= 5 THEN DATE_ADD(NOW(), INTERVAL 5 MINUTE)
             ELSE NULL
           END,
           updated_at = NOW()`,
        [trimmedEmail],
      );

      // Lưu login history (fail)
      await connection.query(
        `INSERT INTO login_history (user_id, email, role, success, ip_address, user_agent, device_info)
         VALUES (?, ?, ?, 0, ?, ?, ?)`,
        [
          user.user_id,
          user.email,
          user.role,
          (req.headers["x-forwarded-for"] as string | undefined) || req.ip,
          req.headers["user-agent"] || null,
          req.headers["x-device-info"] || null,
        ],
      );

      res.status(401).json({
        success: false,
        message: "Email hoặc mật khẩu không chính xác",
      });
      return;
    }

    // Reset brute-force counter khi login đúng
    await connection.query(`DELETE FROM login_attempts WHERE email = ?`, [
      trimmedEmail,
    ]);

    // Owner must be approved by admin (owner_profiles.approval_status)
    if (user.role === "owner") {
      const [opRows] = await connection.query<RowDataPacket[]>(
        `SELECT approval_status
         FROM owner_profiles
         WHERE owner_id = ?
         LIMIT 1`,
        [user.user_id],
      );

      const approvalStatus = String(opRows?.[0]?.approval_status || "pending");
      if (approvalStatus !== "approved") {
        res.status(403).json({
          success: false,
          message: "Tài khoản Owner đang chờ Admin duyệt.",
          code: "OWNER_NOT_APPROVED",
        });
        return;
      }
    }

    // Lưu login history (success)
    await connection.query(
      `INSERT INTO login_history (user_id, email, role, success, ip_address, user_agent, device_info)
       VALUES (?, ?, ?, 1, ?, ?, ?)`,
      [
        user.user_id,
        user.email,
        user.role,
        (req.headers["x-forwarded-for"] as string | undefined) || req.ip,
        req.headers["user-agent"] || null,
        req.headers["x-device-info"] || null,
      ],
    );

    // Cảnh báo nếu chưa xác thực
    let warningMessage = "";
    if (!user.is_verified) {
      warningMessage =
        "Tài khoản chưa xác thực. Một số tính năng có thể bị giới hạn.";
    }

    const previousSessionId = await getActiveSessionId(user.user_id);
    const newSessionId = uuidv4();
    await setActiveSessionId(user.user_id, newSessionId);
    if (previousSessionId && previousSessionId !== newSessionId) {
      emitSessionRevoked(user.user_id, newSessionId);
    }

    // Generate tokens
    const accessToken = generateToken(user.user_id, user.role, newSessionId);
    const refreshToken = generateRefreshToken(user.user_id);

    // Lưu refresh token vào DB
    await connection.query(
      "UPDATE users SET refresh_token = ? WHERE user_id = ?",
      [refreshToken, user.user_id],
    );

    const redirectUrl = getRoleRedirectUrl(user.role);

    res.status(200).json({
      success: true,
      message: "Đăng nhập thành công",
      warning: warningMessage || undefined,
      data: {
        user: {
          user_id: user.user_id,
          email: user.email,
          phone: user.phone,
          full_name: user.full_name,
          role: user.role,
          avatar_url: getEffectiveAvatarUrl(user),
          is_verified: user.is_verified,
        },
        accessToken,
        refreshToken,
        redirectUrl,
      },
    });
  } catch (error) {
    console.error("❌ Login error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi đăng nhập",
    });
  } finally {
    connection.release();
  }
};

export const confirmOwnerTerms = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const token = String(req.query.token || "").trim();
    if (!token) {
      res.status(400).json({ success: false, message: "Token không hợp lệ" });
      return;
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT op.owner_id, op.terms_token_expires, u.email, u.full_name
       FROM owner_profiles op
       JOIN users u ON op.owner_id = u.user_id
       WHERE op.terms_token = ?
       LIMIT 1`,
      [token],
    );

    if (!rows[0]) {
      res.status(404).json({ success: false, message: "Token không tồn tại" });
      return;
    }

    const expires = rows[0].terms_token_expires as Date | null;
    if (expires && new Date(expires).getTime() < Date.now()) {
      res.status(400).json({ success: false, message: "Token đã hết hạn" });
      return;
    }

    const ip =
      (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0] ||
      req.socket.remoteAddress ||
      null;
    const userAgent = req.headers["user-agent"] || null;

    await pool.query(
      `UPDATE owner_profiles
       SET terms_accepted_at = NOW(),
           terms_accepted_ip = ?,
           terms_accepted_user_agent = ?,
           terms_token = NULL,
           terms_token_expires = NULL
       WHERE owner_id = ?`,
      [ip, userAgent, rows[0].owner_id],
    );

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)`,
      [
        rows[0].owner_id,
        "OWNER_TERMS_CONFIRMED",
        JSON.stringify({ token, timestamp: new Date() }),
      ],
    );

    await sendOwnerTermsAcceptedEmail(rows[0].email, rows[0].full_name);

    res.json({ success: true, message: "Đã xác nhận điều khoản" });
  } catch (error: unknown) {
    console.error("Lỗi xác nhận điều khoản owner:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

// ==================== SOCIAL LOGIN ====================
export const socialLogin = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const connection = await pool.getConnection();

  try {
    const { provider, socialId, email, fullName, avatarUrl } = req.body;

    const normalizedProviderAvatarUrl =
      typeof avatarUrl === "string" && avatarUrl.trim().length
        ? avatarUrl.trim()
        : null;

    // ⭐ LOG ĐỂ DEBUG
    console.log("📥 Received social login request:", {
      provider,
      socialId,
      email,
      fullName,
      avatarUrl,
    });

    if (!provider || !socialId) {
      console.error("❌ Missing provider or socialId:", req.body);
      res.status(400).json({
        success: false,
        message: "Thiếu thông tin provider hoặc socialId",
        receivedData: req.body, // ⭐ THÊM ĐỂ DEBUG
      });
      return;
    }

    if (!["google", "facebook"].includes(provider)) {
      res.status(400).json({
        success: false,
        message:
          "Provider không hợp lệ. Chỉ chấp nhận 'google' hoặc 'facebook'",
      });
      return;
    }

    let processedEmail =
      typeof email === "string" && email.trim().length ? email.trim() : null;

    if (!processedEmail || processedEmail.includes("@temp.local")) {
      console.log(
        `⚠️ ${provider} không cung cấp email thật cho user ${socialId}`,
      );

      const socialIdColumn =
        provider === "google" ? "google_id" : "facebook_id";
      const [existingUsers] = await connection.query<User[]>(
        `SELECT * FROM users WHERE ${socialIdColumn} = ?`,
        [socialId],
      );

      if (existingUsers.length > 0) {
        processedEmail = existingUsers[0].email;
        console.log(`✅ Dùng email cũ: ${processedEmail}`);
      } else if (provider === "facebook") {
        processedEmail = null;
      } else {
        res.status(400).json({
          success: false,
          message: `${provider} không cung cấp email. Vui lòng cấp quyền email hoặc liên hệ admin để cập nhật email thủ công.`,
          hint: "Hãy thử đăng ký lại và đảm bảo cho phép ứng dụng truy cập email của bạn.",
        });
        return;
      }
    }

    if (
      processedEmail &&
      (await isCredentialBlacklisted({ email: processedEmail }))
    ) {
      res.status(403).json({
        success: false,
        message:
          "Email này đã bị cấm sử dụng. Vui lòng liên hệ admin để được hỗ trợ.",
      });
      return;
    }

    let processedFullName = fullName;
    if (!processedFullName || processedFullName.trim().length === 0) {
      processedFullName = `${
        provider.charAt(0).toUpperCase() + provider.slice(1)
      } User`;
      console.log(`⚠️ Tạo tên giả: ${processedFullName}`);
    }

    const socialIdColumn = provider === "google" ? "google_id" : "facebook_id";

    let [users] = await connection.query<User[]>(
      `SELECT * FROM users WHERE ${socialIdColumn} = ?`,
      [socialId],
    );

    let user: User;

    if (users.length > 0) {
      user = users[0];
      console.log(`✅ Tìm thấy user theo ${socialIdColumn}: ${user.user_id}`);

      if (user.deleted_at) {
        res.status(403).json({
          success: false,
          message:
            "Tài khoản của bạn đã bị xóa. Vui lòng liên hệ admin để được hỗ trợ.",
        });
        return;
      }

      if (user.status === "locked") {
        res.status(403).json({
          success: false,
          message: "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ admin.",
        });
        return;
      }

      const hasAnyAvatar =
        (typeof user.avatar_path === "string" && user.avatar_path.trim()) ||
        (typeof user.avatar_url === "string" && user.avatar_url.trim());
      const avatarToSet = !hasAnyAvatar ? normalizedProviderAvatarUrl : null;

      // Only set provider avatar when user has no avatar yet.
      // This prevents social login from overwriting a custom avatar URL set in Profile.
      await connection.query(
        `UPDATE users SET 
          full_name = COALESCE(?, full_name),
          email = COALESCE(?, email),
          avatar_url = COALESCE(?, avatar_url),
          avatar_source = CASE WHEN ? IS NOT NULL THEN 'url' ELSE avatar_source END,
          is_verified = 1
        WHERE user_id = ?`,
        [
          processedFullName,
          processedEmail,
          avatarToSet,
          avatarToSet,
          user.user_id,
        ],
      );

      // Lấy lại user sau khi update
      const [updatedUsers] = await connection.query<User[]>(
        "SELECT * FROM users WHERE user_id = ?",
        [user.user_id],
      );
      user = updatedUsers[0];
    } else {
      const [existingUsers] = processedEmail
        ? await connection.query<User[]>(
            "SELECT * FROM users WHERE email = ?",
            [processedEmail],
          )
        : [[], []];

      if (existingUsers.length > 0) {
        user = existingUsers[0];
        console.log(
          `🔗 Liên kết ${provider} với tài khoản cũ: ${user.user_id}`,
        );

        if (user.deleted_at) {
          res.status(403).json({
            success: false,
            message:
              "Tài khoản của bạn đã bị xóa. Vui lòng liên hệ admin để được hỗ trợ.",
          });
          return;
        }

        if (user.status === "locked") {
          res.status(403).json({
            success: false,
            message: "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ admin.",
          });
          return;
        }

        const hasAnyAvatar =
          (typeof user.avatar_path === "string" && user.avatar_path.trim()) ||
          (typeof user.avatar_url === "string" && user.avatar_url.trim());
        const avatarToSet = !hasAnyAvatar ? normalizedProviderAvatarUrl : null;

        await connection.query(
          `UPDATE users SET 
            ${socialIdColumn} = ?,
            avatar_url = COALESCE(?, avatar_url),
            avatar_source = CASE WHEN ? IS NOT NULL THEN 'url' ELSE avatar_source END,
            is_verified = 1
          WHERE user_id = ?`,
          [socialId, avatarToSet, avatarToSet, user.user_id],
        );

        const [updatedUsers] = await connection.query<User[]>(
          "SELECT * FROM users WHERE user_id = ?",
          [user.user_id],
        );
        user = updatedUsers[0];
      } else {
        console.log(`➕ Tạo user mới từ ${provider}`);

        const [result] = await connection.query<ResultSetHeader>(
          `INSERT INTO users (
            email, 
            full_name, 
            ${socialIdColumn}, 
            avatar_url, 
            avatar_source,
            role, 
            status, 
            is_verified,
            password_hash,
            phone
          ) VALUES (?, ?, ?, ?, ?, 'user', 'active', 1, NULL, NULL)`,
          [
            processedEmail,
            processedFullName,
            socialId,
            normalizedProviderAvatarUrl,
            normalizedProviderAvatarUrl ? "url" : null,
          ],
        );

        const newUserId = result.insertId;

        const [newUsers] = await connection.query<User[]>(
          "SELECT * FROM users WHERE user_id = ?",
          [newUserId],
        );

        user = newUsers[0];
      }
    }

    if (user.status === "locked") {
      res.status(403).json({
        success: false,
        message: "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ admin.",
      });
      return;
    }

    if (user.status === "pending") {
      if (user.role === "user") {
        await connection.query(
          "UPDATE users SET status = 'active' WHERE user_id = ?",
          [user.user_id],
        );
      } else {
        res.status(403).json({
          success: false,
          message: "Tài khoản đang chờ admin xác thực.",
        });
        return;
      }
    }

    // Owner must be approved by admin (owner_profiles.approval_status)
    if (user.role === "owner") {
      const [opRows] = await connection.query<RowDataPacket[]>(
        `SELECT approval_status
         FROM owner_profiles
         WHERE owner_id = ?
         LIMIT 1`,
        [user.user_id],
      );

      const approvalStatus = String(opRows?.[0]?.approval_status || "pending");
      if (approvalStatus !== "approved") {
        res.status(403).json({
          success: false,
          message: "Tài khoản Owner đang chờ Admin duyệt.",
          code: "OWNER_NOT_APPROVED",
        });
        return;
      }
    }

    // Lưu login history (success - social)
    await connection.query(
      `INSERT INTO login_history (user_id, email, role, success, ip_address, user_agent, device_info)
       VALUES (?, ?, ?, 1, ?, ?, ?)`,
      [
        user.user_id,
        user.email,
        user.role,
        (req.headers["x-forwarded-for"] as string | undefined) || req.ip,
        req.headers["user-agent"] || null,
        req.headers["x-device-info"] || null,
      ],
    );

    const previousSessionId = await getActiveSessionId(user.user_id);
    const newSessionId = uuidv4();
    await setActiveSessionId(user.user_id, newSessionId);
    if (previousSessionId && previousSessionId !== newSessionId) {
      emitSessionRevoked(user.user_id, newSessionId);
    }

    const accessToken = generateToken(user.user_id, user.role, newSessionId);
    const refreshToken = generateRefreshToken(user.user_id);

    await connection.query(
      "UPDATE users SET refresh_token = ? WHERE user_id = ?",
      [refreshToken, user.user_id],
    );

    const redirectUrl = getRoleRedirectUrl(user.role);

    console.log(`✅ Social login thành công:`, {
      user_id: user.user_id,
      email: user.email,
      role: user.role,
      redirectUrl,
    });

    res.status(200).json({
      success: true,
      message: "Đăng nhập thành công",
      data: {
        user: {
          user_id: user.user_id,
          email: user.email,
          phone: user.phone,
          full_name: user.full_name,
          role: user.role,
          avatar_url: getEffectiveAvatarUrl(user),
          is_verified: user.is_verified,
        },
        accessToken,
        refreshToken,
        redirectUrl,
      },
    });
  } catch (error: any) {
    console.error("❌ Social login error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi đăng nhập",
      error: error.message,
    });
  } finally {
    connection.release();
  }
};

// ==================== REFRESH TOKEN ====================
export const refreshAccessToken = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const connection = await pool.getConnection();

  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({
        success: false,
        message: "Refresh token là bắt buộc",
      });
      return;
    }

    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET || "your-refresh-secret",
    ) as { userId: number };

    const [users] = await connection.query<User[]>(
      "SELECT * FROM users WHERE user_id = ? AND refresh_token = ?",
      [decoded.userId, refreshToken],
    );

    if (users.length === 0) {
      res.status(401).json({
        success: false,
        message: "Refresh token không hợp lệ",
      });
      return;
    }

    const user = users[0];
    const activeSessionId = await getActiveSessionId(user.user_id);
    if (!activeSessionId) {
      res.status(401).json({
        success: false,
        code: "SESSION_REVOKED",
        message: "Phiên đăng nhập đã hết hiệu lực. Vui lòng đăng nhập lại.",
      });
      return;
    }

    const newAccessToken = generateToken(
      user.user_id,
      user.role,
      activeSessionId,
    );

    res.status(200).json({
      success: true,
      data: {
        accessToken: newAccessToken,
      },
    });
  } catch (error: any) {
    console.error("❌ Refresh token error:", error);

    if (error.name === "TokenExpiredError") {
      res.status(401).json({
        success: false,
        message: "Refresh token đã hết hạn. Vui lòng đăng nhập lại.",
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: "Lỗi server khi làm mới token",
    });
  } finally {
    connection.release();
  }
};

// ==================== LOGOUT ====================
export const logout = async (req: Request, res: Response): Promise<void> => {
  const connection = await pool.getConnection();

  try {
    // userId được lấy từ middleware authenticateToken
    const userId = req.userId;
    const sessionId = req.sessionId;

    if (!userId) {
      res.status(401).json({ success: false, message: "Chưa xác thực" });
      return;
    }

    // Xóa refresh token khỏi DB
    await connection.query(
      "UPDATE users SET refresh_token = NULL WHERE user_id = ?",
      [userId],
    );

    if (sessionId) {
      await clearActiveSessionId(userId, sessionId);
    }

    res.status(200).json({
      success: true,
      message: "Đăng xuất thành công",
    });
  } catch (error) {
    console.error("❌ Logout error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi đăng xuất",
    });
  } finally {
    connection.release();
  }
};

export const checkSession = async (
  req: Request,
  res: Response,
): Promise<void> => {
  if (!req.userId) {
    res.status(401).json({ success: false, message: "Chưa xác thực" });
    return;
  }

  res.status(200).json({ success: true, message: "Phiên hợp lệ" });
};

export const getLoginBackground = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    // Priority: Active schedule > System setting (file > url)
    const [scheduleRows] = await pool.query<RowDataPacket[]>(
      `SELECT schedule_id, title, image_url, image_path, start_date, end_date
       FROM background_schedules
       WHERE is_active = 1
         AND applied_to_setting = 'login_background'
         AND NOW() BETWEEN start_date AND end_date
       ORDER BY start_date DESC
       LIMIT 1`,
    );

    if (scheduleRows.length > 0) {
      const schedule = scheduleRows[0];
      // Prefer image_path (uploaded) over image_url
      const effectiveUrl = schedule.image_path || schedule.image_url;
      res.json({
        success: true,
        data: {
          source: "schedule",
          image_url: effectiveUrl,
          title: schedule.title,
        },
      });
      return;
    }

    // Fallback to system_settings
    const [settingRows] = await pool.query<RowDataPacket[]>(
      `SELECT setting_value, setting_value_file FROM system_settings WHERE setting_key = 'login_background_url' LIMIT 1`,
    );

    // Prefer file over URL
    const row = settingRows[0];
    const imageUrl = row?.setting_value_file || row?.setting_value || null;

    res.json({
      success: true,
      data: {
        source: "default",
        image_url: imageUrl,
        title: null,
      },
    });
  } catch (error: unknown) {
    console.error("Lỗi lấy nền đăng nhập:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy nền đăng nhập",
    });
  }
};

export const getAppBackground = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    // Priority: Active schedule > System setting (file > url)
    const [scheduleRows] = await pool.query<RowDataPacket[]>(
      `SELECT schedule_id, title, image_url, image_path, start_date, end_date
       FROM background_schedules
       WHERE is_active = 1
         AND applied_to_setting = 'app_background'
         AND NOW() BETWEEN start_date AND end_date
       ORDER BY start_date DESC
       LIMIT 1`,
    );

    if (scheduleRows.length > 0) {
      const schedule = scheduleRows[0];
      const effectiveUrl = schedule.image_path || schedule.image_url;
      res.json({
        success: true,
        data: {
          source: "schedule",
          image_url: effectiveUrl,
          title: schedule.title,
        },
      });
      return;
    }

    const [settingRows] = await pool.query<RowDataPacket[]>(
      `SELECT setting_value, setting_value_file FROM system_settings WHERE setting_key = 'app_background_url' LIMIT 1`,
    );

    const row = settingRows[0];
    const imageUrl = row?.setting_value_file || row?.setting_value || null;

    res.json({
      success: true,
      data: {
        source: "default",
        image_url: imageUrl,
        title: null,
      },
    });
  } catch (error: unknown) {
    console.error("Lỗi lấy nền app:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy nền app",
    });
  }
};

export const getBackgroundHistoryFile = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    void req;
    res.status(410).json({
      success: false,
      message: "Tính năng tải ảnh nền từ lịch sử đã bị tắt (DB rút gọn)",
    });
  } catch (error: unknown) {
    console.error("Lỗi lấy background file:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};
