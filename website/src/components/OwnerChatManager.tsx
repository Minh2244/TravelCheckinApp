import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import locationChatApi from "../api/locationChatApi";
import type { LocationChatMessageItem } from "../api/locationChatApi";
import { resolveBackendUrl } from "../utils/resolveBackendUrl";

interface OwnerChatManagerProps {
  locationId?: number | null;
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
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const timeStr = date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false });
    if (isToday) return timeStr;
    
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${timeStr} ${day}/${month}`;
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
}

export default function OwnerChatManager({ locationId }: OwnerChatManagerProps) {
  const [openChats, setOpenChats] = useState<ChatSession[]>([]);
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
          storedChats = JSON.parse(stored) as ChatSession[];
        }
      } catch (e) {
        console.error("[OwnerChatManager] Lỗi khi đọc localStorage:", e);
      }

      if (!isMounted) return;

      try {
        const res = await locationChatApi.getActiveSessions(activeLocationId);
        if (res.success && res.data && isMounted) {
          const apiSessions = res.data;
          const mergedChatsMap = new Map<number, ChatSession>();

          // Đưa các chat từ localStorage vào trước
          for (const c of storedChats) {
            mergedChatsMap.set(c.customerId, c);
          }

          // Duyệt qua danh sách active sessions từ API
          for (const sess of apiSessions) {
            const existing = mergedChatsMap.get(sess.customerId);
            
            // Nếu có tin nhắn chưa trả lời (unreadCount > 0) hoặc session này đã từng được mở
            if (sess.unreadCount > 0 || existing) {
              mergedChatsMap.set(sess.customerId, {
                customerId: sess.customerId,
                customerName: sess.customerName,
                customerAvatar: sess.customerAvatar || (existing ? existing.customerAvatar : null),
                // Nếu chưa từng mở thì mặc định thu nhỏ
                isMinimized: existing ? existing.isMinimized : true,
                hasNewMessage: sess.unreadCount > 0 ? true : (existing ? existing.hasNewMessage : false),
                unreadCount: sess.unreadCount,
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
        if (isMounted) {
          hasLoadedRef.current[activeLocationId] = true;
        }
      }
    };

    void loadChats();

    return () => {
      isMounted = false;
    };
  }, [activeLocationId]);

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

      console.log(`[OwnerChatManager] Mở/Highlight khung chat cho customerId: ${customerId}`);
      setOpenChats((prev) => {
        const exists = prev.some((c) => c.customerId === customerId);
        if (exists) {
          return prev.map((c) =>
            c.customerId === customerId 
              ? { ...c, hasNewMessage: true, customerAvatar: customerAvatar || c.customerAvatar } 
              : c
          );
        } else {
          return [...prev, { customerId, customerName, hasNewMessage: true, isMinimized: false, customerAvatar }];
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
    setOpenChats((prev) => prev.filter((c) => c.customerId !== customerId));
  };

  const handleClearHighlight = (customerId: number) => {
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
}: OwnerChatWindowProps) {
  const [messages, setMessages] = useState<LocationChatMessageItem[]>([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Số tin nhắn chưa đọc của cửa sổ chat này
  const [unreadCount, setUnreadCount] = useState(0);
  const [isFocused, setIsFocused] = useState(false);

  // Trạng thái ảnh đại diện của khách hàng
  const [customerAvatar, setCustomerAvatar] = useState<string | null>(null);

  // Vị trí và kéo thả
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);

  const handleHeaderMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("input") || target.closest("a")) {
      return;
    }
    e.preventDefault();

    const parentEl = e.currentTarget.closest("[id^='owner-chat-box-']") as HTMLElement;
    if (!parentEl) return;

    const rect = parentEl.getBoundingClientRect();
    parentEl.style.transition = "none";

    const startX = e.clientX;
    const startY = e.clientY;
    const posX = rect.left;
    const posY = rect.top;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      let newX = posX + dx;
      let newY = posY + dy;

      const maxX = window.innerWidth - rect.width;
      const maxY = window.innerHeight - rect.height;
      newX = Math.max(0, Math.min(newX, maxX));
      newY = Math.max(0, Math.min(newY, maxY));

      parentEl.style.left = `${newX}px`;
      parentEl.style.top = `${newY}px`;
      parentEl.style.bottom = "auto";
      parentEl.style.right = "auto";
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      parentEl.style.transition = "";

      const finalRect = parentEl.getBoundingClientRect();
      setPosition({ x: finalRect.left, y: finalRect.top });
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  // Ảnh đính kèm (base64)
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const socketUrl = useMemo(() => resolveSocketUrl(), []);

  const onFocusRef = useRef(onFocus);
  useEffect(() => {
    onFocusRef.current = onFocus;
  }, [onFocus]);

  const isFocusedRef = useRef(isFocused);
  const onUnreadChangeRef = useRef(onUnreadChange);
  useEffect(() => { onUnreadChangeRef.current = onUnreadChange; }, [onUnreadChange]);

  useEffect(() => {
    isFocusedRef.current = isFocused;
    if (isFocused) {
      setUnreadCount(0);
      onFocusRef.current();
    }
  }, [isFocused]);

  // Truyền unreadCount lên OwnerChatManager để hiển thị badge
  useEffect(() => {
    onUnreadChangeRef.current(unreadCount);
  }, [unreadCount]);

  // Cuộn tin nhắn xuống dưới cùng
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

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

  // Helper: fetch lịch sử chat (dùng chung load đầu + refresh khi nhận has_image)
  const fetchHistory = useCallback(async (showLoading = false) => {
    try {
      if (showLoading) {
        setLoading(true);
        setError(null);
      }
      const res = await locationChatApi.getHistory(locationId, customerId);
      if (res.success) {
        const list = res.data || [];
        setMessages(list);
        const firstWithAvatar = list.find((m) => m.customer_avatar);
        if (firstWithAvatar && firstWithAvatar.customer_avatar) {
          setCustomerAvatar(firstWithAvatar.customer_avatar);
          onAvatarLoaded(firstWithAvatar.customer_avatar);
        }
      }
    } catch {
      if (showLoading) setError("Không thể tải lịch sử.");
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [locationId, customerId, onAvatarLoaded]);

  // Ref để tránh stale closure trong socket event listener
  const fetchHistoryRef = useRef(fetchHistory);
  useEffect(() => { fetchHistoryRef.current = fetchHistory; }, [fetchHistory]);

  // Kết nối socket riêng và lấy lịch sử tin nhắn của thread khách hàng này
  useEffect(() => {
    const token = sessionStorage.getItem("accessToken");
    if (!token) return;

    console.log(`[OwnerChatWindow - Customer ${customerId}] Tải lịch sử chat...`);
    void fetchHistory(true);

    console.log(`[OwnerChatWindow - Customer ${customerId}] Đang kết nối socket chat riêng...`);
    const socket = io(socketUrl, {
      auth: { token },
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log(`[OwnerChatWindow - Customer ${customerId}] Đã kết nối socket! ID:`, socket.id);
      socket.emit("join_location_room", { locationId, customerId });
    });

    socket.on("location_chat_message", (msg: LocationChatMessageItem & { has_image?: boolean; customer_avatar?: string }) => {
      console.log(`[OwnerChatWindow - Customer ${customerId}] Nhận socket event:`, {
        message_id: msg.message_id,
        has_image: msg.has_image,
        content: msg.content?.slice(0, 30),
      });

      if (
        Number(msg.location_id) !== locationId ||
        Number(msg.customer_id) !== customerId
      ) return;

      if (msg.customer_avatar) {
        setCustomerAvatar(msg.customer_avatar);
      }

      // Tăng badge NGAY LẬP TỨC từ metadata (không cần chờ ảnh)
      const currentUserId = sessionStorage.getItem("user")
        ? JSON.parse(sessionStorage.getItem("user") || "{}").user_id
        : null;
      if (Number(msg.sender_id) !== Number(currentUserId) && !isFocusedRef.current) {
        setUnreadCount((prev) => prev + 1);
      }

      // Luôn append ngay lập tức để hiển thị cả tin nhắn từ khách
      setMessages((prev) => {
        if (prev.some((m) => m.message_id === msg.message_id)) return prev;
        return [...prev, msg];
      });

      if (msg.has_image) {
        // Tin nhắn có ảnh → refetch history để lấy image_data đầy đủ (dùng ref để tránh stale closure)
        console.log(`[OwnerChatWindow - Customer ${customerId}] has_image=true, đang refetch history...`);
        void fetchHistoryRef.current(false);
      }
    });

    return () => {
      socket.off("location_chat_message");
      socket.disconnect();
      socketRef.current = null;
    };
  }, [locationId, customerId, socketUrl]);

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
      style={
        position
          ? {
              position: "fixed",
              left: `${position.x}px`,
              top: `${position.y}px`,
              bottom: "auto",
              right: "auto",
              zIndex: 1000,
            }
          : {}
      }
    >
      {/* Header */}
      <div
        onMouseDown={handleHeaderMouseDown}
        className="p-3 text-white bg-gradient-to-r from-teal-600 to-emerald-600 flex items-center justify-between cursor-move select-none shrink-0 h-[48px]"
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
        <div className="flex items-center gap-1 shrink-0">
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
        className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-[#fafbfc]/50"
      >
        {loading && (
          <div className="text-center text-xs text-slate-400 py-6 font-medium">
            <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-teal-500 border-t-transparent mb-1" />
            <p>Đang tải lịch sử...</p>
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
              className={`flex flex-col max-w-[80%] ${isMe ? "ml-auto items-end" : "mr-auto items-start"}`}
            >
              {/* Image message */}
              {item.image_data && (
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
              )}

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
              <span className="text-[10px] text-slate-400 mt-0.5 px-1">
                {formatMessageTime(item.created_at)}
              </span>
            </div>
          );
        })}
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
