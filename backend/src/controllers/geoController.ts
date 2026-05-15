import type { Request, Response } from "express";
import axios from "axios";

type CacheEntry<T> = { exp: number; value: T };

const cache = new Map<string, CacheEntry<unknown>>();

const cacheGet = <T>(key: string): T | null => {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.exp) {
    cache.delete(key);
    return null;
  }
  return hit.value as T;
};

const cacheSet = (key: string, value: unknown, ttlMs: number) => {
  cache.set(key, { exp: Date.now() + ttlMs, value });
};

// Very small, in-memory rate limiter (best-effort).
// Enough to prevent hammering Nominatim during typing.
const rate = new Map<string, { tokens: number; last: number }>();
const RATE_CAPACITY = 60; // burst
const RATE_REFILL_PER_SEC = 1; // 60/min

const getClientIp = (req: Request): string => {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.trim()) return xf.split(",")[0]!.trim();
  if (Array.isArray(xf) && xf[0]) return String(xf[0]);
  return (
    req.ip ||
    (req.socket?.remoteAddress ? String(req.socket.remoteAddress) : "unknown")
  );
};

const takeToken = (key: string): boolean => {
  const now = Date.now();
  const hit = rate.get(key);
  if (!hit) {
    rate.set(key, { tokens: RATE_CAPACITY - 1, last: now });
    return true;
  }

  const elapsedSec = Math.max(0, (now - hit.last) / 1000);
  const refill = elapsedSec * RATE_REFILL_PER_SEC;
  const tokens = Math.min(RATE_CAPACITY, hit.tokens + refill);

  if (tokens < 1) {
    rate.set(key, { tokens, last: now });
    return false;
  }

  rate.set(key, { tokens: tokens - 1, last: now });
  return true;
};

const VIETNAM_VIEWBOX = {
  // left, top, right, bottom
  left: 102.0,
  top: 23.5,
  right: 110.5,
  bottom: 8.0,
};

const isWithinVietnam = (lat: number, lng: number): boolean => {
  return (
    lat >= VIETNAM_VIEWBOX.bottom &&
    lat <= VIETNAM_VIEWBOX.top &&
    lng >= VIETNAM_VIEWBOX.left &&
    lng <= VIETNAM_VIEWBOX.right
  );
};

const removeDiacritics = (value: string): string => {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
};

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";

const nominatimHeaders = () => {
  const ua =
    process.env.NOMINATIM_USER_AGENT ||
    "TravelCheckinApp/1.0 (geocoding proxy; contact: set NOMINATIM_USER_AGENT)";

  return {
    "User-Agent": ua,
    "Accept-Language": "vi",
    Accept: "application/json",
  };
};

export const geoSearch = async (req: Request, res: Response) => {
  const ip = getClientIp(req);
  if (!takeToken(`search:${ip}`)) {
    res.status(429).json({ message: "Rate limited" });
    return;
  }

  const q = String(req.query.q ?? "").trim();
  const limitRaw = Number(req.query.limit ?? 6);
  const limit =
    Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.min(10, Math.max(1, Math.round(limitRaw)))
      : 6;

  if (!q || q.length < 2) {
    res.json([]);
    return;
  }

  const cacheKey = `search:${limit}:${q}`;
  const cached = cacheGet<unknown[]>(cacheKey);
  if (cached) {
    res.json(cached);
    return;
  }

  const viewbox = `${VIETNAM_VIEWBOX.left},${VIETNAM_VIEWBOX.top},${VIETNAM_VIEWBOX.right},${VIETNAM_VIEWBOX.bottom}`;

  const doSearch = async (query: string) => {
    const url =
      `${NOMINATIM_BASE}/search` +
      `?format=json` +
      `&addressdetails=1` +
      `&limit=${encodeURIComponent(String(limit))}` +
      `&countrycodes=vn` +
      `&bounded=1` +
      `&viewbox=${encodeURIComponent(viewbox)}` +
      `&q=${encodeURIComponent(query)}`;

    const resp = await axios.get(url, {
      headers: nominatimHeaders(),
      timeout: 8000,
    });
    const data = resp.data;
    return Array.isArray(data) ? data : [];
  };

  try {
    let results = await doSearch(q);

    // Fallback: try without diacritics when the first search yields nothing.
    if (results.length === 0) {
      const normalized = removeDiacritics(q);
      if (normalized && normalized !== q) {
        results = await doSearch(normalized);
      }
    }

    const filtered = results.filter((r) => {
      const lat = Number((r as any)?.lat);
      const lng = Number((r as any)?.lon);
      return (
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        isWithinVietnam(lat, lng)
      );
    });

    cacheSet(cacheKey, filtered, 60 * 60 * 1000);
    res.json(filtered);
  } catch (err) {
    res.status(502).json({ message: "Geocoding upstream error" });
  }
};

export const geoReverse = async (req: Request, res: Response) => {
  const ip = getClientIp(req);
  if (!takeToken(`reverse:${ip}`)) {
    res.status(429).json({ message: "Rate limited" });
    return;
  }

  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    res.status(400).json({ message: "Invalid lat/lng" });
    return;
  }

  const cacheKey = `reverse:${lat.toFixed(6)}:${lng.toFixed(6)}`;
  const cached = cacheGet<unknown>(cacheKey);
  if (cached) {
    res.json(cached);
    return;
  }

  try {
    const url =
      `${NOMINATIM_BASE}/reverse` +
      `?format=jsonv2` +
      `&addressdetails=1` +
      `&lat=${encodeURIComponent(String(lat))}` +
      `&lon=${encodeURIComponent(String(lng))}`;

    const resp = await axios.get(url, {
      headers: nominatimHeaders(),
      timeout: 8000,
    });

    const data = resp.data ?? null;
    cacheSet(cacheKey, data, 24 * 60 * 60 * 1000);
    res.json(data);
  } catch {
    res.status(502).json({ message: "Reverse-geocoding upstream error" });
  }
};
