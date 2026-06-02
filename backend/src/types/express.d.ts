// backend/src/types/express.d.ts
import "express-serve-static-core";

declare module "express-serve-static-core" {
  interface Request {
    /** ID người dùng đã xác thực (được gắn từ JWT trong authenticateToken) */
    userId?: number;

    /** Role người dùng đã xác thực (được gắn từ JWT trong authenticateToken) */
    userRole?: string;

    /** Session ID người dùng đã xác thực (được gắn từ JWT trong authenticateToken) */
    sessionId?: string;
  }
}
