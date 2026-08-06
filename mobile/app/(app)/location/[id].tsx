import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
  DeviceEventEmitter,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LocationReviews } from "../../../src/components/location/LocationReviews";
import { resolveBackendImageSource, resolveBackendUrl } from "../../../src/lib/url";
import { isLocationOpen } from "../../../src/lib/time";
import { voucherStillUsable } from "../../../src/lib/voucher-utils";
import { useAuthStore } from "../../../src/modules/auth/store";
import { confirm } from "../../../src/modules/ui/confirm-store";
import { getCachedImageUri } from "../../../src/modules/image/image-cache";
import { showToast } from "../../../src/modules/ui/toast-store";
import { geoApi } from "../../../src/services/geo.api";
import { locationApi } from "../../../src/services/location.api";
import {
  userApi,
  type LocationVoucher,
} from "../../../src/services/user.api";
import { chatApi } from "../../../src/services/chat.api";
import { isPrivateUserLocation, type LocationItem } from "../../../src/types/location";
import { LocationChatModal } from "../../../src/components/chat/LocationChatBubble";
import { travelColors } from "../../../src/theme/travel";

type DetailTab = "overview" | "reviews" | "about" | "diary";

type DiaryItem = {
  diary_id: number;
  location_id: number | null;
  mood?: "happy" | "excited" | "neutral" | "sad" | "angry" | "tired";
  notes?: string | null;
  images?: string | string[] | null;
  created_at?: string | null;
};

function locationTypeLabel(value?: string | null) {
  const type = String(value || "").toLowerCase();
  if (type === "restaurant") return "Nhà hàng";
  if (type === "cafe") return "Quán cà phê";
  if (type === "hotel") return "Khách sạn";
  if (type === "resort") return "Khu nghỉ dưỡng";
  if (type === "tourist") return "Điểm du lịch";
  return "Địa điểm";
}

function normalizeImages(value?: string[] | string | null) {
  if (Array.isArray(value)) {
    return value;
  }

  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [value];
  }
}

