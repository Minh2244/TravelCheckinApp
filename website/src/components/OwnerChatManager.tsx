import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { Modal } from "antd";
import { io, Socket } from "socket.io-client";
import locationChatApi from "../api/locationChatApi";
import type { LocationChatMessageItem } from "../api/locationChatApi";
import { resolveBackendUrl } from "../utils/resolveBackendUrl";

interface OwnerChatManagerProps {
  locationId?: number | null;
  locationImageUrl?: string | null;
}

const resolveSocketUrl = (): string => {
  const raw =
    (import.meta.env.VITE_SOCKET_URL as string | undefined) ||
    (import.meta.env.VITE_API_URL as string | undefined) ||
    "http://localhost:3000";
  return raw.replace(/\/api\/?$/, "");
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

const formatMessageTime = (dateStr: string) => {
  try {
    const date = new Date(dateStr);
    const timeStr = date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false });
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${timeStr} ${day}/${month}/${year}`;
  } catch {
    return "";
  }
};

interface ChatSession {
  customerId: number;
  customerName: string;
  hasNewMessage?: boolean;
  isMinimized?: boolean;
  customerAvatar?: string | null;
  unreadCount?: number;       // Số tin chưa đọc từ OwnerChatWindow
  lastMessageAt?: string;     // Thời điểm tin nhắn cuối cùng để check dismissed state
  lastMessage?: string;       // Nội dung tin nhắn cuối
}

const normalizeChatSession = (session: ChatSession): ChatSession | null => {
  const customerId = Number(session.customerId);
  if (!Number.isFinite(customerId) || customerId <= 0) return null;
  return {
    ...session,
    customerId,
    unreadCount: Math.max(0, Number(session.unreadCount || 0)),
  };
};

export default function OwnerChatManager({ locationId, locationImageUrl }: OwnerChatManagerProps) {
  const [openChats, setOpenChats] = useState<ChatSession[]>([]);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historySessions, setHistorySessions] = useState<ChatSession[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [incomingMessages, setIncomingMessages] = useState<Record<number, LocationChatMessageItem>>({});
  const socketRef = useRef<Socket | null>(null);
  const activeLocationId = Number(locationId);
  const socketUrl = useMemo(() => resolveSocketUrl(), []);
  const hasLoadedRef = useRef<Record<number, boolean>>({});

  // Khôi phục danh sách chat từ localStorage và tải các session từ API
  useEffect(() => {
    if (!activeLocationId || !Number.isFinite(activeLocationId)) return;
    
    let isMounted = true;
    
    const loadChats = async () => {
      let storedChats: ChatSession[] = [];
      try {
        const stored = localStorage.getItem(`owner_open_chats_${activeLocationId}`);
        if (stored) {
          storedChats = ((JSON.parse(stored) as ChatSession[]) || [])
            .map(normalizeChatSession)
            .filter((item): item is ChatSession => Boolean(item));
        }
      } catch (e) {
        console.error("[OwnerChatManager] Lỗi khi đọc localStorage:", e);
      }

      if (!isMounted) return;

      try {
        const res = await locationChatApi.getActiveSessions(activeLocationId);
        if (res.success && res.data && isMounted) {
          const apiSessions = res.data;
          const apiCustomerIds = new Set(apiSessions.map((sess) => Number(sess.customerId)));
          const mergedChatsMap = new Map<number, ChatSession>();

          // Lấy danh sách các chat đã bị chủ động đóng (dismissed)
          let dismissedMap: Record<number, string> = {};
          try {
            const dismissedRaw = localStorage.getItem(`owner_dismissed_chats_${activeLocationId}`);
            if (dismissedRaw) {
              dismissedMap = JSON.parse(dismissedRaw);
            }
          } catch (e) {
            console.error("[OwnerChatManager] Lỗi đọc dismissed chats:", e);
          }

          // Đưa các chat từ localStorage vào trước
          for (const c of storedChats) {
            if (!apiCustomerIds.has(Number(c.customerId))) {
              continue;
            }
            mergedChatsMap.set(c.customerId, c);
          }

          // Duyệt qua danh sách active sessions từ API
          for (const sess of apiSessions) {
            const existing = mergedChatsMap.get(sess.customerId);
            
            // Kiểm tra xem session này có bị dismissed hay không
            const dismissedTime = dismissedMap[sess.customerId];
            const isDismissed = dismissedTime && new Date(sess.lastMessageAt).getTime() <= new Date(dismissedTime).getTime();

            if (existing) {
              // Nếu session đã tồn tại trong local state/localStorage
              // Chỉ coi là tin nhắn mới nếu unreadCount > 0 VÀ thời điểm tin nhắn mới từ API mới hơn thời điểm tin cũ đã lưu
              const existingLastMessageTime = existing.lastMessageAt
                ? new Date(existing.lastMessageAt).getTime()
                : 0;
              const sessionLastMessageTime = sess.lastMessageAt
                ? new Date(sess.lastMessageAt).getTime()
                : 0;
              const existingUnreadCount = existing.unreadCount || 0;
              const sessionUnreadCount = sess.unreadCount || 0;
              const hasUnreadFromApi =
                sessionUnreadCount > 0 &&
                (sessionLastMessageTime > existingLastMessageTime ||
                  sessionUnreadCount > existingUnreadCount ||
                  !existing.lastMessageAt);
              
              mergedChatsMap.set(sess.customerId, {
                customerId: sess.customerId,
                customerName: sess.customerName,
                customerAvatar: sess.customerAvatar || existing.customerAvatar,
                isMinimized: existing.isMinimized,
                hasNewMessage: hasUnreadFromApi,
                unreadCount: hasUnreadFromApi
                  ? Math.max(sessionUnreadCount, existingUnreadCount)
                  : sessionUnreadCount,
                lastMessageAt: sess.lastMessageAt || existing.lastMessageAt,
              });
            } else if (sess.unreadCount > 0 && !isDismissed) {
              // Nếu chưa tồn tại nhưng có tin nhắn chưa đọc từ API và chưa bị dismissed
              mergedChatsMap.set(sess.customerId, {
                customerId: sess.customerId,
                customerName: sess.customerName,
                customerAvatar: sess.customerAvatar,
                isMinimized: true, // Mặc định thu nhỏ khi mới xuất hiện tự động
                hasNewMessage: true,
                unreadCount: sess.unreadCount,
                lastMessageAt: sess.lastMessageAt,
              });
            }
          }

          const mergedChats = Array.from(mergedChatsMap.values());
          console.log(`[OwnerChatManager] Hợp nhất danh sách chat thành công, tổng cộng ${mergedChats.length} session.`);
          setOpenChats(mergedChats);
        } else {
          setOpenChats(storedChats);
        }
      } catch (err) {
        console.error("[OwnerChatManager] Lỗi khi lấy active sessions từ API:", err);
        setOpenChats(storedChats);
      } finally {
        isMounted && (hasLoadedRef.current[activeLocationId] = true);
      }
    };
    void loadChats();
    return () => {
      isMounted = false;
    };
  }, [activeLocationId]);

  // Lắng nghe event mở popup Lịch sử Chat
  useEffect(() => {
    const handleOpenHistory = () => setIsHistoryModalOpen(true);
    window.addEventListener("tc-open-owner-chat-history", handleOpenHistory);
    return () => window.removeEventListener("tc-open-owner-chat-history", handleOpenHistory);
  }, []);

  // Khi popup mở, fetch danh sách session
  useEffect(() => {
    if (isHistoryModalOpen && activeLocationId) {
      setHistoryLoading(true);
      locationChatApi.getActiveSessions(activeLocationId).then(res => {
        if (res.success && res.data) {
          setHistorySessions(res.data.map(normalizeChatSession).filter((c): c is ChatSession => Boolean(c)));
        }
      }).catch(console.error).finally(() => setHistoryLoading(false));
    }
  }, [isHistoryModalOpen, activeLocationId]);

  const handleOpenChat = useCallback((session: ChatSession) => {
    setOpenChats((prev) => {
      const exists = prev.some((c) => c.customerId === session.customerId);
      if (exists) {
        return prev.map(c => c.customerId === session.customerId ? { ...c, isMinimized: false } : c);
      }
      return [...prev, session];
    });
    setIsHistoryModalOpen(false);
  }, []);

  // Tự động lưu openChats vào localStorage mỗi khi có thay đổi
  useEffect(() => {
    if (!activeLocationId || !Number.isFinite(activeLocationId)) return;
    if (!hasLoadedRef.current[activeLocationId]) {
      return;
    }
    try {
      localStorage.setItem(`owner_open_chats_${activeLocationId}`, JSON.stringify(openChats));
    } catch (e) {
      console.error("[OwnerChatManager] Lỗi khi lưu localStorage:", e);
    }
  }, [openChats, activeLocationId]);

  useEffect(() => {
    console.log("[OwnerChatManager] Mount useEffect, activeLocationId:", activeLocationId);
    if (!activeLocationId || !Number.isFinite(activeLocationId)) {
      console.warn("[OwnerChatManager] locationId không hợp lệ:", activeLocationId);
      return;
    }

    const token = sessionStorage.getItem("accessToken");
    if (!token) {
      console.error("[OwnerChatManager] Không tìm thấy accessToken");
      return;
    }

    console.log("[OwnerChatManager] Đang kết nối socket tới:", socketUrl);
    const socket = io(socketUrl, {
      auth: { token },
      transports: ["websocket"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[OwnerChatManager] Socket connected successfully! ID:", socket.id);
      console.log("[OwnerChatManager] Đang gửi join_location_owner_room cho location:", activeLocationId);
      socket.emit("join_location_owner_room", { locationId: activeLocationId });
    });

    socket.on("connect_error", (err) => {
      console.error("[OwnerChatManager] Socket connection error:", err);
    });

    socket.on("disconnect", (reason) => {
      console.warn("[OwnerChatManager] Socket disconnected, lý do:", reason);
    });

    socket.on("location_new_message_alert", (msg: LocationChatMessageItem & { customer_avatar?: string }) => {
      console.log("[OwnerChatManager] Nhận sự kiện location_new_message_alert:", msg);
      if (Number(msg.location_id) !== activeLocationId) {
        console.warn(`[OwnerChatManager] Lọc bỏ vì khác locationId (msg: ${msg.location_id}, active: ${activeLocationId})`);
        return;
      }

      const customerId = Number(msg.customer_id);
      const customerName = msg.sender_name || `Khách hàng #${customerId}`;
      const customerAvatar = msg.customer_avatar || null;
      setIncomingMessages((prev) => ({ ...prev, [customerId]: msg }));

      console.log(`[OwnerChatManager] Mở/Highlight khung chat cho customerId: ${customerId}`);
      setOpenChats((prev) => {
        const exists = prev.some((c) => c.customerId === customerId);
        if (exists) {
          return prev.map((c) =>
            c.customerId === customerId 
              ? {
                  ...c,
                  hasNewMessage: true,
                  unreadCount: (c.unreadCount || 0) + 1,
                  customerAvatar: customerAvatar || c.customerAvatar,
                  lastMessageAt: msg.created_at,
                } 
              : c
          );
        } else {
          return [
            ...prev,
            {
              customerId,
              customerName,
              hasNewMessage: true,
              unreadCount: 1,
              isMinimized: false,
              customerAvatar,
              lastMessageAt: msg.created_at,
            },
          ];
        }
      });
    });

    return () => {
      console.log("[OwnerChatManager] Cleanup socket...");
      socket.off("location_new_message_alert");
      socket.disconnect();
      socketRef.current = null;
    };
  }, [activeLocationId, socketUrl]);

  const handleCloseChat = (customerId: number) => {
    // Luôn lấy thời điểm đóng hiện tại làm mốc dismissed
    // Bất kỳ tin nhắn nào có trước thời điểm này sẽ được coi là đã đọc/đã đóng
    const dismissedTime = new Date().toISOString();
    
    // Lưu vào danh sách đã đóng để không tự động hiện lại khi load trang
    try {
      const dismissedKey = `owner_dismissed_chats_${activeLocationId}`;
      const dismissedRaw = localStorage.getItem(dismissedKey);
      const dismissedMap = dismissedRaw ? JSON.parse(dismissedRaw) : {};
      dismissedMap[customerId] = dismissedTime;
      localStorage.setItem(dismissedKey, JSON.stringify(dismissedMap));
    } catch (e) {
      console.error("[OwnerChatManager] Lỗi lưu dismissed chats:", e);
    }

    setOpenChats((prev) => prev.filter((c) => c.customerId !== customerId));
  };

  const handleClearHighlight = (customerId: number) => {
    // Xóa khỏi danh sách dismissed khi người dùng tương tác mở cửa sổ chat
    try {
      const dismissedKey = `owner_dismissed_chats_${activeLocationId}`;
      const dismissedRaw = localStorage.getItem(dismissedKey);
      if (dismissedRaw) {
        const dismissedMap = JSON.parse(dismissedRaw);
        if (dismissedMap[customerId]) {
          delete dismissedMap[customerId];
          localStorage.setItem(dismissedKey, JSON.stringify(dismissedMap));
        }
      }
    } catch (e) {
      console.error("[OwnerChatManager] Lỗi xóa unread/dismissed:", e);
    }

    setOpenChats((prev) =>
      prev.map((c) =>
        c.customerId === customerId ? { ...c, hasNewMessage: false } : c
      )
    );
  };

  const handleToggleMinimize = (customerId: number) => {
    setOpenChats((prev) =>
      prev.map((c) =>
        c.customerId === customerId ? { ...c, isMinimized: !c.isMinimized, hasNewMessage: false } : c
      )
    );
  };

  const handleAvatarLoaded = (customerId: number, avatarUrl: string) => {
    setOpenChats((prev) =>
      prev.map((c) =>
        c.customerId === customerId ? { ...c, customerAvatar: avatarUrl } : c
      )
    );
  };

  const handleUnreadChange = (customerId: number, count: number) => {
    setOpenChats((prev) =>
      prev.map((c) =>
        c.customerId === customerId ? { ...c, unreadCount: count } : c
      )
    );
  };

  if (!activeLocationId) return null;

  const activeChats = openChats.filter((c) => !c.isMinimized);
  const minimizedChats = openChats.filter((c) => c.isMinimized);

  return (
    <>
      {/* Active Chat Windows at the bottom right */}
      <div className="fixed bottom-0 right-4 z-50 flex items-end gap-3 pointer-events-none max-w-full overflow-x-auto pb-2">
        {activeChats.map((chat) => (
          <div key={chat.customerId} className="pointer-events-auto shrink-0">
            <OwnerChatWindow
              locationId={activeLocationId}
              customerId={chat.customerId}
              customerName={chat.customerName}
              hasNewMessage={chat.hasNewMessage}
              onClose={() => handleCloseChat(chat.customerId)}
              onFocus={() => handleClearHighlight(chat.customerId)}
              onMinimize={() => handleToggleMinimize(chat.customerId)}
              onAvatarLoaded={(avatarUrl) => handleAvatarLoaded(chat.customerId, avatarUrl)}
              onUnreadChange={(count) => handleUnreadChange(chat.customerId, count)}
              locationImageUrl={locationImageUrl}
              initialUnreadCount={chat.unreadCount || 0}
              incomingMessage={incomingMessages[chat.customerId]}
            />
          </div>
        ))}
      </div>

      {/* Minimized Chat Heads (Bubbles) stacked vertically at bottom-right above the bubbles list */}
      {minimizedChats.length > 0 && (
        <div className="fixed bottom-24 right-4 z-50 flex flex-col items-end gap-2.5 pointer-events-none">
          {minimizedChats.map((chat) => {
            const resolvedHeadAvatar = resolveBackendUrl(chat.customerAvatar);
            return (
              <div key={chat.customerId} className="pointer-events-auto relative group">
                {/* Circular bubble */}
                <button
                  type="button"
                  className={`w-14 h-14 rounded-full shadow-lg bg-gradient-to-r from-teal-600 to-emerald-600 flex items-center justify-center text-white font-bold border-2 transition-transform duration-200 hover:scale-105 active:scale-95 cursor-pointer ${
                    chat.hasNewMessage ? "border-rose-500 animate-pulse-subtle" : "border-white"
                  }`}
                  onClick={() => handleToggleMinimize(chat.customerId)}
                  title={`Phóng to chat với ${chat.customerName}`}
                >
                  {resolvedHeadAvatar ? (
                    <img
                      src={resolvedHeadAvatar}
                      alt={chat.customerName}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-base">{chat.customerName.charAt(0).toUpperCase()}</span>
                  )}
                  
                  {/* Badge đỏ số tin chưa đọc */}
                  {((chat.unreadCount ?? 0) > 0 || chat.hasNewMessage) && (
                    <span className="absolute -top-1 -right-1 bg-rose-500 text-white rounded-full text-[9px] font-bold h-5 min-w-[20px] px-1 flex items-center justify-center border border-white animate-bounce">
                      {(chat.unreadCount ?? 0) > 0 ? chat.unreadCount : "!"}
                    </span>
                  )}
                </button>
                
                {/* Close bubble button */}
                <button
                  type="button"
                  className="absolute -top-1.5 -left-1.5 bg-slate-800/90 hover:bg-slate-900 text-white rounded-full w-6 h-6 flex items-center justify-center text-[10px] shadow transition hover:scale-110 active:scale-90"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCloseChat(chat.customerId);
                  }}
                  title="Đóng hoàn toàn"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        title={<span className="font-heading font-bold text-slate-800 text-lg">Lịch sử Chat Khách Hàng</span>}
        open={isHistoryModalOpen}
        onCancel={() => setIsHistoryModalOpen(false)}
        footer={null}
        width={800}
        bodyStyle={{ maxHeight: "75vh", overflowY: "auto", padding: "20px" }}
      >
        {historyLoading ? (
          <div className="flex justify-center p-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
          </div>
        ) : historySessions.length === 0 ? (
          <div className="text-center text-slate-400 py-10 font-medium">
            Chưa có đoạn chat nào.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {historySessions.sort((a,b) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime()).map(session => (
              <div 
                key={session.customerId}
                onClick={() => handleOpenChat(session)}
                className="flex flex-col items-center text-center p-4 rounded-xl border border-slate-100 hover:border-teal-300 hover:shadow-md bg-white cursor-pointer transition-all duration-200 relative group"
              >
                {session.unreadCount ? (
                  <div className="absolute top-2 right-2 bg-rose-500 text-white text-[10px] font-bold h-5 min-w-[20px] flex items-center justify-center rounded-full px-1 shadow-sm z-10 animate-pulse">
                    {session.unreadCount}
                  </div>
                ) : null}
                
                <div className="relative mb-3 group-hover:scale-105 transition-transform duration-300">
                  {session.customerAvatar ? (
                    <img src={resolveBackendUrl(session.customerAvatar) as string} className="w-16 h-16 rounded-full object-cover shadow-sm border-2 border-white ring-2 ring-slate-100" alt="" />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-slate-100 to-slate-200 flex items-center justify-center text-2xl shadow-sm border-2 border-white ring-2 ring-slate-100 text-slate-400">👤</div>
                  )}
                </div>
                
                <div className="font-bold text-slate-800 text-sm truncate w-full mb-1" title={session.customerName}>{session.customerName}</div>
                
                <div className="text-xs text-slate-500 truncate w-full mb-2 h-4" title={session.lastMessage || "Chưa có tin nhắn"}>
                  {session.lastMessage || "Chưa có tin nhắn"}
                </div>
                
                <div className="text-[10px] text-slate-400 font-semibold bg-slate-50 px-2 py-1 rounded-md mt-auto">
                  {session.lastMessageAt ? new Date(session.lastMessageAt).toLocaleString("vi-VN", { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : ""}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </>
  );
}

interface OwnerChatWindowProps {
  locationId: number;
  customerId: number;
  customerName: string;
  hasNewMessage?: boolean;
  onClose: () => void;
  onFocus: () => void;
  onMinimize: () => void;
  onAvatarLoaded: (avatarUrl: string) => void;
  onUnreadChange: (count: number) => void;
  locationImageUrl?: string | null;
  initialUnreadCount?: number;
  incomingMessage?: LocationChatMessageItem;
}

function OwnerChatWindow({
  locationId,
  customerId,
  customerName,
  hasNewMessage,
  onClose,
  onFocus,
  onMinimize,
  onAvatarLoaded,
  onUnreadChange,
  locationImageUrl,
  initialUnreadCount = 0,
  incomingMessage,
}: OwnerChatWindowProps) {
  const [messages, setMessages] = useState<LocationChatMessageItem[]>([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Số tin nhắn chưa đọc của cửa sổ chat này
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [isFocused, setIsFocused] = useState(false);

  // Trạng thái ảnh đại diện của khách hàng
  const [customerAvatar, setCustomerAvatar] = useState<string | null>(null);

  // Ref để truy cập messages hiện tại trong socket event (tránh stale closure)
  const messagesRef = useRef<typeof messages>([]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  // isPreloadedRef: đánh dấu đã preload xong

  // Ảnh đính kèm (base64)
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const imageLoadingIdsRef = useRef<Set<number>>(new Set());
  const getCurrentUserId = useCallback(() => {
    try {
      return sessionStorage.getItem("user")
        ? Number(JSON.parse(sessionStorage.getItem("user") || "{}").user_id)
        : null;
    } catch {
      return null;
    }
  }, []);

  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);

  const onFocusRef = useRef(onFocus);
  useEffect(() => {
    onFocusRef.current = onFocus;
  }, [onFocus]);

  const onAvatarLoadedRef = useRef(onAvatarLoaded);
  useEffect(() => {
    onAvatarLoadedRef.current = onAvatarLoaded;
  }, [onAvatarLoaded]);

  const isFocusedRef = useRef(isFocused);
  const onUnreadChangeRef = useRef(onUnreadChange);
  useEffect(() => { onUnreadChangeRef.current = onUnreadChange; }, [onUnreadChange]);

  useEffect(() => {
    isFocusedRef.current = isFocused;
    if (isFocused && unreadCount > 0) {
      setUnreadCount(0);
      onFocusRef.current();
      locationChatApi.markRead(locationId, customerId).catch(console.error);
    } else if (isFocused) {
      // Just mark read when first focused if unreadCount was 0
      onFocusRef.current();
      locationChatApi.markRead(locationId, customerId).catch(console.error);
    }
  }, [isFocused, unreadCount, locationId, customerId]);

  // Truyền unreadCount lên OwnerChatManager để hiển thị badge
  useEffect(() => {
    onUnreadChangeRef.current(unreadCount);
  }, [unreadCount]);

  const handleClearHistory = useCallback(async () => {
    if (!window.confirm("Bạn có chắc muốn xóa toàn bộ lịch sử trò chuyện này không? Tin nhắn sẽ chỉ được ẩn ở phía bạn.")) {
      return;
    }
    try {
      const res = await locationChatApi.clearHistory(locationId, customerId);
      if (res.success) {
        setMessages([]);
      }
    } catch (err) {
      console.error("Lỗi xóa đoạn chat:", err);
      alert("Không thể xóa đoạn chat.");
    }
  }, [locationId, customerId]);

  useEffect(() => {
    setUnreadCount((prev) => Math.max(prev, initialUnreadCount));
  }, [initialUnreadCount]);

  // Cuộn tin nhắn xuống dưới cùng
  useEffect(() => {
    if (scrollRef.current && !isFetchingMore) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isFetchingMore]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (e.currentTarget.scrollTop === 0 && hasMore && !isFetchingMore && !loading) {
      const currentScrollHeight = e.currentTarget.scrollHeight;
      void fetchHistoryRef.current("older").then(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight - currentScrollHeight;
        }
      });
    }
  };

  // Nhấp ra ngoài cửa sổ để hủy focus (nếu nhấp ra ngoài, tin nhắn mới đến sẽ hiện số đỏ tiếp)
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const el = document.getElementById(`owner-chat-box-${customerId}`);
      if (el && !el.contains(e.target as Node)) {
        setIsFocused(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [customerId]);

  const loadMessageImage = useCallback(async (messageId: number) => {
    if (!Number.isFinite(messageId) || imageLoadingIdsRef.current.has(messageId)) return;
    imageLoadingIdsRef.current.add(messageId);
    try {
      const res = await locationChatApi.getMessageImage(locationId, messageId);
      if (res.success && res.data?.image_data) {
        setMessages((prev) =>
          prev.map((m) =>
            Number(m.message_id) === Number(messageId)
              ? { ...m, image_data: res.data.image_data, has_image: true }
              : m
          )
        );
      }
    } catch (err) {
      console.error("[OwnerChatWindow] Không thể tải ảnh chat:", err);
    } finally {
      imageLoadingIdsRef.current.delete(messageId);
    }
  }, [locationId]);

  useEffect(() => {
    messages.forEach((item) => {
      if (item.has_image && !item.image_data) {
        void loadMessageImage(item.message_id);
      }
    });
  }, [loadMessageImage, messages]);

  // Lấy lịch sử hỗ trợ Infinite Scroll
  const fetchHistory = useCallback(async (direction?: "older" | "newer"): Promise<boolean> => {
    try {
      const isInitial = !direction;
      if (isInitial) {
        setLoading(true);
        setError(null);
        setHasMore(true);
      } else if (direction === "older") {
        setIsFetchingMore(true);
      }

      let afterId: number | undefined = undefined;
      let beforeId: number | undefined = undefined;

      if (direction === "newer") {
        if (messagesRef.current.length > 0) {
          afterId = Math.max(...messagesRef.current.map((m) => Number(m.message_id)));
        }
      } else if (direction === "older") {
        if (messagesRef.current.length > 0) {
          beforeId = Math.min(...messagesRef.current.map((m) => Number(m.message_id)));
        }
      }

      const res = await locationChatApi.getHistory(
        locationId,
        customerId,
        afterId,
        beforeId,
        50, // limit
        false,
        false
      );

      if (res.success) {
        let list = res.data || [];
        if (isInitial) {
          setMessages(list);
          if (list.length < 50) setHasMore(false);
        } else if (direction === "older") {
          if (list.length > 0) {
            setMessages((prev) => {
              const newMsgs = list.filter((m: any) => !prev.some((p) => p.message_id === m.message_id));
              return [...newMsgs, ...prev];
            });
          }
          if (list.length < 50) setHasMore(false);
        } else if (direction === "newer") {
          if (list.length > 0) {
            setMessages((prev) => {
              const newMsgs = list.filter((m: any) => !prev.some((p) => p.message_id === m.message_id));
              return [...prev, ...newMsgs];
            });
          }
        }
        
        const firstWithAvatar = (list as any[]).find((m) => m.customer_avatar);
        if (firstWithAvatar && firstWithAvatar.customer_avatar) {
          setCustomerAvatar(firstWithAvatar.customer_avatar);
          onAvatarLoadedRef.current(firstWithAvatar.customer_avatar);
        }
        return true;
      }
      if (isInitial) setError("Không thể tải lịch sử.");
      return false;
    } catch {
      if (!direction) setError("Không thể tải lịch sử.");
      return false;
    } finally {
      setLoading(false);
      setIsFetchingMore(false);
    }
  }, [customerId, locationId]);

  // Ref để tránh stale closure trong socket event listener
  const fetchHistoryRef = useRef(fetchHistory);
  useEffect(() => { fetchHistoryRef.current = fetchHistory; }, [fetchHistory]);

  // Tải history một lần khi cửa sổ mở. Socket realtime dùng chung ở OwnerChatManager.
  useEffect(() => {
    let cancelled = false;
    void fetchHistory().then((loaded) => {
      if (!cancelled && loaded) {
        locationChatApi.markRead(locationId, customerId).catch(console.error);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [customerId, fetchHistory, locationId]);

  useEffect(() => {
    if (!incomingMessage) return;
    if (
      Number(incomingMessage.location_id) !== locationId ||
      Number(incomingMessage.customer_id) !== customerId
    ) return;

    if (incomingMessage.customer_avatar) {
      setCustomerAvatar(incomingMessage.customer_avatar);
    }

    const currentUserId = getCurrentUserId();
    if (Number(incomingMessage.sender_id) !== Number(currentUserId) && !isFocusedRef.current) {
      setUnreadCount((prev) => prev + 1);
    }

    setMessages((prev) => {
      if (prev.some((m) => m.message_id === incomingMessage.message_id)) return prev;
      return [...prev, incomingMessage];
    });
  }, [customerId, getCurrentUserId, incomingMessage, locationId]);



  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (file.size > 5 * 1024 * 1024) {
        setError("Kích thước ảnh tối đa là 5MB.");
        return;
      }
      const base64 = await fileToBase64(file);
      setSelectedImage(base64);
      setError(null);
    } catch {
      setError("Không thể xử lý tệp ảnh.");
    }
  };

  const handleSend = async () => {
    if (!content.trim() && !selectedImage) return;
    const msgText = content.trim();
    const imgData = selectedImage;

    setContent("");
    setSelectedImage(null);

    try {
      const res = await locationChatApi.sendMessage(
        locationId,
        msgText,
        customerId,
        imgData
      );

      if (res.success && res.data) {
        setMessages((prev) => {
          if (prev.some((m) => m.message_id === res.data.message_id)) return prev;
          return [...prev, res.data];
        });
      }
    } catch {
      setError("Không gửi được.");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      void handleSend();
    }
  };

  const handleWindowClick = () => {
    setIsFocused(true);
  };

  const resolvedAvatar = resolveBackendUrl(customerAvatar);

  return (
    <div
      id={`owner-chat-box-${customerId}`}
      onClick={handleWindowClick}
      className={`w-[360px] sm:w-[400px] h-[520px] rounded-t-2xl border border-slate-100 bg-white/95 backdrop-blur-md shadow-2xl flex flex-col overflow-hidden animate-fade-in-up transition-all duration-300 ${
        hasNewMessage || unreadCount > 0
          ? "ring-2 ring-emerald-500 animate-pulse-subtle"
          : ""
      }`}
    >
      {/* Header */}
      <div
        className="p-3 text-white bg-gradient-to-r from-teal-600 to-emerald-600 flex items-center justify-between select-none shrink-0 h-[48px]"
      >
        <div className="flex items-center gap-2 min-w-0">
          {resolvedAvatar ? (
            <img
              src={resolvedAvatar}
              alt={customerName}
              className="h-8 w-8 rounded-full object-cover border border-white/20 shrink-0"
            />
          ) : (
            <span className="text-base shrink-0">👤</span>
          )}
          <div className="min-w-0">
            <h4 className="text-sm font-bold truncate leading-snug flex items-center gap-1.5 max-w-[180px]">
              <span>{customerName}</span>
              {/* Badge số màu đỏ nổi bật tin nhắn chưa đọc */}
              {unreadCount > 0 && (
                <span className="bg-rose-500 text-white rounded-full text-[8px] font-bold h-5 min-w-[20px] px-1 flex items-center justify-center border border-white animate-bounce shrink-0">
                  {unreadCount}
                </span>
              )}
            </h4>
            <p className="text-[10px] opacity-80 font-semibold">Khách hàng trực tuyến</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 ml-2">
          {messages.length > 0 && (
            <button
              type="button"
              className="text-white/80 hover:text-rose-400 transition p-1 shrink-0 bg-rose-500/10 hover:bg-rose-500/20 rounded-full"
              onClick={(e) => {
                e.stopPropagation();
                void handleClearHistory();
              }}
              title="Xóa toàn bộ trò chuyện"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
          <button
            type="button"
            className="text-white/80 hover:text-white transition p-1 shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onMinimize();
            }}
            title="Thu nhỏ thành bong bóng"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
          <button
            type="button"
            className="text-white/80 hover:text-white transition p-1 shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            title="Đóng"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Message List */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-3 space-y-2.5 relative"
        style={
          locationImageUrl
            ? {
                backgroundImage: `url(${resolveBackendUrl(locationImageUrl)})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundBlendMode: "soft-light",
                backgroundColor: "rgba(255, 255, 255, 0.88)",
              }
            : { backgroundColor: "rgba(250, 251, 252, 0.5)" }
        }
      >
        <div className="relative z-10 space-y-2.5 min-h-full">
            {(loading || isFetchingMore) && (
              <div className="flex flex-col items-center justify-center py-4 space-y-2">
                <span className="block h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                <span className="text-[10px] text-slate-500 font-medium">Đang tải...</span>
              </div>
            )}

        {error && (
          <div className="rounded-lg bg-rose-50 border border-rose-100 p-2 text-center text-xs text-rose-600">
            {error}
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div className="text-center text-xs text-slate-400 py-10 space-y-1">
            <p className="font-bold text-slate-500 text-sm">Khung chat trống</p>
            <p className="max-w-[200px] mx-auto leading-relaxed">
              Nhập tin nhắn để phản hồi khách hàng.
            </p>
          </div>
        )}

        {messages.map((item) => {
          const currentUserId = sessionStorage.getItem("user")
            ? JSON.parse(sessionStorage.getItem("user") || "{}").user_id
            : null;
          const isMe = Number(item.sender_id) === Number(currentUserId);

          return (
            <div
              key={item.message_id}
              className={`group flex flex-col max-w-[80%] ${isMe ? "ml-auto items-end" : "mr-auto items-start"}`}
            >
              {/* Image message */}
              {item.image_data ? (
                <div className="mb-0.5">
                  <img
                    src={item.image_data}
                    alt="Ảnh gửi"
                    className="max-w-full max-h-32 rounded-lg object-cover border border-slate-200 shadow-sm cursor-pointer hover:opacity-90 transition"
                    onClick={() => {
                      const newTab = window.open();
                      if (newTab) {
                        newTab.document.write(`<img src="${item.image_data}" style="max-width:100%; max-height:100vh; display:block; margin:auto;" />`);
                      }
                    }}
                  />
                </div>
              ) : item.has_image ? (
                <div
                  className={`mb-0.5 rounded-lg border px-3 py-2 text-xs font-semibold shadow-sm ${
                    isMe
                      ? "border-teal-200 bg-teal-50 text-teal-700"
                      : "border-slate-200 bg-white text-slate-500"
                  }`}
                >
                  Ảnh đã gửi
                </div>
              ) : null}

              {/* Text message */}
              {item.content && (
                <div
                  className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed break-words font-medium shadow-sm ${
                    isMe
                      ? "bg-teal-600 text-white rounded-br-none"
                      : "bg-white text-slate-800 border border-slate-100 rounded-bl-none"
                  }`}
                >
                  {item.content}
                </div>
              )}

              {/* Hiển thị thời gian bên dưới tin nhắn */}
              <div className="flex items-center gap-1 mt-0.5 px-1">
                <span className="text-[10px] text-slate-400">
                  {formatMessageTime(item.created_at)}
                </span>
              </div>
            </div>
          );
        })}
        </div>
      </div>

      {/* Image Preview inside window */}
      {selectedImage && (
        <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-100 flex items-center gap-2">
          <div className="relative">
            <img
              src={selectedImage}
              alt="Preview"
              className="h-10 w-10 rounded object-cover border border-slate-200"
            />
            <button
              type="button"
              className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white rounded-full h-4 w-4 flex items-center justify-center text-[8px] shadow hover:bg-rose-600"
              onClick={() => setSelectedImage(null)}
            >
              ✕
            </button>
          </div>
          <span className="text-xs text-slate-400">Ảnh đã đính kèm</span>
        </div>
      )}

      {/* Footer input */}
      <div className="p-2 border-t border-slate-100 bg-white flex items-center gap-1.5 shrink-0">
        <input
          type="file"
          accept="image/*"
          className="hidden"
          ref={fileInputRef}
          onChange={handleImageSelect}
        />
        <button
          type="button"
          className="h-7 w-7 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:text-teal-600 hover:border-teal-600 transition shrink-0"
          onClick={() => fileInputRef.current?.click()}
          title="Gửi hình ảnh"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </button>

        <input
          type="text"
          className="flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm transition focus:border-teal-500 focus:outline-none"
          placeholder="Nhập tin nhắn..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          type="button"
          className="h-7 w-7 rounded-full bg-teal-600 hover:bg-teal-700 flex items-center justify-center text-white shadow-sm transition shrink-0"
          onClick={() => void handleSend()}
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>
      </div>
    </div>
  );
}
