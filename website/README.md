# 🌐 Website Dashboard — Trung Tâm Điều Hành Của Đế Chế Du Lịch

> *"Từ đây, Admin kiểm soát cả hệ thống. Owner điều hành quán. User trải nghiệm dịch vụ. Ba vai trò, một nền tảng."*

Đây là ứng dụng web quản lý đa vai trò của TravelCheckinApp — phục vụ **Admin**, **Owner** (bao gồm nhân viên), và **User (Tourist)** trên một giao diện thống nhất được xây dựng bằng React 19 + Vite 7 + Ant Design.

---

## 📋 Mục Lục

- [Tổng Quan](#tổng-quan)
- [Cấu Trúc Thư Mục](#cấu-trúc-thư-mục)
- [Trang Theo Vai Trò](#trang-theo-vai-trò)
- [Components Đặc Biệt](#components-đặc-biệt)
- [Công Nghệ & Thư Viện](#công-nghệ--thư-viện)
- [Cài Đặt & Chạy](#cài-đặt--chạy)
- [Biến Môi Trường](#biến-môi-trường)

---

## Tổng Quan

| Thông tin | Chi tiết |
|-----------|----------|
| **Framework** | React 19 + Vite 7 |
| **Ngôn ngữ** | TypeScript |
| **UI Library** | Ant Design 6 |
| **Routing** | React Router DOM v7 |
| **State** | Zustand + React Context |
| **Bản đồ** | Leaflet + React Leaflet (web) + Google Maps API |
| **Biểu đồ** | Recharts |
| **Calendar** | React Big Calendar |
| **Real-time** | Socket.IO Client |
| **Forms** | React Hook Form + Zod |
| **Export** | ExcelJS (xuất báo cáo Excel) |
| **QR Code** | qrcode.react (tạo QR) + @zxing/browser (quét QR) |
| **Thanh toán** | VietQR (qua backend) |
| **Cổng dev** | `5173` (Vite) |

---

## Cấu Trúc Thư Mục

```
website/
├── src/
│   ├── App.tsx                    # Route config chính — phân quyền theo role
│   ├── main.tsx                   # Entry point React
│   ├── App.css / index.css        # Global styles
│   ├── api/                       # Axios instances + API helpers
│   ├── assets/                    # Ảnh tĩnh, icon
│   ├── components/                # Shared components dùng chung
│   │   ├── AvatarCropper.tsx      # Crop avatar kiểu Zalo (custom hoàn toàn)
│   │   ├── InvoiceExportModal.tsx # Modal xuất hóa đơn
│   │   ├── InvoicePrintTemplate.tsx # Template in hóa đơn
│   │   ├── LeafletHeatLayer.tsx   # Heatmap trên bản đồ
│   │   ├── LocationChatBubble.tsx # Chat bubble AI cho địa điểm (~28KB)
│   │   ├── LocationPickerMap.tsx  # Chọn vị trí trên bản đồ (~21KB)
│   │   ├── ManagerAiBubble.tsx    # Chat bubble AI Manager Bot
│   │   ├── OwnerChatManager.tsx   # Giao diện chat Owner với AI (~45KB)
│   │   ├── OwnerTempCloseModal.tsx # Modal đóng cửa tạm thời
│   │   ├── ProtectedRoute.tsx     # Route guard theo role
│   │   ├── SessionKickModal.tsx   # Thông báo bị kick session
│   │   ├── SupportCenter.tsx      # Trung tâm hỗ trợ
│   │   ├── VirtualBankCard.tsx    # Thẻ ngân hàng virtual UI
│   │   ├── WavyDivider.tsx        # Divider sóng (decorative)
│   │   └── admin/                 # Components riêng cho Admin
│   ├── contexts/                  # React Context (auth, socket, theme...)
│   ├── hooks/                     # Custom hooks
│   ├── layouts/                   # Layout wrapper (sidebar, header, footer)
│   ├── modules/                   # Module độc lập theo tính năng
│   ├── pages/
│   │   ├── Auth/                  # Đăng nhập, đăng ký, OAuth
│   │   ├── Admin/                 # Toàn bộ trang Admin (18 trang)
│   │   ├── Owner/                 # Toàn bộ trang Owner + FrontOffice (21 trang)
│   │   └── User/                  # Toàn bộ trang User/Tourist (20 trang)
│   ├── types/                     # TypeScript type definitions
│   └── utils/                     # Hàm tiện ích
├── public/                        # Static assets công khai
├── index.html                     # HTML template
├── vite.config.ts                 # Vite config
├── tailwind.config.js             # Tailwind (cho className bổ sung)
├── tsconfig.app.json
└── package.json
```

---

## Trang Theo Vai Trò

### 👑 Admin (18 Trang)

| File | Chức năng |
|------|-----------|
| `Dashboard.tsx` | Tổng quan hệ thống, số liệu toàn cầu |
| `Users.tsx` | Quản lý tài khoản User — khóa/xóa |
| `Owners.tsx` | Quản lý tài khoản Owner |
| `Locations.tsx` | Duyệt địa điểm mới từ Owner |
| `OwnerServicesApproval.tsx` | Duyệt dịch vụ/giá/ảnh từ Owner |
| `Checkins.tsx` | Theo dõi toàn bộ lượt check-in (~82KB) |
| `Commissions.tsx` | Quản lý hoa hồng + xác nhận nhận tiền |
| `History.tsx` | Lịch sử giao dịch toàn hệ thống |
| `Vouchers.tsx` | Voucher hệ thống (Admin tạo) (~57KB) |
| `OwnerVouchers.tsx` | Voucher từ phía Owner |
| `SystemVouchers.tsx` | Voucher hệ thống nâng cao |
| `ReviewManagement.tsx` | Kiểm duyệt đánh giá người dùng |
| `SosAlerts.tsx` | Nhận và xử lý cảnh báo SOS |
| `PushNotifications.tsx` | Gửi push notification toàn hệ thống |
| `Reports.tsx` | Báo cáo + xuất Excel |
| `Bank.tsx` | Cấu hình tài khoản ngân hàng nhận hoa hồng |
| `Settings.tsx` | Cài đặt hệ thống (ảnh nền, % hoa hồng mặc định) |
| `Profile.tsx` | Hồ sơ Admin |

### 🏢 Owner — Chế Độ Quản Lý (12 Trang)

| File | Chức năng |
|------|-----------|
| `OwnerDashboard.tsx` | Tổng quan kinh doanh + nút vào Operational Mode |
| `OwnerLocations.tsx` | Đăng ký/quản lý địa điểm (~52KB) |
| `OwnerLocationOpsConfig.tsx` | Cấu hình bàn/phòng/vé sau khi được duyệt (~99KB) |
| `OwnerServices.tsx` | Tạo/sửa dịch vụ và giá (~42KB) |
| `OwnerBookings.tsx` | Xem và xử lý đặt dịch vụ (~34KB) |
| `OwnerPayments.tsx` | Lịch sử thanh toán (~52KB) |
| `OwnerVouchers.tsx` | Tạo và quản lý voucher (~50KB) |
| `OwnerCommissions.tsx` | Xem hoa hồng nợ + quét QR thanh toán |
| `OwnerEmployees.tsx` | Quản lý nhân viên |
| `OwnerReviews.tsx` | Xem và phản hồi đánh giá khách |
| `OwnerBank.tsx` | Cấu hình tài khoản ngân hàng nhận tiền từ khách |
| `OwnerLogs.tsx` | Log hoạt động nội bộ |

### 🏭 Owner — Chế Độ Vận Hành / FrontOffice (5 Trang + 4 History)

| File | Chức năng |
|------|-----------|
| `FrontOffice.tsx` | Màn hình chọn loại FrontOffice |
| `FrontOfficeRestaurant.tsx` | **POS Nhà hàng** — quản lý bàn, order, in hóa đơn (~109KB) |
| `FrontOfficeHotel.tsx` | **PMS Khách sạn** — check-in/out, quản lý phòng (~134KB) |
| `FrontOfficeTourist.tsx` | **POS Du lịch** — quét QR/code vé (~48KB) |
| `FrontOfficePaymentsHistory.tsx` | Lịch sử thanh toán POS (~69KB) |
| `FrontOfficeTouristTicketsHistory.tsx` | Lịch sử vé du lịch (~36KB) |

### 🧳 User / Tourist (20 Trang)

| File | Chức năng |
|------|-----------|
| `UserDashboard.tsx` | Trang chủ + widget thời tiết + gợi ý (~33KB) |
| `UserMap.tsx` | **Bản đồ khám phá** — lớn nhất hệ thống (~234KB) |
| `LocationDetail.tsx` | Chi tiết địa điểm Google Maps-style (~75KB) |
| `BookingPage.tsx` | **Đặt dịch vụ** (3 loại) — cực phức tạp (~199KB) |
| `MyTickets.tsx` / `TicketCart.tsx` | Giỏ vé và thanh toán (~43KB) |
| `Checkins.tsx` | Lịch sử check-in + nhật ký du lịch (~42KB) |
| `Itineraries.tsx` / `ItineraryEditor.tsx` | Tạo và chỉnh sửa hành trình |
| `RoomBookingPass.tsx` | Vé đặt phòng + QR (~22KB) |
| `TableBookingPass.tsx` | Vé đặt bàn + QR (~21KB) |
| `SavedLocations.tsx` | Địa điểm yêu thích |
| `Vouchers.tsx` | Voucher khả dụng |
| `BookingReminders.tsx` | Nhắc nhở sắp đến hẹn |
| `AiChat.tsx` | Chat với Google Gemini |
| `Sos.tsx` | Nút SOS khẩn cấp |
| `Profile.tsx` | Hồ sơ cá nhân + avatar crop |

---

## Components Đặc Biệt

### 🗺️ LocationPickerMap — Chọn Vị Trí Trên Bản Đồ
Cho phép Owner ghim vị trí địa điểm kinh doanh trên bản đồ Leaflet khi đăng ký. Hỗ trợ tìm kiếm địa chỉ và kéo marker.

### ✂️ AvatarCropper — Crop Ảnh Kiểu Zalo
Component crop ảnh hoàn toàn tự làm, hỗ trợ:
- Zoom in/out bằng scroll hoặc pinch
- Kéo ảnh để căn chỉnh
- Preview trực tiếp trong vòng tròn
- Export ảnh đã crop

### 💬 OwnerChatManager + ManagerAiBubble — Chat AI Owner/Admin
Giao diện chat nội bộ kết nối với AI Manager Bot, hỗ trợ:
- Gợi ý câu hỏi theo route hiện tại
- Hiển thị action plan
- Lịch sử hội thoại

### 🔐 ProtectedRoute — Phân Quyền Tự Động
Route guard kiểm tra `role` từ JWT token và redirect về trang lỗi hoặc đăng nhập nếu không đủ quyền.

### 💳 VirtualBankCard — Thẻ Ngân Hàng Ảo
Hiển thị thông tin ngân hàng Owner/Admin theo dạng thẻ ngân hàng đẹp mắt.

---

## Công Nghệ & Thư Viện

| Thư viện | Mục đích |
|----------|---------|
| `antd` | UI Component Library chính |
| `react-router-dom` v7 | Client-side routing |
| `zustand` | Global state |
| `react-leaflet` + `leaflet` | Bản đồ web |
| `@react-google-maps/api` | Google Maps embed |
| `recharts` | Biểu đồ doanh thu, thống kê |
| `react-big-calendar` | Lịch đặt phòng/bàn |
| `socket.io-client` | Real-time SOS, thông báo |
| `qrcode.react` | Sinh QR vé, thanh toán |
| `@zxing/browser` | Quét QR bằng camera |
| `exceljs` | Xuất báo cáo Excel |
| `react-hook-form` + `zod` | Form validation |
| `dayjs` + `date-fns` | Xử lý ngày tháng |
| `react-easy-crop` | Crop ảnh (dùng trong AvatarCropper) |
| `colorthief` | Trích màu dominant từ ảnh |
| `react-to-print` | In hóa đơn trực tiếp |
| `@react-oauth/google` | Đăng nhập Google |

---

## Cài Đặt & Chạy

```bash
cd website

# Cài thư viện
npm install

# Chạy development
npm run dev

# Build production
npm run build

# Preview bản build
npm run preview

# Kiểm tra lint
npm run lint
```

---

## Biến Môi Trường

Tạo file `.env`:

```env
# Backend API URL
VITE_API_URL=http://localhost:3000

# Google Maps API Key (cho LocationPickerMap)
VITE_GOOGLE_MAPS_KEY=...

# Google OAuth Client ID
VITE_GOOGLE_CLIENT_ID=...
```

---

> [!NOTE]
> File `UserMap.tsx` (~234KB) và `BookingPage.tsx` (~199KB) là 2 file lớn nhất toàn dự án. Chúng tích hợp cực nhiều tính năng — đừng ngại khi mở ra thấy dài.

> [!TIP]
> Owner có **2 chế độ** hoàn toàn khác nhau: **Normal Mode** (quản lý) và **Operational Mode** (FrontOffice/POS/PMS). Chuyển đổi bằng nút trên `OwnerDashboard`.

> [!IMPORTANT]
> Website dùng **Ant Design 6** — một số API có thể khác với Ant Design 5. Chú ý khi tra documentation.

---

*Được xây dựng như một phần của luận văn tốt nghiệp — Đại học Tây Đô* 🎓
