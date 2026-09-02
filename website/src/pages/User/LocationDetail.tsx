import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import UserLayout from "../../layouts/UserLayout";
import LocationChatBubble from "../../components/LocationChatBubble";
import AvatarCropper from "../../components/AvatarCropper";
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
import { Image, message } from "antd";
import { ClockCircleOutlined, CalendarOutlined, EnvironmentOutlined } from "@ant-design/icons";
import {
  REVIEW_UPDATED_EVENT,
  dispatchReviewUpdated,
} from "../../utils/reviewSync";
import type { LocationReview } from "../../types/location.types";
import { isPrivateUserLocation } from "../../types/location.types";
import type { DiaryItem } from "../../types/user.types";

const toNumber = (value?: string): number | null => {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

type DetailTab = "overview" | "reviews" | "intro" | "diary";

const getCurrentUserId = (): number | null => {
  try {
    const token = sessionStorage.getItem("accessToken");
    if (!token) return null;
    const payload = JSON.parse(atob(token.split(".")[1]));
    const id = Number(payload.userId ?? payload.user_id ?? payload.sub);
    return Number.isFinite(id) ? id : null;
  } catch {
    return null;
  }
};
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
    refetch,
  } = useLocationDetail(locationId ?? undefined);

  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<DetailTab>(
    searchParams.get("tab") === "reviews" ? "reviews" : "overview",
  );

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "reviews") {
      setActiveTab("reviews");
    }
  }, [searchParams]);

  const [services, setServices] = useState<PublicServiceRow[]>([]);
  const [reviews, setReviews] = useState<LocationReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [vouchersLoading, setVouchersLoading] = useState(false);
  const [locationVoucherList, setLocationVoucherList] = useState<any[]>([]);
  const [claimingId, setClaimingId] = useState<number | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const [isEditingName, setIsEditingName] = useState(false);
  const [editingName, setEditingName] = useState("");
  const [isSubmittingName, setIsSubmittingName] = useState(false);

  const [reviewRating, setReviewRating] = useState<number>(0);
  const [reviewText, setReviewText] = useState("");
  const [reviewFiles, setReviewFiles] = useState<File[]>([]);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewMessage, setReviewMessage] = useState<string | null>(null);
  const [reviewFilter, setReviewFilter] = useState<number>(0);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherTemp, setWeatherTemp] = useState<number | null>(null);
  const [weatherCode, setWeatherCode] = useState<number | null>(null);
  const [diary, setDiary] = useState<DiaryItem | null>(null);
  const [diaryNotes, setDiaryNotes] = useState("");
  const [diaryFiles, setDiaryFiles] = useState<File[]>([]);
  const [diarySubmitting, setDiarySubmitting] = useState(false);
  const [diaryDeleting, setDiaryDeleting] = useState(false);
  const [diaryMessage, setDiaryMessage] = useState<string | null>(null);
  const [coverCropSrc, setCoverCropSrc] = useState<string | null>(null);
  const [coverUploading, setCoverUploading] = useState(false);

  const currentUserId = useMemo(() => getCurrentUserId(), []);
  const isPrivateLocation = useMemo(
    () => isPrivateUserLocation(location, currentUserId),
    [location, currentUserId],
  );

  useEffect(() => {
    if (isPrivateLocation && (activeTab === "reviews" || activeTab === "intro")) {
      setActiveTab("diary");
    }
  }, [activeTab, isPrivateLocation]);

  const mapCoords = useMemo(
    () => parseLatLngMaybeSwap(location?.latitude, location?.longitude),
    [location?.latitude, location?.longitude],
  );

  const galleryImages = useMemo(() => {
    const ts = location?.updated_at ? new Date(location.updated_at).getTime() : undefined;
    const hero = resolveBackendUrl(location?.first_image, ts);

    const rawImages = normalizeLocationImages(location?.images)
      .map((item) => resolveBackendUrl(item, ts) || item)
      .filter((img) => img !== hero);

    return rawImages;
  }, [location?.first_image, location?.images, location?.updated_at]);

  const coverImage =
    resolveBackendUrl(location?.first_image, location?.updated_at ? new Date(location.updated_at).getTime() : undefined) || null;

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
    return locationVoucherList
      .filter((v: any) => {
        // pool_remaining: số vé còn lại trong pool (backend tính = usage_limit - total_wallet_claims)
        const poolRemaining = Number(v.pool_remaining ?? v.remaining ?? 0);
        if (poolRemaining <= 0) return false;
        // is_exhausted: user đã dùng hết lượt booking
        if (v.is_exhausted) return false;
        return true;
      })
      .slice(0, 4);
  }, [locationVoucherList]);

  const reviewPreviews = useMemo(
    () => reviewFiles.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [reviewFiles],
  );
  const diaryFilePreviews = useMemo(
    () => diaryFiles.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [diaryFiles],
  );

  const filteredReviews = useMemo(() => {
    if (!reviewFilter) return reviews;
    return reviews.filter((item) => Number(item.rating) === reviewFilter);
  }, [reviewFilter, reviews]);

  const refreshReviewsAndStats = useCallback(async () => {
    if (!locationId) return;
    const reviewResp = await locationApi.getLocationReviews(locationId);
    setReviews(reviewResp.success ? reviewResp.data || [] : []);
  }, [locationId]);

  useEffect(() => {
    return () => {
      reviewPreviews.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, [reviewPreviews]);
  useEffect(() => {
    return () => {
      diaryFilePreviews.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, [diaryFilePreviews]);

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
            userApi.getVouchersByLocation(locationId),
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
          setLocationVoucherList(voucherResp.success ? voucherResp.data || [] : []);
        }
      } catch {
        if (!cancelled) {
          setServices([]);
          setReviews([]);
          setLocationVoucherList([]);
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
    if (!locationId || !isPrivateLocation) {
      setDiary(null);
      setDiaryNotes("");
      return;
    }
    let cancelled = false;
    const loadDiary = async () => {
      try {
        const response = await userApi.getDiaries({ locationId });
        if (cancelled) return;
        const item = response.success ? response.data?.[0] ?? null : null;
        setDiary(item);
        setDiaryNotes(item?.notes || "");
      } catch {
        if (!cancelled) {
          setDiary(null);
          setDiaryNotes("");
        }
      }
    };
    void loadDiary();
    return () => {
      cancelled = true;
    };
  }, [isPrivateLocation, locationId]);

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
    }, 30000);
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
    navigate(`/user/map?routeTo=${locationId}`, {
      state: {
        focusRoute: {
          location_id: locationId,
          lat: mapCoords.lat,
          lng: mapCoords.lng,
          location_name: location?.location_name,
          address: location?.address,
          first_image: location?.first_image,
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

  const handleClaimVoucher = async (voucherId: number) => {
    setClaimingId(voucherId);
    // Optimistic: giảm pool_remaining ngay
    setLocationVoucherList((prev) =>
      prev.map((v: any) =>
        v.voucher_id === voucherId
          ? {
            ...v,
            pool_remaining: Math.max(0, (v.pool_remaining ?? v.remaining ?? 1) - 1),
            user_claimed_count: (v.user_claimed_count || 0) + 1,
            is_claimed: ((v.user_claimed_count || 0) + 1) >= 1,
          }
          : v,
      ),
    );
    try {
      await userApi.claimVoucher(voucherId);
      flashAction("Đã lưu voucher vào kho của bạn");
      // Hide the voucher after 5 seconds
      setTimeout(() => {
        setLocationVoucherList((prev) =>
          prev.filter((v: any) => v.voucher_id !== voucherId)
        );
      }, 5000);
    } catch (error: any) {
      // Rollback nếu lỗi
      setLocationVoucherList((prev) =>
        prev.map((v: any) =>
          v.voucher_id === voucherId
            ? {
              ...v,
              pool_remaining: (v.pool_remaining ?? v.remaining ?? 0) + 1,
              user_claimed_count: Math.max(0, (v.user_claimed_count || 0) - 1),
              is_claimed: Math.max(0, (v.user_claimed_count || 0) - 1) >= 1,
            }
            : v,
        ),
      );
      flashAction(error.response?.data?.message || "Không thể lưu voucher");
    } finally {
      setClaimingId(null);
    }
  };

  const handleBooking = () => {
    if (!locationId || !primaryService) return;
    navigate(
      `/user/booking/${primaryService.service_id}?locationId=${locationId}`,
    );
  };

  const handleUpdateName = async () => {
    if (!locationId || !editingName.trim()) return;
    try {
      setIsSubmittingName(true);
      const res = isPrivateLocation
        ? await userApi.updateMyCreatedLocation(locationId, {
          location_name: editingName.trim(),
        })
        : await locationApi.updateCustomLocationName(locationId, editingName);
      if (res.success) {
        flashAction(res.message || "Đã cập nhật tên vị trí tự do");
        window.dispatchEvent(
          new CustomEvent("private-location-renamed", {
            detail: { locationId, locationName: editingName.trim() },
          }),
        );
        setIsEditingName(false);
        refetch();
      }
    } catch (err) {
      flashAction(getErrorMessage(err, "Không thể cập nhật tên"));
    } finally {
      setIsSubmittingName(false);
    }
  };

  const handleDiaryFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setDiaryFiles(Array.from(event.target.files || []).slice(0, 6));
    event.currentTarget.value = "";
  };

  const handleSaveDiary = async () => {
    if (!locationId || !isPrivateLocation) return;
    try {
      setDiarySubmitting(true);
      setDiaryMessage(null);
      const uploadedImages: string[] = [];
      for (const file of diaryFiles) {
        const uploadResponse = await userApi.uploadDiaryImage(file);
        if (uploadResponse.success && uploadResponse.data?.image_url) {
          uploadedImages.push(uploadResponse.data.image_url);
        }
      }
      const existingImages = diaryFiles.length > 0 ? [] : normalizeReviewImages(diary?.images);
      const response = await userApi.createDiary({
        location_id: locationId,
        notes: diaryNotes.trim() || null,
        mood: diary?.mood || "happy",
        images: diaryFiles.length > 0 ? uploadedImages : existingImages,
      });
      if (!response.success) {
        setDiaryMessage(response.message || "Không thể lưu nhật ký");
        return;
      }
      const refreshed = await userApi.getDiaries({ locationId });
      const item = refreshed.success ? refreshed.data?.[0] ?? null : null;
      setDiary(item);
      setDiaryNotes(item?.notes || "");
      setDiaryFiles([]);
      setDiaryMessage("Đã lưu nhật ký");
    } catch (error) {
      setDiaryMessage(getErrorMessage(error, "Không thể lưu nhật ký"));
    } finally {
      setDiarySubmitting(false);
    }
  };

  const handleDeleteDiary = async () => {
    if (!diary?.diary_id) return;
    const ok = window.confirm("Xóa nhật ký của vị trí này?");
    if (!ok) return;
    try {
      setDiaryDeleting(true);
      setDiaryMessage(null);
      const response = await userApi.deleteDiary(Number(diary.diary_id));
      if (!response.success) {
        setDiaryMessage(response.message || "Không thể xóa nhật ký");
        return;
      }
      setDiary(null);
      setDiaryNotes("");
      setDiaryFiles([]);
      setDiaryMessage("Đã xóa nhật ký");
    } catch (error) {
      setDiaryMessage(getErrorMessage(error, "Không thể xóa nhật ký"));
    } finally {
      setDiaryDeleting(false);
    }
  };

  const handlePickCoverFile = (file: File) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      flashAction("Định dạng ảnh không hợp lệ");
      return;
    }
    setCoverCropSrc(URL.createObjectURL(file));
  };

  const handleCoverCropConfirm = async (blob: Blob) => {
    if (!locationId) return;
    try {
      setCoverUploading(true);
      const file = new File([blob], "private-location-cover.jpg", {
        type: "image/jpeg",
      });
      const response = await userApi.uploadMyCreatedLocationCover(locationId, file);
      if (!response.success) {
        flashAction(response.message || "Không thể cập nhật ảnh");
        return;
      }
      flashAction("Đã cập nhật ảnh vị trí tự do");
      if (coverCropSrc) URL.revokeObjectURL(coverCropSrc);
      setCoverCropSrc(null);
      refetch();
    } catch (error) {
      flashAction(getErrorMessage(error, "Không thể cập nhật ảnh"));
    } finally {
      setCoverUploading(false);
    }
  };

  const handleCoverCropCancel = () => {
    if (coverCropSrc) URL.revokeObjectURL(coverCropSrc);
    setCoverCropSrc(null);
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

  const handleDeleteReview = async (reviewId: number) => {
    if (!window.confirm("Bạn có chắc muốn xóa đánh giá này?")) return;
    try {
      const response = await userApi.deleteReview(reviewId);
      if (!response.success) {
        message.error(response.message || "Xóa đánh giá thất bại");
        return;
      }
      message.success("Đã xóa đánh giá");
      await refreshReviewsAndStats();
    } catch (err) {
      message.error(getErrorMessage(err, "Xóa đánh giá thất bại"));
    }
  };

  const detailTabs = isPrivateLocation
    ? [
      { key: "overview", label: "Tổng quan" },
      { key: "diary", label: "Nhật ký" },
    ]
    : [
      { key: "overview", label: "Tổng quan" },
      { key: "reviews", label: "Bài đánh giá" },
      { key: "intro", label: "Giới thiệu" },
    ];

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
              <div className="relative h-64 bg-slate-100 sm:h-[320px]">
                {coverImage ? (
                  <img
                    src={coverImage}
                    alt={location?.location_name || "Địa điểm"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-teal-50 via-sky-50 to-slate-100 text-sm font-semibold text-slate-400">
                    Vị trí tự do
                  </div>
                )}
                {isPrivateLocation ? (
                  <label className="absolute bottom-4 right-4 cursor-pointer rounded-full bg-white/95 px-4 py-2 text-xs font-bold text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-white">
                    {coverUploading ? "Đang cập nhật..." : "Đổi ảnh"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      disabled={coverUploading}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.currentTarget.value = "";
                        if (file) handlePickCoverFile(file);
                      }}
                    />
                  </label>
                ) : null}
              </div>
              <div className="space-y-4 p-5">
                <div>
                  <div className="flex items-center gap-3">
                    {isEditingName ? (
                      <div className="flex flex-1 items-center gap-2">
                        <input
                          type="text"
                          className="flex-1 rounded-xl border border-slate-200 px-4 py-2 text-[20px] font-semibold text-slate-900 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          placeholder="Nhập tên vị trí mới..."
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleUpdateName();
                            if (e.key === "Escape") setIsEditingName(false);
                          }}
                        />
                        <button
                          className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-bold text-white hover:bg-teal-700 disabled:opacity-50"
                          onClick={handleUpdateName}
                          disabled={isSubmittingName || !editingName.trim()}
                        >
                          Lưu
                        </button>
                        <button
                          className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-200"
                          onClick={() => setIsEditingName(false)}
                          disabled={isSubmittingName}
                        >
                          Hủy
                        </button>
                      </div>
                    ) : (
                      <>
                        <h1 className="text-[32px] font-semibold leading-tight text-slate-900">
                          {location?.location_name || "Địa điểm"}
                        </h1>
                        {isPrivateLocation && (
                          <button
                            onClick={() => {
                              setEditingName(location?.location_name || "");
                              setIsEditingName(true);
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
                            title="Sửa tên vị trí"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                  {!isPrivateLocation ? (
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
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
                  ) : (
                    <div className="mt-2 inline-flex rounded-full bg-teal-50 px-3 py-1 text-sm font-semibold text-teal-700">
                      Vi tri rieng tu
                    </div>
                  )}
                  <div className="mt-3 inline-flex rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sky-700">
                    {typeLabel(location?.location_type)}
                  </div>
                </div>

                <div className={`grid gap-2 ${isPrivateLocation ? "grid-cols-2" : "grid-cols-3"}`}>
                  {detailTabs.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      className={`rounded-full px-3 py-2 text-xs font-semibold transition ${activeTab === tab.key
                          ? "bg-blue-600 text-white hover:bg-blue-700"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      onClick={() => setActiveTab(tab.key as DetailTab)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className={`grid gap-2 ${isPrivateLocation ? "grid-cols-2" : "grid-cols-3"}`}>
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
                  {!isPrivateLocation ? (
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
                  ) : null}
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

                    {!isPrivateLocation ? (
                      <button
                        type="button"
                        className={`mt-4 w-full rounded-full px-5 py-3 text-sm font-semibold text-white transition ${!primaryService || !isOpenNow
                            ? "bg-slate-400 cursor-not-allowed"
                            : "bg-blue-600 hover:bg-blue-700"
                          }`}
                        onClick={handleBooking}
                        disabled={!primaryService || !isOpenNow}
                      >
                        {bookingLabelByLocationType(location?.location_type)}
                      </button>
                    ) : null}


                  </>
                ) : null}

                {activeTab === "reviews" ? (
                  <div className="space-y-4 rounded-[24px] border border-slate-100 bg-white p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-slate-900">
                        Bài đánh giá
                      </h3>
                      <div className="relative">
                        <select
                          value={reviewFilter}
                          onChange={(e) => setReviewFilter(Number(e.target.value))}
                          className="appearance-none rounded-full border border-slate-200 bg-white pl-4 pr-8 py-1.5 text-xs font-bold text-slate-700 outline-none transition hover:bg-slate-50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-sm"
                        >
                          <option value={0}>Tất cả</option>
                          <option value={5}>5 sao ★</option>
                          <option value={4}>4 sao ★</option>
                          <option value={3}>3 sao ★</option>
                          <option value={2}>2 sao ★</option>
                          <option value={1}>1 sao ★</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">
                          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
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
                            className={`rounded-full px-2 py-1.5 text-xs font-semibold transition ${reviewRating >= star
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
                          className="rounded-2xl border border-slate-100 p-4"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-sm font-semibold text-slate-900">
                              {review.user_name || "Người dùng"}
                            </div>
                            <div className="text-sm font-bold text-yellow-500 flex items-center gap-1">
                              {Number(review.rating || 0).toFixed(0)} <span className="text-xs">★</span>
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

                          {review.reply_content ? (
                            <div className="mt-3 border-l-2 border-teal-500 bg-teal-50/50 p-3 rounded-r-xl">
                              <div className="text-xs font-bold text-teal-700 mb-1">
                                Phản hồi từ địa điểm
                              </div>
                              <p className="text-sm text-slate-700 whitespace-pre-wrap">
                                {review.reply_content}
                              </p>
                            </div>
                          ) : null}

                          {review.user_id === currentUserId ? (
                            <div className="mt-4 flex justify-end">
                              <button
                                type="button"
                                onClick={() => void handleDeleteReview(review.review_id)}
                                className="rounded-full bg-red-50 px-4 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100 transition shadow-sm"
                              >
                                Xóa đánh giá
                              </button>
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
                        <Image.PreviewGroup>
                          {galleryImages.slice(0, 4).map((image, index) => (
                            <div key={`${image}-${index}`} className="aspect-square w-full rounded-xl overflow-hidden bg-slate-50">
                              <Image
                                src={image}
                                alt={`gallery-${index + 1}`}
                                rootClassName="h-full w-full"
                                className="h-full w-full"
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                            </div>
                          ))}
                        </Image.PreviewGroup>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {activeTab === "diary" && isPrivateLocation ? (
                  <div className="space-y-4 rounded-[24px] border border-slate-100 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">
                          Nhật ký vị trí
                        </h3>
                        <p className="mt-1 text-xs text-slate-500">
                          {diary?.created_at
                            ? `Cập nhật ${formatDateTimeVi(diary.created_at)}`
                            : "Chưa có nhật ký cho vị trí này."}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-700">
                          Riêng tư
                        </span>
                        {diary ? (
                          <button
                            type="button"
                            onClick={handleDeleteDiary}
                            disabled={diaryDeleting}
                            className="rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-600 transition hover:bg-rose-100 disabled:opacity-50"
                          >
                            {diaryDeleting ? "Đang xóa..." : "Xóa"}
                          </button>
                        ) : null}
                      </div>
                    </div>

                    {normalizeReviewImages(diary?.images).length > 0 ? (
                      <div className="grid grid-cols-2 gap-2">
                        <Image.PreviewGroup>
                          {normalizeReviewImages(diary?.images).map((image, index) => (
                            <div key={`${image}-${index}`} className="h-32 overflow-hidden rounded-xl bg-slate-100">
                              <Image
                                src={resolveBackendUrl(image) || image}
                                alt={`diary-${index + 1}`}
                                width="100%"
                                height="100%"
                                className="object-cover"
                              />
                            </div>
                          ))}
                        </Image.PreviewGroup>
                      </div>
                    ) : null}

                    <textarea
                      value={diaryNotes}
                      onChange={(event) => setDiaryNotes(event.target.value)}
                      rows={5}
                      placeholder="Ghi lại kỷ niệm, cảm nhận hoặc ghi chú của bạn..."
                      className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                    />

                    {diaryFilePreviews.length > 0 ? (
                      <div className="grid grid-cols-3 gap-2">
                        {diaryFilePreviews.slice(0, 6).map((item, index) => (
                          <div key={`${item.file.name}-${index}`} className="relative h-24 overflow-hidden rounded-xl bg-slate-100">
                            <img
                              src={item.url}
                              alt={`diary-new-${index + 1}`}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        ))}
                      </div>
                    ) : null}

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <label className="cursor-pointer rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50">
                        {diaryFiles.length > 0
                          ? `${diaryFiles.length} ảnh mới`
                          : "Chọn ảnh nhật ký"}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          multiple
                          className="hidden"
                          onChange={handleDiaryFileChange}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={handleSaveDiary}
                        disabled={diarySubmitting}
                        className="rounded-full bg-teal-600 px-5 py-2 text-xs font-bold text-white transition hover:bg-teal-700 disabled:opacity-50"
                      >
                        {diarySubmitting ? "Đang lưu..." : diary ? "Cập nhật nhật ký" : "Lưu nhật ký"}
                      </button>
                    </div>

                    {diaryMessage ? (
                      <div className="rounded-2xl border border-teal-100 bg-teal-50 px-4 py-3 text-sm text-teal-700">
                        {diaryMessage}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="space-y-5 xl:sticky xl:top-24 xl:self-start">
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

            {!isPrivateLocation ? (
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
                  Ưu đãi đang áp dụng cho địa điểm này. Bấm lưu để dùng khi đặt chỗ.
                </p>

                {vouchersLoading ? (
                  <p className="mt-4 text-sm text-slate-500">Đang tải khuyến mãi...</p>
                ) : null}

                {!vouchersLoading && locationVouchers.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-600">Chưa có voucher cho địa điểm này.</p>
                ) : null}

                {!vouchersLoading && locationVouchers.length > 0 ? (
                  <div className="mt-4 space-y-3 max-h-[530px] overflow-y-auto pr-1">
                    {locationVouchers.map((v: any) => {
                      const maxUses = Number(v.max_uses_per_user || 1);
                      // Số lượng user đã lưu (đã được update optimistic)
                      const savedCount = Number(v.user_claimed_count || 0);
                      // Dùng is_claimed từ backend (hoặc local optimistic update)
                      const isSaved = Boolean(v.is_claimed) || savedCount >= 1;
                      // Số vé còn lại trong pool
                      const displayRemaining = Number(v.pool_remaining ?? v.remaining ?? 0);
                      const isPercent = v.discount_type === "percent" || v.discount_type === "percentage";
                      const discountLabel = isPercent
                        ? `-${Number(v.discount_value)}%`
                        : `-${(Number(v.discount_value) / 1000).toFixed(0)}k`;

                      return (
                        <div
                          key={v.voucher_id}
                          className="relative flex flex-row rounded-xl overflow-hidden border border-slate-100 bg-white shadow-sm"
                          style={{ height: "140px" }}
                        >
                          {/* Left Violet Stub */}
                          <div className="relative w-24 bg-indigo-600 flex flex-col justify-center items-center text-white shrink-0 p-4 select-none">
                            <div className="absolute top-2 right-2 opacity-50">
                              <svg className="w-3.5 h-3.5 text-indigo-200 fill-current" viewBox="0 0 24 24">
                                <path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z" />
                              </svg>
                            </div>
                            <div className="absolute bottom-0 left-0 w-full h-7 flex flex-row items-end opacity-10 px-2 justify-between pointer-events-none">
                              <div className="w-[12%] h-[60%] bg-white rounded-t-sm" />
                              <div className="w-[15%] h-[80%] bg-white rounded-t-sm" />
                              <div className="w-[10%] h-[40%] bg-white rounded-t-sm" />
                              <div className="w-[18%] h-[90%] bg-white rounded-t-sm" />
                              <div className="w-[14%] h-[70%] bg-white rounded-t-sm" />
                              <div className="w-[12%] h-[50%] bg-white rounded-t-sm" />
                            </div>
                            <div className="text-2xl font-black tracking-tight">{discountLabel}</div>
                            <div className="text-[9px] font-bold tracking-widest text-indigo-200 mt-0.5 uppercase">GIẢM GIÁ</div>
                          </div>

                          {/* Perforated Separator 1 */}
                          <div className="relative w-3 shrink-0 flex flex-col items-center justify-between py-1 bg-white select-none">
                            <div className="absolute -top-2.5 w-5 h-5 rounded-full bg-slate-50 border border-slate-200" />
                            <div className="h-full border-l border-dashed border-slate-200" />
                            <div className="absolute -bottom-2.5 w-5 h-5 rounded-full bg-slate-50 border border-slate-200" />
                          </div>

                          {/* Middle Info Block */}
                          <div className="flex-1 p-3.5 pl-1.5 bg-white flex flex-col justify-between min-w-0">
                            <div>
                              <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                <span className="bg-indigo-50 text-indigo-700 text-[8px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                                  MÃ GIẢM GIÁ
                                </span>
                                <div className="flex items-center gap-1.5 whitespace-nowrap">
                                  <span className="bg-emerald-50 text-emerald-600 text-[8px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <ClockCircleOutlined className="text-[8px]" /> Còn {displayRemaining} vé
                                  </span>
                                  <span className="bg-blue-50 text-blue-600 text-[8px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                    Bạn: {savedCount}/{maxUses} lượt
                                  </span>
                                </div>
                              </div>

                              <h3 className="text-[13px] font-extrabold text-slate-800 flex items-center gap-1 line-clamp-1 leading-snug">
                                {v.campaign_name || "Voucher đặc biệt"} <span className="text-xs select-none">🎉</span>
                              </h3>
                              {v.campaign_description && (
                                <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1 leading-relaxed">
                                  {v.campaign_description}
                                </p>
                              )}
                            </div>

                            <div className="space-y-1">
                              {v.discount_type === "percent" && v.max_discount_amount && (
                                <div className="text-[9px] text-purple-600 font-semibold leading-none">
                                  Giảm tối đa: {Number(v.max_discount_amount).toLocaleString("vi-VN")}đ
                                </div>
                              )}
                              <div className="bg-slate-50 border border-slate-100 rounded-lg px-2 py-1 flex items-center gap-1.5 w-fit">
                                <svg className="w-3.5 h-3.5 text-indigo-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                </svg>
                                <span className="text-[10px] font-semibold text-slate-600 leading-none">
                                  Đơn tối thiểu: {Number(v.min_order_value) > 0 ? `${Number(v.min_order_value).toLocaleString("vi-VN")}đ` : "0đ"}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Perforated Separator 2 */}
                          <div className="relative w-3 shrink-0 flex flex-col items-center justify-between py-1 bg-white select-none">
                            <div className="absolute -top-2.5 w-5 h-5 rounded-full bg-slate-50 border border-slate-200" />
                            <div className="h-full border-l border-dashed border-slate-200" />
                            <div className="absolute -bottom-2.5 w-5 h-5 rounded-full bg-slate-50 border border-slate-200" />
                          </div>

                          {/* Right Metadata Block */}
                          <div className="w-28 p-3 bg-slate-50/50 flex flex-col justify-between border-l border-transparent shrink-0">
                            <div className="space-y-1">
                              <div className="flex items-start gap-1 text-[10px] text-slate-500">
                                <CalendarOutlined className="text-indigo-400 mt-0.5 shrink-0" />
                                <div>
                                  <div className="text-[8px] font-bold text-slate-400 leading-none">NSD</div>
                                  <div className="font-semibold text-slate-600 mt-0.5 leading-none">{new Date(v.start_date).toLocaleDateString("vi-VN")}</div>
                                </div>
                              </div>
                              <div className="flex items-start gap-1 text-[10px] text-slate-500">
                                <CalendarOutlined className="text-indigo-400 mt-0.5 shrink-0" />
                                <div>
                                  <div className="text-[8px] font-bold text-slate-400 leading-none">HSD</div>
                                  <div className="font-semibold text-slate-600 mt-0.5 leading-none">{new Date(v.end_date).toLocaleDateString("vi-VN")}</div>
                                </div>
                              </div>
                            </div>

                            <div className="pt-1.5 border-t border-slate-100 flex flex-col gap-2 w-full relative min-w-0 mt-auto">
                              <div className="flex items-start gap-1 text-[8px] text-slate-400">
                                <EnvironmentOutlined className="text-rose-400 shrink-0 mt-0.5" />
                                <span className="line-clamp-2 leading-tight flex-1" title={location?.location_name || "Toàn hệ thống"}>
                                  <span className="font-bold text-slate-500 block text-[8px] leading-none mb-0.5">Áp dụng tại</span>
                                  {location?.location_name || "Toàn hệ thống"}
                                </span>
                              </div>

                              <div className="flex items-end justify-end">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleClaimVoucher(v.voucher_id);
                                  }}
                                  disabled={isSaved || claimingId === v.voucher_id}
                                  className={`w-full rounded-lg px-2 py-1.5 text-[10px] font-bold transition shadow-sm ${isSaved
                                      ? "bg-slate-100 text-slate-400 cursor-default"
                                      : "bg-indigo-600 text-white hover:bg-indigo-700"
                                    }`}
                                >
                                  {isSaved ? "Đã lưu" : claimingId === v.voucher_id ? "Đang lưu..." : "Lưu"}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                <button
                  type="button"
                  className="mt-4 w-full rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition"
                  onClick={() => navigate("/user/vouchers")}
                >
                  Xem voucher của tôi
                </button>
              </div>
            ) : null}

          </div>

          {/* Kênh chat thời gian thực với địa điểm */}
          {!isPrivateLocation ? (
            <LocationChatBubble
              locationId={locationId}
              userRole="user"
              locationName={location?.location_name}
              locationImage={location?.first_image || (location?.images && location.images[0])}
            />
          ) : null}
        </div>
      </section>
      {coverCropSrc ? (
        <AvatarCropper
          src={coverCropSrc}
          title="Cắt ảnh bìa vị trí"
          accentColor="#0d9488"
          variant="cover"
          aspectRatio={16 / 9}
          onConfirm={handleCoverCropConfirm}
          onCancel={handleCoverCropCancel}
        />
      ) : null}
    </UserLayout>
  );
};

export default LocationDetail;
