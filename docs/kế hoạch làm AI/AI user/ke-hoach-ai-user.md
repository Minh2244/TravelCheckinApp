# Kế hoạch AI hỗ trợ User bằng Gemini API

**Cập nhật:** 2026-06-25
**Phạm vi:** Website và Mobile dùng chung Backend Node.js
**Hướng triển khai:** Gemini API tư vấn bằng ngôn ngữ tự nhiên, Backend cung cấp địa điểm thật từ database
**Độ khó tổng thể:** Trung bình, khoảng 5/10

---

## 1. Mục tiêu

Xây dựng một trợ lý AI hỗ trợ người dùng:

- Hỏi đáp về du lịch, ăn uống, lưu trú và tham quan.
- Gợi ý địa điểm phù hợp với nhu cầu.
- Giải thích ngắn gọn vì sao địa điểm phù hợp.
- Hiển thị địa điểm được gợi ý thành thẻ có ảnh và thông tin thật.
- Cho phép user mở trang chi tiết địa điểm.
- Cho phép user mở bản đồ và chỉ đường.
- Cho phép user lưu địa điểm yêu thích.
- Lưu lịch sử trò chuyện để dùng lại trên Website và Mobile.

AI không thay thế chức năng tìm kiếm, bản đồ hoặc database. AI đóng vai trò hiểu câu hỏi và viết lời tư vấn dễ đọc.

---

## 2. Phạm vi phiên bản chính

### 2.1. Chức năng thực hiện

User có thể hỏi:

```text
Ở Cần Thơ có quán cà phê nào phù hợp để ngồi làm việc?
```

```text
Tôi muốn tìm khách sạn gần trung tâm, giá vừa phải.
```

```text
Cuối tuần nên đi đâu chơi ở Cần Thơ?
```

```text
Tìm giúp tôi nơi ăn uống được đánh giá tốt.
```

Hệ thống trả:

1. Lời tư vấn bằng ngôn ngữ tự nhiên từ Gemini.
2. Một hoặc nhiều thẻ địa điểm thật từ database.
3. Các hành động:
   - Xem chi tiết.
   - Chỉ đường.
   - Lưu địa điểm.

### 2.2. Không thực hiện trong phiên bản này

- Không cho AI tự tạo itinerary hoàn chỉnh.
- Không yêu cầu AI tạo JSON lịch trình nhiều ngày.
- Không tối ưu thứ tự di chuyển.
- Không tính thời gian đi lại bằng AI.
- Không tự tạo hoặc tự lưu lịch trình.
- Không tự tạo địa điểm mới.
- Không dùng OSM để tự động bổ sung địa điểm trong phiên bản đầu.
- Không cá nhân hóa sâu bằng toàn bộ lịch sử booking.
- Không cho AI tự đưa ra giá, giờ mở cửa hoặc khoảng cách nếu Backend không có dữ liệu.

Các chức năng itinerary thủ công hiện có vẫn giữ nguyên và hoạt động độc lập với AI.

---

## 3. Vì sao dùng Gemini API

Gemini phù hợp hơn mô hình tự huấn luyện cho AI User vì cần:

- Hiểu nhiều cách diễn đạt tiếng Việt.
- Trò chuyện tự nhiên.
- Hiểu câu hỏi có ngữ cảnh.
- Viết lời giải thích dễ đọc.
- Trả lời các câu hỏi mở về du lịch.
- Không cần tự xây dataset hội thoại rất lớn.

Phần quan trọng vẫn do dự án kiểm soát:

- Backend tìm địa điểm.
- Backend xác minh địa điểm.
- Backend cung cấp ảnh, địa chỉ, rating và thông tin dịch vụ.
- Frontend tạo đường dẫn.
- Backend quản lý quyền và lịch sử.

Gemini không được tự tạo `location_id`, ảnh, địa chỉ hoặc URL.

---

## 4. Kiến trúc

```text
Website / Mobile
       |
       v
POST /api/ai/chat
       |
       v
Backend Node.js
  |-- Kiểm tra đăng nhập
  |-- Kiểm tra AI feature flag
  |-- Phân tích từ khóa tìm kiếm
  |-- Truy vấn địa điểm thật trong MySQL
  |-- Gửi danh sách ứng viên cho Gemini
  |-- Xác minh ID Gemini lựa chọn
  |-- Lưu lịch sử chat
       |
       +--> MySQL
       +--> Gemini API
```

### Nguyên tắc

1. Database là nguồn dữ liệu chính.
2. Backend tìm danh sách địa điểm trước khi gọi Gemini.
3. Gemini chỉ được chọn từ danh sách Backend cung cấp.
4. Backend xác minh lại mọi ID trước khi trả về Frontend.
5. Frontend gọi dữ liệu địa điểm thật để dựng card.
6. Nếu Gemini lỗi, Backend vẫn có thể trả kết quả tìm kiếm cơ bản.

---

## 5. Luồng hoạt động

### 5.1. User hỏi về địa điểm

```text
User:
"Có quán cà phê nào yên tĩnh ở Cần Thơ không?"

Backend:
- Xác định nhóm cafe/restaurant.
- Tìm các địa điểm active trong database.
- Lọc theo tỉnh, rating và từ khóa.
- Chọn tối đa 5-10 ứng viên.

Gemini:
- Nhận câu hỏi và danh sách ứng viên.
- Viết lời tư vấn.
- Chọn tối đa 3 địa điểm phù hợp.

Backend:
- Kiểm tra location_id.
- Trả lời kèm địa điểm thật.

Frontend:
- Hiển thị tin nhắn AI.
- Hiển thị card địa điểm.
```

### 5.2. User bấm địa điểm

#### Website

```text
Xem chi tiết:
/user/location/:locationId

Chỉ đường:
/user/map?locationId=:locationId
```

#### Mobile

```text
Xem chi tiết:
/location/:locationId

Chỉ đường:
/(app)/(tabs)/explore?focusLocationId=:locationId
```

### 5.3. Không tìm thấy địa điểm

Nếu database không có kết quả:

```text
Hiện hệ thống chưa có địa điểm phù hợp với yêu cầu này.
Bạn có thể thử đổi khu vực hoặc loại dịch vụ.
```

Gemini có thể tư vấn chung nhưng không được bịa tên một địa điểm cụ thể rồi tạo card.

