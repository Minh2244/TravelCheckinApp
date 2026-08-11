import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import locationChatApi from "../api/locationChatApi";
import type { LocationChatMessageItem } from "../api/locationChatApi";
import { resolveBackendUrl } from "../utils/resolveBackendUrl";

interface LocationChatBubbleProps {
  locationId?: number | null;
  userRole: "user" | "owner" | "employee";
  locationName?: string;
  locationImage?: string | null;
  initialOpen?: boolean;
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

const LocationChatBubble = ({
  locationId,
  userRole,
  locationName,
  locationImage,
  initialOpen,
}: LocationChatBubbleProps) => {
  const [isOpen, setIsOpen] = useState(initialOpen || false);
  const [messages, setMessages] = useState<LocationChatMessageItem[]>([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeLocationId = Number(locationId);

  // Số tin nhắn chưa đọc
  const [unreadCount, setUnreadCount] = useState(0);

  // Ảnh đính kèm (base64)
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const imageLoadingIdsRef = useRef<Set<number>>(new Set());

  // Vị trí định vị bong bóng
  const positionClass = userRole === "user" ? "bottom-24 right-6" : "bottom-6 right-24";

  const socketUrl = useMemo(() => resolveSocketUrl(), []);

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

  const getHiddenKey = useCallback(() => {
    const currentUserId = getCurrentUserId();
    if (!activeLocationId || !Number.isFinite(activeLocationId)) return null;
    return `chat_hidden_after_${activeLocationId}_${userRole}_${currentUserId || "guest"}`;
  }, [activeLocationId, getCurrentUserId, userRole]);

  const readHiddenMessageId = useCallback(() => {
    const key = getHiddenKey();
    if (!key) return 0;
    const value = Number(localStorage.getItem(key));
    return Number.isFinite(value) ? value : 0;
  }, [getHiddenKey]);

  const hideChat = useCallback(() => {
    if (messages.length === 0) return;
    const maxId = Math.max(...messages.map((m) => Number(m.message_id) || 0));
    const key = getHiddenKey();
    if (key) localStorage.setItem(key, String(maxId));
    setMessages([]);
    setHasMore(false);
  }, [messages, getHiddenKey]);

  // Sync isOpen to ref to avoid stale closures in socket listener
  const isOpenRef = useRef(isOpen);
  useEffect(() => {
    isOpenRef.current = isOpen;
    if (isOpen) {
      setUnreadCount(0);
    }
  }, [isOpen]);

  // Đồng bộ prop initialOpen và lắng nghe event đóng chat
  useEffect(() => {
    if (initialOpen) {
      setIsOpen(true);
    }
    
    const closeLocationChat = () => setIsOpen(false);
    window.addEventListener("tc-close-location-chat", closeLocationChat);
    return () => {
      window.removeEventListener("tc-close-location-chat", closeLocationChat);
    };
  }, [initialOpen, activeLocationId]);

  // Cuộn tin nhắn xuống dưới cùng
  useEffect(() => {
    if (scrollRef.current && !isFetchingMore) {
      // Đảm bảo DOM cập nhật hoàn toàn trước khi đo chiều cao
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight + 1000; // Force scroll to bottom
          }
        }, 150);
      });
    }
  }, [messages, isOpen, isFetchingMore]);

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

  const loadMessageImage = useCallback(async (messageId: number) => {
    if (!activeLocationId || !Number.isFinite(activeLocationId)) return;
    if (!Number.isFinite(messageId) || imageLoadingIdsRef.current.has(messageId)) return;
    imageLoadingIdsRef.current.add(messageId);
    try {
      const res = await locationChatApi.getMessageImage(activeLocationId, messageId);
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
      console.error("[LocationChatBubble] Không thể tải ảnh chat:", err);
    } finally {
      imageLoadingIdsRef.current.delete(messageId);
    }
  }, [activeLocationId]);

  useEffect(() => {
    messages.forEach((item) => {
      if (item.has_image && !item.image_data) {
        void loadMessageImage(item.message_id);
      }
    });
  }, [loadMessageImage, messages]);

  // Lấy lịch sử chat hỗ trợ Infinite Scroll
  const fetchHistory = useCallback(async (direction?: "older" | "newer") => {
    if (!activeLocationId || !Number.isFinite(activeLocationId)) return;
    try {
      const isInitial = !direction;
      if (isInitial) {
        setLoading(true);
        setError(null);
        setHasMore(true);
      } else if (direction === "older") {
        setIsFetchingMore(true);
      }

      const currentUserId = getCurrentUserId();
      const targetCustomerId = userRole === "user" ? currentUserId : undefined;
      const hiddenId = readHiddenMessageId();

      let afterId: number | undefined = undefined;
      let beforeId: number | undefined = undefined;

      if (direction === "newer") {
        if (messagesRef.current.length > 0) {
          afterId = Math.max(...messagesRef.current.map((m) => Number(m.message_id)));
        } else {
          afterId = hiddenId; // Only fetch new messages after hidden point
        }
      } else if (direction === "older") {
        if (messagesRef.current.length > 0) {
          beforeId = Math.min(...messagesRef.current.map((m) => Number(m.message_id)));
        }
      }

      const res = await locationChatApi.getHistory(
        activeLocationId,
        targetCustomerId || undefined,
        afterId,
        beforeId,
        50, // limit
        false,
        false
      );

      if (res.success) {
        let list = res.data || [];
        // Filter out hidden messages
        if (hiddenId > 0) {
          list = list.filter((m) => Number(m.message_id) > hiddenId);
        }

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
      }
    } catch {
      if (!direction) setError("Không thể tải lịch sử cuộc trò chuyện.");
    } finally {
      setLoading(false);
      setIsFetchingMore(false);
    }
  }, [activeLocationId, getCurrentUserId, userRole, readHiddenMessageId]);

  // Ref để tránh stale closure trong socket event listener
  const fetchHistoryRef = useRef(fetchHistory);
  useEffect(() => { fetchHistoryRef.current = fetchHistory; }, [fetchHistory]);

  // messagesRef để tránh stale closure khi cần biết ID tin nhắn cuối
  const messagesRef = useRef(messages);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // 1. Tải/đồng bộ lịch sử khi mở khung chat
  useEffect(() => {
    if (!isOpen) return;
    void fetchHistory();
    locationChatApi.markRead(activeLocationId).catch(console.error);
  }, [isOpen, fetchHistory, activeLocationId]);

  // 2. Duy trì kết nối Socket ngầm để nhận thông báo tin chưa đọc ngay cả khi đóng chat
  useEffect(() => {
    if (!activeLocationId || !Number.isFinite(activeLocationId)) {
      console.warn("[LocationChatBubble] activeLocationId không hợp lệ:", activeLocationId);
      return;
    }

    const token = sessionStorage.getItem("accessToken");
    if (!token) {
      console.warn("[LocationChatBubble] Không tìm thấy accessToken trong sessionStorage");
      return;
    }

    console.log(`[LocationChatBubble] Đang kết nối socket tới: ${socketUrl}`);
    const socket = io(socketUrl, {
      auth: { token },
      transports: ["websocket"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      const currentUserId = getCurrentUserId();
      const targetCustomerId = userRole === "user" ? currentUserId : undefined;

      const roomName = `location_${activeLocationId}_customer_${targetCustomerId || "fallback"}`;
      console.log(`[LocationChatBubble] Socket connected! ID: ${socket.id}. Joining room: ${roomName}`);

      socket.emit("join_location_room", {
        locationId: activeLocationId,
        customerId: targetCustomerId,
      });

      void fetchHistoryRef.current("newer");
    });

    socket.on("connect_error", (err) => {
      console.error("[LocationChatBubble] Socket connection error:", err);
    });

    socket.on("disconnect", (reason) => {
      console.warn("[LocationChatBubble] Socket disconnected, lý do:", reason);
    });

    socket.on("location_chat_message", (msg: LocationChatMessageItem & { has_image?: boolean }) => {
      console.log("[LocationChatBubble] Nhận socket event location_chat_message:", {
        message_id: msg.message_id,
        has_image: msg.has_image,
        sender_role: msg.sender_role,
        content: msg.content?.slice(0, 30),
      });

      if (Number(msg.location_id) !== activeLocationId) return;

      // Tăng badge NGAY LẬP TỨC dựa vào metadata (không cần chờ ảnh)
      const currentUserId = getCurrentUserId();

      if (!isOpenRef.current && Number(msg.sender_id) !== Number(currentUserId)) {
        setUnreadCount((prev) => prev + 1);
      }

      // Luôn append message người khác gửi ngay lập tức.
      // Nếu có ảnh, realtime dùng has_image để hiện placeholder nhẹ.
      setMessages((prev) => {
        if (prev.some((m) => m.message_id === msg.message_id)) return prev;
        return [...prev, msg];
      });

      // Không refetch toàn bộ history khi có ảnh. Base64 ảnh rất nặng; socket đã
      // append placeholder bằng has_image để chat realtime không bị đứng.
    });

    return () => {
      console.log("[LocationChatBubble] Cleanup socket...");
      socket.off("location_chat_message");

      socket.disconnect();
      socketRef.current = null;
    };
  }, [activeLocationId, getCurrentUserId, socketUrl, userRole]);

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
    if ((!content.trim() && !selectedImage) || !activeLocationId) return;
    const msgText = content.trim();
    const imgData = selectedImage;
    
    setContent("");
    setSelectedImage(null);

    try {
      const currentUserId = sessionStorage.getItem("user")
        ? JSON.parse(sessionStorage.getItem("user") || "{}").user_id
        : null;
      const targetCustomerId = userRole === "user" ? currentUserId : undefined;

      const res = await locationChatApi.sendMessage(
        activeLocationId,
        msgText,
        targetCustomerId,
        imgData
      );

      if (res.success && res.data) {
        setMessages((prev) => {
          if (prev.some((m) => m.message_id === res.data.message_id)) return prev;
          return [...prev, res.data];
        });
      }
    } catch {
      setError("Không thể gửi tin nhắn. Vui lòng thử lại.");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      void handleSend();
    }
  };

  if (!activeLocationId) return null;

  const resolvedImg = resolveBackendUrl(locationImage);

  return (
    <div
      className={`fixed z-50 ${positionClass} font-sans`}
    >
      {/* Nút bong bóng chat (chỉ hiện khi chưa mở khung) */}
      <button
        type="button"
        className={`relative flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition-transform duration-300 hover:scale-110 active:scale-95 cursor-pointer ${
          userRole === "user"
            ? "bg-gradient-to-tr from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-500/30"
            : "bg-gradient-to-tr from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-emerald-500/30"
        } ${isOpen ? "opacity-0 pointer-events-none scale-0" : "opacity-100 scale-100"}`}
        onClick={() => {
          window.dispatchEvent(new Event("tc-close-ai-chat"));
          setIsOpen(true);
        }}
        aria-label="Mở chat"
      >
        {isOpen ? (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        )}

        {/* Số tin nhắn chưa đọc màu đỏ */}
        {unreadCount > 0 && !isOpen && (
          <span className="absolute -top-1 -right-1 bg-rose-500 text-white rounded-full text-[10px] font-bold h-6 w-6 flex items-center justify-center border-2 border-white animate-bounce">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Cửa sổ hội thoại nổi */}
      {isOpen && (
        <div className={`absolute bottom-16 right-0 bg-white/95 backdrop-blur-md shadow-2xl flex flex-col z-40 overflow-hidden transition-all duration-300 origin-bottom-right rounded-2xl border border-slate-100 w-[360px] sm:w-[400px] h-[520px] max-h-[80vh]`}>
          {/* Header */}
          <div
            className={`p-4 text-white flex items-center justify-between select-none ${
              userRole === "user"
                ? "bg-gradient-to-r from-blue-600 to-indigo-600"
                : "bg-gradient-to-r from-teal-600 to-emerald-600"
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              {resolvedImg ? (
                <img
                  src={resolvedImg}
                  alt={locationName || "Tiệm"}
                  className="h-8 w-8 rounded-full object-cover border border-white/20 shrink-0"
                />
              ) : (
                <span className="text-xl shrink-0">💬</span>
              )}
              <div className="min-w-0">
                <h4 className="text-sm font-bold font-heading uppercase tracking-wider truncate max-w-[180px]">
                  {locationName || (userRole === "user" ? "Liên hệ địa điểm" : "Kênh khách hàng")}
                </h4>
                <p className="text-[10px] opacity-80 font-semibold">Kết nối thời gian thực</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {userRole === "user" && (
                <button
                  type="button"
                  className="text-white/80 hover:text-rose-200 p-1.5 rounded-full transition-colors active:scale-95 mr-1"
                  onClick={(e) => { e.stopPropagation(); hideChat(); }}
                  title="Xóa/Ẩn chat"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}

              <button
                type="button"
                className="text-white/80 hover:text-white p-1.5 rounded-full transition-colors active:scale-95"
                onClick={() => setIsOpen(false)}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Message List */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto p-4 space-y-3 relative"
          >
            {/* Background Image */}
            {locationImage && (
              <div 
                className="absolute inset-0 z-0 opacity-10 pointer-events-none"
                style={{ 
                  backgroundImage: `url(${resolveBackendUrl(locationImage)})`, 
                  backgroundSize: "cover", 
                  backgroundPosition: "center" 
                }}
              />
            )}
            
            <div className="relative z-10 space-y-3 min-h-full">
            {(loading || isFetchingMore) && (
              <div className="text-center text-xs text-slate-400 py-4 font-medium">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent mb-1" />
                <p>Đang tải lịch sử...</p>
              </div>
            )}

            {error && (
              <div className="rounded-xl bg-rose-50 border border-rose-100 p-2.5 text-center text-xs text-rose-600">
                {error}
              </div>
            )}

            {!loading && !error && messages.length === 0 && (
              <div className="text-center text-xs text-slate-400 py-12 space-y-2">
                <span className="text-xl">👋</span>
                <p className="font-bold text-slate-500 text-sm">Bắt đầu cuộc trò chuyện</p>
                <p className="text-xs text-slate-400 max-w-[200px] mx-auto leading-relaxed">
                  Gửi tin nhắn hoặc hình ảnh đầu tiên để kết nối.
                </p>
              </div>
            )}

            {!loading &&
              messages.map((item) => {
                const currentUserId = sessionStorage.getItem("user")
                  ? JSON.parse(sessionStorage.getItem("user") || "{}").user_id
                  : null;
                const isMe = Number(item.sender_id) === Number(currentUserId);
                const roleLabel =
                  item.sender_role === "owner"
                    ? "Chủ quán"
                    : item.sender_role === "employee"
                      ? "Nhân viên"
                      : "";

                return (
                  <div
                    key={item.message_id}
                    className={`flex flex-col max-w-[75%] ${isMe ? "ml-auto items-end" : "mr-auto items-start"}`}
                  >
                    {!isMe && (
                      <span className="text-[11px] font-bold text-slate-500 mb-0.5 ml-1">
                        {item.sender_name} {roleLabel && `(${roleLabel})`}
                      </span>
                    )}
                    
                    {/* Render Image if exists */}
                    {item.image_data ? (
                      <div className="mb-1">
                        <img
                          src={item.image_data}
                          alt="Gửi ảnh"
                          className="max-w-full max-h-40 rounded-xl object-cover border border-slate-200 shadow-sm cursor-pointer hover:opacity-90 transition"
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
                        className={`mb-1 rounded-xl border px-3 py-2 text-xs font-semibold shadow-sm ${
                          isMe
                            ? userRole === "user"
                              ? "border-blue-200 bg-blue-50 text-blue-700"
                              : "border-teal-200 bg-teal-50 text-teal-700"
                            : "border-slate-200 bg-white text-slate-500"
                        }`}
                      >
                        Ảnh đã gửi
                      </div>
                    ) : null}

                    {/* Render Content Text if exists */}
                    {item.content && (
                      <div
                        className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed break-words font-medium shadow-sm ${
                          isMe
                            ? userRole === "user"
                              ? "bg-blue-600 text-white rounded-br-none"
                              : "bg-teal-600 text-white rounded-br-none"
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
          </div>

          {/* Preview Image block before sending */}
          {selectedImage && (
            <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center gap-3">
              <div className="relative">
                <img
                  src={selectedImage}
                  alt="Preview"
                  className="h-14 w-14 rounded-lg object-cover border border-slate-200"
                />
                <button
                  type="button"
                  className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white rounded-full h-5 w-5 flex items-center justify-center text-[10px] shadow-md hover:bg-rose-600"
                  onClick={() => setSelectedImage(null)}
                >
                  ✕
                </button>
              </div>
              <span className="text-xs text-slate-400 font-medium">Ảnh đã đính kèm</span>
            </div>
          )}

          {/* Footer Input */}
          <div className="p-3 border-t border-slate-100 bg-white flex items-center gap-2">
            {/* Nút gửi ảnh */}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              ref={fileInputRef}
              onChange={handleImageSelect}
            />
            <button
              type="button"
              className="h-8 w-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:border-indigo-600 transition duration-200 shrink-0"
              onClick={() => fileInputRef.current?.click()}
              title="Gửi hình ảnh"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>

            <input
              type="text"
              className="flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm transition duration-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 focus:outline-none"
              placeholder="Nhập tin nhắn..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button
              type="button"
              className={`h-8 w-8 rounded-full flex items-center justify-center text-white shadow-sm transition hover:scale-105 active:scale-95 shrink-0 ${
                userRole === "user"
                  ? "bg-blue-600 hover:bg-blue-700"
                  : "bg-teal-600 hover:bg-teal-700"
              }`}
              onClick={() => void handleSend()}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LocationChatBubble;
