// backend/src/routes/locationRoutes.ts
import { Router } from "express";
import {
  getLocationById,
  getLocationPosAreasPublic,
  getLocationPosTablesPublic,
  getLocationReviewsPublic,
  getLocationServicesPublic,
  getLocations,
} from "../controllers/locationController";
import { authenticateTokenOptional } from "../middleware/authMiddleware";

const router = Router();

// GET /api/locations/search?keyword=&type=&province=&source=
router.get("/search", authenticateTokenOptional, getLocations);

// GET /api/locations
router.get("/", authenticateTokenOptional, getLocations);

// GET /api/locations/:id/services?type=
router.get(
  "/:id/services",
  authenticateTokenOptional,
  getLocationServicesPublic,
);

// GET /api/locations/:id/pos/areas
router.get(
  "/:id/pos/areas",
  authenticateTokenOptional,
  getLocationPosAreasPublic,
);

// GET /api/locations/:id/pos/tables
router.get(
  "/:id/pos/tables",
  authenticateTokenOptional,
  getLocationPosTablesPublic,
);

// GET /api/locations/:id/reviews
router.get("/:id/reviews", authenticateTokenOptional, getLocationReviewsPublic);

// GET /api/locations/:id
router.get("/:id", authenticateTokenOptional, getLocationById);

export default router;
