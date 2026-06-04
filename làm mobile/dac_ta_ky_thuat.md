# Báo cáo Đặc tả Kỹ thuật & Kiến trúc Hệ thống: Vai trò User (Tourist)
*Nền tảng mục tiêu: Expo Router (React Native, SDK 56)*

Tài liệu đặc tả kỹ thuật này ghi chép chính xác cấu trúc hệ thống, quản lý trạng thái, danh sách endpoint API, cấu hình bản đồ/chỉ đường và quy trình nghiệp vụ được trích xuất trực tiếp từ mã nguồn TravelCheckin. Đây là tài liệu nguồn chuẩn (Single Source of Truth - SSOT) để cung cấp cho Google AI Studio phục vụ việc xây dựng phiên bản Mobile App.

---

## 1. Kiến trúc Cốt lõi & Công nghệ

### Backend Stack
* **Ngôn ngữ & Runtime:** TypeScript / Node.js (v18+)
* **Framework:** Express.js `^5.2.1`
* **Cơ sở dữ liệu & Driver:** MySQL (v8.0+), sử dụng thư viện `mysql2` `^3.16.0` (hỗ trợ connection pooling)
* **Xác thực & Bảo mật:** 
  * `jsonwebtoken` `^9.0.3` (xác thực dựa trên token JWT)
  * `bcryptjs` `^3.0.3` / `bcrypt` `^6.0.0` (mã hóa mật khẩu)
  * `helmet` `^8.1.0` (bảo mật HTTP headers)
  * Thuật toán giới hạn tần suất (Rate Limiting) in-memory (Token Bucket: nạp 1 token/giây, dung lượng tối đa 60) áp dụng cho các API tìm kiếm tọa độ địa lý.
* **Giao tiếp Realtime:** 
  * Server-Sent Events (SSE) qua route `/api/events` (truyền token JWT qua query parameters)
  * `socket.io` `^4.8.3` (WebSockets hub)
* **Thông báo đẩy (Push Notifications):** `firebase-admin` `^13.6.0` (Google Cloud Messaging)

### Web Frontend Stack
* **Framework & Build Tool:** React `^19.2.0`, Vite `^7.2.4`
* **Ngôn ngữ:** TypeScript `~5.9.3`
* **Styling:** TailwindCSS `^3.4.17`
* **Quản lý trạng thái:** Cài đặt sẵn thư viện `zustand` `^5.0.9`, nhưng thực tế mã nguồn trang Web chủ yếu lưu trữ qua `sessionStorage` và các state cục bộ của React.
* **UI Components:** Ant Design (`antd`) `^6.1.4`
* **Bản đồ:** Leaflet `^1.9.4` và React-Leaflet `^5.0.0` (kết hợp `leaflet-polylinedecorator` `^1.6.0`)
* **API Client:** Axios `^1.13.2`

### Kiến trúc phân rã (Decoupling)
Hệ thống sử dụng mô hình kiến trúc phân rã hoàn toàn, hướng API. Frontend Web và Mobile App liên kết với Express Backend thông qua các API REST dạng JSON chuẩn hóa.
* **Cấu hình API URL:** Bản Web sử dụng `import.meta.env.VITE_API_URL`. Bản mobile phải sử dụng `process.env.EXPO_PUBLIC_API_URL` (trỏ đến URL công khai của Ngrok trong quá trình phát triển cục bộ).
* **Đồng bộ thời gian thực:** Frontend lắng nghe các sự kiện thời gian thực thông qua SSE (`/api/events?token=<accessToken>`) hoặc WebSockets. Khi có thay đổi trạng thái ở Backend (ví dụ: Owner duyệt đơn, PMS cập nhật phòng, POS hoàn tất hóa đơn), Backend sẽ phát sự kiện để Frontend tự động tải lại dữ liệu mới nhất.

---

## 2. Quản lý trạng thái & Luồng Xác thực

### Phân tích trạng thái & Lưu trữ
Mặc dù `zustand` có khai báo trong dependency của web frontend, hệ thống Web thực tế không dùng store Zustand toàn cục. Trạng thái người dùng được lưu trực tiếp trong `sessionStorage` để duy trì khi chuyển trang.

