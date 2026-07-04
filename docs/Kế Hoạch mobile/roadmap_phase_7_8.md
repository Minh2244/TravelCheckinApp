# Kế hoạch Thực thi: Giai đoạn 7 & Giai đoạn 8

Tài liệu này trình bày phương án kiến trúc, công nghệ và chi tiết luồng dữ liệu (Data flow) để hiện thực hóa các tính năng nâng cao thuộc Phase 7 (Hệ thống Khách sạn/Nhà hàng dạng Kéo-thả) và Phase 8 (Tích hợp AI Google Gemini).

---

## 🚀 Giai đoạn 7: Tinh chỉnh PMS Khách sạn & POS Nhà hàng (Kéo Thả)

### 1. Hotel PMS - Quản lý phòng dạng Lưới (Grid/Calendar View)
**Mục tiêu:** Giúp chủ khách sạn có cái nhìn tổng quan về tình trạng phòng trong tháng và dễ dàng đổi phòng/đổi ngày cho khách qua thao tác Drag & Drop.

- **Frontend (Web):**
  - Cài đặt thư viện `@dnd-kit/core` để hỗ trợ kéo thả trơn tru.
  - Xây dựng component `HotelPmsGrid`:
    - **Trục Y:** Danh sách các Phòng.
    - **Trục X:** Các ngày trong khoảng thời gian chọn.
    - **Block Đặt phòng:** Khối màu hiển thị trên lưới, kéo sang ngang để đổi ngày, kéo lên xuống để đổi phòng.
- **Backend:** 
  - Thêm API `PUT /api/owner/pms/bookings/:id/reschedule` để xử lý logic dời lịch/đổi phòng.
  - Đảm bảo logic kiểm tra trùng lịch (Conflict Resolution) nghiêm ngặt trước khi cập nhật DB.

### 2. Restaurant POS - Sơ đồ Bàn ăn (Floor Plan)
**Mục tiêu:** Mô phỏng không gian nhà hàng, quản lý trạng thái bàn (Trống, Đang phục vụ, Đã đặt) bằng giao diện 2D.

- **Frontend (Web):**
  - Xây dựng component `RestaurantFloorPlan` (Canvas).
  - Chủ quán có thể thêm bàn mới (Vuông, Tròn, Chữ nhật), kéo thả sắp xếp vị trí (x, y) trên canvas.
  - Kéo bàn đang có khách đè lên bàn khác để **Gộp bàn (Merge table)**.
- **Backend & Database:**
  - Thêm bảng `restaurant_tables`: `(table_id, location_id, name, capacity, shape, pos_x, pos_y)`.
  - API `POST /api/owner/pos/tables` lưu layout sơ đồ quán.
  - API `POST /api/owner/pos/tables/merge` xử lý logic gộp bill và chỗ ngồi.

---

## 🤖 Giai đoạn 8: Tích hợp Trí tuệ Nhân tạo (Google Gemini AI)

### 1. Gợi ý lịch trình thông minh (Itinerary Planner) - Dành cho User
**Mục tiêu:** Tính năng "Hướng dẫn viên ảo" trên Mobile/Web.
- User nhập Prompt: *"Đi Đà Lạt 3 ngày 2 đêm, thích yên tĩnh, ngân sách 5 triệu"*.
- Backend gọi Google Gemini API (`gemini-1.5-flash`), ép AI trả về định dạng JSON gồm lịch trình chi tiết (Ngày 1, Ngày 2...).
- Frontend hiển thị dạng Timeline (Dòng thời gian dọc) tích hợp nút "Đặt chỗ ngay".

### 2. Phân tích Đánh giá (Review Sentiment Analysis) - Dành cho Owner
**Mục tiêu:** Tự động đọc và tóm tắt Insight từ hàng trăm nhận xét của khách hàng.
- Khi Owner vào trang Dashboard AI, Backend gom 100 review gần nhất gửi cho Gemini.
- Trả về JSON: Điểm hài lòng, Từ khóa khen nhiều nhất, Từ khóa phàn nàn nhiều nhất.
- Hiển thị lên biểu đồ để Owner cải thiện dịch vụ.

### 3. Owner AI Chatbot (Trợ lý tự động trả lời)
**Mục tiêu:** Trả lời tự động các câu hỏi cơ bản của khách qua Location Chat khi Owner vắng mặt.
- Khi nhận tin nhắn mới từ khách, nếu Owner bật "AI Assistant", hệ thống nhúng tin nhắn khách + thông tin địa điểm (Menu, Giờ mở cửa) gửi cho Gemini.
- Gemini sinh câu trả lời tự nhiên dưới tư cách nhân viên, Backend lưu tin nhắn vào DB và đẩy tới User qua WebSockets.
