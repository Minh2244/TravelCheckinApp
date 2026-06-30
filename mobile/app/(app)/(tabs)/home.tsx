import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import * as Location from "expo-location";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
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
import { geoApi } from "../../../src/services/geo.api";
import { userApi } from "../../../src/services/user.api";
import type { LocationItem } from "../../../src/types/location";

type GeoState =
  | { status: "idle" | "loading" }
  | { status: "ready"; city: string; temperature?: number; weather?: string }
  | { status: "error"; message: string };

type StatsState = {
  checkins: number;
  favorites: number;
  vouchers: number;
};

const quickActions: Array<{
  label: string;
  description: string;
  action: "food" | "tickets" | "saved" | "itinerary";
  icon: "restaurant-outline" | "ticket-outline" | "bookmark-outline" | "calendar-outline";
  iconBackground: string;
  cardBackground: string;
}> = [
  {
    label: "Ăn uống",
    description: "Xem nhà hàng và quán cafe",
    action: "food",
    icon: "restaurant-outline",
    iconBackground: "#f97316",
    cardBackground: "#fff7ed",
  },
  {
    label: "Giỏ vé",
    description: "Quản lý vé du lịch của bạn",
    action: "tickets",
    icon: "ticket-outline",
    iconBackground: "#0ea5e9",
    cardBackground: "#f0f9ff",
  },
  {
    label: "Đã lưu",
    description: "Mở lại địa điểm bạn đã thích",
    action: "saved",
    icon: "bookmark-outline",
    iconBackground: "#7c3aed",
    cardBackground: "#f5f3ff",
  },
  {
    label: "Lịch trình",
    description: "Quản lý kế hoạch chuyến đi",
    action: "itinerary",
    icon: "calendar-outline",
    iconBackground: "#2563eb",
    cardBackground: "#eff6ff",
  },
];

const categories = ["Tất cả", "Ẩm thực", "Lưu trú", "Du lịch"] as const;
const statItems: Array<{
  key: "checkins" | "favorites" | "vouchers";
  label: string;
  icon: "location-outline" | "bookmark-outline" | "ticket-outline";
  tint: string;
}> = [
  {
    key: "checkins",
    label: "Check-in",
    icon: "location-outline",
    tint: "#0f766e",
  },
  {
    key: "favorites",
    label: "Đã lưu",
    icon: "bookmark-outline",
    tint: "#7c3aed",
  },
  {
    key: "vouchers",
    label: "Voucher",
    icon: "ticket-outline",
    tint: "#2563eb",
  },
];

