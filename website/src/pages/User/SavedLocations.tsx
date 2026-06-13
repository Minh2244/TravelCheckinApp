import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import UserLayout from "../../layouts/UserLayout";
import userApi from "../../api/userApi";
import type { Location } from "../../types/location.types";
import { resolveBackendUrl } from "../../utils/resolveBackendUrl";
import { getErrorMessage } from "../../utils/safe";

const SavedLocations = () => {
  const navigate = useNavigate();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await userApi.getFavorites();
        if (!cancelled) {
          setLocations(response.success ? response.data || [] : []);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(getErrorMessage(loadError, "Không thể tải địa điểm đã lưu"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleRemove = async (locationId: number) => {
    try {
      setRemovingId(locationId);
      await userApi.removeFavorite(locationId);
      setLocations((prev) =>
        prev.filter((item) => item.location_id !== locationId),
      );
      setMessage("Đã bỏ lưu địa điểm");
    } catch (removeError) {
      setError(
        getErrorMessage(removeError, "Không thể cập nhật địa điểm đã lưu"),
      );
    } finally {
      setRemovingId(null);
    }
  };

  const getLocationTypeLabel = (type: string) => {
    const t = (type || "").toLowerCase();
    if (t === "restaurant" || t === "cafe") return "Ăn uống";
    if (t === "hotel" || t === "resort" || t === "homestay") return "Khách sạn";
    return "Du lịch";
  };

  return (
    <UserLayout title="Địa điểm đã lưu" activeKey="/user/saved-locations">
      <section className="user-section p-4 sm:p-6 lg:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">
              Những địa điểm bạn lưu để xem lại nhanh hoặc đặt trước sau.
            </p>
          </div>
          <div className="rounded-full bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-700">
            {locations.length} địa điểm
          </div>
        </div>

        {message ? (
          <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {message}
          </div>
        ) : null}

        {error ? (
          <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="mt-5 rounded-2xl border border-gray-200/60 bg-gradient-to-br from-gray-50 to-white px-4 py-10 text-center text-sm text-gray-500">
            Đang tải danh sách đã lưu...
          </div>
        ) : null}

        {!loading && locations.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-gray-200/60 bg-gradient-to-br from-gray-50 to-white px-4 py-10 text-center text-sm text-gray-500">
            Bạn chưa lưu địa điểm nào.
          </div>
        ) : null}

        {locations.length > 0 ? (
          <div className="mt-6 max-h-[70vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 items-start">
              
              {/* Cột trái: Lưới danh sách địa điểm đã lưu */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 items-stretch">
                {locations.map((item) => {
                  const imageUrl = resolveBackendUrl(item.first_image);
                  return (
                    <article
                      key={item.location_id}
                      className="group relative flex w-full max-w-[280px] mx-auto sm:mx-0 flex-col overflow-hidden bg-white/90 border border-slate-100/90 shadow-sm hover:shadow-md hover:-translate-y-0.5 rounded-xl transition-all duration-300 h-full"
                    >
                      {/* Phần ảnh kèm nút Trái tim nổi nhỏ gọn */}
                      <div className="relative h-32 overflow-hidden bg-slate-100 shadow-inner">
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={item.location_name}
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 group-hover:rotate-1"
                          />
                        ) : (
                          <div className="h-full w-full bg-gradient-to-br from-sky-100 via-cyan-50 to-emerald-100" />
                        )}

                        {/* Nút Trái tim Bỏ lưu nổi ở góc ảnh */}
                        <button
                          type="button"
                          onClick={() => void handleRemove(item.location_id)}
                          disabled={removingId === item.location_id}
                          className="absolute right-2.5 top-2.5 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/75 backdrop-blur-md text-red-500 shadow-sm hover:bg-white hover:text-red-600 transition-all hover:scale-110 active:scale-95 disabled:opacity-60"
                          title="Bỏ lưu địa điểm"
                        >
                          <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" stroke="currentColor" strokeWidth="1">
                            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                          </svg>
                        </button>
                      </div>

                      {/* Nội dung chi tiết */}
                      <div className="flex flex-1 flex-col justify-between p-3 bg-white/50">
                        <div className="space-y-1.5 text-left">
                          <div className="flex items-center justify-between">
                            <span className={`inline-flex rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider ${
                              (item.location_type as string) === "restaurant" || (item.location_type as string) === "cafe"
                                ? "bg-amber-50 text-amber-700 border border-amber-100"
                                : (item.location_type as string) === "hotel" || (item.location_type as string) === "resort" || (item.location_type as string) === "homestay"
                                ? "bg-indigo-50 text-indigo-700 border border-indigo-100"
                                : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                            }`}>
                              {getLocationTypeLabel(item.location_type)}
                            </span>
                            <div className="flex items-center gap-0.5 text-[10px]">
                              <span className="text-amber-500">★</span>
                              <span className="font-bold text-slate-800">{Number(item.rating || 0).toFixed(1)}</span>
                              <span className="text-slate-400">({Number(item.total_reviews || 0)})</span>
                            </div>
                          </div>

                          <h3 className="text-xs font-bold text-slate-900 line-clamp-1 group-hover:text-teal-600 transition-colors">
                            {item.location_name}
                          </h3>
                          <p className="line-clamp-2 text-[10px] leading-relaxed text-slate-500">
                            📍 {item.address}
                          </p>
                        </div>

                        {/* Nút hành động chính */}
                        <div className="mt-3">
                          <button
                            type="button"
                            className="w-full rounded-lg bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 py-1.5 text-[10px] font-bold text-white shadow-sm hover:shadow transition-all flex items-center justify-center gap-1"
                            onClick={() => navigate(`/user/location/${item.location_id}`)}
                          >
                            Xem chi tiết địa điểm
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              {/* Cột phải: Widget Radar Bản đồ vệ tinh cố định - Tông Sáng Nhã Nhặn */}
              <div className="w-full max-w-[280px] mx-auto lg:mx-0 flex flex-col bg-gradient-to-br from-[#ccefe8]/90 via-[#e2f7f3] to-[#ccefe8]/80 border border-teal-200 rounded-xl p-5 shadow-sm relative overflow-hidden group text-center items-center justify-center min-h-[240px]">
                {/* Viền sáng thanh nhã phía trên */}
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-teal-400/0 via-teal-400/50 to-teal-400/0" />

                {/* Sóng quét radar tông sáng dịu mát */}
                <div className="relative flex items-center justify-center h-16 w-16 mb-4">
                  <span className="absolute inline-flex h-12 w-12 rounded-full bg-teal-100 opacity-70 animate-ping" />
                  <span className="absolute inline-flex h-8 w-8 rounded-full bg-teal-200/50 opacity-60 animate-pulse" />
                  <div className="relative h-10 w-10 rounded-full bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600 shadow-sm transition-transform duration-500 group-hover:scale-105">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                    </svg>
                  </div>
                </div>

                <span className="text-[9px] font-bold tracking-wider text-teal-600/90 uppercase font-sans">VỆ TINH ĐỊNH VỊ</span>
                <h4 className="text-sm font-black text-slate-800 mt-0.5 font-heading">
                  Radar Bản Đồ
                </h4>
                
                <p className="mt-2 text-[10px] leading-relaxed text-slate-600 px-1 font-medium">
                  Đã khóa vị trí <span className="font-extrabold text-teal-700">{locations.length} địa điểm</span> của bạn trên hệ thống. 
                </p>

                <p className="text-[10px] text-slate-400 italic px-2 mt-1 leading-snug">
                  Nhấn nút bên dưới để trực quan hóa tất cả mốc vị trí đã lưu trên bản đồ vệ tinh lớn.
                </p>

                <button
                  onClick={() => navigate("/user/map")}
                  className="mt-4.5 w-full rounded-lg bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 py-2 text-[10px] font-bold text-white shadow-sm hover:shadow transition-all active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M15 3h6v6" />
                    <path d="M10 14L21 3" />
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  </svg>
                  Xem trên Bản đồ lớn
                </button>
              </div>

            </div>
          </div>
        ) : null}
      </section>
    </UserLayout>
  );
};

export default SavedLocations;
