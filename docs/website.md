website/
├── src/
│ │
│ ├── api/ # Gọi Backend
│ │ ├── axiosClient.ts # Config Interceptors (Auto attach Token)
│ │ ├── auth.api.ts
│ │ ├── user.api.ts
│ │ ├── owner.api.ts
│ │ ├── employee.api.ts
│ │ ├── admin.api.ts
│ │ ├── location.api.ts
│ │ ├── booking.api.ts
│ │ ├── payment.api.ts
│ │ ├── voucher.api.ts # 🆕 Quản lý mã giảm giá
│ │ ├── commission.api.ts # 🆕 Quản lý công nợ
│ │ ├── ai.api.ts # 🆕 Chat Gemini & Lịch trình
│ │ └── sos.api.ts # 🆕 Gửi tín hiệu SOS
│ │
│ ├── assets/ # 🆕 Ảnh tĩnh, Logo, Icon
│ │ ├── images/
│ │ └── icons/
│ │
│ ├── types/ # 🆕 TypeScript Interface (Khớp DB)
│ │ ├── user.types.ts
│ │ ├── booking.types.ts
│ │ ├── location.types.ts
│ │ └── ...
│ │
│ ├── constants/
│ │ ├── roles.ts # ENUM: ADMIN, OWNER...
│ │ ├── status.ts # Booking Status, Payment Status
│ │ └── config.ts # API_URL, GOOGLE_MAP_KEY
│ │
│ ├── context/ # 🆕 Global State (Thay vì dùng Redux phức tạp)
│ │ ├── AuthContext.tsx # Lưu User đang login
│ │ └── ToastContext.tsx # Thông báo nổi (Success/Error)
│ │
│ ├── hooks/
│ │ ├── useAuth.ts
│ │ ├── useRole.ts
│ │ ├── useDebounce.ts # 🆕 Để search địa điểm không bị lag
│ │ └── useSocket.ts # 🆕 Nhận thông báo Realtime (SOS, Booking mới)
│ │
│ ├── utils/
│ │ ├── formatDate.ts
│ │ ├── formatMoney.ts # VND currency
│ │ ├── storage.ts
│ │ └── validate.ts # Validate form
│ │
│ ├── components/
│ │ ├── common/
│ │ │ ├── Button.tsx
│ │ │ ├── Input.tsx
│ │ │ ├── Modal.tsx
│ │ │ ├── Table.tsx # 🆕 Table hiển thị dữ liệu chuẩn
│ │ │ └── Badge.tsx # 🆕 Hiển thị Status màu sắc
│ │ │
│ │ ├── layout/
│ │ │ ├── Header.tsx
│ │ │ ├── Sidebar.tsx # Sidebar đổi theo Role
│ │ │ └── Footer.tsx
│ │ │
│ │ ├── map/ # 🆕 Google Maps Components
│ │ │ ├── MapViewer.tsx
│ │ │ └── LocationMarker.tsx
│ │ │
│ │ └── qr/ # 🆕 QR Components
│ │ ├── QrGenerator.tsx # Tạo QR thanh toán
│ │ └── QrScanner.tsx # Quét QR (cho Employee dùng Laptop/Tablet)
│ │
│ ├── pages/
│ │ │
│ │ ├── auth/
│ │ │ ├── LoginPage.tsx
│ │ │ ├── RegisterPage.tsx
│ │ │ └── ForgotPasswordPage.tsx
│ │ │
│ │ ├── user/ # Khách du lịch
│ │ │ ├── HomePage.tsx
│ │ │ ├── LocationDetailPage.tsx
│ │ │ ├── BookingPage.tsx
│ │ │ ├── ProfilePage.tsx
│ │ │ ├── BookingHistoryPage.tsx
│ │ │ ├── MyItineraryPage.tsx # 🆕 Xem lịch trình AI gợi ý
│ │ │ └── AiChatPage.tsx # 🆕 Chat với Gemini
│ │ │
│ │ ├── owner/ # Chủ địa điểm
│ │ │ ├── OwnerDashboard.tsx
│ │ │ ├── LocationManagePage.tsx
│ │ │ ├── ServiceManagePage.tsx
│ │ │ ├── BookingManagePage.tsx
│ │ │ ├── RevenuePage.tsx
│ │ │ ├── VoucherManagePage.tsx # 🆕 Tạo Voucher
│ │ │ ├── CommissionDebtPage.tsx # 🆕 Xem nợ Admin
│ │ │ ├── EmployeeManagePage.tsx # 🆕 Tạo nhân viên
│ │ │ └── BankProfilePage.tsx # 🆕 Cài đặt tài khoản ngân hàng
│ │ │
│ │ ├── employee/ # Nhân viên
│ │ │ ├── EmployeeDashboard.tsx
│ │ │ ├── CheckinPage.tsx # Quét QR khách
│ │ │ └── PosPage.tsx # 🆕 Bán vé/đồ ăn tại quầy
│ │ │
│ │ ├── admin/ # Quản trị viên
│ │ │ ├── AdminDashboard.tsx
│ │ │ ├── OwnerApprovePage.tsx
│ │ │ ├── UserManagePage.tsx
│ │ │ ├── CommissionSystemPage.tsx # 🆕 Quản lý thu nợ toàn hệ thống
│ │ │ ├── SosAlertsPage.tsx # 🆕 Màn hình theo dõi SOS
│ │ │ └── ReportManagePage.tsx # Xử lý báo cáo vi phạm
│ │ │
│ │ └── NotFoundPage.tsx
│ │
│ ├── router/
│ │ ├── AppRouter.tsx
│ │ ├── PrivateRoute.tsx
│ │ └── RoleRoute.tsx
│ │
│ ├── App.tsx
│ └── main.tsx
│
├── public/
├── package.json
├── tsconfig.json
└── vite.config.ts # Dùng Vite cho nhanh (npm run dev)

