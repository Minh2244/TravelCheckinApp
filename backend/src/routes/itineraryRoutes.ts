import { Router } from "express";
import { authenticateToken } from "../middleware/authMiddleware";
import {
  getUserItineraries,
  getUserItineraryDetail,
  createUserItinerary,
  updateUserItinerary,
  deleteUserItinerary,
  toggleItemVisited,
} from "../controllers/itineraryController";

const router = Router();

// Tất cả routes đều cần đăng nhập
router.use(authenticateToken);

// CRUD lịch trình
router.get("/", getUserItineraries);
router.get("/:itineraryId", getUserItineraryDetail);
router.post("/", createUserItinerary);
router.put("/:itineraryId", updateUserItinerary);
router.delete("/:itineraryId", deleteUserItinerary);

// Đánh dấu đã đến
router.patch("/:itineraryId/items/:itemId/visit", toggleItemVisited);

export default router;
