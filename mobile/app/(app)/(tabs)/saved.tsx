import { useEffect, useState } from "react";
import { FlatList, Image, RefreshControl, StyleSheet, Text, View } from "react-native";

import { ScreenShell } from "../../../src/components/screen-shell";
import { resolveBackendUrl } from "../../../src/lib/url";
import { userApi } from "../../../src/services/user.api";
import type { LocationItem } from "../../../src/types/location";

export default function SavedScreen() {
  const [items, setItems] = useState<LocationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadFavorites = async (asRefresh = false) => {
    try {
      if (asRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const response = await userApi.getFavorites();
      setItems(response.data ?? []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadFavorites();
  }, []);

  return (
    <ScreenShell
      title="Đã lưu"
      framed={false}
      scrollable={false}
    >
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.location_id)}
        contentContainerStyle={styles.savedList}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void loadFavorites(true)} />
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>
              {loading ? "Đang tải địa điểm đã lưu" : "Bạn chưa lưu địa điểm nào"}
            </Text>
            <Text style={styles.emptyText}>
              Khi bạn thích một địa điểm trên website hoặc mobile, danh sách đó sẽ hiện ở đây.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const imageUrl = resolveBackendUrl(item.first_image || item.images?.[0] || null);

          return (
            <View style={styles.savedCard}>
              <View style={styles.savedImageWrap}>
                {imageUrl ? (
                  <Image source={{ uri: imageUrl }} style={styles.savedImage} resizeMode="cover" />
                ) : (
                  <View style={styles.savedImagePlaceholder}>
                    <Text style={styles.savedImagePlaceholderText}>Chưa có ảnh</Text>
                  </View>
                )}
              </View>

              <View style={styles.savedBody}>
                <Text style={styles.savedName}>{item.location_name}</Text>
                <Text style={styles.savedMeta}>{getTypeLabel(item.location_type)}</Text>
                <Text style={styles.savedAddress} numberOfLines={2}>
                  {item.address}
                </Text>
              </View>
            </View>
          );
        }}
      />
    </ScreenShell>
  );
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
  savedList: {
    paddingBottom: 118,
    gap: 14,
  },
  emptyBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#dbe4ea",
    backgroundColor: "#ffffff",
    padding: 18,
    gap: 10,
  },
  emptyTitle: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "800",
  },
  emptyText: {
    color: "#475569",
    lineHeight: 22,
  },
  savedCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#dbe4ea",
    backgroundColor: "#ffffff",
    overflow: "hidden",
  },
  savedImageWrap: {
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: "#e2e8f0",
  },
  savedImage: {
    width: "100%",
    height: "100%",
  },
  savedImagePlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  savedImagePlaceholderText: {
    color: "#64748b",
    fontWeight: "700",
  },
  savedBody: {
    padding: 16,
    gap: 6,
  },
  savedName: {
    color: "#111827",
    fontWeight: "800",
    fontSize: 18,
  },
  savedMeta: {
    color: "#0f766e",
    fontWeight: "700",
  },
  savedAddress: {
    color: "#475569",
    lineHeight: 21,
  },
});
