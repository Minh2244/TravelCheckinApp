# Giai đoạn 6: AI Chat, Chat với địa điểm & Lịch trình cá nhân

Tài liệu này tách riêng cụm tính năng thông minh của User. Đây là phase biến Mobile thành trợ lý du lịch thực thụ, dùng lại backend AI và itinerary hiện có của Website thay vì xây một stack riêng.

## 1. Phạm vi chính thức

Giai đoạn 6 bao phủ các chức năng Website User sau:
- `website/src/pages/User/AiChat.tsx`
- `website/src/components/LocationChatBubble.tsx`
- `website/src/pages/User/Itineraries.tsx`
- `website/src/pages/User/ItineraryEditor.tsx`
- API liên quan trong:
  - `website/src/api/aiApi.ts`
  - `website/src/api/locationChatApi.ts`
  - `website/src/api/userApi.ts` (nhóm itinerary)

Không thuộc Giai đoạn 6:
- Map / detail cơ bản
- Booking / payment
- Profile / voucher / SOS / saved

## 1.1. Quy tắc bắt buộc cho Giai đoạn 6

- Mọi màn AI chat, location chat, itinerary list và itinerary editor phải xử lý `SafeArea` tuyệt đối cho header, nút back, composer chat, nút gửi, CTA lưu lịch trình và action bar đáy.
- Ô nhập chat không được đụng keyboard hoặc home indicator; phải kết hợp keyboard handling với `insets.bottom`.
- Điều hướng từ location detail / booking sang location chat, và từ AI chat sang tạo itinerary phải rõ ràng, không có nút “Sắp mở” kiểu chết luồng.
- Sau khi lưu itinerary thành công hoặc gửi hành động AI tạo lịch trình xong, route phải quay về đúng màn mong muốn bằng điều hướng an toàn, không để stack lặp nhiều tầng.

## 2. Đối chiếu chức năng Website -> Mobile

| Chức năng | Nguồn Website | Màn hình Mobile dự kiến |
|---|---|---|
| Chat AI | `AiChat.tsx`, `UserLayout.tsx` | `mobile/app/ai/chat.tsx` hoặc AI bubble toàn cục |
| Chat với địa điểm | `LocationChatBubble.tsx`, `LocationDetail.tsx`, `BookingPage.tsx` | `mobile/app/chat/location/[locationId].tsx` hoặc bottom sheet chat |
| Danh sách lịch trình | `Itineraries.tsx` | `mobile/app/itinerary/index.tsx` |
| Tạo mới lịch trình | `ItineraryEditor.tsx` | `mobile/app/itinerary/create.tsx` |
| Sửa lịch trình | `ItineraryEditor.tsx` | `mobile/app/itinerary/[id].tsx` |

## 3. Bản vẽ giao diện theo luồng

### 3.1. Chat AI
```text
+---------------------------------------------------+
|  [ < ] Trợ lý AI                                  |
+===================================================+
|  AI: Tôi có thể giúp bạn lên lịch trình du lịch   |
|      hoặc gợi ý địa điểm theo sở thích.           |
|---------------------------------------------------|
|  User: Lên lịch trình Cần Thơ 2 ngày              |
|---------------------------------------------------|
|  AI: Tôi đề xuất ngày 1 đi Ninh Kiều...           |
|      [ Lưu thành lịch trình ]                     |
+===================================================+
|  [ Nhập câu hỏi...                         ] [ Gửi]|
+---------------------------------------------------+
```

### 3.2. Danh sách lịch trình
```text
+---------------------------------------------------+
|  Lịch trình của tôi                               |
+===================================================+
|  [ Cần Thơ 2 ngày ]                               |
|  21-06-2026 -> 22-06-2026                         |
|  5 điểm dừng                                      |
|  [ Xem chi tiết ]                                 |
|---------------------------------------------------|
|  [ Đà Lạt 3 ngày ]                                |
|  01-07-2026 -> 03-07-2026                         |
|  8 điểm dừng                                      |
|  [ Xem chi tiết ]                                 |
+===================================================+
|  [ + Tạo lịch trình mới ]                         |
+---------------------------------------------------+
```

### 3.3. Chat với địa điểm
```text
+---------------------------------------------------+
|  [ < ] Chat với địa điểm                          |
+===================================================+
|  Chủ quán: Xin chào, mình có thể hỗ trợ gì?       |
|---------------------------------------------------|
|  User: Cho mình hỏi còn bàn tối nay không?        |
|---------------------------------------------------|
|  Chủ quán: Hiện còn 3 bàn trống từ 19:00.         |
+===================================================+
|  [ Nhập tin nhắn...                        ] [ Gửi]|
+---------------------------------------------------+
```

### 3.4. Màn hình chỉnh sửa lịch trình
```text
+---------------------------------------------------+
|  [ < ] Chỉnh sửa lịch trình                       |
+===================================================+
|  Tên lịch trình: [ Cần Thơ 2 ngày ]              |
|  Từ ngày:       [ 21-06-2026 ]                    |
|  Đến ngày:      [ 22-06-2026 ]                    |
|---------------------------------------------------|
|  Ngày 1                                             |
|  08:00 - Bến Ninh Kiều                            |
|  11:00 - Chợ nổi Cái Răng                         |
|  [ + Thêm điểm dừng ]                             |
|---------------------------------------------------|
|  Ngày 2                                             |
|  09:00 - Bờ Kè Sông Hậu                           |
+===================================================+
|  [ Lưu thay đổi ]                                 |
+---------------------------------------------------+
```

