import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import UserLayout from "../../layouts/UserLayout";
import { useLocations } from "../../hooks/useLocations";
import authApi from "../../api/authApi";
import geoApi from "../../api/geoApi";
import { resolveBackendUrl } from "../../utils/resolveBackendUrl";
import userApi from "../../api/userApi";
import { getErrorMessage } from "../../utils/safe";

type WeatherState =
  | {
      status: "idle" | "loading";
    }
  | {
      status: "ready";
      placeLabel: string;
      temperatureC: number;
      description: string;
      weatherCode: number;
      isDay: boolean;
      updatedAt: number;
    }
  | {
      status: "error";
      message: string;
    };

type StoredUser = {
  full_name: string;
  email?: string;
  role?: string;
};

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

const UserDashboard = () => {
  const navigate = useNavigate();

  const [user, setUser] = useState<StoredUser | null>(null);
  const [searchValue, setSearchValue] = useState("");
  const [homeBackgroundUrl, setHomeBackgroundUrl] = useState<string | null>(
    null,
  );

  const [weather, setWeather] = useState<WeatherState>({ status: "idle" });
  const [smartItineraries, setSmartItineraries] = useState<
    Array<{ itinerary_id: number; name: string; description: string | null }>
  >([]);

  const { locations, loading, error, category, setCategory, setKeyword } =
    useLocations();

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

  useEffect(() => {
    const timer = setTimeout(() => {
      setKeyword(searchValue);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchValue, setKeyword]);

  useEffect(() => {
    const run = async () => {
      try {
        const itineraryResp = await userApi.getItineraries();
        if (itineraryResp.success) {
          setSmartItineraries(
            (itineraryResp.data || []).slice(0, 2).map((it) => ({
              itinerary_id: it.itinerary_id,
              name: it.name,
              description: it.description ?? null,
            })),
          );
        }
      } catch (e: unknown) {
        // ignore
        console.warn(getErrorMessage(e, "Không lấy được lịch trình"));
      }
    };

    void run();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const res = await authApi.getAppBackground();
        if (!res?.success) {
          if (!cancelled) setHomeBackgroundUrl(null);
          return;
        }

        const resolved = resolveBackendUrl(res.data?.image_url);
        if (!resolved) {
          if (!cancelled) setHomeBackgroundUrl(null);
          return;
        }

        const img = new Image();
        img.onload = () => {
          if (!cancelled) setHomeBackgroundUrl(resolved);
        };
        img.onerror = () => {
          if (!cancelled) setHomeBackgroundUrl(null);
        };
        img.src = resolved;
      } catch {
        if (!cancelled) setHomeBackgroundUrl(null);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const categories = useMemo(
    () => ["Tất cả", "Ăn uống", "Vui chơi", "Khách sạn", "Du lịch xanh"],
    [],
  );

  useEffect(() => {
    let cancelled = false;
    const weatherCodeText = (code: number) => {
      // Mapping tối giản theo Open-Meteo weather_code.
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
        const addr = (json as any)?.address;
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
      const json = (await resp.json()) as any;
      const t = Number(json?.current?.temperature_2m);
      const code = Number(json?.current?.weather_code);
      const isDayRaw = Number(json?.current?.is_day);
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
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            const data = await fetchWeather(lat, lng);
            if (cancelled) return;
            setWeather({
              status: "ready",
              ...data,
              updatedAt: Date.now(),
            });
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
        {
          enableHighAccuracy: false,
          timeout: 8000,
          maximumAge: 10 * 60 * 1000,
        },
      );
    };

    void run();
    const id = window.setInterval(() => void run(), 60 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const weatherIcon = (state: WeatherState) => {
    if (state.status !== "ready") return null;
    const code = state.weatherCode;
    const isDay = state.isDay;

    // Minimal icon set: day-sun, cloud, rain, night-moon.
    const Icon = ({ children }: { children: React.ReactNode }) => (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-xl bg-white/70 text-gray-900 shadow-sm backdrop-blur">
        {children}
      </span>
    );

    if (!isDay) {
      return (
        <Icon>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        </Icon>
      );
    }

    // Rain codes: drizzle/rain/showers/thunder.
    if (
      code === 51 ||
      code === 53 ||
      code === 55 ||
      code === 61 ||
      code === 63 ||
      code === 65 ||
      code === 80 ||
      code === 81 ||
      code === 82 ||
      code === 95 ||
      code === 96 ||
      code === 99
    ) {
      return (
        <Icon>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M16 13a4 4 0 0 0-8 0" />
            <path d="M5 16a4 4 0 0 1 1-7 5 5 0 0 1 9.8-1.5A4 4 0 1 1 18 16" />
            <line x1="8" y1="19" x2="8" y2="21" />
            <line x1="12" y1="19" x2="12" y2="21" />
            <line x1="16" y1="19" x2="16" y2="21" />
          </svg>
        </Icon>
      );
    }

    // Cloudy codes.
    if (code === 3 || code === 2 || code === 1 || code === 45 || code === 48) {
      return (
        <Icon>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M17.5 19a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.6-1.4A4 4 0 0 0 6 19h11.5z" />
          </svg>
        </Icon>
      );
    }

    // Sunny.
    return (
      <Icon>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
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
      </Icon>
    );
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4" />
          <p className="text-gray-600">Đang tải...</p>
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
      <section className="relative z-0 -mx-4 min-h-[260px] overflow-hidden rounded-3xl border border-white/70 bg-white shadow-sm sm:-mx-6 sm:min-h-[300px] lg:-mx-8">
        <div
          className="absolute inset-0"
          style={
            homeBackgroundUrl
              ? {
                  backgroundImage: `url(${homeBackgroundUrl})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : {
                  background:
                    "linear-gradient(120deg, rgba(59,130,246,0.18), rgba(14,165,233,0.10), rgba(99,102,241,0.12))",
                }
          }
        />
        {/* Keep text readable on busy photos: stronger overlay on left side */}
        <div className="absolute inset-0 bg-gradient-to-r from-white/80 via-white/45 to-white/20" />
        <div className="relative px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="md:absolute md:right-6 md:top-4 lg:right-8 lg:top-5">
            <div className="rounded-2xl border border-white/60 bg-white/80 px-3 py-2 shadow-sm backdrop-blur max-w-[260px]">
              {weather.status === "ready" ? (
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      {weatherIcon(weather)}
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {weather.placeLabel}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 shrink-0">
                      {Math.round(weather.temperatureC)}°C
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-gray-600">
                    {weather.description}
                  </p>
                </div>
              ) : weather.status === "loading" ? (
                <p className="text-sm text-gray-700">Đang lấy thời tiết...</p>
              ) : weather.status === "error" ? (
                <p className="text-sm text-gray-700">{weather.message}</p>
              ) : (
                <p className="text-sm text-gray-700">Thời tiết</p>
              )}
            </div>
          </div>

          <h2 className="mt-5 text-3xl font-semibold leading-tight text-gray-900 sm:mt-0 sm:text-4xl">
            Chào {user.full_name}, bạn muốn
            <br className="hidden sm:block" />
            đi đâu hôm nay?
          </h2>
          <p className="mt-2 max-w-2xl">
            <span className="inline-flex rounded-full bg-white/70 px-3 py-1 text-sm sm:text-base text-gray-800 shadow-sm backdrop-blur">
              Khám phá ngay nhiều địa điểm thú vị và tiện ích tận hưởng.
            </span>
          </p>

          <div className="mt-5 max-w-2xl">
            <div className="relative">
              <input
                className="w-full rounded-full border border-white/60 bg-white/75 py-3 pl-11 pr-4 text-sm shadow-sm backdrop-blur focus:border-blue-400 focus:outline-none"
                placeholder="Tìm kiếm địa điểm, nhà hàng, khách sạn..."
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
              />
              <span className="absolute left-4 top-3.5 text-gray-500">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </span>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {categories.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCategory(item)}
                  className={`rounded-full px-4 py-2 text-xs font-medium transition ${
                    category === item
                      ? "bg-blue-600 text-white"
                      : "bg-white/70 text-gray-700 hover:bg-white"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="rounded-3xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur sm:p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900">
              Đề xuất địa điểm phù hợp cho bạn
            </h3>
            <button
              type="button"
              className="text-sm text-blue-600 hover:text-blue-700"
              onClick={() => setCategory("Tất cả")}
            >
              Xem thêm
            </button>
          </div>

          <div className="mt-4">
            {loading ? (
              <div className="rounded-2xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
                Đang tải danh sách địa điểm...
              </div>
            ) : null}

            {error ? (
              <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-center text-sm text-red-600">
                {error}
              </div>
            ) : null}

            {!loading && locations.length === 0 ? (
              <div className="rounded-2xl border border-gray-100 p-6 text-center text-sm text-gray-500">
                Chưa có địa điểm phù hợp với bộ lọc hiện tại.
              </div>
            ) : null}

            {!loading && locations.length > 0 ? (
              <div className="-mx-1 overflow-x-auto px-1 pb-2">
                <div className="grid w-max grid-flow-col gap-3 auto-cols-[280px] sm:auto-cols-[300px] lg:auto-cols-[320px]">
                  {locations.map((locationItem) => {
                    const imageUrl = resolveBackendUrl(
                      locationItem.first_image,
                    );
                    return (
                      <div
                        key={locationItem.location_id}
                        className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition"
                      >
                        <div className="w-full aspect-[16/10]">
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={locationItem.location_name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="h-full w-full bg-gradient-to-br from-blue-100 via-sky-100 to-blue-200" />
                          )}
                        </div>

                        <div className="p-3">
                          <h4 className="font-semibold text-gray-900">
                            {locationItem.location_name}
                          </h4>
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                            {locationItem.address}
                          </p>

                          <div className="mt-3 flex items-center justify-between gap-3">
                            <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-[10px] font-medium text-blue-700">
                              {locationItem.location_type}
                            </span>
                            <div className="flex min-w-0 flex-1 items-end justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-xs font-semibold text-amber-700">
                                  ★{" "}
                                  {Number(locationItem.rating || 0).toFixed(1)}{" "}
                                  ({Number(locationItem.total_reviews || 0)})
                                </div>
                                <div className="text-[11px] text-gray-500"></div>
                              </div>
                              <div className="shrink-0 text-right">
                                <div className="text-[11px] uppercase tracking-wide text-gray-400">
                                  Tổng lượt
                                </div>
                                <div className="text-xs font-semibold text-slate-700">
                                  {Number(locationItem.total_reviews || 0)} đánh
                                  giá
                                </div>
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            className="mt-3 w-full rounded-2xl bg-blue-600 py-2.5 text-sm text-white hover:bg-blue-700"
                            onClick={() =>
                              navigate(
                                `/user/location/${locationItem.location_id}`,
                              )
                            }
                          >
                            Xem chi tiết
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-3xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">
                Lịch trình thông minh
              </h3>
              <span className="text-xs text-gray-500">AI</span>
            </div>

            <div className="mt-4 space-y-2">
              {smartItineraries.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 p-4 text-sm text-gray-500">
                  Chưa có lịch trình. Bạn có thể tạo chuyến đi hoặc dùng AI gợi
                  ý.
                </div>
              ) : (
                smartItineraries.map((it) => (
                  <button
                    key={it.itinerary_id}
                    type="button"
                    className="w-full rounded-2xl border border-gray-100 bg-white px-4 py-2.5 text-left hover:bg-gray-50"
                    onClick={() => navigate("/user/itinerary")}
                  >
                    <p className="text-sm font-semibold text-gray-900">
                      {it.name}
                    </p>
                    <p className="mt-1 text-xs text-gray-500 line-clamp-2">
                      {it.description || "Lịch trình của bạn"}
                    </p>
                  </button>
                ))
              )}
            </div>

            <button
              type="button"
              className="mt-3 w-full rounded-2xl bg-blue-600 py-2.5 text-sm text-white hover:bg-blue-700"
              onClick={() => navigate("/user/itinerary")}
            >
              Gợi ý ngay
            </button>
          </div>

          <div className="rounded-3xl border border-white/70 bg-white/80 shadow-sm backdrop-blur p-4">
            <h3 className="text-base font-semibold text-gray-900">
              Tiện ích tín hiệu SOS
            </h3>
            <div className="mt-4 flex items-center justify-center">
              <button
                type="button"
                className="h-24 w-24 rounded-full bg-red-500 text-white text-xl font-bold shadow-lg hover:bg-red-600"
                onClick={() => navigate("/user/sos")}
              >
                SOS
              </button>
            </div>
            <p className="mt-4 text-xs text-gray-500 text-center">
              Gửi tín hiệu khi cần hỗ trợ khẩn cấp.
            </p>
          </div>
        </aside>
      </div>
    </UserLayout>
  );
};

export default UserDashboard;
