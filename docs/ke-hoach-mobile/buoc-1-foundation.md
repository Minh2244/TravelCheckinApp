# 🏗️ BƯỚC 1: FOUNDATION — Nền tảng Mobile App

> **Ngày bắt đầu:** 2026-06-06
> **Mục tiêu:** Tạo nền tảng để toàn bộ app hoạt động (theme, types, API, auth)
> **Tổng thời gian ước tính:** ~1h50p
> **Số phần:** 5

---

## Tổng quan

| # | Phần | Mô tả | Thời gian | Độ khó | Trạng thái |
|---|------|-------|-----------|--------|------------|
| 1.1 | Theme System | Định nghĩa màu sắc, spacing, typography | 10p | ⭐ Dễ | ✅ |
| 1.2 | Types Definitions | Định nghĩa tất cả TypeScript interfaces | 20p | ⭐ Dễ | ✅ |
| 1.3 | Axios Client | HTTP client + token refresh tự động | 25p | ⭐⭐ TB | ✅ |
| 1.4 | API Endpoints | Map tất cả 87 endpoints từ backend | 30p | ⭐ Dễ | ✅ |
| 1.5 | Auth Store | Zustand store quản lý đăng nhập | 25p | ⭐⭐ TB | ✅ |
| **TỔNG** | | | **~110p** | | **✅** |

---

## PHẦN 1.1: Theme System

### Mô tả
Tạo file chứa tất cả giá trị theme (màu sắc, khoảng cách, font size) để toàn bộ app dùng chung. Đảm bảo UI thống nhất trên mọi màn hình.

### Chi tiết công việc
```
1. Tạo file: constants/theme.ts
2. Định nghĩa colors:
   ├── primary: '#2563EB'      (xanh dương — nút chính)
   ├── primaryLight: '#3B82F6' (xanh dương nhạt)
   ├── accent: '#F59E0B'       (cam — nút CTA)
   ├── background: '#F8FAFC'   (nền app)
   ├── card: '#FFFFFF'         (nền card)
   ├── text: '#1E293B'         (chữ chính)
   ├── textSecondary: '#64748B'(chữ phụ)
   ├── border: '#E2E8F0'       (viền)
   ├── error: '#EF4444'        (lỗi)
   ├── success: '#10B981'      (thành công)
   └── warning: '#F59E0B'      (cảnh báo)

3. Định nghĩa spacing: 4, 8, 12, 16, 20, 24, 32
4. Định nghĩa fontSize: 12, 14, 16, 18, 20, 24, 28, 32
5. Định nghĩa fontWeight: normal, medium, semibold, bold
6. Định nghĩa borderRadius: 4, 8, 12, 16, 999 (full)
7. Export theme object

### File liên quan
- Tạo mới: constants/theme.ts

### Cách test
- Import theme vào App.tsx
- Tạo View với backgroundColor = theme.colors.primary
- Nếu thấy màu xanh dương (#2563EB) → OK

### Tiêu chí đạt
- [ ] Theme object export được
- [ ] Không lỗi TypeScript
- [ ] Màu hiển thị đúng trên Expo Go

### Đánh giá
- Độ phức tạp: Thấp
- Rủi ro: Không có
- Phụ thuộc: Không

---

## PHẦN 1.2: Types Definitions

### Mô tả
Định nghĩa tất cả TypeScript interfaces cho dữ liệu trong app. Giúp code an toàn, autocomplete, và bắt lỗi sớm.

### Chi tiết công việc
```
1. Tạo file: types/index.ts
2. Định nghĩa các interface:

   // Auth
   interface User { user_id, email, phone, full_name, username, avatar_url, role, status, ... }
   interface LoginResponse { user, accessToken, refreshToken }

   // Location
   interface Location { location_id, location_name, location_type, description, address, province, latitude, longitude, images, opening_hours, phone, email, website, rating, total_reviews, total_checkins, status, first_image }

   // Service
   interface Service { service_id, location_id, category_id, service_name, service_type, description, price, quantity, unit, status, images }
   interface ServiceCategory { category_id, location_id, category_type, category_name, sort_order }

   // Booking
   interface Booking { booking_id, user_id, service_id, location_id, contact_name, contact_phone, booking_date, check_in_date, check_out_date, quantity, total_amount, discount_amount, final_amount, voucher_code, status, source, notes }
   interface Ticket { ticket_id, ticket_code, status, issued_at, used_at, service_name, service_price, location_name, booking_id, use_date }
   interface TablePass { reservation_id, booking_id, table_name, start_time, end_time, status, location_name }
   interface RoomPass { booking_id, room_name, check_in_date, check_out_date, status, location_name, total_amount }

   // Review
   interface Review { review_id, user_id, location_id, rating, comment, images, created_at, user_name, user_avatar }
   interface ReviewReply { reply_id, content, images, role, created_at }

   // Voucher
   interface Voucher { voucher_id, code, campaign_name, campaign_description, discount_type, discount_value, min_order_value, max_discount_amount, start_date, end_date, max_uses_per_user, is_claimed, user_used_count }

   // Check-in & Diary
   interface Checkin { checkin_id, location_id, checkin_time, status, checkin_latitude, checkin_longitude, location_name, address, first_image }
   interface Diary { diary_id, location_id, location_name, mood, notes, images, created_at }

   // Notification
   interface Notification { notification_id, title, body, target_audience, created_at, is_read }

   // SOS
   interface SosAlert { alert_id, status, location_text, created_at }

   // Leaderboard
   interface LeaderboardEntry { user_id, full_name, avatar_url, checkin_count }

   // Booking Reminder
   interface BookingReminder { booking_id, check_in_date, check_out_date, status, location_name, address, location_type, reminder_sent }

   // API Response
   interface ApiResponse<T> { success: boolean, message?: string, data: T }
   interface PaginatedResponse<T> { success: boolean, data: T[], pagination: { page, limit, total } }

