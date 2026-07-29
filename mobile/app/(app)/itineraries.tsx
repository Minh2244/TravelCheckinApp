import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { itineraryApi, ItineraryListItem } from "../../src/services/itinerary.api";
import { AppAlert as Alert } from "../../src/modules/ui/app-alert";
import { travelColors, travelShadow } from "../../src/theme/travel";

type FilterKey = "all" | "upcoming" | "completed";

export default function ItinerariesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [itineraries, setItineraries] = useState<ItineraryListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("all");

  const fetchItineraries = async (asRefresh = false) => {
    if (asRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const resp = await itineraryApi.getItineraries();
      if (resp?.success) {
        setItineraries(resp.data || []);
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Lỗi", "Không thể tải danh sách lịch trình.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void fetchItineraries();
  }, []);

  const handleDelete = (id: number, title: string) => {
    Alert.alert("Xác nhận xóa", `Bạn có chắc chắn muốn xóa lịch trình "${title}"?`, [
      { text: "Hủy" },
      {
        text: "Xóa",
        style: "destructive",
        onPress: async () => {
          try {
            const res = await itineraryApi.deleteItinerary(id);
            if (res.success) {
              await fetchItineraries();
            } else {
              Alert.alert("Lỗi", res.message || "Không thể xóa lịch trình.");
            }
          } catch (error) {
            console.error(error);
          }
        },
      },
    ]);
  };

  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let upcoming = 0;
    let completed = 0;
    itineraries.forEach((item) => {
      const end = new Date(item.end_date);
      end.setHours(23, 59, 59, 999);
      if (end < today) completed += 1;
      else upcoming += 1;
    });

    return { total: itineraries.length, upcoming, completed };
  }, [itineraries]);

  const filteredItineraries = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return itineraries.filter((item) => {
      const end = new Date(item.end_date);
      end.setHours(23, 59, 59, 999);
      const isCompleted = end < today;
      if (filter === "upcoming") return !isCompleted;
      if (filter === "completed") return isCompleted;
      return true;
    });
  }, [filter, itineraries]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator size="large" color={travelColors.purple} />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={["top", "left", "right"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void fetchItineraries(true)} />
        }
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 14,
          paddingBottom: Math.max(insets.bottom, 16) + 78,
          gap: 14,
        }}
      >
        <View className="flex-row items-center justify-between gap-3">
          <View className="flex-1">
            <Text className="text-[34px] font-black leading-[40px] text-ink">Lịch trình</Text>
            <Text className="mt-1 text-[14px] font-semibold leading-5 text-muted">
              Lên kế hoạch, theo dõi điểm dừng và tiến độ chuyến đi.
            </Text>
          </View>
          <Pressable
            onPress={() => router.push("/itinerary/create")}
            className="min-h-[42px] flex-row items-center gap-1.5 rounded-full bg-ai-500 px-4"
          >
            <Ionicons name="add" size={18} color="#ffffff" />
            <Text className="text-[13px] font-extrabold text-white">Tạo</Text>
          </Pressable>
        </View>

        <View className="rounded-2xl border border-ai-50 bg-ai-50 p-4">
          <Text className="text-[14px] font-bold leading-6 text-ink">
            Tự thiết lập kế hoạch theo ngày, thêm điểm tham quan, ghi chú và chi phí để chuyến đi dễ theo dõi hơn.
          </Text>
        </View>

        <View className="flex-row gap-2">
          <StatTile label="Tổng" value={stats.total} icon="map-outline" />
          <StatTile label="Sắp tới" value={stats.upcoming} icon="calendar-outline" />
          <StatTile label="Đã đi" value={stats.completed} icon="checkmark-done-outline" />
        </View>

        <View className="flex-row gap-2">
          {([
            { key: "all", label: "Tất cả" },
            { key: "upcoming", label: "Sắp tới" },
            { key: "completed", label: "Đã hoàn thành" },
          ] as const).map((item) => (
            <FilterChip
              key={item.key}
              label={item.label}
              active={filter === item.key}
              onPress={() => setFilter(item.key)}
            />
          ))}
        </View>

        {filteredItineraries.length === 0 ? (
          <View className="items-center gap-2 rounded-2xl border border-line bg-white p-6" style={travelShadow}>
            <View className="h-12 w-12 items-center justify-center rounded-full bg-ai-50">
              <Ionicons name="calendar-outline" size={25} color={travelColors.purple} />
            </View>
            <Text className="text-center text-[16px] font-extrabold text-ink">
              Không tìm thấy lịch trình nào
            </Text>
            <Text className="text-center text-[13px] leading-5 text-muted">
              {itineraries.length === 0
                ? "Tạo lịch trình đầu tiên để gom địa điểm, ngày đi và ghi chú vào một nơi."
                : "Thử đổi bộ lọc khác để xem lịch trình phù hợp."}
            </Text>
          </View>
        ) : (
          <View className="gap-3">
            {filteredItineraries.map((item) => (
              <ItineraryCard
                key={item.itinerary_id}
                item={item}
                onOpen={() => router.push(`/itinerary/${item.itinerary_id}`)}
                onEdit={() => router.push(`/itinerary/${item.itinerary_id}?edit=true`)}
                onDelete={() => handleDelete(item.itinerary_id, item.title)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatTile({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number;
}) {
  return (
    <View className="flex-1 items-center rounded-xl border border-line bg-white p-3" style={travelShadow}>
      <Ionicons name={icon} size={18} color={travelColors.teal} />
      <Text className="mt-1 text-[10px] font-extrabold uppercase text-muted">{label}</Text>
      <Text className="mt-0.5 text-[20px] font-black text-ink">{value}</Text>
    </View>
  );
}

function FilterChip({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={[
        "min-h-[38px] items-center justify-center rounded-full border px-4",
        active ? "border-brand-600 bg-brand-600" : "border-line bg-white",
      ].join(" ")}
    >
      <Text className={["text-[13px] font-extrabold", active ? "text-white" : "text-ink"].join(" ")}>
        {label}
      </Text>
    </Pressable>
  );
}

function ItineraryCard({
  item,
  onDelete,
  onEdit,
  onOpen,
}: {
  item: ItineraryListItem;
  onDelete: () => void;
  onEdit: () => void;
  onOpen: () => void;
}) {
  const status = getItineraryStatus(item);
  const totalItems = Number(item.total_items || 0);
  const visitedItems = Number(item.visited_items || 0);
  const progress = totalItems > 0 ? Math.min(100, (visitedItems / totalItems) * 100) : 0;

  return (
    <View className="rounded-2xl border border-line bg-white p-4" style={travelShadow}>
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="text-[18px] font-black text-ink" numberOfLines={1}>
            {item.title}
          </Text>
          <Text className="mt-1 text-[13px] leading-5 text-muted" numberOfLines={2}>
            {item.description || "Không có mô tả chuyến đi."}
          </Text>
        </View>
        <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: status.background }}>
          <Text className="text-[11px] font-extrabold" style={{ color: status.color }}>
            {status.label}
          </Text>
        </View>
      </View>

      <View className="mt-3 flex-row items-center gap-3 rounded-xl border border-line bg-surfaceSoft px-3 py-2">
        <View className="flex-row items-center gap-1.5">
          <Ionicons name="calendar-outline" size={14} color={travelColors.muted} />
          <Text className="text-[12px] font-bold text-ink">
            {new Date(item.start_date).toLocaleDateString("vi-VN")} -{" "}
            {new Date(item.end_date).toLocaleDateString("vi-VN")}
          </Text>
        </View>
        <View className="h-4 w-[1px] bg-line" />
        <View className="flex-row items-center gap-1.5">
          <Ionicons name="time-outline" size={14} color={travelColors.muted} />
          <Text className="text-[12px] font-bold text-ink">
            {getDaysCount(item.start_date, item.end_date)}
          </Text>
        </View>
      </View>

      <View className="mt-3">
        <View className="mb-1.5 flex-row items-center justify-between">
          <Text className="text-[12px] font-bold text-muted">
            {totalItems} điểm dừng · {visitedItems}/{totalItems} đã ghé
          </Text>
          <Text className="text-[12px] font-extrabold text-brand-700">
            {Math.round(progress)}%
          </Text>
        </View>
        <View className="h-2 overflow-hidden rounded-full bg-slate-200">
          <View className="h-full rounded-full bg-brand-600" style={{ width: `${progress}%` }} />
        </View>
      </View>

      <View className="mt-4 flex-row justify-end gap-2">
        <MiniAction label="Xem" onPress={onOpen} tint={travelColors.purple} />
        <MiniAction label="Sửa" onPress={onEdit} tint={travelColors.teal} />
        <MiniAction label="Xóa" onPress={onDelete} tint={travelColors.danger} />
      </View>
    </View>
  );
}

function MiniAction({
  label,
  onPress,
  tint,
}: {
  label: string;
  onPress: () => void;
  tint: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="min-h-[34px] min-w-[56px] items-center justify-center rounded-lg border px-3"
      style={{ borderColor: `${tint}33`, backgroundColor: `${tint}10` }}
    >
      <Text className="text-[12px] font-extrabold" style={{ color: tint }}>
        {label}
      </Text>
    </Pressable>
  );
}

function getItineraryStatus(item: ItineraryListItem) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(item.end_date);
  end.setHours(23, 59, 59, 999);

  if (end < today) {
    return {
      label: "Đã đi",
      color: travelColors.tealDark,
      background: travelColors.tealSoft,
    };
  }

  return {
    label: "Sắp đi",
    color: travelColors.purple,
    background: travelColors.purpleSoft,
  };
}

function getDaysCount(startStr: string, endStr: string) {
  const start = new Date(startStr);
  const end = new Date(endStr);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return `${diffDays} ngày`;
}
