import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { resolveBackendUrl } from "../../lib/url";
import type { LocationItem } from "../../types/location";

export function BottomSheetSummary({
  isFavorite,
  location,
  onClose,
  onRoute,
  onToggleFavorite,
}: {
  isFavorite: boolean;
  location: LocationItem;
  onClose: () => void;
  onRoute: () => void;
  onToggleFavorite: () => void;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const imageUrl = resolveBackendUrl(
    location.first_image || location.images?.[0] || null,
  );
  const rating = Number(location.rating || 0);

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.header}>
        <View style={styles.dragHandle} />
        <Pressable onPress={onClose} style={styles.closeButton} hitSlop={10}>
          <Ionicons name="close" size={22} color="#64748b" />
        </Pressable>
      </View>

      <View style={styles.content}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <Ionicons name="image-outline" size={22} color="#94a3b8" />
          </View>
        )}

        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>
            {location.location_name}
          </Text>
          <Text style={styles.subtitle} numberOfLines={2}>
            {location.address}
          </Text>
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={14} color="#eab308" />
            <Text style={styles.ratingText}>
              {rating > 0 ? rating.toFixed(1) : "Chưa có"}
            </Text>
            <Text style={styles.reviewCount}>
              ({location.total_reviews || 0} đánh giá)
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable style={styles.actionButton} onPress={onRoute}>
          <Ionicons name="navigate-outline" size={19} color="#0f766e" />
          <Text style={styles.actionText}>Chỉ đường</Text>
        </Pressable>
        <Pressable
          style={styles.actionButton}
          onPress={() => router.push(`/location/${location.location_id}`)}
        >
          <Ionicons name="information-circle-outline" size={19} color="#0f766e" />
          <Text style={styles.actionText}>Chi tiết</Text>
        </Pressable>
        <Pressable style={styles.actionButton} onPress={onToggleFavorite}>
          <Ionicons
            name={isFavorite ? "heart" : "heart-outline"}
            size={19}
            color={isFavorite ? "#dc2626" : "#0f766e"}
          />
          <Text style={[styles.actionText, isFavorite && styles.favoriteText]}>
            {isFavorite ? "Đã lưu" : "Lưu"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 9,
    elevation: 20,
    zIndex: 20,
  },
  header: {
    alignItems: "center",
    marginBottom: 10,
  },
  dragHandle: {
    width: 38,
    height: 4,
    backgroundColor: "#cbd5e1",
    borderRadius: 2,
  },
  closeButton: {
    position: "absolute",
    right: 0,
    top: -5,
  },
  content: {
    flexDirection: "row",
    gap: 13,
    marginBottom: 14,
  },
  image: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
  },
  imagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  info: {
    flex: 1,
    justifyContent: "center",
    gap: 3,
  },
  title: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0f172a",
  },
  subtitle: {
    fontSize: 13,
    color: "#64748b",
    lineHeight: 18,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
  },
  reviewCount: {
    fontSize: 12,
    color: "#94a3b8",
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#f8fafc",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  actionText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f766e",
  },
  favoriteText: {
    color: "#dc2626",
  },
});