# mô tả cấu trúc thư mục cho website React của dự án "Travel Smart Check-in"

website/
├── src/
│ ├── api/ # Chứa logic gọi Backend (Axios)
│ ├── assets/ # Ảnh tĩnh, logo, icons
│ ├── components/ # Các UI nhỏ tái sử dụng (Button, Input, Modal...)
│ ├── constants/ # Các biến cố định (Role, API URL, Status Color)
│ ├── context/ # Quản lý State toàn cục (Auth, Toast)
│ ├── hooks/ # Logic dùng chung (useAuth, useLocation...)
│ ├── pages/ # Các màn hình chính (chia theo Role)
│ ├── router/ # Cấu hình đường dẫn (React Router)
│ ├── types/ # Định nghĩa kiểu dữ liệu (Interface khớp DB)
│ └── utils/ # Hàm hỗ trợ (Format tiền, Date...)

🗺️ MAPPING: TỪ LOGIC SANG GIAO DIỆN (UI/UX)
Dưới đây là cách Frontend xử lý dữ liệu để tương tác với người dùng:

1. Nhóm Kinh Doanh (Booking & Money)
   Màn hình Đặt chỗ (BookingPage.tsx):

UI: Form chọn ngày, số lượng + Ô nhập mã Voucher.

Logic:

User chọn dịch vụ -> Frontend tính tạm tính.

User nhập Voucher -> Gọi API checkVoucher -> Trừ tiền -> Cập nhật final_amount.

Bấm "Thanh toán" -> Gọi API createBooking -> Backend trả về chuỗi QR.

Hiển thị QR Code (dùng thư viện qrcode.react) để khách quét trả tiền.

Màn hình Quản lý Nợ (CommissionDebtPage.tsx - Owner):

UI: Bảng thống kê các đơn hàng chưa đóng thuế + Nút "Thanh toán nợ".

Logic:

Gọi API getCommissions -> Lấy danh sách nợ.

Hiện tổng tiền nợ Admin.

Bấm "Thanh toán" -> Hiện QR tài khoản của Admin để Owner chuyển khoản.

2. Nhóm Tương Tác & Tiện Ích
   Màn hình Check-in (CheckinPage.tsx - Employee):

