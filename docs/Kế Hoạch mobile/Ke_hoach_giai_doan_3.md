# Kế hoạch Triển khai Giai đoạn 3: Bản đồ Tương tác (OSM) & Màn Hình Chi Tiết

Tài liệu này vạch ra toàn bộ lộ trình chi tiết để xây dựng màn hình "Khám phá" (Bản đồ) và thiết kế **Màn hình Chi Tiết Địa Điểm** chuyên sâu khi người dùng nhấp vào một điểm đến cụ thể.

## 📌 Thuật ngữ Kỹ thuật và Khái niệm Phát triển (Mobile App)

Trước khi đi sâu vào chi tiết các màn hình, dưới đây là định nghĩa và vai trò của các thành phần kiến trúc cốt lõi được triển khai trên ứng dụng di động (Mobile App):

1. **UI Shell (Vỏ giao diện)**: 
   - Là phần khung sườn giao diện (bao gồm các nút bấm, các ô nhập, khung chat, cấu trúc trang) chứa dữ liệu mẫu (mock data) để nhìn rõ bố cục trực quan trước khi kết nối các tính năng và dữ liệu thực tế.
2. **API Client**: 
   - Là các file code và module trung gian chịu trách nhiệm kết nối, gửi và nhận dữ liệu trực tiếp từ Backend API (ví dụ: sử dụng Axios để gọi API `/api/bookings`).
3. **Hooks (Logic nghiệp vụ)**: 
   - Là các đoạn code và React Hooks xử lý logic chạy ngầm phía sau giao diện (ví dụ: tính góc la bàn định hướng, tự động tính ngày trả phòng, tự động tính tổng tiền và chặn giới hạn tối đa 50 vé).

---


## 1. Bản vẽ Giao diện Bản đồ theo Luồng Trải nghiệm

### TRẠNG THÁI 1: BẢN ĐỒ MẶC ĐỊNH
```text
+---------------------------------------------------+
|  [Thanh Tìm Kiếm Địa Điểm...]                 [🔍] |
+---------------------------------------------------+
|                        ☁️                         |
|  [📍 User] (Mũi tên xoay)                         |
|                        [🖼️ Cafe Trung Nguyên]     |
|                                            [ ⌖ ]  | 
+---------------------------------------------------+
```

### TRẠNG THÁI 2: KHI BẤM VÀO ĐỊA ĐIỂM CỦA OWNER
```text
+===================================================+
|  -----------------------------------------------  |
|  ☕ Cafe Trung Nguyên                             |
|  ⭐ 4.0 (1 đánh giá)  |  📍 Trần Chiên, Cái Răng  |
|                                                   |
|  [ Nút: 🔀 Chỉ đường ]     [ Nút: ℹ️ Xem chi tiết ] | <- Bấm Xem chi tiết sẽ sang màn hình Chi Tiết
|  [ Nút: ❤️ Yêu thích ]                            |
+---------------------------------------------------+
```

### TRẠNG THÁI 3: KHI BẤM "CHỈ ĐƯỜNG" TRỰC TIẾP TỪ BẢN ĐỒ
```text
+---------------------------------------------------+
|  [ < Trở lại ]                                    |
+---------------------------------------------------+
|  [📍 User]                                        |
|       \==== (Đường vẽ màu Teal bo theo đường đi)  |
|            \====\                                 |
|                  [🎯 Cafe Trung Nguyên]           |
+===================================================+
|  -----------------------------------------------  |
|  🚗 Đi từ vị trí của bạn -> Cafe Trung Nguyên     |
|  Khoảng cách: 1.2 km  |  Thời gian: 4 phút        |
|  [ Nút: ❌ Huỷ chỉ đường ]                        |
+---------------------------------------------------+
```

---

## 2. Cài đặt Thư viện & Công cụ

Đứng tại thư mục `mobile`, chúng ta sẽ chạy các lệnh:

1. **Bản đồ**: `npx expo install react-native-maps`
2. **La bàn**: `npx expo install expo-sensors`
3. **Toán học & Khoảng cách**: `npm install @turf/helpers @turf/distance @turf/bbox`
4. **Range Slider**: Cài đặt slider để làm thanh kéo điểm đánh giá (Ví dụ: `@react-native-community/slider`).
5. **Weather API**: Cài đặt thêm `axios` (nếu chưa có) hoặc dùng fetch API có sẵn để gọi dữ liệu thời tiết (OpenWeatherMap / WeatherAPI).

---

## 3. Cấu trúc Code Giai đoạn 3 (Bổ sung mới)

### `mobile/hooks/useCompass.ts` (MỚI)
- Dùng bộ lọc Low-pass filter lọc dữ liệu `Magnetometer` để trả về góc quay cho mũi tên người dùng trên bản đồ.

### `mobile/api/osrmApi.ts` (MỚI)
- Cung cấp tính năng tìm đường đi (routing) giữa Toạ độ A và Toạ độ B qua OSRM public API. Trả về mảng toạ độ để dùng cho thẻ `<Polyline>`.

### `mobile/app/(tabs)/explore.tsx` (SỬA ĐỔI)
- Thêm `<MapView>` với base tile của OpenStreetMap.
- Chèn Component BottomSheet hiện thông tin tóm tắt.

---

## 4. Rủi ro & Cấp độ khó

- **Cấp độ khó**: 🔥🔥🔥🔥🔥 (5/5) 
- **Các thách thức kỹ thuật lớn nhất**:
  - Tối ưu render Bản đồ và La bàn.
  - Gọi thêm API thứ 3 (API Thời tiết) dựa trên Toạ độ của Quán và render Icon thời tiết tương ứng.

---

### 4.2. Giải pháp kỹ thuật phòng ngừa & khắc phục lỗi Bản đồ / La bàn / Giao diện (CẬP NHẬT)

Nhằm tránh các tình trạng giật lag bản đồ, mũi tên xoay bị đơ/rung, đường chỉ đường vẽ sai lệch, lỗi hiển thị tai thỏ hoặc điều hướng lặp, lập trình viên cần tuân thủ nghiêm ngặt các giải pháp kỹ thuật sau:

#### 1. Khắc phục giật lag Bản đồ khi di chuyển/zoom:
- **Tránh re-render Marker vô điều kiện**: Chia nhỏ Marker địa điểm thành các component con và sử dụng `React.memo` với điều kiện so sánh thuộc tính tùy chỉnh. Chỉ re-render Marker khi toạ độ hoặc thông tin hiển thị của địa điểm đó thay đổi, không re-render khi toạ độ người dùng hoặc góc xoay la bàn thay đổi.
- **Tách state góc xoay khỏi Component cha**: Sử dụng `Animated.Value` để quản lý góc xoay la bàn của User Marker. Góc xoay sẽ được cập nhật trực tiếp vào thuộc tính style của component mũi tên bằng phương thức `useNativeDriver: true` để chạy trực tiếp trên luồng đồ họa (UI thread), tránh làm tắc nghẽn luồng JavaScript (JS thread).
- **Giới hạn khoảng thời gian đọc cảm biến (Throttle)**: Cài đặt tần suất cập nhật dữ liệu của la bàn tối ưu là 10Hz (100ms/lần) thông qua lệnh `Magnetometer.setUpdateInterval(100)`.

#### 2. Khắc phục đơ la bàn hoặc mũi tên định hướng không quay:
- **Áp dụng bộ lọc Low-pass Filter khử nhiễu**: Cảm biến từ trường thường bị nhiễu liên tục do thiết bị kim loại xung quanh. Áp dụng thuật toán lọc mượt để tính góc quay mới:
  `góc_mượt = alpha * góc_mới + (1 - alpha) * góc_cũ` (với `alpha` khuyến nghị là `0.15`).
- **Sử dụng hiệu ứng chuyển động mượt (Animated.spring)**: Xoay mũi tên từ góc cũ sang góc mới bằng animation mượt mà thay vì thay đổi góc đột ngột.
- **Giải phóng cảm biến khi không hoạt động (Memory Leak prevention)**: Luôn unsubscribe sự kiện la bàn (`Magnetometer.removeAllListeners()`) trong cleanup function của `useEffect` hoặc khi chuyển tab (sử dụng hook `useFocusEffect` của Expo Router).

#### 3. Khắc phục vẽ đường chỉ đường (Polyline) bị sai lệch và GPS Drift:
- **Đồng bộ định dạng hệ toạ độ**: API OSRM trả về định dạng GeoJSON `[longitude, latitude]` (Kinh độ trước, Vĩ độ sau), trong khi component `<Polyline>` yêu cầu `{ latitude: number, longitude: number }`. Phải thực hiện chuyển đổi tường minh bằng thư viện `@mapbox/polyline` để decode chính xác.
- **Ngăn chặn gọi trùng và nhảy đường chỉ đi (GPS Drift)**: Chỉ gọi API OSRM tính lại đường đi khi người dùng di chuyển thực tế vượt quá 15 mét (sử dụng `@turf/distance` để đo). Không gọi lại API OSRM liên tục mỗi khi GPS cập nhật sai số nhỏ trong phạm vi vài mét.

#### 4. Tối ưu hóa tải Bản đồ OSM (OpenStreetMap) không bị lag:
- **Thiết lập mapType="none"**: Trên `<MapView>`, bắt buộc cài đặt thuộc tính `mapType="none"` để ngắt tải ngầm bản đồ nền Google Maps (Android) hoặc Apple Maps (iOS). Điều này giúp app chỉ render duy nhất các tile hình ảnh của OpenStreetMap (`<UrlTile urlTemplate="..." />`), giúp tối ưu hóa RAM, giảm tải cho CPU/GPU của thiết bị, tiết kiệm pin tối đa.

#### 5. Xử lý Tai thỏ (Notch) & Thanh điều hướng ảo:
- **Ngăn ngừa vỡ giao diện / lẹm nội dung**: Cài đặt và bọc app trong `SafeAreaProvider` ở root (`_layout.tsx`).
- **Áp dụng Insets động cho giao diện Premium**: Đối với màn hình chi tiết địa điểm có ảnh cover lớn tràn viền, **tuyệt đối không sử dụng** thẻ `<SafeAreaView>` bọc ngoài cứng. Thay vào đó, sử dụng hook `useSafeAreaInsets()` của `react-native-safe-area-context` để lấy các giá trị `top` (chiều cao tai thỏ/dynamic island) và `bottom` (chiều cao thanh điều hướng ảo) tùy theo từng thiết bị đang chạy. Sau đó, áp dụng padding/margin động vào Header Back button hoặc Bottom Action Button để đảm bảo giao diện vừa tràn viền đẹp mắt vừa không bị lẹm hay che mất các nút bấm.

#### 6. Thống nhất Phông chữ (Font Family):
- **Tránh lỗi font tiếng Việt**: Sử dụng phông mặc định của thiết bị (San Francisco trên iOS, Roboto trên Android).
- **Cấu hình Tailwind Config**: Định nghĩa lớp font `sans` mặc định trong tệp `tailwind.config.js` của Mobile trỏ về phông chữ hệ thống. Lập trình viên không được tự ý import hay hardcode font ngoài để giảm thiểu dung lượng file APK build ra và tối đa tính tương thích hệ điều hành.

#### 7. Điều hướng an toàn tránh lặp giao dịch (Back Loops):
- **Phòng ngừa gửi đúp request đặt dịch vụ**: Trong luồng đi Đặt chỗ (Ăn uống, Stays, Vé du lịch), khi chuyển từ màn hình đặt hoặc màn hình thanh toán VietQR sang màn hình báo thành công (Success Screen), bắt buộc sử dụng `router.replace()` hoặc thực hiện lệnh reset Stack (`router.dismissAll()`). Điều này ngăn việc người dùng nhấn phím Back cứng (Android) hoặc vuốt Back (iOS) quay ngược lại các màn hình thanh toán/đặt chỗ trước đó, loại bỏ hoàn toàn rủi ro người dùng vô tình bấm mua/thanh toán lần thứ hai.

## 5. Thiết kế Màn Hình "Xem Chi Tiết Địa Điểm" (Location Detail)

Giao diện sẽ được thiết kế **ĐỒNG NHẤT VỚI WEBSITE** nhưng tối ưu UX cho Mobile (Vuốt chạm, thanh kéo). Màn hình chia làm các khối Tab để dễ quản lý. Phần Voucher và Thời tiết sẽ được "bẻ" xuống xếp dọc ngay bên dưới phần thông tin quán.

**Đường dẫn**: `mobile/app/location/[id].tsx`

### Giao diện Tổng thể (Tab: Tổng quan)

