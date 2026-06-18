import axiosClient from './axiosClient';
import {
  LoginRequest,
  RegisterRequest,
  OTPVerifyRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  GoogleLoginRequest,
  AuthResponse,
  ApiResponse,
} from '../types';

const authApi = {
  // Đăng nhập
  login: async (data: LoginRequest): Promise<AuthResponse> => {
    const response = await axiosClient.post('/auth/login', data);
    return response.data;
  },

  // Đăng ký
  register: async (data: RegisterRequest): Promise<ApiResponse> => {
    const response = await axiosClient.post('/auth/register', data);
    return response.data;
  },

  // Xác thực OTP
  verifyOTP: async (data: OTPVerifyRequest): Promise<ApiResponse> => {
    const response = await axiosClient.post('/auth/verify-otp', data);
    return response.data;
  },

  // Gửi lại OTP
  resendOTP: async (email: string): Promise<ApiResponse> => {
    const response = await axiosClient.post('/auth/resend-otp', { email });
    return response.data;
  },

  // Quên mật khẩu
  forgotPassword: async (data: ForgotPasswordRequest): Promise<ApiResponse> => {
    const response = await axiosClient.post('/auth/forgot-password', data);
    return response.data;
  },

  // Đặt lại mật khẩu
  resetPassword: async (data: ResetPasswordRequest): Promise<ApiResponse> => {
    const response = await axiosClient.post('/auth/reset-password', data);
    return response.data;
  },

  // Đăng nhập Google
  googleLogin: async (data: GoogleLoginRequest): Promise<AuthResponse> => {
    const response = await axiosClient.post('/auth/google', data);
    return response.data;
  },

  // Đăng xuất
  logout: async (): Promise<ApiResponse> => {
    const response = await axiosClient.post('/auth/logout');
    return response.data;
  },

  // Lấy thông tin user hiện tại
  getProfile: async (): Promise<ApiResponse> => {
    const response = await axiosClient.get('/auth/profile');
    return response.data;
  },
};

export default authApi;
