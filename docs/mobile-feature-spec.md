# 📋 ĐẶC TẢ CHỨC NĂNG MOBILE APP — TravelCheckinApp

> **Ngày tạo:** 2026-06-05
> **Mục đích:** Mô tả chi tiết logic, cách hoạt động của từng chức năng trên Mobile
> **Tham chiếu:** Backend API (87 endpoints), Website User pages (17 pages), Database (51 tables)

---

## MỤC LỤC

1. [Auth Flow](#1-auth-flow)
2. [Home / Dashboard](#2-home--dashboard)
3. [Map](#3-map)
4. [Location Detail](#4-location-detail)
5. [Booking System](#5-booking-system)
6. [Tickets & Passes](#6-tickets--passes)
7. [Profile](#7-profile)
8. [Check-in](#8-check-in)
9. [History](#9-history)
10. [Secondary Features](#10-secondary-features)

---

## 1. AUTH FLOW

### 1.1 Đăng nhập (Login)

**Mô tả:** Cho phép user đăng nhập bằng email + mật khẩu. Sau khi đăng nhập thành công, lưu token vào thiết bị và chuyển đến màn hình chính.

**Logic hoạt động:**
```
1. User mở app → kiểm tra token đã lưu trong AsyncStorage
   ├── Có token hợp lệ → chuyển thẳng vào Home (bypass login)
   └── Không có token → hiển thị màn hình Login

2. User nhập email + mật khẩu → nhấn "Đăng nhập"
   ├── Validate phía client:
   │   ├── Email không được trống
   │   ├── Mật khẩu không được trống
   │   └── Mật khẩu ≥ 6 ký tự
   │
   ├── Gọi API: POST /api/auth/login { email, password }
   │
   ├── Phản hồi thành công:
   │   ├── Lưu accessToken vào AsyncStorage
   │   ├── Lưu refreshToken vào AsyncStorage
   │   ├── Lưu thông tin user vào Zustand store
   │   └── Chuyển đến Home screen (tabs)
   │
   └── Phản hồi lỗi:
       ├── 401: "Email hoặc mật khẩu không đúng"
       ├── 423: "Tài khoản bị khóa" (hiển thị lý do)
       ├── 429: "Thử lại sau X giây" (brute-force protection)
       └── 500: "Lỗi server, thử lại sau"
```

**Xử lý đặc biệt:**
- Backend có brute-force protection: 5 lần sai → khóa 5 phút
- Nếu user chưa xác thực OTP → chuyển sang màn hình OTP
- Nếu có warning (đăng nhập từ thiết bị mới) → hiển thị cảnh báo

---

### 1.2 Đăng ký (Register)

**Mô tả:** Tạo tài khoản mới. Gửi OTP về email để xác thực.

**Logic hoạt động:**
```
BƯỚC 1: Nhập thông tin
├── Họ tên: bắt buộc, không chứa ký tự đặc biệt
├── Email: bắt buộc, đúng định dạng
├── Số điện thoại: bắt buộc, 10 số bắt đầu bằng 0
├── Mật khẩu: bắt buộc, ≥ 6 ký tự
└── Nhập lại mật khẩu: phải khớp với mật khẩu

BƯỚC 2: Gửi OTP
├── Gọi API: POST /api/auth/register { email, phone, password, full_name }
├── Thành công: chuyển sang màn hình nhập OTP
└── Lỗi: "Email đã tồn tại" hoặc "SĐT đã tồn tại"

BƯỚC 3: Xác nhận OTP
├── Hiện 6 ô nhập OTP
├── Gọi API: POST /api/auth/verify-otp { email, otp }
├── Thành công: "Đăng ký thành công!" → chuyển về Login
├── Lỗi: "OTP không đúng" hoặc "OTP đã hết hạn"
└── Nút "Gửi lại OTP" (đếm ngược 60 giây)
```

---

### 1.3 Quên mật khẩu (Forgot Password)

**Mô tả:** Đặt lại mật khẩu khi quên. Yêu cầu cả email SĐT để xác minh.

**Logic hoạt động:**
```
BƯỚC 1: Nhập email + SĐT
├── Gọi API: POST /api/auth/forgot-password { email, phone }
├── Backend kiểm tra email + SĐT khớp với 1 tài khoản
├── Thành công: gửi OTP về email
└── Lỗi: "Email hoặc SĐT không đúng"

BƯỚC 2: Xác nhận OTP
├── Gọi API: POST /api/auth/verify-reset-otp { email, otp }
├── Thành công: chuyển sang bước đặt mật khẩu mới
└── Lỗi: "OTP không đúng"

BƯỚC 3: Đặt mật khẩu mới
├── Mật khẩu mới: ≥ 6 ký tự
├── Nhập lại: phải khớp
├── Gọi API: POST /api/auth/reset-password { email, otp, newPassword }
├── Thành công: "Đã đặt lại mật khẩu!" → chuyển về Login
└── Lỗi: hiển thị thông báo
```

---

### 1.4 Google OAuth

**Mô tả:** Đăng nhập bằng tài khoản Google, không cần nhập email/mật khẩu.

**Logic hoạt động:**
```
1. User nhấn "Đăng nhập bằng Google"
2. Mở expo-web-browser → URL: GET /api/auth/google/mobile?returnTo=travelcheckin://auth/callback
3. Backend redirect → Google consent screen
4. User chọn tài khoản Google → đồng ý cấp quyền
5. Google callback → backend tạo/tìm user → tạo JWT tokens
6. Backend redirect → deep link: travelcheckin://auth/callback?accessToken=...&refreshToken=...&user=...
7. App nhận deep link → lưu token → chuyển Home
```

**Xử lý lỗi:**
- User hủy: quay về Login
- Network error: "Không thể kết nối, thử lại"
- Tài khoản bị khóa: "Tài khoản này đã bị khóa"

---

### 1.5 Đăng xuất (Logout)

**Mô tả:** Xóa session và token, quay về màn hình đăng nhập.

**Logic hoạt động:**
```
1. User nhấn "Đăng xuất" (ở Profile screen)
2. Hiện dialog xác nhận: "Bạn có chắc muốn đăng xuất?"
3. Nếu OK:
   ├── Gọi API: POST /api/auth/logout (xóa refresh token trên server)
   ├── Xóa accessToken khỏi AsyncStorage
   ├── Xóa refreshToken khỏi AsyncStorage
   ├── Reset Zustand auth store
   └── Chuyển về Login screen
```

---

## 2. HOME / DASHBOARD

### 2.1 Lời chào theo thời gian

**Mô tả:** Hiển thị lời chào phù hợp với thời gian trong ngày.

**Logic:**
```
Giờ hiện tại:
├── 5:00 - 11:59  → "Chào buổi sáng, {tên}! ☀️"
├── 12:00 - 17:59 → "Chào buổi chiều, {tên}! 🌤️"
└── 18:00 - 4:59  → "Chào buổi tối, {tên}! 🌙"
```

---

### 2.2 Thời tiết GPS

**Mô tả:** Hiển thị thời tiết hiện tại tại vị trí user đang đứng.

**Logic hoạt động:**
```
1. Lấy tọa độ GPS hiện tại (expo-location)
2. Gọi Open-Meteo API: https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lng}&current_weather=true
3. Gọi API reverse geocode: GET /api/geo/reverse?lat={lat}&lng={lng} → lấy tên thành phố
4. Hiển thị: "☀️ 32°C · Cần Thơ"
```

**Xử lý:**
- Không có quyền GPS: ẩn phần thời tiết
- API lỗi: ẩn phần thời tiết (không hiển thị lỗi)

---

### 2.3 Quick Actions (5 nút)

**Mô tả:** 5 nút truy cập nhanh các chức năng chính.

| Nút | Hành động |
|-----|----------|
| 🗺️ Map | Chuyển sang tab Map |
| 📍 Check-in | Mở màn hình Check-in |
| ❤️ Lưu | Mở Saved Locations |
| 🎫 Vé | Chuyển sang tab Tickets |
| 🆘 SOS | Mở màn hình SOS |

---

### 2.4 Tìm kiếm địa điểm

**Mô tả:** Tìm kiếm địa điểm theo tên, hiển thị kết quả realtime.

**Logic hoạt động:**
```
1. User gõ vào search bar
2. Debounce 300ms (chờ user gõ xong)
3. Gọi API: GET /api/locations?keyword={text}&source=mobile
4. Hiển thị kết quả trong danh sách bên dưới
5. Nhấn kết quả → chuyển đến Location Detail
```

**Xử lý:**
- Kết quả rỗng: hiện EmptyState "Không tìm thấy địa điểm"
- Đang loading: hiện skeleton shimmer
- Lỗi: hiện "Thử lại" button

---

### 2.5 Category Filter (Chips)

**Mô tả:** Lọc địa điểm theo loại.

**Logic:**
```
Chips: [Tất cả] [Khám phá] [Ăn uống] [Lưu trú]

Mapping:
├── "Tất cả"   → không filter (type không gửi)
├── "Khám phá" → type=tourist
├── "Ăn uống"  → type=restaurant,cafe
└── "Lưu trú"  → type=hotel,resort

Nhấn chip → gọi API: GET /api/locations?type={value}&source=mobile
```

---

### 2.6 Danh sách địa điểm (Location Cards)

**Mô tả:** Hiển thị danh sách địa điểm dạng grid, sắp xếp theo khoảng cách GPS.

**Logic hoạt động:**
```
1. Gọi API: GET /api/locations?source=mobile (+ type, keyword nếu có)
2. Lấy GPS hiện tại
3. Tính khoảng cách từ GPS đến mỗi địa điểm (Haversine formula)
4. Sắp xếp theo khoảng cách tăng dần (gần nhất lên đầu)
5. Hiển thị dạng grid 2-3 cột (tùy kích thước màn hình)

Mỗi card hiển thị:
├── Ảnh địa điểm (first_image)
├── Tên địa điểm
├── Rating (⭐ 4.5)
├── Địa chỉ (rút gọn)
└── Loại (badge: Tourist, Restaurant, Hotel...)

Nhấn card → chuyển đến Location Detail
```

---

### 2.7 Stats (Thống kê nhanh)

**Mô tả:** Hiển thị số lượng check-ins, favorites, vouchers của user.

**Logic:**
```
Gọi 3 API song song:
├── GET /api/user/checkins → đếm số lượng
├── GET /api/user/favorites → đếm số lượng
└── GET /api/user/vouchers/saved → đếm số lượng

Hiển thị: "📊 Check-ins: 12  ❤️: 5  🎫: 3"
```

---

### 2.8 Gợi ý cá nhân hóa

**Mô tả:** Gợi ý địa điểm dựa trên lịch sử check-in và sở thích.

**Logic:**
```
Gọi API: GET /api/user/recommendations/locations?limit=12

Backend logic:
├── Lấy danh sách favorites của user
├── Lấy 5 check-in gần nhất
├── Tìm các location cùng loại (tourist, restaurant, hotel...)
├── Tìm các location cùng tỉnh/thành
└── Trả về 3 nhóm: favorites, recent, recommended

Hiển thị section "Gợi ý cho bạn" với horizontal scroll
```

---

## 3. MAP

### 3.1 Bản đồ OSM

**Mô tả:** Bản đồ tương tác sử dụng OpenStreetMap tiles, không dùng Google Maps.

**Logic hoạt động:**
```
1. Khởi tạo MapView với provider=null (không dùng Google)
2. Thêm UrlTile: https://tile.openstreetmap.org/{z}/{x}/{y}.png
3. Hiển thị GPS dot (vị trí hiện tại) với animation pulsing
4. Load tất cả locations từ API → hiển thị markers

Thao tác:
├── Kéo 1 ngón → di chuyển bản đồ
├── Pinch 2 ngón → zoom in/out
├── Nhấn GPS button → quay về vị trí hiện tại
└── Nhấn giữ → tạo check-in tự do
```

---

### 3.2 Markers ảnh tròn

**Mô tả:** Hiển thị địa điểm trên bản đồ bằng marker ảnh tròn.

**Logic:**
```
1. Lấy danh sách locations từ API
2. Với mỗi location:
   ├── Lấy ảnh đầu tiên (first_image)
   ├── Tạo marker custom (ảnh tròn 40x40px)
   ├── Đặt tại tọa độ (latitude, longitude)
   └── Hiển thị tên bên dưới marker

3. Nhấn marker → hiện popup:
   ├── Ảnh + tên + rating
   ├── Nút "Xem chi tiết" → Location Detail
   ├── Nút "Chỉ đường" → mở Google Maps/Apple Maps
   └── Nút "❤️ Lưu" → toggle favorite
```

---

### 3.3 Tìm kiếm trên Map

**Mô tả:** Tìm kiếm địa điểm trên bản đồ, ưu tiên hệ thống trước, fallback Nominatim.

**Logic hoạt động:**
```
1. User gõ vào search bar trên map
2. Debounce 300ms
3. Tìm trong hệ thống trước: GET /api/locations?keyword={text}&source=mobile
4. Nếu không có kết quả → fallback Nominatim: GET /api/geo/search?q={text}&limit=10
5. Hiển thị kết quả dropdown
6. Nhấn kết quả:
   ├── Nếu là location hệ thống → di chuyển map + hiện marker
   └── Nếu là Nominatim → di chuyển map + hiện marker + cho phép check-in tự do
```

---

### 3.4 Chỉ đường

**Mô tả:** Mở ứng dụng bản đồ bên ngoài để chỉ đường đến địa điểm.

**Logic:**
```
1. User nhấn "Chỉ đường" trên popup marker
2. Lấy tọa độ destination (lat, lng)
3. Mở app bản đồ bằng deep link:
   ├── Android: geo:{lat},{lng}?q={lat},{lng}({name})
   └── iOS: maps:{lat},{lng}?q={name}
4. Nếu không có app bản đồ → mở Google Maps web
```

---

### 3.5 Lọc theo loại + bán kính

**Mô tả:** Lọc markers trên map theo loại địa điểm và khoảng cách.

**Logic:**
```
Category chips: [Tất cả] [Khám phá] [Ăn uống] [Lưu trú]
Radius slider: 1km —————●————— 50km

Khi thay đổi filter:
├── Lọc theo category: ẩn marker không khớp loại
├── Lọc theo bán kính: ẩn marker ngoài khoảng cách
└── Tính khoảng cách: Haversine formula (GPS user → marker)
```

---

### 3.6 Check-in tự do

**Mô tả:** Tạo check-in tại bất kỳ điểm nào trên bản đồ (không cần location có sẵn).

**Logic hoạt động:**
```
1. User nhấn giữ trên map tại vị trí任意
2. Hiện popup: "Tạo check-in tại đây?"
3. Nếu OK:
   ├── Gọi API reverse geocode: GET /api/geo/reverse?lat={lat}&lng={lng}
   ├── Lấy tên địa điểm từ kết quả
   ├── Gọi API: POST /api/user/checkins {
   │     checkin_latitude: lat,
   │     checkin_longitude: lng,
   │     location_name: "Tên địa điểm",
   │     location_address: "Địa chỉ",
   │     location_type: "other"
   │   }
   ├── Backend tự tạo location mới (user-created)
   └── Hiển thị: "✅ Đã check-in!"
```

---

## 4. LOCATION DETAIL

### 4.1 Hiển thị thông tin địa điểm

**Mô tả:** Hiển thị đầy đủ thông tin chi tiết của một địa điểm.

**Logic:**
```
Gọi API: GET /api/locations/{id}

Hiển thị:
├── Ảnh bìa (swipeable gallery từ mảng images)
├── Tên địa điểm
├── Rating + số đánh giá
├── Địa chỉ
├── Trạng thái mở/đóng (dựa vào opening_hours + giờ hiện tại)
├── Giờ mở cửa
├── Số điện thoại (nhấn → gọi điện)
├── Email (nhấn → gửi email)
├── Website (nhấn → mở web)
└── Mô tả
```

---

### 4.2 Tab Đánh giá (Reviews)

**Mô tả:** Xem và viết đánh giá cho địa điểm.

**Logic xem đánh giá:**
```
1. Gọi API: GET /api/locations/{id}/reviews
2. Hiển thị danh sách review:
   ├── Avatar + tên user
   ├── Star rating (1-5)
   ├── Nội dung comment
   ├── Ảnh đính kèm (nếu có)
   ├── Thời gian
   └── Phản hồi của chủ địa điểm (nếu có)

3. Filter theo sao: nhấn [5★] [4★] [3★] [2★] [1★]
   → Lọc client-side, chỉ hiện review có rating khớp
```

**Logic viết đánh giá:**
```
1. User nhấn "✍️ Viết đánh giá"
2. Hiện form:
   ├── Chọn sao: [☆☆☆☆☆] (nhấn chọn 1-5, step 0.5)
   ├── Nhận xét: TextInput multiline
   └── Thêm ảnh: [+] mở image picker (tối đa 5 ảnh)

3. Upload ảnh (nếu có):
   ├── Gọi API: POST /api/user/reviews/upload (FormData: image)
   └── Nhận lại image_url

4. Gửi đánh giá:
   ├── Gọi API: POST /api/user/reviews { location_id, rating, comment, images[] }
   ├── Backend tự động:
   │   ├── Tính lại rating trung bình của location
   │   ├── Cập nhật total_reviews
   │   └── Gửi thông báo cho chủ địa điểm
   └── Hiển thị: "✅ Đã gửi đánh giá!"
```

---

### 4.3 Voucher theo địa điểm

**Mô tả:** Xem và lưu voucher áp dụng cho địa điểm này.

**Logic:**
```
1. Gọi API: GET /api/user/vouchers/location/{locationId}
2. Hiển thị danh sách voucher:
   ├── Mã voucher
   ├── Loại giảm: % hoặc số tiền
   ├── Điều kiện: đơn tối thiểu, ngày hết hạn
   ├── Trạng thái: đã lưu / chưa lưu
   └── Nút "Lưu voucher" (nếu chưa lưu)

3. Nhấn "Lưu voucher":
   ├── Gọi API: POST /api/user/vouchers/{id}/claim
   ├── Thành công: "✅ Đã lưu voucher!"
   └── Lỗi: "Voucher đã hết hạn" hoặc "Đã đạt giới hạn"
```

---

### 4.4 Lưu yêu thích (Favorite)

**Mô tả:** Thêm/bỏ địa điểm khỏi danh sách yêu thích.

**Logic:**
```
Nhấn nút ❤️:
├── Nếu chưa lưu:
│   ├── Gọi API: PATCH /api/user/favorites/{locationId} { note: "", tags: [] }
│   ├── Nút chuyển thành ❤️ (đỏ, filled)
│   └── Hiện toast: "Đã lưu yêu thích"
│
└── Nếu đã lưu:
    ├── Gọi API: DELETE /api/user/favorites/{locationId}
    ├── Nút chuyển thành 🤍 (trống)
    └── Hiện toast: "Đã bỏ lưu"
```

---

### 4.5 Báo cáo sai thông tin

**Mô tả:** Cho phép user báo cáo địa điểm có thông tin sai.

**Logic:**
```
1. User nhấn "🚨 Báo cáo sai thông tin"
2. Hiện modal với form:
   ├── Mô tả vấn đề: TextInput multiline (bắt buộc)
   └── Loại báo cáo: [Spam] [Không phù hợp] [Lừa đảo] [Khác]

3. Gọi API: POST /api/user/reports/location {
      location_id,
      description,
      report_type: "other",
      severity: "low"
   }

4. Thành công: "✅ Đã gửi báo cáo, cảm ơn bạn!"
```

---

### 4.6 Đặt chỗ ngay

**Mô tả:** Chuyển đến màn hình Booking để đặt dịch vụ tại địa điểm.

**Logic:**
```
Nhấn nút "📅 Đặt chỗ ngay":
├── Lấy location_id từ route params
├── Navigate → Booking screen với location_id
└── Booking screen tự động load dịch vụ của location
```

---

## 5. BOOKING SYSTEM

### 5.1 Đặt vé tham quan (Ticket Booking)

**Mô tả:** Đặt mua vé tham quan tại địa điểm du lịch.

**Logic hoạt động:**
```
BƯỚC 1: Chọn dịch vụ
├── Gọi API: GET /api/locations/{id}/services?type=ticket
├── Hiển thị danh sách vé:
│   ├── Vé người lớn: 150,000đ
│   ├── Vé trẻ em: 80,000đ
│   └── Vé VIP: 300,000đ
├── Kiểm tra tồn kho realtime: GET /api/locations/{id}/tickets/realtime-stock
└── User chọn số lượng: [-] quantity [+]

BƯỚC 2: Chọn ngày
├── DatePicker: chọn ngày sử dụng vé
├── Validate: không được chọn ngày quá khứ
└── Validate: không được chọn quá 3 ngày tới (backend rule)

BƯỚC 3: Áp dụng voucher (tùy chọn)
├── Gọi API: GET /api/user/vouchers/saved
├── Hiển thị modal chọn voucher (chỉ hiện voucher áp dụng cho ticket)
├── Validate: voucher còn hạn, chưa dùng hết
└── Tính giảm giá: % hoặc số tiền

BƯỚC 4: Xác nhận & Thanh toán
├── Hiển thị tổng tiền:
│   ├── Tạm tính: tổng giá vé × số lượng
│   ├── Giảm giá: -voucher discount
│   └── Tổng cộng: tạm tính - giảm giá
│
├── Gọi API: POST /api/bookings {
│     location_id, service_id, check_in_date,
│     quantity, source: "mobile",
│     ticket_items: [{ service_id, quantity }],
│     voucher_code: "ABC123"
│   }
│
├── Backend trả về: booking_id + payment info (qr_data)
│
└── Hiển thị màn hình thanh toán:
    ├── QR code (VietQR image)
    ├── Thông tin chuyển khoản:
    │   ├── Ngân hàng: Vietcombank
    │   ├── STK: 1234567890
    │   ├── Chủ TK: MAI NHUT MINH
    │   ├── Số tiền: 330,000đ
    │   └── Nội dung: TC-BOOKING-100
    │
    ├── Nút "📋 Sao chép thông tin" → copy vào clipboard
    │
    └── Nút "✅ Xác nhận đã chuyển khoản"
        ├── Gọi API: POST /api/bookings/{id}/tickets/confirm-transfer
        ├── Backend: chuyển booking → confirmed, phát hành tickets
        └── Hiển thị: "✅ Đã xác nhận! Vé sẽ được phát hành."
```

---

### 5.2 Đặt bàn nhà hàng (Table Booking)

**Mô tả:** Đặt bàn tại nhà hàng/quán cafe, có thể đặt trước đồ ăn.

**Logic hoạt động:**
```
BƯỚC 1: Chọn ngày + giờ
├── DatePicker: chọn ngày
├── TimePicker: chọn giờ
├── Validate: giờ nằm trong opening_hours
└── Validate: không quá 3 ngày tới

BƯỚC 2: Chọn bàn (sơ đồ)
├── Gọi API: GET /api/locations/{id}/pos/areas → danh sách khu vực
├── Gọi API: GET /api/locations/{id}/pos/tables?check_in_date={date}
├── Hiển thị sơ đồ bàn theo khu vực:
│   ├── Khu A: [■] [□] [■] [□]
│   ├── Khu B: [□] [□] [■]
│   └── ■ = occupied/reserved, □ = free
│
├── Nhấn bàn trống (□) → chọn bàn (hiển thị viền xanh)
├── Nhấn bàn đã chọn → bỏ chọn
└── Validate: phải chọn ít nhất 1 bàn

BƯỚC 3: Đặt trước đồ ăn (tùy chọn)
├── Gọi API: GET /api/locations/{id}/services?type=food
├── Hiển thị menu theo category (Món chính, Đồ uống, Tráng miệng...)
├── User chọn số lượng: [-] quantity [+]
└── Tổng tiền đồ ăn = tổng (giá × số lượng)

BƯỚC 4: Nhập thông tin liên hệ
├── Tên liên hệ: bắt buộc
├── Số điện thoại: bắt buộc, 10 số
└── Validate: không được trống

BƯỚC 5: Áp dụng voucher (tùy chọn)
├── Gọi API: GET /api/user/vouchers/saved
├── Chọn voucher áp dụng cho food/table
└── Tính giảm giá

BƯỚC 6: Thanh toán
├── Gọi API: POST /api/bookings {
│     location_id, service_id, check_in_date,
│     quantity: 1, source: "mobile",
│     table_ids: [2, 4],
│     preorder_items: [{ service_id: 10, quantity: 2 }],
│     contact_name, contact_phone,
│     voucher_code
│   }
│
├── Hiển thị QR + thông tin chuyển khoản
│
└── Nút "✅ Xác nhận đã thanh toán"
    ├── Gọi API: POST /api/bookings/{id}/tables/confirm-transfer
    └── Backend: xác nhận booking, giữ bàn
```

---

### 5.3 Đặt phòng khách sạn (Room Booking)

**Mô tả:** Đặt nhiều phòng khách sạn cùng lúc (batch booking).

**Logic hoạt động:**
```
BƯỚC 1: Chọn ngày nhận/trả
├── DatePicker: ngày nhận phòng
├── DatePicker: ngày trả phòng
├── Tự động tính số đêm
└── Validate: trả phải sau nhận, không quá 30 ngày

BƯỚC 2: Chọn phòng
├── Gọi API: GET /api/locations/{id}/services?type=room
├── Hiển thị danh sách loại phòng:
│   ├── 🛏️ Phòng Deluxe: 1,200,000đ/đêm, còn 3 phòng
│   ├── 🛏️ Phòng Standard: 800,000đ/đêm, còn 5 phòng
│   └── 🛏️ Phòng VIP: 2,000,000đ/đêm, còn 1 phòng
│
├── User chọn số lượng: [-] quantity [+]
├── Validate: không vượt quá số phòng còn trống
└── Tổng tiền = tổng (giá/đêm × số đêm × số lượng)

BƯỚC 3: Nhập thông tin liên hệ
├── Tên liên hệ: bắt buộc
├── Số điện thoại: bắt buộc
└── Validate: không được trống

BƯỚC 4: Áp dụng voucher (tùy chọn)

BƯỚC 5: Thanh toán batch
├── Gọi API: POST /api/bookings/batch {
│     location_id, service_ids: [1, 3],
│     check_in_date, check_out_date,
│     source: "mobile",
│     reserve_on_confirm: true,
│     voucher_code
│   }
│
├── Backend tạo nhiều bookings → trả về booking_ids
│
├── Gọi API: POST /api/bookings/batch/payments {
│     booking_ids: [101, 102]
│   }
│
├── Hiển thị QR + thông tin chuyển khoản
│
└── Nút "✅ Xác nhận đã chuyển khoản"
    ├── Gọi API: POST /api/bookings/batch/rooms/confirm-transfer { payment_id }
    └── Backend: xác nhận tất cả bookings, giữ phòng
```

---

### 5.4 Hủy đặt chỗ

**Mô tả:** Hủy booking đã tạo trước đó.

**Logic:**
```
1. User nhấn "Hủy đặt chỗ" trên ticket/pass
2. Hiện dialog xác nhận:
   ├── "Bạn có chắc muốn hủy?"
   ├── "Lưu ý: Chính sách hủy của địa điểm sẽ được áp dụng"
   └── [Hủy] [Xác nhận]
3. Nếu xác nhận:
   ├── Gọi API: POST /api/bookings/{id}/cancel
   ├── Thành công: "✅ Đã hủy đặt chỗ"
   └── Lỗi: "Không thể hủy" (đã quá thời gian cho phép)
```

---

## 6. TICKETS & PASSES

### 6.1 Vé du lịch (Tour Tab)

**Mô tả:** Hiển thị danh sách vé du lịch đã mua với QR code.

**Logic:**
```
1. Gọi API: GET /api/user/tickets
2. Nhóm vé theo booking_id
3. Hiển thị mỗi vé:
   ├── Ảnh địa điểm
   ├── Tên dịch vụ + số lượng
   ├── Ngày sử dụng
   ├── Mã vé (ticket_code)
   ├── QR code (từ ticket_code)
   └── Trạng thái:
       ├── 🟢 Chưa sử dụng (unused) → QR rõ, có thể quét
       ├── 🔴 Đã sử dụng (used) → QR mờ, không quét được
       ├── ⚪ Đã hết hạn (expired) → QR mờ
       └── ❌ Đã hủy (void) → QR mờ
```

---

### 6.2 Pass đặt bàn (Table Tab)

**Mô tả:** Hiển thị pass đặt bàn nhà hàng với QR code.

**Logic:**
```
1. Gọi API: GET /api/bookings/table-reservations/pass
2. Hiển thị mỗi pass:
   ├── Tên nhà hàng
   ├── Ngày + giờ đặt bàn
   ├── Tên bàn đã chọn
   ├── Số tiền đặt cọc
   ├── QR code (dùng để check-in tại nhà hàng)
   └── Trạng thái:
       ├── 🟡 Chờ xác nhận (pending) → QR mờ
       ├── 🟢 Đã xác nhận (confirmed) → QR rõ
       ├── 🔴 Đã hoàn thành (completed) → QR mờ
       └── ⚪ Đã hủy (cancelled) → QR mờ
```

---

### 6.3 Pass đặt phòng (Room Tab)

**Mô tả:** Hiển thị pass đặt phòng khách sạn với QR code.

**Logic:**
```
1. Gọi API: GET /api/bookings/room-reservations/pass
2. Hiển thị mỗi pass:
   ├── Tên khách sạn
   ├── Ngày nhận / ngày trả
   ├── Số đêm
   ├── Tên phòng đã đặt
   ├── Tổng tiền
   ├── QR code
   └── Trạng thái: (giống Table Pass)
```

---

## 7. PROFILE

### 7.1 Xem hồ sơ

**Mô tả:** Hiển thị thông tin cá nhân và thống kê hoạt động.

**Logic:**
```
Gọi API: GET /api/user/profile

Hiển thị:
├── Ảnh bìa (background_url)
├── Avatar (avatar_url)
├── Họ tên
├── Hạng thành viên (member_tier): Đồng / Bạc / Vàng / Kim cương
├── Thống kê:
│   ├── Số check-in
│   ├── Số đơn hàng
│   ├── Tổng chi tiêu
│   └── Địa điểm yêu thích nhất
├── Tiến trình lên hạng (check-in count / target)
└── Email (read-only)
```

---

### 7.2 Chỉnh sửa hồ sơ

**Mô tả:** Cập nhật thông tin cá nhân.

**Logic:**
```
1. User chỉnh sửa: Họ tên, SĐT, Địa chỉ
2. Validate:
   ├── Họ tên: không trống, không ký tự đặc biệt
   ├── SĐT: 10 số, bắt đầu bằng 0
   └── Địa chỉ: tùy chọn
3. Gọi API: PUT /api/user/profile { full_name, phone, address }
4. Thành công: "✅ Đã cập nhật hồ sơ!"
5. Cập nhật Zustand store
```

---

### 7.3 Đổi avatar / ảnh bìa

**Mô tả:** Upload ảnh đại diện hoặc ảnh bìa mới.

**Logic:**
```
1. User nhấn vào avatar hoặc nút "Đổi ảnh bìa"
2. Mở expo-image-picker:
   ├── Chọn từ thư viện
   └── Chụp ảnh mới
3. Validate: kích thước ≤ 50MB
4. Upload:
   ├── Avatar: POST /api/user/profile/avatar (FormData: avatar)
   └── Ảnh bìa: POST /api/user/profile/background (FormData: background)
5. Nhận lại URL ảnh mới
6. Cập nhật UI + Zustand store
```

---

## 8. CHECK-IN

### 8.1 Check-in GPS

**Mô tả:** Tạo check-in tại một địa điểm có sẵn trong hệ thống.

**Logic hoạt động:**
```
1. User chọn địa điểm (từ danh sách hoặc map)
2. Lấy GPS hiện tại
3. Validate khoảng cách:
   ├── Tính khoảng cách GPS user → location (Haversine)
   ├── Nếu ≤ 500m: cho phép check-in
   └── Nếu > 500m: "Bạn quá xa địa điểm này"

4. Validate rate limit (backend):
   ├── 30 giây giữa 2 lần check-in
   ├── 2 phút giữa 2 lần check-in cùng địa điểm
   ├── 20 lần/giờ
   ├── 100 lần/ngày
   └── 20 địa điểm mới/ngày

5. Gọi API: POST /api/user/checkins {
      location_id,
      checkin_latitude: gps_lat,
      checkin_longitude: gps_lng,
      notes: "Ghi chú (tùy chọn)"
   }

6. Backend trả về:
   ├── checkin_id
   ├── location_id
   ├── safety_warning (nếu có cảnh báo an toàn)
   └── safety_message

7. Hiển thị: "✅ Đã check-in tại {tên địa điểm}!"
```

---

### 8.2 Check-in với ảnh

**Mô tả:** Tạo check-in kèm theo ảnh chụp tại địa điểm.

**Logic:**
```
1. User chụp ảnh hoặc chọn từ thư viện (expo-image-picker)
2. Validate: kích thước ≤ 50MB
3. Gọi API: POST /api/user/checkins/photo (FormData)
   ├── photo: file ảnh
   ├── location_id
   ├── checkin_latitude
   ├── checkin_longitude
   └── notes
4. Backend: upload ảnh + tạo check-in
5. Hiển thị: "✅ Đã check-in với ảnh!"
```

---

## 9. HISTORY

### 9.1 Timeline lịch sử check-in

**Mô tả:** Hiển thị tất cả check-in theo thời gian, grouped theo địa điểm.

**Logic:**
```
1. Gọi API: GET /api/user/checkins
2. Sắp xếp theo thời gian giảm dần (mới nhất lên đầu)
3. Group theo location_id (gộp các check-in cùng địa điểm)
4. Hiển thị:
   ├── Map thu nhỏ với polyline nối các điểm check-in
   └── Danh sách timeline:
       ├── 📍 Tên địa điểm
       ├── Ngày + giờ check-in
       ├── Trạng thái: 🟢 verified / 🟡 pending / 🔴 failed
       └── Nhấn → chuyển đến Location Detail
```

---

## 10. SECONDARY FEATURES

### 10.1 SOS Khẩn cấp

**Mô tả:** Gửi tín hiệu khẩn cấp đến hệ thống với GPS liên tục.

**Logic hoạt động:**
```
1. User nhấn giữ nút SOS (3 giây) để kích hoạt
2. Gọi API: POST /api/sos { latitude, longitude, location_text }
3. Backend tạo sos_alert (status: pending)
4. Bắt đầu ping GPS mỗi 20 giây:
   ├── Gọi API: POST /api/sos/ping { alert_id, latitude, longitude }
   └── Lặp lại cho đến khi user nhấn "Dừng"
5. User nhấn "⏹️ Dừng SOS":
   ├── Gọi API: POST /api/sos/stop { alert_id }
   └── Dừng ping interval
6. Hiển thị: vị trí GPS, thời gian ping cuối, trạng thái
```

---

### 10.2 Nhật ký du lịch (Diary)

**Mô tả:** Ghi lại cảm xúc và ghi chú tại mỗi địa điểm đã check-in.

**Logic:**
```
Xem nhật ký:
├── Gọi API: GET /api/user/diary
└── Hiển thị danh sách: địa điểm, mood, notes, ảnh, ngày

Tạo/sửa nhật ký:
├── Chọn mood: 😊 happy | 😃 excited | 😐 neutral | 😢 sad | 😡 angry | 😴 tired
├── Nhập notes: TextInput multiline
├── Thêm ảnh: image picker (tối đa 5)
├── Gọi API: POST /api/user/diary {
│     location_id, mood, notes, images[]
│   }
└── Nếu đã có diary cho location → tự động update

Xóa nhật ký:
├── Nhấn giữ → hiện menu "Xóa"
├── Xác nhận: "Bạn có chắc muốn xóa?"
└── Gọi API: DELETE /api/user/diary/{id}
```

---

### 10.3 Địa điểm đã lưu (Saved Locations)

**Mô tả:** Danh sách địa điểm user đã lưu yêu thích.

**Logic:**
```
1. Gọi API: GET /api/user/favorites
2. Hiển thị grid cards:
   ├── Ảnh địa điểm
   ├── Tên + loại
   ├── Rating
   └── Nút ❤️ (bỏ lưu)
3. Nhấn ❤️:
   ├── Gọi API: DELETE /api/user/favorites/{locationId}
   └── Xóa khỏi danh sách
4. Nhấn card → Location Detail
```

---

### 10.4 Voucher đã lưu

**Mô tả:** Danh sách voucher user đã lưu.

**Logic:**
```
1. Gọi API: GET /api/user/vouchers/saved
2. Filter: [Tất cả] [Còn hạn] [Hết hạn]
3. Hiển thị mỗi voucher:
   ├── Mã voucher
   ├── Loại giảm (% hoặc tiền)
   ├── Số tiền giảm tối đa
   ├── Điều kiện (đơn tối thiểu)
   ├── Ngày hết hạn
   ├── Địa điểm áp dụng
   └── Số lần còn dùng
```

---

### 10.5 Nhắc nhở đặt chỗ (Booking Reminders)

**Mô tả:** Hiển thị các đặt chỗ sắp tới và đã qua.

**Logic:**
```
1. Gọi API: GET /api/user/booking-reminders
2. Filter: [Tất cả] [Sắp tới] [Đã xong] [Đã hủy]
3. Hiển thị mỗi reminder:
   ├── Loại dịch vụ: 🎫 Tour / 🍽️ Nhà hàng / 🏨 Khách sạn
   ├── Tên địa điểm + địa chỉ
   ├── Ngày check-in / check-out
   ├── Ghi chú
   └── Trạng thái nhắc nhở: đã gửi / chưa gửi
```

---

### 10.6 Bảng xếp hạng (Leaderboard)

**Mô tả:** Xếp hạng check-in tháng hiện tại.

**Logic:**
```
1. Gọi API: GET /api/user/leaderboard
2. Hiển thị top 50:
   ├── Hạng #1: 🥇 vàng
   ├── Hạng #2: 🥈 bạc
   ├── Hạng #3: 🥉 đồng
   └── Hạng #4-50: số thứ tự
3. Mỗi dòng: Avatar + tên + số check-in
4. Highlight dòng của user hiện tại
```

---

### 10.7 Thông báo (Notifications)

**Mô tả:** Hiển thị thông báo từ hệ thống.

**Logic:**
```
1. Gọi API: GET /api/user/notifications (max 20)
2. Hiển thị danh sách:
   ├── Tiêu đề
   ├── Nội dung
   ├── Thời gian
   └── Trạng thái: chưa đọc (dot xanh) / đã đọc
3. Nút "Đánh dấu đã đọc tất cả":
   └── Gọi API: POST /api/user/notifications/read-all
4. Nút "Xóa tất cả":
   └── Gọi API: POST /api/user/notifications/delete-all
```

---

*Cập nhật: 2026-06-05*
