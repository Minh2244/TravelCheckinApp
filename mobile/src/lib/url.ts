import { env } from "./env";

export function resolveBackendUrl(value?: string | null) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith("/")) {
    return `${env.apiOrigin}${trimmed}`;
  }

  return `${env.apiOrigin}/${trimmed}`;
}