UI: Khung Camera (Webcam) hoặc ô nhập mã thủ công.

Logic:

Sử dụng thư viện react-qr-reader để bật Camera.

Khi quét được QR -> Parse chuỗi PAY|LOC=....

Gọi API verifyCheckin -> Server trả về thông tin khách + trạng thái "Hợp lệ/Không hợp lệ".

Hiện Popup thông báo kết quả (Xanh/Đỏ).

Màn hình Nhật ký (BookingHistoryPage.tsx + Modal Diary):

UI: Danh sách chuyến đi đã qua + Nút "Viết nhật ký".

Logic:

User chọn chuyến đi cũ -> Bấm "Viết nhật ký".

Hiện Form: Upload ảnh + Chọn Mood (Vui/Buồn - Enum) + Ghi chú.

Gửi API createDiary.

Nút SOS Khẩn cấp (Floating Button - Global):

UI: Nút đỏ luôn nổi ở góc màn hình.

🆕 Bản đồ check-in tự do (UserMap.tsx - User):
UI: User click bản đồ để tạo marker + popup (tọa độ, nhập tên, nút xem thông tin / check-in / lưu).
Logic: Gọi /user/checkins với tọa độ; backend tự tìm location gần nhất hoặc tạo mới (is_user_created) trước khi check-in hoặc lưu favorite.

Logic:

User bấm -> Web browser xin quyền navigator.geolocation.

Lấy tọa độ (Lat/Long) -> Gọi API sendSOS.

Hiện thông báo: "Đã gửi tín hiệu cứu hộ! Admin đang xử lý".

3. Nhóm AI & Thông Minh
   Màn hình Chat AI (AiChatPage.tsx):

UI: Giao diện chat giống Messenger/ChatGPT.

Logic:

User nhập: "Gợi ý lịch trình đi Đà Lạt 3 ngày 2 đêm, thích sống ảo".

Frontend gửi prompt + user_id (để AI đọc sở thích) về Backend.

Backend trả về JSON -> Frontend render ra Timeline đẹp mắt.

🔌 DANH SÁCH PAGES (ROUTING)
Các đường dẫn (URL) tương ứng trên trình duyệt:

🔐 AUTH (Public)
/login: Đăng nhập

/register: Đăng ký User

/register-owner: Đăng ký đối tác (Owner)

/forgot-password: Quên mật khẩu

👤 USER (Role: User)
/: Trang chủ (Tìm kiếm, Gợi ý)

/location/:id: Chi tiết địa điểm (Xem phòng/menu, Review)

/booking/:serviceId: Trang đặt chỗ

/profile: Thông tin cá nhân + Cài đặt AI Style

/my-trips: Lịch sử chuyến đi + Nhật ký

/ai-chat: Chat với trợ lý ảo

🥈 OWNER (Role: Owner)
/owner/dashboard: Thống kê doanh thu, khách hàng

/owner/locations: Quản lý địa điểm

/owner/services: Quản lý phòng/món ăn

/owner/vouchers: (Mới) Tạo mã giảm giá

/owner/employees: Tạo tài khoản nhân viên

/owner/finance: (Mới) Xem công nợ & Thanh toán hoa hồng

🥉 EMPLOYEE (Role: Employee)
/employee/dashboard: Xem task hôm nay

/employee/checkin: Màn hình quét QR

🥇 ADMIN (Role: Admin)
/admin/dashboard: Thống kê toàn hệ thống

/admin/approvals: Duyệt Owner/Location mới

/admin/sos: (Mới) Màn hình theo dõi tín hiệu SOS (Real-time)

/admin/debts: (Mới) Quản lý thu hồi nợ

🛠️ CODE MẪU: BẢO VỆ ROUTE (RoleRoute.tsx)
Đây là component quan trọng để đảm bảo User không thể mò vào trang Admin dù biết đường dẫn.

File: src/router/RoleRoute.tsx

TypeScript

import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth'; // Hook lấy thông tin user từ Context
import { ROLES } from '../constants/roles'; // Enum: 'admin', 'owner', 'user'...

