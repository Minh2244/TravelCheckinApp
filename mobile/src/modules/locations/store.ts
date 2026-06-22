import { create } from "zustand";

import type { LocationItem } from "../../types/location";

const CACHE_TTL_MS = 5 * 60 * 1000;

type LocationCacheState = {
  items: LocationItem[];
  lastFetchedAt: number | null;
  setItems: (items: LocationItem[]) => void;
  clear: () => void;
  isFresh: () => boolean;
};

export const useLocationCacheStore = create<LocationCacheState>((set, get) => ({
  items: [],
  lastFetchedAt: null,
  setItems: (items) => set({ items, lastFetchedAt: Date.now() }),
  clear: () => set({ items: [], lastFetchedAt: null }),
  isFresh: () => {
    const lastFetchedAt = get().lastFetchedAt;
    return lastFetchedAt != null && Date.now() - lastFetchedAt < CACHE_TTL_MS;
  },
}));
