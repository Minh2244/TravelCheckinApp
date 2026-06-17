# Giai đoạn 2: Map & API Layer

## Mục tiêu
Xây dựng hệ thống bản đồ (map) và lớp API cho mobile app, tương đương website.

---

## Phần A: API Layer

### Cấu trúc thư mục
```
src/api/
├── client.ts          # Axios instance + interceptors
├── auth.ts            # Auth endpoints
├── locations.ts       # Location endpoints
├── bookings.ts        # Booking endpoints
├── user.ts            # User endpoints (checkins, favorites, profile...)
├── geo.ts             # Geocoding endpoints
├── sos.ts             # SOS endpoints
├── ai.ts              # AI chat endpoints
├── push.ts            # Push notification endpoints
└── index.ts           # Re-export tất cả
```

### 1. Axios Client (`client.ts`)

```typescript
// Cấu hình:
// - Base URL: từ .env (EXPO_PUBLIC_API_URL)
// - Request interceptor: gắn Bearer token từ authStore
// - Response interceptor:
//   + 401 → gọi refresh-token → retry request cũ
//   + 401 + SESSION_REVOKED → force logout
//   + 403 + ACCOUNT_LOCKED → force logout
//   + Hàng đợi request chờ token mới (không gọi refresh nhiều lần)
```

### 2. Auth API (`auth.ts`)

| Endpoint | Method | Request | Response |
|---|---|---|---|
| `/auth/register` | POST | `{email, phone, password, full_name}` | `{success, message}` |
| `/auth/verify-otp` | POST | `{email, otp}` | `{success, message}` |
| `/auth/login` | POST | `{email, password}` | `{data: {user, accessToken, refreshToken}}` |
| `/auth/social-login` | POST | `{provider, socialId, email, fullName, avatarUrl}` | `{data: {user, accessToken, refreshToken}}` |
| `/auth/forgot-password` | POST | `{email}` | `{success, message}` |
| `/auth/verify-reset-otp` | POST | `{email, otp}` | `{success, message}` |
| `/auth/reset-password` | POST | `{email, otp, newPassword}` | `{success, message}` |
| `/auth/refresh-token` | POST | `{refreshToken}` | `{data: {accessToken}}` |
| `/auth/logout` | POST | - | `{success}` |
| `/auth/session` | GET | - | `{data: {valid: boolean}}` |

### 3. Location API (`locations.ts`)

| Endpoint | Method | Params | Mô tả |
|---|---|---|---|
| `/locations` | GET | `type, keyword, province, source` | Danh sách địa điểm |
| `/locations/search` | GET | `keyword, type, province, source` | Tìm kiếm địa điểm |
| `/locations/:id` | GET | - | Chi tiết địa điểm |
| `/locations/:id/services` | GET | `type` | Dịch vụ (room/table/ticket/food) |
| `/locations/:id/pos/areas` | GET | - | Khu vực ăn uống |
| `/locations/:id/pos/tables` | GET | `area_id, check_in_date` | Bàn ăn + trạng thái |
| `/locations/:id/tickets/realtime-stock` | GET | - | Vé còn lại hôm nay |
| `/locations/:id/reviews` | GET | - | Đánh giá |

### 4. Booking API (`bookings.ts`)

| Endpoint | Method | Body | Mô tả |
|---|---|---|---|
| `/bookings` | POST | `{location_id, service_id, check_in_date, ...}` | Tạo booking |
| `/bookings/batch` | POST | `{location_id, service_ids[], ...}` | Tạo nhiều booking |
| `/bookings/table-reservations/mine` | GET | `location_id` | Bàn đã đặt |
| `/bookings/room-reservations/pass` | GET | `location_id` | Phòng đã đặt |
| `/bookings/:id/payments` | POST | - | Tạo/thanh toán |
| `/bookings/:id/tickets/confirm-transfer` | POST | - | Xác nhận chuyển khoản vé |
| `/bookings/:id/tables/confirm-transfer` | POST | - | Xác nhận chuyển khoản bàn |
| `/bookings/:id/rooms/confirm-transfer` | POST | - | Xác nhận chuyển khoản phòng |
| `/bookings/:id/tables/cancel` | POST | - | Hủy bàn |
| `/bookings/:id/tables/preorder` | POST | `{preorder_items[]}` | Đặt đồ ăn trước |
| `/bookings/:id/cancel` | POST | - | Hủy booking |

### 5. User API (`user.ts`)

