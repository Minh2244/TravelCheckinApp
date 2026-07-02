import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Alert,
  Animated,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";

import { sosApi } from "../../../src/services/sos.api";

export default function SosScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alertId, setAlertId] = useState<number | null>(null);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [address, setAddress] = useState<string | null>(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pingInterval = useRef<any>(null);

  // Pulse animation for active SOS state
  useEffect(() => {
    let anim: Animated.CompositeAnimation | null = null;
    if (isActive) {
      anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      anim.start();
    } else {
      pulseAnim.setValue(1);
    }

    return () => {
      if (anim) anim.stop();
    };
  }, [isActive]);

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (pingInterval.current) {
        clearInterval(pingInterval.current);
      }
    };
  }, []);

  const getAddressFromCoords = async (latitude: number, longitude: number): Promise<string | null> => {
    try {
      const result = await Promise.race([
        Location.reverseGeocodeAsync({ latitude, longitude }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000))
      ]);
      if (result && Array.isArray(result) && result.length > 0) {
        const item = result[0];
        const parts = [
          item.name,
          item.street,
          item.district,
          item.city || item.subregion,
          item.region,
          item.country,
        ].filter(Boolean);
        return parts.join(", ") || null;
      }
    } catch (e) {
      console.warn("Lỗi lấy địa chỉ (bỏ qua):", e);
    }
    // Fallback: return lat,lng as text
    return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
  };

  const startSos = async () => {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Quyền định vị", "Bạn cần cấp quyền truy cập vị trí để gửi cứu hộ khẩn cấp.");
        setLoading(false);
        return;
      }

      let location;
      try {
        location = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 8000))
        ]);
      } catch (err) {
        // Fallback to last known position if current position times out or fails
        location = await Location.getLastKnownPositionAsync();
        if (!location) {
          Alert.alert("Lỗi", "Không thể lấy được vị trí hiện tại. Vui lòng bật GPS.");
          setLoading(false);
          return;
        }
      }

      const lat = (location as Location.LocationObject).coords.latitude;
      const lng = (location as Location.LocationObject).coords.longitude;

      setCoords({ latitude: lat, longitude: lng });

      const resolvedAddress = await getAddressFromCoords(lat, lng);
      setAddress(resolvedAddress);

      // Call API to create SOS Alert
      const res = await sosApi.triggerSos(
        lat,
        lng,
        resolvedAddress || "Không xác định",
        "Tôi gặp sự cố cần cứu hộ khẩn cấp!"
      );

      if (res.success && res.data?.alert_id) {
        const id = res.data.alert_id;
        setAlertId(id);
        setIsActive(true);

        // Start ping interval (every 15 seconds)
        pingInterval.current = setInterval(async () => {
          try {
            const loc = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            });
            const newLat = loc.coords.latitude;
            const newLng = loc.coords.longitude;
            setCoords({ latitude: newLat, longitude: newLng });
            
            const newAddr = await getAddressFromCoords(newLat, newLng);
            setAddress(newAddr);

            await sosApi.pingSos(id, newLat, newLng, newAddr || "Không xác định");
          } catch (err) {
            console.error("Lỗi gửi ping tọa độ SOS:", err);
          }
        }, 15000);
      } else {
        Alert.alert("Lỗi", "Không thể gửi tín hiệu cứu hộ lên hệ thống.");
      }
    } catch (e) {
      console.error(e);
      Alert.alert("Lỗi", "Đã xảy ra lỗi khi khởi chạy SOS.");
    } finally {
      setLoading(false);
    }
  };

  const stopSos = async () => {
    setLoading(true);
    try {
      if (pingInterval.current) {
        clearInterval(pingInterval.current);
        pingInterval.current = null;
      }

      await sosApi.stopSos(alertId || undefined);
      setIsActive(false);
      setAlertId(null);
      setCoords(null);
      setAddress(null);
      Alert.alert("Đã kết thúc", "Đã hủy tín hiệu SOS và thông báo trạng thái an toàn.");
    } catch (e) {
      console.error(e);
      Alert.alert("Lỗi", "Lỗi khi dừng gửi tín hiệu cứu hộ.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={["top", "left", "right"]}>
      {/* Header */}
      <View className="flex-row items-center border-b border-line bg-white px-4 pb-3 pt-2">
        <Pressable
          className="h-10 w-10 items-center justify-center rounded-full bg-slate-100"
          onPress={() => router.back()}
          disabled={isActive} // Vô hiệu hóa nút quay lại khi SOS đang kích hoạt để người dùng tập trung xử lý khẩn cấp
        >
          <Ionicons name="chevron-back" size={24} color={isActive ? "#cbd5e1" : "#0f172a"} />
        </Pressable>
        <Text className="ml-3 text-[20px] font-extrabold text-slate-900 flex-1">
          Cứu hộ khẩn cấp SOS
        </Text>
      </View>

      <View className="flex-1 px-5 items-center justify-center">
        {isActive ? (
          <View className="items-center w-full">
            {/* Glowing active circle */}
            <View className="w-64 h-64 justify-center items-center relative mb-8">
              <Animated.View
                style={{
                  transform: [{ scale: pulseAnim }],
                  position: "absolute",
                  width: 180,
                  height: 180,
                  borderRadius: 90,
                  backgroundColor: "rgba(239, 68, 68, 0.2)",
                }}
              />
              <Animated.View
                style={{
                  transform: [{ scale: pulseAnim }],
                  position: "absolute",
                  width: 220,
                  height: 220,
                  borderRadius: 110,
                  backgroundColor: "rgba(239, 68, 68, 0.1)",
                }}
              />
              <View className="w-40 h-40 rounded-full bg-red-500 justify-center items-center border-4 border-white shadow-xl shadow-red-500/50">
                <Text className="text-white text-3xl font-black tracking-widest">SOS</Text>
              </View>
            </View>

            <Text className="text-red-500 font-extrabold text-xl mb-2 text-center">
              🔴 TÍN HIỆU SOS ĐANG BẬT
            </Text>
            <Text className="text-slate-500 text-sm text-center px-4 mb-6 leading-[22px]">
              Vị trí GPS của bạn đang được truyền tải liên tục lên máy chủ quản trị viên Admin để kịp thời cung cấp cứu trợ.
            </Text>

            {/* GPS Info details card */}
            <View className="w-full bg-white rounded-2xl border border-line p-4 mb-8 shadow-sm">
              <View className="flex-row items-center gap-2 mb-2">
                <Ionicons name="location" size={18} color="#ef4444" />
                <Text className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Vị trí khẩn cấp
                </Text>
              </View>
              {coords ? (
                <View className="gap-1.5">
                  <Text className="text-xs text-slate-600 font-semibold">
                    Kinh độ: {coords.longitude.toFixed(6)} | Vĩ độ: {coords.latitude.toFixed(6)}
                  </Text>
                  <Text className="text-xs text-slate-500 leading-[18px]">
                    Địa chỉ: {address || "Đang lấy địa chỉ..."}
                  </Text>
                </View>
              ) : (
                <ActivityIndicator size="small" color="#ef4444" />
              )}
            </View>

            <Pressable
              disabled={loading}
              onPress={stopSos}
              className="w-full min-h-[50px] bg-slate-900 justify-center items-center rounded-2xl active:bg-slate-800"
            >
              {loading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text className="text-white font-bold text-base">Tôi đã an toàn - Dừng SOS</Text>
              )}
            </Pressable>
          </View>
        ) : (
          <View className="items-center w-full">
            {/* Ready big button */}
            <Pressable
              disabled={loading}
              onPress={startSos}
              className="w-48 h-48 rounded-full bg-red-100 justify-center items-center border border-red-200 shadow-md shadow-red-200/50 mb-10 active:bg-red-200/80"
            >
              <View pointerEvents="none" className="w-40 h-40 rounded-full bg-red-500 justify-center items-center shadow border-4 border-white active:bg-red-600">
                <Ionicons name="alert-circle" size={54} color="white" />
              </View>
            </Pressable>

            <Text className="text-slate-900 font-black text-xl mb-3 text-center">
              Nhấn để kích hoạt SOS
            </Text>
            <Text className="text-slate-500 text-sm text-center px-4 leading-[22px]">
              Tính năng này sử dụng trong trường hợp gặp tai nạn nguy hiểm hoặc sự cố bất ngờ. Hệ thống sẽ tự động thông báo và gửi vị trí liên tục đến cứu hộ.
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