```text
+---------------------------------------------------+
|  < Trở về                     (Header trong suốt) |
|===================================================|
|                [ ẢNH COVER LỚN ]                  |
|          (Kéo xuống ảnh sẽ bị mờ đi)              |
+---------------------------------------------------+
| [Khối màu trắng bo góc lồi lên trên ảnh cover]    |
|                                                   |
|  Cafe Trung Nguyên                                |
|  4.0 ⭐⭐⭐⭐☆   1 đánh giá                       |
|  [ NHÀ HÀNG ] (Tag màu xanh dương nhạt)           |
|                                                   |
|  [Tổng quan] (Active)  [Bài đánh giá]  [Giới thiệu]| <- Thanh Tab Navigation
|                                                   |
|   +-------+   +-------+   +-------+               |
|   |   🔀  |   |   🔖  |   |   🔗  |               |
|   | Chỉ đ...| |  Lưu  |   |Chia sẻ|               |
|   +-------+   +-------+   +-------+               |
|                                                   |
|  Giới thiệu nhanh:                                |
|  Quán cafe lâu đời...                             |
|---------------------------------------------------|
|  📍 TÊN QUÁN: Cafe Trung Nguyên                   |
|  🧭 ĐỊA CHỈ QUÁN: Trần Chiên, Cái Răng..          |
|  🟢 TRẠNG THÁI QUÁN: Đang hoạt động               |
|  🕒 THỜI GIAN MỞ CỬA: Chưa cập nhật               |
|  📞 SỐ ĐIỆN THOẠI: 0869378422                     |
|  ✉️ EMAIL: memory3367@gmail.com                   |
|  🌐 WEBSITE: Chưa cập nhật                        |
|                                                   |
|===================================================|
|  [ THẺ VOUCHER & KHUYẾN MÃI ]               [Mới] |
|  Ưu đãi đang áp dụng cho địa điểm này...          |
|                                                   |
|  Chưa có voucher cho địa điểm này.                |
|  [ Xem voucher của tôi ] (Nút xám)                |
|                                                   |
|===================================================|
|  [ THỜI TIẾT ĐỊA ĐIỂM ]             Theo điểm đến |
|                                                   |
|  HIỆN TẠI                                         |
|  32°C                                     [ ⛈️ ]  |
|  Dông                                             |
|                                            (💬)   | <- Nút Chat Owner (Màu xanh dương, tự do kéo)
|                                            (🤖)   | <- Nút Chat AI (Màu xanh Teal, tự do kéo)
+===================================================+
|               [ Đặt bàn trước ]                   | <- Nút cố định ở cuối màn hình
+---------------------------------------------------+
```

### Giao diện khi bấm sang Tab: "Bài đánh giá"

```text
+---------------------------------------------------+
|  [Tổng quan]  [Bài đánh giá] (Active) [Giới thiệu]| 
|---------------------------------------------------|
|                                                   |
|  Bài đánh giá                                     |
|                                                   |
|  Lọc theo Sao: Từ 3 đến 5 sao                     |
|   ⭐     ⭐     ⭐     ⭐     ⭐                 |
|  1---o---2-------3======4======5---o              | <- THANH KÉO (Range Slider) cực xịn
|                                                   |
|  Viết đánh giá                            1-5 sao |
|  [ ⭐ ⭐ ⭐ ⭐ ⭐ ]                                   |
|  +---------------------------------------------+  |
|  | Chia sẻ trải nghiệm của bạn...              |  |
|  |                                             |  |
|  | [📷 Thêm ảnh cho bài đánh giá]              |  |
|  +---------------------------------------------+  |
|  [ Gửi đánh giá ]                                 |
|                                                   |
|---------------------------------------------------|
|  Nhựt Minh                                  4 sao |
|  20:52 12/06/2026                                 |
|  nước tạm ổn                                      |
|                                                   |
|  [ 🖼️ Ảnh review (Meme mèo tom) ]                |
|                                                   |
+===================================================+
### Cách triển khai Code (Tab Chi Tiết)
- **Kiến trúc Layout**: Sử dụng `ScrollView` xếp dọc. Vì không gian Mobile hẹp ngang, phần Voucher và Thời tiết (vốn nằm bên phải trên Web) sẽ được **xếp dọc xuống ngay bên dưới** khối thông tin (Info Block) và nằm trong cùng Tab "Tổng quan".
- **Gọi API Thời Tiết**: Sử dụng Toạ độ `(Latitude, Longitude)` của Quán để gọi API thời tiết thời gian thực (Ví dụ: OpenWeather) nhằm hiển thị chính xác nhiệt độ và trạng thái (Dông, Mưa, Nắng...).
- **Nút Chat Nổi Tự Do Kéo (Draggable Floating Chat Buttons)**:
  - Thiết kế 2 nút tròn nổi ở góc dưới bên phải màn hình:
    - Nút Chat Owner (Màu xanh dương): Icon tin nhắn `💬` hoặc avatar quán.
    - Nút Chat AI (Màu xanh Teal): Icon robot/trợ lý `🤖`.
  - Sử dụng `PanResponder` và `Animated` của React Native để cho phép kéo thả tự do trên toàn bộ màn hình. Tích hợp tính năng auto-snap (khi thả tay, nút tự động hút nhẹ về phía cạnh trái hoặc phải gần nhất để tránh cản trở tầm nhìn).
  - Xây dựng phần vỏ giao diện (UI Shell) cho Giai đoạn 3:
    - Bấm nút Owner: Hiện Modal chat giả lập *"CAFE TRUNG NGUYÊN - Kết nối thời gian thực"* có khung chat, ô nhập tin nhắn và nút gửi.
    - Bấm nút AI: Hiện Modal chat giả lập *"Trợ lý AI - Hỏi đáp Địa điểm"* có danh sách câu hỏi gợi ý và khung phản hồi mẫu.
- **Fixed Button**: Dùng `<SafeAreaView>` để nút "Đặt bàn trước" dính chặt ở dưới cùng.
- **Range Slider**: Lọc review mượt mà qua state nội bộ.

---

## 6. Thiết kế Màn Hình "Đặt Chỗ" (Dịch vụ Ăn Uống)

Giao diện sẽ bám sát logic nghiệp vụ thực tế của Backend và Website, tối ưu hóa cho trải nghiệm di động.

### 6.1. Quy tắc Nghiệp vụ cốt lõi (Khớp Backend & Website)
1. **Thông tin liên hệ**: Không cho phép nhập trực tiếp Họ tên và Số điện thoại tại giao diện Đặt chỗ. Thông tin này được lấy tự động từ thông tin người dùng (Profile).
   - Nếu tài khoản đã có đầy đủ Họ tên và Số điện thoại: Hệ thống tự điền vào phần thông tin người đặt dưới dạng chỉ đọc (Read-only).
   - Nếu tài khoản chưa có hoặc thiếu Họ tên/Số điện thoại: Hệ thống sẽ chặn không cho đặt chỗ, hiển thị thông báo yêu cầu người dùng quay lại màn hình Thông tin cá nhân (Profile) để cập nhật, không được phép nhập tại chỗ.
2. **Quy tắc chọn bàn**: Cho phép chọn **1 hoặc nhiều bàn** trong cùng một khu vực hoặc các khu vực khác nhau.
3. **Quy tắc Đặt món trước**:
   - Chỉ được phép chọn món trước khi **chọn đúng 1 bàn**. Nếu chọn nhiều hơn 1 bàn, hệ thống sẽ ẩn hoặc khóa tùy chọn đặt món trước, đồng thời thông báo: *"Đặt món trước chỉ áp dụng khi chọn đúng 1 bàn"*.
   - Đặt món trước là **bắt buộc thanh toán chuyển khoản trước**.
4. **Quy tắc thời gian & Bảng Lưu ý**:
   - Chỉ được phép đặt trước tối đa 3 ngày (tính từ ngày hiện tại + 3 ngày tới).
   - Khách tới trễ hơn 1 tiếng so với giờ đã đặt thì hệ thống tự động hủy booking.
   - Hiển thị **Bảng Lưu ý** đầy đủ gồm 5 điều khoản tại màn hình đặt chỗ:
     1/ Khi đặt bàn nếu khách tới trễ hơn 1 tiếng hệ thống tự hủy.
     2/ Khách có thể tới nhận bàn trong khoảng ± 1 giờ so với giờ đã đặt.
     3/ Quý khách có thể đặt món trước nhưng phải thanh toán trước qua hình thức chuyển khoản.
     4/ Quý khách có thể đặt trước tối đa 3 ngày.
     5/ Tiền đã thanh toán sẽ không được hoàn lại. Xin lưu ý kĩ.

---

### 6.2. Mô tả Luồng Hoạt động chi tiết & Kịch bản

#### KỊCH BẢN 1: Đặt bàn không thanh toán trước (Đặt 1 hoặc nhiều bàn)
- **Bước 1**: User vào màn hình đặt bàn. Hệ thống kiểm tra thông tin Profile của User:
  - Nếu thiếu Họ tên hoặc Số điện thoại: Hiển thị giao diện cảnh báo chặn đặt chỗ kèm nút **[ Cập nhật Thông tin cá nhân ]** để điều hướng người dùng quay lại màn hình Profile.
  - Nếu đầy đủ thông tin: Hệ thống hiển thị Họ tên & Số điện thoại (chỉ đọc) và cho phép User tiếp tục chọn ngày giờ đến.
- **Bước 2**: User chọn một hoặc nhiều bàn trong danh sách lưới (Grid).
- **Bước 3**: Checkbox "Đặt món trước" không được tích chọn (để trống).
- **Bước 4**: User điền ghi chú (không bắt buộc) -> bấm **[ Xác nhận đặt chỗ ]** ở thanh bám đáy (Fixed Footer).
- **Bước 5**: App gọi API `POST /api/bookings` với body:
  ```json
  {
    "location_id": 1,
    "check_in_date": "2026-06-20T13:05:00",
    "check_out_date": null,
    "quantity": 2, // Số lượng bàn đã chọn (ví dụ chọn 2 bàn)
    "contact_name": "MEMORY",
    "contact_phone": "0938233763",
    "notes": "Nhóm bạn 6 người",
    "source": "mobile",
    "table_ids": [1, 3]
  }
  ```
- **Bước 6**: Backend kiểm tra xung đột bàn. Nếu hợp lệ, lưu booking với trạng thái `pending`, đồng thời khóa cứng bàn trong `booking_table_reservations` with trạng thái `active`.
- **Bước 7**: App nhận response thành công -> Hiển thị Màn hình thông báo đặt chỗ thành công có 2 nút:
  - **[ Vỏ vé ăn uống ]**: Bấm vào để xem thông tin chi tiết của vé vừa đặt (thiết kế UI vỏ vé, chưa có chức năng xử lý nghiệp vụ).
  - **[ Quay lại ]**: Bấm vào để quay lại trang chi tiết địa điểm hoặc trang Khám phá.

#### KỊCH BẢN 2: Đặt 1 bàn thanh toán trước có chọn đồ ăn nước uống
- **Bước 1**: Hệ thống kiểm tra thông tin Profile của User (nếu thiếu, yêu cầu quay lại Profile cập nhật như Kịch bản 1). Nếu đầy đủ, hiển thị thông tin chỉ đọc, User chọn duy nhất 1 bàn trống và chọn thời gian.
- **Bước 2**: User tích chọn checkbox **"Đặt món trước"**. Danh mục món ăn và danh sách món hiện ra.
- **Bước 3**: User tăng/giảm số lượng món ăn/nước uống muốn đặt trước. Tổng tiền tạm tính hiển thị tương ứng.
- **Bước 4**: User bấm **[ Thanh toán ]** ở Fixed Footer.
- **Bước 5**: App thực hiện cuộc gọi API đầu tiên để khởi tạo booking:
  - Gọi API `POST /api/bookings` với tham số `reserve_on_confirm: true` và `preorder_items`:
    ```json
    {
      "location_id": 1,
      "check_in_date": "2026-06-20T13:05:00",
      "contact_name": "MEMORY",
      "contact_phone": "0938233763",
      "source": "mobile",
      "table_ids": [1],
      "preorder_items": [{"service_id": 12, "quantity": 4}],
      "reserve_on_confirm": true
    }
    ```
  - Backend tạo booking ở trạng thái `pending`, ghi chú đính kèm nhãn `PREPAY_UNCONFIRMED` để đánh dấu chưa thanh toán chính thức, đồng thời tạo reservation cho bàn với trạng thái tạm giữ `released`.
- **Bước 6**: App nhận `bookingId` từ response, tiếp tục gọi API thứ hai:
  - Gọi API `POST /api/bookings/:bookingId/payments` để lấy dữ liệu thanh toán và thông tin VietQR của chủ quán.
- **Bước 7**: Màn hình Đặt chỗ hiển thị **Mã QR VietQR** (vẽ bằng `react-native-qrcode-svg`) cùng thông tin chuyển khoản cụ thể. 
  - Phía dưới mã QR hiển thị nút **[ Xác nhận đã thanh toán ]** (Nút màu xanh lá).
- **Bước 8**: Sau khi chuyển khoản trên ứng dụng ngân hàng, User bấm nút **[ Xác nhận đã thanh toán ]**:
  - App gọi API xác nhận: `POST /api/bookings/:bookingId/tables/confirm-transfer`.
  - Backend nhận lệnh, kiểm tra lại bàn, chuyển trạng thái reservation của bàn từ `released` sang `active`, cập nhật payment sang `completed` và xóa nhãn `PREPAY_UNCONFIRMED` khỏi booking.
- **Bước 9**: App nhận kết quả thành công -> hiển thị Màn hình thông báo đặt chỗ thành công có 2 nút **[ Vỏ vé ăn uống ]** và **[ Quay lại ]** giống như Kịch bản 1.

```text
Trạng thái 1: Chọn bàn & Đặt món trước
+---------------------------------------------------+
|  [ < ]  Xác nhận đặt bàn                          |
+===================================================+
|  🛋️ Chọn bàn (Đã chọn: 1 bàn)                      |
|  [✅ Bàn 1 (Đã chọn)]   [ Bàn 2 (Trống) ]         |
|                                                   |
|  ☑️ Đặt món trước (bắt buộc chuyển khoản)          |
|  Danh mục: [Tất cả] [Cafe] [Trà] (Cuộn ngang ->)  |
|  [☕] Cafe đen      17.000đ       [ - ] 4 [ + ]   |
|  [🍹] Trà Đào       23.000đ       [ - ] 0 [ + ]   |
|---------------------------------------------------|
|  📋 Tóm tắt đơn hàng:                             |
|  Cafe đen x4 = 68.000đ                            |
|  Tổng: 68.000đ                                    |
+===================================================+
|  1 Bàn | 68.000đ        [ Thanh toán ]            | <- Bấm nút này sẽ chuyển sang trạng thái 2 (QR)
+---------------------------------------------------+

