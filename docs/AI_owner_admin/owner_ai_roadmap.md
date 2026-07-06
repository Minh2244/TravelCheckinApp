# Lộ trình hoàn thiện AI cho Owner (3 Giai đoạn)

Dựa trên yêu cầu, hệ thống AI dành cho Owner sẽ được phát triển theo 3 giai đoạn để đảm bảo tính ổn định.

## Nguyên tắc chung
- Tất cả chức năng phải kèm theo **thời gian cụ thể**.
- Nếu thiếu tham số (VD: thiếu khoảng thời gian), AI phải chuyển intent sang `unknown` và hỏi lại người dùng (Slot-filling).
- Luôn hiển thị **Bản xem trước (Preview)** để Owner xác nhận trước khi thực thi các lệnh thay đổi dữ liệu (Dùng `answer` chứa Markdown preview).
- Phân quyền: Xác thực phải được xử lý ở `actionExecutor.ts` (kiểm tra `actor_user_id` và `role`).

---

## Phase 1: Thống kê & Báo cáo Cơ bản (ĐÃ HOÀN THÀNH)
Tập trung vào việc giúp Owner đọc và hiểu dữ liệu kinh doanh.

1. **Số lượng đơn hoàn thành & Hủy (`owner_get_order_stats`):**
   - Đơn tại quầy: Đếm trong bảng `pos_orders` (hoàn thành: `status IN ('paid', 'completed')`, hủy: `status = 'cancelled'`).
   - Đơn online: Đếm trong bảng `hotel_stays` (hoàn thành: `status IN ('inhouse', 'checked_out')`, hủy: `status = 'cancelled'`).
2. **Cơ cấu doanh thu (`owner_get_revenue_structure`):** 
   - Truy vấn bảng `payments` (`status = 'completed'`) JOIN `locations` để nhóm theo `location_type` (khách sạn, ăn uống, du lịch).
3. **Top Dịch vụ (`owner_get_top_services`):**
   - Bảng `pos_order_items` JOIN `pos_orders` JOIN `services`. Gom nhóm theo `service_name`, sắp xếp theo số lượng bán (`quantity`) giảm dần.
4. **Phân tích đánh giá (`owner_analyze_reviews`):**
   - Đếm số lượng và tính trung bình rating từ bảng `reviews`.

---

## Phase 2: Quản lý Vận hành & Tương tác (Hành động thay đổi) [SẮP TRIỂN KHAI]
Tập trung vào các chức năng cho phép Owner tương tác và thay đổi dữ liệu hệ thống thông qua AI.

1. **Quản lý Đánh giá (`owner_review_reply_draft` & `owner_review_reply_publish`):**
   - **Kỹ thuật:** AI query bảng `reviews` để lấy review chưa có `reply`. Sau đó dùng `owner_review_reply_draft` để tạo câu trả lời nháp, và `owner_review_reply_publish` để `UPDATE reviews SET reply_content = ?`.
2. **Quản lý Đặt chỗ (`owner_view_bookings`):**
   - **Kỹ thuật:** AI chỉ được phép đọc và báo cáo (`owner_view_bookings`). KHÔNG cho phép AI hủy đơn hay duyệt đơn (an toàn dữ liệu, chính sách không hoàn tiền).
3. **Quản lý Voucher (`owner_voucher_draft`):**
   - **Kỹ thuật:** Đã hỗ trợ tạo bản nháp với `discount_value`. Bổ sung API `owner_voucher_publish` lưu vào bảng `vouchers`.
4. **Quản lý Nhân viên (`owner_manage_employees`):**
   - **Kỹ thuật:** Khóa tài khoản nhân viên (ban) thay vì xóa cứng. Dùng lệnh `UPDATE users SET status='locked', deleted_at=NOW()` để bảo toàn tên người tạo trên các hóa đơn cũ.
   - **Thay đổi luồng tạo mới:** Tạo nhân viên mặc định lấy số điện thoại làm mật khẩu (bỏ field password).

---

## Phase 3: Đối soát Nâng cao & Cải thiện Ngữ nghĩa (Slot-Filling)
Hoàn thiện các tính năng đòi hỏi sự chuẩn xác cao và nâng cấp "độ khôn" của AI.

1. **Báo cáo Hoa hồng (`view_commissions`):**
   - **Kỹ thuật:** Query `owner_balances` hoặc tính tổng hoa hồng dựa trên `commission_rate` trong bảng `locations`. (Tuyệt đối không cho phép thanh toán).
2. **Hệ thống Slot-Filling khép kín:**
   - Hoàn thiện luồng kiểm tra logic ở `prompt_templates.py`.
