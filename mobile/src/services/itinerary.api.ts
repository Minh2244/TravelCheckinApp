import { api } from "../lib/api";

type ApiResponse<T> = {
  success: boolean;
  message?: string;
  data: T;
};

export type ItineraryItemInput = {
  itinerary_item_id?: number;
  day_number: number;
  sort_order?: number;
  location_id?: number | null;
  custom_name?: string | null;
  custom_address?: string | null;
  custom_lat?: number | null;
  custom_lng?: number | null;
  time?: string | null;
  note?: string | null;
  estimated_cost?: number | null;
  is_visited?: boolean | 0 | 1;
};

export type ItineraryInput = {
  title: string;
  description?: string;
  start_date: string;
  end_date: string;
  items?: ItineraryItemInput[];
};

export type ItineraryListItem = {
  itinerary_id: number;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  created_at: string;
  total_items: number;
  visited_items: number;
};

export type ItineraryDetail = {
  itinerary_id: number;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  created_at: string;
  items: ItineraryItemInput[];
};

export const itineraryApi = {
  async getItineraries() {
    const response = await api.get<ApiResponse<ItineraryListItem[]>>("/user/itineraries");
    return response.data;
  },

  async getItineraryDetail(id: number | string) {
    const response = await api.get<ApiResponse<ItineraryDetail>>(`/user/itineraries/${id}`);
    return response.data;
  },

  async createItinerary(data: ItineraryInput) {
    const response = await api.post<ApiResponse<ItineraryDetail>>("/user/itineraries", data);
    return response.data;
  },

  async updateItinerary(id: number | string, data: ItineraryInput) {
    const response = await api.put<ApiResponse<ItineraryDetail>>(`/user/itineraries/${id}`, data);
    return response.data;
  },

  async deleteItinerary(id: number | string) {
    const response = await api.delete<ApiResponse<unknown>>(`/user/itineraries/${id}`);
    return response.data;
  },

  async toggleVisited(itineraryId: number | string, itemId: number | string, isVisited: boolean) {
    const response = await api.patch<ApiResponse<unknown>>(
      `/user/itineraries/${itineraryId}/items/${itemId}/visit`,
      { is_visited: isVisited ? 1 : 0 }
    );
    return response.data;
  },
};