#### Các key lưu trữ trong `sessionStorage`:
1. `accessToken` (string): Token JWT dùng để gửi kèm trong header mỗi request.
2. `refreshToken` (string): Token JWT dùng để yêu cầu cấp lại Access Token mới.
3. `user` (chuỗi JSON): Thông tin tài khoản đăng nhập hiện tại, khớp với interface `User`:
   ```typescript
   export interface User {
     user_id: number;
     email: string;
     phone: string | null;
     full_name: string;
     role: "user" | "owner" | "employee" | "admin";
     avatar_url: string | null;
     is_verified: number;
   }
   ```
4. `userMapNearbyRadius` / `userMapCustomRadiusInput`: Cấu hình bán kính tìm kiếm địa điểm trên bản đồ.
5. `userMapRoute`: Lưu trữ thông tin tọa độ đích, chế độ di chuyển và trạng thái hiển thị tuyến đường để vẽ lại khi reload map.

> [!TIP]
> **Khuyến nghị triển khai trên Mobile:**
> Đối với ứng dụng di động Expo Router, bạn nên triển khai một store Zustand toàn cục (`useAuthStore`) kết hợp với `expo-secure-store` hoặc `AsyncStorage` để mô phỏng chính xác hành vi lưu trữ của phiên bản Web nhưng chạy tối ưu trên ứng dụng Native.

### Chi tiết Luồng Xác thực

#### 1. Đăng ký & Đăng nhập truyền thống
* **Đăng ký (`POST /api/auth/register`):**
  * Đầu vào: `email`, `phone`, `password`, `full_name`.
  * Logic xử lý: Mã hóa mật khẩu bằng `bcrypt.hash(password, 10)`. Thêm bản ghi mới vào bảng `users` với `status = 'pending'` và `is_verified = 0`. Tạo mã OTP ngẫu nhiên gồm 6 chữ số, lưu vào bảng `otp_codes` và gửi qua email đăng ký của người dùng bằng nodemailer (`sendOTPEmail`).
* **Xác thực OTP (`POST /api/auth/verify-otp`):**
  * Đầu vào: `email`, `otp`.
  * Logic xử lý: Kiểm tra mã OTP khớp và còn hiệu lực từ bảng `otp_codes`. Cập nhật trạng thái người dùng thành `is_verified = 1`, `verified_at = NOW()` và `status = 'active'`.
* **Đăng nhập (`POST /api/auth/login`):**
  * Đầu vào: `email`, `password`.
  * Logic xử lý: Kiểm tra email và mật khẩu, kiểm tra chống brute-force (khóa tài khoản tạm thời 5 phút nếu nhập sai quá 5 lần), đảm bảo quyền hạn hợp lệ. Sinh ra một `sessionId` (UUIDv4) mới và cập nhật trạng thái hoạt động trong cơ sở dữ liệu (tự động thu hồi phiên đăng nhập trước đó của tài khoản bằng cách phát sự kiện `session_revoked` qua Socket/SSE). Trả về bộ ba `accessToken`, `refreshToken` và object thông tin `user`.

#### 2. Đăng nhập qua mạng xã hội (Google & Facebook OAuth)
* **Quy trình phía Web:**
  * Bấm nút đăng nhập sẽ mở một cửa sổ popup dẫn đến Dialog OAuth của nhà cung cấp (`https://accounts.google.com/o/oauth2/v2/auth` hoặc `https://www.facebook.com/v18.0/dialog/oauth`) kèm theo `response_type=token` và `redirect_uri=http://localhost:5173/auth/google/callback` (hoặc `/facebook/callback`).
  * Trang callback sau khi chuyển hướng thành công sẽ trích xuất tham số `access_token` từ URL hash, lấy thông tin cá nhân và dùng lệnh `window.opener.postMessage` gửi ngược thông tin về cửa sổ chính.
  * Cửa sổ chính lắng nghe sự kiện (`GOOGLE_AUTH_SUCCESS` hoặc `FACEBOOK_AUTH_SUCCESS`) thu thập thông tin người dùng (socialId, email, fullName, avatarUrl) và gọi API backend:
    `POST /api/auth/social-login`
    ```json
    {
      "provider": "google" | "facebook",
      "socialId": "id-mang-xa-hoi-doc-nhat",
      "email": "user@example.com",
      "fullName": "Tên Người Dùng",
      "avatarUrl": "https://lh3.googleusercontent.com/..."
    }
    ```
