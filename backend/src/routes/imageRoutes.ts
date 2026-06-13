// backend/src/routes/imageRoutes.ts
import { Router } from "express";
import { serveImage, getImageMetadata, deleteImage } from "../controllers/imageController";

const router = Router();

router.get("/:id", serveImage);
router.get("/:id/metadata", getImageMetadata);
router.delete("/:id", deleteImage);

export default router;
