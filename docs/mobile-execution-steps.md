# 🛠️ KẾ HOẠCH THỰC HIỆN TỪNG BƯỚC — Mobile Rebuild

> **Ngày tạo:** 2026-06-05
> **Mục đích:** Chia nhỏ công việc thành từng bước test được trên Expo Go
> **Nguyên tắc:** Mỗi bước → code → test → bạn xác nhận → mới qua bước tiếp

---

## CÁCH HOẠT ĐỘNG

```
Mỗi bước bao gồm:
├── 📝 Mô tả: làm gì ở bước này
├── 📁 File liên quan: những file sẽ tạo/sửa
├── 🧪 Cách test: kiểm tra trên Expo Go thế nào
├── ✅ Tiêu chí đạt: như nào là OK
├── ⏱️ Ước tính: bao lâu
└── ⭐ Độ khó: Dễ / Trung bình / Khó
```

---

## GIAI ĐOẠN 1: FOUNDATION (5 bước)

### Bước 1.1 — Theme System
```
📝 Mô tả:
├── Tạo file constants/theme.ts
├── Định nghĩa màu sắc (primary, accent, background, text, error, success)
├── Định nghĩa spacing (4, 8, 12, 16, 20, 24, 32)
├── Định nghĩa typography (fontSize, fontWeight)
└── Định nghĩa borderRadius (4, 8, 12, 16, full)

📁 File: constants/theme.ts

🧪 Cách test:
├── Import theme vào App.tsx
├── Tạo View với backgroundColor = theme.colors.primary
└── Nếu thấy màu xanh dương (#2563EB) → OK

✅ Tiêu chí đạt:
├── Theme object export được
├── Không lỗi TypeScript
└── Màu hiển thị đúng trên Expo Go

⏱️ Ước tính: 10 phút
⭐ Độ khó: Dễ
```

### Bước 1.2 — Types Definitions
```
📝 Mô tả:
├── Tạo file types/index.ts
├── Định nghĩa các interface chính:
│   ├── User { user_id, email, phone, full_name, avatar_url, role, ... }
│   ├── Location { location_id, location_name, location_type, latitude, longitude, rating, ... }
│   ├── Service { service_id, service_name, service_type, price, quantity, ... }
│   ├── Booking { booking_id, user_id, service_id, location_id, status, ... }
│   ├── Ticket { ticket_id, ticket_code, status, booking_id, ... }
│   ├── Review { review_id, rating, comment, images, user_name, ... }
│   ├── Voucher { voucher_id, code, campaign_name, discount_type, discount_value, ... }
│   ├── Checkin { checkin_id, location_id, checkin_time, status, ... }
│   ├── Diary { diary_id, location_id, mood, notes, images, ... }
│   ├── Notification { notification_id, title, body, is_read, ... }
│   └── ApiResponse<T> { success, message, data: T }
└── Export tất cả

📁 File: types/index.ts

🧪 Cách test:
├── Import User vào file khác
├── Tạo const user: User = { ... }
└── Nếu TypeScript không báo lỗi → OK

✅ Tiêu chí đạt:
├── Tất cả interface compile được
├── Match với API response từ backend
└── Không lỗi TypeScript

⏱️ Ước tính: 20 phút
⭐ Độ khó: Dễ
```

### Bước 1.3 — Axios Client
```
📝 Mô tả:
├── Tạo file api/axiosClient.ts
├── Tạo axios instance với baseURL từ process.env.EXPO_PUBLIC_API_URL
├── Request interceptor: tự động attach Bearer token từ AsyncStorage
├── Response interceptor: khi 401 → tự động refresh token → retry request
├── Xử lý lỗi: network error, timeout, server error
└── Export axiosClient

📁 File: api/axiosClient.ts

🧪 Cách test:
├── Import axiosClient
├── Gọi axiosClient.get('/locations') 
├── Nếu nhận được response (không lỗi network) → OK
└── Kiểm tra console.log không có lỗi

✅ Tiêu chí đạt:
├── baseURL đọc đúng từ .env
├── Token tự động attach vào header
├── Refresh token hoạt động khi 401
└── Không crash khi network error

⏱️ Ước tính: 25 phút
⭐ Độ khó: Trung bình
```

### Bước 1.4 — API Endpoints
```
📝 Mô tả:
├── Tạo file api/endpoints.ts
├── Định nghĩa tất cả endpoint functions:
│   ├── authApi: login, register, verifyOtp, forgotPassword, logout, refreshToken
│   ├── userApi: getProfile, updateProfile, uploadAvatar, getCheckins, getFavorites, ...
│   ├── locationApi: getLocations, getLocationById, getServices, getReviews, ...
│   ├── bookingApi: createBooking, createBatch, getTickets, getTablePass, getRoomPass, ...
│   ├── sosApi: sendSos, pingSos, stopSos
│   ├── geoApi: search, reverse
│   └── voucherApi: getByLocation, getSaved, claim
└── Mỗi function gọi axiosClient với đúng method + path + params

📁 File: api/endpoints.ts

🧪 Cách test:
├── Import locationApi
├── Gọi locationApi.getLocations()
├── Nếu nhận được danh sách locations → OK
└── Kiểm tra response shape match với types

✅ Tiêu chí đạt:
├── Tất cả 87 endpoints được map
├── Params match với backend API
├── Response parse đúng types
└── Không lỗi TypeScript

⏱️ Ước tính: 30 phút
⭐ Độ khó: Dễ (chỉ là mapping)
```

