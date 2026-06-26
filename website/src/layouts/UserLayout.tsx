import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import userApi from "../api/userApi";
import { resolveBackendUrl } from "../utils/resolveBackendUrl";
import { formatDateTimeVi } from "../utils/formatDateVi";
import type { UserNotificationItem } from "../types/user.types";
import aiApi from "../api/aiApi";
import type { AiChatHistoryItem } from "../types/user.types";

// Dùng để định nghĩa input cho layout user, giúp tái sử dụng UI thống nhất
interface UserLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  activeKey?: string;
  showSearch?: boolean;
  onSearch?: (value: string) => void;
  searchPlaceholder?: string;
  flushTop?: boolean;
}

// Dùng để đọc dữ liệu user lưu trong sessionStorage
type StoredUser = {
  user_id?: number;
  full_name?: string;
  email?: string;
  avatar_url?: string | null;
};

// Vì sao: chuẩn hóa dữ liệu user từ sessionStorage để tránh lỗi UI khi dữ liệu sai định dạng
const parseStoredUser = (value: string | null): StoredUser | null => {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object") return null;
    const obj = parsed as Record<string, unknown>;
    return {
      user_id: typeof obj.user_id === "number" ? obj.user_id : undefined,
      full_name: typeof obj.full_name === "string" ? obj.full_name : undefined,
      email: typeof obj.email === "string" ? obj.email : undefined,
      avatar_url:
        typeof obj.avatar_url === "string" || obj.avatar_url === null
          ? (obj.avatar_url as string | null)
          : undefined,
    };
  } catch {
    return null;
  }
};

type MenuSection = {
  label: string;
  items: Array<{
    label: string;
    path: string;
    icon: React.ReactNode;
  }>;
};