* **Xử lý phía Backend (`authController.ts`):**
  * Nếu người dùng có `google_id` hoặc `facebook_id` trùng khớp với `socialId` đã tồn tại, tiến hành đăng nhập trực tiếp.
  * Nếu email của tài khoản mạng xã hội đã tồn tại trong DB nhưng chưa liên kết, tự động cập nhật liên kết `google_id` hoặc `facebook_id` vào tài khoản cũ và đăng nhập.
  * Nếu tài khoản chưa từng tồn tại, tiến hành tạo mới bản ghi người dùng với trạng thái `status = 'active'`, `is_verified = 1` và đặt trường `password_hash = NULL`.
  * Sinh token và trả về `accessToken`, `refreshToken`, `user` tương tự luồng đăng nhập thường.

### Axios Interceptors & Truyền Token tự động
Đường dẫn file: [axiosClient.ts](file:///e:/TravelCheckinApp/website/src/api/axiosClient.ts)

#### Request Interceptor:
Tự động lấy token từ `sessionStorage` và chèn vào header `Authorization` dưới dạng Bearer Token:
```typescript
axiosClient.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("accessToken");
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

#### Response Interceptor & Xử lý lỗi toàn cục:
1. **Kiểm tra đăng nhập nơi khác (`SESSION_REVOKED`):**
   Nếu mã phản hồi trả về lỗi có code là `SESSION_REVOKED` (do tài khoản vừa đăng nhập trên thiết bị mới), interceptor sẽ phát ra một sự kiện tùy biến `"tc-session-revoked"` để cảnh báo người dùng.
2. **Các trường hợp buộc Đăng xuất (Force Logout):**
   Nếu trạng thái phản hồi HTTP trả về lỗi `401` (Unauthorized) hoặc lỗi `403` (Forbidden) liên quan đến các mã lỗi:
   * Tài khoản bị khóa (`ACCOUNT_LOCKED` hoặc chứa chuỗi "tài khoản đã bị khóa")
   * Tài khoản Owner đang chờ duyệt (`OWNER_NOT_APPROVED` hoặc chứa chuỗi "owner đang chờ admin duyệt")
   Axios Interceptor sẽ tự động xóa sạch toàn bộ khóa trong phiên làm việc (`accessToken`, `refreshToken`, `user`...) và điều hướng người dùng ngay lập tức về trang `/login`.

---

## 3. Đặc tả chi tiết Endpoint API dành cho Tourist
Tất cả các API này yêu cầu truyền kèm Token JWT hợp lệ trong header (`Authorization: Bearer <accessToken>`).

### 1. Nhóm API Xác thực (`/api/auth`)
* `POST /api/auth/register` - Đăng ký tài khoản người dùng mới (chờ xác thực).
* `POST /api/auth/verify-otp` - Kích hoạt tài khoản bằng mã OTP 6 số gửi qua email.
* `POST /api/auth/login` - Đăng nhập tài khoản bằng Email/Mật khẩu. Nhận về bộ đôi token.
* `POST /api/auth/social-login` - Đăng nhập bằng liên kết OAuth mạng xã hội (Google/Facebook).
* `POST /api/auth/forgot-password` - Yêu cầu gửi mã OTP đặt lại mật khẩu qua email.
* `POST /api/auth/verify-reset-otp` - Xác thực mã OTP đặt lại mật khẩu.
* `POST /api/auth/reset-password` - Đặt mật khẩu mới bằng mã OTP đã được xác minh.
* `POST /api/auth/refresh-token` - Đổi mã `accessToken` mới bằng `refreshToken`.
* `POST /api/auth/logout` - Đăng xuất và vô hiệu hóa phiên làm việc hiện tại.
* `GET /api/auth/session` - Kiểm tra tính hợp lệ của token phiên đăng nhập hiện tại.
* `GET /api/auth/background` - Lấy hình ảnh nền của trang đăng nhập.
* `GET /api/auth/app-background` - Lấy hình ảnh nền chung của ứng dụng.

### 2. Thông tin cá nhân & Tương tác xã hội (`/api/user`)
* `GET /api/user/profile` - Lấy thông tin cá nhân đầy đủ của khách du lịch.
* `PUT /api/user/profile` - Cập nhật thông tin cá nhân (họ tên, điện thoại, địa chỉ,...).
* `POST /api/user/profile/avatar` - Tải lên ảnh đại diện mới (multipart/form-data tên file `avatar`).
* `POST /api/user/profile/background` - Tải lên ảnh nền trang cá nhân (multipart/form-data tên file `background`).
* `GET /api/user/profile/login-history` - Xem lịch sử đăng nhập (hỗ trợ tham số `page`, `limit`, `success`, `from`, `to`).
* `GET /api/user/checkins` - Danh sách lịch sử các điểm đã check-in hoặc lưu lại.
* `POST /api/user/checkins` - Tạo một bản ghi check-in mới tại tọa độ hiện tại.
* `DELETE /api/user/checkins/:id` - Xóa lịch sử một bản ghi check-in.
* `POST /api/user/checkins/photo` - Thực hiện check-in kèm theo tải lên một tệp ảnh thực tế.
* `GET /api/user/favorites` - Lấy danh sách địa điểm yêu thích đã lưu.
* `PATCH /api/user/favorites/:locationId` - Thêm/sửa ghi chú hoặc nhãn dán cho địa điểm yêu thích.
* `DELETE /api/user/favorites/:locationId` - Xóa địa điểm khỏi danh sách yêu thích.
* `GET /api/user/recommendations/locations` - Lấy danh sách địa điểm gợi ý thông minh cho người dùng.
* `GET /api/user/created-locations` - Danh sách các địa điểm do chính người dùng này đóng góp/đề xuất.
* `PATCH /api/user/created-locations/:id` - Sửa thông tin địa điểm đóng góp của mình.
* `DELETE /api/user/created-locations/:id` - Xóa địa điểm đóng góp của mình.
* `GET /api/user/vouchers/location/:locationId` - Lấy danh sách các ưu đãi (vouchers) đang phát hành tại địa điểm.
* `GET /api/user/vouchers/saved` - Lấy danh sách các mã voucher người dùng đã lưu/đã thu thập.
* `POST /api/user/vouchers/:id/claim` - Thu thập/Lưu một mã giảm giá.
* `GET /api/user/tickets` - Danh sách vé tham quan du lịch đang sở hữu (hỗ trợ lọc theo `location_id`).
* `GET /api/user/diary` - Danh sách nhật ký hành trình.
* `POST /api/user/diary` - Tạo mới một nhật ký (cảm xúc, ghi chú, hình ảnh, địa điểm).
* `DELETE /api/user/diary/:id` - Xóa một bản ghi nhật ký.
* `POST /api/user/reviews/upload` - Tải lên hình ảnh đính kèm bài đánh giá địa điểm.
* `POST /api/user/reviews` - Viết bài đánh giá và chấm điểm (ratings) cho địa điểm.
* `DELETE /api/user/reviews/:id` - Xóa bài đánh giá của mình.
* `POST /api/user/reviews/:id/reply` - Phản hồi/trả lời một bài bình luận/đánh giá.
* `POST /api/user/reports/location` - Báo cáo vi phạm địa điểm (spam, lừa đảo, hình ảnh phản cảm,...).
* `GET /api/user/leaderboard` - Bảng xếp hạng thành tích người dùng (hỗ trợ lọc theo tỉnh/thành, tháng).
* `GET /api/user/booking-reminders` - Danh sách các nhắc nhở lịch trình sắp diễn ra.
* `GET /api/user/notifications` - Danh sách thông báo đẩy gửi cho người dùng.
* `POST /api/user/notifications/read-all` - Đánh dấu tất cả thông báo là đã đọc.
* `POST /api/user/notifications/delete-all` - Xóa toàn bộ lịch sử thông báo của tài khoản.
* `POST /api/user/notifications/location-invite` - Gửi lời mời check-in/chia sẻ vị trí đến bạn bè.

### 3. Đặt chỗ & Giao dịch (`/api/bookings`)
* `POST /api/bookings` - Tạo đơn đặt chỗ (bàn nhà hàng, phòng khách sạn, vé tham quan). Các tham số:
  ```json
  {
    "location_id": 10,
    "service_id": 25,
    "check_in_date": "YYYY-MM-DD HH:mm:ss",
    "check_out_date": "YYYY-MM-DD HH:mm:ss",
    "quantity": 1,
    "source": "mobile",
    "contact_name": "Nguyễn Văn A",
    "contact_phone": "0987654321",
    "notes": "Ghi chú bổ sung",
    "voucher_code": "GIAMGIA10",
    "reserve_on_confirm": true,
    "table_ids": [1, 2],
    "preorder_items": [{"service_id": 12, "quantity": 2}],
    "ticket_items": [{"service_id": 15, "quantity": 3}]
  }
  ```
* `POST /api/bookings/batch` - Đặt phòng hàng loạt (đặt gộp nhiều phòng khách sạn trong một đơn).
* `POST /api/bookings/batch/payments` - Khởi tạo mã chuyển khoản VietQR gộp cho đơn phòng hàng loạt.
* `POST /api/bookings/batch/rooms/confirm-transfer` - Người dùng xác nhận đã chuyển khoản thành công đơn đặt phòng gộp.
* `PUT /api/bookings/batch/contact` - Cập nhật thông tin liên hệ của khách lưu trú cho đơn phòng hàng loạt.
* `POST /api/bookings/:id/payments` - Lấy thông tin thanh toán (mã giao dịch, dữ liệu mã VietQR) của một đơn đặt chỗ đơn lẻ.
* `POST /api/bookings/:id/tickets/confirm-transfer` - Người dùng xác nhận đã chuyển khoản đơn mua vé du lịch.
* `POST /api/bookings/:id/tables/confirm-transfer` - Người dùng xác nhận đã chuyển khoản đơn đặt trước món ăn nhà hàng.
* `POST /api/bookings/:id/rooms/confirm-transfer` - Người dùng xác nhận đã chuyển khoản đơn đặt một phòng khách sạn.
* `GET /api/bookings/table-reservations/mine` - Lấy danh sách các bàn nhà hàng đã đặt.
* `GET /api/bookings/table-reservations/pass` - Lấy danh sách các vỏ vé/thẻ thông hành đặt bàn nhà hàng đang hoạt động.
* `GET /api/bookings/room-reservations/pass` - Lấy danh sách thẻ thông hành/vé nhận phòng khách sạn.
* `POST /api/bookings/:id/tables/cancel` - Yêu cầu hủy một đơn đặt bàn nhà hàng.
* `POST /api/bookings/:id/tables/preorder` - Cập nhật/bổ sung món ăn gọi trước cho bàn đã đặt chỗ.
* `POST /api/bookings/:id/cancel` - Yêu cầu hủy đơn đặt phòng khách sạn hoặc vé tham quan du lịch.

---

## 4. Bản đồ OpenStreetMap (OSM) & Logic Chỉ đường

### Cấu hình các lớp bản đồ
Bản đồ trong file [UserMap.tsx](file:///e:/TravelCheckinApp/website/src/pages/User/UserMap.tsx) cấu hình 4 lớp bản đồ nền khác nhau:
```typescript
const tileOptions = [
  {
    key: "osm",
    label: "Bản đồ tiêu chuẩn",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  },
  {
    key: "positron",
    label: "Bản đồ sáng",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
  },
  {
    key: "voyager",
    label: "Bản đồ đường phố",
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
  },
  {
    key: "satellite",
    label: "Vệ tinh",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: '&copy; <a href="https://www.esri.com/">Esri</a> &mdash; Source: Esri, Maxar, Earthstar Geographics...'
  }
];
```

### Xử lý chọn vị trí & Gửi tuyến đường
1. Bản đồ sử dụng component trung gian `MapClickHandler` lắng nghe sự kiện **nhấp đúp chuột (`dblclick`)** trên bản đồ để lấy tọa độ. Điều này tránh việc người dùng nhấp đơn nhầm làm nhảy ghim. Tọa độ nhận về có dạng `{ lat, lng }` (lưu vào state `pickedCoords` hoặc `routeTarget`).
2. Khi kích hoạt chế độ chỉ đường (`routeEnabled: true`) từ vị trí hiện tại của thiết bị (`myPosition`) đến điểm đích (`routeTarget`).
3. Ứng dụng gửi request lấy danh sách các điểm đi qua đến API OSRM theo cấu trúc:
   * **URL chính:** `https://router.project-osrm.org/route/v1/${routeProfile}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&alternatives=true`
   * **URL dự phòng (OSM backup):** `https://routing.openstreetmap.de/routed-${routeProfile}/route/v1/${routeProfile}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&alternatives=true`
   * Biến `${routeProfile}` nhận giá trị `"driving"` (dành cho ô tô/xe máy đường bộ) hoặc `"foot"` (đi bộ).

### Thuật toán ngăn chỉ đường xuống nước (Chặn chỉ đường xuống sông Cần Thơ)
Hệ thống không sử dụng một mảng cứng danh sách tọa độ các đa giác sông để đối chiếu thủ công trên client. Thay vào đó, nó dựa trên cấu trúc liên kết mạng giao thông (road network topology) của API OSRM.

1. **Kiểm tra cấu trúc liên kết:** Khi người dùng click chọn điểm đích hoặc yêu cầu chỉ đường đến một vị trí nằm giữa lòng sông Cần Thơ (các khu vực chợ nổi không nối liền cầu bộ, sông ngòi, hoặc vùng biển đảo hoang sơ), máy chủ OSRM phân tích và không thể tìm thấy bất cứ đoạn đường bộ nào kết nối đến điểm này.
2. **Bắt mã lỗi phản hồi:** API OSRM sẽ trả về phản hồi lỗi HTTP `400` hoặc `422` kèm theo nội dung lỗi là `{ "code": "NoRoute" }`. Phía Web bắt điều kiện lỗi này và ném ra một ngoại lệ:
   ```typescript
   if (errBody.code === "NoRoute") {
     throw new Error("NoRoute");
   }
   ```
3. **Chuyển đổi sang đường chim bay (Haversine Fallback):** Khi bắt được lỗi `NoRoute`:
   * Bản đồ tự động chuyển sang chế độ vẽ đường chim bay bằng cách vẽ một đường thẳng trực tiếp nối hai tọa độ: `setRouteLines([[from, to]])`.
   * Cập nhật thông tin lộ trình `routeInfo` với cờ hiệu `hasNoRoute: true` và tính toán khoảng cách hình học theo công thức Haversine `haversineMeters(from, to)`.
4. **Hiển thị cảnh báo người dùng:** Giao diện bản đồ hiển thị một thẻ cảnh báo màu cam với nội dung:
   * **Nội dung hiển thị:** `"Không tìm thấy đường bộ đến điểm này (ngoài khơi, sông hồ hoặc vùng biệt lập)"`
   * **Chi tiết:** Hiện khoảng cách chim bay ("Khoảng cách chim bay: X.XX km") và ghi rõ thời gian ước tính di chuyển là "không khả dụng".

### Tạo Marker hình tròn chứa ảnh đại diện của Owner
Khi hiển thị địa điểm của Owner trên bản đồ, marker Leaflet được tùy biến thành dạng container tròn chứa ảnh đại diện của địa điểm đó. Mã nguồn sinh DivIcon tùy biến:

```typescript
const getCircleImageIcon = (imageUrl: string | null, isSelected: boolean, size = 56) => {
  const borderStyle = isSelected ? `3px solid white` : `2px solid white`;
  const shadow = isSelected
    ? `0 0 0 3px #14b8a6, 0 2px 10px rgba(0,0,0,0.35)`
    : `0 2px 6px rgba(0,0,0,0.2)`;

  return L.divIcon({
    className: "",
    html: imageUrl 
      ? `<div style="
          width: ${size}px; height: ${size}px;
          border-radius: 50%;
          border: ${borderStyle};
          box-shadow: ${shadow};
          overflow: hidden;
          background: #e2e8f0;
        ">
          <img src="${imageUrl}" style="width:100%;height:100%;object-fit:cover;pointer-events:none;" 
               onerror="this.parentElement.style.background='linear-gradient(135deg,#99f6e4,#a7f3d0)';this.style.display='none';" />
        </div>`
      : `<div style="
          width: ${size}px; height: ${size}px;
          border-radius: 50%;
          border: ${borderStyle};
          box-shadow: ${shadow};
          background: linear-gradient(135deg, #99f6e4, #a7f3d0);
          display: flex; align-items: center; justify-content: center;
        ">
          <svg width="${size * 0.5}" height="${size * 0.5}" viewBox="0 0 24 24" fill="none" stroke="#14b8a6" stroke-width="2">
            <path d="M12 3a7 7 0 0 1 7 7c0 5-7 11-7 11s-7-6-7-11a7 7 0 0 1 7-7z" />
            <circle cx="12" cy="10" r="2.5" />
          </svg>
        </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 4)]
  });
};
```

---

## 5. Nghiệp vụ & Quy trình chi tiết

### 1. Đặt chỗ Nhà hàng & Khách sạn
* **Xác thực khung giờ check-in:**
  * Lịch check-in được yêu cầu phải nằm ở thời gian tương lai.
  * Giới hạn đặt trước: Không cho phép đặt trước quá 3 ngày tiếp theo. Thuật toán xác định thời điểm kết hạn tối đa bằng hàm `getMaxAdvanceLimitEnd` (cuối ngày của Hôm nay + 3 ngày).
  * Đối với dịch vụ đặt bàn nhà hàng, thời gian khách chọn phải nằm trong khung giờ mở/đóng cửa của quán: `isWithinOpeningHours(openingHours, checkInLocal)`.
* **Logic giữ chỗ & Tự động Hủy đơn trễ hẹn (Holding / Auto-cancel):**
  * Backend triển khai một tác vụ ngầm chạy tuần kỳ mỗi 60 giây (`autoCancelAndExpireBookings` trong `server.ts`).
  * **Đơn đặt bàn nhà hàng (`service_type = 'table'`):** Tự động chuyển trạng thái đơn thành `'cancelled'` nếu thời gian hiện tại đã trễ quá `auto_cancel_food_minutes` (Owner tự cấu hình cho địa điểm, mặc định là 60 phút) tính từ thời điểm đặt check-in và đơn đó vẫn ở trạng thái `pending` hoặc `confirmed`.
  * **Đơn đặt phòng khách sạn (`service_type = 'room'`):** Tự động chuyển trạng thái đơn thành `'cancelled'` nếu thời điểm hiện tại trễ quá `auto_cancel_hotel_minutes` (mặc định 60 phút) tính từ thời gian check-in dự kiến mà khách hàng vẫn chưa được nhân viên PMS chuyển trạng thái lưu trú thành `'inhouse'` hoặc `'checked_out'`.
  * **Logic giữ chỗ sau khi chuyển khoản:** Khi đặt chỗ chọn `reserve_on_confirm = true`, bàn/phòng sẽ không bị giữ ngay lập tức để tránh giữ ảo. Đơn hàng sẽ lưu ghi chú kèm từ khóa `[PREPAY_UNCONFIRMED]`. Khi người dùng thực hiện chuyển khoản thành công và bấm nút xác nhận thanh toán, hệ thống mới chính thức cập nhật bàn/phòng sang trạng thái giữ chỗ (`status = 'reserved'`).
* **Tính toán chi phí Đặt món trước (Pre-ordering):**
  * Đối với đặt bàn nhà hàng, khách hàng có thể đặt trước các món ăn (`preorderItems`).
  * Hệ thống kiểm tra tính khả dụng và lấy giá hiện hành của từng món từ bảng `services` của địa điểm đó.
  * Tổng tiền đơn đặt bàn: `totalAmount = tiền phí giữ bàn (thường bằng 0) + tổng tiền các món gọi trước`.
  * Quy tắc: Đặt trước món ăn chỉ khả dụng khi khách hàng đặt chính xác duy nhất **1 bàn**.

### 2. Vé Tham quan Du lịch (Tourist Tickets)
* **Quy tắc hết hạn trong ngày:**
  * Đơn đặt vé du lịch sau khi khởi tạo thành công sẽ tự động đồng bộ hóa thời gian check-in về `00:00:00` của ngày tham quan đã chọn.
  * Thời hạn hết hiệu lực của vé (`check_out_date`) được tự động gán bằng chính giờ đóng cửa của địa điểm tham quan đó trong ngày bằng hàm `computeTicketValidUntil`.
* **Vô hiệu hóa vé khi hết hạn đóng cửa:**
  * Ngay khi đến giờ đóng cửa của địa điểm (`b.check_out_date <= NOW()`), toàn bộ các đơn vé du lịch của ngày đó chưa được sử dụng (ở trạng thái `pending` hoặc `confirmed`) sẽ tự động bị quét hủy:
    `UPDATE bookings SET status = 'cancelled', notes = '[SYSTEM] Ticket expired: hết hạn khi đóng cửa' ...`
  * Đồng thời, tất cả các vé con thuộc đơn hàng đó sẽ bị hủy hiệu lực: `UPDATE booking_tickets SET status = 'void' WHERE status = 'unused'`.

### 3. Hệ thống tính hoa hồng linh hoạt (Flexible Commission System)
Mỗi giao dịch thanh toán online thành công qua hệ thống đều tự động phân bổ dòng tiền:
* **Xác định tỷ lệ:** Hệ thống kiểm tra tỷ lệ commission cài đặt riêng cho địa điểm (`locations.commission_rate`). Nếu trống, hệ thống sử dụng cấu hình chung toàn hệ thống `system_settings.default_commission_rate` (mặc định là 2.5%).
* **Thuế giá trị gia tăng (VAT):** Thuế suất VAT trên phí dịch vụ được đọc từ cấu hình hệ thống `system_settings.vat_rate` (mặc định là 10%).
* **Công thức phân tách dòng tiền (lưu vào bảng `payments`):**
  * Phí dịch vụ hệ thống: `commissionAmount = amount * commissionRate / 100` (làm tròn 2 chữ số thập phân)
  * Thuế VAT phí dịch vụ: `vatAmount = commissionAmount * vatRate / 100` (làm tròn 2 chữ số thập phân)
  * Doanh thu thực nhận của Owner: `ownerReceivable = amount - commissionAmount - vatAmount` (đây là số tiền thực tế cộng vào tài khoản của đối tác sau khi trừ phí hoa hồng sàn và thuế).

### 4. Đồng bộ sức chứa Đa kênh (Omni-channel Capacity Unification)
Để tránh tình trạng bán quá tải (overbooking) giữa khách mua trực tiếp tại quầy và khách đặt online, hệ thống đồng bộ hóa sức chứa thực tế của dịch vụ:
* Hàm `getServiceRemainingQuantity` tính toán lượng vé/chỗ còn lại bằng công thức:
  $$\text{Số lượng còn lại} = \text{Tổng sức chứa dịch vụ} - (\text{Số vé đã bán Online} + \text{Số vé bán trực tiếp tại Quầy})$$
  * **Số vé bán Online:** Đếm số vé đã xuất qua hệ thống đặt chỗ online cho ngày được chọn:
    `SELECT COUNT(*) FROM booking_tickets WHERE service_id = ? AND DATE(check_in_date) = ? AND status <> 'void'`
  * **Số vé bán trực tiếp tại Quầy (POS):** Đếm số vé nhân viên xuất tại quầy POS trực tiếp:
    `SELECT COUNT(*) FROM pos_tickets WHERE service_id = ? AND DATE(sold_at) = ? AND status <> 'void'`

### 5. Quy trình hóa đơn & Tích hợp mã VietQR
* **Sinh ảnh mã VietQR tự động:**
  * Thông tin ngân hàng của đối tác được lấy từ bảng `owner_profiles` của chủ địa điểm: `bank_name`, `bank_account`, `account_holder`.
  * Tên ngân hàng đối tác nhập vào được chuẩn hóa để chuyển đổi thành mã BIN gồm 6 chữ số tương ứng (ví dụ: `"vietcombank"` $\rightarrow$ `"970436"`, `"techcombank"` $\rightarrow$ `"970407"`,...).
  * Đường dẫn ảnh QR thanh toán được tạo động gửi về client hiển thị:
    `https://img.vietqr.io/image/${inferredBin}-${encodeURIComponent(bankAccount)}-compact2.png?addInfo=${addInfo}&amount=${amount}&accountName=${accountHolder}`
    * Trong đó, tham số `addInfo` chứa mã giao dịch tự động không trùng lặp (ví dụ: `BK-bookingId...` hoặc `BKB-batchId...`).
* **Giao diện chuyển đổi "Thanh toán & Biến mất" (View-and-disappear):**
  * Trong lúc đơn hàng chờ thanh toán, hộp thoại hóa đơn cùng mã VietQR hiển thị nổi bật trên màn hình.
  * Sau khi chuyển khoản thành công, người dùng bấm nút "Xác nhận đã chuyển khoản", hệ thống gọi API `confirmTicketTransfer` / `confirmTableTransfer`.
  * Backend xác thực giao dịch, chuyển trạng thái thanh toán sang `completed`.
  * Frontend nhận phản hồi thành công sẽ ghi chú sự kiện `"Đơn đặt trước của bạn đã thành công..."` vào `sessionStorage` (key `tc_booking_fade_message`) và gọi hàm tải lại trang sau 50ms - 80ms (`window.location.reload()`).
  * Sau khi trang tải lại, giao diện nhận diện đơn hàng đã được thanh toán xong $\rightarrow$ hộp thoại VietQR cùng hóa đơn tạm thời sẽ biến mất hoàn toàn ("disappears") và điều hướng thẳng người dùng đến trang Vỏ vé cá nhân `/user/tickets`, hiển thị mã QR code chính thức để quét check-in trực tiếp tại quầy.
