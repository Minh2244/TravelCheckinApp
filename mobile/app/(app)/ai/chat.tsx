import React, { useEffect, useState, useRef } from "react";
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
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";

import { chatApi } from "../../../src/services/chat.api";
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

export default function AiChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<number | undefined>(undefined);

  const scrollRef = useRef<ScrollView>(null);

  const fetchHistory = async () => {
    try {
      const resp = await chatApi.getAiHistory();
      if (resp?.success && resp.data) {
        setHistory(resp.data);
        if (resp.data.length > 0) {
          setConversationId(resp.data[resp.data.length - 1].conversation_id);
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
    if (!textToSend) return;

    if (!messageText) {
      setPrompt("");
    }

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
      // Gather context (GPS location & simple mock weather)
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

  const parseMetadata = (metadata: any) => {
    if (!metadata) return null;
    if (typeof metadata === "object") return metadata;
    try {
      return JSON.parse(metadata);
    } catch {
      return null;
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
        
        {/* AI Profile Info */}
        <View className="flex-row items-center ml-3 flex-1">
          <View className="relative">
            <Image
              source={require("../../../assets/images/icon.png")} // Fallback icon
              className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-100"
              defaultSource={require("../../../assets/images/icon.png")}
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
        behavior={Platform.OS === "ios" ? "padding" : undefined}
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
            contentContainerStyle={{ padding: 16 }}
            className="flex-1 bg-slate-50/50"
          >
            {history.length === 0 ? (
              <View className="py-12 items-center justify-center gap-3">
                <Image
                  source={require("../../../assets/images/icon.png")}
                  className="w-16 h-16 rounded-full"
                />
                <Text className="text-base font-bold text-slate-800">Travel Assistant</Text>
                <Text className="text-xs text-slate-400 text-center max-w-[240px] leading-[18px]">
                  Chào bạn! Mình có thể giúp bạn lên kế hoạch chuyến đi, gợi ý món ngon, nhà hàng hoặc giải đáp các thắc mắc về điểm đến.
                </Text>
              </View>
            ) : (
              history.map((item) => {
                const metadata = parseMetadata(item.metadata);
                const locations = metadata?.locations || [];
                const quickReplies = metadata?.quickReplies || [];
                const actions = metadata?.actions || [];

                return (
                  <View key={item.history_id} className="mb-4">
                    {/* User prompt message bubble */}
                    <View className="flex-row justify-end mb-2">
                      <View className="max-w-[80%] bg-indigo-600 rounded-2xl rounded-tr-none px-4 py-2.5 shadow-sm">
                        <Text className="text-white text-xs font-medium leading-[18px]">
                          {item.prompt}
                        </Text>
                      </View>
                    </View>

                    {/* AI response bubble */}
                    {item.response || locations.length > 0 ? (
                      <View className="flex-row justify-start items-start gap-2.5 mb-2">
                        <Image
                          source={require("../../../assets/images/icon.png")}
                          className="w-6 h-6 rounded-full bg-slate-100"
                        />
                        <View className="max-w-[80%]">
                          {item.response ? (
                            <View className="bg-white rounded-2xl rounded-tl-none border border-line px-4 py-2.5 shadow-sm">
                              <Text className="text-slate-800 text-xs font-medium leading-[18px]">
                                {item.response}
                              </Text>
                            </View>
                          ) : null}

                          {/* Location Card Recommendations */}
                          {locations.map((loc: any, idx: number) => {
                            const imageUrl = resolveBackendUrl(loc.first_image);
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
                                  <Text className="text-xs font-bold text-slate-800" numberOfLines={1}>
                                    {loc.location_name}
                                  </Text>
                                  <View className="flex-row items-center gap-1 my-1">
                                    <Text className="text-[10px] text-amber-500">⭐ {loc.rating || 0}</Text>
                                    <Text className="text-[9px] text-slate-400">({loc.total_reviews || 0} đánh giá)</Text>
                                  </View>
                                  <Text className="text-[10px] text-slate-400 mb-2" numberOfLines={1}>
                                    📍 {loc.address}
                                  </Text>
                                  
                                  {loc.reason && (
                                    <View className="bg-indigo-50/50 border border-indigo-100/50 p-2 rounded-lg mb-2">
                                      <Text className="text-[10px] text-indigo-700 leading-[14px]">
                                        💡 {loc.reason}
                                      </Text>
                                    </View>
                                  )}

                                  <View className="flex-row gap-2 mt-1">
                                    <Pressable
                                      onPress={() => router.push(`/location/${loc.location_id}`)}
                                      className="flex-1 bg-indigo-600 py-1.5 rounded-lg justify-center items-center active:bg-indigo-700"
                                    >
                                      <Text className="text-white text-[9px] font-bold">Xem chi tiết</Text>
                                    </Pressable>
                                    <Pressable
                                      onPress={() => router.push("/explore")}
                                      className="flex-1 bg-slate-50 border border-line py-1.5 rounded-lg justify-center items-center active:bg-slate-100"
                                    >
                                      <Text className="text-slate-600 text-[9px] font-bold">Bản đồ</Text>
                                    </Pressable>
                                  </View>
                                </View>
                              </View>
                            );
                          })}

                          {/* Quick replies or custom actions buttons */}
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
                                <Text className="text-[10px] font-bold text-slate-700">
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

            {sending && (
              <View className="flex-row justify-start items-start gap-2.5 mb-2">
                <Image
                  source={require("../../../assets/images/icon.png")}
                  className="w-6 h-6 rounded-full bg-slate-100"
                />
                <View className="bg-white rounded-2xl rounded-tl-none border border-line px-4 py-3 shadow-sm flex-row gap-1">
                  <ActivityIndicator size="small" color="#6366f1" />
                </View>
              </View>
            )}
          </ScrollView>
        )}

        {/* Suggestion Quick Replies */}
        {!loading && history.length === 0 && (
          <View className="flex-row gap-2 px-4 py-2 border-t border-line bg-white">
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {[
                "Lập kế hoạch du lịch Đà Lạt 3 ngày",
                "Khách sạn tốt nhất Cần Thơ",
                "Quán ăn ngon nổi tiếng gần đây",
              ].map((text, idx) => (
                <Pressable
                  key={idx}
                  onPress={() => void handleSend(text)}
                  className="bg-slate-100 border border-slate-200 px-3.5 py-1.5 rounded-full mr-2 active:bg-slate-200"
                >
                  <Text className="text-[10px] font-semibold text-slate-600">{text}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Input area */}
        <View
          style={{ paddingBottom: Math.max(insets.bottom, 12) }}
          className="flex-row items-center gap-2 border-t border-line bg-white p-3"
        >
          <TextInput
            value={prompt}
            onChangeText={setPrompt}
            placeholder="Gửi tin nhắn cho trợ lý..."
            disabled={sending}
            className="flex-1 bg-slate-50 border border-line rounded-full px-4 py-2 text-xs text-slate-800"
          />
          <Pressable
            disabled={sending || !prompt.trim()}
            onPress={() => void handleSend()}
            className={`w-9 h-9 rounded-full justify-center items-center ${
              !prompt.trim() ? "bg-slate-100" : "bg-indigo-600"
            }`}
          >
            <Ionicons name="arrow-up" size={18} color={!prompt.trim() ? "#cbd5e1" : "white"} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
