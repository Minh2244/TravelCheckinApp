export type BookingSource = "web" | "mobile" | "admin";

export type PreorderItemPayload = {
  service_id: number;
  quantity: number;
};

export type TicketItemPayload = {
  service_id: number;
  quantity: number;
};

// Payload tạo booking theo chuẩn backend
export interface CreateBookingPayload {
  location_id: number;
  service_id?: number;
  check_in_date: string;
  check_out_date?: string | null;
  quantity?: number;
  source?: BookingSource;
  contact_name?: string | null;
  contact_phone?: string | null;
  notes?: string | null;
  voucher_code?: string | null;
  reserve_on_confirm?: boolean;

  // Table booking extensions
  table_ids?: number[];
  preorder_items?: PreorderItemPayload[];

  // Ticket booking extension
  ticket_items?: TicketItemPayload[];
}

export interface CreateBookingResult {
  bookingId: number;
  totalAmount: number;
  discountAmount: number;
  finalAmount: number;
  voucherCode: string | null;
  payment?: {
    paymentId: number;
    status: string;
    amount: number;
    transactionCode: string | null;
    qrData: unknown;
  } | null;
}

export interface CreateBookingResponse {
  success: boolean;
  message?: string;
  data: CreateBookingResult;
}

export interface CreateBookingBatchPayload {
  location_id: number;
  service_ids: number[];
  check_in_date: string;
  check_out_date?: string | null;
  source?: BookingSource;
  notes?: string | null;
  reserve_on_confirm?: boolean;
}

export interface CreateBookingBatchResult {
  bookingIds: number[];
  totalAmount: number;
  discountAmount: number;
  finalAmount: number;
  voucherCode: string | null;
}

export interface CreateBookingBatchResponse {
  success: boolean;
  message?: string;
  data: CreateBookingBatchResult;
}

export interface BookingPaymentResult {
  payment_id: number;
  booking_id: number | null;
  location_id: number;
  user_id: number | null;
  amount: number;
  status: string;
  payment_method: string | null;
  transaction_code: string | null;
  qr_data: unknown;
  payment_time: string | null;
}

export interface BookingPaymentResponse {
  success: boolean;
  message?: string;
  data: BookingPaymentResult;
}

export interface BookingBatchPaymentResponse {
  success: boolean;
  message?: string;
  data: BookingPaymentResult;
}

export interface UpdateRoomBookingBatchContactResult {
  bookingIds: number[];
  contactName: string;
  contactPhone: string;
}

export interface UpdateRoomBookingBatchContactResponse {
  success: boolean;
  message?: string;
  data: UpdateRoomBookingBatchContactResult;
}

export type IssuedTicketRow = {
  ticketId: number;
  serviceId: number;
  ticketCode: string;
  status: string;
  issuedAt: string | null;
};

export interface ConfirmTicketTransferResult {
  bookingId: number;
  paymentId: number;
  paymentStatus: string;
  issuedCount: number;
  issuedTickets: IssuedTicketRow[];
}

export interface ConfirmTicketTransferResponse {
  success: boolean;
  message?: string;
  data: ConfirmTicketTransferResult;
}

export interface ConfirmTableTransferResult {
  bookingId: number;
  paymentId: number;
  paymentStatus: string;
}

export interface ConfirmRoomTransferResult {
  bookingId: number;
  paymentId: number;
  paymentStatus: string;
}

export interface TableReservationItem {
  bookingId: number;
  locationId: number;
  locationName: string | null;
  bookingStatus: string;
  paymentStatus: string | null;
  checkInDate: string;
  startTime: string;
  endTime: string;
  tableIds: number[];
  tableNames: string[];
  contactName: string | null;
  contactPhone: string | null;
  canCancel: boolean;
  canPreorder: boolean;
  posOrderId: number | null;
}

export interface TableReservationsResponse {
  success: boolean;
  message?: string;
  data: TableReservationItem[];
}

export interface CancelTableBookingResponse {
  success: boolean;
  message?: string;
  data: {
    bookingId: number;
  };
}

export interface AttachTablePreorderResponse {
  success: boolean;
  message?: string;
  data: {
    bookingId: number;
    posOrderId: number;
    preorderAmount: number;
  };
}

export interface ConfirmTableTransferResponse {
  success: boolean;
  message?: string;
  data: ConfirmTableTransferResult;
}

export interface ConfirmRoomTransferResponse {
  success: boolean;
  message?: string;
  data: ConfirmRoomTransferResult;
}

export interface ConfirmRoomBatchTransferResult {
  paymentId: number;
  paymentStatus: string;
  bookingIds: number[];
}

export interface ConfirmRoomBatchTransferResponse {
  success: boolean;
  message?: string;
  data: ConfirmRoomBatchTransferResult;
}
