/**
 * TypeScript Types — Định nghĩa dữ liệu cho toàn app
 * TravelCheckinApp Mobile
 */

// ============================================================
// API RESPONSE
// ============================================================

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface PaginatedData<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}

// ============================================================
// AUTH
// ============================================================

export interface User {
  user_id: number;
  email: string | null;
  phone: string | null;
  full_name: string;
  username: string | null;
  avatar_url: string | null;
  avatar_source: 'upload' | 'url' | null;
  background_url: string | null;
  background_source: 'upload' | 'url' | null;
  role: 'user' | 'owner' | 'employee' | 'admin';
  status: 'active' | 'pending' | 'locked';
  is_verified: number;
  created_at: string;
  updated_at: string;
}

export interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  redirectUrl?: string;
  warning?: string;
}

export interface UserStats {
  total_orders: number;
  total_spending: number;
  latest_order_date: string | null;
  favorite_location: {
    location_name: string;
    visit_count: number;
    total_spent: number;
    latest_visit: string;
    first_image: string | null;
  } | null;
  member_tier: string;
  checkin_count: number;
}

export interface UserProfile extends User {
  stats: UserStats;
}

// ============================================================
// LOCATION
// ============================================================

export interface Location {
  location_id: number;
  owner_id: number;
  location_name: string;
  location_type: 'hotel' | 'restaurant' | 'tourist' | 'cafe' | 'resort' | 'other';
  description: string | null;
  address: string;
  province: string | null;
  latitude: number;
  longitude: number;
  images: string[] | null;
  first_image: string | null;
  opening_hours: Record<string, { open: string; close: string }> | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  is_eco_friendly: number;
  status: 'active' | 'inactive' | 'pending';
  rating: number;
  total_reviews: number;
  total_checkins: number;
  source: 'osm' | 'owner' | 'admin';
  created_at: string;
  updated_at: string;
}

// ============================================================
// SERVICE
// ============================================================

export interface ServiceCategory {
  category_id: number;
  location_id: number;
  category_type: 'menu' | 'room' | 'other';
  category_name: string;
  sort_order: number;
}

export interface Service {
  service_id: number;
  location_id: number;
  category_id: number | null;
  service_name: string;
  service_type: 'room' | 'table' | 'ticket' | 'food' | 'combo' | 'other';
  description: string | null;
  price: number;
  quantity: number | null;
  unit: string | null;
  status: 'available' | 'booked' | 'unavailable' | 'reserved';
  images: string[] | null;
  category_name?: string;
  category_type?: string;
  category_sort_order?: number;
  room_status?: string;
  remaining_today?: number;
}

// ============================================================
// BOOKING
// ============================================================

