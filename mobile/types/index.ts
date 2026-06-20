// Auth types
export interface User {
  id: number;
  email: string;
  full_name: string;
  phone?: string;
  role: 'user' | 'owner' | 'admin';
  avatar_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data?: {
    user: User;
    accessToken: string;
    refreshToken: string;
  };
  error?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  full_name: string;
  email: string;
  phone: string;
  password: string;
}

export interface OTPVerifyRequest {
  email: string;
  otp: string;
}

export interface ForgotPasswordRequest {
  email: string;
  phone: string;
}

export interface ResetPasswordRequest {
  email: string;
  otp: string;
  new_password: string;
}

export interface GoogleLoginRequest {
  idToken: string;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

// Location types
export interface Location {
  location_id: number;
  location_name: string;
  address: string;
  latitude: number;
  longitude: number;
  location_type: 'tourist' | 'restaurant' | 'hotel' | 'cafe' | 'resort' | 'other' | string;
  rating: number;
  total_reviews: number;
  images: string[];
  first_image: string | null;
  status: 'active' | 'inactive' | 'pending';
  created_at?: string;
}

// Booking types
export interface Booking {
  id: number;
  user_id: number;
  location_id: number;
  booking_type: string;
  status: string;
  total_amount: number;
  booking_date: string;
  created_at: string;
}

// Notification types
export interface Notification {
  id: number;
  user_id: number;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}
