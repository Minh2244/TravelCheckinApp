import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  TextInput,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  ToastAndroid,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";

import { chatApi } from "../../../src/services/chat.api";
import { userApi } from "../../../src/services/user.api";
import { resolveBackendUrl } from "../../../src/lib/url";

type ChatMessage = {
  history_id: number;
  conversation_id: number;
  prompt: string;
  response: string;
  response_type: string;
  metadata: string | any | null;
  created_at: string;
};

// Default guided prompt chips (mục 27 kế hoạch)
const DEFAULT_CHIPS = [
  { id: "chip_1", text: "Nay nên đi đâu?" },
  { id: "chip_2", text: "Tui đói, kiếm chỗ ăn đi" },
  { id: "chip_3", text: "Trời nóng, tìm chỗ mát" },
  { id: "chip_4", text: "Quán cafe yên tĩnh gần đây" },
  { id: "chip_5", text: "Khách sạn giá ổn" },
  { id: "chip_6", text: "Có voucher nào không?" },
];

export default function AiChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<number | undefined>(undefined);
  const [showChips, setShowChips] = useState(true);
  const [savedLocations, setSavedLocations] = useState<Set<number>>(new Set());
  const [savingIds, setSavingIds] = useState<Set<number>>(new Set());

  const scrollRef = useRef<ScrollView>(null);
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  const clickedChipRef = useRef(new Set<string>());
  const lastChipClickRef = useRef<number>(0);

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener("keyboardDidHide", () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const fetchHistory = async () => {
    try {
      const resp = await chatApi.getAiHistory();
      if (resp?.success && resp.data) {
        setHistory(resp.data);
        if (resp.data.length > 0) {
          setConversationId(resp.data[resp.data.length - 1].conversation_id);
          setShowChips(false);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchHistory();
  }, []);

  // Auto scroll to bottom when history or sending state changes
  useEffect(() => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [history, sending]);

  const handleSend = async (messageText?: string) => {
    const textToSend = (messageText || prompt).trim();
    if (!textToSend || sending) return;

    if (!messageText) {
      setPrompt("");
    }
    setShowChips(false);
    setSending(true);

    // Create temporary message for optimistic UI
    const tempId = Date.now();
    const tempMsg: ChatMessage = {
      history_id: tempId,
      conversation_id: conversationId || 0,
      prompt: textToSend,
      response: "",
      response_type: "text",
      metadata: null,
      created_at: new Date().toISOString(),
    };

    setHistory((prev) => [...prev, tempMsg]);

    try {
      // Gather context (GPS location)
      let context = null;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          context = {
            current_location: {
              lat: loc.coords.latitude,
              lng: loc.coords.longitude,
            },
          };
        }
      } catch (err) {
        console.log("Không lấy được GPS cho ngữ cảnh AI:", err);
      }

      const res = await chatApi.chatWithAi(textToSend, conversationId, context);
      if (res?.success && res.data) {
        setConversationId(res.data.conversationId);
        await fetchHistory();
      } else {
        Alert.alert("Lỗi", "Không thể gửi tin nhắn đến AI.");
        setHistory((prev) => prev.filter((m) => m.history_id !== tempId));
      }
    } catch (e) {
      console.error(e);
      Alert.alert("Lỗi", "Đã xảy ra lỗi kết nối.");
      setHistory((prev) => prev.filter((m) => m.history_id !== tempId));
    } finally {
      setSending(false);
    }
  };

  // Anti-spam chip handler (mục 28)
  const handleChipPress = useCallback((chipId: string, chipText: string) => {
    const now = Date.now();
    if (sending) return;
    if (clickedChipRef.current.has(chipId)) return;
    if (now - lastChipClickRef.current < 500) return; // debounce 500ms

    lastChipClickRef.current = now;
    clickedChipRef.current.add(chipId);
    void handleSend(chipText);
  }, [sending, handleSend]);

  const handleToggleFavorite = async (locationId: number) => {
    if (savingIds.has(locationId)) return;
    setSavingIds((prev) => new Set(prev).add(locationId));

    const isSaved = savedLocations.has(locationId);
    try {
      // Optimistic update
      setSavedLocations((prev) => {
        const next = new Set(prev);
        if (isSaved) next.delete(locationId);
        else next.add(locationId);
        return next;
      });

      await userApi.toggleFavorite(locationId, !isSaved);

      if (Platform.OS === "android") {
        ToastAndroid.show(
          isSaved ? "Đã bỏ lưu địa điểm" : "Đã lưu địa điểm ❤️",
          ToastAndroid.SHORT
        );
      }
    } catch (e) {
      // Revert
      setSavedLocations((prev) => {
        const next = new Set(prev);
        if (isSaved) next.add(locationId);
        else next.delete(locationId);
        return next;
      });
      console.error("Lỗi lưu địa điểm:", e);
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(locationId);
        return next;
      });
    }
  };

  const parseMetadata = (metadata: any) => {
    if (!metadata) return null;
    if (typeof metadata === "object") return metadata;
    try {
      return JSON.parse(metadata);
    } catch {
      return null;
    }
  };

  // Get latest quickReplies from last AI message
  const latestQuickReplies: string[] = (() => {
    for (let i = history.length - 1; i >= 0; i--) {
      const meta = parseMetadata(history[i].metadata);
      if (meta?.quickReplies && meta.quickReplies.length > 0) return meta.quickReplies;
    }
    return [];
  })();

  return (
    <View style={{ paddingTop: insets.top }} className="flex-1 bg-slate-50">
      {/* Header */}
      <View className="flex-row items-center border-b border-line bg-white px-4 pb-3 pt-2">
        <Pressable
          className="h-10 w-10 items-center justify-center rounded-full bg-slate-100"
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={24} color="#0f172a" />
        </Pressable>

        {/* AI Profile Info */}
        <View className="flex-row items-center ml-3 flex-1">
          <View className="relative">
            <Image
              source={require("../../../assets/ai-avatar.png")}
              className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-100"
              defaultSource={require("../../../assets/ai-avatar.png")}
            />
            <View className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white" />
          </View>
          <View className="ml-2.5">
            <Text className="text-[15px] font-extrabold text-slate-800">Trợ lý ảo AI</Text>
            <Text className="text-[10px] text-slate-400 font-semibold">Tự động phản hồi nhanh</Text>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "padding"}
        enabled={Platform.OS === "ios" ? true : isKeyboardVisible}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
        className="flex-1"
      >
        {loading ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color="#a855f7" />
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
            className="flex-1 bg-slate-50/50"
          >
            {history.length === 0 ? (
              <View className="py-12 items-center justify-center gap-3">
                <Image
                  source={require("../../../assets/ai-avatar.png")}
                  className="w-16 h-16 rounded-full"
                />
                <Text className="text-base font-bold text-slate-800">Travel Assistant</Text>
                <Text className="text-xs text-slate-400 text-center max-w-[240px] leading-[18px]">
                  Chào bạn! Mình có thể giúp bạn gợi ý địa điểm, quán ăn, café hay chỗ nghỉ ngơi. Hỏi gì cũng được!
                </Text>
              </View>
            ) : (
              history.map((item) => {
                const metadata = parseMetadata(item.metadata);
                const locations = metadata?.locations || [];
                const actions = metadata?.actions || [];

                return (
                  <View key={item.history_id} className="mb-4">
                    {/* User prompt message bubble */}
                    <View className="flex-row justify-end mb-2">
                      <View className="max-w-[80%] bg-indigo-600 rounded-2xl rounded-tr-none px-4 py-2.5 shadow-sm">
                        <Text className="text-white text-sm font-medium leading-[20px]">
                          {item.prompt}
                        </Text>
                      </View>
                    </View>

                    {/* AI response bubble */}
                    {item.response || locations.length > 0 ? (
                      <View className="flex-row justify-start items-start gap-2.5 mb-2">
                        <Image
                          source={require("../../../assets/ai-avatar.png")}
                          className="w-6 h-6 rounded-full bg-slate-100"
                        />
                        <View className="max-w-[90%]">
                          {item.response ? (
                            <View className="bg-white rounded-2xl rounded-tl-none border border-line px-4 py-2.5 shadow-sm">
                              <Text className="text-slate-800 text-sm font-medium leading-[20px]">
                                {item.response}
                              </Text>
                            </View>
                          ) : null}

                          {/* Location Cards */}
                          {locations.map((loc: any, idx: number) => {
                            const imageUrl = resolveBackendUrl(loc.first_image);
                            const isSaved = savedLocations.has(loc.location_id);
                            const isSaving = savingIds.has(loc.location_id);

                            // Legacy record without full data
                            if (!loc.location_name) {
                              return (
                                <View
                                  key={idx}
                                  className="bg-white border border-indigo-100 rounded-xl p-3 mt-2 w-full shadow-sm"
                                >
                                  <Text className="text-[12px] text-indigo-700 leading-[18px] mb-2 font-medium">
                                    💡 {loc.reason || "Một địa điểm đề xuất dành cho bạn."}
                                  </Text>
                                  <Pressable
                                    onPress={() => router.push(`/location/${loc.location_id}`)}
                                    className="bg-indigo-600 py-1.5 px-3.5 rounded-lg self-start active:bg-indigo-700"
                                  >
                                    <Text className="text-white text-[10px] font-bold">Xem chi tiết</Text>
                                  </Pressable>
                                </View>
                              );
                            }

                            return (
                              <View
                                key={idx}
                                className="bg-white border border-line rounded-xl overflow-hidden shadow-sm mt-2 w-full"
                              >
                                {imageUrl && (
                                  <Image
                                    source={{ uri: imageUrl }}
                                    className="h-28 w-full bg-slate-100"
                                    resizeMode="cover"
                                  />
                                )}
                                <View className="p-3">
                                  <View className="flex-row items-start justify-between gap-2">
                                    <Text className="text-sm font-bold text-slate-800 flex-1" numberOfLines={1}>
                                      {loc.location_name}
                                    </Text>
                                    {/* Save button */}
                                    <Pressable
                                      onPress={() => void handleToggleFavorite(loc.location_id)}
                                      disabled={isSaving}
                                      className="p-1"
                                    >
                                      <Ionicons
                                        name={isSaved ? "heart" : "heart-outline"}
                                        size={18}
                                        color={isSaved ? "#ef4444" : "#94a3b8"}
                                      />
                                    </Pressable>
                                  </View>

                                  <View className="flex-row items-center gap-1 my-1">
                                    <Text className="text-[11px] text-amber-500">⭐ {loc.rating || 0}</Text>
                                    <Text className="text-[10px] text-slate-400">({loc.total_reviews || 0} đánh giá)</Text>
                                  </View>
                                  <Text className="text-[11px] text-slate-400 mb-2" numberOfLines={1}>
                                    📍 {loc.address}
                                  </Text>

                                  {loc.reason && (
                                    <View className="bg-indigo-50/50 border border-indigo-100/50 p-2 rounded-lg mb-2">
                                      <Text className="text-[11px] text-indigo-700 leading-[15px]">
                                        💡 {loc.reason}
                                      </Text>
                                    </View>
                                  )}

                                  <View className="flex-row gap-2 mt-1">
                                    <Pressable
                                      onPress={() => router.push(`/location/${loc.location_id}`)}
                                      className="flex-1 bg-indigo-600 py-1.5 rounded-lg justify-center items-center active:bg-indigo-700"
                                    >
                                      <Text className="text-white text-[11px] font-bold">Xem chi tiết</Text>
                                    </Pressable>
                                    <Pressable
                                      onPress={() => router.push(`/explore?focusLocationId=${loc.location_id}`)}
                                      className="flex-1 bg-slate-50 border border-line py-1.5 rounded-lg justify-center items-center active:bg-slate-100"
                                    >
                                      <Text className="text-slate-600 text-[11px] font-bold">🗺 Bản đồ</Text>
                                    </Pressable>
                                  </View>
                                </View>
                              </View>
                            );
                          })}

                          {/* Action buttons (SOS, itinerary, etc.) */}
                          {actions.map((act: any, idx: number) => {
                            const icon = act.type === "open_sos" ? "alert-circle" : "journal";
                            const color = act.type === "open_sos" ? "#ef4444" : "#7c3aed";
                            return (
                              <Pressable
                                key={idx}
                                onPress={() => {
                                  if (act.type === "open_sos") router.push("/profile/sos");
                                  else router.push("/itineraries");
                                }}
                                className="flex-row items-center gap-1.5 bg-white border border-line px-3 py-1.5 rounded-full mt-2 self-start shadow-sm active:bg-slate-50"
                              >
                                <Ionicons name={icon} size={14} color={color} />
                                <Text className="text-[11px] font-bold text-slate-700">
                                  {act.label}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>
                    ) : null}
                  </View>
                );
              })
            )}

            {/* Typing indicator */}
            {sending && (
              <View className="flex-row justify-start items-start gap-2.5 mb-2">
                <Image
                  source={require("../../../assets/ai-avatar.png")}
                  className="w-6 h-6 rounded-full bg-slate-100"
                />
                <View className="bg-white rounded-2xl rounded-tl-none border border-line px-4 py-3 shadow-sm flex-row gap-1">
                  <ActivityIndicator size="small" color="#6366f1" />
                </View>
              </View>
            )}

            {/* AI disclaimer */}
            <Text className="text-[9px] text-slate-300 text-center mt-2 mb-1 leading-[13px] px-4">
              Thông tin do AI hỗ trợ gợi ý. Vui lòng kiểm tra thông tin địa điểm trước khi quyết định.
            </Text>
          </ScrollView>
        )}

        {/* Guided Quick Prompt Chips — khi chưa có lịch sử (mục 27) */}
        {!loading && showChips && history.length === 0 && (
          <View className="px-4 py-2 border-t border-line bg-white">
            <View className="flex-row flex-wrap gap-2">
              {DEFAULT_CHIPS.map((chip) => (
                <Pressable
                  key={chip.id}
                  onPress={() => handleChipPress(chip.id, chip.text)}
                  disabled={sending}
                  className={`border rounded-full px-3.5 py-1.5 ${
                    sending
                      ? "bg-slate-50 border-slate-200 opacity-50"
                      : "bg-white border-indigo-200 active:bg-indigo-50"
                  }`}
                >
                  <Text className="text-[11px] font-semibold text-indigo-600">{chip.text}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Quick Replies từ AI response — sau mỗi câu trả lời (mục 26.6) */}
        {!loading && !sending && history.length > 0 && latestQuickReplies.length > 0 && (
          <View className="px-4 py-2 border-t border-line bg-white">
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {latestQuickReplies.map((text: string, idx: number) => (
                <Pressable
                  key={idx}
                  onPress={() => !sending && void handleSend(text)}
                  disabled={sending}
                  className="bg-slate-100 border border-slate-200 px-3.5 py-1.5 rounded-full mr-2 active:bg-indigo-50 active:border-indigo-200"
                >
                  <Text className="text-[11px] font-semibold text-slate-600">{text}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Input area */}
        <View
          style={{
            paddingBottom: Platform.OS === "ios"
              ? Math.max(insets.bottom, 12)
              : isKeyboardVisible
                ? 12
                : Math.max(insets.bottom, 12),
          }}
          className="flex-row items-end gap-2 border-t border-line bg-white p-3"
        >
          <TextInput
            value={prompt}
            onChangeText={setPrompt}
            placeholder="Gửi tin nhắn cho trợ lý..."
            editable={!sending}
            multiline={true}
            style={{ minHeight: 40, maxHeight: 100, paddingTop: 10, paddingBottom: 10 }}
            className="flex-1 bg-slate-50 border border-line rounded-2xl px-4 text-sm text-slate-800"
          />
          <Pressable
            disabled={sending || !prompt.trim()}
            onPress={() => void handleSend()}
            style={{ marginBottom: 2 }}
            className={`w-9 h-9 rounded-full justify-center items-center ${
              !prompt.trim() ? "bg-slate-100" : "bg-indigo-600"
            }`}
          >
            <Ionicons name="arrow-up" size={18} color={!prompt.trim() ? "#cbd5e1" : "white"} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
