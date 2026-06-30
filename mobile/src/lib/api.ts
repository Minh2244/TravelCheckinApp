import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from "axios";

import { env } from "./env";

type RetryableConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

type AuthBridge = {
  getAccessToken: () => string | null;
  getRefreshToken: () => string | null;
  onAccessTokenRefreshed: (accessToken: string) => Promise<void> | void;
  onSessionExpired: (reason?: string) => Promise<void> | void;
};

let authBridge: AuthBridge = {
  getAccessToken: () => null,
  getRefreshToken: () => null,
  onAccessTokenRefreshed: () => undefined,
  onSessionExpired: () => undefined,
};

let refreshPromise: Promise<string | null> | null = null;

export const api: AxiosInstance = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 20000,
  headers: {
    "ngrok-skip-browser-warning": "true",
  },
});

const refreshClient = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 20000,
  headers: {
    "ngrok-skip-browser-warning": "true",
  },
});

export function configureApiAuthBridge(nextBridge: AuthBridge) {
  authBridge = nextBridge;
}

function shouldSkipRefresh(url?: string) {
  if (!url) {
    return true;
  }

  return [
    "/auth/login",
    "/auth/register",
    "/auth/verify-otp",
    "/auth/forgot-password",
    "/auth/verify-reset-otp",
    "/auth/reset-password",
    "/auth/refresh-token",
  ].some((path) => url.includes(path));
}

async function refreshAccessToken() {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    const refreshToken = authBridge.getRefreshToken();

    if (!refreshToken) {
      return null;
    }

    try {
      const response = await refreshClient.post("/auth/refresh-token", { refreshToken });
      const accessToken = response.data?.data?.accessToken as string | undefined;

      if (!accessToken) {
        return null;
      }

      await authBridge.onAccessTokenRefreshed(accessToken);
      return accessToken;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

api.interceptors.request.use((config) => {
  const token = authBridge.getAccessToken();

  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ code?: string; message?: string }>) => {
    const code = error.response?.data?.code;
    const message = error.response?.data?.message;
    const status = error.response?.status;
    const originalRequest = error.config as RetryableConfig | undefined;

    if (code === "SESSION_REVOKED") {
      await authBridge.onSessionExpired(message);
      return Promise.reject(error);
    }

    if (
      status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !shouldSkipRefresh(originalRequest.url)
    ) {
      originalRequest._retry = true;
      const newAccessToken = await refreshAccessToken();

      if (newAccessToken) {
        originalRequest.headers = originalRequest.headers ?? {};
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      }
    }

    if (status === 401) {
      await authBridge.onSessionExpired(message);
    }

    return Promise.reject(error);
  },
);