Trạng thái 2: Hiển thị VietQR thanh toán
+---------------------------------------------------+
|  [ < ]  Xác nhận thanh toán                       |
+===================================================+
|  💳 Thanh toán qua VietQR chuyển khoản ngân hàng   |
|                                                   |
|          +-----------------------------+          |
|          |                             |          |
|          |        [ MÃ QR CODE ]       |          |
|          |          (VietQR)           |          |
|          |                             |          |
|          +-----------------------------+          |
|                                                   |
|  Ngân hàng: Vietcombank                           |
|  Số tài khoản: 1023456789                         |
|  Chủ tài khoản: NGUYEN VAN OWNER                  |
|  Số tiền: 68.000đ                                 |
|  Nội dung: BK-145-178193... (Auto-copy)           |
|                                                   |
|  *Lưu ý: Tiền đã thanh toán không được hoàn lại.  |
|  Vui lòng thực hiện chuyển khoản trước khi xác    |
|  nhận thanh toán bên dưới.*                       |
|                                                   |
|  [ ✅ Xác nhận đã thanh toán ]                    | <- Nút chính màu xanh lá
+---------------------------------------------------+

Trạng thái 3: Màn hình báo Đặt chỗ thành công
+---------------------------------------------------+
|                                                   |
|                🎉 THÀNH CÔNG 🎉                    |
|          Bạn đã đặt bàn thành công!               |
|                                                   |
|    [ Vỏ vé ăn uống ] (Vàng)    [ Quay lại ] (Xám) | <- Hai nút hành động ở cuối (làm vỏ UI)
|                                                   |
+---------------------------------------------------+
```

---

## 7. Thiết kế Màn Hình "Đặt Phòng" (Dịch vụ Khách sạn)

Giao diện sẽ bám sát logic nghiệp vụ thực tế của Backend và Website, tối ưu hóa cho trải nghiệm di động.

### 7.1. Quy tắc Nghiệp vụ cốt lõi (Khớp Backend & Website)
1. **Thông tin liên hệ**: Không cho phép nhập trực tiếp Họ tên và Số điện thoại tại giao diện Đặt chỗ. Thông tin này được lấy tự động từ thông tin người dùng (Profile).
   - Nếu tài khoản đã có đầy đủ Họ tên và Số điện thoại: Hệ thống tự điền vào phần thông tin người đặt dưới dạng chỉ đọc (Read-only).
   - Nếu tài khoản chưa có hoặc thiếu Họ tên/Số điện thoại: Hệ thống sẽ chặn không cho đặt chỗ, hiển thị thông báo yêu cầu người dùng quay lại màn hình Thông tin cá nhân (Profile) để cập nhật, không được phép nhập tại chỗ.
2. **Quy tắc chọn phòng**: Cho phép chọn **1 hoặc nhiều phòng** cùng một lúc (tối đa 20 phòng cho mỗi lần đặt).
3. **Thời gian lưu trú**:
   - Khách hàng chọn ngày Check-in bằng datetime picker.
   - Số ngày lưu trú (Stay Days) được chọn thông qua các preset: 1 Ngày (`day`), 1 Tuần (`week`), 1 Tháng (`month`), hoặc Tùy chỉnh (`custom`).
   - Nếu là Tùy chỉnh (`custom`), người dùng nhập trực tiếp số ngày (tối đa 90 ngày/3 tháng).
   - Ngày Check-out được tự động tính toán dựa trên ngày Check-in + Stay Days. Giờ trả phòng mặc định là 12:00 PM.
4. **Hai trường hợp luồng hoạt động (Chọn 1 hay nhiều phòng đều được)**:
   - **Trường hợp 1 (Không thanh toán trước - Pay Later)**: Hệ thống vẫn cho phép đặt phòng bình thường (áp dụng cho cả khi đặt 1 hay nhiều phòng).
   - **Trường hợp 2 (Thanh toán trước - Prepayment)**:
     - Số tiền phải trả tương ứng với thời gian đặt trước (số đêm/ngày lưu trú).
     - Các phòng được đặt cùng nhau trong một đơn đặt phòng (batch booking) phải có **cùng khoảng thời gian lưu trú như nhau** (cùng check-in, cùng check-out).
     - Giá tiền thanh toán sẽ tỷ lệ thuận và nhân lên theo số phòng: `Tổng tiền = Giá phòng/giờ * 24 giờ * Số ngày lưu trú * Số phòng`.
5. **Quy tắc thời gian & Bảng Lưu ý**:
   - Chỉ được phép đặt trước tối đa 3 ngày (tính từ ngày hiện tại + 3 ngày tới).
   - Khách tới nhận phòng trễ hơn 1 tiếng so với giờ đã đặt thì hệ thống tự động hủy booking.
   - Hiển thị **Bảng Lưu ý** đầy đủ gồm 6 điều khoản tại màn hình đặt phòng:
     1/ Khi đặt phòng nếu khách tới trễ hơn 1 tiếng hệ thống tự hủy.
     2/ Khách có thể tới nhận phòng trong khoảng ± 1 giờ so với giờ đã đặt.
     3/ Quý khách có thể đặt phòng trước nhưng phải thanh toán trước qua hình thức chuyển khoản.
     4/ Quý khách có thể đặt phòng trước tối đa 3 ngày.
     5/ Tiền đã thanh toán sẽ không được hoàn lại. Xin lưu ý kĩ.
     6/ Quý khách có thể đặt phòng để ở tối đa 3 tháng (90 ngày).
6. **Hình thức thanh toán**:
   - Cho phép chọn giữa **Không thanh toán trước** (Pay later) và **Chuyển khoản (VietQR)** (Thanh toán trước).

### 7.2. Luồng Hoạt động chi tiết & Kịch bản
#### KỊCH BẢN 1: Đặt phòng không thanh toán trước (Đặt 1 hoặc nhiều phòng, Pay Later)
- **Bước 1**: User vào màn hình đặt phòng. Hệ thống kiểm tra thông tin Profile của User:
  - Nếu thiếu Họ tên hoặc Số điện thoại: Hiển thị giao diện cảnh báo chặn đặt phòng kèm nút **[ Cập nhật Thông tin cá nhân ]** để điều hướng người dùng quay lại màn hình Profile.
  - Nếu đầy đủ thông tin: Hệ thống hiển thị Họ tên & Số điện thoại (chỉ đọc) và cho phép User tiếp tục chọn ngày check-in và số đêm lưu trú.
- **Bước 2**: User chọn một hoặc nhiều phòng trống trong danh sách lưới (Grid). Tất cả các phòng cùng đặt phải chia sẻ chung thời gian check-in và check-out.
- **Bước 3**: Chọn phương thức thanh toán là **"Không thanh toán trước"** (`prepayChoice === "none"`).
- **Bước 4**: User bấm **[ Xác nhận đặt chỗ ]** ở thanh bám đáy (Fixed Footer).
- **Bước 5**: App gọi API `POST /api/bookings/batch` với body (ví dụ chọn Phòng 101 và Phòng 102 tại địa điểm Nhà Trọ Phú Mỹ):
  ```json
  {
    "location_id": 1,
    "service_ids": [101, 102],
    "check_in_date": "2026-06-20T14:00:00",
    "check_out_date": "2026-06-23T12:00:00",
    "notes": null,
    "source": "mobile",
    "reserve_on_confirm": false,
    "voucher_code": null
  }
  ```
- **Bước 6**: Backend kiểm tra xung đột phòng trên hệ thống stays PMS. Nếu phòng trống, lưu booking với trạng thái `pending`, stays được kích hoạt thành `reserved` và phòng đổi trạng thái thành `reserved`.
- **Bước 7**: App nhận response thành công -> Hiển thị Banner Toast màu xanh lá ở trên cùng: *"Đơn đặt trước của bạn đã thành công và đã được tiếp nhận và đang được xử lý"*, reset danh sách phòng đang chọn, cập nhật các phòng vừa đặt sang màu vàng cam (`Bạn đã đặt` kèm Họ tên + SĐT). Hiển thị 2 nút điều hướng nhanh: **[ Vỏ vé khách sạn ]** (vỏ UI) và **[ Quay lại ]**.

#### KỊCH BẢN 2: Đặt phòng thanh toán trước chuyển khoản VietQR (1 hoặc nhiều phòng)
- **Bước 1**: Thực hiện các bước kiểm tra Profile và chọn phòng tương tự Kịch bản 1 (ví dụ chọn 2 phòng: Phòng 101 và Phòng 102).
- **Bước 2**: Chọn phương thức thanh toán là **"Chuyển khoản (VietQR)"** (`prepayChoice === "transfer"`). Áp dụng voucher giảm giá (nếu có).
- **Bước 3**: User bấm **[ Thanh toán ]** ở Fixed Footer. Tổng tiền hiển thị bằng tích của đơn giá phòng/ngày nhân số đêm lưu trú và nhân số lượng phòng chọn.
- **Bước 4**: App thực hiện cuộc gọi API đầu tiên để khởi tạo booking batch:
  - Gọi API `POST /api/bookings/batch` với `reserve_on_confirm: true` (Không truyền contact_name/contact_phone trực tiếp):
    ```json
    {
      "location_id": 1,
      "service_ids": [101, 102],
      "check_in_date": "2026-06-20T14:00:00",
      "check_out_date": "2026-06-23T12:00:00",
      "notes": null,
      "source": "mobile",
      "reserve_on_confirm": true,
      "voucher_code": "VOUCHER50"
    }
    ```
  - Backend tạo các booking ở trạng thái `pending` và trả về danh sách `booking_ids` (ví dụ: `[1201, 1202]`).
- **Bước 4b (MỚI)**: App thực hiện cuộc gọi API cập nhật thông tin liên hệ cho batch booking vừa tạo:
  - Gọi API `PUT /api/bookings/batch/contact`:
    ```json
    {
      "booking_ids": [1201, 1202],
      "contact_name": "Mai Nhựt Minh",
      "contact_phone": "0938233763"
    }
    ```
  - Backend cập nhật thông tin `contact_name` và `contact_phone` cho các booking tương ứng.
- **Bước 5**: App nhận danh sách `bookingIds` từ response, tiếp tục gọi API thứ ba:
  - Gọi API `POST /api/bookings/batch/payments` để lấy dữ liệu thanh toán và thông tin VietQR của chủ khách sạn.
- **Bước 6**: Màn hình Đặt phòng hiển thị **Mã QR VietQR** (vẽ bằng `react-native-qrcode-svg`) cùng thông tin chuyển khoản cụ thể. Phía dưới mã QR hiển thị nút **[ Xác nhận đã chuyển khoản ]** (Nút màu xanh lá).
- **Bước 7**: Sau khi chuyển khoản trên ứng dụng ngân hàng, User bấm nút **[ Xác nhận đã chuyển khoản ]**:
  - App gọi API xác nhận: `POST /api/bookings/batch/rooms/confirm-transfer` (hoặc qua paymentId tương ứng).
  - Backend nhận lệnh, kiểm tra lại phòng, tạo stay PMS ở trạng thái `reserved`, cập nhật status phòng thành `reserved`, cập nhật status payment sang `completed` và xóa nhãn `PREPAY_UNCONFIRMED` khỏi booking.
- **Bước 8**: App nhận kết quả thành công -> hiển thị Banner Toast xanh lá thành công và hai nút điều hướng **[ Vỏ vé khách sạn ]** và **[ Quay lại ]** giống như Kịch bản 1.

#### KỊCH BẢN 3: Đặt phòng thanh toán trước có áp dụng Voucher giảm 100%
- **Bước 1**: Chọn phòng, chọn "Chuyển khoản (VietQR)" và áp dụng mã voucher giảm giá 100% tiền phòng.
- **Bước 2**: Tổng tiền thanh toán giảm về 0đ. Nút bám đáy hiển thị: **[ Xác nhận đặt phòng ]** (thay vì Thanh toán).
- **Bước 3**: Bấm nút, App gọi API `POST /api/bookings/batch` với `reserve_on_confirm: false` (giữ phòng PMS trực tiếp luôn) và `voucher_code`.
- **Bước 4**: Booking được tạo trực tiếp với trạng thái `pending`, stay PMS kích hoạt `reserved` ngay lập tức mà không cần qua màn VietQR.
- **Bước 5**: Hiển thị Banner Toast xanh lá thành công và các phòng vừa đặt chuyển sang "Bạn đã đặt" (màu vàng cam nhạt).

### 7.3. Đặc tả API Endpoints Backend Chi Tiết

#### 1. Lấy danh sách phòng
- **Endpoint**: `GET /api/services`
- **Query Params**:
  - `location_id`: `number` (ID địa điểm, ví dụ Nhà Trọ Phú Mỹ)
  - `service_type`: `string` (Cố định là `'room'`)
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": 101,
        "location_id": 1,
        "name": "Phòng 101",
        "service_type": "room",
        "price": 100000,
        "status": "available",
        "image": "https://example.com/images/room101.jpg",
        "floor": "Tầng trệt"
      },
      {
        "id": 102,
        "location_id": 1,
        "name": "Phòng 102",
        "service_type": "room",
        "price": 100000,
        "status": "available",
        "image": "https://example.com/images/room102.jpg",
        "floor": "Tầng trệt"
      }
    ]
  }
  ```

