# Giai đoạn 1: Cụm Màn Hình Xác Thực

Tài liệu này phân tích chi tiết giao diện và luồng hoạt động của cụm tính năng Xác thực, bao gồm 4 luồng chính: Đăng nhập, Đăng nhập Google, Đăng ký (kèm mã xác thực), và Quên mật khẩu.

*(Lưu ý: 100% giao diện sử dụng tiếng Việt, ngôn từ thân thiện, không dùng từ viết tắt hay tiếng Anh lóng).*

## 1. Công nghệ sử dụng cho Giao diện & Xử lý
- **Khung giao diện (UI Framework)**: React Native + Expo Router.
- **Phiên bản nền tảng**: **Bắt buộc Expo SDK 54** để đồng bộ toàn bộ nhánh mobile.
- **Canh chỉnh giao diện (Styling)**: `nativewind` (Tailwind CSS) để canh chỉnh bố cục, khoảng cách chuẩn xác như trang web.
- **Kiểm tra dữ liệu (Form Handling)**: Sử dụng `react-hook-form` kết hợp `zod` để kiểm tra lỗi nhập liệu ngay lập tức (ví dụ: báo lỗi nếu email sai định dạng, mật khẩu ngắn) trước khi gửi yêu cầu lên máy chủ.
- **Xác thực mạng xã hội**: Thư viện `expo-auth-session` để xử lý cửa sổ trình duyệt bật lên khi đăng nhập Google.

### 1.1. Biến môi trường bắt buộc cho auth mobile

```env
EXPO_PUBLIC_API_URL=https://diligent-suffice-paradox.ngrok-free.dev/api
EXPO_PUBLIC_GOOGLE_CLIENT_ID=649280086350-dcnmaq0dg1isfnt7hmtso9paq6r8jgqr.apps.googleusercontent.com
EXPO_PUBLIC_FACEBOOK_APP_ID=4153740721542373
```

Lưu ý:
- Google login trên app phải dùng đúng `EXPO_PUBLIC_API_URL` ở trên để mở route `GET /api/auth/google/mobile` qua ngrok.
- Nếu đổi domain API khác, phải kiểm tra lại toàn bộ callback flow của Google mobile trước khi code hoặc test.

---

## 2. Chi tiết từng màn hình

### 2.1. Màn Hình Đăng Nhập

**Bản vẽ Giao diện:**
```text
------------------------------------------------
|                                              |
|            ( Hình Mascot Robot AI )          |
|                                              |
|         "Chạm để khám phá thế giới!"         |
|                                              |
|  [👤 Email.................................] |
|                                              |
|  [🔒 Mật khẩu..........................[👁️]] |
|                                              |
|  Quên mật khẩu?              [ ĐĂNG NHẬP ]   |
|                                              |
|  --------------- Hoặc ---------------------  |
|                                              |
|  [   (G) Đăng nhập với Google             ]  |
|                                              |
|       Chưa có tài khoản? Đăng ký ngay        |
|                                              |
------------------------------------------------
```

**Cách hoạt động:**
- **Sự kiện "Đăng nhập"**:
  1. **Kiểm tra dữ liệu**: Bấm đăng nhập, hệ thống kiểm tra email và mật khẩu. Nếu sai, hiển thị dòng chữ cảnh báo màu đỏ bên dưới.
  2. **Chờ xử lý**: Nút "Đăng nhập" hiển thị vòng xoay tải dữ liệu, khóa toàn bộ màn hình để tránh bấm nhiều lần.
  3. **Gọi API**: Gửi yêu cầu `POST /api/auth/login`.
  4. **Thành công**: Lưu khóa truy cập (Token) vào bộ nhớ an toàn (`SecureStore`), đồng thời cập nhật trạng thái toàn cục.
  5. **Điều hướng**: Chuyển thẳng người dùng vào **Trang chủ**, xóa lịch sử màn hình này (không cho phép vuốt để quay lại).
  6. **Thất bại**: Hiện thông báo nổi "Sai tài khoản hoặc mật khẩu".

---

### 2.2. Luồng Đăng Nhập Google

**Bản vẽ Giao diện (Cửa sổ trình duyệt an toàn):**
```text
------------------------------------------------
|  accounts.google.com                       X |
|----------------------------------------------|
|        [ G ] Đăng nhập                       |
|                                              |
|   Chọn một tài khoản để tiếp tục tới         |
|   Travel Checkin App                         |
|                                              |
|   [ Avatar ] Nhựt Minh                       |
|              minhmap3367@gmail.com           |
------------------------------------------------
```

**Cách hoạt động:**
  1. Bấm nút `[ (G) Đăng nhập với Google ]`.
  2. Hệ thống bật cửa sổ trình duyệt an toàn mở route backend `GET /api/auth/google/mobile`.
  3. Backend chuyển tiếp sang trang ủy quyền của Google và nhận callback tại `GET /api/auth/google/callback`.
  4. Sau callback, backend trả access token / refresh token về app theo flow đã có.
  5. Ứng dụng lưu quyền và chuyển thẳng vào **Trang chủ**.

Lưu ý rất quan trọng:
  - Theo backend hiện tại, **không có** route `POST /api/auth/google`.
  - Khi làm mobile phải bám đúng một trong hai hướng:
    - server-side redirect flow: `/api/auth/google/mobile` -> `/api/auth/google/callback`
    - hoặc social-login thống nhất bằng `POST /api/auth/social-login` nếu app dùng SDK native để lấy thông tin social account trước.

---

### 2.3. Màn Hình Đăng Ký & Xác thực Email

