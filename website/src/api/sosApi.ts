import axiosClient from "./axiosClient";
import type { SosResponse } from "../types/user.types";

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface SosPayload {
  latitude: number;
  longitude: number;
  location_text?: string | null;
  message?: string | null;
  alert_id?: number | null;
}

const sosApi = {
  sendSos: async (payload: SosPayload) => {
    const response = await axiosClient.post<ApiResponse<SosResponse>>(
      "/sos",
      payload,
    );
    return response.data;
  },
  pingSos: async (payload: SosPayload) => {
    const response = await axiosClient.post<ApiResponse<SosResponse>>(
      "/sos/ping",
      payload,
    );
    return response.data;
  },
  stopSos: async (payload?: { alert_id?: number | null }) => {
    const response = await axiosClient.post<ApiResponse<SosResponse | null>>(
      "/sos/stop",
      payload || {},
    );
    return response.data;
  },
};

export default sosApi;
