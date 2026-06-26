# Kế hoạch Thiết kế lại Giao diện Xác thực (Auth UI Redesign)

Tài liệu này quy định bản thiết kế (mockup logic) và quy trình thực hiện việc nâng cấp giao diện Đăng nhập / Đăng ký cho cả Website và Mobile App, dựa trên nguyên mẫu (blueprint) màu xanh dương đám mây. ĐỒNG THỜI cho phép Admin cấu hình linh hoạt (Dynamic Background) và xem trước (Preview) giao diện ngay trên trang Quản trị.

## 1. Phân tích Nguyên mẫu (Blueprint Analysis)

- **Ngôn ngữ thiết kế:** Hiện đại, chia mảng không gian (Split Layout) cho Website và Xếp chồng (Stacked) cho Mobile. Có chi tiết uốn lượn hình đám mây tạo sự mềm mại.
- **Màu sắc chủ đạo:** 
  - Nền mảng màu: Có thể tùy chỉnh từ Admin (Mặc định: Gradient xanh dương đậm sang nhạt `from-blue-700 to-blue-500`).
  - Màu nền Form: Trắng tinh (`bg-white`).
  - Màu nhấn (Nút bấm): Xanh dương trơn (`bg-blue-600`).
- **Typograpy:** Sạch sẽ, sử dụng font Sans-serif cơ bản, tiêu đề in đậm.
- **Thành phần đặc trưng:**
  - Logo nổi bật trên nền xanh.
  - Border của Form Input chỉ là một đường gạch chân mỏng (Underline variant) thay vì ô vuông thô cứng.

## 2. Tính năng Admin (Quản trị Hệ thống)

**File liên quan:** `website/src/pages/Admin/Settings.tsx`

**Chi tiết Triển khai:**
- Bổ sung giao diện tải lên (Upload) hình ảnh / chọn màu Gradient cho **Auth Background**.
- Xây dựng vùng **Preview (Xem trước)**:
  - Render một khung giả lập màn hình Desktop (tỷ lệ 16:9) hiển thị form Login đè lên ảnh nền vừa chọn.
  - Render một khung giả lập màn hình Điện thoại (tỷ lệ 9:16) hiển thị form Login đè lên ảnh nền.
- Gọi API `updateSystemSettings` để lưu giá trị `auth_bg_image` vào bảng `system_settings` trong MySQL.

## 3. Kiến trúc Giao diện Website (React + Tailwind)

**Các file sẽ thay đổi:**
- `website/src/pages/Auth/Login.tsx`
- `website/src/pages/Auth/Register.tsx`

**Chi tiết Triển khai:**
- Bao bọc toàn bộ màn hình bằng một `div` Flexbox toàn màn hình (`h-screen w-full`).
- **Nửa bên trái (40% - 50% width):** 
  - Gọi API `getSystemSettings` để lấy ảnh nền do Admin cài đặt.
  - Chứa Logo, Slogan.
  - Áp dụng kỹ thuật SVG để tạo đường viền mây sóng lượn (Cloud divider) nối với phần trắng.
- **Nửa bên phải (Trắng):**
  - Căn giữa nội dung Form.
  - Thay đổi Input của Ant Design thành kiểu `variant="borderless"` và tự thêm `border-b` để tạo đường gạch ngang.
  - Nút Đăng nhập/Đăng ký nằm cạnh nhau bo góc tròn (Một nút đặc màu xanh, một nút viền Outline).

## 4. Kiến trúc Giao diện Mobile (React Native / Expo)

**Các file sẽ thay đổi:**
- `mobile/app/(auth)/sign-in.tsx`
- `mobile/app/(auth)/sign-up.tsx`

**Chi tiết Triển khai:**
- Bọc bằng `ScrollView` hoặc `KeyboardAvoidingView`.
- **Phần Header (1/3 màn hình trên):**
  - Fetch cấu hình từ API để hiển thị hình nền / màu nền do Admin đã cài.
  - Hiện Logo giữa màn hình.
  - Có module `Svg` hình ảnh đám mây uốn lượn ở mép dưới của Header vắt ngang màn hình.
- **Phần Body Form (2/3 màn hình dưới):**
  - Hình nền trắng.
  - Khung Input sẽ bỏ border viền vuông, chỉ giữ Border viền dưới (Underline).
  - Nút bấm bo góc tròn hoàn toàn.

## 5. Các bước thực hiện (Roadmap)
1. Thống nhất sử dụng SVG để vẽ họa tiết mây cho chân thực.
2. Code chức năng Admin Cấu hình + Xem trước giao diện.
3. Code lại giao diện Website (Login & Register) có móc nối API setting.
4. Code lại giao diện Mobile App có móc nối API setting.
5. Kiểm tra tương thích các màn hình (Responsive).
