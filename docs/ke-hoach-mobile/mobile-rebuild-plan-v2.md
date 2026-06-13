# 📱 KẾ HOẠCH REBUILD MOBILE APP v2.0 — TravelCheckinApp

> **Ngày tạo:** 2026-06-05
> **Cập nhật:** 2026-06-13
> **Trạng thái:** Đang triển khai
> **Người duyệt:** Mai Nhut Minh

---

## MỤC LỤC

1. [Tổng quan dự án](#1-tổng-quan-dự-án)
2. [Thay đổi từ v1.0](#2-thay đổi-từ-v10)
3. [Quyết định đã chốt](#3-quyết-định-đã-chốt)
4. [Cấu trúc thư mục hiện tại](#4-cấu-trúc-thư-mục-hiện-tại)
5. [Danh sách màn hình & chức năng](#5-danh-sách-màn-hình--chức-năng)
6. [Tiến độ triển khai](#6-tiến-độ-triển-khai)
7. [Kế hoạch còn lại](#7-kế-hoạch-còn-lại)
8. [Database & API Changes](#8-database--api-changes)

---

## 1. Tổng quan dự án

### Mục tiêu
Rebuild toàn bộ phân hệ Mobile (Tourist/User) bằng React Native + Expo SDK. Mobile kế thừa 100% trải nghiệm cốt lõi của Website.

### Tech Stack
| Layer | Technology |
|-------|-----------|
| Framework | React Native + Expo SDK 56 |
| Navigation | Expo Router (file-based routing) |
| State Management | Zustand |
| HTTP Client | Axios (baseURL từ `.env`) |
| Maps | react-native-maps + OSM tile overlay |
| QR Code | react-native-qrcode-svg |
| Auth | JWT Bearer Token |

### Backend
- **KHÔNG sửa backend** — 180+ endpoints hiện tại đủ dùng
- Backend chỉ phân biệt `admin` vs `user`, KHÔNG phân biệt web vs mobile
- Cả 2 gọi cùng 1 backend API → cùng 1 database → dữ liệu đồng bộ 100%

---

## 2. Thay đổi từ v1.0

### 2.1. Tính năng mới thêm vào Website (cần đưa vào Mobile)

| Tính năng | Mô tả | Ưu tiên |
|-----------|-------|---------|
| **Lịch trình (Itinerary)** | Tạo/sửa/xóa lịch trình du lịch theo ngày, dẫn đường | 🔴 Cao |
| **Hệ thống ảnh mới** | Ảnh lưu trong DB (LONGBLOB), URL: `/api/images/:id` | 🔴 Cao |
| **Notification improvements** | Cần thêm cột `type`, phân trang, xóa từng item | 🟡 Trung bình |

### 2.2. API Endpoints cập nhật

| Nhóm | v1.0 | v2.0 | Thay đổi |
|------|------|------|----------|
| Auth | 10 | 16 | +6 (OAuth, session) |
| User | 25+ | 35+ | +10 (diary, notifications, itinerary) |
| Location | 7 | 7 | Không đổi |
| Booking | 14 | 14 | Không đổi |
| Owner | - | 70+ | Không áp dụng cho mobile |
| Admin | - | 80+ | Không áp dụng cho mobile |
| Chat | 2 | 3 | +1 |
| SOS | 3 | 3 | Không đổi |
| Geo | 2 | 2 | Không đổi |
| Images | - | 3 | Mới |
| **Tổng** | ~87 | ~180+ | +93 endpoints |

### 2.3. Database mới thêm

| Bảng | Mô tả | Ngày thêm |
|------|-------|-----------|
| `itineraries` | Lịch trình du lịch | 2026-06-13 |
| `itinerary_items` | Chi tiết lịch trình | 2026-06-13 |
| `images` | Lưu ảnh BLOB | 2026-06-12 |
| `image_categories` | Phân loại ảnh | 2026-06-12 |
| `entity_images` | Liên kết ảnh-entity | 2026-06-12 |

### 2.4. Cột mới trong bảng hiện có

| Bảng | Cột mới | Mục đích |
|------|---------|----------|
| `users` | `address`, `username`, `background_*` | Profile mở rộng |
| `checkins` | `checkin_latitude`, `checkin_longitude`, `device_info` | GPS check-in |
| `itinerary_items` | `custom_lat`, `custom_lng` | Tọa độ địa điểm tự do |

---

## 3. Quyết định đã chốt

### ✅ Giữ nguyên từ v1.0

| Quyết định | Chi tiết |
|-----------|---------|
| Theme màu | Primary `#2563EB`, Accent `#F59E0B`, Background `#F8FAFC` |
| Font | System default |
| Bản đồ | OSM tiles, KHÔNG Google Maps |
| Booking flow | QR + nút "Xác nhận đã chuyển" |
| Single-session | 1 device duy nhất |
| Git | KHÔNG tự ý push/commit |

### ✅ Quyết định mới

| Quyết định | Chi tiết |
|-----------|---------|
| **Ảnh** | Dùng URL `/api/images/:id` thay vì đường dẫn cũ |
| **Lịch trình** | Thêm vào mobile (đã có file cơ bản) |
| **Notification** | Cần cập nhật backend trước khi làm mobile |

### ❌ Không làm trên mobile

| Chức năng bỏ | Lý do |
|-------------|-------|
| AI Chat | Website đang xây dựng |
| Chat realtime với owner | Website đang xây dựng |
| Lịch sử đăng nhập | Ít cần trên mobile |
| Xuất CSV | Ít cần trên mobile |
| Facebook OAuth | Backend đã hỗ trợ nhưng không cần mobile |
| VisitedMap | Đã deprecated |

---

## 4. Cấu trúc thư mục hiện tại

```
mobile/app/
├── _layout.tsx                   ✅ Root layout + auth guard
├── +not-found.tsx                ✅ 404 page
├── login.tsx                     ✅ HOÀN THÀNH
├── register.tsx                  ✅ HOÀN THÀNH
├── forgot-password.tsx           ✅ HOÀN THÀNH
├── (tabs)/
│   ├── _layout.tsx               ✅ 5 tabs + safe area
│   ├── index.tsx                 ⏳ PLACEHOLDER (Giai đoạn 3)
│   ├── map.tsx                   ⏳ PLACEHOLDER (Giai đoạn 4)
│   ├── tickets.tsx               ⏳ PLACEHOLDER (Giai đoạn 7)
│   ├── profile.tsx               ⏳ PLACEHOLDER (Giai đoạn 3)
│   └── history.tsx               ⏳ PLACEHOLDER (Giai đoạn 4)
├── booking/[serviceId].tsx       ⏳ PLACEHOLDER (Giai đoạn 6)
├── location/[id].tsx             ⏳ PLACEHOLDER (Giai đoạn 5)
├── sos/
│   ├── _layout.tsx               ⏳ PLACEHOLDER
│   └── index.tsx                 ⏳ PLACEHOLDER (Giai đoạn 8)
├── booking-reminders.tsx         ⏳ PLACEHOLDER (Giai đoạn 8)
├── checkin.tsx                   ⏳ PLACEHOLDER (Giai đoạn 4)
├── diary.tsx                     ⏳ PLACEHOLDER (Giai đoạn 8)
├── leaderboard.tsx               ⏳ PLACEHOLDER (Giai đoạn 8)
├── notifications.tsx             ⏳ PLACEHOLDER (Giai đoạn 8)
├── saved-locations.tsx           ⏳ PLACEHOLDER (Giai đoạn 8)
├── vouchers.tsx                  ⏳ PLACEHOLDER (Giai đoạn 8)
└── itineraries/                  🆕 MỚI (không có trong kế hoạch gốc)
    ├── index.tsx                 ⏳ PLACEHOLDER
    ├── create.tsx                ⏳ PLACEHOLDER
    └── [id].tsx                  ⏳ PLACEHOLDER
```

**Thư mục rỗng (cần tạo nội dung):**
- `components/` — 10 component files (0 bytes)
- `hooks/` — rỗng
- `utils/` — rỗng

---

## 5. Danh sách màn hình & chức năng

### 5.1. Đã hoàn thành (G0, G1, G2)

| Màn hình | Trạng thái | Ghi chú |
|----------|-----------|---------|
| Login | ✅ 100% | Email + Password + Google OAuth |
| Register | ✅ 100% | 2 bước + OTP 6 số |
| Forgot Password | ✅ 100% | 3 bước + OTP |
| Root Layout | ✅ 100% | Auth guard + session check |
| Tab Layout | ✅ 100% | 5 tabs + safe area |
| API Layer | ✅ 100% | 180+ endpoints, token refresh |
| Theme System | ✅ 100% | Colors, spacing, typography |
| Types | ✅ 100% | 30+ interfaces |
| Auth Store | ✅ 100% | Zustand + AsyncStorage |

### 5.2. Chưa bắt đầu (G3-G9)

#### Giai đoạn 3: Tab Screens + Notifications

| Màn hình | Chức năng chính | API |
|----------|----------------|-----|
| Home (index.tsx) | Lời chào, thời tiết GPS, quick actions, tìm kiếm, danh sách địa điểm | `GET /api/locations`, `GET /api/geo/reverse`, Open-Meteo |
| Profile (profile.tsx) | Avatar, stats, chỉnh sửa hồ sơ, đăng xuất | `GET /api/user/profile`, `PUT /api/user/profile` |
| Notifications | Danh sách thông báo, đánh dấu đã đọc | `GET /api/user/notifications` |

#### Giai đoạn 4: Map & Check-in

| Màn hình | Chức năng chính | API |
|----------|----------------|-----|
| Map (map.tsx) | Bản đồ OSM, markers ảnh tròn, tìm kiếm, GPS, chỉ đường | `GET /api/locations`, `GET /api/geo/search` |
| Check-in | Check-in tự do, GPS tracking | `POST /api/user/checkins` |
| History | Timeline check-in, bản đồ polyline | `GET /api/user/checkins` |

#### Giai đoạn 5: Location Detail

| Màn hình | Chức năng chính | API |
|----------|----------------|-----|
| Location Detail | 3 tabs, voucher, thời tiết, review, booking | `GET /api/locations/:id`, `GET /api/locations/:id/reviews` |

#### Giai đoạn 6: Booking System

| Màn hình | Chức năng chính | API |
|----------|----------------|-----|
| Booking - Ticket | Đặt vé, thanh toán VietQR | `POST /api/bookings` |
| Booking - Table | Đặt bàn, chọn bàn, đặt món | `POST /api/bookings` |
| Booking - Room | Đặt phòng, batch booking | `POST /api/bookings/batch` |

#### Giai đoạn 7: Tickets & Passes

| Màn hình | Chức năng chính | API |
|----------|----------------|-----|
| Tickets tab | Vé du lịch + QR | `GET /api/user/tickets` |
| Table Pass | Pass đặt bàn + QR + SSE | `GET /api/bookings/table-reservations/pass` |
| Room Pass | Pass đặt phòng + QR + SSE | `GET /api/bookings/room-reservations/pass` |

#### Giai đoạn 8: Secondary Screens

| Màn hình | Chức năng chính | API |
|----------|----------------|-----|
| Saved Locations | Grid địa điểm đã lưu | `GET /api/user/favorites` |
| Vouchers | Danh sách voucher | `GET /api/user/vouchers/saved` |
| Booking Reminders | Nhắc lịch trình | `GET /api/user/booking-reminders` |
| Diary | Nhật ký + mood | `GET /api/user/diary` |
| Leaderboard | Bảng xếp hạng | `GET /api/user/leaderboard` |
| SOS | Khẩn cấp GPS | `POST /api/sos` |
| **Itinerary** | CRUD lịch trình, dẫn đường | `GET/POST/PUT/DELETE /api/user/itineraries` |

#### Giai đoạn 9: Shared Components

| Component | Mô tả |
|-----------|-------|
| Button | Nút bấm với variants |
| Card | Container bo góc + shadow |
| Input | TextInput với label, error |
| Header | Top bar + back button |
| Avatar | Ảnh tròn + fallback |
| Badge | Status indicator |
| EmptyState | Illustration khi list rỗng |
| LoadingOverlay | Spinner toàn màn hình |
| RatingStars | Star rating |
| SegmentedControl | Tab switcher |

---

## 6. Tiến độ triển khai

```
G0  Database FK          ████████████████████ 100%  ✅ HOÀN THÀNH (2026-06-05)
G1  Foundation           ████████████████████ 100%  ✅ HOÀN THÀNH (2026-06-06)
G2  Auth Flow            ████████████████████ 100%  ✅ HOÀN THÀNH (2026-06-06)
G3  Tab Screens + Notif  ░░░░░░░░░░░░░░░░░░░░   0%  ⏳ CHƯA BẮT ĐẦU
G4  Map & Check-in       ░░░░░░░░░░░░░░░░░░░░   0%  ⏳ CHƯA BẮT ĐẦU
G5  Location Detail      ░░░░░░░░░░░░░░░░░░░░   0%  ⏳ CHƯA BẮT ĐẦU
G6  Booking System       ░░░░░░░░░░░░░░░░░░░░   0%  ⏳ CHƯA BẮT ĐẦU
G7  Tickets & Passes     ░░░░░░░░░░░░░░░░░░░░   0%  ⏳ CHƯA BẮT ĐẦU
G8  Secondary Screens    ░░░░░░░░░░░░░░░░░░░░   0%  ⏳ CHƯA BẮT ĐẦU
G9  Shared Components    ░░░░░░░░░░░░░░░░░░░░   0%  ⏳ CHƯA BẮT ĐẦU
```

**Tổng tiến độ:** 3/9 giai đoạn (~33%)
**Thời gian đã dùng:** ~3h50p
**Thời gian còn lại ước tính:** ~12h40p

---

## 7. Kế hoạch còn lại

### Ưu tiên thực hiện

| Thứ tự | Giai đoạn | Thời gian ước tính | Lý do ưu tiên |
|--------|-----------|-------------------|---------------|
| 1 | G3: Tab Screens | ~3h | Nền tảng cho tất cả màn hình khác |
| 2 | G4: Map & Check-in | ~2h45p | Tính năng cốt lõi |
| 3 | G5: Location Detail | ~1h45p | Cần cho booking |
| 4 | G6: Booking System | ~2h50p | Phức tạp nhất |
| 5 | G7: Tickets & Passes | ~50p | Đơn giản |
| 6 | G8: Secondary + Itinerary | ~2h30p | Mở rộng |
| 7 | G9: Shared Components | ~55p | Refactor |

**Tổng thời gian còn lại:** ~14h15p

### Chi tiết từng giai đoạn

#### Giai đoạn 3: Tab Screens + Notifications (~3h)

| Bước | Nội dung | Thời gian |
|------|----------|-----------|
| 3.1 | DB Migration: thêm cột `type` vào `push_notifications` | 15p |
| 3.2 | Backend: cập nhật INSERT + API notifications | 30p |
| 3.3 | Website: trang Notifications riêng | 40p |
| 3.4 | Mobile: Home Screen (GPS, thời tiết, tìm kiếm, danh sách) | 45p |
| 3.5 | Mobile: Profile Screen (avatar, stats, edit) | 35p |
| 3.6 | Mobile: Notifications Screen | 25p |
| 3.7 | Test toàn bộ | 15p |

#### Giai đoạn 4: Map & Check-in (~2h45p)

| Bước | Nội dung | Thời gian |
|------|----------|-----------|
| 4.1 | Map Screen: OSM tiles, GPS, markers ảnh tròn | 60p |
| 4.2 | Map: tìm kiếm (system + Nominatim) | 30p |
| 4.3 | Map: chỉ đường (mở Google Maps/Apple Maps) | 15p |
| 4.4 | Check-in: GPS validation, tạo check-in | 30p |
| 4.5 | History: timeline + bản đồ polyline | 30p |

#### Giai đoạn 5: Location Detail (~1h45p)

| Bước | Nội dung | Thời gian |
|------|----------|-----------|
| 5.1 | Location Detail: thông tin cơ bản + gallery | 30p |
| 5.2 | Tab đánh giá + viết đánh giá | 30p |
| 5.3 | Voucher + thời tiết + báo cáo | 25p |
| 5.4 | Booking button → navigate | 20p |

#### Giai đoạn 6: Booking System (~2h50p)

| Bước | Nội dung | Thời gian |
|------|----------|-----------|
| 6.1 | Booking - Ticket: chọn ngày, số lượng, voucher | 40p |
| 6.2 | Booking - Table: sơ đồ bàn, đặt món | 50p |
| 6.3 | Booking - Room: chọn phòng, batch | 40p |
| 6.4 | Thanh toán VietQR + xác nhận | 30p |
| 6.5 | SSE realtime cập nhật trạng thái | 15p |

#### Giai đoạn 7: Tickets & Passes (~50p)

| Bước | Nội dung | Thời gian |
|------|----------|-----------|
| 7.1 | Ticket tab: QR code, trạng thái | 25p |
| 7.2 | Table Pass + Room Pass | 25p |

#### Giai đoạn 8: Secondary + Itinerary (~2h30p)

| Bước | Nội dung | Thời gian |
|------|----------|-----------|
| 8.1 | Saved Locations + Vouchers | 20p |
| 8.2 | Booking Reminders + Diary | 25p |
| 8.3 | Leaderboard + SOS | 20p |
| 8.4 | **Itinerary: danh sách + tạo/sửa** | 45p |
| 8.5 | **Itinerary: dẫn đường (focusRoute)** | 20p |
| 8.6 | Notifications | 20p |

#### Giai đoạn 9: Shared Components (~55p)

| Bước | Nội dung | Thời gian |
|------|----------|-----------|
| 9.1 | Button, Card, Input, Header | 30p |
| 9.2 | Avatar, Badge, EmptyState, Loading, RatingStars, SegmentedControl | 25p |

---

## 8. Database & API Changes

### 8.1. API mới cần dùng trong Mobile

#### Itinerary API (mới)

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/user/itineraries` | Danh sách lịch trình |
| GET | `/api/user/itineraries/:id` | Chi tiết lịch trình |
| POST | `/api/user/itineraries` | Tạo lịch trình |
| PUT | `/api/user/itineraries/:id` | Cập nhật lịch trình |
| DELETE | `/api/user/itineraries/:id` | Xóa lịch trình |
| PATCH | `/api/user/itineraries/:id/items/:itemId/visit` | Đánh dấu đã đến |

#### Image API (mới)

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/images/:id` | Lấy ảnh binary |
| GET | `/api/images/:id/metadata` | Lấy metadata ảnh |
| DELETE | `/api/images/:id` | Xóa ảnh (soft) |

#### Notification API (cần cập nhật backend)

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/user/notifications` | Danh sách thông báo (phân trang) |
| POST | `/api/user/notifications/read-all` | Đánh dấu đã đọc tất cả |
| DELETE | `/api/user/notifications/:id` | Xóa từng thông báo |
| DELETE | `/api/user/notifications/delete-all` | Xóa tất cả |

### 8.2. Thay đổi cách xử lý ảnh

**Trước (v1.0):**
```
Image URL: /uploads/avatars/avatar-4-xxx.jpg
→ Frontend: resolveBackendUrl(path)
```

**Sau (v2.0):**
```
Image URL: /api/images/123
→ Frontend: gọi trực tiếp URL
→ Cache-Control: 24h
```

### 8.3. Itinerary data flow

```
Mobile: Tạo lịch trình
  → POST /api/user/itineraries
  → Backend: INSERT itineraries + itinerary_items
  → Response: lịch trình với items

Mobile: Xem chi tiết
  → GET /api/user/itineraries/:id
  → Backend: SELECT itineraries JOIN itinerary_items JOIN locations
  → Response: lịch trình + items + tọa độ

Mobile: Dẫn đường
  → Navigate sang Map với focusRoute state
  → Map: hiển thị marker đích + vẽ đường đi
```

---

## 9. Notes

- **KHÔNG tự ý push/commit git** — chờ phê duyệt
- Sau mỗi giai đoạn xong → tạo file tiến độ mới
- File tiến độ lưu tại: `docs/ke-hoach-mobile/mobile-progress/`
- Backend đã sẵn sàng, không cần sửa đổi thêm (trừ notification)

---

*Cập nhật lần cuối: 2026-06-13*