interface RoleRouteProps {
allowedRoles: string[]; // Mảng các role được phép truy cập
}

const RoleRoute: React.FC<RoleRouteProps> = ({ allowedRoles }) => {
const { user, isAuthenticated, isLoading } = useAuth();

// 1. Đang tải thông tin user -> Hiện Loading
if (isLoading) {
return <div className="flex justify-center items-center h-screen">Loading...</div>;
}

// 2. Chưa đăng nhập -> Đá về trang login
if (!isAuthenticated || !user) {
return <Navigate to="/login" replace />;
}

// 3. Đăng nhập rồi nhưng sai quyền -> Đá về trang 403 hoặc Home
if (!allowedRoles.includes(user.role)) {
// Ví dụ: User thường cố vào /admin -> Đá về /
return <Navigate to="/" replace />;
}

// 4. Hợp lệ -> Cho phép hiển thị nội dung bên trong (Outlet)
return <Outlet />;
};

export default RoleRoute;
Cách sử dụng trong AppRouter.tsx:

TypeScript

<Routes>
  {/* Public Routes */}
  <Route path="/login" element={<LoginPage />} />

{/_ Admin Routes (Chỉ Admin mới vào được) _/}
<Route element={<RoleRoute allowedRoles={[ROLES.ADMIN]} />}>
<Route path="/admin/dashboard" element={<AdminDashboard />} />
<Route path="/admin/sos" element={<SosAlertsPage />} />
</Route>

{/_ Owner Routes (Chỉ Owner mới vào được) _/}
<Route element={<RoleRoute allowedRoles={[ROLES.OWNER]} />}>
<Route path="/owner/dashboard" element={<OwnerDashboard />} />
<Route path="/owner/vouchers" element={<VoucherManagePage />} />
</Route>

{/_ Employee Routes (Employee & Owner đều vào được để kiểm tra) _/}
<Route element={<RoleRoute allowedRoles={[ROLES.EMPLOYEE, ROLES.OWNER]} />}>
<Route path="/employee/checkin" element={<CheckinPage />} />
</Route>
</Routes>
💡 Lời khuyên công nghệ cho Frontend
State Management: Dùng React Context API là đủ (như cấu trúc trên). Không cần Redux trừ khi dự án phình quá to.

UI Library: Nên dùng TailwindCSS để code giao diện nhanh, dễ chỉnh sửa trên Mobile.

Real-time: Dùng Socket.io-client để làm tính năng SOS và Chat (kết nối với Backend).

# mẫu file RoleRoute.tsx để chặn quyền truy cập

Bạn tạo file theo đường dẫn: src/router/RoleRoute.tsx

1️⃣ Code file src/router/RoleRoute.tsx
TypeScript

import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth'; // Hook lấy thông tin user (xem lưu ý bên dưới)

interface RoleRouteProps {
allowedRoles: string[]; // Mảng các role được phép truy cập (VD: ['admin', 'owner'])
}

const RoleRoute: React.FC<RoleRouteProps> = ({ allowedRoles }) => {
const { user, isAuthenticated, isLoading } = useAuth();
const location = useLocation();

// 1. Nếu đang tải thông tin user (F5 trang) -> Hiện màn hình Loading
if (isLoading) {
return (

<div className="flex justify-center items-center h-screen bg-gray-50">
<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
</div>
);
}

// 2. Nếu chưa đăng nhập -> Đá về trang Login
// state={{ from: location }} giúp login xong tự quay lại trang đang vào dở
if (!isAuthenticated || !user) {
return <Navigate to="/login" state={{ from: location }} replace />;
}

// 3. Nếu đã đăng nhập nhưng Role không nằm trong danh sách cho phép
if (!allowedRoles.includes(user.role)) {
// Nếu là Admin/Owner đi lạc -> Về dashboard của họ
if (user.role === 'admin') return <Navigate to="/admin/dashboard" replace />;
if (user.role === 'owner') return <Navigate to="/owner/dashboard" replace />;
if (user.role === 'employee') return <Navigate to="/employee/dashboard" replace />;

    // Mặc định user thường hoặc role lạ -> Về trang chủ
    return <Navigate to="/" replace />;

}

// 4. Hợp lệ -> Cho phép hiển thị nội dung bên trong (Outlet)
return <Outlet />;
};

