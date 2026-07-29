# 📱 Mobile App — Người Bạn Đồng Hành Của Du Khách

> *"Bỏ túi là có map, có vé, có AI, có SOS — đi đâu cũng không sợ lạc."*

Ứng dụng di động dành cho **Du Khách (Tourist)** — trái tim trải nghiệm của hệ thống TravelCheckinApp. Được xây dựng bằng Expo (React Native), chạy trên cả iOS và Android.

---

## 📋 Mục Lục

- [Tổng Quan](#tổng-quan)
- [Cấu Trúc Thư Mục](#cấu-trúc-thư-mục)
- [Màn Hình & Tính Năng](#màn-hình--tính-năng)
- [Luồng Điều Hướng](#luồng-điều-hướng)
- [Công Nghệ & Thư Viện](#công-nghệ--thư-viện)
- [Cài Đặt & Chạy](#cài-đặt--chạy)
- [Biến Môi Trường](#biến-môi-trường)

---

## Tổng Quan

| Thông tin | Chi tiết |
|-----------|----------|
| **Framework** | Expo SDK ~54 + React Native 0.81.5 |
| **Ngôn ngữ** | TypeScript |
| **Navigation** | Expo Router (file-based routing) |
| **State** | Zustand |
| **UI Styling** | NativeWind (TailwindCSS cho React Native) |
| **Bản đồ** | React Native Maps |
| **Real-time** | Socket.IO Client |
| **AI Chat** | Google Gemini (qua Backend) |
| **Forms** | React Hook Form + Zod validation |
| **Cổng dev** | `8081` (Expo Go) |

---

## Cấu Trúc Thư Mục

```
mobile/
├── app/                           # File-based routing (Expo Router)
│   ├── _layout.tsx                # Root layout — font, theme, auth guard
│   ├── index.tsx                  # Entry redirect
│   ├── (auth)/                    # Nhóm màn hình chưa đăng nhập
│   │   └── auth/                  # Đăng nhập, đăng ký, quên mật khẩu
│   ├── (app)/                     # Nhóm màn hình đã đăng nhập
│   │   ├── _layout.tsx            # Layout chính (header, tab bar)
│   │   ├── (tabs)/                # Bottom Tab Navigation
│   │   │   ├── home.tsx           # 🏠 Trang chủ — gợi ý địa điểm, thời tiết
│   │   │   ├── explore.tsx        # 🗺️ Bản đồ khám phá
│   │   │   ├── saved.tsx          # ❤️ Địa điểm đã lưu
│   │   │   ├── support.tsx        # 🆘 Hỗ trợ & SOS
│   │   │   └── profile.tsx        # 👤 Hồ sơ cá nhân
│   │   ├── location/              # Chi tiết địa điểm
│   │   ├── booking/               # Đặt dịch vụ (hotel/restaurant/ticket)
│   │   ├── wallet/                # Ví vé QR
│   │   ├── ai/                    # AI Chat (Gemini)
│   │   ├── profile/               # Chỉnh sửa hồ sơ, đổi mật khẩu
│   │   └── itineraries.tsx        # Hành trình du lịch
│   └── itinerary/                 # Trình soạn hành trình
├── src/
│   ├── components/                # UI components tái sử dụng
│   ├── contexts/                  # React Context (auth, location permission...)
│   ├── hooks/                     # Custom hooks
│   ├── lib/                       # Thư viện tiện ích
│   ├── modules/                   # Module độc lập
│   │   ├── auth/                  # Logic xác thực
│   │   ├── image/                 # Upload, crop, zoom ảnh (Zalo-style)
│   │   ├── location-permission/   # Xin quyền GPS
│   │   ├── locations/             # Danh sách & filter địa điểm
│   │   ├── map/                   # Map component, marker, routing
│   │   └── ui/                    # Design system components
│   ├── services/                  # Gọi API Backend
│   ├── store/                     # Zustand store (global state)
│   ├── theme/                     # Màu sắc, typography, spacing
│   ├── types/                     # TypeScript type definitions
│   └── utils/                     # Hàm tiện ích
├── assets/                        # Ảnh, icon, font
├── app.json                       # Cấu hình Expo app
├── tailwind.config.js             # NativeWind config
├── babel.config.js
└── package.json
```

---

## Màn Hình & Tính Năng

### 🔐 Màn Hình Xác Thực
| Màn hình | Tính năng |
|----------|-----------|
| Đăng nhập | Email/password + OAuth Google/Facebook |
| Đăng ký | Form đăng ký với validation Zod |
| Quên mật khẩu | Gửi OTP qua email |

### 🏠 Tab Trang Chủ (`home.tsx`)
- Gợi ý địa điểm theo vị trí hiện tại
- Widget thời tiết thời gian thực
- Hiển thị địa điểm gần đây đã khám phá
- Voucher hệ thống đang có

### 🗺️ Tab Khám Phá (`explore.tsx`)
- Bản đồ tương tác với React Native Maps
- Xem địa điểm dạng danh sách hoặc bản đồ
- Tìm kiếm và lọc theo loại hình (nhà hàng, khách sạn, du lịch)
- Xem chi tiết địa điểm + thời tiết tại chỗ
- Điều hướng đường đi (routing)

### 📍 Chi Tiết Địa Điểm
- Thông tin đầy đủ, ảnh, giờ hoạt động
- Đánh giá + bình luận (Google Maps-style)
- Link trực tiếp đến trang đặt dịch vụ
- Lưu vào danh sách yêu thích

### 🎟️ Đặt Dịch Vụ
Có **3 giao diện đặt dịch vụ hoàn toàn độc lập**:
- 🍽️ **Nhà hàng** — chọn bàn, số người, thời gian
- 🏨 **Khách sạn** — chọn phòng, ngày nhận/trả
- 🎡 **Vé du lịch** — chọn loại vé, số lượng, ngày đi

**Hình thức thanh toán:** Thanh toán sau / Chuyển khoản ngân hàng

### 👛 Ví Vé (`wallet/`)
- Lưu trữ tất cả hóa đơn và mã vé
- QR Code động được sinh tự động
- Nhân viên quét QR hoặc nhập mã để xác nhận
- Sticker mô tả thay thế ảnh (cho nhà hàng/khách sạn)

### ❤️ Địa Điểm Đã Lưu (`saved.tsx`)
- Danh sách địa điểm bookmark
- Tổ chức và xem lại dễ dàng

### 🤖 AI Chat (`ai/`)
- Chat trực tiếp với Google Gemini
- Hỏi về địa điểm, lịch trình, gợi ý du lịch
- Ngữ cảnh được cá nhân hóa theo lịch sử

### 🗓️ Hành Trình (`itineraries.tsx`)
- Tạo lịch trình du lịch cá nhân
- Chọn địa điểm và thời gian theo ngày
- Xem tổng quan hành trình trên bản đồ

### 👤 Hồ Sơ (`profile/`)
- Thông tin cá nhân
- **Avatar crop & zoom kiểu Zalo** — tự custom, mất 1 tuần code!
- Đổi mật khẩu, đăng xuất
- Điểm leaderboard & thành tích

### 🆘 SOS & Hỗ Trợ (`support.tsx`)
- Nút SOS khẩn cấp — gửi ngay vị trí GPS đến Admin
- Thông báo thời gian thực qua Socket.IO

---

## Luồng Điều Hướng

```
app/
├── index.tsx → redirect dựa vào auth state
│
├── (auth)/           ← Chưa đăng nhập
│   └── auth/         ← Đăng nhập / Đăng ký / Quên mật khẩu
│
└── (app)/            ← Đã đăng nhập
    ├── (tabs)/       ← Bottom Tab Bar
    │   ├── home
    │   ├── explore
    │   ├── saved
    │   ├── support
    │   └── profile
    │
    ├── location/[id] ← Chi tiết địa điểm (stack)
    ├── booking/      ← Đặt dịch vụ (stack)
    ├── wallet/       ← Ví vé (stack)
    ├── ai/           ← AI Chat (stack)
    └── itineraries   ← Hành trình (stack)
```

---

## Công Nghệ & Thư Viện

| Thư viện | Mục đích |
|----------|---------|
| `expo-router` | File-based navigation |
| `react-native-maps` | Bản đồ tương tác |
| `expo-location` | GPS & vị trí |
| `expo-image-picker` | Chọn ảnh từ thư viện / camera |
| `expo-image-manipulator` | Crop, resize ảnh |
| `socket.io-client` | Real-time SOS và thông báo |
| `zustand` | Global state management |
| `react-hook-form` + `zod` | Form validation |
| `nativewind` | TailwindCSS cho React Native |
| `expo-secure-store` | Lưu JWT token an toàn |
| `expo-sensors` | Cảm biến (gyroscope cho UX) |
| `@turf/distance` | Tính khoảng cách địa lý |
| `react-native-reanimated` | Smooth animation |
| `react-native-sse` | Server-Sent Events (AI streaming) |

---

## Cài Đặt & Chạy

```bash
cd mobile

# Cài thư viện
npm install

# Chạy trên Expo Go (quét QR bằng điện thoại)
npm start

# Chạy với tunnel (dùng khi backend ở IP khác)
npm run tunnel

# Chạy trên Android emulator
npm run android

# Chạy trên iOS simulator
npm run ios
```

---

## Biến Môi Trường

Tạo file `.env`:

```env
# URL Backend API
EXPO_PUBLIC_API_URL=http://192.168.x.x:3000

# Google Maps API Key
EXPO_PUBLIC_GOOGLE_MAPS_KEY=...

# Google OAuth Client ID
EXPO_PUBLIC_GOOGLE_CLIENT_ID=...
```

---

> [!NOTE]
> App dùng **file-based routing** của Expo Router — mỗi file `.tsx` trong thư mục `app/` tự động trở thành một route. Không cần config thủ công.

> [!TIP]
> Khi test trên thiết bị thật, dùng `npm run tunnel` để Expo tự tạo URL công khai — không cần cùng mạng WiFi với máy tính.

> [!IMPORTANT]
> Thư viện `expo-secure-store` được dùng để lưu JWT token thay vì `AsyncStorage` thông thường — đảm bảo token không bị đọc trộm trên thiết bị đã root.

---

*Được xây dựng như một phần của luận văn tốt nghiệp — Đại học Tây Đô* 🎓
