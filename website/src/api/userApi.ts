import axiosClient from "./axiosClient";
import type {
  CheckinItem,
  DiaryItem,
  GroupCheckinItem,
  GroupInfo,
  LeaderboardRow,
  BookingReminderItem,
  ItineraryItem,
  PaginationMeta,
  UserLoginHistoryItem,
  UserNotificationItem,
  UserProfile,
  VoucherItem,
  UserTouristTicketItem,
} from "../types/user.types";
import type {
  Location,
  LocationStatus,
  LocationType,
} from "../types/location.types";

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

interface ApiListResponse<T> extends ApiResponse<T> {
  pagination?: PaginationMeta;
}

interface ApiMetaResponse<T> extends ApiResponse<T> {
  meta?: Record<string, unknown>;
}

export interface CreateDiaryPayload {
  location_id?: number | null;
  mood?: "happy" | "excited" | "neutral" | "sad" | "angry" | "tired";
  notes?: string | null;
  images?: string[] | null;
}

export interface CreateItineraryPayload {
  name: string;
  description?: string | null;
  locations?: Array<Record<string, unknown>> | null;
  total_distance_km?: number | null;
  estimated_time_hours?: number | null;
  is_ai_recommended?: boolean;
}

export interface CreateCheckinPayload {
  location_id?: number;
  checkin_latitude?: number | null;
  checkin_longitude?: number | null;
  notes?: string | null;
  action?: "checkin" | "save";
  location_name?: string | null;
  location_address?: string | null;
  location_type?:
    | "hotel"
    | "restaurant"
    | "tourist"
    | "cafe"
    | "resort"
    | "other";
}

export interface UpdateProfilePayload {
  full_name: string;
  phone?: string | null;
  avatar_url?: string | null;
  skip_avatar?: boolean;
  background_url?: string | null;
  skip_background?: boolean;
}

export interface UpdateMyCreatedLocationPayload {
  location_name?: string;
  location_type?: LocationType;
  description?: string | null;
  address?: string;
  province?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  status?: Exclude<LocationStatus, "pending">;
}

export interface CreateReviewPayload {
  location_id: number;
  rating: number;
  comment?: string | null;
  images?: string[] | null;
}

export interface LoginHistoryQuery {
  page?: number;
  limit?: number;
  success?: 0 | 1 | "0" | "1";
  from?: string;
  to?: string;
  q?: string;
}

