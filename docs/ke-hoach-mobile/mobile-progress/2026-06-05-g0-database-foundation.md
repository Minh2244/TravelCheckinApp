# 📊 Tiến độ Mobile Rebuild — Ngày 2026-06-05

> **Giai đoạn:** 0 (Database) + 1 (Foundation) — Đang thực hiện
> **Cập nhật:** 2026-06-05

---

## Tổng quan tiến độ

| Giai đoạn | Nội dung | Độ khó | Thời gian | Trạng thái |
|-----------|----------|--------|-----------|------------|
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

---

## Giai đoạn 0: Database FK — ✅ HOÀN THÀNH

| Bước | Nội dung | Trạng thái |
|------|----------|------------|
| 0.1 | Thêm FK `location_chat_messages.location_id` → `locations` | ✅ |
| 0.2 | Thêm FK `location_chat_messages.sender_id` → `users` | ✅ |
| 0.3 | Thêm FK `user_active_sessions.user_id` → `users` | ✅ |
| 0.4 | Thêm FK `user_diary.checkin_id` → `checkins` | ✅ |
| 0.5 | Thêm FK `booking_preorder_items.booking_id` → `bookings` | ✅ |
| 0.6 | Thêm FK `booking_preorder_items.location_id` → `locations` | ✅ |
| 0.7 | Thêm FK `booking_preorder_items.service_id` → `services` | ✅ |
| 0.8 | Kiểm tra dữ liệu mồ côi (0 orphaned) | ✅ |
| 0.9 | Xác nhận website hoạt động bình thường | ✅ |

---

## Giai đoạn 1: Foundation — ⏳ ĐANG LÀM (70%)

| Bước | Nội dung | Trạng thái |
|------|----------|------------|
| 1.1 | Backup `.env` | ✅ |
| 1.2 | Xóa mobile cũ (giữ `.env`) | ✅ |
| 1.3 | Tạo Expo SDK 54 mới (blank-typescript) | ✅ |
| 1.4 | Cài 27 dependencies (expo-router, maps, zustand, axios, etc.) | ✅ |
| 1.5 | Sửa tên project → `travel-checkin-mobile` | ✅ |
| 1.6 | Khôi phục `.env` gốc | ✅ |
| 1.7 | Tạo cấu trúc thư mục (app/, api/, components/, store/, types/, hooks/, utils/) | ✅ |
| 1.8 | Tạo 33 file placeholder (rỗng) | ✅ |
| 1.9 | Theme system (`constants/theme.ts`) | ⏸️ CHỜ |
| 1.10 | Types definitions (`types/index.ts`) | ⏸️ CHỜ |
| 1.11 | Axios Client (`api/axiosClient.ts`) | ⏸️ CHỜ |
| 1.12 | API Endpoints mapping (`api/endpoints.ts`) | ⏸️ CHỜ |
| 1.13 | Auth Store (`store/useAuthStore.ts`) | ⏸️ CHỜ |

### Cấu trúc đã tạo

```
mobile/
├── .env                              ✅ (nguyên vẹn)
├── app/
│   ├── _layout.tsx                   ✅ (rỗng)
│   ├── +not-found.tsx                ✅ (rỗng)
│   ├── login.tsx                     ✅ (rỗng)
│   ├── register.tsx                  ✅ (rỗng)
│   ├── forgot-password.tsx           ✅ (rỗng)
│   ├── (tabs)/
│   │   ├── _layout.tsx               ✅ (rỗng)
│   │   ├── index.tsx                 ✅ (rỗng)
│   │   ├── map.tsx                   ✅ (rỗng)
│   │   ├── tickets.tsx               ✅ (rỗng)
│   │   ├── profile.tsx               ✅ (rỗng)
│   │   └── history.tsx               ✅ (rỗng)
│   ├── booking/[serviceId].tsx       ✅ (rỗng)
│   ├── location/[id].tsx             ✅ (rỗng)
│   ├── sos/
│   │   ├── _layout.tsx               ✅ (rỗng)
│   │   └── index.tsx                 ✅ (rỗng)
│   ├── checkin.tsx                   ✅ (rỗng)
│   ├── diary.tsx                     ✅ (rỗng)
│   ├── leaderboard.tsx               ✅ (rỗng)
│   ├── notifications.tsx             ✅ (rỗng)
│   ├── saved-locations.tsx           ✅ (rỗng)
│   ├── vouchers.tsx                  ✅ (rỗng)
│   └── booking-reminders.tsx         ✅ (rỗng)
├── api/
│   ├── axiosClient.ts                ✅ (rỗng)
│   └── endpoints.ts                  ✅ (rỗng)
├── components/
│   ├── Button.tsx                    ✅ (rỗng)
│   ├── Card.tsx                      ✅ (rỗng)
│   ├── Input.tsx                     ✅ (rỗng)
│   ├── Header.tsx                    ✅ (rỗng)
│   ├── Avatar.tsx                    ✅ (rỗng)
│   ├── Badge.tsx                     ✅ (rỗng)
│   ├── EmptyState.tsx                ✅ (rỗng)
│   ├── LoadingOverlay.tsx            ✅ (rỗng)
│   ├── RatingStars.tsx               ✅ (rỗng)
│   └── SegmentedControl.tsx          ✅ (rỗng)
├── store/
│   └── useAuthStore.ts               ✅ (rỗng)
├── constants/
│   └── theme.ts                      ✅ (rỗng)
├── types/
│   └── index.ts                      ✅ (rỗng)
├── hooks/
│   └── index.ts                      ✅ (rỗng)
├── utils/
│   └── index.ts                      ✅ (rỗng)
└── assets/
    ├── images/                       ✅
    └── fonts/                        ✅
```

