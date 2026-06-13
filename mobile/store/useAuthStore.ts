/**
 * Auth Store — Quản lý trạng thái đăng nhập (Zustand)
 * TravelCheckinApp Mobile
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi, userApi } from '../api/endpoints';
import type { User } from '../types';

interface AuthState {
  // State
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, phone: string, password: string, fullName: string) => Promise<{
    success: boolean;
    message?: string;
  }>;
  verifyOtp: (email: string, otp: string) => Promise<{ success: boolean; message?: string }>;
  forgotPassword: (email: string, phone: string) => Promise<{ success: boolean; message?: string }>;
  verifyResetOtp: (email: string, otp: string) => Promise<{ success: boolean; message?: string }>;
  resetPassword: (
    email: string,
    otp: string,
    newPassword: string
  ) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  loadSession: () => Promise<void>;
  clearError: () => void;
  clearAuth: () => void;
}

const useAuthStore = create<AuthState>((set) => ({
  // ============================================================
  // INITIAL STATE
  // ============================================================
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  // ============================================================
  // LOGIN
  // ============================================================
  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });

    try {
      const response = await authApi.login(email, password);
      const { user, accessToken, refreshToken } = response.data;

      // Lưu token vào AsyncStorage
      await AsyncStorage.setItem('accessToken', accessToken);
      await AsyncStorage.setItem('refreshToken', refreshToken);

      set({
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (error as Error)?.message ||
        'Đăng nhập thất bại';

      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: message,
      });

      throw error;
    }
  },

  // ============================================================
  // REGISTER
  // ============================================================
  register: async (email: string, phone: string, password: string, fullName: string) => {
    set({ isLoading: true, error: null });

    try {
      const response = await authApi.register({
        email,
        phone,
        password,
        full_name: fullName,
      });

      set({ isLoading: false, error: null });
      return { success: true, message: response.message };
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Đăng ký thất bại';

      set({ isLoading: false, error: message });
      return { success: false, message };
    }
  },

  // ============================================================
  // VERIFY OTP
  // ============================================================
  verifyOtp: async (email: string, otp: string) => {
    set({ isLoading: true, error: null });

    try {
      const response = await authApi.verifyOtp(email, otp);
      set({ isLoading: false, error: null });
      return { success: true, message: response.message };
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Xác nhận OTP thất bại';

      set({ isLoading: false, error: message });
      return { success: false, message };
    }
  },

  // ============================================================
  // FORGOT PASSWORD
  // ============================================================
  forgotPassword: async (email: string, phone: string) => {
    set({ isLoading: true, error: null });

    try {
      const response = await authApi.forgotPassword(email, phone);
      set({ isLoading: false, error: null });
      return { success: true, message: response.message };
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Gửi OTP thất bại';

      set({ isLoading: false, error: message });
      return { success: false, message };
    }
  },

  // ============================================================
  // VERIFY RESET OTP
  // ============================================================
  verifyResetOtp: async (email: string, otp: string) => {
    set({ isLoading: true, error: null });

    try {
      const response = await authApi.verifyResetOtp(email, otp);
      set({ isLoading: false, error: null });
      return { success: true, message: response.message };
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Xác nhận OTP thất bại';

      set({ isLoading: false, error: message });
      return { success: false, message };
    }
  },

  // ============================================================
  // RESET PASSWORD
  // ============================================================
  resetPassword: async (email: string, otp: string, newPassword: string) => {
    set({ isLoading: true, error: null });

    try {
      const response = await authApi.resetPassword(email, otp, newPassword);
      set({ isLoading: false, error: null });
      return { success: true, message: response.message };
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Đặt lại mật khẩu thất bại';

      set({ isLoading: false, error: message });
      return { success: false, message };
    }
  },

  // ============================================================
  // LOGOUT
  // ============================================================
  logout: async () => {
    try {
      await authApi.logout();
    } catch {
      // Không quan tâm lỗi logout trên server
    }

    // Xóa token khỏi AsyncStorage
    await AsyncStorage.removeItem('accessToken');
    await AsyncStorage.removeItem('refreshToken');

    set({
      user: null,
      isAuthenticated: false,
      error: null,
    });
  },

  // Xóa auth state (không gọi API) - dùng khi refresh token thất bại
  clearAuth: () => {
    set({
      user: null,
      isAuthenticated: false,
      error: null,
    });
  },

  // ============================================================
  // LOAD SESSION (khi mở app)
  // ============================================================
  loadSession: async () => {
    set({ isLoading: true });

    try {
      const accessToken = await AsyncStorage.getItem('accessToken');

      if (!accessToken) {
        set({ user: null, isAuthenticated: false, isLoading: false });
        return;
      }

      // Kiểm tra session còn hợp lệ không
      await authApi.checkSession();

      // Lấy thông tin user
      const profileResponse = await userApi.getProfile();
      const user = profileResponse.data;

      set({
        user,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch {
      // Token không hợp lệ → xóa
      await AsyncStorage.removeItem('accessToken');
      await AsyncStorage.removeItem('refreshToken');

      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  // ============================================================
  // CLEAR ERROR
  // ============================================================
  clearError: () => {
    set({ error: null });
  },
}));

export default useAuthStore;
