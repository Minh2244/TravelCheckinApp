import axiosClient from "./axiosClient";

export type GeoSearchResult = {
  place_id?: string | number;
  display_name?: string;
  lat?: string;
  lon?: string;
  address?: Record<string, string | undefined>;
};

export type GeoReverseResult = {
  display_name?: string;
  address?: Record<string, string | undefined>;
};

const geoApi = {
  search: async (q: string, limit = 6, signal?: AbortSignal) => {
    const res = await axiosClient.get<GeoSearchResult[]>("/geo/search", {
      params: { q, limit },
      signal,
    });
    return Array.isArray(res.data) ? res.data : [];
  },
  reverse: async (lat: number, lng: number, signal?: AbortSignal) => {
    const res = await axiosClient.get<GeoReverseResult>("/geo/reverse", {
      params: { lat, lng },
      signal,
    });
    return res.data;
  },
};

export default geoApi;
