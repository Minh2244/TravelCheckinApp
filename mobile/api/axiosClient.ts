/**
 * Axios Client — HTTP client + token refresh tự động
 * TravelCheckinApp Mobile
 */

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// baseURL từ .env (EXPO_PUBLIC_API_URL)
const baseURL = process.env.EXPO_PUBLIC_API_URL;

const axiosClient = axios.create({
  baseURL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ============================================================
// REQUEST INTERCEPTOR — Tự động gắn token
// ============================================================

axiosClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await AsyncStorage.getItem('accessToken');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ============================================================
// RESPONSE INTERCEPTOR — Xử lý lỗi + refresh token
// ============================================================

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

axiosClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // Nếu lỗi 401 và chưa retry → thử refresh token
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Nếu đang refresh → đẩy request vào queue chờ
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return axiosClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await AsyncStorage.getItem('refreshToken');

        if (!refreshToken) {
          throw new Error('No refresh token');
        }

        // Gọi API refresh token (dùng axios gốc, không dùng axiosClient để tránh loop)
        const { data } = await axios.post(`${baseURL}/auth/refresh-token`, {
          refreshToken,
        });

        const newAccessToken = data.data.accessToken;

        // Lưu token mới
        await AsyncStorage.setItem('accessToken', newAccessToken);

        // Xử lý queue đang chờ
        processQueue(null, newAccessToken);

        // Retry request gốc
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }

        return axiosClient(originalRequest);
      } catch (refreshError) {
        // Refresh thất bại → xóa token, buộc đăng nhập lại
        processQueue(refreshError, null);
        await AsyncStorage.removeItem('accessToken');
        await AsyncStorage.removeItem('refreshToken');
        // Reset auth state trong Zustand store
        try {
          const { useAuthStore } = require('../store/useAuthStore');
          useAuthStore.getState().clearAuth();
        } catch {}
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Xử lý các lỗi khác
    if (!error.response) {
      // Network error
      return Promise.reject(new Error('Không có kết nối mạng. Vui lòng kiểm tra lại.'));
    }

    if (error.code === 'ECONNABORTED') {
      // Timeout
      return Promise.reject(new Error('Hết thời gian chờ. Vui lòng thử lại.'));
    }

    return Promise.reject(error);
  }
);

export default axiosClient;
