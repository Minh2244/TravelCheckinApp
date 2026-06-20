import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, FlatList,
  TouchableOpacity, Linking, AppState,
  StyleSheet, ActivityIndicator
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useLocations } from "../../hooks/useLocations";
import geoApi from "../../api/geoApi";
import userApi from "../../api/userApi";
import useAuthStore from "../../store/authStore";

const TEAL = "#0d9488";
const TEAL_LIGHT = "#f0fdfa";
const TEAL_BORDER = "#99f6e4";

const QUICK_ACCESS = [
  { icon: "🗺️", label: "Bản đồ", route: "/(tabs)/explore" },
  { icon: "🔖", label: "Đã lưu", route: "/(tabs)/profile" },
  { icon: "📅", label: "Lịch trình", route: "/(tabs)/booking" },
];

const CATEGORIES = ["Tất cả", "Ăn uống", "Lưu trú", "Du lịch"];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuthStore();

  const [hasGPS, setHasGPS] = useState<boolean | null>(null);
  const [geoData, setGeoData] = useState<{ city?: string; temperature?: number; weather?: string } | null>(null);
  const [stats, setStats] = useState({ checkins: 0, saved: 0, vouchers: 0 });

  const { locations, loading, category, setCategory } = useLocations();

  useEffect(() => {
    checkGPS();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") checkGPS();
    });
    return () => sub.remove();
  }, []);

  const checkGPS = async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === "granted") {
        setHasGPS(true);
        loadGeoData();
      } else {
        const { status: newStatus } = await Location.requestForegroundPermissionsAsync();
        const granted = newStatus === "granted";
        setHasGPS(granted);
        if (granted) loadGeoData();
      }
    } catch { }
  };

  const loadGeoData = async () => {
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const result = await geoApi.reverse(pos.coords.latitude, pos.coords.longitude);
      setGeoData(result);
    } catch (e) {
      console.log("Lỗi lấy thời tiết:", e);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const [checkins, favorites, vouchers] = await Promise.all([
          userApi.getCheckins().catch(() => null),
          userApi.getFavorites().catch(() => null),
          userApi.getMySavedVouchers().catch(() => null),
        ]);
        setStats({
          checkins: checkins?.data?.length || 0,
          saved: favorites?.data?.length || 0,
          vouchers: vouchers?.data?.length || 0,
        });
      } catch { }
    })();
  }, []);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Chào buổi sáng";
    if (h < 18) return "Chào buổi chiều";
    return "Chào buổi tối";
  })();

  const dateStr = new Date().toLocaleDateString("vi-VN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const firstName = user?.full_name?.trim().split(" ").pop() || "bạn";

  const ListHeader = (
    <View>
      {/* GPS Banner */}
      {hasGPS === false && (
        <View style={styles.gpsBanner}>
          <Text style={styles.gpsBannerText}>📍 Bật GPS để xem thời tiết</Text>
          <TouchableOpacity style={styles.gpsBannerBtn} onPress={() => Linking.openSettings()}>
            <Text style={styles.gpsBannerBtnText}>Bật GPS</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Lời chào */}
      <View style={styles.greetingSection}>
        <Text style={styles.greetingName}>{greeting}, {firstName}</Text>
        <Text style={styles.greetingDate}>{dateStr}</Text>
        {geoData && (
          <View style={styles.weatherBadge}>
            <Text style={styles.weatherText}>
              ⛅  {geoData.temperature?.toFixed(0)}°C · {geoData.city} · {geoData.weather}
            </Text>
          </View>
        )}
      </View>

      {/* Truy cập nhanh */}
      <View style={styles.suggestHeader}>
        <Text style={styles.sectionTitle}>Truy cập nhanh</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickAccessContainer}>
        {QUICK_ACCESS.map((item) => (
          <TouchableOpacity
            key={item.label}
            style={styles.quickAccessItem}
            onPress={() => router.push(item.route as any)}
          >
            <View style={styles.quickAccessIconBox}>
              <Text style={styles.quickAccessIcon}>{item.icon}</Text>
            </View>
            <Text style={styles.quickAccessLabel}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Hoạt động */}
      <View style={styles.activityCard}>
        <Text style={styles.sectionTitle}>Hoạt động của bạn</Text>
        <View style={styles.activityRow}>
          {[
            { count: stats.checkins, label: "Check-in", icon: "📷" },
            { count: stats.saved, label: "Đã lưu", icon: "🔖" },
            { count: stats.vouchers, label: "Voucher", icon: "🎫" },
          ].map((s) => (
            <View key={s.label} style={styles.activityItem}>
              <Text style={styles.activityIcon}>{s.icon}</Text>
              <Text style={styles.activityCount}>{s.count}</Text>
              <Text style={styles.activityLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Đề xuất header */}
      <View style={styles.suggestHeader}>
        <Text style={styles.sectionTitle}>Đề xuất cho bạn</Text>
        <TouchableOpacity>
          <Text style={styles.seeAll}>Xem tất cả</Text>
        </TouchableOpacity>
      </View>

      {/* Bộ lọc danh mục */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryList}>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[styles.categoryChip, category === cat && styles.categoryChipActive]}
            onPress={() => setCategory(cat)}
          >
            <Text style={[styles.categoryChipText, category === cat && styles.categoryChipTextActive]}>
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading && (
        <ActivityIndicator color={TEAL} style={{ marginVertical: 24 }} />
      )}
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <FlatList
        data={locations}
        numColumns={2}
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: insets.bottom + 90 }}
        ListHeaderComponent={ListHeader}
        renderItem={({ item }) => (
          <View style={styles.locationCard}>
            <Image
              source={{
                uri: item.first_image || item.images?.[0],
                headers: { 'ngrok-skip-browser-warning': 'true' }
              }}
              style={styles.locationImage}
              contentFit="cover"
            />
            <View style={styles.locationInfo}>
              <Text style={styles.locationName} numberOfLines={1}>{item.location_name}</Text>
              <Text style={styles.locationRating}>
                ⭐ {Number(item.rating || 0).toFixed(1)}{' '}
                <Text style={styles.locationRatingCount}>({item.total_reviews || 0})</Text>
              </Text>
              <Text style={styles.locationAddress} numberOfLines={2}>📍 {item.address}</Text>
            </View>
          </View>
        )}
        keyExtractor={(item) => item.location_id.toString()}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>Không có địa điểm nào</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F7FB", // Soft cool gray background
  },

  // Greeting
  greetingSection: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    backgroundColor: "#ffffff",
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
    marginBottom: 24,
  },
  greetingName: {
    fontSize: 26,
    fontWeight: "800",
    color: "#1e293b",
    letterSpacing: -0.5,
  },
  greetingDate: {
    fontSize: 14,
    color: "#64748b",
    marginTop: 4,
    fontWeight: "500",
  },
  weatherBadge: {
    backgroundColor: "#f0fdfa",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  weatherText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0d9488",
    marginLeft: 6,
  },

  // Quick Access
  quickAccessContainer: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  quickAccessItem: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginRight: 12,
    width: 100,
    shadowColor: "#0d9488",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  quickAccessIconBox: {
    backgroundColor: "#f0fdfa",
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  quickAccessIcon: {
    fontSize: 24,
  },
  quickAccessLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
  },

  // Activity
  activityCard: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 32,
    shadowColor: "#0d9488",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  activityRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },
  activityItem: {
    alignItems: "center",
    flex: 1,
  },
  activityIcon: {
    fontSize: 22,
    marginBottom: 8,
  },
  activityCount: {
    fontSize: 26,
    fontWeight: "900",
    color: "#0d9488",
  },
  activityLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748b",
    marginTop: 4,
  },

  // Section
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.3,
  },
  suggestHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  seeAll: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0d9488",
  },

  // Category chips
  categoryList: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  categoryChip: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: "#ffffff",
    marginRight: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  categoryChipActive: {
    backgroundColor: "#0d9488",
    borderColor: "#0d9488",
    shadowColor: "#0d9488",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  categoryChipText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#64748b",
  },
  categoryChipTextActive: {
    color: "#ffffff",
  },

  // Location card
  locationCard: {
    flex: 1,
    margin: 8,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    maxWidth: '46%',
  },
  locationImage: {
    height: 130,
    width: "100%",
    backgroundColor: "#f1f5f9",
  },
  locationInfo: {
    padding: 12,
  },
  locationName: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1e293b",
    marginBottom: 6,
    lineHeight: 20,
  },
  locationRating: {
    fontSize: 12,
    fontWeight: "600",
    color: "#f59e0b",
    marginBottom: 4,
  },
  locationRatingCount: {
    color: "#94a3b8",
    fontWeight: "500",
  },
  locationAddress: {
    fontSize: 11,
    color: "#64748b",
    lineHeight: 16,
  },

  // GPS Banner
  gpsBanner: {
    backgroundColor: "#fffbeb",
    borderColor: "#fcd34d",
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginBottom: 16,
  },
  gpsBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: "#92400e",
  },
  gpsBannerBtn: {
    backgroundColor: "#f59e0b",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  gpsBannerBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },

  // Empty
  emptyBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyText: {
    color: "#94a3b8",
    fontSize: 15,
    fontWeight: "500",
  },
});