### Bước 1.5 — Auth Store (Zustand)
```
📝 Mô tả:
├── Tạo file store/useAuthStore.ts
├── Tạo Zustand store với state:
│   ├── user: User | null
│   ├── isAuthenticated: boolean
│   ├── isLoading: boolean
│   └── error: string | null
├── Actions:
│   ├── login(email, password): gọi authApi → lưu token → set user
│   ├── register(email, phone, password, fullName): gọi authApi
│   ├── verifyOtp(email, otp): gọi authApi
│   ├── logout(): xóa token → reset user
│   ├── loadSession(): đọc token từ AsyncStorage → validate
│   └── clearError(): xóa error message
└── Persist: lưu user vào AsyncStorage (không lưu password)

📁 File: store/useAuthStore.ts

🧪 Cách test:
├── Import useAuthStore
├── Gọi store.login("test@example.com", "123456")
├── Nếu store.isAuthenticated = true → OK
├── Gọi store.logout()
└── Nếu store.isAuthenticated = false → OK

✅ Tiêu chí đạt:
├── Login/logout hoạt động
├── Token lưu vào AsyncStorage
├── User state persist qua restart app
└── Error handling hoạt động

⏱️ Ước tính: 25 phút
⭐ Độ khó: Trung bình
```

---

## GIAI ĐOẠN 2: AUTH FLOW (4 bước)

### Bước 2.1 — Root Layout + Tab Navigator
```
📝 Mô tả:
├── Sửa app/_layout.tsx:
│   ├── Import Stack từ expo-router
│   ├── Wrap với SafeAreaProvider + GestureHandlerRootView
│   ├── Định nghĩa screen options (headerShown: false)
│   └── Kiểm tra auth state → redirect đúng route
├── Tạo app/(tabs)/_layout.tsx:
│   ├── Import Tabs từ expo-router
│   ├── 5 tabs: Home (index), Map, Tickets, Profile, History
│   ├── Tab icons: Ionicons hoặc Expo icons
│   ├── Tab bar style: theme colors
│   └── Active/inactive color
└── Tạo app/+not-found.tsx (404 page đơn giản)

📁 File: app/_layout.tsx, app/(tabs)/_layout.tsx, app/+not-found.tsx

🧪 Cách test:
├── Chạy Expo Go
├── Thấy 5 tabs ở dưới cùng
├── Nhấn mỗi tab → chuyển đúng màn hình
└── Không crash

✅ Tiêu chí đạt:
├── 5 tabs hiển thị
├── Navigation hoạt động
├── SafeArea không che notch
└── Không lỗi

⏱️ Ước tính: 20 phút
⭐ Độ khó: Trung bình
```

### Bước 2.2 — Login Screen
```
📝 Mô tả:
├── Tạo app/login.tsx
├── UI components:
│   ├── Logo/app name
│   ├── Input: Email (keyboard type email)
│   ├── Input: Password (secureTextEntry, show/hide toggle)
│   ├── Button: "Đăng nhập" (primary, loading state)
│   ├── Divider: "── Hoặc ──"
│   ├── Button: "Đăng nhập bằng Google" (outline)
│   ├── Link: "Quên mật khẩu?" → forgot-password.tsx
│   └── Link: "Đăng ký" → register.tsx
├── KeyboardAvoidingView bọc form
├── Gọi useAuthStore().login(email, password)
├── Loading state khi đang gọi API
├── Error message hiển thị dưới input
└── Navigate sang (tabs) khi thành công

📁 File: app/login.tsx

🧪 Cách test:
├── Mở app → thấy màn hình Login
├── Nhập email + password → nhấn Đăng nhập
├── Nếu đúng → chuyển sang Home (tabs)
├── Nếu sai → hiện lỗi "Email hoặc mật khẩu không đúng"
├── Nhấn "Đăng ký" → chuyển sang Register
└── Bàn phím không che input

✅ Tiêu chí đạt:
├── Form hiển thị đẹp
├── KeyboardAvoidingView hoạt động
├── Login thành công → Home
├── Login thất bại → hiện lỗi
├── Loading state khi đang gọi API
└── Navigation hoạt động

⏱️ Ước tính: 30 phút
⭐ Độ khó: Trung bình
```

### Bước 2.3 — Register + OTP Screen
```
📝 Mô tả:
├── Tạo app/register.tsx
├── Bước 1: Form đăng ký
│   ├── Input: Họ tên
│   ├── Input: Email
│   ├── Input: Số điện thoại
│   ├── Input: Mật khẩu
│   ├── Input: Nhập lại mật khẩu
│   ├── Button: "Tiếp theo (Gửi OTP)"
│   └── Validate: tất cả trường bắt buộc, password match
├── Bước 2: Nhập OTP
│   ├── 6 ô nhập OTP (auto-focus next khi nhập)
│   ├── Text: "Mã OTP đã gửi về email {email}"
│   ├── Button: "Xác nhận"
│   ├── Link: "Gửi lại OTP" (đếm ngược 60s)
│   └── Gọi API verifyOtp → thành công → về Login
└── Back button quay về Login

📁 File: app/register.tsx

🧪 Cách test:
├── Nhập thông tin hợp lệ → gửi OTP → nhận OTP về email
├── Nhập đúng OTP → "Đăng ký thành công" → về Login
├── Nhập sai OTP → hiện lỗi
├── Validate: password không khớp → hiện lỗi
└── Nhập email đã tồn tại → hiện lỗi

✅ Tiêu chí đạt:
├── 2 bước hoạt động mượt
├── OTP auto-focus
├── Validate đầy đủ
└── Register thành công → về Login

⏱️ Ước tính: 35 phút
⭐ Độ khó: Trung bình
```

