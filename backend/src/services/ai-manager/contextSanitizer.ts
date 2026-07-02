const SENSITIVE_KEY_PATTERNS = [
  /token/i,
  /password/i,
  /otp/i,
  /secret/i,
  /authorization/i,
  /cookie/i,
  /bank/i,
  /account_number/i,
  /stk/i,
  /card/i,
  /cvv/i,
];

const MAX_STRING_LENGTH = 1200;
const MAX_ARRAY_LENGTH = 20;
const MAX_DEPTH = 4;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function shouldRemoveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

function sanitizeValue(value: unknown, depth: number): unknown {
  if (depth > MAX_DEPTH) return "[truncated]";
  if (value == null) return value;

  if (typeof value === "string") {
    return value.length > MAX_STRING_LENGTH ? `${value.slice(0, MAX_STRING_LENGTH)}...` : value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_LENGTH).map((item) => sanitizeValue(item, depth + 1));
  }

  if (isPlainObject(value)) {
    const output: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      if (shouldRemoveKey(key)) continue;
      output[key] = sanitizeValue(nestedValue, depth + 1);
    }
    return output;
  }

  return String(value);
}

export function sanitizeManagerAiContext(context: unknown): Record<string, unknown> {
  const sanitized = sanitizeValue(context || {}, 0);
  return isPlainObject(sanitized) ? sanitized : {};
}
