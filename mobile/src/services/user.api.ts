import { api } from "../lib/api";
import type { LocationItem } from "../types/location";

type ApiResponse<T> = {
  success: boolean;
  message?: string;
  data: T;
};

export type LocationVoucher = {
  voucher_id: number;
  code?: string | null;
  campaign_name?: string | null;
  campaign_description?: string | null;
  discount_type?: "percent" | "percentage" | "amount" | string | null;
  discount_value?: number | string | null;
  min_order_value?: number | string | null;
  max_discount_amount?: number | string | null;
  start_date?: string | null;
  end_date?: string | null;
  apply_to_service_type?: string | null;
  apply_to_location_type?: string | null;
  location_id?: number | string | null;
  location_ids?: Array<number | string> | string | null;
  location_name?: string | null;
  location_names?: string[] | string | null;
  usage_limit?: number | string | null;
  remaining?: number | string | null;
  max_uses_per_user?: number | string | null;
  user_used_count?: number | string | null;
  is_claimed?: boolean | 0 | 1;
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
  async getVouchersByLocation(locationId: string | number) {
    const response = await api.get<ApiResponse<LocationVoucher[]>>(
      `/user/vouchers/location/${locationId}`,
    );
    return response.data;
  },
  async claimVoucher(voucherId: string | number) {
    const response = await api.post<ApiResponse<unknown>>(
      `/user/vouchers/${voucherId}/claim`,
    );
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
  async createReview(data: {
    location_id: string | number;
    rating: number;
    comment: string;
  }) {
    const response = await api.post<ApiResponse<unknown>>("/user/reviews", data);
    return response.data;
  },
};