export default function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const refreshLocationStatus = useLocationPermissionStore((state) => state.refreshStatus);
  const ensureLocationAccess = useLocationPermissionStore((state) => state.ensureAccess);
  const [searchText, setSearchText] = useState("");
  const [geoState, setGeoState] = useState<GeoState>({ status: "idle" });
  const [stats, setStats] = useState<StatsState>({
    checkins: 0,
    favorites: 0,
    vouchers: 0,
  });
  const [statsLoading, setStatsLoading] = useState(false);

  const {
    locations,
    loading,
    refreshing,
    category,
    setCategory,
    setKeyword,
    refetch,
  } = useLocations();

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
      setStatsLoading(true);
      const [checkins, favorites, vouchers] = await Promise.allSettled([
        userApi.getCheckins(),
        userApi.getFavorites(),
        userApi.getMySavedVouchers(),
      ]);

      setStats({
        checkins:
          checkins.status === "fulfilled" ? (checkins.value.data?.length ?? 0) : 0,
        favorites:
          favorites.status === "fulfilled" ? (favorites.value.data?.length ?? 0) : 0,
        vouchers:
          vouchers.status === "fulfilled" ? (vouchers.value.data?.length ?? 0) : 0,
      });
    } finally {
      setStatsLoading(false);
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
        setGeoState({ status: "error", message: "Không lấy được vị trí. Thử lại hoặc di chuyển ra ngoài trời." });
        return;
      }

      // 4. Call backend geo API
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
    }, [ensureLocationAccess, fetchGeo]),
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
  const cardWidth = useMemo(
    () => Math.max(Math.floor((shellWidth - gridGap) / 2), 148),
    [gridGap, shellWidth],
  );

  const headerNode = useMemo(
    () => (
      <View className="gap-6 pb-5 pt-2.5">
      <View className="gap-2">
        <Text className="text-[28px] font-extrabold leading-[34px] text-slate-900">
          {greeting}, {firstName}
        </Text>
        <Text className="text-base text-slate-500">{dateLabel}</Text>

        {geoState.status === "ready" ? (
          <View className="rounded-xl border border-cyan-200 bg-cyan-50 px-3.5 py-3">
            <Text className="text-[17px] font-bold leading-5 text-brand-800">
              {geoState.temperature != null ? `${Math.round(geoState.temperature)}\u00b0C` : "--"} |{" "}
              {geoState.city} | {geoState.weather ?? "Th\u1eddi ti\u1ebft \u0111ang c\u1eadp nh\u1eadt"}
            </Text>
          </View>
        ) : geoState.status === "loading" ? (
          <View className="rounded-xl border border-cyan-100 bg-cyan-50 px-3.5 py-3">
            <Text className="text-[15px] text-slate-400">Đang lấy vị trí và thời tiết...</Text>
          </View>
        ) : null}
      </View>

      <View className="gap-3.5">
        <Text className="text-[18px] font-extrabold text-slate-900">Truy cập nhanh</Text>
        <View className="flex-row flex-wrap justify-between gap-y-3">
          {quickActions.map((item) => (
            <Pressable
              key={item.label}
              hitSlop={{ top: 10, left: 10, right: 10, bottom: 10 }}
              accessibilityRole="button"
              onPress={() => {
                if (item.action === "food") {
                  setCategory("Ẩm thực");
                  return;
                }

                if (item.action === "tickets") {
                  router.push("/wallet?tab=tour");
                  return;
                }

                if (item.action === "saved") {
                  router.push("/saved");
                  return;
                }

                router.push("/itineraries");
              }}
              className="min-h-[112px] justify-between rounded-2xl border border-line p-4"
              style={{ width: cardWidth, backgroundColor: item.cardBackground }}
            >
              <View className="gap-2.5">
                <View
                  className="h-10 w-10 items-center justify-center rounded-xl"
                  style={{ backgroundColor: item.iconBackground }}
                >
                  <Ionicons name={item.icon} size={18} color="#ffffff" />
                </View>
                <Text className="text-[16px] font-extrabold text-slate-900">{item.label}</Text>
              </View>
              <Text className="text-[13px] leading-[18px] text-slate-600">{item.description}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View className="gap-3.5">
        <Text className="text-[18px] font-extrabold text-slate-900">Hoạt động của bạn</Text>
        <View
          className="flex-row rounded-2xl border border-line bg-white px-1 py-1.5"
          style={{
            shadowColor: "#0f172a",
            shadowOpacity: 0.06,
            shadowRadius: 14,
            shadowOffset: {
              width: 0,
              height: 8,
            },
            elevation: 3,
          }}
        >
          {statItems.map((item, index) => (
            <StatTile
              key={item.key}
              label={item.label}
              value={stats[item.key]}
              loading={statsLoading}
              icon={item.icon}
              tint={item.tint}
              bordered={index < statItems.length - 1}
            />
          ))}
        </View>
      </View>

      <View className="gap-3.5">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1 gap-1">
            <Text className="text-[18px] font-extrabold text-slate-900">Đề xuất cho bạn</Text>
            <Text className="leading-5 text-slate-500">
              Chọn nhóm phù hợp để xem đúng nơi ăn uống, lưu trú hoặc tham quan.
            </Text>
          </View>
          <Pressable
            onPress={() => setCategory("Tất cả")}
            className="pt-0.5"
            hitSlop={{ top: 8, left: 8, right: 8, bottom: 8 }}
            accessibilityRole="button"
          >
            <Text className="font-extrabold text-brand-600">Xem tất cả</Text>
          </Pressable>
        </View>



        <TextInput
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Tìm địa điểm, nhà hàng, khách sạn"
          placeholderTextColor="#94a3b8"
          className="min-h-[52px] rounded-xl border border-slate-300 bg-white px-4 text-slate-900"
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
                "min-h-[38px] items-center justify-center rounded-full border px-4",
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
      cardWidth,
      category,
      dateLabel,
      firstName,
      geoState,
      greeting,
      router,
      searchText,
      setCategory,
      stats,
      statsLoading,
    ],
  );

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={["top", "left", "right"]}>
      <FlatList
        data={locations}
        numColumns={2}
        style={{ flex: 1 }}
        keyExtractor={(item) => String(item.location_id)}
        columnWrapperStyle={{ justifyContent: "space-between", marginBottom: 12 }}
        contentContainerStyle={{
          paddingTop: 12,
          paddingHorizontal: 20,
          paddingBottom: Math.max(insets.bottom, 12),
        }}
        overScrollMode="never"
        bounces={false}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={headerNode}
        ListEmptyComponent={
          loading ? (
            <Text className="py-6 text-center leading-[22px] text-slate-500">
              Đang tải danh sách địa điểm
            </Text>
          ) : (
            <Text className="py-6 text-center leading-[22px] text-slate-500">
              Chưa có địa điểm phù hợp. Hãy thử lại với nhóm khác hoặc bỏ từ khóa tìm kiếm.
            </Text>
          )
        }
        renderItem={({ item }) => <LocationCard item={item} width={cardWidth} />}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />
        }
      />
    </SafeAreaView>
  );
}