| Endpoint | Method | Mô tả |
|---|---|---|
| `/user/checkins` | GET | Danh sách check-in |
| `/user/checkins` | POST | Tạo check-in |
| `/user/checkins/:id` | DELETE | Xóa check-in |
| `/user/favorites` | GET | Địa điểm yêu thích |
| `/user/favorites/:locationId` | PATCH | Toggle yêu thích |
| `/user/favorites/:locationId` | DELETE | Bỏ yêu thích |
| `/user/profile` | GET | Thông tin cá nhân |
| `/user/profile` | PUT | Cập nhật profile |
| `/user/profile/avatar` | POST | Upload avatar (multipart) |
| `/user/tickets` | GET | Vé của tôi |
| `/user/vouchers/saved` | GET | Voucher đã lưu |
| `/user/vouchers/:id/claim` | POST | Nhận voucher |
| `/user/diary` | GET/POST | Nhật ký du lịch |
| `/user/reviews` | POST | Tạo đánh giá |
| `/user/leaderboard` | GET | Bảng xếp hạng |
| `/user/booking-reminders` | GET | Nhắc nhở đặt chỗ |
| `/user/notifications` | GET | Thông báo |

### 6. Geo API (`geo.ts`)

| Endpoint | Method | Params | Mô tả |
|---|---|---|---|
| `/geo/search` | GET | `q, limit` | Tìm kiếm địa điểm (Nominatim) |
| `/geo/reverse` | GET | `lat, lng` | Lấy tên địa điểm từ tọa độ |

### 7. SOS API (`sos.ts`)

| Endpoint | Method | Body | Mô tả |
|---|---|---|---|
| `/sos` | POST | `{latitude, longitude, message}` | Gửi SOS |
| `/sos/ping` | POST | `{latitude, longitude}` | Cập nhật vị trí SOS |
| `/sos/stop` | POST | - | Dừng SOS |

---

## Phần B: Map Implementation

### Library: `react-native-maps` + OSM Tiles

```typescript
// MapView với UrlTile overlay
<MapView
  initialRegion={{
    latitude: 10.776889,   // TP.HCM
    longitude: 106.700806,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  }}
  mapType="none"           // Ẩn Google Maps mặc định
>
  <UrlTile
    urlTemplate="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
    maximumZ={17}
  />
</MapView>
```

### Tile Layers (4 tùy chọn như website)

| Tên | URL | Mô tả |
|---|---|---|
| osm | `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` | Tiêu chuẩn |
| positron | `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png` | Sáng nhẹ |
| voyager | `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png` | Đẹp, mặc định |
| satellite | `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}` | Vệ tinh |

### Markers

#### Location Marker (hình tròn có ảnh)
```
┌─────────────┐
│  ┌───────┐  │
│  │  IMG  │  │  ← Ảnh địa điểm (circular crop)
│  │       │  │
│  └───────┘  │
│    border   │  ← Viền trắng + teal khi selected
└─────────────┘
```

- Custom `<Marker>` với `<View>` chứa `<Image>` hình tròn
- Kích thước: 56px (selected), 48px (normal)
- Nếu không có ảnh: gradient circle + pin icon

#### Pin Icons (SVG)
| Loại | Màu | Ý nghĩa |
|---|---|---|
| owner | `#3b82f6` (xanh dương) | Địa điểm hệ thống |
| userCreated | `#f59e0b` (vàng) | Địa điểm người dùng tạo |
| search | `#22c55e` (xanh lá) | Kết quả tìm kiếm |
| myPosition | `#ef4444` (đỏ) | Vị trí hiện tại |

#### My Position Marker
- Viên đạn đỏ với heading indicator
- Compass arrow xoay theo hướng điện thoại

### Category Filtering

| Category | Filter |
|---|---|
| all | Hiển thị tất cả |
| food | `location_type === "restaurant" \|\| "cafe"` |
| tourist | `location_type === "tourist"` |
| hotel | `location_type === "hotel" \|\| "resort"` |
| mine | Chỉ hiện địa điểm yêu thích |

### Routing / Navigation

#### OSRM (miễn phí, không cần API key)
```typescript
// Primary
const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson&alternatives=true`;

// Fallback
const url2 = `https://routing.openstreetmap.de/routed-car/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson&alternatives=true`;
```

#### Route Rendering
- Tuyến chính: `Polyline` màu xanh `#2563eb`, strokeWidth 5
- Tuyến phụ 1: dashed green `#10b981`
- Tuyến phụ 2: dashed orange `#f97316`
- Hiển thị khoảng cách + thời gian ước tính

#### Fallback
- Nếu OSRM lỗi: vẽ đường thẳng (haversine) + cảnh báo "Hiển thị khoảng cách đường chim bay"

### GPS & Check-in

