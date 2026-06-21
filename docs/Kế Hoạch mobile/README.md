# Yêu Cầu Kỹ Thuật & Cấu Hình Mobile App (Phase 4)

Tài liệu này quy định các tiêu chuẩn kỹ thuật, thư viện, cấu hình môi trường và quy trình làm việc để xây dựng ứng dụng Mobile (Travel Check-in App).

## 1. Môi trường & Nền tảng
- **Framework**: React Native
- **Môi trường build**: Expo SDK 54 (Hỗ trợ tốt nhất cho đa thiết bị).
- **Quy trình Build (Build Pipeline)**: Ứng dụng được thiết kế song song cho cả **Expo Go** (để test nhanh) và **EAS Build (để xuất file APK/AAB)**. Tất cả thư viện native (Camera, Location) phải được cấu hình chuẩn qua Expo Plugins trong `app.json` để tối ưu hóa khi build APK, đảm bảo app chạy mượt và ổn định nhất khi đưa vào thực tế.
- **Ngôn ngữ**: TypeScript
- **Routing**: Expo Router (File-based routing)

## 2. Quy trình làm việc (Workflow)
- **Tạo cấu trúc dự án**: Tất cả thư mục và file cấu trúc dự án `mobile` sẽ được khởi tạo hoàn toàn bằng các dòng lệnh (CLI).
- **Phân kỳ giai đoạn**: "Làm tới đâu, lên kế hoạch tới đó". Sẽ không lập kế hoạch dư thừa. Mỗi trang sẽ được phân tích kỹ, vẽ UI bằng ký tự `---` (hoặc ảnh) và chốt luồng hoạt động rồi mới đưa vào file `.md`.
- **Tái sử dụng Backend**: Đảm bảo gọi API và sử dụng chung Database chính xác 100% như cách Website đang hoạt động.

## 3. Cấu hình Môi trường (.env)
Bắt buộc sử dụng các biến môi trường sau cho Mobile App. Lưu ý dùng URL của ngrok để quá trình Đăng nhập Google qua `expo-auth-session` diễn ra chính xác.

```env
# API Configuration
EXPO_PUBLIC_API_URL=https://diligent-suffice-paradox.ngrok-free.dev/api

# Google OAuth (cùng Client ID với website)
EXPO_PUBLIC_GOOGLE_CLIENT_ID=649280086350-dcnmaq0dg1isfnt7hmtso9paq6r8jgqr.apps.googleusercontent.com

# Facebook App ID (cùng App ID với website - Dù không dùng vẫn giữ cấu hình)
EXPO_PUBLIC_FACEBOOK_APP_ID=4153740721542373
```

## 4. Thư viện cốt lõi (Core Dependencies)
- **Styling**: `nativewind` v4 (Tailwind CSS cho React Native).
- **Phông chữ (Font)**: **Bắt buộc sử dụng phông chữ mặc định của hệ thống** (San Francisco trên iOS, Roboto trên Android) để tối ưu hiệu năng. Định nghĩa font-family mặc định trong `tailwind.config.js` (`sans`) chỉ tới phông hệ thống nhằm tránh lỗi hiển thị các ký tự tiếng Việt có dấu.
- **Xử lý tai thỏ (Notch/SafeArea)**: Cấu hình `SafeAreaProvider` tại root layout (`mobile/app/_layout.tsx`). Sử dụng hook `useSafeAreaInsets` để tính toán padding động cho từng màn hình thay vì dùng thẻ `<SafeAreaView>` bọc cứng, giúp duy trì trải nghiệm tràn viền (cho ảnh cover lớn của màn hình chi tiết địa điểm) mà không bị che khuất bởi tai thỏ hay thanh điều hướng ảo.
- **State Management**: `zustand`.
- **Lưu trữ cục bộ**: `@react-native-async-storage/async-storage`.
- **HTTP Client**: `axios` (kèm interceptor cho tự động Refresh Token).

