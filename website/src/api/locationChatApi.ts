import axiosClient from "./axiosClient";

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface LocationChatMessageItem {
  message_id: number;
  location_id: number;
  customer_id: number;
  sender_id: number;
  sender_name: string;
  sender_role: string;
  content: string;
  image_data?: string | null;
  has_image?: boolean;           // Flag từ socket: tin nhắn có ảnh, cần fetch lại history
  created_at: string;
  customer_avatar?: string | null;
}

export interface LocationChatSessionItem {
  customerId: number;
  customerName: string;
  customerAvatar: string | null;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

const locationChatApi = {
  getHistory: async (locationId: number, customerId?: number) => {
    const response = await axiosClient.get<ApiResponse<LocationChatMessageItem[]>>(
      `/chat/location/${locationId}`,
      { params: { customerId } }
    );
    return response.data;
  },
  sendMessage: async (
    locationId: number,
    content: string,
    customerId?: number,
    imageData?: string | null
  ) => {
    const response = await axiosClient.post<ApiResponse<LocationChatMessageItem>>(
      `/chat/location/${locationId}`,
      { content, customerId, imageData }
    );
    return response.data;
  },
  getActiveSessions: async (locationId: number) => {
    const response = await axiosClient.get<ApiResponse<LocationChatSessionItem[]>>(
      `/chat/location/${locationId}/sessions`
    );
    return response.data;
  },
};


export default locationChatApi;
