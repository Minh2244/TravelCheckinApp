import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import UserLayout from "../../layouts/UserLayout";
import userApi from "../../api/userApi";
import { getErrorMessage } from "../../utils/safe";

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
              <span className="text-[10px] font-extrabold tracking-widest text-indigo-600 uppercase">
                KẾ HOẠCH DU LỊCH
              </span>
              <h2 className="text-2xl font-black text-slate-800 mt-1 font-heading">
                Lịch trình của tôi
              </h2>
              <p className="text-xs text-slate-600 mt-2 font-medium max-w-md leading-relaxed">
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
    </UserLayout>
  );
};

export default Itineraries;
