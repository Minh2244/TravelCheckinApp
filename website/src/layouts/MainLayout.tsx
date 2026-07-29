import React, { useState, useEffect, useRef } from "react";
import { Layout, Menu, Button, Avatar, Badge } from "antd";
import { resolveBackendUrl } from "../utils/resolveBackendUrl";
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  DashboardOutlined,
  UserOutlined,
  TeamOutlined,
  ShopOutlined,
  LogoutOutlined,
  CheckCircleOutlined,
  DollarOutlined,
  SettingOutlined,
  GiftOutlined,
  NotificationOutlined,
  BellOutlined,
  AlertOutlined,
  StarOutlined,
  FileTextOutlined,
  RightOutlined,
} from "@ant-design/icons";
import { useNavigate, useLocation } from "react-router-dom";
import { message, notification } from "antd";
import ownerApi from "../api/ownerApi";
import { useSocket } from "../contexts/SocketContext";
import { formatDateTimeVi } from "../utils/formatDateVi";
import ManagerAiBubble from "../components/ManagerAiBubble";

const { Sider } = Layout;

interface MainLayoutProps {
  children: React.ReactNode;
}

type StoredUser = {
  user_id?: number;
  role?: string;
  full_name?: string;
  email?: string;
  avatar_url?: string | null;
};

const MAX_ADMIN_NOTIFS = 50;

type AdminNotif = {
  id: string;
  type: "sos" | "location" | "review" | "user" | "voucher" | "general";
  title: string;
  body: string;
  link: string;
  read: boolean;
  at: string; // ISO string
};

const loadAdminNotifs = (): AdminNotif[] => {
  try {
    const raw = localStorage.getItem("admin_notifs");
    return raw ? (JSON.parse(raw) as AdminNotif[]) : [];
  } catch {
    return [];
  }
};

const saveAdminNotifs = (items: AdminNotif[]) => {
  try {
    localStorage.setItem("admin_notifs", JSON.stringify(items.slice(0, MAX_ADMIN_NOTIFS)));
  } catch {}
};

const SSE_NOTIF_TYPE_MAP: Record<string, { type: AdminNotif["type"]; title: string; link: string }> = {
  sos_alert:         { type: "sos",      title: "🆘 SOS khẩn cấp",           link: "/admin/sos" },
  location_pending:  { type: "location", title: "📍 Địa điểm chờ duyệt",      link: "/admin/locations" },
  location_approved: { type: "location", title: "✅ Địa điểm được duyệt",     link: "/admin/locations" },
  location_rejected: { type: "location", title: "❌ Địa điểm bị từ chối",     link: "/admin/locations" },
  location_approval: { type: "location", title: "📍 Địa điểm chờ duyệt",      link: "/admin/locations" },
  location_update:   { type: "location", title: "📍 Cập nhật địa điểm",       link: "/admin/locations" },
  service_approval:  { type: "general",  title: "📦 Dịch vụ chờ duyệt",       link: "/admin/owner-services" },
  service_update:    { type: "general",  title: "📦 Dịch vụ cập nhật",        link: "/admin/owner-services" },
  commission_reconciliation: { type: "general", title: "💰 Yêu cầu đối soát", link: "/admin/payments" },
  review_flagged:    { type: "review",   title: "⚠️ Đánh giá bị báo cáo",    link: "/admin/reviews" },
  new_user:          { type: "user",     title: "👤 Người dùng mới",          link: "/admin/users" },
  voucher_created:   { type: "voucher",  title: "🎁 Voucher mới",             link: "/admin/vouchers" },
};

