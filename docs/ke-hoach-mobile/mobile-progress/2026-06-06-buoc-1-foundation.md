# 📊 Tiến độ Mobile Rebuild — Bước 1: Foundation

> **Ngày:** 2026-06-06
> **Trạng thái:** ✅ HOÀN THÀNH

---

## Tổng quan

| Phần | Nội dung | File | Thời gian | Trạng thái |
|------|----------|------|-----------|------------|
| 1.1 | Theme System | `constants/theme.ts` | 10p | ✅ |
| 1.2 | Types Definitions | `types/index.ts` | 20p | ✅ |
| 1.3 | Axios Client | `api/axiosClient.ts` | 25p | ✅ |
| 1.4 | API Endpoints | `api/endpoints.ts` | 30p | ✅ |
| 1.5 | Auth Store | `store/useAuthStore.ts` | 25p | ✅ |
| **TỔNG** | | **5 files** | **~110p** | **✅** |

---

## Chi tiết từng phần

### 1.1 Theme System ✅
- **File:** `constants/theme.ts`
- **Nội dung:** 11 colors, 7 spacing, 9 fontSize, 4 fontWeight, 5 borderRadius, 3 shadow levels
- **Colors:** primary (#2563EB), accent (#F59E0B), background (#F8FAFC), text (#1E293B), error (#EF4444), success (#10B981)
- **Export:** theme object gộp + named exports

### 1.2 Types Definitions ✅
- **File:** `types/index.ts`
- **Nội dung:** 25+ TypeScript interfaces
- **Interfaces:** User, UserProfile, Location, Service, Booking, Ticket, TablePass, RoomPass, Review, Voucher, Checkin, Diary, Notification, SosAlert, LeaderboardEntry, BookingReminder, GeoSearchResult, PosArea, PosTable, RealtimeStock, Payment, Recommendations, CreatedLocation, ApiResponse, PaginatedData

### 1.3 Axios Client ✅
- **File:** `api/axiosClient.ts`
- **Nội dung:**
  - baseURL từ `process.env.EXPO_PUBLIC_API_URL`
  - Request interceptor: tự động attach Bearer token
  - Response interceptor: refresh token khi 401 (với queue chống duplicate)
  - Xử lý lỗi: network error, timeout, server error

### 1.4 API Endpoints ✅
- **File:** `api/endpoints.ts`
- **Nội dung:** Map tất cả endpoints từ backend
  - `authApi`: 10 functions (login, register, verifyOtp, forgotPassword, verifyResetOtp, resetPassword, logout, refreshToken, getBackground, checkSession)
  - `userApi`: 25+ functions (profile, checkins, favorites, recommendations, created-locations, vouchers, tickets, diary, reviews, reports, booking-reminders, notifications, leaderboard)
  - `locationApi`: 7 functions (getLocations, getById, services, reviews, posAreas, posTables, realtimeStock)
  - `bookingApi`: 15 functions (create, batch, tablePass, roomPass, payments, confirm-transfer, cancel, contact, preorder)
  - `sosApi`: 3 functions (send, ping, stop)
  - `geoApi`: 2 functions (search, reverse)
  - `pushApi`: 2 functions (register, unregister)
  - `chatApi`: 2 functions (getMessages, sendMessage)

### 1.5 Auth Store ✅
- **File:** `store/useAuthStore.ts`
- **Nội dung:**
  - State: user, isAuthenticated, isLoading, error
  - Actions: login, register, verifyOtp, forgotPassword, verifyResetOtp, resetPassword, logout, loadSession, clearError
  - Token persist qua AsyncStorage
  - Auto load session khi mở app
  - Error handling

---

## Cấu hình bổ sung (cần thiết cho Expo Router)

| File | Nội dung | Trạng thái |
|------|----------|------------|
| `app/_layout.tsx` | Root layout: SafeAreaProvider + GestureHandler + Stack + loadSession | ✅ |
| `index.ts` | Entry point: `import 'expo-router/entry'` | ✅ |
| `app.json` | Tên "Travel Check-in", scheme "travelcheckin", bundle ID | ✅ |
| `tsconfig.json` | TypeScript strict mode | ✅ |
| `App.tsx` | Xóa (không cần vì dùng expo-router) | ✅ |

## Vấn đề phát sinh

| Vấn đề | Giải quyết |
|--------|------------|
| app.json tên sai "mobile-temp2" | Sửa thành "Travel Check-in" |
| index.ts dùng registerRootComponent cũ | Đổi sang expo-router/entry |
| tsconfig baseUrl deprecated | Bỏ baseUrl, dùng relative imports |
| App.tsx cũ không cần | Xóa |

---

## Bước tiếp theo

**Bước 2: Auth Flow** — Tạo giao diện đăng nhập/đăng ký
- 2.1 Root Layout + Tab Navigator
- 2.2 Login Screen
- 2.3 Register + OTP Screen
- 2.4 Forgot Password Screen

---

*Cập nhật: 2026-06-06*
