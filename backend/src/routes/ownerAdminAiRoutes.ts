import { Router } from "express";

import { createOwnerAdminAiController } from "../controllers/ownerAdminAiController";
import type { ManagerAiRole } from "../services/ai-manager/actionRegistry";

export function createOwnerAdminAiRouter(role: ManagerAiRole): Router {
  const router = Router();
  const controller = createOwnerAdminAiController(role);

  router.get("/health", controller.health);
  router.get("/suggestions", controller.suggestions);
  router.post("/chat", controller.chat);
  router.post("/plan-action", controller.planAction);

  return router;
}