---

## 6. Dữ liệu gửi cho Gemini

Backend chỉ gửi dữ liệu tối thiểu:

```json
{
  "question": "Có quán cà phê nào yên tĩnh ở Cần Thơ không?",
  "candidates": [
    {
      "location_id": 1,
      "name": "Cafe Trung Nguyên",
      "type": "cafe",
      "province": "Cần Thơ",
      "address": "Trần Chiên, Cái Răng",
      "rating": 4,
      "review_count": 1,
      "description": "Quán cafe lâu đời"
    }
  ]
}
```

Không gửi:

- Email user.
- Số điện thoại user.
- Access token.
- Refresh token.
- Thông tin thanh toán.
- Nội dung booking không liên quan.
- Dữ liệu của user khác.

---

## 7. Response API

Không dùng JSON itinerary phức tạp. Chỉ cần response nhỏ và ổn định:

```ts
type AiChatResponse = {
  conversation_id: number;
  message_id: number;
  message: string;
  locations: Array<{
    location_id: number;
    reason: string;
  }>;
};
```

Ví dụ:

```json
{
  "conversation_id": 12,
  "message_id": 48,
  "message": "Cafe Trung Nguyên phù hợp nếu bạn cần một nơi uống cà phê và ngồi nghỉ trong khu vực Cái Răng.",
  "locations": [
    {
      "location_id": 1,
      "reason": "Đúng loại hình bạn đang tìm và có đánh giá tốt."
    }
  ]
}
```

### Quy tắc xử lý

- Tối đa 3 địa điểm trong một câu trả lời.
- Backend loại bỏ ID không tồn tại.
- Backend chỉ trả location có `status = active`.
- Nếu JSON của Gemini lỗi, Backend trả lời dạng text và danh sách tìm kiếm mặc định.
- Frontend không lấy ảnh hoặc địa chỉ do Gemini viết.
- Frontend dùng `location_id` để lấy dữ liệu thật.

---

## 8. Prompt Gemini

System instruction cần quy định:

```text
Bạn là trợ lý du lịch của TravelCheckinApp.

Chỉ được gợi ý địa điểm có trong danh sách candidates.
Không được tự tạo tên địa điểm, địa chỉ, giá hoặc đánh giá.
Không được thay đổi location_id.
Nếu không có candidates phù hợp, hãy nói rõ hệ thống chưa có dữ liệu.
Nếu Backend gửi intent theo thời tiết như hot_weather_recommendation, hãy ưu tiên diễn giải theo hướng nơi mát, đồ uống, cafe, quán ăn nhẹ hoặc chỗ ngồi nghỉ.
Nếu Backend gửi intent rain_weather_recommendation, hãy ưu tiên nơi trong nhà, cafe, quán ăn hoặc lưu trú.
Nếu câu hỏi mơ hồ nhưng Backend đã có candidates, hãy gợi ý 2-3 địa điểm thật thay vì trả lời chung chung.
Trả lời ngắn gọn, thân thiện và bằng tiếng Việt.
Chọn tối đa 3 địa điểm.
Mỗi địa điểm cần có một lý do ngắn gọn.
```

Model name và API key phải dùng environment:

```env
GEMINI_API_KEY=
GEMINI_MODEL=
```

Không hard-code model hoặc key trong source code.

---

## 9. API Backend

### 9.1. Chat

```text
POST /api/ai/chat
```

Request:

```json
{
  "prompt": "Tìm quán cafe ở Cần Thơ",
  "conversation_id": 12,
  "context": {
    "current_location": {
      "lat": 10.034,
      "lng": 105.785,
      "city": "Cần Thơ"
    },
    "weather": {
      "temperature": 34,
      "condition": "hot"
    }
  }
}
```

`context` là optional. Nếu Website/Mobile chưa gửi được context, Backend vẫn phải tự nhận diện keyword cơ bản trong prompt.

Response:

```json
{
  "success": true,
  "data": {
    "conversation_id": 12,
    "message_id": 48,
    "message": "Tôi tìm thấy một số địa điểm phù hợp.",
    "locations": [
      {
        "location_id": 1,
        "reason": "Phù hợp với nhu cầu tìm quán cafe."
      }
    ]
  }
}
```

### 9.2. Lịch sử

```text
GET /api/ai/history
```

Giữ endpoint cũ để tương thích trong MVP.

Sau khi chat nhiều cuộc hội thoại:

```text
GET    /api/ai/conversations
POST   /api/ai/conversations
GET    /api/ai/conversations/:id/messages
DELETE /api/ai/conversations/:id
```

### 9.3. Dữ liệu card địa điểm

Có hai lựa chọn:

1. Backend `/api/ai/chat` trả luôn thông tin card đã được lấy từ DB.
2. Frontend nhận ID rồi dùng API location hiện có.

Khuyến nghị MVP: Backend trả luôn dữ liệu card tối thiểu để giảm số request:

```ts
type AiLocationCard = {
  location_id: number;
  location_name: string;
  location_type: string;
  address: string;
  province?: string;
  first_image?: string;
  rating: number;
  total_reviews: number;
  reason: string;
};
```

Tất cả trường ngoài `reason` lấy trực tiếp từ MySQL.

---

## 10. Database

### 10.1. Có thể tái sử dụng

Đã có bảng:

```text
ai_chat_history
```

Đã có các cột:

- `history_id`
- `user_id`
- `ai_model`
- `prompt`
- `response`
- `metadata`
- `response_time_ms`
- Token usage.
- Error.
- Model version.

MVP có thể lưu danh sách location được gợi ý trong `metadata`:

```json
{
  "locations": [
    {
      "location_id": 1,
      "reason": "Phù hợp nhu cầu."
    }
  ]
}
```

### 10.2. Nâng cấp sau

Chỉ tạo thêm `ai_conversations` và mở rộng `ai_chat_history` khi cần:

- Nhiều cuộc hội thoại.
- Chat nhiều lượt.
- Đặt tên và xóa từng cuộc chat.
- Đồng bộ lịch sử tốt hơn giữa Website và Mobile.

Không cần sửa bảng itinerary cho phiên bản AI đơn giản này.

---

## 11. Tìm địa điểm từ câu hỏi

