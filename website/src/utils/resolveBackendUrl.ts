import axiosClient from "../api/axiosClient";

const getBackendOrigin = (): string | null => {
  const baseURL = axiosClient.defaults.baseURL;
  if (!baseURL) return null;

  try {
    // baseURL is something like: http://localhost:3000/api
    const url = new URL(baseURL);
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
};

export const resolveBackendUrl = (input?: string | null): string | null => {
  if (!input) return null;
  const value = String(input).trim();
  if (!value) return null;

  // Already absolute or data URL
  if (/^(https?:)?\/\//i.test(value) || value.startsWith("data:")) {
    return value;
  }

  const origin = getBackendOrigin();
  if (!origin) return value;

  if (value.startsWith("/")) return `${origin}${value}`;
  return `${origin}/${value}`;
};
