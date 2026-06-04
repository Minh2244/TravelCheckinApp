// types/index.ts
// Dinh nghia tat ca kieu du lieu dung chung, phu hop voi DB schema

export interface User {
  user_id: number;
  email: string;
  phone: string | null;
  full_name: string;
  role: 'user' | 'owner' | 'employee' | 'admin';
  avatar_url: string | null;
  background_url?: string | null;
  address?: string | null;
  username?: string | null;
  is_verified: number;
  status?: string;
}

export interface UserStats {
  total_orders: number;
  total_spending: number;
  latest_order_date: string | null;
  favorite_location: string | null;
  member_tier: string;
  checkin_count: number;
}

export interface UserProfile extends User {
  stats: UserStats;
}

export interface Location {
  location_id: number;
  location_name: string;
  location_type: string;
  description: string | null;
  address: string | null;
  province: string | null;
  latitude: number;
  longitude: number;
  phone: string | null;
  email: string | null;
  opening_hours: string | null;
  first_image: string | null;
  images: string[] | null;
  owner_id: number | null;
  owner_name?: string | null;
  owner_avatar?: string | null;
  avg_rating?: number;
  total_reviews?: number;
  is_user_created?: number;
  status?: string;
}

export interface Service {
  service_id: number;
  location_id: number;
  service_name: string;
  service_type: 'ticket' | 'table' | 'room' | 'food' | 'combo' | 'other';
  price: number;
  quantity: number | null;
  description: string | null;
  category: string | null;
  image_url: string | null;
  status: string;
}

export interface Booking {
  booking_id: number;
  location_id: number;
  location_name?: string;
  service_id: number | null;
  service_name?: string;
  service_type?: string;
  user_id: number;
  check_in_date: string;
  check_out_date: string | null;
  quantity: number;
  total_amount: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'expired';
  payment_status: 'pending' | 'paid' | 'refunded' | 'failed';
  contact_name: string | null;
  contact_phone: string | null;
  notes: string | null;
  voucher_code: string | null;
  source: string;
  created_at: string;
  secure_code?: string | null;
}

export interface Ticket {
  ticket_id: number;
  ticket_code: string;
  status: 'active' | 'used' | 'expired' | 'cancelled';
  service_name: string;
  service_price: number;
  booking_id: number;
  use_date: string | null;
  location_name: string;
  location_id?: number;
  payment_status: string;
}

export interface TablePass {
  booking_id: number;
  secure_code: string;
  status: string;
  payment_status: string;
  check_in_date: string;
  contact_name: string | null;
  contact_phone: string | null;
  location_name: string;
  location_id?: number;
  table_names?: string;
  preorder_items?: string;
}

export interface RoomPass {
  booking_id: number;
  secure_code: string;
  status: string;
  payment_status: string;
  check_in_date: string;
  check_out_date: string;
  quantity: number;
  location_name: string;
  location_id?: number;
  room_names?: string;
  total_amount: number;
}

export interface Payment {
  payment_id: number;
  booking_id: number;
  amount: number;
  payment_method: string;
  status: string;
  bank_name: string | null;
  bank_account: string | null;
  account_holder: string | null;
  transaction_content: string | null;
  created_at: string;
}

export interface Review {
  review_id: number;
  user_id: number;
  full_name: string;
  avatar_url: string | null;
  location_id: number;
  rating: number;
  comment: string | null;
  images: string[] | null;
  created_at: string;
  owner_reply?: string | null;
  owner_reply_at?: string | null;
}

export interface Voucher {
  voucher_id: number;
  voucher_code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_order: number;
  max_discount: number | null;
  start_date: string;
  end_date: string;
  location_id: number | null;
  location_name?: string | null;
  apply_to_service_type: string | null;
  is_claimed?: boolean;
}

export interface Checkin {
  checkin_id: number;
  checkin_time: string;
  status: 'verified' | 'pending' | 'failed';
  location_id: number | null;
  location_name: string;
  address: string | null;
  first_image: string | null;
  is_user_created: number;
}

export interface DiaryEntry {
  diary_id: number;
  user_id: number;
  location_id: number | null;
  location_name: string | null;
  mood: 'happy' | 'excited' | 'neutral' | 'sad' | 'angry' | 'tired' | null;
  notes: string | null;
  images: string[] | null;
  created_at: string;
}

export interface Notification {
  notification_id: number;
  title: string;
  body: string;
  created_at: string;
  is_read: number;
}

export interface LeaderboardEntry {
  user_id: number;
  full_name: string;
  avatar_url: string | null;
  checkin_count: number;
}

export interface BookingReminder {
  booking_id: number;
  check_in_date: string;
  check_out_date: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  notes: string | null;
  status: string;
  service_name: string;
  service_type: string;
  location_name: string;
  location_id: number;
  reminder_sent: number;
}

export interface LoginHistory {
  id: number;
  ip_address: string;
  user_agent: string | null;
  success: number;
  created_at: string;
}

export interface FavoriteLocation {
  location_id: number;
  location_name: string;
  address: string | null;
  first_image: string | null;
  avg_rating: number;
  note: string | null;
  tags: string | null;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
}

export interface PaginatedResponse<T> {
  success: boolean;
  message: string;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}
