import { create } from 'zustand';
import { Location } from '../types';

interface LocationState {
  locations: Location[];
  lastFetched: number | null;
  setLocations: (data: Location[]) => void;
  clearCache: () => void;
}

export const CACHE_TTL = 5 * 60 * 1000; // 5 phút

export const useLocationStore = create<LocationState>((set) => ({
  locations: [],
  lastFetched: null,
  setLocations: (data) => set({ locations: data, lastFetched: Date.now() }),
  clearCache: () => set({ locations: [], lastFetched: null }),
}));