#### 2. Tạo Booking Batch (Đơn đặt phòng hàng loạt)
- **Endpoint**: `POST /api/bookings/batch`
- **Request Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "location_id": 1,
    "service_ids": [101, 102],
    "check_in_date": "2026-06-20T14:00:00.000Z",
    "check_out_date": "2026-06-23T12:00:00.000Z",
    "notes": "Đặt phòng gia đình",
    "source": "mobile",
    "reserve_on_confirm": true,
    "voucher_code": "VOUCHER50"
  }
  ```
- **Response (201 Created)**:
  ```json
  {
    "success": true,
    "booking_ids": [1201, 1202]
  }
  ```

#### 2b. Cập nhật thông tin liên hệ cho Batch Booking
- **Endpoint**: `PUT /api/bookings/batch/contact`
- **Request Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "booking_ids": [1201, 1202],
    "contact_name": "Mai Nhựt Minh",
    "contact_phone": "0938233763"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Cập nhật liên hệ thành công"
  }
  ```

#### 3. Tạo thông tin thanh toán VietQR
- **Endpoint**: `POST /api/bookings/batch/payments`
- **Request Body**:
  ```json
  {
    "booking_ids": [1201, 1202]
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "payment_id": 450,
    "amount": 7200000,
    "qr_content": "00020101021238580010A0000007270128000697042201141023456789520460115303704540772000005802VN5921MAI NHUT MINH6007Can Tho62360520BK-1201-1202-3NIGHT6304A9C1",
    "bank_name": "Vietcombank",
    "account_number": "1023456789",
    "account_name": "MAI NHUT MINH",
    "transfer_content": "BK-1201-1202-3NIGHT"
  }
  ```

#### 4. Xác nhận chuyển khoản phòng thành công
- **Endpoint**: `POST /api/bookings/batch/rooms/confirm-transfer`
- **Request Body**:
  ```json
  {
    "payment_id": 450
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Xác nhận chuyển khoản thành công. Stay PMS đã được kích hoạt."
  }
  ```

### 7.4. Kiến trúc Kết nối & Quản lý UI State Mobile (React Native + TypeScript)

#### 1. Code gọi API qua Axios (`mobile/api/bookingApi.ts`)
```typescript
import axios from 'axios';

const API_BASE_URL = 'https://api.travelcheckin.com'; // Base URL backend

export interface CreateBookingBatchPayload {
  location_id: number;
  service_ids: number[];
  check_in_date: string;
  check_out_date: string;
  notes?: string | null;
  source: string;
  reserve_on_confirm: boolean;
  voucher_code?: string | null;
}

export interface BookingBatchResponse {
  success: boolean;
  booking_ids: number[];
}

export interface PaymentInfoResponse {
  success: boolean;
  payment_id: number;
  amount: number;
  qr_content: string;
  bank_name: string;
  account_number: string;
  account_name: string;
  transfer_content: string;
}

export const bookingApi = {
  // Lấy danh sách phòng của địa điểm
  getRooms: async (locationId: number) => {
    const response = await axios.get(`${API_BASE_URL}/api/services`, {
      params: { location_id: locationId, service_type: 'room' }
    });
    return response.data;
  },

  // Tạo đơn đặt phòng batch
  createBookingBatch: async (payload: CreateBookingBatchPayload): Promise<BookingBatchResponse> => {
    const response = await axios.post<BookingBatchResponse>(
      `${API_BASE_URL}/api/bookings/batch`, 
      payload
    );
    return response.data;
  },

  // Tạo và lấy mã VietQR thanh toán
  getPaymentForBatch: async (bookingIds: number[]): Promise<PaymentInfoResponse> => {
    const response = await axios.post<PaymentInfoResponse>(
      `${API_BASE_URL}/api/bookings/batch/payments`, 
      { booking_ids: bookingIds }
    );
    return response.data;
  },

  // Xác nhận đã chuyển khoản thành công
  confirmRoomBatchTransfer: async (paymentId: number): Promise<{ success: boolean; message: string }> => {
    const response = await axios.post<{ success: boolean; message: string }>(
      `${API_BASE_URL}/api/bookings/confirm-room-transfer`, 
      { payment_id: paymentId }
    );
    return response.data;
  }
};
```

#### 2. Logic tính toán Check-out Date và Tổng tiền phòng trên Mobile
```typescript
import React, { useState, useEffect } from 'react';

// Định nghĩa Đơn giá phòng của Nhà Trọ Phú Mỹ
const PRICE_PER_HOUR = 100000; // 100.000đ / giờ
const PRICE_PER_DAY = PRICE_PER_HOUR * 24; // 2.400.000đ / ngày (24h)

interface BookingStateProps {
  checkInDate: Date;
  selectedRoomIds: number[];
  stayPreset: 'day' | 'week' | 'month' | 'custom';
  customDaysCount: number;
}

export const useBookingCalculator = ({
  checkInDate,
  selectedRoomIds,
  stayPreset,
  customDaysCount
}: BookingStateProps) => {
  const [checkOutDate, setCheckOutDate] = useState<Date>(new Date());
  const [totalAmount, setTotalAmount] = useState<number>(0);

  // 1. Tính toán ngày Check-out tự động dựa trên ngày Check-in + Stay Days
  useEffect(() => {
    const calcOutDate = new Date(checkInDate);
    let daysToAdd = 1;

    switch (stayPreset) {
      case 'day':
        daysToAdd = 1;
        break;
      case 'week':
        daysToAdd = 7;
        break;
      case 'month':
        daysToAdd = 30;
        break;
      case 'custom':
        daysToAdd = Math.min(Math.max(customDaysCount, 1), 90); // Giới hạn từ 1 đến 90 ngày
        break;
    }

    calcOutDate.setDate(calcOutDate.getDate() + daysToAdd);
    
    // Giờ trả phòng cố định theo chuẩn khách sạn/nhà trọ (thường là 12:00 PM)
    calcOutDate.setHours(12, 0, 0, 0);
    setCheckOutDate(calcOutDate);
  }, [checkInDate, stayPreset, customDaysCount]);

  // 2. Tính tổng tiền: nhân hệ số số phòng * số ngày lưu trú * đơn giá ngày (24h)
  useEffect(() => {
    let stayDays = 1;
    switch (stayPreset) {
      case 'day': stayDays = 1; break;
      case 'week': stayDays = 7; break;
      case 'month': stayDays = 30; break;
      case 'custom': stayDays = Math.min(Math.max(customDaysCount, 1), 90); break;
    }

    const roomsCount = selectedRoomIds.length;
    const calculatedTotal = PRICE_PER_DAY * stayDays * roomsCount;
    setTotalAmount(calculatedTotal);
  }, [selectedRoomIds, stayPreset, customDaysCount]);

  return {
    checkOutDate,
    totalAmount
  };
};
```

> [!IMPORTANT]
> **Hiển thị động thông tin tài khoản ngân hàng của Owner**:
> Mỗi địa điểm thuộc sở hữu của một Owner khác nhau, và mỗi Owner sẽ cấu hình tài khoản ngân hàng riêng trong bảng `owner_profiles` (các cột `bank_name`, `bank_account`, `account_holder`). 
> Khi gọi API lấy payment QR, Backend sẽ tự động lấy thông tin ngân hàng của đúng chủ địa điểm đó để sinh ra chuỗi `qr_content` động. 
> Giao diện Mobile **tuyệt đối không được fix cứng** thông tin ngân hàng mà phải hiển thị động hoàn toàn theo dữ liệu trả về từ API response (Ngân hàng, Chủ tài khoản, Số tài khoản, Số tiền, và Nội dung chuyển khoản).

## 8. Sơ đồ các Giao diện Mockup chi tiết (Luồng đi từ Ăn uống)

### 8.1. Giao diện 1: Khi vừa vào trang (Đầy đủ Profile)
```text
+---------------------------------------------------+
|  [ < ] Đặt chỗ                                     |
+===================================================+
|  Xác nhận thông tin booking                        |
|  [ Vỏ vé ăn uống ] (Vàng)        [ Quay lại ] (Xám)|
|---------------------------------------------------|
|  📍 ĐỊA ĐIỂM:                                      |
|  Cafe Trung Nguyên                                |
|  Trung Nguyên E-Coffee, Trần Chiên, Cái Răng...   |
|---------------------------------------------------|
|  🕒 Thời gian tới:                                 |
|  [ 20-06-2026 23:00                      [📅] ]   |
|  *Khung đến: 22:00 - 00:00 (Hôm sau)*             |
|                                                   |
|  ⌛ Hạn sử dụng:                                   |
|  [ Trễ hơn 1 tiếng tự hủy             ] (Chỉ đọc) |
|---------------------------------------------------|
|  👤 Họ tên người đặt:                              |
|  [ Mai Nhựt Minh                     ] (Chỉ đọc)  |
|  📞 Số điện thoại:                                 |
|  [ 0938233763                        ] (Chỉ đọc)  |
|---------------------------------------------------|
|  🛋️ Chọn bàn: (Đã chọn: 0 bàn)                     |
|  Khu: [Tất cả] [Tầng 1] [Tầng 2]                  |
|                                                   |
|  [ Bàn 1 (Trống) ]      [ Bàn 2 (Trống) ]         |
|  [ Bàn 3 (Trống) ]      [ Bàn 4 (Trống) ]         |
|  [ Bàn 5 (Trống) ]      [ Bàn 6 (Trống) ]         |
|  *Bấm 1 hoặc nhiều bàn để đặt*                    |
|                                                   |
|  ☐ Đặt món trước (bắt buộc chuyển khoản)          |
|---------------------------------------------------|
|  📝 Ghi chú:                                      |
|  [ Nhập ghi chú cho quán...                     ] |
|---------------------------------------------------|
|  ℹ️ Lưu ý:                                         |
|  - 1/ Khi đặt bàn nếu khách tới trễ hơn 1 tiếng    |
|     hệ thống tự hủy.                              |
|  - 2/ Khách có thể tới nhận bàn trong khoảng      |
|     ± 1 giờ so với giờ đã đặt.                    |
|  - 3/ Quý khách có thể đặt món trước nhưng phải   |
|     thanh toán trước qua hình thức chuyển khoản.  |
|  - 4/ Quý khách có thể đặt trước tối đa 3 ngày.   |
|  - 5/ Tiền đã thanh toán sẽ không được hoàn lại.  |
+===================================================+
|  0 Bàn | Miễn phí     [ Vui lòng chọn bàn ]       | <- Nút mờ bám đáy
+---------------------------------------------------+
```

*(Trường hợp nếu thiếu thông tin Profile, giao diện sẽ hiển thị như sau:)*
```text
+---------------------------------------------------+
|  [ < ]  Đặt chỗ - Cafe Trung Nguyên               |
+===================================================+
|                                                   |
|  ⚠️ THÔNG BÁO QUAN TRỌNG                            |
|                                                   |
|  Bạn cần cập nhật Họ tên và Số điện thoại trong   |
|  Thông tin cá nhân để thực hiện đặt chỗ.          |
|                                                   |
|       [ ⚙️ Cập nhật Thông tin cá nhân ]           | <- Nút điều hướng sang trang Profile
|                                                   |
+---------------------------------------------------+
```

### 8.2. Giao diện 2: Khi chọn bàn (Không chọn món)
```text
+---------------------------------------------------+
|  [ < ] Đặt chỗ                                     |
+===================================================+
|  Xác nhận thông tin booking                        |
|  [ Vỏ vé ăn uống ] (Vàng)        [ Quay lại ] (Xám)|
|---------------------------------------------------|
|  📍 ĐỊA ĐIỂM: Cafe Trung Nguyên                    |
|---------------------------------------------------|
|  🕒 Thời gian tới:                                 |
|  [ 20-06-2026 23:00                      [📅] ]   |
|  *Khung đến: 22:00 - 00:00 (Hôm sau)*             |
|                                                   |
|  ⌛ Hạn sử dụng:                                   |
|  [ Trễ hơn 1 tiếng tự hủy             ] (Chỉ đọc) |
|---------------------------------------------------|
|  👤 Họ tên: Mai Nhựt Minh (Chỉ đọc)               |
|  📞 SĐT: 0938233763 (Chỉ đọc)                     |
|---------------------------------------------------|
|  🛋️ Chọn bàn: (Đã chọn: 2 bàn)                     |
|  Khu: [Tất cả] [Tầng 1] [Tầng 2]                  |
|                                                   |
|  [✅ Bàn 1 (Đã chọn)]   [ Bàn 2 (Trống) ]         |
|  [✅ Bàn 3 (Đã chọn)]   [ Bàn 4 (Trống) ]         |
|                                                   |
|  🔒 Đặt món trước (Khóa vì chọn nhiều bàn)        |
|  *Đặt món trước chỉ áp dụng khi chọn đúng 1 bàn*   |
|---------------------------------------------------|
|  📝 Ghi chú:                                      |
|  [ Nhóm đi 4 người                              ] |
|---------------------------------------------------|
|  ℹ️ Lưu ý:                                         |
|  - 1/ Khi đặt bàn nếu khách tới trễ hơn 1 tiếng    |
|     hệ thống tự hủy.                              |
|  - 2/ Khách có thể tới nhận bàn trong khoảng      |
|     ± 1 giờ so với giờ đã đặt.                    |
+===================================================+
|  2 Bàn | Miễn phí       [ Xác nhận đặt chỗ ]      | <- Nút hoạt động bấm được
+---------------------------------------------------+
```