3. Export tất cả

### File liên quan
- Tạo mới: types/index.ts

### Cách test
- Import User vào file khác
- Tạo const user: User = { user_id: 1, email: "test@test.com", ... }
- Nếu TypeScript không báo lỗi → OK

### Tiêu chí đạt
- [ ] Tất cả interface compile được
- [ ] Match với API response từ backend
- [ ] Không lỗi TypeScript

### Đánh giá
- Độ phức tạp: Thấp
- Rủi ro: Không có
- Phụ thuộc: Không

---

## PHẦN 1.3: Axios Client

### Mô tả
Tạo HTTP client dùng chung cho toàn app. Tự động gắn token vào mỗi request, tự động refresh token khi hết hạn.

### Chi tiết công việc
```
1. Tạo file: api/axiosClient.ts
2. Tạo axios instance:
   ├── baseURL: process.env.EXPO_PUBLIC_API_URL
   ├── timeout: 15000ms
   └── headers: { 'Content-Type': 'application/json' }

3. Request interceptor:
   ├── Đọc accessToken từ AsyncStorage
   ├── Nếu có token → gắn vào header Authorization: Bearer {token}
   └── Trả về config

4. Response interceptor (xử lý lỗi):
   ├── Nếu 401 (Unauthorized):
   │   ├── Đọc refreshToken từ AsyncStorage
   │   ├── Gọi POST /api/auth/refresh-token { refreshToken }
   │   ├── Nếu thành công:
   │   │   ├── Lưu accessToken mới vào AsyncStorage
   │   │   ├── Gắn token mới vào request cũ
   │   │   └── Retry request
   │   └── Nếu thất bại:
   │       ├── Xóa cả 2 token
   │       ├── Reset auth store
   │       └── Navigate về Login
   ├── Nếu network error: throw lỗi "Không có kết nối mạng"
   ├── Nếu timeout: throw lỗi "Hết thời gian chờ"
   └── Nếu 500: throw lỗi "Lỗi server"

5. Export axiosClient

### File liên quan
- Tạo mới: api/axiosClient.ts

### Cách test
- Import axiosClient
- Gọi axiosClient.get('/locations')
- Nếu nhận được response (không lỗi network) → OK
- Kiểm tra header có Authorization không

### Tiêu chí đạt
- [ ] baseURL đọc đúng từ .env
- [ ] Token tự động attach vào header
- [ ] Refresh token hoạt động khi 401
- [ ] Không crash khi network error

### Đánh giá
- Độ phức tạp: Trung bình
- Rủi ro: Refresh token loop nếu xử lý không đúng
- Phụ thuộc: .env (đã có), AsyncStorage (đã cài)

---

## PHẦN 1.4: API Endpoints

### Mô tả
Tạo file chứa tất cả functions gọi API. Mỗi function tương ứng 1 endpoint trên backend. Giúp code gọn, dễ tìm, dễ sửa.

### Chi tiết công việc
```
1. Tạo file: api/endpoints.ts
2. Import axiosClient + types
3. Định nghĩa các API modules:

   authApi = {
     login(email, password)           → POST /api/auth/login
     register(data)                   → POST /api/auth/register
     verifyOtp(email, otp)            → POST /api/auth/verify-otp
     forgotPassword(email, phone)     → POST /api/auth/forgot-password
     verifyResetOtp(email, otp)       → POST /api/auth/verify-reset-otp
     resetPassword(email, otp, newPw) → POST /api/auth/reset-password
     logout()                         → POST /api/auth/logout
     refreshToken(refreshToken)       → POST /api/auth/refresh-token
     getBackground()                  → GET /api/auth/background
   }

   userApi = {
     getProfile()                     → GET /api/user/profile
     updateProfile(data)              → PUT /api/user/profile
     uploadAvatar(formData)           → POST /api/user/profile/avatar
     uploadBackground(formData)       → POST /api/user/profile/background
     getCheckins()                    → GET /api/user/checkins
     createCheckin(data)              → POST /api/user/checkins
     createCheckinPhoto(formData)     → POST /api/user/checkins/photo
     deleteCheckin(id)                → DELETE /api/user/checkins/:id
     getFavorites()                   → GET /api/user/favorites
     saveFavorite(locationId, data)   → PATCH /api/user/favorites/:id
     removeFavorite(locationId)       → DELETE /api/user/favorites/:id
     getDiaries()                     → GET /api/user/diary
     createDiary(data)                → POST /api/user/diary
     deleteDiary(id)                  → DELETE /api/user/diary/:id
     getNotifications()               → GET /api/user/notifications
     markAllRead()                    → POST /api/user/notifications/read-all
     deleteAllNotifications()         → POST /api/user/notifications/delete-all
     getMySavedVouchers()             → GET /api/user/vouchers/saved
     getVouchersByLocation(locationId)→ GET /api/user/vouchers/location/:id
     claimVoucher(voucherId)          → POST /api/user/vouchers/:id/claim
     getTouristTickets(params?)       → GET /api/user/tickets
     getBookingReminders()            → GET /api/user/booking-reminders
     getLeaderboard(params?)          → GET /api/user/leaderboard
     createReview(data)               → POST /api/user/reviews
     uploadReviewImage(formData)      → POST /api/user/reviews/upload
     deleteReview(id)                 → DELETE /api/user/reviews/:id
     reportLocation(data)             → POST /api/user/reports/location
     getRecommendations(limit?)       → GET /api/user/recommendations/locations
   }

   locationApi = {
     getLocations(params?)            → GET /api/locations
     getLocationById(id)              → GET /api/locations/:id
     getLocationServices(id, type?)   → GET /api/locations/:id/services
     getLocationReviews(id)           → GET /api/locations/:id/reviews
     getLocationPosAreas(id)          → GET /api/locations/:id/pos/areas
     getLocationPosTables(id, params?)→ GET /api/locations/:id/pos/tables
     getRealtimeStock(id)             → GET /api/locations/:id/tickets/realtime-stock
   }

   bookingApi = {
     createBooking(data)              → POST /api/bookings
     createBookingBatch(data)         → POST /api/bookings/batch
     getMyTableReservations(locationId?) → GET /api/bookings/table-reservations/mine
     getTablePass(locationId?)        → GET /api/bookings/table-reservations/pass
     getRoomPass(locationId?)         → GET /api/bookings/room-reservations/pass
     createPaymentForBooking(bookingId)→ POST /api/bookings/:id/payments
     createPaymentForBatch(bookingIds)→ POST /api/bookings/batch/payments
     confirmTicketTransfer(bookingId) → POST /api/bookings/:id/tickets/confirm-transfer
     confirmTableTransfer(bookingId)  → POST /api/bookings/:id/tables/confirm-transfer
     confirmRoomTransfer(bookingId)   → POST /api/bookings/:id/rooms/confirm-transfer
     confirmRoomBatchTransfer(paymentId)→ POST /api/bookings/batch/rooms/confirm-transfer
     cancelBooking(bookingId)         → POST /api/bookings/:id/cancel
     cancelTableBooking(bookingId)    → POST /api/bookings/:id/tables/cancel
     updateBatchContact(data)         → PUT /api/bookings/batch/contact
     preorderItems(bookingId, data)   → POST /api/bookings/:id/tables/preorder
   }

   sosApi = {
     sendSos(data)                    → POST /api/sos
     pingSos(data)                    → POST /api/sos/ping
     stopSos(data?)                   → POST /api/sos/stop
   }

   geoApi = {
     search(query, limit?)            → GET /api/geo/search
     reverse(lat, lng)                → GET /api/geo/reverse
   }