### Dependencies đã cài (27 packages)

| Nhóm | Thư viện | Version |
|------|----------|---------|
| Expo Core | expo | ~56.0.8 |
| Expo Core | expo-constants | ~56.0.16 |
| Expo Core | expo-status-bar | ~56.0.4 |
| Expo Core | expo-font | ~56.0.5 |
| Expo Core | expo-splash-screen | ~56.0.10 |
| Navigation | expo-router | ~56.2.8 |
| Navigation | expo-linking | ~56.0.13 |
| Navigation | expo-web-browser | ~56.0.5 |
| UI/UX | react-native-safe-area-context | ~5.7.0 |
| UI/UX | react-native-screens | 4.25.2 |
| UI/UX | react-native-gesture-handler | ~2.31.1 |
| UI/UX | react-native-reanimated | 4.3.1 |
| UI/UX | @react-native-community/datetimepicker | 9.1.0 |
| Media | expo-image-picker | ~56.0.15 |
| Media | expo-file-system | ~56.0.7 |
| Media | expo-sharing | ~56.0.15 |
| Map | react-native-maps | 1.27.2 |
| State | zustand | ^5.0.14 |
| State | @react-native-async-storage/async-storage | 2.2.0 |
| API | axios | ^1.17.0 |
| QR | react-native-qrcode-svg | ^6.3.21 |
| Utils | date-fns | ^4.4.0 |

---

## Quyết định thiết kế đã chốt

| Quyết định | Chi tiết |
|-----------|---------|
| Theme | Primary `#2563EB`, Accent `#F59E0B`, BG `#F8FAFC`, Text `#1E293B` |
| Font | System default (Android: Roboto, iOS: SF Pro) |
| Map | OSM tiles via `react-native-maps` + `UrlTile`, KHÔNG Google Maps |
| Home sorting | GPS gần nhất mặc định |
| Map markers | Ảnh tròn (circular) |
| Booking flow | QR + "Xác nhận đã chuyển" + "Sao chép thông tin" |
| Single-session | Giữ nguyên (1 device) |
| Chat + AI | KHÔNG làm trên mobile |

---

## Vấn đề phát sinh

| Ngày | Vấn đề | Giải quyết |
|------|--------|------------|
| 2026-06-05 | `npm install` bị peer dependency conflict (react-dom vs react) | Dùng `--legacy-peer-deps` |
| 2026-06-05 | `create-expo-app` bị kẹt ở git prompt | Pipe `echo y` hoặc dùng `--no-git` |

---

## Tài liệu đã tạo

| File | Nội dung |
|------|---------|
| `docs/mobile-rebuild-plan.md` | Kế hoạch tổng + UI mockups + technical specs |
| `docs/mobile-feature-spec.md` | Đặc tả chi tiết 48 chức năng (logic, flow, API) |
| `docs/mobile-execution-steps.md` | 36 bước thực hiện chi tiết (mỗi bước test được) |
| `docs/mobile-progress/2026-06-05-g0-database-foundation.md` | Tiến độ hiện tại |

## Bước tiếp theo

| # | Nội dung | Giai đoạn |
|---|----------|-----------|
| 1 | Viết theme system (`constants/theme.ts`) | 1 |
| 2 | Viết types definitions (`types/index.ts`) | 1 |
| 3 | Viết Axios Client (`api/axiosClient.ts`) | 1 |
| 4 | Viết API Endpoints (`api/endpoints.ts`) | 1 |
| 5 | Viết Auth Store (`store/useAuthStore.ts`) | 1 |
| 6 | Bắt đầu Giai đoạn 2: Auth Flow | 2 |

---

*Cập nhật: 2026-06-05 13:40*
