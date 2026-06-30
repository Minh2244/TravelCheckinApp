import { api } from "../lib/api";
import type {
  AttachTablePreorderResponse,
  BookingBatchPaymentResponse,
  BookingPaymentResponse,
  CancelBookingResponse,
  ConfirmRoomBatchTransferResponse,
  ConfirmRoomTransferResponse,
  ConfirmTableTransferResponse,
  ConfirmTicketTransferResponse,
  CreateBookingBatchPayload,
  CreateBookingBatchResponse,
  CreateBookingPayload,
  CreateBookingResponse,
  RoomReservationsResponse,
  TableReservationsResponse,
  UpdateRoomBookingBatchContactResponse,
} from "../types/booking";

export const bookingApi = {
  async createBooking(payload: CreateBookingPayload) {
    const response = await api.post<CreateBookingResponse>("/bookings", payload);
    return response.data;
  },

  async createBookingBatch(payload: CreateBookingBatchPayload) {
    const response = await api.post<CreateBookingBatchResponse>(
      "/bookings/batch",
      payload,
    );
    return response.data;
  },

  async createOrGetPaymentForBooking(bookingId: number) {
    const response = await api.post<BookingPaymentResponse>(
      `/bookings/${bookingId}/payments`,
      {}
    );
    return response.data;
  },

  async createOrGetPaymentForBookingBatch(bookingIds: number[]) {
    const response = await api.post<BookingBatchPaymentResponse>(
      "/bookings/batch/payments",
      { booking_ids: bookingIds },
    );
    return response.data;
  },

  async updateRoomBookingBatchContact(
    bookingIds: number[],
    contactName: string,
    contactPhone: string,
  ) {
    const response = await api.put<UpdateRoomBookingBatchContactResponse>(
      "/bookings/batch/contact",
      {
        booking_ids: bookingIds,
        contact_name: contactName,
        contact_phone: contactPhone,
      },
    );
    return response.data;
  },

  async confirmTicketTransfer(bookingId: number) {
    const response = await api.post<ConfirmTicketTransferResponse>(
      `/bookings/${bookingId}/tickets/confirm-transfer`,
      {}
    );
    return response.data;
  },

  async confirmTableTransfer(bookingId: number) {
    const response = await api.post<ConfirmTableTransferResponse>(
      `/bookings/${bookingId}/tables/confirm-transfer`,
      {}
    );
    return response.data;
  },

  async confirmRoomTransfer(bookingId: number) {
    const response = await api.post<ConfirmRoomTransferResponse>(
      `/bookings/${bookingId}/rooms/confirm-transfer`,
      {}
    );
    return response.data;
  },

  async confirmRoomBatchTransfer(paymentId: number) {
    const response = await api.post<ConfirmRoomBatchTransferResponse>(
      "/bookings/batch/rooms/confirm-transfer",
      { payment_id: paymentId },
    );
    return response.data;
  },

  async getMyTableReservations(locationId?: number) {
    const response = await api.get<TableReservationsResponse>(
      "/bookings/table-reservations/mine",
      {
        params:
          Number.isFinite(Number(locationId)) && Number(locationId) > 0
            ? { location_id: Number(locationId) }
            : undefined,
      },
    );
    return response.data;
  },

  async getMyTablePass(locationId?: number) {
    const response = await api.get<TableReservationsResponse>(
      "/bookings/table-reservations/pass",
      {
        params:
          Number.isFinite(Number(locationId)) && Number(locationId) > 0
            ? { location_id: Number(locationId) }
            : undefined,
      },
    );
    return response.data;
  },

  async getMyRoomPass(locationId?: number) {
    const response = await api.get<RoomReservationsResponse>(
      "/bookings/room-reservations/pass",
      {
        params:
          Number.isFinite(Number(locationId)) && Number(locationId) > 0
            ? { location_id: Number(locationId) }
            : undefined,
      },
    );
    return response.data;
  },

  async cancelTableBooking(bookingId: number) {
    const response = await api.post<CancelBookingResponse>(
      `/bookings/${bookingId}/tables/cancel`,
      {}
    );
    return response.data;
  },

  async cancelMyBooking(bookingId: number) {
    const response = await api.post<CancelBookingResponse>(
      `/bookings/${bookingId}/cancel`,
      {}
    );
    return response.data;
  },

  async attachTablePreorder(
    bookingId: number,
    preorderItems: Array<{ service_id: number; quantity: number }>,
  ) {
    const response = await api.post<AttachTablePreorderResponse>(
      `/bookings/${bookingId}/tables/preorder`,
      { preorder_items: preorderItems },
    );
    return response.data;
  },
};
