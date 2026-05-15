import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { io, Socket } from "socket.io-client";

import ProtectedRoute from "./components/ProtectedRoute";
import SessionKickModal from "./components/SessionKickModal";
import authApi from "./api/authApi";

const Login = lazy(() => import("./pages/Auth/Login"));
const Register = lazy(() => import("./pages/Auth/Register"));
const ForgotPassword = lazy(() => import("./pages/Auth/ForgotPassword"));
const GoogleCallback = lazy(() => import("./pages/Auth/GoogleCallback"));
const FacebookCallback = lazy(() => import("./pages/Auth/FacebookCallback"));
const OwnerTermsConfirm = lazy(() => import("./pages/Auth/OwnerTermsConfirm"));

const AdminDashboard = lazy(() => import("./pages/Admin/Dashboard"));
const AdminUsers = lazy(() => import("./pages/Admin/Users"));
const AdminOwners = lazy(() => import("./pages/Admin/Owners"));
const AdminLocations = lazy(() => import("./pages/Admin/Locations"));
const AdminCheckins = lazy(() => import("./pages/Admin/Checkins"));
const AdminReports = lazy(() => import("./pages/Admin/Reports"));
const AdminCommissions = lazy(() => import("./pages/Admin/Commissions"));
const AdminSettings = lazy(() => import("./pages/Admin/Settings"));
const AdminVouchers = lazy(() => import("./pages/Admin/Vouchers"));
const AdminPushNotifications = lazy(
  () => import("./pages/Admin/PushNotifications"),
);
const AdminSosAlerts = lazy(() => import("./pages/Admin/SosAlerts"));
const AdminProfile = lazy(() => import("./pages/Admin/Profile"));
const AdminAnalytics = lazy(() => import("./pages/Admin/Analytics"));
const AdminOwnerServicesApproval = lazy(
  () => import("./pages/Admin/OwnerServicesApproval"),
);
const AdminReviewManagement = lazy(
  () => import("./pages/Admin/ReviewManagement"),
);
const AdminBank = lazy(() => import("./pages/Admin/Bank"));

const UserDashboard = lazy(() => import("./pages/User/UserDashboard"));
const UserMap = lazy(() => import("./pages/User/UserMap"));
const LocationDetail = lazy(() => import("./pages/User/LocationDetail"));
const QrCheckin = lazy(() => import("./pages/User/QrCheckin"));
const MyCreatedLocations = lazy(
  () => import("./pages/User/MyCreatedLocations"),
);
const BookingPage = lazy(() => import("./pages/User/BookingPage"));
const UserProfile = lazy(() => import("./pages/User/Profile"));
const UserHistory = lazy(() => import("./pages/User/History"));
const UserVouchers = lazy(() => import("./pages/User/Vouchers"));
const UserSos = lazy(() => import("./pages/User/Sos"));
const UserItinerary = lazy(() => import("./pages/User/Itinerary"));
const SavedLocations = lazy(() => import("./pages/User/SavedLocations"));
const UserCheckins = lazy(() => import("./pages/User/Checkins"));
const UserDiary = lazy(() => import("./pages/User/Diary"));
const UserAiChat = lazy(() => import("./pages/User/AiChat"));
const UserLeaderboard = lazy(() => import("./pages/User/Leaderboard"));
const UserGroupCheckin = lazy(() => import("./pages/User/GroupCheckin"));
const UserBookingReminders = lazy(
  () => import("./pages/User/BookingReminders"),
);
const UserTicketCart = lazy(() => import("./pages/User/TicketCart"));

