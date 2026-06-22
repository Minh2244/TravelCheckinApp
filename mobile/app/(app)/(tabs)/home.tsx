import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AppState,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
  ScrollView,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { resolveBackendUrl } from "../../../src/lib/url";
import { useAuthStore } from "../../../src/modules/auth/store";
import { useLocations } from "../../../src/modules/locations/use-locations";
import { geoApi } from "../../../src/services/geo.api";
import { userApi } from "../../../src/services/user.api";
import type { LocationItem } from "../../../src/types/location";

const { width } = Dimensions.get("window");

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
  action: "food" | "stay" | "saved" | "itinerary";
  icon: "restaurant" | "bed" | "bookmark" | "calendar";
  color: string;
  bgColor: string;
}> = [
  {
    label: "Ăn uống",
    action: "food",
    icon: "restaurant",
    color: "#f59e0b",
    bgColor: "#fef3c7",
  },
  {
    label: "Lưu trú",
    action: "stay",
    icon: "bed",
    color: "#3b82f6",
    bgColor: "#dbeafe",
  },
  {
    label: "Đã lưu",
    action: "saved",
    icon: "bookmark",
    color: "#ec4899",
    bgColor: "#fce7f3",
  },
  {
    label: "Lịch trình",
    action: "itinerary",
    icon: "calendar",
    color: "#8b5cf6",
    bgColor: "#ede9fe",
  },
];

