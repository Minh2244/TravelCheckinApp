// backend/src/routes/adminRoutes.ts
import { Router } from "express";
import multer from "multer";
import {
  getDashboardStats,
  getAdminProfile,
  updateAdminProfile,
  uploadAdminAvatar,
  getAdminAvatarCurrent,
  getAdminAvatarHistory,
  getAdminAvatarHistoryFile,
  useAdminAvatarFromHistory,
  changeAdminPassword,
  getAdminLoginHistory,
  getUserLoginHistory,
  getUserSearchHistory,
  getUserTravelHistory,
  getUserReviewHistory,
  getUserFavoriteLocations,
  getOwnerEmployees,
  getOwnerViolations,
  createOwnerViolation,
  sendOwnerTermsEmailToOwner,
  markOwnerTermsAccepted,
  getAiSettings,
  updateAiSettings,
  getAiLogs,
  getAiChatHistory,
  getBackgroundSchedules,
  createBackgroundSchedule,
  updateBackgroundSchedule,
  toggleBackgroundSchedule,
  deleteBackgroundSchedule,
  getBackgroundHistory,
  uploadBackgroundImage,
  setBackgroundUrl,
  useBackgroundFromHistory,
  getUsers,
  getUserById,
  updateUserStatus,
  promoteUserToOwner,
  deleteUser,
  getOwners,
  getOwnerById,
  approveOwner,
  rejectOwner,
  updateOwnerStatus,
  getOwnerLocations,
  getAdminLocations,
  updateLocationCommissionRate,
  approveLocation,
  rejectLocation,
  hideLocation,
  deleteOwner,
  deleteLocation,
  getLocationDuplicates,
  mergeLocations,
  getCheckins,
  getCheckinById,
  getLocationCheckinHistory,
  getAdminLocationPosPaymentsHistory,
  getAdminLocationTouristTicketInvoices,
  getAdminOwnerRevenueSummary,
  verifyCheckin,
  failCheckin,
  toggleCheckinLock,
  updateCheckinLocationStatus,
  deleteCheckin,
  getCommissions,
  getCommissionDetails,
  deleteCommission,
  updateCommissionRate,
  getCommissionHistory,
  remindCommission,
  hideCommissionLocation,
  lockCommissionOwner,
  markCommissionsPaid,
  getCommissionPaymentRequests,
  confirmCommissionPaymentRequest,
  getReports,
  getReportById,
  resolveReport,
  updateReportLockStatus,
  remindReport,
  deleteReport,
  warnReportedUser,
  warnReportedOwner,
  deleteReportedReview,
  getAdminReviews,
  deleteAdminReview,
  reportReviewUserByAdmin,
  deleteOwnerReplyByAdmin,
  reportOwnerReplyByAdmin,
  getCheckinAnalytics,
  getSystemLogs,
  getOwnerChatHistory,
  getSystemSettings,
  updateSystemSettings,
  getAdminBank,
  updateAdminBank,
  getSosAlerts,
  updateSosAlertStatus,
  getOwnerServicesAdmin,
  updateOwnerServiceApprovalAdmin,
  bulkUpdateOwnerServiceApprovalAdmin,
  deleteOwnerServiceAdmin,
  getSystemVouchers,
  createSystemVoucher,
  updateSystemVoucher,
  deleteSystemVoucher,
  getVoucherUsageHistoryAdmin,
  getVoucherLocationsAdmin,
  getOwnerVouchersAdmin,
  updateOwnerVoucherStatusAdmin,
  reviewOwnerVoucherAdmin,
  updateOwnerVoucherAdmin,
  deleteOwnerVoucherAdmin,
  createPushNotification,
  getPushNotifications,
  deletePushNotification,
  confirmPaymentAndCreateCommission,
} from "../controllers/adminController";
import { authenticateToken, requireRole } from "../middleware/authMiddleware";

const router = Router();

// Vì sao: Upload avatar cần nhận file nhưng không được lưu vào máy server, nên dùng memoryStorage.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    // Cho phép upload lớn (phòng trường hợp ảnh 4K), nhưng vẫn nên cân nhắc hiệu năng.
    fileSize: 50 * 1024 * 1024,
  },
});

