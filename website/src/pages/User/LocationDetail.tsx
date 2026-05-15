import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import UserLayout from "../../layouts/UserLayout";
import { useLocationDetail } from "../../hooks/useLocationDetail";
import { resolveBackendUrl } from "../../utils/resolveBackendUrl";
import { parseLatLngMaybeSwap } from "../../utils/latLng";
import {
  extractOpenClose,
  isWithinOpeningHours,
} from "../../utils/openingHours";
import userApi from "../../api/userApi";
import locationApi from "../../api/locationApi";
import { getErrorMessage } from "../../utils/safe";
import { formatDateTimeVi } from "../../utils/formatDateVi";
import {
  REVIEW_UPDATED_EVENT,
  dispatchReviewUpdated,
} from "../../utils/reviewSync";
import type { LocationReview } from "../../types/location.types";
import type { VoucherItem } from "../../types/user.types";

const toNumber = (value?: string): number | null => {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

type DetailTab = "overview" | "reviews" | "intro";
type PublicServiceRow = {
  service_id: number;
  location_id: number;
  service_name: string;
  service_type: "room" | "table" | "ticket" | "food" | "combo" | "other";
  price: number | string;
};

const normalizeLocationImages = (value: unknown): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item || "").trim()).filter(Boolean);
      }
    } catch {
      return value.trim() ? [value.trim()] : [];
    }
  }
  return [];
};

const normalizeReviewImages = (value: unknown): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item || "").trim()).filter(Boolean);
      }
    } catch {
      return value.trim() ? [value.trim()] : [];
    }
  }
  return [];
};

const bookingLabelByLocationType = (locationType: unknown): string => {
  const t = String(locationType ?? "")
    .trim()
    .toLowerCase();
  if (t === "restaurant" || t === "cafe") return "Đặt bàn trước";
  if (t === "hotel" || t === "resort") return "Đặt phòng";
  if (t === "tourist") return "Mua vé";
  return "Đặt trước";
};

const pickPrimaryServiceForLocation = (
  services: PublicServiceRow[],
  locationType: unknown,
) => {
  if (!services.length) return null;
  const t = String(locationType ?? "")
    .trim()
    .toLowerCase();
  const wanted: PublicServiceRow["service_type"][] =
    t === "restaurant" || t === "cafe"
      ? ["table", "food", "combo", "other"]
      : t === "hotel" || t === "resort"
        ? ["room", "combo", "other"]
        : t === "tourist"
          ? ["ticket", "combo", "other"]
          : ["other", "combo", "food", "table", "room", "ticket"];

  for (const type of wanted) {
    const found = services.find((item) => item.service_type === type);
    if (found) return found;
  }
  return services[0] ?? null;
};

const typeLabel = (value: unknown) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (normalized === "restaurant") return "Nhà hàng";
  if (normalized === "cafe") return "Quán cà phê";
  if (normalized === "hotel") return "Khách sạn";
  if (normalized === "resort") return "Khu nghỉ dưỡng";
  if (normalized === "tourist") return "Du lịch";
  return normalized || "Địa điểm";
};

const weatherLabelByCode = (code?: number) => {
  if (code == null) return "Trời quang";
  if ([0, 1].includes(code)) return "Trời quang";
  if ([2, 3].includes(code)) return "Có mây";
  if ([45, 48].includes(code)) return "Sương mù";
  if ([51, 53, 55, 56, 57].includes(code)) return "Mưa phùn";
  if ([61, 63, 65, 80, 81, 82].includes(code)) return "Mưa";
  if ([66, 67].includes(code)) return "Mưa lạnh";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Tuyết";
  if ([95, 96, 99].includes(code)) return "Dông";
  return "Thời tiết";
};

const weatherIconByCode = (code?: number) => {
  if (code == null) return "☀";
  if ([0, 1].includes(code)) return "☀";
  if ([2, 3, 45, 48].includes(code)) return "☁";
  if ([61, 63, 65, 80, 81, 82, 51, 53, 55].includes(code)) return "🌧";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "❄";
  if ([95, 96, 99].includes(code)) return "⛈";
  return "☀";
};

