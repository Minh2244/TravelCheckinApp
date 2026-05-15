import express from "express";
import multer from "multer";

import { authenticateToken, requireRole } from "../middleware/authMiddleware";
import {
  addHotelStayItems,
  createOwnerCommissionPaymentRequest,
  createOrGetPaymentForBooking,
  createHotelRoom,
  updateHotelRoom,
  deleteHotelRoom,
  updateHotelRoomPosition,
  createOwnerEmployee,
  createOwnerLocation,
  createPosArea,
  createPosTable,
  createServiceCategoryForLocation,
  createOwnerVoucher,
  createServiceForLocation,
  checkoutHotelStay,
  checkoutHotelStaysBatch,
  deleteOwnerVoucher,
  deletePosArea,
  deleteService,
  deleteServiceCategory,
  getFrontOfficeContext,
  getHotelRooms,
  failOwnerCheckin,
  getOwnerAuditLogs,
  getOwnerBank,
  getOwnerBookingFoodItems,
  getAdminBankInfo,
  getOwnerBookings,
  getOwnerCheckins,
  getOwnerCommissions,
  getOwnerEmployeeDetail,
  getOwnerEmployees,
  updateOwnerEmployee,
  deleteOwnerEmployee,
  getOwnerLocations,
  getOwnerLoginHistory,
  getOwnerMe,
  getOwnerPayments,
  getOwnerProfile,
  getOwnerReviews,
  getOwnerNotifications,
  getOwnerVouchers,
  getOwnerVoucherUsageHistory,
  getServicesByLocation,
  getServiceCategoriesByLocation,
  getPosAreas,
  getPosMenu,
  getPosOrderDetail,
  getPosPaymentsHistory,
  getPosTables,
  getHotelPaymentsRecent,
  getTouristTicketToday,
  getTouristTicketInvoices,
  getTouristTicketsByUser,
  hideReview,
  deleteOwnerReview,
  reportReviewUserByOwner,
  openPosTable,
  payPosOrder,
  payTouristPosTicketsBatch,
  reservePosTable,
  arrivePosTable,
  markOwnerPaymentCompleted,
  replyToReview,
  markOwnerNotificationsReadAll,
  deleteOwnerNotificationsAll,
  scanTouristTicket,
  sellTouristPosTickets,
  sellTouristPosTicketsBatch,
  setHotelRoomStatus,
  checkinHotelRoom,
  addPosOrderItem,
  updatePosOrderItem,
  deletePosOrderItem,
  deletePosTable,
  updateBookingStatus,
  extendHotelStay,
  updatePosArea,
  updatePosTable,
  updatePosTablePosition,
  updateOwnerBank,
  updateOwnerEmployeeAssignments,
  updateOwnerLocation,
  updateOwnerLocationStatus,
  updateOwnerProfile,
  updateOwnerVoucher,
  updateServiceCategory,
  updateService,
  uploadOwnerAvatar,
  uploadOwnerBackground,
  uploadOwnerServiceImage,
  verifyOwnerCheckin,
} from "../controllers/ownerController";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(authenticateToken);
router.use(requireRole("owner", "employee"));

// Me / identity
router.get("/me", getOwnerMe);

// Profile (owner-only for mutations)
router.get("/profile", getOwnerProfile);
router.put("/profile", updateOwnerProfile);
router.post("/profile/avatar", upload.single("avatar"), uploadOwnerAvatar);
router.post(
  "/profile/background",
  upload.single("background"),
  uploadOwnerBackground,
);

// Service image upload (single image)
router.post(
  "/services/upload-image",
  upload.single("image"),
  uploadOwnerServiceImage,
);
router.get("/profile/login-history", getOwnerLoginHistory);
router.get("/profile/audit-logs", getOwnerAuditLogs);

// Bank
router.get("/bank", getOwnerBank);
router.put("/bank", updateOwnerBank);

// Admin bank info (for commission payments)
router.get("/admin-bank", getAdminBankInfo);

// Locations
router.get("/locations", getOwnerLocations);
router.post(
  "/locations",
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "images", maxCount: 12 },
  ]),
  createOwnerLocation,
);
router.put(
  "/locations/:id",
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "images", maxCount: 12 },
  ]),
  updateOwnerLocation,
);
router.put("/locations/:id/status", updateOwnerLocationStatus);

// Services
router.get("/locations/:locationId/services", getServicesByLocation);
router.post("/locations/:locationId/services", createServiceForLocation);
router.put("/services/:id", updateService);
router.delete("/services/:id", deleteService);

// Service Categories
router.get(
  "/locations/:locationId/service-categories",
  getServiceCategoriesByLocation,
);
router.post(
  "/locations/:locationId/service-categories",
  createServiceCategoryForLocation,
);
router.put("/service-categories/:categoryId", updateServiceCategory);
router.delete("/service-categories/:categoryId", deleteServiceCategory);

// Bookings
router.get("/bookings", getOwnerBookings);
router.get("/bookings/:id/food-items", getOwnerBookingFoodItems);
router.put("/bookings/:id/status", updateBookingStatus);

