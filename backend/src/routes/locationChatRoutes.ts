import { Router } from "express";
import { authenticateToken } from "../middleware/authMiddleware";
import {
  getLocationChatHistory,
  postLocationChatMessage,
  getLocationActiveSessions,
  getUnreadChatCounts,
  markLocationChatRead
} from "../controllers/locationChatController";

const router = Router();

router.use(authenticateToken);

// GET /api/chat/unread-counts
router.get("/unread-counts", getUnreadChatCounts);

// POST /api/chat/location/:locationId/mark-read
router.post("/location/:locationId/mark-read", markLocationChatRead);

// GET /api/chat/location/:locationId/sessions
router.get("/location/:locationId/sessions", getLocationActiveSessions);

// GET /api/chat/location/:locationId
router.get("/location/:locationId", getLocationChatHistory);

// POST /api/chat/location/:locationId
router.post("/location/:locationId", postLocationChatMessage);

export default router;
