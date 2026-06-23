# Kế hoạch Triển khai Giai đoạn 3: Bản đồ Tương tác, Marker Ảnh Mobile & Màn Hình Chi Tiết

Tài liệu này chốt lại phạm vi chính thức của **Giai đoạn 3** cho nhánh Mobile User, tập trung vào trải nghiệm `Khám phá` trên bản đồ và `Chi tiết địa điểm`, bám sát chức năng Website nhưng không ôm luôn booking, thanh toán và tiện ích user khác.

## Cập nhật phạm vi chính thức của Giai đoạn 3

Sau khi đối chiếu lại toàn bộ quyền `user` của Website, phạm vi chính thức của **Giai đoạn 3** được chốt như sau:
- Tab `Khám phá` trên Mobile.
- Bản đồ Google native qua `react-native-maps`, GPS, hướng di chuyển/compass, marker ảnh owner và routing.
- Màn hình `Chi tiết địa điểm`.
- Review của user tại địa điểm.
- Nút `Yêu thích` ngay trong chi tiết địa điểm.
- Entry-point cho chat với địa điểm và chat AI ở mức điều hướng từ chi tiết địa điểm.

Các chức năng sau **không còn triển khai chính thức trong Giai đoạn 3**:
- `Giai đoạn 4`: booking, VietQR, wallet vé, table pass, room pass.
- `Giai đoạn 5`: profile, saved locations, checkins, history, booking reminders, vouchers, notifications, SOS.
- `Giai đoạn 6`: AI chat hoàn chỉnh, itineraries, itinerary editor.

Đối chiếu trực tiếp từ Website User:
- `website/src/pages/User/UserMap.tsx`
- `website/src/pages/User/LocationDetail.tsx`
- `website/src/api/locationApi.ts`
- `website/src/api/locationChatApi.ts`
- `website/src/api/userApi.ts`

Lưu ý triển khai:
- Nếu cần gắn nút đi sang booking từ `Chi tiết địa điểm`, chỉ dựng đúng entry-point và navigation contract.
- Không nhúng logic VietQR, wallet, nhắc lịch, itinerary editor, push notification vào phase này.
- Mobile luôn tái sử dụng **backend hiện tại**; không truy cập trực tiếp database `D:\app\My SQL Sever\bin`.

## Quyết định kỹ thuật mới cho Map Mobile

Sau khi kiểm thử thực tế trên Android/Expo Go, Phase 3 chốt hướng map như sau:

- **Không dùng remote image trực tiếp bên trong custom marker của `react-native-maps`**. Trên Android, custom marker sẽ bị native map snapshot thành bitmap, dễ gây lỗi ảnh owner bị cắt nửa, trắng nửa, marker user méo hình hoặc lag khi compass cập nhật.
- **Không dùng overlay tuyệt đối ngoài `<MapView>` cho marker chính**. Cách này làm marker "bay" khi user kéo/zoom bản đồ vì marker không còn thuộc hệ tọa độ native của map.
- **Không chồng OSM/Leaflet và Google Map lên nhau**. Hai lớp map dễ lệch tile, lệch gesture và khó ổn định hơn trong app mobile.
- **Nền bản đồ chính thức của Mobile Phase 3 là Google native qua `react-native-maps`** để GPS, pan/zoom, marker và polyline bám tọa độ ổn định.
- **Ảnh owner vẫn phải hiển thị trên map**, nhưng mobile phải xử lý theo hướng:
  - lấy `first_image` hoặc `images[0]` từ response backend;
  - chuẩn hóa URL bằng `resolveBackendUrl`;
  - tải ảnh về cache local bằng `expo-file-system`;
  - crop/resize thành thumbnail vuông bằng `expo-image-manipulator`;
  - dùng ảnh local đã chuẩn hóa cho marker, không dùng URL remote trực tiếp.
- Nếu địa điểm không có ảnh hoặc ảnh tải lỗi, marker dùng fallback local theo `location_type` bằng màu/label đơn giản; backend không cần thay đổi.
- User marker phải nằm trong `Marker` native để bám tọa độ, sử dụng GPS từ `expo-location`; hướng xoay lấy từ `watchHeadingAsync` hoặc `coords.heading`, có low-pass smoothing để giảm giật.
- Backend và database giữ nguyên. Toàn bộ thay đổi xử lý ảnh marker, GPS marker và fallback marker chỉ nằm trong thư mục `mobile/`.

## Quy tắc bắt buộc cho Giai đoạn 3

- Tất cả màn hình map, routing và location detail phải xử lý `SafeArea` tuyệt đối cho:
  - header nổi,
  - nút back,
  - nút định vị,
  - bottom sheet tóm tắt,
  - CTA đáy trong location detail.
