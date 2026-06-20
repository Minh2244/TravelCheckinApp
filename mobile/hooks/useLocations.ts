import { useState, useEffect, useCallback } from 'react';
import axiosClient from '../api/axiosClient';
import { useLocationStore, CACHE_TTL } from '../store/locationStore';
import { Location } from '../types';
import { API_URL } from '../constants';

// Lấy base URL (bỏ /api ở cuối)
const BASE_URL = API_URL.replace(/\/api$/, '');

/**
 * Chuyển relative path '/api/images/123' -> full URL
 */
function resolveImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${BASE_URL}${path}`;
}

/**
 * Gán full URL cho images và first_image của từng địa điểm
 */
function enrichLocationImages(loc: Location): Location {
  return {
    ...loc,
    first_image: resolveImageUrl(loc.first_image),
    images: (loc.images || []).map((img) => resolveImageUrl(img) as string).filter(Boolean),
  };
}

export const useLocations = () => {
  const { locations, lastFetched, setLocations } = useLocationStore();
  const [loading, setLoading] = useState<boolean>(false);
  const [category, setCategory] = useState<string>('Tất cả');
  const [keyword, setKeyword] = useState<string>('');

  const fetchLocations = useCallback(async (force = false) => {
    const isCacheValid = lastFetched !== null && Date.now() - lastFetched < CACHE_TTL;
    if (!force && isCacheValid && locations.length > 0) {
      return;
    }

    setLoading(true);
    try {
      // Backend đã tự lọc: chỉ trả về địa điểm của owner/admin, bỏ "Vị trí tự do"
      const locRes = await axiosClient.get('/locations', { params: { source: 'mobile' } });
      const allLocations: Location[] = (locRes.data?.data || []).map(enrichLocationImages);
      setLocations(allLocations);
    } catch (error) {
      console.error('Lỗi khi fetch địa điểm đề xuất:', error);
    } finally {
      setLoading(false);
    }
  }, [locations.length, lastFetched, setLocations]);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  const EAT_TYPES = new Set(['restaurant', 'cafe', 'food', 'bar', 'bakery']);
  const STAY_TYPES = new Set(['hotel', 'resort', 'hostel', 'motel', 'accommodation', 'guesthouse', 'homestay']);
  const TOUR_TYPES = new Set(['tourist', 'attraction', 'landmark', 'museum', 'park', 'beach']);

  let displayedLocations = locations;

  if (category === 'Ăn uống') {
    displayedLocations = locations.filter((l) => EAT_TYPES.has(l.location_type));
  } else if (category === 'Lưu trú') {
    displayedLocations = locations.filter((l) => STAY_TYPES.has(l.location_type));
  } else if (category === 'Du lịch') {
    displayedLocations = locations.filter((l) => TOUR_TYPES.has(l.location_type));
  }

  if (keyword.trim()) {
    const lowerKey = keyword.toLowerCase();
    displayedLocations = displayedLocations.filter((l) =>
      l.location_name.toLowerCase().includes(lowerKey) ||
      l.address.toLowerCase().includes(lowerKey)
    );
  }

  return {
    locations: displayedLocations,
    loading,
    category,
    setCategory,
    keyword,
    setKeyword,
    refetch: () => fetchLocations(true)
  };
};
