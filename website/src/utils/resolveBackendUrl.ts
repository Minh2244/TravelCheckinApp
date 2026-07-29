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

export const resolveBackendUrl = (input?: string | null, cacheBuster?: string | number): string | null => {
  if (!input) return null;
  const value = String(input).trim();
  if (!value) return null;

  let url = value;
  if (!/^(https?:)?\/\//i.test(value) && !value.startsWith("data:")) {
    const origin = getBackendOrigin();
    if (origin) {
      url = value.startsWith("/") ? `${origin}${value}` : `${origin}/${value}`;
    }
  }

  if (cacheBuster && !url.startsWith("data:")) {
    url += (url.includes("?") ? "&" : "?") + `t=${cacheBuster}`;
  }

  return url;
};

