// api/endpoints.ts
// Tap trung tat ca API endpoint de tranh hardcode rai rac

export const AUTH_API = {
  LOGIN: '/auth/login',
  REGISTER: '/auth/register',
  VERIFY_OTP: '/auth/verify-otp',
  FORGOT_PASSWORD: '/auth/forgot-password',
  VERIFY_RESET_OTP: '/auth/verify-reset-otp',
  RESET_PASSWORD: '/auth/reset-password',
  REFRESH_TOKEN: '/auth/refresh-token',
  LOGOUT: '/auth/logout',
  GOOGLE_MOBILE: '/auth/google/mobile',
  FACEBOOK_MOBILE: '/auth/facebook/mobile',
} as const;

export const USER_API = {
  PROFILE: '/user/profile',
  PROFILE_AVATAR: '/user/profile/avatar',
  PROFILE_BACKGROUND: '/user/profile/background',
  LOGIN_HISTORY: '/user/profile/login-history',
  CHECKINS: '/user/checkins',
  CHECKINS_PHOTO: '/user/checkins/photo',
  FAVORITES: '/user/favorites',
  RECOMMENDATIONS: '/user/recommendations/locations',
  REVIEWS: '/user/reviews',
  REVIEWS_UPLOAD: '/user/reviews/upload',
  VOUCHERS_LOCATION: (id: number) => `/user/vouchers/location/${id}`,
  VOUCHERS_SAVED: '/user/vouchers/saved',
  VOUCHERS_CLAIM: (id: number) => `/user/vouchers/${id}/claim`,
  DIARY: '/user/diary',
  DIARY_DELETE: (id: number) => `/user/diary/${id}`,
  TICKETS: '/user/tickets',
  NOTIFICATIONS: '/user/notifications',
  NOTIFICATIONS_READ_ALL: '/user/notifications/read-all',
  NOTIFICATIONS_DELETE_ALL: '/user/notifications/delete-all',
  BOOKING_REMINDERS: '/user/booking-reminders',
  LEADERBOARD: '/user/leaderboard',
} as const;

export const LOCATIONS_API = {
  LIST: '/locations',
  SEARCH: '/locations/search',
  DETAIL: (id: number) => `/locations/${id}`,
  SERVICES: (id: number) => `/locations/${id}/services`,
  REVIEWS: (id: number) => `/locations/${id}/reviews`,
  TABLE_AREAS: (id: number) => `/locations/${id}/pos/areas`,
  TABLES: (id: number) => `/locations/${id}/pos/tables`,
  TICKET_STOCK: (id: number) => `/locations/${id}/tickets/realtime-stock`,
} as const;

export const BOOKINGS_API = {
  CREATE: '/bookings',
  BATCH: '/bookings/batch',
  PAYMENT: (id: number) => `/bookings/${id}/payments`,
  CONFIRM_TICKETS: (id: number) => `/bookings/${id}/tickets/confirm-transfer`,
  CONFIRM_TABLES: (id: number) => `/bookings/${id}/tables/confirm-transfer`,
  CONFIRM_ROOMS: (id: number) => `/bookings/${id}/rooms/confirm-transfer`,
  CANCEL: (id: number) => `/bookings/${id}/cancel`,
  CANCEL_TABLES: (id: number) => `/bookings/${id}/tables/cancel`,
  PREORDER: (id: number) => `/bookings/${id}/tables/preorder`,
  TABLE_RESERVATIONS_PASS: '/bookings/table-reservations/pass',
  ROOM_RESERVATIONS_PASS: '/bookings/room-reservations/pass',
  TABLE_RESERVATIONS_MINE: '/bookings/table-reservations/mine',
  BATCH_PAYMENTS: '/bookings/batch/payments',
  BATCH_CONFIRM_ROOMS: '/bookings/batch/rooms/confirm-transfer',
  BATCH_CONTACT: '/bookings/batch/contact',
} as const;

export const SOS_API = {
  CREATE: '/sos',
  PING: '/sos/ping',
  STOP: '/sos/stop',
} as const;
