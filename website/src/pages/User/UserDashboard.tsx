import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import UserLayout from "../../layouts/UserLayout";
import { useLocations } from "../../hooks/useLocations";
import type { LocationType } from "../../types/location.types";
import geoApi from "../../api/geoApi";
import { resolveBackendUrl } from "../../utils/resolveBackendUrl";
import userApi from "../../api/userApi";
import { getErrorMessage } from "../../utils/safe";

// Dịch location_type sang tiếng Việt
const locationTypeVi: Record<LocationType, string> = {
  hotel: "Khách sạn",
  restaurant: "Nhà hàng",
  tourist: "Du lịch",
  cafe: "Quán cafe",
  resort: "Resort",
  other: "Khác",
};

// Rút gọn địa chỉ: chỉ lấy tên đường + phường/xã
const shortAddress = (addr: string): string => {
  const parts = addr.split(",").map((s) => s.trim());
  if (parts.length <= 2) return addr;
  return `${parts[0]}, ${parts[1]}`;
};

type WeatherState =
  | { status: "idle" | "loading" }
  | {
      status: "ready";
      placeLabel: string;
      temperatureC: number;
      description: string;
      weatherCode: number;
      isDay: boolean;
    }
  | { status: "error"; message: string };

type StoredUser = {
  full_name: string;
  email?: string;
  role?: string;
};

// Dùng để parse user từ sessionStorage an toàn
const parseStoredUser = (value: string): StoredUser | null => {
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== "object" || parsed === null) return null;
    const obj = parsed as Record<string, unknown>;
    if (typeof obj.full_name !== "string") return null;
    return {
      full_name: obj.full_name,
      email: typeof obj.email === "string" ? obj.email : undefined,
      role: typeof obj.role === "string" ? obj.role : undefined,
    };
  } catch {
    return null;
  }
};

// Lời chào theo buổi trong ngày
const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) return "Chào buổi sáng";
  if (hour < 18) return "Chào buổi chiều";
  return "Chào buổi tối";
};

// Lấy ngày giờ hiện tại định dạng tiếng Việt
const getFormattedDate = (): string => {
  const days = [
    "Chủ nhật",
    "Thứ hai",
    "Thứ ba",
    "Thứ tư",
    "Thứ năm",
    "Thứ sáu",
    "Thứ bảy",
  ];
  const now = new Date();
  const day = days[now.getDay()];
  const date = now.getDate();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  return `${day}, ngày ${date} tháng ${month} năm ${year}`;
};