4. Export tất cả

### File liên quan
- Tạo mới: api/endpoints.ts

### Cách test
- Import locationApi
- Gọi locationApi.getLocations()
- Nếu nhận được danh sách locations → OK
- Kiểm tra response shape match với types

### Tiêu chí đạt
- [ ] Tất cả endpoints được map
- [ ] Params match với backend API
- [ ] Response parse đúng types
- [ ] Không lỗi TypeScript

### Đánh giá
- Độ phức tạp: Thấp (chỉ là mapping)
- Rủi ro: Không có
- Phụ thuộc: axiosClient (1.3), types (1.2)

---

## PHẦN 1.5: Auth Store (Zustand)

### Mô tả
Quản lý trạng thái đăng nhập của user. Lưu thông tin user, token, xử lý login/logout.

### Chi tiết công việc
```
1. Tạo file: store/useAuthStore.ts
2. Định nghĩa state:
   ├── user: User | null
   ├── isAuthenticated: boolean
   ├── isLoading: boolean
   └── error: string | null

3. Định nghĩa actions:
   ├── login(email, password):
   │   ├── Set isLoading = true
   │   ├── Gọi authApi.login(email, password)
   │   ├── Nếu thành công:
   │   │   ├── Lưu accessToken vào AsyncStorage
   │   │   ├── Lưu refreshToken vào AsyncStorage
   │   │   ├── Set user = response.user
   │   │   ├── Set isAuthenticated = true
   │   │   └── Set error = null
   │   └── Nếu thất bại:
   │       ├── Set error = message từ API
   │       └── Set isAuthenticated = false
   │   └── Set isLoading = false
   │
   ├── register(email, phone, password, fullName):
   │   ├── Gọi authApi.register({ email, phone, password, full_name: fullName })
   │   └── Trả về response (không auto login)
   │
   ├── verifyOtp(email, otp):
   │   ├── Gọi authApi.verifyOtp(email, otp)
   │   └── Trả về response
   │
   ├── forgotPassword(email, phone):
   │   ├── Gọi authApi.forgotPassword(email, phone)
   │   └── Trả về response
   │
   ├── verifyResetOtp(email, otp):
   │   ├── Gọi authApi.verifyResetOtp(email, otp)
   │   └── Trả về response
   │
   ├── resetPassword(email, otp, newPassword):
   │   ├── Gọi authApi.resetPassword(email, otp, newPassword)
   │   └── Trả về response
   │
   ├── logout():
   │   ├── Gọi authApi.logout() (không quan tâm lỗi)
   │   ├── Xóa accessToken khỏi AsyncStorage
   │   ├── Xóa refreshToken khỏi AsyncStorage
   │   ├── Set user = null
   │   ├── Set isAuthenticated = false
   │   └── Set error = null
   │
   ├── loadSession():
   │   ├── Đọc accessToken từ AsyncStorage
   │   ├── Nếu không có → isAuthenticated = false
   │   ├── Nếu có → gọi GET /api/auth/session
   │   ├── Nếu hợp lệ → set user + isAuthenticated = true
   │   └── Nếu không hợp lệ → xóa token + isAuthenticated = false
   │
   └── clearError():
       └── Set error = null

4. Export useAuthStore

### File liên quan
- Tạo mới: store/useAuthStore.ts

### Cách test
- Import useAuthStore
- Gọi store.login("test@example.com", "123456")
- Nếu store.isAuthenticated = true → OK
- Gọi store.logout()
- Nếu store.isAuthenticated = false → OK
- Restart app → gọi loadSession() → vẫn đăng nhập

### Tiêu chí đạt
- [ ] Login/logout hoạt động
- [ ] Token lưu vào AsyncStorage
- [ ] User state persist qua restart app
- [ ] Error handling hoạt động
- [ ] Refresh token hoạt động

### Đánh giá
- Độ phức tạp: Trung bình
- Rủi ro: State không persist nếu AsyncStorage lỗi
- Phụ thuộc: axiosClient (1.3), endpoints (1.4), types (1.2)

---

## Quy trình thực hiện

```
Phần 1.1 (Theme)     → Code → Test → Bạn OK → Tiếp
Phần 1.2 (Types)     → Code → Test → Bạn OK → Tiếp
Phần 1.3 (Axios)     → Code → Test → Bạn OK → Tiếp
Phần 1.4 (API)       → Code → Test → Bạn OK → Tiếp
Phần 1.5 (AuthStore) → Code → Test → Bạn OK → XONG BƯỚC 1
```

## Phụ thuộc giữa các phần

```
1.1 Theme       ← Không phụ thuộc
1.2 Types       ← Không phụ thuộc
1.3 Axios       ← Không phụ thuộc
1.4 API Endpoints ← Cần 1.2 (types) + 1.3 (axiosClient)
1.5 Auth Store  ← Cần 1.2 (types) + 1.3 (axios) + 1.4 (endpoints)
```

→ Có thể code song song 1.1 + 1.2 + 1.3, sau đó 1.4, cuối cùng 1.5

---

## Tiến độ

| Phần | Bắt đầu | Hoàn thành | Ghi chú |
|------|---------|------------|---------|
| 1.1 Theme | 2026-06-06 | 2026-06-06 | ✅ |
| 1.2 Types | 2026-06-06 | 2026-06-06 | ✅ 25+ interfaces |
| 1.3 Axios | 2026-06-06 | 2026-06-06 | ✅ Token refresh + queue |
| 1.4 API | 2026-06-06 | 2026-06-06 | ✅ 87 endpoints mapped |
| 1.5 AuthStore | 2026-06-06 | 2026-06-06 | ✅ Zustand + AsyncStorage |

---

*Cập nhật: 2026-06-06*
