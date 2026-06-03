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
  title: string;
  subtitle?: string;
  activeKey: string;
  showSearch?: boolean;
  onSearch?: (value: string) => void;
  searchPlaceholder?: string;
  flushTop?: boolean;
}

// Dùng để đọc dữ liệu user lưu trong sessionStorage
type StoredUser = {
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
  title,
  subtitle,
  activeKey,
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
  const [aiHistory, setAiHistory] = useState<AiChatHistoryItem[]>([]);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const aiScrollRef = useRef<HTMLDivElement | null>(null);

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
    if (aiScrollRef.current) {
      aiScrollRef.current.scrollTop = aiScrollRef.current.scrollHeight;
    }
  }, [aiHistory, aiChatOpen]);

  const handleSendAiMessage = async () => {
    if (!aiPrompt.trim()) return;
    const promptText = aiPrompt.trim();
    setAiPrompt("");
    setAiLoading(true);
    setAiError(null);
    try {
      await aiApi.chat({ prompt: promptText });
      const res = await aiApi.getHistory();
      if (res.success) {
        setAiHistory(res.data || []);
      }
    } catch {
      setAiError("Không thể gửi tin nhắn tới AI.");
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

  const normalizedTitle = title.trim().toLowerCase();
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
        <aside className="hidden lg:flex lg:w-80 lg:flex-col bg-gradient-to-b from-slate-900 to-slate-950">
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
              className="flex h-12 w-12 items-center justify-center rounded-full text-white bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 shadow-lg shadow-teal-500/30 transition-transform duration-300 hover:scale-110 active:scale-95"
              onClick={() => setAiChatOpen((prev) => !prev)}
              aria-label="Trợ lý ảo AI"
            >
              {aiChatOpen ? (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 21l5.096-.813a8.959 8.959 0 003.58-.889A9 9 0 103.07 9.814a8.96 8.96 0 00.89 3.58L3 18.5l5.096-.813a8.96 8.96 0 003.58.889z" />
                </svg>
              )}
            </button>

            {aiChatOpen && (
              <div className="absolute bottom-16 right-0 w-[330px] sm:w-[360px] h-[450px] rounded-2xl border border-slate-100 bg-white/95 backdrop-blur-md shadow-2xl flex flex-col overflow-hidden animate-fade-in">
                {/* Header */}
                <div className="p-4 text-white bg-gradient-to-r from-teal-500 to-emerald-500 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🤖</span>
                    <div>
                      <h4 className="text-xs font-bold font-heading uppercase tracking-wider">Trợ lý ảo AI</h4>
                      <p className="text-[9px] opacity-80 font-semibold">Tự động trả lời nhanh</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="text-white/80 hover:text-white transition"
                    onClick={() => setAiChatOpen(false)}
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Message List */}
                <div
                  ref={aiScrollRef}
                  className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#fafbfc]/50"
                >
                  {aiLoading && aiHistory.length === 0 && (
                    <div className="text-center text-xs text-slate-400 py-8 font-medium">
                      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-teal-500 border-t-transparent mb-1" />
                      <p>Trợ lý AI đang tải cuộc trò chuyện...</p>
                    </div>
                  )}

                  {aiError && (
                    <div className="rounded-xl bg-rose-50 border border-rose-100 p-2.5 text-center text-[10px] text-rose-600">
                      {aiError}
                    </div>
                  )}

                  {!aiLoading && aiHistory.length === 0 && (
                    <div className="text-center text-xs text-slate-400 py-12 space-y-2">
                      <span className="text-xl">🤖</span>
                      <p className="font-bold text-slate-500">Xin chào</p>
                      <p className="text-[10px] text-slate-400 max-w-[200px] mx-auto leading-relaxed">
                        Tôi là trợ lý AI của bạn. Hãy gửi tin nhắn để hỏi bất kỳ thông tin nào về chuyến hành trình nhé.
                      </p>
                    </div>
                  )}

                  {aiHistory.map((item) => (
                    <div key={item.history_id} className="space-y-3">
                      {/* User Prompt */}
                      <div className="flex flex-col max-w-[75%] ml-auto items-end">
                        <div className="rounded-2xl px-3 py-2 text-xs leading-relaxed break-words font-medium shadow-sm bg-teal-600 text-white rounded-br-none">
                          {item.prompt}
                        </div>
                      </div>
                      {/* AI Response */}
                      <div className="flex flex-col max-w-[75%] mr-auto items-start">
                        <span className="text-[9px] font-bold text-slate-500 mb-0.5 ml-1 flex items-center gap-1">
                          <span>🤖</span> Trợ lý AI
                        </span>
                        <div className="rounded-2xl px-3 py-2 text-xs leading-relaxed break-words font-medium shadow-sm bg-white text-slate-800 border border-slate-100 rounded-bl-none">
                          {item.response}
                        </div>
                      </div>
                    </div>
                  ))}

                  {aiLoading && aiHistory.length > 0 && (
                    <div className="flex flex-col max-w-[75%] mr-auto items-start">
                      <span className="text-[9px] font-bold text-slate-500 mb-0.5 ml-1">🤖 Trợ lý AI</span>
                      <div className="rounded-2xl px-3 py-2 text-xs bg-white text-slate-400 border border-slate-100 rounded-bl-none flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" />
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.2s]" />
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.4s]" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Input */}
                <div className="p-3 border-t border-slate-100 bg-white flex items-center gap-2">
                  <input
                    type="text"
                    className="flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs transition duration-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20 focus:outline-none"
                    placeholder="Hỏi trợ lý AI..."
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleSendAiMessage();
                    }}
                    disabled={aiLoading}
                  />
                  <button
                    type="button"
                    className="h-8 w-8 rounded-full flex items-center justify-center text-white bg-teal-600 hover:bg-teal-700 shadow-sm transition hover:scale-105 active:scale-95 shrink-0 disabled:opacity-60"
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