### Bước 2.4 — Forgot Password Screen
```
📝 Mô tả:
├── Tạo app/forgot-password.tsx
├── Bước 1: Nhập Email + SĐT
│   ├── Input: Email
│   ├── Input: Số điện thoại
│   └── Button: "Gửi OTP"
├── Bước 2: Xác nhận OTP
│   ├── 6 ô nhập OTP
│   └── Button: "Xác nhận"
├── Bước 3: Đặt mật khẩu mới
│   ├── Input: Mật khẩu mới
│   ├── Input: Nhập lại mật khẩu
│   └── Button: "Đặt lại mật khẩu"
└── Back button quay về Login

📁 File: app/forgot-password.tsx

🧪 Cách test:
├── Nhập email + SĐT đúng → nhận OTP
├── Nhập đúng OTP → chuyển bước 3
├── Đặt mật khẩu mới → "Thành công" → về Login
└── Login bằng mật khẩu mới → OK

✅ Tiêu chí đạt:
├── 3 bước hoạt động
├── Validate đầy đủ
└── Reset thành công → login được bằng MK mới

⏱️ Ước tính: 25 phút
⭐ Độ khó: Trung bình
```

---

## GIAI ĐOẠN 3: TAB SCREENS (3 bước)

### Bước 3.1 — Home Screen (Basic)
```
📝 Mô tả:
├── Tạo app/(tabs)/index.tsx
├── Header: "Xin chào, {user.name}!" + nút 🔔 notifications
├── Weather bar: nhiệt độ + thành phố (Open-Meteo API)
├── Search bar: tìm kiếm địa điểm (debounce 300ms)
├── Category chips: [Tất cả] [Khám phá] [Ăn uống] [Lưu trú]
├── Location cards: FlatList 2 cột, mỗi card có ảnh + tên + rating
├── Loading skeleton khi đang load
└── Empty state khi không có kết quả

📁 File: app/(tabs)/index.tsx

🧪 Cách test:
├── Mở tab Home → thấy lời chào + thời tiết
├── Gõ tìm kiếm → danh sách thay đổi
├── Nhấn chip category → danh sách lọc
├── Nhấn card → chuyển Location Detail
└── Vuốt xuống → refresh

✅ Tiêu chí đạt:
├── Hiển thị danh sách địa điểm
├── Tìm kiếm hoạt động
├── Filter hoạt động
├── Navigation hoạt động
└── Không crash

⏱️ Ước tính: 45 phút
⭐ Độ khó: Trung bình
```

### Bước 3.2 — Profile Screen
```
📝 Mô tả:
├── Tạo app/(tabs)/profile.tsx
├── Header: ảnh bìa + avatar + tên + hạng thành viên
├── Stats: check-ins, orders, spending (3 ô)
├── Form chỉnh sửa: họ tên, SĐT, địa chỉ
├── Nút "Lưu thay đổi"
├── Nút "Đổi ảnh đại diện" (image picker)
├── Nút "Đổi ảnh bìa" (image picker)
└── Nút "Đăng xuất" (confirm dialog)

📁 File: app/(tabs)/profile.tsx

🧪 Cách test:
├── Mở tab Profile → thấy thông tin đúng
├── Chỉnh sửa tên → lưu → thấy tên mới
├── Đổi avatar → thấy ảnh mới
├── Nhấn Đăng xuất → về Login
└── Đăng nhập lại → thông tin vẫn còn

✅ Tiêu chí đạt:
├── Hiển thị đúng thông tin user
├── Edit + save hoạt động
├── Upload avatar hoạt động
└── Logout hoạt động

⏱️ Ước tính: 35 phút
⭐ Độ khó: Trung bình
```

### Bước 3.3 — Notifications Screen
```
📝 Mô tả:
├── Tạo app/notifications.tsx
├── Header: "Thông báo" + nút "Đọc tất cả"
├── Danh sách notifications (FlatList)
├── Mỗi item: title, body, thời gian, chấm xanh (chưa đọc)
├── Swipe để xóa
└── Empty state: "Không có thông báo"

📁 File: app/notifications.tsx

🧪 cách test:
├── Nhấn 🔔 trên Home → mở Notifications
├── Thấy danh sách thông báo
├── Nhấn "Đọc tất cả" → chấm xanh biến mất
└── Vuốt xóa → thông báo biến mất

✅ Tiêu chí đạt:
├── Danh sách hiển thị đúng
├── Đọc tất cả hoạt động
└── Xóa hoạt động

⏱️ Ước tính: 20 phút
⭐ Độ khó: Dễ
```

---

## GIAI ĐOẠN 4: MAP & CHECK-IN (5 bước)

