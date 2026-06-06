# 📊 Tiến độ Mobile Rebuild — Bước 2: Auth Flow

> **Ngày:** 2026-06-06
> **Trạng thái:** ✅ HOÀN THÀNH

---

## Tổng quan

| Phần | Nội dung | File | Trạng thái |
|------|----------|------|------------|
| 2.1 | Root Layout + Tab Navigator | `app/_layout.tsx`, `app/(tabs)/_layout.tsx`, `app/+not-found.tsx` | ✅ |
| 2.2 | Login Screen | `app/login.tsx` | ✅ |
| 2.3 | Register + OTP Screen | `app/register.tsx` | ✅ |
| 2.4 | Forgot Password Screen | `app/forgot-password.tsx` | ✅ |

---

## Chi tiết

### 2.1 Root Layout + Tab Navigator ✅
- **app/_layout.tsx**: Kiểm tra auth state → redirect (chưa đăng nhập → login, đã đăng nhập → tabs)
- **app/(tabs)/_layout.tsx**: 5 tabs (Home, Bản đồ, Vé, Hồ sơ, Lịch sử) với Ionicons
- **app/+not-found.tsx**: 404 page
- **app/(tabs)/index.tsx, map.tsx, tickets.tsx, profile.tsx, history.tsx**: Placeholder screens

### 2.2 Login Screen ✅
- **app/login.tsx**: Form đăng nhập đầy đủ
  - Input Email + Password (hiện/ẩn)
  - Nút "Đăng nhập" (primary, loading)
  - Nút "Đăng nhập bằng Google" (expo-web-browser)
  - Error message
  - Links: Quên mật khẩu | Đăng ký
  - KeyboardAvoidingView

### 2.3 Register + OTP Screen ✅
- **app/register.tsx**: 2 bước
  - Bước 1: Họ tên + Email + SĐT + Mật khẩu + Nhập lại MK
  - Bước 2: 6 ô OTP (auto-focus, auto-submit, backspace)
  - Countdown 60s gửi lại OTP
  - Validate đầy đủ

### 2.4 Forgot Password Screen ✅
- **app/forgot-password.tsx**: 3 bước
  - Bước 1: Nhập Email + SĐT
  - Bước 2: Xác nhận OTP (6 ô, countdown)
  - Bước 3: Đặt mật khẩu mới
  - Thành công → về Login

---

## Dependencies bổ sung

| Package | Lý do |
|---------|-------|
| `@expo/vector-icons` | Ionicons cho tab icons + form icons |
| `react-native-worklets@0.8.3` | Fix compatibility với SDK 54 |

---

## Vấn đề phát sinh

| Vấn đề | Giải quyết |
|--------|------------|
| `react-native-worklets` version conflict | Downgrade về 0.8.3 (compatible với reanimated 4.1.x) |
| `@expo/vector-icons` chưa cài | Cài thủ công |

---

## Bước tiếp theo

**Bước 3: Tab Screens** — Home, Profile, Notifications

---

*Cập nhật: 2026-06-06*
