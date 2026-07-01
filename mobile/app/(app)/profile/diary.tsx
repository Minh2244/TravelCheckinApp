import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  TextInput,
  RefreshControl,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";

import { userApi } from "../../../src/services/user.api";
import { resolveBackendUrl } from "../../../src/lib/url";

type CheckinItem = {
  checkin_id: number;
  checkin_time: string;
  status: string;
  location_id: number;
  location_name: string;
  address: string;
  first_image: string | null;
  is_user_created: number | boolean;
  location_owner_id: number | null;
  location_latitude?: number | string | null;
  location_longitude?: number | string | null;
  checkin_latitude?: number | string | null;
  checkin_longitude?: number | string | null;
};

type DiaryItem = {
  diary_id: number;
  location_id: number | null;
  location_name?: string | null;
  mood: "happy" | "excited" | "neutral" | "sad" | "angry" | "tired";
  notes: string;
  images: string | string[];
  created_at: string;
};

const moodsList = [
  { value: "happy", label: "Vui vẻ", emoji: "😊", bg: "bg-emerald-50 text-emerald-700 border-emerald-100", activeBg: "bg-emerald-500 text-white border-emerald-500" },
  { value: "excited", label: "Hào hứng", emoji: "🤩", bg: "bg-amber-50 text-amber-700 border-amber-100", activeBg: "bg-amber-500 text-white border-amber-500" },
  { value: "neutral", label: "Bình thường", emoji: "😐", bg: "bg-slate-50 text-slate-700 border-slate-100", activeBg: "bg-slate-500 text-white border-slate-500" },
  { value: "sad", label: "Buồn bã", emoji: "😢", bg: "bg-blue-50 text-blue-700 border-blue-100", activeBg: "bg-blue-500 text-white border-blue-500" },
  { value: "angry", label: "Bực bội", emoji: "😠", bg: "bg-rose-50 text-rose-700 border-rose-100", activeBg: "bg-rose-500 text-white border-rose-500" },
  { value: "tired", label: "Mệt mỏi", emoji: "😴", bg: "bg-indigo-50 text-indigo-700 border-indigo-100", activeBg: "bg-indigo-500 text-white border-indigo-500" }
] as const;