Không cần xây mô hình NLP riêng trong MVP.

Backend có thể dùng:

1. Từ khóa loại địa điểm:
   - cafe, cà phê.
   - ăn, nhà hàng, quán ăn.
   - khách sạn, lưu trú, resort.
   - du lịch, tham quan, vui chơi.
2. Tỉnh/thành có trong database.
3. Keyword search theo tên và địa chỉ.
4. Rating và số đánh giá.

Nếu không xác định được loại:

- Tìm nhiều nhóm.
- Để Gemini giải thích và chọn từ candidates.

Sau này có thể dùng Gemini để trích bộ lọc:

```json
{
  "type": "cafe",
  "province": "Cần Thơ",
  "keywords": ["yên tĩnh", "làm việc"]
}
```

Đây chỉ là bộ lọc nhỏ, không phải JSON itinerary phức tạp.

### 11.1. Gợi ý theo thời tiết, vị trí và ngữ cảnh mơ hồ

Các câu như:

```text
Nay trời nóng, có quán nào gợi ý không?
```

```text
Trời mưa quá, nên đi đâu gần đây?
```

không nên để Gemini tự đoán. Backend phải hiểu đây là nhóm câu hỏi theo ngữ cảnh và tự tạo candidates trước.

Backend cần trích metadata dạng:

```json
{
  "intent": "hot_weather_recommendation",
  "weather_context": "hot",
  "type_filters": ["cafe", "restaurant"],
  "province": "Cần Thơ",
  "keyword_hints": ["mát", "nước uống", "cafe", "trà", "kem", "ngồi nghỉ"],
  "candidate_count": 8
}
```

Quy tắc:

- Nếu user nói `trời nóng`, `oi`, `nắng`, `giải nhiệt`, `chỗ mát`: ưu tiên `cafe`, `restaurant`, đồ uống, quán có mô tả phù hợp.
- Nếu user nói `trời mưa`, `mưa quá`, `âm u`: ưu tiên nơi trong nhà như cafe, quán ăn, lưu trú.
- Nếu user không nói tỉnh/thành, Backend dùng vị trí hiện tại từ client nếu có. Nếu client không gửi vị trí, dùng khu vực mặc định đang có nhiều dữ liệu hoặc hỏi lại.
- Nếu không có candidates từ database, không gọi Gemini để bịa tên địa điểm. Trả lời thiếu dữ liệu và xin thêm khu vực/loại địa điểm.
- Metadata phải lưu `intent`, `weather_context`, `type_filters`, `province`, `candidate_count` để debug khi AI trả lời kém.

### 11.2. Chuẩn hóa tiếng Việt mạng xã hội và cách nói Nam Bộ

Trước khi tìm intent, Backend phải chuẩn hóa câu chat đời thường để AI không hiểu sai:

```text
ko, k, hk, hok, hong, hông -> không
dc, đc -> được
wa, qa, qá -> quá
j -> gì
z, v -> vậy
r, rùi -> rồi
lun -> luôn
nha, nhe, nghen, hen, hén -> sắc thái thân mật, không dùng làm intent chính
```

Các mẫu câu miền Nam/đời thường cần hiểu:

```text
Trời nắng quá, gợi ý cho tao chỗ đi đâu đi.
Nóng quá, có chỗ nào ngồi mát hong?
Nay oi quá, kiếm quán nước gần đây đi.
Đói quá, có quán nào ăn được ko?
Mưa quá, đi đâu trú mưa được?
Cho tui chỗ chill ở Cần Thơ.
```

Quy tắc xử lý:

- Chuẩn hóa không dấu và teencode trước khi match intent.
- Các từ xưng hô như `tao`, `tui`, `mình`, `bạn`, `má`, `trời ơi` chỉ là sắc thái hội thoại, không dùng để lọc dữ liệu.
- `đi đâu`, `chỗ nào`, `gợi ý`, `chill`, `sống ảo`, `checkin` là tín hiệu gợi ý địa điểm.
- Nếu đi cùng `trời nóng/nắng/oi`, ưu tiên địa điểm tránh nóng hoặc đồ uống trước khi chọn điểm tham quan ngoài trời.
- Nếu đi cùng `mưa`, ưu tiên nơi trong nhà.
- Danh sách synonym cần được mở rộng dần từ log thật và các nguồn nghiên cứu công khai về Vietnamese lexical normalization/dialect normalization; không scrape dữ liệu riêng tư từ Facebook.

---

## 12. Giao diện Website

### 12.1. Chat screen

- Danh sách tin nhắn user và AI.
- Ô nhập câu hỏi.
- Loading khi Gemini đang trả lời.
- Retry khi lỗi.
- Gợi ý câu hỏi nhanh:
  - Tìm chỗ ăn gần đây.
  - Gợi ý khách sạn.
  - Cuối tuần đi đâu?
  - Quán cafe được đánh giá tốt.

### 12.2. Card địa điểm trong chat

```text
[Ảnh địa điểm]
Cafe Trung Nguyên
4.0 điểm · 1 đánh giá
Trần Chiên, Cái Răng

Phù hợp vì đúng loại hình bạn đang tìm.

[Xem chi tiết] [Chỉ đường] [Lưu]
```

### 12.3. Hành động

- `Xem chi tiết`: mở trang location hiện có.
- `Chỉ đường`: mở map và focus location.
- `Lưu`: gọi API favorite hiện có.

Không dựng một trang chi tiết riêng cho AI.

---

## 13. Giao diện Mobile

Mobile triển khai sau khi Backend và Website ổn định.

### Chức năng

- Màn chat AI.
- Lịch sử chat.
- Card địa điểm giống Website.
- Mở chi tiết địa điểm.
- Mở bản đồ và chỉ đường.
- Lưu địa điểm.
- Xử lý bàn phím, SafeArea và loading.

### Điều hướng

```text
AI card
  |-- Xem chi tiết --> /location/:id
  |-- Chỉ đường -----> Explore Map
  |-- Lưu -----------> Favorite API
```

Mobile không gọi Gemini trực tiếp. Mọi request đi qua Backend.

---

## 14. Xử lý lỗi và fallback

### Gemini timeout

- Timeout request.
- Không retry quá nhiều.
- Trả danh sách tìm kiếm từ DB kèm câu trả lời mặc định.

