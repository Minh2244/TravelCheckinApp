export type LatLng = { lat: number; lng: number };

export const normalizeNumber = (value: unknown): number | null => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

export const isLatLngValid = (pos: unknown): pos is LatLng => {
  if (!pos || typeof pos !== "object") return false;
  const candidate = pos as { lat?: unknown; lng?: unknown };
  const lat = normalizeNumber(candidate.lat);
  const lng = normalizeNumber(candidate.lng);
  if (lat == null || lng == null) return false;

  // Treat (0,0) as missing in this app context.
  if (lat === 0 && lng === 0) return false;

  if (Math.abs(lat) > 90) return false;
  if (Math.abs(lng) > 180) return false;
  return true;
};

export const parseLatLngMaybeSwap = (
  latRaw: unknown,
  lngRaw: unknown,
): LatLng | null => {
  const lat = normalizeNumber(latRaw);
  const lng = normalizeNumber(lngRaw);
  if (lat == null || lng == null) return null;

  // Treat (0,0) as missing in this app context.
  if (lat === 0 && lng === 0) return null;

  // If stored swapped (VN: lat~10, lng~106), fix it.
  if (Math.abs(lat) > 90 && Math.abs(lng) <= 90) {
    if (Math.abs(lat) <= 180) return { lat: lng, lng: lat };
  }

  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
};
