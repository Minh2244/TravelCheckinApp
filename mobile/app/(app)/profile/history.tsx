import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import MapView, { Marker, Polyline } from "react-native-maps";

import { userApi } from "../../../src/services/user.api";

type CheckinItem = {
  checkin_id: number;
  checkin_time: string;
  status: string;
  location_id: number;
  location_name: string;
  address: string;
  checkin_latitude: number | string | null;
  checkin_longitude: number | string | null;
};

export default function HistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [items, setItems] = useState<CheckinItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = async (asRefresh = false) => {
    if (asRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const resp = await userApi.getCheckins();
      if (resp?.success) {
        setItems((resp.data as any) || []);
      } else {
        setError(resp.message || "Không thể tải lịch sử check-in");
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
    void fetchHistory();
  }, []);

  // Filter coordinate points for Map route rendering
  const timelinePoints = useMemo(() => {
    const points = items
      .map((item) => {
        const lat = Number(item.checkin_latitude);
        const lng = Number(item.checkin_longitude);
        if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return null;
        return {
          id: item.checkin_id,
          name: item.location_name,
          time: item.checkin_time,
          coords: { latitude: lat, longitude: lng },
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);

    // Sort chronologically ascending for polyline path drawing
    return points.sort(
      (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
    );
  }, [items]);

  // Initial region centered on the first check-in
  const initialRegion = useMemo(() => {
    if (timelinePoints.length === 0) {
      return {
        latitude: 10.03711, // Can Tho default coordinates
        longitude: 105.78825,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
    }
    return {
      latitude: timelinePoints[0].coords.latitude,
      longitude: timelinePoints[0].coords.longitude,
      latitudeDelta: 0.03,
      longitudeDelta: 0.03,
    };
  }, [timelinePoints]);

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
          Lịch sử hành trình
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
            <RefreshControl refreshing={refreshing} onRefresh={() => void fetchHistory(true)} />
          }
          contentContainerStyle={{
            paddingBottom: Math.max(insets.bottom, 16),
          }}
        >
          {/* Map Section */}
          <View className="h-64 w-full bg-slate-200 border-b border-line">
            {timelinePoints.length > 0 ? (
              <MapView
                style={{ width: "100%", height: "100%" }}
                initialRegion={initialRegion}
              >
                {/* Connection route polyline */}
                {timelinePoints.length > 1 && (
                  <Polyline
                    coordinates={timelinePoints.map((p) => p.coords)}
                    strokeColor="#7c3aed"
                    strokeWidth={4}
                  />
                )}

                {/* Markers */}
                {timelinePoints.map((point, index) => (
                  <Marker
                    key={point.id}
                    coordinate={point.coords}
                    title={point.name}
                    description={`Dừng chân #${index + 1}`}
                  />
                ))}
              </MapView>
            ) : (
              <View className="flex-1 justify-center items-center bg-slate-100 p-6">
                <Ionicons name="map-outline" size={32} color="#94a3b8" />
                <Text className="text-xs text-slate-400 text-center mt-2">
                  Chưa có dữ liệu GPS để hiển thị hành trình trên bản đồ.
                </Text>
              </View>
            )}
          </View>

          {/* Stats Bar */}
          <View className="flex-row justify-between items-center bg-white px-5 py-3 border-b border-line shadow-sm">
            <Text className="text-xs text-slate-500 font-medium">
              Tổng lượt check-in: <Text className="font-extrabold text-slate-900">{items.length}</Text>
            </Text>
          </View>

          {/* Timeline List */}
          {items.length === 0 ? (
            <View className="m-4 bg-white border border-line rounded-2xl p-6 items-center">
              <Ionicons name="calendar-outline" size={40} color="#cbd5e1" />
              <Text className="text-sm font-bold text-slate-800 mt-3 text-center">
                Không có dữ liệu check-in
              </Text>
              <Text className="text-xs text-slate-400 text-center mt-1">
                Các địa điểm bạn đã check-in thành công sẽ hiển thị ở đây.
              </Text>
            </View>
          ) : (
            <View className="p-4 gap-3">
              {items.map((item) => (
                <View
                  key={item.checkin_id}
                  className="bg-white border border-line rounded-2xl p-4 flex-row justify-between items-center shadow-sm"
                >
                  <View className="flex-1 mr-3">
                    <Text className="text-[14px] font-extrabold text-slate-800" numberOfLines={1}>
                      {item.location_name}
                    </Text>
                    <Text className="text-[11px] text-slate-400 mt-1">
                      🕒 {new Date(item.checkin_time).toLocaleString("vi-VN")}
                    </Text>
                  </View>
                  <View className="bg-teal-50 border border-teal-100 px-3 py-1 rounded-full">
                    <Text className="text-[10px] font-bold text-teal-700 uppercase">
                      {item.status || "Thành công"}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
