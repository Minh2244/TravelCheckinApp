import axiosClient from "./axiosClient";
import type {
  LocationDetailResponse,
  LocationListResponse,
  LocationReview,
} from "../types/location.types";

export interface LocationQueryParams {
  type?: string;
  keyword?: string;
  province?: string;
  source?: string;
}

export interface LocationServicesQueryParams {
  type?: string;
}

const locationApi = {
  getLocations: async (params?: LocationQueryParams) => {
    const response = await axiosClient.get<LocationListResponse>("/locations", {
      params,
    });
    return response.data;
  },
  getLocationById: async (id: number, source?: string) => {
    const response = await axiosClient.get<LocationDetailResponse>(
      `/locations/${id}`,
      {
        params: source ? { source } : undefined,
      },
    );
    return response.data;
  },

  getLocationServices: async (
    id: number,
    params?: LocationServicesQueryParams,
  ) => {
    const response = await axiosClient.get<{
      success: boolean;
      data: unknown[];
    }>(`/locations/${id}/services`, { params });
    return response.data;
  },

  getLocationPosAreas: async (id: number) => {
    const response = await axiosClient.get<{
      success: boolean;
      data: unknown[];
    }>(`/locations/${id}/pos/areas`);
    return response.data;
  },

  getLocationPosTables: async (
    id: number,
    params?: { area_id?: string; check_in_date?: string },
  ) => {
    const response = await axiosClient.get<{
      success: boolean;
      data: unknown[];
    }>(`/locations/${id}/pos/tables`, { params });
    return response.data;
  },

  getLocationReviews: async (id: number) => {
    const response = await axiosClient.get<{
      success: boolean;
      data: LocationReview[];
    }>(`/locations/${id}/reviews`);
    return response.data;
  },
};

export default locationApi;