// Tất cả routes đều yêu cầu xác thực và role admin
router.use(authenticateToken);
router.use(requireRole("admin"));

// Dashboard
router.get("/dashboard/stats", getDashboardStats);

// Admin Profile
router.get("/profile", getAdminProfile);
router.put("/profile", updateAdminProfile);
router.post("/profile/avatar", upload.single("avatar"), uploadAdminAvatar);
router.get("/profile/avatar/current", getAdminAvatarCurrent);
router.get("/profile/avatar/history", getAdminAvatarHistory);
router.get("/profile/avatar/history/:avatarId", getAdminAvatarHistoryFile);
router.post("/profile/avatar/use/:avatarId", useAdminAvatarFromHistory);
router.put("/profile/password", changeAdminPassword);
router.get("/profile/login-history", getAdminLoginHistory);

// Quản lý User
router.get("/users", getUsers);
router.get("/users/:id", getUserById);
router.get("/users/:id/login-history", getUserLoginHistory);
router.get("/users/:id/search-history", getUserSearchHistory);
router.get("/users/:id/travel-history", getUserTravelHistory);
router.get("/users/:id/review-history", getUserReviewHistory);
router.get("/users/:id/favorites", getUserFavoriteLocations);
router.put("/users/:id/status", updateUserStatus);
router.put("/users/:id/promote-owner", promoteUserToOwner);
router.delete("/users/:id", deleteUser);

// Quản lý Owner
router.get("/owners", getOwners);
router.get("/owners/:id", getOwnerById);
router.put("/owners/:id/approve", approveOwner);
router.put("/owners/:id/reject", rejectOwner);
router.put("/owners/:id/status", updateOwnerStatus);
router.delete("/owners/:id", deleteOwner);
router.get("/owners/:id/employees", getOwnerEmployees);
router.get("/owners/:id/violations", getOwnerViolations);
router.post("/owners/:id/violations", createOwnerViolation);
router.post("/owners/:id/send-terms", sendOwnerTermsEmailToOwner);
router.put("/owners/:id/terms-accepted", markOwnerTermsAccepted);
router.get("/owners/:id/locations", getOwnerLocations);
router.get("/locations", getAdminLocations);
router.put("/locations/:id/commission-rate", updateLocationCommissionRate);
router.put("/locations/:id/approve", approveLocation);
router.put("/locations/:id/reject", rejectLocation);
router.put("/locations/:id/hide", hideLocation);
router.delete("/locations/:id", deleteLocation);
router.get("/locations/duplicates", getLocationDuplicates);
router.post("/locations/merge", mergeLocations);

// Quản lý Check-in
router.get("/checkins", getCheckins);
router.get("/checkins/:id", getCheckinById);
router.get("/locations/:id/checkins/history", getLocationCheckinHistory);
router.get(
  "/locations/:id/pos/payments-history",
  getAdminLocationPosPaymentsHistory,
);
router.get(
  "/locations/:id/tourist/tickets/invoices",
  getAdminLocationTouristTicketInvoices,
);
router.get("/owners/:id/revenue-summary", getAdminOwnerRevenueSummary);
router.put("/checkins/:id/verify", verifyCheckin);
router.put("/checkins/:id/fail", failCheckin);
router.put("/checkins/:id/toggle-lock", toggleCheckinLock);
router.put("/checkins/:id/location-status", updateCheckinLocationStatus);
router.delete("/checkins/:id", deleteCheckin);

// Payment confirm -> tạo commission + VAT theo system_settings
router.post("/payments/:id/confirm", confirmPaymentAndCreateCommission);

// Quản lý Commission & VAT
router.get("/commissions", getCommissions);
router.get("/commissions/:id", getCommissionDetails);
router.delete("/commissions/:id", deleteCommission);
router.put("/commissions/rate", updateCommissionRate);
router.get("/owners/:id/commission-history", getCommissionHistory);
router.post("/commissions/:id/remind", remindCommission);
router.put("/commissions/:id/hide-location", hideCommissionLocation);
router.put("/commissions/:id/lock-owner", lockCommissionOwner);
router.post("/commissions/mark-paid", markCommissionsPaid);
router.get("/commission-payment-requests", getCommissionPaymentRequests);
router.post(
  "/commission-payment-requests/:id/confirm",
  confirmCommissionPaymentRequest,
);

