/**
 * Shared booking utilities extracted from BookingDraftScreen + table/[serviceId].
 * Used by all booking screens and wallet screens.
 */

export function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function toInputDateTime(date: Date): string {
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

export function toLocalISOString(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

export function parseInputDate(value: string): Date | null {
  const parts = value.trim().split(/[\s/\-:]+/);
  if (parts.length >= 5) {
    const d = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const y = parseInt(parts[2], 10);
    const h = parseInt(parts[3], 10);
    const min = parseInt(parts[4], 10);
    const date = new Date(y, m, d, h, min);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

export function formatCurrency(value?: number | string | null): string {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) {
    return "Liên hệ";
  }
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount);
}

export function normalizeImages(images: unknown): string[] {
  if (Array.isArray(images)) return images as string[];
  if (typeof images === "string") {
    try {
      const parsed = JSON.parse(images);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [images];
    }
  }
  return [];
}

export function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return dateStr;
  }
}

export function formatTime(timeStr?: string | null): string {
  if (!timeStr) return "-";
  try {
    const d = new Date(timeStr);
    if (!Number.isNaN(d.getTime())) {
      return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
    return timeStr.slice(0, 5);
  } catch {
    return timeStr.slice(0, 5);
  }
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}