### 8.3. Giao diện 3: Khi bấm Xác nhận (Đặt chỗ không món thành công)
* Banner thông báo màu xanh lá nhạt nổi lên ở đầu màn hình. Các bàn vừa đặt chuyển sang trạng thái "Bạn đã đặt" (màu vàng cam nhạt, viền cam) hiển thị thông tin người đặt. Mảng bàn đang chọn được reset về 0 bàn.
```text
+---------------------------------------------------+
|  [ < ] Đặt chỗ                                     |
+===================================================+
|  [✓] Đơn đặt trước của bạn đã thành công và đã    | <- Banner Toast màu xanh lá
|      được tiếp nhận và đang được xử lý            |
|---------------------------------------------------|
|  Xác nhận thông tin booking                        |
|  [ Vỏ vé ăn uống ] (Vàng)        [ Quay lại ] (Xám)|
|---------------------------------------------------|
|  📍 ĐỊA ĐIỂM: Cafe Trung Nguyên                    |
|---------------------------------------------------|
|  🕒 Thời gian tới:                                 |
|  [ 20-06-2026 23:02                      [📅] ]   |
|  *Khung đến: 22:02 - 00:02 (Hôm sau)*             |
|                                                   |
|  ⌛ Hạn sử dụng:                                   |
|  [ Trễ hơn 1 tiếng tự hủy             ] (Chỉ đọc) |
|---------------------------------------------------|
|  👤 Họ tên: Mai Nhựt Minh (Chỉ đọc)               |
|  📞 SĐT: 0938233763 (Chỉ đọc)                     |
|---------------------------------------------------|
|  🛋️ Chọn bàn: (Đã chọn: 0 bàn)                     |
|  Khu: [Tất cả] [Tầng 1] [Tầng 2]                  |
|                                                   |
|  +---------------------+   +---------------------+|
|  | Bàn 1 (Bạn đã đặt)  |   | Bàn 2 (Bạn đã đặt)  || <- Trạng thái bàn đã đặt (Nền vàng cam nhạt)
|  | Mai Nhựt Minh       |   | Mai Nhựt Minh       ||
|  | 0938233763          |   | 0938233763          ||
|  +---------------------+   +---------------------+|
|  [ Bàn 3 (Trống) ]         [ Bàn 4 (Trống) ]      |
|  [ Bàn 5 (Trống) ]         [ Bàn 6 (Trống) ]      |
|                                                   |
|  ☐ Đặt món trước (bắt buộc chuyển khoản)          |
|---------------------------------------------------|
|  📝 Ghi chú:                                      |
|  [ Nhóm đi 4 người                              ] |
+===================================================+
|  0 Bàn | Miễn phí     [ Vui lòng chọn bàn ]       | <- Nút mờ bám đáy do bàn đã đặt thành công
+---------------------------------------------------+
```

### 8.4. Giao diện 4: Khi chọn bàn và chọn món (Chưa áp dụng voucher)
* Chọn đúng 1 bàn, tick chọn Checkbox "Đặt món trước (bắt buộc chuyển khoản)". Hiển thị danh mục món ăn bên dưới để tăng giảm số lượng.
```text
+---------------------------------------------------+
|  [ < ] Đặt chỗ                                     |
+===================================================+
|  Xác nhận thông tin booking                        |
|---------------------------------------------------|
|  🛋️ Chọn bàn: (Đã chọn: 1 bàn)                     |
|  [✅ Bàn 3 (Đã chọn)]   [ Bàn 4 (Trống) ]         |
|                                                   |
|  ☑️ Đặt món trước (bắt buộc chuyển khoản)          |
|  Danh mục: [Tất cả] [Cafe] [Trà] [Bánh Ngọt]       | <- Cuộn ngang chọn danh mục
|  [🍔] Combo đi làm    35.000đ     [ - ] 1 [ + ]   |
|  [🍹] Trà Đào         23.000đ     [ - ] 1 [ + ]   |
|  [🍰] Bánh cheesecake 100.000đ    [ - ] 1 [ + ]   |
|---------------------------------------------------|
|  📝 Ghi chú:                                      |
|  [ Nhập ghi chú...                              ] |
|---------------------------------------------------|
|  🎫 Voucher đã lưu:                                |
|  [ Bạn chưa lưu voucher nào khả dụng             ] |
|---------------------------------------------------|
|  📋 Tóm tắt đặt món trước:                         |
|  - Combo đi làm: 35.000đ x 1                      |
|  - Trà Đào: 23.000đ x 1                           |
|  - Bánh cheesecake...: 100.000đ x 1               |
|  Số món: 3 | Tổng SL: 3                           |
|  Tổng tiền: 158.000đ                              |
+===================================================+
|  1 Bàn | 158.000đ        [ Thanh toán ]           | <- Nút chuyển sang VietQR
+---------------------------------------------------+
```

### 8.5. Giao diện 5: Khi chọn bàn + món và Áp dụng Voucher giảm 100%
* Nếu áp dụng mã giảm giá voucher 100% (hoặc giảm hết tiền món), tổng tiền thanh toán về 0đ.
```text
+---------------------------------------------------+
|  [ < ] Đặt chỗ                                     |
+===================================================+
|  Xác nhận thông tin booking                        |
|---------------------------------------------------|
|  🛋️ Chọn bàn: (Đã chọn: 1 bàn)                     |
|  [✅ Bàn 3 (Đã chọn)]   [ Bàn 4 (Trống) ]         |
|                                                   |
|  ☑️ Đặt món trước (bắt buộc chuyển khoản)          |
|  [🍔] Combo đi làm    35.000đ     [ - ] 1 [ + ]   |
|  [🍹] Trà Đào         23.000đ     [ - ] 1 [ + ]   |
|  [🍰] Bánh cheesecake 100.000đ    [ - ] 1 [ + ]   |
|---------------------------------------------------|
|  🎫 Voucher đã lưu:                                |
|  [ VOUCHER100              ]    [ Đã áp dụng ]    |
|  *Giảm giá 100% tiền đặt món trước*                |
|---------------------------------------------------|
|  📋 Tóm tắt đặt món trước:                         |
|  - Tổng tiền món: 158.000đ                        |
|  - Giảm giá voucher: -158.000đ                    |
|  Tổng tiền thanh toán: 0đ                         |
+===================================================+
|  1 Bàn | 0đ             [ Xác nhận đặt chỗ ]      | <- Bấm chuyển thẳng sang giao diện thành công
+---------------------------------------------------+
```

### 8.6. Giao diện 6: Hiện mã QR thanh toán VietQR (Khi thanh toán > 0đ, không có voucher 100%)
* Hiển thị mã QR Code VietQR động cùng thông tin chuyển khoản chính xác của Chủ quán để thanh toán tiền cọc món.
```text
+---------------------------------------------------+
|  [ < ] Thanh toán món đặt trước                   |
+===================================================+
|  💳 Chuyển khoản ngân hàng qua mã VietQR          |
|  *Đã tạo 1 payment.*                              |
|                                                   |
|          +-----------------------------+          |
|          |                             |          |
|          |        [ MÃ QR CODE ]       |          |
|          |          (VietQR)           |          |
|          |                             |          |
|          +-----------------------------+          |
|                                                   |
|  Ngân hàng: Vietcombank                           |
|  Số tài khoản: 1030549759                         |
|  Chủ tài khoản: MAI NHUT MINH                     |
|  Số tiền: 158.000đ                                |
|  Nội dung: Cafe Trung Nguyen - Cam on...          |
|                                                   |
|  *Sau khi chuyển khoản, vui lòng bấm nút xác      |
|  nhận bên dưới để hoàn tất đặt bàn. Trang sẽ      |
|  tự động tải lại và cập nhật trạng thái.*         |
|                                                   |
|  +-------------------------------------------+    |
|  |        [ ✅ Xác nhận đã thanh toán ]       |    | <- Nút màu xanh lá
|  +-------------------------------------------+    |
+---------------------------------------------------+
```

### 8.7. Giao diện 7: Khi hoàn tất (Đặt chỗ có gọi món & chuyển khoản thành công)
* Tương tự Giao diện 3, màn hình hiển thị Banner đặt trước thành công kèm theo trạng thái bàn "Bạn đã đặt" (màu vàng cam nhạt) của chính user.
```text
+---------------------------------------------------+
|  [ < ] Đặt chỗ                                     |
+===================================================+
|  [✓] Đơn đặt trước của bạn đã thành công và đã    | <- Banner Toast màu xanh lá
|      được tiếp nhận và đang được xử lý            |
|---------------------------------------------------|
|  Xác nhận thông tin booking                        |
|  [ Vỏ vé ăn uống ] (Vàng)        [ Quay lại ] (Xám)|
|---------------------------------------------------|
|  📍 ĐỊA ĐIỂM: Cafe Trung Nguyên                    |
|---------------------------------------------------|
|  🕒 Thời gian tới:                                 |
|  [ 20-06-2026 23:02                      [📅] ]   |
|  *Khung đến: 22:02 - 00:02 (Hôm sau)*             |
|---------------------------------------------------|
|  👤 Họ tên: Mai Nhựt Minh (Chỉ đọc)               |
|  📞 SĐT: 0938233763 (Chỉ đọc)                     |
|---------------------------------------------------|
|  🛋️ Chọn bàn: (Đã chọn: 0 bàn)                     |
|  Khu: [Tất cả] [Tầng 1] [Tầng 2]                  |
|                                                   |
|  +---------------------+                          |
|  | Bàn 1 (Bạn đã đặt)  |                          | <- Bàn đã đặt thành công (màu vàng cam)
|  | Mai Nhựt Minh       |                          |
|  | 0938233763          |                          |
|  +---------------------+                          |
|  [ Bàn 2 (Trống) ]         [ Bàn 3 (Trống) ]      |
|                                                   |
|  ☑️ Đặt món trước (bắt buộc chuyển khoản)          |
|  📋 Tóm tắt đơn hàng:                             |
|  - Cafe đen x4 = 68.000đ                          |
|  - Đã thanh toán chuyển khoản: 68.000đ            |
+===================================================+
|  0 Bàn | 68.000đ      [ Đã hoàn tất đặt chỗ ]     | <- Nút trạng thái thành công
+---------------------------------------------------+
```

## 9. Sơ đồ các Giao diện Mockup chi tiết (Luồng đi từ Khách sạn)

### 9.1. Giao diện 1: Khi vừa vào trang (Đầy đủ Profile)
```text
+---------------------------------------------------+
|  [ < ] Đặt phòng                                   |
+===================================================+
|  Xác nhận thông tin đặt phòng                      |
|  [ Vỏ vé khách sạn ] (Vàng)          [ Quay lại ] (Xám)|
|---------------------------------------------------|
|  📍 ĐỊA ĐIỂM:                                      |
|  Nhà Trọ Phú Mỹ                            |
|  Đường 30 Tháng 4, Hưng Lợi, Ninh Kiều, Cần Thơ...|
|---------------------------------------------------|
|  🕒 Thời gian check-in:                            |
|  [ 20-06-2026 14:00                      [📅] ]   |
|                                                   |
|  ⌛ Số ngày lưu trú:                               |
|  [ 1 Ngày (Active) ]  [ 1 Tuần ]  [ 1 Tháng ]     |
|  [ Tùy chỉnh ]                                    |
|                                                   |
|  📅 Ngày check-out dự kiến:                        |
|  [ 21-06-2026 12:00                   ] (Chỉ đọc) |
|---------------------------------------------------|
|  👤 Họ tên người đặt:                              |
|  [ Mai Nhựt Minh                     ] (Chỉ đọc)  |
|  📞 Số điện thoại:                                 |
|  [ 0938233763                        ] (Chỉ đọc)  |
|---------------------------------------------------|
|  🛏️ Chọn phòng: (Đã chọn: 0 phòng)                 |
|                                                   |
|  +-------------------+   +-------------------+    |
|  | [📷] Phòng 101     |   | [📷] Phòng 102     |    |
|  | 100.000đ/giờ       |   | 100.000đ/giờ       |    |
|  | [ Trống ]         |   | [ Trống ]         |    |
|  +-------------------+   +-------------------+    |
|  +-------------------+   +-------------------+    |
|  | [📷] Phòng 103     |   | [📷] Phòng 104     |    |
|  | 100.000đ/giờ       |   | 100.000đ/giờ       |    |
|  | [ Có khách ] (Đỏ) |   | [ Đang dọn ] (Tím)|    |
|  +-------------------+   +-------------------+    |
|  *Bấm 1 hoặc nhiều phòng để đặt (Tối đa 20)*      |
|---------------------------------------------------|
|  💳 Thanh toán trước:                             |
|  (o) Không thanh toán trước                       |
|  ( ) Chuyển khoản (VietQR)                        |
|---------------------------------------------------|
|  ℹ️ Lưu ý:                                         |
|  - 1/ Khi đặt phòng nếu khách tới trễ hơn 1 tiếng  |
|     hệ thống tự hủy.                              |
|  - 2/ Khách có thể tới nhận phòng trong khoảng    |
|     ± 1 giờ so với giờ đã đặt.                    |
|  - 3/ Quý khách có thể đặt phòng trước nhưng phải |
|     thanh toán trước qua hình thức chuyển khoản.  |
|  - 4/ Quý khách có thể đặt trước tối đa 3 ngày.   |
|  - 5/ Tiền đã thanh toán sẽ không được hoàn lại.  |
|  - 6/ Quý khách có thể ở tối đa 90 ngày.          |
+===================================================+
|  0 Phòng | 0đ         [ Vui lòng chọn phòng ]     | <- Nút mờ bám đáy
+---------------------------------------------------+
```

