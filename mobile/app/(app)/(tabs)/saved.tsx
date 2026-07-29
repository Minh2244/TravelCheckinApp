import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
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
import { travelColors, travelShadow } from "../../../src/theme/travel";
import { isPrivateUserLocation, type LocationItem } from "../../../src/types/location";

export default function SavedScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [items, setItems] = useState<LocationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadFavorites = async (asRefresh = false) => {
    try {
      if (asRefresh) setRefreshing(true);
      else setLoading(true);

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

  useFocusEffect(
    useCallback(() => {
      void loadFavorites(true);
    }, []),
  );

  const shellWidth = Math.min(Math.max(width - 32, 0), 580);
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
          paddingTop: 16,
          paddingHorizontal: 16,
          paddingBottom: Math.max(insets.bottom, 16) + 16,
        }}
        overScrollMode="never"
        bounces={false}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View className="gap-2 pb-4">
            <Text className="text-[34px] font-black leading-[40px] text-ink">Đã lưu</Text>
            <Text className="max-w-[330px] text-[15px] leading-[22px] text-muted">
              Mở lại địa điểm bạn thích, xem nhanh khoảng cách và đặt dịch vụ khi cần.
            </Text>
            <View className="mt-1 self-start rounded-full bg-brand-50 px-3 py-1">
              <Text className="text-[12px] font-extrabold text-brand-700">
                {items.length} địa điểm
              </Text>
            </View>
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void loadFavorites(true)} />
        }
        ListEmptyComponent={
          <View className="items-center gap-2.5 rounded-2xl border border-line bg-white p-6" style={travelShadow}>
            <View className="h-12 w-12 items-center justify-center rounded-full bg-brand-50">
              <Ionicons name="bookmark-outline" size={24} color={travelColors.teal} />
            </View>
            <Text className="text-center text-[17px] font-extrabold text-ink">
              {loading ? "Đang tải địa điểm đã lưu" : "Bạn chưa lưu địa điểm nào"}
            </Text>
            <Text className="text-center text-[13px] leading-5 text-muted">
              Khi bấm lưu ở website hoặc mobile, địa điểm sẽ xuất hiện tại đây.
            </Text>
          </View>
        }
        renderItem={({ item }) => <LocationCard item={item} width={cardWidth} />}
      />
    </SafeAreaView>
  );
}

function LocationCard({ item, width }: { item: LocationItem; width: number }) {
  const router = useRouter();
  const imageUrl = resolveBackendUrl(item.first_image || item.images?.[0] || null);
  const rating = Number(item.rating || 0);
  const reviewCount = Number(item.total_reviews || 0);
  const isPrivateLocation = isPrivateUserLocation(item);
  const typeLabel = isPrivateLocation ? "Vị trí riêng tư" : getTypeLabel(item.location_type);

  return (
    <Pressable
      className="overflow-hidden rounded-xl border border-line bg-white"
      style={{ width, ...travelShadow }}
      hitSlop={{ top: 6, left: 6, right: 6, bottom: 6 }}
      accessibilityRole="button"
      onPress={() => router.push(`/location/${item.location_id}`)}
    >
      <View className="w-full bg-slate-200" style={{ height: Math.min(112, Math.round(width * 0.68)) }}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} className="h-full w-full" resizeMode="cover" />
        ) : (
          <View className="flex-1 items-center justify-center bg-slate-200">
            <Ionicons name="image-outline" size={24} color="#98a2b3" />
          </View>
        )}

        {(item as any).distance_km ? (
          <View className="absolute right-2 top-2 rounded-full bg-black/65 px-2 py-1">
            <Text className="text-[10px] font-bold text-white">{(item as any).distance_km} km</Text>
          </View>
        ) : null}
      </View>

      <View className="gap-1.5 p-2.5">
        <Text className="text-[11px] font-bold text-brand-600">{typeLabel}</Text>
        {isPrivateLocation ? (
          <Text className="text-[11px] font-bold text-teal-700">Chi minh ban thay</Text>
        ) : null}
        <Text className="text-[14px] font-extrabold text-ink" numberOfLines={1}>
          {item.location_name}
        </Text>
        <Text className="text-[12px] text-muted">
          {rating > 0 ? rating.toFixed(1) : "0"} điểm | {reviewCount} đánh giá
        </Text>
        <Text className="text-[12px] leading-[17px] text-slate-600" numberOfLines={2}>
          {shortAddress(item.address)}
        </Text>
      </View>
    </Pressable>
  );
}

function shortAddress(address: string) {
  if (!address) return "-";
  const parts = address.split(",").map((item) => item.trim());
  return parts.length <= 2 ? address : `${parts[0]}, ${parts[1]}`;
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
