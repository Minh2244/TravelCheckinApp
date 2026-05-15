export interface CheckinItem {
  checkin_id: number;
  checkin_time: string;
  status: "pending" | "verified" | "failed";
  location_id: number;
  location_name: string;
  address: string;
  first_image: string | null;
  checkin_latitude?: number | string | null;
  checkin_longitude?: number | string | null;
  location_owner_id?: number | string | null;
  is_user_created?: number | boolean | null;
  location_status?: "active" | "inactive" | "pending" | string;
  location_latitude?: number | string | null;
  location_longitude?: number | string | null;
}

export interface VoucherItem {
  voucher_id: number;
  code: string;
  campaign_name: string | null;
  campaign_description: string | null;
  discount_type: "percent" | "amount";
  discount_value: number | string;
  start_date: string;
  end_date: string;
  status: "active" | "inactive" | "expired";
  location_id: number | null;
  location_name?: string | null;
}

export interface DiaryItem {
  diary_id: number;
  user_id: number;
  location_id: number | null;
  images: string[] | null;
  mood: "happy" | "excited" | "neutral" | "sad" | "angry" | "tired";
  notes: string | null;
  created_at: string;
  location_name?: string | null;
}

export interface ItineraryItem {
  itinerary_id: number;
  user_id: number | null;
  name: string;
  description: string | null;
  locations: Array<Record<string, unknown>> | null;
  total_distance_km: number | string;
  estimated_time_hours: number | string;
  is_ai_recommended: 0 | 1;
  created_at: string;
}

export interface AiChatHistoryItem {
  history_id: number;
  prompt: string;
  response: string;
  created_at: string;
}

export interface SosResponse {
  alert_id: number;
}

export interface LeaderboardRow {
  user_id: number;
  full_name: string | null;
  avatar_url: string | null;
  checkin_count: number | string;
}

export interface BookingReminderItem {
  booking_id: number;
  check_in_date: string;
  check_out_date: string | null;
  status: "pending" | "confirmed" | "cancelled" | "completed";
  location_name: string;
  address: string;
  province: string | null;
  reminder_sent?: boolean;
}

export interface UserTouristTicketItem {
  ticket_id: number;
  ticket_code: string;
  status: "unused" | "used" | "expired" | "void" | string;
  issued_at: string | null;
  used_at: string | null;
  service_id: number;
  service_name: string | null;
  service_price?: number | string | null;
  service_images?: string | null;
  booking_id: number;
  use_date: string | null;
  location_id: number;
  location_name: string | null;
  payment_status?: string | null;
}

export interface GroupMember {
  user_id: number;
  joined_at: string;
  last_seen_at: string;
}

export interface GroupInfo {
  code: string;
  created_by: number;
  created_at: string;
  expires_at: string;
  members: GroupMember[];
}

export interface GroupCheckinItem {
  checkin_id: number;
  user_id: number;
  user_name: string | null;
  checkin_time: string;
  location_id: number;
  location_name: string;
  address: string;
  province: string | null;
}

export interface UserProfile {
  user_id: number;
  email: string | null;
  phone: string | null;
  full_name: string;
  avatar_url: string | null;
  avatar_source?: "upload" | "url";
  background_url?: string | null;
  background_source?: "upload" | "url";
  role: "user" | "owner" | "employee" | "admin";
  status: "active" | "pending" | "locked";
  created_at: string;
  updated_at: string;
}

export interface UserLoginHistoryItem {
  login_id: number;
  success: 0 | 1;
  ip_address: string | null;
  user_agent: string | null;
  device_info: string | null;
  created_at: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
}

export interface UserNotificationItem {
  notification_id: number;
  title: string | null;
  body: string | null;
  target_audience: string | null;
  target_user_id: number | null;
  created_at: string;
  read_at?: string | null;
  is_read?: 0 | 1 | boolean;
}
