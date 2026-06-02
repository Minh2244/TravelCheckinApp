// Hằng số cho mobile app

// API URL - đọc từ environment variable
// Cấu hình trong file .env (xem .env.example)
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://192.168.2.128:3000/api';

// Google OAuth Client ID
export const GOOGLE_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '';

// Facebook App ID
export const FACEBOOK_APP_ID =
  process.env.EXPO_PUBLIC_FACEBOOK_APP_ID || '';

// Màu sắc chủ đạo
export const COLORS = {
  primary: '#0d9488',       // Teal - màu chính
  primaryLight: '#14b8a6',  // Teal nhạt
  primaryDark: '#0f766e',   // Teal đậm
  secondary: '#f59e0b',     // Amber - màu phụ
  background: '#f8fafc',    // Nền chính
  surface: '#ffffff',       // Nền card/component
  text: '#1e293b',          // Text chính
  textSecondary: '#64748b', // Text phụ
  textLight: '#94a3b8',     // Text mờ
  border: '#e2e8f0',        // Viền
  error: '#ef4444',         // Lỗi
  success: '#22c55e',       // Thành công
  warning: '#f59e0b',       // Cảnh báo
  info: '#3b82f6',          // Thông tin
  overlay: 'rgba(0,0,0,0.5)', // Lớp phủ
};

// Kích thước
export const SIZES = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  radius: 12,
  radiusSm: 8,
  radiusLg: 16,
};

// Font size
export const FONTS = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 22,
  xxxl: 28,
  title: 32,
};

// Giới hạn
export const LIMITS = {
  searchResults: 20,
  reviewImages: 8,
  pageSize: 20,
};

// Thời gian cache (ms)
export const CACHE = {
  locations: 5 * 60 * 1000,    // 5 phút
  profile: 10 * 60 * 1000,     // 10 phút
  vouchers: 5 * 60 * 1000,     // 5 phút
};

// Loại địa điểm
export const LOCATION_TYPES = {
  all: { label: 'Tất cả', value: '' },
  tourist: { label: 'Khám phá', value: 'tourist' },
  restaurant: { label: 'Ẩm thực', value: 'restaurant' },
  hotel: { label: 'Lưu trú', value: 'hotel' },
  cafe: { label: 'Cafe', value: 'cafe' },
  resort: { label: 'Resort', value: 'resort' },
} as const;
