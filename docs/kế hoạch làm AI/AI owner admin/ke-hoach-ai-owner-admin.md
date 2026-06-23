# Kế Hoạch Triển Khai AI Cho Owner & Admin (Self-Trained NLP Model)

**Ngày tạo:** 2026-06-24
**Phạm vi:** Trình quản lý trên Website (Web Dashboard).
**Phương pháp kỹ thuật:** Kỹ thuật Học máy liên tục (Continuous Learning) với mô hình Phân loại ý định (NLP Intent Classification) tự huấn luyện bằng Python. Tuyệt đối không dùng API bên ngoài để khắc phục hạn chế về quota và thể hiện chiều sâu kỹ thuật.

---

## 1. Tầm Nhìn Kỹ Thuật (Thesis Highlight)
Thay vì làm một con Chatbot nói chuyện phiếm dựa vào API bên ngoài, AI dành cho Owner/Admin sẽ là một **AI Thực thi Lệnh (Action-oriented AI)**. Mô hình này đóng vai trò như một "Người phiên dịch", đọc lệnh của sếp và chuyển thành các Action để hệ thống thực thi. 

---

## 2. Kiến Trúc Hệ Thống (Microservices)

Dự án sẽ được mở rộng thành kiến trúc Microservices với một thư mục mới có tên là `service` nằm ngang hàng với các thư mục hiện tại:

```text
TravelCheckinApp/
├── backend/       (Node.js - Chuyên xử lý API, Database, Logic Web)
├── website/       (React - Giao diện Web Admin/Owner)
├── mobile/        (Expo - App điện thoại cho Tourist)
└── service/       (Python - Bộ não AI xử lý ngôn ngữ tự nhiên)
```

### Luồng chạy thực tế (Runtime Flow)
1. **Website (Port 5173):** Owner gõ *"Khóa phòng VIP ngày mai"*.
2. **Backend Node.js (Port 3000):** Nhận được chuỗi text, gọi API nội bộ sang Python.
3. **AI Python (Port 5000):** Đọc text, chạy model đã train, trả về JSON bóc tách thực thể (NER): `{"intent": "KHOA_PHONG", "entities": {"loai": "VIP", "thoi_gian": "ngay_mai"}}`.
4. **Backend Node.js:** Nhận JSON, gọi hàm SQL `UPDATE` khóa phòng, sau đó báo về cho Website: *"Đã khóa phòng thành công!"*.

---

## 3. Các Nhóm Lệnh (Intents) & Thực Thể (Entities) Cần Huấn Luyện

### 3.1. Nhóm Lệnh Quản lý Dịch vụ
- **Intent: `lock_room`** (Khóa phòng/bàn)
  - *Mẫu huấn luyện:* "Khóa phòng VIP 1 ngày mai", "Chặn đặt bàn số 5 tối nay".
  - *Entity cần trích xuất:* Loại dịch vụ (Phòng/Bàn), Thời gian (Ngày mai/Tối nay).
- **Intent: `create_voucher`** (Tạo khuyến mãi)
  - *Mẫu huấn luyện:* "Tạo 1 voucher cho tất cả owner giảm 20% tối đa 500k".
  - *Entity cần trích xuất:* Mục tiêu (Tất cả owner), Tỷ lệ giảm (20%), Tối đa (500k).

### 3.2. Nhóm Lệnh Hỗ trợ & Thống kê
- **Intent: `get_revenue`** (Xem doanh thu): "Hôm nay có bao nhiêu đơn đặt phòng?"
- **Intent: `auto_reply_review`** (Trả lời đánh giá): "Tạo câu xin lỗi cho review 1 sao này giúp tôi."

---

## 4. Chi Tiết Môi Trường Cài Đặt (Tech Stack Setup)

Để thư mục `service` chạy được, cần cài đặt môi trường Python chuẩn mực:

1. **Tạo môi trường ảo (Virtual Environment):**
   ```bash
   cd service
   python -m venv venv
   source venv/bin/activate  # (hoặc venv\Scripts\activate trên Windows)
   ```
2. **Cài đặt các thư viện lõi (requirements.txt):**
   ```bash
   pip install scikit-learn pandas numpy flask flask-cors
   ```
   - `scikit-learn`: Thuật toán Machine Learning (SVM / Naive Bayes + TF-IDF) cực nhẹ, không cần GPU.
   - `flask`: Tạo web server API nội bộ mở cổng 5000.
   - `pandas`, `numpy`: Xử lý dữ liệu CSV.

---

## 5. Cơ Chế Tự Học Liên Tục (Continuous Learning)

### Cập nhật Database
Tạo thêm 2 bảng mới trong MySQL:
1. `owner_ai_history`: Lưu lại lịch sử đoạn chat của Owner và AI.
2. `ai_training_data`: Lưu kho dữ liệu huấn luyện thô.

### Cơ chế Feedback Loop (Học qua sửa lỗi)
- Khi AI thực thi sai ý, Owner có thể chat: *"Sai rồi, ý tôi là xóa chứ không phải tạo"*.
- Backend nhận dạng "Lỗi" (Correction Intent), tự động Rollback thao tác trước đó. Đồng thời nhét câu nói gây hiểu nhầm kèm nhãn đúng vào bảng `ai_training_data`.
- **Retrain Button:** Trên giao diện Admin có nút **"Cập Nhật Trí Tuệ AI"**. Admin bấm nút -> Node.js gọi Python lôi toàn bộ dữ liệu từ DB ra trộn và train đè lên model cũ. AI sẽ ngày càng khôn lên và nhớ được từ lóng của từng người.

---

## 6. Kế Hoạch Các Bước Tiến Hành (Workflow)

- **Bước 1:** Tạo folder `service` và cài đặt môi trường Python.
- **Bước 2:** Lập 1 file CSV khoảng 100-200 câu lệnh mẫu phân theo nhóm Intent. Nhập file này vào bảng `ai_training_data`.
- **Bước 3:** Viết script `train.py` (đọc dữ liệu từ DB, huấn luyện bằng SVM, lưu ra file `intent_model.pkl`).
- **Bước 4:** Viết script `app.py` (tạo API Flask cổng 5000 để Node.js gọi sang).
- **Bước 5:** Trong Node.js, tạo Controller mới chuyên nhận lệnh từ Frontend, gọi qua cổng 5000, sau đó chạy SQL tương ứng để thực thi lệnh.
