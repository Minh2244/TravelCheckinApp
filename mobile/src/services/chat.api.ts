import { api } from "../lib/api";

export interface LocationChatMessageItem {
  message_id: number;
  location_id: number;
  customer_id: number;
  sender_id: number;
  sender_name: string;
  sender_role: string;
  content: string;
  image_data?: string | null;
  has_image?: boolean;
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

export const chatApi = {
  getHistory: async (locationId: number, customerId?: number) => {
    const response = await api.get<any>(`/chat/location/${locationId}`, {
      params: { customerId },
    });
    return response.data;
  },
  sendMessage: async (
    locationId: number,
    content: string,
    customerId?: number,
    imageData?: string | null
  ) => {
    const response = await api.post<any>(`/chat/location/${locationId}`, {
      content,
      customerId,
      imageData,
    });
    return response.data;
  },
  getSessions: async (locationId: number) => {
    const response = await api.get<any>(`/chat/location/${locationId}/sessions`);
    return response.data;
  },
};
