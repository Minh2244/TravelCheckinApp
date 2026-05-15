import React, { useState, useEffect, useRef } from "react";
import { Layout, Menu, Button, Avatar, Dropdown, Badge } from "antd";
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
  BarChartOutlined,
  StarOutlined,
  FileTextOutlined,
  RightOutlined,
} from "@ant-design/icons";
import { useNavigate, useLocation } from "react-router-dom";
import { message } from "antd";
import ownerApi from "../api/ownerApi";
import { resolveBackendUrl } from "../utils/resolveBackendUrl";
import { formatDateTimeVi } from "../utils/formatDateVi";

const { Header, Sider, Content } = Layout;

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

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState<StoredUser | null>(null);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [deletingNotifications, setDeletingNotifications] = useState(false);
  const notificationWrapRef = useRef<HTMLDivElement | null>(null);

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
    return () => window.clearInterval(id);
  }, [user?.role]);

  const userRole = user?.role;
  const userId = user?.user_id;

  // Heartbeat: nếu admin khóa tài khoản owner/employee thì tự bị đá về login (gần như ngay lập tức)
  useEffect(() => {
    if (!userId) return;
    if (userRole === "admin") return;
    const id = window.setInterval(() => {
      // Chỉ cần ping 1 API có auth; nếu bị khóa middleware sẽ trả 403 ACCOUNT_LOCKED
      void ownerApi.getMe().catch(() => {
        // axios interceptor sẽ handle redirect
      });
    }, 8000);
    return () => window.clearInterval(id);
  }, [userId, userRole]);

  const handleLogout = () => {
    console.log("🚪 Đăng xuất từ MainLayout");
    sessionStorage.removeItem("accessToken");
    sessionStorage.removeItem("refreshToken");
    sessionStorage.removeItem("user");
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
      key: "/admin/reports",
      icon: <DashboardOutlined />,
      label: "Báo cáo vi phạm",
    },
    {
      key: "/admin/analytics",
      icon: <BarChartOutlined />,
      label: "Analytics check-in",
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

  const brand = (() => {
    const role = String(user?.role || "");
    if (role === "admin") return { short: "TCA", full: "Travel Admin" };
    if (role === "owner") return { short: "TCO", full: "Travel Owner" };
    if (role === "employee") return { short: "TCO", full: "Travel Owner" };
    return { short: "TC", full: "Travel" };
  })();

  return (
    <div className="min-h-screen">
      <Layout className="min-h-screen" style={{ background: "#f5f5f5" }}>
        <Sider
          trigger={null}
          collapsible
          collapsed={collapsed}
          theme="light"
          className="shadow-md"
          width={250}
          style={{ backgroundColor: "#fff" }}
        >
          <div className="h-16 flex items-center justify-center border-b bg-gradient-to-r from-blue-500 to-blue-600">
            <h1
              className={`font-bold text-white transition-all ${
                collapsed ? "text-xs" : "text-xl"
              }`}
            >
              {collapsed ? brand.short : brand.full}
            </h1>
          </div>
          <Menu
            theme="light"
            mode="inline"
            selectedKeys={[
              user?.role === "admin" &&
              (location.pathname === "/admin/system-vouchers" ||
                location.pathname === "/admin/owner-vouchers")
                ? "/admin/vouchers"
                : location.pathname,
            ]}
            items={menuItems}
            onClick={({ key }) => navigate(key)}
            className="border-r-0"
          />
        </Sider>

        <Layout style={{ background: "transparent" }}>
          <Header
            className="p-0 shadow-sm flex justify-between items-center px-4"
            style={{ backgroundColor: "#fff" }}
          >
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              className="text-lg w-16 h-16"
            />

            <div className="flex items-center gap-4 pr-4">
              {user?.role !== "admin" ? (
                <div className="relative" ref={notificationWrapRef}>
                  <button
                    type="button"
                    className="group relative flex h-10 w-10 items-center justify-center rounded-full border border-blue-200 bg-gradient-to-b from-white to-blue-50 text-blue-600 shadow-sm transition-all hover:-translate-y-[1px] hover:border-blue-300 hover:shadow-md"
                    onClick={() => {
                      void openOwnerNotificationPanel();
                    }}
                    aria-label="Mở thông báo"
                  >
                    <Badge
                      count={unreadOwnerNotifications}
                      size="small"
                      offset={[-2, 2]}
                    >
                      <BellOutlined className="text-[17px]" />
                    </Badge>
                  </button>

                  {notificationOpen ? (
                    <div className="absolute right-0 top-12 z-50 w-[390px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
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
                          disabled={
                            deletingNotifications || notifications.length === 0
                          }
                        >
                          {deletingNotifications ? "Đang xóa..." : "Xóa hết"}
                        </button>
                      </div>
                      <div className="max-h-[420px] overflow-y-auto bg-white">
                        {notificationsLoading ? (
                          <div className="px-4 py-7 text-center text-sm text-slate-500">
                            Đang tải thông báo...
                          </div>
                        ) : notifications.length === 0 ? (
                          <div className="px-4 py-7 text-center text-sm text-slate-500">
                            Chưa có thông báo.
                          </div>
                        ) : (
                          notifications.map((item) => (
                            <button
                              type="button"
                              key={String(item.notification_id)}
                              className="w-full border-b border-slate-100 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-slate-50"
                              onClick={() => handleOwnerNotificationClick(item)}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm font-semibold text-slate-900">
                                    {String(item.title || "Thông báo")}
                                  </div>
                                  <div className="mt-1 text-xs leading-5 text-slate-600">
                                    {String(item.body || "-")}
                                  </div>
                                  <div className="mt-2 text-[11px] text-slate-400">
                                    {formatDateTimeVi(item.created_at)}
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-2 pt-0.5">
                                  {!(
                                    item?.is_read === true ||
                                    Number(item?.is_read) === 1
                                  ) ? (
                                    <span className="rounded-full bg-blue-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                                      Mới
                                    </span>
                                  ) : null}
                                  <RightOutlined className="text-[11px] text-slate-300" />
                                </div>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
              <span className="font-semibold text-gray-700">
                Hi, {user?.full_name || "User"}
              </span>
              <Dropdown
                menu={{
                  items: [
                    {
                      key: "profile",
                      label: "Thông tin cá nhân",
                      icon: <UserOutlined />,
                      onClick: () =>
                        navigate(
                          user?.role === "admin"
                            ? "/admin/profile"
                            : "/owner/profile",
                        ),
                    },
                    {
                      key: "logout",
                      label: "Đăng xuất",
                      icon: <LogoutOutlined />,
                      onClick: handleLogout,
                      danger: true,
                    },
                  ],
                }}
                placement="bottomRight"
              >
                <Avatar
                  src={resolveBackendUrl(user?.avatar_url) || undefined}
                  style={{ backgroundColor: "#1890ff", cursor: "pointer" }}
                  icon={!user?.avatar_url ? <UserOutlined /> : undefined}
                />
              </Dropdown>
            </div>
          </Header>

          <Content className="m-4 p-6 bg-white rounded-lg shadow-sm overflow-auto">
            {children}
          </Content>
        </Layout>
      </Layout>
    </div>
  );
};

export default MainLayout;
