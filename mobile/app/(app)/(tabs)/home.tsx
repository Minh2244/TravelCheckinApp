import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import * as Location from "expo-location";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
  FlatList,
  Image,
  ImageBackground,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { resolveBackendUrl } from "../../../src/lib/url";
import { useAuthStore } from "../../../src/modules/auth/store";
import { useLocations } from "../../../src/modules/locations/use-locations";
import { useLocationPermissionStore } from "../../../src/modules/location-permission/store";
import { useAppSettingsStore } from "../../../src/store/app-settings";
import { geoApi } from "../../../src/services/geo.api";
import { userApi } from "../../../src/services/user.api";
import { travelColors, travelShadow } from "../../../src/theme/travel";
import type { LocationItem } from "../../../src/types/location";
import {
  formatDistanceKm,
  type Coordinates,
} from "../../../src/utils/location-distance";

type GeoState =
  | { status: "idle" | "loading" }
  | { status: "ready"; city: string; temperature?: number; weather?: string }
  | { status: "error"; message: string };

const quickActions: Array<{
  label: string;
  description: string;
  action:
    | "wallet"
    | "vouchers"
    | "sos"
    | "diary"
    | "reminders"
    | "itineraries"
    | "ai_chat"
    | "notifications";
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  background: string;
}> = [
  {
    label: "Giỏ vé",
    description: "Vé bàn, phòng & tour",
    action: "wallet",
    icon: "ticket-outline",
    tint: "#2587d9",
    background: "#eaf5ff",
  },
  {
    label: "Ví Voucher",
    description: "Mã giảm giá đã nhận",
    action: "vouchers",
    icon: "gift-outline",
    tint: "#ff6b4a",
    background: "#fff0eb",
  },
  {
    label: "Thông báo",
    description: "Hộp thư & tin tức mới",
    action: "notifications",
    icon: "notifications-outline",
    tint: "#ef4444",
    background: "#fff1f2",
  },
  {
    label: "Nhật ký",
    description: "Lưu giữ kỷ niệm đi đi",
    action: "diary",
    icon: "journal-outline",
    tint: "#6d35f5",
    background: "#f1ebff",
  },
  {
    label: "Trợ lý AI",
    description: "Trò chuyện & tư vấn",
    action: "ai_chat",
    icon: "sparkles",
    tint: "#ffffff",
    background: "#6d35f5", // Use purple background to make it stand out
  },
  {
    label: "Nhắc lịch",
    description: "Thông báo lịch đặt hẹn",
    action: "reminders",
    icon: "alarm-outline",
    tint: "#f59e0b",
    background: "#fff7df",
  },
  {
    label: "Lịch trình",
    description: "Quản lý chuyến đi",
    action: "itineraries",
    icon: "calendar-outline",
    tint: "#0f8f83",
    background: "#e4f7f4",
  },
  {
    label: "SOS",
    description: "Hỗ trợ khẩn cấp",
    action: "sos",
    icon: "alert-circle-outline",
    tint: "#ef4444",
    background: "#fff1f2",
  },
];

