import { api } from "../lib/api";

export type RouteProfile = "driving" | "cycling" | "walking";

export type RouteInfo = {
  distance: number;
  duration: number;
  coordinates: { latitude: number; longitude: number }[];
  alternatives?: number;
  source?: "osrm" | "haversine";
  hasNoRoute?: boolean;
  error?: string | null;
};

export const osrmApi = {
  async getRoute(
    start: { latitude: number; longitude: number },
    end: { latitude: number; longitude: number },
    profile: RouteProfile = "driving",
  ): Promise<RouteInfo> {
    const response = await api.get<RouteInfo>("/geo/route", {
      params: {
        startLat: start.latitude,
        startLng: start.longitude,
        endLat: end.latitude,
        endLng: end.longitude,
        profile,
      },
    });

    return response.data;
  },
};
