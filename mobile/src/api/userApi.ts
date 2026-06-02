// User API calls
import axiosClient from './axiosClient';
import type { User, FavoriteLocation, Voucher, Checkin } from '../types';

export interface UpdateProfileParams {
  full_name?: string;
  phone?: string;
  avatar_url?: string;
  skip_avatar?: boolean;
}

export interface CreateReviewParams {
  location_id: number;
  rating: number;
  comment?: string;
  images?: string[];
}

export interface CreateCheckinParams {
  location_id: number;
  checkin_latitude: number;
  checkin_longitude: number;
  notes?: string;
}

const userApi = {
  // Profile
  getProfile: () => axiosClient.get<User>('/user/profile'),

  updateProfile: (params: UpdateProfileParams) =>
    axiosClient.put<User>('/user/profile', params),

  uploadAvatar: (file: FormData) =>
    axiosClient.post<{ avatar_url: string }>('/user/profile/avatar', file, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  // Favorites
  getFavorites: () =>
    axiosClient.get<FavoriteLocation[]>('/user/favorites'),

  saveFavorite: (locationId: number) =>
    axiosClient.patch(`/user/favorites/${locationId}`),

  removeFavorite: (locationId: number) =>
    axiosClient.delete(`/user/favorites/${locationId}`),

  // Vouchers
  getMySavedVouchers: () =>
    axiosClient.get<Voucher[]>('/user/vouchers/saved'),

  getVouchersByLocation: (locationId: number) =>
    axiosClient.get<Voucher[]>(`/user/vouchers/location/${locationId}`),

  claimVoucher: (voucherId: number) =>
    axiosClient.post(`/user/vouchers/${voucherId}/claim`),

  // Checkins
  getCheckins: () => axiosClient.get<Checkin[]>('/user/checkins'),

  createCheckin: (params: CreateCheckinParams) =>
    axiosClient.post('/user/checkins', params),

  deleteCheckin: (checkinId: number) =>
    axiosClient.delete(`/user/checkins/${checkinId}`),

  // Reviews
  createReview: (params: CreateReviewParams) =>
    axiosClient.post('/user/reviews', params),

  uploadReviewImage: (file: FormData) =>
    axiosClient.post<{ url: string }>('/user/reviews/upload', file, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  deleteReview: (reviewId: number) =>
    axiosClient.delete(`/user/reviews/${reviewId}`),

  // Recommendations
  getRecommendations: (limit: number = 12) =>
    axiosClient.get<{
      favorites: unknown[];
      recent: unknown[];
      recommended: unknown[];
    }>('/user/recommendations/locations', { params: { limit } }),

  // Reports
  reportLocationIssue: (params: {
    location_id: number;
    description: string;
    report_type?: string;
    severity?: string;
  }) => axiosClient.post('/user/reports/location', params),
};

export default userApi;
