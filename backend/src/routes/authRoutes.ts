import express from "express";
import {
  register,
  verifyOTP,
  login,
  socialLogin,
  forgotPassword,
  verifyResetOTP,
  resetPassword,
  logout,
  refreshAccessToken,
  getLoginBackground,
  getAppBackground,
  getBackgroundHistoryFile,
  confirmOwnerTerms,
  checkSession,
} from "../controllers/authController";
import { authenticateToken } from "../middleware/authMiddleware";

const router = express.Router();

// Public routes
router.post("/register", register);
router.post("/verify-otp", verifyOTP);
router.post("/login", login);
router.post("/social-login", socialLogin);
router.post("/forgot-password", forgotPassword);
router.post("/verify-reset-otp", verifyResetOTP);
router.get("/owner-terms/confirm", confirmOwnerTerms);
router.post("/reset-password", resetPassword);
router.post("/refresh-token", refreshAccessToken);
router.get("/background", getLoginBackground);
router.get("/app-background", getAppBackground);
router.get("/background/files/:id", getBackgroundHistoryFile);

// Protected routes
router.post("/logout", authenticateToken, logout);
router.get("/session", authenticateToken, checkSession);

export default router;
