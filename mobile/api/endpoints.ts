/**
 * API Endpoints — Danh bạ 87 endpoints từ backend
 * TravelCheckinApp Mobile
 */

import axiosClient from './axiosClient';
import type {
  ApiResponse,
  LoginResponse,
  User,
  UserProfile,
  Location,
  Service,
  Review,
  Voucher,
  Ticket,
  TablePass,
  RoomPass,
  Checkin,
  Diary,
  Notification,
  SosAlert,
  LeaderboardEntry,
  BookingReminder,
  GeoSearchResult,
  GeoReverseResult,
  PosArea,
  PosTable,
  RealtimeStock,
  Payment,
  Recommendations,
  CreatedLocation,
} from '../types';

// ============================================================
// AUTH API (9 endpoints)
// ============================================================

export const authApi = {
  login: async (email: string, password: string) => {
    const { data } = await axiosClient.post<ApiResponse<LoginResponse>>(
      '/auth/login',
      { email, password }
    );
    return data;
  },

  register: async (payload: {
    email?: string;
    phone?: string;
    password: string;
    full_name: string;
  }) => {
    const { data } = await axiosClient.post<ApiResponse<null>>(
      '/auth/register',
      payload
    );
    return data;
  },

  verifyOtp: async (email: string, otp: string) => {
    const { data } = await axiosClient.post<ApiResponse<null>>(
      '/auth/verify-otp',
      { email, otp }
    );
    return data;
  },

  forgotPassword: async (email: string, phone: string) => {
    const { data } = await axiosClient.post<ApiResponse<null>>(
      '/auth/forgot-password',
      { email, phone }
    );
    return data;
  },

  verifyResetOtp: async (email: string, otp: string) => {
    const { data } = await axiosClient.post<ApiResponse<null>>(
      '/auth/verify-reset-otp',
      { email, otp }
    );
    return data;
  },

  resetPassword: async (email: string, otp: string, newPassword: string) => {
    const { data } = await axiosClient.post<ApiResponse<null>>(
      '/auth/reset-password',
      { email, otp, newPassword }
    );
    return data;
  },

  logout: async () => {
    const { data } = await axiosClient.post<ApiResponse<null>>('/auth/logout');
    return data;
  },

  refreshToken: async (refreshToken: string) => {
    const { data } = await axiosClient.post<ApiResponse<{ accessToken: string }>>(
      '/auth/refresh-token',
      { refreshToken }
    );
    return data;
  },

  getBackground: async () => {
    const { data } = await axiosClient.get<
      ApiResponse<{ source: string; image_url: string; title: string }>
    >('/auth/background');
    return data;
  },

  checkSession: async () => {
    const { data } = await axiosClient.get<ApiResponse<null>>('/auth/session');
    return data;
  },
};

// ============================================================
// USER API (20+ endpoints)
// ============================================================

