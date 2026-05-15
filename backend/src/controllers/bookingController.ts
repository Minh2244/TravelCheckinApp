import type { Request, Response } from "express";
import {
  attachPreorderToMyTableBooking,
  cancelMyTableBooking,
  confirmRoomBankTransfer,
  confirmTicketBankTransfer,
  confirmTableBankTransfer,
  createBooking,
  createBookingBatch,
  isBookingError,
  listMyTableReservations,
  updateMyRoomBookingBatchContact,
} from "../services/bookingService";
import {
  confirmRoomBatchBankTransfer,
  createOrGetUserPaymentForBookingBatch,
  createOrGetUserPaymentForBooking,
  isBookingPaymentError,
} from "../services/bookingPaymentService";

type AuthenticatedRequest = Request & {
  userId?: number;
  userRole?: string;
};

interface CreateBookingBody {
  location_id: number;
  service_id?: number;
  check_in_date: string;
  check_out_date?: string | null;
  quantity?: number;
  source?: "web" | "mobile" | "admin";
  contact_name?: string | null;
  contact_phone?: string | null;
  notes?: string | null;
  voucher_code?: string | null;
  reserve_on_confirm?: boolean;
  table_ids?: number[];
  preorder_items?: Array<{ service_id: number; quantity: number }>;
  ticket_items?: Array<{ service_id: number; quantity: number }>;
}

interface CreateBookingBatchBody {
  location_id: number;
  service_ids: number[];
  check_in_date: string;
  check_out_date?: string | null;
  source?: "web" | "mobile" | "admin";
  notes?: string | null;
  reserve_on_confirm?: boolean;
}

interface AttachTablePreorderBody {
  preorder_items?: Array<{ service_id: number; quantity: number }>;
}

interface CreateBookingBatchPaymentBody {
  booking_ids?: number[];
}

interface ConfirmBookingBatchPaymentBody {
  payment_id?: number;
}

interface UpdateBookingBatchContactBody {
  booking_ids?: number[];
  contact_name?: string | null;
  contact_phone?: string | null;
}

export const createBookingHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    if (!userId) {
      res.status(401).json({ success: false, message: "Chưa đăng nhập" });
      return;
    }

    const body = req.body as CreateBookingBody;

    const hasTableIds = Array.isArray(body?.table_ids) && body.table_ids.length;
    const hasTicketItems =
      Array.isArray(body?.ticket_items) && body.ticket_items.length;
    if (
      !body?.location_id ||
      !body?.check_in_date ||
      (!body?.service_id && !hasTableIds && !hasTicketItems)
    ) {
      res.status(400).json({
        success: false,
        message:
          "Thiếu dữ liệu bắt buộc (location_id, check_in_date, và service_id hoặc table_ids hoặc ticket_items)",
      });
      return;
    }

    const result = await createBooking({
      userId,
      locationId: Number(body.location_id),
      serviceId: body.service_id != null ? Number(body.service_id) : null,
      checkInDate: body.check_in_date,
      checkOutDate: body.check_out_date ?? null,
      quantity: Number(body.quantity ?? 1),
      source: body.source ?? "mobile",
      contactName: body.contact_name ?? null,
      contactPhone: body.contact_phone ?? null,
      notes: body.notes ?? null,
      voucherCode: body.voucher_code ?? null,
      reserveOnConfirm: Boolean(body.reserve_on_confirm),
      tableIds: Array.isArray(body.table_ids) ? body.table_ids : null,
      preorderItems: Array.isArray(body.preorder_items)
        ? (body.preorder_items as any)
        : null,
      ticketItems: Array.isArray(body.ticket_items)
        ? (body.ticket_items as any)
        : null,
    });

    res.status(201).json({
      success: true,
      message: "Tạo booking thành công",
      data: result,
    });
  } catch (error) {
    if (isBookingError(error)) {
      res
        .status(error.statusCode)
        .json({ success: false, message: error.message });
      return;
    }

    console.error("Lỗi create booking:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi tạo booking",
    });
  }
};