const QuickAction = ({
  label,
  onClick,
  icon,
  disabled,
}: {
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
  disabled?: boolean;
}) => (
  <button
    type="button"
    className="flex flex-col items-center gap-1.5 rounded-2xl bg-slate-50 px-2 py-2 text-center text-[11px] font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
    onClick={onClick}
    disabled={disabled}
  >
    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm">
      {icon}
    </span>
    <span>{label}</span>
  </button>
);

const LocationDetail = () => {
  const navigate = useNavigate();
  const params = useParams();
  const locationId = toNumber(params.id);
  const {
    loading,
    error,
    location,
    refetch: refetchLocationDetail,
  } = useLocationDetail(locationId ?? undefined);

  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const [services, setServices] = useState<PublicServiceRow[]>([]);
  const [reviews, setReviews] = useState<LocationReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [vouchers, setVouchers] = useState<VoucherItem[]>([]);
  const [vouchersLoading, setVouchersLoading] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [reportText, setReportText] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportMessage, setReportMessage] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState<number>(0);
  const [reviewText, setReviewText] = useState("");
  const [reviewFiles, setReviewFiles] = useState<File[]>([]);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewMessage, setReviewMessage] = useState<string | null>(null);
  const [reviewFilter, setReviewFilter] = useState<number>(0);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherTemp, setWeatherTemp] = useState<number | null>(null);
  const [weatherCode, setWeatherCode] = useState<number | null>(null);

  const mapCoords = useMemo(
    () => parseLatLngMaybeSwap(location?.latitude, location?.longitude),
    [location?.latitude, location?.longitude],
  );

  const galleryImages = useMemo(() => {
    const rawImages = normalizeLocationImages(location?.images).map(
      (item) => resolveBackendUrl(item) || item,
    );
    const hero = resolveBackendUrl(location?.first_image);
    if (hero && !rawImages.includes(hero)) {
      return [hero, ...rawImages];
    }
    return rawImages;
  }, [location?.first_image, location?.images]);

  const coverImage =
    galleryImages[0] || resolveBackendUrl(location?.first_image) || null;

  const primaryService = useMemo(
    () => pickPrimaryServiceForLocation(services, location?.location_type),
    [location?.location_type, services],
  );

  const isFavorite = useMemo(
    () => (locationId ? favoriteIds.includes(locationId) : false),
    [favoriteIds, locationId],
  );

  const openingHours = useMemo(
    () => extractOpenClose(location?.opening_hours),
    [location?.opening_hours],
  );
  const isOpenNow = useMemo(
    () => isWithinOpeningHours(location?.opening_hours),
    [location?.opening_hours],
  );

  const locationVouchers = useMemo(() => {
    if (!locationId) return [] as VoucherItem[];
    return vouchers.filter((voucher) => {
      if (voucher.status !== "active") return false;
      if (!voucher.location_id) return true;
      return Number(voucher.location_id) === Number(locationId);
    });
  }, [locationId, vouchers]);

  const reviewPreviews = useMemo(
    () => reviewFiles.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [reviewFiles],
  );

  const filteredReviews = useMemo(() => {
    if (!reviewFilter) return reviews;
    return reviews.filter((item) => Number(item.rating) === reviewFilter);
  }, [reviewFilter, reviews]);

  const refreshReviewsAndStats = useCallback(async () => {
    if (!locationId) return;
    const [reviewResp] = await Promise.all([
      locationApi.getLocationReviews(locationId),
      refetchLocationDetail(),
    ]);
    setReviews(reviewResp.success ? reviewResp.data || [] : []);
  }, [locationId, refetchLocationDetail]);

  useEffect(() => {
    return () => {
      reviewPreviews.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, [reviewPreviews]);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;

    const run = async () => {
      try {
        setFavoriteLoading(true);
        setReviewsLoading(true);
        setVouchersLoading(true);
        const [serviceResp, favoriteResp, reviewResp, voucherResp] =
          await Promise.all([
            locationApi.getLocationServices(locationId),
            userApi.getFavorites(),
            locationApi.getLocationReviews(locationId),
            userApi.getVouchers(),
          ]);

        if (!cancelled) {
          setServices(
            serviceResp.success ? (serviceResp.data as PublicServiceRow[]) : [],
          );
          setFavoriteIds(
            favoriteResp.success
              ? (favoriteResp.data || [])
                  .map((item) => Number(item.location_id))
                  .filter((item) => Number.isFinite(item))
              : [],
          );
          setReviews(reviewResp.success ? reviewResp.data || [] : []);
          setVouchers(voucherResp.success ? voucherResp.data || [] : []);
        }
      } catch {
        if (!cancelled) {
          setServices([]);
          setReviews([]);
          setVouchers([]);
        }
      } finally {
        if (!cancelled) {
          setFavoriteLoading(false);
          setReviewsLoading(false);
          setVouchersLoading(false);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [locationId]);

  useEffect(() => {
    if (!mapCoords) return;
    const controller = new AbortController();

    const run = async () => {
      try {
        setWeatherLoading(true);
        const response = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${mapCoords.lat}&longitude=${mapCoords.lng}&current=temperature_2m,weather_code`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error("weather_error");
        const json = (await response.json()) as {
          current?: { temperature_2m?: number; weather_code?: number };
        };
        setWeatherTemp(
          Number.isFinite(Number(json.current?.temperature_2m))
            ? Number(json.current?.temperature_2m)
            : null,
        );
        setWeatherCode(
          Number.isFinite(Number(json.current?.weather_code))
            ? Number(json.current?.weather_code)
            : null,
        );
      } catch {
        setWeatherTemp(null);
        setWeatherCode(null);
      } finally {
        setWeatherLoading(false);
      }
    };

    void run();
    return () => controller.abort();
  }, [mapCoords]);

  useEffect(() => {
    if (!locationId) return;
    const handler = (event: Event) => {
      const custom = event as CustomEvent<{ locationId?: number }>;
      if (Number(custom.detail?.locationId) !== Number(locationId)) return;
      void refreshReviewsAndStats();
    };
    window.addEventListener(REVIEW_UPDATED_EVENT, handler as EventListener);
    const id = window.setInterval(() => {
      void refreshReviewsAndStats();
    }, 5000);
    return () => {
      window.removeEventListener(
        REVIEW_UPDATED_EVENT,
        handler as EventListener,
      );
      window.clearInterval(id);
    };
  }, [locationId, refreshReviewsAndStats]);

  const flashAction = (text: string) => {
    setActionMessage(text);
    window.setTimeout(() => setActionMessage(null), 2800);
  };

  const handleOpenDirections = async () => {
    if (!locationId || !mapCoords) return;
    navigate("/user/map", {
      state: {
        focusRoute: {
          location_id: locationId,
          lat: mapCoords.lat,
          lng: mapCoords.lng,
          location_name: location?.location_name,
          address: location?.address,
        },
      },
    });
  };

  const handleToggleFavorite = async () => {
    if (!locationId) return;
    try {
      setFavoriteLoading(true);
      if (isFavorite) {
        await userApi.removeFavorite(locationId);
        setFavoriteIds((prev) => prev.filter((item) => item !== locationId));
        flashAction(
          "Đã bỏ lưu địa điểm. Có thể xem lại trong mục Địa điểm đã lưu.",
        );
      } else {
        await userApi.saveFavorite(locationId);
        setFavoriteIds((prev) =>
          prev.includes(locationId) ? prev : [...prev, locationId],
        );
        flashAction("Đã lưu địa điểm vào mục Địa điểm đã lưu");
      }
    } catch (toggleError) {
      flashAction(
        getErrorMessage(toggleError, "Không cập nhật được địa điểm lưu"),
      );
    } finally {
      setFavoriteLoading(false);
    }
  };

  const handleShare = async () => {
    if (!locationId) return;
    const url = `${window.location.origin}/user/location/${locationId}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: location?.location_name || "Địa điểm",
          url,
        });
        flashAction("Đã chia sẻ liên kết");
        return;
      }
      await navigator.clipboard.writeText(url);
      flashAction("Đã copy liên kết");
    } catch {
      flashAction("Không thể chia sẻ lúc này");
    }
  };

  const handleBooking = () => {
    if (!locationId || !primaryService) return;
    navigate(
      `/user/booking/${primaryService.service_id}?locationId=${locationId}`,
    );
  };

  const handleReport = async () => {
    if (!locationId || !reportText.trim()) {
      setReportMessage("Vui lòng nhập mô tả vấn đề");
      return;
    }

    try {
      setReportLoading(true);
      setReportMessage(null);
      const response = await userApi.reportLocationIssue({
        location_id: locationId,
        description: reportText.trim(),
      });
      if (response.success) {
        setReportText("");
        setReportMessage("Đã gửi báo cáo. Cảm ơn bạn.");
      } else {
        setReportMessage(response.message || "Không thể gửi báo cáo");
      }
    } catch (reportError) {
      setReportMessage(getErrorMessage(reportError, "Không thể gửi báo cáo"));
    } finally {
      setReportLoading(false);
    }
  };

  const handleReviewFileChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const nextFiles = Array.from(event.target.files || []);
    setReviewFiles(nextFiles.slice(0, 8));
    event.currentTarget.value = "";
  };

  const handleSubmitReview = async () => {
    if (!locationId) return;
    if (reviewRating < 1 || reviewRating > 5) {
      setReviewMessage("Vui lòng chọn số sao từ 1 đến 5");
      return;
    }
    if (!reviewText.trim()) {
      setReviewMessage("Vui lòng nhập nội dung đánh giá");
      return;
    }

    try {
      setReviewSubmitting(true);
      setReviewMessage(null);

      const uploadedImages: string[] = [];
      for (const file of reviewFiles) {
        const uploadResponse = await userApi.uploadReviewImage(file);
        if (uploadResponse.success && uploadResponse.data?.image_url) {
          uploadedImages.push(uploadResponse.data.image_url);
        }
      }

      const response = await userApi.createReview({
        location_id: locationId,
        rating: reviewRating,
        comment: reviewText.trim(),
        images: uploadedImages,
      });

      if (!response.success) {
        setReviewMessage(response.message || "Không thể gửi đánh giá");
        return;
      }

      setReviewRating(0);
      setReviewText("");
      setReviewFiles([]);
      setReviewMessage("Đã gửi đánh giá thành công");

      await refreshReviewsAndStats();
      dispatchReviewUpdated({
        locationId,
        rating: response.data?.rating,
        totalReviews: response.data?.total_reviews,
      });
    } catch (submitError) {
      setReviewMessage(getErrorMessage(submitError, "Không thể gửi đánh giá"));
    } finally {
      setReviewSubmitting(false);
    }
  };

  return (
    <UserLayout title="Chi tiết địa điểm" activeKey="/user/dashboard">
      <section className="mx-auto w-full max-w-[1320px] space-y-5">
        {actionMessage ? (
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {actionMessage}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500">
            Đang tải chi tiết địa điểm...
          </div>
        ) : null}

        {error ? (
          <div className="rounded-3xl border border-red-100 bg-red-50 px-6 py-10 text-center text-sm text-red-600">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_390px] 2xl:grid-cols-[minmax(0,1fr)_430px]">
          <div className="mx-auto w-full max-w-[640px] space-y-4">
            <div className="overflow-hidden rounded-[30px] border border-slate-100 bg-white shadow-sm">
              {coverImage ? (
                <img
                  src={coverImage}
                  alt={location?.location_name || "Địa điểm"}
                  className="h-40 w-full object-cover"
                />
              ) : null}
              <div className="space-y-4 p-5">
                <div>
                  <h1 className="text-[32px] font-semibold leading-tight text-slate-900">
                    {location?.location_name || "Địa điểm"}
                  </h1>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                    <div className="flex items-center gap-2 text-slate-900">
                      <span className="text-xl font-semibold">
                        {Number(location?.rating || 0).toFixed(1)}
                      </span>
                      <div className="flex items-center gap-1 text-amber-400">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <span key={star}>★</span>
                        ))}
                      </div>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
                      {Number(location?.total_reviews || 0)} đánh giá
                    </span>
                  </div>
                  <div className="mt-3 inline-flex rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sky-700">
                    {typeLabel(location?.location_type)}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: "overview", label: "Tổng quan" },
                    { key: "reviews", label: "Bài đánh giá" },
                    { key: "intro", label: "Giới thiệu" },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                        activeTab === tab.key
                          ? "bg-blue-600 text-white hover:bg-blue-700"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                      onClick={() => setActiveTab(tab.key as DetailTab)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <QuickAction
                    label="Chỉ đường"
                    onClick={() => {
                      void handleOpenDirections();
                    }}
                    icon={
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M9 18l-6-6 6-6" />
                        <path d="M3 12h7a4 4 0 0 0 4-4V5" />
                        <path d="M15 6l3-3 3 3" />
                        <path d="M18 3v10a4 4 0 0 1-4 4h-3" />
                      </svg>
                    }
                  />
                  <QuickAction
                    label={isFavorite ? "Bỏ lưu" : "Lưu"}
                    onClick={() => {
                      void handleToggleFavorite();
                    }}
                    disabled={favoriteLoading}
                    icon={
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                      </svg>
                    }
                  />
                  <QuickAction
                    label="Chia sẻ"
                    onClick={() => {
                      void handleShare();
                    }}
                    icon={
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <circle cx="18" cy="5" r="3" />
                        <circle cx="6" cy="12" r="3" />
                        <circle cx="18" cy="19" r="3" />
                        <path d="M8.59 13.51l6.83 3.98" />
                        <path d="M15.41 6.51L8.59 10.49" />
                      </svg>
                    }
                  />
                </div>

                {activeTab === "overview" ? (
                  <>
                    {location?.description?.trim() ? (
                      <div className="rounded-[24px] bg-slate-50 p-4">
                        <div className="text-sm leading-7 text-slate-700">
                          {location.description}
                        </div>
                      </div>
                    ) : null}

                    <div className="space-y-2 border-t border-slate-100 pt-4 text-sm">
                      <div className="flex items-start gap-3 rounded-xl bg-slate-50 px-3 py-2">
                        <span className="mt-0.5 text-slate-500">📍</span>
                        <div>
                          <div className="text-[11px] uppercase tracking-wide text-slate-400">
                            Tên quán
                          </div>
                          <div className="font-semibold text-slate-900">
                            {location?.location_name || "Địa điểm"}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 rounded-xl bg-slate-50 px-3 py-2">
                        <span className="mt-0.5 text-slate-500">🧭</span>
                        <div>
                          <div className="text-[11px] uppercase tracking-wide text-slate-400">
                            Địa chỉ quán
                          </div>
                          <div className="text-slate-700">
                            {location?.address || "Chưa cập nhật địa chỉ"}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 rounded-xl bg-slate-50 px-3 py-2">
                        <span className="mt-0.5 text-slate-500">🟢</span>
                        <div>
                          <div className="text-[11px] uppercase tracking-wide text-slate-400">
                            Trạng thái quán
                          </div>
                          <div
                            className={
                              isOpenNow ? "text-emerald-700" : "text-amber-700"
                            }
                          >
                            {isOpenNow ? "Đang hoạt động" : "Đã đóng cửa"}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 rounded-xl bg-slate-50 px-3 py-2">
                        <span className="mt-0.5 text-slate-500">🕒</span>
                        <div>
                          <div className="text-[11px] uppercase tracking-wide text-slate-400">
                            Thời gian mở cửa - đóng cửa
                          </div>
                          <div className="text-slate-700">
                            {openingHours
                              ? `${openingHours.open} - ${openingHours.close}`
                              : "Chưa cập nhật"}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 rounded-xl bg-slate-50 px-3 py-2">
                        <span className="mt-0.5 text-slate-500">📞</span>
                        <div>
                          <div className="text-[11px] uppercase tracking-wide text-slate-400">
                            Số điện thoại
                          </div>
                          <div className="text-slate-700">
                            {location?.phone || "Chưa cập nhật"}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 rounded-xl bg-slate-50 px-3 py-2">
                        <span className="mt-0.5 text-slate-500">✉️</span>
                        <div>
                          <div className="text-[11px] uppercase tracking-wide text-slate-400">
                            Email
                          </div>
                          <div className="text-slate-700">
                            {location?.email || "Chưa cập nhật"}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 rounded-xl bg-slate-50 px-3 py-2">
                        <span className="mt-0.5 text-slate-500">🌐</span>
                        <div>
                          <div className="text-[11px] uppercase tracking-wide text-slate-400">
                            Website
                          </div>
                          <div className="text-slate-700">
                            {location?.website || "Chưa cập nhật"}
                          </div>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="mt-4 w-full rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                      onClick={handleBooking}
                      disabled={!primaryService}
                    >
                      {bookingLabelByLocationType(location?.location_type)}
                    </button>

                    <div className="rounded-[28px] border border-slate-100 bg-white p-6 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <h2 className="text-xl font-semibold text-slate-900">
                          Báo sai thông tin
                        </h2>
                        <button
                          type="button"
                          className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                          onClick={handleReport}
                          disabled={reportLoading}
                        >
                          {reportLoading ? "Đang gửi..." : "Gửi báo cáo"}
                        </button>
                      </div>
                      <textarea
                        value={reportText}
                        onChange={(event) => setReportText(event.target.value)}
                        rows={4}
                        className="mt-4 w-full rounded-[24px] border border-slate-200 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
                        placeholder="Mô tả vấn đề bạn thấy tại địa điểm này"
                      />
                      {reportMessage ? (
                        <div className="mt-3 text-sm text-slate-500">
                          {reportMessage}
                        </div>
                      ) : null}
                    </div>
                  </>
                ) : null}

                {activeTab === "reviews" ? (
                  <div className="space-y-4 rounded-[24px] border border-slate-100 bg-white p-4">
                    <h3 className="text-lg font-semibold text-slate-900">
                      Bài đánh giá
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {[0, 1, 2, 3, 4, 5].map((star) => {
                        const active = reviewFilter === star;
                        return (
                          <button
                            key={`detail-review-filter-${star}`}
                            type="button"
                            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                              active
                                ? "bg-blue-600 text-white"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            }`}
                            onClick={() => setReviewFilter(star)}
                          >
                            {star === 0 ? "Tất cả" : `${star} sao`}
                          </button>
                        );
                      })}
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <h4 className="text-sm font-semibold text-slate-900">
                          Viết đánh giá
                        </h4>
                        <span className="text-xs text-slate-500">1-5 sao</span>
                      </div>
                      <div className="mt-3 grid grid-cols-5 gap-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            className={`rounded-full px-2 py-1.5 text-xs font-semibold transition ${
                              reviewRating >= star
                                ? "bg-amber-100 text-amber-700"
                                : "bg-white text-slate-500 hover:bg-slate-100"
                            }`}
                            onClick={() => setReviewRating(star)}
                          >
                            {star} sao
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={reviewText}
                        onChange={(event) => setReviewText(event.target.value)}
                        rows={3}
                        className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                        placeholder="Chia sẻ trải nghiệm của bạn"
                      />
                      <label className="mt-3 block rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-600 hover:bg-white">
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={handleReviewFileChange}
                        />
                        Thêm ảnh cho bài đánh giá
                      </label>
                      {reviewPreviews.length > 0 ? (
                        <div className="mt-3 grid grid-cols-3 gap-2">
                          {reviewPreviews.slice(0, 6).map((item, index) => (
                            <img
                              key={`${item.file.name}-${index}`}
                              src={item.url}
                              alt={`review-preview-${index + 1}`}
                              className="h-20 w-full rounded-xl object-cover"
                            />
                          ))}
                        </div>
                      ) : null}
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          className="rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                          onClick={handleSubmitReview}
                          disabled={reviewSubmitting}
                        >
                          {reviewSubmitting ? "Đang gửi..." : "Gửi đánh giá"}
                        </button>
                        {reviewMessage ? (
                          <span className="text-xs text-slate-600">
                            {reviewMessage}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {reviewsLoading ? (
                      <p className="text-sm text-slate-500">
                        Đang tải đánh giá...
                      </p>
                    ) : null}
                    {!reviewsLoading && filteredReviews.length === 0 ? (
                      <p className="text-sm text-slate-500">
                        Chưa có đánh giá nào cho địa điểm này.
                      </p>
                    ) : null}
                    {filteredReviews.map((review) => {
                      const reviewImages = normalizeReviewImages(
                        review.images,
                      ).map((item) => resolveBackendUrl(item) || item);
                      return (
                        <article
                          key={review.review_id}
                          className="rounded-2xl border border-slate-100 p-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-sm font-semibold text-slate-900">
                              {review.user_name || "Người dùng"}
                            </div>
                            <div className="text-xs font-semibold text-amber-700">
                              {Number(review.rating || 0).toFixed(0)} sao
                            </div>
                          </div>
                          <div className="mt-1 text-[11px] text-slate-400">
                            {formatDateTimeVi(review.created_at)}
                          </div>
                          <p className="mt-2 text-sm text-slate-600">
                            {review.comment?.trim() ||
                              "Người dùng không để lại bình luận."}
                          </p>
                          {reviewImages.length > 0 ? (
                            <div className="mt-3 grid grid-cols-3 gap-2">
                              {reviewImages.slice(0, 3).map((image, index) => (
                                <img
                                  key={`${review.review_id}-${index}`}
                                  src={image}
                                  alt={`review-${index + 1}`}
                                  className="h-20 w-full rounded-xl object-cover"
                                />
                              ))}
                            </div>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                ) : null}

                {activeTab === "intro" ? (
                  <div className="space-y-3 rounded-[24px] border border-slate-100 bg-white p-4">
                    <h3 className="text-lg font-semibold text-slate-900">
                      Giới thiệu
                    </h3>
                    <p className="text-sm leading-7 text-slate-600">
                      {location?.description?.trim() ||
                        "Chưa có nội dung giới thiệu cho địa điểm này."}
                    </p>
                    {galleryImages.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2">
                        {galleryImages.slice(0, 4).map((image, index) => (
                          <img
                            key={`${image}-${index}`}
                            src={image}
                            alt={`gallery-${index + 1}`}
                            className="h-28 w-full rounded-xl object-cover"
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="space-y-5 xl:sticky xl:top-24 xl:self-start">
            <div className="rounded-[34px] border border-slate-100 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-slate-900">
                  Voucher & Khuyến mãi
                </h2>
                <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600">
                  Mới
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-500">
                Xem ưu đãi đang áp dụng cho địa điểm này và sử dụng ngay khi đặt
                trước.
              </p>
              <div className="mt-4 rounded-2xl border border-slate-100 bg-gradient-to-br from-rose-50 via-amber-50 to-white p-4">
                {vouchersLoading ? (
                  <p className="text-sm text-slate-500">
                    Đang tải khuyến mãi...
                  </p>
                ) : null}
                {!vouchersLoading && locationVouchers.length === 0 ? (
                  <p className="text-sm text-slate-600">
                    Hiện chưa có khuyến mãi
                  </p>
                ) : null}
                {!vouchersLoading && locationVouchers.length > 0 ? (
                  <>
                    <div className="text-sm font-semibold text-slate-900">
                      {locationVouchers[0]?.campaign_name ||
                        `Mã ${locationVouchers[0]?.code}`}
                    </div>
                    <div className="mt-1 text-sm text-slate-600">
                      {locationVouchers[0]?.campaign_description ||
                        "Ưu đãi đang hoạt động cho địa điểm này."}
                    </div>
                    <div className="mt-3 text-xs text-slate-500">
                      Mã: {locationVouchers[0]?.code}
                    </div>
                  </>
                ) : null}
                <button
                  type="button"
                  className="mt-4 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                  onClick={() => navigate("/user/vouchers")}
                >
                  Xem voucher của tôi
                </button>
              </div>
            </div>

            <div className="rounded-[34px] border border-slate-100 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xl font-semibold text-slate-900">
                  Thời tiết địa điểm
                </h2>
                <span className="text-xs text-slate-400">Theo điểm đến</span>
              </div>
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-slate-900">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                      Hiện tại
                    </div>
                    <div className="mt-2 text-3xl font-semibold">
                      {weatherLoading
                        ? "..."
                        : weatherTemp != null
                          ? `${Math.round(weatherTemp)}°C`
                          : "--°C"}
                    </div>
                    <div className="mt-1 text-sm text-slate-600">
                      {weatherLoading
                        ? "Đang cập nhật"
                        : weatherLabelByCode(weatherCode ?? undefined)}
                    </div>
                  </div>
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-4xl animate-pulse">
                    {weatherIconByCode(weatherCode ?? undefined)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </UserLayout>
  );
};

export default LocationDetail;