```text
AI đang phản hồi chậm. Đây là một số địa điểm hệ thống tìm thấy cho bạn.
```

### Gemini trả ID sai

- Backend loại bỏ ID.
- Không tạo card.
- Ghi lỗi vào metadata/log.

### Không có địa điểm

- Không bịa dữ liệu.
- Gợi ý user đổi tỉnh, từ khóa hoặc loại dịch vụ.

### AI bị tắt/bảo trì

Tái sử dụng:

- `ai_enabled`
- `ai_maintenance`
- `ai_maintenance_note`
- `ai_fallback_enabled`

---

## 15. Bảo mật và giới hạn

- Bắt buộc đăng nhập.
- Rate limit theo user và IP.
- Giới hạn độ dài prompt.
- Không cho gửi file ở MVP.
- Không cho client truyền system prompt.
- Không đưa API key xuống Website/Mobile.
- Không log token đăng nhập.
- Lọc dữ liệu nhạy cảm trước khi gửi Gemini.
- Chặn câu hỏi ngoài phạm vi nguy hiểm hoặc không phù hợp.
- Hiển thị ghi chú:

```text
Thông tin do AI hỗ trợ gợi ý. Vui lòng kiểm tra thông tin địa điểm trước khi quyết định.
```

---

## 16. Kế hoạch triển khai

### A1 - Kết nối Gemini thật

**Độ khó:** Trung bình
**Ước lượng:** 1-2 ngày công

- Thêm environment.
- Tạo `geminiProvider`.
- Thay response bảo trì trong `aiController.ts`.
- Timeout và error handling.
- Tái sử dụng feature flags Admin.
- Lưu latency, model và lỗi vào `ai_chat_history`.

**Hoàn thành khi:**

- User gửi câu hỏi và nhận phản hồi Gemini thật.
- Gemini lỗi không làm Backend crash.

### A2 - Tìm kiếm địa điểm từ database

**Độ khó:** Trung bình
**Ước lượng:** 2-3 ngày công

- Tạo `aiLocationSearchService`.
- Nhận diện loại hình và tỉnh/thành.
- Chỉ lấy location active của owner/admin.
- Chọn tối đa 5-10 candidates.
- Chuẩn hóa dữ liệu gửi Gemini.

**Hoàn thành khi:**

- Câu hỏi ăn uống, lưu trú và du lịch trả đúng nhóm địa điểm.
- Không trả location inactive.

### A3 - Gemini lựa chọn và giải thích

**Độ khó:** Trung bình
**Ước lượng:** 1-2 ngày công

- Prompt chỉ cho chọn candidate.
- Response nhỏ gồm message và location IDs.
- Backend validate ID.
- Fallback khi JSON lỗi.
- Gắn dữ liệu card thật từ DB.

**Hoàn thành khi:**

- AI không tạo card cho địa điểm ngoài database.
- Card luôn mở đúng location.

### A4 - Website chat hoàn chỉnh

**Độ khó:** Dễ - Trung bình
**Ước lượng:** 2-3 ngày công

- Chuyển giao diện lịch sử hiện tại thành chat UI.
- Hiển thị card địa điểm.
- Nút chi tiết, chỉ đường và lưu.
- Loading, empty, retry và maintenance.
- Responsive.

**Hoàn thành khi:**

- Toàn bộ luồng hoạt động trên Website.
- Reload vẫn thấy lịch sử.

### A5 - Mobile

**Độ khó:** Trung bình
**Ước lượng:** 2-4 ngày công

- Chat screen.
- Location cards.
- Điều hướng chi tiết/map.
- Lưu favorite.
- SafeArea và keyboard.
- Kiểm tra Expo Go và build.

**Hoàn thành khi:**

- Website và Mobile dùng chung lịch sử và Backend.
- Hai nền tảng mở đúng cùng một location.

---

## 17. Tổng thời gian dự kiến

| Phạm vi | Thời gian |
|---|---:|
| Backend + Gemini + DB retrieval | 4-6 ngày công |
| Website | 2-3 ngày công |
| Mobile | 2-4 ngày công |
| Kiểm thử và chỉnh prompt | 1-2 ngày công |
| Tổng | 7-12 ngày công |

Thời gian phụ thuộc vào độ ổn định của Gemini API và chất lượng dữ liệu địa điểm trong database.

---

## 18. Kiểm thử

### Câu hỏi cần kiểm thử

- Tìm quán cafe ở Cần Thơ.
- Tìm nơi ăn uống được đánh giá tốt.
- Nay trời nóng, có quán nào gợi ý không?
- Trời mưa quá, nên đi đâu gần đây?
- Muốn tìm chỗ mát để ngồi nghỉ.
- Đói quá, gần đây có gì ăn không?
- Có khách sạn nào ở Cái Răng?
- Cuối tuần nên đi đâu chơi?
- Tôi muốn nơi phù hợp cho gia đình.
- Câu hỏi tiếng Việt không dấu.
- Câu hỏi sai chính tả.
- Khu vực không có dữ liệu.
- Câu hỏi không liên quan du lịch.
- Prompt yêu cầu AI tự tạo địa điểm.

### Điều kiện bắt buộc

- 100% card có `location_id` tồn tại.
- 100% card mở đúng trang chi tiết.
- 100% dữ liệu ảnh, địa chỉ và rating lấy từ Backend.
- Không hiển thị location inactive.
- Không lộ API key.
- Không lẫn lịch sử giữa các user.
- Gemini lỗi vẫn có thông báo hoặc kết quả DB fallback.
- Với câu hỏi gợi ý địa điểm, metadata phải có `candidate_count` và filters đã trích.
- Nếu `candidate_count = 0`, response không được chứa card địa điểm bịa.
- Câu hỏi theo thời tiết phải trả card địa điểm thật nếu database có địa điểm phù hợp.

---

## 19. Tiêu chí hoàn thành

AI User được xem là hoàn thành khi:

1. User chat được với Gemini.
2. AI trả lời bằng tiếng Việt tự nhiên.
3. AI gợi ý địa điểm thật trong database.
4. Kết quả hiển thị thành card có ảnh và thông tin.
5. User bấm được `Xem chi tiết`.
6. User bấm được `Chỉ đường`.
7. User lưu được địa điểm.
8. Lịch sử chat được lưu.
9. Website và Mobile dùng chung Backend.
10. AI không tự bịa card địa điểm ngoài hệ thống.

