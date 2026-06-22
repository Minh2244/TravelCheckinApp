import { useCallback, useEffect, useMemo, useState } from "react";

import { getErrorMessage } from "../../lib/error";
import { locationApi } from "../../services/location.api";
import type { LocationItem } from "../../types/location";
import { useLocationCacheStore } from "./store";

type Category = "Tất cả" | "Ẩm thực" | "Lưu trú" | "Du lịch";

const foodTypes = new Set(["restaurant", "cafe"]);
const stayTypes = new Set(["hotel", "resort"]);
const exploreTypes = new Set(["tourist"]);

export function useLocations() {
  const cacheItems = useLocationCacheStore((state) => state.items);
  const setCacheItems = useLocationCacheStore((state) => state.setItems);
  const isCacheFresh = useLocationCacheStore((state) => state.isFresh);

  const [rawItems, setRawItems] = useState<LocationItem[]>(cacheItems);
  const [loading, setLoading] = useState(cacheItems.length === 0);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState<Category>("Tất cả");

  const runFetch = useCallback(
    async (asRefresh = false) => {
      try {
        if (asRefresh) {
          setRefreshing(true);
        } else if (rawItems.length === 0) {
          setLoading(true);
        }

        setError(null);

        const locationsRes = await locationApi.getLocations({ source: "mobile" });
        const nextItems = locationsRes.data ?? [];

        setRawItems(nextItems);
        setCacheItems(nextItems);
      } catch (fetchError) {
        setError(getErrorMessage(fetchError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [rawItems.length, setCacheItems],
  );

  useEffect(() => {
    if (cacheItems.length > 0) {
      setRawItems(cacheItems);
      setLoading(false);
      if (!isCacheFresh()) {
        void runFetch(true);
      }
      return;
    }

    void runFetch();
  }, [cacheItems, isCacheFresh, runFetch]);

  const locations = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return rawItems.filter((item) => {
      const locationType = String(item.location_type || "").toLowerCase();
      const matchesKeyword =
        normalizedKeyword.length === 0 ||
        item.location_name.toLowerCase().includes(normalizedKeyword) ||
        item.address.toLowerCase().includes(normalizedKeyword);

      if (!matchesKeyword) {
        return false;
      }

      if (category === "Tất cả") {
        return true;
      }

      if (category === "Ẩm thực") {
        return foodTypes.has(locationType);
      }

      if (category === "Lưu trú") {
        return stayTypes.has(locationType);
      }

      return exploreTypes.has(locationType);
    });
  }, [category, keyword, rawItems]);

  return {
    locations,
    loading,
    refreshing,
    error,
    category,
    keyword,
    setCategory,
    setKeyword,
    refetch: runFetch,
  };
}
