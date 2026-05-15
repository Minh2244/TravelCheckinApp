import { Router } from "express";
import {
  attachTablePreorderHandler,
  cancelMyTableBookingHandler,
  confirmRoomBatchTransferHandler,
  confirmRoomTransferHandler,
  confirmTicketTransferHandler,
  confirmTableTransferHandler,
  createBookingBatchHandler,
  createOrGetBookingBatchPaymentHandler,
  createBookingHandler,
  createOrGetBookingPaymentHandler,
  listMyTableReservationsHandler,
  updateRoomBookingBatchContactHandler,
} from "../controllers/bookingController";
import { authenticateToken, requireRole } from "../middleware/authMiddleware";

const router = Router();

// Vì sao: Booking chỉ cho user đã đăng nhập tạo để đảm bảo gắn đúng user_id.
router.use(authenticateToken);
router.use(requireRole("user"));

// POST /api/bookings
router.post("/", createBookingHandler);

// POST /api/bookings/batch
router.post("/batch", createBookingBatchHandler);

// GET /api/bookings/table-reservations/mine
router.get("/table-reservations/mine", listMyTableReservationsHandler);

// POST /api/bookings/batch/payments
router.post("/batch/payments", createOrGetBookingBatchPaymentHandler);

// POST /api/bookings/batch/rooms/confirm-transfer
router.post("/batch/rooms/confirm-transfer", confirmRoomBatchTransferHandler);

// PUT /api/bookings/batch/contact
router.put("/batch/contact", updateRoomBookingBatchContactHandler);

// POST /api/bookings/:id/payments
router.post("/:id/payments", createOrGetBookingPaymentHandler);

// POST /api/bookings/:id/tickets/confirm-transfer
router.post("/:id/tickets/confirm-transfer", confirmTicketTransferHandler);

// POST /api/bookings/:id/tables/confirm-transfer
router.post("/:id/tables/confirm-transfer", confirmTableTransferHandler);

// POST /api/bookings/:id/rooms/confirm-transfer
router.post("/:id/rooms/confirm-transfer", confirmRoomTransferHandler);

// POST /api/bookings/:id/tables/cancel
router.post("/:id/tables/cancel", cancelMyTableBookingHandler);

// POST /api/bookings/:id/tables/preorder
router.post("/:id/tables/preorder", attachTablePreorderHandler);

export default router;