const UserLayout = ({
  children,
  title = "Travel Check-in",
  subtitle,
  activeKey = "",
  showSearch = false,
  onSearch,
  searchPlaceholder,
  flushTop = false,
}: UserLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchValue, setSearchValue] = useState("");

  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement | null>(null);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement | null>(null);

  const [hasReminderAlerts, setHasReminderAlerts] = useState(false);
  const [notifications, setNotifications] = useState<UserNotificationItem[]>(
    [],
  );
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [deletingNotifications, setDeletingNotifications] = useState(false);

  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [isAiChatExpanded, setIsAiChatExpanded] = useState(false);
  const [aiHistory, setAiHistory] = useState<AiChatHistoryItem[]>([]);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const aiScrollRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollAi = useRef(true);

  const [user, setUser] = useState<StoredUser | null>(() => {
    const stored = sessionStorage.getItem("user");
    return parseStoredUser(stored);
  });

  useEffect(() => {
    const refresh = () => {
      const stored = sessionStorage.getItem("user");
      setUser(parseStoredUser(stored));
    };

    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("tc-avatar-updated", refresh);
    window.addEventListener("tc-profile-updated", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("tc-avatar-updated", refresh);
      window.removeEventListener("tc-profile-updated", refresh);
    };
  }, []);

  useEffect(() => {
    if (!aiChatOpen) return;
    const fetchHistory = async () => {
      setAiLoading(true);
      setAiError(null);
      try {
        const res = await aiApi.getHistory();
        if (res.success) {
          setAiHistory(res.data || []);
        }
      } catch {
        setAiError("Không thể tải lịch sử chat AI.");
      } finally {
        setAiLoading(false);
      }
    };
    void fetchHistory();
  }, [aiChatOpen]);

  useEffect(() => {
    if (aiChatOpen) {
      shouldAutoScrollAi.current = true;
    }
  }, [aiChatOpen]);

  useEffect(() => {
    if (aiScrollRef.current && shouldAutoScrollAi.current) {
      // Use setTimeout to allow DOM to render before scrolling
      setTimeout(() => {
        if (aiScrollRef.current) {
          aiScrollRef.current.scrollTop = aiScrollRef.current.scrollHeight;
        }
      }, 50);
    }
  }, [aiHistory, aiChatOpen]);

  const handleSendAiMessage = async () => {
    if (!aiPrompt.trim()) return;
    const promptText = aiPrompt.trim();
    setAiPrompt("");

    const tempId = Date.now();
    setAiHistory(prev => [
      ...prev,
      {
        history_id: tempId,
        conversation_id: prev.length > 0 ? prev[prev.length - 1].conversation_id : 0,
        user_id: user?.user_id || 0,
        prompt: promptText,
        response: "",
        response_type: "text",
        metadata: null,
        created_at: new Date().toISOString()
      }
    ]);

    // Force scroll when user sends a message
    shouldAutoScrollAi.current = true;

    setAiLoading(true);
    setAiError(null);
    try {
      const conversationId = aiHistory.length > 0 ? aiHistory[aiHistory.length - 1].conversation_id : undefined;
      await aiApi.chat({ prompt: promptText, conversationId });
      const res = await aiApi.getHistory();
      if (res.success) {
        setAiHistory(res.data || []);
      }
    } catch {
      setAiError("Không thể gửi tin nhắn.");
      setAiHistory(prev => prev.filter(m => m.history_id !== tempId));
    } finally {
      setAiLoading(false);
    }
  };

  const menuSections: MenuSection[] = useMemo(
    () => [
      {
        label: "Khám phá",
        items: [
          {
            label: "Trang chủ",
            path: "/user/dashboard",
            icon: (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 10.5 12 3l9 7.5" />
                <path d="M5 10v9h5v-5h4v5h5v-9" />
              </svg>
            ),
          },
          {
            label: "Bản đồ",
            path: "/user/map",
            icon: (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" />
                <path d="M9 4v14" />
                <path d="M15 6v14" />
              </svg>
            ),
          },
        ],
      },
      {
        label: "Cá nhân",
        items: [
          {
            label: "Đã lưu",
            path: "/user/saved-locations",
            icon: (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 3h12v18l-6-4-6 4z" />
              </svg>
            ),
          },
          {
            label: "Đã ghé thăm",
            path: "/user/checkins",
            icon: (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m5 13 4 4L19 7" />
              </svg>
            ),
          },
          {
            label: "Lịch trình",
            path: "/user/itineraries",
            icon: (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            ),
          },
        ],
      },
      {
        label: "Tiện ích",
        items: [
          {
            label: "Vé của tôi",
            path: "/user/tickets",
            icon: (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
                <path d="M13 5v14" />
              </svg>
            ),
          },
          {
            label: "Nhắc lịch",
            path: "/user/booking-reminders",
            icon: (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            ),
          },
          {
            label: "Voucher",
            path: "/user/vouchers",
            icon: (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7h18v10H3z" />
                <path d="M7 7v10" />
                <path d="M17 7v10" />
              </svg>
            ),
          },
          {
            label: "SOS",
            path: "/user/sos",
            icon: (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v6" />
                <path d="M5.5 20a7 7 0 1 1 13 0" />
                <circle cx="12" cy="9" r="3" />
              </svg>
            ),
          },
        ],
      },
    ],
    [],
  );

  const menuItems = useMemo(
    () => menuSections.flatMap((section) => section.items),
    [menuSections],
  );

  const computedSubtitle = useMemo(() => {
    // subtitle="" nghĩa là chủ động ẩn
    if (subtitle === "") return "";
    if (subtitle) return subtitle;
    const current = menuItems.find(
      (x) => x.path === activeKey || x.path === location.pathname,
    );
    return current?.label ?? "Trang chủ";
  }, [activeKey, location.pathname, menuItems, subtitle]);

  const normalizedTitle = (title || "Travel Check-in").trim().toLowerCase();
  const normalizedSubtitle = (computedSubtitle || "").trim().toLowerCase();
  const showSubtitle =
    Boolean(computedSubtitle) && normalizedSubtitle !== normalizedTitle;

  const brand = useMemo(() => {
    return { short: "TC", full: "Travel" };
  }, []);

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      const el = profileRef.current;
      if (!el) return;
      if (event.target instanceof Node && el.contains(event.target)) return;
      setProfileOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      const el = notificationRef.current;
      if (!el) return;
      if (event.target instanceof Node && el.contains(event.target)) return;
      setNotificationOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const refreshAlerts = useCallback(async (signal?: { cancelled: boolean }) => {
    try {
      if (!signal?.cancelled) setNotificationsLoading(true);
      const [reminderResp, notificationResp] = await Promise.all([
        userApi.getBookingReminders(),
        userApi.getNotifications(),
      ]);
      if (signal?.cancelled) return;

      const now = Date.now();
      const soonMs = 24 * 60 * 60 * 1000;
      const reminderAlert = (reminderResp?.data || []).some((item) => {
        if (item.status === "cancelled" || item.status === "completed") {
          return false;
        }
        const t = new Date(`${item.check_in_date}T00:00:00`).getTime();
        if (!Number.isFinite(t)) return false;
        return t <= now + soonMs;
      });

      setHasReminderAlerts(Boolean(reminderAlert));
      setNotifications(
        notificationResp?.success ? notificationResp.data || [] : [],
      );
    } catch {
      // ignore
    } finally {
      if (!signal?.cancelled) setNotificationsLoading(false);
    }
  }, []);

  useEffect(() => {
    const signal = { cancelled: false };
    void refreshAlerts(signal);
    const id = window.setInterval(
      () => void refreshAlerts(signal),
      5 * 60 * 1000,
    );
    return () => {
      signal.cancelled = true;
      window.clearInterval(id);
    };
  }, [refreshAlerts]);

  const unreadNotificationCount = useMemo(
    () =>
      notifications.filter(
        (item) => !(item.is_read === true || Number(item.is_read) === 1),
      ).length,
    [notifications],
  );

  const hasAlerts = hasReminderAlerts || unreadNotificationCount > 0;

  const markAllNotificationsRead = useCallback(async () => {
    if (unreadNotificationCount <= 0) return;

    const readAt = new Date().toISOString();
    setNotifications((prev) =>
      prev.map((item) => ({
        ...item,
        is_read: 1,
        read_at: item.read_at || readAt,
      })),
    );

    try {
      await userApi.markNotificationsReadAll();
      await refreshAlerts();
    } catch {
      await refreshAlerts();
    }
  }, [refreshAlerts, unreadNotificationCount]);

  const deleteAllNotifications = useCallback(async () => {
    if (notifications.length <= 0 || deletingNotifications) return;
    setDeletingNotifications(true);
    try {
      await userApi.deleteNotificationsAll();
      setNotifications([]);
      await refreshAlerts();
    } catch {
      await refreshAlerts();
    } finally {
      setDeletingNotifications(false);
    }
  }, [deletingNotifications, notifications.length, refreshAlerts]);

  const handleLogout = () => {
    sessionStorage.removeItem("accessToken");
    sessionStorage.removeItem("refreshToken");
    sessionStorage.removeItem("user");
    sessionStorage.removeItem("userMapNearbyRadius");
    sessionStorage.removeItem("userMapCustomRadiusInput");
    sessionStorage.removeItem("userMapRoute");
    navigate("/login", { replace: true });
  };

  const initials = (user?.full_name || "U").trim().charAt(0).toUpperCase();
  const avatarUrl = resolveBackendUrl(user?.avatar_url || undefined) || null;

  return (
    <div className="min-h-screen user-theme user-bg">
      <div className="flex min-h-screen">
        {/* Sidebar dark (desktop) */}
        <aside className="hidden lg:flex lg:w-80 lg:flex-col bg-gradient-to-b from-slate-900 to-slate-950 sticky top-0 h-screen">
          <div className="h-16 flex items-center border-b border-white/10 px-5">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-teal-400 to-emerald-500 text-white flex items-center justify-center text-sm font-bold font-heading">
                {brand.short}
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-sm font-semibold uppercase tracking-[0.2em] text-white font-heading">
                  {brand.full}
                </h1>
                <p className="text-xs text-slate-400">Travel planner</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto px-4 py-5 text-sm">
            {menuSections.map((section) => (
              <div key={section.label} className="mb-5">
                <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  {section.label}
                </p>
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const isActive =
                      activeKey === item.path || location.pathname === item.path;
                    return (
                      <button
                        key={item.path}
                        type="button"
                        className={`w-full text-left rounded-xl px-3 py-2.5 font-semibold transition-all duration-200 ${isActive
                            ? "bg-teal-600/20 text-teal-300"
                            : "text-slate-400 hover:text-white hover:bg-white/5"
                          }`}
                        onClick={() => navigate(item.path)}
                      >
                        <span className="flex items-center gap-3">
                          <span className={isActive ? "text-teal-400" : "text-slate-500"}>
                            {item.icon}
                          </span>
                          <span className="block leading-snug">{item.label}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        {/* Main */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="relative z-50 bg-white/95 border-b border-gray-200/70 shadow-sm backdrop-blur-md">
            <div className="w-full px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between h-16">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Mobile brand */}
                  <div className="lg:hidden h-9 w-9 rounded-xl bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center text-white font-bold font-heading">
                    TC
                  </div>
                  <div className="min-w-0">
                    {showSubtitle ? (
                      <p className="text-sm text-gray-400 truncate">
                        {computedSubtitle}
                      </p>
                    ) : null}
                    <p className="text-lg font-semibold text-gray-900 truncate font-heading">
                      {title}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {showSearch ? (
                    <div className="relative hidden md:block">
                      <input
                        className="w-56 lg:w-72 rounded-full border border-gray-200 bg-gray-50 py-2 pl-10 pr-4 text-sm transition-all duration-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none"
                        placeholder={searchPlaceholder ?? "Tìm địa điểm..."}
                        value={searchValue}
                        onChange={(event) => {
                          const value = event.target.value;
                          setSearchValue(value);
                          onSearch?.(value);
                        }}
                      />
                      <span className="absolute left-3 top-2.5 text-gray-400">
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <circle cx="11" cy="11" r="8" />
                          <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                      </span>
                    </div>
                  ) : null}

                  <div className="relative" ref={notificationRef}>
                    <button
                      type="button"
                      className="relative h-10 w-10 rounded-full border border-gray-200 bg-white hover:bg-gray-50 transition-colors duration-200"
                      aria-label="Thông báo"
                      title="Thông báo"
                      onClick={() => {
                        const nextOpen = !notificationOpen;
                        setNotificationOpen(nextOpen);
                        if (nextOpen) {
                          void markAllNotificationsRead();
                        }
                      }}
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="mx-auto text-gray-600"
                      >
                        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                      </svg>
                      {hasAlerts ? (
                        <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
                      ) : null}
                    </button>

                    {notificationOpen ? (
                      <div className="absolute right-0 top-12 z-50 w-[calc(100vw-2rem)] max-w-[340px] overflow-hidden rounded-2xl border border-slate-100 bg-white/95 backdrop-blur-md shadow-2xl animate-fade-in">
                        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 bg-[#fafbfc]/60">
                          <div className="text-xs font-extrabold text-slate-800 font-heading tracking-wide uppercase flex items-center gap-1.5">
                            <span className="text-teal-600">🔔</span> Thông báo gần đây
                          </div>
                          <div className="flex items-center gap-2">
                            {unreadNotificationCount > 0 ? (
                              <span className="rounded-md bg-teal-50 px-1.5 py-0.5 text-[9px] font-black text-teal-700 uppercase tracking-wide">
                                {unreadNotificationCount} mới
                              </span>
                            ) : null}
                            <button
                              type="button"
                              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-600 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100 transition-all duration-200 disabled:opacity-60 disabled:pointer-events-none"
                              onClick={() => {
                                void deleteAllNotifications();
                              }}
                              disabled={
                                deletingNotifications ||
                                notifications.length === 0
                              }
                            >
                              {deletingNotifications
                                ? "Đang xóa..."
                                : "Xóa hết"}
                            </button>
                          </div>
                        </div>
                        <div className="max-h-[360px] overflow-y-auto">
                          {notificationsLoading ? (
                            <div className="px-4 py-8 text-center text-xs text-slate-400 font-medium">
                              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-teal-500 border-t-transparent mb-1" />
                              <p>Đang tải thông báo...</p>
                            </div>
                          ) : notifications.length === 0 ? (
                            <div className="px-4 py-12 text-center text-xs text-slate-400 font-medium space-y-2">
                              <span className="text-2xl inline-block mb-1">📭</span>
                              <p className="font-bold text-slate-500">Hộp thư trống</p>
                              <p className="text-[10px] text-slate-400">Bạn không có thông báo mới nào.</p>
                            </div>
                          ) : (
                            notifications.map((item) => {
                              const rawBody = item.body || "";
                              const cleanBody = rawBody.replace(/\[[^\]]+\]/g, "").trim();

                              const isBooking =
                                rawBody.includes("[booking:") ||
                                item.title?.toLowerCase().includes("lịch") ||
                                item.title?.toLowerCase().includes("đặt trước") ||
                                item.title?.toLowerCase().includes("đơn hàng") ||
                                item.title?.toLowerCase().includes("hủy") ||
                                item.title?.toLowerCase().includes("quá hạn") ||
                                item.title?.toLowerCase().includes("xác nhận") ||
                                item.title?.toLowerCase().includes("đã dùng") ||
                                item.title?.toLowerCase().includes("vé");

                              const isVoucher =
                                rawBody.includes("[voucher:") ||
                                item.title?.toLowerCase().includes("voucher") ||
                                item.title?.toLowerCase().includes("khuyến mãi");

                              let icon = "🔔";
                              let iconBg = "bg-slate-50 text-slate-500 border-slate-100";
                              if (isBooking) {
                                icon = "📅";
                                iconBg = "bg-teal-50 text-teal-700 border-teal-100";
                              } else if (isVoucher) {
                                icon = "🎁";
                                iconBg = "bg-rose-50 text-rose-700 border-rose-100";
                              }

                              const isUnread = !(item.is_read === true || Number(item.is_read) === 1);

                              return (
                                <div
                                  key={item.notification_id}
                                  className={`flex items-start gap-3 border-b border-slate-50 px-4 py-3 last:border-b-0 cursor-pointer transition-all duration-200 text-left ${isUnread
                                      ? "bg-[#f0fbf9]/60 hover:bg-[#e6f7f4]/80"
                                      : "bg-white hover:bg-slate-50/80"
                                    }`}
                                  onClick={() => {
                                    setNotificationOpen(false);
                                    if (isBooking) {
                                      navigate("/user/booking-reminders");
                                    } else if (isVoucher) {
                                      navigate("/user/vouchers");
                                    }
                                  }}
                                >
                                  {/* Icon bên trái */}
                                  <div className={`h-8 w-8 rounded-xl border flex items-center justify-center shrink-0 text-sm shadow-sm ${iconBg}`}>
                                    {icon}
                                  </div>

                                  {/* Nội dung bên phải */}
                                  <div className="flex-1 min-w-0 space-y-1">
                                    <div className="flex items-center justify-between gap-2">
                                      <h4 className="text-xs font-bold text-slate-800 truncate">
                                        {item.title || "Thông báo"}
                                      </h4>
                                      {isUnread && (
                                        <span className="h-2 w-2 shrink-0 rounded-full bg-teal-500 shadow-[0_0_8px_#14b8a6]" />
                                      )}
                                    </div>
                                    <p className="text-[10px] text-slate-500 leading-relaxed break-words font-medium">
                                      {cleanBody || "-"}
                                    </p>
                                    <div className="text-[9px] text-slate-400 font-semibold tracking-wide">
                                      {formatDateTimeVi(item.created_at)}
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="relative" ref={profileRef}>
                    <button
                      type="button"
                      className="h-10 w-10 overflow-hidden rounded-full border border-gray-200 bg-white hover:border-teal-300 transition-colors duration-200"
                      onClick={() => setProfileOpen((v) => !v)}
                      aria-label="Tài khoản"
                      title="Tài khoản"
                    >
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt="avatar"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-teal-100 text-sm font-semibold text-teal-700">
                          {initials}
                        </div>
                      )}
                    </button>

                    {profileOpen ? (
                      <div className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg animate-fade-in">
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150"
                          onClick={() => {
                            setProfileOpen(false);
                            navigate("/user/profile");
                          }}
                        >
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                              <circle cx="12" cy="7" r="4" />
                            </svg>
                          </span>
                          Thông tin cá nhân
                        </button>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors duration-150"
                          onClick={() => {
                            setProfileOpen(false);
                            handleLogout();
                          }}
                        >
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-red-50 text-red-600">
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                              <polyline points="16 17 21 12 16 7" />
                              <line x1="21" y1="12" x2="9" y2="12" />
                            </svg>
                          </span>
                          Đăng xuất
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Mobile menu */}
              <div className="lg:hidden pb-3">
                <nav className="flex gap-2 overflow-x-auto pb-1">
                  {menuItems.map((item) => {
                    const isActive =
                      activeKey === item.path ||
                      location.pathname === item.path;
                    return (
                      <button
                        key={item.path}
                        type="button"
                        className={`shrink-0 whitespace-nowrap user-chip transition-all duration-200 ${isActive ? "user-chip-active" : "user-chip-idle"
                          }`}
                        onClick={() => navigate(item.path)}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </nav>
              </div>
            </div>
          </header>

          <div
            className={`w-full px-4 sm:px-6 lg:px-8 ${flushTop ? "pt-0 pb-8" : "py-8"
              }`}
            style={{
              background: "linear-gradient(180deg, #f8fafb 0%, #f1f5f9 50%, #f8fafb 100%)",
            }}
          >
            <main className="w-full min-w-0 space-y-8 animate-fade-in">
              {children}
            </main>
          </div>

          {/* Bong bóng Chat AI nổi toàn cục */}
          <div className="fixed bottom-6 right-6 z-40 font-sans">
            <button
              type="button"
              className="flex h-14 w-14 items-center justify-center rounded-full text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-xl shadow-indigo-500/30 transition-all duration-300 hover:scale-110 active:scale-95 border-2 border-white"
              onClick={() => setAiChatOpen((prev) => !prev)}
              aria-label="Trợ lý ảo AI"
            >
              {aiChatOpen ? (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                   <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z" />
                   <path strokeLinecap="round" strokeLinejoin="round" d="M9 13.5a3 3 0 006 0" />
                   <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 10.5h.01M14.25 10.5h.01" />
                </svg>
              )}
            </button>

            {aiChatOpen && (
              <div className={`fixed bg-white rounded-2xl shadow-2xl border border-indigo-100 flex flex-col z-40 overflow-hidden transition-all duration-300 origin-bottom-right ${isAiChatExpanded ? 'bottom-6 right-6 w-[92vw] sm:w-[80vw] md:w-[65vw] lg:w-[50vw] h-[90vh]' : 'bottom-24 right-6 w-80 md:w-96 h-[500px] max-h-[80vh]'}`}>
                {/* Header */}
                <div className="p-4 text-white bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center justify-between shadow-md z-10 relative">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <img src="/ai-avatar.png" className="w-14 h-14 rounded-full object-cover shadow-sm border-2 border-white/20 bg-white" alt="AI" />
                      <span className="absolute bottom-1 right-1 w-3.5 h-3.5 bg-green-400 border-2 border-indigo-600 rounded-full"></span>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold font-heading uppercase tracking-wider">Trợ lý ảo AI</h4>
                      <p className="text-[9px] opacity-80 font-semibold">Tự động trả lời nhanh</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setIsAiChatExpanded(p => !p)} className="text-white hover:bg-white/20 p-1.5 rounded-full transition-colors active:scale-95" title={isAiChatExpanded ? "Thu nhỏ" : "Phóng to"}>
                      {isAiChatExpanded ? (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 9L5 5m4 4v-4m0 4H5m10 0l4-4m-4 4v-4m0 4h4M9 15l-4 4m4-4v4m0-4H5m10 0l4 4m-4-4v4m0-4h4" />
                        </svg>
                      ) : (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                        </svg>
                      )}
                    </button>
                    <button onClick={() => setAiChatOpen(false)} className="text-white hover:bg-white/20 p-1.5 rounded-full transition-colors active:scale-95">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Message List */}
                <div
                  ref={aiScrollRef}
                  onScroll={() => {
                    if (aiScrollRef.current) {
                      const { scrollTop, scrollHeight, clientHeight } = aiScrollRef.current;
                      shouldAutoScrollAi.current = scrollHeight - scrollTop - clientHeight < 100;
                    }
                  }}
                  className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#fafbfc]/50"
                >
                  {aiLoading && aiHistory.length === 0 && (
                    <div className="text-center text-xs text-slate-400 py-8 font-medium">
                      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent mb-1" />
                      <p>Đang kết nối với Trợ lý AI...</p>
                    </div>
                  )}

                  {aiError && (
                    <div className="rounded-xl bg-rose-50 border border-rose-100 p-2.5 text-center text-[10px] text-rose-600 shadow-sm">
                      {aiError}
                    </div>
                  )}

                  {!aiLoading && aiHistory.length === 0 && (
                    <div className="text-center text-xs text-slate-400 py-12 space-y-3 flex flex-col items-center justify-center">
                      <img src="/ai-avatar.png" className="w-16 h-16 rounded-full object-cover shadow-md mb-2 bg-slate-100" alt="AI" />
                      <p className="font-bold text-slate-600 text-sm">Travel Assistant</p>
                      <p className="text-[10px] text-slate-400 max-w-[220px] mx-auto leading-relaxed">
                        Chào bạn! Mình có thể giúp bạn lên kế hoạch chuyến đi, tìm phòng khách sạn, hoặc gợi ý các nhà hàng tuyệt ngon.
                      </p>
                    </div>
                  )}

                  {aiHistory.map((item) => (
                    <div key={item.history_id} className="space-y-3">
                      {/* User Prompt */}
                      <div className="flex flex-col max-w-[75%] ml-auto items-end">
                        <div className={`rounded-2xl px-3.5 py-2.5 ${isAiChatExpanded ? 'text-sm' : 'text-xs'} leading-relaxed break-words font-medium shadow-sm bg-indigo-600 text-white rounded-br-none`}>
                          {item.prompt}
                        </div>
                      </div>
                      {/* AI Response */}
                      {item.response ? (
                        <div className="flex flex-col max-w-[85%] mr-auto items-start">
                          <span className="text-[11px] font-bold text-slate-500 mb-1 ml-1 flex items-center gap-2">
                            <img src="/ai-avatar.png" className="w-6 h-6 rounded-full object-cover shadow-sm bg-slate-100" alt="AI" />
                            Trợ lý AI
                          </span>
                          <div className={`rounded-2xl px-3.5 py-2.5 ${isAiChatExpanded ? 'text-sm' : 'text-xs'} leading-relaxed break-words font-medium shadow-sm bg-white text-slate-700 border border-slate-100 rounded-bl-none`}>
                            {item.response}
                          </div>
                          {/* Location Cards from Gemini */}
                          {(() => {
                            let parsedMeta = null;
                            try {
                              parsedMeta = typeof item.metadata === 'string' ? JSON.parse(item.metadata) : item.metadata;
                            } catch (e) {}
                            const locs = parsedMeta?.locations || [];
                            if (locs.length === 0) return null;
                            return (
                              <div className="mt-2 space-y-2 w-full pr-2">
                                {locs.map((loc: any, idx: number) => (
                                  <div key={idx} className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm flex flex-col hover:border-teal-200 transition">
                                    {loc.first_image && (
                                      <img src={loc.first_image.startsWith('http') ? loc.first_image : `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/images/${loc.first_image}`} alt={loc.location_name || "Location"} className="h-24 w-full object-cover" />
                                    )}
                                    <div className="p-2.5">
                                      {loc.location_name ? (
                                        <h5 className="font-bold text-xs text-slate-800 line-clamp-1">{loc.location_name}</h5>
                                      ) : null}
                                      <div className="flex items-center gap-1 text-[10px] text-amber-500 my-1">
                                          <span>⭐</span> <span>{loc.rating || 0}</span> <span className="text-slate-400">({loc.total_reviews || 0} đánh giá)</span>
                                      </div>
                                      {loc.address ? (
                                        <p className="text-[10px] text-slate-500 line-clamp-1 mb-1.5 flex items-center gap-1">
                                          <svg className="w-3 h-3 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                          {loc.address}
                                        </p>
                                      ) : null}
                                      <div className="bg-indigo-50/50 text-indigo-700 text-[10px] p-2 rounded-lg mb-2 leading-relaxed border border-indigo-50">
                                          💡 {loc.reason}
                                      </div>
                                      <div className="flex gap-2 mt-auto">
                                        <button onClick={() => navigate(`/user/location/${loc.location_id}`)} className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white py-1.5 rounded-lg text-[10px] font-semibold transition shadow-sm">Xem chi tiết</button>
                                        <button onClick={() => navigate(`/user/map?locationId=${loc.location_id}`)} className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-600 py-1.5 rounded-lg text-[10px] font-semibold transition border border-slate-200">Bản đồ</button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )
                          })()}
                        </div>
                      ) : null}
                    </div>
                  ))}

                  {aiLoading && aiHistory.length > 0 && (
                    <div className="flex flex-col max-w-[85%] mr-auto items-start">
                      <span className="text-[11px] font-bold text-slate-500 mb-1 ml-1 flex items-center gap-2">
                        <img src="/ai-avatar.png" className="w-6 h-6 rounded-full object-cover shadow-sm bg-slate-100" alt="AI" />
                        Trợ lý AI
                      </span>
                      <div className={`rounded-2xl px-4 py-3 ${isAiChatExpanded ? 'text-sm' : 'text-xs'} bg-white text-slate-400 border border-slate-100 rounded-bl-none flex items-center gap-1.5 shadow-sm`}>
                        <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce" />
                        <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:0.2s]" />
                        <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:0.4s]" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Input */}
                <div className="p-3 border-t border-slate-100 bg-slate-50 flex items-center gap-2">
                  <input
                    type="text"
                    className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-xs transition duration-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none shadow-inner"
                    placeholder="Gửi tin nhắn..."
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleSendAiMessage();
                    }}
                    disabled={aiLoading}
                  />
                  <button
                    type="button"
                    className="h-9 w-9 rounded-full flex items-center justify-center text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20 transition-all hover:scale-105 active:scale-95 shrink-0 disabled:opacity-60"
                    onClick={() => void handleSendAiMessage()}
                    disabled={aiLoading}
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserLayout;
