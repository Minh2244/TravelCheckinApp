# Đặc tả API & Kỹ thuật Mobile App — Tiếng Việt

> **Ngày tạo:** 2026-06-07
> **Mục đích:** Tài liệu tham khảo API chi tiết cho developer mobile
> **Nguồn:** Phân tích codebase backend + website thực tế

---

## 1. Stack công nghệ

### Backend
- Express ^5.2.1 + TypeScript ^5.9.3
- MySQL qua mysql2/promise ^3.16.0
- JWT (jsonwebtoken) ^9.0.3, bcryptjs ^3.0.3
- Socket.IO ^4.8.3, Firebase Admin ^13.6.0
- Kiến trúc: Controller → Service → Model

### Mobile
- Expo SDK ~56.0.8, Expo Router ~56.2.8
- React 19.2.3, React Native 0.85.3
- react-native-maps 1.27.2
- expo-location ~56.0.15

---

## 2. Luồng xác thực

### 2.1 Đăng nhập
1. `POST /api/auth/login` với `{email, password}`
2. Lưu `accessToken`, `refreshToken` vào AsyncStorage
3. Access token hết hạn 7 ngày, refresh 30 ngày

### 2.2 Đăng ký
1. `POST /api/auth/register` với `{full_name, email, password, phone}`
2. `POST /api/auth/verify-otp` với `{email, otp}`
3. OTP hết hạn 5 phút, brute-force: 5 lần → khóa 5 phút

### 2.3 Google/Facebook OAuth (Mobile)
1. Mở WebView → `GET /api/auth/google/mobile`
2. Backend callback → redirect `travelcheckin://auth/callback?accessToken=...&refreshToken=...`

### 2.4 Quản lý phiên
- Single-session: chỉ 1 phiên/user
- Socket.IO thông báo `session_revoked` khi bị thay thế

---

## 3. Danh sách API đầy đủ

### Auth (Công khai)
```
POST   /api/auth/register          {full_name, email, password, phone}
POST   /api/auth/verify-otp        {email, otp}
POST   /api/auth/login             {email, password}
POST   /api/auth/social-login      {provider, socialId, email, fullName, avatarUrl?}
POST   /api/auth/forgot-password   {email}
POST   /api/auth/verify-reset-otp  {email, otp}
POST   /api/auth/reset-password    {email, otp, newPassword}
POST   /api/auth/refresh-token     {refreshToken}
GET    /api/auth/background
GET    /api/auth/app-background
GET    /api/auth/google/mobile
GET    /api/auth/facebook/mobile
```

### Auth (Bảo vệ)
```
POST   /api/auth/logout
GET    /api/auth/session
```

### User (Vai trò "user")
```
GET    /api/user/profile
PUT    /api/user/profile                    {full_name, phone?, address?}
POST   /api/user/profile/avatar             FormData: avatar
POST   /api/user/profile/background         FormData: background
GET    /api/user/profile/login-history      ?page=&limit=

GET    /api/user/checkins
POST   /api/user/checkins                   {location_id?, latitude, longitude, notes?, action}
DELETE /api/user/checkins/:id

GET    /api/user/favorites
PATCH  /api/user/favorites/:locationId      {note?, tags?}
DELETE /api/user/favorites/:locationId

GET    /api/user/recommendations/locations
GET    /api/user/created-locations
PATCH  /api/user/created-locations/:id
DELETE /api/user/created-locations/:id

GET    /api/user/vouchers/location/:locationId
GET    /api/user/vouchers/saved
POST   /api/user/vouchers/:id/claim

GET    /api/user/tickets                    ?location_id=
GET    /api/user/diary
POST   /api/user/diary                      {location_id?, mood?, notes?, images?}
DELETE /api/user/diary/:id

POST   /api/user/reviews/upload             FormData: image
POST   /api/user/reviews                    {location_id, rating, comment?, images?}
DELETE /api/user/reviews/:id
POST   /api/user/reviews/:id/reply          {content, images?}

POST   /api/user/reports/location           {location_id, description, report_type?, severity?}
GET    /api/user/leaderboard                ?province=&month=
GET    /api/user/booking-reminders
GET    /api/user/notifications
POST   /api/user/notifications/read-all
POST   /api/user/notifications/delete-all
POST   /api/user/notifications/location-invite  {location_id}
```

