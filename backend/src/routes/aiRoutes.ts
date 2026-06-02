import { Router } from "express";
import { authenticateToken } from "../middleware/authMiddleware";
import { chatWithAi, getAiHistory } from "../controllers/aiController";

const router = Router();

router.use(authenticateToken);

router.post("/chat", chatWithAi);
router.get("/history", getAiHistory);

export default router;