### Bước 4.1 — Map Screen (Basic)
```
📝 Mô tả:
├── Tạo app/(tabs)/map.tsx
├── MapView với OSM tiles (provider=null, UrlTile)
├── Hiển thị GPS dot (vị trí hiện tại)
├── Hiển thị markers cho tất cả locations
├── Marker custom: ảnh tròn + tên
├── Nhấn marker → hiện popup với nút "Xem chi tiết"
└── Nút GPS button (quay về vị trí hiện tại)

📁 File: app/(tabs)/map.tsx

🧪 cách test:
├── Mở tab Map → thấy bản đồ OSM
├── Thấy vị trí hiện tại (GPS dot xanh)
├── Thấy markers các địa điểm
├── Nhấn marker → hiện popup
├── Nhấn "Xem chi tiết" → chuyển Location Detail
└── Kéo/zoom bản đồ mượt

✅ Tiêu chí đạt:
├── Bản đồ OSM hiển thị
├── GPS hoạt động
├── Markers hiển thị đúng vị trí
└── Navigation hoạt động

⏱️ Ước tính: 50 phút
⭐ Độ khó: Khó
```

### Bước 4.2 — Map Search + Filter
```
📝 Mô tả:
├── Thêm search bar nổi trên map
├── Thêm category chips nổi
├── Thêm radius slider nổi
├── Search: debounce 300ms → gọi API → hiện marker mới
├── Category filter: ẩn/hiện markers theo loại
└── Radius filter: ẩn markers ngoài bán kính

📁 File: app/(tabs)/map.tsx (sửa)

🧪 cách test:
├── Gõ tìm kiếm → marker mới hiện trên map
├── Nhấn chip "Ăn uống" → chỉ hiện markers nhà hàng
├── Kéo slider 10km → chỉ hiện markers trong 10km
└── Kết hợp filter: vừa search vừa filter loại

✅ Tiêu chí đạt:
├── Search hoạt động
├── Category filter hoạt động
├── Radius filter hoạt động
└── Kết hợp filter OK

⏱️ Ước tính: 30 phút
⭐ Độ khó: Trung bình
```

### Bước 4.3 — Check-in GPS
```
📝 Mô tả:
├── Tạo app/checkin.tsx
├── Chọn địa điểm (từ danh sách hoặc map)
├── Lấy GPS hiện tại
├── Validate khoảng cách (≤ 500m)
├── Gọi API check-in
├── Hiển thị kết quả: thành công / lỗi / cảnh báo
└── Nếu quá xa: "Bạn quá xa địa điểm này"

📁 File: app/checkin.tsx

🧪 cách test:
├── Đến gần 1 địa điểm → check-in → thành công
├── Ở xa (> 500m) → check-in → "Quá xa"
├── Check-in 2 lần liên tiếp (< 30s) → "Thử lại sau"
└── Check-in thành công → thấy trong History

✅ Tiêu chí đạt:
├── GPS validation hoạt động
├── API check-in hoạt động
├── Rate limit validation
└── Kết quả hiển thị đúng

⏱️ Ước tính: 30 phút
⭐ Độ khó: Trung bình
```

### Bước 4.4 — Chỉ đường + Check-in tự do
```
📝 Mô tả:
├── Thêm nút "Chỉ đường" trên popup marker
├── Mở Google Maps/Apple Maps bằng deep link
├── Thêm chức năng check-in tự do (nhấn giữ trên map)
├── Reverse geocode → tạo location mới → check-in
└── Hiển thị marker mới trên map

📁 File: app/(tabs)/map.tsx (sửa)

🧪 cách test:
├── Nhấn "Chỉ đường" → mở Google Maps
├── Nhấn giữ trên map → "Tạo check-in tại đây?"
├── Xác nhận → check-in thành công
└── Marker mới hiện trên map

✅ Tiêu chí đạt:
├── Deep link mở Google Maps
├── Check-in tự do hoạt động
└── Marker mới hiển thị

⏱️ Ước tính: 20 phút
⭐ Độ khó: Dễ
```

### Bước 4.5 — History Screen
```
📝 Mô tả:
├── Tạo app/(tabs)/history.tsx
├── Map thu nhỏ ở trên (polyline nối các điểm)
├── Danh sách check-in bên dưới (FlatList)
├── Mỗi item: tên địa điểm, ngày giờ, trạng thái
├── Nhấn item → Location Detail
└── Pull to refresh

📁 File: app/(tabs)/history.tsx

🧪 cách test:
├── Check-in vài địa điểm
├── Mở History → thấy danh sách
├── Map hiện polyline nối các điểm
├── Nhấn item → Location Detail
└── Vuốt xuống → refresh

✅ Tiêu chí đạt:
├── Danh sách hiển thị đúng
├── Map polyline hoạt động
├── Navigation hoạt động
└── Refresh hoạt động

⏱️ Ước tính: 30 phút
⭐ Độ khó: Trung bình
```

---

## GIAI ĐOẠN 5: LOCATION DETAIL (4 bước)