### Đặt chỗ
```
POST   /api/bookings                          CreateBookingPayload
POST   /api/bookings/batch                    CreateBookingBatchPayload
POST   /api/bookings/:id/payments
POST   /api/bookings/batch/payments           {booking_ids}
PUT    /api/bookings/batch/contact            {booking_ids, contact_name, contact_phone}
POST   /api/bookings/:id/tickets/confirm-transfer
POST   /api/bookings/:id/tables/confirm-transfer
POST   /api/bookings/:id/rooms/confirm-transfer
POST   /api/bookings/batch/rooms/confirm-transfer  {payment_id}
GET    /api/bookings/table-reservations/mine  ?location_id=
GET    /api/bookings/table-reservations/pass  ?location_id=
GET    /api/bookings/room-reservations/pass   ?location_id=
POST   /api/bookings/:id/tables/cancel
POST   /api/bookings/:id/cancel
POST   /api/bookings/:id/tables/preorder      {preorder_items: [{service_id, quantity}]}
```

### Địa điểm (Công khai)
```
GET    /api/locations                         ?type=&keyword=&province=&source=
GET    /api/locations/:id                     ?source=
GET    /api/locations/:id/services            ?type=
GET    /api/locations/:id/pos/areas
GET    /api/locations/:id/pos/tables          ?area_id=&check_in_date=
GET    /api/locations/:id/tickets/realtime-stock
GET    /api/locations/:id/reviews
```

### Chat, Push, AI, SOS, Geo
```
GET    /api/chat/location/:locationId
POST   /api/chat/location/:locationId         {content}
POST   /api/push/device-tokens                {token, deviceId, platform}
DELETE /api/push/device-tokens/:deviceId
POST   /api/ai/chat                           {prompt}
GET    /api/ai/history
POST   /api/sos                               {latitude, longitude, message?}
POST   /api/sos/ping                          {latitude, longitude}
POST   /api/sos/stop                          {alert_id?}
GET    /api/geo/search                        ?q=&limit=
GET    /api/geo/reverse                       ?lat=&lng=
GET    /api/events                            ?token= (SSE)
```

---

## 4. Bản đồ & Định tuyến

### Tile layers
- Tiêu chuẩn: `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`
- Sáng: `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png`
- Đường phố: `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png`
- Vệ tinh: `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`

### OSRM routing
```
https://router.project-osrm.org/route/v1/driving/{fromLng},{fromLat};{toLng},{toLat}?overview=full&geometries=geojson
```

---

## 5. Ràng buộc nghiệp vụ

### Check-in
| Ràng buộc | Giá trị |
|-----------|---------|
| SĐT bắt buộc | `^0\d{9}$` |
| Phạm vi Việt Nam | lat 8-23.5, lng 102-110.5 |
| Tự động khớp | 80 mét |
| Khoảng cách tối đa | 500 mét |
| Tối thiểu giữa 2 lần | 30 giây |
| Tối đa/giờ | 20 |
| Tối đa/ngày | 100 |
| Cùng địa điểm | 2 phút |
| Ban đêm | 22:00-05:00 (cảnh báo) |

### Đặt chỗ
| Ràng buộc | Giá trị |
|-----------|---------|
| Đặt trước | Hôm nay + 3 ngày |
| Giữ bàn | 120 phút |
| Tự hủy bàn/phòng | 60 phút sau check-in |
| Tự hủy vé | 1 ngày |
| Tự xác nhận | 30 phút sau thanh toán |
| Hủy phòng | 24 giờ trước |
| Tối đa vé | 50/giao dịch |

### Hoa hồng
- Mặc định: 2.5% hoa hồng, 10% VAT
- Mỗi địa điểm có thể có tỷ lệ riêng

### Hạng thành viên
- Newbie: 0-4 check-in
- Silver Traveler: 5-15
- Gold Explorer: 16-30
- Diamond Pathfinder: 31+

---

## 6. VietQR

```
https://img.vietqr.io/image/{BIN}-{bankAccount}-compact2.png?addInfo={content}&amount={amount}&accountName={accountHolder}
```

Ngân hàng: VCB (970436), CTG (970415), BIDV (970418), ACB (970416), TCB (970407), MB (970422)...

---

## 7. Deep Link & Push

- OAuth callback: `travelcheckin://auth/callback`
- FCM topics: `user_{userId}`, `all_users`
- SSE events: `session_revoked`, `booking_expired`, `booking_checked_in`, `pos_updated`, `tourist_updated`, `hotel_updated`

---

*Tạo: 2026-06-07*
