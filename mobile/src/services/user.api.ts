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
  pool_remaining?: number | string | null;
  is_exhausted?: boolean | 0 | 1;
  max_uses_per_user?: number | string | null;
  user_used_count?: number | string | null;
  user_claimed_count?: number | string | null;
  user_remaining_uses?: number | string | null;
  is_claimed?: boolean | 0 | 1;
  claimed_count?: number | string | null;
};

export type CreateCheckinPayload = {
  location_id?: number | null;
  checkin_latitude?: number | null;
  checkin_longitude?: number | null;
  notes?: string | null;
  action?: "checkin" | "save";
  location_name?: string | null;
  location_address?: string | null;
  location_type?: "hotel" | "restaurant" | "tourist" | "cafe" | "resort" | "other";
};

export type DiaryPayload = {
  location_id: number;
  location_name?: string | null;
  notes: string;
  mood: "happy" | "excited" | "neutral" | "sad" | "angry" | "tired";
  images?: string[];
};

function appendImage(formData: FormData, fieldName: string, uri: string, fallbackName: string) {
  const filename = uri.split("/").pop() || fallbackName;
  const extension = filename.split(".").pop()?.toLowerCase();
  const mimeType =
    extension === "png"
      ? "image/png"
      : extension === "webp"
        ? "image/webp"
        : "image/jpeg";

  formData.append(fieldName, {
    uri,
    name: filename,
    type: mimeType,
  } as unknown as Blob);
}

export const userApi = {
  async getCheckins() {
    const response = await api.get<ApiResponse<unknown[]>>("/user/checkins");
    return response.data;
  },
  async createCheckin(payload: CreateCheckinPayload) {
    const response = await api.post<
      ApiResponse<{
        action?: "checkin" | "save";
        checkin_id?: number;
        location_id?: number;
        location_name?: string | null;
      }>
    >("/user/checkins", payload);
    return response.data;
  },
  async getFavorites() {
    const response = await api.get<ApiResponse<LocationItem[]>>("/user/favorites");
    return response.data;
  },
  async getMyCreatedLocations() {
    const response = await api.get<ApiResponse<LocationItem[]>>("/user/created-locations");
    return response.data;
  },
  async updateMyCreatedLocation(
    locationId: string | number,
    payload: Partial<Pick<
      LocationItem,
      "location_name" | "location_type" | "address" | "description" | "province" | "latitude" | "longitude" | "status"
    >>,
  ) {
    const response = await api.patch<ApiResponse<LocationItem>>(
      `/user/created-locations/${locationId}`,
      payload,
    );
    return response.data;
  },
  async uploadMyCreatedLocationCover(locationId: string | number, uri: string) {
    const formData = new FormData();
    appendImage(formData, "image", uri, `private-location-cover-${Date.now()}.jpg`);

    const response = await api.post<ApiResponse<{ image_url: string }>>(
      `/user/created-locations/${locationId}/cover`,
      formData,
    );
    return response.data;
  },
  async deleteMyCreatedLocation(locationId: string | number) {
    const response = await api.delete<ApiResponse<null>>(
      `/user/created-locations/${locationId}`,
    );
    return response.data;
  },
  async getMySavedVouchers() {
    const response = await api.get<ApiResponse<unknown[]>>("/user/vouchers/saved");
    return response.data;
  },
  async getUsableVouchersByLocation(locationId: string | number) {
    const response = await api.get<ApiResponse<LocationVoucher[]>>(
      `/user/vouchers/usable/${locationId}`,
    );
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
      const response = await api.patch<ApiResponse<unknown>>(
        `/user/favorites/${locationId}`,
        {}
      );
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
    images?: string[];
  }) {
    const response = await api.post<ApiResponse<unknown>>("/user/reviews", data);
    return response.data;
  },
  async uploadReviewImage(uri: string) {
    const formData = new FormData();
    appendImage(formData, "image", uri, `review-${Date.now()}.jpg`);

    const response = await api.post<ApiResponse<{ image_url: string }>>(
      "/user/reviews/upload",
      formData,
    );
    return response.data;
  },
  async getProfile() {
    const response = await api.get<ApiResponse<any>>("/user/profile");
    return response.data;
  },
  async updateProfile(data: {
    full_name: string;
    phone?: string | null;
    address?: string | null;
    skip_avatar?: boolean;
    avatar_url?: string | null;
  }) {
    const response = await api.put<ApiResponse<any>>("/user/profile", data);
    return response.data;
  },
  async uploadAvatar(uri: string) {
    const formData = new FormData();
    appendImage(formData, "avatar", uri, `avatar-${Date.now()}.jpg`);

    const response = await api.post<ApiResponse<{ avatar_url: string }>>(
      "/user/profile/avatar",
      formData,
    );
    return response.data;
  },
  async getTouristTickets() {
    const response = await api.get<ApiResponse<any>>("/user/tickets");
    return response.data;
  },
  async getDiaries(params?: { locationId?: string | number }) {
    const response = await api.get<ApiResponse<any[]>>("/user/diary", { params });
    return response.data;
  },
  async uploadDiaryImage(uri: string) {
    const formData = new FormData();
    appendImage(formData, "image", uri, `diary-${Date.now()}.jpg`);

    const response = await api.post<ApiResponse<{ image_url: string }>>(
      "/user/diary/upload",
      formData,
    );
    return response.data;
  },
  async createDiary(data: DiaryPayload) {
    const response = await api.post<ApiResponse<any>>("/user/diary", data);
    return response.data;
  },
  async deleteDiary(id: number) {
    const response = await api.delete<ApiResponse<any>>(`/user/diary/${id}`);
    return response.data;
  },
  async getBookingReminders() {
    const response = await api.get<ApiResponse<any[]>>("/user/booking-reminders");
    return response.data;
  },
  async getNotifications() {
    const response = await api.get<ApiResponse<any[]>>("/user/notifications");
    return response.data;
  },
  async markNotificationsRead() {
    const response = await api.post<ApiResponse<any>>("/user/notifications/read-all");
    return response.data;
  },
  async deleteNotificationsAll() {
    const response = await api.post<ApiResponse<any>>("/user/notifications/delete-all");
    return response.data;
  },
  async getLeaderboard() {
    const response = await api.get<ApiResponse<any>>("/user/leaderboard");
    return response.data;
  },
};