### Bước 5.1 — Location Detail (Overview)
```
📝 Mô tả:
├── Tạo app/location/[id].tsx
├── Header: back button + ❤️ favorite + ↗️ share
├── Ảnh bìa (swipeable gallery)
├── Thông tin: tên, rating, địa chỉ, giờ mở cửa, SĐT, email
├── Tab bar: [Tổng quan] [Đánh giá] [Giới thiệu]
├── Tab Tổng quan: mô tả + thông tin liên hệ
└── BIG button: "📅 Đặt chỗ ngay"

📁 File: app/location/[id].tsx

🧪 cách test:
├── Nhấn card từ Home → mở Location Detail
├── Thấy ảnh + thông tin đầy đủ
├── Vuốt ảnh → chuyển ảnh tiếp
├── Nhấn ❤️ → toggle favorite
├── Nhấn SĐT → mở app gọi điện
└── Nhấn "Đặt chỗ ngay" → Booking screen

✅ Tiêu chí đạt:
├── Hiển thị đầy đủ thông tin
├── Gallery swipe hoạt động
├── Favorite toggle hoạt động
└── Navigation hoạt động

⏱️ Ước tính: 35 phút
⭐ Độ khó: Trung bình
```

### Bước 5.2 — Tab Đánh giá + Viết review
```
📝 Mô tả:
├── Tab Đánh giá: danh sách review + filter theo sao
├── Mỗi review: avatar, tên, rating, comment, ảnh, thời gian
├── Nút "Viết đánh giá":
│   ├── Star rating selector (1-5, step 0.5)
│   ├── TextInput multiline
│   ├── Image picker (tối đa 5 ảnh)
│   └── Nút "Gửi đánh giá"
├── Upload ảnh → POST /api/user/reviews/upload
└── Gửi review → POST /api/user/reviews

📁 File: app/location/[id].tsx (sửa)

🧪 cách test:
├── Nhấn tab "Đánh giá" → thấy danh sách review
├── Nhấn [5★] → lọc review 5 sao
├── Nhấn "Viết đánh giá" → hiện form
├── Chọn sao + viết comment + thêm ảnh → gửi
├── Thấy review mới xuất hiện trong danh sách
└── Rating trung bình cập nhật

✅ Tiêu chí đạt:
├── Danh sách review hiển thị
├── Filter theo sao hoạt động
├── Viết review hoạt động
├── Upload ảnh hoạt động
└── Review mới xuất hiện ngay

⏱️ Ước tính: 35 phút
⭐ Độ khó: Trung bình
```

### Bước 5.3 — Voucher + Báo cáo
```
📝 Mô tả:
├── Hiển thị voucher theo địa điểm (nếu có)
├── Nút "Lưu voucher"
├── Form báo cáo sai thông tin
│   ├── TextInput: mô tả vấn đề
│   └── Nút "Gửi báo cáo"
└── Gọi API tương ứng

📁 File: app/location/[id].tsx (sửa)

🧪 cách test:
├── Thấy voucher (nếu có) → nhấn "Lưu" → "Đã lưu!"
├── Nhấn "Báo cáo" → nhập mô tả → gửi → "Đã gửi!"
└── Voucher đã lưu thấy trong tab Vouchers

✅ Tiêu chí đạt:
├── Voucher hiển thị + lưu được
├── Báo cáo gửi được
└── Không crash

⏱️ Ước tính: 20 phút
⭐ Độ khó: Dễ
```

### Bước 5.4 — Saved Locations Screen
```
📝 Mô tả:
├── Tạo app/saved-locations.tsx
├── Grid cards: ảnh + tên + loại + rating + ❤️
├── Nhấn ❤️ → bỏ lưu (confirm dialog)
├── Nhấn card → Location Detail
└── Empty state: "Chưa lưu địa điểm nào"

📁 File: app/saved-locations.tsx

🧪 cách test:
├── Lưu vài địa điểm từ Location Detail
├── Mở Saved Locations → thấy danh sách
├── Nhấn ❤️ → bỏ lưu → biến mất
└── Nhấn card → Location Detail

✅ Tiêu chí đạt:
├── Danh sách hiển thị đúng
├── Bỏ lưu hoạt động
└── Navigation hoạt động

⏱️ Ước tính: 15 phút
⭐ Độ khó: Dễ
```

---

## GIAI ĐOẠN 6: BOOKING SYSTEM (5 bước)

### Bước 6.1 — Booking Ticket (Basic)
```
📝 Mô tả:
├── Tạo app/booking/[serviceId].tsx
├── Hiển thị thông tin địa điểm
├── DatePicker: chọn ngày
├── Danh sách vé: tên + giá + [-] quantity [+]
├── Tính tổng tiền
├── Nút "Thanh toán VietQR"
└── Hiển thị QR + thông tin chuyển khoản

📁 File: app/booking/[serviceId].tsx

🧪 cách test:
├── Nhấn "Đặt chỗ ngay" từ Location Detail
├── Chọn ngày + số lượng vé
├── Thấy tổng tiền cập nhật
├── Nhấn "Thanh toán" → thấy QR code
└── Thông tin chuyển khoản đúng

✅ Tiêu chí đạt:
├── Chọn ngày hoạt động
├── Chọn số lượng hoạt động
├── Tính tổng tiền đúng
├── QR code hiển thị
└── Thông tin chuyển khoản đúng

⏱️ Ước tính: 35 phút
⭐ Độ khó: Trung bình
```