### 9.2. Giao diện 2: Khi chọn phòng & số đêm lưu trú (Thanh toán sau)
```text
+---------------------------------------------------+
|  [ < ] Đặt phòng                                   |
+===================================================+
|  Xác nhận thông tin đặt phòng                      |
|  [ Vỏ vé khách sạn ] (Vàng)          [ Quay lại ] (Xám)|
|---------------------------------------------------|
|  📍 ĐỊA ĐIỂM: Nhà Trọ Phú Mỹ                |
|---------------------------------------------------|
|  🕒 Thời gian check-in:                            |
|  [ 20-06-2026 14:00                      [📅] ]   |
|  ⌛ Số ngày lưu trú:                               |
|  [ 1 Ngày ]  [ 1 Tuần ]  [ 1 Tháng ]              |
|  [ Tùy chỉnh (Active) ]                           |
|  Số đêm lưu trú: [ 3  ] ngày                      |
|  📅 Ngày check-out dự kiến:                        |
|  [ 23-06-2026 12:00                   ] (Chỉ đọc) |
|---------------------------------------------------|
|  👤 Họ tên: Mai Nhựt Minh (Chỉ đọc)               |
|  📞 SĐT: 0938233763 (Chỉ đọc)                     |
|---------------------------------------------------|
|  🛏️ Chọn phòng: (Đã chọn: 2 phòng)                 |
|                                                   |
|  +-------------------+   +-------------------+    |
|  | [📷] Phòng 101     |   | [📷] Phòng 102     |    |
|  | 100.000đ/giờ       |   | 100.000đ/giờ       |    |
|  | [ Đã chọn ] (Teal)|   | [ Đã chọn ] (Teal)|    |
|  +-------------------+   +-------------------+    |
|                                                   |
|  💳 Thanh toán trước:                             |
|  (o) Không thanh toán trước                       |
|  ( ) Chuyển khoản (VietQR)                        |
+===================================================+
|  2 Phòng | 14.400.000đ   [ Xác nhận đặt chỗ ]      | <- Nút bấm được (100.000đ/giờ * 24h * 3 đêm * 2 phòng = 14.400.000đ)
+---------------------------------------------------+
```

### 9.3. Giao diện 3: Khi bấm Xác nhận (Đặt chỗ thanh toán sau thành công)
```text
+---------------------------------------------------+
|  [ < ] Đặt phòng                                   |
+===================================================+
|  [✓] Đơn đặt trước của bạn đã thành công và đã    | <- Banner Toast màu xanh lá
|      được tiếp nhận và đang được xử lý            |
|---------------------------------------------------|
|  Xác nhận thông tin đặt phòng                      |
|  [ Vỏ vé khách sạn ] (Vàng)          [ Quay lại ] (Xám)|
|---------------------------------------------------|
|  📍 ĐỊA ĐIỂM: Nhà Trọ Phú Mỹ                |
|---------------------------------------------------|
|  🕒 Thời gian check-in:                            |
|  [ 20-06-2026 14:00                      [📅] ]   |
|  ⌛ Số ngày lưu trú: 3 ngày                        |
|  📅 Ngày check-out dự kiến: 23-06-2026 12:00       |
|---------------------------------------------------|
|  👤 Họ tên: Mai Nhựt Minh (Chỉ đọc)               |
|  📞 SĐT: 0938233763 (Chỉ đọc)                     |
|---------------------------------------------------|
|  🛏️ Chọn phòng: (Đã chọn: 0 phòng)                 |
|                                                   |
|  +---------------------+   +---------------------+|
|  | Phòng 101 (Bạn đã đặt|   | Phòng 102 (Bạn đã đặt|| <- Phòng đã đặt (nền vàng cam nhạt, viền cam)
|  | Mai Nhựt Minh       |   | Mai Nhựt Minh       ||
|  | 0938233763          |   | 0938233763          ||
|  +---------------------+   +---------------------+|
|  [ Phòng 103 (Bận) ]       [ Phòng 104 (Bận) ]    |
|                                                   |
|  💳 Thanh toán trước:                             |
|  (o) Không thanh toán trước                       |
+===================================================+
|  0 Phòng | 0đ         [ Vui lòng chọn phòng ]     |
+---------------------------------------------------+
```

### 9.4. Giao diện 4: Chọn phòng + Chuyển khoản VietQR (Chưa áp dụng voucher)
```text
+---------------------------------------------------+
|  [ < ] Đặt phòng                                   |
+===================================================+
|  Xác nhận thông tin đặt phòng                      |
|---------------------------------------------------|
|  🛏️ Chọn phòng: (Đã chọn: 1 phòng)                 |
|  +-------------------+                            |
|  | [📷] Phòng 101     |                            |
|  | 100.000đ/giờ       |                            |
|  | [ Đã chọn ] (Teal)|                            |
|  +-------------------+                            |
|                                                   |
|  💳 Thanh toán trước:                             |
|  ( ) Không thanh toán trước                       |
|  (o) Chuyển khoản (VietQR)                        |
|---------------------------------------------------|
|  🎫 Voucher đã lưu:                                |
|  [ Bạn chưa lưu voucher nào khả dụng             ] |
|---------------------------------------------------|
|  📋 Tóm tắt đặt phòng:                             |
|  - Phòng 101: 2.400.000đ/ngày x 3 ngày = 7.200.000đ  |
|  Tổng tiền phòng: 7.200.000đ                      |
+===================================================+
|  1 Phòng | 7.200.000đ     [ Thanh toán ]          | <- Bấm nút chuyển sang VietQR
+---------------------------------------------------+
```

### 9.5. Giao diện 5: Chọn phòng + Chuyển khoản VietQR (Có Voucher giảm 100%)
```text
+---------------------------------------------------+
|  [ < ] Đặt phòng                                   |
+===================================================+
|  Xác nhận thông tin đặt phòng                      |
|---------------------------------------------------|
|  🛏️ Chọn phòng: (Đã chọn: 1 phòng)                 |
|  +-------------------+                            |
|  | [📷] Phòng 101     |                            |
|  | 100.000đ/giờ       |                            |
|  | [ Đã chọn ] (Teal)|                            |
|  +-------------------+                            |
|                                                   |
|  💳 Thanh toán trước:                             |
|  ( ) Không thanh toán trước                       |
|  (o) Chuyển khoản (VietQR)                        |
|---------------------------------------------------|
|  🎫 Voucher đã lưu:                                |
|  [ HOTEL100                ]    [ Đã áp dụng ]    |
|  *Giảm giá 100% tiền đặt phòng khách sạn*          |
|---------------------------------------------------|
|  📋 Tóm tắt đặt phòng:                             |
|  - Tổng tiền phòng: 7.200.000đ                    |
|  - Giảm giá voucher: -7.200.000đ                  |
|  Tổng tiền thanh toán: 0đ                         |
+===================================================+
|  1 Phòng | 0đ          [ Xác nhận đặt phòng ]     | <- Bấm chuyển thẳng sang giao diện thành công
+---------------------------------------------------+
```

### 9.6. Giao diện 6: Hiện mã QR thanh toán VietQR (Khi thanh toán > 0đ)
```text
+---------------------------------------------------+
|  [ < ] Thanh toán phòng đặt trước                 |
+===================================================+
|  💳 Chuyển khoản ngân hàng qua mã VietQR          |
|  *Đã tạo 1 payment.*                              |
|                                                   |
|          +-----------------------------+          |
|          |                             |          |
|          |        [ MÃ QR CODE ]       |          |
|          |          (VietQR)           |          |
|          |                             |          |
|          +-----------------------------+          |
|                                                   |
|  Ngân hàng: Vietcombank                           |
|  Số tài khoản: 1023456789                         |
|  Chủ tài khoản: MAI NHUT MINH            |
|  Số tiền: 7.200.000đ                              |
|  Nội dung: HM-101-3NIGHT... (Auto-copy)           |
|                                                   |
|  *Sau khi chuyển khoản, vui lòng bấm nút xác      |
|  nhận bên dưới để hoàn tất đặt phòng. Trang sẽ    |
|  tự động tải lại và cập nhật trạng thái.*         |
|                                                   |
|  +-------------------------------------------+    |
|  |       [ ✅ Xác nhận đã chuyển khoản ]       |    | <- Nút màu xanh lá
|  +-------------------------------------------+    |
+---------------------------------------------------+
```

