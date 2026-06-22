# Yêu Cầu Kỹ Thuật & Cấu Hình Mobile App (Phase 4)

Tài liệu này quy định các tiêu chuẩn kỹ thuật, thư viện, cấu hình môi trường và quy trình làm việc để xây dựng ứng dụng Mobile (Travel Check-in App).

## 1. Môi trường & Nền tảng
- **Framework**: React Native
- **Môi trường build**: **Bắt buộc Expo SDK 54**. Không hạ xuống SDK cũ hơn nếu chưa có quyết định đổi nền tảng cho toàn bộ nhánh mobile.
- **Quy trình Build (Build Pipeline)**: Ứng dụng được thiết kế song song cho cả **Expo Go** (để test nhanh bằng quét QR) và **EAS Build / native build** (để xuất file APK/AAB về sau). Dù giai đoạn phát triển hằng ngày chạy bằng Expo Go, ưu tiên kỹ thuật cao nhất vẫn là **khả năng build app thật ổn định sau khi hoàn thành**. Tất cả thư viện native (Camera, Location) phải được cấu hình chuẩn qua Expo Plugins trong `app.json` để tối ưu hóa khi build APK, đảm bảo app chạy mượt và ổn định nhất khi đưa vào thực tế.
- **Ngôn ngữ**: TypeScript
- **Routing**: Expo Router (File-based routing)

## 2. Quy trình làm việc (Workflow)
- **Tạo cấu trúc dự án**: Tất cả thư mục và file cấu trúc dự án `mobile` phải được khởi tạo hoàn toàn bằng các dòng lệnh (CLI) để giữ bộ khung Expo chuẩn nhất.
- **Node / package / plugin setup**: Toàn bộ phần cài đặt Node packages, Expo packages, Metro, NativeWind, Router, plugin và tooling cũng phải ưu tiên dùng lệnh CLI chính thức (`npx create-expo-app`, `npx expo install`, `npm install`, `npx expo prebuild` khi cần) thay vì dựng tay rời rạc.
- **Phân kỳ giai đoạn**: "Làm tới đâu, lên kế hoạch tới đó". Sẽ không lập kế hoạch dư thừa. Mỗi trang sẽ được phân tích kỹ, vẽ UI bằng ký tự `---` (hoặc ảnh) và chốt luồng hoạt động rồi mới đưa vào file `.md`.
- **Tái sử dụng Backend**: Đảm bảo gọi API và sử dụng chung Database chính xác 100% như cách Website đang hoạt động.

### 2.1. Nguyên tắc dựng khung chuẩn

- Dự án mobile mới phải bắt đầu từ bộ khung Expo SDK 54 sinh bằng CLI, không copy lại bộ khung cũ đã xóa.
- Các dependency phải ưu tiên bản tương thích chính thức với SDK 54 thông qua `npx expo install`.
- Chỉ dùng package ngoài `expo install` khi thật sự cần và đã kiểm tra tương thích với Expo Go lẫn build app thật.
- Mọi quyết định cấu trúc từ đầu phải phục vụ hai mục tiêu cùng lúc:
  - chạy được ngay bằng Expo Go qua QR để phát triển nhanh,
  - không tự tạo nợ kỹ thuật khiến EAS Build / APK-AAB bị vỡ về sau.

## 3. Cấu hình Môi trường (.env)
Bắt buộc sử dụng các biến môi trường sau cho Mobile App. Lưu ý dùng URL của ngrok để quá trình Đăng nhập Google qua `expo-auth-session` diễn ra chính xác.

```env
# API Configuration
EXPO_PUBLIC_API_URL=https://diligent-suffice-paradox.ngrok-free.dev/api

# Google OAuth (cùng Client ID với website)
EXPO_PUBLIC_GOOGLE_CLIENT_ID=649280086350-dcnmaq0dg1isfnt7hmtso9paq6r8jgqr.apps.googleusercontent.com

# Facebook App ID (giữ trong env để đồng bộ cấu hình hệ thống nếu cần)
EXPO_PUBLIC_FACEBOOK_APP_ID=4153740721542373
```

Ghi chú bắt buộc:
- Bộ `.env` trên là cấu hình chuẩn hiện tại cho nhánh mobile.
- `EXPO_PUBLIC_API_URL=https://diligent-suffice-paradox.ngrok-free.dev/api` phải được giữ đúng khi kiểm thử Google login trên app, vì backend mobile OAuth đang trả callback theo flow ngrok này.
- Dù mobile hiện không triển khai Facebook login, vẫn có thể giữ `EXPO_PUBLIC_FACEBOOK_APP_ID` trong env để đồng bộ cấu hình với hệ thống hiện tại.