export const createBookingBatchHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    if (!userId) {
      res.status(401).json({ success: false, message: "Chưa đăng nhập" });
      return;
    }

    const body = req.body as CreateBookingBatchBody;

    if (
      !body?.location_id ||
      !Array.isArray(body?.service_ids) ||
      body.service_ids.length === 0 ||
      !body?.check_in_date
    ) {
      res.status(400).json({
        success: false,
        message:
          "Thiếu dữ liệu bắt buộc (location_id, service_ids, check_in_date)",
      });
      return;
    }

    const result = await createBookingBatch({
      userId,
      locationId: Number(body.location_id),
      serviceIds: body.service_ids.map((x) => Number(x)),
      checkInDate: body.check_in_date,
      checkOutDate: body.check_out_date ?? null,
      source: body.source ?? "web",
      notes: body.notes ?? null,
      reserveOnConfirm: Boolean(body.reserve_on_confirm),
    });

    res.status(201).json({
      success: true,
      message: "Tạo booking thành công",
      data: result,
    });
  } catch (error) {
    if (isBookingError(error)) {
      res
        .status(error.statusCode)
        .json({ success: false, message: error.message });
      return;
    }

    console.error("Lỗi create booking batch:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi tạo booking",
    });
  }
};

export const createOrGetBookingPaymentHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    if (!userId) {
      res.status(401).json({ success: false, message: "Chưa đăng nhập" });
      return;
    }

    const bookingId = Number(req.params.id);
    if (!Number.isFinite(bookingId)) {
      res
        .status(400)
        .json({ success: false, message: "bookingId không hợp lệ" });
      return;
    }

    const payment = await createOrGetUserPaymentForBooking({
      userId,
      bookingId,
    });

    res.status(201).json({
      success: true,
      message: "Tạo/lấy payment thành công",
      data: payment,
    });
  } catch (error) {
    if (isBookingPaymentError(error)) {
      res
        .status(error.statusCode)
        .json({ success: false, message: error.message });
      return;
    }

    console.error("Lỗi create/get booking payment:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi tạo payment",
    });
  }
};

export const createOrGetBookingBatchPaymentHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    if (!userId) {
      res.status(401).json({ success: false, message: "Chưa đăng nhập" });
      return;
    }

    const body = req.body as CreateBookingBatchPaymentBody;
    const bookingIds = Array.isArray(body?.booking_ids)
      ? body.booking_ids.map((x) => Number(x))
      : [];

    const payment = await createOrGetUserPaymentForBookingBatch({
      userId,
      bookingIds,
    });

    res.status(201).json({
      success: true,
      message: "Tạo/lấy payment gộp thành công",
      data: payment,
    });
  } catch (error) {
    if (isBookingPaymentError(error)) {
      res
        .status(error.statusCode)
        .json({ success: false, message: error.message });
      return;
    }

    console.error("Lỗi create/get booking batch payment:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi tạo payment gộp",
    });
  }
};

export const confirmRoomBatchTransferHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    if (!userId) {
      res.status(401).json({ success: false, message: "Chưa đăng nhập" });
      return;
    }

    const body = req.body as ConfirmBookingBatchPaymentBody;
    const paymentId = Number(body?.payment_id);
    if (!Number.isFinite(paymentId) || paymentId <= 0) {
      res
        .status(400)
        .json({ success: false, message: "payment_id không hợp lệ" });
      return;
    }

    const data = await confirmRoomBatchBankTransfer({
      userId,
      paymentId,
    });

    res.status(200).json({
      success: true,
      message: "Xác nhận chuyển khoản thành công",
      data,
    });
  } catch (error) {
    if (isBookingPaymentError(error)) {
      res
        .status(error.statusCode)
        .json({ success: false, message: error.message });
      return;
    }

    console.error("Lỗi confirm room batch transfer:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi xác nhận chuyển khoản",
    });
  }
};

export const updateRoomBookingBatchContactHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    if (!userId) {
      res.status(401).json({ success: false, message: "Chưa đăng nhập" });
      return;
    }

    const body = req.body as UpdateBookingBatchContactBody;
    const bookingIds = Array.isArray(body?.booking_ids)
      ? body.booking_ids.map((x) => Number(x))
      : [];
    const contactName = String(body?.contact_name || "").trim();
    const contactPhone = String(body?.contact_phone || "").trim();

    const data = await updateMyRoomBookingBatchContact({
      userId,
      bookingIds,
      contactName,
      contactPhone,
    });

    res.status(200).json({
      success: true,
      message: "Cập nhật liên hệ thành công",
      data,
    });
  } catch (error) {
    if (isBookingError(error)) {
      res
        .status(error.statusCode)
        .json({ success: false, message: error.message });
      return;
    }

    console.error("Lỗi update room booking batch contact:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi cập nhật liên hệ",
    });
  }
};

