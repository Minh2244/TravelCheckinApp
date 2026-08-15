import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Modal,
  TextInput,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";

import { itineraryApi, ItineraryDetail, ItineraryItemInput } from "../../src/services/itinerary.api";
import { locationApi } from "../../src/services/location.api";
import type { LocationItem } from "../../src/types/location";
import { AppAlert as Alert } from "../../src/modules/ui/app-alert";

export default function ItineraryDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id, edit } = useLocalSearchParams<{ id: string; edit?: string }>();

  const [detail, setDetail] = useState<ItineraryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isEditMode, setIsEditMode] = useState(edit === "true");

  // Tab State
  const [activeDay, setActiveDay] = useState(1);

  // Modal State for Adding/Editing stops
  const [stopModalVisible, setStopModalVisible] = useState(false);
  const [editingStopIndex, setEditingStopIndex] = useState<number | null>(null);
  const [allLocations, setAllLocations] = useState<LocationItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showLocationList, setShowLocationList] = useState(false);

  // Form Fields for stops
  const [stopType, setStopType] = useState<"system" | "custom">("system");
  const [selectedLocation, setSelectedLocation] = useState<LocationItem | null>(null);
  const [customName, setCustomName] = useState("");
  const [customAddress, setCustomAddress] = useState("");
  const [stopTime, setStopTime] = useState("");
  const [stopNote, setStopNote] = useState("");
  const [stopCost, setStopCost] = useState("");
  const [customLat, setCustomLat] = useState<number | null>(null);
  const [customLng, setCustomLng] = useState<number | null>(null);
  const [mapPickerVisible, setMapPickerVisible] = useState(false);

  // Trip Info Edit State
  const [tripInfoModalVisible, setTripInfoModalVisible] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const fetchDetail = async (asRefresh = false) => {
    if (!id) return;
    if (asRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [detailRes, locationsRes] = await Promise.all([
        itineraryApi.getItineraryDetail(id),
        locationApi.getLocations().catch(() => ({ success: false, data: [] })),
      ]);

      if (detailRes?.success && detailRes.data) {
        setDetail(detailRes.data);
      }
      if (locationsRes?.success && locationsRes.data) {
        setAllLocations(locationsRes.data);
      }
    } catch (e) {
      console.error(e);
      Alert.alert("Lỗi", "Không thể tải chi tiết lịch trình.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void fetchDetail();
  }, [id]);

  // Calculate day list from start_date & end_date
  const daysList = useMemo(() => {
    if (!detail) return [];
    const start = new Date(detail.start_date);
    const end = new Date(detail.end_date);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    const list = [];
    for (let i = 1; i <= diffDays; i++) {
      list.push(i);
    }
    return list;
  }, [detail]);

  // Filters items for the currently selected Day Tab
  const activeDayItems = useMemo(() => {
    if (!detail?.items) return [];
    return detail.items
      .filter((item) => Number(item.day_number) === activeDay)
      .sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0));
  }, [detail, activeDay]);

  // Handle location search filtering
  const filteredLocations = useMemo(() => {
    if (!searchQuery.trim()) return allLocations;
    return allLocations.filter((loc) =>
      loc.location_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      loc.address?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [allLocations, searchQuery]);

  const handleToggleVisited = async (item: ItineraryItemInput) => {
    if (!detail || !(item.item_id || item.itinerary_item_id)) return;
    const currentVisited = !!item.is_visited || !!item.visited_at;

    // Optimistic UI state update
    setDetail((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        items: prev.items.map((i) =>
          (i.item_id || i.itinerary_item_id) === (item.item_id || item.itinerary_item_id)
            ? { ...i, is_visited: !currentVisited, visited_at: !currentVisited ? new Date().toISOString() : null }
            : i
        ),
      };
    });

    try {
      await itineraryApi.toggleVisited(detail.itinerary_id, (item.item_id || item.itinerary_item_id) as number, !currentVisited);
    } catch (e) {
      console.error(e);
      // Revert if error
      setDetail((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          items: prev.items.map((i) =>
            (i.item_id || i.itinerary_item_id) === (item.item_id || item.itinerary_item_id)
              ? { ...i, is_visited: currentVisited, visited_at: currentVisited ? new Date().toISOString() : null }
              : i
          ),
        };
      });
      Alert.alert("Lỗi", "Không thể cập nhật trạng thái ghé thăm.");
    }
  };

  const openAddStopModal = () => {
    setEditingStopIndex(null);
    setStopType("system");
    setSelectedLocation(null);
    setCustomName("");
    setCustomAddress("");
    setStopTime("");
    setStopNote("");
    setStopCost("");
    setSearchQuery("");
    setShowLocationList(false);
    setCustomLat(null);
    setCustomLng(null);
    setStopModalVisible(true);
  };

  const openEditStopModal = (itemIndex: number, item: ItineraryItemInput) => {
    setEditingStopIndex(itemIndex);
    if (item.location_id) {
      setStopType("system");
      const matched = allLocations.find((l) => l.location_id === item.location_id);
      setSelectedLocation(matched || null);
      setSearchQuery(matched?.location_name || "");
    } else {
      setStopType("custom");
      setCustomName(item.custom_name || "");
      setCustomAddress(item.custom_address || "");
    }
    setStopTime(item.time || "");
    setStopNote(item.note || "");
    setStopCost(item.estimated_cost ? String(item.estimated_cost) : "");
    setCustomLat(item.custom_lat ? Number(item.custom_lat) : null);
    setCustomLng(item.custom_lng ? Number(item.custom_lng) : null);
    setStopModalVisible(true);
  };

  const saveItineraryStops = async (updatedItems: ItineraryItemInput[]) => {
    if (!detail) return;
    try {
      const formatYMD = (dateString: string) => {
        const d = new Date(dateString);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      };

      const res = await itineraryApi.updateItinerary(detail.itinerary_id, {
        title: detail.title,
        description: detail.description || undefined,
        start_date: formatYMD(detail.start_date),
        end_date: formatYMD(detail.end_date),
        items: updatedItems,
      });

      if (res.success && res.data) {
        setDetail(res.data);
      } else {
        Alert.alert("Lỗi", res.message || "Cập nhật lịch trình thất bại.");
      }
    } catch (e: any) {
      console.error(e);
      Alert.alert("Lỗi", e?.response?.data?.message || e.message || "Lỗi mạng hoặc không thể kết nối đến máy chủ.");
    }
  };

  const handleSaveTripInfo = async () => {
    if (!detail) return;
    if (!editTitle.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập tên chuyến đi.");
      return;
    }
    try {
      const formatYMD = (dateString: string) => {
        const d = new Date(dateString);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      };

      const res = await itineraryApi.updateItinerary(detail.itinerary_id, {
        title: editTitle.trim(),
        description: editDesc.trim() || undefined,
        start_date: formatYMD(detail.start_date),
        end_date: formatYMD(detail.end_date),
        items: detail.items,
      });

      if (res.success && res.data) {
        setDetail(res.data);
        setTripInfoModalVisible(false);
        Alert.alert("Thành công", "Đã cập nhật thông tin chuyến đi.");
      } else {
        Alert.alert("Lỗi", res.message || "Cập nhật thất bại.");
      }
    } catch (e: any) {
      console.error(e);
      Alert.alert("Lỗi", e?.response?.data?.message || "Lỗi mạng.");
    }
  };

  const handleSaveStop = async () => {
    if (!detail) return;

    if (stopType === "system" && !selectedLocation) {
      Alert.alert("Lỗi", "Vui lòng chọn một địa điểm trên hệ thống.");
      return;
    }
    if (stopType === "custom" && !customName.trim()) {
      Alert.alert("Lỗi", "Vui lòng điền tên địa điểm tự do.");
      return;
    }

    const newItem: ItineraryItemInput = {
      day_number: activeDay,
      time: stopTime.trim() || null,
      note: stopNote.trim() || null,
      estimated_cost: stopCost.trim() ? Number(stopCost) : null,
      is_visited: false,
      visited_at: null,
    };

    if (stopType === "system" && selectedLocation) {
      newItem.location_id = selectedLocation.location_id;
      newItem.custom_name = selectedLocation.location_name;
      newItem.custom_address = selectedLocation.address;
    } else {
      newItem.location_id = null;
      newItem.custom_name = customName.trim();
      newItem.custom_address = customAddress.trim() || null;
      newItem.custom_lat = customLat;
      newItem.custom_lng = customLng;
    }

    let updatedItems = [...detail.items];

    if (editingStopIndex !== null) {
      // Find the item index in the whole items array
      const activeItemsSorted = [...activeDayItems];
      const itemToReplace = activeItemsSorted[editingStopIndex];
      const indexInMain = updatedItems.findIndex(
        (x) =>
          (x.item_id || x.itinerary_item_id) === (itemToReplace.item_id || itemToReplace.itinerary_item_id) &&
          x.custom_name === itemToReplace.custom_name
      );

      if (indexInMain !== -1) {
        // Retain ID and sort order
        newItem.item_id = itemToReplace.item_id || itemToReplace.itinerary_item_id;
        newItem.sort_order = itemToReplace.sort_order;
        newItem.is_visited = itemToReplace.is_visited;
        newItem.visited_at = itemToReplace.visited_at;
        updatedItems[indexInMain] = newItem;
      }
    } else {
      // Add new item at the end of the day
      newItem.sort_order = activeDayItems.length + 1;
      updatedItems.push(newItem);
    }

    setStopModalVisible(false);
    await saveItineraryStops(updatedItems);
  };

  const handleStartNav = (item: any) => {
    const lat = item.location_lat || item.custom_lat;
    const lng = item.location_lng || item.custom_lng;
    if (!lat || !lng) {
      Alert.alert("Thông báo", "Địa điểm này chưa có tọa độ để dẫn đường.");
      return;
    }
    router.push({
      pathname: "/explore",
      params: {
        focusRouteLat: lat.toString(),
        focusRouteLng: lng.toString(),
        focusRouteName: item.custom_name || item.location_name || "",
        focusRouteAddress: item.custom_address || item.location_address || "",
      },
    });
  };

  const handleDeleteStop = (itemIndex: number) => {
    if (!detail) return;
    const activeItemsSorted = [...activeDayItems];
    const itemToDelete = activeItemsSorted[itemIndex];

    Alert.alert("Xóa điểm dừng", "Bạn chắc chắn muốn xóa điểm dừng chân này?", [
      { text: "Hủy" },
      {
        text: "Xóa",
        style: "destructive",
        onPress: async () => {
          const updatedItems = detail.items.filter(
            (x) =>
              !(
                (x.item_id || x.itinerary_item_id) === (itemToDelete.item_id || itemToDelete.itinerary_item_id) &&
                x.custom_name === itemToDelete.custom_name
              )
          );
          await saveItineraryStops(updatedItems);
        },
      },
    ]);
  };

  const handleReorderStop = async (itemIndex: number, direction: "up" | "down") => {
    if (!detail) return;
    const activeItemsSorted = [...activeDayItems];
    if (direction === "up" && itemIndex === 0) return;
    if (direction === "down" && itemIndex === activeItemsSorted.length - 1) return;

    const swapIndex = direction === "up" ? itemIndex - 1 : itemIndex + 1;
    
    // Swap sort orders
    const tempOrder = activeItemsSorted[itemIndex].sort_order;
    activeItemsSorted[itemIndex].sort_order = activeItemsSorted[swapIndex].sort_order;
    activeItemsSorted[swapIndex].sort_order = tempOrder;

    // Map changes back to main items list
    const updatedItems = detail.items.map((mainItem) => {
      const matchedIdx = activeItemsSorted.findIndex(
        (i) => (i.item_id || i.itinerary_item_id) === (mainItem.item_id || mainItem.itinerary_item_id) && i.custom_name === mainItem.custom_name
      );
      if (matchedIdx !== -1) {
        return activeItemsSorted[matchedIdx];
      }
      return mainItem;
    });

    await saveItineraryStops(updatedItems);
  };

  if (loading) {
    return (
      <View className="flex-1 bg-surface justify-center items-center">
        <ActivityIndicator size="large" color="#a855f7" />
      </View>
    );
  }

  if (!detail) {
    return (
      <View className="flex-1 bg-surface justify-center items-center p-6">
        <Text className="text-slate-800 font-bold mb-4">Không tìm thấy hành trình</Text>
        <Pressable onPress={() => router.back()} className="bg-indigo-600 px-4 py-2 rounded-xl">
          <Text className="text-white font-bold">Quay lại</Text>
        </Pressable>
      </View>
    );
  }

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
        <View className="ml-3 flex-1 mr-2">
          <View className="flex-row items-center">
            <Text className="text-[16px] font-extrabold text-slate-900 flex-shrink" numberOfLines={1}>
              {detail.title}
            </Text>
            {isEditMode && (
              <Pressable 
                onPress={() => {
                  setEditTitle(detail.title);
                  setEditDesc(detail.description || "");
                  setTripInfoModalVisible(true);
                }}
                className="ml-2 p-1"
              >
                <Ionicons name="pencil" size={14} color="#6366f1" />
              </Pressable>
            )}
          </View>
          <Text className="text-[10px] text-slate-400 font-bold mt-0.5">
            Ngày: {new Date(detail.start_date).toLocaleDateString("vi-VN")} - {new Date(detail.end_date).toLocaleDateString("vi-VN")}
          </Text>
        </View>
        
        {/* Toggle Edit/View Mode */}
        <Pressable
          onPress={() => setIsEditMode((prev) => !prev)}
          className={`px-3 py-1.5 rounded-full border ${
            isEditMode ? "bg-indigo-50 border-indigo-200" : "bg-slate-100 border-slate-200"
          }`}
        >
          <Text className="text-[10px] font-bold text-indigo-700">
            {isEditMode ? "💾 Lưu / Xem" : "⚙️ Chỉnh sửa"}
          </Text>
        </Pressable>
      </View>

      {/* Days Tabs bar */}
      <View className="bg-white border-b border-line py-2">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-4">
          {daysList.map((day) => {
            const isActive = activeDay === day;
            return (
              <Pressable
                key={day}
                onPress={() => setActiveDay(day)}
                className={`px-4 py-1.5 rounded-full border mr-2 ${
                  isActive
                    ? "bg-indigo-600 border-indigo-600"
                    : "bg-slate-50 border-slate-200"
                }`}
              >
                <Text
                  className={`text-[11px] font-bold ${
                    isActive ? "text-white" : "text-slate-600"
                  }`}
                >
                  Ngày {day}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void fetchDetail(true)} />
        }
        contentContainerStyle={{ paddingBottom: 100 }}
        className="flex-1 bg-slate-50/50"
      >
        {activeDayItems.length === 0 ? (
          <View className="m-4 bg-white border border-line rounded-2xl p-8 items-center justify-center">
            <Ionicons name="map-outline" size={40} color="#cbd5e1" />
            <Text className="text-sm font-bold text-slate-800 mt-3 text-center">
              Chưa có điểm dừng cho Ngày {activeDay}
            </Text>
            <Text className="text-xs text-slate-400 text-center mt-1">
              {isEditMode
                ? "Hãy nhấn nút phía dưới để lên kế hoạch dừng chân tham quan cho ngày này."
                : "Chuyển sang chế độ Chỉnh sửa ở góc trên bên phải để thêm địa điểm."}
            </Text>
          </View>
        ) : (
          <View className="p-4 gap-4">
            {activeDayItems.map((item, idx) => {
              const isVisited = !!item.is_visited || !!item.visited_at;
              return (
                <View
                  key={idx}
                  className={`bg-white border rounded-2xl p-4 shadow-sm flex-row gap-3 ${
                    isVisited ? "border-emerald-200 bg-emerald-50/20" : "border-line"
                  }`}
                >
                  {/* View Mode Checkbox vs Edit Mode controls */}
                  {!isEditMode ? (
                    <Pressable
                      onPress={() => void handleToggleVisited(item)}
                      className="justify-center pt-1"
                    >
                      <Ionicons
                        name={isVisited ? "checkmark-circle" : "ellipse-outline"}
                        size={24}
                        color={isVisited ? "#10b981" : "#cbd5e1"}
                      />
                    </Pressable>
                  ) : (
                    <View className="justify-between items-center py-1">
                      <Pressable
                        disabled={idx === 0}
                        onPress={() => void handleReorderStop(idx, "up")}
                      >
                        <Ionicons name="chevron-up" size={16} color={idx === 0 ? "#cbd5e1" : "#6366f1"} />
                      </Pressable>
                      <Pressable
                        disabled={idx === activeDayItems.length - 1}
                        onPress={() => void handleReorderStop(idx, "down")}
                      >
                        <Ionicons
                          name="chevron-down"
                          size={16}
                          color={idx === activeDayItems.length - 1 ? "#cbd5e1" : "#6366f1"}
                        />
                      </Pressable>
                    </View>
                  )}

                  {/* Stop Details */}
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2 flex-wrap">
                      {item.time && (
                        <View className="px-2 py-0.5 bg-slate-100 border border-slate-200/50 rounded-md">
                          <Text className="text-[10px] text-slate-500 font-bold">{item.time}</Text>
                        </View>
                      )}
                      <Text className="text-xs font-black text-slate-800 flex-1" numberOfLines={1}>
                        {item.custom_name}
                      </Text>
                    </View>
                    {item.custom_address ? (
                      <Text className="text-[10px] text-slate-400 mt-1" numberOfLines={1}>
                        Địa chỉ: {item.custom_address}
                      </Text>
                    ) : null}

                    {item.note && (
                      <Text className="text-xs text-slate-500 mt-1.5 italic leading-[18px]">
                        "{item.note}"
                      </Text>
                    )}

                    {item.estimated_cost ? (
                      <Text className="text-[10px] text-rose-600 font-bold mt-2">
                        💰 Dự chi: {Number(item.estimated_cost).toLocaleString("vi-VN")}đ
                      </Text>
                    ) : null}

                    {/* Start Trip Button */}
                    {!isEditMode && (item.location_lat || item.custom_lat) && (
                      <Pressable
                        onPress={() => handleStartNav(item)}
                        className="mt-2.5 flex-row items-center justify-center bg-indigo-50 border border-indigo-100 py-2 rounded-xl active:bg-indigo-100"
                      >
                        <Ionicons name="navigate-circle" size={18} color="#4f46e5" />
                        <Text className="text-[11px] font-bold text-indigo-700 ml-1">Bắt đầu</Text>
                      </Pressable>
                    )}
                  </View>

                  {/* Edit mode actions */}
                  {isEditMode && (
                    <View className="justify-center gap-3 items-center">
                      <Pressable onPress={() => void handleToggleVisited(item)} className="p-1">
                        <Ionicons
                          name={isVisited ? "checkmark-circle" : "ellipse-outline"}
                          size={20}
                          color={isVisited ? "#10b981" : "#cbd5e1"}
                        />
                      </Pressable>
                      <Pressable onPress={() => openEditStopModal(idx, item)} className="p-1">
                        <Ionicons name="create-outline" size={18} color="#6366f1" />
                      </Pressable>
                      <Pressable onPress={() => handleDeleteStop(idx)} className="p-1">
                        <Ionicons name="trash-outline" size={18} color="#ef4444" />
                      </Pressable>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Add Stop Trigger (Visible only in Edit Mode) */}
      {isEditMode && (
        <View
          style={{ paddingBottom: Math.max(insets.bottom, 16) }}
          className="absolute bottom-0 left-0 right-0 p-4 bg-white/95 border-t border-line flex-row justify-center"
        >
          <Pressable
            onPress={openAddStopModal}
            className="w-full bg-indigo-600 min-h-[48px] justify-center items-center rounded-xl shadow active:bg-indigo-700"
          >
            <Text className="text-white font-bold text-xs">+ Thêm điểm dừng tham quan</Text>
          </Pressable>
        </View>
      )}

      {/* Add/Edit Stop Modal */}
      <Modal visible={stopModalVisible} animationType="slide" transparent>
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-white rounded-t-3xl p-5 max-h-[88%]">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-base font-extrabold text-slate-900">
                {editingStopIndex !== null ? "Cập Nhật Điểm Dừng" : "Thêm Điểm Dừng"}
              </Text>
              <Pressable onPress={() => setStopModalVisible(false)} className="p-1">
                <Ionicons name="close" size={24} color="#64748b" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Type Select */}
              <Text className="text-xs text-slate-400 font-bold uppercase mb-2">Loại địa điểm</Text>
              <View className="flex-row gap-3 mb-4">
                <Pressable
                  onPress={() => setStopType("system")}
                  className={`flex-1 py-2 rounded-xl border items-center ${
                    stopType === "system"
                      ? "bg-indigo-50 border-indigo-400 text-indigo-700"
                      : "bg-slate-50 border-slate-200 text-slate-500"
                  }`}
                >
                  <Text className="text-xs font-bold">Hệ thống gợi ý</Text>
                </Pressable>
                <Pressable
                  onPress={() => setStopType("custom")}
                  className={`flex-1 py-2 rounded-xl border items-center ${
                    stopType === "custom"
                      ? "bg-indigo-50 border-indigo-400 text-indigo-700"
                      : "bg-slate-50 border-slate-200 text-slate-500"
                  }`}
                >
                  <Text className="text-xs font-bold">Địa điểm tự do</Text>
                </Pressable>
              </View>

              {/* System Location Search & Selector */}
              {stopType === "system" ? (
                <View className="mb-4 relative">
                  <Text className="text-xs text-slate-400 font-bold uppercase mb-1.5">Tìm địa điểm</Text>
                  <TextInput
                    value={searchQuery}
                    onChangeText={(text) => {
                      setSearchQuery(text);
                      setShowLocationList(true);
                    }}
                    placeholder="Gõ tên khách sạn, nhà hàng, điểm du lịch..."
                    className="border border-line rounded-xl px-4 py-3 text-xs text-slate-800 bg-white"
                  />
                  {showLocationList && searchQuery.trim().length > 0 && (
                    <View className="border border-line rounded-xl mt-1.5 max-h-[160px] overflow-hidden bg-white shadow-lg">
                      <ScrollView nestedScrollEnabled>
                        {filteredLocations.map((loc) => (
                          <Pressable
                            key={loc.location_id}
                            onPress={() => {
                              setSelectedLocation(loc);
                              setSearchQuery(loc.location_name);
                              setShowLocationList(false);
                            }}
                            className="p-3 border-b border-slate-50 active:bg-slate-50"
                          >
                            <Text className="text-xs font-bold text-slate-800">{loc.location_name}</Text>
                            <Text className="text-[10px] text-slate-400 mt-0.5" numberOfLines={1}>{loc.address}</Text>
                          </Pressable>
                        ))}
                        {filteredLocations.length === 0 && (
                          <Text className="p-3 text-center text-slate-400 text-xs">Không tìm thấy kết quả</Text>
                        )}
                      </ScrollView>
                    </View>
                  )}
                </View>
              ) : (
                <View className="gap-3 mb-4">
                  <View>
                    <Text className="text-xs text-slate-400 font-bold uppercase mb-1.5">Tên địa điểm tự tạo</Text>
                    <TextInput
                      value={customName}
                      onChangeText={setCustomName}
                      placeholder="Ví dụ: Ăn sáng bún bò đầu hẻm, Ghé nhà bạn..."
                      className="border border-line rounded-xl px-4 py-3 text-xs text-slate-800 bg-white"
                    />
                  </View>
                  <View>
                    <Text className="text-xs text-slate-400 font-bold uppercase mb-1.5">Tọa độ & Địa chỉ</Text>
                    <Pressable
                      onPress={() => setMapPickerVisible(true)}
                      className="border border-line rounded-xl px-4 py-3 bg-white flex-row items-center justify-between"
                    >
                      <Text className={`text-xs ${customLat && customLng ? "text-slate-800" : "text-slate-400"}`} numberOfLines={1}>
                        {customLat && customLng ? `${customLat.toFixed(5)}, ${customLng.toFixed(5)}` : "Chạm để chọn trên bản đồ..."}
                      </Text>
                      <Ionicons name="map-outline" size={16} color="#6366f1" />
                    </Pressable>
                    <TextInput
                      value={customAddress}
                      onChangeText={customAddress => setCustomAddress(customAddress)}
                      placeholder="Số nhà, tên đường, khu vực..."
                      className="border border-line rounded-xl px-4 py-3 text-xs text-slate-800 bg-white mt-3"
                    />
                  </View>
                </View>
              )}

              {/* Time */}
              <Text className="text-xs text-slate-400 font-bold uppercase mb-1.5">Thời gian dự kiến</Text>
              <TextInput
                value={stopTime}
                onChangeText={setStopTime}
                placeholder="Ví dụ: 08:00, Sáng sớm, Chiều tà..."
                className="border border-line rounded-xl px-4 py-3 text-xs text-slate-800 bg-white mb-4"
              />

              {/* Notes */}
              <Text className="text-xs text-slate-400 font-bold uppercase mb-1.5">Ghi chú hoạt động</Text>
              <TextInput
                value={stopNote}
                onChangeText={setStopNote}
                placeholder="Các món nên ăn, lưu ý đường sá..."
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                className="border border-line rounded-xl p-3 text-xs text-slate-800 bg-white min-h-[70px] mb-4"
              />

              {/* Estimated Cost */}
              <Text className="text-xs text-slate-400 font-bold uppercase mb-1.5">Chi phí dự kiến (đ)</Text>
              <TextInput
                value={stopCost}
                onChangeText={setStopCost}
                placeholder="Ví dụ: 150000"
                keyboardType="numeric"
                className="border border-line rounded-xl px-4 py-3 text-xs text-slate-800 bg-white mb-4"
              />
            </ScrollView>

            {/* Actions */}
            <View className="flex-row gap-4 mt-2">
              <Pressable
                onPress={() => setStopModalVisible(false)}
                className="flex-1 min-h-[48px] items-center justify-center rounded-xl bg-slate-100"
              >
                <Text className="text-slate-600 font-bold text-xs">Hủy bỏ</Text>
              </Pressable>
              <Pressable
                onPress={handleSaveStop}
                className="flex-1 min-h-[48px] items-center justify-center rounded-xl bg-indigo-600 active:bg-indigo-700"
              >
                <Text className="text-white font-bold text-xs">Xác nhận</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Map Picker Modal */}
      <Modal visible={mapPickerVisible} animationType="slide" transparent>
        <View className="flex-1 bg-white">
          <SafeAreaView className="flex-1" edges={["top", "bottom"]}>
            <View className="flex-row items-center justify-between px-4 py-3 border-b border-line bg-white z-10">
              <Text className="text-base font-extrabold text-slate-900">Chọn vị trí</Text>
              <Pressable onPress={() => setMapPickerVisible(false)} className="p-1">
                <Ionicons name="close" size={24} color="#64748b" />
              </Pressable>
            </View>
            <View className="flex-1 relative">
              <MapView
                provider={PROVIDER_GOOGLE}
                style={{ flex: 1 }}
                initialRegion={{
                  latitude: customLat || 10.0452,
                  longitude: customLng || 105.7469,
                  latitudeDelta: 0.05,
                  longitudeDelta: 0.05,
                }}
                onPress={(e) => {
                  setCustomLat(e.nativeEvent.coordinate.latitude);
                  setCustomLng(e.nativeEvent.coordinate.longitude);
                }}
              >
                {customLat && customLng && (
                  <Marker coordinate={{ latitude: customLat, longitude: customLng }} />
                )}
              </MapView>
              <View className="absolute bottom-4 left-4 right-4 bg-white rounded-xl shadow-lg border border-slate-100 p-4">
                <Text className="text-xs text-slate-500 mb-3">Chạm vào bản đồ để chọn tọa độ</Text>
                <Pressable
                  onPress={() => setMapPickerVisible(false)}
                  disabled={!customLat || !customLng}
                  className={`w-full py-3 rounded-xl items-center ${
                    customLat && customLng ? "bg-indigo-600" : "bg-slate-200"
                  }`}
                >
                  <Text className={`font-bold text-xs ${customLat && customLng ? "text-white" : "text-slate-400"}`}>
                    Xác nhận tọa độ
                  </Text>
                </Pressable>
              </View>
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Trip Info Edit Modal */}
      <Modal visible={tripInfoModalVisible} animationType="fade" transparent>
        <View className="flex-1 bg-black/60 justify-center px-4">
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
            <View className="bg-white rounded-3xl p-5 shadow-xl">
              <View className="flex-row justify-between items-center mb-4">
                <Text className="text-base font-extrabold text-slate-900">Thông tin chuyến đi</Text>
                <Pressable onPress={() => setTripInfoModalVisible(false)} className="p-1">
                  <Ionicons name="close" size={24} color="#64748b" />
                </Pressable>
              </View>

              <Text className="text-xs text-slate-400 font-bold uppercase mb-1.5">Tên chuyến đi</Text>
              <TextInput
                value={editTitle}
                onChangeText={setEditTitle}
                placeholder="Ví dụ: Khám phá Phú Quốc 3N2Đ"
                className="border border-line rounded-xl px-4 py-3 text-sm text-slate-800 bg-white mb-4"
              />

              <Text className="text-xs text-slate-400 font-bold uppercase mb-1.5">Mô tả (không bắt buộc)</Text>
              <TextInput
                value={editDesc}
                onChangeText={setEditDesc}
                placeholder="Chuyến đi cùng gia đình..."
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                className="border border-line rounded-xl p-4 text-sm text-slate-800 bg-white min-h-[80px] mb-6"
              />

              <View className="flex-row gap-4">
                <Pressable
                  onPress={() => setTripInfoModalVisible(false)}
                  className="flex-1 py-3 items-center justify-center rounded-xl bg-slate-100"
                >
                  <Text className="text-slate-600 font-bold text-sm">Hủy</Text>
                </Pressable>
                <Pressable
                  onPress={handleSaveTripInfo}
                  className="flex-1 py-3 items-center justify-center rounded-xl bg-indigo-600 active:bg-indigo-700"
                >
                  <Text className="text-white font-bold text-sm">Lưu thay đổi</Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
