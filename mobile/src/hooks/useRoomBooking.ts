import { useRouter } from "expo-router";
import { useCallback, useState } from "react";

import { getErrorMessage } from "../lib/error";
import { showToast } from "../modules/ui/toast-store";
import { bookingApi } from "../services/booking.api";
import type { CreateBookingBatchResult } from "../types/booking";

type RoomEntry = {
  serviceId: number;
  serviceName: string;
  price: number;
  quantity: number;
};

type UseRoomBookingOpts = {
  locationId: number;
};

/**
 * Hook for room booking logic with batch support.
 * Handles multi-room selection, night calculation, batch booking + payment.
 */
export function useRoomBooking({ locationId }: UseRoomBookingOpts) {
  const router = useRouter();
  const [rooms, setRooms] = useState<RoomEntry[]>([]);
  const [checkInDate, setCheckInDate] = useState("");
  const [checkOutDate, setCheckOutDate] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [bookingResult, setBookingResult] = useState<CreateBookingBatchResult | null>(null);

  const nightCount = useCallback(() => {
    if (!checkInDate || !checkOutDate) return 0;
    try {
      const partsIn = checkInDate.trim().split(/[\s/\-:]+/);
      const partsOut = checkOutDate.trim().split(/[\s/\-:]+/);
      if (partsIn.length >= 5 && partsOut.length >= 5) {
        const dIn = new Date(
          parseInt(partsIn[2], 10), parseInt(partsIn[1], 10) - 1, parseInt(partsIn[0], 10)
        );
        const dOut = new Date(
          parseInt(partsOut[2], 10), parseInt(partsOut[1], 10) - 1, parseInt(partsOut[0], 10)
        );
        const diff = Math.ceil((dOut.getTime() - dIn.getTime()) / (1000 * 60 * 60 * 24));
        return diff > 0 ? diff : 0;
      }
    } catch {}
    return 0;
  }, [checkInDate, checkOutDate]);

  const addRoom = useCallback((serviceId: number, serviceName: string, price: number) => {
    setRooms((prev) => {
      const existing = prev.find((r) => r.serviceId === serviceId);
      if (existing) {
        return prev.map((r) =>
          r.serviceId === serviceId ? { ...r, quantity: r.quantity + 1 } : r
        );
      }
      return [...prev, { serviceId, serviceName, price, quantity: 1 }];
    });
  }, []);

  const removeRoom = useCallback((serviceId: number) => {
    setRooms((prev) => {
      const existing = prev.find((r) => r.serviceId === serviceId);
      if (existing && existing.quantity > 1) {
        return prev.map((r) =>
          r.serviceId === serviceId ? { ...r, quantity: r.quantity - 1 } : r
        );
      }
      return prev.filter((r) => r.serviceId !== serviceId);
    });
  }, []);

  const totalAmount = useCallback(() => {
    const nights = nightCount();
    return rooms.reduce((sum, r) => sum + r.price * r.quantity * Math.max(nights, 1), 0);
  }, [rooms, nightCount]);

  const canSubmit =
    rooms.length > 0 &&
    rooms.some((r) => r.quantity > 0) &&
    Boolean(checkInDate) &&
    Boolean(checkOutDate) &&
    nightCount() > 0 &&
    Boolean(contactName.trim()) &&
    Boolean(contactPhone.trim());

  const submitBooking = useCallback(async () => {
    if (!canSubmit) {
      showToast("Vui lòng kiểm tra thông tin đặt phòng.");
      return;
    }

    setSubmitting(true);
    try {
      // Parse dates
      const partsIn = checkInDate.trim().split(/[\s/\-:]+/);
      const partsOut = checkOutDate.trim().split(/[\s/\-:]+/);
      const dIn = new Date(
        parseInt(partsIn[2], 10), parseInt(partsIn[1], 10) - 1, parseInt(partsIn[0], 10),
        parseInt(partsIn[3], 10), parseInt(partsIn[4], 10)
      );
      const dOut = new Date(
        parseInt(partsOut[2], 10), parseInt(partsOut[1], 10) - 1, parseInt(partsOut[0], 10),
        parseInt(partsOut[3], 10), parseInt(partsOut[4], 10)
      );

      const toISO = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

      // Use batch booking for multiple rooms
      if (rooms.length > 1) {
        const serviceIds: number[] = [];
        rooms.forEach((r) => {
          for (let i = 0; i < r.quantity; i++) serviceIds.push(r.serviceId);
        });

        const response = await bookingApi.createBookingBatch({
          location_id: locationId,
          service_ids: serviceIds,
          check_in_date: toISO(dIn),
          check_out_date: toISO(dOut),
          source: "mobile",
          notes: notes.trim() || null,
          reserve_on_confirm: true,
        });

        setBookingResult(response.data);
        showToast(response.message || "Tạo booking thành công.");
      } else {
        // Single room booking
        const room = rooms[0];
        const response = await bookingApi.createBooking({
          location_id: locationId,
          service_id: room.serviceId,
          check_in_date: toISO(dIn),
          check_out_date: toISO(dOut),
          quantity: room.quantity,
          source: "mobile",
          contact_name: contactName.trim(),
          contact_phone: contactPhone.trim(),
          notes: notes.trim() || null,
          reserve_on_confirm: true,
        });

        setBookingResult({
          bookingIds: [response.data.bookingId],
          totalAmount: response.data.totalAmount,
          discountAmount: response.data.discountAmount,
          finalAmount: response.data.finalAmount,
          voucherCode: response.data.voucherCode,
        });
        showToast(response.message || "Tạo booking thành công.");
      }
    } catch (error) {
      showToast(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, checkInDate, checkOutDate, contactName, contactPhone, notes, locationId, rooms]);

  const goToPayment = useCallback(() => {
    if (!bookingResult?.bookingIds?.length) return;
    const id = bookingResult.bookingIds[0];
    router.push(`/booking/payment/${id}?mode=room`);
  }, [bookingResult, router]);

  const reset = useCallback(() => {
    setBookingResult(null);
    setRooms([]);
  }, []);

  return {
    rooms,
    addRoom,
    removeRoom,
    checkInDate,
    setCheckInDate,
    checkOutDate,
    setCheckOutDate,
    contactName,
    setContactName,
    contactPhone,
    setContactPhone,
    notes,
    setNotes,
    nightCount: nightCount(),
    totalAmount: totalAmount(),
    submitting,
    canSubmit,
    bookingResult,
    submitBooking,
    goToPayment,
    reset,
  };
}
