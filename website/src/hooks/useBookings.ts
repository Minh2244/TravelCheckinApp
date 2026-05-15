import { useCallback, useState } from "react";
import bookingApi from "../api/bookingApi";
import { getErrorMessage } from "../utils/safe";
import type {
  CreateBookingPayload,
  CreateBookingResult,
} from "../types/booking.types";

// Dùng để quản lý trạng thái tạo booking
interface UseBookingState {
  loading: boolean;
  error: string | null;
  result: CreateBookingResult | null;
}

// Vì sao: tập trung logic tạo booking để UI chỉ lo hiển thị trạng thái
export const useBookings = () => {
  const [state, setState] = useState<UseBookingState>({
    loading: false,
    error: null,
    result: null,
  });

  const createBooking = useCallback(async (payload: CreateBookingPayload) => {
    setState({ loading: true, error: null, result: null });
    try {
      const response = await bookingApi.createBooking(payload);
      setState({ loading: false, error: null, result: response.data });
      return response.data;
    } catch (error: unknown) {
      const message = getErrorMessage(error, "Không thể tạo booking");
      setState({ loading: false, error: message, result: null });
      return null;
    }
  }, []);

  return {
    ...state,
    createBooking,
  };
};