const OwnerDashboard = lazy(() => import("./pages/Owner/OwnerDashboard"));
const OwnerProfile = lazy(() => import("./pages/Owner/OwnerProfile"));
const OwnerBank = lazy(() => import("./pages/Owner/OwnerBank"));
const OwnerLocations = lazy(() => import("./pages/Owner/OwnerLocations"));
const OwnerServices = lazy(() => import("./pages/Owner/OwnerServices"));
const OwnerBookings = lazy(() => import("./pages/Owner/OwnerBookings"));
const OwnerPayments = lazy(() => import("./pages/Owner/OwnerPayments"));
const OwnerCommissions = lazy(() => import("./pages/Owner/OwnerCommissions"));
const OwnerVouchers = lazy(() => import("./pages/Owner/OwnerVouchers"));
const OwnerReviews = lazy(() => import("./pages/Owner/OwnerReviews"));
const OwnerEmployees = lazy(() => import("./pages/Owner/OwnerEmployees"));
const OwnerLogs = lazy(() => import("./pages/Owner/OwnerLogs"));
const OwnerNavigate = lazy(() => import("./pages/Owner/OwnerNavigate"));
const FrontOffice = lazy(() => import("./pages/Owner/FrontOffice"));
const FrontOfficePaymentsHistory = lazy(
  () => import("./pages/Owner/FrontOfficePaymentsHistory"),
);
const FrontOfficeTouristTicketsHistory = lazy(
  () => import("./pages/Owner/FrontOfficeTouristTicketsHistory"),
);
const OwnerLocationOpsConfig = lazy(
  () => import("./pages/Owner/OwnerLocationOpsConfig"),
);
const Unauthorized = lazy(() => import("./pages/Unauthorized"));

// ⭐ Helper function để lấy default redirect URL
const getDefaultRedirect = (): string => {
  const userStr = sessionStorage.getItem("user");
  if (!userStr) return "/login";

  try {
    const user = JSON.parse(userStr);
    switch (user.role) {
      case "admin":
        return "/admin/dashboard";
      case "owner":
        return "/owner/dashboard";
      case "employee":
        return "/employee/front-office";
      default:
        return "/user/dashboard";
    }
  } catch {
    return "/login";
  }
};

const PageLoader = () => (
  <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
    <div className="rounded-3xl border border-slate-200 bg-white px-6 py-5 text-center shadow-sm">
      <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
      <div className="text-sm font-medium text-slate-700">
        Đang tải trang...
      </div>
    </div>
  </div>
);

const resolveSocketUrl = (): string => {
  const raw =
    (import.meta.env.VITE_SOCKET_URL as string | undefined) ||
    (import.meta.env.VITE_API_URL as string | undefined) ||
    "http://localhost:3000";
  return raw.replace(/\/api\/?$/, "");
};

const SessionGuard = () => {
  const location = useLocation();
  const socketRef = useRef<Socket | null>(null);
  const tokenRef = useRef<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState(
    "Tai khoan dang duoc dang nhap tai noi khac.",
  );

  const socketUrl = useMemo(() => resolveSocketUrl(), []);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string }>).detail;
      setModalMessage(
        detail?.message || "Tai khoan dang duoc dang nhap tai noi khac.",
      );
      setModalOpen(true);
    };

    window.addEventListener("tc-session-revoked", handler as EventListener);
    return () => {
      window.removeEventListener(
        "tc-session-revoked",
        handler as EventListener,
      );
    };
  }, []);

  useEffect(() => {
    if (modalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
  }, [modalOpen]);

  useEffect(() => {
    const token = sessionStorage.getItem("accessToken");
    if (!token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        tokenRef.current = null;
      }
      return;
    }

    void authApi.checkSession();

    if (tokenRef.current === token && socketRef.current) {
      return;
    }

    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    tokenRef.current = token;
    const socket = io(socketUrl, {
      auth: { token },
      transports: ["websocket"],
    });

    socket.on("session_revoked", (payload: { message?: string }) => {
      window.dispatchEvent(
        new CustomEvent("tc-session-revoked", {
          detail: {
            message:
              payload?.message ||
              "Tai khoan dang duoc dang nhap tai noi khac.",
          },
        }),
      );
    });

    socketRef.current = socket;
  }, [location.key, socketUrl]);

  const handleConfirm = () => {
    sessionStorage.removeItem("accessToken");
    sessionStorage.removeItem("refreshToken");
    sessionStorage.removeItem("user");
    window.location.href = "/login";
  };

  return (
    <SessionKickModal
      open={modalOpen}
      message={modalMessage}
      onConfirm={handleConfirm}
    />
  );
};

