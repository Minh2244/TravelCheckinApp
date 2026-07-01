import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";

import { itineraryApi } from "../../src/services/itinerary.api";

export default function CreateItineraryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());

  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập tên hành trình.");
      return;
    }

    if (endDate < startDate) {
      Alert.alert("Lỗi", "Ngày kết thúc không được nhỏ hơn ngày khởi hành.");
      return;
    }

    setLoading(true);

    try {
      const res = await itineraryApi.createItinerary({
        title: title.trim(),
        description: description.trim() || undefined,
        start_date: startDate.toISOString().split("T")[0],
        end_date: endDate.toISOString().split("T")[0],
        items: [],
      });

      if (res.success && res.data) {
        Alert.alert("Thành công", "Đã tạo hành trình mới!");
        // Navigate to the editor for this itinerary detail day planner
        router.replace(`/itinerary/${res.data.itinerary_id}?edit=true`);
      } else {
        Alert.alert("Thất bại", res.message || "Tạo hành trình thất bại.");
      }
    } catch (e) {
      console.error(e);
      Alert.alert("Lỗi", "Không thể lưu hành trình.");
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
        >
          <Ionicons name="chevron-back" size={24} color="#0f172a" />
        </Pressable>
        <Text className="ml-3 text-[20px] font-extrabold text-slate-900 flex-1">
          Tạo hành trình du lịch
        </Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 20 }}
          className="flex-1"
        >
          {/* Title */}
          <Text className="text-xs text-slate-400 font-bold uppercase mb-1.5">Tên chuyến đi / Hành trình</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Ví dụ: Du hí Đà Lạt hè 2026, Đi phượt Cần Thơ..."
            className="border border-line rounded-xl px-4 py-3 text-xs text-slate-800 bg-white mb-4 shadow-sm"
          />

          {/* Description */}
          <Text className="text-xs text-slate-400 font-bold uppercase mb-1.5">Mô tả hành trình (không bắt buộc)</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Mô tả tóm tắt hoạt động chính..."
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            className="border border-line rounded-xl px-4 py-3 text-xs text-slate-800 bg-white min-h-[80px] mb-4 shadow-sm"
          />

          {/* Date Range selectors */}
          <View className="flex-row gap-4 mb-6">
            {/* Start Date */}
            <View className="flex-1">
              <Text className="text-xs text-slate-400 font-bold uppercase mb-1.5">Khởi hành</Text>
              <Pressable
                onPress={() => setShowStartPicker(true)}
                className="border border-line rounded-xl px-4 py-3 flex-row items-center justify-between bg-white shadow-sm"
              >
                <Text className="text-xs text-slate-800 font-semibold">
                  {startDate.toLocaleDateString("vi-VN")}
                </Text>
                <Ionicons name="calendar-outline" size={16} color="#64748b" />
              </Pressable>
              {showStartPicker && (
                <DateTimePicker
                  value={startDate}
                  mode="date"
                  display="default"
                  onChange={(event, date) => {
                    setShowStartPicker(false);
                    if (date) {
                      setStartDate(date);
                      if (endDate < date) {
                        setEndDate(date);
                      }
                    }
                  }}
                />
              )}
            </View>

            {/* End Date */}
            <View className="flex-1">
              <Text className="text-xs text-slate-400 font-bold uppercase mb-1.5">Kết thúc</Text>
              <Pressable
                onPress={() => setShowEndPicker(true)}
                className="border border-line rounded-xl px-4 py-3 flex-row items-center justify-between bg-white shadow-sm"
              >
                <Text className="text-xs text-slate-800 font-semibold">
                  {endDate.toLocaleDateString("vi-VN")}
                </Text>
                <Ionicons name="calendar-outline" size={16} color="#64748b" />
              </Pressable>
              {showEndPicker && (
                <DateTimePicker
                  value={endDate}
                  mode="date"
                  display="default"
                  minimumDate={startDate}
                  onChange={(event, date) => {
                    setShowEndPicker(false);
                    if (date) setEndDate(date);
                  }}
                />
              )}
            </View>
          </View>

          {/* Submit button */}
          <Pressable
            disabled={loading || !title.trim()}
            onPress={handleSave}
            className={`w-full min-h-[50px] justify-center items-center rounded-2xl ${
              loading || !title.trim() ? "bg-indigo-300" : "bg-indigo-600 active:bg-indigo-700"
            }`}
          >
            {loading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text className="text-white font-bold text-base">Tiếp tục lên lịch trình</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
