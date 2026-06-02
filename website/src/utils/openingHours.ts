import type { OpeningHours } from "../types/location.types";

type OpenClose = { open: string; close: string };

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const isValidTime = (v: unknown): v is string => {
  return typeof v === "string" && TIME_RE.test(v.trim());
};

const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map((x) => Number(x));
  return h * 60 + m;
};

const normalizeDay = (d: unknown): string => {
  return String(d ?? "")
    .trim()
    .toLowerCase();
};

const dayTokensForDate = (date: Date): Set<string> => {
  const js = date.getDay(); // 0..6 (Sun..Sat)
  const names = [
    ["sun", "sunday", "cn", "0", "7"],
    ["mon", "monday", "t2", "2", "1"],
    ["tue", "tuesday", "t3", "3", "2"],
    ["wed", "wednesday", "t4", "4", "3"],
    ["thu", "thursday", "t5", "5", "4"],
    ["fri", "friday", "t6", "6", "5"],
    ["sat", "saturday", "t7", "7", "6"],
  ];
  const tokens = new Set<string>();
  for (const t of names[js] || []) tokens.add(t);
  tokens.add(String(js));
  return tokens;
};

const parseJsonMaybe = (raw: string): unknown => {
  const t = raw.trim();
  if (!t) return null;
  if (!(t.startsWith("{") || t.startsWith("["))) return raw;
  return JSON.parse(t);
};

export const extractOpenClose = (
  openingHours: OpeningHours | unknown,
  date: Date = new Date(),
): OpenClose | null => {
  if (openingHours == null) return null;

  let v: unknown = openingHours;
  if (typeof v === "string") {
    try {
      v = parseJsonMaybe(v);
    } catch {
      return null;
    }
  }

  if (Array.isArray(v)) {
    const tokens = dayTokensForDate(date);
    for (const row of v) {
      const day = normalizeDay((row as any)?.day);
      if (!day || !tokens.has(day)) continue;
      const open = (row as any)?.open;
      const close = (row as any)?.close;
      if (isValidTime(open) && isValidTime(close)) {
        return { open: open.trim(), close: close.trim() };
      }
    }
    return null;
  }

  if (typeof v === "object" && v) {
    const rec = v as Record<string, unknown>;
    const open = rec.open;
    const close = rec.close;
    if (isValidTime(open) && isValidTime(close)) {
      return { open: open.trim(), close: close.trim() };
    }
  }

  return null;
};

export const isWithinOpeningHours = (
  openingHours: OpeningHours | unknown,
  date: Date = new Date(),
): boolean => {
  const oc = extractOpenClose(openingHours, date);
  if (!oc) return true;

  const openMin = toMinutes(oc.open);
  const closeMin = toMinutes(oc.close);
  const nowMin = date.getHours() * 60 + date.getMinutes();

  if (openMin === closeMin) return true; // treat as 24h
  if (openMin < closeMin) return nowMin >= openMin && nowMin < closeMin;
  return nowMin >= openMin || nowMin < closeMin; // overnight schedule
};
