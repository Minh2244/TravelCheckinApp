import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { itineraryApi, ItineraryListItem } from "../../../src/services/itinerary.api";

export default function ItinerariesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [itineraries, setItineraries] = useState<ItineraryListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"all" | "upcoming" | "completed">("all");

  const fetchItineraries = async (asRefresh = false) => {
    if (asRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const resp = await itineraryApi.getItineraries();
      if (resp?.success) {
        setItineraries(resp.data || []);
      }
    } catch (e) {
      console.error(e);
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
    Alert.alert(
      "Xác nhận xóa",
      `Bạn có chắc chắn muốn xóa lịch trình "${title}"?`,
      [
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
            } catch (err) {
              console.error(err);
            }
          },
        },
      ]
    );
  };

  // Classify itinerary status
  const getItineraryStatus = (item: ItineraryListItem) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(item.end_date);
    end.setHours(23, 59, 59, 999);

    if (end < today) {
      return { label: "Hoàn thành", color: "text-emerald-700 bg-emerald-50 border-emerald-200/50" };
    }
    return { label: "Sắp diễn ra", color: "text-indigo-700 bg-indigo-50 border-indigo-200/50" };
  };

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
  }, [itineraries, filter]);

  // Statistics counters
  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let upcoming = 0;
    let completed = 0;

    itineraries.forEach((item) => {
      const end = new Date(item.end_date);
      end.setHours(23, 59, 59, 999);
      if (end < today) completed++;
      else upcoming++;
    });

    return {
      total: itineraries.length,
      upcoming,
      completed,
    };
  }, [itineraries]);

  const getDaysCount = (startStr: string, endStr: string) => {
    const start = new Date(startStr);
    const end = new Date(endStr);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return `${diffDays} ngày`;
  };

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={["top", "left", "right"]}>
      {/* Header */}
      <View className="flex-row items-center justify-between border-b border-line bg-white px-4 pb-3 pt-2">
        <Text className="text-[24px] font-black text-slate-900">Lịch trình</Text>
        <Pressable
          onPress={() => router.push("/itinerary/create")}
          className="bg-indigo-600 px-4 py-2 rounded-xl flex-row items-center gap-1 shadow-sm active:bg-indigo-700"
        >
          <Ionicons name="add" size={16} color="white" />
          <Text className="text-white text-xs font-bold">Tạo lịch trình</Text>
        </Pressable>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#a855f7" />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void fetchItineraries(true)} />
          }
          contentContainerStyle={{
            paddingBottom: Math.max(insets.bottom, 16) + 70,
          }}
        >
          {/* Quick info card */}
          <View className="m-4 bg-indigo-50/40 border border-indigo-100 rounded-2xl p-4">
            <Text className="text-[13px] text-indigo-950 font-medium leading-[20px]">
              Tự thiết lập kế hoạch cho chuyến đi của bạn, phân chia địa điểm tham quan theo ngày, thêm chú thích và ghi nhận chi phí thực tế dễ dàng.
            </Text>
          </View>

          {/* Stats Bar */}
          <View className="px-4 flex-row gap-3">
            <View className="flex-1 bg-white border border-line rounded-xl p-3.5 items-center">
              <Text className="text-[10px] text-slate-400 font-bold uppercase">Tổng cộng</Text>
              <Text className="text-lg font-extrabold text-slate-800 mt-0.5">{stats.total}</Text>
            </View>
            <View className="flex-1 bg-white border border-line rounded-xl p-3.5 items-center">
              <Text className="text-[10px] text-slate-400 font-bold uppercase">Sắp tới</Text>
              <Text className="text-lg font-extrabold text-slate-800 mt-0.5">{stats.upcoming}</Text>
            </View>
            <View className="flex-1 bg-white border border-line rounded-xl p-3.5 items-center">
              <Text className="text-[10px] text-slate-400 font-bold uppercase">Đã đi</Text>
              <Text className="text-lg font-extrabold text-slate-800 mt-0.5">{stats.completed}</Text>
            </View>
          </View>

          {/* Filter Tab bar */}
          <View className="flex-row gap-2 px-4 mt-5">
            {([
              { key: "all", label: "Tất cả" },
              { key: "upcoming", label: "Sắp tới" },
              { key: "completed", label: "Đã hoàn thành" },
            ] as const).map((item) => {
              const isActive = filter === item.key;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => setFilter(item.key)}
                  className={`rounded-full px-3.5 py-1.5 border ${
                    isActive
                      ? "bg-indigo-600 border-indigo-600"
                      : "bg-slate-100 border-slate-200"
                  }`}
                >
                  <Text
                    className={`text-[11px] font-bold ${
                      isActive ? "text-white" : "text-slate-600"
                    }`}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* List Section */}
          {filteredItineraries.length === 0 ? (
            <View className="mx-4 mt-4 bg-white border border-line rounded-2xl p-6 items-center">
              <Ionicons name="calendar-outline" size={40} color="#cbd5e1" />
              <Text className="text-sm font-bold text-slate-800 mt-3 text-center">
                Không tìm thấy lịch trình nào
              </Text>
              <Text className="text-xs text-slate-400 text-center mt-1">
                {itineraries.length === 0
                  ? "Hãy bấm nút phía trên góc phải để lên kế hoạch cho hành trình du lịch đầu tiên của mình."
                  : "Thử đổi bộ lọc khác."}
              </Text>
            </View>
          ) : (
            <View className="p-4 gap-3.5">
              {filteredItineraries.map((item) => {
                const statusInfo = getItineraryStatus(item);
                return (
                  <View
                    key={item.itinerary_id}
                    className="bg-white border border-line rounded-2xl p-4 shadow-sm"
                  >
                    <View className="flex-row justify-between items-start mb-2.5">
                      <View className="flex-1 mr-2">
                        <Text className="text-[15px] font-extrabold text-slate-800" numberOfLines={1}>
                          {item.title}
                        </Text>
                        <Text className="text-xs text-slate-400 mt-1 leading-[18px]" numberOfLines={2}>
                          {item.description || "Không có mô tả chuyến đi."}
                        </Text>
                      </View>
                      <View className={`px-2 py-0.5 rounded border ${statusInfo.color}`}>
                        <Text className="text-[9px] font-bold">{statusInfo.label}</Text>
                      </View>
                    </View>

                    <View className="flex-row items-center gap-4 text-xs text-slate-500 mb-4 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <View className="flex-row items-center gap-1">
                        <Ionicons name="calendar" size={13} color="#64748b" />
                        <Text className="text-[11px] text-slate-600 font-semibold">
                          {new Date(item.start_date).toLocaleDateString("vi-VN")} - {new Date(item.end_date).toLocaleDateString("vi-VN")}
                        </Text>
                      </View>
                      <View className="w-[1px] bg-slate-200 h-3" />
                      <View className="flex-row items-center gap-1">
                        <Ionicons name="time-outline" size={13} color="#64748b" />
                        <Text className="text-[11px] text-slate-600 font-bold">
                          {getDaysCount(item.start_date, item.end_date)}
                        </Text>
                      </View>
                    </View>

                    <View className="h-[1px] bg-slate-100 w-full mb-3" />

                    <View className="flex-row justify-between items-center">
                      <Text className="text-[11px] text-slate-400 font-medium">
                        📍 {item.total_items || 0} điểm dừng • {item.visited_items || 0}/{item.total_items || 0} đã ghé
                      </Text>
                      
                      <View className="flex-row gap-3">
                        <Pressable
                          onPress={() => router.push(`/itinerary/${item.itinerary_id}`)}
                          className="bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-lg active:bg-indigo-100"
                        >
                          <Text className="text-[10px] font-bold text-indigo-600">Xem</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => router.push(`/itinerary/${item.itinerary_id}?edit=true`)}
                          className="bg-slate-50 border border-line px-3 py-1.5 rounded-lg active:bg-slate-100"
                        >
                          <Text className="text-[10px] font-bold text-slate-600">Sửa</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => handleDelete(item.itinerary_id, item.title)}
                          className="bg-red-50 border border-red-100 px-3 py-1.5 rounded-lg active:bg-red-100"
                        >
                          <Text className="text-[10px] font-bold text-red-600">Xóa</Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