- Không để marker action, chat bubble, nút chỉ đường hoặc nút xem chi tiết bị che bởi notch / home indicator.
- Điều hướng `explore -> location detail -> booking/chat` phải rõ ràng, không có nút chết và không có màn trung gian mơ hồ.
- Khi user rời mode chỉ đường hoặc rời detail về map, trạng thái điều hướng phải nhất quán, không giữ stack lặp gây back nhiều tầng khó chịu.

## Thuật ngữ Kỹ thuật và Khái niệm Phát triển

1. **UI Shell**
   - Là phần khung giao diện có mock data để khóa layout, thứ tự khối và hành vi chạm trước khi nối API thật.
2. **API Client**
   - Là lớp trung gian gọi Backend API bằng `axios`, tái dùng contract từ web càng nhiều càng tốt.
3. **Hooks / Store**
   - Là nơi xử lý logic nền như GPS, compass, routing, marker state, review state, favorite state.
4. **Navigation Contract**
   - Là quy ước param, route, payload khi đi giữa `explore -> location detail -> phase khác`.

---

## 1. Bản vẽ Giao diện Bản đồ theo Luồng Trải nghiệm

### TRẠNG THÁI 1: BẢN ĐỒ MẶC ĐỊNH
```text
+---------------------------------------------------+
|  [Thanh Tìm Kiếm Địa Điểm...]                 [🔍] |
+---------------------------------------------------+
|                                                   |
|  [📍 User] (Mũi tên xoay)                          |
|                        [🖼️ Cafe Trung Nguyên]      |
|                                            [ ⌖ ]  |
+---------------------------------------------------+
```

### TRẠNG THÁI 2: KHI BẤM VÀO ĐỊA ĐIỂM CỦA OWNER
```text
+===================================================+
|  -----------------------------------------------  |
|  ☕ Cafe Trung Nguyên                              |
|  ⭐ 4.0 (1 đánh giá) | 📍 Trần Chiên, Cái Răng     |
|                                                   |
|  [ 🔀 Chỉ đường ]      [ ℹ️ Xem chi tiết ]         |
|  [ ❤️ Yêu thích ]                                  |
+---------------------------------------------------+
```

### TRẠNG THÁI 3: KHI BẤM "CHỈ ĐƯỜNG" TRỰC TIẾP TỪ BẢN ĐỒ
```text
+---------------------------------------------------+
|  [ < Trở lại ]                                    |
+---------------------------------------------------+
|  [📍 User]                                        |
|       \==== (Đường màu Teal bo theo đường đi)     |
|            \====\                                 |
|                  [🎯 Cafe Trung Nguyên]           |
+===================================================+
|  -----------------------------------------------  |
|  🚗 Đi từ vị trí của bạn -> Cafe Trung Nguyên      |
|  Khoảng cách: 1.2 km | Thời gian: 4 phút         |
|  [ ❌ Huỷ chỉ đường ]                              |
+---------------------------------------------------+
```

---

## 2. Cài đặt Thư viện & Công cụ

Đứng tại thư mục `mobile`, triển khai các thư viện sau:

1. **Bản đồ**: `npx expo install react-native-maps`
2. **Định vị**: `npx expo install expo-location`
3. **La bàn**: `npx expo install expo-sensors`
4. **Safe area**: `npx expo install react-native-safe-area-context`
5. **Toán học / khoảng cách**: `npm install @turf/helpers @turf/distance @turf/bbox`
6. **Polyline decode**: `npm install @mapbox/polyline`
7. **Range Slider đánh giá**: `npx expo install @react-native-community/slider`
8. **Cache ảnh marker**: `npx expo install expo-file-system expo-image-manipulator`
9. **State + API**: tái dùng `zustand`, `axios` từ stack hiện tại

### Đánh giá công nghệ cho Phase 3

- **Expo Router + React Native + TypeScript**: ổn, hợp với hướng chia màn hình theo flow của web.
- **Zustand**: ổn cho location state, filters, selected marker, review draft; không cần nâng lên giải pháp nặng hơn.
- **react-native-maps + Google native**: là hướng chính thức cho Mobile Phase 3 để giữ GPS, marker và polyline bám tọa độ ổn định trên Android/Expo Go.
- **Marker ảnh owner**: không render remote image trực tiếp trong marker. Bắt buộc đi qua cache local + resize/crop thumbnail trước khi gắn vào marker.
- **WebView/Leaflet từ website**: chỉ là phương án dự phòng nếu sau này cần tái tạo 100% trải nghiệm map website. Không dùng cho Phase 3 MVP vì phải xử lý auth, token, GPS bridge và responsive embed riêng.
- **Routing qua backend/OSRM**: mobile ưu tiên gọi backend route proxy để lấy đường đi, backend mới quyết định dùng OSRM upstream hoặc fallback. Không để mobile phụ thuộc trực tiếp vào dịch vụ OSRM bên ngoài khi đã có backend tái sử dụng.
- **Weather API**: nên đi qua backend giống định hướng ở `giai-doan-2-home.md`, ưu tiên `Open-Meteo` hoặc một provider miễn phí ổn định. Không nên để mobile tự ôm thêm key/API rời.

