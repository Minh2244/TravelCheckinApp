import { Router } from "express";
import { authenticateToken, requireRole } from "../middleware/authMiddleware";
import {
  createSosAlert,
  pingSosAlert,
  stopSosAlert,
  getActiveSosAlert,
} from "../controllers/sosController";

const router = Router();

router.use(authenticateToken);
router.use(requireRole("user"));

router.post("/", createSosAlert);
router.post("/ping", pingSosAlert);
router.post("/stop", stopSosAlert);
router.get("/active", getActiveSosAlert);

export default router;
