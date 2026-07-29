import { Router } from "express";
import { authenticateToken } from "../middleware/authMiddleware";
import { chatWithAi, getAiHistory, getAiLatestHistoryId, clearAiHistory } from "../controllers/aiController";

const router = Router();

router.use(authenticateToken);

router.post("/chat", chatWithAi);
router.get("/history/latest-id", getAiLatestHistoryId);
router.get("/history", getAiHistory);
router.delete("/history", clearAiHistory);

export default router;