export const confirmTicketTransferHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    if (!userId) {
      res.status(401).json({ success: false, message: "Chưa đăng nhập" });
      return;
    }

    const bookingId = Number(req.params.id);
    if (!Number.isFinite(bookingId)) {
      res
        .status(400)
        .json({ success: false, message: "bookingId không hợp lệ" });
      return;
    }

    const data = await confirmTicketBankTransfer({ userId, bookingId });

    res.status(200).json({
      success: true,
      message: "Xác nhận chuyển khoản thành công",
      data,
    });
  } catch (error) {
    if (isBookingError(error)) {
      res
        .status(error.statusCode)
        .json({ success: false, message: error.message });
      return;
    }

    console.error("Lỗi confirm ticket transfer:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi xác nhận chuyển khoản",
    });
  }
};

export const confirmTableTransferHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    if (!userId) {
      res.status(401).json({ success: false, message: "Chưa đăng nhập" });
      return;
    }

    const bookingId = Number(req.params.id);
    if (!Number.isFinite(bookingId)) {
      res
        .status(400)
        .json({ success: false, message: "bookingId không hợp lệ" });
      return;
    }

    const data = await confirmTableBankTransfer({ userId, bookingId });

    res.status(200).json({
      success: true,
      message: "Xác nhận thanh toán thành công",
      data,
    });
  } catch (error) {
    if (isBookingError(error)) {
      res
        .status(error.statusCode)
        .json({ success: false, message: error.message });
      return;
    }

    console.error("Lỗi confirm table transfer:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi xác nhận thanh toán",
    });
  }
};

export const confirmRoomTransferHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    if (!userId) {
      res.status(401).json({ success: false, message: "Chưa đăng nhập" });
      return;
    }

    const bookingId = Number(req.params.id);
    if (!Number.isFinite(bookingId)) {
      res
        .status(400)
        .json({ success: false, message: "bookingId không hợp lệ" });
      return;
    }

    const data = await confirmRoomBankTransfer({ userId, bookingId });

    res.status(200).json({
      success: true,
      message: "Xác nhận thanh toán thành công",
      data,
    });
  } catch (error) {
    if (isBookingError(error)) {
      res
        .status(error.statusCode)
        .json({ success: false, message: error.message });
      return;
    }

    console.error("Lỗi confirm room transfer:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi xác nhận thanh toán",
    });
  }
};

export const listMyTableReservationsHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    if (!userId) {
      res.status(401).json({ success: false, message: "Chưa đăng nhập" });
      return;
    }

    const locationIdRaw = Number((req.query as any)?.location_id);
    const data = await listMyTableReservations({
      userId,
      locationId: Number.isFinite(locationIdRaw) ? locationIdRaw : null,
    });

    res.status(200).json({
      success: true,
      message: "Lấy danh sách đặt bàn thành công",
      data,
    });
  } catch (error) {
    if (isBookingError(error)) {
      res
        .status(error.statusCode)
        .json({ success: false, message: error.message });
      return;
    }

    console.error("Lỗi list my table reservations:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy danh sách đặt bàn",
    });
  }
};

export const cancelMyTableBookingHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    if (!userId) {
      res.status(401).json({ success: false, message: "Chưa đăng nhập" });
      return;
    }

    const bookingId = Number(req.params.id);
    if (!Number.isFinite(bookingId)) {
      res
        .status(400)
        .json({ success: false, message: "bookingId không hợp lệ" });
      return;
    }

    const data = await cancelMyTableBooking({ userId, bookingId });
    res.status(200).json({
      success: true,
      message: "Hủy đặt bàn thành công",
      data,
    });
  } catch (error) {
    if (isBookingError(error)) {
      res
        .status(error.statusCode)
        .json({ success: false, message: error.message });
      return;
    }

    console.error("Lỗi cancel table booking:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi hủy đặt bàn",
    });
  }
};

export const attachTablePreorderHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    if (!userId) {
      res.status(401).json({ success: false, message: "Chưa đăng nhập" });
      return;
    }

    const bookingId = Number(req.params.id);
    if (!Number.isFinite(bookingId)) {
      res
        .status(400)
        .json({ success: false, message: "bookingId không hợp lệ" });
      return;
    }

    const body = req.body as AttachTablePreorderBody;
    const items = Array.isArray(body.preorder_items)
      ? body.preorder_items.map((item) => ({
          serviceId: Number(item.service_id),
          quantity: Number(item.quantity),
        }))
      : [];

    const data = await attachPreorderToMyTableBooking({
      userId,
      bookingId,
      items,
    });

    res.status(200).json({
      success: true,
      message: "Cập nhật món đặt trước thành công",
      data,
    });
  } catch (error) {
    if (isBookingError(error)) {
      res
        .status(error.statusCode)
        .json({ success: false, message: error.message });
      return;
    }

    console.error("Lỗi attach table preorder:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi cập nhật món đặt trước",
    });
  }
};
