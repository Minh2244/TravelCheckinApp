import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { resolveBackendUrl } from "../../../src/lib/url";
import { userApi } from "../../../src/services/user.api";
import type { LocationItem } from "../../../src/types/location";

export default function SavedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
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

  const shellWidth = Math.min(Math.max(width - 40, 0), 560);
  const gridGap = 12;
  const cardWidth = Math.max(Math.floor((shellWidth - gridGap) / 2), 148);

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={["top", "left", "right"]}>
      <FlatList
        data={items}
        numColumns={2}
        keyExtractor={(item) => String(item.location_id)}
        columnWrapperStyle={{ justifyContent: "space-between", marginBottom: 12 }}
        contentContainerStyle={{
          paddingTop: 14,
          paddingHorizontal: 20,
          paddingBottom: Math.max(insets.bottom, 16) + 12,
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
        renderItem={({ item }) => <LocationCard item={item} width={cardWidth} />}
      />
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
  if (!address) return "-";
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