export interface Booking {
  booking_id: number;
  user_id: number;
  service_id: number;
  location_id: number;
  contact_name: string | null;
  contact_phone: string | null;
  booking_date: string;
  check_in_date: string;
  check_out_date: string | null;
  quantity: number;
  total_amount: number;
  discount_amount: number;
  final_amount: number;
  voucher_code: string | null;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  source: 'web' | 'mobile' | 'admin';
  notes: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Ticket {
  ticket_id: number;
  ticket_code: string;
  status: 'unused' | 'used' | 'void';
  issued_at: string;
  used_at: string | null;
  service_id: number;
  service_name: string;
  service_price: number;
  service_images: string[] | null;
  booking_id: number;
  use_date: string;
  location_id: number;
  location_name: string;
  payment_status: string;
}

export interface TablePass {
  reservation_id: number;
  booking_id: number;
  table_id: number;
  table_name: string;
  location_id: number;
  location_name: string;
  start_time: string;
  end_time: string | null;
  status: 'active' | 'checked_in' | 'cancelled' | 'no_show' | 'released';
  checked_in_at: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  deposit_amount: number | null;
  preorder_items: PreorderItem[] | null;
}

export interface RoomPass {
  booking_id: number;
  location_id: number;
  location_name: string;
  room_name: string;
  check_in_date: string;
  check_out_date: string;
  night_count: number;
  total_amount: number;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  contact_name: string | null;
  contact_phone: string | null;
}

export interface PreorderItem {
  preorder_item_id: number;
  booking_id: number;
  service_id: number;
  service_name_snapshot: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface Payment {
  payment_id: number;
  amount: number;
  transaction_code: string;
  qr_data: string | null;
  payment_method: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  bank_name?: string;
  bank_account?: string;
  account_holder?: string;
}

// ============================================================
// REVIEW
// ============================================================

export interface Review {
  review_id: number;
  user_id: number;
  location_id: number;
  rating: number;
  comment: string | null;
  images: string[] | null;
  created_at: string;
  user_name: string;
  user_avatar: string | null;
  reply_content?: string | null;
  reply_created_at?: string | null;
  reply_images?: string[] | null;
  user_reply_content?: string | null;
  user_reply_created_at?: string | null;
  user_reply_images?: string[] | null;
}

// ============================================================
// VOUCHER
// ============================================================

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
  usage_limit: number | null;
  max_uses_per_user: number | null;
  used_count: number;
  is_claimed?: boolean;
  user_used_count?: number;
  location_name?: string;
  location_ids?: number[];
  location_names?: string[];
  claimed_at?: string;
}

// ============================================================
// CHECK-IN & DIARY
// ============================================================

export interface Checkin {
  checkin_id: number;
  user_id: number;
  location_id: number | null;
  checkin_time: string;
  status: 'pending' | 'verified' | 'failed';
  checkin_latitude: number | null;
  checkin_longitude: number | null;
  notes: string | null;
  location_name: string;
  address: string;
  first_image: string | null;
  location_owner_id?: number;
  is_user_created: boolean;
  location_status?: string;
  location_latitude?: number;
  location_longitude?: number;
}

export interface Diary {
  diary_id: number;
  user_id: number;
  location_id: number | null;
  location_name: string | null;
  mood: 'happy' | 'excited' | 'neutral' | 'sad' | 'angry' | 'tired';
  notes: string | null;
  images: string[] | null;
  created_at: string;
}

// ============================================================
// NOTIFICATION
// ============================================================

export interface Notification {
  notification_id: number;
  title: string;
  body: string;
  target_audience: 'all_users' | 'all_owners' | 'specific_user';
  target_user_id: number | null;
  created_at: string;
  read_at: string | null;
  is_read: boolean;
}

// ============================================================
// SOS
// ============================================================

export interface SosAlert {
  alert_id: number;
  user_id: number;
  location_text: string | null;
  message: string | null;
  status: 'pending' | 'processing' | 'resolved';
  resolved_at: string | null;
  created_at: string;
}

// ============================================================
// LEADERBOARD
// ============================================================

export interface LeaderboardEntry {
  user_id: number;
  full_name: string;
  avatar_url: string | null;
  checkin_count: number;
}

// ============================================================
// BOOKING REMINDER
// ============================================================

export interface BookingReminder {
  booking_id: number;
  check_in_date: string;
  check_out_date: string | null;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  notes: string | null;
  location_name: string;
  address: string;
  province: string | null;
  location_type: string;
  reminder_sent: boolean;
}

// ============================================================
// ITINERARY (Lịch trình)
// ============================================================

export interface ItinerarySummary {
  itinerary_id: number;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  total_items: number;
  total_estimated_cost: number;
  visited_count: number;
  created_at: string;
}

export interface ItineraryItem {
  item_id: number;
  day_number: number;
  sort_order: number;
  location_id: number | null;
  location_name: string | null;
  location_image: string | null;
  location_rating: number | null;
  custom_name: string | null;
  custom_address: string | null;
  time: string | null;
  note: string | null;
  estimated_cost: number | null;
  visited_at: string | null;
}

export interface ItineraryDetail {
  itinerary_id: number;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  created_at: string;
  updated_at: string;
  items: ItineraryItem[];
}

// ============================================================
// GEO
// ============================================================

export interface GeoSearchResult {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  address: Record<string, string>;
}

export interface GeoReverseResult {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  address: Record<string, string>;
}

// ============================================================
// POS (Point of Sale)
// ============================================================

export interface PosArea {
  area_id: number;
  location_id: number;
  area_name: string;
  sort_order: number;
}

export interface PosTable {
  table_id: number;
  location_id: number;
  area_id: number;
  table_name: string;
  shape: 'square' | 'round';
  status: 'free' | 'occupied' | 'reserved';
}

// ============================================================
// REALTIME STOCK
// ============================================================

export interface RealtimeStock {
  service_id: number;
  service_type: string;
  remaining_today: number;
}

// ============================================================
// LOGIN HISTORY
// ============================================================

export interface LoginHistory {
  login_id: number;
  success: boolean;
  ip_address: string;
  user_agent: string;
  device_info: string | null;
  created_at: string;
}

// ============================================================
// RECOMMENDATIONS
// ============================================================

export interface Recommendations {
  favorites: Location[];
  recent: Location[];
  recommended: Location[];
}

// ============================================================
// CREATED LOCATIONS (User-created check-in spots)
// ============================================================

export interface CreatedLocation {
  location_id: number;
  location_name: string;
  location_type: string;
  description: string | null;
  address: string;
  province: string | null;
  latitude: number;
  longitude: number;
  status: string;
  created_at: string;
}
