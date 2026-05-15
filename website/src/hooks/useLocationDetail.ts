import { useCallback, useEffect, useState } from "react";
import locationApi from "../api/locationApi";
import type { Location } from "../types/location.types";

// Dùng để quản lý trạng thái chi tiết địa điểm
interface UseLocationDetailState {
  loading: boolean;
  error: string | null;
  location: Location | null;
}

// Vì sao: tách riêng việc gọi API detail để tránh lặp logic ở UI
export const useLocationDetail = (locationId?: number) => {
  const [state, setState] = useState<UseLocationDetailState>({
    loading: false,
    error: null,
    location: null,
  });

  const fetchDetail = useCallback(async () => {
    if (!locationId) return;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const response = await locationApi.getLocationById(locationId, "web");
      setState({ loading: false, error: null, location: response.data });
    } catch {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: "Không thể tải chi tiết địa điểm",
      }));
    }
  }, [locationId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  return {
    ...state,
    refetch: fetchDetail,
  };
};
