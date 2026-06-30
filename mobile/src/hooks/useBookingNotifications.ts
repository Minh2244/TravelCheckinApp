import { useEffect, useRef } from "react";
import { DeviceEventEmitter } from "react-native";
import EventSource from "react-native-sse";

import { env } from "../lib/env";
import { useAuthStore } from "../modules/auth/store";
import { showToast } from "../modules/ui/toast-store";

export function useBookingNotifications() {
  const esRef = useRef<EventSource | null>(null);
  const status = useAuthStore((s) => s.status);

  useEffect(() => {
    if (status !== "authenticated") return;

    const token = useAuthStore.getState().accessToken;
    if (!token) return;

    const backendUrl = env.apiOrigin;
    if (!backendUrl) return;

    // Website uses API_URL/events
    const apiUrl = backendUrl.endsWith("/api") ? backendUrl.replace(/\/api$/, "") : backendUrl;
    const url = `${apiUrl}/api/events?token=${token}`;

    const es = new EventSource(url);
    esRef.current = es;

    es.addEventListener("message", (evt) => {
      try {
        if (!evt.data) return;
        const data = JSON.parse(evt.data);
        const { type, booking_id, message } = data;

        if (type === "booking_confirmed" || type === "booking_cancelled" || type === "booking_checked_in") {
          // Kích hoạt reload ngầm cho các hóa đơn và sơ đồ bàn
          DeviceEventEmitter.emit("booking_updated", data);
        }

        if (type === "booking_confirmed") {
          showToast(`🎉 ${message || `Đơn đặt bàn #${booking_id} đã được duyệt!`}`, 5000);
        } else if (type === "booking_cancelled") {
          showToast(`❌ ${message || `Đơn đặt bàn #${booking_id} đã bị từ chối.`}`, 5000);
        } else if (type === "booking_checked_in") {
          showToast(`✅ ${message || `Check-in #${booking_id} thành công!`}`, 5000);
        }
      } catch (err) {
        console.error("SSE Parse error:", err);
      }
    });

    es.addEventListener("error", (err) => {
      // Ẩn cảnh báo console để đỡ rối
      // console.warn("[useBookingNotifications] SSE Error:", err);
    });

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [status]);

  return {};
}