**Bản vẽ Giao diện:**
```text
------------------------------------------------
|  < Quay lại                                  |
|                                              |
|                 Tạo tài khoản                |
|           Bắt đầu hành trình của bạn         |
|                                              |
|  [👤 Họ và tên.............................] |
|  [✉️ Email.................................] |
|  [📞 Số điện thoại.........................] |
|  [🔒 Mật khẩu..........................[👁️]] |
|  [🔒 Nhập lại mật khẩu.................[👁️]] |
|                                              |
|  [               ĐĂNG KÝ                  ]  |
|                                              |
|        Đã có tài khoản? Đăng nhập ngay       |
|----------------------------------------------|
|                                              |
|  (Màn hình 2: Bắt buộc sau khi Đăng ký)      |
|                                              |
|               Xác thực Email                 |
|    Mã xác thực đã được gửi đến email của bạn |
|                                              |
|    [ Nhập mã 6 số:    [ _ _ _ _ _ _ ]     ]  |
|                                              |
|    [           XÁC NHẬN MÃ                ]  |
|    (Gửi lại mã sau: 59 giây)                 |
------------------------------------------------
```

**Cách hoạt động:**
  1. **Kiểm tra dữ liệu**: Mật khẩu phải từ 6 ký tự. "Nhập lại mật khẩu" phải khớp hoàn toàn.
  2. **Gửi Đăng ký**: Bấm Đăng ký, gọi API `POST /api/auth/register`. Máy chủ tạo người dùng (trạng thái chờ) và gửi email chứa mã số.
  3. **Chuyển sang Màn hình 2 (Xác thực)**: Giao diện chuyển sang màn hình nhập mã và đếm ngược 60 giây. Bắt buộc hoàn thành màn hình này.
  4. **Xác nhận Mã**: Nhập đủ 6 số, bấm "XÁC NHẬN MÃ" -> gọi API `POST /api/auth/verify-otp` (hoặc API tương ứng). Bắt buộc bước này thành công mới được đi tiếp.
  5. **Hoàn tất**: Hiện thông báo nổi "Tạo tài khoản thành công!". Hệ thống tự động chuyển người dùng về lại **Màn hình Đăng nhập**.

---

### 2.4. Màn Hình Quên Mật Khẩu (3 Bước Rõ Ràng)

**Bản vẽ Giao diện:**
```text
------------------------------------------------
|  < Quay lại                                  |
|                                              |
|               Quên mật khẩu?                 |
|   Vui lòng nhập thông tin để nhận mã xác nhận|
|                                              |
|  [✉️ Email.................................] |
|  [📞 Số điện thoại.........................] |
|                                              |
|  [             GỬI MÃ XÁC NHẬN            ]  |
|----------------------------------------------|
|                                              |
|  (Màn hình 2: Bắt buộc sau khi bấm Gửi mã)   |
|                                              |
|  [ Nhập mã 6 số:      [ _ _ _ _ _ _ ]     ]  |
|                                              |
|  [              XÁC NHẬN MÃ               ]  |
|  (Gửi lại mã sau: 59 giây)                   |
|----------------------------------------------|
|                                              |
|  (Màn hình 3: Sau khi xác nhận mã đúng)      |
|                                              |
|  [🔒 Mật khẩu mới......................[👁️]] |
|  [🔒 Nhập lại mật khẩu mới.............[👁️]] |
|                                              |
|  [          XÁC NHẬN ĐỔI MẬT KHẨU         ]  |
------------------------------------------------
```

**Cách hoạt động:**
  1. **Màn hình 1 (Yêu cầu)**: Bắt buộc nhập cả **Email** và **Số điện thoại**. Bấm "GỬI MÃ XÁC NHẬN" -> gọi API `POST /api/auth/forgot-password`.
  2. **Màn hình 2 (Xác thực Mã)**: Chuyển sang giao diện chỉ có ô nhập 6 số. Bấm "XÁC NHẬN MÃ" -> gọi API kiểm tra mã hợp lệ hay không. Bắt buộc thành công mới qua bước 3.
  3. **Màn hình 3 (Đổi Mật khẩu)**: Giao diện chuyển sang bước yêu cầu nhập mật khẩu mới 2 lần. Bấm "XÁC NHẬN ĐỔI MẬT KHẨU" -> gọi API `POST /api/auth/reset-password`.
  4. **Hoàn tất**: Hiện thông báo nổi "Đổi mật khẩu thành công!" và tự động đưa người dùng về **Màn hình Đăng nhập**.

---

## 3. Ghi chú triển khai lại từ đầu

- Folder `mobile/` cũ đã được xóa; Giai đoạn 1 này là đặc tả để dựng lại cụm auth từ đầu.
- Không triển khai đăng nhập Facebook nữa.
- Bắt buộc bám đúng backend hiện tại:
  - `POST /api/auth/login`
  - `POST /api/auth/register`
  - `POST /api/auth/verify-otp`
  - `POST /api/auth/forgot-password`
  - `POST /api/auth/verify-reset-otp`
  - `POST /api/auth/reset-password`
  - `POST /api/auth/refresh-token`
  - `GET /api/auth/google/mobile`
  - `GET /api/auth/google/callback`
  - `GET /api/auth/session`

### 3.1. Quy tắc bắt buộc cho auth

- Mọi màn hình auth phải xử lý `SafeArea` đầy đủ cho header, nút quay lại, vùng form và nút submit.
- Khi bàn phím mở, không để input cuối hoặc nút submit bị che bởi home indicator.
- Sau các luồng thành công như `login`, `register + verify`, `reset password`, bắt buộc điều hướng bằng `router.replace()` để không back ngược về màn hình auth cũ.
- Không để nút quay lại ở màn OTP / reset bị đè lên notch hoặc status bar.
