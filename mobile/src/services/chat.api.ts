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
  is_read?: number | boolean;
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
  getHistory: async (locationId: number, customerId?: number, afterId?: number, limit?: number) => {
    const response = await api.get<any>(`/chat/location/${locationId}`, {
      params: { customerId, afterId, limit },
    });
    return response.data;
  },
  getMessageImage: async (locationId: number, messageId: number) => {
    const response = await api.get<any>(`/chat/location/${locationId}/message/${messageId}/image`);
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
  chatWithAi: async (prompt: string, conversationId?: number, context?: any) => {
    const response = await api.post<any>("/ai/chat", {
      prompt,
      conversationId,
      context,
    });
    return response.data;
  },
  getAiHistory: async (afterId?: number) => {
    const response = await api.get<any>("/ai/history", { params: { afterId } });
    return response.data;
  },
  clearAiHistory: async () => {
    const response = await api.delete<any>("/ai/history");
    return response.data;
  },
  getUnreadCounts: async () => {
    const response = await api.get<any>("/chat/unread-counts");
    return response.data;
  },
  getUnreadCountsByLocation: async (locationId: number) => {
    const response = await api.get<any>("/chat/unread-counts", {
      params: { locationId },
    });
    return response.data;
  },
  markRead: async (locationId: number, customerId?: number) => {
    const response = await api.post<any>(`/chat/location/${locationId}/mark-read`, { customerId });
    return response.data;
  },
  clearHistory: async (locationId: number, customerId?: number) => {
    const response = await api.delete<any>(`/chat/location/${locationId}/clear`, {
      params: { customerId },
    });
    return response.data;
  },
};
