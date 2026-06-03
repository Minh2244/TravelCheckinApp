import { Router } from "express";
import { authenticateToken } from "../middleware/authMiddleware";
import {
  getLocationChatHistory,
  postLocationChatMessage
} from "../controllers/locationChatController";

const router = Router();

router.use(authenticateToken);

// GET /api/chat/location/:locationId
router.get("/location/:locationId", getLocationChatHistory);

// POST /api/chat/location/:locationId
router.post("/location/:locationId", postLocationChatMessage);

export default router;
