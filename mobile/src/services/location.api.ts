import { api } from "../lib/api";
import type { LocationItem } from "../types/location";

type LocationListResponse = {
  success: boolean;
  message?: string;
  count?: number;
  data: LocationItem[];
};

export type LocationQueryParams = {
  source?: "mobile";
};

export const locationApi = {
  async getLocations(params: LocationQueryParams = { source: "mobile" }) {
    const response = await api.get<LocationListResponse>("/locations", { params });
    return response.data;
  },
};
