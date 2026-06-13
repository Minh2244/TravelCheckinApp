# Kế Hoạch Tính Năng AI Cho User (Chatbox + Lịch Trình)

**Ngày tạo:** 2026-06-07
**Phạm vi:** Website trước, Mobile sau (dùng chung API)

---

## 1. Tổng Quan

Tích hợp AI vào chatbox cho phép user:
- Chat bình thường với AI
- Yêu cầu AI tạo lịch trình du lịch
- Lưu, chỉnh sửa, xóa lịch trình đã tạo
- Sử dụng lịch trình từng bước (step-by-step) với thời tiết + khoảng cách

---

## 2. Luồng Hoạt Động

### 2.1 Tạo lịch trình
```
User: "Lên lịch trình Đà Nẵng 3 ngày"
→ AI phân tích yêu cầu
→ Check DB trước (địa điểm owner đã curated)
→ Nếu thiếu → gọi OpenStreetMap/Nominatim tìm thêm (đã có sẵn)
→ Gọi Gemini API viết lịch trình (phong cách chuyên gia)
→ Hiển thị lịch trình cho user (có map, thời gian, mô tả)
→ User bấm "Lưu" → lưu vào DB
```

### 2.2 Sử dụng lịch trình
```
User chọn lịch trình đã lưu
→ Hiển thị bước 1: địa điểm, thời gian dự kiến, thời tiết, khoảng cách
→ User đến nơi → bấm "Xác nhận"
→ Hiển thị bước 2
→ Lặp lại cho đến khi hết lịch trình
```

### 2.3 Chỉnh sửa / Xóa
- User có thể chỉnh sửa lịch trình AI đã tạo
- User có thể xóa lịch trình

---

## 3. Nguồn Dữ Liệu

| Ưu tiên | Nguồn | Ghi chú |
|---------|-------|---------|
| 1 (ưu tiên) | Database (MySQL) | Địa điểm do owner tìm, chất lượng cao |
| 2 (fallback) | OpenStreetMap/Nominatim | Khi DB không có, tự động tìm thêm (đã có sẵn trong dự án) |
| 3 | Gemini AI | Viết mô tả, tạo lịch trình từ data |

**Quy tắc:** DB luôn được check trước. Địa điểm owner có giá trị hơn Google tự tìm.

---

## 4. Kiến Trúc (Architecture)

### 4.1 Không cần Python riêng
- Backend hiện tại: **Node.js + TypeScript + Express**
- Đã có sẵn: `@google/generative-ai` (Gemini SDK)
- Đã có sẵn: `aiRoutes.ts`, `aiController.ts`, `ai_chat_history` table
- **→ Chỉ cần sửa code Node.js hiện tại, KHÔNG cần tạo Python service mới**

### 4.2 Flow kiến trúc
```
Website (Next.js)  ──┐
                      ├──→  Backend Node.js (hiện tại)  ──→  MySQL + Google Places + Gemini API
Mobile (Expo)      ──┘
```

### 4.3 API Endpoints (dự kiến)
```
POST   /api/ai/chat              # Chat bình thường
POST   /api/ai/itinerary         # Tạo lịch trình mới
GET    /api/ai/itinerary         # Lấy danh sách lịch trình đã lưu
GET    /api/ai/itinerary/:id     # Lấy chi tiết 1 lịch trình
PUT    /api/ai/itinerary/:id     # Chỉnh sửa lịch trình
DELETE /api/ai/itinerary/:id     # Xóa lịch trình
POST   /api/ai/itinerary/:id/save # Lưu lịch trình (khi user xác nhận)
```

---

## 5. Triển Khai Theo Phase

### Phase A — MVP (Rule-based)
- Chatbox cơ bản với Gemini API
- Tạo lịch trình đơn giản (user chọn type → AI gợi ý)
- DB lookup → Gemini viết mô tả
- Lưu/chỉnh sửa/xóa lịch trình
- **Độ khó: Trung bình**

### Phase B — Nâng cấp (Smart)
- Phân tích sở thích user từ lịch sử booking/favorite
- Thời tiết thực tế theo ngày đi
- Tối ưu khoảng cách di chuyển (route optimization)
- Giờ mở cửa, thời gian tham quan ước tính
- Step-by-step navigation khi sử dụng lịch trình
- **Độ khó: Cao hơn**

### Phase C = A → B
Làm Phase A trước → ship → thu thập data user → upgrade lên Phase B

---

## 6. API Keys

### 6.1 Gemini API Key
- **Tạo tại:** [Google AI Studio](https://aistudio.google.com/apikey)
- **Hạn sử dụng:** Không hết hạn (dùng mãi)
- **Free tier:** 1,500 requests/ngày, 1M token/ngày
- **Chi phí:** Miễn phí
- **Đủ cho dự án:** ✅

### 6.2 OpenStreetMap/Nominatim (Đã có sẵn)
- **Không cần tạo mới** — đã tích hợp sẵn trong `geoController.ts`
- **Chức năng:** Tìm địa điểm (`geoSearch`), reverse geocoding (`geoReverse`)
- **Chi phí:** Miễn phí hoàn toàn
- **Không cần thẻ tín dụng**
- **Đủ cho dự án:** ✅

---

## 7. Hiệu Suất (RAM / CPU)

- AI chạy trên **máy Google**, không chạy trên máy local
- Gọi API chỉ cần gửi/nhận HTTP request → **gần như không tốn RAM thêm**
- Node.js backend hiện tại đã chạy → thêm AI chỉ tăng ~5-10MB
- **→ Không ảnh hưởng đến hiệu suất máy**

---

## 8. Tóm Tắt

| Hạng mục | Chi tiết |
|----------|---------|
| Tính năng | Chatbox AI + Tạo/Sửa/Xóa lịch trình du lịch |
| Platform | Website trước, Mobile sau (dùng chung backend) |
| Backend | Node.js hiện tại (không cần Python riêng) |
| AI Model | Gemini 2.0 Flash (free tier) |
| Data source | DB (ưu tiên) + OpenStreetMap/Nominatim (fallback, đã có sẵn) |
| API Keys | Chỉ cần Gemini API (đã có key mới) |
| RAM/CPU | Không ảnh hưởng (AI chạy trên cloud) |
| Triển khai | Phase A (MVP) → Phase B (Smart) |

---

## 9. Bước Tiếp Theo

1. ✅ Tạo Gemini API key mới (đã có)
2. ✅ OpenStreetMap/Nominatim đã có sẵn (không cần tạo mới)
3. Thiết kế database tables cho itinerary
4. Sửa `aiController.ts` kết nối Gemini thật
5. Thêm logic tạo lịch trình
6. Build frontend chatbox UI
7. Test trên website
8. Deploy cho mobile dùng chung