const userApi = {
  getCheckins: async () => {
    const response =
      await axiosClient.get<ApiResponse<CheckinItem[]>>("/user/checkins");
    return response.data;
  },
  deleteCheckin: async (checkinId: number) => {
    const response = await axiosClient.delete<ApiResponse<null>>(
      `/user/checkins/${checkinId}`,
    );
    return response.data;
  },
  createCheckin: async (payload: CreateCheckinPayload) => {
    const response = await axiosClient.post<
      ApiResponse<{
        checkin_id: number;
        safety_warning?: boolean;
        safety_message?: string | null;
      }>
    >("/user/checkins", payload);
    return response.data;
  },
  getProfile: async () => {
    const response =
      await axiosClient.get<ApiResponse<UserProfile>>("/user/profile");
    return response.data;
  },
  getMyCreatedLocations: async () => {
    const response = await axiosClient.get<ApiResponse<Location[]>>(
      "/user/created-locations",
    );
    return response.data;
  },
  updateMyCreatedLocation: async (
    locationId: number,
    payload: UpdateMyCreatedLocationPayload,
  ) => {
    const response = await axiosClient.patch<ApiResponse<Location>>(
      `/user/created-locations/${locationId}`,
      payload,
    );
    return response.data;
  },
  deleteMyCreatedLocation: async (locationId: number) => {
    const response = await axiosClient.delete<ApiResponse<null>>(
      `/user/created-locations/${locationId}`,
    );
    return response.data;
  },
  updateProfile: async (payload: UpdateProfilePayload) => {
    const response = await axiosClient.put<ApiResponse<UserProfile>>(
      "/user/profile",
      payload,
    );
    return response.data;
  },
  uploadAvatar: async (file: File) => {
    const formData = new FormData();
    formData.append("avatar", file);
    const response = await axiosClient.post<
      ApiResponse<{ avatar_url: string | null }>
    >("/user/profile/avatar", formData);
    return response.data;
  },
  uploadBackground: async (file: File) => {
    const formData = new FormData();
    formData.append("background", file);
    const response = await axiosClient.post<
      ApiResponse<{ background_url: string | null }>
    >("/user/profile/background", formData);
    return response.data;
  },
  getLoginHistory: async (params: LoginHistoryQuery) => {
    const response = await axiosClient.get<
      ApiListResponse<UserLoginHistoryItem[]>
    >("/user/profile/login-history", { params });
    return response.data;
  },
  getFavorites: async () => {
    const response =
      await axiosClient.get<ApiResponse<Location[]>>("/user/favorites");
    return response.data;
  },
  saveFavorite: async (
    locationId: number,
    payload?: { note?: string | null; tags?: string | null },
  ) => {
    // Backend yêu cầu ít nhất 1 trong note/tags phải được gửi (không undefined)
    // để tránh lỗi: "Thiếu note/tags để cập nhật".
    const body = {
      note: payload?.note ?? "",
      tags: payload?.tags ?? "",
    };
    const response = await axiosClient.patch<ApiResponse<null>>(
      `/user/favorites/${locationId}`,
      body,
    );
    return response.data;
  },
  removeFavorite: async (locationId: number) => {
    const response = await axiosClient.delete<ApiResponse<null>>(
      `/user/favorites/${locationId}`,
    );
    return response.data;
  },
  getNotifications: async () => {
    const response = await axiosClient.get<ApiResponse<UserNotificationItem[]>>(
      "/user/notifications",
    );
    return response.data;
  },
  markNotificationsReadAll: async () => {
    const response = await axiosClient.post<ApiResponse<null>>(
      "/user/notifications/read-all",
    );
    return response.data;
  },
  deleteNotificationsAll: async () => {
    const response = await axiosClient.post<ApiResponse<null>>(
      "/user/notifications/delete-all",
    );
    return response.data;
  },
  sendLocationInvite: async (location_id: number) => {
    const response = await axiosClient.post<
      ApiResponse<{ notification_id: number }>
    >("/user/notifications/location-invite", { location_id });
    return response.data;
  },
  getVouchers: async () => {
    const response =
      await axiosClient.get<ApiResponse<VoucherItem[]>>("/user/vouchers");
    return response.data;
  },
  getDiaries: async () => {
    const response =
      await axiosClient.get<ApiResponse<DiaryItem[]>>("/user/diary");
    return response.data;
  },
  createDiary: async (payload: CreateDiaryPayload) => {
    const response = await axiosClient.post<ApiResponse<{ diary_id: number }>>(
      "/user/diary",
      payload,
    );
    return response.data;
  },
  getItineraries: async () => {
    const response =
      await axiosClient.get<ApiResponse<ItineraryItem[]>>("/user/itineraries");
    return response.data;
  },
  createItinerary: async (payload: CreateItineraryPayload) => {
    const response = await axiosClient.post<
      ApiResponse<{ itinerary_id: number }>
    >("/user/itineraries", payload);
    return response.data;
  },
  uploadReviewImage: async (file: File) => {
    const formData = new FormData();
    formData.append("image", file);
    const response = await axiosClient.post<ApiResponse<{ image_url: string }>>(
      "/user/reviews/upload",
      formData,
    );
    return response.data;
  },
  createReview: async (payload: CreateReviewPayload) => {
    const response = await axiosClient.post<
      ApiResponse<{ review_id: number; rating: number; total_reviews: number }>
    >("/user/reviews", payload);
    return response.data;
  },
  reportLocationIssue: async (payload: {
    location_id: number;
    description: string;
    report_type?: "spam" | "inappropriate" | "fraud" | "other";
    severity?: "low" | "medium" | "high" | "critical";
  }) => {
    const response = await axiosClient.post<
      ApiResponse<{ report_id?: number }>
    >("/user/reports/location", payload);
    return response.data;
  },
  getLeaderboard: async (params?: { province?: string; month?: string }) => {
    const response = await axiosClient.get<ApiMetaResponse<LeaderboardRow[]>>(
      "/user/leaderboard",
      { params },
    );
    return response.data;
  },
  getBookingReminders: async () => {
    const response = await axiosClient.get<ApiResponse<BookingReminderItem[]>>(
      "/user/booking-reminders",
    );
    return response.data;
  },
  getTouristTickets: async (params?: { location_id?: number }) => {
    const response = await axiosClient.get<
      ApiResponse<UserTouristTicketItem[]>
    >("/user/tickets", { params });
    return response.data;
  },
  createGroup: async () => {
    const response = await axiosClient.post<ApiResponse<GroupInfo>>(
      "/user/groups/create",
    );
    return response.data;
  },
  joinGroup: async (code: string) => {
    const response = await axiosClient.post<ApiResponse<GroupInfo>>(
      "/user/groups/join",
      { code },
    );
    return response.data;
  },
  leaveGroup: async () => {
    const response =
      await axiosClient.post<ApiResponse<null>>("/user/groups/leave");
    return response.data;
  },
  getGroupStatus: async () => {
    const response = await axiosClient.get<
      ApiResponse<{
        group: GroupInfo;
        recent_checkins: GroupCheckinItem[];
      } | null>
    >("/user/groups");
    return response.data;
  },
};

export default userApi;
