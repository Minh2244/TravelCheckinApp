CHỨC NĂNG CHI TIẾT

1. Xác thực và tài khoản
   1.1 Đăng ký user

- Ai dùng: User.
- Mục đích: tạo tài khoản mới bằng email hoặc số điện thoại.
- Luồng: nhập thông tin cơ bản -> nhận OTP -> xác thực -> tài khoản ở trạng thái hoạt động.

  1.2 Đăng nhập

- Ai dùng: User, Owner, Employee, Admin.
- Mục đích: truy cập hệ thống theo vai trò.
- Luồng: nhập email/phone + mật khẩu -> hệ thống trả token -> chuyển về dashboard đúng role.

  1.3 Đăng nhập xã hội

- Ai dùng: User/Owner (nếu đã được cấp quyền).
- Mục đích: đăng nhập nhanh bằng Google/Facebook.
- Luồng: lấy email từ OAuth -> nếu đã có tài khoản thì gán role hiện có -> nếu chưa có thì tạo user mặc định.

  1.4 Quên mật khẩu

- Ai dùng: User/Owner/Employee/Admin.
- Mục đích: đặt lại mật khẩu qua OTP.
- Luồng: nhập email -> nhận OTP -> xác thực OTP -> đặt mật khẩu mới.

  1.5 Token và đăng xuất

- Ai dùng: tất cả vai trò.
- Mục đích: duy trì phiên làm việc và làm mới token khi cần.
- Luồng: backend cấp access/refresh token, hỗ trợ refresh và logout.

  1.6 Ảnh nền đăng nhập và app

- Ai dùng: Admin.
- Mục đích: thay đổi ảnh nền đăng nhập/app theo sự kiện.
- Luồng: upload ảnh -> lưu lịch sử -> chọn ảnh sử dụng -> áp dụng toàn hệ thống.

2. Admin (Back-office)
   2.1 Dashboard tổng quan

- Ai dùng: Admin.
- Nội dung: tổng user/owner/employee, số địa điểm hoạt động, check-in, doanh thu, hoa hồng, báo cáo chờ xử lý.

  2.2 Quản lý user

- Ai dùng: Admin.
- Chức năng: danh sách user, khóa/mở khóa, lịch sử đăng nhập, lịch sử tìm kiếm, yêu thích.

  2.3 Quản lý owner

- Ai dùng: Admin.
- Chức năng: duyệt owner, xem nhân viên owner, theo dõi vi phạm, gửi điều khoản hoạt động.

  2.4 Quản lý địa điểm

- Ai dùng: Admin.
- Chức năng: duyệt/từ chối địa điểm, ẩn địa điểm vi phạm, chỉnh tỷ lệ hoa hồng theo địa điểm.

  2.5 Quản lý check-in

- Ai dùng: Admin.
- Chức năng: xem danh sách check-in, xác thực hoặc đánh dấu thất bại, đối soát lịch sử.

  2.6 Quản lý thanh toán và hoa hồng

- Ai dùng: Admin.
- Chức năng: xác nhận thanh toán, tạo commission, theo dõi công nợ, đánh dấu đã thanh toán.

  2.7 Quản lý voucher hệ thống

- Ai dùng: Admin.
- Chức năng: tạo/sửa/xóa voucher hệ thống, theo dõi lượt dùng.

  2.8 Quản lý báo cáo và review

- Ai dùng: Admin.
- Chức năng: xử lý report, cảnh báo user/owner, xóa review vi phạm.

  2.9 SOS

- Ai dùng: Admin.
- Chức năng: xem danh sách SOS, cập nhật trạng thái xử lý.

  2.10 AI (quản trị)

- Ai dùng: Admin.
- Chức năng: bật/tắt AI, xem log và lịch sử chat AI.

  2.11 Push notification

- Ai dùng: Admin.
- Chức năng: gửi thông báo đến user/owner hoặc theo đối tượng.

  2.12 Cài đặt hệ thống

- Ai dùng: Admin.
- Chức năng: cấu hình hệ thống, cập nhật tài khoản ngân hàng nhận hoa hồng.

3. Owner (Back-office)
   3.1 Dashboard

- Ai dùng: Owner.
- Nội dung: tổng doanh thu, đơn chờ xử lý, công nợ hoa hồng, thông báo vận hành.

  3.2 Hồ sơ và ngân hàng

- Ai dùng: Owner.
- Chức năng: cập nhật thông tin, tài khoản nhận tiền, lịch sử đăng nhập.

  3.3 Quản lý địa điểm

- Ai dùng: Owner.
- Chức năng: tạo/sửa địa điểm, trạng thái hoạt động, ảnh và thông tin liên hệ.

  3.4 Quản lý dịch vụ và danh mục

- Ai dùng: Owner.
- Chức năng: tạo danh mục dịch vụ, tạo/sửa dịch vụ (phòng, món ăn, vé), tải ảnh.

  3.5 Quản lý booking

- Ai dùng: Owner.
- Chức năng: xem booking, cập nhật trạng thái, ghi chú.

  3.6 Quản lý thanh toán

- Ai dùng: Owner.
- Chức năng: tạo/lấy payment cho booking, theo dõi trạng thái thanh toán.

  3.7 Quản lý công nợ hoa hồng

- Ai dùng: Owner.
- Chức năng: xem công nợ, gửi yêu cầu thanh toán hoa hồng.

  3.8 Voucher

