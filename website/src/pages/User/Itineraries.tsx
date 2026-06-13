import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import UserLayout from "../../layouts/UserLayout";
import userApi from "../../api/userApi";
import { getErrorMessage } from "../../utils/safe";
import LocationPickerMap from "../../components/LocationPickerMap";

interface ItinerarySummary {
  itinerary_id: number;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  total_items: number;
  total_estimated_cost: number;
  visited_count: number;
  created_at: string;
}

const Itineraries = () => {
  const navigate = useNavigate();
  const [itineraries, setItineraries] = useState<ItinerarySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "upcoming" | "completed">("all");

  // Detail modal
  const [detailId, setDetailId] = useState<number | null>(null);
  const [detailData, setDetailData] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [navMode, setNavMode] = useState(false);
  const [navTarget, setNavTarget] = useState<any>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await userApi.getItineraries();
      if (res.success) setItineraries(res.data || []);
    } catch (err) {
      setError(getErrorMessage(err, "Không thể tải lịch trình"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleDelete = async (id: number, title: string) => {
    if (!window.confirm(`Xóa lịch trình "${title}"?`)) return;
    try {
      await userApi.deleteItinerary(id);
      setItineraries((prev) => prev.filter((i) => i.itinerary_id !== id));
    } catch (err) {
      alert(getErrorMessage(err, "Không thể xóa"));
    }
  };

  // Load chi tiết lịch trình
  const loadDetail = async (id: number) => {
    setDetailId(id);
    setDetailLoading(true);
    try {
      const res = await userApi.getItineraryDetail(id);
      if (res.success) setDetailData(res.data);
    } catch (err) {
      alert(getErrorMessage(err, "Không thể tải chi tiết"));
    } finally {
      setDetailLoading(false);
    }
  };

  // Đánh dấu đã đến
  const handleToggleVisited = async (itineraryId: number, itemId: number) => {
    try {
      const res = await userApi.toggleItemVisited(itineraryId, itemId);
      if (res.success && detailData) {
        setDetailData({
          ...detailData,
          items: detailData.items.map((item: any) =>
            item.item_id === itemId ? { ...item, visited_at: res.data.visited_at } : item
          ),
        });
        // Cập nhật list
        setItineraries((prev) =>
          prev.map((it) => {
            if (it.itinerary_id !== itineraryId) return it;
            const visitedCount = detailData.items.filter((i: any) =>
              i.item_id === itemId ? res.data.visited_at : i.visited_at
            ).length;
            return { ...it, visited_count: visitedCount };
          })
        );
      }
    } catch (err: any) {
      alert(err?.response?.data?.message || "Không thể cập nhật");
    }
  };

  // Bắt đầu dẫn đường
  const handleStartNav = (item: any) => {
    setNavTarget(item);
    setNavMode(true);
    // Lấy GPS hiện tại
    navigator.geolocation.getCurrentPosition(
      (pos) => {},
      () => {},
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Tính khoảng cách
  const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const formatDate = (d: string) => {
    const dt = new Date(d);
    return `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}/${dt.getFullYear()}`;
  };

  const formatMoney = (v: number) =>
    new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(v);

  const countDays = (start: string, end: string) => {
    const diff = new Date(end).getTime() - new Date(start).getTime();
    return Math.max(1, Math.ceil(diff / 86400000) + 1);
  };

  const isCompleted = (it: ItinerarySummary) => it.total_items > 0 && it.visited_count >= it.total_items;
  const isUpcoming = (it: ItinerarySummary) => new Date(it.start_date) >= new Date(new Date().toDateString());

  const stats = useMemo(() => {
    const total = itineraries.length;
    const upcoming = itineraries.filter(isUpcoming).length;
    const completed = itineraries.filter(isCompleted).length;
    return { total, upcoming, completed };
  }, [itineraries]);

  const filteredItems = useMemo(() => {
    if (activeTab === "upcoming") return itineraries.filter(isUpcoming);
    if (activeTab === "completed") return itineraries.filter(isCompleted);
    return itineraries;
  }, [itineraries, activeTab]);

  return (
    <UserLayout title="Lịch trình" activeKey="/user/itineraries">
      <section className="user-section p-4 sm:p-6 lg:p-8">
        {/* Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-50/80 via-purple-50/60 to-indigo-50/80 border border-indigo-100 p-6 mb-6">
          <div className="absolute top-0 right-0 h-32 w-32 bg-indigo-200/20 rounded-full blur-2xl" />
          <div className="absolute bottom-0 left-0 h-24 w-24 bg-purple-200/15 rounded-full blur-2xl" />
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-600 font-medium max-w-md leading-relaxed">
                Tạo kế hoạch cho chuyến đi, thêm địa điểm theo ngày, ghi chú và theo dõi những nơi đã ghé thăm.
              </p>
            </div>
            <button
              onClick={() => navigate("/user/itineraries/create")}
              className="shrink-0 flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:shadow-xl transition-all"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Tạo lịch trình
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: "Tổng lịch trình", count: stats.total, color: "from-slate-50 to-slate-100/50 border-slate-100 text-slate-800" },
            { label: "Sắp tới", count: stats.upcoming, color: "from-indigo-50 to-purple-50/50 border-indigo-100 text-indigo-800" },
            { label: "Đã hoàn thành", count: stats.completed, color: "from-emerald-50 to-emerald-100/30 border-emerald-100 text-emerald-800" },
          ].map((stat, i) => (
            <div key={i} className={`rounded-xl border bg-gradient-to-br p-3.5 shadow-sm text-left ${stat.color}`}>
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">{stat.label}</span>
              <div className="text-2xl font-black mt-1 font-heading">{stat.count}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6 border-b border-slate-100 pb-4">
          {[
            { key: "all" as const, label: "Tất cả" },
            { key: "upcoming" as const, label: "Sắp tới" },
            { key: "completed" as const, label: "Đã hoàn thành" },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
                activeTab === tab.key
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "border border-slate-200 text-slate-600 bg-white hover:bg-slate-50"
              }`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div className="rounded-2xl border border-slate-100 bg-gradient-to-br from-slate-50 to-white px-4 py-16 text-center text-sm text-slate-500 shadow-sm">
            <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent mb-2" />
            <p className="font-semibold text-slate-600">Đang tải lịch trình...</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-8 text-center text-sm text-rose-600">
            {error}
          </div>
        )}

        {/* Empty */}
        {!loading && !error && filteredItems.length === 0 && (
          <div className="rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/30 px-4 py-16 text-center">
            <div className="text-5xl mb-4">🗺️</div>
            <p className="text-base font-bold text-slate-700 mb-1">Chưa có lịch trình nào</p>
            <p className="text-xs text-slate-500">Bắt đầu tạo kế hoạch cho chuyến đi sắp tới của bạn!</p>
          </div>
        )}

        {/* Danh sách */}
        {!loading && !error && filteredItems.length > 0 && (
          <div className="space-y-4">
            {filteredItems.map((it) => {
              const completed = isCompleted(it);
              const days = countDays(it.start_date, it.end_date);
              const progress = it.total_items > 0 ? Math.round((it.visited_count / it.total_items) * 100) : 0;

              return (
                <div
                  key={it.itinerary_id}
                  onClick={() => navigate(`/user/itineraries/${it.itinerary_id}`)}
                  className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-5 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer"
                >
                  {/* Progress bar */}
                  <div className="absolute bottom-0 left-0 h-1 bg-slate-100 w-full">
                    <div
                      className={`h-full transition-all rounded-full ${completed ? "bg-emerald-400" : "bg-indigo-400"}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Title + Badge */}
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-base font-bold text-slate-800 truncate">{it.title}</h3>
                        {completed && (
                          <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                            ✓ Hoàn thành
                          </span>
                        )}
                      </div>

                      {it.description && (
                        <p className="text-xs text-slate-500 mb-2 line-clamp-1">{it.description}</p>
                      )}

                      {/* Info pills */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 border border-indigo-100/60 px-2.5 py-1 text-[11px] font-semibold text-indigo-700">
                          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <rect x="3" y="4" width="18" height="18" rx="2" />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                          </svg>
                          {formatDate(it.start_date)} — {formatDate(it.end_date)}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-lg bg-slate-50 border border-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                          {days} ngày
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-lg bg-purple-50 border border-purple-100/60 px-2.5 py-1 text-[11px] font-semibold text-purple-700">
                          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                            <circle cx="12" cy="10" r="3" />
                          </svg>
                          {it.total_items} địa điểm
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 border border-emerald-100/60 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                          ✓ {it.visited_count}/{it.total_items} đã đến
                        </span>
                        {it.total_estimated_cost > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 border border-amber-100/60 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                            💰 {formatMoney(it.total_estimated_cost)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void loadDetail(it.itinerary_id);
                        }}
                        className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-100 transition-colors"
                      >
                        📍 Xem
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/user/itineraries/${it.itinerary_id}`);
                        }}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                      >
                        Sửa
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(it.itinerary_id, it.title);
                        }}
                        className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-100 transition-colors"
                      >
                        Xóa
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Detail Modal */}
      {detailId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) { setDetailId(null); setDetailData(null); } }}>
          <div className="w-full max-w-2xl max-h-[85vh] overflow-auto rounded-2xl bg-white shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
              <div>
                <span className="text-[10px] font-extrabold tracking-widest text-indigo-600 uppercase">CHI TIẾT</span>
                <h3 className="text-lg font-black text-slate-800 font-heading">{detailData?.title || "Đang tải..."}</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigate(`/user/itineraries/${detailId}`)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  ✏️ Sửa
                </button>
                <button onClick={() => { setDetailId(null); setDetailData(null); }} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              {detailLoading ? (
                <div className="text-center py-10">
                  <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                </div>
              ) : detailData ? (
                <div className="space-y-4">
                  {detailData.description && (
                    <p className="text-sm text-slate-500">{detailData.description}</p>
                  )}
                  {Object.entries(
                    (detailData.items || []).reduce((acc: any, item: any) => {
                      const day = item.day_number;
                      if (!acc[day]) acc[day] = [];
                      acc[day].push(item);
                      return acc;
                    }, {})
                  ).map(([day, items]: [string, any]) => (
                    <div key={day}>
                      <h4 className="text-sm font-bold text-slate-700 mb-2">📅 Ngày {day}</h4>
                      <div className="space-y-2">
                        {items.map((item: any, idx: number) => (
                          <div key={item.item_id} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                            <span className="flex items-center justify-center h-7 w-7 rounded-lg bg-indigo-100 text-indigo-700 text-xs font-bold shrink-0">
                              {idx + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-sm text-slate-800">
                                {item.location_name || item.custom_name || "Chưa có tên"}
                              </div>
                              {item.custom_address && (
                                <div className="text-xs text-slate-500">📍 {item.custom_address}</div>
                              )}
                              <div className="flex flex-wrap gap-2 mt-1">
                                {item.time && <span className="text-xs text-slate-400">🕐 {item.time}</span>}
                                {item.note && <span className="text-xs text-slate-400">📝 {item.note}</span>}
                                {item.estimated_cost > 0 && <span className="text-xs text-amber-600">💰 {Number(item.estimated_cost).toLocaleString("vi-VN")}đ</span>}
                              </div>
                              {item.visited_at && (
                                <div className="text-xs text-emerald-600 font-semibold mt-1">
                                  ✅ Đã đến lúc {new Date(item.visited_at).toLocaleString("vi-VN")}
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col gap-1 shrink-0">
                              {/* Nút Đã đến */}
                              <button
                                onClick={() => void handleToggleVisited(detailId, item.item_id)}
                                className={`rounded-lg px-2 py-1 text-xs font-semibold transition-all ${
                                  item.visited_at
                                    ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                                    : "bg-white text-slate-500 border border-slate-200 hover:bg-emerald-50 hover:text-emerald-600"
                                }`}
                              >
                                {item.visited_at ? "✅ Đã đến" : "⬜ Đã đến"}
                              </button>
                              {/* Nút Bắt đầu - luôn hiện */}
                              {(
                                <button
                                  onClick={() => handleStartNav(item)}
                                  className="rounded-lg px-2 py-1 text-xs font-semibold bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100 transition-all"
                                >
                                  🚀 Bắt đầu
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Navigation Mode Overlay */}
      {navMode && navTarget && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-white">
            <button onClick={() => { setNavMode(false); setNavTarget(null); }} className="flex items-center gap-2 text-slate-600">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
              <span className="text-sm font-semibold">Quay lại</span>
            </button>
            <div className="text-sm font-bold text-slate-800">🎯 {navTarget.location_name || navTarget.custom_name}</div>
            <div className="w-20" />
          </div>
          <div className="flex-1">
            <LocationPickerMap onSelectLocation={() => {}} className="h-full" />
          </div>
          <div className="bg-white/95 backdrop-blur-sm border-t border-slate-200 p-4">
            <div className="max-w-lg mx-auto flex items-center justify-between">
              <div>
                <div className="font-bold text-base text-slate-800">📍 {navTarget.location_name || navTarget.custom_name}</div>
                {navTarget.custom_address && <div className="text-xs text-slate-500">{navTarget.custom_address}</div>}
              </div>
              <button
                onClick={() => {
                  void handleToggleVisited(detailId!, navTarget.item_id);
                  setNavMode(false);
                  setNavTarget(null);
                }}
                className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg hover:bg-emerald-700"
              >
                ✅ Đã đến
              </button>
            </div>
          </div>
        </div>
      )}
    </UserLayout>
  );
};

export default Itineraries;
