import axiosClient from "./axiosClient";

export type OwnerRole = "owner" | "employee";

export type OwnerLocationStatus = "active" | "inactive" | "pending";

export interface OwnerMeResponse {
  success: boolean;
  data: {
    actor: {
      user_id: number;
      email: string | null;
      phone: string | null;
      full_name: string;
      avatar_url: string | null;
      role: OwnerRole;
      status: string;
      created_at: string;
    } | null;
    owner_id: number;
    owner_profile: unknown;
    employee_context?: {
      location_id: number;
      owner_id: number;
      permissions: unknown;
      position?: string | null;
      location_name?: string | null;
      location_type?: string | null;
    } | null;
  };
}

const ownerApi = {
  getMe: async (): Promise<OwnerMeResponse> => {
    const res = await axiosClient.get<OwnerMeResponse>("/owner/me");
    return res.data;
  },

  getProfile: async () => {
    const res = await axiosClient.get("/owner/profile");
    return res.data;
  },

  updateProfile: async (payload: {
    full_name: string;
    phone?: string | null;
    avatar_url?: string | null;
    skip_avatar?: boolean;
  }) => {
    const res = await axiosClient.put("/owner/profile", payload);
    return res.data;
  },

  uploadAvatar: async (file: File) => {
    const fd = new FormData();
    fd.append("avatar", file);
    const res = await axiosClient.post("/owner/profile/avatar", fd);
    return res.data;
  },

  uploadBackground: async (file: File) => {
    const fd = new FormData();
    fd.append("background", file);
    const res = await axiosClient.post("/owner/profile/background", fd);
    return res.data;
  },

  uploadServiceImage: async (file: File) => {
    const fd = new FormData();
    fd.append("image", file);
    const res = await axiosClient.post("/owner/services/upload-image", fd);
    return res.data;
  },

  getLoginHistory: async (limit = 50) => {
    const res = await axiosClient.get("/owner/profile/login-history", {
      params: { limit },
    });
    return res.data;
  },

  getAuditLogs: async (limit = 100) => {
    const res = await axiosClient.get("/owner/profile/audit-logs", {
      params: { limit },
    });
    return res.data;
  },

  getBank: async () => {
    const res = await axiosClient.get("/owner/bank");
    return res.data;
  },

  updateBank: async (payload: {
    bank_account: string;
    bank_name: string;
    account_holder: string;
    contact_info?: string | null;
  }) => {
    const res = await axiosClient.put("/owner/bank", payload);
    return res.data;
  },

  getAdminBankInfo: async () => {
    const res = await axiosClient.get("/owner/admin-bank");
    return res.data;
  },

  getLocations: async (params?: {
    status?: OwnerLocationStatus;
    q?: string;
  }) => {
    const res = await axiosClient.get("/owner/locations", { params });
    return res.data;
  },

  createLocation: async (payload: unknown) => {
    // If payload is FormData (multipart), do NOT set Content-Type manually.
    const res = await axiosClient.post("/owner/locations", payload);
    return res.data;
  },

  updateLocation: async (locationId: number, payload: unknown) => {
    const res = await axiosClient.put(
      `/owner/locations/${locationId}`,
      payload,
    );
    return res.data;
  },

  updateLocationStatus: async (
    locationId: number,
    status: "active" | "inactive",
  ) => {
    const res = await axiosClient.put(`/owner/locations/${locationId}/status`, {
      status,
    });
    return res.data;
  },

  getServicesByLocation: async (locationId: number) => {
    const res = await axiosClient.get(
      `/owner/locations/${locationId}/services`,
    );
    return res.data;
  },

  createService: async (locationId: number, payload: unknown) => {
    const res = await axiosClient.post(
      `/owner/locations/${locationId}/services`,
      payload,
    );
    return res.data;
  },

  updateService: async (serviceId: number, payload: unknown) => {
    const res = await axiosClient.put(`/owner/services/${serviceId}`, payload);
    return res.data;
  },

  deleteService: async (serviceId: number) => {
    const res = await axiosClient.delete(`/owner/services/${serviceId}`);
    return res.data;
  },

  getServiceCategories: async (
    locationId: number,
    params?: { type?: "menu" | "room" | "other" },
  ) => {
    const res = await axiosClient.get(
      `/owner/locations/${locationId}/service-categories`,
      { params },
    );
    return res.data;
  },

  createServiceCategory: async (
    locationId: number,
    payload: {
      category_type: "menu" | "room" | "other";
      category_name: string;
      sort_order?: number;
    },
  ) => {
    const res = await axiosClient.post(
      `/owner/locations/${locationId}/service-categories`,
      payload,
    );
    return res.data;
  },

  updateServiceCategory: async (
    categoryId: number,
    payload: { category_name?: string; sort_order?: number },
  ) => {
    const res = await axiosClient.put(
      `/owner/service-categories/${categoryId}`,
      payload,
    );
    return res.data;
  },

  deleteServiceCategory: async (categoryId: number) => {
    const res = await axiosClient.delete(
      `/owner/service-categories/${categoryId}`,
    );
    return res.data;
  },

  getBookings: async (params?: { status?: string; location_id?: number }) => {
    const res = await axiosClient.get("/owner/bookings", { params });
    return res.data;
  },

  getBookingFoodItems: async (bookingId: number) => {
    const res = await axiosClient.get(
      `/owner/bookings/${bookingId}/food-items`,
    );
    return res.data;
  },

  updateBookingStatus: async (
    bookingId: number,
    payload: {
      status: "confirmed" | "cancelled" | "completed";
      notes?: string | null;
    },
  ) => {
    const res = await axiosClient.put(
      `/owner/bookings/${bookingId}/status`,
      payload,
    );
    return res.data;
  },

  createOrGetPaymentForBooking: async (bookingId: number) => {
    const res = await axiosClient.post(`/owner/bookings/${bookingId}/payments`);
    return res.data;
  },

  getPayments: async (params?: { status?: string }) => {
    const res = await axiosClient.get("/owner/payments", { params });
    return res.data;
  },

  markPaymentCompleted: async (paymentId: number) => {
    const res = await axiosClient.put(
      `/owner/payments/${paymentId}/mark-completed`,
    );
    return res.data;
  },

  getCommissions: async (params?: { status?: string }) => {
    const res = await axiosClient.get("/owner/commissions", { params });
    return res.data;
  },

  createCommissionPaymentRequest: async (payload?: { note?: string }) => {
    const res = await axiosClient.post(
      "/owner/commissions/payment-request",
      payload || {},
    );
    return res.data;
  },

  getVouchers: async () => {
    const res = await axiosClient.get("/owner/vouchers");
    return res.data;
  },

  createVoucher: async (payload: unknown) => {
    const res = await axiosClient.post("/owner/vouchers", payload);
    return res.data;
  },

  updateVoucher: async (voucherId: number, payload: unknown) => {
    const res = await axiosClient.put(`/owner/vouchers/${voucherId}`, payload);
    return res.data;
  },

  deleteVoucher: async (voucherId: number) => {
    const res = await axiosClient.delete(`/owner/vouchers/${voucherId}`);
    return res.data;
  },

  getReviews: async (params?: { location_id?: number }) => {
    const res = await axiosClient.get("/owner/reviews", { params });
    return res.data;
  },

  // Front-office: checkins
  getCheckins: async (params?: { location_id?: number; status?: string }) => {
    const res = await axiosClient.get("/owner/checkins", { params });
    return res.data;
  },

  // Front-office: context (routing by location_type)
  getFrontOfficeContext: async (params: { location_id: number }) => {
    const res = await axiosClient.get("/owner/front-office/context", {
      params,
    });
    return res.data;
  },

  // Front-office: hotel
  getHotelRooms: async (params: { location_id: number; floor?: string }) => {
    const res = await axiosClient.get("/owner/front-office/hotel/rooms", {
      params,
    });
    return res.data;
  },
  createHotelRoom: async (payload: {
    location_id: number;
    service_id?: number | null;
    area_id?: number | null;
    floor_number: number;
    room_number: string;
  }) => {
    const res = await axiosClient.post(
      "/owner/front-office/hotel/rooms",
      payload,
    );
    return res.data;
  },
  updateHotelRoom: async (
    roomId: number,
    payload: {
      area_id?: number | null;
      floor_number?: number;
      room_number?: string;
    },
  ) => {
    const res = await axiosClient.put(
      `/owner/front-office/hotel/rooms/${roomId}`,
      payload,
    );
    return res.data;
  },
  deleteHotelRoom: async (roomId: number) => {
    const res = await axiosClient.delete(
      `/owner/front-office/hotel/rooms/${roomId}`,
    );
    return res.data;
  },
  updateHotelRoomPosition: async (
    roomId: number,
    payload: { pos_x: number; pos_y: number },
  ) => {
    const res = await axiosClient.post(
      `/owner/front-office/hotel/rooms/${roomId}/position`,
      payload,
    );
    return res.data;
  },
  setHotelRoomStatus: async (roomId: number, payload: { status: string }) => {
    const res = await axiosClient.post(
      `/owner/front-office/hotel/rooms/${roomId}/status`,
      payload,
    );
    return res.data;
  },
  checkinHotelRoom: async (
    roomId: number,
    payload:
      | { user_id: number; notes?: string | null }
      | {
          guest_full_name: string;
          guest_phone?: string | null;
          stay_nights: number;
          room_ids?: number[];
          notes?: string | null;
        },
  ) => {
    const res = await axiosClient.post(
      `/owner/front-office/hotel/rooms/${roomId}/checkin`,
      payload,
    );
    return res.data;
  },
  addHotelStayItems: async (
    stayId: number,
    payload: { items: Array<{ service_id: number; quantity?: number }> },
  ) => {
    const res = await axiosClient.post(
      `/owner/front-office/hotel/stays/${stayId}/items`,
      payload,
    );
    return res.data;
  },
  extendHotelStay: async (
    stayId: number,
    payload: {
      preset: "day" | "week" | "month" | "custom";
      custom_days?: number;
    },
  ) => {
    const res = await axiosClient.post(
      `/owner/front-office/hotel/stays/${stayId}/extend`,
      payload,
    );
    return res.data;
  },
  checkoutHotelStay: async (
    stayId: number,
    payload: {
      payment_method: "cash" | "transfer";
      step?: "init" | "complete";
      payment_id?: number;
    },
  ) => {
    const res = await axiosClient.post(
      `/owner/front-office/hotel/stays/${stayId}/checkout`,
      payload,
    );
    return res.data;
  },

  checkoutHotelStaysBatch: async (payload: {
    stay_ids: number[];
    payment_method: "transfer" | "cash";
    step?: "init" | "complete";
    payment_id?: number;
  }) => {
    const res = await axiosClient.post(
      `/owner/front-office/hotel/stays/checkout-batch`,
      payload,
    );
    return res.data;
  },
  getHotelPaymentsRecent: async (params: {
    location_id: number;
    limit?: number;
  }) => {
    const res = await axiosClient.get(
      "/owner/front-office/hotel/payments-recent",
      { params },
    );
    return res.data;
  },

  // Front-office: restaurant/cafe POS
  getPosAreas: async (params: { location_id: number }) => {
    const res = await axiosClient.get("/owner/front-office/pos/areas", {
      params,
    });
    return res.data;
  },
  createPosArea: async (payload: {
    location_id: number;
    area_name: string;
    sort_order?: number;
  }) => {
    const res = await axiosClient.post(
      "/owner/front-office/pos/areas",
      payload,
    );
    return res.data;
  },

  updatePosArea: async (
    areaId: number,
    payload: { area_name?: string; sort_order?: number },
  ) => {
    const res = await axiosClient.put(
      `/owner/front-office/pos/areas/${areaId}`,
      payload,
    );
    return res.data;
  },

  deletePosArea: async (areaId: number) => {
    const res = await axiosClient.delete(
      `/owner/front-office/pos/areas/${areaId}`,
    );
    return res.data;
  },
  getPosTables: async (params: { location_id: number; area_id?: string }) => {
    const res = await axiosClient.get("/owner/front-office/pos/tables", {
      params,
    });
    return res.data;
  },
  createPosTable: async (payload: {
    location_id: number;
    area_id?: number | null;
    table_name: string;
    shape?: "square" | "round";
  }) => {
    const res = await axiosClient.post(
      "/owner/front-office/pos/tables",
      payload,
    );
    return res.data;
  },

  updatePosTable: async (
    tableId: number,
    payload: {
      area_id?: number | null;
      table_name?: string;
      shape?: "square" | "round";
    },
  ) => {
    const res = await axiosClient.put(
      `/owner/front-office/pos/tables/${tableId}`,
      payload,
    );
    return res.data;
  },
  deletePosTable: async (tableId: number) => {
    const res = await axiosClient.delete(
      `/owner/front-office/pos/tables/${tableId}`,
    );
    return res.data;
  },
  updatePosTablePosition: async (
    tableId: number,
    payload: { pos_x: number; pos_y: number },
  ) => {
    const res = await axiosClient.post(
      `/owner/front-office/pos/tables/${tableId}/position`,
      payload,
    );
    return res.data;
  },
  getPosMenu: async (params: { location_id: number }) => {
    const res = await axiosClient.get("/owner/front-office/pos/menu", {
      params,
    });
    return res.data;
  },
  openPosTable: async (tableId: number) => {
    const res = await axiosClient.post(
      `/owner/front-office/pos/tables/${tableId}/open`,
    );
    return res.data;
  },
  reservePosTable: async (tableId: number) => {
    const res = await axiosClient.post(
      `/owner/front-office/pos/tables/${tableId}/reserve`,
    );
    return res.data;
  },
  arrivePosTable: async (tableId: number) => {
    const res = await axiosClient.post(
      `/owner/front-office/pos/tables/${tableId}/arrive`,
    );
    return res.data;
  },
  getPosOrderDetail: async (orderId: number) => {
    const res = await axiosClient.get(
      `/owner/front-office/pos/orders/${orderId}`,
    );
    return res.data;
  },
  getPosPaymentsHistory: async (params: {
    location_id: number;
    range?: "day" | "week" | "month" | "year" | "all";
    date?: string;
    from?: string;
    to?: string;
  }) => {
    const res = await axiosClient.get(
      "/owner/front-office/pos/payments-history",
      { params },
    );
    return res.data;
  },
  addPosOrderItem: async (
    orderId: number,
    payload: { service_id: number; quantity?: number },
  ) => {
    const res = await axiosClient.post(
      `/owner/front-office/pos/orders/${orderId}/items`,
      payload,
    );
    return res.data;
  },
  updatePosOrderItem: async (
    orderId: number,
    orderItemId: number,
    payload: { quantity: number },
  ) => {
    const res = await axiosClient.put(
      `/owner/front-office/pos/orders/${orderId}/items/${orderItemId}`,
      payload,
    );
    return res.data;
  },
  deletePosOrderItem: async (orderId: number, orderItemId: number) => {
    const res = await axiosClient.delete(
      `/owner/front-office/pos/orders/${orderId}/items/${orderItemId}`,
    );
    return res.data;
  },
  payPosOrder: async (
    orderId: number,
    payload:
      | {
          payment_method: "cash";
          transaction_source?: "online_booking" | "onsite_pos";
          booking_id?: number;
          voucher_code?: string | null;
        }
      | {
          payment_method: "transfer";
          step: "init";
          transaction_source?: "online_booking" | "onsite_pos";
          booking_id?: number;
          voucher_code?: string | null;
        }
      | {
          payment_method: "transfer";
          step: "complete";
          payment_id?: number;
          transaction_source?: "online_booking" | "onsite_pos";
          booking_id?: number;
          voucher_code?: string | null;
        },
  ) => {
    const res = await axiosClient.post(
      `/owner/front-office/pos/orders/${orderId}/pay`,
      payload,
    );
    return res.data;
  },

  // Front-office: tourist
  getTouristTicketToday: async (params: {
    location_id: number;
    date?: string;
  }) => {
    const res = await axiosClient.get(
      "/owner/front-office/tourist/tickets/today",
      { params },
    );
    return res.data;
  },
  getTouristTicketInvoices: async (params: {
    location_id: number;
    range?: "day" | "week" | "month" | "year" | "all";
    date?: string;
    from?: string;
    to?: string;
  }) => {
    const res = await axiosClient.get(
      "/owner/front-office/tourist/tickets/invoices",
      { params },
    );
    return res.data;
  },
  getTouristTicketsByUser: async (params: {
    location_id: number;
    user_id?: number;
  }) => {
    const res = await axiosClient.get(
      "/owner/front-office/tourist/tickets/by-user",
      { params },
    );
    return res.data;
  },
  scanTouristTicket: async (payload: {
    location_id: number;
    ticket_code: string;
  }) => {
    const res = await axiosClient.post(
      "/owner/front-office/tourist/tickets/scan",
      payload,
    );
    return res.data;
  },
  sellTouristPosTickets: async (payload: {
    location_id: number;
    service_id: number;
    quantity: number;
  }) => {
    const res = await axiosClient.post(
      "/owner/front-office/tourist/tickets/sell",
      payload,
    );
    return res.data;
  },

  sellTouristPosTicketsBatch: async (payload: {
    location_id: number;
    items: Array<{ service_id: number; quantity: number }>;
  }) => {
    const res = await axiosClient.post(
      "/owner/front-office/tourist/tickets/sell-batch",
      payload,
    );
    return res.data;
  },

  payTouristPosTicketsBatch: async (
    payload:
      | {
          location_id: number;
          payment_method: "cash";
          items: Array<{ service_id: number; quantity: number }>;
        }
      | {
          location_id: number;
          payment_method: "transfer";
          step: "init";
          items: Array<{ service_id: number; quantity: number }>;
        }
      | {
          location_id: number;
          payment_method: "transfer";
          step: "complete";
          payment_id: number;
          items: Array<{ service_id: number; quantity: number }>;
        },
  ) => {
    const res = await axiosClient.post(
      "/owner/front-office/tourist/tickets/pay-batch",
      payload,
    );
    return res.data;
  },

  verifyCheckin: async (checkinId: number, notes?: string | null) => {
    const res = await axiosClient.post(`/owner/checkins/${checkinId}/verify`, {
      notes: notes ?? null,
    });
    return res.data;
  },

  failCheckin: async (checkinId: number, reason?: string | null) => {
    const res = await axiosClient.post(`/owner/checkins/${checkinId}/fail`, {
      reason: reason ?? null,
    });
    return res.data;
  },

  replyReview: async (reviewId: number, content: string) => {
    const res = await axiosClient.post(`/owner/reviews/${reviewId}/reply`, {
      content,
    });
    return res.data;
  },

  hideReview: async (reviewId: number, hidden: boolean) => {
    const res = await axiosClient.put(`/owner/reviews/${reviewId}/hide`, {
      hidden,
    });
    return res.data;
  },

  deleteReview: async (reviewId: number) => {
    const res = await axiosClient.delete(`/owner/reviews/${reviewId}`);
    return res.data;
  },

  reportReviewUser: async (reviewId: number, reason?: string) => {
    const res = await axiosClient.post(
      `/owner/reviews/${reviewId}/report-user`,
      {
        reason: reason ?? "",
      },
    );
    return res.data;
  },

  getNotifications: async () => {
    const res = await axiosClient.get("/owner/notifications");
    return res.data;
  },

  markNotificationsReadAll: async () => {
    const res = await axiosClient.post("/owner/notifications/read-all");
    return res.data;
  },

  deleteNotificationsAll: async () => {
    const res = await axiosClient.post("/owner/notifications/delete-all");
    return res.data;
  },

  getEmployees: async () => {
    const res = await axiosClient.get("/owner/employees");
    return res.data;
  },

  getEmployeeDetail: async (employeeId: number) => {
    const res = await axiosClient.get(`/owner/employees/${employeeId}`);
    return res.data;
  },

  createEmployee: async (payload: unknown) => {
    const res = await axiosClient.post("/owner/employees", payload);
    return res.data;
  },

  updateEmployee: async (employeeId: number, payload: unknown) => {
    const res = await axiosClient.put(
      `/owner/employees/${employeeId}`,
      payload,
    );
    return res.data;
  },

  deleteEmployee: async (employeeId: number) => {
    const res = await axiosClient.delete(`/owner/employees/${employeeId}`);
    return res.data;
  },

  updateEmployeeAssignments: async (employeeId: number, payload: unknown) => {
    const res = await axiosClient.put(
      `/owner/employees/${employeeId}/assignments`,
      payload,
    );
    return res.data;
  },
};

export default ownerApi;
