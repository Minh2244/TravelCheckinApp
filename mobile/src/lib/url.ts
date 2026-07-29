import { env } from "./env";

const NGROK_SKIP_BROWSER_WARNING_HEADER = {
  "ngrok-skip-browser-warning": "true",
};

export function resolveBackendUrl(value?: string | null) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (/^(https?:|file:|content:|data:|blob:)/i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith("/")) {
    return `${env.apiOrigin}${trimmed}`;
  }

  return `${env.apiOrigin}/${trimmed}`;
}

export function resolveBackendImageSource(value?: string | null) {
  const uri = resolveBackendUrl(value);
  if (!uri) {
    return null;
  }

  if (/^(file:|content:|data:|blob:)/i.test(uri)) {
    return { uri };
  }

  return {
    uri,
    headers: uri.includes("ngrok")
      ? NGROK_SKIP_BROWSER_WARNING_HEADER
      : undefined,
  };
}
