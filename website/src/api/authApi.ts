import axiosClient from "./axiosClient";

export interface SocialLoginRequest {
  provider: "google" | "facebook";
  socialId: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
}

export interface User {
  user_id: number;
  email: string;
  phone: string | null;
  full_name: string;
  role: "user" | "owner" | "employee" | "admin";
  avatar_url: string | null;
  is_verified: number;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  warning?: string;
  data: {
    user: User;
    accessToken: string;
    refreshToken: string;
    redirectUrl: string;
  };
}

const socialLogin = async (data: SocialLoginRequest): Promise<AuthResponse> => {
  console.log("📤 Sending to backend:", data); // ⭐ THÊM LOG NÀY
  const response = await axiosClient.post("/auth/social-login", data);
  return response.data;
};

const authApi = {
  login: async (data: Record<string, unknown>) => {
    const response = await axiosClient.post("/auth/login", data);
    return response.data;
  },
  socialLogin,
  register: async (data: Record<string, unknown>) => {
    const response = await axiosClient.post("/auth/register", data);
    return response.data;
  },
  verifyOTP: async (data: Record<string, unknown>) => {
    const response = await axiosClient.post("/auth/verify-otp", data);
    return response.data;
  },
  forgotPassword: async (data: Record<string, unknown>) => {
    const response = await axiosClient.post("/auth/forgot-password", data);
    return response.data;
  },
  verifyResetOTP: async (data: Record<string, unknown>) => {
    const response = await axiosClient.post("/auth/verify-reset-otp", data);
    return response.data;
  },
  resetPassword: async (data: Record<string, unknown>) => {
    const response = await axiosClient.post("/auth/reset-password", data);
    return response.data;
  },
  logout: async () => {
    const response = await axiosClient.post("/auth/logout");
    return response.data;
  },
  refreshToken: async (refreshToken: string) => {
    const response = await axiosClient.post("/auth/refresh-token", {
      refreshToken,
    });
    return response.data;
  },
  getLoginBackground: async () => {
    const response = await axiosClient.get("/auth/background");
    return response.data;
  },
  getAppBackground: async () => {
    const response = await axiosClient.get("/auth/app-background");
    return response.data;
  },
  confirmOwnerTerms: async (token: string) => {
    const response = await axiosClient.get("/auth/owner-terms/confirm", {
      params: { token },
    });
    return response.data;
  },
  checkSession: async () => {
    const response = await axiosClient.get("/auth/session");
    return response.data;
  },
};

export default authApi;
