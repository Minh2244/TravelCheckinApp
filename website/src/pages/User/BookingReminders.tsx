import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import UserLayout from "../../layouts/UserLayout";
import userApi from "../../api/userApi";
import type { BookingReminderItem } from "../../types/user.types";

const formatReminderDate = (dateStr: string) => {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const days = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
    const dayName = days[d.getDay()];
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${dayName}, ${dd}/${mm}/${yyyy} lúc ${hh}:${min}`;
  } catch {
    return dateStr;
  }
};

const BookingReminders = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<BookingReminderItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "upcoming" | "completed" | "cancelled">("all");

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await userApi.getBookingReminders();
        if (!cancelled) {
          if (res.success) {
            setItems(res.data || []);
          } else {
            setError(res.message || "Không thể tải lịch trình");
          }
        }
      } catch {
        if (!cancelled) {
          setError("Không thể tải lịch trình. Vui lòng thử lại sau.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    void fetchData();
    return () => {
      cancelled = true;
    };
  }, []);

  // Đếm số lượng đặt đơn cho các stats
  const stats = useMemo(() => {
    const total = items.length;
    const upcoming = items.filter((x) => x.status === "pending" || x.status === "confirmed").length;
    const completed = items.filter((x) => x.status === "completed").length;
    const cancelled = items.filter((x) => x.status === "cancelled").length;
    return { total, upcoming, completed, cancelled };
  }, [items]);

  // Bộ lọc theo tab hoạt động
  const filteredItems = useMemo(() => {
    if (activeTab === "all") return items;
    if (activeTab === "upcoming") {
      return items.filter((x) => x.status === "pending" || x.status === "confirmed");
    }
    if (activeTab === "completed") {
      return items.filter((x) => x.status === "completed");
    }
    if (activeTab === "cancelled") {
      return items.filter((x) => x.status === "cancelled");
    }
    return items;
  }, [items, activeTab]);

  // Xác định xem đơn hàng có bị quá hạn tự động không
  const isExpired = (item: BookingReminderItem) => {
    return item.status === "cancelled" && item.notes && item.notes.includes("[SYSTEM]");
  };

  const getServiceLabel = (type?: string | null) => {
    const t = String(type || "").toLowerCase();
    if (t === "restaurant" || t === "cafe") return { label: "Ăn uống", icon: "🍽️", bg: "bg-amber-50 text-amber-700 border-amber-100" };
    if (t === "hotel" || t === "resort" || t === "homestay") return { label: "Lưu trú", icon: "🏨", bg: "bg-indigo-50 text-indigo-700 border-indigo-100" };
    if (t === "tourist") return { label: "Du lịch", icon: "🎟️", bg: "bg-emerald-50 text-emerald-700 border-emerald-100" };
    return { label: "Dịch vụ khác", icon: "📍", bg: "bg-slate-50 text-slate-700 border-slate-100" };
  };

  return (
    <UserLayout title="Nhắc lịch trình" activeKey="/user/booking-reminders">
      <section className="user-section p-4 sm:p-6 lg:p-8">
        
        {/* Banner tiêu đề nâng cấp với màu nền Ngọc Bích Sáng Nhã Nhặn */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#ccefe8]/80 via-[#e2f7f3] to-[#ccefe8]/70 border border-teal-100 p-6 mb-6">
          <div className="absolute top-0 right-0 h-32 w-32 bg-teal-200/20 rounded-full blur-2xl" />
          <div className="relative z-10 text-left">
            <p className="text-xs text-slate-600 font-medium max-w-xl leading-relaxed">
              Chào mừng bạn đến với trung tâm giám sát hành trình. Hệ thống tự động theo dõi thời gian check-in/check-out và phát tín hiệu cảnh báo lịch đặt trước cho mọi loại hình dịch vụ.
            </p>
          </div>
        </div>

        {/* Stats Panel */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Tổng số lịch trình", count: stats.total, color: "from-slate-50 to-slate-100/50 border-slate-100 text-slate-800" },
            { label: "Sắp diễn ra", count: stats.upcoming, color: "from-teal-50 to-emerald-50/50 border-teal-100 text-teal-800" },
            { label: "Đã hoàn thành", count: stats.completed, color: "from-indigo-50 to-indigo-100/30 border-indigo-100 text-indigo-800" },
            { label: "Hủy / Quá hạn", count: stats.cancelled, color: "from-rose-50 to-rose-100/30 border-rose-100 text-rose-800" },
          ].map((stat, i) => (
            <div key={i} className={`rounded-xl border bg-gradient-to-br p-3.5 shadow-sm text-left ${stat.color}`}>
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">{stat.label}</span>
              <div className="text-2xl font-black mt-1 font-heading">{stat.count}</div>
            </div>
          ))}
        </div>

        {/* Tab Lọc Trạng Thái */}
        <div className="flex flex-wrap gap-2 mb-6 border-b border-slate-100 pb-4">
          {[
            { key: "all" as const, label: "Tất cả" },
            { key: "upcoming" as const, label: "Sắp diễn ra" },
            { key: "completed" as const, label: "Đã hoàn thành" },
            { key: "cancelled" as const, label: "Hủy / Quá hạn" },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
                activeTab === tab.key
                  ? "bg-teal-600 text-white shadow-sm"
                  : "border border-slate-200 text-slate-600 bg-white hover:bg-slate-50"
              }`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Feedback / State */}
        {loading ? (
          <div className="rounded-2xl border border-slate-100 bg-gradient-to-br from-slate-50 to-white px-4 py-16 text-center text-sm text-slate-500 shadow-sm">
            <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-teal-600 border-t-transparent mb-2" />
            <p className="font-semibold text-slate-600">Đang tải lịch trình hành trình của bạn...</p>
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-red-100 bg-red-50/60 px-4 py-8 text-center text-sm text-red-600 shadow-sm">
            <p className="font-bold">⚠️ Có lỗi xảy ra</p>
            <p className="mt-1 text-xs">{error}</p>
          </div>
        ) : null}

        {!loading && !error && filteredItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-16 text-center text-sm text-slate-500 shadow-inner">
            <p className="text-2xl mb-1">📅</p>
            <p className="font-bold text-slate-700">Trống lịch nhắc trình</p>
            <p className="text-xs text-slate-400 mt-1">Không tìm thấy lịch đặt chỗ nào phù hợp với bộ lọc này.</p>
          </div>
        ) : null}

        {/* Danh sách lịch trình */}
        {!loading && filteredItems.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
            {filteredItems.map((item) => {
              const svc = getServiceLabel(item.location_type);
              const expired = isExpired(item);
              
              // Cấu hình nhãn trạng thái chính xác
              let statusLabel = "Đặt trước thành công";
              let statusBg = "bg-amber-50 text-amber-700 border-amber-100 shadow-[0_0_8px_rgba(245,158,11,0.1)]";
              if (item.status === "confirmed") {
                statusLabel = "Đã xác nhận";
                statusBg = "bg-indigo-50 text-indigo-700 border-indigo-100 shadow-[0_0_8px_rgba(99,102,241,0.1)]";
              } else if (item.status === "cancelled") {
                if (expired) {
                  statusLabel = "Quá hạn (Hệ thống)";
                  statusBg = "bg-slate-100 text-slate-600 border-slate-200";
                } else {
                  statusLabel = "Đã hủy";
                  statusBg = "bg-rose-50 text-rose-700 border-rose-100 shadow-[0_0_8px_rgba(244,63,94,0.1)]";
                }
              } else if (item.status === "completed") {
                statusLabel = "Đã dùng";
                statusBg = "bg-emerald-50 text-emerald-700 border-emerald-100 shadow-[0_0_8px_rgba(16,185,129,0.1)]";
              }

              return (
                <article
                  key={item.booking_id}
                  className="user-sub-card card-lift flex flex-col justify-between overflow-hidden border border-slate-100 bg-white shadow-sm hover:shadow-md rounded-2xl transition duration-300 h-full relative"
                >
                  {/* Đường viền nhỏ ở trên để phân biệt nhanh trạng thái */}
                  <div className={`absolute top-0 left-0 right-0 h-1 ${
                    item.status === "confirmed" ? "bg-indigo-500" :
                    item.status === "completed" ? "bg-emerald-500" :
                    item.status === "cancelled" ? "bg-rose-400" : "bg-amber-500"
                  }`} />

                  {/* Header: Dịch vụ & Trạng thái */}
                  <div className="p-4 flex items-center justify-between border-b border-slate-50 mt-1">
                    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold border uppercase tracking-wider ${svc.bg}`}>
                      <span>{svc.icon}</span>
                      <span>{svc.label}</span>
                    </span>

                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-black border ${statusBg}`}>
                      <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
                      {statusLabel}
                    </span>
                  </div>

                  {/* Body: Tên địa điểm, Địa chỉ & Thời gian */}
                  <div className="p-4 flex-1 text-left space-y-3">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 line-clamp-1 hover:text-teal-600 cursor-pointer transition-colors"
                          onClick={() => navigate("/user/map")}
                      >
                        {item.location_name}
                      </h3>
                      <p className="text-[10px] leading-relaxed text-slate-400 mt-1 line-clamp-1">
                        📍 {item.address}
                      </p>
                    </div>

                    <div className="rounded-xl bg-slate-50/70 p-3 space-y-1.5 border border-slate-100/40">
                      <div className="flex items-center gap-2 text-[10px] text-slate-600 font-medium">
                        <span className="text-teal-600 shrink-0 font-extrabold">▶ CHECK-IN:</span>
                        <span className="truncate">{formatReminderDate(item.check_in_date)}</span>
                      </div>
                      {item.check_out_date ? (
                        <div className="flex items-center gap-2 text-[10px] text-slate-600 font-medium border-t border-slate-100 pt-1.5 mt-1.5">
                          <span className="text-rose-500 shrink-0 font-extrabold">◀ CHECK-OUT:</span>
                          <span className="truncate">{formatReminderDate(item.check_out_date)}</span>
                        </div>
                      ) : null}
                    </div>

                    {/* Hiển thị ghi chú nếu bị quá hạn hoặc đặc biệt */}
                    {item.notes ? (
                      <div className="text-[9px] text-slate-400 italic bg-amber-50/40 border border-amber-100/50 rounded-lg p-2 leading-relaxed">
                        📝 Ghi chú: {item.notes}
                      </div>
                    ) : null}
                  </div>

                  {/* Footer: Trạng thái nhắc nhở */}
                  <div className="p-4 bg-slate-50/50 border-t border-slate-50 flex items-center gap-3">
                    <div className="flex items-center gap-1.5 text-[9px] font-bold">
                      {item.reminder_sent ? (
                        <>
                          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">✓</span>
                          <span className="text-emerald-700 uppercase tracking-wide">Đã nhắc lịch trình</span>
                        </>
                      ) : (
                        <>
                          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-teal-100 text-teal-700 animate-pulse">⏰</span>
                          <span className="text-teal-700 uppercase tracking-wide">Sắp nhắc lịch trình</span>
                        </>
                      )}
                    </div>
                  </div>

                </article>
              );
            })}
          </div>
        ) : null}
      </section>
    </UserLayout>
  );
};

export default BookingReminders;
