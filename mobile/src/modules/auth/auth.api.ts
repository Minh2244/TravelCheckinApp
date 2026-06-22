import { api } from "../../lib/api";
import type { AuthPayload, BasicResponse } from "./types";

export const authApi = {
  async login(payload: { email: string; password: string }) {
    const response = await api.post<AuthPayload>("/auth/login", payload);
    return response.data;
  },
  async register(payload: {
    email: string;
    phone: string;
    password: string;
    full_name: string;
  }) {
    const response = await api.post<BasicResponse>("/auth/register", payload);
    return response.data;
  },
  async verifyOTP(payload: { email: string; otp: string }) {
    const response = await api.post<BasicResponse>("/auth/verify-otp", payload);
    return response.data;
  },
  async forgotPassword(payload: { email: string; phone: string }) {
    const response = await api.post<BasicResponse>("/auth/forgot-password", payload);
    return response.data;
  },
  async verifyResetOTP(payload: { email: string; otp: string }) {
    const response = await api.post<BasicResponse>("/auth/verify-reset-otp", payload);
    return response.data;
  },
  async resetPassword(payload: { email: string; otp: string; newPassword: string }) {
    const response = await api.post<BasicResponse>("/auth/reset-password", payload);
    return response.data;
  },
  async logout() {
    const response = await api.post<BasicResponse>("/auth/logout");
    return response.data;
  },
  async checkSession() {
    const response = await api.get<BasicResponse>("/auth/session");
    return response.data;
  },
};