---

## 20. Công nghệ

| Hạng mục | Công nghệ |
|---|---|
| AI | Gemini API |
| Backend | Node.js + TypeScript + Express |
| Database | MySQL |
| Website | React hiện tại |
| Mobile | Expo/React Native hiện tại |
| Dữ liệu địa điểm | Database trước |
| Map/chi tiết | Tái sử dụng chức năng hiện có |
| Python | Không cần |
| Mô hình tự huấn luyện | Không cần cho AI User |

---

## 21. Đánh giá database hiện tại

### 21.1. Bảng đã có

| Bảng | Trạng thái | Có thể dùng cho |
|---|---|---|
| `ai_chat_history` | Dùng được một phần | Lưu mỗi cặp prompt/response, token, latency, lỗi và metadata |
| `user_preferences` | Có nhưng chưa cần cho MVP | Cá nhân hóa ở phiên bản sau |
| `system_settings` | Có cấu trúc, thiếu dữ liệu AI mặc định | Bật/tắt AI, bảo trì và fallback |
| `audit_logs` | Có | Ghi thay đổi cấu hình AI bởi Admin |
| `locations` và ảnh liên quan | Có | Nguồn card địa điểm thật |
| `favorites`/dữ liệu đã lưu hiện có | Có | Nút lưu địa điểm |

### 21.2. Kết luận đủ hay chưa

- **Đủ cho demo chat một lượt:** Có.
- **Đủ cho AI User hoàn chỉnh dùng chung Web/Mobile:** Chưa.
- `ai_chat_history` chưa nhóm được nhiều tin nhắn thành từng cuộc hội thoại.
- Chưa có bảng feedback để đo AI trả lời hữu ích hay không.
- Bản dump `system_settings` chưa có các key AI dù Backend Admin đã hỗ trợ đọc/ghi.
- `user_preferences.ai_model` đang có default model cũ; không dùng cột này để quyết định model runtime.

### 21.3. Thay đổi database tối thiểu

#### Tạo `ai_conversations`

```sql
CREATE TABLE ai_conversations (
  conversation_id BIGINT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  assistant_scope ENUM('user','owner','admin') NOT NULL DEFAULT 'user',
  title VARCHAR(255) DEFAULT NULL,
  status ENUM('active','archived','deleted') NOT NULL DEFAULT 'active',
  last_message_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (conversation_id),
  KEY idx_ai_conversation_user_time
    (user_id, assistant_scope, last_message_at),
  CONSTRAINT fk_ai_conversation_user
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);
```

#### Mở rộng `ai_chat_history`

```sql
ALTER TABLE ai_chat_history
  ADD COLUMN conversation_id BIGINT NULL AFTER history_id,
  ADD COLUMN response_type
    ENUM('text','location_suggestions','action_plan','summary','error')
    NOT NULL DEFAULT 'text' AFTER response,
  ADD COLUMN status
    ENUM('success','fallback','error')
    NOT NULL DEFAULT 'success' AFTER response_type,
  MODIFY COLUMN ai_model VARCHAR(100) DEFAULT 'Gemini',
  MODIFY COLUMN model_version VARCHAR(100) DEFAULT NULL,
  ADD KEY idx_ai_history_conversation_time
    (conversation_id, created_at),
  ADD CONSTRAINT fk_ai_history_conversation
    FOREIGN KEY (conversation_id)
    REFERENCES ai_conversations(conversation_id)
    ON DELETE CASCADE;
```

Danh sách location gợi ý tiếp tục lưu trong `metadata`, không cần tạo bảng riêng:

```json
{
  "locations": [
    {
      "location_id": 1,
      "reason": "Phù hợp với nhu cầu tìm quán cà phê."
    }
  ],
  "filters": {
    "type": "cafe",
    "province": "Cần Thơ"
  }
}
```

#### Tạo `ai_assistant_feedback`

```sql
CREATE TABLE ai_assistant_feedback (
  feedback_id BIGINT NOT NULL AUTO_INCREMENT,
  history_id INT NOT NULL,
  user_id INT NOT NULL,
  rating ENUM('helpful','not_helpful') NOT NULL,
  reason VARCHAR(500) DEFAULT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (feedback_id),
  UNIQUE KEY uniq_ai_feedback_user_message (history_id, user_id),
  CONSTRAINT fk_ai_feedback_history
    FOREIGN KEY (history_id)
    REFERENCES ai_chat_history(history_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_ai_feedback_user
    FOREIGN KEY (user_id)
    REFERENCES users(user_id)
    ON DELETE CASCADE
);
```

#### Seed AI settings

```sql
INSERT IGNORE INTO system_settings
  (setting_key, setting_value, setting_type)
VALUES
  ('ai_enabled', '1', 'text'),
  ('ai_maintenance', '0', 'text'),
  ('ai_maintenance_note', '', 'text'),
  ('ai_fallback_enabled', '1', 'text'),
  ('ai_user_model', '', 'text'),
  ('ai_user_max_locations', '3', 'text'),
  ('ai_user_daily_limit', '50', 'text');
```

Tên model thực tế vẫn ưu tiên lấy từ environment; setting chỉ dùng khi Admin được phép chọn model.

Khuyến nghị bỏ default model cũ trong `user_preferences`:

```sql
ALTER TABLE user_preferences
  MODIFY COLUMN ai_model VARCHAR(100) DEFAULT NULL;
```

---

## 22. Ma trận API và chức năng

### 22.1. API AI chính

| API | Trạng thái | Chức năng | Việc cần làm |
|---|---|---|---|
| `POST /api/ai/chat` | Đã có nhưng đang stub | Gửi câu hỏi, nhận lời tư vấn và card location | Kết nối Gemini, DB retrieval, validate ID, lưu metadata |
| `GET /api/ai/history` | Đã có | Lấy lịch sử chat cũ | Thêm phân trang, conversation filter và location cards |
| `GET /api/ai/conversations` | Cần tạo | Danh sách cuộc chat | Truy vấn theo user, sắp xếp lần nhắn cuối |
| `POST /api/ai/conversations` | Cần tạo | Tạo cuộc chat mới | Tạo title mặc định hoặc sinh từ câu hỏi đầu |
| `GET /api/ai/conversations/:id/messages` | Cần tạo | Lấy tin nhắn một cuộc chat | Kiểm tra conversation thuộc user |
| `DELETE /api/ai/conversations/:id` | Cần tạo | Xóa/ẩn cuộc chat | Soft delete hoặc cập nhật status |
| `POST /api/ai/messages/:historyId/feedback` | Cần tạo | Hữu ích/không hữu ích | Upsert `ai_assistant_feedback` |