### Bước 6.2 — Xác nhận thanh toán + Sao chép
```
📝 Mô tả:
├── Nút "📋 Sao chép thông tin" → copy vào clipboard
├── Nút "✅ Xác nhận đã chuyển khoản"
├── Gọi API confirm-transfer
├── Loading state khi đang xác nhận
├── Thành công: "Đã xác nhận! Vé sẽ được phát hành."
└── Lỗi: "Không thể xác nhận, thử lại"

📁 File: app/booking/[serviceId].tsx (sửa)

🧪 cách test:
├── Nhấn "Sao chép" → paste ra text đúng
├── Nhấn "Xác nhận" → loading → "Thành công!"
├── Kiểm tra vé trong tab Tickets
└── Nhấn "Xác nhận" lần nữa → "Đã xác nhận rồi"

✅ Tiêu chí đạt:
├── Copy clipboard hoạt động
├── Confirm API hoạt động
├── Vé xuất hiện trong Tickets
└── Trạng thái cập nhật đúng

⏱️ Ước tính: 20 phút
⭐ Độ khó: Trung bình
```

### Bước 6.3 — Booking Table (Restaurant)
```
📝 Mô tả:
├── Thêm phần chọn bàn (sơ đồ grid)
├── Hiển thị bàn theo khu vực: ■ occupied / □ free
├── Nhấn □ → chọn bàn (viền xanh)
├── Thêm phần đặt trước đồ ăn (menu)
├── Nhập tên liên hệ + SĐT (bắt buộc)
├── Gọi API createBooking với table_ids + preorder_items
└── Thanh toán giống Ticket

📁 File: app/booking/[serviceId].tsx (sửa)

🧪 cách test:
├── Chọn nhà hàng → thấy sơ đồ bàn
├── Chọn bàn trống → hiện viền xanh
├── Chọn đồ ăn + số lượng
├── Nhập tên + SĐT
├── Thanh toán → QR → xác nhận
└── Kiểm tra Pass trong tab Tickets → Bàn

✅ Tiêu chí đạt:
├── Sơ đồ bàn hiển thị đúng
├── Chọn bàn hoạt động
├── Đặt trước đồ ăn hoạt động
├── Validate tên + SĐT
└── Thanh toán hoạt động

⏱️ Ước tính: 50 phút
⭐ Độ khó: Rất khó
```

### Bước 6.4 — Booking Room (Hotel)
```
📝 Mô tả:
├── DatePicker: ngày nhận + ngày trả
├── Tính số đêm tự động
├── Danh sách loại phòng: tên + giá/đêm + [-] quantity [+]
├── Tính tổng tiền = giá × đêm × số lượng
├── Nhập tên liên hệ + SĐT
├── Gọi API createBookingBatch
├── Thanh toán batch
└── Xác nhận batch

📁 File: app/booking/[serviceId].tsx (sửa)

🧪 cách test:
├── Chọn khách sạn → thấy danh sách phòng
├── Chọn ngày nhận/trả → thấy số đêm
├── Chọn 2 loại phòng khác nhau
├── Tổng tiền = phòng1 + phòng2
├── Thanh toán → QR → xác nhận
└── Kiểm tra Pass trong tab Tickets → Phòng

✅ Tiêu chí đạt:
├── Date picker hoạt động
├── Tính số đêm đúng
├── Multi-room hoạt động
├── Tổng tiền đúng
└── Thanh toán batch hoạt động

⏱️ Ước tính: 45 phút
⭐ Độ khó: Rất khó
```

### Bước 6.5 — Voucher selector trong Booking
```
📝 Mô tả:
├── Thêm nút "🎫 Chọn voucher" trong booking
├── Modal hiện danh sách voucher đã lưu
├── Chỉ hiện voucher áp dụng cho loại dịch vụ
├── Chọn voucher → tính giảm giá
├── Hiển thị: tạm tính - giảm giá = tổng cộng
└── Bỏ chọn voucher → tính lại

📁 File: app/booking/[serviceId].tsx (sửa)

🧪 cách test:
├── Có voucher → nhấn "Chọn voucher" → hiện modal
├── Chọn voucher → tổng tiền giảm
├── Bỏ chọn → tổng tiền về ban đầu
├── Voucher hết hạn → không hiện trong danh sách
└── Thanh toán với voucher → code đúng

✅ Tiêu chí đạt:
├── Modal voucher hoạt động
├── Tính giảm giá đúng
├── Voucher code gửi đúng khi booking
└── Bỏ chọn hoạt động

⏱️ Ước tính: 20 phút
⭐ Độ khó: Trung bình
```

---

## GIAI ĐOẠN 7: TICKETS & PASSES (2 bước)

### Bước 7.1 — Tickets Screen (Tab Tour)
```
📝 Mô tả:
├── Tạo app/(tabs)/tickets.tsx
├── Tab bar: [🎫 Tour] [🍽️ Bàn] [🏨 Phòng]
├── Tab Tour: danh sách vé đã mua
├── Mỗi vé: ảnh + tên + số lượng + ngày + QR code + trạng thái
├── Trạng thái: 🟢 unused (QR rõ) / 🔴 used (QR mờ) / ⚪ expired
├── Nhấn vé → expand chi tiết
└── Pull to refresh

📁 File: app/(tabs)/tickets.tsx

🧪 cách test:
├── Đặt vé từ Booking → mở Tickets → thấy vé mới
├── QR code hiển thị đúng
├── Trạng thái đúng (unused)
├── Vuốt xuống → refresh
└── Nhấn vé → expand chi tiết

✅ Tiêu chí đạt:
├── Danh sách vé hiển thị
├── QR code đúng
├── Trạng thái đúng
└── Refresh hoạt động

⏱️ Ước tính: 25 phút
⭐ Độ khó: Trung bình
```

