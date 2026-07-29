import express from "express";
import { getDashboardStatsForAi } from "../controllers/internalAiController";
import { authenticateToken, requireRole } from "../middleware/authMiddleware";

const router = express.Router();

router.post(
  "/context",
  authenticateToken,
  requireRole("admin", "owner", "employee"),
  getDashboardStatsForAi,
);

export default router;
