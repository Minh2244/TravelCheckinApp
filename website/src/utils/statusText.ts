export const statusToVi = (raw: unknown): string => {
  const s = String(raw ?? "").trim();
  if (!s) return "-";

  // Normalize common variants (upper/lower).
  const key = s.toLowerCase();

  const map: Record<string, string> = {
    // Generic
    active: "Đang hoạt động",
    inactive: "Ngừng hoạt động",
    pending: "Chờ xử lý",
    locked: "Bị khóa",
    hidden: "Đã ẩn",
    expired: "Hết hạn",

    // Check-in verification
    verified: "Đã xác minh",
    failed: "Thất bại",

    // Approvals / moderation
    approved: "Đã duyệt",
    rejected: "Từ chối",
    reviewing: "Đang xem xét",

    // SOS
    processing: "Đang xử lý",
    resolved: "Đã xử lý",

    // Payments / commissions
    paid: "Đã thanh toán",
    overdue: "Quá hạn",

    // Bookings
    confirmed: "Đã xác nhận",
    cancelled: "Đã hủy",
    completed: "Hoàn thành",
  };

  return map[key] || s;
};