export const userApi = {
  // Profile
  getProfile: async () => {
    const { data } = await axiosClient.get<ApiResponse<UserProfile>>('/user/profile');
    return data;
  },

  updateProfile: async (payload: {
    full_name: string;
    phone?: string;
    address?: string;
    username?: string;
  }) => {
    const { data } = await axiosClient.put<ApiResponse<User>>('/user/profile', payload);
    return data;
  },

  uploadAvatar: async (formData: FormData) => {
    const { data } = await axiosClient.post<ApiResponse<{ avatar_url: string }>>(
      '/user/profile/avatar',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return data;
  },

  uploadBackground: async (formData: FormData) => {
    const { data } = await axiosClient.post<ApiResponse<{ background_url: string }>>(
      '/user/profile/background',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return data;
  },

  // Check-ins
  getCheckins: async () => {
    const { data } = await axiosClient.get<ApiResponse<Checkin[]>>('/user/checkins');
    return data;
  },

  createCheckin: async (payload: {
    location_id?: number;
    checkin_latitude?: number;
    checkin_longitude?: number;
    notes?: string;
    action?: 'checkin' | 'save';
    location_name?: string;
    location_address?: string;
    location_type?: string;
  }) => {
    const { data } = await axiosClient.post<
      ApiResponse<{
        checkin_id: number;
        location_id: number;
        action: string;
        safety_warning?: boolean;
        safety_message?: string;
      }>
    >('/user/checkins', payload);
    return data;
  },

  createCheckinPhoto: async (formData: FormData) => {
    const { data } = await axiosClient.post<
      ApiResponse<{ checkin_id: number; location_id: number; image_url: string }>
    >('/user/checkins/photo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  deleteCheckin: async (id: number) => {
    const { data } = await axiosClient.delete<ApiResponse<null>>(`/user/checkins/${id}`);
    return data;
  },

  // Favorites
  getFavorites: async () => {
    const { data } = await axiosClient.get<
      ApiResponse<
        Array<{
          location_id: number;
          added_at: string;
          note?: string;
          tags?: string[];
          location_name: string;
          address: string;
          location_type: string;
          first_image: string | null;
          status: string;
        }>
      >
    >('/user/favorites');
    return data;
  },

  saveFavorite: async (locationId: number, payload?: { note?: string; tags?: string[] }) => {
    const { data } = await axiosClient.patch<ApiResponse<null>>(
      `/user/favorites/${locationId}`,
      payload || {}
    );
    return data;
  },

  removeFavorite: async (locationId: number) => {
    const { data } = await axiosClient.delete<ApiResponse<null>>(
      `/user/favorites/${locationId}`
    );
    return data;
  },

  // Recommendations
  getRecommendations: async (limit?: number) => {
    const { data } = await axiosClient.get<ApiResponse<Recommendations>>(
      '/user/recommendations/locations',
      { params: { limit } }
    );
    return data;
  },

  // Created Locations
  getCreatedLocations: async () => {
    const { data } = await axiosClient.get<ApiResponse<CreatedLocation[]>>(
      '/user/created-locations'
    );
    return data;
  },

  updateCreatedLocation: async (id: number, payload: Partial<CreatedLocation>) => {
    const { data } = await axiosClient.patch<ApiResponse<CreatedLocation>>(
      `/user/created-locations/${id}`,
      payload
    );
    return data;
  },

  deleteCreatedLocation: async (id: number) => {
    const { data } = await axiosClient.delete<ApiResponse<null>>(
      `/user/created-locations/${id}`
    );
    return data;
  },

  // Vouchers
  getVouchersByLocation: async (locationId: number) => {
    const { data } = await axiosClient.get<ApiResponse<Voucher[]>>(
      `/user/vouchers/location/${locationId}`
    );
    return data;
  },

  getMySavedVouchers: async () => {
    const { data } = await axiosClient.get<ApiResponse<Voucher[]>>('/user/vouchers/saved');
    return data;
  },

  claimVoucher: async (voucherId: number) => {
    const { data } = await axiosClient.post<ApiResponse<null>>(
      `/user/vouchers/${voucherId}/claim`
    );
    return data;
  },

  // Tourist Tickets
  getTouristTickets: async (params?: { location_id?: number }) => {
    const { data } = await axiosClient.get<ApiResponse<Ticket[]>>('/user/tickets', {
      params,
    });
    return data;
  },

  // Diary
  getDiaries: async () => {
    const { data } = await axiosClient.get<ApiResponse<Diary[]>>('/user/diary');
    return data;
  },

  createDiary: async (payload: {
    location_id?: number;
    location_name?: string;
    mood?: 'happy' | 'excited' | 'neutral' | 'sad' | 'angry' | 'tired';
    notes?: string;
    images?: string[];
  }) => {
    const { data } = await axiosClient.post<ApiResponse<{ diary_id: number }>>(
      '/user/diary',
      payload
    );
    return data;
  },

  deleteDiary: async (id: number) => {
    const { data } = await axiosClient.delete<ApiResponse<null>>(`/user/diary/${id}`);
    return data;
  },

  // Reviews
  uploadReviewImage: async (formData: FormData) => {
    const { data } = await axiosClient.post<ApiResponse<{ image_url: string }>>(
      '/user/reviews/upload',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return data;
  },

  createReview: async (payload: {
    location_id: number;
    rating: number;
    comment?: string;
    images?: string[];
  }) => {
    const { data } = await axiosClient.post<
      ApiResponse<{ review_id: number; rating: number; total_reviews: number }>
    >('/user/reviews', payload);
    return data;
  },

  deleteReview: async (id: number) => {
    const { data } = await axiosClient.delete<ApiResponse<null>>(`/user/reviews/${id}`);
    return data;
  },

  replyToReview: async (reviewId: number, payload: { content: string; images?: string[] }) => {
    const { data } = await axiosClient.post<ApiResponse<null>>(
      `/user/reviews/${reviewId}/reply`,
      payload
    );
    return data;
  },

  // Reports
  reportLocation: async (payload: {
    location_id: number;
    description: string;
    report_type?: 'spam' | 'inappropriate' | 'fraud' | 'other';
    severity?: 'low' | 'medium' | 'high' | 'critical';
  }) => {
    const { data } = await axiosClient.post<ApiResponse<null>>('/user/reports/location', payload);
    return data;
  },

  // Booking Reminders
  getBookingReminders: async () => {
    const { data } = await axiosClient.get<ApiResponse<BookingReminder[]>>(
      '/user/booking-reminders'
    );
    return data;
  },

  // Notifications
  getNotifications: async () => {
    const { data } = await axiosClient.get<ApiResponse<Notification[]>>('/user/notifications');
    return data;
  },

  markAllNotificationsRead: async () => {
    const { data } = await axiosClient.post<ApiResponse<null>>('/user/notifications/read-all');
    return data;
  },

  deleteAllNotifications: async () => {
    const { data } = await axiosClient.post<ApiResponse<null>>('/user/notifications/delete-all');
    return data;
  },

  // Leaderboard
  getLeaderboard: async (params?: { province?: string; month?: string }) => {
    const { data } = await axiosClient.get<
      ApiResponse<LeaderboardEntry[]> & { meta: { month: string; province: string | null } }
    >('/user/leaderboard', { params });
    return data;
  },

  // Itineraries (Lịch trình)
  getItineraries: async () => {
    const { data } = await axiosClient.get<ApiResponse<any[]>>('/user/itineraries');
    return data;
  },

  getItineraryDetail: async (itineraryId: number) => {
    const { data } = await axiosClient.get<ApiResponse<any>>(`/user/itineraries/${itineraryId}`);
    return data;
  },

  createItinerary: async (payload: {
    title: string;
    description?: string;
    start_date: string;
    end_date: string;
    items?: any[];
  }) => {
    const { data } = await axiosClient.post<ApiResponse<any>>('/user/itineraries', payload);
    return data;
  },

  updateItinerary: async (
    itineraryId: number,
    payload: {
      title: string;
      description?: string;
      start_date: string;
      end_date: string;
      items?: any[];
    }
  ) => {
    const { data } = await axiosClient.put<ApiResponse<any>>(
      `/user/itineraries/${itineraryId}`,
      payload
    );
    return data;
  },

  deleteItinerary: async (itineraryId: number) => {
    const { data } = await axiosClient.delete<ApiResponse<null>>(
      `/user/itineraries/${itineraryId}`
    );
    return data;
  },

  toggleItemVisited: async (itineraryId: number, itemId: number) => {
    const { data } = await axiosClient.patch<ApiResponse<{ item_id: number; visited_at: string | null }>>(
      `/user/itineraries/${itineraryId}/items/${itemId}/visit`
    );
    return data;
  },
};

// ============================================================
// LOCATION API (8 endpoints)
// ============================================================

export const locationApi = {
  getLocations: async (params?: {
    type?: string;
    keyword?: string;
    province?: string;
    source?: string;
  }) => {
    const { data } = await axiosClient.get<ApiResponse<Location[]>>('/locations', {
      params,
    });
    return data;
  },

  getLocationById: async (id: number) => {
    const { data } = await axiosClient.get<ApiResponse<Location>>(`/locations/${id}`);
    return data;
  },

  getLocationServices: async (id: number, type?: string) => {
    const { data } = await axiosClient.get<ApiResponse<Service[]>>(
      `/locations/${id}/services`,
      { params: { type } }
    );
    return data;
  },

  getLocationReviews: async (id: number) => {
    const { data } = await axiosClient.get<ApiResponse<Review[]>>(
      `/locations/${id}/reviews`
    );
    return data;
  },

  getLocationPosAreas: async (id: number) => {
    const { data } = await axiosClient.get<ApiResponse<PosArea[]>>(
      `/locations/${id}/pos/areas`
    );
    return data;
  },

  getLocationPosTables: async (
    id: number,
    params?: { area_id?: number; check_in_date?: string }
  ) => {
    const { data } = await axiosClient.get<ApiResponse<PosTable[]>>(
      `/locations/${id}/pos/tables`,
      { params }
    );
    return data;
  },

  getRealtimeStock: async (id: number) => {
    const { data } = await axiosClient.get<ApiResponse<RealtimeStock[]>>(
      `/locations/${id}/tickets/realtime-stock`
    );
    return data;
  },
};

// ============================================================
// BOOKING API (15 endpoints)
// ============================================================

export const bookingApi = {
  createBooking: async (payload: {
    location_id: number;
    service_id?: number;
    check_in_date: string;
    check_out_date?: string;
    quantity?: number;
    source?: 'web' | 'mobile' | 'admin';
    contact_name?: string;
    contact_phone?: string;
    notes?: string;
    voucher_code?: string;
    reserve_on_confirm?: boolean;
    table_ids?: number[];
    preorder_items?: Array<{ service_id: number; quantity: number }>;
    ticket_items?: Array<{ service_id: number; quantity: number }>;
  }) => {
    const { data } = await axiosClient.post<
      ApiResponse<{
        bookingId: number;
        payment?: Payment;
        tickets?: Ticket[];
      }>
    >('/bookings', payload);
    return data;
  },

  createBookingBatch: async (payload: {
    location_id: number;
    service_ids: number[];
    check_in_date: string;
    check_out_date?: string;
    source?: 'web' | 'mobile' | 'admin';
    notes?: string;
    reserve_on_confirm?: boolean;
    voucher_code?: string;
  }) => {
    const { data } = await axiosClient.post<
      ApiResponse<{
        bookingIds: number[];
        bookings: Booking[];
      }>
    >('/bookings/batch', payload);
    return data;
  },

  getMyTableReservations: async (locationId?: number) => {
    const { data } = await axiosClient.get<ApiResponse<TablePass[]>>(
      '/bookings/table-reservations/mine',
      { params: { location_id: locationId } }
    );
    return data;
  },

  getTablePass: async (locationId?: number) => {
    const { data } = await axiosClient.get<ApiResponse<TablePass[]>>(
      '/bookings/table-reservations/pass',
      { params: { location_id: locationId } }
    );
    return data;
  },

  getRoomPass: async (locationId?: number) => {
    const { data } = await axiosClient.get<ApiResponse<RoomPass[]>>(
      '/bookings/room-reservations/pass',
      { params: { location_id: locationId } }
    );
    return data;
  },

  createPaymentForBooking: async (bookingId: number) => {
    const { data } = await axiosClient.post<ApiResponse<Payment>>(
      `/bookings/${bookingId}/payments`
    );
    return data;
  },

  createPaymentForBatch: async (bookingIds: number[]) => {
    const { data } = await axiosClient.post<ApiResponse<Payment>>('/bookings/batch/payments', {
      booking_ids: bookingIds,
    });
    return data;
  },

  confirmTicketTransfer: async (bookingId: number) => {
    const { data } = await axiosClient.post<ApiResponse<null>>(
      `/bookings/${bookingId}/tickets/confirm-transfer`
    );
    return data;
  },

  confirmTableTransfer: async (bookingId: number) => {
    const { data } = await axiosClient.post<ApiResponse<null>>(
      `/bookings/${bookingId}/tables/confirm-transfer`
    );
    return data;
  },

  confirmRoomTransfer: async (bookingId: number) => {
    const { data } = await axiosClient.post<ApiResponse<null>>(
      `/bookings/${bookingId}/rooms/confirm-transfer`
    );
    return data;
  },

  confirmRoomBatchTransfer: async (paymentId: number) => {
    const { data } = await axiosClient.post<ApiResponse<null>>(
      '/bookings/batch/rooms/confirm-transfer',
      { payment_id: paymentId }
    );
    return data;
  },

  cancelBooking: async (bookingId: number) => {
    const { data } = await axiosClient.post<ApiResponse<null>>(
      `/bookings/${bookingId}/cancel`
    );
    return data;
  },

  cancelTableBooking: async (bookingId: number) => {
    const { data } = await axiosClient.post<ApiResponse<null>>(
      `/bookings/${bookingId}/tables/cancel`
    );
    return data;
  },

  updateBatchContact: async (
    bookingIds: number[],
    contactName?: string,
    contactPhone?: string
  ) => {
    const { data } = await axiosClient.put<ApiResponse<null>>('/bookings/batch/contact', {
      booking_ids: bookingIds,
      contact_name: contactName,
      contact_phone: contactPhone,
    });
    return data;
  },

  preorderItems: async (
    bookingId: number,
    items: Array<{ service_id: number; quantity: number }>
  ) => {
    const { data } = await axiosClient.post<ApiResponse<null>>(
      `/bookings/${bookingId}/tables/preorder`,
      { preorder_items: items }
    );
    return data;
  },
};

// ============================================================
// SOS API (3 endpoints)
// ============================================================

export const sosApi = {
  sendSos: async (payload: {
    latitude: number;
    longitude: number;
    location_text?: string;
    message?: string;
  }) => {
    const { data } = await axiosClient.post<ApiResponse<{ alert_id: number }>>('/sos', payload);
    return data;
  },

  pingSos: async (payload: {
    latitude: number;
    longitude: number;
    location_text?: string;
    message?: string;
    alert_id?: number;
  }) => {
    const { data } = await axiosClient.post<ApiResponse<{ alert_id: number }>>(
      '/sos/ping',
      payload
    );
    return data;
  },

  stopSos: async (alertId?: number) => {
    const { data } = await axiosClient.post<ApiResponse<{ alert_id?: number }>>('/sos/stop', {
      alert_id: alertId,
    });
    return data;
  },
};

// ============================================================
// GEO API (2 endpoints)
// ============================================================

export const geoApi = {
  search: async (query: string, limit?: number) => {
    const { data } = await axiosClient.get<GeoSearchResult[]>('/geo/search', {
      params: { q: query, limit: limit || 6 },
    });
    return data;
  },

  reverse: async (lat: number, lng: number) => {
    const { data } = await axiosClient.get<GeoReverseResult>('/geo/reverse', {
      params: { lat, lng },
    });
    return data;
  },
};

// ============================================================
// PUSH API (2 endpoints)
// ============================================================

export const pushApi = {
  registerDevice: async (payload: {
    token: string;
    platform: 'android' | 'ios';
    device_id: string;
    device_info?: string;
  }) => {
    const { data } = await axiosClient.post<
      ApiResponse<{ platform: string; device_id: string; topics: string[] }>
    >('/push/device-tokens', payload);
    return data;
  },

  unregisterDevice: async (deviceId: string, token?: string) => {
    const { data } = await axiosClient.delete<ApiResponse<{ device_id: string }>>(
      `/push/device-tokens/${deviceId}`,
      { data: { token } }
    );
    return data;
  },
};

// ============================================================
// CHAT API (2 endpoints)
// ============================================================

export const chatApi = {
  getMessages: async (locationId: number) => {
    const { data } = await axiosClient.get<
      ApiResponse<
        Array<{
          message_id: number;
          location_id: number;
          sender_id: number;
          sender_name: string;
          sender_role: string;
          content: string;
          created_at: string;
        }>
      >
    >(`/chat/location/${locationId}`);
    return data;
  },

  sendMessage: async (locationId: number, content: string) => {
    const { data } = await axiosClient.post<
      ApiResponse<{
        message_id: number;
        location_id: number;
        sender_id: number;
        sender_name: string;
        sender_role: string;
        content: string;
        created_at: string;
      }>
    >(`/chat/location/${locationId}`, { content });
    return data;
  },
};

// ============================================================
// IMPORT TYPE (used in bookingApi)
// ============================================================

import type { Booking } from '../types';