function DiaryPhoto({
  image,
  index,
  onRemove,
  onOpen,
}: {
  image: string;
  index: number;
  onRemove?: () => void;
  onOpen?: () => void;
}) {
  const [source, setSource] = useState<any>(null);
  const [failed, setFailed] = useState(false);
  const lastTapRef = useRef(0);

  useEffect(() => {
    let active = true;
    setFailed(false);

    const resolved = resolveBackendUrl(image) || image;
    if (!/^https?:\/\//i.test(resolved)) {
      setSource({ uri: resolved });
      return () => {
        active = false;
      };
    }

    setSource(null);
    getCachedImageUri(resolved)
      .then((cachedUri) => {
        if (!active) return;
        setSource(cachedUri ? { uri: cachedUri } : resolveBackendImageSource(image));
      })
      .catch(() => {
        if (!active) return;
        setSource(resolveBackendImageSource(image));
      });

    return () => {
      active = false;
    };
  }, [image]);

  const handlePress = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 280) {
      onOpen?.();
      lastTapRef.current = 0;
      return;
    }
    lastTapRef.current = now;
  };

  return (
    <Pressable style={styles.diaryPhotoFrame} onPress={handlePress}>
      {source && !failed ? (
        <Image
          source={source}
          style={styles.diaryImage}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <View style={styles.diaryPhotoFallback}>
          <Ionicons name="image-outline" size={22} color={travelColors.muted} />
          <Text style={styles.diaryPhotoFallbackText}>
            {failed ? "Lỗi ảnh" : `Ảnh ${index + 1}`}
          </Text>
        </View>
      )}

      {onRemove ? (
        <Pressable style={styles.diaryRemovePhotoButton} onPress={onRemove}>
          <Ionicons name="close" size={13} color="#ffffff" />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

function DiaryZoomImage({ image }: { image: string }) {
  const [source, setSource] = useState<any>(null);

  useEffect(() => {
    let active = true;
    const resolved = resolveBackendUrl(image) || image;

    if (!/^https?:\/\//i.test(resolved)) {
      setSource({ uri: resolved });
      return () => {
        active = false;
      };
    }

    setSource(null);
    getCachedImageUri(resolved)
      .then((cachedUri) => {
        if (!active) return;
        setSource(cachedUri ? { uri: cachedUri } : resolveBackendImageSource(image));
      })
      .catch(() => {
        if (!active) return;
        setSource(resolveBackendImageSource(image));
      });

    return () => {
      active = false;
    };
  }, [image]);

  if (!source) {
    return <ActivityIndicator color="#ffffff" size="large" />;
  }

  return <Image source={source} style={styles.diaryZoomImage} resizeMode="contain" />;
}

function openingHoursLabel(
  value: LocationItem["opening_hours"],
  date = new Date(),
) {
  if (!value) {
    return "Chưa cập nhật";
  }

  if (typeof value === "string") {
    try {
      return openingHoursLabel(JSON.parse(value));
    } catch {
      return value;
    }
  }

  if (Array.isArray(value)) {
    const dayTokens = [
      ["sun", "sunday", "cn", "0", "7"],
      ["mon", "monday", "t2", "2", "1"],
      ["tue", "tuesday", "t3", "3", "2"],
      ["wed", "wednesday", "t4", "4", "3"],
      ["thu", "thursday", "t5", "5", "4"],
      ["fri", "friday", "t6", "6", "5"],
      ["sat", "saturday", "t7", "7", "6"],
    ][date.getDay()];
    const today = value.find((item) =>
      dayTokens.includes(String(item.day || "").trim().toLowerCase()),
    );
    return today?.open && today?.close
      ? `${today.open} - ${today.close}`
      : "Chưa cập nhật";
  }

  const direct = value as Record<string, unknown>;
  if (typeof direct.open === "string" && typeof direct.close === "string") {
    return `${direct.open} - ${direct.close}`;
  }

  return "Chưa cập nhật";
}

function statusLabel(status: LocationItem["status"]) {
  if (status === "active") return "Đang hoạt động";
  if (status === "pending") return "Đang chờ duyệt";
  return "Tạm ngừng";
}

function voucherDiscountLabel(voucher: LocationVoucher) {
  const value = Number(voucher.discount_value || 0);
  const isPercent = voucher.discount_type === "percent" || voucher.discount_type === "percentage";
  if (isPercent) {
    return `Giảm ${value}%`;
  }
  return `Giảm ${value.toLocaleString("vi-VN")} đ`;
}

export default function LocationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const user = useAuthStore((state) => state.user);

  const [location, setLocation] = useState<LocationItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const [temperature, setTemperature] = useState<number | null>(null);
  const [weather, setWeather] = useState<string | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [vouchers, setVouchers] = useState<LocationVoucher[]>([]);
  const [vouchersLoading, setVouchersLoading] = useState(false);
  const [claimingVoucherId, setClaimingVoucherId] = useState<number | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [diary, setDiary] = useState<DiaryItem | null>(null);
  const [diaryNotes, setDiaryNotes] = useState("");
  const [diaryImages, setDiaryImages] = useState<string[]>([]);
  const [newDiaryImages, setNewDiaryImages] = useState<string[]>([]);
  const [zoomDiaryImage, setZoomDiaryImage] = useState<string | null>(null);
  const [savingDiary, setSavingDiary] = useState(false);
  const [diaryLoading, setDiaryLoading] = useState(false);
  const isPrivateLocation = isPrivateUserLocation(location);
  const locationDescription = useMemo(() => {
    const raw = String(location?.description || "").trim();
    if (isPrivateLocation && (!raw || raw.toLowerCase() === "user created location")) {
      return "Địa điểm tự do do bạn tạo, chỉ hiển thị trong tài khoản của bạn.";
    }
    return raw || "Địa điểm chưa cập nhật phần giới thiệu.";
  }, [isPrivateLocation, location?.description]);
  const diaryPreviewImages = useMemo(
    () => [...diaryImages, ...newDiaryImages].filter(Boolean).slice(0, 6),
    [diaryImages, newDiaryImages],
  );

  const loadDetail = async () => {
    if (!id) return;

    try {
      setLoading(true);
      const [locationResponse, favoriteResponse, unreadResponse] =
        await Promise.all([
          locationApi.getLocationById(id),
          user
            ? userApi.getFavorites().catch(() => ({ success: false, data: [] }))
            : Promise.resolve({ success: false, data: [] }),
          chatApi.getUnreadCountsByLocation(Number(id)).catch(() => ({ success: false, userUnread: 0 })),
        ]);

      setLocation(locationResponse.data);
      setRenameValue(locationResponse.data?.location_name || "");
      setUnreadCount(unreadResponse.userUnread || 0);
      setIsFavorite(
        (favoriteResponse.data || []).some(
          (item) => Number(item.location_id) === Number(id),
        ),
      );
    } catch {
      showToast("Không thể tải chi tiết địa điểm");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDetail();
  }, [id, user]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener("chat_unread_update", () => {
      if (!id) return;
      chatApi.getUnreadCountsByLocation(Number(id))
        .then((res) => {
          if (res.success) {
            setUnreadCount(res.userUnread || 0);
          }
        })
        .catch(() => { });
    });
    return () => sub.remove();
  }, [id]);

  useEffect(() => {
    if (!id || !user || isPrivateLocation) {
      setVouchers([]);
      return;
    }

    let active = true;
    setVouchersLoading(true);

    userApi
      .getVouchersByLocation(id)
      .then((response) => {
        if (!active) return;
        setVouchers(
          (response.data || []).filter((voucher) => {
            const isClaimed = Boolean(voucher.is_claimed) || Number(voucher.claimed_count || 0) > 0;
            return !isClaimed && voucherStillUsable(voucher);
          }),
        );
      })
      .catch(() => {
        if (active) setVouchers([]);
      })
      .finally(() => {
        if (active) setVouchersLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id, isPrivateLocation, user]);

  useEffect(() => {
    const latitude = Number(location?.latitude);
    const longitude = Number(location?.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setTemperature(null);
      setWeather(null);
      return;
    }

    let active = true;
    setWeatherLoading(true);

    geoApi
      .reverse(latitude, longitude)
      .then((response) => {
        if (!active) return;
        setTemperature(
          Number.isFinite(Number(response.temperature))
            ? Number(response.temperature)
            : null,
        );
        setWeather(response.weather || null);
      })
      .catch(() => {
        if (!active) return;
        setTemperature(null);
        setWeather(null);
      })
      .finally(() => {
        if (active) setWeatherLoading(false);
      });

    return () => {
      active = false;
    };
  }, [location?.latitude, location?.longitude]);

  useEffect(() => {
    if (!isPrivateLocation && activeTab === "diary") {
      setActiveTab("overview");
    }
    if (isPrivateLocation && (activeTab === "reviews" || activeTab === "about")) {
      setActiveTab("overview");
    }
  }, [activeTab, isPrivateLocation]);

  useEffect(() => {
    if (!id || !isPrivateLocation) {
      setDiary(null);
      setDiaryNotes("");
      setDiaryImages([]);
      setNewDiaryImages([]);
      return;
    }

    let active = true;
    setDiaryLoading(true);
    userApi
      .getDiaries({ locationId: id })
      .then((response) => {
        if (!active) return;
        const entry = (response.data || [])[0] as DiaryItem | undefined;
        setDiary(entry || null);
        setDiaryNotes(entry?.notes || "");
        setDiaryImages(entry ? normalizeImages(entry.images).filter(Boolean) : []);
        setNewDiaryImages([]);
      })
      .catch(() => {
        if (!active) return;
        setDiary(null);
        setDiaryNotes("");
        setDiaryImages([]);
        setNewDiaryImages([]);
      })
      .finally(() => {
        if (active) setDiaryLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id, isPrivateLocation]);

  const gallery = useMemo(() => {
    if (!location) return [];
    const items = normalizeImages(location.images)
      .map((item) => resolveBackendUrl(item))
      .filter((item): item is string => Boolean(item));
    const cover = resolveBackendUrl(location.first_image);
    return cover && !items.includes(cover) ? [cover, ...items] : items;
  }, [location]);

  const toggleFavorite = async () => {
    if (!location || favoriteLoading) return;

    const nextValue = !isFavorite;
    setIsFavorite(nextValue);
    setFavoriteLoading(true);

    try {
      await userApi.toggleFavorite(location.location_id, nextValue);
      showToast(nextValue ? "Đã lưu địa điểm" : "Đã bỏ lưu địa điểm");
    } catch {
      setIsFavorite(!nextValue);
      showToast("Không thể cập nhật địa điểm đã lưu");
    } finally {
      setFavoriteLoading(false);
    }
  };

  const shareLocation = async () => {
    if (!location) return;

    try {
      await Share.share({
        title: location.location_name,
        message: `${location.location_name}\n${location.address}\ntravelcheckin://location/${location.location_id}`,
      });
    } catch {
      showToast("Không thể chia sẻ địa điểm lúc này");
    }
  };

  const openDirections = () => {
    if (!location) return;
    router.push({
      pathname: "/(app)/(tabs)/explore",
      params: {
        focusLocationId: String(location.location_id),
        startRoute: "1",
        requestKey: String(Date.now()),
      },
    });
  };

  const claimVoucher = async (voucherId: number) => {
    if (claimingVoucherId) return;

    setClaimingVoucherId(voucherId);
    try {
      await userApi.claimVoucher(voucherId);
      setVouchers((current) =>
        current.filter((voucher) => voucher.voucher_id !== voucherId),
      );
      showToast("Đã lưu voucher vào kho của bạn");
    } catch {
      showToast("Không thể lưu voucher lúc này");
    } finally {
      setClaimingVoucherId(null);
    }
  };

  const savePrivateLocationName = async () => {
    if (!location || savingName) return;
    const nextName = renameValue.trim();
    if (nextName.length < 3) {
      showToast("Tên vị trí quá ngắn");
      return;
    }

    setSavingName(true);
    try {
      const response = await userApi.updateMyCreatedLocation(location.location_id, {
        location_name: nextName,
      });
      const updated = response.data || { ...location, location_name: nextName };
      setLocation((current) => current ? { ...current, ...updated, location_name: nextName } : current);
      setRenameValue(nextName);
      setIsRenaming(false);
      showToast("Đã đổi tên vị trí");
    } catch {
      showToast("Không thể đổi tên vị trí");
    } finally {
      setSavingName(false);
    }
  };

  const pickPrivateLocationCover = async () => {
    if (!location || uploadingCover) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showToast("Cần cấp quyền thư viện ảnh");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.85,
    });

    if (result.canceled || !result.assets?.[0]?.uri) return;

    setUploadingCover(true);
    try {
      const response = await userApi.uploadMyCreatedLocationCover(
        location.location_id,
        result.assets[0].uri,
      );
      const imageUrl = response.data?.image_url || null;
      if (imageUrl) {
        setLocation((current) =>
          current
            ? {
              ...current,
              first_image: imageUrl,
              images: [imageUrl, ...normalizeImages(current.images).filter((item) => item !== imageUrl)],
            }
            : current,
        );
      }
      showToast("Đã cập nhật ảnh bìa");
    } catch {
      showToast("Không thể cập nhật ảnh bìa");
    } finally {
      setUploadingCover(false);
    }
  };

  const pickDiaryImages = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showToast("Cần cấp quyền thư viện ảnh");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.85,
      selectionLimit: 6,
    });

    if (!result.canceled && result.assets) {
      const picked = result.assets
        .map((asset) => asset.uri)
        .filter(Boolean);
      if (picked.length > 0) {
        const availableSlots = Math.max(0, 6 - diaryImages.length);
        setNewDiaryImages((current) =>
          Array.from(new Set([...current, ...picked])).slice(0, availableSlots),
        );
        showToast(`Đã chọn ${picked.length} ảnh nhật ký`);
      }
    }
  };

  const savePrivateDiary = async () => {
    if (!location || savingDiary) return;
    if (!diaryNotes.trim() && diaryImages.length === 0 && newDiaryImages.length === 0) {
      showToast("Nhập ghi chú hoặc chọn ảnh");
      return;
    }

    setSavingDiary(true);
    try {
      const uploadedImages: string[] = [];
      for (const uri of newDiaryImages) {
        const response = await userApi.uploadDiaryImage(uri);
        if (response.success && response.data?.image_url) {
          uploadedImages.push(response.data.image_url);
        }
      }
      if (newDiaryImages.length > 0 && uploadedImages.length !== newDiaryImages.length) {
        throw new Error("Không thể tải đủ ảnh nhật ký");
      }

      const allImages = [...diaryImages, ...uploadedImages].slice(0, 6);
      await userApi.createDiary({
        location_id: location.location_id,
        location_name: location.location_name,
        mood: "happy",
        notes: diaryNotes.trim(),
        images: allImages,
      });

      const refreshed = await userApi.getDiaries({ locationId: location.location_id });
      const entry = (refreshed.data || [])[0] as DiaryItem | undefined;
      setDiary(entry || null);
      setDiaryNotes(entry?.notes || diaryNotes.trim());
      setDiaryImages(entry ? normalizeImages(entry.images).filter(Boolean) : allImages);
      setNewDiaryImages([]);
      showToast(diary ? "Đã cập nhật nhật ký" : "Đã lưu nhật ký");
    } catch {
      showToast("Không thể lưu nhật ký");
    } finally {
      setSavingDiary(false);
    }
  };

  const deletePrivateDiary = async () => {
    if (!diary?.diary_id) return;
    const ok = await confirm({
      title: "Xóa nhật ký",
      message: "Bạn có chắc muốn xóa nhật ký này?",
      confirmText: "Xóa",
      cancelText: "Hủy",
      destructive: true,
    });
    if (!ok) return;

    try {
      await userApi.deleteDiary(diary.diary_id);
      setDiary(null);
      setDiaryNotes("");
      setDiaryImages([]);
      setNewDiaryImages([]);
      showToast("Đã xóa nhật ký");
    } catch {
      showToast("Không thể xóa nhật ký");
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color={travelColors.teal} size="large" />
        <Text style={styles.loadingText}>Đang tải địa điểm...</Text>
      </View>
    );
  }

  if (!location) {
    return (
      <View style={[styles.loadingScreen, { paddingTop: insets.top }]}>
        <Text style={styles.errorTitle}>Không tìm thấy địa điểm</Text>
        <Pressable style={styles.retryButton} onPress={() => void loadDetail()}>
          <Text style={styles.retryText}>Thử lại</Text>
        </Pressable>
      </View>
    );
  }

  const coverUrl = gallery[0] || null;
  const coverSource = coverUrl ? resolveBackendImageSource(coverUrl) : null;
  const rating = Number(location.rating || 0);
  const detailTabs = isPrivateLocation
    ? ([
      ["overview", "Tổng quan"],
      ["diary", "Nhật ký"],
    ] as const)
    : ([
      ["overview", "Tổng quan"],
      ["reviews", "Đánh giá"],
      ["about", "Giới thiệu"],
    ] as const);

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        bounces={false}
        overScrollMode="never"
        contentContainerStyle={{ paddingBottom: insets.bottom + 86 }}
      >
        <View style={styles.coverContainer}>
          {coverSource ? (
            <Image source={coverSource} style={styles.coverImage} resizeMode="cover" />
          ) : (
            <View style={[styles.coverImage, styles.coverFallback]}>
              <Ionicons name="image-outline" size={42} color="#94a3b8" />
            </View>
          )}

          <View style={[styles.headerActions, { top: Math.max(insets.top, 14) }]}>
            <Pressable style={styles.iconButton} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={24} color={travelColors.ink} />
            </Pressable>
          </View>

          <View style={[styles.weatherOverlay, { top: Math.max(insets.top, 14) }]}>
            <Ionicons name="partly-sunny-outline" size={24} color="#0369a1" />
            <View>
              <Text style={styles.weatherOverlayTemperature}>
                {weatherLoading
                  ? "..."
                  : temperature != null
                    ? `${Math.round(temperature)}°C`
                    : "--"}
              </Text>
              <Text style={styles.weatherOverlayDescription} numberOfLines={1}>
                {weatherLoading ? "Đang tải" : weather || "Chưa có dữ liệu"}
              </Text>
            </View>
          </View>

          {isPrivateLocation ? (
            <Pressable
              style={styles.coverEditButton}
              disabled={uploadingCover}
              onPress={() => void pickPrivateLocationCover()}
            >
              <Ionicons name="image-outline" size={16} color={travelColors.teal} />
              <Text style={styles.coverEditText}>
                {uploadingCover ? "Đang tải" : "Đổi ảnh"}
              </Text>
            </Pressable>
          ) : null}

          {!isPrivateLocation && (location.temp_close_type || !isLocationOpen(location.opening_hours)) && (
            <View style={[styles.closedOverlay, location.temp_close_type && { backgroundColor: "rgba(220, 38, 38, 0.85)" }]}>
              <Ionicons name={location.temp_close_type ? "alert-circle-outline" : "time-outline"} size={20} color="#fff" />
              <Text style={styles.closedOverlayText}>
                {location.temp_close_type ? "Tạm thời đóng cửa" : "Đang đóng cửa"}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.infoPanel}>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>
              {isPrivateLocation ? "Vị trí tự do" : locationTypeLabel(location.location_type)}
            </Text>
          </View>
          {isPrivateLocation ? (
            <View style={styles.renameBlock}>
              {isRenaming ? (
                <TextInput
                  value={renameValue}
                  onChangeText={setRenameValue}
                  autoFocus
                  style={styles.renameInput}
                />
              ) : (
                <Text style={styles.locationTitle}>{location.location_name}</Text>
              )}
              <Pressable
                style={styles.renameButton}
                disabled={savingName}
                onPress={() => {
                  if (isRenaming) void savePrivateLocationName();
                  else setIsRenaming(true);
                }}
              >
                <Ionicons name={isRenaming ? "checkmark" : "pencil"} size={18} color={travelColors.teal} />
              </Pressable>
            </View>
          ) : (
            <Text style={styles.locationTitle}>{location.location_name}</Text>
          )}
          {!isPrivateLocation ? (
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={16} color="#eab308" />
              <Text style={styles.ratingScore}>
                {rating > 0 ? rating.toFixed(1) : "Chưa có"}
              </Text>
              <Text style={styles.reviewCount}>
                ({location.total_reviews || 0} đánh giá)
              </Text>
            </View>
          ) : (
            <View style={styles.privateDetailBadge}>
              <Ionicons name="lock-closed-outline" size={14} color={travelColors.teal} />
              <Text style={styles.privateDetailBadgeText}>Vị trí riêng tư</Text>
            </View>
          )}

          <View style={styles.quickActions}>
            <Pressable style={styles.quickAction} onPress={openDirections}>
              <Ionicons name="navigate-outline" size={20} color={travelColors.teal} />
              <Text style={styles.quickActionText}>Chỉ đường</Text>
            </Pressable>
            <Pressable style={styles.quickAction} onPress={() => void toggleFavorite()}>
              <Ionicons
                name={isFavorite ? "heart" : "heart-outline"}
                size={21}
                color={isFavorite ? travelColors.danger : travelColors.teal}
              />
              <Text style={[styles.quickActionText, isFavorite && styles.savedText]}>
                {isFavorite ? "Đã lưu" : "Lưu"}
              </Text>
            </Pressable>
            <Pressable style={[styles.quickAction, isPrivateLocation && styles.hidden]} onPress={() => void shareLocation()}>
              <Ionicons name="share-outline" size={20} color={travelColors.teal} />
              <Text style={styles.quickActionText}>Chia sẻ</Text>
            </Pressable>
          </View>

          <View style={styles.tabHeader}>
            {detailTabs.map(([value, label]) => (
              <Pressable
                key={value}
                onPress={() => setActiveTab(value)}
                style={[styles.tabButton, activeTab === value && styles.tabButtonActive]}
              >
                <Text
                  style={[styles.tabText, activeTab === value && styles.tabTextActive]}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>

          {activeTab === "overview" ? (
            <View style={styles.section}>
              <View style={styles.descriptionBlock}>
                <Text style={styles.descriptionText}>
                  {locationDescription}
                </Text>
              </View>

              <DetailInfoRow
                icon="business-outline"
                label="Tên địa điểm"
                value={location.location_name}
              />
              <DetailInfoRow
                icon="location-outline"
                label="Địa chỉ"
                value={location.address}
              />
              <DetailInfoRow
                icon="checkmark-circle-outline"
                label="Trạng thái"
                value={location.temp_close_type ? "Tạm thời đóng cửa" : statusLabel(location.status)}
                accent={location.status === "active" && !location.temp_close_type}
                danger={!!location.temp_close_type}
              />
              <DetailInfoRow
                icon="time-outline"
                label="Thời gian mở cửa - đóng cửa"
                value={location.temp_close_type ? (location.temp_close_until ? `Đóng đến ${(() => {
                  const d = new Date(location.temp_close_until);
                  if (isNaN(d.getTime())) return location.temp_close_until;
                  const pad = (n: number) => String(n).padStart(2, '0');
                  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
                })()}` : "Đóng vô thời hạn") : openingHoursLabel(location.opening_hours)}
                danger={!!location.temp_close_type}
              />
              <DetailInfoRow
                icon="call-outline"
                label="Số điện thoại"
                value={location.phone || "Chưa cập nhật"}
              />
              <DetailInfoRow
                icon="mail-outline"
                label="Email"
                value={location.email || "Chưa cập nhật"}
              />
              <DetailInfoRow
                icon="globe-outline"
                label="Website"
                value={location.website || "Chưa cập nhật"}
              />
              {location.province ? (
                <DetailInfoRow
                  icon="map-outline"
                  label="Tỉnh / Thành phố"
                  value={location.province}
                />
              ) : null}
              {location.is_eco_friendly ? (
                <DetailInfoRow
                  icon="leaf-outline"
                  label="Môi trường"
                  value="Địa điểm thân thiện với môi trường"
                  accent
                />
              ) : null}

              {!isPrivateLocation ? (
                <View style={styles.voucherSection}>
                  <View style={styles.voucherHeading}>
                    <View>
                      <Text style={styles.voucherTitle}>Voucher & khuyến mãi</Text>
                      <Text style={styles.voucherSubtitle}>
                        Ưu đãi đang áp dụng tại địa điểm
                      </Text>
                    </View>
                    <Ionicons name="ticket-outline" size={22} color={travelColors.coral} />
                  </View>

                  {vouchersLoading ? (
                    <ActivityIndicator color={travelColors.coral} />
                  ) : vouchers.length === 0 ? (
                    <Text style={styles.voucherEmpty}>
                      Chưa có voucher cho địa điểm này.
                    </Text>
                  ) : (
                    vouchers
                      .filter((v) => !(Boolean(v.is_claimed) || Number(v.claimed_count || 0) > 0))
                      .slice(0, 2)
                      .map((voucher) => {
                        const claimed = Boolean(voucher.is_claimed) || Number(voucher.claimed_count || 0) > 0;
                        const isPercent = voucher.discount_type === "percent" || voucher.discount_type === "percentage";
                        const discountLabel = isPercent
                          ? `-${Number(voucher.discount_value)}%`
                          : `-${(Number(voucher.discount_value) / 1000).toFixed(0)}k`;

                        const maxUsesPerUser = Number(voucher.max_uses_per_user || 1);
                        const userUsed = Number(voucher.user_used_count || 0);
                        const userRemaining = Math.max(0, maxUsesPerUser - userUsed);
                        const systemRemaining = voucher.remaining != null ? Math.max(0, Number(voucher.remaining)) : 999999;
                        const displayRemaining = Math.min(userRemaining, systemRemaining);

                        const locationText = voucher.location_name || "Toàn hệ thống";

                        return (
                          <View
                            key={voucher.voucher_id}
                            className="bg-white rounded-2xl flex-row overflow-hidden border border-slate-100 mb-4 shadow-sm"
                            style={{ elevation: 2, height: 140 }}
                          >
                            {/* Left Violet Stub */}
                            <View className="relative w-20 bg-indigo-600 justify-center items-center p-2 select-none">
                              <View className="absolute top-2 right-2 opacity-50">
                                <Ionicons name="sparkles" size={10} color="#c084fc" />
                              </View>
                              <Text className="text-white font-black text-xl tracking-tight text-center">
                                {discountLabel}
                              </Text>
                              <Text className="text-indigo-200 text-[8px] font-bold tracking-widest mt-0.5 uppercase">
                                GIẢM GIÁ
                              </Text>
                              <View className="absolute bottom-0 w-full h-6 flex-row items-end opacity-20 px-1 justify-between">
                                <View className="w-[12%] h-[60%] bg-white rounded-t-sm" />
                                <View className="w-[15%] h-[80%] bg-white rounded-t-sm" />
                                <View className="w-[10%] h-[40%] bg-white rounded-t-sm" />
                                <View className="w-[18%] h-[90%] bg-white rounded-t-sm" />
                                <View className="w-[14%] h-[70%] bg-white rounded-t-sm" />
                                <View className="w-[12%] h-[50%] bg-white rounded-t-sm" />
                              </View>
                            </View>

                            {/* Perforated Separator 1 */}
                            <View className="relative w-3 shrink-0 flex-col items-center justify-between py-1 bg-white">
                              <View className="absolute -top-2 w-4 h-4 rounded-full bg-slate-100 border border-slate-200" />
                              <View className="h-full border-l border-dashed border-slate-200" />
                              <View className="absolute -bottom-2 w-4 h-4 rounded-full bg-slate-100 border border-slate-200" />
                            </View>

                            {/* Middle Info Block */}
                            <View className="flex-1 p-3 pl-1.5 bg-white justify-between min-w-0">
                              <View>
                                <View className="flex-row items-center gap-1.5 mb-1 flex-wrap">
                                  <View className="bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
                                    <Text className="text-[8px] font-black text-indigo-700 uppercase tracking-wider">
                                      MÃ GIẢM GIÁ
                                    </Text>
                                  </View>
                                  <View className="bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-full flex-row items-center gap-0.5">
                                    <Ionicons name="time-outline" size={8} color="#059669" />
                                    <Text className="text-[8px] font-bold text-emerald-600">
                                      Còn {displayRemaining} vé
                                    </Text>
                                  </View>
                                </View>

                                <Text className="text-[13px] font-extrabold text-slate-800 leading-snug" numberOfLines={1}>
                                  {voucher.campaign_name || "Voucher đặc biệt"} 🎉
                                </Text>
                                {voucher.campaign_description ? (
                                  <Text className="text-[10px] text-slate-400 mt-0.5 leading-[13px]" numberOfLines={1}>
                                    {voucher.campaign_description}
                                  </Text>
                                ) : null}
                              </View>

                              <View className="bg-slate-50 border border-slate-100 rounded-lg px-2 py-1 flex-row items-center gap-1 my-0.5 self-start">
                                <Ionicons name="card-outline" size={10} color="#6366f1" />
                                <Text className="text-[9px] font-semibold text-slate-600">
                                  Đơn tối thiểu: {Number(voucher.min_order_value) > 0 ? `${Number(voucher.min_order_value) >= 1000 ? (Number(voucher.min_order_value) / 1000).toFixed(0) + "k" : voucher.min_order_value}đ` : "0đ"}
                                </Text>
                              </View>
                            </View>

                            {/* Perforated Separator 2 */}
                            <View className="relative w-3 shrink-0 flex-col items-center justify-between py-1 bg-white">
                              <View className="absolute -top-2 w-4 h-4 rounded-full bg-slate-100 border border-slate-200" />
                              <View className="h-full border-l border-dashed border-slate-200" />
                              <View className="absolute -bottom-2 w-4 h-4 rounded-full bg-slate-100 border border-slate-200" />
                            </View>

                            {/* Right Metadata Block */}
                            <View className="w-24 p-2 bg-slate-50/50 justify-between border-l border-transparent shrink-0">
                              <View className="gap-1">
                                <View className="flex-row items-start gap-1">
                                  <Ionicons name="calendar-outline" size={9} color="#6366f1" className="mt-0.5" />
                                  <View>
                                    <Text className="text-[8px] font-bold text-slate-400 leading-none">NSD</Text>
                                    <Text className="text-[9px] font-semibold text-slate-600 mt-0.5">{voucher.start_date ? new Date(voucher.start_date).toLocaleDateString("vi-VN") : "-"}</Text>
                                  </View>
                                </View>
                                <View className="flex-row items-start gap-1">
                                  <Ionicons name="calendar-outline" size={9} color="#6366f1" className="mt-0.5" />
                                  <View>
                                    <Text className="text-[8px] font-bold text-slate-400 leading-none">HSD</Text>
                                    <Text className="text-[9px] font-semibold text-slate-600 mt-0.5">{voucher.end_date ? new Date(voucher.end_date).toLocaleDateString("vi-VN") : "-"}</Text>
                                  </View>
                                </View>
                              </View>

                              <Pressable
                                className={`py-1.5 px-2 rounded-lg items-center ${claimed ? "bg-slate-100" : "bg-indigo-600 active:bg-indigo-700"}`}
                                disabled={claimed || claimingVoucherId === voucher.voucher_id}
                                onPress={() => void claimVoucher(voucher.voucher_id)}
                              >
                                <Text className={`text-[11px] font-bold ${claimed ? "text-slate-400" : "text-white"}`}>
                                  {claimed ? "Đã lưu" : claimingVoucherId === voucher.voucher_id ? "..." : "Lưu"}
                                </Text>
                              </Pressable>
                            </View>
                          </View>
                        );
                      })
                  )}
                </View>
              ) : null}
            </View>
          ) : null}

          {activeTab === "diary" && isPrivateLocation ? (
            <View style={styles.diarySection}>
              <View style={styles.diaryHeader}>
                <View>
                  <Text style={styles.diaryTitle}>Nhật ký vị trí</Text>
                  <Text style={styles.diarySubtitle}>
                    {diary?.created_at
                      ? new Date(diary.created_at).toLocaleString("vi-VN")
                      : "Ghi lại ghi chú và hình ảnh riêng tư"}
                  </Text>
                </View>
                {diary?.diary_id ? (
                  <Pressable style={styles.diaryDeleteButton} onPress={deletePrivateDiary}>
                    <Ionicons name="trash-outline" size={18} color={travelColors.danger} />
                  </Pressable>
                ) : null}
              </View>

              {diaryLoading ? (
                <ActivityIndicator color={travelColors.teal} />
              ) : null}

              {diaryPreviewImages.length > 0 ? (
                <View style={styles.diaryImageGrid}>
                  {diaryPreviewImages.map((image, index) => {
                    const isNewImage = newDiaryImages.includes(image);
                    return (
                      <DiaryPhoto
                        key={`${image}-${index}`}
                        image={image}
                        index={index}
                        onOpen={() => setZoomDiaryImage(image)}
                        onRemove={
                          isNewImage
                            ? () => setNewDiaryImages((current) => current.filter((item) => item !== image))
                            : undefined
                        }
                      />
                    );
                  })}
                </View>
              ) : (
                <View style={styles.diaryEmptyImage}>
                  <Ionicons name="images-outline" size={28} color={travelColors.muted} />
                  <Text style={styles.diaryEmptyText}>Chưa có ảnh nhật ký</Text>
                </View>
              )}

              <TextInput
                value={diaryNotes}
                onChangeText={setDiaryNotes}
                placeholder="Ghi chú về vị trí này..."
                placeholderTextColor={travelColors.muted}
                multiline
                style={styles.diaryInput}
              />

              <View style={styles.diaryActions}>
                <Pressable style={styles.diaryPickButton} onPress={() => void pickDiaryImages()}>
                  <Ionicons name="image-outline" size={18} color={travelColors.teal} />
                  <Text style={styles.diaryPickText}>Chọn ảnh</Text>
                </Pressable>
                <Pressable
                  style={[styles.diarySaveButton, savingDiary && styles.actionButtonDisabled]}
                  disabled={savingDiary}
                  onPress={() => void savePrivateDiary()}
                >
                  <Text style={styles.diarySaveText}>
                    {savingDiary ? "Đang lưu" : diary ? "Cập nhật" : "Lưu nhật ký"}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {activeTab === "reviews" ? (
            <LocationReviews
              locationId={id}
              onSubmitted={() =>
                setLocation((current) =>
                  current
                    ? { ...current, total_reviews: Number(current.total_reviews || 0) + 1 }
                    : current,
                )
              }
            />
          ) : null}

          {activeTab === "about" ? (
            <View style={styles.section}>
              <Text style={styles.aboutText}>
                {locationDescription}
              </Text>
              {location.website ? (
                <InfoRow icon="globe-outline" text={location.website} />
              ) : null}
            </View>
          ) : null}
        </View>
      </ScrollView>

      <Modal
        visible={Boolean(zoomDiaryImage)}
        transparent
        animationType="fade"
        onRequestClose={() => setZoomDiaryImage(null)}
      >
        <View style={styles.diaryZoomBackdrop}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setZoomDiaryImage(null)} />
          <Pressable
            style={[styles.diaryZoomClose, { top: Math.max(insets.top, 18) }]}
            onPress={() => setZoomDiaryImage(null)}
          >
            <Ionicons name="close" size={24} color="#ffffff" />
          </Pressable>
          {zoomDiaryImage ? <DiaryZoomImage image={zoomDiaryImage} /> : null}
        </View>
      </Modal>

      {!isPrivateLocation ? (
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Pressable
            style={[
              styles.actionButton,
              (location.temp_close_type || !isLocationOpen(location.opening_hours)) && styles.actionButtonDisabled
            ]}
            disabled={!!location.temp_close_type || !isLocationOpen(location.opening_hours)}
            onPress={() => {
              const t = String(location.location_type || "").toLowerCase();
              if (t === "restaurant" || t === "cafe") {
                router.push(`/booking/table/0?locationId=${location.location_id}`);
              } else if (t === "hotel" || t === "resort") {
                router.push(`/booking/hotel/${location.location_id}`);
              } else if (t === "tourist") {
                router.push(`/booking/ticket/all?locationId=${location.location_id}`);
              } else {
                router.push(`/location/${location.location_id}/services`);
              }
            }}
          >
            <Text style={styles.actionButtonText}>
              {location.temp_close_type ? "Địa điểm tạm thời đóng cửa" : (() => {
                const t = String(location.location_type || "").toLowerCase();
                if (t === "restaurant" || t === "cafe") return "Đặt bàn trước";
                if (t === "hotel" || t === "resort") return "Đặt phòng";
                if (t === "tourist") return "Mua vé";
                return "Xem dịch vụ tại địa điểm";
              })()}
            </Text>
          </Pressable>
        </View>
      ) : null}


      {!isPrivateLocation ? (
        <Pressable
          style={{
            position: "absolute",
            right: 20,
            bottom: Math.max(insets.bottom, 12) + 104,
            width: 52,
            height: 52,
            borderRadius: 26,
            backgroundColor: "#2563eb",
            justifyContent: "center",
            alignItems: "center",
            shadowColor: "#2563eb",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.35,
            shadowRadius: 6,
            elevation: 8,
            zIndex: 30,
          }}
          onPress={() => setIsChatOpen(true)}
          accessibilityLabel="Chat với địa điểm"
        >
          <Ionicons name="chatbubbles" size={22} color="#ffffff" />
          {unreadCount > 0 && (
            <View style={{
              position: "absolute",
              top: -2,
              right: -2,
              backgroundColor: travelColors.danger,
              borderRadius: 10,
              width: 20,
              height: 20,
              justifyContent: "center",
              alignItems: "center",
              borderWidth: 1.5,
              borderColor: "#ffffff"
            }}>
              <Text style={{ color: "#ffffff", fontSize: 10, fontWeight: "bold" }}>
                {unreadCount > 99 ? "99+" : unreadCount}
              </Text>
            </View>
          )}
        </Pressable>
      ) : null}

      {!isPrivateLocation ? (
        <LocationChatModal
          locationId={location.location_id}
          userRole="user"
          locationName={location.location_name}
          locationImage={normalizeImages(location.images)[0] || null}
          visible={isChatOpen}
          onMarkedRead={() => setUnreadCount(0)}
          onClose={() => {
            setIsChatOpen(false);
            setUnreadCount(0); // Đã xem
          }}
        />
      ) : null}
    </View>
  );
}

function InfoRow({
  icon,
  text,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={19} color={travelColors.muted} />
      <Text style={styles.infoText}>{text}</Text>
    </View>
  );
}

function DetailInfoRow({
  accent = false,
  danger = false,
  icon,
  label,
  value,
}: {
  accent?: boolean;
  danger?: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailInfoRow}>
      <View style={styles.detailInfoIcon}>
        <Ionicons
          name={icon}
          size={18}
          color={danger ? travelColors.danger : accent ? travelColors.teal : travelColors.muted}
        />
      </View>
      <View style={styles.detailInfoContent}>
        <Text style={styles.detailInfoLabel}>{label}</Text>
        <Text style={[
          styles.detailInfoValue,
          accent && styles.detailInfoAccent,
          danger && { color: "#dc2626", fontWeight: "700" }
        ]}>
          {value}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: travelColors.surface,
  },
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: travelColors.surface,
    paddingHorizontal: 24,
  },
  loadingText: {
    color: travelColors.muted,
    fontSize: 15,
  },
  errorTitle: {
    color: travelColors.ink,
    fontWeight: "800",
    fontSize: 20,
  },
  retryButton: {
    height: 44,
    paddingHorizontal: 24,
    justifyContent: "center",
    backgroundColor: travelColors.teal,
    borderRadius: 8,
  },
  retryText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  coverContainer: {
    height: 285,
    width: "100%",
  },
  coverImage: {
    width: "100%",
    height: "100%",
  },
  coverFallback: {
    backgroundColor: travelColors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  coverEditButton: {
    position: "absolute",
    right: 18,
    bottom: 18,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    elevation: 4,
  },
  coverEditText: {
    color: travelColors.teal,
    fontSize: 12,
    fontWeight: "800",
  },
  headerActions: {
    position: "absolute",
    left: 14,
    right: 14,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  headerRight: {
    flexDirection: "row",
    gap: 9,
  },
  weatherOverlay: {
    position: "absolute",
    right: 22,
    minWidth: 100,
    maxWidth: 150,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
  },
  weatherOverlayTemperature: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "900",
    textAlign: "right",
  },
  weatherOverlayDescription: {
    maxWidth: 88,
    color: "#374151",
    fontSize: 13,
    fontWeight: "bold",
    textAlign: "right",
  },
  closedOverlay: {
    position: "absolute",
    left: 14,
    bottom: 34,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.7)",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    elevation: 5,
  },
  closedOverlayText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.94)",
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
  },
  infoPanel: {
    marginTop: -22,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    backgroundColor: travelColors.card,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 24,
  },
  typeBadge: {
    alignSelf: "flex-start",
    backgroundColor: travelColors.tealSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 8,
  },
  typeBadgeText: {
    color: travelColors.tealDark,
    fontSize: 12,
    fontWeight: "800",
  },
  locationTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "800",
    color: travelColors.ink,
  },
  renameBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  renameInput: {
    flex: 1,
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: travelColors.line,
    backgroundColor: travelColors.surfaceSoft,
    paddingHorizontal: 12,
    color: travelColors.ink,
    fontSize: 21,
    fontWeight: "800",
  },
  renameButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: travelColors.tealSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  privateDetailBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 8,
    borderRadius: 999,
    backgroundColor: travelColors.tealSoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  privateDetailBadgeText: {
    color: travelColors.tealDark,
    fontSize: 12,
    fontWeight: "800",
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 7,
  },
  ratingScore: {
    color: travelColors.ink,
    fontWeight: "700",
    fontSize: 15,
  },
  reviewCount: {
    color: travelColors.muted,
    fontSize: 13,
  },
  quickActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 18,
  },
  quickAction: {
    flex: 1,
    height: 42,
    borderWidth: 1,
    borderColor: travelColors.line,
    backgroundColor: travelColors.surfaceSoft,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 5,
  },
  quickActionText: {
    color: travelColors.tealDark,
    fontSize: 13,
    fontWeight: "700",
  },
  savedText: {
    color: travelColors.danger,
  },
  tabHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: travelColors.line,
    marginTop: 20,
    marginBottom: 18,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 11,
    alignItems: "center",
  },
  tabButtonActive: {
    borderBottomWidth: 2,
    borderBottomColor: travelColors.teal,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "700",
    color: travelColors.muted,
  },
  tabTextActive: {
    color: travelColors.teal,
  },
  section: {
    gap: 9,
  },
  descriptionBlock: {
    backgroundColor: travelColors.surfaceSoft,
    borderRadius: 10,
    padding: 14,
    marginBottom: 5,
  },
  descriptionText: {
    color: travelColors.ink,
    fontSize: 14,
    lineHeight: 21,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  infoText: {
    flex: 1,
    color: travelColors.ink,
    fontSize: 14,
    lineHeight: 21,
  },
  detailInfoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 10,
    backgroundColor: travelColors.surfaceSoft,
  },
  detailInfoIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: travelColors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  detailInfoContent: {
    flex: 1,
  },
  detailInfoLabel: {
    color: travelColors.muted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  detailInfoValue: {
    marginTop: 3,
    color: travelColors.ink,
    fontSize: 14,
    lineHeight: 20,
  },
  detailInfoAccent: {
    color: travelColors.teal,
    fontWeight: "700",
  },
  aboutText: {
    color: travelColors.ink,
    fontSize: 15,
    lineHeight: 23,
  },
  voucherSection: {
    gap: 10,
    marginTop: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ffd8ce",
    backgroundColor: travelColors.coralSoft,
  },
  voucherHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  voucherTitle: {
    color: travelColors.ink,
    fontSize: 16,
    fontWeight: "800",
  },
  voucherSubtitle: {
    marginTop: 2,
    color: travelColors.muted,
    fontSize: 12,
  },
  voucherEmpty: {
    color: travelColors.muted,
    fontSize: 13,
  },
  voucherItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 11,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#fecdd3",
  },
  voucherCopy: {
    flex: 1,
  },
  voucherDiscount: {
    color: travelColors.coral,
    fontSize: 15,
    fontWeight: "800",
  },
  voucherName: {
    marginTop: 3,
    color: travelColors.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  voucherButton: {
    minWidth: 58,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: travelColors.coral,
  },
  voucherButtonClaimed: {
    backgroundColor: travelColors.line,
  },
  voucherButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
  },
  voucherButtonTextClaimed: {
    color: travelColors.muted,
  },
  diarySection: {
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: travelColors.line,
    backgroundColor: travelColors.card,
    padding: 14,
  },
  diaryHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  diaryTitle: {
    color: travelColors.ink,
    fontSize: 18,
    fontWeight: "900",
  },
  diarySubtitle: {
    marginTop: 3,
    color: travelColors.muted,
    fontSize: 12,
  },
  diaryDeleteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#fff1f2",
    alignItems: "center",
    justifyContent: "center",
  },
  diaryImageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  diaryPhotoFrame: {
    width: "31.5%",
    aspectRatio: 1,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: travelColors.line,
  },
  diaryImage: {
    width: "100%",
    height: "100%",
  },
  diaryPhotoFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: travelColors.surfaceSoft,
  },
  diaryPhotoFallbackText: {
    color: travelColors.muted,
    fontSize: 10,
    fontWeight: "800",
  },
  diaryRemovePhotoButton: {
    position: "absolute",
    top: 5,
    right: 5,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(15, 23, 42, 0.72)",
    alignItems: "center",
    justifyContent: "center",
  },
  diaryZoomBackdrop: {
    flex: 1,
    backgroundColor: "rgba(2, 6, 23, 0.94)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  diaryZoomImage: {
    width: "100%",
    height: "82%",
  },
  diaryZoomClose: {
    position: "absolute",
    right: 18,
    zIndex: 3,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(15, 23, 42, 0.74)",
    alignItems: "center",
    justifyContent: "center",
  },
  diaryEmptyImage: {
    minHeight: 110,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: travelColors.line,
    backgroundColor: travelColors.surfaceSoft,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  diaryEmptyText: {
    color: travelColors.muted,
    fontSize: 13,
    fontWeight: "700",
  },
  diaryInput: {
    minHeight: 130,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: travelColors.line,
    backgroundColor: travelColors.surfaceSoft,
    padding: 12,
    color: travelColors.ink,
    fontSize: 14,
    lineHeight: 20,
    textAlignVertical: "top",
  },
  diaryActions: {
    flexDirection: "row",
    gap: 10,
  },
  diaryPickButton: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: travelColors.line,
    backgroundColor: travelColors.surfaceSoft,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  diaryPickText: {
    color: travelColors.tealDark,
    fontSize: 13,
    fontWeight: "800",
  },
  diarySaveButton: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: travelColors.teal,
    alignItems: "center",
    justifyContent: "center",
  },
  diarySaveText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
  },
  voucherTicket: {
    minHeight: 105,
    marginBottom: 8,
    overflow: "hidden",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: travelColors.line,
    backgroundColor: "#ffffff",
    flexDirection: "row",
    elevation: 1,
  },
  voucherTicketStub: {
    width: 76,
    paddingHorizontal: 8,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: travelColors.purple,
  },
  voucherTicketDiscount: {
    color: "#ffffff",
    fontSize: 17,
    lineHeight: 21,
    fontWeight: "900",
    textAlign: "center",
  },
  voucherTicketLabel: {
    marginTop: 2,
    color: "#ddd6fe",
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0,
  },
  voucherDivider: {
    width: 12,
    alignItems: "center",
    backgroundColor: "#ffffff",
    overflow: "hidden",
    paddingVertical: 4,
    flexDirection: "column",
    justifyContent: "space-between",
  },
  voucherDividerLine: {
    flex: 1,
    width: 1,
    borderLeftWidth: 1,
    borderStyle: "dashed",
    borderColor: travelColors.line,
  },
  voucherDividerDotTop: {
    width: 14,
    height: 7,
    borderBottomLeftRadius: 7,
    borderBottomRightRadius: 7,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: travelColors.line,
    backgroundColor: travelColors.surfaceSoft,
  },
  voucherDividerDotBottom: {
    width: 14,
    height: 7,
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: travelColors.line,
    backgroundColor: travelColors.surfaceSoft,
  },
  voucherTicketBody: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 10,
    paddingRight: 10,
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
  },
  voucherTicketTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  voucherTicketCopy: {
    flex: 1,
    minWidth: 0,
  },
  voucherTicketName: {
    color: travelColors.ink,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
  },
  voucherTicketDescription: {
    marginTop: 2,
    color: travelColors.muted,
    fontSize: 10,
    lineHeight: 14,
  },
  voucherTicketButton: {
    minWidth: 44,
    height: 28,
    paddingHorizontal: 9,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: travelColors.purple,
  },
  voucherTicketButtonClaimed: {
    backgroundColor: travelColors.surfaceSoft,
  },
  voucherTicketButtonText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "800",
  },
  voucherTicketButtonTextClaimed: {
    color: travelColors.muted,
  },
  voucherTicketMetaRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 8,
  },
  voucherTicketMeta: {
    color: travelColors.muted,
    fontSize: 9,
    lineHeight: 13,
    fontWeight: "600",
  },
  voucherTicketDate: {
    marginTop: 2,
    color: travelColors.muted,
    fontSize: 8,
    lineHeight: 12,
  },
  voucherTicketRemaining: {
    overflow: "hidden",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    color: travelColors.tealDark,
    backgroundColor: travelColors.tealSoft,
    fontSize: 9,
    fontWeight: "800",
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: travelColors.card,
    paddingTop: 10,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: travelColors.line,
  },
  actionButton: {
    height: 50,
    backgroundColor: travelColors.teal,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonDisabled: {
    backgroundColor: "#98a2b3",
  },
  actionButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
  chatBubbles: {
    position: "absolute",
    right: 15,
    gap: 10,
    zIndex: 30,
  },
  chatBubble: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
  },
  ownerChatBubble: {
    backgroundColor: "#2563eb",
  },
  aiChatBubble: {
    backgroundColor: travelColors.purple,
  },
  hidden: {
    display: "none",
  },
});