---

## 3. Lộ trình triển khai Chi tiết

Để Giai đoạn 3 gọn, dễ test và bám đúng chức năng website, quá trình triển khai được chia thành 4 phân hệ nhỏ.

### 3.1. Phân hệ 1: Nền tảng Bản đồ, Định vị GPS và La bàn
- **Độ ưu tiên:** 1
- **Độ khó:** Rất cao

#### Code ở đâu?
- `mobile/app/(app)/(tabs)/explore.tsx`
- `mobile/src/modules/location-permission/store.ts`
- `mobile/src/hooks/useCompass.ts` hoặc hook heading riêng dùng `expo-location`
- `mobile/src/components/map/UserHeadingMarker.tsx`

#### Hướng xử lý chi tiết
- Dùng `<MapView provider={PROVIDER_DEFAULT}>` với nền Google native trên Android/Expo Go.
- Không dùng `<UrlTile>` OSM trong Phase 3 MVP để tránh rủi ro tile bị chặn/rate-limit và tránh lệch khi phối hợp với native marker.
- Xin quyền `FOREGROUND_LOCATION` ngay khi vào tab `Khám phá`.
- Nếu user từ chối quyền vị trí thì vẫn cho xem map và marker, chỉ khóa nút định vị / routing theo vị trí thật.
- User marker:
  - lấy vị trí bằng `Location.watchPositionAsync`;
  - lấy hướng bằng `Location.watchHeadingAsync`;
  - fallback sang `coords.heading` khi thiết bị không trả heading ổn định;
  - dùng low-pass smoothing để tránh mũi tên rung;
  - marker phải là child của `<Marker>` native, không dùng overlay ngoài map.
- Nếu mũi tên định hướng gây lỗi trên một số máy Expo Go, giữ chấm vị trí native/local đơn giản trước, không để phần compass làm hỏng toàn bộ map.

### 3.2. Phân hệ 2: Render Địa điểm của Owner (Markers Ảnh Local Cache)
- **Độ ưu tiên:** 2
- **Độ khó:** Trung bình

#### Code ở đâu?
- `mobile/src/services/location.api.ts`
- `mobile/src/modules/locations/use-locations.ts`
- `mobile/src/modules/map/marker-image-cache.ts`
- `mobile/src/components/map/OwnerCachedMarker.tsx`
- `mobile/src/components/map/BottomSheetSummary.tsx`

#### Hướng xử lý chi tiết
- Gọi đúng endpoint `GET /api/locations`.
- Tái sử dụng shape dữ liệu location từ web, tránh tạo DTO mobile lệch tên field nếu không thật sự cần.
- Ảnh marker lấy theo thứ tự:
  1. `location.first_image`
  2. `location.images?.[0]`
  3. fallback marker local theo `location_type`
- Không truyền URL remote trực tiếp vào custom marker.
- Mobile tạo cache key theo `location_id + image_url` để khi owner đổi ảnh thì app tự tải lại.
- Ảnh sau khi tải về phải được crop/resize thành thumbnail nhỏ, ví dụ `72x72` hoặc `96x96`, rồi dùng URI local cho marker.
- Marker cần `React.memo()` và hạn chế `tracksViewChanges`; chỉ bật khi ảnh vừa tải/chưa ổn định, sau đó tắt để giảm lag Android.
- Bottom sheet tóm tắt vẫn hiển thị ảnh lớn từ backend hoặc ảnh cache local, có 3 hành động ngắn: `Chỉ đường`, `Xem chi tiết`, `Yêu thích`.

### 3.3. Phân hệ 3: Màn hình Chi tiết Địa điểm (Đồng bộ Web)
- **Độ ưu tiên:** 3
- **Độ khó:** Cao

#### Code ở đâu?
- `mobile/app/location/[id].tsx`
- `mobile/components/Location/ImageCarousel.tsx`
- `mobile/components/Location/WeatherBlock.tsx`
- `mobile/components/Location/DraggableChat.tsx`
- `mobile/components/Location/ReviewSection.tsx`

