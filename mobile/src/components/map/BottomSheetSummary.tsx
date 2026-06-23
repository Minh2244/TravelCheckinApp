import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { resolveBackendUrl } from "../../lib/url";
import type { LocationItem } from "../../types/location";

export function BottomSheetSummary({
  location,
  onClose,
  onRoute,
}: {
  location: LocationItem;
  onClose: () => void;
  onRoute: () => void;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const imageUrl = resolveBackendUrl(location.first_image || location.images?.[0] || null);
  const rating = Number(location.rating || 0);

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 16) }]}>
      <View style={styles.header}>
        <View style={styles.dragHandle} />
        <Pressable onPress={onClose} style={styles.closeButton} hitSlop={10}>
          <Ionicons name="close" size={24} color="#64748b" />
        </Pressable>
      </View>

      <View style={styles.content}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.image} />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <Ionicons name="image-outline" size={24} color="#94a3b8" />
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
            <Text style={styles.reviewCount}>({location.total_reviews || 0})</Text>
          </View>
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable style={styles.actionBtnSecondary} onPress={onRoute}>
          <Ionicons name="navigate" size={18} color="#0f766e" />
          <Text style={styles.actionTextSecondary}>Chỉ đường</Text>
        </Pressable>
        <Pressable 
          style={styles.actionBtnPrimary}
          onPress={() => router.push(`/location/${location.location_id}`)}
        >
          <Text style={styles.actionTextPrimary}>Xem chi tiết</Text>
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
    backgroundColor: "white",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    shadowColor: "#0f172a",
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -10 },
    elevation: 20,
    zIndex: 20,
  },
  header: {
    alignItems: "center",
    marginBottom: 16,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#e2e8f0",
    borderRadius: 2,
  },
  closeButton: {
    position: "absolute",
    right: 0,
    top: -4,
  },
  content: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 20,
  },
  image: {
    width: 80,
    height: 80,
    borderRadius: 16,
    backgroundColor: "#f1f5f9",
  },
  imagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  info: {
    flex: 1,
    justifyContent: "center",
    gap: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
  },
  subtitle: {
    fontSize: 14,
    color: "#64748b",
    lineHeight: 20,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#334155",
  },
  reviewCount: {
    fontSize: 14,
    color: "#94a3b8",
  },
  actions: {
    flexDirection: "row",
    gap: 12,
  },
  actionBtnSecondary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#f0fdfa",
  },
  actionTextSecondary: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f766e",
  },
  actionBtnPrimary: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: 48,
    borderRadius: 24,
    backgroundColor: "#0f766e",
  },
  actionTextPrimary: {
    fontSize: 15,
    fontWeight: "700",
    color: "white",
  },
});
