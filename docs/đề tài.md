Tên đề tài: Ứng dụng du lịch và check-in thông minh

1. Mục tiêu

- Tập trung vào trải nghiệm tìm kiếm, đặt dịch vụ và check-in tại địa điểm du lịch.
- Hỗ trợ vận hành cho Owner/Employee theo mô hình vừa quản lý vừa bán hàng tại quầy.
- Xây dựng nền tảng dễ mở rộng cho AI và mobile ở giai đoạn sau.

2. Phạm vi và đối tượng

- User: tìm địa điểm, đặt dịch vụ, check-in, đánh giá.
- Owner: quản lý địa điểm, dịch vụ, doanh thu, vận hành POS/PMS.
- Employee: thao tác vận hành tại quầy theo quyền được cấp.
- Admin: quản trị hệ thống, duyệt địa điểm, theo dõi vận hành.

3. Công nghệ chính (miêu tả sơ)

- Backend: Node.js + Express + TypeScript.
- Website: React + TypeScript + Vite + TailwindCSS.
- Mobile: React Native (Expo) + TypeScript, triển khai sau khi ổn định backend.
- Database: MySQL 8.x.
- Bản đồ & định vị: Google Maps hoặc OpenStreetMap (tìm kiếm và định vị).
- Thanh toán: VietQR (QR động).
- Push Notification: Firebase Cloud Messaging.
- AI: dịch vụ Python/FastAPI (microservice), backend gọi qua REST.

4. Kiến trúc tổng quan

- Website/Mobile gọi API Backend qua HTTP.
- Backend xử lý nghiệp vụ và lưu dữ liệu MySQL.
- AI Service độc lập, backend gọi nội bộ để lấy kết quả AI.

5. Lộ trình triển khai

- Hoàn thiện Backend + Website trước.
- Tích hợp AI Service sau khi core nghiệp vụ ổn định.
- Dùng Backend đã hoàn thiện để triển khai Mobile.