#### Hướng xử lý chi tiết
- Layout bám web: ảnh cover lớn, info block nổi lên, tab con `Tổng quan / Đánh giá / Giới thiệu`.
- Phần thời tiết hiển thị như một khối hỗ trợ cho địa điểm, dữ liệu nên đi từ backend.
- Nút `Yêu thích` phải nối thẳng vào cùng API / state với Website để favorite đồng bộ hai bên.
- Chat Owner và Chat AI ở phase này chỉ là **điểm vào**:
  - Owner: điều hướng sang luồng chat địa điểm khi backend/mobile screen sẵn sàng.
  - AI: điều hướng sang màn hình AI chat của phase 6 hoặc hiển thị trạng thái `Sắp mở`.
- Không đưa voucher workflow, wallet, booking payment vào màn hình này trong phase 3.

### 3.4. Phân hệ 4: Tìm đường và Vẽ Polyline (Routing)
- **Độ ưu tiên:** 4
- **Độ khó:** Rất cao

#### Code ở đâu?
- `mobile/src/services/osrm.api.ts`
- `mobile/src/components/map/RoutePolyline.tsx`

#### Hướng xử lý chi tiết
- Backend route proxy / OSRM trả về theo chuẩn `[longitude, latitude]` hoặc GeoJSON, cần chuyển về `{ latitude, longitude }` cho React Native Maps tại đúng một lớp service.
- Polyline dùng `strokeWidth={5}` trở lên, `lineCap="round"`, `lineJoin="round"`.
- Chỉ fetch lại route khi user lệch đáng kể khỏi vị trí bắt đầu, ví dụ trên `15m`, để tránh GPS drift gây spam request.
- Khi vào mode routing, UI phải có trạng thái thoát rõ ràng: `Huỷ chỉ đường`.

---

## 4. Rủi ro & Cấp độ khó

- **Cấp độ khó tổng thể**: 5/5
- **Rủi ro lớn nhất**:
  - Custom marker có ảnh remote trực tiếp bị Android snapshot lỗi.
  - Marker ảnh nhiều gây lag nếu không cache/resize/tắt `tracksViewChanges`.
  - Compass rung, xoay sai hướng hoặc không có heading trên một số máy.
  - Polyline sai hệ tọa độ.
  - Layout detail bị che bởi notch / bottom inset.
  - Location detail bị phình phạm vi do cố nhét booking và tiện ích phase sau.

### 4.1. Giải pháp kỹ thuật phòng ngừa

#### 1. Khắc phục giật lag Bản đồ
- Cache và resize ảnh marker ở mobile trước khi render.
- Không dùng remote image trực tiếp trong marker.
- Memo marker.
- Tách compass animation khỏi state cha.
- Chỉ render marker trong vùng cần thiết nếu số lượng địa điểm tăng mạnh.
- Không render các khối detail nặng ngay trên tab map.

#### 2. Khắc phục đơ la bàn hoặc xoay sai hướng
- Dùng low-pass filter.
- Cleanup sensor listeners đúng vòng đời tab.
- Ưu tiên trải nghiệm ổn định hơn tần số update quá cao.
- Có fallback: nếu heading không ổn định, hiển thị chấm vị trí user hoặc mũi tên cố định theo hướng di chuyển gần nhất, không làm marker biến mất.

#### 3. Khắc phục route sai lệch
- Chuẩn hóa transform toạ độ ở đúng một chỗ.
- Log và test tuyến ngắn, tuyến dài, tuyến lệch nhiều trước khi mở rộng.

#### 4. Xử lý notch và bottom action
- Dùng `SafeAreaProvider` ở root.
- Dùng `useSafeAreaInsets()` cho header, chat nổi, bottom action.
- Không bọc cứng toàn màn hình detail bằng `<SafeAreaView>` nếu muốn cover tràn đẹp.

#### 5. Thống nhất font và hiển thị tiếng Việt
- Dùng font hệ thống mặc định.
- Không hardcode font lạ trong phase này.

---

## 5. Thiết kế Màn Hình "Xem Chi Tiết Địa Điểm" (Location Detail)

Giao diện bám website nhưng tối ưu cho mobile. Màn hình chia theo tab con để không quá dài và để user tìm đúng hành động nhanh hơn.

**Đường dẫn**: `mobile/app/location/[id].tsx`

### Giao diện Tổng thể (Tab: Tổng quan)

