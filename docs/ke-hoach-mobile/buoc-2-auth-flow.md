# 🔐 BƯỚC 2: AUTH FLOW — Giao diện Đăng nhập/Đăng ký

> **Ngày bắt đầu:** 2026-06-06
> **Mục tiêu:** Tạo giao diện đăng nhập, đăng ký, quên mật khẩu + điều hướng auth ↔ main
> **Tổng thời gian ước tính:** ~1h50p
> **Số phần:** 4

---

## Tổng quan

| # | Phần | Mô tả | Thời gian | Độ khó | Trạng thái |
|---|------|-------|-----------|--------|------------|
| 2.1 | Root Layout + Tab Navigator | Điều hướng auth ↔ main, 5 tabs | 20p | ⭐⭐ TB | ✅ |
| 2.2 | Login Screen | Form đăng nhập + Google OAuth | 30p | ⭐⭐ TB | ✅ |
| 2.3 | Register + OTP Screen | Form đăng ký + nhập OTP 6 số | 35p | ⭐⭐ TB | ✅ |
| 2.4 | Forgot Password Screen | 3 bước: nhập info → OTP → MK mới | 25p | ⭐⭐ TB | ✅ |
| **TỔNG** | | | **~110p** | | **✅** |

---

## PHẦN 2.1: Root Layout + Tab Navigator

### Mô tả
Cập nhật `app/_layout.tsx` để kiểm tra auth state → redirect đúng route.
Tạo `app/(tabs)/_layout.tsx` với 5 tabs: Home, Map, Tickets, Profile, History.

### Chi tiết công việc
```
1. Sửa app/_layout.tsx:
   ├── Đã có: Stack + SafeAreaProvider + loadSession
   ├── Thêm: kiểm tra isAuthenticated
   │   ├── Nếu chưa đăng nhập → hiển thị Stack (login, register, forgot-password)
   │   └── Nếu đã đăng nhập → hiển thị Stack (tabs, booking, location, sos, ...)
   └── Screen options: headerShown: false

2. Tạo app/(tabs)/_layout.tsx:
   ├── Import Tabs từ expo-router
   ├── 5 tabs:
   │   ├── index (Home)     — icon: home-outline
   │   ├── map (Map)        — icon: map-outline
   │   ├── tickets (Tickets)— icon: ticket-outline
   │   ├── profile (Profile)— icon: person-outline
   │   └── history (History)— icon: time-outline
   ├── Tab bar style:
   │   ├── backgroundColor: white
   │   ├── activeTintColor: colors.primary (#2563EB)
   │   ├── inactiveTintColor: colors.textSecondary (#64748B)
   │   └── height: 60, paddingBottom: 8
   └── Screen options: headerShown: false

3. Tạo app/+not-found.tsx:
   ├── Hiển thị "Không tìm thấy trang"
   └── Nút "Về trang chủ"

### File liên quan
- Sửa: app/_layout.tsx
- Tạo mới: app/(tabs)/_layout.tsx, app/+not-found.tsx

### Cách test
- Chạy Expo Go → thấy 5 tabs ở dưới
- Nhấn mỗi tab → chuyển đúng màn hình (dù màn hình trắng)
- Không crash

### Tiêu chí đạt
- [ ] 5 tabs hiển thị
- [ ] Tab bar có icon + màu đúng theme
- [ ] Navigation hoạt động (nhấn tab → chuyển)
- [ ] Không crash

### Đánh giá
- Độ phức tạp: Trung bình
- Rủi ro: Thấp
- Phụ thuộc: theme.ts, useAuthStore.ts (đã có)

---

## PHẦN 2.2: Login Screen

### Mô tả
Giao diện đăng nhập với email + mật khẩu, nút Google OAuth, link quên mật khẩu + đăng ký.

### Chi tiết công việc
```
1. Tạo app/login.tsx