// Payments
router.post("/bookings/:bookingId/payments", createOrGetPaymentForBooking);
router.get("/payments", getOwnerPayments);
router.put("/payments/:id/mark-completed", markOwnerPaymentCompleted);

// Commissions (owner-only)
router.get("/commissions", getOwnerCommissions);
router.post(
  "/commissions/payment-request",
  createOwnerCommissionPaymentRequest,
);

// Vouchers (owner-only)
router.get("/vouchers", getOwnerVouchers);
router.get("/vouchers/:id/usage-history", getOwnerVoucherUsageHistory);
router.post("/vouchers", createOwnerVoucher);
router.put("/vouchers/:id", updateOwnerVoucher);
router.delete("/vouchers/:id", deleteOwnerVoucher);

// Reviews
router.get("/reviews", getOwnerReviews);
router.post("/reviews/:id/reply", replyToReview);
router.put("/reviews/:id/hide", hideReview);
router.delete("/reviews/:id", deleteOwnerReview);
router.post("/reviews/:id/report-user", reportReviewUserByOwner);

// Notifications
router.get("/notifications", getOwnerNotifications);
router.post("/notifications/read-all", markOwnerNotificationsReadAll);
router.post("/notifications/delete-all", deleteOwnerNotificationsAll);

// Check-ins (Front-office)
router.get("/checkins", getOwnerCheckins);
router.post("/checkins/:id/verify", verifyOwnerCheckin);
router.post("/checkins/:id/fail", failOwnerCheckin);

// POS/PMS Front-office context
router.get("/front-office/context", getFrontOfficeContext);

// Hotel PMS
router.get("/front-office/hotel/rooms", getHotelRooms);
router.post("/front-office/hotel/rooms", createHotelRoom);
router.put("/front-office/hotel/rooms/:roomId", updateHotelRoom);
router.delete("/front-office/hotel/rooms/:roomId", deleteHotelRoom);
router.post("/front-office/hotel/rooms/:roomId/status", setHotelRoomStatus);
router.post(
  "/front-office/hotel/rooms/:roomId/position",
  updateHotelRoomPosition,
);
router.post("/front-office/hotel/rooms/:roomId/checkin", checkinHotelRoom);
router.post("/front-office/hotel/stays/:stayId/items", addHotelStayItems);
router.post("/front-office/hotel/stays/:stayId/extend", extendHotelStay);
router.post("/front-office/hotel/stays/:stayId/checkout", checkoutHotelStay);
router.post(
  "/front-office/hotel/stays/checkout-batch",
  checkoutHotelStaysBatch,
);
router.get("/front-office/hotel/payments-recent", getHotelPaymentsRecent);

// Restaurant/Cafe POS
router.get("/front-office/pos/areas", getPosAreas);
router.post("/front-office/pos/areas", createPosArea);
router.put("/front-office/pos/areas/:areaId", updatePosArea);
router.delete("/front-office/pos/areas/:areaId", deletePosArea);
router.get("/front-office/pos/tables", getPosTables);
router.post("/front-office/pos/tables", createPosTable);
router.put("/front-office/pos/tables/:tableId", updatePosTable);
router.delete("/front-office/pos/tables/:tableId", deletePosTable);
router.post(
  "/front-office/pos/tables/:tableId/position",
  updatePosTablePosition,
);
router.get("/front-office/pos/menu", getPosMenu);
router.post("/front-office/pos/tables/:tableId/open", openPosTable);
router.post("/front-office/pos/tables/:tableId/reserve", reservePosTable);
router.post("/front-office/pos/tables/:tableId/arrive", arrivePosTable);
router.get("/front-office/pos/orders/:orderId", getPosOrderDetail);
router.post("/front-office/pos/orders/:orderId/items", addPosOrderItem);
router.put(
  "/front-office/pos/orders/:orderId/items/:orderItemId",
  updatePosOrderItem,
);
router.delete(
  "/front-office/pos/orders/:orderId/items/:orderItemId",
  deletePosOrderItem,
);
router.post("/front-office/pos/orders/:orderId/pay", payPosOrder);
router.get("/front-office/pos/payments-history", getPosPaymentsHistory);

// Tourist POS
router.get("/front-office/tourist/tickets/today", getTouristTicketToday);
router.get("/front-office/tourist/tickets/invoices", getTouristTicketInvoices);
router.get("/front-office/tourist/tickets/by-user", getTouristTicketsByUser);
router.post("/front-office/tourist/tickets/scan", scanTouristTicket);
router.post("/front-office/tourist/tickets/sell", sellTouristPosTickets);
router.post(
  "/front-office/tourist/tickets/sell-batch",
  sellTouristPosTicketsBatch,
);

// Tourist POS payments (cash + transfer init/complete)
router.post(
  "/front-office/tourist/tickets/pay-batch",
  payTouristPosTicketsBatch,
);

// Employees (owner-only)
router.get("/employees", getOwnerEmployees);
router.get("/employees/:id", getOwnerEmployeeDetail);
router.post("/employees", createOwnerEmployee);
router.put("/employees/:id", updateOwnerEmployee);
router.delete("/employees/:id", deleteOwnerEmployee);
router.put("/employees/:id/assignments", updateOwnerEmployeeAssignments);

export default router;