// Quản lý Reports
router.get("/reports", getReports);
router.get("/reports/:id", getReportById);
router.put("/reports/:id/resolve", resolveReport);
router.put("/reports/:id/lock", updateReportLockStatus);
router.post("/reports/:id/remind", remindReport);
router.delete("/reports/:id", deleteReport);
router.post("/reports/:id/warn-user", warnReportedUser);
router.post("/reports/:id/warn-owner", warnReportedOwner);
router.post("/reports/:id/delete-review", deleteReportedReview);

// Quản lí Review
router.get("/reviews", getAdminReviews);
router.delete("/reviews/:id", deleteAdminReview);
router.post("/reviews/:id/report-user", reportReviewUserByAdmin);
router.delete("/reviews/:id/reply", deleteOwnerReplyByAdmin);
router.post("/reviews/:id/report-owner", reportOwnerReplyByAdmin);

// Analytics
router.get("/analytics/checkins", getCheckinAnalytics);

// System Logs
router.get("/logs", getSystemLogs);
router.get("/chat-history", getOwnerChatHistory);

// System Settings
router.get("/settings", getSystemSettings);
router.put("/settings", updateSystemSettings);

// Admin bank (platform bank for owner commission payments)
router.get("/bank", getAdminBank);
router.put("/bank", updateAdminBank);

// AI Management
router.get("/ai/settings", getAiSettings);
router.put("/ai/settings", updateAiSettings);
router.get("/ai/logs", getAiLogs);
router.get("/ai/chat-history", getAiChatHistory);

// Background schedules
router.get("/backgrounds", getBackgroundSchedules);
router.post("/backgrounds", createBackgroundSchedule);
router.put("/backgrounds/:id", updateBackgroundSchedule);
router.put("/backgrounds/:id/toggle", toggleBackgroundSchedule);
router.delete("/backgrounds/:id", deleteBackgroundSchedule);

// Background images (app/login)
router.get("/backgrounds/history", getBackgroundHistory);
router.post(
  "/backgrounds/upload",
  upload.single("image"),
  uploadBackgroundImage,
);
router.post("/backgrounds/url", setBackgroundUrl);
router.post("/backgrounds/use/:id", useBackgroundFromHistory);

// SOS Alerts
router.get("/sos", getSosAlerts);
router.put("/sos/:id/status", updateSosAlertStatus);

// Owner Services (Admin approval)
router.get("/owner-services", getOwnerServicesAdmin);
router.put("/owner-services/:id/status", updateOwnerServiceApprovalAdmin);
router.put("/owner-services/bulk-status", bulkUpdateOwnerServiceApprovalAdmin);
router.delete("/owner-services/:id", deleteOwnerServiceAdmin);

// System Vouchers (Admin)
router.get("/system-vouchers", getSystemVouchers);
router.post("/system-vouchers", createSystemVoucher);
router.put("/system-vouchers/:id", updateSystemVoucher);
router.delete("/system-vouchers/:id", deleteSystemVoucher);

// Voucher usage history
router.get("/vouchers/:id/usage-history", getVoucherUsageHistoryAdmin);
router.get("/vouchers/:id/locations", getVoucherLocationsAdmin);

// Owner Vouchers (Admin approval)
router.get("/owner-vouchers", getOwnerVouchersAdmin);
router.put("/owner-vouchers/:id/status", updateOwnerVoucherStatusAdmin);
router.put("/owner-vouchers/:id/review", reviewOwnerVoucherAdmin);
router.put("/owner-vouchers/:id", updateOwnerVoucherAdmin);
router.delete("/owner-vouchers/:id", deleteOwnerVoucherAdmin);

// Push Notifications (Admin)
router.get("/push-notifications", getPushNotifications);
router.post("/push-notifications", createPushNotification);
router.delete("/push-notifications/:id", deletePushNotification);

export default router;