### 22.2. API dữ liệu địa điểm Backend phải kết nối

| API/service | Trạng thái | AI dùng để làm gì |
|---|---|---|
| `GET /api/locations?type=&keyword=&province=&source=mobile/web` | Đã có | Lấy candidates thật từ DB |
| `GET /api/locations/:id` | Đã có | Xác minh ID và lấy card/detail |
| `GET /api/locations/:id/reviews` | Đã có | Chỉ dùng khi user hỏi về đánh giá của địa điểm |
| `GET /api/locations/:id/services` | Đã có | Chỉ dùng khi user hỏi dịch vụ tại địa điểm |
| `GET /api/user/recommendations/locations` | Đã có | Có thể dùng làm fallback gợi ý chung |

Trong Backend, nên gọi service/query dùng chung thay vì tự gửi HTTP về chính server.

### 22.3. API hành động từ card

| API/route | Trạng thái | Chức năng |
|---|---|---|
| `PATCH /api/user/favorites/:locationId` | Đã có | Lưu địa điểm |
| `DELETE /api/user/favorites/:locationId` | Đã có | Bỏ lưu |
| Website `/user/location/:locationId` | Đã có | Xem chi tiết |
| Mobile `/location/:locationId` | Đã có | Xem chi tiết |
| Website map route | Đã có màn hình | Focus location và chỉ đường |
| Mobile Explore params | Đã có nền tảng | Focus location và bắt đầu route |

### 22.4. API Admin quản lý AI

| API | Trạng thái | Chức năng | Việc cần làm |
|---|---|---|---|
| `GET /api/admin/ai/settings` | Đã có | Đọc feature flags | Seed dữ liệu mặc định |
| `PUT /api/admin/ai/settings` | Đã có | Bật/tắt, bảo trì, fallback | Mở rộng allowlist nếu thêm model/limit |
| `GET /api/admin/ai/chat-history` | Đã có | Admin xem lịch sử AI | Thêm role, status, model, error filters |
| `GET /api/admin/ai/logs` | Đã có nhưng trả rỗng | Theo dõi lỗi/latency/token | Xây query từ `ai_chat_history` |

### 22.5. API Frontend cần bổ sung

#### Website `website/src/api/aiApi.ts`

- Mở rộng `chat()` nhận `conversation_id`.
- Thêm `getConversations()`.
- Thêm `createConversation()`.
- Thêm `getConversationMessages()`.
- Thêm `deleteConversation()`.
- Thêm `sendFeedback()`.
- Cập nhật response type có `locations`.

#### Mobile

Tạo `mobile/src/services/ai.api.ts`:

```text
chat
getConversations
createConversation
getMessages
deleteConversation
sendFeedback
```

Mobile không gọi Gemini trực tiếp.

---

## 23. File Backend cần tạo hoặc sửa

| File | Công việc |
|---|---|
| `backend/src/controllers/aiController.ts` | Thay stub, thêm conversation/history/feedback |
| `backend/src/routes/aiRoutes.ts` | Khai báo toàn bộ API AI User |
| `backend/src/services/ai/geminiProvider.ts` | Adapter gọi Gemini |
| `backend/src/services/ai/locationContextService.ts` | Tìm và chuẩn hóa candidates |
| `backend/src/services/ai/aiChatService.ts` | Điều phối chat, fallback và lưu DB |
| `backend/src/schemas/aiSchemas.ts` | Zod schema request/response |
| `backend/src/config/ai.ts` | Model, timeout, limit từ env/settings |
| Migration AI | Tạo conversation, feedback, alter history, seed settings |

Thư viện Node cần dùng:

```bash
npm install @google/genai
```

`zod`, `axios`, `mysql2` và `dotenv` đã có trong Backend.

Sau khi chuyển xong phải xóa việc sử dụng SDK cũ `@google/generative-ai` để tránh tồn tại hai SDK Gemini song song.

---

## 24. Kết luận

Phiên bản này vẫn là một tính năng AI rõ ràng:

- Gemini hiểu câu hỏi.
- Gemini viết lời tư vấn.
- Gemini giải thích lý do gợi ý.
- Backend cung cấp và kiểm chứng địa điểm.
- User có thể hành động ngay từ kết quả AI.

Hướng này đơn giản hơn AI itinerary, ít rủi ro hơn, dễ kiểm thử và phù hợp để hoàn thành Website lẫn Mobile trong thời gian hợp lý.

---

## 25. Tài liệu kỹ thuật

- Google Gen AI SDK: https://ai.google.dev/gemini-api/docs/libraries
- Structured output: https://ai.google.dev/gemini-api/docs/structured-output
- Function calling: https://ai.google.dev/gemini-api/docs/function-calling
- Embeddings/RAG: https://ai.google.dev/gemini-api/docs/embeddings
- Long context: https://ai.google.dev/gemini-api/docs/long-context
- Safety settings: https://ai.google.dev/gemini-api/docs/safety-settings
- Rate limits: https://ai.google.dev/gemini-api/docs/rate-limits

---

## 26. Kế hoạch nâng cấp AI User thông minh cao

Mục tiêu phiên bản nâng cấp là biến AI User thành một trợ lý thân thiện, nói chuyện tự nhiên được, hiểu tiếng Việt đời thường, hiểu vị trí/thời tiết/lịch sử người dùng, nhưng vẫn không bịa dữ liệu khi gợi ý địa điểm hoặc thao tác chức năng.

### 26.1. Tư duy kiến trúc

AI User chia thành 3 lớp:

1. **Lớp trò chuyện tự nhiên**
   - Cho phép nói chuyện vui, xàm nhẹ, thân thiện.
   - Hiểu teencode, viết tắt, không dấu, cách nói miền Nam.
   - Có personality riêng của TravelCheckinApp: vui, gần gũi, gợi ý nhanh, không dạy đời.

