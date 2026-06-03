import axiosClient from "./axiosClient";

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface LocationChatMessageItem {
  message_id: number;
  location_id: number;
  sender_id: number;
  sender_name: string;
  sender_role: string;
  content: string;
  created_at: string;
}

const locationChatApi = {
  getHistory: async (locationId: number) => {
    const response = await axiosClient.get<ApiResponse<LocationChatMessageItem[]>>(
      `/chat/location/${locationId}`
    );
    return response.data;
  },
  sendMessage: async (locationId: number, content: string) => {
    const response = await axiosClient.post<ApiResponse<LocationChatMessageItem>>(
      `/chat/location/${locationId}`,
      { content }
    );
    return response.data;
  },
};

export default locationChatApi;
