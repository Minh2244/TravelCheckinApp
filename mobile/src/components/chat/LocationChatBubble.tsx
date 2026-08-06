import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
  Image,
  ImageBackground,
  DeviceEventEmitter,
  InteractionManager,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { io } from "socket.io-client";
import { useAuthStore } from "../../modules/auth/store";
import { showToast } from "../../modules/ui/toast-store";
import { confirm } from "../../modules/ui/confirm-store";
import { chatApi, LocationChatMessageItem } from "../../services/chat.api";
import { resolveBackendUrl } from "../../lib/url";

const INITIAL_MESSAGE_LIMIT = 10;

interface LocationChatModalProps {
  locationId?: number | null;
  userRole: "user" | "owner" | "employee";
  locationName?: string;
  locationImage?: string | null;
  visible: boolean;
  onClose: () => void;
  onMarkedRead?: () => void;
}

export function LocationChatModal({
  locationId,
  userRole,
  locationName = "Chủ địa điểm",
  locationImage,
  visible,
  onClose,
  onMarkedRead,
}: LocationChatModalProps) {
  const [messages, setMessages] = useState<LocationChatMessageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [inputText, setInputText] = useState("");
  const [selectedImage, setSelectedImage] = useState<{ uri: string; base64?: string | null } | null>(null);
  const [clearingHistory, setClearingHistory] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const imageLoadingIdsRef = useRef<Set<number>>(new Set());
  const loadedConversationKeyRef = useRef<string | null>(null);
  const openedReadKeyRef = useRef<string | null>(null);
  
  const token = useAuthStore((state: any) => state.accessToken);
  const user = useAuthStore((state: any) => state.user);
  
  const activeLocationId = locationId;

  // Since Mobile doesn't have sessions implemented yet, we will just use customerId = user?.user_id
  const customerId = user?.user_id;

  const scrollToLatest = useCallback((animated = false) => {
    InteractionManager.runAfterInteractions(() => {
      flatListRef.current?.scrollToEnd({ animated });
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated });
      }, 50);
    });
  }, []);

  const fetchHistory = useCallback(async () => {
    if (!activeLocationId || !customerId) return;
    const conversationKey = `${activeLocationId}:${customerId}`;
    if (loadedConversationKeyRef.current === conversationKey) return;

    try {
      setLoading(true);
      const res = await chatApi.getHistory(activeLocationId, customerId, undefined, INITIAL_MESSAGE_LIMIT);
      if (res.success && Array.isArray(res.data)) {
        setMessages(res.data);
        loadedConversationKeyRef.current = conversationKey;
        scrollToLatest(false);
      }
    } catch (err) {
      console.error("[LocationChatModal] Fetch history error:", err);
    } finally {
      setLoading(false);
    }
  }, [activeLocationId, customerId, scrollToLatest]);

  useEffect(() => {
    loadedConversationKeyRef.current = null;
    openedReadKeyRef.current = null;
    setMessages([]);
  }, [activeLocationId, customerId]);

  const loadMessageImage = useCallback(async (messageId: number) => {
    if (!activeLocationId || imageLoadingIdsRef.current.has(messageId)) return;
    imageLoadingIdsRef.current.add(messageId);
    try {
      const res = await chatApi.getMessageImage(activeLocationId, messageId);
      if (res?.success && res.data?.image_data) {
        setMessages((prev) =>
          prev.map((m) =>
            Number(m.message_id) === Number(messageId)
              ? { ...m, image_data: res.data.image_data, has_image: true }
              : m
          )
        );
      }
    } catch (err) {
      console.error("[LocationChatModal] Load image error:", err);
    } finally {
      imageLoadingIdsRef.current.delete(messageId);
    }
  }, [activeLocationId]);

  const markConversationRead = useCallback(async (force = false) => {
    if (!activeLocationId) return;
    const conversationKey = `${activeLocationId}:${customerId || ""}`;
    if (!force && openedReadKeyRef.current === conversationKey) return;

    try {
      const res = await chatApi.markRead(activeLocationId, customerId);
      if (res?.success) {
        openedReadKeyRef.current = conversationKey;
        onMarkedRead?.();
        DeviceEventEmitter.emit("chat_unread_update", { location_id: activeLocationId });
      }
    } catch (err) {
      console.error("[LocationChatModal] Mark read error:", err);
    }
  }, [activeLocationId, customerId, onMarkedRead]);

  useEffect(() => {
    if (!visible) {
      openedReadKeyRef.current = null;
    }
  }, [visible]);

  useEffect(() => {
    if (!visible || !activeLocationId || messages.length === 0) return;

    messages.forEach((message) => {
      if (message.has_image && !message.image_data) {
        void loadMessageImage(message.message_id);
      }
    });
  }, [visible, activeLocationId, messages, loadMessageImage]);

  useEffect(() => {
    if (visible) {
      fetchHistory();
      void markConversationRead();
    }
  }, [visible, fetchHistory, markConversationRead]);

  useEffect(() => {
    if (!activeLocationId || !token || !customerId || !visible) return;
    
    const backendUrl = resolveBackendUrl("/");
    if (!backendUrl) return;

    const socketUrl = backendUrl.replace(/\/api\/?$/, "");
    const socket = io(socketUrl, {
      auth: { token },
      path: "/socket.io",
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socket.on("connect", () => {
      socket.emit("join_location_room", {
        locationId: activeLocationId,
        customerId,
      });
    });

    socket.on("location_chat_message", (msg: LocationChatMessageItem) => {
      setMessages((prev) => {
        if (prev.some((m) => m.message_id === msg.message_id)) return prev;
        return [...prev, msg];
      });
      if (msg.has_image) {
        void loadMessageImage(msg.message_id);
      }
      if (Number(msg.sender_id) !== Number(user?.user_id)) {
        void markConversationRead(true);
      }
      scrollToLatest(true);
    });

    return () => {
      socket.disconnect();
    };
  }, [activeLocationId, token, customerId, visible, loadMessageImage, markConversationRead, scrollToLatest, user?.user_id]);

  const handleImagePick = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      showToast("Bạn cần cấp quyền truy cập thư viện ảnh!");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setSelectedImage({
        uri: result.assets[0].uri,
        base64: result.assets[0].base64,
      });
    }
  };

  const handleSend = async () => {
    if ((!inputText.trim() && !selectedImage) || !activeLocationId || !customerId) return;
    const text = inputText.trim();
    const imageData = selectedImage?.base64 ? `data:image/jpeg;base64,${selectedImage.base64}` : null;
    setInputText("");
    setSelectedImage(null);
    try {
      const res = await chatApi.sendMessage(activeLocationId, text, customerId, imageData);
      if (res.success && res.data) {
        setMessages((prev) => {
          if (prev.some((m) => m.message_id === res.data.message_id)) return prev;
          return [...prev, res.data];
        });
        scrollToLatest(true);
      }
    } catch (err) {
      console.error("Lỗi gửi tin nhắn:", err);
    }
  };

  const handleClearHistory = useCallback(async () => {
    if (!activeLocationId || clearingHistory || messages.length === 0) return;

    const accepted = await confirm({
      title: "Xóa tin nhắn?",
      message: "Toàn bộ tin nhắn sẽ được xóa khỏi cuộc trò chuyện của bạn.",
      confirmText: "Xóa",
      cancelText: "Hủy",
      destructive: true,
    });
    if (!accepted) return;

    setClearingHistory(true);
    try {
      const res = await chatApi.clearHistory(activeLocationId, customerId);
      if (res?.success) {
        setMessages([]);
        loadedConversationKeyRef.current = `${activeLocationId}:${customerId}`;
        showToast("Đã xóa tin nhắn");
      } else {
        showToast("Không thể xóa tin nhắn");
      }
    } catch (err) {
      console.error("[LocationChatModal] Clear history error:", err);
      showToast("Không thể xóa tin nhắn");
    } finally {
      setClearingHistory(false);
    }
  }, [activeLocationId, clearingHistory, customerId, messages.length]);

  const formatTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  const renderMessage = ({ item }: { item: LocationChatMessageItem }) => {
    const isMine = item.sender_id === user?.user_id;
    return (
      <View style={[styles.msgContainer, isMine ? styles.msgMine : styles.msgTheirs]}>
        {!isMine && (
          <View style={styles.avatarPlaceholder}>
             {item.sender_role === "user" && item.customer_avatar ? (
                <Image source={{ uri: resolveBackendUrl(item.customer_avatar) || "" }} style={styles.avatarImg} />
             ) : (
                <Ionicons name="person-circle" size={32} color="#94a3b8" />
             )}
          </View>
        )}
        <View style={{ alignItems: isMine ? "flex-end" : "flex-start", maxWidth: "85%", flexShrink: 1 }}>
          {item.sender_name && !isMine && (
            <Text style={{ fontSize: 11, fontWeight: "bold", color: "#64748b", marginBottom: 2, marginLeft: 4 }}>
              {item.sender_name} {item.sender_role === "owner" ? "(Chủ quán)" : item.sender_role === "employee" ? "(Nhân viên)" : ""}
            </Text>
          )}
          {item.image_data && (
            <Image 
              source={{ uri: item.image_data }} 
              style={{ width: 160, height: 160, borderRadius: 12, marginBottom: 4 }} 
              resizeMode="cover" 
            />
          )}
          {!item.image_data && item.has_image ? (
            <View style={[styles.imagePlaceholder, isMine ? styles.imagePlaceholderMine : styles.imagePlaceholderTheirs]}>
              <Ionicons name="image-outline" size={18} color={isMine ? "#1d4ed8" : "#64748b"} />
              <Text style={[styles.imagePlaceholderText, isMine ? styles.imagePlaceholderTextMine : styles.imagePlaceholderTextTheirs]}>
                Ảnh đã gửi
              </Text>
            </View>
          ) : null}
          {item.content ? (
            <View style={[styles.msgBubble, isMine ? styles.msgBubbleMine : styles.msgBubbleTheirs]}>
              <Text style={[styles.msgText, isMine ? styles.msgTextMine : styles.msgTextTheirs]}>
                {item.content}
              </Text>
            </View>
          ) : null}
          <Text style={[styles.messageTime, { marginTop: 2, marginHorizontal: 4 }]}>
            {formatTime(item.created_at)}
          </Text>
        </View>
      </View>
    );
  };

  if (!activeLocationId) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
            <Ionicons name="chevron-down" size={28} color="#0f172a" />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle} numberOfLines={1}>{locationName}</Text>
            <Text style={styles.headerSubtitle}>
              {userRole === "user" ? "Chủ địa điểm" : "Khách hàng"}
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleClearHistory}
            style={[styles.headerBtn, styles.headerBtnRight]}
            disabled={clearingHistory || messages.length === 0}
            accessibilityLabel="Xóa tin nhắn"
          >
            {clearingHistory ? (
              <ActivityIndicator size="small" color="#0f172a" />
            ) : (
              <Ionicons
                name="trash-outline"
                size={22}
                color={messages.length === 0 ? "#cbd5e1" : "#0f172a"}
              />
            )}
          </TouchableOpacity>
        </View>

        <ImageBackground 
          source={locationImage ? { uri: resolveBackendUrl(locationImage) || "" } : undefined} 
          style={styles.chatArea} 
          imageStyle={{ opacity: 0.1 }}
        >
          {loading && messages.length === 0 ? (
            <ActivityIndicator style={styles.loader} size="large" color="#3b82f6" />
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.message_id.toString()}
              renderItem={renderMessage}
              initialNumToRender={INITIAL_MESSAGE_LIMIT}
              contentContainerStyle={styles.listContent}
              onContentSizeChange={() => scrollToLatest(false)}
              onLayout={() => scrollToLatest(false)}
            />
          )}
        </ImageBackground>

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          {selectedImage && (
            <View style={{ padding: 12, backgroundColor: "#f8fafc", borderTopWidth: 1, borderTopColor: "#e2e8f0", flexDirection: "row", alignItems: "center" }}>
              <View style={{ position: "relative" }}>
                <Image source={{ uri: selectedImage.uri }} style={{ width: 60, height: 60, borderRadius: 8 }} />
                <TouchableOpacity 
                  style={{ position: "absolute", top: -8, right: -8, backgroundColor: "#ef4444", borderRadius: 12, width: 24, height: 24, justifyContent: "center", alignItems: "center" }}
                  onPress={() => setSelectedImage(null)}
                >
                  <Ionicons name="close" size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          )}
          <View style={styles.inputArea}>
            <TouchableOpacity onPress={handleImagePick} style={{ marginRight: 8, justifyContent: "center", alignItems: "center", width: 44, height: 44 }}>
              <Ionicons name="image-outline" size={24} color="#64748b" />
            </TouchableOpacity>
            <TextInput
              style={styles.input}
              placeholder="Nhập tin nhắn..."
              value={inputText}
              onChangeText={setInputText}
              multiline
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!inputText.trim() && !selectedImage) && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!inputText.trim() && !selectedImage}
            >
              <Ionicons name="send" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#3b82f6",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
    zIndex: 9999,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#f1f5f9",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  headerBtn: {
    width: 40,
    alignItems: "flex-start",
  },
  headerBtnRight: {
    alignItems: "flex-end",
  },
  headerInfo: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  chatArea: {
    flex: 1,
  },
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    padding: 16,
  },
  msgContainer: {
    flexDirection: "row",
    marginBottom: 16,
    alignItems: "flex-end",
  },
  msgMine: {
    justifyContent: "flex-end",
  },
  msgTheirs: {
    justifyContent: "flex-start",
  },
  avatarPlaceholder: {
    width: 32,
    height: 32,
    marginRight: 8,
    borderRadius: 16,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImg: {
    width: 32,
    height: 32,
  },
  msgBubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
  },
  msgBubbleMine: {
    backgroundColor: "#3b82f6",
    borderBottomRightRadius: 4,
  },
  msgBubbleTheirs: {
    backgroundColor: "#fff",
    borderBottomLeftRadius: 4,
  },
  msgText: {
    fontSize: 15,
    lineHeight: 20,
  },
  msgTextMine: {
    color: "#fff",
  },
  msgTextTheirs: {
    color: "#334155",
  },
  imagePlaceholder: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 4,
  },
  imagePlaceholderMine: {
    backgroundColor: "#dbeafe",
    borderColor: "#bfdbfe",
  },
  imagePlaceholderTheirs: {
    backgroundColor: "#fff",
    borderColor: "#e2e8f0",
  },
  imagePlaceholderText: {
    fontSize: 12,
    fontWeight: "700",
  },
  imagePlaceholderTextMine: {
    color: "#1d4ed8",
  },
  imagePlaceholderTextTheirs: {
    color: "#64748b",
  },
  messageTime: {
    fontSize: 10,
    color: "#94a3b8",
  },
  inputArea: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 12,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  input: {
    flex: 1,
    backgroundColor: "#f1f5f9",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    maxHeight: 100,
    fontSize: 15,
    color: "#0f172a",
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#3b82f6",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  sendBtnDisabled: {
    backgroundColor: "#94a3b8",
  },
});
