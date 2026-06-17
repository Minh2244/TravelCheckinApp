# Kế hoạch chi tiết Thiết kế lại Giao diện Xác thực Web & Mobile (Đồng bộ ảnh nền động)

Tài liệu này trình bày kế hoạch thiết kế lại toàn bộ hệ thống các trang xác thực (Đăng nhập, Đăng ký, Nhập OTP, Quên mật khẩu) trên cả **Website** và **Mobile App** theo phong cách Split Card cao cấp, tích hợp hình ảnh nền động do Admin quản lý.

---

## Giai đoạn 1: Chuẩn bị & Cấu hình API Backend
*Ở giai đoạn này, chúng ta đảm bảo hệ thống API backend hoạt động chuẩn xác và sẵn sàng cung cấp dữ liệu ảnh nền.*

### 1. Công việc cần thực hiện
- Xác minh tính chính xác của endpoint `/api/auth/background` trên Backend.
- Đảm bảo cơ chế lưu trữ ảnh trong bảng `system_settings` hoạt động bình thường cho cả trường hợp nhập URL trực tiếp và tải lên file (được lưu tại thư mục `/uploads/`).
- Kiểm tra tính năng fallback: Nếu chưa cấu hình ảnh nền trong database, API phải trả về `image_url` là `null` để client tự động sử dụng giao diện mặc định tối giản.

### 2. Kết quả đạt được
- API `/api/auth/background` hoạt động ổn định, trả về đúng cấu trúc dữ liệu:
  ```json
  {
    "success": true,
    "data": {
      "source": "default",
      "image_url": "/uploads/settings/...jpg" or null,
      "title": null
    }
  }
  ```

---

## Giai đoạn 2: Thiết kế lại Giao diện Web Client (React & Ant Design & Tailwind CSS)
*Áp dụng phong cách Split Card cao cấp cho toàn bộ 3 trang Auth trên trình duyệt.*

### 1. Công việc cần thực hiện
- **Thiết kế Split Card Layout**:
  - Tạo khung chứa Split Card với kích thước tối đa rộng `960px`, cao `580px`, bo góc `16px`, đổ bóng sâu `shadow-2xl`.
  - **Nửa bên trái (45%)**: Panel trực quan hiển thị ảnh nền động. Phủ một lớp gradient tối mịn (`rgba(15, 23, 42, 0.45)`) để tăng độ tương phản. Hiển thị Logo máy bay, Tên ứng dụng `TravelCheckin` và Slogan `"Khám phá hành trình tuyệt vời của bạn"` màu trắng nổi bật.
  - **Nửa bên phải (55%)**: Form điền thông tin trên nền trắng tinh khiết `#ffffff`.
- **Áp dụng cho các trang**:
  - `website/src/pages/Auth/Login.tsx`: Gọi API lấy ảnh nền, lồng Form vào layout Split Card.
  - `website/src/pages/Auth/Register.tsx`: Lấy ảnh nền, áp dụng layout Split Card, thêm hiệu ứng chuyển bước OTP nhẹ nhàng (`animate-fade-in`).
  - `website/src/pages/Auth/ForgotPassword.tsx`: Lấy ảnh nền, áp dụng layout Split Card, thêm hiệu ứng trượt chuyển bước giữa các giai đoạn khôi phục mật khẩu.
- **Xử lý Responsive (Mobile Web)**:
  - Sử dụng Tailwind class `hidden md:flex` để ẩn panel visual bên trái khi màn hình rộng dưới `768px` (thiết bị di động). Lúc này, form nhập liệu bên phải sẽ chiếm 100% diện tích màn hình để đảm bảo trải nghiệm tốt nhất trên trình duyệt di động.
- **Xử lý trạng thái Fallback (Không có ảnh nền)**:
  - Nếu API trả về ảnh nền là `null` hoặc lỗi tải ảnh, panel bên trái sẽ tự động chuyển sang màu nền xám nhẹ `#f8fafc`. Logo máy bay và tên app sẽ tự động chuyển sang màu xanh dương thương hiệu để đảm bảo tính mỹ thuật.

### 2. Kết quả đạt được
- Giao diện 3 trang Auth trên Web trông cao cấp, thanh lịch, đạt chuẩn Split Card.
- Responsive mượt mà, hiển thị hoàn hảo trên cả Desktop và trình duyệt di động.
- Trạng thái chưa cấu hình ảnh nền hiển thị đồng bộ màu xám thanh lịch tối giản.

---

## Giai đoạn 3: Cập nhật Live Preview Mockup của Admin
*Giúp Admin nhìn thấy chính xác giao diện người dùng sẽ hiển thị khi họ đổi ảnh nền.*

