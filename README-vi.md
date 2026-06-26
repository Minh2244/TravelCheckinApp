# Hệ thống quản lý và trải nghiệm du lịch đa vai trò tích hợp trí tuệ nhân tạo

### Multi-role Travel Management and Experience System with AI Integration

Một hệ sinh thái du lịch toàn diện kết nối khách du lịch với các nhà cung cấp dịch vụ thông qua việc tích hợp hệ thống POS (Điểm bán hàng), PMS (Quản lý khách sạn), Check-in thông minh, và các tính năng hỗ trợ bởi AI. Được xây dựng làm đồ án tốt nghiệp tại Đại học Tây Đô.

---

## Mục lục

- [I. Tổng quan dự án](#i-tong-quan-du-an)
- [II. Website Dashboard (Quản trị viên, Chủ doanh nghiệp, Người dùng)](#ii-website-dashboard-quan-tri-vien-chu-doanh-nghiep-nguoi-dung)
- [III. Backend API & Dịch vụ AI](#iii-backend-api--dich-vu-ai)
- [IV. Ứng dụng Mobile (Dành cho khách du lịch)](#iv-ung-dung-mobile-danh-cho-khach-du-lich)
- [V. Kiến trúc hệ thống & Phân quyền](#v-kien-truc-he-thong--phan-quyen)
- [VI. Cấu trúc cơ sở dữ liệu (56 Bảng)](#vi-cau-truc-co-so-du-lieu-56-bang)
- [VII. Tiến độ phát triển](#vii-tien-do-phat-trien)
- [VIII. Tác giả & Bản quyền](#viii-tac-gia--ban-quyen)

---

## I. Tổng quan dự án

Dự án này là một hệ sinh thái du lịch full-stack bao gồm ba thành phần chính:

| Thành phần | Mô tả | Công nghệ |
|-----------|-------------|------------|
| **Website Dashboard** | Bảng điều khiển dành cho Admin, Chủ doanh nghiệp (Owner), và Người dùng (User) | React 19, Vite 7, Ant Design, TypeScript |
| **Backend API & AI** | Máy chủ RESTful, dịch vụ thời gian thực & AI Bot | Node.js, Express 5, Python (AI), MySQL |
| **Mobile App** | Ứng dụng cho khách du lịch để khám phá và check-in | Expo (React Native), TypeScript |

Hệ thống cho phép khách du lịch khám phá các địa điểm, đặt dịch vụ (phòng khách sạn, bàn nhà hàng, vé tham quan), check-in bằng mã QR, lên kế hoạch lịch trình, kiếm điểm thưởng qua bảng xếp hạng, và nhận hỗ trợ khẩn cấp qua tín hiệu SOS. Các chủ dịch vụ được trang bị hệ thống POS/PMS đầy đủ để quản lý hoạt động kinh doanh. Nền tảng tích hợp Google Gemini AI để làm trợ lý chatbot thông minh và gợi ý cá nhân hóa.

---

## II. Website Dashboard (Quản trị viên, Chủ doanh nghiệp, Người dùng)

Frontend web là một ứng dụng Single Page Application (SPA) cung cấp các giao diện chuyên biệt cho ba vai trò khác nhau.

### 1. Công nghệ sử dụng
| Danh mục | Công nghệ |
|----------|------------|
| Framework | React 19 + TypeScript |
| Build Tool | Vite 7 |
| Routing | react-router-dom v7 |
| UI Library | Ant Design v6 |
| Quản lý State | Zustand |
| Styling | Tailwind CSS 3 |
| Bản đồ | react-leaflet (OpenStreetMap) |
| Thời gian thực (Real-time) | socket.io-client, EventSource (SSE) |

### 2. Tính năng chính

#### Admin Dashboard (Dành cho Quản trị viên)
- **Kiểm soát toàn bộ hệ thống:** Quản lý người dùng, chủ doanh nghiệp, địa điểm, và cài đặt hệ thống.
- **Kiểm duyệt địa điểm:** Phê duyệt, từ chối, ẩn, hoặc xóa địa điểm; phát hiện và gộp các địa điểm trùng lặp.
- **Quản lý hoa hồng:** Thiết lập tỷ lệ hoa hồng cho từng địa điểm, theo dõi thanh toán.
- **Thống kê & SOS:** Xem biểu đồ thống kê, xử lý báo cáo vi phạm, và giám sát cảnh báo SOS theo thời gian thực.
- **Cài đặt AI:** Cấu hình hành vi của AI chatbot và xem lịch sử trò chuyện.

#### Owner Dashboard (Dành cho Chủ doanh nghiệp - POS & PMS)
- **Quản lý địa điểm:** Thêm/sửa/xóa thông tin, tải lên tối đa 12 hình ảnh, tọa độ GPS, và tích hợp OpenStreetMap.
- **Quản lý Khách sạn (Hotel PMS):** Lưới phòng trực quan kéo thả (drag-and-drop), quản lý lưu trú, check-in trực tuyến và khách vãng lai.
- **Quản lý Nhà hàng / Quán Cafe (Restaurant POS):** Bố trí bàn ăn kéo thả, theo dõi đơn hàng theo thời gian thực, quản lý khu vực.
- **Quản lý Vé tham quan (Ticket POS):** Quét mã QR kiểm vé bằng camera, bán vé tại quầy, theo dõi số lượng vé tồn theo thời gian thực.
- **Vận hành kinh doanh:** Trả lời đánh giá, phân quyền nhân viên (dựa trên JSON), theo dõi hoa hồng, tạo mã giảm giá (voucher).

#### User Web Portal (Dành cho Người dùng)
- **Khám phá & Đặt chỗ:** Xem địa điểm, đặt phòng khách sạn, bàn nhà hàng, và vé du lịch.
- **Tính năng du lịch:** Nhật ký hành trình (Travel Diary), Lên kế hoạch (Itinerary), và Ví Voucher.
- **Trợ lý AI Chat:** Trợ lý ảo sử dụng Google Gemini hỗ trợ lên kế hoạch du lịch và gợi ý cá nhân hóa.
- **Đăng nhập Mạng xã hội:** Tích hợp xác thực OAuth bằng Google và Facebook.

---

## III. Backend API & Dịch vụ AI

Backend đóng vai trò là hệ thần kinh trung ương, xử lý lưu trữ dữ liệu, logic nghiệp vụ, giao tiếp thời gian thực, và tích hợp AI.

### 1. Công nghệ sử dụng
| Danh mục | Công nghệ |
|----------|------------|
| Runtime | Node.js + TypeScript |
| Framework | Express 5.x |
| Cơ sở dữ liệu | MySQL (mysql2, promise-based pool) |
| Xác thực | JWT (jsonwebtoken), bcrypt |
| Thời gian thực (Real-time) | Socket.IO, Server-Sent Events (SSE) |
| AI | Google Gemini (@google/generative-ai) |
| Thông báo đẩy (Push) | Firebase Cloud Messaging (firebase-admin) |
| Lưu trữ File | MySQL LONGBLOB (bảng images) |

### 2. Tính năng chính
- **11 Nhóm API cốt lõi:** Bao gồm auth, admin, owner, user, bookings, locations, SOS, chat, geo, push, và events.
- **Phân quyền chặt chẽ (RBAC):** Middleware JWT kiểm tra nghiêm ngặt quyền hạn của Admin, Owner, Employee, và User.
- **Động cơ thời gian thực:** Websockets cho chức năng chat tại địa điểm, SSE để cập nhật trạng thái đặt chỗ (booking).
- **Tích hợp AI (Customer Assistant):** AI Gemini hiểu ngữ cảnh được tích hợp thẳng vào luồng người dùng.
- **AI Manager Bot (Microservice):** Dịch vụ AI độc lập (dùng Python) phục vụ phân tích thống kê và tóm tắt đánh giá cho Admin/Owner.
- **Xử lý hình ảnh:** Tự động thay đổi kích thước và nén ảnh bằng Sharp trước khi lưu vào MySQL LONGBLOB.

---

## IV. Ứng dụng Mobile (Dành cho khách du lịch)

Một ứng dụng di động chuyên biệt thiết kế riêng cho khách du lịch khi di chuyển, tập trung vào các dịch vụ dựa trên vị trí và trải nghiệm mượt mà.

### 1. Công nghệ sử dụng
| Danh mục | Công nghệ |
|----------|------------|
| Framework | Expo / React Native |
| Ngôn ngữ | TypeScript |
| Routing | Expo Router |
| Networking | Axios |

### 2. Tính năng chính
- **Check-in thông minh:** Check-in dựa trên GPS kết hợp hàng rào địa lý (geofencing) và bắt buộc chụp ảnh check-in.
- **Ví vé QR:** Truy cập vé điện tử trên điện thoại với mã QR duy nhất để quét tại cổng kiểm soát.
- **Bản đồ tương tác:** Tìm kiếm các địa điểm lân cận, xem đánh dấu (markers), và chỉ đường.
- **Cảnh báo SOS:** Nút bấm gọi cứu hộ khẩn cấp gửi kèm định vị GPS theo thời gian thực.
- **Bảng xếp hạng (Leaderboard):** Hệ thống xếp hạng vinh danh người dùng dựa trên hoạt động check-in và đóng góp.

*(Lưu ý: Ứng dụng Mobile hiện đang trong quá trình phát triển)*

---

## V. Kiến trúc hệ thống & Phân quyền

```text
TravelCheckinApp/
├── website/                         # React SPA (Admin + Owner + User)
│   └── src/pages/ (Admin, Owner, User, Auth)
│
├── backend/                         # Node.js + Express REST API
│   └── src/
│       ├── controllers/             # 11 route controllers
│       ├── services/                # Business logic
│       │   └── ai-services/         # AI Customer Assistant dành cho Users
│       └── utils/
│
├── ai-manager-bot/                  # Python Microservice (AI dành cho Owner/Admin)
│   └── app/services/                # Xử lý báo cáo và phân tích dữ liệu
│
└── mobile/                          # Expo / React Native Mobile App
    └── app/(tabs)/                  # Các tab chức năng du lịch chính
```

### Vai trò và Phân quyền

| Vai trò | Phạm vi | Quyền hạn chính |
|------|-------|------------------|
| **Admin** | Toàn hệ thống | Toàn quyền: quản lý user/owner, kiểm duyệt địa điểm, hoa hồng, cài đặt AI, SOS |
| **Owner** | Doanh nghiệp | Quản lý địa điểm, POS/PMS, quản lý nhân viên, mã giảm giá, trả lời đánh giá |
| **Employee** | Địa điểm | Một phần quyền của owner: Dùng POS/PMS, quét mã vé (do Owner cấp quyền) |
| **User** | Người dùng cuối | Đặt chỗ, check-in, yêu thích, dùng voucher, đánh giá, lịch trình, SOS, chat AI |

---

## VI. Cấu trúc cơ sở dữ liệu (59 Bảng)

Hệ thống sử dụng cơ sở dữ liệu quan hệ **MySQL** với **59 bảng** được tổ chức thành 12 phân hệ chức năng, đảm bảo tính toàn vẹn dữ liệu cho các luồng nghiệp vụ phức tạp.

1. **Xác thực và Người dùng (8 bảng):** Tài khoản cốt lõi, hồ sơ chủ doanh nghiệp, phiên đăng nhập JWT, mã OTP, danh sách đen.
2. **Địa điểm và Dịch vụ (3 bảng):** Điểm kinh doanh, dịch vụ cho thuê, danh mục dịch vụ.
3. **Đặt chỗ và Thanh toán (7 bảng):** Lịch đặt (Bookings), vé QR, đặt bàn nhà hàng, món gọi trước, thanh toán, hoa hồng.
4. **Quản lý khách sạn PMS (3 bảng):** Danh sách phòng, lượt lưu trú, phí dịch vụ/minibar.
5. **Quản lý nhà hàng POS (5 bảng):** Khu vực ăn uống, bàn kéo thả, đơn hàng đang mở, chi tiết món ăn.
6. **Check-in và SOS (2 bảng):** Lượt check-in GPS, cảnh báo khẩn cấp.
7. **Đánh giá và Báo cáo (4 bảng):** Đánh giá của user, trả lời của owner, báo cáo vi phạm, hồ sơ vi phạm của owner.
8. **Hệ thống Voucher (5 bảng):** Định nghĩa mã giảm giá, áp dụng cho địa điểm, lịch sử sử dụng, ví người dùng.
9. **Chat và Thông báo (6 bảng):** Chat chung, chat tại địa điểm, thông báo đẩy (FCM), theo dõi trạng thái đã đọc.
10. **Lưu trữ Hình ảnh (3 bảng):** Dữ liệu ảnh nhị phân (LONGBLOB), liên kết đa hình (polymorphic).
11. **Lịch trình (2 bảng):** Kế hoạch du lịch của người dùng, chi tiết từng ngày.
12. **Hệ thống và Tiện ích (8 bảng):** Mục yêu thích, nhật ký du lịch, lịch sử chat AI, nhật ký hệ thống (audit logs), tác vụ nền.

*(Cấu trúc hoàn chỉnh bao gồm các ràng buộc khóa ngoại và index tối ưu truy vấn được lưu trong file `TravelCheckinApp.sql` tại thư mục gốc).*

### A. Danh sách toàn bộ các bảng

#### 1. Xác thực và Người dùng (8 bảng)

| # | Bảng | Mô tả |
|---|-------|-------------|
| 1 | `users` | Tài khoản người dùng cốt lõi với phân quyền (admin, owner, employee, user) |
| 2 | `owner_profiles` | Hồ sơ kinh doanh mở rộng của chủ doanh nghiệp (thông tin ngân hàng, trạng thái duyệt, hoa hồng) |
| 3 | `user_active_sessions` | Theo dõi phiên JWT — giới hạn một phiên hoạt động duy nhất cho mỗi user |
| 4 | `login_history` | Nhật ký truy cập chi tiết với IP, thiết bị, và thời gian |
| 5 | `login_attempts` | Theo dõi các lần đăng nhập thất bại để chống brute-force |
| 6 | `otp_codes` | Mã OTP để xác thực email và đặt lại mật khẩu |
| 7 | `account_blacklist` | Các tài khoản bị cấm cùng với lý do và thời gian hết hạn |
| 8 | `user_preferences` | Cài đặt người dùng và tùy chọn thông báo |

#### 2. Địa điểm và Dịch vụ (3 bảng)

| # | Bảng | Mô tả |
|---|-------|-------------|
| 9 | `locations` | Các địa điểm kinh doanh với tọa độ GPS, hình ảnh, giờ mở cửa |
| 10 | `services` | Dịch vụ cho thuê của từng địa điểm (phòng, bàn, vé, món ăn, combo) |
| 11 | `service_categories` | Phân loại và nhóm các dịch vụ |

#### 3. Đặt chỗ và Thanh toán (7 bảng)

| # | Bảng | Mô tả |
|---|-------|-------------|
| 12 | `bookings` | Hồ sơ đặt chỗ chính với trạng thái và mã giảm giá tích hợp |
| 13 | `booking_tickets` | Vé điện tử mã QR cho các khu du lịch |
| 14 | `booking_table_reservations` | Đặt bàn nhà hàng liên kết với đặt chỗ |
| 15 | `booking_preorder_items` | Các món ăn gọi trước cho bàn đã đặt |
| 16 | `payments` | Giao dịch thanh toán với tính toán hoa hồng |
| 17 | `commissions` | Hồ sơ hoa hồng nền tảng của từng chủ doanh nghiệp |
| 18 | `commission_history` | Lịch sử thanh toán và đối soát hoa hồng |

#### 4. Quản lý Khách sạn (PMS) (3 bảng)

| # | Bảng | Mô tả |
|---|-------|-------------|
| 19 | `hotel_rooms` | Kho phòng với thông tin số tầng, số phòng, loại phòng và trạng thái |
| 20 | `hotel_stays` | Lượt lưu trú hiện tại và quá khứ (check-in/check-out) |
| 21 | `hotel_stay_items` | Phí minibar, phí dịch vụ, và các chi phí phát sinh khác trong thời gian lưu trú |

#### 5. Quản lý Nhà hàng (POS) (6 bảng)

| # | Bảng | Mô tả |
|---|-------|-------------|
| 22 | `pos_areas` | Các khu vực ăn uống (trong nhà, ngoài trời, VIP...) |
| 23 | `pos_tables` | Các bàn ăn vật lý với vị trí được thiết lập kéo thả (drag-and-drop) |
| 24 | `pos_orders` | Các đơn hàng đang phục vụ liên kết với bàn ăn |
| 25 | `pos_order_items` | Chi tiết từng món ăn trong một đơn hàng |
| 26 | `pos_tickets` | Vé du lịch được bán trực tiếp thông qua POS |
| 27 | `location_invoice_sequences` | Số thứ tự hóa đơn (invoice) sinh tự động cho từng địa điểm |

#### 6. Check-in và SOS (2 bảng)

| # | Bảng | Mô tả |
|---|-------|-------------|
| 27 | `checkins` | Lượt check-in tại địa điểm (kèm hình ảnh, định vị GPS và rào chắn địa lý geofence) |
| 28 | `sos_alerts` | Cảnh báo khẩn cấp với tọa độ GPS theo thời gian thực và trạng thái xử lý |

#### 7. Đánh giá và Báo cáo (4 bảng)

| # | Bảng | Mô tả |
|---|-------|-------------|
| 29 | `reviews` | Đánh giá và xếp hạng của người dùng đối với địa điểm |
| 30 | `review_replies` | Phản hồi của chủ doanh nghiệp đối với đánh giá |
| 31 | `reports` | Các báo cáo từ người dùng (vi phạm nội dung, lạm dụng) |
| 32 | `owner_violations` | Hồ sơ ghi nhận vi phạm và cảnh cáo đối với chủ doanh nghiệp |

#### 8. Hệ thống Voucher (5 bảng)

| # | Bảng | Mô tả |
|---|-------|-------------|
| 33 | `vouchers` | Thông tin mã giảm giá (loại, mức giảm, thời hạn) |
| 34 | `voucher_locations` | Liên kết Voucher-Địa điểm (địa điểm nào chấp nhận mã nào) |
| 35 | `voucher_usage_history` | Lịch sử sử dụng voucher của từng người dùng |
| 36 | `voucher_reviews` | Đánh giá của người dùng có liên quan đến việc sử dụng voucher |
| 37 | `user_voucher_wallet` | Ví chứa các voucher mà người dùng đã lưu |

#### 9. Chat và Thông báo (6 bảng)

| # | Bảng | Mô tả |
|---|-------|-------------|
| 38 | `chat_messages` | Tin nhắn thời gian thực chung (Socket.IO) |
| 39 | `location_chat_messages` | Tin nhắn thời gian thực giữa người dùng và chủ địa điểm |
| 40 | `push_notifications` | Các thông báo đẩy (Firebase Cloud Messaging) |
| 41 | `user_notification_reads` | Trạng thái đã đọc thông báo của người dùng |
| 42 | `user_notification_dismissed` | Trạng thái đã xóa thông báo của người dùng |
| 43 | `owner_notification_reads` | Trạng thái đã đọc thông báo của chủ doanh nghiệp |

#### 10. Lưu trữ Hình ảnh (3 bảng)

| # | Bảng | Mô tả |
|---|-------|-------------|
| 44 | `images` | Dữ liệu nhị phân ảnh được lưu dưới dạng LONGBLOB kèm siêu dữ liệu (metadata) |
| 45 | `entity_images` | Bảng liên kết đa hình (Polymorphic junction) gắn ảnh với bất kỳ thực thể nào |
| 46 | `image_categories` | Định nghĩa loại ảnh với các ràng buộc về kích thước/chất lượng |

#### 11. Lịch trình (2 bảng)

| # | Bảng | Mô tả |
|---|-------|-------------|
| 47 | `itineraries` | Các lịch trình du lịch do người dùng tạo (kèm khoảng thời gian) |
| 48 | `itinerary_items` | Chi tiết lịch trình theo từng ngày kèm địa điểm và ghi chú |

#### 12. Hệ thống và Tiện ích (10 bảng)

| # | Bảng | Mô tả |
|---|-------|-------------|
| 50 | `favorite_locations` | Các địa điểm yêu thích/đã lưu của người dùng |
| 51 | `user_diary` | Các bài viết nhật ký hành trình với trạng thái cảm xúc (mood), nội dung, và hình ảnh |
| 52 | `ai_chat_history` | Lịch sử trò chuyện với AI Chatbot (Google Gemini) |
| 53 | `ai_conversations` | Quản lý các phiên/cuộc hội thoại độc lập với AI |
| 54 | `ai_assistant_feedback` | Lưu trữ đánh giá (feedback) của người dùng về câu trả lời của AI |
| 55 | `audit_logs` | Nhật ký hệ thống ghi nhận mọi thao tác của quản trị viên |
| 56 | `system_settings` | Cấu hình hệ thống lưu dưới dạng khóa-giá trị (key-value) |
| 57 | `background_schedules` | Các tác vụ được lập lịch (tự động xác nhận, tự động hủy, dọn dẹp) |
| 58 | `owner_notification_dismissed` | Trạng thái đã xóa thông báo của chủ doanh nghiệp |
| 59 | `employee_locations` | Phân công quyền hạn của nhân viên tại các địa điểm |

### B. Mối quan hệ giữa các thực thể cốt lõi

```text
+----------------+       +--------------------+       +--------------------+
|     users      |       |     locations      |       |     services       |
|----------------|       |--------------------|       |--------------------|
| id (PK)        |<--+   | id (PK)            |<--+   | id (PK)            |
| name           |   |   | name               |   +---| location_id (FK)   |
| email          |   |   | type               |   |   | name               |
| role           |   |   | province           |   |   | price              |
| password       |   |   | latitude           |   |   | quantity           |
| avatar_url     |   |   | longitude          |   |   | pos_id             |
| status         |   |   | owner_id (FK) -----+---+   +--------+-----------+
+--------+-------+   |   | images (JSON)      |                |
         |           |   | opening_hours      |                |
         v           |   +--------------------+                |
+----------------+   |                                         |
|owner_profiles  |   |   +--------------------+                |
|----------------|   |   |     bookings       |                |
| user_id (FK)   |---+   |--------------------|                |
| bank_name      |       | id (PK)            |                |
| bank_number    |       | user_id (FK) ------+----------------+---+
| approval       |       | service_id (FK) ---+----------------+   |
| commission_rate|       | status             |                    |
+----------------+       | voucher_id (FK)    |                    |
                         | check_in_date      |                    |
                         | total_amount       |                    |
                         +--------+-----------+                    |
                                  |                                |
              +-------------------+-------------------+            |
              v                   v                   v            v
    +----------------+  +----------------+  +-------------------------+
    |booking_tickets |  |    payments    |  |booking_table_           |
    |----------------|  |----------------|  |  reservations           |
    | id (PK)        |  | id (PK)        |  |-------------------------|
    | booking_id     |  | booking_id     |  | id (PK)                 |
    | ticket_code    |  | amount         |  | commission     |  | table_id                |
    | qr_code        |  | status         |  | status                  |
    | status         |  +----------------+  +-------------------------+
    +----------------+
```

### C. Các phân hệ PMS và POS

```text
    +----------------+  +----------------+  +----------------+
    |  hotel_rooms   |  |   pos_tables   |  |    vouchers    |
    |----------------|  |----------------|  |----------------|
    | id (PK)        |  | id (PK)        |  | id (PK)        |
    | location_id    |  | area_id (FK)   |  | code           |
    | room_number    |  | table_number   |  | discount_type  |
    | floor          |  | status         |  | discount_value |
    | status         |  | position       |  | scope          |
    +-------+--------+  +-------+--------+  +----------------+
            |                   |
            v                   v
    +----------------+  +----------------+
    |  hotel_stays   |  |   pos_orders   |
    |----------------|  |----------------|
    | id (PK)        |  | id (PK)        |
    | room_id (FK)   |  | table_id (FK)  |
    | user_id (FK)   |  | user_id (FK)   |
    | status         |  | status         |
    | check_in       |  | total_amount   |
    | check_out      |  +-------+--------+
    +----------------+          |
                                v
                        +----------------+
                        | pos_order_items|
                        |----------------|
                        | id (PK)        |
                        | order_id (FK)  |
                        | item_name      |
                        | quantity       |
                        | price          |
                        +----------------+
```

### D. Hệ thống Lưu trữ Hình ảnh

```text
    +----------------+  +----------------+  +----------------+
    |    images      |  | entity_images  |  |image_categories|
    |----------------|  |----------------|  |----------------|
    | id (PK)        |  | id (PK)        |  | id (PK)        |
    | category_id FK |  | image_id (FK)  |  | name           |
    | original_name  |  | entity_type    |  | max_width      |
    | mime_type      |  | entity_id      |  | max_height     |
    | file_size      |  | role           |  | quality        |
    | data (LONGBLOB)|  | sort_order     |  | max_file_size  |
    | uploaded_by    |  | is_primary     |  +----------------+
    +----------------+  +----------------+
```

---

## VII. Tiến độ phát triển

- [x] **Giai đoạn 1** — Thiết kế CSDL & Xây dựng Backend API Cốt lõi (Auth, Vai trò, Middleware)
- [x] **Giai đoạn 2** — Website Dashboard cho module quản trị của Admin & Owner
- [x] **Giai đoạn 3** — Hoàn thiện CSDL (56 bảng) và phục hồi toàn bộ chức năng
- [ ] **Giai đoạn 4** — Phát triển Mobile App (Đang tiến hành)
- [ ] **Giai đoạn 6** — Hoàn thiện tương tác kéo thả (drag-and-drop) cho Hotel PMS và Restaurant POS
- [ ] **Giai đoạn 7** — Tích hợp AI Chat với Google Gemini

---

## VIII. Tác giả & Bản quyền

### Thông tin dự án

| Trường | Chi tiết |
|-------|---------|
| **Tên dự án (Tiếng Việt)** | Hệ thống quản lý và trải nghiệm du lịch đa vai trò tích hợp trí tuệ nhân tạo |
| **Tên dự án (Tiếng Anh)** | Multi-role Travel Management and Experience System with AI Integration |
| **Tác giả** | **Mai Nhựt Minh** (minhmap3367@gmail.com) |
| **Đơn vị** | Đại học Tây Đô |
| **Lớp** | CNTT17A |
| **Năm thực hiện** | 2026 |
| **Loại dự án** | Đồ án tốt nghiệp |

### Tuyên bố bản quyền

```text
Copyright (c) 2026 Mai Nhut Minh. All rights reserved.

Đây là đồ án tốt nghiệp nguyên bản được phát triển tại Đại học Tây Đô, Việt Nam.
Toàn bộ quyền sở hữu trí tuệ bao gồm (nhưng không giới hạn): mã nguồn, thiết kế 
cơ sở dữ liệu, kiến trúc hệ thống, thiết kế UI/UX, và tài liệu dự án thuộc về
độc quyền của tác giả.

Nghiêm cấm sử dụng trái phép. Mọi hoạt động sau đây đều cần có sự đồng ý 
bằng văn bản của tác giả:

  1. Sao chép, tái bản, hoặc phân phối một phần hay toàn bộ mã nguồn.
  2. Sử dụng dự án này hoặc các bản phái sinh cho mục đích thương mại.
  3. Đăng ký bản quyền hoặc sáng chế dưới bất kỳ tên nào khác.
  4. Sửa đổi, phóng tác, hoặc tạo ra các tác phẩm phái sinh để phân phối lại.
  5. Xóa bỏ hoặc thay đổi thông báo bản quyền này.
  6. Tự nhận là tác giả của bất kỳ phần nào trong dự án này.

Dự án này được cung cấp "nguyên trạng" chỉ nhằm mục đích tham khảo học thuật 
và giáo dục. Tác giả không đảm bảo sự phù hợp của dự án cho bất kỳ mục đích 
cụ thể nào khác.

Mọi vi phạm các điều khoản này sẽ bị xử lý theo Luật Sở hữu Trí tuệ Việt Nam 
(Luật số 50/2005/QH11, sửa đổi bổ sung bởi Luật số 36/2009/QH12) và các 
hiệp ước bản quyền quốc tế có liên quan.
```

### Thương hiệu
Tên dự án "Travel Check-in" cùng toàn bộ logo, nhãn hiệu và các yếu tố nhận diện thương hiệu liên quan là tài sản của Mai Nhựt Minh. Việc sử dụng tên thương hiệu trong bất kỳ dự án phái sinh nào mà không có sự cho phép bằng văn bản đều bị nghiêm cấm.

### Lời cảm ơn (Công nghệ bên thứ ba)
Dự án này sử dụng các công nghệ mã nguồn mở sau: Node.js, Express, React, Ant Design, Tailwind CSS, Socket.IO, MySQL, Google Gemini API, Firebase, và OpenStreetMap.

---

*Tài liệu README này được cập nhật lần cuối vào ngày 26 tháng 06, 2026.*
