import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import userApi from "../api/userApi";
import { resolveBackendUrl } from "../utils/resolveBackendUrl";
import { formatDateTimeVi } from "../utils/formatDateVi";
import type { UserNotificationItem } from "../types/user.types";

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
          {
            label: "QR check-in",
            path: "/user/qr-checkin",
            icon: (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
                <path d="M14 14h3v3h-3z" />
                <path d="M17 17h4" />
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
            label: "Nhật ký",
            path: "/user/diary",
            icon: (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h12a4 4 0 0 1 4 4v12H8a4 4 0 0 0-4 4z" />
                <path d="M8 8h8" />
                <path d="M8 12h8" />
              </svg>
            ),
          },
          {
            label: "Lịch trình",
            path: "/user/itinerary",
            icon: (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="3" />
                <path d="M8 2v4" />
                <path d="M16 2v4" />
                <path d="M3 10h18" />
              </svg>
            ),
          },
          {
            label: "Địa điểm của tôi",
            path: "/user/my-created-locations",
            icon: (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3a7 7 0 0 1 7 7c0 5-7 11-7 11s-7-6-7-11a7 7 0 0 1 7-7z" />
                <circle cx="12" cy="10" r="2.5" />
              </svg>
            ),
          },
        ],
      },
      {
        label: "Xã hội",
        items: [
          {
            label: "Nhóm bạn",
            path: "/user/group-checkin",
            icon: (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="8" r="3" />
                <path d="M2 20a7 7 0 0 1 14 0" />
                <circle cx="17" cy="9" r="2" />
                <path d="M16 20a5 5 0 0 1 6 0" />
              </svg>
            ),
          },
          {
            label: "Xếp hạng",
            path: "/user/leaderboard",
            icon: (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 21V10" />
                <path d="M12 21V3" />
                <path d="M16 21v-7" />
              </svg>
            ),
          },
        ],
      },
      {
        label: "Tiện ích",
        items: [
          {
            label: "Vỏ vé du lịch",
            path: "/user/tickets",
            icon: (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
                <path d="M13 5v14" />
              </svg>
            ),
          },
          {
            label: "Vỏ vé ăn uống",
            path: "/user/table-pass",
            icon: (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
                <path d="M7 2v4" />
                <path d="M21 2v20" />
                <path d="M21 2c-3.07 0-6 2.5-6 7v3h6V2z" />
                <path d="M12 11v11" />
                <path d="M7 11v11" />
              </svg>
            ),
          },
          {
            label: "Vỏ vé khách sạn",
            path: "/user/room-pass",
            icon: (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
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
          {
            label: "Hồ sơ",
            path: "/user/profile",
            icon: (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
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
                        className={`w-full text-left rounded-xl px-3 py-2.5 font-semibold transition-all duration-200 ${
                          isActive
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
                        <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-rose-500 animate-pulse" />
                      ) : null}
                    </button>

                    {notificationOpen ? (
                      <div className="absolute right-0 top-12 z-50 w-[calc(100vw-2rem)] max-w-[340px] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl animate-fade-in">
                        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
                          <div className="text-sm font-semibold text-gray-900 font-heading">
                            Thông báo gần đây
                          </div>
                          <div className="flex items-center gap-2">
                            {unreadNotificationCount > 0 ? (
                              <span className="rounded-full bg-rose-50 px-2 py-1 text-[11px] font-medium text-rose-600">
                                {unreadNotificationCount} chưa đọc
                              </span>
                            ) : null}
                            <button
                              type="button"
                              className="rounded-full border border-gray-200 px-2.5 py-1 text-[11px] font-medium text-gray-600 hover:bg-gray-50 transition-colors duration-200 disabled:opacity-60"
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
                            <div className="px-4 py-6 text-center text-sm text-gray-500">
                              Đang tải thông báo...
                            </div>
                          ) : notifications.length === 0 ? (
                            <div className="px-4 py-6 text-center text-sm text-gray-500">
                              Chưa có thông báo mới.
                            </div>
                          ) : (
                            notifications.map((item) => {
                              const rawBody = item.body || "";
                              const cleanBody = rawBody.replace(/\[[^\]]+\]/g, "").trim();

                              return (
                                <div
                                  key={item.notification_id}
                                  className={`border-b border-gray-100 px-4 py-3 last:border-b-0 cursor-pointer hover:bg-gray-50 transition-colors duration-150 ${
                                    item.is_read === true ||
                                    Number(item.is_read) === 1
                                      ? "bg-white"
                                      : "bg-teal-50/50"
                                  }`}
                                  onClick={() => {
                                    setNotificationOpen(false);
                                    if (
                                      rawBody.includes("[booking:") ||
                                      item.title?.includes("lịch trình")
                                    ) {
                                      navigate("/user/booking-reminders");
                                    }
                                  }}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="text-sm font-medium text-gray-900">
                                      {item.title || "Thông báo"}
                                    </div>
                                    {item.is_read === true ||
                                    Number(item.is_read) === 1 ? null : (
                                      <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-teal-500" />
                                    )}
                                  </div>
                                  <div className="mt-1 text-xs leading-5 text-gray-600">
                                    {cleanBody || "-"}
                                  </div>
                                  <div className="mt-2 text-[11px] text-gray-400">
                                    {formatDateTimeVi(item.created_at)}
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
                        className={`shrink-0 whitespace-nowrap user-chip transition-all duration-200 ${
                          isActive ? "user-chip-active" : "user-chip-idle"
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
            className={`w-full px-4 sm:px-6 lg:px-8 ${
              flushTop ? "pt-0 pb-8" : "py-8"
            }`}
            style={{
              background: "linear-gradient(180deg, #f8fafb 0%, #f1f5f9 50%, #f8fafb 100%)",
            }}
          >
            <main className="w-full min-w-0 space-y-8 animate-fade-in">
              {children}
            </main>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserLayout;
