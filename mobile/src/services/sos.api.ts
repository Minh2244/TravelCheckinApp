import { api } from "../lib/api";

type ApiResponse<T> = {
  success: boolean;
  message?: string;
  data: T;
};

export type SosAlertResponse = {
  alert_id: number;
};

export const sosApi = {
  async triggerSos(latitude: number, longitude: number, locationText?: string, message?: string) {
    const response = await api.post<ApiResponse<SosAlertResponse>>("/sos", {
      latitude,
      longitude,
      location_text: locationText || null,
      message: message || "Yêu cầu hỗ trợ khẩn cấp!",
    });
    return response.data;
  },

  async pingSos(alertId: number | null, latitude: number, longitude: number, locationText?: string, message?: string) {
    const response = await api.post<ApiResponse<SosAlertResponse>>("/sos/ping", {
      alert_id: alertId,
      latitude,
      longitude,
      location_text: locationText || null,
      message: message || "SOS ping",
    });
    return response.data;
  },

  async stopSos(alertId?: number) {
    const response = await api.post<ApiResponse<unknown>>("/sos/stop", {
      alert_id: alertId || null,
    });
    return response.data;
  },
};
