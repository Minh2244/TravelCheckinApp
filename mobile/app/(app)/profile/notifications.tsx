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
import { AppAlert as Alert } from "../../../src/modules/ui/app-alert";

type NotificationItem = {
  notification_id: number;
  title: string;
  body: string;
  target_audience: string;
  target_user_id: number | null;
  created_at: string;
  is_read: number;
};

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = async (asRefresh = false) => {
    if (asRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const resp = await userApi.getNotifications();
      if (resp?.success) {
        setNotifications(resp.data || []);
      } else {
        setError(resp.message || "Không thể tải thông báo");
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
    void fetchNotifications();
  }, []);

  const handleMarkAllRead = async () => {
    try {
      const resp = await userApi.markNotificationsRead();
      if (resp?.success) {
        setNotifications((prev) =>
          prev.map((item) => ({ ...item, is_read: 1 }))
        );
      }
    } catch (e) {
      console.error("Lỗi đánh dấu đã đọc:", e);
    }
  };

  const handleDeleteAll = () => {
    Alert.alert(
      "Xác nhận",
      "Bạn có chắc muốn xóa tất cả thông báo không?",
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xóa",
          style: "destructive",
          onPress: async () => {
            try {
              const resp = await userApi.deleteNotificationsAll();
              if (resp?.success) {
                setNotifications([]);
              }
            } catch (e) {
              console.error("Lỗi xóa tất cả thông báo:", e);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const formatTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const hh = String(date.getHours()).padStart(2, "0");
      const mm = String(date.getMinutes()).padStart(2, "0");
      const dd = String(date.getDate()).padStart(2, "0");
      const mo = String(date.getMonth() + 1).padStart(2, "0");
      const yyyy = date.getFullYear();
      return `${hh}:${mm} - ${dd}/${mo}/${yyyy}`;
    } catch {
      return dateStr;
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top", "left", "right"]}>
      {/* Header */}
      <View className="flex-row items-center justify-between border-b border-slate-100 bg-white px-4 pb-3 pt-3">
        <View className="flex-row items-center flex-1">
          <Pressable
            className="h-10 w-10 items-center justify-center rounded-full bg-slate-50 border border-slate-100 active:bg-slate-100"
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={24} color="#0f172a" />
          </Pressable>
          <Text className="ml-3 text-[20px] font-black text-slate-900">
            Thông báo
          </Text>
        </View>

        {notifications.length > 0 && (
          <View className="flex-row gap-2.5">
            <Pressable
              className="h-10 w-10 items-center justify-center rounded-full bg-sky-50 border border-sky-100 active:bg-sky-100"
              onPress={handleMarkAllRead}
            >
              <Ionicons name="checkmark-done" size={20} color="#0284c7" />
            </Pressable>
            <Pressable
              className="h-10 w-10 items-center justify-center rounded-full bg-rose-50 border border-rose-100 active:bg-rose-100"
              onPress={handleDeleteAll}
            >
              <Ionicons name="trash-outline" size={18} color="#e11d48" />
            </Pressable>
          </View>
        )}
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#0284c7" />
        </View>
      ) : error ? (
        <View className="flex-1 justify-center items-center px-4">
          <Text className="text-red-500 font-bold text-center">{error}</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void fetchNotifications(true)} />
          }
          contentContainerStyle={{
            padding: 16,
            paddingBottom: Math.max(insets.bottom, 16),
            gap: 12,
          }}
        >
          {notifications.length === 0 ? (
            <View className="bg-white border border-slate-100 rounded-3xl p-8 items-center mt-6 shadow-sm">
              <View className="w-16 h-16 rounded-full bg-sky-50 items-center justify-center mb-4">
                <Ionicons name="notifications-off-outline" size={32} color="#0284c7" />
              </View>
              <Text className="text-base font-bold text-slate-800 text-center">
                Hộp thư trống
              </Text>
              <Text className="text-xs text-slate-400 text-center mt-2 leading-[18px] max-w-[220px]">
                Các thông báo và cập nhật quan trọng từ hệ thống sẽ hiển thị tại đây.
              </Text>
            </View>
          ) : (
            notifications.map((item) => {
              const cleanBody = (item.body || "").replace(/\[[^\]]+\]/g, "").trim();
              const isUnread = Number(item.is_read) !== 1;
              return (
                <View
                  key={item.notification_id}
                  className={`bg-white border ${
                    isUnread ? "border-l-4 border-l-sky-500 border-y-slate-100 border-r-slate-100" : "border-slate-100"
                  } rounded-2xl p-4 shadow-sm flex-row items-start relative`}
                  style={{
                    shadowColor: "#0f172a",
                    shadowOpacity: 0.03,
                    shadowRadius: 8,
                    shadowOffset: { width: 0, height: 4 },
                    elevation: 1,
                  }}
                >
                  {isUnread && (
                    <View className="absolute top-4 right-4 w-2 h-2 rounded-full bg-sky-500" />
                  )}

                  {/* Left Bell Icon */}
                  <View
                    className={`w-10 h-10 rounded-full ${
                      isUnread ? "bg-sky-50" : "bg-slate-50"
                    } items-center justify-center mr-3`}
                  >
                    <Ionicons
                      name={isUnread ? "notifications" : "notifications-outline"}
                      size={18}
                      color={isUnread ? "#0284c7" : "#64748b"}
                    />
                  </View>

                  {/* Right Content Stack */}
                  <View className="flex-1 pr-2">
                    <Text
                      className={`text-[15px] ${
                        isUnread ? "font-extrabold text-slate-900" : "font-bold text-slate-800"
                      }`}
                    >
                      {item.title}
                    </Text>
                    <Text className="text-xs text-slate-500 mt-1.5 leading-5">
                      {cleanBody}
                    </Text>
                    <View className="flex-row items-center gap-1.5 mt-2.5">
                      <Ionicons name="time-outline" size={12} color="#94a3b8" />
                      <Text className="text-[10px] font-semibold text-slate-400">
                        {formatTime(item.created_at)}
                      </Text>
                    </View>
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
