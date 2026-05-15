const parseNumber = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  if (!Number.isInteger(num)) return null;
  if (num <= 0) return null;
  return num;
};

export const parseLocationIdFromQr = (text: string): number | null => {
  const raw = text.trim();
  if (!raw) return null;

  // 1) Plain integer
  const direct = parseNumber(raw);
  if (direct) return direct;

  // 2) Patterns like location:123 or location_id=123
  const match = raw.match(/(?:location(?:_id)?\s*[:=]\s*)(\d+)/i);
  if (match?.[1]) {
    const parsed = parseNumber(match[1]);
    if (parsed) return parsed;
  }

  // 3) URL containing /location/{id}
  const pathMatch = raw.match(/\/location\/(\d+)/i);
  if (pathMatch?.[1]) {
    const parsed = parseNumber(pathMatch[1]);
    if (parsed) return parsed;
  }

  // 4) URL query string with location_id
  try {
    const url = new URL(raw);
    const queryId = parseNumber(url.searchParams.get("location_id"));
    if (queryId) return queryId;
  } catch {
    // ignore
  }

  return null;
};
