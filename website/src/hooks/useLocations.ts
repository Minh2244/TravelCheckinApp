import { useCallback, useEffect, useMemo, useState } from "react";
import locationApi from "../api/locationApi";
import type { LocationQueryParams } from "../api/locationApi";
import type { Location } from "../types/location.types";

// Dùng để quản lý trạng thái danh sách địa điểm
interface UseLocationsState {
  locations: Location[];
  loading: boolean;
  error: string | null;
  keyword: string;
  category: string;
}

const normalizeCategoryToType = (category: string): string | undefined => {
  if (category === "Tất cả") return undefined;
  if (category === "Cà phê") return "cafe";
  if (category === "Nhà hàng") return "restaurant";
  if (category === "Khách sạn") return "hotel";
  if (category === "Giải trí") return "tourist";
  if (category === "Ăn uống") return "restaurant";
  if (category === "Vui chơi") return "tourist";
  if (category === "Du lịch xanh") return "other";
  return undefined;
};

// Vì sao: gom logic gọi API và lọc dữ liệu vào hook để UI chỉ nhận props hiển thị
export const useLocations = () => {
  const [state, setState] = useState<UseLocationsState>({
    locations: [],
    loading: false,
    error: null,
    keyword: "",
    category: "Tất cả",
  });

  const params = useMemo<LocationQueryParams>(() => {
    const type = normalizeCategoryToType(state.category);
    return {
      type,
      keyword: state.keyword || undefined,
      source: "web",
    };
  }, [state.category, state.keyword]);

  const fetchLocations = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const response = await locationApi.getLocations(params);
      setState((prev) => ({
        ...prev,
        loading: false,
        locations: response?.data ?? [],
      }));
    } catch {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: "Không thể tải danh sách địa điểm",
      }));
    }
  }, [params]);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  const setKeyword = useCallback((keyword: string) => {
    setState((prev) => ({ ...prev, keyword }));
  }, []);

  const setCategory = useCallback((category: string) => {
    setState((prev) => ({ ...prev, category }));
  }, []);

  return {
    ...state,
    refetch: fetchLocations,
    setKeyword,
    setCategory,
  };
};