2. **Lớp hiểu ý định**
   - Phân loại câu hỏi thành intent:
     - `small_talk`
     - `location_recommendation`
     - `weather_aware_recommendation`
     - `nearby_recommendation`
     - `location_detail_question`
     - `booking_help`
     - `ticket_help`
     - `hotel_help`
     - `itinerary_help`
     - `safety_sos_help`
     - `out_of_scope`
   - Intent phải trả bằng structured output để Backend kiểm soát.

3. **Lớp tool/database**
   - Khi user hỏi địa điểm, booking, voucher, vé, thời tiết, chỉ đường: AI phải gọi tool Backend.
   - Gemini không được tự chế địa điểm, giá, trạng thái, số phòng, số vé hoặc link.
   - Backend validate toàn bộ ID trước khi trả về frontend.

### 26.2. Tool AI cần có

Backend khai báo tool/function cho AI:

| Tool | Dùng khi nào | Dữ liệu trả về |
|---|---|---|
| `search_locations` | User hỏi gợi ý địa điểm | Location cards thật |
| `get_nearby_locations` | User hỏi gần đây/quanh đây | Địa điểm theo GPS |
| `get_weather_context` | User nói trời nóng/mưa/lạnh | Thời tiết hiện tại |
| `get_location_detail` | User hỏi về một địa điểm cụ thể | Detail từ DB |
| `get_location_services` | User hỏi địa điểm có gì/dịch vụ gì | Menu, vé, phòng, bàn |
| `get_saved_locations` | User hỏi địa điểm đã lưu | Favorite của user |
| `get_user_bookings` | User hỏi đơn đặt trước/vé/phòng | Booking của user |
| `get_vouchers` | User hỏi khuyến mãi | Voucher khả dụng |
| `create_itinerary_draft` | User nhờ lên lịch trình nháp | Draft chưa lưu |

Tool nào có thay đổi dữ liệu như đặt chỗ, hủy đơn, lưu lịch trình phải có xác nhận từ user trước khi gọi API thật.

### 26.3. Structured output bắt buộc

Mỗi phản hồi AI phải có envelope ổn định:

```ts
type AiUserReply = {
  mode: "chat" | "suggest_locations" | "show_booking" | "show_voucher" | "itinerary_draft" | "need_clarification" | "error";
  message: string;
  quick_replies: string[];
  cards: Array<{
    type: "location" | "booking" | "voucher" | "service" | "itinerary_day";
    id: number | string;
    reason?: string;
  }>;
  actions: Array<{
    type: "open_location" | "open_map" | "save_location" | "open_booking" | "open_wallet" | "ask_confirm";
    label: string;
    payload: Record<string, unknown>;
  }>;
  metadata: {
    intent: string;
    confidence: number;
    tools_used: string[];
    candidate_count?: number;
  };
};
```

Frontend chỉ hiển thị card/action nếu Backend đã validate ID.

### 26.4. RAG và semantic search

Keyword search hiện tại chỉ đủ MVP. Bản thông minh cần semantic search:

- Tạo text mô tả cho mỗi địa điểm:
  - tên, loại, địa chỉ, mô tả, tiện ích, review tóm tắt, dịch vụ nổi bật.
- Sinh embedding cho từng địa điểm và service.
- Khi user hỏi:
  - `chỗ nào mát mát ngồi lâu được`
  - `đi với người yêu thì nên đi đâu`
  - `có chỗ nào sống ảo không`
  - `trời nắng quá kiếm chỗ trú`
  Backend dùng embedding search để lấy candidates theo nghĩa.
- Sau đó mới đưa candidates cho Gemini chọn và giải thích.

Không dùng embedding để thay thế database. Embedding chỉ giúp tìm candidates tốt hơn.

### 26.5. Trí nhớ người dùng

AI cần 3 loại memory:

1. **Session memory**
   - Nhớ vài lượt chat gần nhất trong cùng cuộc trò chuyện.
   - Dùng để hiểu đại từ như `chỗ đó`, `quán này`, `cái thứ 2`.

2. **Profile memory**
   - Lưu sở thích được user cho phép:
     - thích cafe, thích chỗ yên tĩnh, hay đi Cần Thơ, thích rẻ, thích có máy lạnh.
   - Không lưu thông tin nhạy cảm không cần thiết.

3. **Behavior memory**
   - Dựa trên lịch sử đã lưu, đã xem, đã đặt, đã check-in.
   - Chỉ dùng để cá nhân hóa gợi ý, không gửi toàn bộ dữ liệu thô cho Gemini.

Memory đưa vào prompt phải là bản tóm tắt ngắn, ví dụ:

```json
{
  "preferences": ["thích quán cafe yên tĩnh", "ưu tiên Cần Thơ", "hay đi buổi tối"],
  "recent_context": "User vừa hỏi chỗ tránh nóng và đang ở Cái Răng."
}
```

### 26.6. Personality và trò chuyện xàm vui

AI được nói chuyện tự nhiên, nhưng phải có ranh giới:

- Được trả lời vui các câu như:
  - `nay chán quá`
  - `nóng muốn xỉu`
  - `đi đâu giờ trời`
  - `ê gợi ý kèo đi chơi đi`
  - `tui đói muốn xỉu`
- Không biến thành bot tán gẫu vô hạn nếu user đang cần hành động.
- Sau 1-2 câu small talk, AI nên kéo nhẹ về chức năng:
  - gợi ý địa điểm
  - mở bản đồ
  - xem voucher
  - tạo lịch trình nháp

Ví dụ:

```text
User: Nóng muốn xỉu luôn á.
AI: Nghe là thấy cần một ly nước mát rồi đó. Mình gợi ý vài quán cafe/quán nước gần bạn nha?
Quick replies: [Gợi ý gần đây] [Chỗ có máy lạnh] [Quán nước giá ổn]
```

### 26.7. Bộ test hội thoại thông minh

Phải test bằng câu đời thường:

