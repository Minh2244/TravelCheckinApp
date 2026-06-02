// Types cho mobile app - khớp với database schema

export interface User {
  user_id: number;
  email: string;
  phone: string | null;
  full_name: string;
  role: 'user' | 'owner' | 'employee' | 'admin';
  status: 'pending' | 'active' | 'locked';
  avatar_url: string | null;
  avatar_path: string | null;
  avatar_source: 'upload' | 'url' | null;
  is_verified: number;
  created_at: string;
}

export interface Location {
  location_id: number;
  owner_id: number | null;
  location_name: string;
  location_type: 'hotel' | 'restaurant' | 'tourist' | 'cafe' | 'resort' | 'other';
  description: string | null;
  address: string;
  province: string | null;
  latitude: number;
  longitude: number;
  first_image: string | null;
  status: 'active' | 'inactive';
  rating: number;
  total_reviews: number;
  total_checkins: number;
  opening_hours: OpeningHours | null;
  source: string | null;
  created_at: string;
}

export interface OpeningHours {
  [day: string]: {
    open: string;
    close: string;
    closed?: boolean;
  };
}

export interface LocationService {
  service_id: number;
  location_id: number;
  category_id: number | null;
  service_name: string;
  service_type: 'room' | 'table' | 'ticket' | 'food' | 'combo' | 'other';
  description: string | null;
  price: number;
  quantity: number | null;
  unit: string | null;
  status: string;
  images: string[] | null;
}

export interface Review {
  review_id: number;
  user_id: number;
  location_id: number;
  rating: number;
  comment: string | null;
  images: string[] | null;
  status: 'active' | 'deleted';
  created_at: string;
  user_name?: string;
  user_avatar?: string | null;
}

export interface Voucher {
  voucher_id: number;
  code: string;
  campaign_name: string;
  campaign_description: string | null;
  discount_type: 'percent' | 'amount';
  discount_value: number;
  min_order_value: number | null;
  max_discount_amount: number | null;
  start_date: string;
  end_date: string;
  usage_limit: number;
  used_count: number;
  max_uses_per_user: number | null;
  status: string;
  location_names?: string[];
  user_used_count?: number;
}

export interface FavoriteLocation {
  location_id: number;
  location_name: string;
  location_type: string;
  address: string;
  first_image: string | null;
  rating: number;
  total_reviews: number;
  added_at: string;
}

export interface Checkin {
  checkin_id: number;
  user_id: number;
  location_id: number;
  checkin_latitude: number | null;
  checkin_longitude: number | null;
  checkin_time: string;
  status: string;
  notes: string | null;
  location_name?: string;
  location_address?: string;
  location_type?: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
  redirectUrl: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}
