import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { userApi } from "../../../src/services/user.api";

type ReminderItem = {
  booking_id: number;
  check_in_date: string;
  check_out_date: string | null;
  status: string;
  notes: string | null;
  location_name: string;
  address: string;
  province: string | null;
  location_type: string;
};

export default function RemindersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReminders = async (asRefresh = false) => {
    if (asRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const resp = await userApi.getBookingReminders();
      if (resp?.success) {
        setReminders(resp.data || []);
      } else {
        setError(resp.message || "Không thể tải lịch nhắc nhở");
      }
    } catch (e) {
      console.error(e);
      setError("Không thể kết nối đến máy chủ");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void fetchReminders();
  }, []);

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "confirmed":
        return { bg: "bg-emerald-50 border-emerald-100", text: "text-emerald-700", label: "Đã xác nhận" };
      case "pending":
        return { bg: "bg-amber-50 border-amber-100", text: "text-amber-700", label: "Chờ xử lý" };
      case "cancelled":
        return { bg: "bg-red-50 border-red-100", text: "text-red-700", label: "Đã hủy" };
      case "completed":
        return { bg: "bg-indigo-50 border-indigo-100", text: "text-indigo-700", label: "Đã hoàn thành" };
      default:
        return { bg: "bg-slate-50 border-slate-100", text: "text-slate-700", label: status };
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={["top", "left", "right"]}>
      {/* Header */}
      <View className="flex-row items-center border-b border-line bg-white px-4 pb-3 pt-2">
        <Pressable
          className="h-10 w-10 items-center justify-center rounded-full bg-slate-100"
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={24} color="#0f172a" />
        </Pressable>
        <Text className="ml-3 text-[20px] font-extrabold text-slate-900 flex-1">
          Nhắc lịch booking
        </Text>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#a855f7" />
        </View>
      ) : error ? (
        <View className="flex-1 justify-center items-center px-4">
          <Text className="text-red-500 font-bold text-center">{error}</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void fetchReminders(true)} />
          }
          contentContainerStyle={{
            padding: 16,
            paddingBottom: Math.max(insets.bottom, 16),
            gap: 12,
          }}
        >
          {reminders.length === 0 ? (
            <View className="bg-white border border-line rounded-2xl p-6 items-center">
              <Ionicons name="alarm-outline" size={40} color="#cbd5e1" />
              <Text className="text-sm font-bold text-slate-800 mt-3 text-center">
                Không có lịch nhắc nhở nào
              </Text>
              <Text className="text-xs text-slate-400 text-center mt-1">
                Lịch nhắc nhở hiển thị các lịch đặt phòng/bàn/vé du lịch của bạn trong vòng 30 ngày qua và sắp tới.
              </Text>
            </View>
          ) : (
            reminders.map((r) => {
              const statusInfo = getStatusStyle(r.status);
              return (
                <View
                  key={r.booking_id}
                  className="bg-white border border-line rounded-2xl p-4 shadow-sm"
                >
                  <View className="flex-row justify-between items-start mb-2">
                    <View className="flex-1 mr-2">
                      <Text className="text-[15px] font-extrabold text-slate-800" numberOfLines={1}>
                        {r.location_name}
                      </Text>
                      <Text className="text-xs text-slate-400 mt-0.5" numberOfLines={1}>
                        📍 {r.address}
                      </Text>
                    </View>
                    <View className={`px-2 py-0.5 rounded border ${statusInfo.bg}`}>
                      <Text className={`text-[10px] font-bold ${statusInfo.text}`}>
                        {statusInfo.label}
                      </Text>
                    </View>
                  </View>

                  <View className="h-[1px] bg-slate-100 w-full my-2.5" />

                  <View className="gap-1.5">
                    <View className="flex-row items-center gap-1.5">
                      <Ionicons name="calendar-outline" size={13} color="#64748b" />
                      <Text className="text-xs text-slate-600 font-semibold">
                        Thời gian: {new Date(r.check_in_date).toLocaleDateString("vi-VN")} {new Date(r.check_in_date).toLocaleTimeString("vi-VN", {hour: '2-digit', minute:'2-digit'})}
                        {r.check_out_date && ` - ${new Date(r.check_out_date).toLocaleDateString("vi-VN")}`}
                      </Text>
                    </View>

                    {r.notes ? (
                      <View className="flex-row items-start gap-1.5 mt-1 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        <Ionicons name="document-text-outline" size={13} color="#64748b" className="mt-0.5" />
                        <Text className="text-xs text-slate-500 flex-1 leading-[18px]">
                          Ghi chú: {r.notes}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