export default function DiaryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [checkins, setCheckins] = useState<CheckinItem[]>([]);
  const [diaries, setDiaries] = useState<DiaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profileStats, setProfileStats] = useState<any>(null);

  // Modal States
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCheckin, setEditingCheckin] = useState<CheckinItem | null>(null);
  const [diaryNotes, setDiaryNotes] = useState("");
  const [diaryMood, setDiaryMood] = useState<typeof moodsList[number]["value"]>("happy");
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [savingDiary, setSavingDiary] = useState(false);

  const fetchProfileStats = async () => {
    try {
      const resp = await userApi.getProfile();
      if (resp?.success) {
        setProfileStats(resp.data?.stats);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchData = async (asRefresh = false) => {
    if (asRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [checkinsRes, diariesRes] = await Promise.all([
        userApi.getCheckins(),
        userApi.getDiaries(),
      ]);

      if (checkinsRes?.success) {
        setCheckins(checkinsRes.data || []);
      }
      if (diariesRes?.success) {
        setDiaries(diariesRes.data || []);
      }
      await fetchProfileStats();
    } catch (e) {
      console.error(e);
      Alert.alert("Lỗi", "Không thể tải dữ liệu hành trình.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  // Parse diary images cleanly
  const getDiaryImages = (diary: DiaryItem): string[] => {
    if (!diary.images) return [];
    if (Array.isArray(diary.images)) return diary.images;
    try {
      const parsed = JSON.parse(diary.images as unknown as string);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      if (typeof diary.images === "string" && String(diary.images).trim().length > 0) {
        return [String(diary.images).trim()];
      }
    }
    return [];
  };

  // Group checkins by location (matching website logic)
  const groupedCheckins = useMemo(() => {
    const groups: Record<string, {
      location_id: number;
      location_name: string;
      address: string;
      first_image: string | null;
      is_user_created: boolean;
      records: Array<{
        checkin_id: number;
        checkin_time: string;
        status: string;
      }>;
      originalItem: CheckinItem;
    }> = {};

    checkins.forEach((item) => {
      const isUserCreated = Number(item.is_user_created) === 1;
      const key = item.location_id ? `loc_${item.location_id}` : `name_${item.location_name}`;
      if (!groups[key]) {
        groups[key] = {
          location_id: item.location_id,
          location_name: item.location_name,
          address: item.address,
          first_image: item.first_image,
          is_user_created: isUserCreated,
          records: [],
          originalItem: item,
        };
      }
      groups[key].records.push({
        checkin_id: item.checkin_id,
        checkin_time: item.checkin_time,
        status: item.status,
      });
    });

    return Object.values(groups).sort((a, b) => {
      const timeA = new Date(a.records[0]?.checkin_time || 0).getTime();
      const timeB = new Date(b.records[0]?.checkin_time || 0).getTime();
      return timeB - timeA;
    });
  }, [checkins]);

  // Match location checkin with user diary
  const getDiaryForLocation = (locationId: number) => {
    return diaries.find((d) => d.location_id === locationId);
  };

  const handlePickPhotos = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Quyền truy cập", "Bạn cần cấp quyền truy cập thư viện để chọn ảnh.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets) {
      const uris = result.assets.map((asset) => asset.uri);
      setSelectedPhotos((prev) => [...prev, ...uris]);
    }
  };

  const openWriteDiary = (checkin: CheckinItem) => {
    const existing = getDiaryForLocation(checkin.location_id);
    setEditingCheckin(checkin);
    if (existing) {
      setDiaryNotes(existing.notes || "");
      setDiaryMood(existing.mood || "happy");
      setSelectedPhotos([]);
      setExistingImages(getDiaryImages(existing));
    } else {
      setDiaryNotes("");
      setDiaryMood("happy");
      setSelectedPhotos([]);
      setExistingImages([]);
    }
    setModalVisible(true);
  };

  const handleSaveDiary = async () => {
    if (!diaryNotes.trim() || !editingCheckin) return;
    setSavingDiary(true);

    try {
      const imageUrls: string[] = [...existingImages];

      // Upload new photos first
      if (selectedPhotos.length > 0) {
        for (const uri of selectedPhotos) {
          const uploadRes = await userApi.uploadReviewImage(uri);
          if (uploadRes.success && uploadRes.data?.image_url) {
            imageUrls.push(uploadRes.data.image_url);
          }
        }
      }

      const saveRes = await userApi.createDiary({
        location_id: editingCheckin.location_id,
        mood: diaryMood,
        notes: diaryNotes.trim(),
        images: imageUrls,
      });

      if (saveRes.success) {
        setModalVisible(false);
        await fetchData();
        Alert.alert("Thành công", "Đã lưu kỷ niệm hành trình!");
      } else {
        Alert.alert("Thất bại", saveRes.message || "Lỗi lưu kỷ niệm.");
      }
    } catch (e) {
      console.error(e);
      Alert.alert("Lỗi", "Không thể lưu kỷ niệm hành trình.");
    } finally {
      setSavingDiary(false);
    }
  };

  const handleDeleteDiary = (diaryId: number) => {
    Alert.alert(
      "Xác nhận xóa",
      "Bạn có chắc chắn muốn xóa kỷ niệm nhật ký này?",
      [
        { text: "Hủy" },
        {
          text: "Xóa",
          style: "destructive",
          onPress: async () => {
            try {
              const res = await userApi.deleteDiary(diaryId);
              if (res.success) {
                await fetchData();
              } else {
                Alert.alert("Lỗi", res.message || "Xóa thất bại.");
              }
            } catch (e) {
              console.error(e);
            }
          },
        },
      ]
    );
  };

  const getMilestoneInfo = (total: number) => {
    if (total >= 1 && total <= 3) {
      return {
        title: "Thám Hiểm Tập Sự",
        color: "text-teal-700 bg-teal-50 border-teal-200/50",
        description: "Bạn đang bắt đầu tích lũy những dấu chân đầu tiên. Những chân trời mới đang mở ra chào đón bạn.",
      };
    } else if (total >= 4 && total <= 10) {
      return {
        title: "Lãng Khách Muôn Phương",
        color: "text-amber-700 bg-amber-50 border-amber-200/50",
        description: "Những bước đi vững chãi và trải nghiệm phong phú. Bạn đã là một tay du hành cừ khôi trên mọi nẻo đường.",
      };
    } else if (total > 10) {
      return {
        title: "Bậc Thầy Dịch Chuyển",
        color: "text-purple-700 bg-purple-50 border-purple-200/50",
        description: "Không có giới hạn nào có thể ngăn cản bước chân bạn. Bản đồ thế giới chính là sân chơi của bạn.",
      };
    }
    return {
      title: "Tân Thủ Khởi Hành",
      color: "text-sky-700 bg-sky-50 border-indigo-200/50",
      description: "Chuyến đi đầu tiên luôn là trải nghiệm khó quên nhất. Hãy tiếp tục hành trình khám phá thế giới xung quanh.",
    };
  };

  if (loading) {
    return (
      <View className="flex-1 bg-surface justify-center items-center">
        <ActivityIndicator size="large" color="#a855f7" />
      </View>
    );
  }

  const milestone = getMilestoneInfo(checkins.length);

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
          Nhật ký hành trình
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void fetchData(true)} />
        }
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) }}
      >
        {/* Milestone Card */}
        <View className="m-4 bg-white rounded-2xl border border-line p-4 shadow-sm">
          <View className={`self-start px-3 py-1 rounded-full border ${milestone.color} mb-2.5`}>
            <Text className="text-xs font-bold">{milestone.title}</Text>
          </View>
          <Text className="text-[13px] text-slate-500 leading-[20px]">
            {milestone.description}
          </Text>

          <View className="h-[1px] bg-line w-full my-3.5" />

          {/* Travel statistics */}
          <View className="flex-row justify-between">
            <View className="items-center flex-1">
              <Text className="text-[10px] text-slate-400 font-bold uppercase">Lượt đi</Text>
              <Text className="text-xl font-extrabold text-slate-800 mt-1">{checkins.length}</Text>
            </View>
            <View className="w-[1px] bg-line" />
            <View className="items-center flex-1">
              <Text className="text-[10px] text-slate-400 font-bold uppercase">Địa điểm</Text>
              <Text className="text-xl font-extrabold text-slate-800 mt-1">{groupedCheckins.length}</Text>
            </View>
          </View>
        </View>

        <Text className="px-4 text-base font-extrabold text-slate-800 mb-3">
          Dòng thời gian chuyến đi
        </Text>

        {groupedCheckins.length === 0 ? (
          <View className="mx-4 bg-white rounded-2xl border border-line p-6 items-center">
            <Ionicons name="footsteps" size={40} color="#cbd5e1" />
            <Text className="text-sm font-bold text-slate-800 mt-3 text-center">
              Bạn chưa có lượt check-in nào
            </Text>
            <Text className="text-xs text-slate-400 text-center mt-1">
              Hãy quét QR hoặc check-in GPS tại các địa điểm để bắt đầu ghi nhật ký hành trình.
            </Text>
          </View>
        ) : (
          <View className="px-4">
            {groupedCheckins.map((group, idx) => {
              const diary = getDiaryForLocation(group.location_id);
              const diaryPhotosParsed = diary ? getDiaryImages(diary) : [];
              const moodItem = diary ? moodsList.find((m) => m.value === diary.mood) : null;

              return (
                <View key={group.location_id || idx} className="flex-row gap-4">
                  {/* Left timeline bar */}
                  <View className="items-center">
                    <View className="w-5 h-5 rounded-full bg-indigo-600 justify-center items-center">
                      <View className="w-2.5 h-2.5 rounded-full bg-white" />
                    </View>
                    {idx < groupedCheckins.length - 1 && (
                      <View className="w-[2px] bg-indigo-200 flex-1 my-1" />
                    )}
                  </View>

                  {/* Card Content */}
                  <View className="flex-1 bg-white rounded-2xl border border-line p-4 shadow-sm mb-4 overflow-hidden">
                    {/* Location Name & Details */}
                    <View className="flex-row justify-between items-start mb-2">
                      <View className="flex-1 mr-2">
                        <View className="flex-row items-center gap-1.5 flex-wrap">
                          <Text className="text-[15px] font-extrabold text-slate-800" numberOfLines={1}>
                            {group.location_name}
                          </Text>
                          <View className="px-2 py-0.5 bg-slate-100 border border-slate-200/50 rounded-full">
                            <Text className="text-[9px] text-slate-500 font-bold">
                              {group.is_user_created ? "Tự check-in" : "Hệ thống"}
                            </Text>
                          </View>
                        </View>
                        <Text className="text-[11px] text-slate-400 mt-0.5" numberOfLines={1}>
                          📍 {group.address}
                        </Text>
                      </View>
                    </View>

                    {/* Timeline Date & Count */}
                    <Text className="text-[10px] text-slate-400 font-medium mb-3">
                      Lần check-in gần nhất: {new Date(group.records[0]?.checkin_time).toLocaleDateString("vi-VN")} • Tổng cộng: {group.records.length} lần ghé thăm
                    </Text>

                    {/* Diary content */}
                    {diary ? (
                      <View className={`rounded-xl border border-line p-3 ${diary ? getMoodCardStyles(diary.mood) : ""}`}>
                        <View className="flex-row justify-between items-center mb-2">
                          {moodItem && (
                            <View className={`px-2 py-0.5 rounded border ${moodItem.bg} flex-row items-center gap-1`}>
                              <Text className="text-xs">{moodItem.emoji}</Text>
                              <Text className="text-[10px] font-bold">{moodItem.label}</Text>
                            </View>
                          )}
                          <View className="flex-row gap-2">
                            <Pressable onPress={() => openWriteDiary(group.originalItem)}>
                              <Text className="text-xs font-bold text-indigo-600">Sửa</Text>
                            </Pressable>
                            <Pressable onPress={() => handleDeleteDiary(diary.diary_id)}>
                              <Text className="text-xs font-bold text-red-600">Xóa</Text>
                            </Pressable>
                          </View>
                        </View>

                        <Text className="text-xs text-slate-800 leading-5">
                          "{diary.notes}"
                        </Text>

                        {/* Images */}
                        {diaryPhotosParsed.length > 0 && (
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            className="mt-3 gap-2 flex-row"
                          >
                            {diaryPhotosParsed.map((img, imgIdx) => (
                              <Image
                                key={imgIdx}
                                source={{ uri: resolveBackendUrl(img) || "" }}
                                className="w-16 h-16 rounded-lg mr-2"
                                resizeMode="cover"
                              />
                            ))}
                          </ScrollView>
                        )}
                      </View>
                    ) : (
                      <Pressable
                        onPress={() => openWriteDiary(group.originalItem)}
                        className="flex-row items-center justify-center border border-dashed border-indigo-300 bg-indigo-50/20 py-2.5 rounded-xl active:bg-indigo-50/50"
                      >
                        <Ionicons name="create-outline" size={16} color="#6366f1" />
                        <Text className="text-xs font-bold text-indigo-600 ml-1.5">
                          Lưu giữ kỷ niệm hành trình
                        </Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Diary Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-white rounded-t-3xl p-5 max-h-[85%]">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-base font-extrabold text-slate-900">
                Lưu Giữ Kỷ Niệm Hành Trình
              </Text>
              <Pressable onPress={() => setModalVisible(false)} className="p-1">
                <Ionicons name="close" size={24} color="#64748b" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text className="text-xs text-slate-400 font-bold uppercase mb-1.5">Địa điểm ghé thăm</Text>
              <Text className="text-[15px] font-extrabold text-slate-800 mb-4">
                {editingCheckin?.location_name}
              </Text>

              {/* Mood list */}
              <Text className="text-xs text-slate-400 font-bold uppercase mb-2">Cảm xúc của bạn thế nào?</Text>
              <View className="flex-row flex-wrap gap-2 mb-4">
                {moodsList.map((mood) => {
                  const isActive = diaryMood === mood.value;
                  return (
                    <Pressable
                      key={mood.value}
                      onPress={() => setDiaryMood(mood.value)}
                      className={`px-3 py-1.5 rounded-full border ${isActive ? mood.activeBg : mood.bg} flex-row items-center gap-1`}
                    >
                      <Text className="text-xs">{mood.emoji}</Text>
                      <Text className="text-xs font-bold">{mood.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Notes */}
              <Text className="text-xs text-slate-400 font-bold uppercase mb-1.5">Kể lại trải nghiệm của bạn</Text>
              <TextInput
                value={diaryNotes}
                onChangeText={setDiaryNotes}
                placeholder="Điểm này có gì đặc biệt, điều gì làm bạn nhớ nhất..."
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                className="border border-line rounded-xl p-3 text-xs text-slate-800 bg-slate-50 min-h-[100px] mb-4"
              />

              {/* Photos uploader */}
              <Text className="text-xs text-slate-400 font-bold uppercase mb-2">Hình ảnh kỷ niệm</Text>
              <View className="flex-row flex-wrap gap-2 mb-4">
                {/* Existing Images */}
                {existingImages.map((img, idx) => (
                  <View key={`existing-${idx}`} className="relative">
                    <Image source={{ uri: resolveBackendUrl(img) || "" }} className="w-16 h-16 rounded-lg" />
                    <Pressable
                      onPress={() => setExistingImages((prev) => prev.filter((_, i) => i !== idx))}
                      className="absolute -top-1.5 -right-1.5 bg-black/60 rounded-full p-0.5"
                    >
                      <Ionicons name="close" size={12} color="white" />
                    </Pressable>
                  </View>
                ))}

                {/* Selected Photos */}
                {selectedPhotos.map((uri, idx) => (
                  <View key={`selected-${idx}`} className="relative">
                    <Image source={{ uri }} className="w-16 h-16 rounded-lg" />
                    <Pressable
                      onPress={() => setSelectedPhotos((prev) => prev.filter((_, i) => i !== idx))}
                      className="absolute -top-1.5 -right-1.5 bg-black/60 rounded-full p-0.5"
                    >
                      <Ionicons name="close" size={12} color="white" />
                    </Pressable>
                  </View>
                ))}

                {/* Plus button */}
                <Pressable
                  onPress={handlePickPhotos}
                  className="w-16 h-16 rounded-lg border border-dashed border-slate-300 bg-slate-50 justify-center items-center"
                >
                  <Ionicons name="add" size={24} color="#64748b" />
                </Pressable>
              </View>
            </ScrollView>

            {/* Actions */}
            <View className="flex-row gap-4 mt-4">
              <Pressable
                disabled={savingDiary}
                onPress={() => setModalVisible(false)}
                className="flex-1 min-h-[48px] items-center justify-center rounded-xl bg-slate-100"
              >
                <Text className="text-slate-600 font-bold text-xs">Hủy bỏ</Text>
              </Pressable>
              <Pressable
                disabled={savingDiary || !diaryNotes.trim()}
                onPress={handleSaveDiary}
                className={`flex-1 min-h-[48px] items-center justify-center rounded-xl ${
                  savingDiary || !diaryNotes.trim() ? "bg-indigo-300" : "bg-indigo-600"
                }`}
              >
                {savingDiary ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text className="text-white font-bold text-xs">Lưu kỷ niệm</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// Mood styles helper function
const getMoodCardStyles = (moodValue: string) => {
  switch (moodValue) {
    case "happy":
      return "bg-emerald-50 border-emerald-100 text-emerald-800";
    case "excited":
      return "bg-amber-50 border-amber-100 text-amber-900";
    case "neutral":
      return "bg-slate-50 border-slate-100 text-slate-800";
    case "sad":
      return "bg-blue-50 border-blue-100 text-blue-900";
    case "angry":
      return "bg-rose-50 border-rose-100 text-rose-950";
    case "tired":
      return "bg-indigo-50 border-indigo-100 text-indigo-950";
    default:
      return "bg-indigo-50 border-indigo-100 text-indigo-950";
  }
};
