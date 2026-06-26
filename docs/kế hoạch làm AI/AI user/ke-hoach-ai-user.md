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
  "conversation_id": 12
}
```

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
- Rate limits: https://ai.google.dev/gemini-api/docs/rate-limits
