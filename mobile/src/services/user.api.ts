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
};
