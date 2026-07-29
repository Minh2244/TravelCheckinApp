// backend/src/routes/imageRoutes.ts
import { Router } from "express";
import { serveImage, getImageMetadata, deleteImage } from "../controllers/imageController";
import { authenticateToken } from "../middleware/authMiddleware";

const router = Router();

router.get("/:id", serveImage);
router.get("/:id/metadata", getImageMetadata);
router.delete("/:id", authenticateToken, deleteImage);

export default router;
