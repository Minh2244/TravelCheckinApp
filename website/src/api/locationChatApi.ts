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
  has_image?: boolean;           // Tin nhắn có ảnh; frontend tải ảnh riêng theo message_id
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

const locationChatApi = {
  getHistory: async (
    locationId: number,
    customerId?: number,
    afterId?: number,
    beforeId?: number,
    limit?: number,
    includeImages = false,
    unreadOnly = false,
  ) => {
    const params: Record<string, unknown> = {};
    if (customerId !== undefined) params.customerId = customerId;
    if (afterId !== undefined) params.afterId = afterId;
    if (beforeId !== undefined) params.beforeId = beforeId;
    if (limit !== undefined) params.limit = limit;
    if (includeImages) params.includeImages = "1";
    if (unreadOnly) params.unreadOnly = "1";
    const response = await axiosClient.get<ApiResponse<LocationChatMessageItem[]>>(
      `/chat/location/${locationId}`,
      { params }
    );
    return response.data;
  },
  getMessageImage: async (locationId: number, messageId: number) => {
    const response = await axiosClient.get<
      ApiResponse<{ message_id: number; image_data: string }>
    >(`/chat/location/${locationId}/message/${messageId}/image`);
    return response.data;
  },
  getLatestMessageId: async (locationId: number, customerId?: number) => {
    const params: Record<string, unknown> = {};
    if (customerId !== undefined) params.customerId = customerId;
    const response = await axiosClient.get<
      ApiResponse<{ latestMessageId: number }>
    >(`/chat/location/${locationId}/latest-message-id`, { params });
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

  getUnreadCounts: async () => {
    const response = await axiosClient.get<ApiResponse<{ ownerUnread: number; userUnread: number }>>(
      "/chat/unread-counts"
    );
    return response.data;
  },
  markRead: async (locationId: number, customerId?: number) => {
    const response = await axiosClient.post<ApiResponse<void>>(
      `/chat/location/${locationId}/mark-read`,
      { customerId }
    );
    return response.data;
  },
  deleteMessage: async (locationId: number, messageId: number) => {
    const response = await axiosClient.delete<ApiResponse<void>>(
      `/chat/location/${locationId}/message/${messageId}`
    );
    return response.data;
  },
  clearHistory: async (locationId: number, customerId: number) => {
    const response = await axiosClient.delete<ApiResponse<void>>(
      `/chat/location/${locationId}/clear?customerId=${customerId}`
    );
    return response.data;
  }
};

export default locationChatApi;
