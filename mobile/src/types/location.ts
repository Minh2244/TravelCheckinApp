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
  latitude?: number | string | null;
  longitude?: number | string | null;
  images?: string[] | null;
  first_image: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  source?: string | null;
  status: LocationStatus;
  rating: number | string;
  total_reviews: number;
  total_checkins?: number;
  created_at?: string;
  updated_at?: string;
};
