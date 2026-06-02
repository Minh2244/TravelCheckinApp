// Hook lấy danh sách địa điểm
import { useState, useEffect, useCallback } from 'react';
import locationApi from '../api/locationApi';
import type { Location } from '../types';

interface UseLocationsOptions {
  type?: string;
  keyword?: string;
  autoFetch?: boolean;
}

interface UseLocationsReturn {
  locations: Location[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  search: (keyword: string) => Promise<void>;
  filterByType: (type: string) => void;
}

export function useLocations(options: UseLocationsOptions = {}): UseLocationsReturn {
  const { type = '', keyword = '', autoFetch = true } = options;

  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentType, setCurrentType] = useState(type);
  const [currentKeyword, setCurrentKeyword] = useState(keyword);

  const fetchLocations = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params: Record<string, string> = { source: 'mobile' };
      if (currentType) params.type = currentType;
      if (currentKeyword) params.keyword = currentKeyword;

      const response = await locationApi.getLocations(params);
      setLocations(response.data.locations || []);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Không thể tải danh sách địa điểm';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [currentType, currentKeyword]);

  const search = useCallback(async (kw: string) => {
    setCurrentKeyword(kw);
  }, []);

  const filterByType = useCallback((t: string) => {
    setCurrentType(t);
  }, []);

  useEffect(() => {
    if (autoFetch) {
      fetchLocations();
    }
  }, [autoFetch, fetchLocations]);

  return {
    locations,
    isLoading,
    error,
    refetch: fetchLocations,
    search,
    filterByType,
  };
}