function StatTile({
  label,
  value,
  loading,
  icon,
  tint,
  bordered,
}: {
  label: string;
  value: number;
  loading: boolean;
  icon: "location-outline" | "bookmark-outline" | "ticket-outline";
  tint: string;
  bordered: boolean;
}) {
  return (
    <View
      className="flex-1 items-center gap-2 px-2 py-4"
      style={bordered ? { borderRightWidth: 1, borderRightColor: "#e2e8f0" } : undefined}
    >
      <View className="h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: `${tint}18` }}>
        <Ionicons name={icon} size={18} color={tint} />
      </View>
      <Text className="text-2xl font-extrabold" style={{ color: tint }}>
        {loading ? "..." : String(value)}
      </Text>
      <Text className="text-[13px] font-bold text-slate-500">{label}</Text>
    </View>
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
      className="overflow-hidden rounded-2xl border border-line bg-white"
      style={{ width }}
      hitSlop={{ top: 6, left: 6, right: 6, bottom: 6 }}
      accessibilityRole="button"
      onPress={() => router.push(`/location/${item.location_id}`)}
    >
      <View
        className="w-full bg-slate-200"
        style={{ height: Math.min(120, Math.round(width * 0.72)) }}
      >
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} className="h-full w-full" resizeMode="cover" />
        ) : (
          <View className="flex-1 items-center justify-center bg-slate-200">
            <Text className="font-bold text-slate-500">Chưa có ảnh</Text>
          </View>
        )}
      </View>

      <View className="gap-1.5 p-3">
        <Text className="text-[11px] font-bold text-brand-600">{typeLabel}</Text>
        <Text className="text-sm font-extrabold text-slate-900" numberOfLines={1}>
          {item.location_name}
        </Text>
        <Text className="text-xs text-slate-500">
          {rating > 0 ? rating.toFixed(1) : "0"} điểm | {reviewCount} đánh giá
        </Text>
        <Text className="text-xs leading-[18px] text-slate-600" numberOfLines={2}>
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