## 4. Tái sử dụng Backend API và Database

### 4.1. API phải tái sử dụng

- `POST /api/ai/chat`
- `GET /api/ai/history`
- `GET /api/chat/location/:locationId`
- `POST /api/chat/location/:locationId`
- `GET /api/chat/location/:locationId/sessions`
- `GET /api/user/itineraries`
- `GET /api/user/itineraries/:itineraryId`
- `POST /api/user/itineraries`
- `PUT /api/user/itineraries/:itineraryId`
- `DELETE /api/user/itineraries/:itineraryId`
- `PATCH /api/user/itineraries/:itineraryId/items/:itemId/visit`

### 4.2. Bảng dữ liệu liên quan

- `ai_chat_history`
- `location_chat_messages`
- `itineraries`
- `itinerary_items`
- `locations`
- Có thể tham chiếu thêm `checkins`, `favorites`, `bookings` cho phase nâng cấp sau

## 5. Lộ trình triển khai chia phân hệ

### 5.1. Phân hệ 1: Chat AI cơ bản
- **Độ ưu tiên:** Ưu tiên Số 1
- **Độ khó:** 🔥🔥🔥

#### Code ở đâu?
- `mobile/app/ai/chat.tsx`
- `mobile/api/aiApi.ts`
- `mobile/hooks/useAiChat.ts`

#### Việc phải làm:
- Hiển thị lịch sử chat.
- Gửi prompt mới.
- Render câu trả lời dạng hội thoại.
- Cho deep-action `Lưu thành lịch trình` khi AI trả về gợi ý có cấu trúc.
- Hỗ trợ cả entry qua màn riêng lẫn AI bubble toàn cục giống `UserLayout.tsx` của Website.

### 5.2. Phân hệ 2: Chat với địa điểm
- **Độ ưu tiên:** Ưu tiên Số 2
- **Độ khó:** 🔥🔥🔥

#### Code ở đâu?
- `mobile/app/chat/location/[locationId].tsx`
- `mobile/api/locationChatApi.ts`
- `mobile/hooks/useLocationChat.ts`

#### Việc phải làm:
- Lấy lịch sử chat theo `locationId`.
- Gửi tin nhắn mới đúng contract backend hiện có.
- Hỗ trợ mở chat từ `location detail` và từ `booking`.
- Nếu mobile dùng socket / realtime thì phải bám chung room naming với backend/web hiện tại.

### 5.3. Phân hệ 3: Danh sách itinerary
- **Độ ưu tiên:** Ưu tiên Số 2
- **Độ khó:** 🔥🔥

#### Code ở đâu?
- `mobile/app/itinerary/index.tsx`
- `mobile/api/itineraryApi.ts`

#### Việc phải làm:
- List itinerary của user.
- Xóa itinerary.
- Điều hướng sang tạo mới hoặc chỉnh sửa.

### 5.4. Phân hệ 4: Itinerary editor
- **Độ ưu tiên:** Ưu tiên Số 3
- **Độ khó:** 🔥🔥🔥🔥

#### Code ở đâu?
- `mobile/app/itinerary/create.tsx`
- `mobile/app/itinerary/[id].tsx`
- `mobile/components/itinerary/*`

#### Việc phải làm:
- Tạo và sửa itinerary.
- Quản lý item theo ngày.
- Thêm / xóa / cập nhật điểm dừng.
- Đánh dấu đã đi qua từng item.

### 5.5. Phân hệ 5: Nâng cấp thông minh sau MVP
- **Độ ưu tiên:** Ưu tiên Số 4
- **Độ khó:** 🔥🔥🔥🔥🔥

#### Việc phải làm:
- Gợi ý itinerary dựa trên favorites, check-ins, bookings.
- Hiển thị quãng đường và thời gian dự kiến giữa các điểm.
- Tích hợp điều hướng quay lại map hoặc location detail.
- Gắn thời tiết và thời gian mở cửa vào từng ngày nếu backend đã hỗ trợ đủ.

## 6. Tiêu chí nghiệm thu

1. User chat với AI được trên Mobile bằng đúng backend hiện tại.
2. User xem được lịch sử chat AI.
3. User chat được với địa điểm từ `location detail` và `booking` giống Website.
4. User tạo, sửa, xóa itinerary giống Website.
5. User đánh dấu item đã đi thành công.
6. Không tách AI/chat ra service riêng; vẫn dùng backend dự án làm trục.

## 7. Rủi ro và phụ thuộc

- Chất lượng trải nghiệm AI phụ thuộc vào format response backend hiện tại.
- Nếu itinerary editor quá phức tạp ngay từ đầu, nên ship MVP trước rồi mới nâng cấp planner thông minh.
- Phase này phụ thuộc dữ liệu địa điểm của Giai đoạn 3 để picker location hoạt động mượt.