2. UI Components:
   ├── KeyboardAvoidingView (bọc toàn bộ form)
   │   ├── ScrollView (cuộn khi bàn phím hiện)
   │   │   ├── Logo/App name: "Travel Check-in" + emoji 🏖️
   │   │   │
   │   │   ├── Input: Email
   │   │   │   ├── placeholder: "Email"
   │   │   │   ├── keyboardType: "email-address"
   │   │   │   ├── autoCapitalize: "none"
   │   │   │   └── icon: mail-outline
   │   │   │
   │   │   ├── Input: Mật khẩu
   │   │   │   ├── placeholder: "Mật khẩu"
   │   │   │   ├── secureTextEntry: true
   │   │   │   ├── icon: lock-closed-outline
   │   │   │   └── nút hiện/ẩn mật khẩu (eye/eye-off)
   │   │   │
   │   │   ├── Button: "Đăng nhập"
   │   │   │   ├── variant: primary (cam)
   │   │   │   ├── loading: spinner khi đang gọi API
   │   │   │   └── disabled: khi email hoặc password trống
   │   │   │
   │   │   ├── Divider: "── Hoặc ──"
   │   │   │
   │   │   ├── Button: "Đăng nhập bằng Google"
   │   │   │   ├── variant: outline
   │   │   │   ├── icon: logo-google (nếu có) hoặc text "G"
   │   │   │   └── onPress: mở Google OAuth
   │   │   │
   │   │   ├── Error message (nếu có lỗi từ API)
   │   │   │   └── màu đỏ, hiện dưới nút
   │   │   │
   │   │   └── Footer links:
   │   │       ├── "Quên mật khẩu?" → navigate forgot-password
   │   │       └── "Chưa có tài khoản? Đăng ký" → navigate register
   │   │
   │   └── SafeAreaView (bottom)
   │
   └── Background: colors.background (#F8FAFC)

3. Logic:
   ├── State: email, password, showPassword, isLoading, error
   ├── Validate: email không trống, password ≥ 6 ký tự
   ├── onPress "Đăng nhập":
   │   ├── Gọi useAuthStore().login(email, password)
   │   ├── Thành công → tự động chuyển (tabs) vì _layout kiểm tra isAuthenticated
   │   └── Thất bại → hiện error message
   ├── onPress "Google":
   │   ├── Mở expo-web-browser → URL: /api/auth/google/mobile
   │   └── Deep link callback → lưu token → chuyển (tabs)
   └── onPress links → navigate

### File liên quan
- Tạo mới: app/login.tsx

### Cách test
- Mở app → thấy màn hình Login
- Nhập email + password → nhấn Đăng nhập
  - Nếu đúng → chuyển sang Home (tabs)
  - Nếu sai → hiện lỗi "Email hoặc mật khẩu không đúng"
- Nhấn "Đăng ký" → chuyển sang Register
- Nhấn "Quên mật khẩu" → chuyển sang Forgot Password
- Bàn phím không che input (KeyboardAvoidingView)
- Loading spinner khi đang gọi API

### Tiêu chí đạt
- [ ] Form hiển thị đẹp
- [ ] KeyboardAvoidingView hoạt động
- [ ] Login thành công → Home
- [ ] Login thất bại → hiện lỗi
- [ ] Loading state hoạt động
- [ ] Navigation hoạt động (Register, Forgot Password)
- [ ] Google OAuth mở được (không cần test thành công)

### Đánh giá
- Độ phức tạp: Trung bình
- Rủi ro: Google OAuth deep link có thể phức tạp
- Phụ thuộc: useAuthStore.ts, theme.ts, expo-web-browser

---

## PHẦN 2.3: Register + OTP Screen

### Mô tả
Form đăng ký tài khoản mới, sau đó nhập mã OTP 6 số để xác thực email.

### Chi tiết công việc
```
1. Tạo app/register.tsx

2. UI Components (2 bước):

   BƯỚC 1: Thông tin đăng ký
   ├── Header: "← Đăng ký tài khoản"
   │
   ├── Input: Họ tên
   │   ├── placeholder: "Họ và tên"
   │   ├── autoCapitalize: "words"
   │   └── icon: person-outline
   │
   ├── Input: Email
   │   ├── placeholder: "Email"
   │   ├── keyboardType: "email-address"
   │   └── icon: mail-outline
   │
   ├── Input: Số điện thoại
   │   ├── placeholder: "Số điện thoại"
   │   ├── keyboardType: "phone-pad"
   │   └── icon: call-outline
   │
   ├── Input: Mật khẩu
   │   ├── placeholder: "Mật khẩu (≥6 ký tự)"
   │   ├── secureTextEntry: true
   │   └── icon: lock-closed-outline
   │
   ├── Input: Nhập lại mật khẩu
   │   ├── placeholder: "Nhập lại mật khẩu"
   │   ├── secureTextEntry: true
   │   └── icon: lock-closed-outline
   │
   ├── Error message (nếu có)
   │
   ├── Button: "Tiếp theo (Gửi OTP)"
   │   └── Validate → gọi API register → chuyển bước 2
   │
   └── Link: "Đã có tài khoản? Đăng nhập" → navigate login

   BƯỚC 2: Xác nhận OTP
   ├── Header: "← Xác nhận OTP"
   │
   ├── Text: "Mã OTP đã gửi về email {email}"
   │
   ├── 6 ô nhập OTP:
   │   ├── Mỗi ô: 1 TextInput 40x50
   │   ├── Tự động focus ô tiếp theo khi nhập
   │   ├── Tự động submit khi nhập đủ 6 số
   │   └── Nhấn backspace → focus ô trước
   │
   ├── Button: "Xác nhận"
   │   └── Gọi API verifyOtp → thành công → về Login
   │
   ├── Link: "Gửi lại OTP"
   │   ├── Đếm ngược 60 giây
   │   └── Hết giờ → hiện link, nhấn → gọi API register lại
   │
   └── Error message (nếu OTP sai)

3. Logic:
   ├── State: step (1|2), fullName, email, phone, password, confirmPassword, otp[6], isLoading, error, countdown
   ├── Validate bước 1:
   │   ├── Họ tên: không trống, không ký tự đặc biệt
   │   ├── Email: đúng định dạng
   │   ├── SĐT: 10 số, bắt đầu bằng 0
   │   ├── Password: ≥ 6 ký tự
   │   └── Confirm password: khớp với password
   ├── Gọi useAuthStore().register(email, phone, password, fullName)
   ├── Thành công → chuyển bước 2
   ├── Validate bước 2: OTP 6 số
   ├── Gọi useAuthStore().verifyOtp(email, otp)
   ├── Thành công → "Đăng ký thành công!" → navigate login
   └── Countdown: setInterval 60 → 0

### File liên quan
- Tạo mới: app/register.tsx

### Cách test
- Nhập thông tin hợp lệ → gửi OTP → nhận OTP về email
- Nhập đúng OTP → "Đăng ký thành công" → về Login
- Nhập sai OTP → hiện lỗi
- Validate: password không khớp → hiện lỗi
- Validate: email đã tồn tại → hiện lỗi
- Countdown 60s → hết giờ → hiện "Gửi lại OTP"
- Tự động focus ô tiếp theo khi nhập OTP

### Tiêu chí đạt
- [ ] 2 bước hoạt động mượt (chuyển qua lại)
- [ ] OTP 6 ô auto-focus
- [ ] Validate đầy đủ
- [ ] Register thành công → về Login
- [ ] Countdown hoạt động
- [ ] Error handling hoạt động

### Đánh giá
- Độ phức tạp: Trung bình
- Rủi ro: OTP input UX phức tạp (auto-focus, backspace)
- Phụ thuộc: useAuthStore.ts

---

## PHẦN 2.4: Forgot Password Screen

### Mô tả
Quên mật khẩu — 3 bước: nhập email+SĐT → xác nhận OTP → đặt mật khẩu mới.

### Chi tiết công việc
```
1. Tạo app/forgot-password.tsx

2. UI Components (3 bước):

   BƯỚC 1: Nhập email + SĐT
   ├── Header: "← Quên mật khẩu"
   ├── Text: "Nhập email và số điện thoại đã đăng ký"
   ├── Input: Email
   ├── Input: Số điện thoại
   ├── Button: "Gửi OTP"
   └── Error message

   BƯỚC 2: Xác nhận OTP
   ├── Header: "← Xác nhận OTP"
   ├── Text: "Mã OTP đã gửi về email {email}"
   ├── 6 ô nhập OTP (giống Register)
   ├── Button: "Xác nhận"
   ├── Link: "Gửi lại OTP" (đếm ngược 60s)
   └── Error message

   BƯỚC 3: Đặt mật khẩu mới
   ├── Header: "← Đặt mật khẩu mới"
   ├── Input: Mật khẩu mới (≥6 ký tự)
   ├── Input: Nhập lại mật khẩu mới
   ├── Button: "Đặt lại mật khẩu"
   └── Error message

3. Logic:
   ├── State: step (1|2|3), email, phone, otp, newPassword, confirmPassword, isLoading, error, countdown
   ├── Bước 1: Gọi useAuthStore().forgotPassword(email, phone) → chuyển bước 2
   ├── Bước 2: Gọi useAuthStore().verifyResetOtp(email, otp) → chuyển bước 3
   ├── Bước 3: Gọi useAuthStore().resetPassword(email, otp, newPassword)
   ├── Thành công → "Đã đặt lại mật khẩu!" → navigate login
   └── Countdown: giống Register

### File liên quan
- Tạo mới: app/forgot-password.tsx

### Cách test
- Nhập email + SĐT đúng → nhận OTP
- Nhập đúng OTP → chuyển bước 3
- Đặt mật khẩu mới → "Thành công" → về Login
- Login bằng mật khẩu mới → OK
- Nhập email + SĐT sai → "Email hoặc SĐT không đúng"

### Tiêu chí đạt
- [ ] 3 bước hoạt động
- [ ] OTP auto-focus
- [ ] Validate đầy đủ
- [ ] Reset thành công → login được bằng MK mới
- [ ] Countdown hoạt động

### Đánh giá
- Độ phức tạp: Trung bình
- Rủi ro: Thấp
- Phụ thuộc: useAuthStore.ts

---

## Quy trình thực hiện

```
Phần 2.1 (Layout + Tabs) → Code → Test → Bạn OK → Tiếp
Phần 2.2 (Login)         → Code → Test → Bạn OK → Tiếp
Phần 2.3 (Register+OTP)  → Code → Test → Bạn OK → Tiếp
Phần 2.4 (Forgot PW)     → Code → Test → Bạn OK → XONG BƯỚC 2
```

## Phụ thuộc giữa các phần

```
2.1 Layout + Tabs ← Không phụ thuộc (dùng theme + authStore đã có)
2.2 Login         ← Cần 2.1 (navigation)
2.3 Register      ← Cần 2.1 (navigation)
2.4 Forgot PW     ← Cần 2.1 (navigation)
```

→ Code 2.1 trước, sau đó 2.2 + 2.3 + 2.4 (có thể song song)

---

## Tiến độ

| Phần | Bắt đầu | Hoàn thành | Ghi chú |
|------|---------|------------|---------|
| 2.1 Layout + Tabs | — | — | |
| 2.2 Login | — | — | |
| 2.3 Register + OTP | — | — | |
| 2.4 Forgot Password | — | — | |

---

*Cập nhật: 2026-06-06*