function App() {
  return (
    <Router>
      <Suspense fallback={<PageLoader />}>
        <SessionGuard />
        <Routes>
          {/* ==================== PUBLIC ROUTES ==================== */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/auth/google/callback" element={<GoogleCallback />} />
          <Route
            path="/auth/facebook/callback"
            element={<FacebookCallback />}
          />
          <Route
            path="/auth/owner-terms/confirm"
            element={<OwnerTermsConfirm />}
          />
          <Route path="/unauthorized" element={<Unauthorized />} />

          {/* ==================== PROTECTED ROUTES ==================== */}

          {/* Admin Routes */}
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminUsers />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/owners"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminOwners />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/locations"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminLocations />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/owner-services"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminOwnerServicesApproval />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/reviews"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminReviewManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/checkins"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminCheckins />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/reports"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminReports />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/payments"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminCommissions />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/settings"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminSettings />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/bank"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminBank />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/vouchers"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminVouchers />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/system-vouchers"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminVouchers />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/owner-vouchers"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminVouchers />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/push-notifications"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminPushNotifications />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/sos"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminSosAlerts />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/profile"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminProfile />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/analytics"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminAnalytics />
              </ProtectedRoute>
            }
          />

          {/* User Routes */}
          <Route
            path="/user/dashboard"
            element={
              <ProtectedRoute allowedRoles={["user"]}>
                <UserDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user/map"
            element={
              <ProtectedRoute allowedRoles={["user"]}>
                <UserMap />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user/qr-checkin"
            element={
              <ProtectedRoute allowedRoles={["user"]}>
                <QrCheckin />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user/my-created-locations"
            element={
              <ProtectedRoute allowedRoles={["user"]}>
                <MyCreatedLocations />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user/location/:id"
            element={
              <ProtectedRoute allowedRoles={["user"]}>
                <LocationDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user/booking/:serviceId"
            element={
              <ProtectedRoute allowedRoles={["user"]}>
                <BookingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user/tickets"
            element={
              <ProtectedRoute allowedRoles={["user"]}>
                <UserTicketCart />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user/profile"
            element={
              <ProtectedRoute allowedRoles={["user"]}>
                <UserProfile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user/itinerary"
            element={
              <ProtectedRoute allowedRoles={["user"]}>
                <UserItinerary />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user/saved-locations"
            element={
              <ProtectedRoute allowedRoles={["user"]}>
                <SavedLocations />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user/checkins"
            element={
              <ProtectedRoute allowedRoles={["user"]}>
                <UserCheckins />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user/leaderboard"
            element={
              <ProtectedRoute allowedRoles={["user"]}>
                <UserLeaderboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user/group-checkin"
            element={
              <ProtectedRoute allowedRoles={["user"]}>
                <UserGroupCheckin />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user/booking-reminders"
            element={
              <ProtectedRoute allowedRoles={["user"]}>
                <UserBookingReminders />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user/diary"
            element={
              <ProtectedRoute allowedRoles={["user"]}>
                <UserDiary />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user/ai-chat"
            element={
              <ProtectedRoute allowedRoles={["user"]}>
                <UserAiChat />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user/history"
            element={
              <ProtectedRoute allowedRoles={["user"]}>
                <UserHistory />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user/vouchers"
            element={
              <ProtectedRoute allowedRoles={["user"]}>
                <UserVouchers />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user/sos"
            element={
              <ProtectedRoute allowedRoles={["user"]}>
                <UserSos />
              </ProtectedRoute>
            }
          />

          {/* Owner/Employee Routes */}
          <Route
            path="/owner/dashboard"
            element={
              <ProtectedRoute allowedRoles={["owner", "employee"]}>
                <OwnerDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/owner/navigate"
            element={
              <ProtectedRoute allowedRoles={["owner", "employee"]}>
                <OwnerNavigate />
              </ProtectedRoute>
            }
          />

          <Route
            path="/owner/location-ops/:locationId"
            element={
              <ProtectedRoute allowedRoles={["owner"]}>
                <OwnerLocationOpsConfig />
              </ProtectedRoute>
            }
          />

          <Route
            path="/owner/front-office"
            element={
              <ProtectedRoute allowedRoles={["owner"]}>
                <FrontOffice />
              </ProtectedRoute>
            }
          />

          <Route
            path="/owner/front-office/payments-history"
            element={
              <ProtectedRoute allowedRoles={["owner"]}>
                <FrontOfficePaymentsHistory />
              </ProtectedRoute>
            }
          />

          <Route
            path="/owner/front-office/tourist/tickets-history"
            element={
              <ProtectedRoute allowedRoles={["owner"]}>
                <FrontOfficeTouristTicketsHistory />
              </ProtectedRoute>
            }
          />

          <Route
            path="/employee/front-office"
            element={
              <ProtectedRoute allowedRoles={["employee"]}>
                <FrontOffice />
              </ProtectedRoute>
            }
          />

          <Route
            path="/employee/front-office/payments-history"
            element={
              <ProtectedRoute allowedRoles={["employee"]}>
                <FrontOfficePaymentsHistory />
              </ProtectedRoute>
            }
          />

          <Route
            path="/employee/front-office/tourist/tickets-history"
            element={
              <ProtectedRoute allowedRoles={["employee"]}>
                <FrontOfficeTouristTicketsHistory />
              </ProtectedRoute>
            }
          />

          <Route
            path="/owner/profile"
            element={
              <ProtectedRoute allowedRoles={["owner", "employee"]}>
                <OwnerProfile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/owner/bank"
            element={
              <ProtectedRoute allowedRoles={["owner"]}>
                <OwnerBank />
              </ProtectedRoute>
            }
          />
          <Route
            path="/owner/locations"
            element={
              <ProtectedRoute allowedRoles={["owner", "employee"]}>
                <OwnerLocations />
              </ProtectedRoute>
            }
          />
          <Route
            path="/owner/services"
            element={
              <ProtectedRoute allowedRoles={["owner", "employee"]}>
                <OwnerServices />
              </ProtectedRoute>
            }
          />
          <Route
            path="/owner/bookings"
            element={
              <ProtectedRoute allowedRoles={["owner", "employee"]}>
                <OwnerBookings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/owner/payments"
            element={
              <ProtectedRoute allowedRoles={["owner", "employee"]}>
                <OwnerPayments />
              </ProtectedRoute>
            }
          />
          <Route
            path="/owner/commissions"
            element={
              <ProtectedRoute allowedRoles={["owner"]}>
                <OwnerCommissions />
              </ProtectedRoute>
            }
          />
          <Route
            path="/owner/vouchers"
            element={
              <ProtectedRoute allowedRoles={["owner", "employee"]}>
                <OwnerVouchers />
              </ProtectedRoute>
            }
          />
          <Route
            path="/owner/reviews"
            element={
              <ProtectedRoute allowedRoles={["owner", "employee"]}>
                <OwnerReviews />
              </ProtectedRoute>
            }
          />
          <Route
            path="/owner/employees"
            element={
              <ProtectedRoute allowedRoles={["owner"]}>
                <OwnerEmployees />
              </ProtectedRoute>
            }
          />
          <Route
            path="/owner/logs"
            element={
              <ProtectedRoute allowedRoles={["owner", "employee"]}>
                <OwnerLogs />
              </ProtectedRoute>
            }
          />

          {/* ==================== ROOT REDIRECT ==================== */}
          <Route
            path="/"
            element={<Navigate to={getDefaultRedirect()} replace />}
          />

          {/* ==================== 404 ==================== */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