- Ai dùng: Owner.
- Chức năng: tạo/sửa/xóa voucher theo địa điểm, theo dõi lịch sử sử dụng.

  3.9 Review

- Ai dùng: Owner.
- Chức năng: trả lời review, ẩn review vi phạm, báo cáo user.

  3.10 Nhân viên

- Ai dùng: Owner.
- Chức năng: tạo/sửa/xóa nhân viên, gán quyền và địa điểm làm việc.

  3.11 Logs và thông báo

- Ai dùng: Owner.
- Chức năng: xem audit log, đọc và xóa thông báo.

  3.12 Cấu hình vận hành (POS/PMS)

- Ai dùng: Owner.
- Chức năng: cấu hình sơ đồ phòng/bàn, khu vực, vị trí (pos_x/pos_y), sắp xếp theo tầng/khu.

4. Front-office (Owner/Employee)
   4.1 Luồng vào vận hành

- Ai dùng: Owner, Employee.
- Owner: từ Dashboard chọn "Điều hướng" -> chọn địa điểm -> vào Front-office.
- Employee: đăng nhập xong đi thẳng vào Front-office theo địa điểm được gán.

  4.2 Trạng thái chuẩn

- Phòng: vacant, occupied, reserved, cleaning.
- Bàn: free, occupied, reserved.
- Vé: unused, used, void.
- Booking: pending, confirmed, cancelled, completed.

  4.3 Lưu trú (Hotel/Resort)

- Ai dùng: Owner, Employee.
- Giao diện: tab theo tầng + lưới phòng.
- Hành động:
  - Phòng trống: check-in tại quầy.
  - Phòng đang ở: thêm dịch vụ, gia hạn, thanh toán và trả phòng.
  - Phòng đã đặt: xác nhận khi khách đến.
  - Phòng dọn dẹp: cập nhật trạng thái sau khi vệ sinh.

  4.4 Ăn uống (Restaurant/Cafe)

- Ai dùng: Owner, Employee.
- Giao diện: sơ đồ bàn theo khu vực (pos_areas) và lưới bàn.
- Hành động:
  - Bàn trống: mở bàn và gọi món.
  - Bàn đã đặt: chuyển sang có khách khi khách đến.
  - Bàn có khách: cập nhật món, thanh toán tiền mặt hoặc chuyển khoản.

  4.5 Du lịch (Tourist)

- Ai dùng: Owner, Employee.
- Giao diện: nút quét vé, bán vé tại quầy, lịch sử soát vé trong ngày.
- Hành động:
  - Quét QR để xác thực vé đã mua.
  - Bán vé tại quầy (cash/transfer) và xuất danh sách vé.

  4.6 Lịch sử thanh toán vận hành

- Ai dùng: Owner, Employee.
- Chức năng: xem lịch sử thanh toán POS/PMS theo địa điểm.

5. User (Web/Mobile)
   5.1 Tìm kiếm địa điểm

- Ai dùng: User.
- Chức năng: tìm theo từ khóa, loại địa điểm, tỉnh thành; xem danh sách và bản đồ.

  5.2 Chi tiết địa điểm

- Ai dùng: User.
- Chức năng: xem ảnh, mô tả, dịch vụ, review, trạng thái hoạt động.

  5.3 Đặt dịch vụ

- Ai dùng: User.
- Chức năng: đặt phòng/bàn/vé, chọn ngày giờ, nhập voucher.

  5.4 Thanh toán và nhận QR

- Ai dùng: User.
- Chức năng: tạo payment cho booking, nhận QR VietQR, theo dõi trạng thái.

  5.5 Check-in

- Ai dùng: User.
- Chức năng: check-in tại địa điểm, lưu lịch sử check-in.

  5.6 Yêu thích và nhóm

- Ai dùng: User.
- Chức năng: lưu địa điểm yêu thích, tạo/join group để check-in nhóm.

  5.7 Review và báo cáo

- Ai dùng: User.
- Chức năng: đánh giá, upload ảnh, báo cáo địa điểm vi phạm.

  5.8 Nhật ký và lịch trình

- Ai dùng: User.
- Chức năng: ghi nhật ký, xem lịch trình đã lưu.

  5.9 AI chat

- Ai dùng: User.
- Chức năng: gửi prompt để nhận gợi ý. Hiện backend lưu log và phản hồi trạng thái bảo trì.

  5.10 SOS

- Ai dùng: User.
- Chức năng: gửi tọa độ khẩn cấp, ping cập nhật vị trí, dừng SOS.

  5.11 Thông báo và lịch nhắc

- Ai dùng: User.
- Chức năng: xem thông báo hệ thống, lịch nhắc booking.

6. AI Service (giai đoạn sau)
   6.1 Mục tiêu

- Cung cấp gợi ý thông minh, phát hiện gian lận, kiểm duyệt nội dung, phân tích hành vi.

  6.2 Các module chính

- Chatbot: RAG + LLM.
- Gợi ý địa điểm: collaborative filtering + content-based.
- Phát hiện gian lận check-in: anomaly detection.
- Kiểm duyệt nội dung: text classification.
- Nhận diện ảnh: vision model và so sánh embedding.
- Phân tích hành vi: dự báo xu hướng và churn.

  6.3 Nguyên tắc tích hợp

- Web/Mobile không gọi trực tiếp AI.
- Backend gọi AI Service qua REST và lưu log.
- Có fallback khi thiếu dữ liệu để tránh AI bịa thông tin.
