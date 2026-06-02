// Auth API calls
import axiosClient from './axiosClient';
import type { ApiResponse, LoginResponse, User } from '../types';

export interface LoginParams {
  email: string;
  password: string;
}

export interface RegisterParams {
  full_name: string;
  email: string;
  password: string;
  phone: string;
}

export interface VerifyOTPParams {
  email: string;
  otp: string;
}

export interface SocialLoginParams {
  provider: 'google' | 'facebook';
  socialId: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
}

export interface ForgotPasswordParams {
  email: string;
}

export interface ResetPasswordParams {
  email: string;
  otp: string;
  newPassword: string;
}

const authApi = {
  // Đăng nhập bằng email/password
  login: (params: LoginParams) =>
    axiosClient.post<ApiResponse<LoginResponse>>('/auth/login', params),

  // Đăng ký tài khoản mới
  register: (params: RegisterParams) =>
    axiosClient.post('/auth/register', params),

  // Xác thực OTP sau đăng ký
  verifyOTP: (params: VerifyOTPParams) =>
    axiosClient.post('/auth/verify-otp', params),

  // Đăng nhập bằng mạng xã hội
  socialLogin: (params: SocialLoginParams) =>
    axiosClient.post<ApiResponse<LoginResponse>>('/auth/social-login', params),

  // Quên mật khẩu - gửi OTP
  forgotPassword: (params: ForgotPasswordParams) =>
    axiosClient.post('/auth/forgot-password', params),

  // Xác thực OTP đặt lại mật khẩu
  verifyResetOTP: (params: VerifyOTPParams) =>
    axiosClient.post('/auth/verify-reset-otp', params),

  // Đặt lại mật khẩu mới
  resetPassword: (params: ResetPasswordParams) =>
    axiosClient.post('/auth/reset-password', params),

  // Đăng xuất
  logout: () => axiosClient.post('/auth/logout'),

  // Kiểm tra session hiện tại
  checkSession: () => axiosClient.get<{ user: User }>('/auth/session'),

  // Làm mới token
  refreshToken: (refreshToken: string) =>
    axiosClient.post<{ accessToken: string; refreshToken: string }>(
      '/auth/refresh-token',
      { refreshToken }
    ),
};

export default authApi;
