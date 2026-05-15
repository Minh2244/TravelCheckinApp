import axiosClient from "./axiosClient";
import type {
  CreateBookingPayload,
  CreateBookingBatchPayload,
  CreateBookingResponse,
  CreateBookingBatchResponse,
  BookingPaymentResponse,
  BookingBatchPaymentResponse,
  UpdateRoomBookingBatchContactResponse,
  ConfirmRoomTransferResponse,
  ConfirmRoomBatchTransferResponse,
  ConfirmTicketTransferResponse,
  ConfirmTableTransferResponse,
  TableReservationsResponse,
  CancelTableBookingResponse,
  AttachTablePreorderResponse,
} from "../types/booking.types";

const bookingApi = {
  createBooking: async (payload: CreateBookingPayload) => {
    const response = await axiosClient.post<CreateBookingResponse>(
      "/bookings",
      payload,
    );
    return response.data;
  },

  createBookingBatch: async (payload: CreateBookingBatchPayload) => {
    const response = await axiosClient.post<CreateBookingBatchResponse>(
      "/bookings/batch",
      payload,
    );
    return response.data;
  },

  createOrGetPaymentForBooking: async (bookingId: number) => {
    const response = await axiosClient.post<BookingPaymentResponse>(
      `/bookings/${bookingId}/payments`,
    );
    return response.data;
  },

  createOrGetPaymentForBookingBatch: async (bookingIds: number[]) => {
    const response = await axiosClient.post<BookingBatchPaymentResponse>(
      "/bookings/batch/payments",
      { booking_ids: bookingIds },
    );
    return response.data;
  },

  updateRoomBookingBatchContact: async (
    bookingIds: number[],
    contactName: string,
    contactPhone: string,
  ) => {
    const response =
      await axiosClient.put<UpdateRoomBookingBatchContactResponse>(
        "/bookings/batch/contact",
        {
          booking_ids: bookingIds,
          contact_name: contactName,
          contact_phone: contactPhone,
        },
      );
    return response.data;
  },

  confirmTicketTransfer: async (bookingId: number) => {
    const response = await axiosClient.post<ConfirmTicketTransferResponse>(
      `/bookings/${bookingId}/tickets/confirm-transfer`,
    );
    return response.data;
  },

  confirmTableTransfer: async (bookingId: number) => {
    const response = await axiosClient.post<ConfirmTableTransferResponse>(
      `/bookings/${bookingId}/tables/confirm-transfer`,
    );
    return response.data;
  },

  confirmRoomTransfer: async (bookingId: number) => {
    const response = await axiosClient.post<ConfirmRoomTransferResponse>(
      `/bookings/${bookingId}/rooms/confirm-transfer`,
    );
    return response.data;
  },

  confirmRoomBatchTransfer: async (paymentId: number) => {
    const response = await axiosClient.post<ConfirmRoomBatchTransferResponse>(
      "/bookings/batch/rooms/confirm-transfer",
      { payment_id: paymentId },
    );
    return response.data;
  },

  getMyTableReservations: async (locationId?: number) => {
    const response = await axiosClient.get<TableReservationsResponse>(
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

  cancelTableBooking: async (bookingId: number) => {
    const response = await axiosClient.post<CancelTableBookingResponse>(
      `/bookings/${bookingId}/tables/cancel`,
    );
    return response.data;
  },

  attachTablePreorder: async (
    bookingId: number,
    preorderItems: Array<{ service_id: number; quantity: number }>,
  ) => {
    const response = await axiosClient.post<AttachTablePreorderResponse>(
      `/bookings/${bookingId}/tables/preorder`,
      { preorder_items: preorderItems },
    );
    return response.data;
  },
};

export default bookingApi;
