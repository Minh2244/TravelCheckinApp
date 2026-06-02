// Geocoding API calls
import axiosClient from './axiosClient';

export interface GeoSearchResult {
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  province?: string;
}

export interface GeoReverseResult {
  display_name: string;
  address: {
    road?: string;
    suburb?: string;
    city?: string;
    state?: string;
    country?: string;
  };
}

const geoApi = {
  // Tìm kiếm địa điểm theo text
  search: (query: string, limit: number = 6) =>
    axiosClient.get<GeoSearchResult[]>('/geo/search', {
      params: { q: query, limit },
    }),

  // Lấy địa chỉ từ tọa độ
  reverse: (lat: number, lng: number) =>
    axiosClient.get<GeoReverseResult>('/geo/reverse', {
      params: { lat, lng },
    }),
};

export default geoApi;