### 9.7. Giao diện 7: Khi hoàn tất (Đặt phòng có chuyển khoản thành công)
```text
+---------------------------------------------------+
|  [ < ] Đặt phòng                                   |
+===================================================+
|  [✓] Đơn đặt trước của bạn đã thành công và đã    | <- Banner Toast màu xanh lá
|      được tiếp nhận và đang được xử lý            |
|---------------------------------------------------|
|  Xác nhận thông tin đặt phòng                      |
|  [ Vỏ vé khách sạn ] (Vàng)          [ Quay lại ] (Xám)|
|---------------------------------------------------|
|  📍 ĐỊA ĐIỂM: Nhà Trọ Phú Mỹ                |
|---------------------------------------------------|
|  🕒 Thời gian check-in:                            |
|  [ 20-06-2026 14:02                      [📅] ]   |
|  ⌛ Số ngày lưu trú: 3 ngày                        |
|  📅 Ngày check-out dự kiến: 23-06-2026 12:02       |
|---------------------------------------------------|
|  👤 Họ tên: Mai Nhựt Minh (Chỉ đọc)               |
|  📞 SĐT: 0938233763 (Chỉ đọc)                     |
|---------------------------------------------------|
|  🛏️ Chọn phòng: (Đã chọn: 0 phòng)                 |
|                                                   |
|  +---------------------+                          |
|  | Phòng 101 (Bạn đã đặt|                          | <- Phòng đã đặt thành công (màu vàng cam)
|  | Mai Nhựt Minh       |                          |
|  | 0938233763          |                          |
|  +---------------------+                          |
|  [ Phòng 102 (Trống) ]     [ Phòng 103 (Trống) ]  |
|                                                   |
|  📋 Tóm tắt đơn hàng:                             |
|  - Phòng 101 x 3 đêm = 7.200.000đ                 |
|  - Đã thanh toán chuyển khoản: 7.200.000đ          |
+===================================================+
|  0 Phòng | 7.200.000đ   [ Đã hoàn tất đặt phòng ] | <- Nút trạng thái thành công
+---------------------------------------------------+
```
```
## 10. Thiết kế Màn Hình "Mua vé" (Dịch vụ Du lịch)

Giao diện sẽ bám sát logic nghiệp vụ thực tế của Backend và Website, tối ưu hóa cho trải nghiệm di động.

### 10.1. Quy tắc Nghiệp vụ cốt lõi (Khớp Backend & Website)
1. **Thông tin liên hệ**: Không cho phép nhập trực tiếp Họ tên và Số điện thoại tại giao diện mua vé. Thông tin này được lấy tự động từ thông tin người dùng (Profile).
   - Nếu tài khoản đã có đầy đủ Họ tên và Số điện thoại: Hệ thống tự điền vào phần thông tin người đặt dưới dạng chỉ đọc (Read-only).
   - Nếu tài khoản chưa có hoặc thiếu Họ tên/Số điện thoại: Hệ thống sẽ chặn không cho đặt chỗ, hiển thị thông báo yêu cầu người dùng quay lại màn hình Profile để cập nhật, không được phép nhập tại chỗ.
2. **Các loại vé & Đơn giá**:
   - **Vé Người Lớn**: `100.000đ/vé` (Còn lại: 500 vé).
   - **Vé Trẻ Em**: `50.000đ/vé` (Còn lại: 500 vé).
3. **Giới hạn số lượng vé**:
   - Tổng số lượng vé đặt mua trong 1 lần (Số vé người lớn + Số vé trẻ em) tối đa là **50 vé**.
   - Nếu người dùng bấm tăng số lượng vượt quá 50 vé, hệ thống sẽ chặn không cho tăng và hiển thị thông báo cảnh báo: *"Tổng số vé đặt mua tối đa trong một giao dịch là 50 vé"*.
4. **Thời gian sử dụng & Hạn dùng**:
   - Khách hàng chọn ngày sử dụng bằng datetime picker (chỉ được đặt trước tối đa 3 ngày).
   - Hạn sử dụng cố định là `"Trong ngày"` (Chỉ đọc). Vé chỉ có hạn dùng trong ngày đặt mua và hết hạn khi địa điểm đóng cửa.
5. **Hình thức thanh toán**:
   - Bắt buộc thanh toán chuyển khoản trước qua mã **VietQR** (không áp dụng thanh toán sau, "mua gì thanh toán đó qua QR").
6. **Bảng Lưu ý**: Hiển thị bảng lưu ý gồm 4 điều khoản tại màn hình mua vé:
   1/ Vé quý khách mua chỉ có hạn dùng trong ngày đặt mua và hết hạn khi tới giờ đóng cửa.
   2/ Khi đặt vé vui lòng thanh toán trước bằng hình thức chuyển khoản.
   3/ Quý khách có thể đặt trước tối đa 3 ngày.
   4/ Tiền đã thanh toán sẽ không được hoàn lại. Xin lưu ý kĩ.
7. **Nút vé thành công**: Nút xem vé thành công hiển thị nhãn **`[ Vỏ vé du lịch ]`**.

### 10.2. Luồng Hoạt động chi tiết & Kịch bản
#### KỊCH BẢN 1: Mua vé du lịch qua chuyển khoản VietQR (Địa điểm: Bờ Kè Sông Hậu)
- **Bước 1**: User bấm nút **`[ Mua vé ]`** tại trang Chi tiết Địa điểm Bờ Kè Sông Hậu để chuyển sang màn hình Xác nhận thông tin booking. Hệ thống tự điền Họ tên và SĐT chỉ đọc từ Profile. User chọn Ngày sử dụng.
- **Bước 2**: User tăng/giảm số lượng Vé Người Lớn và Vé Trẻ Em bằng nút `[ - ]` và `[ + ]`. Hệ thống tự động tính tổng tiền. Nếu tổng số lượng vé lớn hơn 50, hệ thống chặn không cho tăng thêm.
- **Bước 3**: User bấm **`[ Xác nhận đặt chỗ ]`** (hoặc `[ Thanh toán ]`) ở Fixed Footer.
- **Bước 4**: App thực hiện cuộc gọi API đầu tiên:
  - Gọi API `POST /api/bookings` với body:
    ```json
    {
      "location_id": 2,
      "check_in_date": "2026-06-21T00:00:00.000Z",
      "contact_name": "Mai Nhựt Minh",
      "contact_phone": "0938233763",
      "notes": "Đặt vé tham quan bờ kè",
      "source": "mobile",
      "ticket_items": [
        {"service_id": 201, "quantity": 10},
        {"service_id": 202, "quantity": 5}
      ]
    }
    ```
  - Backend tạo booking du lịch ở trạng thái `pending`, ghi chú đính kèm nhãn `PREPAY_UNCONFIRMED`.
- **Bước 5**: App nhận `bookingId` từ response, tiếp tục gọi API thứ hai:
  - Gọi API `POST /api/bookings/:bookingId/payments` để lấy VietQR payload.
- **Bước 6**: Ứng dụng chuyển sang màn hình thanh toán, hiển thị **Mã QR VietQR** cùng thông tin tài khoản chuyển khoản (Chủ tài khoản: MAI NHUT MINH, Ngân hàng: Vietcombank, Số tiền: 1.250.000đ). Phía dưới hiển thị nút **`[ Xác nhận đã chuyển khoản ]`** (màu xanh lá).
- **Bước 7**: Sau khi chuyển khoản trên ứng dụng ngân hàng, User bấm nút **`[ Xác nhận đã chuyển khoản ]`**:
  - App gọi API xác nhận: `POST /api/bookings/:bookingId/tickets/confirm-transfer`.
  - Backend kiểm tra, cập nhật booking sang trạng thái `completed`, payment sang `completed` và xóa nhãn `PREPAY_UNCONFIRMED`.
- **Bước 8**: App nhận kết quả thành công -> hiển thị Banner Toast xanh lá thành công: *"Đơn đặt trước của bạn đã thành công và đã được tiếp nhận và đang được xử lý"*, đồng thời hiện hai nút điều hướng nhanh: **`[ Vỏ vé du lịch ]`** và **`[ Quay lại ]`**.

### 10.3. Đặc tả API Endpoints Backend Chi Tiết (Du lịch)

#### 1. Lấy danh sách vé/dịch vụ du lịch
- **Endpoint**: `GET /api/services`
- **Query Params**:
  - `location_id`: `number` (Ví dụ: 2 đại diện cho Bờ Kè Sông Hậu)
  - `service_type`: `string` (Cố định là `'ticket'`)
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": 201,
        "location_id": 2,
        "name": "Vé Người Lớn",
        "service_type": "ticket",
        "price": 100000,
        "remaining_quantity": 500,
        "description": "Vé dành cho người lớn từ 1m4 trở lên"
      },
      {
        "id": 202,
        "location_id": 2,
        "name": "Vé Trẻ Em",
        "service_type": "ticket",
        "price": 50000,
        "remaining_quantity": 500,
        "description": "Vé dành cho trẻ em từ 1m đến dưới 1m4"
      }
    ]
  }
  ```

#### 2. Tạo Đơn mua vé du lịch (Booking Ticket)
- **Endpoint**: `POST /api/bookings`
- **Request Body**:
  ```json
  {
    "location_id": 2,
    "check_in_date": "2026-06-21T00:00:00.000Z",
    "contact_name": "Mai Nhựt Minh",
    "contact_phone": "0938233763",
    "notes": "Đặt vé tham quan bờ kè",
    "source": "mobile",
    "ticket_items": [
      { "service_id": 201, "quantity": 10 },
      { "service_id": 202, "quantity": 5 }
    ]
  }
  ```
- **Response (201 Created)**:
  ```json
  {
    "success": true,
    "booking_id": 2450,
    "total_amount": 1250000,
    "payable_amount": 1250000,
    "payment_required": true
  }
  ```

#### 3. Tạo thông tin thanh toán VietQR cho Vé du lịch
- **Endpoint**: `POST /api/bookings/payments`
- **Request Body**:
  ```json
  {
    "booking_id": 2450
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "payment_id": 870,
    "amount": 1250000,
    "qr_content": "00020101021238580010A0000007270128000697042201141030549759520460115303704540712500005802VN5913MAI NHUT MINH6007Can Tho62230519BK-2450-TOURTICKET63045E1B",
    "bank_name": "Vietcombank",
    "account_number": "1030549759",
    "account_name": "MAI NHUT MINH",
    "transfer_content": "BK-2450-TOURTICKET"
  }
  ```

#### 4. Xác nhận chuyển khoản mua vé thành công
- **Endpoint**: `POST /api/bookings/:bookingId/tickets/confirm-transfer`
- **Request Body**:
  ```json
  {
    "payment_id": 870
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Xác nhận chuyển khoản vé thành công. Vé điện tử đã được phát hành."
  }
  ```

### 10.4. Kiến trúc Kết nối & Quản lý UI State Mobile (React Native + TypeScript)

#### 1. Code gọi API qua Axios (`mobile/api/ticketApi.ts`)
```typescript
import axios from 'axios';

const API_BASE_URL = 'https://api.travelcheckin.com';

export interface TicketItem {
  ticket_type: 'adult' | 'child';
  quantity: number;
}

export interface CreateTicketBookingPayload {
  location_id: number;
  check_in_date: string;
  contact_name: string;
  contact_phone: string;
  notes?: string | null;
  source: string;
  ticket_items: Array<{ service_id: number; quantity: number }>;
}

export interface TicketBookingResponse {
  success: boolean;
  booking_id: number;
  total_amount: number;
  payable_amount: number;
  payment_required: boolean;
}

export const ticketApi = {
  // Lấy các loại vé khả dụng
  getTicketTypes: async (locationId: number) => {
    const response = await axios.get(`${API_BASE_URL}/api/services`, {
      params: { location_id: locationId, service_type: 'ticket' }
    });
    return response.data;
  },

  // Tạo đơn mua vé
  createTicketBooking: async (payload: CreateTicketBookingPayload): Promise<TicketBookingResponse> => {
    const response = await axios.post<TicketBookingResponse>(
      `${API_BASE_URL}/api/bookings`, 
      payload
    );
    return response.data;
  },

  // Lấy thông tin VietQR thanh toán vé
  getTicketPaymentQR: async (bookingId: number) => {
    const response = await axios.post(`${API_BASE_URL}/api/bookings/${bookingId}/payments`);
    return response.data;
  },

  // Xác nhận chuyển khoản vé thành công (paymentId chính là bookingId hoặc paymentId trong hệ thống)
  confirmTicketTransfer: async (bookingId: number) => {
    const response = await axios.post(`${API_BASE_URL}/api/bookings/${bookingId}/tickets/confirm-transfer`);
    return response.data;
  }
};
```

#### 2. Logic quản lý State số lượng vé và giới hạn 50 vé
```typescript
import React, { useState, useEffect } from 'react';

const ADULT_TICKET_PRICE = 100000; // 100.000đ
const CHILD_TICKET_PRICE = 50000;  // 50.000đ
const MAX_TOTAL_TICKETS = 50;      // Giới hạn 1 lần mua tối đa 50 vé

export const useTicketCalculator = () => {
  const [adultCount, setAdultCount] = useState<number>(0);
  const [childCount, setChildCount] = useState<number>(0);
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [warningMessage, setWarningMessage] = useState<string>('');

  const updateAdultCount = (newVal: number) => {
    const val = Math.max(0, newVal);
    if (val + childCount > MAX_TOTAL_TICKETS) {
      setWarningMessage(`Tổng số vé đặt mua tối đa trong một giao dịch là ${MAX_TOTAL_TICKETS} vé.`);
      return;
    }
    setWarningMessage('');
    setAdultCount(val);
  };

  const updateChildCount = (newVal: number) => {
    const val = Math.max(0, newVal);
    if (adultCount + val > MAX_TOTAL_TICKETS) {
      setWarningMessage(`Tổng số vé đặt mua tối đa trong một giao dịch là ${MAX_TOTAL_TICKETS} vé.`);
      return;
    }
    setWarningMessage('');
    setChildCount(val);
  };

  useEffect(() => {
    const calculatedTotal = (adultCount * ADULT_TICKET_PRICE) + (childCount * CHILD_TICKET_PRICE);
    setTotalAmount(calculatedTotal);
  }, [adultCount, childCount]);

  return {
    adultCount,
    childCount,
    totalAmount,
    warningMessage,
    updateAdultCount,
    updateChildCount
  };
};
```


## 11. Sơ đồ các Giao diện Mockup chi tiết (Luồng đi từ Du lịch)

### 11.1. Giao diện 1: Khi vừa vào trang (Đầy đủ Profile)
```text
+---------------------------------------------------+
|  [ < ] Đặt chỗ                                     |
+===================================================+
|  Xác nhận thông tin booking                        |
|  [ Vỏ vé du lịch ] (Xanh)        [ Quay lại ] (Xám)|
|---------------------------------------------------|
|  📍 ĐỊA ĐIỂM:                                      |
|  Bờ Kè Sông Hậu                                    |
|  Bờ kè sông Hậu, Trần Văn Khéo, Cái Khế, Cần Thơ...|
|---------------------------------------------------|
|  🕒 Ngày sử dụng:                                   |
|  [ 21-06-2026                            [📅] ]   |
|                                                   |
|  ⌛ Hạn sử dụng:                                   |
|  [ Trong ngày                         ] (Chỉ đọc) |
|---------------------------------------------------|
|  👤 Họ tên người đặt:                              |
|  [ Mai Nhựt Minh                     ] (Chỉ đọc)  |
|  📞 Số điện thoại:                                 |
|  [ 0938233763                        ] (Chỉ đọc)  |
|---------------------------------------------------|
|  🎟️ Vé du lịch:                                    |
|                                                   |
|  🎟️ Vé Người Lớn                                   |
|  100.000đ  •  Còn lại: 500 vé                      |
|  [ - ] 0 [ + ]                                     |
|                                                   |
|  🎟️ Vé Trẻ Em                                     |
|  50.000đ  •  Còn lại: 500 vé                       |
|  [ - ] 0 [ + ]                                     |
|                                                   |
|  *Lưu ý: Tối đa 1 lần mua 50 vé tổng cộng*        |
|---------------------------------------------------|
|  📝 Ghi chú:                                      |
|  [ Nhập ghi chú cho địa điểm...                 ] |
|---------------------------------------------------|
|  ℹ️ Lưu ý:                                         |
|  - 1/ Vé quý khách mua chỉ có hạn dùng trong ngày  |
|     đặt mua và hết hạn khi tới giờ đóng cửa.       |
|  - 2/ Khi đặt vé vui lòng thanh toán trước bằng   |
|     hình thức chuyển khoản.                       |
|  - 3/ Quý khách có thể đặt trước tối đa 3 ngày.   |
|  - 4/ Tiền đã thanh toán sẽ không được hoàn lại.  |
+===================================================+
|  0 Vé | 0đ            [ Vui lòng chọn vé ]        | <- Nút mờ bám đáy
+---------------------------------------------------+
```