const notifIconMap: Record<AdminNotif["type"], string> = {
  sos:      "🆘",
  location: "📍",
  review:   "⭐",
  user:     "👤",
  voucher:  "🎁",
  general:  "🔔",
};

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const socket = useSocket();
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState<StoredUser | null>(null);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [deletingNotifications, setDeletingNotifications] = useState(false);
  const notificationWrapRef = useRef<HTMLDivElement | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement | null>(null);

  // Admin notification state
  const [adminNotifOpen, setAdminNotifOpen] = useState(false);
  const [adminNotifs, setAdminNotifs] = useState<AdminNotif[]>(loadAdminNotifs);
  const adminNotifRef = useRef<HTMLDivElement | null>(null);

  const addAdminNotif = (notif: Omit<AdminNotif, "id" | "at" | "read">) => {
    setAdminNotifs((prev) => {
      const next: AdminNotif[] = [
        { ...notif, id: `${Date.now()}-${Math.random()}`, at: new Date().toISOString(), read: false },
        ...prev,
      ].slice(0, MAX_ADMIN_NOTIFS);
      saveAdminNotifs(next);
      return next;
    });
  };

  const markAllAdminRead = () => {
    setAdminNotifs((prev) => {
      const next = prev.map((n) => ({ ...n, read: true }));
      saveAdminNotifs(next);
      return next;
    });
  };

  const clearAdminNotifs = () => {
    setAdminNotifs([]);
    localStorage.removeItem("admin_notifs");
  };

  const loadUserFromStorage = () => {
    const userStr = sessionStorage.getItem("user");
    if (!userStr) {
      setUser(null);
      return null;
    }
    try {
      const parsed = JSON.parse(userStr) as unknown;
      if (!parsed || typeof parsed !== "object") {
        setUser(null);
        return null;
      }
      const u = parsed as StoredUser;
      setUser(u);
      return u;
    } catch (error) {
      console.error("❌ MainLayout - Lỗi parse user:", error);
      setUser(null);
      return null;
    }
  };

  useEffect(() => {
    loadUserFromStorage();

    const onAvatarUpdated = () => {
      loadUserFromStorage();
    };

    window.addEventListener("tc-avatar-updated", onAvatarUpdated);
    return () => {
      window.removeEventListener("tc-avatar-updated", onAvatarUpdated);
    };
  }, []);

  const refreshOwnerNotifications = async () => {
    if (user?.role !== "owner" && user?.role !== "employee") return;
    setNotificationsLoading(true);
    try {
      const res = await ownerApi.getNotifications();
      setNotifications(Array.isArray(res?.data) ? res.data : []);
    } catch {
      setNotifications([]);
    } finally {
      setNotificationsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role !== "owner" && user?.role !== "employee") return;
    void refreshOwnerNotifications();
    const id = window.setInterval(() => {
      void refreshOwnerNotifications();
    }, 15000);

    if (socket) {
      const handleSocketEvent = (event: Record<string, unknown>) => {
        const type = String(event.type || "");
        if (
          type.startsWith("location_") ||
          type.startsWith("service_") ||
          type.startsWith("voucher_")
        ) {
          void refreshOwnerNotifications();
        }
      };
      socket.on("realtime_event", handleSocketEvent);
      return () => {
        window.clearInterval(id);
        socket.off("realtime_event", handleSocketEvent);
      };
    }

    return () => window.clearInterval(id);
  }, [user?.role, socket]);

  const userRole = user?.role;
  const userId = user?.user_id;

  // Realtime Socket listener for Admin (SOS events + other events)
  useEffect(() => {
    if (userRole !== "admin" || !socket) return;

    const handleEvent = (event: Record<string, unknown>) => {
      try {
        const evType = String(event.type || "");
        const meta = SSE_NOTIF_TYPE_MAP[evType];

        if (evType === "sos_alert") {
          const loc = String(event.location || "Không xác định");
          notification.error({
            message: "SOS KHẨN CẤP",
            description: `Có người cần cứu hộ tại: ${loc}`,
            duration: 10,
            onClick: () => navigate("/admin/sos"),
            style: { backgroundColor: "#fff1f0", border: "1px solid #ffa39e", cursor: "pointer" },
          });
          addAdminNotif({
            type: "sos",
            title: "🆘 SOS khẩn cấp",
            body: `Vị trí: ${loc}`,
            link: "/admin/sos",
          });
        } else if (meta) {
          const body = String(event.message || event.body || event.description || "");
          addAdminNotif({ type: meta.type, title: meta.title, body, link: meta.link });
        } else if (event.title && event.body) {
          const typeVal = event.type as string;
          const fallbackType: AdminNotif["type"] = (["sos", "location", "review", "user", "voucher", "general"].includes(typeVal)) 
            ? (typeVal as AdminNotif["type"]) 
            : "general";

          addAdminNotif({ 
            type: fallbackType, 
            title: String(event.title), 
            body: String(event.body), 
            link: String(event.link || "") 
          });
        }
      } catch {}
    };

    socket.on("realtime_event", handleEvent);

    return () => {
      socket.off("realtime_event", handleEvent);
    };
  }, [userRole, navigate, socket]);

  // Heartbeat: nếu admin khóa tài khoản owner/employee thì tự bị đá về login (gần như ngay lập tức)
  useEffect(() => {
    if (!userId) return;
    if (userRole === "admin") return;
    const id = window.setInterval(() => {
      // Chỉ cần ping 1 API có auth; nếu bị khóa middleware sẽ trả 403 ACCOUNT_LOCKED
      void ownerApi.getMe().catch(() => {
        // axios interceptor sẽ handle redirect
      });
    }, 30000);
    return () => window.clearInterval(id);
  }, [userId, userRole]);

  const handleLogout = () => {
    console.log("🚪 Đăng xuất từ MainLayout");
    sessionStorage.removeItem("accessToken");
    sessionStorage.removeItem("refreshToken");
    sessionStorage.removeItem("user");
    sessionStorage.removeItem("userMapNearbyRadius");
    sessionStorage.removeItem("userMapCustomRadiusInput");
    sessionStorage.removeItem("userMapRoute");
    message.success("Đã đăng xuất!");
    navigate("/login", { replace: true });
  };

  // ✅ MENU THEO ĐỀ TÀI - ADMIN
  const adminItems = [
    {
      key: "/admin/dashboard",
      icon: <DashboardOutlined />,
      label: "Tổng quan",
    },
    {
      key: "/admin/users",
      icon: <UserOutlined />,
      label: "Quản lý Người dùng",
    },
    {
      key: "/admin/owners",
      icon: <TeamOutlined />,
      label: "Quản lý Owner",
    },
    {
      key: "/admin/locations",
      icon: <ShopOutlined />,
      label: "Duyệt Địa điểm",
    },
    {
      key: "/admin/owner-services",
      icon: <FileTextOutlined />,
      label: "Duyệt Dịch vụ",
    },
    {
      key: "/admin/reviews",
      icon: <StarOutlined />,
      label: "Quản lí đánh giá",
    },
    {
      key: "/admin/checkins",
      icon: <CheckCircleOutlined />,
      label: "Quản lí lịch sử",
    },
    {
      key: "/admin/payments",
      icon: <DollarOutlined />,
      label: "Thanh toán & Hoa hồng",
    },
    {
      key: "/admin/bank",
      icon: <DollarOutlined />,
      label: "Ngân hàng Admin",
    },
    {
      key: "/admin/settings",
      icon: <SettingOutlined />,
      label: "Cài đặt hệ thống",
    },
    {
      key: "/admin/vouchers",
      icon: <GiftOutlined />,
      label: "Voucher",
    },
    {
      key: "/admin/push-notifications",
      icon: <NotificationOutlined />,
      label: "Gửi thông báo đẩy",
    },
    {
      key: "/admin/sos",
      icon: <AlertOutlined />,
      label: "Theo dõi SOS",
    },
  ];

  // ✅ MENU OWNER
  const ownerItems = [
    {
      key: "/owner/dashboard",
      icon: <DashboardOutlined />,
      label: "Tổng quan",
    },
    ...(user?.role === "owner"
      ? [
        {
          key: "/owner/bank",
          icon: <DollarOutlined />,
          label: "Ngân hàng",
        },
      ]
      : []),
    {
      key: "/owner/locations",
      icon: <ShopOutlined />,
      label: "Địa điểm",
    },
    {
      key: "/owner/services",
      icon: <ShopOutlined />,
      label: "Dịch vụ",
    },
    {
      key: "/owner/reviews",
      icon: <StarOutlined />,
      label: "Quản lí đánh giá",
    },
    {
      key: "/owner/bookings",
      icon: <CheckCircleOutlined />,
      label: "Quản lí đặt chỗ",
    },
    {
      key: "/owner/payments",
      icon: <DollarOutlined />,
      label: "Lịch sử",
    },
    ...(user?.role === "owner"
      ? [
        {
          key: "/owner/commissions",
          icon: <DollarOutlined />,
          label: "Hoa hồng",
        },
      ]
      : []),
    {
      key: "/owner/vouchers",
      icon: <GiftOutlined />,
      label: "Voucher",
    },
    ...(user?.role === "owner"
      ? [
        {
          key: "/owner/employees",
          icon: <TeamOutlined />,
          label: "Nhân viên",
        },
      ]
      : []),
    {
      key: "/owner/logs",
      icon: <FileTextOutlined />,
      label: "Nhật ký",
    },
  ];

  const menuItems = user?.role === "admin" ? adminItems : ownerItems;

  const unreadOwnerNotifications = notifications.filter(
    (item) => !(item?.is_read === true || Number(item?.is_read) === 1),
  ).length;

  const openOwnerNotificationPanel = async () => {
    const nextOpen = !notificationOpen;
    setNotificationOpen(nextOpen);
    if (!nextOpen) return;
    try {
      await ownerApi.markNotificationsReadAll();
    } catch {
      // ignore
    }
    await refreshOwnerNotifications();
  };

  const deleteAllOwnerNotifications = async () => {
    if (deletingNotifications || notifications.length === 0) return;
    setDeletingNotifications(true);
    try {
      await ownerApi.deleteNotificationsAll();
      setNotifications([]);
    } finally {
      setDeletingNotifications(false);
      await refreshOwnerNotifications();
    }
  };

  const getOwnerNotificationTarget = (item: any): string => {
    const title = String(item?.title || "").toLowerCase();
    const body = String(item?.body || "").toLowerCase();
    const text = `${title} ${body}`;

    if (text.includes("dịch vụ") || text.includes("service")) {
      return "/owner/services";
    }
    if (
      text.includes("địa điểm") ||
      text.includes("location") ||
      text.includes("duyệt") ||
      text.includes("từ chối")
    ) {
      return "/owner/locations";
    }
    if (
      text.includes("đánh giá") ||
      text.includes("review") ||
      text.includes("bình luận")
    ) {
      return "/owner/reviews";
    }
    if (text.includes("đặt chỗ") || text.includes("booking")) {
      return "/owner/bookings";
    }
    if (text.includes("hoa hồng") || text.includes("commission")) {
      return "/owner/commissions";
    }
    if (text.includes("thanh toán") || text.includes("payment")) {
      return "/owner/payments";
    }
    if (text.includes("voucher")) {
      return "/owner/vouchers";
    }
    if (text.includes("nhân viên") || text.includes("employee")) {
      return "/owner/employees";
    }
    return "/owner/dashboard";
  };

  const handleOwnerNotificationClick = (item: any) => {
    const target = getOwnerNotificationTarget(item);
    setNotificationOpen(false);
    navigate(target);
  };

  // Close admin notif panel on outside click
  useEffect(() => {
    if (!adminNotifOpen) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (!adminNotifRef.current?.contains(e.target as Node)) setAdminNotifOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setAdminNotifOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [adminNotifOpen]);

  useEffect(() => {
    if (!notificationOpen) return;

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (notificationWrapRef.current?.contains(target)) return;
      setNotificationOpen(false);
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setNotificationOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onEscape);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, [notificationOpen]);

  // Close profile dropdown on outside click
  useEffect(() => {
    if (!profileOpen) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (!profileRef.current?.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [profileOpen]);

  const brand = (() => {
    const role = String(user?.role || "");
    if (role === "admin") return { short: "TCA", full: "Travel Admin" };
    if (role === "owner") return { short: "TCO", full: "Travel Owner" };
    if (role === "employee") return { short: "TCO", full: "Travel Owner" };
    return { short: "TC", full: "Travel" };
  })();

  const isAdmin = user?.role === "admin";
  const isOwner = user?.role === "owner" || user?.role === "employee";
  
  return (
    <div className="h-screen overflow-hidden flex bg-slate-50">
      {/* SIDER */}
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        theme="dark"
        width={250}
        className={`shadow-xl z-20 h-full overflow-y-auto sleek-scrollbar ${isAdmin ? "bg-gradient-to-b from-[#1a0505] to-[#0a0000]" : "bg-[#0B1120]"}`}
        style={{ backgroundColor: isAdmin ? "#0a0000" : "#0B1120" }}
      >
        <div className={`h-16 flex items-center justify-center border-b ${isAdmin ? "border-red-900/50 bg-transparent" : "border-slate-800 bg-[#0B1120]"}`}>
          <h1
            className={`font-black tracking-wide transition-all ${
              collapsed ? "text-xl" : "text-2xl"
            } ${isAdmin ? "text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-rose-400 drop-shadow-sm" : "text-white"}`}
          >
            {collapsed ? brand.short : brand.full}
          </h1>
        </div>
        <div className="p-3">
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[
              isAdmin &&
                (location.pathname === "/admin/system-vouchers" ||
                  location.pathname === "/admin/owner-vouchers")
                ? "/admin/vouchers"
                : location.pathname,
            ]}
            items={menuItems}
            onClick={({ key }) => navigate(key)}
            className="border-r-0 bg-transparent custom-sider-menu"
            style={{ backgroundColor: "transparent" }}
          />
        </div>

      </Sider>

      {/* MAIN CONTENT AREA */}
      <Layout className="h-full overflow-hidden flex-1" style={{ background: "transparent" }}>
        {/* HEADER */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 flex items-center justify-between shrink-0 shadow-sm z-[999] relative">
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            className="text-lg w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-600"
          />

          <div className="flex items-center gap-4">
            {/* ADMIN: Notification Bell */}
            {isAdmin && (
              <div className="relative" ref={adminNotifRef}>
                <button
                  type="button"
                  className="group relative flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600 transition-all hover:bg-red-100 hover:text-red-700"
                  onClick={() => {
                    setAdminNotifOpen((o) => !o);
                    if (!adminNotifOpen) markAllAdminRead();
                  }}
                  aria-label="Thông báo Admin"
                >
                  <Badge
                    count={adminNotifs.filter((n) => !n.read).length}
                    size="small"
                    offset={[2, -2]}
                  >
                    <BellOutlined className="text-lg" />
                  </Badge>
                </button>

                {adminNotifOpen && (
                  <div className="absolute right-0 top-12 z-[9999] w-[420px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-fade-in origin-top-right">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-red-50 to-orange-50 px-4 py-3">
                      <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                        <BellOutlined className="text-red-500" />
                        Thông báo Hệ thống
                        {adminNotifs.filter((n) => !n.read).length > 0 && (
                          <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
                            {adminNotifs.filter((n) => !n.read).length} mới
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        className="rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-white disabled:opacity-50"
                        onClick={clearAdminNotifs}
                        disabled={adminNotifs.length === 0}
                      >
                        Xóa hết
                      </button>
                    </div>

                    {/* List */}
                    <div className="max-h-[460px] overflow-y-auto sleek-scrollbar">
                      {adminNotifs.length === 0 ? (
                        <div className="px-4 py-10 text-center">
                          <div className="text-3xl mb-2">🔔</div>
                          <div className="text-sm text-slate-400">Chưa có thông báo nào</div>
                        </div>
                      ) : (
                        adminNotifs.map((n) => (
                          <button
                            type="button"
                            key={n.id}
                            className={`w-full border-b border-slate-50 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-slate-50 ${
                              !n.read ? "bg-red-50/40" : ""
                            }`}
                            onClick={() => {
                              setAdminNotifOpen(false);
                              if (n.link) {
                                navigate(n.link);
                              }
                            }}
                          >
                            <div className="flex items-start gap-3">
                              <span className="mt-0.5 text-xl leading-none">{notifIconMap[n.type]}</span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-sm font-semibold text-slate-900">{n.title}</span>
                                  {!n.read && (
                                    <span className="shrink-0 rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-bold text-white">MỚI</span>
                                  )}
                                </div>
                                {n.body && (
                                  <div className="mt-0.5 text-xs text-slate-500 line-clamp-3 whitespace-pre-line break-words">{n.body.trim()}</div>
                                )}
                                <div className="mt-1.5 text-[11px] text-slate-400 font-semibold tracking-wide">
                                  {new Date(n.at).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" })}
                                </div>
                              </div>
                              <RightOutlined className="mt-1 shrink-0 text-[10px] text-slate-300" />
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* OWNER: Notification Bell */}
            {!isAdmin && (
              <div className="relative" ref={notificationWrapRef}>
                <button
                  type="button"
                  className="group relative flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition-all hover:bg-blue-100 hover:text-blue-700"
                  onClick={() => {
                    void openOwnerNotificationPanel();
                  }}
                  aria-label="Mở thông báo"
                >
                  <Badge
                    count={unreadOwnerNotifications}
                    size="small"
                    offset={[2, -2]}
                  >
                    <BellOutlined className="text-lg" />
                  </Badge>
                </button>

                {notificationOpen && (
                  <div className="absolute right-0 top-12 z-[9999] w-[390px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-fade-in origin-top-right">
                    <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-4 py-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <NotificationOutlined className="text-blue-500" />
                        Thông báo gần đây
                      </div>
                      <button
                        type="button"
                        className="rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-white disabled:opacity-60"
                        onClick={() => {
                          void deleteAllOwnerNotifications();
                        }}
                        disabled={deletingNotifications || notifications.length === 0}
                      >
                        {deletingNotifications ? "Đang xóa..." : "Xóa hết"}
                      </button>
                    </div>
                    
                    <div className="max-h-[420px] overflow-y-auto bg-white sleek-scrollbar">
                      {notificationsLoading ? (
                        <div className="px-4 py-7 text-center text-sm text-slate-500">
                          Đang tải thông báo...
                        </div>
                      ) : notifications.length === 0 ? (
                        <div className="px-4 py-7 text-center text-sm text-slate-500">
                          Chưa có thông báo.
                        </div>
                      ) : (
                        notifications.map((item) => {
                          const isUnread = !(item?.is_read === true || Number(item?.is_read) === 1);
                          return (
                            <div
                              key={String(item.notification_id)}
                              className={`flex items-start gap-3 border-b border-slate-50 px-4 py-3 last:border-b-0 cursor-pointer transition-all duration-200 text-left ${isUnread ? 'bg-[#f0f7ff]/60 hover:bg-[#e0efff]/80' : 'bg-white hover:bg-slate-50/80'}`}
                              onClick={() => handleOwnerNotificationClick(item)}
                            >
                              <div className="h-9 w-9 rounded-xl border flex items-center justify-center shrink-0 text-sm shadow-sm bg-blue-50 text-blue-500 border-blue-100">
                                🔔
                              </div>
                              <div className="flex-1 min-w-0 space-y-1">
                                <div className="flex items-center justify-between gap-2">
                                  <h4 className="text-xs font-bold text-slate-800 truncate">
                                    {String(item.title || "Thông báo")}
                                  </h4>
                                  {isUnread && (
                                    <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500 shadow-[0_0_8px_#3b82f6]" />
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-500 leading-relaxed break-words font-medium line-clamp-3">
                                  {String(item.body || "-").trim()}
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
                )}
              </div>
            )}

            {/* Profile Dropdown Component */}
            <div className="relative" ref={profileRef}>
              <div 
                className="flex items-center gap-2 px-1.5 py-1.5 rounded-full border border-slate-200 bg-white shadow-sm hover:shadow-md hover:border-slate-300 transition-all cursor-pointer"
                onClick={() => setProfileOpen(!profileOpen)}
              >
                <div className={`rounded-full p-[2px] bg-gradient-to-tr ${isAdmin ? "from-red-500 to-rose-400" : "from-blue-500 to-cyan-400"}`}>
                  <Avatar
                    src={resolveBackendUrl(user?.avatar_url) || undefined}
                    style={{ backgroundColor: isAdmin ? "#0f172a" : "#ffffff", color: isAdmin ? "#ffffff" : "#0f172a" }}
                    icon={!user?.avatar_url ? <UserOutlined /> : undefined}
                    className="w-7 h-7 shrink-0 border-2 border-white"
                  />
                </div>
                <span className="hidden sm:block text-sm font-bold text-slate-700 pl-1 pr-2 truncate max-w-[120px]">
                  {user?.full_name?.split(' ').pop() || "User"}
                </span>
                <RightOutlined className={`text-[10px] text-slate-400 pr-2 transition-transform duration-300 ${profileOpen ? 'rotate-90' : 'rotate-0'}`} />
              </div>

              {profileOpen && (
                <div className="absolute right-0 top-12 z-50 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl animate-fade-in origin-top-right">
                  <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                    <p className="text-sm font-bold text-slate-800 truncate">{user?.full_name}</p>
                    <p className="text-xs font-medium text-slate-500 truncate">{user?.email}</p>
                  </div>
                  <div className="p-2 space-y-1">
                    <button
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                      onClick={() => {
                        setProfileOpen(false);
                        navigate(isAdmin ? "/admin/profile" : "/owner/profile");
                      }}
                    >
                      <UserOutlined className="text-slate-400 text-lg" /> Thông tin cá nhân
                    </button>
                    <button
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors"
                      onClick={() => {
                        setProfileOpen(false);
                        handleLogout();
                      }}
                    >
                      <LogoutOutlined className="text-red-400 text-lg" /> Đăng xuất
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* VIEWPORT CONTENT */}
        <div className="flex-1 flex flex-col overflow-x-hidden overflow-y-auto sleek-scrollbar bg-slate-50/50">
          <div className="p-4 sm:p-6 lg:p-8 flex-1 animate-fade-in-up">
            {children}
          </div>
          
          {/* Footer Support Info (Only for Owner) */}
        </div>

        {isOwner || isAdmin ? <ManagerAiBubble /> : null}
      </Layout>
    </div>
  );
};

export default MainLayout;