## 4. Thư viện cốt lõi (Core Dependencies)
- **Styling**: `nativewind` v4 (Tailwind CSS cho React Native).
- **Phông chữ (Font)**: **Bắt buộc sử dụng phông chữ mặc định của hệ thống** (San Francisco trên iOS, Roboto trên Android) để tối ưu hiệu năng. Định nghĩa font-family mặc định trong `tailwind.config.js` (`sans`) chỉ tới phông hệ thống nhằm tránh lỗi hiển thị các ký tự tiếng Việt có dấu.
- **Xử lý tai thỏ (Notch/SafeArea)**: Cấu hình `SafeAreaProvider` tại root layout (`mobile/app/_layout.tsx`). Sử dụng hook `useSafeAreaInsets` để tính toán padding động cho từng màn hình thay vì dùng thẻ `<SafeAreaView>` bọc cứng, giúp duy trì trải nghiệm tràn viền (cho ảnh cover lớn của màn hình chi tiết địa điểm) mà không bị che khuất bởi tai thỏ hay thanh điều hướng ảo.
- **State Management**: `zustand`.
- **Lưu trữ cục bộ**: `@react-native-async-storage/async-storage`.
- **HTTP Client**: `axios` (kèm interceptor cho tự động Refresh Token).

## 5. Thư viện tính năng (Feature Dependencies)
- **Xác thực (OAuth)**: `expo-auth-session`, `expo-crypto`, `expo-web-browser` cho luồng Google mobile redirect hoặc social-login thống nhất với backend.
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

## 8. Mục tiêu tổng thể của nhánh Mobile User

Mục tiêu chính thức của nhánh Mobile là:
- **Đưa toàn bộ chức năng phân quyền `user` của Website sang Mobile**.
- **Tái sử dụng tối đa Backend API hiện tại** thay vì tạo luồng dữ liệu riêng.
- **Không cho Mobile kết nối trực tiếp Database**, mọi dữ liệu đều đi qua Backend.
- **Giữ đồng nhất nghiệp vụ với Website**: trạng thái booking, xác nhận chuyển khoản, ví vé, nhắc lịch, lịch trình, SOS, AI chat, v.v.

## 8.1. Quy tắc bắt buộc toàn dự án Mobile

Các quy tắc dưới đây áp dụng tuyệt đối cho **toàn bộ** màn hình của dự án:

- **Không dùng icon**:
  - Không dùng icon library, icon emoji, icon minh họa hoặc icon-only button cho toàn bộ dự án mobile.
  - Toàn bộ hành động phải thể hiện bằng chữ, bố cục, màu, viền, trạng thái hoặc thành phần giao diện rõ nghĩa thay vì biểu tượng.
  - Nếu cần nhấn mạnh hành động quan trọng như quay lại, đóng, gửi, lưu, lọc, điều hướng, phải dùng text button hoặc control chuẩn không phụ thuộc icon.

- **Tai thỏ / SafeArea**:
  - Bắt buộc có `SafeAreaProvider` ở root app.
  - Mọi màn hình phải xử lý `insets.top` và `insets.bottom` bằng `useSafeAreaInsets()`.
  - Không để header, nút back, tab bar, CTA đáy, composer chat, bottom sheet hoặc QR/payment action bị che bởi notch hay thanh home indicator.
  - Không hardcode `paddingTop` / `paddingBottom` cố định rồi bỏ qua SafeArea thật của thiết bị.

- **Nút điều hướng / Navigation**:
  - Mọi màn hình detail, form, chat, booking, profile con đều phải có nút quay lại rõ ràng và vùng bấm đủ lớn.
  - Luồng thành công như login thành công, reset password xong, tạo booking xong, thanh toán xong, lưu itinerary xong phải dùng `router.replace()` hoặc `router.dismissAll()` khi cần, không để back quay ngược vào màn hình gửi form / thanh toán.
  - Với các màn hình có CTA dính đáy, phần nút phải luôn nằm trên `insets.bottom` và không va chạm với gesture bar.
  - Toàn bộ route phải được thiết kế theo hướng production-ready, không để nút điều hướng đi vào màn hình chết.