### 11.2. Giao diện 2: Khi chọn vé (Ví dụ 10 vé người lớn, 5 vé trẻ em)
```text
+---------------------------------------------------+
|  [ < ] Đặt chỗ                                     |
+===================================================+
|  Xác nhận thông tin booking                        |
|  [ Vỏ vé du lịch ] (Xanh)        [ Quay lại ] (Xám)|
|---------------------------------------------------|
|  📍 ĐỊA ĐIỂM: Bờ Kè Sông Hậu                       |
|---------------------------------------------------|
|  🕒 Ngày sử dụng: 21-06-2026                       |
|  ⌛ Hạn sử dụng: Trong ngày (Chỉ đọc)              |
|---------------------------------------------------|
|  👤 Họ tên: Mai Nhựt Minh (Chỉ đọc)               |
|  📞 SĐT: 0938233763 (Chỉ đọc)                     |
|---------------------------------------------------|
|  🎟️ Vé du lịch:                                    |
|                                                   |
|  🎟️ Vé Người Lớn                                   |
|  100.000đ  •  Còn lại: 500 vé                      |
|  [ - ] 10 [ + ]                                    |
|                                                   |
|  🎟️ Vé Trẻ Em                                     |
|  50.000đ  •  Còn lại: 500 vé                       |
|  [ - ] 5 [ + ]                                     |
|---------------------------------------------------|
|  📝 Ghi chú:                                      |
|  [ Không có                                     ] |
+===================================================+
|  15 Vé | 1.250.000đ      [ Xác nhận đặt chỗ ]      | <- Nút bấm được chuyển sang VietQR
+---------------------------------------------------+
```

### 11.3. Giao diện 3: Cảnh báo khi mua quá 50 vé
```text
+---------------------------------------------------+
|  [ - ] 45 [ + ] (Vé Người Lớn)                     |
|  [ - ] 6  [ + ] (Vé Trẻ Em)                        |
|---------------------------------------------------|
|  ⚠️ Cảnh báo:                                       |
|  Tổng số vé đặt mua tối đa trong một giao dịch    |
|  là 50 vé.                                        |
+===================================================+
|  51 Vé | 4.800.000đ   [ Số vé vượt quá giới hạn ] | <- Nút bị khóa, không bấm được
+---------------------------------------------------+
```

### 11.4. Giao diện 4: Hiện mã QR thanh toán VietQR (Thanh toán 1.250.000đ)
```text
+---------------------------------------------------+
|  [ < ] Thanh toán vé du lịch                       |
+===================================================+
|  💳 Chuyển khoản ngân hàng qua mã VietQR          |
|  *Đã tạo 1 payment.*                              |
|                                                   |
|          +-----------------------------+          |
|          |                             |          |
|          |        [ MÃ QR CODE ]       |          |
|          |          (VietQR)           |          |
|          |                             |          |
|          +-----------------------------+          |
|                                                   |
|  Ngân hàng: Vietcombank                           |
|  Số tài khoản: 1030549759                         |
|  Chủ tài khoản: MAI NHUT MINH                     |
|  Số tiền: 1.250.000đ                              |
|  Nội dung: BK-2450-TOURTICKET                     |
|                                                   |
|  *Sau khi chuyển khoản, vui lòng bấm nút xác      |
|  nhận bên dưới để hoàn tất mua vé. Vé điện tử     |
|  sẽ được hiển thị ngay sau khi xác nhận.*         |
|                                                   |
|  +-------------------------------------------+    |
|  |       [ ✅ Xác nhận đã chuyển khoản ]       |    | <- Nút màu xanh lá
|  +-------------------------------------------+    |
+---------------------------------------------------+
```

### 11.5. Giao diện 5: Khi hoàn tất (Mua vé thành công)
```text
+---------------------------------------------------+
|  [ < ] Đặt chỗ                                     |
+===================================================+
|  [✓] Đơn đặt trước của bạn đã thành công và đã    | <- Banner Toast màu xanh lá
|      được tiếp nhận và đang được xử lý            |
|---------------------------------------------------|
|  Xác nhận thông tin booking                        |
|  [ Vỏ vé du lịch ] (Xanh)        [ Quay lại ] (Xám)|
|---------------------------------------------------|
|  📍 ĐỊA ĐIỂM: Bờ Kè Sông Hậu                       |
|---------------------------------------------------|
|  🕒 Ngày sử dụng: 21-06-2026                       |
|  ⌛ Hạn sử dụng: Trong ngày (Chỉ đọc)              |
|---------------------------------------------------|
|  👤 Họ tên: Mai Nhựt Minh (Chỉ đọc)               |
|  📞 SĐT: 0938233763 (Chỉ đọc)                     |
|---------------------------------------------------|
|  📋 Tóm tắt đơn hàng:                             |
|  - Vé Người Lớn x 10 = 1.000.000đ                 |
|  - Vé Trẻ Em x 5 = 250.000đ                       |
|  - Đã thanh toán chuyển khoản: 1.250.000đ          |
+===================================================+
|  0 Vé | 1.250.000đ    [ Đã hoàn tất đặt chỗ ]     | <- Nút trạng thái thành công
+---------------------------------------------------+

---

## 12. Xác nhận nghiệp vụ QR ngân hàng theo từng Owner (Quan trọng)

Để việc tích hợp cổng thanh toán chuyển khoản qua mã QR VietQR hoạt động ổn định và chính xác trên từng địa điểm:

### 12.1. Cấu hình Cơ sở dữ liệu (Database Schema)
Trong bảng `owner_profiles` thực tế đã được thiết kế sẵn các cột lưu trữ thông tin ngân hàng của chủ kinh doanh:
- `bank_name`: Tên ngân hàng (ví dụ: Vietcombank, Techcombank, MB Bank, v.v.).
- `bank_account`: Số tài khoản ngân hàng để nhận tiền chuyển khoản.
- `account_holder`: Tên chủ tài khoản ngân hàng (viết hoa không dấu).

### 12.2. Quy trình sinh và hiển thị VietQR động
1. **Phía Backend API**: 
   - Khi Mobile gọi các API lấy thông tin thanh toán chuyển khoản (`POST /api/bookings/batch/payments` hoặc `POST /api/bookings/:bookingId/payments`), hệ thống Backend sẽ tự động truy vấn `owner_id` liên kết với địa điểm đặt dịch vụ.
   - Truy vấn thông tin ngân hàng tương ứng của Owner từ bảng `owner_profiles`.
   - Sinh chuỗi VietQR động (`qr_content`) chứa các thông tin: Tên ngân hàng, Số tài khoản, Tên chủ tài khoản, Số tiền cần thanh toán và Nội dung chuyển khoản tự động (ví dụ: `BK-1201-1202-3NIGHT`).
2. **Phía Mobile App**: 
   - **Tuyệt đối không được fix cứng (hardcode)** bất kỳ thông tin tài khoản ngân hàng nào của chủ sở hữu hoặc hệ thống ở client.
   - Giao diện thanh toán của Mobile App phải hiển thị động hoàn toàn dựa trên dữ liệu response trả về từ API (bao gồm: Ngân hàng, Chủ tài khoản, Số tài khoản, Số tiền, Nội dung chuyển khoản).
   - Sử dụng chuỗi `qr_content` nhận từ API để dựng mã QR Code trực quan cho người dùng quét nhanh.

---

## 13. Cơ chế Tự động làm mới Token (Axios Interceptors & Silent Refresh)

Để đảm bảo các giao dịch đặt phòng, đặt bàn hoặc mua vé không bị gián đoạn khi Access Token hết hạn, API Client trên Mobile sẽ sử dụng bộ chặn (Interceptor) của Axios để tự động cấp lại Token mới mà không bắt người dùng đăng nhập lại.

### Cấu hình Module API Client (`mobile/api/apiClient.ts`)
```typescript
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_BASE_URL = 'https://api.travelcheckin.com'; // URL Backend API

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// Interceptor Request: Tự động chèn token vào header
apiClient.interceptors.request.use(
  async (config) => {
    const token = await SecureStore.getItemAsync('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor Response: Xử lý Silent Refresh khi gặp lỗi 401
let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Nếu mã phản hồi là 401 và không phải là request cố gắng lấy token mới
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await SecureStore.getItemAsync('refresh_token');
        if (!refreshToken) throw new Error('No refresh token');

        // Gọi API làm mới token từ Backend
        const response = await axios.post(`${API_BASE_URL}/api/auth/refresh`, {
          refresh_token: refreshToken,
        });

        const { access_token, refresh_token: newRefreshToken } = response.data;

        // Lưu thông tin token mới vào bộ nhớ bảo mật
        await SecureStore.setItemAsync('access_token', access_token);
        if (newRefreshToken) {
          await SecureStore.setItemAsync('refresh_token', newRefreshToken);
        }

        processQueue(null, access_token);
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        
        // Refresh token cũng hết hạn -> Xoá sạch token và điều hướng về trang Đăng nhập
        await SecureStore.deleteItemAsync('access_token');
        await SecureStore.deleteItemAsync('refresh_token');
        
        // Gọi hàm Callback logout / điều hướng trang tại đây (Ví dụ: Expo router.replace('/login'))
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
```

---

## 14. Trải nghiệm Offline & Lưu trữ Cục bộ (Offline Mode & Local Cache)

Nhằm đảm bảo du khách vẫn có thể mở vé điện tử chứa QR Code để quét check-in tại địa điểm khi đi vào vùng mất sóng hoặc kết nối 3G/4G yếu:

### 14.1. Cache dữ liệu vé khi Online (`mobile/services/ticketCache.ts`)
Mỗi lần người dùng tải danh sách vé trực tuyến thành công, ứng dụng sẽ lưu bản sao lưu vào bộ nhớ cục bộ `AsyncStorage`.
```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_TICKETS_CACHE = '@tickets_offline_cache';

export const ticketCache = {
  // Lưu đè danh sách vé mới nhất vào bộ nhớ
  saveTickets: async (tickets: any[]) => {
    try {
      const dataStr = JSON.stringify(tickets);
      await AsyncStorage.setItem(KEY_TICKETS_CACHE, dataStr);
    } catch (err) {
      console.error('Lỗi khi ghi dữ liệu cache vé:', err);
    }
  },

  // Đọc danh sách vé lưu trữ cục bộ
  loadCachedTickets: async (): Promise<any[]> => {
    try {
      const dataStr = await AsyncStorage.getItem(KEY_TICKETS_CACHE);
      return dataStr ? JSON.parse(dataStr) : [];
    } catch (err) {
      console.error('Lỗi khi đọc dữ liệu cache vé:', err);
      return [];
    }
  }
};
```

### 14.2. Xử lý UI/UX trạng thái Offline
- Khi gọi API lấy vé thất bại (do mất kết nối mạng): Hệ thống sẽ hiển thị một biểu tượng thông báo cảnh báo màu vàng cam *"Bạn đang offline. Đang hiển thị vé đã lưu gần nhất"* và tự động gọi `ticketCache.loadCachedTickets()` để hiển thị danh sách vé.

---

## 15. Tối ưu UX thanh toán VietQR (Click to Copy)

Để tránh sai sót khi người dùng nhập thông tin thủ công vào ứng dụng ngân hàng, màn hình hiển thị VietQR sẽ tích hợp tính năng "Một chạm để sao chép" cho các trường thông tin quan trọng.

### 15.1. Triển khai Logic sao chép
```typescript
import * as Clipboard from 'expo-clipboard';
import { Alert } from 'react-native';

export const handleCopyToClipboard = async (text: string, label: string) => {
  if (!text) return;
  await Clipboard.setStringAsync(text);
  Alert.alert('Thành công', `Đã sao chép ${label} vào Clipboard.`);
};
```

### 15.2. Bản vẽ cấu trúc UI (Bổ sung nút Sao chép)
```text
Ngân hàng: Vietcombank                     [ Sao chép ]
Số tài khoản: 1030549759                   [ Sao chép ]
Chủ tài khoản: MAI NHUT MINH               [ Sao chép ]
Số tiền: 1.250.000đ                        [ Sao chép ]
Nội dung: BK-2450-TOURTICKET               [ Sao chép ]
```

---

## 16. Tích hợp Thông báo đẩy (FCM Push Notifications)

Để du khách nhận được thông báo phản hồi từ hệ thống ngay khi Owner duyệt đơn đặt bàn/đặt phòng hoặc khi gần tới giờ đặt chỗ.

### 16.1. Logic Đăng ký Token thiết bị (`mobile/services/notificationService.ts`)
```typescript
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import apiClient from '../api/apiClient';

// Cấu hình cách hiển thị thông báo khi app đang chạy nổi (Foreground)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotificationsAsync() {
  let token;
  
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('Người dùng từ chối cấp quyền thông báo đẩy!');
      return;
    }
    
    // Lấy Expo Push Token
    token = (await Notifications.getExpoPushTokenAsync()).data;
    
    // Gửi token thiết bị lên Backend để lưu trữ
    await apiClient.post('/api/push/register-token', {
      device_token: token,
      device_type: Platform.OS,
    });
  } else {
    console.log('Chỉ kiểm tra được thông báo đẩy trên thiết bị thật');
  }

  return token;
}
```


```
