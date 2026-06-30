import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { io, Socket } from "socket.io-client";
import { useAuthStore } from "../../modules/auth/store";
import { chatApi, LocationChatMessageItem } from "../../services/chat.api";
import { resolveBackendUrl } from "../../lib/url";

interface LocationChatModalProps {
  locationId?: number | null;
  userRole: "user" | "owner" | "employee";
  locationName?: string;
  locationImage?: string | null;
  visible: boolean;
  onClose: () => void;
}

export function LocationChatModal({
  locationId,
  userRole,
  locationName = "Chủ địa điểm",
  locationImage,
  visible,
  onClose,
}: LocationChatModalProps) {
  const [messages, setMessages] = useState<LocationChatMessageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [inputText, setInputText] = useState("");
  const flatListRef = useRef<FlatList>(null);
  
  const token = useAuthStore((state: any) => state.accessToken);
  const user = useAuthStore((state: any) => state.user);
  
  const activeLocationId = locationId;

  // Since Mobile doesn't have sessions implemented yet, we will just use customerId = user?.user_id
  const customerId = user?.user_id;

  const fetchHistory = useCallback(async () => {
    if (!activeLocationId || !customerId) return;
    try {
      setLoading(true);
      const res = await chatApi.getHistory(activeLocationId, customerId);
      if (res.success && Array.isArray(res.data)) {
        setMessages(res.data);
      }
    } catch (err) {
      console.error("[LocationChatModal] Fetch history error:", err);
    } finally {
      setLoading(false);
    }
  }, [activeLocationId, customerId]);

  useEffect(() => {
    if (visible) {
      fetchHistory();
    }
  }, [visible, fetchHistory]);

  useEffect(() => {
    if (!activeLocationId || !token || !customerId || !visible) return;
    
    const backendUrl = resolveBackendUrl("/");
    if (!backendUrl) return;

    const socketUrl = backendUrl.replace(/\/api\/?$/, "");
    const socket = io(socketUrl, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socket.on("connect", () => {
      socket.emit("join_location_chat", {
        locationId: activeLocationId,
        customerId,
        token,
      });
    });

    socket.on("location_chat_message", (msg: LocationChatMessageItem) => {
      if (msg.has_image) {
        fetchHistory();
      } else {
        setMessages((prev) => {
          if (prev.some((m) => m.message_id === msg.message_id)) return prev;
          return [...prev, msg];
        });
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [activeLocationId, token, customerId, visible, fetchHistory]);

  const handleSend = async () => {
    if (!inputText.trim() || !activeLocationId || !customerId) return;
    const text = inputText.trim();
    setInputText("");
    try {
      const res = await chatApi.sendMessage(activeLocationId, text, customerId, null);
      if (res.success && res.data) {
        setMessages((prev) => {
          if (prev.some((m) => m.message_id === res.data.message_id)) return prev;
          return [...prev, res.data];
        });
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    } catch (err) {
      console.error("Lỗi gửi tin nhắn:", err);
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
        <View style={[styles.msgBubble, isMine ? styles.msgBubbleMine : styles.msgBubbleTheirs]}>
          <Text style={[styles.msgText, isMine ? styles.msgTextMine : styles.msgTextTheirs]}>
            {item.content}
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
          <View style={styles.headerBtn} />
        </View>

        <View style={styles.chatArea}>
          {loading && messages.length === 0 ? (
            <ActivityIndicator style={styles.loader} size="large" color="#3b82f6" />
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.message_id.toString()}
              renderItem={renderMessage}
              contentContainerStyle={styles.listContent}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
              onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
            />
          )}
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.inputArea}>
            <TextInput
              style={styles.input}
              placeholder="Nhập tin nhắn..."
              value={inputText}
              onChangeText={setInputText}
              multiline
            />
            <TouchableOpacity
              style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!inputText.trim()}
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
    maxWidth: "75%",
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
