// Location API calls
import axiosClient from './axiosClient';
import type { Location, LocationService, Review } from '../types';

export interface GetLocationsParams {
  type?: string;
  keyword?: string;
  source?: string;
  page?: number;
  limit?: number;
}

const locationApi = {
  // Lấy danh sách địa điểm
  getLocations: (params?: GetLocationsParams) =>
    axiosClient.get<{ locations: Location[]; total: number }>('/locations', { params }),

  // Lấy chi tiết địa điểm
  getLocationById: (id: number) =>
    axiosClient.get<Location>(`/locations/${id}`, { params: { source: 'mobile' } }),

  // Lấy dịch vụ của địa điểm
  getLocationServices: (id: number, type?: string) =>
    axiosClient.get<LocationService[]>(`/locations/${id}/services`, {
      params: type ? { type } : undefined,
    }),

  // Lấy đánh giá của địa điểm
  getLocationReviews: (id: number) =>
    axiosClient.get<Review[]>(`/locations/${id}/reviews`),

  // Tìm kiếm địa điểm
  searchLocations: (keyword: string) =>
    axiosClient.get<{ locations: Location[] }>('/locations/search', {
      params: { keyword },
    }),
};

export default locationApi;