```text
+---------------------------------------------------+
|  < Trở về                     (Header trong suốt) |
|===================================================|
|                [ ẢNH COVER LỚN ]                  |
+---------------------------------------------------+
| [Khối trắng bo góc nổi lên trên ảnh cover]        |
|                                                   |
|  Cafe Trung Nguyên                                |
|  4.0 ⭐⭐⭐⭐☆   1 đánh giá                           |
|  [ NHÀ HÀNG ]                                     |
|                                                   |
|  [Tổng quan] [Bài đánh giá] [Giới thiệu]          |
|                                                   |
|  [ 🔀 Chỉ đường ] [ ❤️ Lưu ] [ 🔗 Chia sẻ ]       |
|                                                   |
|  Giới thiệu nhanh: Quán cafe lâu đời...           |
|---------------------------------------------------|
|  📍 Địa chỉ: Trần Chiên, Cái Răng...              |
|  🟢 Trạng thái: Đang hoạt động                    |
|  🕒 Giờ mở cửa: Chưa cập nhật                     |
|  📞 Điện thoại: 0869378422                        |
|  ✉️ Email: memory3367@gmail.com                   |
|                                                   |
|===================================================|
|  [ THỜI TIẾT ĐỊA ĐIỂM ]                           |
|  32°C | Nhiều mây                                 |
|                                                   |
|                                            (💬)   |
|                                            (🤖)   |
+===================================================+
|             [ Xem dịch vụ tại địa điểm ]          |
+---------------------------------------------------+
```

### Giao diện khi bấm sang Tab: "Bài đánh giá"

```text
+---------------------------------------------------+
|  [Tổng quan] [Bài đánh giá] (Active) [Giới thiệu] |
|---------------------------------------------------|
|  Lọc theo Sao: 3 -> 5                             |
|  1---2---3======4======5                          |
|                                                   |
|  Viết đánh giá                            1-5 sao |
|  [ ⭐ ⭐ ⭐ ⭐ ⭐ ]                               |
|  +---------------------------------------------+  |
|  | Chia sẻ trải nghiệm của bạn...              |  |
|  | [Thêm ảnh]                                  |  |
|  +---------------------------------------------+  |
|  [ Gửi đánh giá ]                                 |
|---------------------------------------------------|
|  Nhựt Minh                                  4 sao |
|  20:52 12/06/2026                                 |
|  nước tạm ổn                                      |
+---------------------------------------------------+
```

### Cách triển khai Code

- Dùng `ScrollView` hoặc `FlashList` theo khối để layout mượt hơn.
- `Tổng quan` tập trung vào thông tin địa điểm, ảnh, thời tiết, action nhanh.
- `Bài đánh giá` dùng state lọc sao + form viết review + danh sách review cũ.
- Nút chat nổi:
  - Phase 3 chỉ cần dựng component nổi, kéo thả được, auto-snap đẹp.
  - Hành vi bấm nút ưu tiên điều hướng thay vì nhúng full modal chat production vào đây.
- Bottom action nên là nút trung tính kiểu `Xem dịch vụ tại địa điểm` hoặc `Xem lựa chọn đặt chỗ`, tránh chốt cứng một luồng booking duy nhất trong phase 3.

---

## 6. Các nội dung đã tách khỏi Giai đoạn 3

Để tránh file phase 3 phình quá mức và làm lệch thứ tự triển khai, các nội dung sau đã được chuyển sang file riêng:

1. **Booking, VietQR, ticket wallet, table pass, room pass**
   - Xem `docs/Kế Hoạch mobile/giai-doan-4-booking-thanh-toan-va-vi-dien-tu.md`
2. **Profile, saved locations, checkins, history, reminders, vouchers, notifications, SOS**
   - Xem `docs/Kế Hoạch mobile/giai-doan-5-tien-ich-user-ho-so-va-an-toan.md`
3. **AI chat hoàn chỉnh, itinerary list, itinerary editor**
   - Xem `docs/Kế Hoạch mobile/giai-doan-6-ai-chat-va-lich-trinh.md`

### Definition of Done cho Giai đoạn 3

- Tab `Khám phá` chạy ổn với Google native map, GPS, compass/heading và polyline.
- Marker địa điểm owner hiển thị đúng tọa độ, bấm được, có ảnh local cache khi backend có ảnh.
- Địa điểm không có ảnh phải có fallback marker local rõ ràng, không để marker trắng/vỡ.
- User marker bám đúng vị trí; mũi tên định hướng có fallback ổn định nếu thiết bị không trả heading tốt.
- `Location Detail` bám đúng cấu trúc website user.
- Review list + review submit flow được nối backend hoặc ít nhất khóa UI shell đúng contract.
- Favorite tại location detail đồng bộ được với backend hiện tại.
- Routing từ user tới location chạy ổn trong điều kiện máy thật cơ bản.
- Không còn lẫn booking/payment/push/token refresh vào file phase 3.
