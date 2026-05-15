// website/src/api/adminApi.ts
import axiosClient from "./axiosClient";

interface CommissionSummary {
  total_pending: number;
  total_paid: number;
  total_overdue: number;
}

type QueryParams = Record<string, string | number | boolean | null | undefined>;
type JsonBody = Record<string, unknown>;

const adminApi = {
  // Admin bank (platform bank for owner commission payments)
  getAdminBank: async () => {
    const response = await axiosClient.get("/admin/bank");
    return response.data;
  },
  updateAdminBank: async (data: {
    bank_name: string;
    bank_account: string;
    bank_holder: string;
    bank_bin?: string;
    contact_info?: string;
  }) => {
    const response = await axiosClient.put("/admin/bank", data);
    return response.data;
  },

  // Admin Profile
  getAdminProfile: async () => {
    const response = await axiosClient.get("/admin/profile");
    return response.data;
  },
  uploadAdminAvatar: async (file: File) => {
    const formData = new FormData();
    formData.append("avatar", file);
    // NOTE: Do not set Content-Type manually for FormData.
    // Axios/browser will set the correct multipart boundary.
    const response = await axiosClient.post("/admin/profile/avatar", formData);
    return response.data;
  },
  getAdminAvatarCurrentUrl: async (): Promise<string | null> => {
    const response = await axiosClient.get("/admin/profile/avatar/current", {
      validateStatus: (status) => status === 200 || status === 204,
    });
    if (response.status === 204) return null;
    const url = response.data?.data?.avatar_url as string | null | undefined;
    return url || null;
  },
  updateAdminProfile: async (data: {
    full_name: string;
    phone?: string | null;
    avatar_url?: string | null;
    skip_avatar?: boolean;
  }) => {
    const response = await axiosClient.put("/admin/profile", data);
    return response.data;
  },
  changeAdminPassword: async (data: {
    current_password: string;
    new_password: string;
  }) => {
    const response = await axiosClient.put("/admin/profile/password", data);
    return response.data;
  },
  getAdminLoginHistory: async (params?: { page?: number; limit?: number }) => {
    const response = await axiosClient.get("/admin/profile/login-history", {
      params,
    });
    return response.data;
  },

  // Background images (app/login)
  uploadBackgroundImage: async (
    type: "app" | "login",
    file: File,
    options?: { apply?: boolean },
  ) => {
    const formData = new FormData();
    formData.append("image", file);
    formData.append("type", type);
    if (options?.apply === false) {
      formData.append("apply", "0");
    }
    // NOTE: Do not set Content-Type manually for FormData.
    // Axios/browser will set the correct multipart boundary.
    const response = await axiosClient.post(
      "/admin/backgrounds/upload",
      formData,
    );
    return response.data;
  },
  setBackgroundUrl: async (type: "app" | "login", url: string) => {
    const response = await axiosClient.post("/admin/backgrounds/url", {
      type,
      url,
    });
    return response.data;
  },

  // Dashboard
  getDashboardStats: async (params?: QueryParams) => {
    const response = await axiosClient.get("/admin/dashboard/stats", {
      params,
    });
    return response.data;
  },
  getLocationCheckinHistory: async (
    locationId: number,
    params?: QueryParams,
  ) => {
    const response = await axiosClient.get(
      `/admin/locations/${locationId}/checkins/history`,
      { params },
    );
    return response.data;
  },
  getLocationPosPaymentsHistory: async (
    locationId: number,
    params?: QueryParams,
  ) => {
    const response = await axiosClient.get(
      `/admin/locations/${locationId}/pos/payments-history`,
      { params },
    );
    return response.data;
  },
  getLocationTouristTicketInvoices: async (
    locationId: number,
    params?: QueryParams,
  ) => {
    const response = await axiosClient.get(
      `/admin/locations/${locationId}/tourist/tickets/invoices`,
      { params },
    );
    return response.data;
  },
  getOwnerRevenueSummary: async (ownerId: number, params?: QueryParams) => {
    const response = await axiosClient.get(
      `/admin/owners/${ownerId}/revenue-summary`,
      { params },
    );
    return response.data;
  },
  getCheckinAnalytics: async (params?: { from?: string; to?: string }) => {
    const response = await axiosClient.get("/admin/analytics/checkins", {
      params,
    });
    return response.data;
  },

  // Quản lý User
  getUsers: async (params?: QueryParams) => {
    const response = await axiosClient.get("/admin/users", { params });
    return response.data;
  },
  getUserById: async (id: number) => {
    const response = await axiosClient.get(`/admin/users/${id}`);
    return response.data;
  },
  getUserLoginHistory: async (
    id: number,
    params?: { page?: number; limit?: number },
  ) => {
    const response = await axiosClient.get(`/admin/users/${id}/login-history`, {
      params,
    });
    return response.data;
  },
  getUserTravelHistory: async (
    id: number,
    params?: { page?: number; limit?: number },
  ) => {
    const response = await axiosClient.get(
      `/admin/users/${id}/travel-history`,
      {
        params,
      },
    );
    return response.data;
  },
  getUserReviewHistory: async (
    id: number,
    params?: { page?: number; limit?: number },
  ) => {
    const response = await axiosClient.get(
      `/admin/users/${id}/review-history`,
      {
        params,
      },
    );
    return response.data;
  },
  getUserFavorites: async (
    id: number,
    params?: { page?: number; limit?: number },
  ) => {
    const response = await axiosClient.get(`/admin/users/${id}/favorites`, {
      params,
    });
    return response.data;
  },
  updateUserStatus: async (id: number, status: string) => {
    const response = await axiosClient.put(`/admin/users/${id}/status`, {
      status,
    });
    return response.data;
  },
  promoteUserToOwner: async (id: number) => {
    const response = await axiosClient.put(`/admin/users/${id}/promote-owner`);
    return response.data;
  },
  deleteUser: async (id: number) => {
    const response = await axiosClient.delete(`/admin/users/${id}`);
    return response.data;
  },

  // Quản lý Owner
  getOwners: async (params?: QueryParams) => {
    const response = await axiosClient.get("/admin/owners", { params });
    return response.data;
  },
  getOwnerById: async (id: number) => {
    const response = await axiosClient.get(`/admin/owners/${id}`);
    return response.data;
  },
  getOwnerEmployees: async (id: number) => {
    const response = await axiosClient.get(`/admin/owners/${id}/employees`);
    return response.data;
  },
  getOwnerViolations: async (
    id: number,
    params?: { page?: number; limit?: number },
  ) => {
    const response = await axiosClient.get(`/admin/owners/${id}/violations`, {
      params,
    });
    return response.data;
  },
  createOwnerViolation: async (
    id: number,
    data: { title: string; description?: string | null; severity?: string },
  ) => {
    const response = await axiosClient.post(
      `/admin/owners/${id}/violations`,
      data,
    );
    return response.data;
  },
  sendOwnerTermsEmail: async (id: number) => {
    const response = await axiosClient.post(`/admin/owners/${id}/send-terms`);
    return response.data;
  },
  markOwnerTermsAccepted: async (
    id: number,
    data?: { ip?: string; user_agent?: string },
  ) => {
    const response = await axiosClient.put(
      `/admin/owners/${id}/terms-accepted`,
      data || {},
    );
    return response.data;
  },
  approveOwner: async (id: number) => {
    const response = await axiosClient.put(`/admin/owners/${id}/approve`);
    return response.data;
  },
  rejectOwner: async (id: number, reason?: string) => {
    const response = await axiosClient.put(`/admin/owners/${id}/reject`, {
      reason,
    });
    return response.data;
  },
  updateOwnerStatus: async (id: number, status: string) => {
    const response = await axiosClient.put(`/admin/owners/${id}/status`, {
      status,
    });
    return response.data;
  },
  getOwnerLocations: async (id: number) => {
    const response = await axiosClient.get(`/admin/owners/${id}/locations`);
    return response.data;
  },
  deleteOwner: async (id: number) => {
    const response = await axiosClient.delete(`/admin/owners/${id}`);
    return response.data;
  },
  approveLocation: async (id: number) => {
    const response = await axiosClient.put(`/admin/locations/${id}/approve`);
    return response.data;
  },
  rejectLocation: async (id: number, reason?: string) => {
    const response = await axiosClient.put(`/admin/locations/${id}/reject`, {
      reason,
    });
    return response.data;
  },
  hideLocation: async (id: number) => {
    const response = await axiosClient.put(`/admin/locations/${id}/hide`);
    return response.data;
  },
  updateLocationCommissionRate: async (id: number, new_rate: number) => {
    const response = await axiosClient.put(
      `/admin/locations/${id}/commission-rate`,
      { new_rate },
    );
    return response.data;
  },
  deleteLocation: async (id: number) => {
    const response = await axiosClient.delete(`/admin/locations/${id}`);
    return response.data;
  },

  // Duyệt địa điểm (Admin)
  getLocations: async (params?: QueryParams) => {
    const response = await axiosClient.get(`/admin/locations`, { params });
    return response.data;
  },

  // Owner vouchers (Admin approval)
  getOwnerVouchers: async (params?: QueryParams) => {
    const response = await axiosClient.get("/admin/owner-vouchers", { params });
    return response.data;
  },
  updateOwnerVoucherStatus: async (
    id: number,
    data: { status: "active" | "inactive" },
  ) => {
    const response = await axiosClient.put(
      `/admin/owner-vouchers/${id}/status`,
      data,
    );
    return response.data;
  },
  reviewOwnerVoucher: async (
    id: number,
    data: {
      action: "approve" | "reject" | "hide" | "activate" | "deactivate";
      reason?: string;
    },
  ) => {
    const response = await axiosClient.put(
      `/admin/owner-vouchers/${id}/review`,
      data,
    );
    return response.data;
  },
  updateOwnerVoucher: async (id: number, data: JsonBody) => {
    const response = await axiosClient.put(`/admin/owner-vouchers/${id}`, data);
    return response.data;
  },
  deleteOwnerVoucher: async (id: number) => {
    const response = await axiosClient.delete(`/admin/owner-vouchers/${id}`);
    return response.data;
  },
  getLocationDuplicates: async (params?: {
    distance?: number;
    similarity?: number;
  }) => {
    const response = await axiosClient.get("/admin/locations/duplicates", {
      params,
    });
    return response.data;
  },

  // Voucher locations (for multi-location scope)
  getVoucherLocations: async (id: number) => {
    const response = await axiosClient.get(`/admin/vouchers/${id}/locations`);
    return response.data;
  },
  mergeLocations: async (payload: { source_id: number; target_id: number }) => {
    const response = await axiosClient.post("/admin/locations/merge", payload);
    return response.data;
  },

  // Quản lý Check-in
  getCheckins: async (params?: QueryParams) => {
    const response = await axiosClient.get("/admin/checkins", { params });
    return response.data;
  },
  getCheckinById: async (id: number) => {
    const response = await axiosClient.get(`/admin/checkins/${id}`);
    return response.data;
  },
  verifyCheckin: async (id: number, notes?: string) => {
    const response = await axiosClient.put(`/admin/checkins/${id}/verify`, {
      notes,
    });
    return response.data;
  },
  failCheckin: async (id: number, reason?: string) => {
    const response = await axiosClient.put(`/admin/checkins/${id}/fail`, {
      reason,
    });
    return response.data;
  },
  toggleCheckinLock: async (id: number, notes?: string) => {
    const response = await axiosClient.put(
      `/admin/checkins/${id}/toggle-lock`,
      {
        notes,
      },
    );
    return response.data;
  },
  updateCheckinLocationStatus: async (
    id: number,
    status: "active" | "inactive",
  ) => {
    const response = await axiosClient.put(
      `/admin/checkins/${id}/location-status`,
      { status },
    );
    return response.data;
  },
  deleteCheckin: async (id: number) => {
    const response = await axiosClient.delete(`/admin/checkins/${id}`);
    return response.data;
  },

  // Quản lý Commission
  getCommissions: async (params?: Record<string, string | number>) => {
    const response = await axiosClient.get("/admin/commissions", { params });
    return response.data as {
      success: boolean;
      data: unknown;
      pagination?: { total?: number; page?: number; limit?: number };
      summary?: CommissionSummary;
    };
  },
  exportCommissionsCsv: async (params?: {
    status?: string;
    from?: string;
    to?: string;
  }): Promise<Blob> => {
    const response = await axiosClient.get("/admin/commissions", {
      params: { ...(params || {}), export: "csv" },
      responseType: "blob",
    });
    return response.data as Blob;
  },
  getCommissionDetails: async (id: number) => {
    const response = await axiosClient.get(`/admin/commissions/${id}`);
    return response.data;
  },
  deleteCommission: async (id: number) => {
    const response = await axiosClient.delete(`/admin/commissions/${id}`);
    return response.data;
  },
  updateCommissionRate: async (data: {
    owner_id: number;
    new_rate: number;
    reason?: string;
  }) => {
    const response = await axiosClient.put("/admin/commissions/rate", data);
    return response.data;
  },
  getCommissionHistory: async (
    ownerId: number,
    params?: { page?: number; limit?: number },
  ) => {
    const response = await axiosClient.get(
      `/admin/owners/${ownerId}/commission-history`,
      { params },
    );
    return response.data;
  },
  remindCommission: async (id: number) => {
    const response = await axiosClient.post(`/admin/commissions/${id}/remind`);
    return response.data;
  },
  hideCommissionLocation: async (id: number) => {
    const response = await axiosClient.put(
      `/admin/commissions/${id}/hide-location`,
    );
    return response.data;
  },
  lockCommissionOwner: async (id: number) => {
    const response = await axiosClient.put(
      `/admin/commissions/${id}/lock-owner`,
    );
    return response.data;
  },

  markCommissionsPaid: async (payload: { commission_ids: number[] }) => {
    const response = await axiosClient.post(
      "/admin/commissions/mark-paid",
      payload,
    );
    return response.data;
  },

  getCommissionPaymentRequests: async (params?: {
    page?: number;
    limit?: number;
  }) => {
    const response = await axiosClient.get(
      "/admin/commission-payment-requests",
      { params },
    );
    return response.data;
  },

  confirmCommissionPaymentRequest: async (requestId: number) => {
    const response = await axiosClient.post(
      `/admin/commission-payment-requests/${requestId}/confirm`,
    );
    return response.data;
  },

  // Quản lý Reports
  getReports: async (params?: QueryParams) => {
    const response = await axiosClient.get("/admin/reports", { params });
    return response.data;
  },

  // Export reports CSV (backend là nguồn sự thật, FE chỉ tải file)
  exportReportsCsv: async (params?: {
    status?: string;
    report_type?: string;
    severity?: string;
    from?: string;
    to?: string;
  }): Promise<Blob> => {
    const response = await axiosClient.get("/admin/reports", {
      params: { ...(params || {}), export: "csv" },
      responseType: "blob",
    });
    return response.data as Blob;
  },
  getReportById: async (id: number) => {
    const response = await axiosClient.get(`/admin/reports/${id}`);
    return response.data;
  },
  resolveReport: async (
    id: number,
    data: {
      status: string;
      resolution_notes?: string;
      enforcement?: "none" | "ban";
    },
  ) => {
    const response = await axiosClient.put(
      `/admin/reports/${id}/resolve`,
      data,
    );
    return response.data;
  },
  updateReportLockStatus: async (
    id: number,
    status: "pending" | "reviewing",
  ) => {
    const response = await axiosClient.put(`/admin/reports/${id}/lock`, {
      status,
    });
    return response.data;
  },
  remindReport: async (
    id: number,
    data?: { title?: string; body?: string },
  ) => {
    const response = await axiosClient.post(
      `/admin/reports/${id}/remind`,
      data || {},
    );
    return response.data;
  },
  deleteReport: async (id: number) => {
    const response = await axiosClient.delete(`/admin/reports/${id}`);
    return response.data;
  },
  warnReportedUser: async (
    id: number,
    data?: { title?: string; body?: string },
  ) => {
    const response = await axiosClient.post(
      `/admin/reports/${id}/warn-user`,
      data || {},
    );
    return response.data;
  },
  warnReportedOwner: async (
    id: number,
    data?: { title?: string; body?: string },
  ) => {
    const response = await axiosClient.post(
      `/admin/reports/${id}/warn-owner`,
      data || {},
    );
    return response.data;
  },
  deleteReportedReview: async (id: number) => {
    const response = await axiosClient.post(
      `/admin/reports/${id}/delete-review`,
    );
    return response.data;
  },

  getReviews: async (params?: QueryParams) => {
    const response = await axiosClient.get("/admin/reviews", { params });
    return response.data;
  },

  deleteReview: async (id: number) => {
    const response = await axiosClient.delete(`/admin/reviews/${id}`);
    return response.data;
  },

  reportReviewUser: async (id: number, data?: { reason?: string }) => {
    const response = await axiosClient.post(
      `/admin/reviews/${id}/report-user`,
      data || {},
    );
    return response.data;
  },

  deleteOwnerReply: async (id: number) => {
    const response = await axiosClient.delete(`/admin/reviews/${id}/reply`);
    return response.data;
  },

  reportOwnerReply: async (id: number, data?: { reason?: string }) => {
    const response = await axiosClient.post(
      `/admin/reviews/${id}/report-owner`,
      data || {},
    );
    return response.data;
  },

  // System Logs
  getSystemLogs: async (params?: QueryParams) => {
    const response = await axiosClient.get("/admin/logs", { params });
    return response.data;
  },

  getOwnerChatHistory: async (params?: {
    page?: number;
    limit?: number;
    owner_id?: number;
    user_id?: number;
    from?: string;
    to?: string;
  }) => {
    const response = await axiosClient.get("/admin/chat-history", { params });
    return response.data;
  },

  exportSystemLogsCsv: async (params?: {
    user_id?: number;
    action?: string;
    from?: string;
    to?: string;
  }): Promise<Blob> => {
    const response = await axiosClient.get("/admin/logs", {
      params: { ...(params || {}), export: "csv" },
      responseType: "blob",
    });
    return response.data as Blob;
  },

  // System Settings
  getSystemSettings: async () => {
    const response = await axiosClient.get("/admin/settings");
    return response.data;
  },
  updateSystemSettings: async (settings: JsonBody) => {
    const response = await axiosClient.put("/admin/settings", settings);
    return response.data;
  },

  // AI Management
  getAiSettings: async () => {
    const response = await axiosClient.get("/admin/ai/settings");
    return response.data;
  },
  updateAiSettings: async (
    data: Record<string, string | number | boolean | null>,
  ) => {
    const response = await axiosClient.put("/admin/ai/settings", data);
    return response.data;
  },
  getAiChatHistory: async (params?: {
    page?: number;
    limit?: number;
    user_id?: number;
  }) => {
    const response = await axiosClient.get("/admin/ai/chat-history", {
      params,
    });
    return response.data;
  },

  // Background schedules
  getBackgroundSchedules: async (params?: {
    page?: number;
    limit?: number;
  }) => {
    const response = await axiosClient.get("/admin/backgrounds", { params });
    return response.data;
  },
  createBackgroundSchedule: async (data: {
    title: string;
    image_url: string;
    start_date: string;
    end_date: string;
    is_active?: boolean;
  }) => {
    const response = await axiosClient.post("/admin/backgrounds", data);
    return response.data;
  },
  updateBackgroundSchedule: async (
    id: number,
    data: {
      title?: string;
      image_url?: string;
      start_date?: string;
      end_date?: string;
      is_active?: boolean;
    },
  ) => {
    const response = await axiosClient.put(`/admin/backgrounds/${id}`, data);
    return response.data;
  },
  toggleBackgroundSchedule: async (id: number) => {
    const response = await axiosClient.put(`/admin/backgrounds/${id}/toggle`);
    return response.data;
  },
  deleteBackgroundSchedule: async (id: number) => {
    const response = await axiosClient.delete(`/admin/backgrounds/${id}`);
    return response.data;
  },

  // SOS Alerts
  getSosAlerts: async (params?: QueryParams) => {
    const response = await axiosClient.get("/admin/sos", { params });
    return response.data;
  },
  updateSosAlertStatus: async (
    id: number,
    status: "pending" | "processing" | "resolved",
  ) => {
    const response = await axiosClient.put(`/admin/sos/${id}/status`, {
      status,
    });
    return response.data;
  },

  // Owner Services (approval)
  getOwnerServices: async (params?: QueryParams) => {
    const response = await axiosClient.get("/admin/owner-services", { params });
    return response.data;
  },
  updateOwnerServiceApproval: async (
    id: number,
    data: { status: "approved" | "rejected"; reason?: string },
  ) => {
    const response = await axiosClient.put(
      `/admin/owner-services/${id}/status`,
      data,
    );
    return response.data;
  },
  bulkUpdateOwnerServiceApproval: async (data: {
    scope?: "ids" | "filter";
    status: "approved" | "rejected";
    reason?: string;
    service_ids?: number[];
    filter?: {
      status?: "pending" | "approved" | "rejected";
      search?: string;
      owner_ids?: number[];
      service_types?: string[];
    };
    exclude_service_ids?: number[];
  }) => {
    const response = await axiosClient.put(
      `/admin/owner-services/bulk-status`,
      data,
    );
    return response.data;
  },
  deleteOwnerService: async (id: number) => {
    const response = await axiosClient.delete(`/admin/owner-services/${id}`);
    return response.data;
  },

  // System Vouchers
  getSystemVouchers: async (params?: QueryParams) => {
    const response = await axiosClient.get("/admin/system-vouchers", {
      params,
    });
    return response.data;
  },
  createSystemVoucher: async (data: JsonBody) => {
    const response = await axiosClient.post("/admin/system-vouchers", data);
    return response.data;
  },
  updateSystemVoucher: async (id: number, data: JsonBody) => {
    const response = await axiosClient.put(
      `/admin/system-vouchers/${id}`,
      data,
    );
    return response.data;
  },
  deleteSystemVoucher: async (id: number) => {
    const response = await axiosClient.delete(`/admin/system-vouchers/${id}`);
    return response.data;
  },

  // Push Notifications
  getPushNotifications: async (params?: QueryParams) => {
    const response = await axiosClient.get("/admin/push-notifications", {
      params,
    });
    return response.data;
  },
  createPushNotification: async (data: {
    title: string;
    body: string;
    target_audience: "all_users" | "all_owners" | "specific_user";
    target_user_id?: number;
  }) => {
    const response = await axiosClient.post("/admin/push-notifications", data);
    return response.data;
  },
  deletePushNotification: async (id: number) => {
    const response = await axiosClient.delete(
      `/admin/push-notifications/${id}`,
    );
    return response.data;
  },
};

export default adminApi;