### 1. Công việc cần thực hiện
- Chỉnh sửa file `website/src/pages/Admin/Settings.tsx` tại phần hiển thị xem trước (Live Preview) trong modal đổi ảnh nền.
- Cập nhật cấu trúc hiển thị của preview từ dạng thẻ đè ở giữa (Center Card) sang dạng mô phỏng Split Card thu nhỏ:
  - Trái (45%): Ảnh nền động đã chọn kèm theo logo/slogan thu nhỏ.
  - Phải (55%): Form mockup trắng đơn giản.
- Đảm bảo các thuộc tính zoom (phóng to/thu nhỏ) và kéo thả căn chỉnh vị trí ảnh (crop tool) hoạt động chuẩn xác với khung preview dạng Split Card này.

### 2. Kết quả đạt được
- Giao diện Live Preview trong Modal đổi ảnh nền của Admin phản ánh chính xác cấu trúc Split Card thực tế của người dùng.
- Thao tác kéo thả và phóng to ảnh của Admin được hiển thị trực quan và chính xác.

---

## Giai đoạn 4: Thiết kế lại Giao diện Mobile App (React Native & Expo Router)
*Áp dụng phong cách Split dọc cao cấp trên điện thoại.*

### 1. Công việc cần thực hiện
- **Cấu hình Status Bar**:
  - Tại các file Auth, cấu hình `<StatusBar style="light" />` để chữ hiển thị trên thanh trạng thái có màu trắng, hiển thị đẹp mắt đè lên phần banner.
- **Thiết kế Split dọc Layout**:
  - **Banner trên (35% chiều cao màn hình)**: Hiển thị hình ảnh nền động. Nếu chưa cấu hình ảnh, hiển thị nền xám nhẹ `#f1f5f9`. Đè lên trên là Logo máy bay, tên ứng dụng `TravelCheckin` và slogan trắng: `"Khám phá hành trình tuyệt vời của bạn"`.
  - **Form bên dưới (65% chiều cao màn hình)**: Thẻ card trắng bo góc tròn trên (`borderTopLeftRadius: 24`, `borderTopRightRadius: 24`), kéo đè nhẹ lên banner (`marginTop: -20`) để tạo độ sâu.
- **Áp dụng cho các màn hình**:
  - `mobile/app/login.tsx`: Gọi API lấy ảnh nền, tái cấu trúc Layout (Banner ở trên, Card Form ở dưới).
  - `mobile/app/register.tsx`: Gọi API lấy ảnh nền, áp dụng cấu trúc banner + form card. Tích hợp hiệu ứng điều khiển mượt mà giữa bước điền thông tin và bước nhập mã xác thực OTP.
  - `mobile/app/forgot-password.tsx`: Gọi API lấy ảnh nền, áp dụng layout tương tự cho luồng 3 bước.
- **Hiệu ứng chuyển trang (Transition)**:
  - Cấu hình điều hướng của Expo Router sử dụng hiệu ứng trượt ngang (Slide) hoặc mờ dần (Fade) tự nhiên để nâng cao trải nghiệm người dùng.

### 2. Kết quả đạt được
- Toàn bộ luồng Auth trên Mobile App được đồng bộ ảnh nền động.
- Giao diện Split dọc cao cấp, có chiều sâu với card form đè nhẹ lên banner.
- Trải nghiệm mượt mà với hiệu ứng chuyển màn hình tự nhiên.

---

## Giai đoạn 5: Kiểm tra, Tối ưu & Bàn giao
*Đảm bảo code chạy đúng chuẩn kỹ thuật và không có lỗi phát sinh.*

### 1. Công việc cần thực hiện
- **Kiểm tra biên dịch & TypeScript**:
  - Chạy kiểm tra TypeScript trên Web: `npx tsc --noEmit` ở thư mục `website`.
  - Chạy kiểm tra TypeScript trên Mobile: `npx tsc --noEmit` ở thư mục `mobile`.
- **Kiểm tra thủ công**:
  - Đăng nhập vào trang Admin, thực hiện đổi ảnh nền bằng cả 2 cách (nhập URL và Upload ảnh mới).
  - Kiểm tra xem ảnh nền trên Web và Mobile có được cập nhật đồng bộ ngay lập tức hay không.
  - Test giao diện trên nhiều thiết bị giả lập và responsive để kiểm tra tính hiển thị của text, form và độ tương phản.
  - Xóa ảnh nền trên Admin để xác nhận trạng thái fallback mặc định (nền xám tối giản) hoạt động đúng trên mọi nền tảng.

### 2. Kết quả đạt được
- Dự án không có lỗi TypeScript hoặc lỗi cú pháp.
- Đồng bộ ảnh nền động hoạt động trơn tru 100% trên cả Web và Mobile.
- Giao diện đẹp, cao cấp và hoàn thành đúng yêu cầu đề ra.
