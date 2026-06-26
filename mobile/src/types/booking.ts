export type BookingSource = "web" | "mobile" | "admin";

export type PreorderItemPayload = {
  service_id: number;
  quantity: number;
};

export type TicketItemPayload = {
  service_id: number;
  quantity: number;
};

export type CreateBookingPayload = {
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
  table_ids?: number[];
  preorder_items?: PreorderItemPayload[];
  ticket_items?: TicketItemPayload[];
};

export type CreateBookingResult = {
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
};

export type CreateBookingResponse = {
  success: boolean;
  message?: string;
  data: CreateBookingResult;
};

export type CreateBookingBatchPayload = {
  location_id: number;
  service_ids: number[];
  check_in_date: string;
  check_out_date?: string | null;
  source?: BookingSource;
  notes?: string | null;
  reserve_on_confirm?: boolean;
  voucher_code?: string | null;
};

export type CreateBookingBatchResult = {
  bookingIds: number[];
  totalAmount: number;
  discountAmount: number;
  finalAmount: number;
  voucherCode: string | null;
};

export type CreateBookingBatchResponse = {
  success: boolean;
  message?: string;
  data: CreateBookingBatchResult;
};

export type BookingPaymentResult = {
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
};

export type BookingPaymentResponse = {
  success: boolean;
  message?: string;
  data: BookingPaymentResult;
};

export type BookingBatchPaymentResponse = {
  success: boolean;
  message?: string;
  data: BookingPaymentResult;
};

export type UpdateRoomBookingBatchContactResponse = {
  success: boolean;
  message?: string;
  data: {
    bookingIds: number[];
    contactName: string;
    contactPhone: string;
  };
};

export type IssuedTicketRow = {
  ticketId: number;
  serviceId: number;
  ticketCode: string;
  status: string;
  issuedAt: string | null;
};

export type ConfirmTicketTransferResponse = {
  success: boolean;
  message?: string;
  data: {
    bookingId: number;
    paymentId: number;
    paymentStatus: string;
    issuedCount: number;
    issuedTickets: IssuedTicketRow[];
  };
};

export type ConfirmTableTransferResponse = {
  success: boolean;
  message?: string;
  data: {
    bookingId: number;
    paymentId: number;
    paymentStatus: string;
  };
};

export type ConfirmRoomTransferResponse = ConfirmTableTransferResponse;

export type ConfirmRoomBatchTransferResponse = {
  success: boolean;
  message?: string;
  data: {
    paymentId: number;
    paymentStatus: string;
    bookingIds: number[];
  };
};

export type TableReservationItem = {
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
  totalAmount?: number;
  qrPayload?: string;
  secureCode?: string;
  invoiceCode?: string;
};

export type RoomReservationItem = {
  bookingId: number;
  locationId: number;
  locationName: string | null;
  bookingStatus: string;
  paymentStatus: string | null;
  checkInDate: string;
  checkOutDate: string | null;
  nightCount: number;
  roomNames: string[];
  contactName: string | null;
  contactPhone: string | null;
  canCancel: boolean;
  totalAmount: number;
  qrPayload?: string;
  secureCode?: string;
  invoiceCode?: string;
};

export type TableReservationsResponse = {
  success: boolean;
  message?: string;
  data: TableReservationItem[];
};

export type RoomReservationsResponse = {
  success: boolean;
  message?: string;
  data: RoomReservationItem[];
};

export type CancelBookingResponse = {
  success: boolean;
  message?: string;
  data: {
    bookingId: number;
  };
};

export type AttachTablePreorderResponse = {
  success: boolean;
  message?: string;
  data: {
    bookingId: number;
    posOrderId: number;
    preorderAmount: number;
  };
};
