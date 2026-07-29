import axiosClient from "./axiosClient";
import type { AiChatHistoryItem } from "../types/user.types";

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface AiChatPayload {
  prompt: string;
  conversationId?: number;
}

const aiApi = {
  chat: async (payload: AiChatPayload) => {
    const response = await axiosClient.post<ApiResponse<{ response: string }>>(
      "/ai/chat",
      payload,
      { timeout: 30000 },
    );
    return response.data;
  },
  getHistory: async (afterId?: number) => {
    const params: Record<string, unknown> = {};
    if (afterId !== undefined) params.afterId = afterId;
    const response =
      await axiosClient.get<ApiResponse<AiChatHistoryItem[]>>("/ai/history", {
        params,
        timeout: 8000,
      });
    return response.data;
  },
  getLatestHistoryId: async () => {
    const response = await axiosClient.get<
      ApiResponse<{ latestHistoryId: number }>
    >("/ai/history/latest-id", { timeout: 8000 });
    return response.data;
  },
  clearHistory: async () => {
    const response = await axiosClient.delete<ApiResponse<null>>("/ai/history", { timeout: 8000 });
    return response.data;
  }
};

export default aiApi;
