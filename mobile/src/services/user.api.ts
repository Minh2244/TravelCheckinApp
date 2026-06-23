import { api } from "../lib/api";
import type { LocationItem } from "../types/location";

type ApiResponse<T> = {
  success: boolean;
  message?: string;
  data: T;
};

export const userApi = {
  async getCheckins() {
    const response = await api.get<ApiResponse<unknown[]>>("/user/checkins");
    return response.data;
  },
  async getFavorites() {
    const response = await api.get<ApiResponse<LocationItem[]>>("/user/favorites");
    return response.data;
  },
  async getMySavedVouchers() {
    const response = await api.get<ApiResponse<unknown[]>>("/user/vouchers/saved");
    return response.data;
  },
  async toggleFavorite(locationId: string | number, isFavorite: boolean) {
    if (isFavorite) {
      const response = await api.patch<ApiResponse<unknown>>(`/user/favorites/${locationId}`);
      return response.data;
    } else {
      const response = await api.delete<ApiResponse<unknown>>(`/user/favorites/${locationId}`);
      return response.data;
    }
  },
  async createReview(data: { location_id: string | number; rating: number; review_text: string }) {
    const response = await api.post<ApiResponse<unknown>>("/user/reviews", data);
    return response.data;
  },
};
