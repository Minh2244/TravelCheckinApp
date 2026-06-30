export type LocationType =
  | "hotel"
  | "restaurant"
  | "tourist"
  | "cafe"
  | "resort"
  | "other"
  | string;

export type LocationStatus = "active" | "inactive" | "pending";

export type LocationItem = {
  location_id: number;
  owner_id?: number | null;
  location_name: string;
  location_type: LocationType;
  description?: string | null;
  address: string;
  province?: string | null;
  opening_hours?: Record<string, string> | Array<{
    day: string;
    open: string;
    close: string;
  }> | string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  images?: string[] | null;
  first_image: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  is_eco_friendly?: boolean | 0 | 1;
  source?: string | null;
  status: LocationStatus;
  rating: number | string;
  total_reviews: number;
  total_checkins?: number;
  created_at?: string;
  updated_at?: string;
};

export type LocationServiceItem = {
  service_id: number;
  location_id: number;
  service_name: string;
  service_type: "room" | "table" | "ticket" | "food" | "combo" | "other" | string;
  description?: string | null;
  price: number | string;
  quantity?: number | null;
  unit?: string | null;
  status?: string | null;
  images?: string[] | string | null;
  image_url?: string | null;
  room_status?: string | null;
  category_name?: string | null;
  category_type?: string | null;
  category_sort_order?: number | string | null;
};

export type LocationPosArea = {
  area_id: number;
  area_name: string;
  sort_order?: number | null;
};

export type LocationPosTable = {
  table_id: number;
  location_id: number;
  area_id: number | null;
  table_name: string;
  shape?: string | null;
  status: "free" | "reserved" | "occupied" | string;
};

export type LocationReview = {
  review_id: number;
  user_id?: number;
  location_id: number;
  rating: number;
  comment: string | null;
  images?: string[] | string | null;
  created_at: string;
  user_name: string | null;
  user_avatar?: string | null;
  reply_content?: string | null;
  reply_created_at?: string | null;
};
