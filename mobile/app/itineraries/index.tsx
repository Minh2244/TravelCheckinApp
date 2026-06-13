import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { userApi } from "../../api/endpoints";
import { colors, spacing, fontSize, borderRadius, shadow } from "../../constants/theme";
import type { ItinerarySummary } from "../../types";

export default function ItinerariesScreen() {
  const router = useRouter();
  const [itineraries, setItineraries] = useState<ItinerarySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await userApi.getItineraries();
      if (res.success) setItineraries(res.data || []);
    } catch (err: any) {
      console.error("Load itineraries error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    void load();
  };

  const handleDelete = (id: number, title: string) => {
    Alert.alert("Xóa lịch trình", `Xóa "${title}"?`, [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa",
        style: "destructive",
        onPress: async () => {
          try {
            await userApi.deleteItinerary(id);
            setItineraries((prev) => prev.filter((i) => i.itinerary_id !== id));
          } catch (err: any) {
            Alert.alert("Lỗi", err?.response?.data?.message || "Không thể xóa");
          }
        },
      },
    ]);
  };

  const formatDate = (d: string) => {
    const dt = new Date(d);
    return `${dt.getDate().toString().padStart(2, "0")}/${(dt.getMonth() + 1).toString().padStart(2, "0")}/${dt.getFullYear()}`;
  };

  const formatMoney = (v: number) =>
    new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(v);

  const countDays = (start: string, end: string) => {
    const diff = new Date(end).getTime() - new Date(start).getTime();
    return Math.max(1, Math.ceil(diff / 86400000) + 1);
  };

  const renderItem = ({ item }: { item: ItinerarySummary }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={() => router.push(`/itineraries/${item.itinerary_id}`)}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <TouchableOpacity
          onPress={() => handleDelete(item.itinerary_id, item.title)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="trash-outline" size={18} color="#ff4d4f" />
        </TouchableOpacity>
      </View>

      {item.description ? (
        <Text style={styles.cardDesc} numberOfLines={1}>
          {item.description}
        </Text>
      ) : null}

      <View style={styles.cardInfo}>
        <View style={styles.infoItem}>
          <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.infoText}>
            {formatDate(item.start_date)} — {formatDate(item.end_date)}
          </Text>
        </View>
        <View style={styles.infoItem}>
          <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.infoText}>{item.total_items} địa điểm</Text>
        </View>
        <View style={styles.infoItem}>
          <Ionicons name="moon-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.infoText}>{countDays(item.start_date, item.end_date)} ngày</Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.visitedText}>
          ✅ {item.visited_count}/{item.total_items} đã đến
        </Text>
        {item.total_estimated_cost > 0 && (
          <Text style={styles.costText}>{formatMoney(item.total_estimated_cost)}</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Đang tải...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🗓️ Lịch trình</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push("/itineraries/create")}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.addButtonText}>Tạo mới</Text>
        </TouchableOpacity>
      </View>

      {itineraries.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="map-outline" size={64} color={colors.border} />
          <Text style={styles.emptyText}>Chưa có lịch trình nào</Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => router.push("/itineraries/create")}
          >
            <Text style={styles.emptyButtonText}>Tạo lịch trình đầu tiên</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={itineraries}
          keyExtractor={(item) => String(item.itinerary_id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  loadingText: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: fontSize.xl,
    fontWeight: "700",
    color: colors.text,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    gap: 4,
  },
  addButtonText: {
    color: "#fff",
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
  list: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.xs,
  },
  cardTitle: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.text,
    flex: 1,
    marginRight: spacing.sm,
  },
  cardDesc: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  cardInfo: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  infoText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.xs,
  },
  visitedText: {
    fontSize: fontSize.xs,
    color: colors.success,
    fontWeight: "600",
  },
  costText: {
    fontSize: fontSize.xs,
    color: colors.accent,
    fontWeight: "600",
  },
  emptyText: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  emptyButton: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  emptyButtonText: {
    color: "#fff",
    fontSize: fontSize.base,
    fontWeight: "600",
  },
});
