import express from "express";
import { getDashboardStatsForAi } from "../controllers/internalAiController";

const router = express.Router();

// No token authentication required because this is meant to be called internally by Python bot
// However, we can add a basic secret check if we want
router.post("/context", getDashboardStatsForAi);

export default router;