### Bước 7.2 — Tab Bàn + Tab Phòng
```
📝 Mô tả:
├── Tab Bàn: danh sách pass đặt bàn
├── Tab Phòng: danh sách pass đặt phòng
├── Mỗi pass: QR + thông tin + trạng thái
├── Nút "Hủy đặt chỗ" (nếu status cho phép)
├── Confirm dialog khi hủy
└── Gọi API cancel booking

📁 File: app/(tabs)/tickets.tsx (sửa)

🧪 cách test:
├── Đặt bàn từ Booking → mở Tickets → Bàn → thấy pass
├── Đặt phòng từ Booking → mở Tickets → Phòng → thấy pass
├── Nhấn "Hủy" → xác nhận → "Đã hủy"
├── Trạng thái cập nhật → cancelled
└── QR mờ khi cancelled

✅ Tiêu chí đạt:
├── Tab Bàn hiển thị đúng
├── Tab Phòng hiển thị đúng
├── Hủy hoạt động
└── Trạng thái cập nhật đúng

⏱️ Ước tính: 25 phút
⭐ Độ khó: Trung bình
```

---

## GIAI ĐOẠN 8: SECONDARY SCREENS (6 bước)

### Bước 8.1 — Diary Screen
```
📝 Mô tả:
├── Tạo app/diary.tsx
├── Danh sách nhật ký (FlatList)
├── Mỗi item: địa điểm, mood emoji, notes, ảnh, ngày
├── Nút "+" tạo nhật ký mới
├── Form: mood selector (6 emoji) + notes + image picker
├── Nhấn giữ → menu sửa/xóa
└── Gọi API CRUD diary

📁 File: app/diary.tsx

🧪 cách test:
├── Mở Diary → thấy danh sách (có thể rỗng)
├── Nhấn "+" → chọn mood + viết notes + thêm ảnh → lưu
├── Thấy nhật ký mới trong danh sách
├── Nhấn giữ → sửa → lưu
├── Nhấn giữ → xóa → xác nhận → biến mất
└── Check-in xong → tạo nhật ký từ History

✅ Tiêu chí đạt:
├── CRUD nhật ký hoạt động
├── Mood selector hoạt động
├── Image picker hoạt động
└── Danh sách cập nhật realtime

⏱️ Ước tính: 30 phút
⭐ Độ khó: Trung bình
```

### Bước 8.2 — Vouchers Screen
```
📝 Mô tả:
├── Tạo app/vouchers.tsx
├── Danh sách voucher đã lưu
├── Filter: [Tất cả] [Còn hạn] [Hết hạn]
├── Mỗi voucher: mã, giảm giá, điều kiện, ngày hết hạn, địa điểm
└── Empty state: "Chưa lưu voucher nào"

📁 File: app/vouchers.tsx

🧪 cách test:
├── Lưu voucher từ Location Detail
├── Mở Vouchers → thấy voucher
├── Nhấn filter "Còn hạn" → chỉ hiện voucher chưa hết
├── Nhấn filter "Hết hạn" → chỉ hiện voucher đã hết
└── Voucher hết hạn → hiển thị màu xám

✅ Tiêu chí đạt:
├── Danh sách hiển thị đúng
├── Filter hoạt động
└── Trạng thái hết hạn hiển thị đúng

⏱️ Ước tính: 15 phút
⭐ Độ khó: Dễ
```

### Bước 8.3 — Booking Reminders Screen
```
📝 Mô tả:
├── Tạo app/booking-reminders.tsx
├── Danh sách nhắc nhở đặt chỗ
├── Filter: [Tất cả] [Sắp tới] [Đã xong] [Đã hủy]
├── Mỗi item: loại dịch vụ, địa điểm, ngày, trạng thái
└── Stats: số lượng theo trạng thái

📁 File: app/booking-reminders.tsx

🧪 cách test:
├── Đặt vài booking
├── Mở Booking Reminders → thấy danh sách
├── Filter hoạt động
└── Stats hiển thị đúng

✅ Tiêu chí đạt:
├── Danh sách hiển thị đúng
├── Filter hoạt động
└── Stats đúng

⏱️ Ước tính: 15 phút
⭐ Độ khó: Dễ
```

### Bước 8.4 — Leaderboard Screen
```
📝 Mô tả:
├── Tạo app/leaderboard.tsx
├── Top 50 users theo check-in tháng
├── #1: 🥇 vàng, #2: 🥈 bạc, #3: 🥉 đồng
├── Mỗi dòng: avatar + tên + số check-in
├── Highlight dòng của user hiện tại
└── Pull to refresh

📁 File: app/leaderboard.tsx

🧪 cách test:
├── Mở Leaderboard → thấy bảng xếp hạng
├── User hiện tại được highlight
├── Vuốt xuống → refresh
└── Top 3 có huy chương

✅ Tiêu chí đạt:
├── Bảng xếp hạng hiển thị đúng
├── Highlight user hiện tại
└── Refresh hoạt động

⏱️ Ước tính: 15 phút
⭐ Độ khó: Dễ
```

