import { api } from "../lib/api";
import type {
  LocationItem,
  LocationPosArea,
  LocationPosTable,
  LocationReview,
  LocationServiceItem,
} from "../types/location";

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
  async getLocationById(id: string | number) {
    const response = await api.get<{ success: boolean; data: LocationItem }>(
      `/locations/${id}`,
      { params: { source: "mobile" } },
    );
    return response.data;
  },
  async getServices(id: string | number, params?: { type?: string }) {
    const response = await api.get<{
      success: boolean;
      data: LocationServiceItem[];
    }>(`/locations/${id}/services`, { params });
    return response.data;
  },
  async getPosAreas(id: string | number) {
    const response = await api.get<{
      success: boolean;
      data: LocationPosArea[];
    }>(`/locations/${id}/pos/areas`);
    return response.data;
  },
  async getPosTables(
    id: string | number,
    params?: { area_id?: string; check_in_date?: string },
  ) {
    const response = await api.get<{
      success: boolean;
      data: LocationPosTable[];
    }>(`/locations/${id}/pos/tables`, { params });
    return response.data;
  },
  async getReviews(id: string | number) {
    const response = await api.get<{
      success: boolean;
      data: LocationReview[];
    }>(`/locations/${id}/reviews`);
    return response.data;
  },
};
