// api/axiosClient.ts
// Axios client voi token refresh tu dong, xu ly session revoked va account locked

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import { router } from 'expo-router';
import { AUTH_API } from './endpoints';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

const axiosClient = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// Flag de tranh refresh token chong chong
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });
  failedQueue = [];
};

// Request interceptor: gan token vao header
axiosClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().accessToken;
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: xu ly 401 voi token refresh, session revoked, account locked
axiosClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    const status = error.response?.status;
    const errorCode = (error.response?.data as Record<string, unknown>)?.code;

    // Session bi revoke do dang nhap thiet bi khac
    if (errorCode === 'SESSION_REVOKED') {
      useAuthStore.getState().setSessionRevoked(true);
      return Promise.reject(error);
    }

    // Tai khoan bi khoa
    if (errorCode === 'ACCOUNT_LOCKED') {
      useAuthStore.getState().logout();
      router.replace('/login' as any);
      return Promise.reject(error);
    }

    // 401 — thu refresh token neu chua retry
    if (status === 401 && !originalRequest._retry) {
      const refreshToken = useAuthStore.getState().refreshToken;

      // Khong co refresh token -> logout
      if (!refreshToken) {
        useAuthStore.getState().logout();
        router.replace('/login' as any);
        return Promise.reject(error);
      }

      // Neu dang refresh roi -> dua vao queue cho
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${token}`;
          }
          return axiosClient(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const res = await axios.post(`${API_URL}${AUTH_API.REFRESH_TOKEN}`, {
          refreshToken,
        });

        const newAccessToken = res.data.accessToken;
        const currentUser = useAuthStore.getState().user;
        if (!currentUser) {
          useAuthStore.getState().logout();
          router.replace('/login' as any);
          processQueue(new Error('User not found'), null);
          return Promise.reject(error);
        }
        useAuthStore.getState().setAuth(
          newAccessToken,
          refreshToken,
          currentUser
        );

        processQueue(null, newAccessToken);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }
        return axiosClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        useAuthStore.getState().logout();
        router.replace('/login' as any);
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // 403 — khong co quyen
    if (status === 403) {
      useAuthStore.getState().logout();
      router.replace('/login' as any);
    }

    return Promise.reject(error);
  }
);

export default axiosClient;