const categories = ["Tất cả", "Ẩm thực", "Lưu trú", "Du lịch"] as const;
export default function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const appBgRaw = useAppSettingsStore((state) => state.app_background_url);
  const appBg = resolveBackendUrl(appBgRaw) || "";
  const appPrimary = useAppSettingsStore((state) => state.app_primary_color) || travelColors.teal;
  const appSecondary = useAppSettingsStore((state) => state.app_secondary_color) || "#f0fdf4";
  const appTextColor = useAppSettingsStore((state) => state.app_text_color) || "#ffffff";
  const refreshLocationStatus = useLocationPermissionStore((state) => state.refreshStatus);
  const ensureLocationAccess = useLocationPermissionStore((state) => state.ensureAccess);
  const [searchText, setSearchText] = useState("");
  const [geoState, setGeoState] = useState<GeoState>({ status: "idle" });
  const [currentCoordinates, setCurrentCoordinates] =
    useState<Coordinates | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const {
    locations,
    loading,
    refreshing,
    category,
    setCategory,
    setKeyword,
    refetch,
  } = useLocations(currentCoordinates);

  useEffect(() => {
    const timer = setTimeout(() => {
      setKeyword(searchText);
    }, 250);

    return () => clearTimeout(timer);
  }, [searchText, setKeyword]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();

    if (hour < 12) return "Chào buổi sáng";
    if (hour < 18) return "Chào buổi chiều";
    return "Chào buổi tối";
  }, []);

  const dateLabel = useMemo(() => {
    return new Date().toLocaleDateString("vi-VN", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }, []);

  const firstName = useMemo(() => {
    const name = user?.full_name?.trim();
    if (!name) return "bạn";
    const parts = name.split(/\s+/);
    return parts[parts.length - 1] ?? "bạn";
  }, [user?.full_name]);

  const loadStats = useCallback(async () => {
    try {
      const [notificationsRes, remindersRes] = await Promise.allSettled([
        userApi.getNotifications(),
        userApi.getBookingReminders(),
      ]);

      let count = 0;
      if (notificationsRes.status === "fulfilled" && notificationsRes.value?.success) {
        const list = notificationsRes.value.data || [];
        count += list.filter((item: any) => Number(item.is_read) !== 1).length;
      }

      if (remindersRes.status === "fulfilled" && remindersRes.value?.success) {
        const list = remindersRes.value.data || [];
        const now = Date.now();
        const soonMs = 24 * 60 * 60 * 1000;
        const hasReminders = list.some((item: any) => {
          if (item.status === "cancelled" || item.status === "completed") {
            return false;
          }
          const t = new Date(`${item.check_in_date}T00:00:00`).getTime();
          if (!Number.isFinite(t)) return false;
          return t <= now + soonMs;
        });
        if (hasReminders) {
          count += 1;
        }
      }

      setUnreadCount(count);
    } catch {
      setUnreadCount(0);
    }
  }, []);

  // Ref to prevent concurrent geo fetches
  const geoRunningRef = useRef(false);

  const fetchGeo = useCallback(async () => {
    // Prevent double-call (AppState or concurrent triggers)
    if (geoRunningRef.current) return;
    geoRunningRef.current = true;
    setGeoState({ status: "loading" });

    try {
      // 1. Check if device location service is on
      const serviceOn = await Location.hasServicesEnabledAsync();
      if (!serviceOn) {
        setGeoState({ status: "error", message: "GPS/Dịch vụ vị trí đang tắt trên thiết bị." });
        return;
      }

      // 2. Try last-known position (instant, no GPS lock needed)
      const cached = await Location.getLastKnownPositionAsync({ maxAge: 30 * 60 * 1000 });

      let coords: { latitude: number; longitude: number } | null = cached
        ? { latitude: cached.coords.latitude, longitude: cached.coords.longitude }
        : null;

      // 3. If no cache, request fresh fix with 6s timeout using Low accuracy (WiFi/cell)
      if (!coords) {
        const fresh = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }),
          new Promise<null>((res) => setTimeout(() => res(null), 6000)),
        ]);
        if (fresh) {
          coords = { latitude: fresh.coords.latitude, longitude: fresh.coords.longitude };
        }
      }

      if (!coords) {
        setCurrentCoordinates(null);
        setGeoState({ status: "error", message: "Không lấy được vị trí. Thử lại hoặc di chuyển ra ngoài trời." });
        return;
      }

      // 4. Call backend geo API
      setCurrentCoordinates(coords);
      const geo = await geoApi.reverse(coords.latitude, coords.longitude);
      setGeoState({
        status: "ready",
        city: geo.city,
        temperature: geo.temperature,
        weather: geo.weather,
      });
    } catch {
      setGeoState({ status: "error", message: "Lỗi lấy thời tiết. Thử lại sau." });
    } finally {
      geoRunningRef.current = false;
    }
  }, []);

  useEffect(() => {
    void loadStats();

    const init = async () => {
      const ready = await ensureLocationAccess("ứng dụng");

      if (ready) {
        await fetchGeo();
        return;
      }

      setGeoState({ status: "idle" });
    };

    void init();
  }, [loadStats, ensureLocationAccess, fetchGeo]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      void loadStats();

      const syncGeoOnFocus = async () => {
        const ready = await ensureLocationAccess("ứng dụng");

        if (!active) {
          return;
        }

        if (ready) {
          await fetchGeo();
          return;
        }

        setGeoState({ status: "idle" });
      };

      void syncGeoOnFocus();

      return () => {
        active = false;
      };
    }, [ensureLocationAccess, fetchGeo, loadStats]),
  );

  const onRefresh = useCallback(async () => {
    const jobs = [refetch(true), loadStats()];
    const snapshot = await refreshLocationStatus();

    if (snapshot.granted && snapshot.servicesEnabled) {
      jobs.push(fetchGeo());
    }

    await Promise.all(jobs);
  }, [fetchGeo, loadStats, refreshLocationStatus, refetch]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        return;
      }

      void (async () => {
        const ready = await ensureLocationAccess("ứng dụng");

        if (ready) {
          await fetchGeo();
        } else {
          setGeoState({ status: "error", message: "Vui lòng cấp quyền và bật vị trí để sử dụng ứng dụng." });
        }
      })();
    });

    return () => subscription.remove();
  }, [fetchGeo, ensureLocationAccess]);

  const shellWidth = useMemo(() => Math.min(Math.max(width - 40, 0), 560), [width]);
  const gridGap = 12;
  const utilityWidth = useMemo(
    () => Math.max(Math.floor((shellWidth - gridGap * 3) / 4), 70),
    [gridGap, shellWidth],
  );
  const cardWidth = useMemo(
    () => Math.max(Math.floor((shellWidth - gridGap) / 2), 148),
    [gridGap, shellWidth],
  );

  const headerNode = useMemo(
    () => (
      <View className="pb-5">
        
        {/* Dynamic Header Background */}
        <View 
          style={{ 
            marginHorizontal: -20, 
            marginTop: -12, 
            paddingTop: 36, 
            paddingHorizontal: 20,
            paddingBottom: 64,
            backgroundColor: appPrimary
          }}
        >
          {appBg ? (
            <ImageBackground 
              source={{ uri: appBg }} 
              style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
              resizeMode="cover"
            />
          ) : null}
          
          {/* Lớp Overlay nếu dùng ảnh để chữ dễ đọc hơn */}
          {appBg && <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.15)' }} />}

          <View className="flex-row items-start justify-between relative z-10">
            <View className="gap-1 flex-1">
              <Text className="text-[28px] font-extrabold leading-[34px]" style={{ color: appTextColor }}>
                {greeting}, {firstName}
              </Text>
              <Text className="text-[14px]" style={{ color: appTextColor, opacity: 0.9 }}>{dateLabel}</Text>
            </View>

            {geoState.status === "ready" ? (
              <View className="flex-row items-center gap-2 ml-4">
                <Ionicons name="partly-sunny" size={24} color="#eab308" />
                <View>
                  <Text className="text-[14px] font-extrabold leading-[16px]" style={{ color: appTextColor }}>
                    {geoState.temperature != null ? `${Math.round(geoState.temperature)}\u00b0C` : "--"}
                  </Text>
                  <Text className="text-[10px]" style={{ color: appTextColor, opacity: 0.9 }}>
                    {geoState.city}
                  </Text>
                </View>
              </View>
            ) : geoState.status === "loading" ? (
              <View 
                className="rounded-2xl px-3 py-2 ml-4"
                style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)' }}
              >
                <Text className="text-[12px] font-semibold text-muted">Đang lấy...</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Khung trắng chồng lên Header */}
        <View 
          className="bg-white px-5 pt-6 pb-2" 
          style={{ 
            marginHorizontal: -20, 
            marginTop: -40, 
            borderTopLeftRadius: 32, 
            borderTopRightRadius: 32 
          }}
        >

          {/* Wrapper card for Tiện ích */}
          <View style={{ backgroundColor: appSecondary, borderRadius: 24, padding: 16, marginHorizontal: -4 }}>
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-[18px] font-extrabold text-ink">Tiện ích du lịch</Text>
              <View className="flex-row items-center gap-1">
                <Text className="text-[12px] font-bold text-muted">{quickActions.length} mục</Text>
                <Ionicons name="chevron-forward" size={12} color="#94a3b8" />
              </View>
            </View>
            <View className="flex-row flex-wrap justify-between gap-y-3">
              {quickActions.map((item) => (
            <Pressable
              key={item.label}
              hitSlop={{ top: 10, left: 10, right: 10, bottom: 10 }}
              accessibilityRole="button"
              onPress={() => {
                if (item.action === "wallet") {
                  router.push("/wallet");
                  return;
                }
                if (item.action === "vouchers") {
                  router.push("/profile/vouchers");
                  return;
                }
                if (item.action === "ai_chat") {
                  router.push("/ai/chat");
                  return;
                }
                if (item.action === "notifications") {
                  router.push("/profile/notifications");
                  return;
                }
                if (item.action === "diary") {
                  router.push("/profile/diary");
                  return;
                }
                if (item.action === "reminders") {
                  router.push("/profile/reminders");
                  return;
                }
                if (item.action === "sos") {
                  router.push("/profile/sos");
                  return;
                }
                if (item.action === "itineraries") {
                  router.push("/itineraries");
                  return;
                }
              }}
              className="relative min-h-[68px] items-center justify-start gap-1.5 px-1 py-1"
              style={{ width: utilityWidth }}
            >
              {item.action === "notifications" && unreadCount > 0 && (
                <View className="absolute right-3 top-0 z-10 h-5 min-w-[20px] items-center justify-center rounded-full border border-white bg-red-500 px-1.5">
                  <Text className="text-[10px] font-black text-white">{unreadCount}</Text>
                </View>
              )}
              <View className="items-center gap-1.5">
                {item.action === "ai_chat" ? (
                  <View 
                    style={{ 
                      height: 48, 
                      width: 48, 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      borderRadius: 24, 
                      backgroundColor: 'white',
                      elevation: 2, 
                      shadowColor: '#000', 
                      shadowOffset: { width: 0, height: 2 }, 
                      shadowOpacity: 0.1, 
                      shadowRadius: 3,
                      overflow: 'hidden'
                    }}
                  >
                    <Image 
                      source={require('../../../assets/ai-avatar.png')} 
                      style={{ width: '100%', height: '100%' }} 
                      resizeMode="cover" 
                    />
                  </View>
                ) : (
                  <View
                    className="h-[52px] w-[52px] items-center justify-center rounded-2xl"
                    style={{ 
                      backgroundColor: item.action === "sos" ? "#fee2e2" : "#ffffff",
                      borderWidth: 1,
                      borderColor: item.action === "sos" ? "#fecaca" : "rgba(0,0,0,0.03)"
                    }}
                  >
                    <Ionicons name={item.icon} size={26} color={item.action === "sos" ? "#ef4444" : appPrimary} />
                  </View>
                )}
                <Text className="text-center text-[12px] font-bold leading-[16px] text-slate-700" numberOfLines={2}>
                  {item.label}
                </Text>
              </View>
            </Pressable>
          ))}
              </View>
            </View>
          </View>

          <View className="gap-3 mt-8">
            <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1 gap-1">
            <Text className="text-[20px] font-extrabold text-ink">Khám phá gần bạn</Text>
            <Text className="text-[13px] leading-5 text-muted">
              Chọn nhóm phù hợp để xem đúng nơi ăn uống, lưu trú hoặc tham quan.
            </Text>
          </View>
          <Pressable
            onPress={() => setCategory("Tất cả")}
            className="pt-0.5"
            hitSlop={{ top: 8, left: 8, right: 8, bottom: 8 }}
            accessibilityRole="button"
          >
            <Text className="text-[13px] font-extrabold text-brand-600">Xem tất cả</Text>
          </Pressable>
        </View>



        <TextInput
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Tìm địa điểm, nhà hàng, khách sạn"
          placeholderTextColor="#94a3b8"
          className="min-h-[48px] rounded-xl border border-line bg-white px-4 text-[15px] text-ink"
        />

        <FlatList
          data={categories}
          horizontal
          bounces={false}
          overScrollMode="never"
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 10, paddingRight: 4 }}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <Pressable
              hitSlop={{ top: 8, left: 8, right: 8, bottom: 8 }}
              accessibilityRole="button"
              onPress={() => setCategory(item)}
              className={[
                "min-h-[36px] items-center justify-center rounded-full border px-4",
                category === item
                  ? "border-brand-600 bg-brand-600"
                  : "border-slate-300 bg-white",
              ].join(" ")}
            >
              <Text
                className={[
                  "font-bold",
                  category === item ? "text-white" : "text-slate-700",
                ].join(" ")}
              >
                {item}
              </Text>
            </Pressable>
          )}
        />
      </View>
    </View>
    ),
    [
      category,
      dateLabel,
      firstName,
      geoState,
      greeting,
      router,
      searchText,
      setCategory,
      unreadCount,
      utilityWidth,
      appBg,
      appPrimary,
      appSecondary,
    ],
  );

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: 12,
          paddingHorizontal: 20,
          paddingBottom: Math.max(insets.bottom, 24),
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />
        }
      >
        {headerNode}

        {loading ? (
          <Text className="py-6 text-center leading-[22px] text-slate-500">
            Đang tải danh sách địa điểm...
          </Text>
        ) : locations.length === 0 ? (
          <Text className="py-6 text-center leading-[22px] text-slate-500">
            Chưa có địa điểm phù hợp. Hãy thử lại với nhóm khác hoặc bỏ từ khóa tìm kiếm.
          </Text>
        ) : (
          <FlatList
            data={locations}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => String(item.location_id)}
            contentContainerStyle={{ gap: 14, paddingRight: 8, paddingVertical: 4 }}
            renderItem={({ item }) => <LocationCard item={item} width={180} />}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function LocationCard({
  item,
  width,
}: {
  item: LocationItem;
  width: number;
}) {
  const router = useRouter();
  const imageUrl = resolveBackendUrl(item.first_image || item.images?.[0] || null);
  const rating = Number(item.rating || 0);
  const reviewCount = Number(item.total_reviews || 0);
  const typeLabel = getTypeLabel(item.location_type);

  return (
    <Pressable
      className="overflow-hidden rounded-xl border border-line bg-white"
      style={{ width, ...travelShadow }}
      hitSlop={{ top: 6, left: 6, right: 6, bottom: 6 }}
      accessibilityRole="button"
      onPress={() => router.push(`/location/${item.location_id}`)}
    >
      <View
        className="w-full bg-slate-200"
        style={{ height: Math.min(112, Math.round(width * 0.68)) }}
      >
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} className="h-full w-full" resizeMode="cover" />
        ) : (
          <View className="flex-1 items-center justify-center bg-slate-200">
            <Ionicons name="image-outline" size={24} color="#98a2b3" />
          </View>
        )}
        
        <View className="absolute left-2 right-2 top-2 flex-row items-center justify-between gap-2">
          <View className="rounded-full bg-white/95 px-2 py-1">
            <Text className="text-[10px] font-bold text-brand-700">{typeLabel}</Text>
          </View>
          {typeof item.distance_km === "number" ? (
            <View className="rounded-full bg-black/60 px-2 py-1">
              <Text className="text-[10px] font-bold text-white">
                {formatDistanceKm(item.distance_km)}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <View className="gap-1.5 p-2.5">
        <Text className="text-[14px] font-extrabold text-ink" numberOfLines={1}>
          {item.location_name}
        </Text>
        <Text className="text-[12px] text-muted">
          {rating > 0 ? rating.toFixed(1) : "0"} điểm | {reviewCount} đánh giá
        </Text>
        <Text className="text-[12px] leading-[17px] text-slate-600" numberOfLines={2}>
          {shortAddress(item.address)}
        </Text>
      </View>
    </Pressable>
  );
}

function shortAddress(address: string) {
  const parts = address.split(",").map((item) => item.trim());

  if (parts.length <= 2) {
    return address;
  }

  return `${parts[0]}, ${parts[1]}`;
}

function getTypeLabel(value: string) {
  const normalized = String(value || "").toLowerCase();

  if (normalized === "restaurant") return "Nhà hàng";
  if (normalized === "cafe") return "Quán cafe";
  if (normalized === "hotel") return "Khách sạn";
  if (normalized === "resort") return "Resort";
  if (normalized === "tourist") return "Du lịch";
  return "Địa điểm";
}
