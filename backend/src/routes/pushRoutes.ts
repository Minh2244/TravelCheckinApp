import { Router } from "express";
import { authenticateToken } from "../middleware/authMiddleware";
import {
  registerDeviceToken,
  removeDeviceToken,
} from "../controllers/pushController";

const router = Router();

router.use(authenticateToken);

// Mobile/Web: đăng ký token để nhận push
router.post("/device-tokens", registerDeviceToken);
router.delete("/device-tokens/:deviceId", removeDeviceToken);

export default router;