export default RoleRoute;
2️⃣ Cách sử dụng trong AppRouter.tsx
Bạn bọc các route cần bảo vệ bên trong RoleRoute như sau:

TypeScript

import { Routes, Route } from 'react-router-dom';
import RoleRoute from './RoleRoute';
import { ROLES } from '../constants/roles'; // File constant chứa: 'admin', 'user',...

// Import các pages...

const AppRouter = () => {
return (
<Routes>
{/_ --- Public Routes (Ai cũng vào được) --- _/}
<Route path="/login" element={<LoginPage />} />
<Route path="/" element={<HomePage />} />

      {/* --- ADMIN ONLY --- */}
      <Route element={<RoleRoute allowedRoles={['admin']} />}>
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/sos" element={<SosAlertsPage />} />
      </Route>

      {/* --- OWNER ONLY --- */}
      <Route element={<RoleRoute allowedRoles={['owner']} />}>
        <Route path="/owner/dashboard" element={<OwnerDashboard />} />
        <Route path="/owner/finance" element={<CommissionDebtPage />} />
      </Route>

      {/* --- EMPLOYEE & OWNER (Cả 2 đều vào được) --- */}
      <Route element={<RoleRoute allowedRoles={['owner', 'employee']} />}>
        <Route path="/employee/checkin" element={<CheckinPage />} />
      </Route>

      {/* --- USER ONLY --- */}
      <Route element={<RoleRoute allowedRoles={['user']} />}>
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/ai-chat" element={<AiChatPage />} />
      </Route>

      {/* --- 404 Not Found --- */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>

);
};

export default AppRouter;
⚠️ Lưu ý quan trọng (Prerequisites)
Để code trên chạy được, bạn cần đảm bảo:

Cài thư viện: npm install react-router-dom

Hook useAuth: Bạn phải có hook này trả về đúng format. Ví dụ đơn giản:

TypeScript

// src/hooks/useAuth.ts (Mô phỏng)
export const useAuth = () => {
// Thực tế bạn sẽ lấy từ Context hoặc Redux
const user = JSON.parse(localStorage.getItem('user') || 'null');
// user object phải có dạng: { id: 1, role: 'admin', ... }

return {
user: user,
isAuthenticated: !!user,
isLoading: false, // Xử lý logic check token thật ở đây
};
};

# Các thư viện và cấu hình cần cài đặt:

💻 PHẦN B: WEBSITE (React + Vite + TypeScript)
Dành cho Admin, Owner và User (trên máy tính).

1. Cài đặt thư viện chính
   Chạy trong thư mục website/:

Bash

npm install axios react-router-dom react-hook-form @hookform/resolvers zod zustand clsx tailwind-merge react-icons socket.io-client qrcode.react react-qr-reader @react-google-maps/api
Giải thích công dụng:

axios: Gọi API Backend.

react-router-dom: Chuyển trang, điều hướng.

react-hook-form + zod: Xử lý Form đăng ký/đăng nhập và validate siêu dễ.

zustand: Quản lý State (nhẹ hơn Redux nhiều, dùng để lưu user login).

tailwind-merge + clsx: Để viết class CSS Tailwind điều kiện (VD: nút bấm lúc active/disable).

react-icons: Kho icon khổng lồ.

socket.io-client: Nhận thông báo SOS từ server.

qrcode.react: Tạo mã QR để khách quét.

react-qr-reader: Quét mã QR bằng webcam laptop (cho Employee dùng PC).

@react-google-maps/api: Hiển thị bản đồ Google Maps.

2. Cấu hình TailwindCSS
   Bash

npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
Sửa file tailwind.config.js để nhận diện file code:

JavaScript

export default {
content: [
"./index.html",
"./src/**/*.{js,ts,jsx,tsx}",
],
theme: { extend: {} },
plugins: [],
}