### Bước 8.5 — SOS Screen
```
📝 Mô tả:
├── Tạo app/sos/index.tsx
├── Nút SOS lớn (pulsing red, nhấn giữ 3 giây)
├── Khi active: GPS ping mỗi 20 giây
├── Hiển thị: vị trí GPS, thời gian ping cuối
├── Nút "⏹️ Dừng SOS"
└── Gọi API sos: create → ping → stop

📁 File: app/sos/index.tsx

🧪 cách test:
├── Nhấn giữ nút SOS 3 giây → kích hoạt
├── Thấy GPS + thời gian ping
├── Đợi 20 giây → ping mới
├── Nhấn "Dừng" → dừng
└── Kiểm tra trong database: sos_alerts có record

✅ Tiêu chí đạt:
├── SOS kích hoạt được
├── GPS ping hoạt động
├── Dừng hoạt động
└── Database có record

⏱️ Ước tính: 25 phút
⭐ Độ khó: Trung bình
```

### Bước 8.6 — Booking Cancellation
```
📝 Mô tả:
├── Thêm nút "Hủy đặt chỗ" trong Tickets
├── Confirm dialog: "Bạn có chắc?"
├── Gọi API: POST /api/bookings/{id}/cancel
├── Cập nhật trạng thái UI
└── Thông báo: "Đã hủy đặt chỗ"

📁 File: app/(tabs)/tickets.tsx (sửa)

🧪 cách test:
├── Đặt booking → mở Tickets
├── Nhấn "Hủy" → xác nhận
├── Trạng thái → cancelled
├── QR mờ
└── Không thể hủy lần nữa

✅ Tiêu chí đạt:
├── Hủy hoạt động
├── Trạng thái cập nhật
└── UI cập nhật đúng

⏱️ Ước tính: 15 phút
⭐ Độ khó: Dễ
```

---

## GIAI ĐOẠN 9: SHARED COMPONENTS (2 bước)

### Bước 9.1 — Core Components (5 cái)
```
📝 Mô tả:
├── Button.tsx: variants (primary, secondary, outline, danger), loading, disabled
├── Card.tsx: bo góc + shadow + children
├── Input.tsx: label, error, icon, secureTextEntry
├── Header.tsx: back button + title + right action
├── Avatar.tsx: ảnh tròn + fallback initials
└── Tất cả dùng theme colors

📁 File: components/Button.tsx, Card.tsx, Input.tsx, Header.tsx, Avatar.tsx

🧪 cách test:
├── Import mỗi component vào App.tsx test
├── Button: nhấn → onPress hoạt động, loading → spinner
├── Card: hiển thị children, bo góc + shadow
├── Input: nhập text, hiện error message
├── Header: back button hoạt động
└── Avatar: hiển thị ảnh hoặc initials

✅ Tiêu chí đạt:
├── Mỗi component render đúng
├── Props hoạt động
├── Theme colors áp dụng
└── Không lỗi TypeScript

⏱️ Ước tính: 30 phút
⭐ Độ khó: Dễ
```

### Bước 9.2 — Utility Components (5 cái)
```
📝 Mô tả:
├── Badge.tsx: dot + text + color
├── EmptyState.tsx: icon + title + description
├── LoadingOverlay.tsx: spinner toàn màn hình
├── RatingStars.tsx: hiển thị / nhập star rating
├── SegmentedControl.tsx: tab switcher ngang
└── Tất cả dùng theme colors

📁 File: components/Badge.tsx, EmptyState.tsx, LoadingOverlay.tsx, RatingStars.tsx, SegmentedControl.tsx

🧪 cách test:
├── Import mỗi component test
├── Badge: hiện dot + text đúng màu
├── EmptyState: hiện icon + title + description
├── LoadingOverlay: spinner overlay
├── RatingStars: nhấn chọn sao → onRate callback
└── SegmentedControl: nhấn tab → onChange callback

✅ Tiêu chí đạt:
├── Mỗi component render đúng
├── Props hoạt động
├── Theme colors áp dụng
└── Không lỗi TypeScript

⏱️ Ước tính: 25 phút
⭐ Độ khó: Dễ
```

---

## TỔNG KẾT

| Giai đoạn | Số bước | Thời gian ước tính | Độ khó TB |
|-----------|---------|-------------------|-----------|
| 1. Foundation | 5 | 1h50p | ⭐ Dễ |
| 2. Auth Flow | 4 | 1h50p | ⭐⭐ TB |
| 3. Tab Screens | 3 | 1h40p | ⭐⭐ TB |
| 4. Map & Check-in | 5 | 2h45p | ⭐⭐⭐ Khó |
| 5. Location Detail | 4 | 1h45p | ⭐⭐ TB |
| 6. Booking System | 5 | 2h50p | ⭐⭐⭐⭐ RK |
| 7. Tickets & Passes | 2 | 50p | ⭐⭐ TB |
| 8. Secondary Screens | 6 | 1h45p | ⭐⭐ TB |
| 9. Shared Components | 2 | 55p | ⭐ Dễ |
| **TỔNG** | **36 bước** | **~16h30p** | |

### Quy trình mỗi bước

```
Mình code → Bạn test trên Expo Go
├── ✅ OK → Mình xác nhận → Qua bước tiếp
└── ❌ Có bug → Bạn báo → Mình sửa → Test lại
```

---

*Cập nhật: 2026-06-05*
