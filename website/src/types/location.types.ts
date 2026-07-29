export type LocationType =
  | "hotel"
  | "restaurant"
  | "tourist"
  | "cafe"
  | "resort"
  | "other";

export type LocationStatus = "active" | "inactive" | "pending";

export type OpeningHours =
  | Record<string, string>
  | Array<{ day: string; open: string; close: string }>
  | null;

// Dùng để đồng bộ dữ liệu Location với cấu trúc trong DB
export interface Location {
  location_id: number;
  owner_id: number;
  category?: string;
  location_name: string;
  location_type: LocationType;
  description: string | null;
  address: string;
  province: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  images: string[] | null;
  first_image: string | null;
  opening_hours: OpeningHours;
  phone: string | null;
  email: string | null;
  website: string | null;
  is_eco_friendly: 0 | 1 | boolean;
  is_user_created?: 0 | 1 | boolean;
  is_private_location?: 0 | 1 | boolean;
  private_user_id?: number | string | null;
  created_by_user_id?: number | string | null;
  source?: string | null;
  osm_type?: string | null;
  osm_id?: number | string | null;
  status: LocationStatus;
  previous_status: LocationStatus | null;
  rejection_reason: string | null;
  rating: number | string;
  total_reviews: number;
  total_checkins: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  temp_close_type?: string | null;
  temp_close_until?: string | null;
  distance_km?: number | null;
}

export const isOwnerCreatedLocation = (location: {
  source?: string | null;
  is_user_created?: 0 | 1 | boolean;
}): boolean => {
  return location.source === "owner" || Boolean(location.is_user_created);
};

export const isPrivateUserLocation = (
  location: {
    source?: string | null;
    is_private_location?: 0 | 1 | boolean;
    private_user_id?: number | string | null;
    created_by_user_id?: number | string | null;
  } | null | undefined,
  currentUserId?: number | null,
): boolean => {
  if (!location) return false;
  if (Boolean(location.is_private_location)) return true;
  const createdBy = Number(location.created_by_user_id ?? location.private_user_id);
  return (
    location.source === "user" &&
    Number.isFinite(createdBy) &&
    currentUserId != null &&
    createdBy === Number(currentUserId)
  );
};

export interface LocationListResponse {
  success: boolean;
  message?: string;
  count?: number;
  data: Location[];
}

export interface LocationDetailResponse {
  success: boolean;
  message?: string;
  data: Location;
}

export interface LocationReview {
  review_id: number;
  user_id?: number;
  location_id: number;
  rating: number;
  comment: string | null;
  images: string[] | string | null;
  created_at: string;
  user_name: string | null;
  user_avatar: string | null;
  reply_content?: string | null;
  reply_created_at?: string | null;
  reply_images?: string[] | string | null;
  user_reply_content?: string | null;
  user_reply_created_at?: string | null;
  user_reply_user_id?: number | null;
  user_reply_images?: string[] | string | null;
}