```text
nay nắng quá gợi ý cho tao chỗ đi đâu đi
nóng muốn xỉu, có quán nước nào gần đây hong
tui đói quá kiếm gì ăn đi
ko biết đi đâu chơi cuối tuần này
chỗ nào chill chill ở cần thơ vậy
đi với ny thì nên chọn chỗ nào
mưa quá trú ở đâu được
quán thứ 2 có gì hay
lưu quán đó cho tui
chỉ đường tới chỗ này
vé của tui còn hạn không
đơn đặt bàn của tui sao rồi
```

Điều kiện đạt:

- AI hiểu đúng intent.
- Có candidates thật khi hỏi địa điểm.
- Card mở đúng màn chi tiết.
- Không bịa địa điểm nếu DB không có.
- Không tự đặt/hủy/thanh toán khi user chưa xác nhận.
- Small talk nghe tự nhiên nhưng không lan man quá lâu.

### 26.8. Lộ trình triển khai

#### UAI-1: Chat thông minh có intent

- Tách `intentExtractor`.
- Chuẩn hóa tiếng Việt đời thường.
- Structured output cho intent.
- Small talk an toàn.

Trạng thái hiện tại:

- [x] Đã có `intent.ts` cho AI User ở Backend.
- [x] Đã phân loại được small talk, gợi ý địa điểm, gợi ý theo thời tiết, booking, vé, voucher, đã lưu, lịch trình và SOS.
- [x] Response `/api/ai/chat` mở rộng thêm `mode`, `quickReplies`, `actions`, `metadata` nhưng vẫn giữ `message` và `locations` để tương thích giao diện cũ.
- [x] Small talk và các intent hướng dẫn đơn giản có thể trả lời nhanh không cần gọi Gemini.
- [x] Location recommendation vẫn đi theo nguyên tắc candidates thật từ database trước, Gemini chỉ chọn và viết lời tư vấn.

#### UAI-2: Tool calling nội bộ

- Tạo tool registry trong Backend.
- Cho AI gọi tool đọc dữ liệu:
  - location
  - weather
  - voucher
  - booking
  - favorites
- Validate tool result trước khi trả frontend.

#### UAI-3: Semantic search/RAG

- Tạo bảng embedding cho `locations` và `services`.
- Job cập nhật embedding khi owner sửa địa điểm/dịch vụ.
- Search theo nghĩa trước, keyword search làm fallback.

#### UAI-4: Memory cá nhân hóa

- Tạo memory summary theo user.
- Cho user bật/tắt cá nhân hóa.
- Cho user xóa memory.
- Dùng lịch sử saved/check-in/booking để gợi ý tốt hơn.

#### UAI-5: AI hành động có xác nhận

- Lưu địa điểm.
- Mở bản đồ/chỉ đường.
- Tạo lịch trình nháp.
- Hỗ trợ kiểm tra booking/vé/voucher.
- Các thao tác hủy/đặt/thanh toán chỉ thực hiện sau xác nhận rõ ràng.

### 26.9. Database bổ sung đề xuất

```sql
CREATE TABLE ai_user_memories (
  memory_id BIGINT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  memory_type ENUM('preference','summary','behavior') NOT NULL,
  memory_key VARCHAR(100) NOT NULL,
  memory_value JSON NOT NULL,
  confidence DECIMAL(5,2) DEFAULT 0.80,
  status ENUM('active','deleted') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (memory_id),
  KEY idx_ai_user_memory_user (user_id, memory_type, status)
);
```

```sql
CREATE TABLE ai_location_embeddings (
  embedding_id BIGINT NOT NULL AUTO_INCREMENT,
  location_id INT NOT NULL,
  source_type ENUM('location','service','review_summary') NOT NULL DEFAULT 'location',
  source_id INT DEFAULT NULL,
  text_hash VARCHAR(64) NOT NULL,
  embedding_model VARCHAR(100) NOT NULL,
  embedding_json JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (embedding_id),
  KEY idx_ai_location_embedding_location (location_id, source_type)
);
```

Nếu MySQL hiện tại chưa tối ưu vector search, MVP có thể lưu JSON embedding rồi tính cosine similarity trong service Node/Python cho tập dữ liệu nhỏ. Khi dữ liệu lớn hơn, cân nhắc vector database hoặc MySQL vector support nếu môi trường hỗ trợ.

### 26.10. Nguyên tắc an toàn

- AI được vui vẻ nhưng không xúc phạm user.
- Không tư vấn y tế/pháp lý/tài chính theo kiểu chắc chắn.
- Không tự ý tạo booking, thanh toán, hủy đơn.
- Không gửi thông tin cá nhân của user khác vào prompt.
- Không log access token/API key.
- Nếu câu hỏi nguy hiểm hoặc ngoài phạm vi, trả lời ngắn và điều hướng về tính năng an toàn.

### 26.11. Cập nhật sau kiểm thử thực tế: tránh AI trả lời chung chung

Qua kiểm thử popup chat, các câu như `mình hơi chán`, `mình chán quá`, `nay trời nóng`, `tui đói quá` không được dừng ở small talk. AI phải hiểu đây là nhu cầu ngầm để gợi ý hành động.

Quy tắc mới:

- Câu chào như `hello`, `hi`, `alo` vẫn là small talk.
- Câu tâm trạng như `chán`, `buồn`, `stress`, `mệt`, `tụt mood`, `đổi gió`, `không biết làm gì` phải chuyển sang luồng gợi ý địa điểm.
- Câu thời tiết như `trời nóng`, `trời nắng`, `nóng quá`, `trời mưa` phải chuyển sang luồng gợi ý theo thời tiết dù user chưa nói rõ `gợi ý`.
- Backend phải lấy candidates thật từ database trước, ưu tiên cafe, ăn uống, tham quan, vui chơi nhẹ cho nhóm câu tâm trạng.
- Nếu Gemini không chọn được địa điểm nhưng database có candidates, backend fallback trả 2-3 địa điểm thật thay vì trả lời suông.
- Response cần có `metadata.locations` để website/mobile render card địa điểm, có nút mở chi tiết và bản đồ.

Điều kiện đạt khi test:

```text
User: mình chán quá
AI: trả lời đồng cảm ngắn + hiển thị card địa điểm thật.

User: nay trời nóng quá
AI: ưu tiên cafe/quán nước/chỗ mát từ database.

User: tui đói quá kiếm gì ăn đi
AI: ưu tiên restaurant/cafe, không bịa tên địa điểm ngoài database.
```
