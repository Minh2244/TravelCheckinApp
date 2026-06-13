# Đặc Tả Thiết Kế: Chức Năng Lịch Trình Du Lịch

**Ngày:** 2026-06-13
**Trạng thái:** Chờ phê duyệt

---

## 1. Mục Tiêu

Cho phép người dùng (User) tự tạo kế hoạch du lịch theo ngày, quản lý danh sách địa điểm muốn đến, ghi chú, ước tính chi phí, và đánh dấu đã đến.

**Phạm vi:** Chỉ dành cho User (khách du lịch). Không áp dụng cho Owner hay Admin.

**Giai đoạn này:** User tự tạo lịch trình thủ công. Tính năng AI gợi ý lịch trình sẽ làm sau.

---

## 2. Database

### 2.1. Bảng `itineraries` — Lịch trình

```sql
CREATE TABLE `itineraries` (
  `itinerary_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`itinerary_id`),
  KEY `itineraries_user_fk` (`user_id`),
  CONSTRAINT `itineraries_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Giải thích:**
- `itinerary_id` — Khóa chính, tự động tăng
- `user_id` — Khóa ngoại nối sang bảng `users`. Ai tạo lịch trình thì user_id của người đó. ON DELETE CASCADE: xóa user → xóa hết lịch trình của họ
- `title` — Tên chuyến đi, bắt buộc nhập
- `description` — Mô tả, tùy chọn
- `start_date` / `end_date` — Ngày bắt đầu và kết thúc, bắt buộc
- `created_at` / `updated_at` — Thời gian tạo/cập nhật, tự động

### 2.2. Bảng `itinerary_items` — Từng địa điểm trong lịch trình

```sql
CREATE TABLE `itinerary_items` (
  `item_id` int NOT NULL AUTO_INCREMENT,
  `itinerary_id` int NOT NULL,
  `day_number` int NOT NULL,
  `sort_order` int NOT NULL DEFAULT 0,
  `location_id` int DEFAULT NULL,
  `custom_name` varchar(255) DEFAULT NULL,
  `custom_address` varchar(500) DEFAULT NULL,
  `time` varchar(10) DEFAULT NULL,
  `note` text,
  `estimated_cost` decimal(12,0) DEFAULT NULL,
  `visited_at` datetime DEFAULT NULL,
  PRIMARY KEY (`item_id`),
  KEY `itinerary_items_itinerary_fk` (`itinerary_id`),
  KEY `itinerary_items_location_fk` (`location_id`),
  CONSTRAINT `itinerary_items_itinerary_fk` FOREIGN KEY (`itinerary_id`) REFERENCES `itineraries` (`itinerary_id`) ON DELETE CASCADE,
  CONSTRAINT `itinerary_items_location_fk` FOREIGN KEY (`location_id`) REFERENCES `locations` (`location_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Giải thích:**
- `item_id` — Khóa chính, tự động tăng
- `itinerary_id` — Khóa ngoại nối sang bảng `itineraries`. ON DELETE CASCADE: xóa lịch trình → xóa hết items
- `day_number` — Ngày thứ mấy trong chuyến đi (1, 2, 3...)
- `sort_order` — Thứ tự sắp xếp trong cùng 1 ngày (0, 1, 2...)
- `location_id` — Khóa ngoại nối sang bảng `locations` (tùy chọn). Nếu user chọn địa điểm từ hệ thống thì có giá trị. Nếu nhập tự do thì để NULL. ON DELETE SET NULL: nếu địa điểm bị xóa khỏi hệ thống thì item vẫn giữ, chỉ mất liên kết
- `custom_name` — Tên địa điểm tự do (khi không chọn từ hệ thống)
- `custom_address` — Địa chỉ tự do
- `time` — Giờ dự kiến, tùy chọn (ví dụ: "08:00", "14:30")
- `note` — Ghi chú, tùy chọn
- `estimated_cost` — Chi phí dự kiến (VND), tùy chọn
- `visited_at` — Thời gian đánh dấu đã đến. NULL = chưa đến. Có giá trị = đã đến

### 2.3. Quy tắc dữ liệu

- Mỗi item phải có ít nhất `location_id` HOẶC `custom_name` (không thể để cả hai null)
- `day_number` phải nằm trong khoảng từ 1 đến số ngày của chuyến đi (`end_date - start_date + 1`)
- `estimated_cost` >= 0 (không âm)
- `time` theo định dạng "HH:mm" (24h)

---

## 3. Backend API

### 3.1. Danh sách API

| Method | Endpoint | Chức năng | Auth |
|--------|----------|-----------|------|
| GET | `/api/user/itineraries` | Lấy danh sách lịch trình của user | User |
| GET | `/api/user/itineraries/:itineraryId` | Lấy chi tiết lịch trình (kèm items) | User |
| POST | `/api/user/itineraries` | Tạo lịch trình mới (kèm items) | User |
| PUT | `/api/user/itineraries/:itineraryId` | Cập nhật lịch trình (kèm items) | User |
| DELETE | `/api/user/itineraries/:itineraryId` | Xóa lịch trình | User |
| PATCH | `/api/user/itineraries/:itineraryId/items/:itemId/visit` | Đánh dấu đã đến / Bỏ đánh dấu | User |

### 3.2. Chi tiết từng API

#### GET `/api/user/itineraries`

**Mô tả:** Lấy danh sách lịch trình của user đang đăng nhập, sắp xếp theo ngày tạo mới nhất.

**Query params:** Không có

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "itinerary_id": 1,
      "title": "Du lịch Đà Lạt 3 ngày",
      "description": "Chuyến đi mùa hè",
      "start_date": "2026-07-01",
      "end_date": "2026-07-03",
      "total_items": 8,
      "total_estimated_cost": 2500000,
      "visited_count": 3,
      "created_at": "2026-06-13T10:00:00.000Z"
    }
  ]
}
```

**Lưu ý:** Query JOIN để đếm `total_items`, tính `total_estimated_cost`, đếm `visited_count`. Không trả về full items trong danh sách (chỉ trả khi xem chi tiết).

---

#### GET `/api/user/itineraries/:itineraryId`

**Mô tả:** Lấy chi tiết lịch trình kèm tất cả items, nhóm theo ngày.

**Response:**
```json
{
  "success": true,
  "data": {
    "itinerary_id": 1,
    "title": "Du lịch Đà Lạt 3 ngày",
    "description": "Chuyến đi mùa hè",
    "start_date": "2026-07-01",
    "end_date": "2026-07-03",
    "created_at": "2026-06-13T10:00:00.000Z",
    "updated_at": "2026-06-13T10:00:00.000Z",
    "items": [
      {
        "item_id": 1,
        "day_number": 1,
        "sort_order": 0,
        "location_id": 42,
        "location_name": "Thung lũng Tình Yêu",
        "location_image": "/api/images/123",
        "location_rating": 4.5,
        "custom_name": null,
        "custom_address": null,
        "time": "08:00",
        "note": "Nên đi sáng sớm, ít người",
        "estimated_cost": 100000,
        "visited_at": null
      },
      {
        "item_id": 2,
        "day_number": 1,
        "sort_order": 1,
        "location_id": null,
        "location_name": null,
        "location_image": null,
        "location_rating": null,
        "custom_name": "Nhà hàng ABC",
        "custom_address": "123 Đường XYZ, Đà Lạt",
        "time": "12:00",
        "note": "Ăn trưa",
        "estimated_cost": 200000,
        "visited_at": "2026-07-01T12:30:00.000Z"
      }
    ]
  }
}
```

**Bảo mật:** Kiểm tra `user_id` trong token khớp với `user_id` trong itinerary. Nếu không khớp → trả 403.

---

#### POST `/api/user/itineraries`

**Mô tả:** Tạo lịch trình mới kèm danh sách items.

**Request body:**
```json
{
  "title": "Du lịch Đà Lạt 3 ngày",
  "description": "Chuyến đi mùa hè",
  "start_date": "2026-07-01",
  "end_date": "2026-07-03",
  "items": [
    {
      "day_number": 1,
      "sort_order": 0,
      "location_id": 42,
      "time": "08:00",
      "note": "Nên đi sáng sớm",
      "estimated_cost": 100000
    },
    {
      "day_number": 1,
      "sort_order": 1,
      "custom_name": "Nhà hàng ABC",
      "custom_address": "123 Đường XYZ",
      "time": "12:00",
      "estimated_cost": 200000
    }
  ]
}
```

**Validation:**
- `title` bắt buộc, không rỗng
- `start_date` <= `end_date`
- Mỗi item phải có `location_id` HOẶC `custom_name`
- `day_number` >= 1 và <= (end_date - start_date + 1)
- Dùng transaction: INSERT itinerary trước, sau đó INSERT tất cả items

**Response:** Trả về toàn bộ lịch trình vừa tạo (giống GET chi tiết).

---

#### PUT `/api/user/itineraries/:itineraryId`

**Mô tả:** Cập nhật lịch trình. Cách hoạt động: xóa hết items cũ, insert lại items mới (đơn giản hơn là diff từng item).

**Request body:** Giống POST (gửi toàn bộ items mới).

**Validation:**
- Kiểm tra quyền sở hữu
- Validation giống POST

**Response:** Trả về toàn bộ lịch trình sau khi cập nhật.

---

#### DELETE `/api/user/itineraries/:itineraryId`

**Mô tả:** Xóa lịch trình và tất cả items (CASCADE tự động xóa items).

**Response:**
```json
{
  "success": true,
  "message": "Đã xóa lịch trình"
}
```

---

#### PATCH `/api/user/itineraries/:itineraryId/items/:itemId/visit`

**Mô tả:** Đánh dấu đã đến hoặc bỏ đánh dấu.

**Request body:** Không cần (toggle tự động).

**Logic:**
- Nếu `visited_at` đang NULL → set thành `NOW()`
- Nếu `visited_at` đang có giá trị → set thành NULL

**Response:**
```json
{
  "success": true,
  "data": {
    "item_id": 1,
    "visited_at": "2026-07-01T08:30:00.000Z"
  }
}
```

---

## 4. Frontend — Website

### 4.1. Route

- `/user/itineraries` — Danh sách lịch trình
- `/user/itineraries/create` — Tạo lịch trình mới
- `/user/itineraries/:id` — Xem/Sửa lịch trình

### 4.2. Trang danh sách (`UserItineraries.tsx`)

**Giao diện:**
- Header: "Lịch trình của tôi" + nút "Tạo lịch trình mới"
- Danh sách card, mỗi card hiển thị:
  - Tên lịch trình
  - Ngày bắt đầu — kết thúc
  - Số địa điểm / Số đã đến (ví dụ: "3/8 đã đến")
  - Tổng chi phí dự kiến
  - Nút Sửa / Xóa

**API gọi:** `GET /api/user/itineraries`

**Trạng thái rỗng:** Hiển thị minh họa + nút "Tạo lịch trình đầu tiên"

### 4.3. Trang tạo/sửa (`UserItineraryEditor.tsx`)

**Giao diện chia 2 phần:**

**Phần trên — Thông tin chung:**
- Input: Tên lịch trình
- TextArea: Mô tả (tùy)
- DatePicker range: Ngày bắt đầu — kết thúc

**Phần dưới — Tabs theo ngày:**
- Tabs: [Ngày 1] [Ngày 2] [Ngày 3] ...
- Khi đổi ngày bắt đầu/kết thúc → tabs tự động cập nhật

**Mỗi ngày — Danh sách items:**
- Mỗi item là 1 card hiển thị:
  - Thứ tự (số thứ tự)
  - Giờ (nếu có)
  - Tên địa điểm (từ hệ thống hoặc tự do)
  - Ghi chú (nếu có)
  - Chi phí dự kiến (nếu có)
  - Icon đã đến / chưa đến
  - Nút Sửa / Xóa
- Nút "+ Thêm địa điểm":
  - Modal tìm kiếm: nhập tên → tìm trong hệ thống (API locations)
  - Nếu không tìm thấy → cho phép nhập tên + địa chỉ tự do
  - Fields: Tên, Địa chỉ (nếu tự do), Giờ (tùy), Ghi chú (tùy), Chi phí (tùy)

**API gọi:**
- Tạo mới: `POST /api/user/itineraries`
- Sửa: `PUT /api/user/itineraries/:id`
- Đánh dấu đã đến: `PATCH /api/user/itineraries/:id/items/:itemId/visit`

### 4.4. Vị trí trong Website

- Thêm menu "Lịch trình" vào sidebar/header của User section
- Link dẫn đến `/user/itineraries`

---

## 5. Frontend — Mobile

### 5.1. Route (Expo Router)

- `app/itineraries/index.tsx` — Danh sách lịch trình
- `app/itineraries/create.tsx` — Tạo lịch trình mới
- `app/itineraries/[id].tsx` — Xem/Sửa lịch trình

### 5.2. Vị trí trong Mobile

- Thêm card "Lịch trình" trên UserDashboard (trang Home)
- Card hiển thị lịch trình sắp tới (nếu có):
  ```
  ┌────────────────────────┐
  │ 🗓️ Lịch trình sắp tới  │
  │ Du lịch Đà Lạt 3 ngày │
  │ 01/07 - 03/07/2026     │
  │ 3/8 đã đến · 2.5tr VND │
  │        [Xem tất cả →]  │
  └────────────────────────┘
  ```
- Nếu không có lịch trình → hiển thị "Chưa có lịch trình" + nút "Tạo ngay"

### 5.3. Trang danh sách (`app/itineraries/index.tsx`)

- Tương tự website nhưng responsive cho mobile
- FlatList hiển thị card
- Swipe to delete hoặc nút xóa

### 5.4. Trang tạo/sửa (`app/itineraries/create.tsx` và `app/itineraries/[id].tsx`)

- ScrollView với phần thông tin chung ở trên
- Tabs ngày (horizontal scroll nếu nhiều ngày)
- Mỗi ngày: danh sách item có thể kéo thả
- Modal thêm địa điểm: tìm kiếm + nhập tự do

---

## 6. Validation & Xử lý lỗi

### Frontend validation:
- Tên lịch trình: bắt buộc, tối đa 255 ký tự
- Ngày bắt đầu <= Ngày kết thúc
- Mỗi item phải có ít nhất tên hoặc địa điểm hệ thống
- Ngày hợp lệ (nằm trong khoảng start_date — end_date)

### Backend validation:
- Kiểm tra quyền sở hữu (user_id trong token)
- Kiểm tra ngày hợp lệ
- Kiểm tra item hợp lệ (có tên hoặc location_id)
- Dùng transaction cho POST/PUT (rollback nếu lỗi)

### Thông báo lỗi:
- "Tên lịch trình không được để trống"
- "Ngày kết thúc phải sau ngày bắt đầu"
- "Địa điểm phải có tên hoặc chọn từ hệ thống"
- "Không tìm thấy lịch trình" (404)
- "Bạn không có quyền chỉnh sửa lịch trình này" (403)

---

## 7. Ước tính thời gian

| Phần | Thời gian |
|------|-----------|
| Database: Tạo 2 bảng | 15 phút |
| Backend: 6 API endpoints | 2 giờ |
| Website: Trang danh sách | 1 giờ |
| Website: Trang tạo/sửa | 2 giờ |
| Mobile: API client + store | 30 phút |
| Mobile: Card trên Dashboard | 30 phút |
| Mobile: Trang danh sách | 1 giờ |
| Mobile: Trang tạo/sửa | 2 giờ |
| Test toàn bộ | 1 giờ |
| **Tổng** | **~10.5 giờ** |

---

## 8. Tương lai (không làm ngay)

- **AI gợi ý lịch trình:** User nhập điểm đến + số ngày → AI gợi ý danh sách địa điểm
- **Chia sẻ lịch trình:** Thêm cột `share_token`, tạo link công khai
- **Kết nối check-in:** Khi user check-in tại địa điểm trong lịch trình → tự động đánh dấu đã đến
- **Thông báo nhắc nhở:** Nhắc user trước chuyến đi 1 ngày
- **Xuất PDF/ảnh:** Xuất lịch trình thành file đẹp để lưu hoặc chia sẻ
