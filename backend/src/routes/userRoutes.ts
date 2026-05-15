import { Router } from "express";
import multer from "multer";
import { authenticateToken, requireRole } from "../middleware/authMiddleware";
import {
  getUserCheckins,
  createUserCheckin,
  createUserCheckinWithPhoto,
  deleteUserCheckin,
  getUserCreatedLocations,
  updateUserCreatedLocation,
  getUserFavorites,
  updateUserFavorite,
  removeUserFavoriteLocation,
  getUserLocationRecommendations,
  getUserProfile,
  updateUserProfile,
  uploadUserAvatar,
  uploadUserBackground,
  getUserLoginHistory,
  getUserVouchers,
  getUserDiaries,
  createUserDiary,
  getUserItineraries,
  createUserItinerary,
  reportLocationIssue,
  getLeaderboard,
  getBookingReminders,
  getUserNotifications,
  markUserNotificationsReadAll,
  deleteUserNotificationsAll,
  createGroupCode,
  createUserLocationInvite,
  joinGroupByCode,
  leaveGroupSession,
  getGroupStatus,
  deleteUserCreatedLocation,
  uploadUserReviewImage,
  createUserReview,
  getUserTouristTickets,
} from "../controllers/userController";

const router = Router();

// Vì sao: Upload avatar cần nhận file từ client mà không lưu tạm ra disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
});

router.use(authenticateToken);
router.use(requireRole("user"));

router.get("/checkins", getUserCheckins);
router.post("/checkins", createUserCheckin);
router.delete("/checkins/:id", deleteUserCheckin);
router.post(
  "/checkins/photo",
  upload.single("photo"),
  createUserCheckinWithPhoto,
);

router.get("/favorites", getUserFavorites);
router.patch("/favorites/:locationId", updateUserFavorite);
router.delete("/favorites/:locationId", removeUserFavoriteLocation);

router.get("/recommendations/locations", getUserLocationRecommendations);

router.get("/created-locations", getUserCreatedLocations);
router.patch("/created-locations/:id", updateUserCreatedLocation);
router.delete("/created-locations/:id", deleteUserCreatedLocation);

router.get("/profile", getUserProfile);
router.put("/profile", updateUserProfile);
router.post("/profile/avatar", upload.single("avatar"), uploadUserAvatar);
router.post(
  "/profile/background",
  upload.single("background"),
  uploadUserBackground,
);
router.get("/profile/login-history", getUserLoginHistory);
router.get("/vouchers", getUserVouchers);
router.get("/tickets", getUserTouristTickets);
router.get("/diary", getUserDiaries);
router.post("/diary", createUserDiary);
router.get("/itineraries", getUserItineraries);
router.post("/itineraries", createUserItinerary);

router.post("/reviews/upload", upload.single("image"), uploadUserReviewImage);
router.post("/reviews", createUserReview);

router.post("/reports/location", reportLocationIssue);
router.get("/leaderboard", getLeaderboard);
router.get("/booking-reminders", getBookingReminders);
router.get("/notifications", getUserNotifications);
router.post("/notifications/read-all", markUserNotificationsReadAll);
router.post("/notifications/delete-all", deleteUserNotificationsAll);
router.post("/notifications/location-invite", createUserLocationInvite);

router.post("/groups/create", createGroupCode);
router.post("/groups/join", joinGroupByCode);
router.post("/groups/leave", leaveGroupSession);
router.get("/groups", getGroupStatus);

export default router;
