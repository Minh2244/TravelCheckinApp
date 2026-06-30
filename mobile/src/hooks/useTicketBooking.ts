import { useRouter } from "expo-router";
import { useCallback, useState } from "react";

import { getErrorMessage } from "../lib/error";
import { showToast } from "../modules/ui/toast-store";
import { bookingApi } from "../services/booking.api";
import type { CreateBookingResult } from "../types/booking";

const MAX_TICKETS = 50;

type UseTicketBookingOpts = {
  locationId: number;
  serviceId: number;
  locationName?: string;
};

/**
 * Hook for ticket booking logic.
 * Handles quantity validation, booking creation, and payment navigation.
 */
export function useTicketBooking({ locationId, serviceId }: UseTicketBookingOpts) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [bookingResult, setBookingResult] = useState<CreateBookingResult | null>(null);

  const incrementQuantity = useCallback(() => {
    setQuantity((q) => Math.min(q + 1, MAX_TICKETS));
  }, []);

  const decrementQuantity = useCallback(() => {
    setQuantity((q) => Math.max(q - 1, 1));
  }, []);

  const canSubmit = quantity > 0 && quantity <= MAX_TICKETS;

  const submitBooking = useCallback(
    async (opts?: { checkInDate?: string; notes?: string }) => {
      if (!canSubmit) {
        showToast(`Số lượng vé từ 1 đến ${MAX_TICKETS}.`);
        return;
      }

      setSubmitting(true);
      try {
        const response = await bookingApi.createBooking({
          location_id: locationId,
          service_id: serviceId,
          check_in_date: opts?.checkInDate || new Date().toISOString(),
          quantity,
          source: "mobile",
          notes: opts?.notes || null,
          ticket_items: [{ service_id: serviceId, quantity }],
        });

        setBookingResult(response.data);
        showToast(response.message || "Tạo booking thành công.");
      } catch (error) {
        showToast(getErrorMessage(error));
      } finally {
        setSubmitting(false);
      }
    },
    [canSubmit, locationId, serviceId, quantity]
  );

  const goToPayment = useCallback(() => {
    if (!bookingResult?.bookingId) return;
    router.push(`/booking/payment/${bookingResult.bookingId}?mode=ticket`);
  }, [bookingResult, router]);

  const reset = useCallback(() => {
    setBookingResult(null);
    setQuantity(1);
  }, []);

  return {
    quantity,
    setQuantity,
    incrementQuantity,
    decrementQuantity,
    submitting,
    canSubmit,
    bookingResult,
    submitBooking,
    goToPayment,
    reset,
    maxTickets: MAX_TICKETS,
  };
}
