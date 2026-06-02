// Auth store dùng Zustand + expo-secure-store
import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import authApi from '../api/authApi';
import type { User } from '../types';

const TOKEN_KEY = 'accessToken';
const REFRESH_KEY = 'refreshToken';
const USER_KEY = 'user';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  register: (fullName: string, email: string, password: string, phone: string) => Promise<void>;
  verifyOTP: (email: string, otp: string) => Promise<void>;
  logout: () => Promise<void>;
  loadFromStorage: () => Promise<void>;
  setUser: (user: User) => void;
}

const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isLoading: true,
  isAuthenticated: false,

  // Đăng nhập
  login: async (email: string, password: string) => {
    const response = await authApi.login({ email, password });
    // Backend trả { success, message, data: { accessToken, refreshToken, user } }
    const { accessToken, refreshToken, user } = response.data.data;

    // Lưu vào SecureStore
    await SecureStore.setItemAsync(TOKEN_KEY, accessToken);
    await SecureStore.setItemAsync(REFRESH_KEY, refreshToken);
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));

    set({
      user,
      accessToken,
      refreshToken,
      isAuthenticated: true,
    });
  },

  // Đăng ký
  register: async (fullName: string, email: string, password: string, phone: string) => {
    await authApi.register({
      full_name: fullName,
      email,
      password,
      phone,
    });
  },

  // Xác thực OTP
  verifyOTP: async (email: string, otp: string) => {
    await authApi.verifyOTP({ email, otp });
  },

  // Đăng xuất
  logout: async () => {
    try {
      await authApi.logout();
    } catch {
      // Bỏ qua lỗi logout server
    }

    // Xóa khỏi SecureStore
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);

    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
    });
  },

  // Khôi phục session từ SecureStore khi app khởi động
  loadFromStorage: async () => {
    try {
      const [token, refresh, userStr] = await Promise.all([
        SecureStore.getItemAsync(TOKEN_KEY),
        SecureStore.getItemAsync(REFRESH_KEY),
        SecureStore.getItemAsync(USER_KEY),
      ]);

      if (token && refresh && userStr) {
        const user = JSON.parse(userStr) as User;
        set({
          user,
          accessToken: token,
          refreshToken: refresh,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  // Cập nhật thông tin user
  setUser: (user: User) => {
    SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
    set({ user });
  },
}));

export default useAuthStore;