Phạm vi Website User hiện tại cần được phủ đủ trên Mobile:
- `UserDashboard`
- `UserMap`
- `LocationDetail`
- `BookingPage`
- `TicketCart`
- `TableBookingPass`
- `RoomBookingPass`
- `MyTickets`
- `Profile`
- `SavedLocations`
- `Checkins` (bao gồm nhật ký hành trình / diary)
- `History`
- `BookingReminders`
- `Vouchers`
- `Sos`
- `AiChat`
- `LocationChatBubble` / chat với địa điểm
- `Itineraries`
- `ItineraryEditor`

## 9. Bản đồ chức năng Website User -> Mobile Phase

| Nhóm chức năng | Nguồn trên Website | Phase Mobile |
|---|---|---|
| Đăng nhập / đăng ký / quên mật khẩu / Google login | `pages/Auth/*` | Giai đoạn 1 |
| Trang chủ / thống kê nhanh / danh sách đề xuất | `pages/User/UserDashboard.tsx` | Giai đoạn 2 |
| Bản đồ OSM / marker / route / detail địa điểm / review / chat entry | `pages/User/UserMap.tsx`, `LocationDetail.tsx` | Giai đoạn 3 |
| Đặt vé / đặt bàn / đặt phòng / VietQR / ví vé / pass / cart | `BookingPage.tsx`, `TicketCart.tsx`, `MyTickets.tsx`, `TableBookingPass.tsx`, `RoomBookingPass.tsx` | Giai đoạn 4 |
| Hồ sơ / địa điểm đã lưu / check-in / nhật ký hành trình / lịch sử / voucher / nhắc lịch / thông báo / SOS | `Profile.tsx`, `SavedLocations.tsx`, `Checkins.tsx`, `History.tsx`, `Vouchers.tsx`, `BookingReminders.tsx`, `Sos.tsx` | Giai đoạn 5 |
| AI chat / chat với địa điểm / itineraries / itinerary editor | `AiChat.tsx`, `LocationChatBubble.tsx`, `Itineraries.tsx`, `ItineraryEditor.tsx` | Giai đoạn 6 |

## 10. Danh sách file kế hoạch giai đoạn

- `giai-doan-1-auth.md`
- `giai-doan-2-home.md`
- `Ke_hoach_giai_doan_3.md`
- `giai-doan-4-booking-thanh-toan-va-vi-dien-tu.md`
- `giai-doan-5-tien-ich-user-ho-so-va-an-toan.md`
- `giai-doan-6-ai-chat-va-lich-trinh.md`

## 10.1. Trạng thái hiện tại của nhánh Mobile

- Folder `mobile/` cũ đã được xóa để làm lại từ đầu.
- Từ thời điểm này, toàn bộ các file kế hoạch giai đoạn trong thư mục này là **đặc tả chuẩn để rebuild mobile mới**, không còn là mô tả tiến độ của code cũ.
- Mục tiêu của lần làm lại này là:
  - phủ đủ toàn bộ chức năng `user` từ website,
  - tái dùng backend hiện tại,
  - bám `TravelCheckinApp.sql` làm chuẩn schema đối chiếu,
  - xử lý SafeArea / tai thỏ / nút điều hướng đúng chuẩn trên toàn bộ app ngay từ nền móng.

Nguyên tắc đọc và triển khai:
- Giai đoạn 1 và 2 là nền móng.
- Giai đoạn 3 xử lý cụm `Khám phá + Chi tiết địa điểm`.
- Giai đoạn 4 xử lý cụm `Đặt chỗ + Thanh toán + Wallet`.
- Giai đoạn 5 xử lý cụm `Utility của user`.
- Giai đoạn 6 xử lý cụm `AI + Itinerary`.

## 11. Ghi chú Backend và Database Local

- Backend vẫn là nguồn sự thật duy nhất cho Mobile.
- Database local hiện tại của môi trường phát triển nằm tại:
  `D:\app\My SQL Sever\bin`
- Đã kiểm tra trực tiếp thư mục cài đặt MySQL ở đường dẫn trên; trong thư mục đó không có `my.ini`, nên đối chiếu cấu trúc bảng trong kế hoạch này được chốt theo `TravelCheckinApp.sql` + route/controller/service đang chạy trong repo.
- File schema tham chiếu của dự án là `TravelCheckinApp.sql`.
- Mobile **không được** truy cập MySQL trực tiếp; chỉ dùng lại API từ `backend/src/routes/*` và logic nghiệp vụ hiện có trong `backend/src/controllers/*`, `backend/src/services/*`.
