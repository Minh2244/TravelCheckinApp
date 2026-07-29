import { Router } from "express";
import { authenticateToken } from "../middleware/authMiddleware";
import {
  getLocationChatHistory,
  getLocationChatLatestMessageId,
  getLocationChatMessageImage,
  postLocationChatMessage,
  getLocationActiveSessions,
  getUnreadChatCounts,
  markLocationChatRead,
  softDeleteMessage,
  clearLocationChatHistory
} from "../controllers/locationChatController";

const router = Router();

router.use(authenticateToken);

// GET /api/chat/unread-counts
router.get("/unread-counts", getUnreadChatCounts);

// POST /api/chat/location/:locationId/mark-read
router.post("/location/:locationId/mark-read", markLocationChatRead);

// GET /api/chat/location/:locationId/sessions
router.get("/location/:locationId/sessions", getLocationActiveSessions);

// GET /api/chat/location/:locationId/latest-message-id
router.get("/location/:locationId/latest-message-id", getLocationChatLatestMessageId);

// GET /api/chat/location/:locationId/message/:messageId/image
router.get("/location/:locationId/message/:messageId/image", getLocationChatMessageImage);

// DELETE /api/chat/location/:locationId/message/:messageId
router.delete("/location/:locationId/message/:messageId", softDeleteMessage);

// DELETE /api/chat/location/:locationId/clear
router.delete("/location/:locationId/clear", clearLocationChatHistory);

// GET /api/chat/location/:locationId
router.get("/location/:locationId", getLocationChatHistory);

// POST /api/chat/location/:locationId
router.post("/location/:locationId", postLocationChatMessage);

export default router;