## 5. Thư viện tính năng (Feature Dependencies)
- **Xác thực (OAuth)**: `expo-auth-session`, `expo-crypto`, `expo-web-browser`.
- **Bản đồ & Chỉ đường (OSM + Routing)**: 
  - Sử dụng `react-native-maps` kết hợp với `<UrlTile />` để tải bản đồ OpenStreetMap.
  - **Lưu ý hiệu năng**: Thiết lập thuộc tính `mapType="none"` trên `<MapView>` để vô hiệu hóa bản đồ nền mặc định của thiết bị (Google/Apple Maps), chỉ tải duy nhất OSM Tiles nhằm tiết kiệm RAM, pin và tránh giật lag.
  - Tích hợp gọi API của **OSRM (Open Source Routing Machine)** để vẽ mượt mà lên bản đồ thông qua `<Polyline>`.
  - Đảm bảo 100% khả thi và không cần cài thêm Google Maps API Key phức tạp.
- **Nút điều hướng & Bảo mật luồng giao dịch**:
  - Expo Router (File-based routing).
  - Khi đặt phòng/bàn/vé thành công và chuyển sang màn hình thành công (Success Screen), bắt buộc sử dụng `router.replace()` hoặc xóa bỏ Stack lịch sử điều hướng (`router.dismissAll()`). Điều này ngăn việc người dùng nhấn phím Back vật lý trên Android hoặc vuốt Back trên iOS quay ngược lại trang thanh toán/nhập thông tin, tránh tình trạng trùng lặp yêu cầu đặt dịch vụ.
- **Định vị & Smart Check-in**:
  - `expo-location`: Sử dụng để lấy vị trí GPS. **Bắt buộc** cấu hình tham số độ chính xác cao nhất (`Accuracy.Highest` hoặc `Accuracy.BestForNavigation`) để phục vụ việc chỉ đường mượt mà và Smart Check-in (bán kính < 100m) được chính xác tuyệt đối.
- **Tính năng Đặt Trước (Booking) Thời Gian Thực (Real-time)**:
  - **Bắt buộc** đồng bộ dữ liệu liên tục như Website bằng cách kết hợp `socket.io-client` và `Server-Sent Events (SSE)`. Khi người dùng đặt phòng/bàn/vé hoặc khi Admin xác nhận, ứng dụng Mobile phải lập tức cập nhật trạng thái ngay thời gian thực (Real-time) mà không cần load lại trang.
- **Camera & Hình ảnh**: `expo-camera`, `expo-image-picker`.
- **Mã QR**: `react-native-qrcode-svg`.

## 6. Cấu hình Quyền (Permissions) cho EAS Build APK
Để tối ưu hóa việc xuất file APK/AAB mà không bị crash, ứng dụng bắt buộc phải khai báo đầy đủ các quyền native trong file `app.json` (thông qua Expo Plugins):
- **Location**: Khai báo `ACCESS_FINE_LOCATION` (Định vị chính xác cao) và `ACCESS_COARSE_LOCATION` cho Android; `NSLocationWhenInUseUsageDescription` cho iOS.
- **Camera**: Khai báo quyền sử dụng máy ảnh cho tính năng Check-in.
- **Media Library**: Khai báo quyền truy cập thư viện ảnh để cho phép luồng check-in "chọn ảnh từ thư viện" đã chốt.

## 7. Cấu trúc thư mục dự kiến (Đồng bộ với Website)
Cấu trúc được thiết kế tối ưu, tách biệt API, State và UI, giúp tái sử dụng lại tư duy code từ Website sang Mobile một cách chuẩn xác nhất:

```text
mobile/
├── app/                  # File-based routing (Các màn hình giống thư mục `pages` trên Web)
│   ├── (tabs)/           # 5 Bottom Tabs chính
│   ├── auth/             # Luồng xác thực
│   └── _layout.tsx       # Root layout
├── api/                  # Nơi định nghĩa các modules gọi axios (Đồng bộ với src/api của Web)
├── components/           # UI Components tái sử dụng (Đồng bộ với src/components của Web)
├── store/                # Zustand stores quản lý State toàn cục
├── hooks/                # Custom React hooks
├── types/                # TypeScript Interfaces (Dùng chung model từ Web)
├── utils/                # Hàm tiện ích (định dạng tiền tệ, ngày tháng...)
├── constants/            # Hằng số (Colors, Themes, Config)
└── assets/               # Hình ảnh, fonts, icon
```