const categories = ["Tất cả", "Ẩm thực", "Lưu trú", "Du lịch"] as const;

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const [searchText, setSearchText] = useState("");
  const [gpsGranted, setGpsGranted] = useState<boolean | null>(null);
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

  const loadGeoData = useCallback(async () => {
    try {
      setGeoState({ status: "loading" });
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const geo = await geoApi.reverse(
        position.coords.latitude,
        position.coords.longitude,
      );
      setGeoState({
        status: "ready",
        city: geo.city,
        temperature: geo.temperature,
        weather: geo.weather,
      });
    } catch {
      setGeoState({
        status: "error",
        message: "Không thể lấy thời tiết.",
      });
    }
  }, []);

  const ensureGpsStatus = useCallback(async () => {
    try {
      const current = await Location.getForegroundPermissionsAsync();

      if (current.status === "granted") {
        setGpsGranted(true);
        await loadGeoData();
        return;
      }

      const requested = await Location.requestForegroundPermissionsAsync();
      const granted = requested.status === "granted";
      setGpsGranted(granted);

      if (granted) {
        await loadGeoData();
      } else {
        setGeoState({
          status: "error",
          message: "Bạn chưa cấp quyền vị trí.",
        });
      }
    } catch {
      setGpsGranted(false);
      setGeoState({
        status: "error",
        message: "Lỗi kiểm tra vị trí.",
      });
    }
  }, [loadGeoData]);

  useEffect(() => {
    void ensureGpsStatus();
    void loadStats();

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void ensureGpsStatus();
      }
    });

    return () => subscription.remove();
  }, [ensureGpsStatus, loadStats]);

  const onRefresh = useCallback(async () => {
    await Promise.all([refetch(true), loadStats(), ensureGpsStatus()]);
  }, [ensureGpsStatus, loadStats, refetch]);

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {/* Lời chào & Thời tiết */}
      <View style={styles.heroSection}>
        <View>
          <Text style={styles.greeting}>
            {greeting},{"\n"}
            <Text style={styles.firstName}>{firstName}!</Text>
          </Text>
          <Text style={styles.dateText}>{dateLabel}</Text>
        </View>

        {geoState.status === "ready" ? (
          <View style={styles.weatherBadge}>
            <Ionicons name="partly-sunny" size={20} color="#0d9488" />
            <Text style={styles.weatherBadgeText}>
              {geoState.temperature != null ? `${Math.round(geoState.temperature)}°C` : "--"} • {geoState.city}
            </Text>
          </View>
        ) : geoState.status === "loading" ? (
          <View style={styles.weatherBadge}>
            <Text style={styles.weatherBadgeText}>Đang lấy thời tiết...</Text>
          </View>
        ) : null}
      </View>

      {/* Truy cập nhanh */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Khám phá</Text>
        <View style={styles.quickActionGrid}>
          {quickActions.map((item) => (
            <Pressable
              key={item.label}
              onPress={() => {
                if (item.action === "food") setCategory("Ẩm thực");
                else if (item.action === "stay") setCategory("Lưu trú");
                else if (item.action === "saved") router.push("/saved");
                else router.push("/itineraries");
              }}
              style={styles.quickActionItem}
            >
              <View style={[styles.quickActionIconWrap, { backgroundColor: item.bgColor }]}>
                <Ionicons name={item.icon} size={24} color={item.color} />
              </View>
              <Text style={styles.quickActionLabel}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Thống kê cá nhân */}
      <View style={[styles.section, styles.statsContainer]}>
        <Text style={styles.sectionTitle}>Hoạt động của bạn</Text>
        <View style={styles.statsRow}>
          <StatTile icon="location" label="Check-in" value={stats.checkins} loading={statsLoading} color="#14b8a6" />
          <View style={styles.statDivider} />
          <StatTile icon="heart" label="Đã lưu" value={stats.favorites} loading={statsLoading} color="#f43f5e" />
          <View style={styles.statDivider} />
          <StatTile icon="ticket" label="Voucher" value={stats.vouchers} loading={statsLoading} color="#f59e0b" />
        </View>
      </View>

      {/* GPS Banner */}
      {gpsGranted === false && (
        <View style={styles.gpsBanner}>
          <Ionicons name="warning" size={24} color="#b45309" />
          <View style={{ flex: 1 }}>
            <Text style={styles.gpsBannerTitle}>Vị trí đang tắt</Text>
            <Text style={styles.gpsBannerText}>Bật GPS để tìm đường và dùng check-in thông minh.</Text>
          </View>
        </View>
      )}

      {/* Bộ lọc Đề xuất */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Gợi ý hôm nay</Text>
          <Pressable onPress={() => setCategory("Tất cả")}>
            <Text style={styles.textLink}>Xem tất cả</Text>
          </Pressable>
        </View>

        <TextInput
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Tìm địa điểm, nhà hàng, khách sạn..."
          placeholderTextColor="#94a3b8"
          style={styles.searchInput}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
          {categories.map((cat) => (
            <Pressable
              key={cat}
              onPress={() => setCategory(cat)}
              style={[styles.categoryChip, category === cat && styles.categoryChipActive]}
            >
              <Text style={[styles.categoryText, category === cat && styles.categoryTextActive]}>
                {cat}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <FlatList
        data={locations}
        numColumns={2}
        keyExtractor={(item) => String(item.location_id)}
        columnWrapperStyle={styles.columnWrap}
        contentContainerStyle={[styles.listContent, { paddingBottom: Math.max(insets.bottom, 24) + 64 }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Đang tải danh sách địa điểm...</Text>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Chưa có địa điểm nào phù hợp.</Text>
            </View>
          )
        }
        renderItem={({ item }) => <LocationCard item={item} />}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor="#0d9488" />
        }
      />
    </View>
  );
}

function StatTile({ icon, label, value, loading, color }: { icon: any; label: string; value: number; loading: boolean; color: string }) {
  return (
    <View style={styles.statTile}>
      <View style={[styles.statIconBox, { backgroundColor: color + "1a" }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={[styles.statValue, { color }]}>{loading ? "-" : value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function LocationCard({ item }: { item: LocationItem }) {
  const imageUrl = resolveBackendUrl(item.first_image || item.images?.[0] || null);
  const rating = Number(item.rating || 0);
  const typeLabel = getTypeLabel(item.location_type);
  const cardWidth = (width - 48) / 2; // 2 columns with paddings

  return (
    <Pressable style={[styles.locationCard, { width: cardWidth }]}>
      <View style={styles.locationImageWrap}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.locationImage} resizeMode="cover" />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="image-outline" size={32} color="#cbd5e1" />
          </View>
        )}
        <View style={styles.locationTypeBadge}>
          <Text style={styles.locationTypeBadgeText}>{typeLabel}</Text>
        </View>
      </View>

      <View style={styles.locationBody}>
        <Text style={styles.locationName} numberOfLines={1}>
          {item.location_name}
        </Text>
        <Text style={styles.locationAddress} numberOfLines={1}>
          <Ionicons name="location-outline" size={12} color="#64748b" /> {shortAddress(item.address)}
        </Text>
        
        <View style={styles.locationFooter}>
          <View style={styles.ratingBox}>
            <Ionicons name="star" size={12} color="#fbbf24" />
            <Text style={styles.ratingText}>{rating > 0 ? rating.toFixed(1) : "Chưa có"}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function shortAddress(address: string) {
  const parts = address.split(",").map((item) => item.trim());
  if (parts.length <= 2) return address;
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc", // Nền xám nhạt cao cấp
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  headerContainer: {
    gap: 28,
    paddingBottom: 24,
  },
  heroSection: {
    gap: 16,
  },
  greeting: {
    fontSize: 24,
    color: "#334155",
    lineHeight: 32,
  },
  firstName: {
    fontSize: 32,
    fontWeight: "900",
    color: "#0f172a",
  },
  dateText: {
    color: "#64748b",
    fontSize: 14,
    marginTop: 4,
  },
  weatherBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ccfbf1",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    alignSelf: "flex-start",
    gap: 8,
  },
  weatherBadgeText: {
    color: "#0f766e",
    fontWeight: "700",
    fontSize: 14,
  },
  section: {
    gap: 14,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  textLink: {
    color: "#0d9488",
    fontWeight: "700",
    fontSize: 14,
  },
  quickActionGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  quickActionItem: {
    alignItems: "center",
    gap: 8,
    width: "22%",
  },
  quickActionIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  quickActionLabel: {
    color: "#334155",
    fontWeight: "600",
    fontSize: 12,
  },
  statsContainer: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 20,
    shadowColor: "#cbd5e1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 3,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  statTile: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
  statIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  statValue: {
    fontWeight: "800",
    fontSize: 20,
  },
  statLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "600",
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: "#e2e8f0",
  },
  gpsBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef3c7",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#fde68a",
    gap: 12,
  },
  gpsBannerTitle: {
    color: "#92400e",
    fontWeight: "800",
    fontSize: 14,
    marginBottom: 2,
  },
  gpsBannerText: {
    color: "#b45309",
    fontSize: 13,
    lineHeight: 18,
  },
  searchInput: {
    height: 52,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    paddingHorizontal: 16,
    fontSize: 15,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#e2e8f0",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 1,
  },
  categoryScroll: {
    gap: 10,
    paddingVertical: 4,
  },
  categoryChip: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  categoryChipActive: {
    backgroundColor: "#0d9488",
    borderColor: "#0d9488",
  },
  categoryText: {
    color: "#475569",
    fontWeight: "600",
    fontSize: 14,
  },
  categoryTextActive: {
    color: "#ffffff",
  },
  columnWrap: {
    justifyContent: "space-between",
    marginBottom: 16,
  },
  locationCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#cbd5e1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  locationImageWrap: {
    width: "100%",
    height: 120,
    backgroundColor: "#f1f5f9",
    position: "relative",
  },
  locationImage: {
    width: "100%",
    height: "100%",
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  locationTypeBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  locationTypeBadgeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "700",
  },
  locationBody: {
    padding: 12,
    gap: 4,
  },
  locationName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a",
  },
  locationAddress: {
    fontSize: 12,
    color: "#64748b",
  },
  locationFooter: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  ratingBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyText: {
    color: "#64748b",
    fontSize: 15,
  },
});

