import { api } from "../lib/api";

export type GeoReverseResponse = {
  city: string;
  temperature?: number;
  weather?: string;
  raw_nominatim?: unknown;
};

export const geoApi = {
  async reverse(lat: number, lng: number) {
    const response = await api.get<GeoReverseResponse>("/geo/reverse", {
      params: { lat, lng },
    });
    return response.data;
  },
};
