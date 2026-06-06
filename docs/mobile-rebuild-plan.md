# 📱 KẾ HOẠCH REBUILD MOBILE APP — TravelCheckinApp

> **Ngày tạo:** 2026-06-05
> **Trạng thái:** Đã duyệt — Bắt đầu triển khai
> **Người duyệt:** Mai Nhut Minh

---

## MỤC LỤC

1. [Tổng quan dự án](#1-tổng-quan-dự-án)
2. [Quyết định đã chốt](#2-quyết-đã-chốt)
3. [Cấu trúc thư mục](#3-cấu-trúc-thư-mục)
4. [Danh sách màn hình & chức năng chi tiết](#4-danh-sách-màn-hình--chức-năng-chi-tiết)
5. [UI/UX Design](#5-uiux-design)
6. [Technical Specs](#6-technical-specs)
7. [Database Changes](#7-database-changes)
8. [Tiến độ triển khai](#8-tiến-độ-triển-khai)

---

## 1. Tổng quan dự án

### Mục tiêu
Rebuild toàn bộ phân hệ Mobile (Tourist/User) bằng React Native + Expo SDK 54. Mobile kế thừa 100% trải nghiệm cốt lõi của Website (48 chức năng).

### Tech Stack
| Layer | Technology |
|-------|-----------|
| Framework | React Native + Expo SDK 54 |
| Navigation | Expo Router (file-based routing) |
| State Management | Zustand |
| HTTP Client | Axios (baseURL từ `.env`) |
| Maps | react-native-maps + OSM tile overlay (KHÔNG dùng Google Maps) |
| QR Code | react-native-qrcode-svg |
| Auth | JWT Bearer Token (standard) |

### Backend
- **KHÔNG sửa backend** — 87 endpoints hiện tại đủ dùng
- Backend chỉ phân biệt `admin` vs `user`, KHÔNG phân biệt web vs mobile
- CORS mở rộng, JWT auth chuẩn

### Đồng bộ Website ↔ Mobile
- Cả 2 gọi cùng 1 backend API → cùng 1 database
- Dữ liệu luôn đồng bộ 100%, không cần code thêm sync logic

---

## 2. Quyết định đã chốt

### ✅ Đã đồng ý

| Quyết định | Chi tiết |
|-----------|---------|
| **Theme màu** | Primary `#2563EB` (xanh dương), Accent `#F59E0B` (cam), Background `#F8FAFC`, Text `#1E293B` |
| **Font** | System default — mỗi điện thoại hiển thị font của nó (Android: Roboto, iOS: SF Pro) |
| **Bản đồ** | OSM tiles, KHÔNG Google Maps. Dùng `react-native-maps` + `UrlTile` |
| **Home sorting** | Mặc định theo GPS (gần nhất), có tùy chọn chuyển sang "Đánh giá cao" / "Phổ biến" |
| **Map markers** | Ảnh tròn (circular image markers) |
| **Booking flow** | QR + nút "Xác nhận đã chuyển" + nút "Sao chép thông tin" |
| **Single-session** | Giữ nguyên — 1 device duy nhất, đăng nhập nơi khác bị踢 ra |
| **Chat realtime + AI Chat** | KHÔNG làm trên mobile — website đang làm |
| **Phase 2 (bỏ)** | Không làm: Chat realtime, Login history, CSV export, Facebook OAuth |
| **Git** | KHÔNG tự ý push/commit — chờ phê duyệt |

### ❌ Không làm trên mobile (48 chức năng thay vì 54)

| Chức năng bỏ | Lý do |
|-------------|-------|
| AI Chat | Website đang xây dựng |
| Chat realtime với owner | Website đang xây dựng |
| Lịch sử đăng nhập | Ít cần trên mobile |
| Xuất CSV | Ít cần trên mobile |
| Facebook OAuth | Backend đã hỗ trợ nhưng không cần mobile |
| VisitedMap | Đã deprecated |

---

## 3. Cấu trúc thư mục

```
mobile/
├── .env                              # GIỮ NGUYÊN (API URL, OAuth keys)
├── app/                              # Expo Router pages
│   ├── _layout.tsx                   # Root layout (Auth ↔ Tab split)
│   ├── +not-found.tsx                # 404 page
│   ├── login.tsx                     # Đăng nhập
│   ├── register.tsx                  # Đăng ký + OTP
│   ├── forgot-password.tsx           # Quên mật khẩu + OTP
│   ├── (tabs)/                       # Bottom Tab group
│   │   ├── _layout.tsx               # Tab navigator (5 tabs)
│   │   ├── index.tsx                 # Tab 1: Home/Dashboard
│   │   ├── map.tsx                   # Tab 2: Bản đồ OSM
│   │   ├── tickets.tsx               # Tab 3: Vé & Đặt chỗ
│   │   ├── profile.tsx               # Tab 4: Hồ sơ
│   │   └── history.tsx               # Tab 5: Lịch sử check-in
│   ├── booking/
│   │   └── [serviceId].tsx           # Đặt chỗ (Ticket/Table/Room)
│   ├── location/
│   │   └── [id].tsx                  # Chi tiết địa điểm
│   └── sos/
│       ├── _layout.tsx
│       └── index.tsx                 # SOS khẩn cấp
├── api/
│   ├── axiosClient.ts                # Axios instance + token refresh
│   └── endpoints.ts                  # API endpoint mapping
├── components/                       # Shared UI components
│   ├── Button.tsx
│   ├── Card.tsx
│   ├── Input.tsx
│   ├── Header.tsx
│   ├── Avatar.tsx
│   ├── Badge.tsx
│   ├── EmptyState.tsx
│   ├── LoadingOverlay.tsx
│   ├── RatingStars.tsx
│   └── SegmentedControl.tsx
├── store/
│   └── useAuthStore.ts               # Zustand auth state
├── constants/
│   └── theme.ts                      # Colors, spacing, typography
├── types/
│   └── index.ts                      # TypeScript interfaces
├── hooks/                            # Custom hooks
├── utils/                            # Helper functions
└── assets/
    ├── images/
    └── fonts/
```

---

## 4. Danh sách màn hình & chức năng chi tiết

### 4.1 AUTH SCREENS

#### 4.1.1 Login Screen (`app/login.tsx`)
| # | Chức năng | Chi tiết |
|---|----------|---------|
| 1 | Form đăng nhập | Email + Password, KeyboardAvoidingView |
| 2 | Nút đăng nhập | Gọi `POST /api/auth/login`, lưu token vào Zustand + AsyncStorage |
| 3 | Google OAuth | Mở `expo-web-browser` → `GET /api/auth/google/mobile` → deep link callback |
| 4 | Link "Quên mật khẩu" | Navigate → forgot-password.tsx |
| 5 | Link "Đăng ký" | Navigate → register.tsx |
| 6 | Hiển thị lỗi | Thông báo lỗi từ API (sai mật khẩu, tài khoản bị khóa, etc.) |

**UI:**
```
┌─────────────────────────────────┐
│         🏖️ Travel Check-in      │
│                                 │
│  📧 Email                       │
│  ┌─────────────────────────┐   │
│  │                         │   │
│  └─────────────────────────┘   │
│                                 │
│  🔒 Mật khẩu                   │
│  ┌─────────────────────────┐   │
│  │                    👁️   │   │  ← Hiện/ẩn mật khẩu
│  └─────────────────────────┘   │
│                                 │
│  [        Đăng nhập        ]   │  ← Nút PRIMARY (cam)
│                                 │
│  ─── Hoặc ───                  │
│                                 │
│  [🔵 Đăng nhập bằng Google]    │  ← Nút Google OAuth
│                                 │
│  Quên mật khẩu? | Đăng ký      │  ← Links
└─────────────────────────────────┘
```

#### 4.1.2 Register Screen (`app/register.tsx`)
| # | Chức năng | Chi tiết |
|---|----------|---------|
| 1 | Form đăng ký | Họ tên + Email/SĐT + Mật khẩu + Nhập lại MK |
| 2 | Gửi OTP | `POST /api/auth/register` → chuyển sang bước nhập OTP |
| 3 | Nhập OTP | 6 ô nhập OTP, `POST /api/auth/verify-otp` |
| 4 | Thành công | Chuyển về Login |

**UI:**
```
┌─────────────────────────────────┐
│  ← Đăng ký tài khoản            │
├─────────────────────────────────┤
│  Bước 1/2: Thông tin            │
│                                 │
│  👤 Họ tên                      │
│  ┌─────────────────────────┐   │
│  └─────────────────────────┘   │
│  📧 Email                       │
│  ┌─────────────────────────┐   │
│  └─────────────────────────┘   │
│  📞 Số điện thoại               │
│  ┌─────────────────────────┐   │
│  └─────────────────────────┘   │
│  🔒 Mật khẩu (≥6 ký tự)        │
│  ┌─────────────────────────┐   │
│  └─────────────────────────┘   │
│  🔒 Nhập lại mật khẩu          │
│  ┌─────────────────────────┐   │
│  └─────────────────────────┘   │
│                                 │
│  [      Tiếp theo (Gửi OTP) ]  │
└─────────────────────────────────┘

→ Chuyển sang Bước 2/2: Xác nhận OTP
┌─────────────────────────────────┐
│  Nhập mã OTP đã gửi về email    │
│                                 │
│  [□] [□] [□] [□] [□] [□]      │  ← 6 ô OTP
│                                 │
│  [       Xác nhận         ]     │
│  Gửi lại OTP (59s)              │
└─────────────────────────────────┘
```

#### 4.1.3 Forgot Password Screen (`app/forgot-password.tsx`)
| # | Chức năng | Chi tiết |
|---|----------|---------|
| 1 | Nhập Email + SĐT | `POST /api/auth/forgot-password` |
| 2 | Xác nhận OTP | `POST /api/auth/verify-reset-otp` |
| 3 | Đặt mật khẩu mới | `POST /api/auth/reset-password` |

---

### 4.2 HOME SCREEN (`app/(tabs)/index.tsx`)

| # | Chức năng | Chi tiết | API |
|---|----------|---------|-----|
| 1 | Lời chào | "Xin chào, {tên}!" theo thời gian | — |
| 2 | Thời tiết GPS | Nhiệt độ + trạng thái + tên thành phố | Open-Meteo API + `GET /api/geo/reverse` |
| 3 | Quick actions | 5 nút: Map, Check-in, Lưu, Vé, SOS | — |
| 4 | Tìm kiếm | Debounced search, realtime kết quả | `GET /api/locations?keyword=` |
| 5 | Category filter | Chips: Tất cả, Khám phá, Ăn uống, Lưu trú | `GET /api/locations?type=` |
| 6 | Location cards | Grid 2-3 cột, vuốt ngang, ảnh + tên + rating + địa chỉ | `GET /api/locations` |
| 7 | Stats | Check-ins, Favorites, Vouchers count | `GET /api/user/checkins`, `/favorites`, `/vouchers/saved` |
| 8 | Gợi ý cá nhân | Locations gợi ý dựa trên lịch sử | `GET /api/user/recommendations/locations` |

**Sorting mặc định:** GPS gần nhất (tính khoảng cách client-side).

**UI:**
```
┌─────────────────────────────────┐
│  👋 Xin chào, Minh!        🔔  │  ← Header + nút thông báo
│  ☀️ 32°C · Cần Thơ            │  ← Thời tiết
├─────────────────────────────────┤
│  🔍 Tìm kiếm địa điểm...       │  ← Search bar
├─────────────────────────────────┤
│  [🗺️ Map] [📍 Check-in] [❤️ Lưu] │  ← Quick actions
│  [🎫 Vé]  [🆘 SOS]             │
├─────────────────────────────────┤
│  [Tất cả] [Khám phá] [Ăn uống]│  ← Category chips
│  [Lưu trú]                      │
├─────────────────────────────────┤
│  📊 Check-ins: 12  ❤️: 5  🎫: 3│  ← Stats bar
├─────────────────────────────────┤
│  ┌─────────┐ ┌─────────┐       │
│  │ 📷      │ │ 📷      │       │  ← Location cards (2-3 cột)
│  │ Bến Ninh│ │ Chợ nổi │       │     Nhấn → Location Detail
│  │ ⭐ 4.5  │ │ ⭐ 4.8  │       │
│  │ 📍 Cờ Đỏ│ │ 📍 Phong│       │
│  └─────────┘ └─────────┘       │
│  ┌─────────┐ ┌─────────┐       │
│  │ ...     │ │ ...     │       │
│  └─────────┘ └─────────┘       │
└─────────────────────────────────┘
```

---

### 4.3 MAP SCREEN (`app/(tabs)/map.tsx`)

| # | Chức năng | Chi tiết | API |
|---|----------|---------|-----|
| 1 | Bản đồ OSM | react-native-maps + UrlTile OSM, GPS tracking realtime | — |
| 2 | Markers ảnh tròn | Location markers với ảnh tròn + tên | `GET /api/locations` |
| 3 | Tìm kiếm | Search places, Nominatim fallback | `GET /api/geo/search`, `/api/geo/reverse` |
| 4 | Category filter | Chips nổi trên map: Tất cả, Ăn uống, Khám phá, Lưu trú | — |
| 5 | Bán kính slider | Kéo chọn bán kính 1-50km, lọc marker | — |
| 6 | Check-in tự do | Nhấn giữ trên map → tạo check-in tại điểm đó | `POST /api/user/checkins` |
| 7 | Lưu yêu thích | Nhấn ❤️ trên popup marker | `PATCH /api/user/favorites/:id` |
| 8 | Chỉ đường | Nhấn marker → nút "Chỉ đường" → mở Google Maps/Apple Maps app | `expo-linking` |
| 9 | Nút GPS | Nhấn → map di chuyển về vị trí hiện tại | — |
| 10 | Full-screen mode | Nhấn nút phóng to → map toàn màn hình | — |

**Thao tác bản đồ:**
- **Kéo 1 ngón** → di chuyển bản đồ
- **Pinch 2 ngón** → zoom in/out
- **Nhấn marker** → hiện popup tên + nút "Xem chi tiết" + nút "Chỉ đường"
- **Nhấn giữ** → tạo check-in tự do
- **Nhấn nút GPS** → quay về vị trí hiện tại

**UI:**
```
┌─────────────────────────────────┐
│  🔍 Tìm kiếm trên bản đồ...    │  ← Search bar nổi
├─────────────────────────────────┤
│                                 │
│    📍A        📍B               │  ← Markers (ảnh tròn + tên)
│         📍C                     │
│         📍Bạn (xanh lá, pulse) │  ← GPS dot
│                                 │
│  ┌──────────────────────┐       │
│  │ [Tất cả][Ăn uống]   │       │  ← Filter chips nổi
│  │ [Khám phá][Lưu trú]  │       │
│  └──────────────────────┘       │
│  ┌──────────────────────┐       │
│  │ Bán kính: ━━━●━━ 5km │       │  ← Radius slider nổi
│  └──────────────────────┘       │
├─────────────────────────────────┤
│  [📍 Vị trí tôi]  [⛶ Full]    │  ← Bottom buttons
└─────────────────────────────────┘

Popup khi nhấn marker:
┌──────────────────────┐
│  📷 Bến Ninh Kiều    │
│  ⭐ 4.5 · 📍 Cờ Đỏ  │
│  [Xem chi tiết]      │
│  [🧭 Chỉ đường]      │
│  [❤️ Lưu]            │
└──────────────────────┘
```

---

### 4.4 LOCATION DETAIL (`app/location/[id].tsx`)

| # | Chức năng | Chi tiết | API |
|---|----------|---------|-----|
| 1 | Ảnh bìa | Swipeable image gallery | — |
| 2 | Thông tin cơ bản | Tên, rating, địa chỉ, giờ mở cửa, SĐT, email, website | `GET /api/locations/:id` |
| 3 | Tab Tổng quan | Mô tả, thông tin liên hệ, thời tiết | `GET /api/locations/:id`, Open-Meteo |
| 4 | Tab Đánh giá | Danh sách review + filter theo sao | `GET /api/locations/:id/reviews` |
| 5 | Viết đánh giá | Star rating (1-5) + text + upload ảnh | `POST /api/user/reviews`, `POST /api/user/reviews/upload` |
| 6 | Tab Giới thiệu | Mô tả chi tiết + gallery ảnh | — |
| 7 | Voucher theo ĐD | Hiện voucher, nút "Lưu voucher" | `GET /api/user/vouchers/location/:id`, `POST /api/user/vouchers/:id/claim` |
| 8 | Lưu yêu thích | Nút ❤️ toggle | `PATCH/DELETE /api/user/favorites/:id` |
| 9 | Báo cáo sai | Form báo cáo | `POST /api/user/reports/location` |
| 10 | Đặt chỗ ngay | BIG button → Booking screen | Navigate |
| 11 | Chia sẻ | Share link địa điểm | `expo-sharing` |

**UI:**
```
┌─────────────────────────────────┐
│  ← Quay lại          [❤️] [↗️] │  ← Back + Favorite + Share
├─────────────────────────────────┤
│  ┌─────────────────────────┐   │
│  │     📷 ẢNH BÌA (swipe)  │   │
│  └─────────────────────────┘   │
│  Tên địa điểm                  │
│  ⭐ 4.5 (120 đánh giá)         │
│  📍 Địa chỉ chi tiết           │
│  🟢 Đang mở cửa · 8:00-22:00  │
├─────────────────────────────────┤
│  [Tổng quan] [Đánh giá] [Giới │  ← Tab bar
│   thiệu]                        │
├─────────────────────────────────┤
│  Mô tả ngắn gọn...            │
│  📞 0123 456 789               │
│  🌐 website.com                │
│                                 │
│  ┌─────────────────────────┐   │
│  │  🎫 Voucher: Giảm 20%   │   │
│  │  [Lưu voucher]           │   │
│  └─────────────────────────┘   │
│                                 │
│  ┌─────────────────────────┐   │
│  │  🌡️ Thời tiết: 32°C     │   │
│  └─────────────────────────┘   │
│                                 │
│  [🚨 Báo cáo sai thông tin]    │
├─────────────────────────────────┤
│  [📅 Đặt chỗ ngay]            │  ← BIG button (cam)
└─────────────────────────────────┘

Tab Đánh giá:
┌─────────────────────────────────┐
│  ⭐⭐⭐⭐⭐  (4.5 trung bình)    │
│  [5★] [4★] [3★] [2★] [1★]    │
├─────────────────────────────────┤
│  👤 Nguyễn A  ⭐⭐⭐⭐⭐         │
│  "Địa điểm rất đẹp..."         │
│  📷 [img1] [img2]              │
│                                 │
│  👤 Trần B  ⭐⭐⭐⭐             │
│  "Tốt nhưng hơi đông..."       │
├─────────────────────────────────┤
│  [✍️ Viết đánh giá]            │
└─────────────────────────────────┘
```

---

### 4.5 BOOKING SCREEN (`app/booking/[serviceId].tsx`)

#### 4.5.1 Ticket (Tourist)
| # | Chức năng | Chi tiết | API |
|---|----------|---------|-----|
| 1 | Chọn ngày | DatePicker | — |
| 2 | Chọn số lượng | [-] quantity [+] cho từng loại vé | — |
| 3 | Áp dụng voucher | Modal chọn voucher đã lưu | `GET /api/user/vouchers/saved` |
| 4 | Thanh toán | QR + thông tin chuyển khoản | `POST /api/bookings`, `POST /api/bookings/:id/payments` |
| 5 | Xác nhận đã chuyển | Gọi API confirm | `POST /api/bookings/:id/tickets/confirm-transfer` |

**UI:**
```
┌─────────────────────────────────┐
│  ← Đặt vé tham quan            │
├─────────────────────────────────┤
│  📷 Tên địa điểm               │
│  📍 Địa chỉ                     │
├─────────────────────────────────┤
│  Chọn ngày: [📅 05/06/2026]    │
│                                 │
│  ┌─────────────────────────┐   │
│  │ Vé người lớn  x 150,000 │   │
│  │ Số lượng: [−] 2 [+]     │   │
│  ├─────────────────────────┤   │
│  │ Vé trẻ em    x  80,000  │   │
│  │ Số lượng: [−] 1 [+]     │   │
│  └─────────────────────────┘   │
│                                 │
│  🎫 Voucher: [Chọn voucher ▼]  │
│                                 │
│  ───────────────────────────   │
│  Tạm tính:     380,000đ        │
│  Giảm giá:     -50,000đ        │
│  Tổng cộng:    330,000đ        │
│  ───────────────────────────   │
│                                 │
│  [Thanh toán VietQR]           │
└─────────────────────────────────┘

Sau khi bấm Thanh toán:
┌─────────────────────────────────┐
│  ← Thanh toán                   │
├─────────────────────────────────┤
│  ┌─────────────────────────┐   │
│  │      [QR CODE]          │   │  ← QR VietQR
│  │                         │   │
│  └─────────────────────────┘   │
│                                 │
│  🏦 Vietcombank                │
│  📋 STK: 1234567890            │
│  👤 Chủ TK: MAI NHUT MINH     │
│  💰 330,000đ                   │
│  📝 TC-BOOKING-100             │
│                                 │
│  [📋 Sao chép thông tin]       │  ← Copy STK + nội dung
│                                 │
│  [✅ Xác nhận đã chuyển khoản] │  ← Gọi API confirm
│                                 │
│  ℹ️ Quét QR hoặc chuyển khoản   │
│  với nội dung trên, sau đó     │
│  nhấn "Xác nhận"               │
└─────────────────────────────────┘
```

#### 4.5.2 Table (Restaurant)
| # | Chức năng | Chi tiết | API |
|---|----------|---------|-----|
| 1 | Chọn ngày + giờ | DatePicker + TimePicker | — |
| 2 | Sơ đồ bàn | Grid bàn theo khu vực, ■ occupied / □ free | `GET /api/locations/:id/pos/areas`, `/pos/tables` |
| 3 | Đặt trước đồ ăn | Menu items theo category, [-] qty [+] | `GET /api/locations/:id/services?type=food` |
| 4 | Tên liên hệ + SĐT | TextInput bắt buộc | — |
| 5 | Áp dụng voucher | Modal chọn voucher | `GET /api/user/vouchers/saved` |
| 6 | Thanh toán | QR + confirm | `POST /api/bookings`, `POST /api/bookings/:id/tables/confirm-transfer` |

**UI:**
```
┌─────────────────────────────────┐
│  ← Đặt bàn nhà hàng            │
├─────────────────────────────────┤
│  Chọn ngày: [📅 05/06/2026]    │
│  Chọn giờ:  [🕐 18:00]         │
├─────────────────────────────────┤
│  Sơ đồ bàn:                     │
│  ┌─────────────────────────┐   │
│  │  Khu A                  │   │
│  │  [■] [□] [■] [□]       │   │  ■=occupied □=free
│  │  [□] [■] [□] [□]       │   │  Nhấn □ → chọn
│  │                          │   │
│  │  Khu B                  │   │
│  │  [□] [□] [■]           │   │
│  └─────────────────────────┘   │
│  Đã chọn: Bàn A2, Bàn A4      │
├─────────────────────────────────┤
│  Đặt trước đồ ăn:              │
│  [🍜 Phở bò]    [−] 1 [+]     │
│  [☕ Cà phê sữa] [−] 2 [+]    │
├─────────────────────────────────┤
│  👤 Tên liên hệ: [........]    │
│  📞 SĐT:         [........]    │
│  🎫 Voucher: [Chọn voucher ▼]  │
│  ───────────────────────────   │
│  Tổng: 250,000đ                 │
│  [Thanh toán VietQR]           │
└─────────────────────────────────┘
```

#### 4.5.3 Room (Hotel)
| # | Chức năng | Chi tiết | API |
|---|----------|---------|-----|
| 1 | Chọn ngày nhận/trả | DateRangePicker | — |
| 2 | Chọn phòng | Room cards, [-] qty [+] cho từng loại | `GET /api/locations/:id/services?type=room` |
| 3 | Tên liên hệ + SĐT | TextInput bắt buộc | — |
| 4 | Áp dụng voucher | Modal chọn voucher | `GET /api/user/vouchers/saved` |
| 5 | Thanh toán batch | QR + confirm | `POST /api/bookings/batch`, `POST /api/bookings/batch/rooms/confirm-transfer` |

**UI:**
```
┌─────────────────────────────────┐
│  ← Đặt phòng khách sạn         │
├─────────────────────────────────┤
│  Nhận phòng: [📅 05/06/2026]   │
│  Trả phòng:  [📅 07/06/2026]   │
│  Thời gian:  2 đêm             │
├─────────────────────────────────┤
│  Chọn phòng:                    │
│  ┌─────────────────────────┐   │
│  │ 🛏️ Phòng Deluxe         │   │
│  │ 1,200,000đ/đêm          │   │
│  │ Còn 3 phòng              │   │
│  │ Số lượng: [−] 1 [+]     │   │
│  ├─────────────────────────┤   │
│  │ 🛏️ Phòng Standard       │   │
│  │ 800,000đ/đêm            │   │
│  │ Còn 5 phòng              │   │
│  │ Số lượng: [−] 0 [+]     │   │
│  └─────────────────────────┘   │
├─────────────────────────────────┤
│  👤 Tên liên hệ: [........]    │
│  📞 SĐT:         [........]    │
│  🎫 Voucher: [Chọn voucher ▼]  │
│  ───────────────────────────   │
│  Tổng: 2,400,000đ              │
│  [Thanh toán VietQR]           │
└─────────────────────────────────┘
```

---

### 4.6 TICKETS SCREEN (`app/(tabs)/tickets.tsx`)

| # | Chức năng | Chi tiết | API |
|---|----------|---------|-----|
| 1 | Tab Tour | Vé du lịch đã mua + QR code | `GET /api/user/tickets` |
| 2 | Tab Bàn | Pass đặt bàn nhà hàng + QR | `GET /api/bookings/table-reservations/pass` |
| 3 | Tab Phòng | Pass đặt phòng khách sạn + QR | `GET /api/bookings/room-reservations/pass` |
| 4 | Trạng thái | 🟢 unused (QR rõ) / 🔴 used (QR mờ) / ⚪ expired | — |
| 5 | Hủy đặt chỗ | Nút hủy + xác nhận | `POST /api/bookings/:id/cancel` |

**UI:**
```
┌─────────────────────────────────┐
│  Vé & Đặt chỗ                   │
├─────────────────────────────────┤
│  [🎫 Tour] [🍽️ Bàn] [🏨 Phòng] │  ← Tab switcher
├─────────────────────────────────┤
│  ┌─────────────────────────┐   │
│  │  📷 Bến Ninh Kiều       │   │
│  │  Vé người lớn x2        │   │
│  │  Ngày: 05/06/2026       │   │
│  │  ┌───────────────┐      │   │
│  │  │   [QR CODE]   │      │   │
│  │  │   TC-ABC123   │      │   │
│  │  └───────────────┘      │   │
│  │  🟢 Chưa sử dụng        │   │
│  └─────────────────────────┘   │
└─────────────────────────────────┘
```

---

### 4.7 PROFILE SCREEN (`app/(tabs)/profile.tsx`)

| # | Chức năng | Chi tiết | API |
|---|----------|---------|-----|
| 1 | Ảnh bìa + Avatar | Hiển thị + nhấn để đổi | `POST /api/user/profile/avatar`, `/background` |
| 2 | Stats | Check-ins, Orders, Spending, Tier | `GET /api/user/profile` |
| 3 | Chỉnh sửa hồ sơ | Họ tên, SĐT, Địa chỉ | `PUT /api/user/profile` |
| 4 | Đổi avatar | Image picker → upload | `POST /api/user/profile/avatar` |
| 5 | Đổi ảnh bìa | Image picker → upload | `POST /api/user/profile/background` |
| 6 | Đăng xuất | Xóa token, chuyển về Login | `POST /api/auth/logout` |

**UI:**
```
┌─────────────────────────────────┐
│  ┌─────────────────────────┐   │
│  │    📷 ẢNH BÌA           │   │
│  │      [👤 Avatar]         │   │
│  │      Nguyễn Văn A        │   │
│  │      ⭐ Thành viên Bạc   │   │
│  └─────────────────────────┘   │
├─────────────────────────────────┤
│  📊 Thống kê                    │
│  ┌────┐ ┌────┐ ┌────┐         │
│  │ 12 │ │  5 │ │  3 │         │
│  │Check│ │Lưu │ │Voucher│      │
│  └────┘ └────┘ └────┘         │
├─────────────────────────────────┤
│  ✏️ Chỉnh sửa hồ sơ             │
│  👤 Họ tên: [Nguyễn Văn A  ]  │
│  📞 SĐT:    [0123 456 789  ]  │
│  📍 Địa chỉ:[Cần Thơ       ]  │
│  📧 Email:  minh@gmail.com     │  ← Read-only
│  [Lưu thay đổi]                │
├─────────────────────────────────┤
│  📷 Đổi ảnh đại diện           │
│  🖼️ Đổi ảnh bìa               │
│                                 │
│  [🚪 Đăng xuất]                │
└─────────────────────────────────┘
```

---

### 4.8 HISTORY SCREEN (`app/(tabs)/history.tsx`)

| # | Chức năng | Chi tiết | API |
|---|----------|---------|-----|
| 1 | Map thu nhỏ | Bản đồ OSM với polyline nối các điểm check-in | `GET /api/user/checkins` |
| 2 | Timeline | Danh sách check-in theo thời gian, grouped theo location | — |
| 3 | Trạng thái | 🟢 verified / 🟡 pending / 🔴 failed | — |
| 4 | Nhấn → Xem chi tiết | Navigate đến Location Detail | — |

**UI:**
```
┌─────────────────────────────────┐
│  Lịch sử check-in               │
├─────────────────────────────────┤
│  ┌─────────────────────────┐   │
│  │     🗺️ BẢN ĐỒ           │   │  ← Map thu nhỏ + polyline
│  └─────────────────────────┘   │
├─────────────────────────────────┤
│  📍 Bến Ninh Kiều               │
│  05/06/2026 · 14:30             │
│  🟢 Đã xác nhận                 │
│                                 │
│  📍 Chợ Nổi Cái Răng           │
│  04/06/2026 · 09:15             │
│  🟢 Đã xác nhận                 │
│                                 │
│  📍 Vườn Cò Bằng Lăng          │
│  03/06/2026 · 16:00             │
│  🟡 Chờ xác nhận                │
└─────────────────────────────────┘
```

---

### 4.9 SECONDARY SCREENS

#### 4.9.1 Notifications (`app/notifications.tsx`)
| # | Chức năng | API |
|---|----------|-----|
| 1 | Danh sách thông báo (max 20) | `GET /api/user/notifications` |
| 2 | Đánh dấu đã đọc tất cả | `POST /api/user/notifications/read-all` |
| 3 | Xóa tất cả | `POST /api/user/notifications/delete-all` |

#### 4.9.2 Saved Locations (`app/saved-locations.tsx`)
| # | Chức năng | API |
|---|----------|-----|
| 1 | Grid địa điểm đã lưu | `GET /api/user/favorites` |
| 2 | Bỏ lưu | `DELETE /api/user/favorites/:id` |
| 3 | Nhấn → Location Detail | Navigate |

#### 4.9.3 Vouchers (`app/vouchers.tsx`)
| # | Chức năng | API |
|---|----------|-----|
| 1 | Danh sách voucher đã lưu | `GET /api/user/vouchers/saved` |
| 2 | Filter: Tất cả / Còn hạn / Hết hạn | Client-side filter |
| 3 | Thông tin: giảm giá, ngày hết hạn, địa điểm áp dụng | — |

#### 4.9.4 Booking Reminders (`app/booking-reminders.tsx`)
| # | Chức năng | API |
|---|----------|-----|
| 1 | Danh sách nhắc nhở đặt chỗ | `GET /api/user/booking-reminders` |
| 2 | Filter: Tất cả / Sắp tới / Đã xong / Đã hủy | Client-side filter |
| 3 | Thông tin: địa điểm, ngày, trạng thái | — |

#### 4.9.5 Leaderboard (`app/leaderboard.tsx`)
| # | Chức năng | API |
|---|----------|-----|
| 1 | Bảng xếp hạng check-in tháng | `GET /api/user/leaderboard` |
| 2 | Top 50 users | — |
| 3 | Avatar + tên + số check-in | — |

#### 4.9.6 Diary (`app/diary.tsx`)
| # | Chức năng | API |
|---|----------|-----|
| 1 | Danh sách nhật ký | `GET /api/user/diary` |
| 2 | Tạo/sửa nhật ký (mood + notes + ảnh) | `POST /api/user/diary` |
| 3 | Xóa nhật ký | `DELETE /api/user/diary/:id` |
| 4 | Mood selector: 😊 😃 😐 😢 😡 😴 | — |

#### 4.9.7 SOS (`app/sos/index.tsx`)
| # | Chức năng | API |
|---|----------|-----|
| 1 | Nút SOS lớn (nhấn giữ 3 giây) | `POST /api/sos` |
| 2 | Ping GPS mỗi 20 giây | `POST /api/sos/ping` |
| 3 | Nút dừng SOS | `POST /api/sos/stop` |
| 4 | Hiển thị vị trí GPS + thời gian ping cuối | — |

**UI:**
```
┌─────────────────────────────────┐
│         KHẨN CẤP                │
├─────────────────────────────────┤
│                                 │
│      ┌───────────────┐         │
│      │               │         │
│      │    🆘 SOS     │         │  ← BIG pulsing red button
│      │               │         │     Nhấn giữ 3 giây
│      └───────────────┘         │
│                                 │
│  📍 Vị trí: Cần Thơ, VN       │
│  🟢 Đang theo dõi...           │
│  ⏱️ Ping cuối: 14:30:25        │
│                                 │
│      [⏹️ Dừng SOS]             │
└─────────────────────────────────┘
```

---

### 4.10 SHARED COMPONENTS

| Component | Mô tả | Props |
|-----------|-------|-------|
| `Button` | Nút bấm với variants: primary, secondary, outline, danger | `title, onPress, variant, loading, disabled` |
| `Card` | Container bo góc + shadow | `children, style` |
| `Input` | TextInput với label, error, icon | `label, value, onChangeText, error, icon, secureTextEntry` |
| `Header` | Top bar với back button + title + actions | `title, onBack, rightAction` |
| `Avatar` | Ảnh tròn + fallback initials | `url, name, size` |
| `Badge` | Status indicator (dot + text) | `text, color` |
| `EmptyState` | Illustration + message khi list rỗng | `icon, title, description` |
| `LoadingOverlay` | Spinner toàn màn hình | `visible` |
| `RatingStars` | Hiển thị / nhập star rating | `rating, onRate, size, interactive` |
| `SegmentedControl` | Tab switcher ngang | `options, selectedIndex, onChange` |

---

## 5. UI/UX Design

### Theme Colors
```typescript
const colors = {
  primary: '#2563EB',      // Xanh dương — tin cậy
  primaryLight: '#3B82F6', // Xanh dương nhạt
  accent: '#F59E0B',       // Cam vàng — CTA buttons
  background: '#F8FAFC',   // Xám rất nhạt
  card: '#FFFFFF',         // Card background
  text: '#1E293B',         // Text chính
  textSecondary: '#64748B', // Text phụ
  border: '#E2E8F0',       // Border
  error: '#EF4444',        // Đỏ — lỗi
  success: '#10B981',      // Xanh lá — thành công
  warning: '#F59E0B',      // Vàng — cảnh báo
};
```

### Font
- **KHÔNG cài font riêng**
- Dùng System default: Android (Roboto), iOS (SF Pro)
- `fontFamily: 'System'` (Expo default)

### Nút bấm
- **Primary:** Nền cam `#F59E0B`, text trắng, bo góc 12px
- **Secondary:** Nền xanh dương `#2563EB`, text trắng
- **Outline:** Nền trong, border xanh dương, text xanh dương
- **Danger:** Nền đỏ `#EF4444`, text trắng
- **Touch feedback:** `TouchableOpacity` với `activeOpacity: 0.7`

### Keyboard
- Bọc mọi form bằng `KeyboardAvoidingView`
- `behavior="padding"` trên iOS, `behavior="height"` trên Android

### Safe Area
- Dùng `SafeAreaView` ở root layout
- Chấp nhận lẹm nhẹ notch cho layout phức tạp

---

## 6. Technical Specs

### API Client
```typescript
// api/axiosClient.ts
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const axiosClient = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL, // từ .env
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor: attach token
axiosClient.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor: refresh on 401
axiosClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401) {
      // Try refresh token
      const refreshToken = await AsyncStorage.getItem('refreshToken');
      if (refreshToken) {
        const { data } = await axios.post(
          `${process.env.EXPO_PUBLIC_API_URL}/auth/refresh-token`,
          { refreshToken }
        );
        await AsyncStorage.setItem('accessToken', data.data.accessToken);
        error.config.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return axiosClient(error.config);
      }
    }
    return Promise.reject(error);
  }
);
```

### Auth Store (Zustand)
```typescript
// store/useAuthStore.ts
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loadSession: () => Promise<void>;
}
```

### Map Config
```typescript
// OSM tiles, KHÔNG Google Maps
<MapView
  provider={null}        // Không dùng Google
  mapType="none"         // Chỉ dùng custom tiles
  showsUserLocation={true}
  showsMyLocationButton={true}
>
  <UrlTile
    urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
    maximumZ={19}
  />
</MapView>
```

### QR Code (VietQR)
```typescript
// Tạo QR image URL từ VietQR API
const buildVietQrImageUrl = (opts: {
  bankName: string;
  bankAccount: string;
  accountHolder: string;
  amount: number;
  addInfo: string;
}) => {
  const BIN = BANK_BIN_MAP[opts.bankName.toLowerCase()];
  return `https://img.vietqr.io/image/${BIN}-${opts.bankAccount}-compact2.png?addInfo=${encodeURIComponent(opts.addInfo)}&amount=${opts.amount}&accountName=${encodeURIComponent(opts.accountHolder)}`;
};
```

---

## 7. Database Changes

### Đã thực hiện (2026-06-05)

| # | Bảng | FK thêm | Tham chiếu | ON DELETE |
|---|------|---------|------------|-----------|
| 1 | `location_chat_messages` | `location_id` | → `locations.location_id` | CASCADE |
| 2 | `location_chat_messages` | `sender_id` | → `users.user_id` | CASCADE |
| 3 | `user_active_sessions` | `user_id` | → `users.user_id` | CASCADE |
| 4 | `user_diary` | `checkin_id` | → `checkins.checkin_id` | SET NULL |
| 5 | `booking_preorder_items` | `booking_id` | → `bookings.booking_id` | CASCADE |
| 6 | `booking_preorder_items` | `location_id` | → `locations.location_id` | CASCADE |
| 7 | `booking_preorder_items` | `service_id` | → `services.service_id` | RESTRICT |

### Xác nhận
- ✅ Không có dữ liệu mồ côi trước khi thêm FK
- ✅ Website hoạt động bình thường sau khi thêm
- ✅ Không cần thêm bảng mới cho mobile

---

## 8. Tiến độ triển khai

### Trạng thái tổng quan

| Giai đoạn | Nội dung | Độ khó | Thời gian ước tính | Trạng thái |
|-----------|----------|--------|-------------------|------------|
| 0 | Database FK | ⭐ Dễ | 10 phút | ✅ HOÀN THÀNH |
| 1 | Foundation | ⭐ Dễ | 1h30p | ⏳ ĐANG LÀM (70%) |
| 2 | Auth Flow | ⭐⭐ TB | 1h50p | ⏸️ CHỜ |
| 3 | Tab Screens | ⭐⭐ TB | 1h45p | ⏸️ CHỜ |
| 4 | Map & Check-in | ⭐⭐⭐ Khó | 2h25p | ⏸️ CHỜ |
| 5 | Location Detail | ⭐⭐ TB | 1h35p | ⏸️ CHỜ |
| 6 | Booking System | ⭐⭐⭐⭐ RK | 2h50p | ⏸️ CHỜ |
| 7 | Tickets & Passes | ⭐⭐ TB | 50p | ⏸️ CHỜ |
| 8 | Secondary Screens | ⭐⭐ TB | 1h50p | ⏸️ CHỜ |
| 9 | Shared Components | ⭐ Dễ | 1h25p | ⏸️ CHỜ |
| **TỔNG** | | | **~16h** | |

### Chi tiết Giai đoạn 1 (Foundation)

| Bước | Nội dung | Trạng thái |
|------|----------|------------|
| 1.1 | Backup .env | ✅ |
| 1.2 | Xóa mobile cũ (giữ .env) | ✅ |
| 1.3 | Tạo Expo SDK 54 mới | ✅ |
| 1.4 | Cài 27 dependencies | ✅ |
| 1.5 | Tạo cấu trúc thư mục | ✅ |
| 1.6 | Tạo 33 file placeholder | ✅ |
| 1.7 | Theme system | ⏸️ CHỜ |
| 1.8 | Types definitions | ⏸️ CHỜ |
| 1.9 | Axios Client | ⏸️ CHỜ |
| 1.10 | API Endpoints mapping | ⏸️ CHỜ |
| 1.11 | Auth Store (Zustand) | ⏸️ CHỜ |

### Ghi chú
- **KHÔNG tự ý push/commit git** — chờ phê duyệt
- Sau mỗi giai đoạn xong → tạo file tiến độ mới đánh giá
- File tiến độ lưu tại: `docs/mobile-progress/`

---

*Cập nhật lần cuối: 2026-06-05*
