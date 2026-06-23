import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { resolveBackendUrl } from "../../../src/lib/url";
import { locationApi } from "../../../src/services/location.api";
import { userApi } from "../../../src/services/user.api";
import { useAuthStore } from "../../../src/modules/auth/store";
import type { LocationItem } from "../../../src/types/location";
import { showToast } from "../../../src/modules/ui/toast-store";
import { LocationReviews } from "../../../src/components/location/LocationReviews";

export default function LocationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);

  const [location, setLocation] = useState<LocationItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "reviews" | "about">("overview");

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const res = await locationApi.getLocationById(id);
        setLocation(res.data);

        // Check if favorite (in real app, we might get this from backend or from user state)
        if (user) {
          const favs = await userApi.getFavorites();
          if (favs.data?.some((fav) => String(fav.location_id) === id)) {
            setIsFavorite(true);
          }
        }
      } catch (err) {
        showToast("Không thể tải chi tiết địa điểm");
      } finally {
        setLoading(false);
      }
    }
    if (id) void loadData();
  }, [id, user]);

  const toggleFavorite = async () => {
    try {
      setIsFavorite(!isFavorite);
      await userApi.toggleFavorite(id, !isFavorite);
    } catch {
      setIsFavorite(isFavorite); // Revert
      showToast("Lỗi khi lưu địa điểm");
    }
  };

  if (loading || !location) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, justifyContent: "center", alignItems: "center" }]}>
        <Text>Đang tải...</Text>
      </View>
    );
  }

  const coverUrl = resolveBackendUrl(location.first_image || location.images?.[0] || null);

  return (
    <View style={styles.container}>
      <ScrollView bounces={false} overScrollMode="never" contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
        {/* Cover Image */}
        <View style={styles.coverContainer}>
          {coverUrl ? (
            <Image source={{ uri: coverUrl }} style={styles.coverImage} />
          ) : (
            <View style={[styles.coverImage, { backgroundColor: "#cbd5e1" }]} />
          )}
          <View style={[styles.headerActions, { top: Math.max(insets.top, 16) }]}>
            <Pressable style={styles.iconButton} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={24} color="#0f172a" />
            </Pressable>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable style={styles.iconButton} onPress={toggleFavorite}>
                <Ionicons name={isFavorite ? "heart" : "heart-outline"} size={24} color={isFavorite ? "#ef4444" : "#0f172a"} />
              </Pressable>
              <Pressable style={styles.iconButton}>
                <Ionicons name="share-outline" size={24} color="#0f172a" />
              </Pressable>
            </View>
          </View>
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Text style={styles.locationTitle}>{location.location_name}</Text>
          <View style={styles.ratingRow}>
            <Text style={styles.ratingScore}>{Number(location.rating || 0).toFixed(1)}</Text>
            <Ionicons name="star" size={16} color="#eab308" />
            <Text style={styles.reviewCount}>({location.total_reviews || 0} đánh giá)</Text>
          </View>
          
          <View style={styles.tabHeader}>
            <Pressable onPress={() => setActiveTab("overview")} style={[styles.tabBtn, activeTab === "overview" && styles.tabBtnActive]}>
              <Text style={[styles.tabText, activeTab === "overview" && styles.tabTextActive]}>Tổng quan</Text>
            </Pressable>
            <Pressable onPress={() => setActiveTab("reviews")} style={[styles.tabBtn, activeTab === "reviews" && styles.tabBtnActive]}>
              <Text style={[styles.tabText, activeTab === "reviews" && styles.tabTextActive]}>Đánh giá</Text>
            </Pressable>
            <Pressable onPress={() => setActiveTab("about")} style={[styles.tabBtn, activeTab === "about" && styles.tabBtnActive]}>
              <Text style={[styles.tabText, activeTab === "about" && styles.tabTextActive]}>Giới thiệu</Text>
            </Pressable>
          </View>

          {/* Content */}
          <View style={styles.tabContent}>
            {activeTab === "overview" && (
              <View style={styles.overviewSection}>
                <View style={styles.infoRow}>
                  <Ionicons name="location" size={20} color="#64748b" />
                  <Text style={styles.infoText}>{location.address}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="call" size={20} color="#64748b" />
                  <Text style={styles.infoText}>{location.phone || "Đang cập nhật"}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="mail" size={20} color="#64748b" />
                  <Text style={styles.infoText}>{location.email || "Đang cập nhật"}</Text>
                </View>
                
                <View style={styles.weatherBlock}>
                  <Ionicons name="partly-sunny" size={32} color="#0ea5e9" />
                  <View>
                    <Text style={styles.weatherTemp}>32°C</Text>
                    <Text style={styles.weatherDesc}>Nhiều mây</Text>
                  </View>
                </View>
              </View>
            )}

            {activeTab === "reviews" && (
              <View style={styles.overviewSection}>
                <LocationReviews locationId={id} />
              </View>
            )}

            {activeTab === "about" && (
              <View style={styles.overviewSection}>
                <Text style={styles.infoText}>{location.description || "Chưa có thông tin giới thiệu."}</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Bottom Action */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Pressable 
          style={styles.actionButton}
          onPress={() => showToast("Chức năng đang cập nhật")}
        >
          <Text style={styles.actionButtonText}>Xem dịch vụ tại địa điểm</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  coverContainer: {
    height: 300,
    width: "100%",
  },
  coverImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  headerActions: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  infoCard: {
    flex: 1,
    marginTop: -24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: "#ffffff",
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
  },
  locationTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 8,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 20,
  },
  ratingScore: {
    fontSize: 16,
    fontWeight: "700",
    color: "#334155",
  },
  reviewCount: {
    fontSize: 14,
    color: "#64748b",
  },
  tabHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  tabBtnActive: {
    borderBottomWidth: 2,
    borderBottomColor: "#0f766e",
  },
  tabText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#64748b",
  },
  tabTextActive: {
    color: "#0f766e",
  },
  tabContent: {
    minHeight: 200,
  },
  overviewSection: {
    gap: 16,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 15,
    color: "#334155",
    lineHeight: 22,
  },
  weatherBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    backgroundColor: "#f0f9ff",
    padding: 16,
    borderRadius: 16,
    marginTop: 8,
  },
  weatherTemp: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0c4a6e",
  },
  weatherDesc: {
    fontSize: 14,
    color: "#0369a1",
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "white",
    paddingTop: 12,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  actionButton: {
    height: 52,
    backgroundColor: "#0f766e",
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "white",
  },
});
