# Lộ trình hoàn thiện AI cho Admin (2 Giai đoạn)

Dựa trên nguyên tắc phát triển từ Owner (làm Owner trước, Admin sau), hệ thống AI dành cho Admin sẽ tập trung vào bức tranh toàn cảnh và quản trị hệ thống.

## Nguyên tắc chung
- Phân quyền tối cao: Backend phải xác thực role `admin` cho mọi lệnh.
- Các hành động mang tính chất thay đổi hệ thống (tạo voucher toàn sàn, khóa user) bắt buộc phải có bước xác nhận (Preview & Confirm).
- Giữ nguyên kiến trúc Slot-Filling khép kín tương tự Owner.

---

## Phase 1: Giám sát Hệ thống & Báo cáo Toàn cầu
Tập trung vào việc giúp Admin có cái nhìn bao quát về tình hình kinh doanh của toàn sàn.

1. **Thống kê Doanh thu Toàn sàn:** 
   - **Kỹ thuật:** Query bảng `payments` (`status = 'completed'`).
2. **Theo dõi Tăng trưởng User:** 
   - **Kỹ thuật:** Query đếm số lượng bản ghi mới trong bảng `users` (`created_at` trong khoảng thời gian).
3. **Kiểm duyệt Địa điểm (Locations):** 
   - **Kỹ thuật:** Lấy danh sách địa điểm có `status = 'pending'` trong bảng `locations`. Admin ra lệnh duyệt thì gọi Action `admin_location_review(location_id)` -> `UPDATE locations SET status = 'active'`.
4. **Quản lý Owner:** 
   - **Kỹ thuật:** Query bảng `users` (`role = 'owner'`) JOIN `locations` để xem số lượng địa điểm, JOIN `payments` để tính tổng doanh thu mang lại cho sàn.

---

## Phase 2: Công cụ Chiến lược & Quản lý Chuyên sâu
Tập trung vào các công cụ điều tiết thị trường và xử lý vi phạm.

1. **Quản lý Voucher Hệ thống:** 
   - **Kỹ thuật:** Query bảng `vouchers` (loại voucher áp dụng toàn sàn). Cho phép tạo và báo cáo hiệu quả voucher (lượt dùng từ bảng `bookings`/`pos_orders`).
2. **Quản trị Người dùng & Vi phạm (`admin_user_lock`):** 
   - **Kỹ thuật:** UPDATE bảng `users` (ví dụ set `is_locked = 1` hoặc thay đổi `status = 'banned'`). Cần cấm xóa tài khoản để bảo toàn dữ liệu lịch sử.
3. **Điều chỉnh Chính sách Hoa hồng:** 
   - **Kỹ thuật:** Cho phép Admin set lại `commission_rate` trong bảng `locations` cho một Owner hoặc toàn hệ thống.