const UserDashboard = () => {
  const navigate = useNavigate();

  const [user, setUser] = useState<StoredUser | null>(null);
  const [searchValue, setSearchValue] = useState("");
  const [weather, setWeather] = useState<WeatherState>({ status: "idle" });
  const [smartItineraries, setSmartItineraries] = useState<
    Array<{ itinerary_id: number; name: string; description: string | null }>
  >([]);
  const [stats, setStats] = useState({
    checkins: 0,
    favorites: 0,
    vouchers: 0,
  });

  const { locations, loading, error, category, setCategory, setKeyword } =
    useLocations();

  // Kiểm tra đăng nhập
  useEffect(() => {
    try {
      const userStr = sessionStorage.getItem("user");
      if (!userStr) {
        navigate("/login", { replace: true });
        return;
      }
      const userData = parseStoredUser(userStr);
      if (!userData) {
        navigate("/login", { replace: true });
        return;
      }
      setUser(userData);
    } catch {
      navigate("/login", { replace: true });
    }
  }, [navigate]);

  // Debounce tìm kiếm
  useEffect(() => {
    const timer = setTimeout(() => {
      setKeyword(searchValue);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchValue, setKeyword]);

  // Lấy lịch trình AI
  useEffect(() => {
    const run = async () => {
      try {
        const resp = await userApi.getItineraries();
        if (resp.success) {
          setSmartItineraries(
            (resp.data || []).slice(0, 3).map((it) => ({
              itinerary_id: it.itinerary_id,
              name: it.name,
              description: it.description ?? null,
            })),
          );
        }
      } catch (e: unknown) {
        console.warn(getErrorMessage(e, "Không lấy được lịch trình"));
      }
    };
    void run();
  }, []);

  // Lấy thống kê (check-in, yêu thích, voucher)
  useEffect(() => {
    const run = async () => {
      try {
        const [checkinResp, favResp, voucherResp] = await Promise.allSettled([
          userApi.getCheckins(),
          userApi.getFavorites(),
          userApi.getVouchers(),
        ]);
        setStats({
          checkins:
            checkinResp.status === "fulfilled"
              ? (checkinResp.value?.data?.length ?? 0)
              : 0,
          favorites:
            favResp.status === "fulfilled"
              ? (favResp.value?.data?.length ?? 0)
              : 0,
          vouchers:
            voucherResp.status === "fulfilled"
              ? (voucherResp.value?.data?.length ?? 0)
              : 0,
        });
      } catch {
        // ignore
      }
    };
    void run();
  }, []);

  // Lấy thời tiết theo vị trí
  useEffect(() => {
    let cancelled = false;

    const weatherCodeText = (code: number): string => {
      if (code === 0) return "Trời quang";
      if (code === 1 || code === 2) return "Ít mây";
      if (code === 3) return "Nhiều mây";
      if (code === 45 || code === 48) return "Sương mù";
      if (code === 51 || code === 53 || code === 55) return "Mưa phùn";
      if (code === 61 || code === 63 || code === 65) return "Mưa";
      if (code === 71 || code === 73 || code === 75) return "Tuyết";
      if (code === 80 || code === 81 || code === 82) return "Mưa rào";
      if (code === 95) return "Giông";
      if (code === 96 || code === 99) return "Giông mạnh";
      return "Thời tiết";
    };

    const reverseGeocode = async (lat: number, lng: number) => {
      try {
        const key = `tc-revgeo:${lat.toFixed(3)},${lng.toFixed(3)}`;
        const cached = sessionStorage.getItem(key);
        if (cached) return cached;
        const json = await geoApi.reverse(lat, lng);
        const addr = (json as Record<string, unknown>)?.address as
          | Record<string, string>
          | undefined;
        const city =
          addr?.city ||
          addr?.town ||
          addr?.village ||
          addr?.municipality ||
          addr?.state ||
          null;
        const label =
          typeof city === "string" && city.trim() ? city : "Vị trí hiện tại";
        sessionStorage.setItem(key, label);
        return label;
      } catch {
        return "Vị trí hiện tại";
      }
    };

    const fetchWeather = async (lat: number, lng: number) => {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code,is_day&timezone=auto`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error("Không lấy được thời tiết");
      const json = (await resp.json()) as Record<string, unknown>;
      const current = json?.current as Record<string, unknown> | undefined;
      const t = Number(current?.temperature_2m);
      const code = Number(current?.weather_code);
      const isDayRaw = Number(current?.is_day);
      if (!Number.isFinite(t) || !Number.isFinite(code)) {
        throw new Error("Dữ liệu thời tiết không hợp lệ");
      }
      const placeLabel = await reverseGeocode(lat, lng);
      return {
        placeLabel,
        temperatureC: t,
        description: weatherCodeText(code),
        weatherCode: code,
        isDay: isDayRaw === 1,
      };
    };

    const run = async () => {
      if (!navigator.geolocation) {
        setWeather({ status: "error", message: "Thiết bị không hỗ trợ GPS" });
        return;
      }
      setWeather({ status: "loading" });
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const data = await fetchWeather(
              pos.coords.latitude,
              pos.coords.longitude,
            );
            if (cancelled) return;
            setWeather({ status: "ready", ...data });
          } catch (e: unknown) {
            if (cancelled) return;
            setWeather({
              status: "error",
              message: getErrorMessage(e, "Không thể lấy thời tiết"),
            });
          }
        },
        () => {
          if (cancelled) return;
          setWeather({
            status: "error",
            message: "Bạn chưa cấp quyền vị trí",
          });
        },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 },
      );
    };

    void run();
    const id = window.setInterval(() => void run(), 3600000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const categories = useMemo(
    () => ["Tất cả", "Khám phá", "Ẩm thực", "Lưu trú"],
    [],
  );

  // SVG icons cho thời tiết
  const WeatherIcon = ({ code, isDay }: { code: number; isDay: boolean }) => {
    if (!isDay) {
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      );
    }
    if ([51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99].includes(code)) {
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 13a4 4 0 0 0-8 0" />
          <path d="M5 16a4 4 0 0 1 1-7 5 5 0 0 1 9.8-1.5A4 4 0 1 1 18 16" />
          <line x1="8" y1="19" x2="8" y2="21" />
          <line x1="12" y1="19" x2="12" y2="21" />
          <line x1="16" y1="19" x2="16" y2="21" />
        </svg>
      );
    }
    if ([3, 2, 1, 45, 48].includes(code)) {
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17.5 19a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.6-1.4A4 4 0 0 0 6 19h11.5z" />
        </svg>
      );
    }
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="4" />
        <line x1="12" y1="2" x2="12" y2="4" />
        <line x1="12" y1="20" x2="12" y2="22" />
        <line x1="2" y1="12" x2="4" y2="12" />
        <line x1="20" y1="12" x2="22" y2="12" />
        <line x1="4.2" y1="4.2" x2="5.6" y2="5.6" />
        <line x1="18.4" y1="18.4" x2="19.8" y2="19.8" />
        <line x1="18.4" y1="5.6" x2="19.8" y2="4.2" />
        <line x1="4.2" y1="19.8" x2="5.6" y2="18.4" />
      </svg>
    );
  };

  // Quick action items
  const quickActions = [
    {
      label: "Bản đồ",
      path: "/user/map",
      color: "bg-sky-50 text-sky-600 border-sky-200/60",
      icon: (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" />
          <path d="M9 4v14" />
          <path d="M15 6v14" />
        </svg>
      ),
    },
    {
      label: "QR",
      path: "/user/qr-checkin",
      color: "bg-teal-50 text-teal-600 border-teal-200/60",
      icon: (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
          <path d="M14 14h3v3h-3z" />
          <path d="M17 17h4" />
        </svg>
      ),
    },
    {
      label: "Lịch trình",
      path: "/user/itinerary",
      color: "bg-violet-50 text-violet-600 border-violet-200/60",
      icon: (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="3" />
          <path d="M8 2v4" />
          <path d="M16 2v4" />
          <path d="M3 10h18" />
        </svg>
      ),
    },
    {
      label: "Đã lưu",
      path: "/user/saved-locations",
      color: "bg-amber-50 text-amber-600 border-amber-200/60",
      icon: (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 3h12v18l-6-4-6 4z" />
        </svg>
      ),
    },
    {
      label: "Voucher",
      path: "/user/vouchers",
      color: "bg-emerald-50 text-emerald-600 border-emerald-200/60",
      icon: (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 7h18v10H3z" />
          <path d="M7 7v10" />
          <path d="M17 7v10" />
        </svg>
      ),
    },
    {
      label: "SOS",
      path: "/user/sos",
      color: "bg-rose-50 text-rose-600 border-rose-200/60",
      icon: (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v6" />
          <path d="M5.5 20a7 7 0 1 1 13 0" />
          <circle cx="12" cy="9" r="3" />
        </svg>
      ),
    },
  ];

  // Loading state
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500 mx-auto mb-4" />
          <p className="text-slate-600 text-base">Đang tải...</p>
        </div>
      </div>
    );
  }

  return (
    <UserLayout
      title="Khám phá địa điểm"
      subtitle=""
      activeKey="/user/dashboard"
      showSearch={false}
      flushTop
    >
      {/* ===== Greeting bar compact ===== */}
      <section className="user-section p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-800 font-heading">
              {getGreeting()}, {user.full_name}
            </h2>
            <p className="mt-1 text-sm text-slate-500">{getFormattedDate()}</p>
          </div>

          {/* Weather inline */}
          <div className="inline-flex items-center gap-3 rounded-2xl border border-slate-200/60 bg-white px-4 py-2.5 shadow-sm">
            {weather.status === "ready" ? (
              <>
                <span className="text-sky-500">
                  <WeatherIcon
                    code={weather.weatherCode}
                    isDay={weather.isDay}
                  />
                </span>
                <div className="text-sm">
                  <p className="font-semibold text-slate-800">
                    {Math.round(weather.temperatureC)}°C
                  </p>
                  <p className="text-xs text-slate-500">
                    {weather.placeLabel}
                  </p>
                </div>
                <span className="text-xs text-slate-400 border-l border-slate-200 pl-3">
                  {weather.description}
                </span>
              </>
            ) : weather.status === "loading" ? (
              <p className="text-sm text-slate-500">Đang tải thời tiết...</p>
            ) : weather.status === "error" ? (
              <p className="text-sm text-slate-500">{weather.message}</p>
            ) : (
              <p className="text-sm text-slate-500">Thời tiết</p>
            )}
          </div>
        </div>
      </section>

      {/* ===== Quick actions ===== */}
      <section className="user-section p-5 sm:p-6">
        <h3 className="text-base font-bold text-slate-800 font-heading mb-4">
          Truy cập nhanh
        </h3>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {quickActions.map((action) => (
            <button
              key={action.path}
              type="button"
              onClick={() => navigate(action.path)}
              className={`user-sub-card card-lift flex flex-col items-center gap-2.5 rounded-2xl border px-3 py-4 text-center transition-all duration-200 ${action.color}`}
            >
              {action.icon}
              <span className="text-xs font-semibold leading-tight">
                {action.label}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* ===== Main content: locations + sidebar ===== */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        {/* Left: Search + Categories + Location cards */}
        <section className="user-section p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-800 font-heading">
                Đề xuất cho bạn
              </h3>
              <p className="text-sm text-slate-500 mt-0.5">
                Khám phá các địa điểm nổi bật
              </p>
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-700 transition-all duration-200 hover:bg-teal-100 self-start sm:self-auto"
              onClick={() => setCategory("Tất cả")}
            >
              Xem tất cả
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="m13 6 6 6-6 6" />
              </svg>
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <input
              className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm shadow-sm transition-all duration-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none"
              placeholder="Tìm kiếm địa điểm, nhà hàng, khách sạn..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
            />
            <span className="absolute left-4 top-3.5 text-slate-400">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
          </div>

          {/* Categories */}
          <div className="flex flex-wrap gap-2 mb-5">
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                className={`whitespace-nowrap user-chip ${
                  category === item ? "user-chip-active" : "user-chip-idle"
                }`}
              >
                {item}
              </button>
            ))}
          </div>

          {/* Loading skeleton */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="user-sub-card overflow-hidden"
                >
                  <div className="aspect-square skeleton-box" />
                  <div className="p-4 space-y-3">
                    <div className="h-4 w-3/4 skeleton-box" />
                    <div className="h-3 w-full skeleton-box" />
                    <div className="h-3 w-1/2 skeleton-box" />
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {/* Error */}
          {error ? (
            <div className="rounded-2xl border border-rose-100 bg-rose-50 p-6 text-center text-sm text-rose-600">
              {error}
            </div>
          ) : null}

          {/* Empty state */}
          {!loading && locations.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-gradient-to-br from-slate-50 to-white py-14 text-center">
              <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.2" className="mx-auto text-slate-300">
                <path d="M12 3a7 7 0 0 1 7 7c0 5-7 11-7 11s-7-6-7-11a7 7 0 0 1 7-7z" />
                <circle cx="12" cy="10" r="2.5" />
              </svg>
              <p className="mt-4 text-base font-semibold text-slate-600">
                Chưa có địa điểm phù hợp
              </p>
              <p className="mt-1 text-sm text-slate-400">
                Thử thay đổi bộ lọc hoặc tìm kiếm khác
              </p>
              <button
                type="button"
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal-500/25 transition-all duration-200 hover:bg-teal-700 hover:shadow-xl"
                onClick={() => {
                  setSearchValue("");
                  setCategory("Tất cả");
                }}
              >
                Đặt lại bộ lọc
              </button>
            </div>
          ) : null}

          {/* Location cards — thon, comment trái + rating phải */}
          {!loading && locations.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
              {locations.map((loc, idx) => {
                const imageUrl = resolveBackendUrl(loc.first_image);
                const ratingVal = Number(loc.rating || 0);
                const reviewCount = Number(loc.total_reviews || 0);
                const typeLabel = locationTypeVi[loc.location_type] ?? loc.location_type;
                return (
                  <button
                    key={loc.location_id}
                    type="button"
                    className="user-sub-card card-lift flex flex-col overflow-hidden text-left animate-fade-in"
                    style={{
                      animationDelay: `${Math.min(idx * 0.06, 0.3)}s`,
                      animationFillMode: "both",
                    }}
                    onClick={() =>
                      navigate(`/user/location/${loc.location_id}`)
                    }
                  >
                    {/* Ảnh — 3:2 thon */}
                    <div className="relative w-full aspect-[5/3] overflow-hidden">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={loc.location_name}
                          className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                        />
                      ) : (
                        <div className="h-full w-full bg-gradient-to-br from-teal-100 via-emerald-50 to-cyan-100 flex items-center justify-center">
                          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-teal-300">
                            <path d="M12 3a7 7 0 0 1 7 7c0 5-7 11-7 11s-7-6-7-11a7 7 0 0 1 7-7z" />
                            <circle cx="12" cy="10" r="2.5" />
                          </svg>
                        </div>
                      )}
                      <span className="absolute top-1.5 left-1.5 rounded bg-black/50 backdrop-blur-sm px-1.5 py-0.5 text-[9px] font-bold text-white">
                        {typeLabel}
                      </span>
                    </div>

                    {/* Nội dung */}
                    <div className="flex flex-1 flex-col px-3 py-4">
                      {/* Tên */}
                      <h4 className="text-xs font-bold text-slate-800 line-clamp-1 font-heading">
                        {loc.location_name}
                      </h4>

                      {/* Đánh giá (trái) + Rating (phải) — cùng hàng */}
                      <div className="mt-3 flex items-center justify-between gap-1.5">
                        <p className="flex-1 min-w-0 text-[10px] text-slate-400 line-clamp-1">
                          {reviewCount > 0 ? reviewCount + " đánh giá" : "Chưa có đánh giá"}
                        </p>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <svg viewBox="0 0 24 24" width="10" height="10" fill={ratingVal > 0 ? "#f59e0b" : "#cbd5e1"}>
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                          </svg>
                          <span className="text-[10px] font-bold text-slate-600">
                            {ratingVal > 0 ? ratingVal.toFixed(1) : "0"}
                          </span>
                        </div>
                      </div>

                      {/* Đường kẻ phân cách */}
                      <div className="mt-3 border-t border-slate-100" />

                      {/* Địa chỉ */}
                      <p className="mt-3 flex items-center gap-1 text-[10px] text-slate-400 line-clamp-1">
                        <svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                          <path d="M12 3a7 7 0 0 1 7 7c0 5-7 11-7 11s-7-6-7-11a7 7 0 0 1 7-7z" />
                        </svg>
                        <span className="truncate">{shortAddress(loc.address)}</span>
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : null}
        </section>

        {/* Right: Sidebar */}
        <aside className="space-y-5">
          {/* ===== Stats ===== */}
          <div className="user-section p-5">
            <h3 className="text-base font-bold text-slate-800 font-heading mb-4">
              Hoạt động của bạn
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="user-sub-card p-3 text-center">
                <p className="text-2xl font-bold text-teal-600 font-heading">
                  {stats.checkins}
                </p>
                <p className="text-[11px] text-slate-500 mt-1 font-semibold">
                  Check-in
                </p>
              </div>
              <div className="user-sub-card p-3 text-center">
                <p className="text-2xl font-bold text-amber-500 font-heading">
                  {stats.favorites}
                </p>
                <p className="text-[11px] text-slate-500 mt-1 font-semibold">
                  Đã lưu
                </p>
              </div>
              <div className="user-sub-card p-3 text-center">
                <p className="text-2xl font-bold text-emerald-500 font-heading">
                  {stats.vouchers}
                </p>
                <p className="text-[11px] text-slate-500 mt-1 font-semibold">
                  Voucher
                </p>
              </div>
            </div>
          </div>

          {/* ===== Lịch trình thông minh ===== */}
          <div className="relative overflow-hidden user-section p-5">
            <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-teal-100/40 blur-2xl" />
            <div className="absolute -left-8 bottom-0 h-24 w-24 rounded-full bg-emerald-100/30 blur-2xl" />
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-slate-800 font-heading">
                  Lịch trình thông minh
                </h3>
                <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
                  <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                  AI
                </span>
              </div>

              <div className="space-y-2.5">
                {smartItineraries.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-teal-200 bg-white/60 px-4 py-5 text-center">
                    <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto text-teal-300">
                      <rect x="3" y="4" width="18" height="18" rx="3" />
                      <path d="M8 2v4M16 2v4M3 10h18" />
                    </svg>
                    <p className="mt-2 text-sm text-slate-500 font-medium">
                      Chưa có lịch trình
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      Tạo chuyến đi hoặc dùng AI gợi ý
                    </p>
                  </div>
                ) : (
                  smartItineraries.map((it) => (
                    <button
                      key={it.itinerary_id}
                      type="button"
                      className="w-full rounded-xl border border-slate-100 bg-white/80 px-4 py-3 text-left shadow-sm transition-all duration-200 hover:border-teal-200 hover:shadow-md hover:bg-white"
                      onClick={() => navigate("/user/itinerary")}
                    >
                      <p className="text-sm font-semibold text-slate-800 line-clamp-1">
                        {it.name}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 line-clamp-1">
                        {it.description || "Lịch trình của bạn"}
                      </p>
                    </button>
                  ))
                )}
              </div>

              <button
                type="button"
                className="mt-4 w-full rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 py-3 text-sm font-bold text-white shadow-lg shadow-teal-500/25 transition-all duration-200 hover:shadow-xl hover:shadow-teal-500/30 active:scale-[0.98]"
                onClick={() => navigate("/user/itinerary")}
              >
                Gợi ý ngay
              </button>
            </div>
          </div>

          {/* ===== Mẹo du lịch (SVG icon, không emoji) ===== */}
          <div className="user-section p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-amber-500">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18h6" />
                  <path d="M10 22h4" />
                  <path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" />
                </svg>
              </span>
              <h3 className="text-sm font-bold text-slate-800 font-heading">
                Mẹo du lịch
              </h3>
            </div>
            <ul className="space-y-2.5 text-sm text-slate-600">
              <li className="flex items-start gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                Dùng QR check-in để tích điểm nhanh hơn
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-400" />
                Lưu địa điểm yêu thích để xem lại sau
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" />
                Tham gia nhóm để xem bạn bè check-in
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </UserLayout>
  );
};

export default UserDashboard;
