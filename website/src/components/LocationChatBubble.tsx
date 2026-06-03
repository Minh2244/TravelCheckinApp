import { useEffect, useRef, useState, useMemo } from "react";
import { io, Socket } from "socket.io-client";
import locationChatApi from "../api/locationChatApi";
import type { LocationChatMessageItem } from "../api/locationChatApi";

interface LocationChatBubbleProps {
  locationId?: number | null;
  userRole: "user" | "owner" | "employee";
}

const resolveSocketUrl = (): string => {
  const raw =
    (import.meta.env.VITE_SOCKET_URL as string | undefined) ||
    (import.meta.env.VITE_API_URL as string | undefined) ||
    "http://localhost:3000";
  return raw.replace(/\/api\/?$/, "");
};

const LocationChatBubble = ({ locationId, userRole }: LocationChatBubbleProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<LocationChatMessageItem[]>([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const activeLocationId = Number(locationId);

  // Vị trí định vị bong bóng
  // - Khách hàng: đặt trên bong bóng AI (bottom-24 right-6)
  // - Owner / Nhân viên: đặt ở góc dưới (bottom-6 right-6)
  const positionClass = userRole === "user" ? "bottom-24 right-6" : "bottom-6 right-6";

  const socketUrl = useMemo(() => resolveSocketUrl(), []);

  // Cuộn tin nhắn xuống cuối cùng
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  // Thiết lập Socket và phòng chat khi mở khung chat
  useEffect(() => {
    if (!isOpen || !activeLocationId || !Number.isFinite(activeLocationId)) return;

    const token = sessionStorage.getItem("accessToken");
    if (!token) return;

    // Tải lịch sử tin nhắn
    const fetchHistory = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await locationChatApi.getHistory(activeLocationId);
        if (res.success) {
          setMessages(res.data || []);
        }
      } catch {
        setError("Không thể tải lịch sử cuộc trò chuyện.");
      } finally {
        setLoading(false);
      }
    };
    void fetchHistory();

    // Kết nối Socket.io
    const socket = io(socketUrl, {
      auth: { token },
      transports: ["websocket"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join_location_room", { locationId: activeLocationId });
    });

    socket.on("location_chat_message", (msg: LocationChatMessageItem) => {
      if (Number(msg.location_id) === activeLocationId) {
        setMessages((prev) => {
          // Tránh tin nhắn bị trùng lặp
          if (prev.some((m) => m.message_id === msg.message_id)) return prev;
          return [...prev, msg];
        });
      }
    });

    return () => {
      socket.off("location_chat_message");
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isOpen, activeLocationId, socketUrl]);

  const handleSend = async () => {
    if (!content.trim() || !activeLocationId) return;
    const msgText = content.trim();
    setContent("");

    try {
      await locationChatApi.sendMessage(activeLocationId, msgText);
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

  return (
    <div className={`fixed z-50 ${positionClass} font-sans`}>
      {/* Nút bong bóng chat hình tròn */}
      <button
        type="button"
        className={`flex h-12 w-12 items-center justify-center rounded-full text-white shadow-lg transition-transform duration-300 hover:scale-110 active:scale-95 ${
          userRole === "user"
            ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-500/30"
            : "bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 shadow-teal-500/30"
        }`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Kênh chat địa điểm"
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
      </button>

      {/* Cửa sổ hội thoại nổi */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 w-[330px] sm:w-[360px] h-[450px] rounded-2xl border border-slate-100 bg-white/95 backdrop-blur-md shadow-2xl flex flex-col overflow-hidden animate-fade-in">
          {/* Header */}
          <div className={`p-4 text-white flex items-center justify-between ${
            userRole === "user"
              ? "bg-gradient-to-r from-blue-600 to-indigo-600"
              : "bg-gradient-to-r from-teal-600 to-emerald-600"
          }`}>
            <div className="flex items-center gap-2">
              <span className="text-xl">💬</span>
              <div>
                <h4 className="text-xs font-bold font-heading uppercase tracking-wider">
                  {userRole === "user" ? "Liên hệ địa điểm" : "Kênh khách hàng"}
                </h4>
                <p className="text-[9px] opacity-80 font-semibold">Kết nối thời gian thực</p>
              </div>
            </div>
            <button
              type="button"
              className="text-white/80 hover:text-white transition"
              onClick={() => setIsOpen(false)}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Message List */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#fafbfc]/50"
          >
            {loading && (
              <div className="text-center text-xs text-slate-400 py-8 font-medium">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent mb-1" />
                <p>Đang tải lịch sử trò chuyện...</p>
              </div>
            )}

            {error && (
              <div className="rounded-xl bg-rose-50 border border-rose-100 p-2.5 text-center text-[10px] text-rose-600">
                {error}
              </div>
            )}

            {!loading && !error && messages.length === 0 && (
              <div className="text-center text-xs text-slate-400 py-12 space-y-2">
                <span className="text-xl">👋</span>
                <p className="font-bold text-slate-500">Bắt đầu cuộc trò chuyện</p>
                <p className="text-[10px] text-slate-400 max-w-[200px] mx-auto leading-relaxed">
                  Gửi tin nhắn đầu tiên để kết nối với địa điểm này.
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
                      <span className="text-[9px] font-bold text-slate-500 mb-0.5 ml-1">
                        {item.sender_name} {roleLabel && `(${roleLabel})`}
                      </span>
                    )}
                    <div
                      className={`rounded-2xl px-3 py-2 text-xs leading-relaxed break-words font-medium shadow-sm ${
                        isMe
                          ? userRole === "user"
                            ? "bg-blue-600 text-white rounded-br-none"
                            : "bg-teal-600 text-white rounded-br-none"
                          : "bg-white text-slate-800 border border-slate-100 rounded-bl-none"
                      }`}
                    >
                      {item.content}
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Footer Input */}
          <div className="p-3 border-t border-slate-100 bg-white flex items-center gap-2">
            <input
              type="text"
              className="flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs transition duration-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 focus:outline-none"
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
