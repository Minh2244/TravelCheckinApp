import { useEffect, useState } from "react";
import { FlatList, Image, RefreshControl, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { resolveBackendUrl } from "../../../src/lib/url";
import { userApi } from "../../../src/services/user.api";
import type { LocationItem } from "../../../src/types/location";

export default function SavedScreen() {
  const insets = useSafeAreaInsets();
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
    <SafeAreaView className="flex-1 bg-surface" edges={["top", "left", "right", "bottom"]}>
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.location_id)}
        contentContainerStyle={{
          paddingTop: 14,
          paddingHorizontal: 20,
          paddingBottom: Math.max(insets.bottom, 16) + 12,
          gap: 14,
        }}
        overScrollMode="never"
        bounces={false}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View className="gap-2 pb-4 pt-1">
            <Text className="text-[28px] font-extrabold leading-[34px] text-slate-900">
              Đã lưu
            </Text>
            <Text className="text-[15px] leading-[23px] text-slate-600">
              Mở lại các địa điểm bạn đã thích từ website và mobile.
            </Text>
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void loadFavorites(true)} />
        }
        ListEmptyComponent={
          <View className="gap-2.5 rounded-xl border border-line bg-white p-[18px]">
            <Text className="text-lg font-extrabold text-slate-900">
              {loading ? "Đang tải địa điểm đã lưu" : "Bạn chưa lưu địa điểm nào"}
            </Text>
            <Text className="leading-6 text-slate-600">
              Khi bạn thích một địa điểm trên website hoặc mobile, danh sách đó sẽ hiện ở đây.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const imageUrl = resolveBackendUrl(item.first_image || item.images?.[0] || null);

          return (
            <View className="overflow-hidden rounded-xl border border-line bg-white">
              <View className="aspect-video w-full bg-slate-200">
                {imageUrl ? (
                  <Image source={{ uri: imageUrl }} className="h-full w-full" resizeMode="cover" />
                ) : (
                  <View className="flex-1 items-center justify-center">
                    <Text className="font-bold text-slate-500">Chưa có ảnh</Text>
                  </View>
                )}
              </View>

              <View className="gap-1.5 p-4">
                <Text className="text-lg font-extrabold text-slate-900">{item.location_name}</Text>
                <Text className="font-bold text-brand-600">{getTypeLabel(item.location_type)}</Text>
                <Text className="leading-[21px] text-slate-600" numberOfLines={2}>
                  {item.address}
                </Text>
              </View>
            </View>
          );
        }}
      />
    </SafeAreaView>
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
