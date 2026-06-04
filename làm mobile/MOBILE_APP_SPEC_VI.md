# TravelCheckinApp - Đặc tả Kỹ thuật Ứng dụng Mobile

> **Mục đích:** Tài liệu kỹ thuật tổng hợp để xây dựng ứng dụng Mobile (vai trò User/Khách du lịch) sử dụng Expo Router (SDK 56).
> Trích xuất từ phân tích codebase thực tế — không có placeholder.

---

## Mục lục

1. [Kiến trúc & Công nghệ](#1-kiến-trúc--công-nghệ)
2. [Quản lý trạng thái & Luồng xác thực](#2-quản-lý-trạng-thái--luồng-xác-thực)
3. [Đặc tả API cho vai trò User](#3-đặc-tả-api-cho-vai-trò-user)
4. [Bản đồ OpenStreetMap (OSM) & Logic định tuyến](#4-bản-đồ-openstreetmap-osm--logic-định-tuyến)
5. [Logic nghiệp vụ & Quy trình chi tiết](#5-logic-nghiệp-vụ--quy-trình-chi-tiết)
6. [Tham chiếu Schema Database](#6-tham-chiếu-schema-database)

---

## 1. Kiến trúc & Công nghệ

### 1.1 Backend

| Thành phần | Công nghệ | Phiên bản |
|------------|-----------|-----------|
| Runtime | Node.js | LTS |
| Framework | Express | ^5.2.1 |
| Ngôn ngữ | TypeScript | ^5.9.3 |
| Cơ sở dữ liệu | MySQL qua mysql2/promise | ^3.16.0 |
| Xác thực | JWT (jsonwebtoken) | ^9.0.3 |
| Mật khẩu | bcryptjs | ^3.0.3 |
| Validate | Zod | ^4.3.5 |
| Realtime | Socket.IO | ^4.8.3 |
| AI | @google/generative-ai | ^0.24.1 |
| Push | Firebase Admin | ^13.6.0 |
| Upload | Multer | ^2.0.2 |
| Bảo mật | Helmet | ^8.1.0 |
| Email | Nodemailer | ^7.0.12 |

**Kiến trúc:** Tầng Controller → Service → Model. Truy vấn SQL thô qua `mysql2/promise` với prepared statements (`?`).

**Entry point:** `backend/src/server.ts` — chạy trên `PORT` (mặc định 3000).

### 1.2 Website

| Thành phần | Công nghệ | Phiên bản |
|------------|-----------|-----------|
| Framework | React | ^19.2.0 |
| Bundler | Vite | ^7.2.4 |
| Ngôn ngữ | TypeScript | ~5.9.3 |
| Routing | React Router DOM | ^7.12.0 |
| State | sessionStorage + React hooks | — |
| UI | Ant Design + TailwindCSS | ^6.1.4 / ^3.4.17 |
| Maps | Leaflet + React-Leaflet | ^1.9.4 / ^5.0.0 |
| HTTP | Axios | ^1.13.2 |
| Realtime | Socket.IO Client | ^4.8.3 |
| Forms | React Hook Form + Zod | ^7.70.0 / ^4.3.5 |

### 1.3 Mobile (Hiện tại)

| Thành phần | Công nghệ | Phiên bản |
|------------|-----------|-----------|
| Framework | Expo SDK | ~56.0.8 |
| Routing | Expo Router | ~56.2.8 |
| React | React | 19.2.3 |
| React Native | react-native | 0.85.3 |
| Maps | react-native-maps | 1.27.2 |
| Animation | react-native-reanimated | 4.3.1 |
| Location | expo-location | ~56.0.15 |
| TypeScript | TypeScript | ~6.0.3 |

### 1.4 Kiến trúc tách rời

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Mobile App  │     │  Website    │     │  Admin Panel │
│  (Expo)      │     │  (React)    │     │  (React)     │
└──────┬───────┘     └──────┬──────┘     └──────┬───────┘
       │                    │                    │
       └────────────────────┼────────────────────┘
                            │
                    ┌───────▼───────┐
                    │  Backend API  │
                    │  (Express)    │
                    │  Cổng 3000    │
                    └───────┬───────┘
                            │
                    ┌───────▼───────┐
                    │  MySQL DB     │
                    │  (TravelCheckinApp) │
                    └───────────────┘
```

- Tất cả client giao tiếp qua REST API (`/api/*`)
- SSE endpoint tại `/api/events?token=...` để đẩy realtime (token trong query param vì SSE không gửi được header Authorization)
- Socket.IO để thông báo thu hồi phiên
- Backend phục vụ file tĩnh từ `backend/uploads/` (avatar, background, locations, services, reviews, checkins)

### 1.5 Biến môi trường

**Backend** (`backend/.env`):
```
PORT=3000
NODE_ENV=development
DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
JWT_SECRET, JWT_REFRESH_SECRET
GEMINI_API_KEY
FIREBASE_SERVICE_ACCOUNT_PATH
CORS_ORIGIN, CORS_CREDENTIALS
EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASSWORD, EMAIL_FROM
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
FACEBOOK_APP_ID, FACEBOOK_APP_SECRET
API_URL, FRONTEND_URL
```

---

## 2. Quản lý trạng thái & Luồng xác thực

### 2.1 Chiến lược quản lý trạng thái

**Codebase web không dùng Zustand.** Tất cả trạng thái được quản lý qua:

- **sessionStorage** để lưu trữ: `accessToken`, `refreshToken`, `user` (JSON string)
- **React useState/useCallback hooks** cho state component
- **Custom hooks** (`useBookings`, `useLocations`, `useLocationDetail`) bọc useState + API calls

**Các key sessionStorage:**
| Key | Mục đích |
|-----|----------|
| `accessToken` | JWT Bearer token |
| `refreshToken` | JWT refresh token |
| `user` | Đối tượng User dạng JSON |
| `userMapNearbyRadius` | Bán kính tìm kiếm bản đồ |
| `userMapCustomRadiusInput` | Input bán kính tùy chỉnh |
| `userMapRoute` | Trạng thái tuyến đường |
| `userMapSelected` | Địa điểm đang chọn trên bản đồ |

### 2.2 Cấu hình Axios Client

**File:** `website/src/api/axiosClient.ts`

**Base URL:**
```ts
const baseURL = (import.meta.env.VITE_API_URL) || "http://localhost:3000/api";
```

**Request Interceptor — Gắn Bearer Token:**
```ts
const token = sessionStorage.getItem("accessToken");
config.headers.Authorization = `Bearer ${token}`;
```

**Response Interceptor — Xử lý lỗi:**
- **SESSION_REVOKED:** Nếu `error.response?.data?.code === "SESSION_REVOKED"`, dispatch `CustomEvent("tc-session-revoked")`. Không tự động đăng xuất — hiển thị modal.
- **Đăng xuất bắt buộc:** Khi `status === 401` hoặc `status === 403` với code `ACCOUNT_LOCKED` hoặc `OWNER_NOT_APPROVED`
- Khi đăng xuất: xóa `accessToken`, `refreshToken`, `user` khỏi sessionStorage → chuyển hướng đến `/login`

**Quan trọng:** Không có interceptor tự động refresh token. Endpoint `authApi.refreshToken` tồn tại nhưng chưa được kết nối vào interceptor.

### 2.3 Interface User

```ts
interface User {
  user_id: number;
  email: string;
  phone: string | null;
  full_name: string;
  role: "user" | "owner" | "employee" | "admin";
  avatar_url: string | null;
  is_verified: number;
}

interface AuthResponse {
  success: boolean;
  message: string;
  warning?: string;
  data: {
    user: User;
    accessToken: string;
    refreshToken: string;
    redirectUrl: string;
  };
}
```

### 2.4 Luồng đăng nhập

1. Người dùng nhập `{email, password}` → `POST /api/auth/login`
2. Thành công, lưu vào storage: `accessToken`, `refreshToken`, `user`
3. Chuyển hướng đến `redirectUrl` (server quyết định theo vai trò)
4. Vai trò "user" → `/user/dashboard`
5. Hiển thị `warning` nếu có

### 2.5 Luồng đăng ký

1. **Bước 1:** Gửi `{full_name, email, password, phone}` → `POST /api/auth/register`
2. Backend tạo user với `role='user'`, `status='pending'`, `is_verified=0`
3. Gửi OTP qua email (6 số, hết hạn sau 5 phút)
4. **Bước 2:** Gửi `{email, otp}` → `POST /api/auth/verify-otp`
5. Thành công: `is_verified=1`, `status='active'` (user không cần admin duyệt)
6. Chuyển hướng đến `/login`

### 2.6 Luồng Google OAuth (Mobile)

1. Mở WebView đến `GET /api/auth/google/mobile`
2. Người dùng đồng ý trên Google
3. Google chuyển hướng đến callback backend
4. Backend đổi code lấy token, tạo/liên kết user
5. Chuyển hướng đến deep link: `travelcheckin://auth/callback?accessToken=...&refreshToken=...`
6. App lấy token từ URL

### 2.7 Luồng Facebook OAuth (Mobile)

Tương tự Google:
- `GET /api/auth/facebook/mobile` → đồng ý → `GET /api/auth/facebook/callback` → deep link

### 2.8 Cấu trúc Token

```ts
interface JwtPayload {
  userId: number;
  role: string;
  sessionId?: string;
}
```

| Token | Thời hạn | Secret |
|-------|----------|--------|
| Access Token | 7 ngày | JWT_SECRET |
| Refresh Token | 30 ngày | JWT_REFRESH_SECRET |

### 2.9 Quản lý phiên (Single-Session)

**Bảng:** `user_active_sessions`
```
user_id    INT PRIMARY KEY
session_id VARCHAR(64) NOT NULL
```

- Chỉ MỘT phiên hoạt động mỗi user
- Đăng nhập mới thay thế phiên cũ qua `setActiveSessionId(userId, sessionId)` — INSERT ... ON DUPLICATE KEY UPDATE
- Khi thay thế: `emitSessionRevoked(userId, newSessionId)` qua Socket.IO để thông báo client cũ
- Middleware `authenticateToken` so sánh `sessionId` trong JWT với DB — không khớp trả 401 với `code: "SESSION_REVOKED"`

### 2.10 Bảo vệ Brute-Force

**Bảng:** `login_attempts`
```
email         VARCHAR(255) PRIMARY KEY
attempts      INT NOT NULL DEFAULT 0
locked_until  DATETIME NULL
```

- Mỗi lần đăng nhập thất bại: tăng bộ đếm
- Sau 5 lần thất bại: khóa tài khoản 5 phút
- Đăng nhập thành công: Xóa bộ đếm

---

## 3. Đặc tả API cho vai trò User

### 3.1 Auth (Công khai)

| Method | Đường dẫn | Body | Response |
|--------|----------|------|----------|
| `POST` | `/api/auth/register` | `{full_name, email, password, phone}` | `{success, message}` |
| `POST` | `/api/auth/verify-otp` | `{email, otp}` | `{success, message}` |
| `POST` | `/api/auth/login` | `{email, password}` | `{success, data: {user, accessToken, refreshToken, redirectUrl}}` |
| `POST` | `/api/auth/social-login` | `{provider, socialId, email, fullName, avatarUrl?}` | Giống login |
| `POST` | `/api/auth/forgot-password` | `{email}` | `{success, message}` |
| `POST` | `/api/auth/verify-reset-otp` | `{email, otp}` | `{success, message}` |
| `POST` | `/api/auth/reset-password` | `{email, otp, newPassword}` | `{success, message}` |
| `POST` | `/api/auth/refresh-token` | `{refreshToken}` | `{success, data: {accessToken}}` |
| `GET` | `/api/auth/background` | — | `{success, data: {image_url}}` |
| `GET` | `/api/auth/app-background` | — | `{success, data: {image_url}}` |
| `GET` | `/api/auth/google/mobile` | — | Redirect Google OAuth |
| `GET` | `/api/auth/google/callback` | `?code=` | Redirect deep link |
| `GET` | `/api/auth/facebook/mobile` | — | Redirect Facebook OAuth |
| `GET` | `/api/auth/facebook/callback` | `?code=` | Redirect deep link |

### 3.2 Auth (Bảo vệ — cần Bearer token)

| Method | Đường dẫn | Response |
|--------|----------|----------|
| `POST` | `/api/auth/logout` | `{success}` |
| `GET` | `/api/auth/session` | `{success}` (200 nếu hợp lệ) |

### 3.3 User (Bảo vệ — cần vai trò "user")

Tất cả route tiền tố `/api/user`, yêu cầu `authenticateToken` + `requireRole("user")`.

#### Hồ sơ

| Method | Đường dẫn | Request | Response |
|--------|----------|---------|----------|
| `GET` | `/api/user/profile` | — | `UserProfile` (bao gồm stats: total_orders, total_spending, favorite_location, member_tier) |
| `PUT` | `/api/user/profile` | `{full_name, phone?, avatar_url?, skip_avatar?, background_url?, skip_background?, address?, username?}` | `{success}` |
| `POST` | `/api/user/profile/avatar` | FormData: file `avatar` (tối đa 50MB) | `{success, data: {avatar_url}}` |
| `POST` | `/api/user/profile/background` | FormData: file `background` (tối đa 50MB) | `{success, data: {background_url}}` |
| `GET` | `/api/user/profile/login-history` | `?page=&limit=&success=&from=&to=&q=` | `{data: [], pagination}` |

**Hạng thành viên:**
- 0-4 check-in: "Newbie"
- 5-15: "Silver Traveler"
- 16-30: "Gold Explorer"
- 31+: "Diamond Pathfinder"

#### Check-in

| Method | Đường dẫn | Request | Response |
|--------|----------|---------|----------|
| `GET` | `/api/user/checkins` | — | `CheckinItem[]` |
| `POST` | `/api/user/checkins` | `{location_id?, latitude, longitude, notes?, action: "checkin"|"save"}` | `{checkin_id, safety_warning?, safety_message?}` |
| `POST` | `/api/user/checkins/photo` | FormData: file `photo` + data checkin | `{checkin_id}` |
| `DELETE` | `/api/user/checkins/:id` | — | `{success}` |

#### Yêu thích

| Method | Đường dẫn | Request | Response |
|--------|----------|---------|----------|
| `GET` | `/api/user/favorites` | — | `Location[]` |
| `PATCH` | `/api/user/favorites/:locationId` | `{note?, tags?}` | `{success}` |
| `DELETE` | `/api/user/favorites/:locationId` | — | `{success}` |

#### Gợi ý & Địa điểm tự tạo

| Method | Đường dẫn | Request | Response |
|--------|----------|---------|----------|
| `GET` | `/api/user/recommendations/locations` | — | `Location[]` |
| `GET` | `/api/user/created-locations` | — | `Location[]` |
| `PATCH` | `/api/user/created-locations/:id` | `UpdatePayload` | `{success}` |
| `DELETE` | `/api/user/created-locations/:id` | — | `{success}` |

#### Voucher

| Method | Đường dẫn | Request | Response |
|--------|----------|---------|----------|
| `GET` | `/api/user/vouchers/location/:locationId` | — | `VoucherItem[]` |
| `GET` | `/api/user/vouchers/saved` | — | `VoucherItem[]` |
| `POST` | `/api/user/vouchers/:id/claim` | — | `{success}` |

#### Vé

| Method | Đường dẫn | Request | Response |
|--------|----------|---------|----------|
| `GET` | `/api/user/tickets` | `?location_id=` | `UserTouristTicketItem[]` |

#### Nhật ký

| Method | Đường dẫn | Request | Response |
|--------|----------|---------|----------|
| `GET` | `/api/user/diary` | — | `DiaryItem[]` |
| `POST` | `/api/user/diary` | `{location_id?, location_name?, mood?, notes?, images?}` | `{success}` |
| `DELETE` | `/api/user/diary/:id` | — | `{success}` |

#### Đánh giá

| Method | Đường dẫn | Request | Response |
|--------|----------|---------|----------|
| `POST` | `/api/user/reviews/upload` | FormData: file `image` | `{url}` |
| `POST` | `/api/user/reviews` | `{location_id, rating, comment?, images?}` | `{success}` |
| `DELETE` | `/api/user/reviews/:id` | — | `{success}` |
| `POST` | `/api/user/reviews/:id/reply` | `{content, images?}` | `{success}` |

#### Báo cáo

| Method | Đường dẫn | Request | Response |
|--------|----------|---------|----------|
| `POST` | `/api/user/reports/location` | `{location_id, description, report_type?, severity?}` | `{success}` |

#### Bảng xếp hạng & Nhắc nhở

| Method | Đường dẫn | Request | Response |
|--------|----------|---------|----------|
| `GET` | `/api/user/leaderboard` | `?province=&month=` | `LeaderboardRow[]` |
| `GET` | `/api/user/booking-reminders` | — | `BookingReminderItem[]` |

#### Thông báo

| Method | Đường dẫn | Request | Response |
|--------|----------|---------|----------|
| `GET` | `/api/user/notifications` | — | `UserNotificationItem[]` |
| `POST` | `/api/user/notifications/read-all` | — | `{success}` |
| `POST` | `/api/user/notifications/delete-all` | — | `{success}` |
| `POST` | `/api/user/notifications/location-invite` | `{location_id}` | `{success}` |

### 3.4 Đặt chỗ (Bảo vệ — cần vai trò "user")

Tất cả route tiền tố `/api/bookings`.

| Method | Đường dẫn | Request | Response |
|--------|----------|---------|----------|
| `POST` | `/api/bookings` | `CreateBookingPayload` | `CreateBookingResult` |
| `POST` | `/api/bookings/batch` | `CreateBookingBatchPayload` | `CreateBookingBatchResult` |
| `POST` | `/api/bookings/:id/payments` | — | `BookingPaymentResult` |
| `POST` | `/api/bookings/batch/payments` | `{booking_ids: number[]}` | `BookingPaymentResult` |
| `PUT` | `/api/bookings/batch/contact` | `{booking_ids, contact_name, contact_phone}` | `{success}` |
| `POST` | `/api/bookings/:id/tickets/confirm-transfer` | — | `ConfirmTicketTransferResult` |
| `POST` | `/api/bookings/:id/tables/confirm-transfer` | — | `{success}` |
| `POST` | `/api/bookings/:id/rooms/confirm-transfer` | — | `{success}` |
| `POST` | `/api/bookings/batch/rooms/confirm-transfer` | `{payment_id}` | `{success}` |
| `GET` | `/api/bookings/table-reservations/mine` | `?location_id=` | `TableReservationItem[]` |
| `GET` | `/api/bookings/table-reservations/pass` | `?location_id=` | `TableReservationItem[]` |
| `GET` | `/api/bookings/room-reservations/pass` | `?location_id=` | `RoomReservationItem[]` |
| `POST` | `/api/bookings/:id/tables/cancel` | — | `{success}` |
| `POST` | `/api/bookings/:id/cancel` | — | `{success}` |
| `POST` | `/api/bookings/:id/tables/preorder` | `{preorder_items: [{service_id, quantity}]}` | `{success}` |

**CreateBookingPayload:**
```ts
{
  location_id: number;
  service_id?: number;
  check_in_date: string;        // ISO datetime
  check_out_date?: string | null;
  quantity?: number;
  source?: "web" | "mobile";
  contact_name?: string | null;
  contact_phone?: string | null;
  notes?: string | null;
  voucher_code?: string | null;
  reserve_on_confirm?: boolean;
  table_ids?: number[];
  preorder_items?: { service_id: number; quantity: number }[];
  ticket_items?: { service_id: number; quantity: number }[];
}
```

### 3.5 Địa điểm (Công khai — xác thực tùy chọn)

Tất cả route tiền tố `/api/locations`, dùng `authenticateTokenOptional`.

| Method | Đường dẫn | Request | Response |
|--------|----------|---------|----------|
| `GET` | `/api/locations` | `?type=&keyword=&province=&source=` | `Location[]` |
| `GET` | `/api/locations/search` | Giống trên | `Location[]` |
| `GET` | `GET /api/locations/:id` | `?source=` | `Location` |
| `GET` | `/api/locations/:id/services` | `?type=` | `Service[]` |
| `GET` | `/api/locations/:id/pos/areas` | — | `PosArea[]` |
| `GET` | `/api/locations/:id/pos/tables` | `?area_id=&check_in_date=` | `PosTable[]` |
| `GET` | `/api/locations/:id/tickets/realtime-stock` | — | `{service_id, service_type, remaining_today}[]` |
| `GET` | `/api/locations/:id/reviews` | — | `LocationReview[]` |

**Bộ lọc consumer công khai:** `source=web|mobile` thêm `status='active'` và loại trừ địa điểm do user tạo.

### 3.6 Chat (Bảo vệ — mọi vai trò)

| Method | Đường dẫn | Request | Response |
|--------|----------|---------|----------|
| `GET` | `/api/chat/location/:locationId` | — | `LocationChatMessageItem[]` |
| `POST` | `/api/chat/location/:locationId` | `{content}` | `{success}` |

### 3.7 Push Notification (Bảo vệ)

| Method | Đường dẫn | Request | Response |
|--------|----------|---------|----------|
| `POST` | `/api/push/device-tokens` | `{token, deviceId, platform}` | `{success}` |
| `DELETE` | `/api/push/device-tokens/:deviceId` | — | `{success}` |

Dùng FCM theo topic. Đăng ký vào `user_{userId}` và `all_users`.

### 3.8 AI (Bảo vệ — mọi vai trò)

| Method | Đường dẫn | Request | Response |
|--------|----------|---------|----------|
| `POST` | `/api/ai/chat` | `{prompt}` | `{response}` |
| `GET` | `/api/ai/history` | — | `AiChatHistoryItem[]` |

Hiện tại trả thông báo bảo trì. Lưu chat vào bảng `ai_chat_history`.

### 3.9 SOS (Bảo vệ — cần vai trò "user")

| Method | Đường dẫn | Request | Response |
|--------|----------|---------|----------|
| `POST` | `/api/sos` | `{latitude, longitude, location_text?, message?, alert_id?}` | `{success, alert_id}` |
| `POST` | `/api/sos/ping` | Giống trên | `{success}` |
| `POST` | `/api/sos/stop` | `{alert_id?}` | `{success}` |

Dùng dữ liệu không gian MySQL: `ST_GeomFromText('POINT(lng lat)')`.

### 3.10 Geo (Công khai)

| Method | Đường dẫn | Request | Response |
|--------|----------|---------|----------|
| `GET` | `/api/geo/search` | `?q=&limit=` | `GeoSearchResult[]` |
| `GET` | `/api/geo/reverse` | `?lat=&lng=` | `GeoReverseResult` |

Proxy đến Nominatim OpenStreetMap. Rate limiter: 60 token burst, nạp lại 1/giây. Cache: 1 giờ cho search, 24 giờ cho reverse. Lọc kết quả trong phạm vi Việt Nam.

### 3.11 SSE Events

| Method | Đường dẫn | Request | Response |
|--------|----------|---------|----------|
| `GET` | `/api/events` | `?token=<JWT>` | SSE stream |

Xác thực JWT từ query param. Các sự kiện: `booking_expired`, `pos_updated`, `tourist_updated`, `hotel_updated`, `booking_checked_in`, `booking_cancelled`, `session_revoked`. Heartbeat mỗi 25 giây.

---

## 4. Bản đồ OpenStreetMap (OSM) & Logic định tuyến

### 4.1 Chuyển đổi Tile Layer (4 chế độ)

| Chế độ | Nhãn | URL |
|--------|------|-----|
| Tiêu chuẩn | Bản đồ tiêu chuẩn | `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` |
| Sáng | Bản đồ sáng | `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png` |
| Đường phố | Bản đồ đường phố | `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png` |
| Vệ tinh | Vệ tinh | `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}` |

Max zoom: 17 trên tất cả các lớp.

### 4.2 Xử lý sự kiện nhấn bản đồ

- **Nhấn đúp** trên bản đồ: Tạo marker điểm đã chọn với popup hiển thị tọa độ, gợi ý địa điểm gần, và nút hành động (check-in, chỉ đường, lưu).
- **Nhấn đơn** trên marker địa điểm: Gọi `handleSelectLocation(item, coords)` → đặt địa điểm đang chọn, mở panel bên, bay đến địa điểm.
- **Yêu cầu chỉ đường** (`ensureRouteToTarget`): Đặt `routeEnabled=true`, `routeTarget=target`, kích hoạt effect định tuyến.
- **Mũi tên phương hướng** (`BearingArrow`): Hiển thị vòng tròn xanh (bán kính 50m) + mũi tên chỉ đến đích, góc quay điều chỉnh theo heading thiết bị trên mobile.

### 4.3 Tích hợp dịch vụ định tuyến

**OSRM endpoints (dual fallback):**
```ts
const urls = [
  `https://router.project-osrm.org/route/v1/${routeProfile}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&alternatives=true`,
  `https://routing.openstreetmap.de/routed-car/route/v1/${routeProfile}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&alternatives=true`
];
```

Cả hai dùng `routeProfile = "driving"` bất kể chọn xe máy/ô tô (hạn chế của OSRM).

Thử lại: mỗi URL thử tối đa 3 lần, exponential backoff (`attempt * 300ms`).

### 4.4 Thuật toán chặn chỉ đường xuống sông

**Không có thuật toán chặn sông rõ ràng với mảng tọa độ hoặc bounding box.** Hệ thống dùng phương pháp fallback:

1. OSRM trả `NoRoute` khi không có đường_bridge/lối đi (ví dụ: qua sông Cần Thơ không có cầu)
2. Khi phát hiện `NoRoute`, chuyển sang kết nối đường thẳng haversine:
   ```ts
   setRouteLines([[from, to]]);
   setRouteInfo({
     distanceM: fallbackDistance,
     source: "haversine",
     hasNoRoute: true,
   });
   ```
3. Hiển thị: "Không tìm thấy đường bộ đến điểm này (ngoài khơi, sông hồ hoặc vùng biệt lập)"

Chặn sông là ngầm định — OSRM đơn giản không thể định tuyến qua nước nơi không có cầu, và đường thẳng haversine fallback cho thấy vấn đề cho người dùng.

### 4.5 Marker Avatar Tròn Tùy chỉnh

`getCircleImageIcon(imageUrl, isSelected, size)` tạo marker avatar tròn:

```ts
// Có ảnh: div tròn
{
  borderRadius: "50%",
  objectFit: "cover",
  border: "3px solid white",
  boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
}

// Không có ảnh: gradient fallback
{
  background: "linear-gradient(135deg, #99f6e4, #a7f3d0)",
  // SVG pin icon bên trong
}

// Trạng thái chọn: vòng teal
{
  boxShadow: "0 0 0 3px #14b8a6",
}
```

Giới hạn cache: 200 icons (sau đó xóa cache để tránh rò rỉ bộ nhớ).

### 4.6 Màu Pin theo loại

```ts
const PIN_COLORS = {
  owner: "#3b82f6",              // Xanh dương
  ownerSelected: "#2563eb",      // Xanh dương đậm
  userCreated: "#f59e0b",        // Hổ phách
  userCreatedSelected: "#d97706", // Hổ phách đậm
  search: "#22c55e",             // Xanh lá
  picked: "#fbbf24",             // Vàng
  myPosition: "#ef4444",         // Đỏ
};
```

### 4.7 Thuật toán xếp hạng tìm kiếm

`scoreSearchResult()` tính điểm:
- `ownerBoost`: +1000 cho kết quả owner/system
- `systemBoost`: +40 cho địa điểm hệ thống
- `textScore`: tối đa +120 dựa trên vị trí khớp query
- `distanceBoost`: +400 (≤5km), +250 (≤20km), +120 (≤50km), +50 (≤100km)
- `queryProvinceBoost`: +800 nếu tỉnh khớp query
- `userProvinceBoost`: +500 nếu tỉnh khớp vị trí user
- `outsideProvincePenalty`: -80 nếu khác tỉnh
- `nonHintPenalty`: -120 nếu tỉnh không khớp query

---

## 5. Logic nghiệp vụ & Quy trình chi tiết

### 5.1 Đặt nhà hàng & Khách sạn

#### Xác thực khung giờ check-in

- **Giới hạn đặt trước:** hôm nay + 3 ngày (cuối ngày thứ 3)
- **Không phải vé:** thời gian check-in phải trong tương lai
- **Vé:** ngày check-in phải từ hôm nay trở đi (chỉ ngày, không giờ)
- **Bàn:** thời gian check-in phải trong giờ mở cửa
- **Mặc định check-out phòng:** Nếu không có `check_out_date`, mặc định là `check_in + 24 giờ`

#### Thực thi giờ mở cửa

```ts
isWithinOpeningHours(opening_hours, now)
```

- Hỗ trợ nhiều định dạng: Mảng `{day, open, close}`, hoặc object `{open, close}`
- Tên ngày: `mon/tue/wed/thu/fri/sat/sun`, hoặc tiếng Việt `t2/t3/etc`, hoặc số 0-7
- Hỗ trợ lịch qua đêm (close < open nghĩa là跨越 nửa đêm)
- Nếu `open === close`, coi là 24h
- Trả `true` nếu không có lịch (không chặn)

#### Logic giữ chỗ / Tự hủy ±1 giờ

**Đặt bàn:**
- `TABLE_RESERVATION_SLOT_MINUTES = 120` — mỗi bàn giữ 2 giờ từ thời gian check-in
- `TABLE_RESERVATION_OWNER_WINDOW_MINUTES = 60` — chủ có thể bắt đầu chấp nhận 1 giờ trước đặt chỗ

**Tự hủy (chạy mỗi 60 giây):**
- **Đặt bàn ăn:** Nếu `check_in_date` đã qua `auto_cancel_food_minutes` (mặc định 60 phút) → tự hủy
- **Đặt phòng:** Nếu `check_in_date` đã qua `auto_cancel_hotel_minutes` (mặc định 60 phút) VÀ không có `hotel_stays` hoạt động (chưa check-in) → tự hủy
- **Vé:** Nếu `check_in_date` đã qua `auto_cancel_ticket_minutes` (mặc định 1440 = 1 ngày) → tự hủy. Cũng hủy vé có `check_out_date` (giờ đóng cửa) đã qua.

**Tự xác nhận (chạy mỗi 60 giây):**
- Nếu đặt chỗ đã pending với thanh toán hoàn thành lâu hơn `auto_confirm_minutes` (mặc định 30) → tự đặt thành 'confirmed'

**Quy tắc hủy (user khởi xướng):**
- **Bàn:** Không thể hủy nếu đã thanh toán (phải liên hệ admin). Không thể hủy nếu trong 60 phút trước thời gian đặt chỗ.
- **Phòng:** Không thể hủy nếu trong 24 giờ trước check-in VÀ trạng thái pending/confirmed.

#### Tính toán đặt trước (Pre-order)

- `preorderEnabled` bật/tắt (yêu cầu thanh toán chuyển khoản)
- `preorderQtyByServiceId: Record<number, number>` theo dõi số lượng
- Dịch vụ thực đơn lọc theo loại: `food`, `combo`, `other`
- Nhóm theo `category_name` với sidebar danh mục
- `preorderTotal = tổng (giá × số lượng)` mỗi dịch vụ
- Chỉ 1 bàn khi đặt trước
- Hai bước: (1) tạo booking + thanh toán, (2) xác nhận chuyển khoản

### 5.2 Vé du lịch

#### Quy tắc hết hạn 1 ngày

- Dùng giờ mở cửa để xác định hết hạn
- Nếu địa điểm có giờ đóng cửa → vé hết hạn lúc đóng cửa
- Nếu lịch qua đêm (close < open) → hết hạn ngày hôm sau lúc đóng cửa
- Nếu không có giờ mở cửa hoặc lịch 24h → hết hạn lúc 23:59:59

#### Vô hiệu hóa giờ đóng cửa

**Tự hết hạn (chạy mỗi 60 giây):**
- Vé có `check_in_date` đã qua `auto_cancel_ticket_minutes` (mặc định 1440 phút = 1 ngày) → tự hủy
- Vé có `check_out_date` (giờ đóng cửa) đã qua → tự hủy

#### Tính toán tồn kho vé

```ts
remaining = maxCapacity - (onlineSold + posSold)
```

- `onlineSold` = COUNT từ `booking_tickets` WHERE `status != 'void'` AND `DATE(check_in_date) = targetDate`
- `posSold` = COUNT từ `pos_tickets` WHERE `DATE(sold_at) = targetDate`
- Không giảm tồn kho tĩnh — tồn kho được tính động
- Tối đa 50 vé mỗi giao dịch

#### Định dạng mã vé

```
SB-{bookingId}-{index}-{random6chars}
```

### 5.3 Hệ thống hoa hồng linh hoạt

```ts
commissionAmount = amount * commissionRate / 100
vatAmount = commissionAmount * vatRate / 100
ownerReceivable = amount - commissionAmount - vatAmount
```

| Tỷ lệ | Mặc định | Ghi đè |
|--------|----------|--------|
| Hoa hồng | 2.5% | Theo địa điểm `commission_rate` |
| VAT | 10% | Cài đặt hệ thống `vat_rate` |

### 5.4 Quy trình Omni-Channel

**Bảng booking thống nhất:** Cả Online và Offline (tại quầy) dùng chung bảng `bookings`.

**Trường source:**
- `source: "web"` — từ website
- `source: "mobile"` — từ app mobile
- `source: "admin"` — từ admin panel
- Đặt chỗ tại quầy tạo bởi nhân viên qua hệ thống POS

**Tích hợp POS:**
- Bảng `pos_orders` theo dõi đơn hàng trực tiếp
- `pos_order_items` theo dõi dòng mục
- `pos_tickets` theo dõi vé bán tại quầy
- `pos_tables` theo dõi trạng thái bàn (trống/đặt/chiếm)

**Thống nhất tồn kho:**
```ts
remaining = maxCapacity - (onlineSold + posSold)
```
Cả bán online (`booking_tickets`) và tại quầy (`pos_tickets`) được đếm cùng nhau.

### 5.5 Luồng hóa đơn — Trình tạo VietQR

**URL Pattern:**
```
https://img.vietqr.io/image/{BIN}-{bankAccount}-compact2.png?addInfo={content}&amount={amount}&accountName={accountHolder}
```

**Hàm:**
```ts
buildVietQrImageUrl({
  bankName?: string | null,
  bankAccount?: string | null,
  accountHolder?: string | null,
  amount?: number | null,
  addInfo?: string | null,
  template?: "qr_only" | "compact2"
}): { url: string | null; error: string | null }
```

**Bảng mã BIN ngân hàng:**
```ts
{
  vcb: "970436",        // Vietcombank
  ctg: "970415",        // Vietinbank
  bidv: "970418",
  vba: "970405",        // Agribank
  acb: "970416",
  tcb: "970407",        // Techcombank
  mb: "970422",
  vpbank: "970432",
  tpbank: "970423",
  sacombank: "970403",
  vpb: "970432",
  shb: "970443",
  hdbank: "970437",
  ocb: "970448",
  msb: "970426",
  eximbank: "970431",
  seabank: "970440",
}
```

**Dữ liệu QR từ backend:**
```ts
{
  bank_name: string,
  bank_account: string,
  account_holder: string,
  amount: number,
  content: string,        // Mô tả giao dịch
  transaction_code: string,
  ticket_items: [{service_id, quantity}],
  use_date: string
}
```

**Miễn trừ thanh toán:**
> "Đã thanh toán nếu có vấn đề phát sinh hay không tới bị hủy thì tiền không được hoàn lại"

### 5.6 Logic xác thực voucher

**Các bước xác thực:**
1. Trạng thái phải `active`
2. Trong khoảng `start_date` → `end_date`
3. `used_count < usage_limit`
4. Khớp địa điểm (đơn hoặc đa địa điểm)
5. Khớp loại dịch vụ (all/room/food/ticket/other)
6. Khớp loại địa điểm (all/hotel/restaurant/tourist/cafe/resort/other)
7. Kiểm tra `min_order_value`
8. Kiểm tra `max_uses_per_user`
9. Kiểm tra khách hàng trung thành (nếu `target_group='loyal'`)

**Tính toán giảm giá:**
```ts
if (discount_type === "percent") {
  discount = (total * discount_value) / 100;
  if (max_discount_amount) discount = min(discount, max_discount_amount);
} else {
  discount = discount_value;
}
discount = min(discount, total);
```

### 5.7 Quy tắc Check-in

| Ràng buộc | Giá trị |
|-----------|---------|
| Yêu cầu điện thoại | Có (`^0\d{9}$`) |
| Địa lý Việt Nam | vĩ độ 8-23.5, kinh độ 102-110.5 |
| Tự động khớp địa điểm gần | 80 mét |
| Khoảng cách tối đa | 500 mét |
| Khoảng cách tối thiểu (bất kỳ) | 30 giây |
| Tối đa mỗi giờ | 20 |
| Tối đa mỗi ngày | 100 |
| Khoảng cách tối thiểu (cùng địa điểm) | 2 phút |
| Tối đa địa điểm tự tạo/ngày | 20 |
| Cảnh báo an toàn ban đêm | 22:00 - 05:00 |

### 5.8 Quy tắc đánh giá

- Xếp hạng: 1-5, bước 0.5 (`Number.isInteger(rating * 2)`)
- Tính lại xếp hạng địa điểm là trung bình có trọng số
- User có thể trả lời đánh giá trên địa điểm họ đã đánh giá
- Xóa mềm khi gỡ (`status='deleted'`)

### 5.9 Nhắc nhở đặt chỗ

- **6 giờ trước check-in:** Thông báo push nhắc nhở
- **3 giờ trước check-out:** Thông báo push nhắc nhở

### 5.10 Payload QR bảo mật

Tạo payload QR ký HMAC-SHA256:
```json
{
  "booking_id": 123,
  "location_id": 456,
  "service_type": "ticket",
  "secure_token": "hex_signature"
}
```

`verifySecureQrPayload`: Xác minh chữ ký VÀ kiểm tra `location_id` khớp với địa điểm nhân viên đang quét (ngăn chặn chéo địa điểm).

Mã bảo mật:
- Vé: `DI-{6-ky-tu-HMAC}`
- Phòng: `RS-{6-ky-tu-HMAC}`

---

## 6. Tham chiếu Schema Database

### 6.1 Bảng chính

#### `users`
```sql
user_id              INT AUTO_INCREMENT PRIMARY KEY
email                VARCHAR(255) NULL
phone                VARCHAR(30) NULL
password_hash        VARCHAR(255) NULL
full_name            VARCHAR(255) NOT NULL
role                 VARCHAR(50) NOT NULL  -- 'admin','owner','employee','user'
status               VARCHAR(50) NOT NULL  -- 'pending','active','locked'
avatar_url           VARCHAR(500) NULL
avatar_path          VARCHAR(500) NULL
avatar_source        ENUM('upload','url') NULL
avatar_updated_at    DATETIME NULL
is_verified          TINYINT NOT NULL DEFAULT 0
verified_at          DATETIME NULL
google_id            VARCHAR(255) NULL
facebook_id          VARCHAR(255) NULL
refresh_token        TEXT NULL
address              VARCHAR(500) NULL
username             VARCHAR(100) NULL
background_url       VARCHAR(500) NULL
background_path      VARCHAR(500) NULL
background_source    ENUM('upload','url') NULL
background_updated_at DATETIME NULL
deleted_at           DATETIME NULL
created_at           DATETIME DEFAULT CURRENT_TIMESTAMP
updated_at           DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
```

#### `locations`
```sql
location_id          INT AUTO_INCREMENT PRIMARY KEY
owner_id             INT NULL  -- FK -> users(user_id)
location_name        VARCHAR(255) NOT NULL
location_type        VARCHAR(50) NOT NULL  -- 'hotel','restaurant','tourist','cafe','resort','other'
description          TEXT NULL
address              VARCHAR(500) NULL
province             VARCHAR(100) NULL
latitude             DECIMAL(10,8) NULL
longitude            DECIMAL(11,8) NULL
first_image          VARCHAR(500) NULL
images               JSON NULL
is_eco_friendly      TINYINT DEFAULT 0
status               VARCHAR(50) DEFAULT 'active'
source               VARCHAR(50) NULL  -- 'owner','admin'
is_user_created      TINYINT DEFAULT 0
rating               DECIMAL(3,1) DEFAULT 0
total_reviews        INT DEFAULT 0
total_checkins       INT DEFAULT 0
opening_hours        JSON NULL
commission_rate      DECIMAL(5,2) NULL
auto_confirm_minutes INT DEFAULT 30
auto_cancel_food_minutes INT DEFAULT 60
auto_cancel_hotel_minutes INT DEFAULT 4320
auto_cancel_ticket_minutes INT DEFAULT 1440
deleted_at           DATETIME NULL
created_at           DATETIME DEFAULT CURRENT_TIMESTAMP
updated_at           DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
```

#### `services`
```sql
service_id       INT AUTO_INCREMENT PRIMARY KEY
location_id      INT NOT NULL  -- FK -> locations(location_id)
category_id      INT NULL
service_name     VARCHAR(255) NOT NULL
service_type     VARCHAR(50) NOT NULL  -- 'room','table','ticket','food','combo','other'
description      TEXT NULL
price            DECIMAL(12,2) NOT NULL DEFAULT 0.00
quantity         INT DEFAULT 0
unit             VARCHAR(50) NULL
status           VARCHAR(50) DEFAULT 'available'
images           JSON NULL
admin_status     VARCHAR(50) DEFAULT 'pending'
deleted_at       DATETIME NULL
created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
```

#### `bookings`
```sql
booking_id      INT AUTO_INCREMENT PRIMARY KEY
user_id         INT NOT NULL  -- FK -> users(user_id)
service_id      INT NOT NULL  -- FK -> services(service_id)
location_id     INT NOT NULL  -- FK -> locations(location_id)
check_in_date   DATETIME NOT NULL
check_out_date  DATETIME NULL
quantity        INT NOT NULL DEFAULT 1
total_amount    DECIMAL(12,2) NOT NULL DEFAULT 0
discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0
final_amount    DECIMAL(12,2) NOT NULL DEFAULT 0
voucher_code    VARCHAR(100) NULL
status          VARCHAR(50) NOT NULL DEFAULT 'pending'  -- 'pending','confirmed','cancelled','completed'
source          VARCHAR(20) NULL  -- 'web','mobile','admin'
contact_name    VARCHAR(100) NULL
contact_phone   VARCHAR(30) NULL
notes           TEXT NULL
pos_order_id    INT NULL  -- FK -> pos_orders(order_id)
cancelled_at    DATETIME NULL
cancelled_by    INT NULL
created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
```

#### `booking_tickets`
```sql
ticket_id    INT AUTO_INCREMENT PRIMARY KEY
booking_id   INT NOT NULL  -- FK -> bookings(booking_id)
service_id   INT NOT NULL  -- FK -> services(service_id)
ticket_code  VARCHAR(100) NOT NULL  -- Định dạng: SB-{bookingId}-{index}-{random6chars}
status       VARCHAR(50) DEFAULT 'unused'  -- 'unused','used','void'
issued_at    DATETIME NULL
used_at      DATETIME NULL
```

#### `payments`
```sql
payment_id             INT AUTO_INCREMENT PRIMARY KEY
user_id                INT NULL
location_id            INT NOT NULL
booking_id             INT NOT NULL  -- FK -> bookings(booking_id)
amount                 DECIMAL(12,2) NOT NULL
transaction_source     VARCHAR(50) NULL  -- 'online_booking','pos','admin'
commission_rate        DECIMAL(5,2) NULL
commission_amount      DECIMAL(12,2) NULL
vat_rate               DECIMAL(5,2) NULL
vat_amount             DECIMAL(12,2) NULL
owner_receivable       DECIMAL(12,2) NULL
payment_method         VARCHAR(50) NULL
transaction_code       VARCHAR(100) NULL
qr_data                JSON NULL
status                 VARCHAR(50) DEFAULT 'pending'  -- 'pending','completed','failed','refunded'
notes                  TEXT NULL
performed_by_user_id   INT NULL
performed_by_role      VARCHAR(50) NULL
performed_by_name      VARCHAR(200) NULL
payment_time           DATETIME NULL
created_at             DATETIME DEFAULT CURRENT_TIMESTAMP
```

#### `vouchers`
```sql
voucher_id              INT AUTO_INCREMENT PRIMARY KEY
owner_id                INT NOT NULL  -- FK -> users(user_id)
location_id             INT NULL  -- FK -> locations(location_id)
code                    VARCHAR(100) NOT NULL
campaign_name           VARCHAR(255) NULL
campaign_description    TEXT NULL
discount_type           ENUM('percent','amount') NOT NULL
discount_value          DECIMAL(12,2) NOT NULL
apply_to_service_type   ENUM('all','room','food','ticket','other') DEFAULT 'all'
apply_to_location_type  ENUM('all','hotel','restaurant','tourist','cafe','resort','other') DEFAULT 'all'
min_order_value         DECIMAL(12,2) DEFAULT 0
max_discount_amount     DECIMAL(12,2) NULL
usage_limit             INT DEFAULT 1
used_count              INT DEFAULT 0
max_uses_per_user       INT DEFAULT 1
target_group            VARCHAR(50) DEFAULT 'all'  -- 'all','loyal','new'
loyalty_min_spend       DECIMAL(12,2) NULL
status                  VARCHAR(50) DEFAULT 'active'  -- 'active','expired','disabled'
start_date              DATETIME NOT NULL
end_date              DATETIME NOT NULL
created_at              DATETIME DEFAULT CURRENT_TIMESTAMP
```

### 6.2 Bảng phụ trợ

#### `user_active_sessions`
```sql
user_id    INT PRIMARY KEY  -- FK -> users(user_id)
session_id VARCHAR(64) NOT NULL
created_at DATETIME DEFAULT CURRENT_TIMESTAMP
updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
```

#### `checkins`
```sql
checkin_id         INT AUTO_INCREMENT PRIMARY KEY
user_id            INT NOT NULL  -- FK -> users(user_id)
location_id        INT NOT NULL  -- FK -> locations(location_id)
checkin_latitude   DECIMAL(10,8) NULL
checkin_longitude  DECIMAL(11,8) NULL
notes              TEXT NULL
device_info        VARCHAR(500) NULL
image_url          VARCHAR(500) NULL
status             VARCHAR(50) DEFAULT 'verified'
checkin_time       DATETIME DEFAULT CURRENT_TIMESTAMP
```

#### `reviews`
```sql
review_id    INT AUTO_INCREMENT PRIMARY KEY
user_id      INT NOT NULL  -- FK -> users(user_id)
location_id  INT NOT NULL  -- FK -> locations(location_id)
rating       DECIMAL(3,1) NOT NULL
comment      TEXT NULL
images       JSON NULL
status       VARCHAR(50) DEFAULT 'active'  -- 'active','deleted'
deleted_at   DATETIME NULL
created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
```

#### `favorite_locations`
```sql
id          INT AUTO_INCREMENT PRIMARY KEY
user_id     INT NOT NULL  -- FK -> users(user_id)
location_id INT NOT NULL  -- FK -> locations(location_id)
note        TEXT NULL
tags        VARCHAR(500) NULL
added_at    DATETIME DEFAULT CURRENT_TIMESTAMP
UNIQUE KEY (user_id, location_id)
```

#### `user_diary`
```sql
diary_id    INT AUTO_INCREMENT PRIMARY KEY
user_id     INT NOT NULL  -- FK -> users(user_id)
location_id INT NULL  -- FK -> locations(location_id)
images      JSON NULL
mood        VARCHAR(50) DEFAULT 'happy'  -- 'happy','excited','neutral','sad','angry','tired'
notes       TEXT NULL
created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
```

#### `booking_table_reservations`
```sql
reservation_id       BIGINT AUTO_INCREMENT PRIMARY KEY
booking_id           INT NOT NULL  -- FK -> bookings(booking_id)
table_id             INT NOT NULL  -- FK -> pos_tables(table_id)
location_id          INT NOT NULL
start_time           DATETIME NOT NULL
end_time             DATETIME NOT NULL
status               ENUM('active','checked_in','cancelled','no_show','released') DEFAULT 'active'
checked_in_at        DATETIME NULL
actual_end_time      DATETIME NULL
cancelled_at         DATETIME NULL
created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP
updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
```

#### `hotel_rooms`
```sql
room_id       INT AUTO_INCREMENT PRIMARY KEY
location_id   INT NOT NULL
service_id    INT NOT NULL  -- UNIQUE(location_id, service_id)
area_id       INT NULL
floor_number  INT DEFAULT 0
room_number   VARCHAR(20) NULL
status        VARCHAR(50) DEFAULT 'vacant'  -- 'vacant','reserved','occupied'
```

#### `hotel_stays`
```sql
stay_id           INT AUTO_INCREMENT PRIMARY KEY
location_id       INT NOT NULL
room_id           INT NOT NULL  -- FK -> hotel_rooms(room_id)
user_id           INT NULL
booking_id        INT NULL  -- FK -> bookings(booking_id)
status            VARCHAR(50) DEFAULT 'reserved'  -- 'reserved','inhouse','checked_out','cancelled'
checkin_time      DATETIME NULL
checkout_time     DATETIME NULL
expected_checkin  DATETIME NOT NULL
expected_checkout DATETIME NOT NULL
subtotal_amount   DECIMAL(12,2) NULL
discount_amount   DECIMAL(12,2) NULL
final_amount      DECIMAL(12,2) NULL
notes             TEXT NULL
created_at        DATETIME DEFAULT CURRENT_TIMESTAMP
```

#### `otp_codes`
```sql
id          INT AUTO_INCREMENT PRIMARY KEY
email       VARCHAR(255) NOT NULL
otp_code    VARCHAR(10) NOT NULL
type        VARCHAR(50) NOT NULL  -- 'REGISTER','FORGOT_PASSWORD'
expires_at  DATETIME NOT NULL
is_used     TINYINT DEFAULT 0
created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
```

#### `login_attempts`
```sql
email         VARCHAR(255) PRIMARY KEY
attempts      INT NOT NULL DEFAULT 0
locked_until  DATETIME NULL
updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
```

#### `account_blacklist`
```sql
blacklist_id   BIGINT AUTO_INCREMENT PRIMARY KEY
user_id        INT NULL  -- FK -> users(user_id)
email          VARCHAR(255) NULL UNIQUE
phone          VARCHAR(30) NULL UNIQUE
reason         VARCHAR(255) NULL
created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
```

### 6.3 Bảng POS

#### `pos_tables`
```sql
table_id    INT AUTO_INCREMENT PRIMARY KEY
location_id INT NOT NULL
table_name  VARCHAR(100) NULL
status      VARCHAR(50) DEFAULT 'free'  -- 'free','reserved','occupied'
```

#### `pos_orders`
```sql
order_id         INT AUTO_INCREMENT PRIMARY KEY
location_id      INT NOT NULL
table_id         INT NULL
status           VARCHAR(50) DEFAULT 'open'  -- 'open','closed','cancelled'
order_source     VARCHAR(50) NULL  -- 'online_booking','pos','admin'
subtotal_amount  DECIMAL(12,2) DEFAULT 0
discount_amount  DECIMAL(12,2) DEFAULT 0
final_amount     DECIMAL(12,2) DEFAULT 0
created_by       INT NULL
created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
```

#### `pos_order_items`
```sql
order_id    INT NOT NULL  -- FK -> pos_orders(order_id)
service_id  INT NOT NULL  -- FK -> services(service_id)
quantity    INT NOT NULL
unit_price  DECIMAL(12,2) NOT NULL
line_total  DECIMAL(12,2) NOT NULL
```

### 6.4 Bảng thông báo

#### `push_notifications`
```sql
notification_id   INT AUTO_INCREMENT PRIMARY KEY
title             VARCHAR(255) NOT NULL
body              TEXT NOT NULL
target_audience   VARCHAR(50) NOT NULL  -- 'all_users','all_owners','specific_user'
target_user_id    INT NULL
target_path       VARCHAR(500) NULL
sent_by           INT NULL
created_at        DATETIME DEFAULT CURRENT_TIMESTAMP
```

#### `user_notification_reads`
```sql
notification_id INT NOT NULL  -- FK -> push_notifications(notification_id)
user_id         INT NOT NULL  -- FK -> users(user_id)
read_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
PK (notification_id, user_id)
```

#### `user_notification_dismissed`
```sql
notification_id INT NOT NULL  -- FK -> push_notifications(notification_id)
user_id         INT NOT NULL  -- FK -> users(user_id)
dismissed_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
PK (notification_id, user_id)
```

### 6.5 Bảng hệ thống

#### `system_settings`
```sql
setting_key       VARCHAR(100) PRIMARY KEY
setting_value     TEXT NULL
setting_value_file VARCHAR(500) NULL
```

Các key đã biết: `login_background_url`, `app_background_url`, `default_commission_rate`, `vat_rate`

#### `background_schedules`
```sql
schedule_id          INT AUTO_INCREMENT PRIMARY KEY
title                VARCHAR(255) NULL
image_url            VARCHAR(500) NULL
image_path           VARCHAR(500) NULL
is_active            TINYINT DEFAULT 0
applied_to_setting   VARCHAR(100) NOT NULL  -- 'login_background','app_background'
start_date           DATETIME NOT NULL
end_date             DATETIME NOT NULL
updated_at           DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
```

---

## Phụ lục A: Tổng hợp Ràng buộc Nghiệp vụ

| Ràng buộc | Giá trị | File nguồn |
|-----------|---------|------------|
| Độ dài tối thiểu mật khẩu | 6 ký tự | authController.ts |
| Thời hạn OTP | 5 phút | authController.ts |
| Khóa brute-force đăng nhập | 5 lần thất bại → khóa 5 phút | authController.ts |
| Thời hạn access token | 7 ngày | authController.ts |
| Thời hạn refresh token | 30 ngày | authController.ts |
| Phiên đơn mỗi user | Có | session.ts |
| Yêu cầu SĐT check-in | Có (`^0\d{9}$`) | userController.ts |
| Địa lý Việt Nam | vĩ độ 8-23.5, kinh độ 102-110.5 | userController.ts |
| Bán kính địa điểm gần | 80 mét | userController.ts |
| Khoảng cách tối đa | 500 mét | userController.ts |
| Khoảng cách tối thiểu giữa các check-in | 30 giây | userController.ts |
| Tối đa check-in mỗi giờ | 20 | userController.ts |
| Tối đa check-in mỗi ngày | 100 | userController.ts |
| Khoảng cách tối thiểu cùng địa điểm | 2 phút | userController.ts |
| Tối đa địa điểm tự tạo/ngày | 20 | userController.ts |
| Giờ check-in ban đêm | 22:00 - 05:00 | userController.ts |
| Phạm vi xếp hạng đánh giá | 1-5, bước 0.5 | userController.ts |
| Tối đa vé mỗi giao dịch | 50 | bookingService.ts |
| Tối đa phòng mỗi batch | 20 | bookingService.ts |
| Giới hạn đặt trước | 3 ngày | bookingService.ts |
| Thời gian giữ bàn | 120 phút | tableReservations.ts |
| Cửa sổ chủ chấp nhận | 60 phút trước | tableReservations.ts |
| Cửa sổ hủy phòng | 24 giờ trước check-in | bookingService.ts |
| Cửa sổ hủy bàn | Trước cửa sổ chủ (60 phút trước) | bookingService.ts |
| Chặn hủy bàn nếu đã thanh toán | Có | bookingService.ts |
| Tỷ lệ hoa hồng mặc định | 2.5% | bookingPaymentService.ts |
| Tỷ lệ VAT mặc định | 10% | bookingPaymentService.ts |
| Tự hủy đặt bàn ăn | 60 phút sau check-in | server.ts |
| Tự hủy đặt phòng | 60 phút sau check-in | server.ts |
| Tự hủy vé | 1440 phút (1 ngày) sau check-in | server.ts |
| Tự xác nhận đã thanh toán | 30 phút sau thanh toán | server.ts |
| Nhắc nhở đặt chỗ | 6h trước check-in, 3h trước checkout | server.ts |
| Định dạng tên | Chữ cái tiếng Việt + khoảng trắng | bookingService.ts |
| Định dạng SĐT | `^0\d{9}$` | bookingService.ts |

---

## Phụ lục B: Deep Link OAuth Mobile

**Google OAuth redirect:** `travelcheckin://auth/callback`
**Facebook OAuth redirect:** `travelcheckin://auth/callback`

Luồng mobile:
1. `GET /api/auth/google/mobile` → chuyển hướng đến Google consent screen
2. Google chuyển hướng đến `/api/auth/google/callback`
3. Backend đổi code, lấy userinfo, tạo/liên kết user
4. Chuyển hướng đến `travelcheckin://auth/callback?accessToken=...&refreshToken=...`

Với workaround Chrome Android: backend render trang HTML với nút deep-link đến app mobile (không thể xử lý redirect scheme `exp://` trực tiếp).

---

## Phụ lục C: Topic FCM Push Notification

- `user_{userId}` — thông báo riêng user
- `all_users` — phát sóng tất cả user
- `owner_{ownerId}` — thông báo riêng owner
- `all_owners` — phát sóng tất cả owner

Đăng ký qua `POST /api/push/device-tokens` với `{token, deviceId, platform}`.

---

## Phụ lục D: Sự kiện Realtime (SSE)

| Sự kiện | Mô tả |
|---------|-------|
| `session_revoked` | Phiên bị thay thế bởi đăng nhập mới |
| `booking_expired` | Đặt chỗ tự động hủy |
| `booking_checked_in` | Đặt chỗ đã check-in bởi nhân viên |
| `booking_cancelled` | Đặt chỗ đã hủy |
| `pos_updated` | Đơn POS/bàn thay đổi |
| `tourist_updated` | Dịch vụ du lịch cập nhật |
| `hotel_updated` | Phòng/lưu trú khách sạn cập nhật |

---

*Tạo từ phân tích codebase ngày 2026-06-04. Tất cả đường dẫn file, tên hàm, trạng thái biến và mẫu endpoint được trích xuất từ mã nguồn thực tế.*