#### Expo Location
```typescript
import * as Location from 'expo-location';

// Xin quyền
const { status } = await Location.requestForegroundPermissionsAsync();

// Lấy vị trí hiện tại
const location = await Location.getCurrentPositionAsync({
  accuracy: Location.Accuracy.High,
});

// Theo dõi vị trí liên tục
const subscription = await Location.watchPositionAsync(
  { accuracy: Location.Accuracy.High, distanceInterval: 5 }, // chỉ cập nhật khi di chuyển > 5m
  (location) => { /* update marker */ }
);
```

#### Check-in Flow
1. Lấy GPS hiện tại
2. Kiểm tra khoảng cách đến địa điểm (haversine)
3. Nếu < 80m → cho phép check-in
4. Gọi `POST /api/user/checkins` với `{location_id, checkin_latitude, checkin_longitude, notes}`

#### Free Check-in (tại điểm bất kỳ)
1. Long press trên map → đặt pin
2. Tìm địa điểm gần nhất trong 80m
3. Gợi ý check-in tại địa điểm đó hoặc tạo check-in tự do

### Search System

#### Tìm kiếm 2 tầng (giống website)

**Bước 1: Tìm trong hệ thống**
- Tìm theo `location_name + address + province`
- Bỏ dấu tiếng Việt khi so sánh
- Scoring: owner boost +1000, name match +200, distance boost +400 (5km), province match +800

**Bước 2: Tìm trên Nominatim (nếu hệ thống < 6 kết quả)**
- Gọi `/api/geo/search?q=...&limit=10`
- Backend proxy đến Nominatim, giới hạn Việt Nam
- Kết quả hợp nhất, dedup, lấy top 6

#### Debounce
- 500ms debounce trước khi tìm kiếm

### Bearing Navigation

```
         ↑ Arrow xoay theo hướng đích
        /|\
       / | \
      /  |  \
     /   |   \
    ─────┼─────  ← 50m radius circle
         │
         📍 User position
```

- Tính bearing từ user → đích (haversine)
- Trừ heading điện thoại (compass) → rotation thực tế
- Hiển thị khi routing active

---

## Phần C: Data Types

### Location
```typescript
interface Location {
  location_id: number;
  owner_id: number;
  location_name: string;
  location_type: "hotel" | "restaurant" | "tourist" | "cafe" | "resort" | "other";
  description: string | null;
  address: string;
  province: string | null;
  latitude: number | null;
  longitude: number | null;
  images: string[] | null;
  first_image: string | null;
  opening_hours: Record<string, string> | null;
  phone: string | null;
  rating: number;
  total_reviews: number;
  total_checkins: number;
  status: "active" | "inactive" | "pending";
}
```

### Service
```typescript
interface Service {
  service_id: number;
  location_id: number;
  service_name: string;
  service_type: "room" | "table" | "ticket" | "food" | "combo" | "other";
  price: number;
  quantity: number;
  unit: string;
  status: string;
  images: string | null;
}
```

### Booking
```typescript
interface Booking {
  booking_id: number;
  user_id: number;
  location_id: number;
  service_id: number;
  check_in_date: string;
  check_out_date: string | null;
  quantity: number;
  status: "pending" | "confirmed" | "cancelled";
  source: "web" | "mobile" | "admin";
  contact_name: string | null;
  contact_phone: string | null;
  notes: string | null;
}
```

### Review
```typescript
interface Review {
  review_id: number;
  user_id: number;
  location_id: number;
  rating: number;
  comment: string | null;
  images: string[] | null;
  created_at: string;
  user_name: string | null;
  user_avatar: string | null;
  reply_content: string | null;
  reply_created_at: string | null;
}
```

---

## Phần D: Utils cần copy từ website

| File | Nội dung | Ghi chú |
|---|---|---|
| `openingHours.ts` | Parse giờ mở cửa, kiểm tra đang mở/đóng | Copy nguyên bản, pure TS |
| `imageHelper.ts` | Resolve URL ảnh (relative → absolute) | Đã có trong mobile cũ |
| `vietqr.ts` | Tạo link QR thanh toán VietQR | Đã có trong mobile cũ |
| `latLng.ts` | Validate/normalize tọa độ | Copy từ website |
| `haversine` | Tính khoảng cách 2 điểm | Viết mới hoặc copy |

---

## Kết quả sau giai đoạn 2

- [x] API layer hoàn chỉnh (axios client + tất cả endpoints)
- [x] Map hiển thị với OSM tiles
- [x] Markers hiển thị địa điểm (circular image)
- [x] Category filtering (all/food/tourist/hotel/mine)
- [x] Search tìm kiếm (system + Nominatim)
- [x] GPS tracking + compass heading
- [x] Routing OSRM (primary + fallback)
- [x] Check-in flow (tại địa điểm + tự do)
- [x] Data types đầy đủ
- [x] Utils (openingHours, imageHelper, vietqr, latLng, haversine)
