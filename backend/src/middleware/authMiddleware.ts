import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../config/database";
import { getActiveSessionId } from "../utils/session";

interface JwtPayload {
  userId: number;
  role: string;
  sessionId?: string;
}

export const authenticateToken = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({
        success: false,
        message: "Không tìm thấy token xác thực",
      });
      return;
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "your-secret-key",
    ) as JwtPayload;

    // NOTE: token có thể còn hạn nhưng tài khoản đã bị khóa -> chặn ngay
    void (async () => {
      try {
        const [rows] = await pool.query<RowDataPacket[]>(
          `SELECT user_id, role, status FROM users WHERE user_id = ? LIMIT 1`,
          [decoded.userId],
        );
        const row = rows?.[0] as
          | { user_id: number; role: string; status: string }
          | undefined;

        if (!row) {
          res.status(401).json({
            success: false,
            message: "Tài khoản không tồn tại. Vui lòng đăng nhập lại.",
          });
          return;
        }

        if (String(row.status) === "locked") {
          res.status(403).json({
            success: false,
            code: "ACCOUNT_LOCKED",
            message: "Tài khoản đã bị khóa",
          });
          return;
        }

        // Owner must be approved by admin
        if (String(row.role) === "owner") {
          const [opRows] = await pool.query<RowDataPacket[]>(
            `SELECT approval_status
             FROM owner_profiles
             WHERE owner_id = ?
             LIMIT 1`,
            [decoded.userId],
          );
          const approvalStatus = String(
            opRows?.[0]?.approval_status || "pending",
          );
          if (approvalStatus !== "approved") {
            res.status(403).json({
              success: false,
              code: "OWNER_NOT_APPROVED",
              message: "Tài khoản Owner đang chờ Admin duyệt.",
            });
            return;
          }
        }

        const sessionId = String(decoded.sessionId || "");
        const activeSessionId = await getActiveSessionId(decoded.userId);
        if (!sessionId || !activeSessionId || activeSessionId !== sessionId) {
          res.status(401).json({
            success: false,
            code: "SESSION_REVOKED",
            message: "Tài khoản đang được đăng nhập tại nơi khác",
          });
          return;
        }

        // Gắn thông tin user vào request (ưu tiên dữ liệu DB)
        req.userId = decoded.userId;
        req.userRole = row.role || decoded.role;
        req.sessionId = sessionId;
        next();
      } catch {
        res.status(500).json({
          success: false,
          message: "Lỗi server khi xác thực",
        });
      }
    })();
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err?.name === "TokenExpiredError") {
      res.status(401).json({
        success: false,
        message: "Token đã hết hạn. Vui lòng đăng nhập lại.",
      });
      return;
    }

    res.status(403).json({
      success: false,
      message: "Token không hợp lệ",
    });
  }
};

// Middleware kiểm tra role
export const requireRole = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userRole = req.userRole;

    if (!userRole || !allowedRoles.includes(userRole)) {
      res.status(403).json({
        success: false,
        message: "Bạn không có quyền truy cập chức năng này",
      });
      return;
    }

    next();
  };
};

// Middleware xác thực tùy chọn (không chặn nếu thiếu/invalid token)
export const authenticateTokenOptional = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    next();
    return;
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "your-secret-key",
    ) as JwtPayload;

    req.userId = decoded.userId;
    req.userRole = decoded.role;
  } catch {
    // ignore invalid token
  }

  next();
};
