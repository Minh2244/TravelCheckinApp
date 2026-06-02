import axiosClient from "./axiosClient";
import type { AiChatHistoryItem } from "../types/user.types";

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface AiChatPayload {
  prompt: string;
}

const aiApi = {
  chat: async (payload: AiChatPayload) => {
    const response = await axiosClient.post<ApiResponse<{ response: string }>>(
      "/ai/chat",
      payload,
    );
    return response.data;
  },
  getHistory: async () => {
    const response =
      await axiosClient.get<ApiResponse<AiChatHistoryItem[]>>("/ai/history");
    return response.data;
  },
};

export default aiApi;
