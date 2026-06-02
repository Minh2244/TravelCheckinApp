backend/
├── src/
│ │
│ ├── config/ # Cấu hình hệ thống
│ │ ├── db.ts # Kết nối MySQL
│ │ ├── env.ts # Load biến môi trường (.env)
│ │ ├── constants.ts # Enums (Role, Status, BookingStatus...)
│ │ └── firebase.ts # (Optional) Config Firebase cho Notification/Auth
│ │
│ ├── middlewares/ # Các lớp trung gian
│ │ ├── auth.middleware.ts # Xác thực JWT (chặn người lạ)
│ │ ├── role.middleware.ts # Phân quyền (chặn User vào trang Admin)
│ │ ├── error.middleware.ts # Xử lý lỗi tập trung
│ │ ├── validate.middleware.ts # Validate dữ liệu đầu vào (Joi/Zod)
│ │ └── upload.middleware.ts # Upload ảnh (Multer)
│ │
│ ├── utils/ # Các hàm tiện ích
│ │ ├── jwt.ts # Ký và giải mã Token
│ │ ├── password.ts # Hash mật khẩu (Bcrypt)
│ │ ├── qr.ts # Tạo và đọc QR Code, Chữ ký số
│ │ ├── response.ts # Chuẩn hóa response trả về
│ │ └── logger.ts # Ghi log hệ thống
│ │
│ ├── types/ # Định nghĩa kiểu dữ liệu (TypeScript Interfaces)
│ │ ├── express.d.ts # Mở rộng Request object
│ │ └── db.types.ts # Interface khớp với bảng DB
│ │
│ ├── modules/ # 🟢 CÁC MODULE CHÍNH (KHỚP VỚI DB)
│ │ │
│ │ ├── auth/ # Đăng nhập, Đăng ký, Quên MK
│ │ │ ├── auth.controller.ts
│ │ │ ├── auth.service.ts
│ │ │ └── auth.routes.ts
│ │ │
│ │ ├── user/ # Profile, Preferences (AI Style)
│ │ │ ├── user.controller.ts
│ │ │ ├── user.service.ts
│ │ │ └── user.routes.ts
│ │ │
│ │ ├── admin/ # Dashboard thống kê, Duyệt Owner
│ │ │ ├── admin.controller.ts
│ │ │ ├── admin.service.ts
│ │ │ └── admin.routes.ts
│ │ │
│ │ ├── owner/ # Profile kinh doanh, Dashboard Owner
│ │ │ ├── owner.controller.ts
│ │ │ ├── owner.service.ts
│ │ │ └── owner.routes.ts
│ │ │
│ │ ├── employee/ # Quản lý nhân viên, Phân quyền
│ │ │ ├── employee.controller.ts
│ │ │ ├── employee.service.ts
│ │ │ └── employee.routes.ts
│ │ │
│ │ ├── location/ # Địa điểm, Map, Search
│ │ │ ├── location.controller.ts
│ │ │ ├── location.service.ts
│ │ │ └── location.routes.ts
│ │ │
│ │ ├── service/ # Phòng, Món ăn, Vé
│ │ │ ├── service.controller.ts
│ │ │ └── service.routes.ts
│ │ │
│ │ ├── booking/ # Đặt chỗ, Xử lý trạng thái
│ │ │ ├── booking.controller.ts
│ │ │ ├── booking.service.ts
│ │ │ └── booking.routes.ts
│ │ │
│ │ ├── voucher/ # 🆕 Voucher giảm giá
│ │ │ ├── voucher.controller.ts
│ │ │ ├── voucher.service.ts
│ │ │ └── voucher.routes.ts
│ │ │
│ │ ├── payment/ # VietQR, Transaction
│ │ │ ├── payment.controller.ts
│ │ │ ├── payment.service.ts
│ │ │ └── payment.routes.ts
│ │ │
│ │ ├── commission/ # 🆕 Quản lý nợ, Hoa hồng, Audit Log
│ │ │ ├── commission.controller.ts
│ │ │ ├── commission.service.ts
│ │ │ └── commission.routes.ts
│ │ │
│ │ ├── checkin/ # 🆕 Quét QR, Verify chữ ký
│ │ │ ├── checkin.controller.ts
│ │ │ ├── checkin.service.ts
│ │ │ └── checkin.routes.ts
│ │ │
│ │ ├── review/ # Đánh giá, Bình luận
│ │ │ ├── review.controller.ts
│ │ │ └── review.routes.ts
│ │ │
│ │ ├── itinerary/ # Lịch trình, Gợi ý chuyến đi
│ │ │ ├── itinerary.controller.ts
│ │ │ └── itinerary.routes.ts
│ │ │
│ │ ├── diary/ # 🆕 Nhật ký du lịch (User Diary)
│ │ │ ├── diary.controller.ts
│ │ │ └── diary.routes.ts
│ │ │
│ │ ├── chat/ # 🆕 Chat Human-to-Human
│ │ │ ├── chat.controller.ts
│ │ │ └── chat.routes.ts
│ │ │
│ │ ├── ai/ # Chatbot Gemini, Gợi ý thông minh
│ │ │ ├── ai.controller.ts
│ │ │ └── ai.service.ts
│ │ │
│ │ ├── sos/ # 🆕 Cứu hộ khẩn cấp
│ │ │ ├── sos.controller.ts
│ │ │ └── sos.routes.ts
│ │ │
│ │ └── report/ # 🆕 Báo cáo vi phạm
│ │ ├── report.controller.ts
│ │ └── report.routes.ts
│ │
│ ├── routes.ts # File gom tất cả routes con
│ ├── app.ts # Cấu hình Express App
│ └── server.ts # Điểm khởi chạy Server
│
├── package.json
├── tsconfig.json
├── nodemon.json
└── .env

# Mô tả cấu trúc thư mục backend:

🗺️ MAPPING: TỪ DATABASE SANG MODULE (Logic)
Dưới đây là cách các Module Backend xử lý dữ liệu từ các bảng trong Database mới:

1. Nhóm Kinh Doanh (Business)
   Module booking:

Tương tác bảng: bookings, services, vouchers.

Logic: Khi tạo booking -> check service còn chỗ không -> check voucher hợp lệ không -> tính final_amount.

Module voucher (Mới):

Tương tác bảng: vouchers.

Logic: Owner tạo mã -> User nhập mã -> Validate điều kiện (loại dịch vụ, ngày hết hạn).

Module commission (Mới):

Tương tác bảng: commissions, commission_history, payments.

Logic: Cronjob chạy hàng ngày kiểm tra ai quá hạn thanh toán (overdue) -> Báo Admin.

2. Nhóm Tương Tác & Tiện Ích
   Module checkin (Mới):

Tương tác bảng: checkins, bookings, employee_locations.

Logic: Employee quét QR -> Server giải mã Payload -> Check booking -> Update status verified.

🆕 Check-in tự do (User):
Tương tác bảng: locations, checkins, favorite_locations.
Logic: /user/checkins mở rộng nhận tọa độ + tên địa điểm -> tìm location gần nhất trong bán kính -> nếu không có thì tạo mới location (đánh dấu is_user_created) -> check-in hoặc lưu favorite tùy action.

Module diary (Mới):

Tương tác bảng: user_diary.

Logic: User up ảnh + chọn mood -> Lưu vào DB.

Module sos (Mới):

Tương tác bảng: sos_alerts.

Logic: Nhận tọa độ GPS -> Thông báo ngay cho Admin Dashboard (Real-time).

3. Nhóm AI & Thông Minh
   Module ai:

Tương tác bảng: user_preferences, ai_chat_history, itineraries.

Logic: Đọc sở thích user -> Gọi Gemini API -> Trả về JSON lịch trình -> Lưu vào itineraries với metric distance và time.

🔌 DANH SÁCH API ENDPOINTS (CẬP NHẬT ĐẦY ĐỦ)
Đây là list API bạn cần implement để chạy đủ tính năng:

🔐 AUTH & USER
POST /api/auth/register (User/Owner đăng ký)

POST /api/auth/login

POST /api/auth/forgot-password

GET /api/users/profile (Lấy info + preferences)

PUT /api/users/preferences (Update sở thích AI)

POST /api/user/checkins (mở rộng action=checkin|save, hỗ trợ tọa độ tự do)

🥇 ADMIN
GET /api/admin/dashboard (Stats tổng)

GET /api/admin/commissions (Xem ai nợ tiền) 🆕

PUT /api/admin/owners/:id/approve (Duyệt Owner)

GET /api/admin/sos (Xem danh sách cầu cứu) 🆕

🥈 OWNER
POST /api/owner/locations

POST /api/owner/services

POST /api/vouchers (Tạo mã giảm giá) 🆕

GET /api/owner/commissions (Xem mình nợ bao nhiêu) 🆕

POST /api/owner/employees (Tạo nhân viên)

🥉 EMPLOYEE & CHECK-IN
POST /api/checkin/verify (Quét QR code) 🆕

GET /api/employee/tasks (Xem booking cần phục vụ)

📆 BOOKING & PAYMENT
POST /api/bookings (Tạo đơn)

POST /api/bookings/apply-voucher (Check mã giảm giá) 🆕

POST /api/payments/confirm (Xác nhận đã chuyển khoản)

🤖 AI & TIỆN ÍCH
POST /api/ai/chat (Hỏi đáp du lịch)

POST /api/ai/plan-trip (Gợi ý lịch trình)

POST /api/sos (Gửi tín hiệu SOS) 🆕

POST /api/diary (Viết nhật ký) 🆕

💡 LỜI KHUYÊN KHI CODE
Chạy Database trước: Copy đoạn SQL "Final Gold Version" ở câu trả lời trước và chạy vào phpMyAdmin/Workbench.

Tạo khung dự án: Tạo các folder y hệt cấu trúc trên.

Code từ dưới lên:

Làm User & Auth trước (để có token login).

Làm Location & Service (để có dữ liệu).

Làm Booking & Payment (Logic chính).

Các phần AI, SOS, Diary làm sau cùng.

# Các thư viện và cấu hình cài đặt:

🏛️ PHẦN A: BACKEND (Node.js + TypeScript)
Đây là "bộ não" xử lý Logic, AI, Database và Auth.

1. Cài đặt thư viện chính
   Copy và chạy lệnh này trong thư mục backend/:

Bash

npm install express mysql2 dotenv cors helmet compression jsonwebtoken bcryptjs zod multer uuid @google/generative-ai socket.io
Giải thích công dụng:

express: Framework web server cốt lõi.

mysql2: Driver kết nối MySQL (hỗ trợ Promise/Async Await).

dotenv: Đọc file .env (chứa mật khẩu DB, API Key).

cors: Cho phép Web và Mobile gọi API.

helmet & compression: Bảo mật header và nén dữ liệu cho nhanh.

jsonwebtoken (JWT): Tạo token đăng nhập.

bcryptjs: Mã hóa mật khẩu người dùng.

zod: Validate dữ liệu đầu vào (Cực ngon khi dùng với TypeScript).

multer: Upload ảnh (cho món ăn, phòng, avatar).

uuid: Tạo ID ngẫu nhiên duy nhất (cho tên file ảnh).

@google/generative-ai: SDK để gọi Google Gemini (Tính năng Chat AI).

socket.io: Xử lý Real-time (Thông báo SOS khẩn cấp).

2. Cài đặt thư viện hỗ trợ TypeScript (Dev Dependencies)
   Bash

npm install -D typescript ts-node nodemon @types/node @types/express @types/cors @types/jsonwebtoken @types/bcryptjs @types/multer @types/uuid 3. Cấu hình quan trọng (tsconfig.json)
Tạo file tsconfig.json ở root backend:

JSON

{
"compilerOptions": {
"target": "es2016",
"module": "commonjs",
"rootDir": "./src",
"outDir": "./dist",
"esModuleInterop": true,
"forceConsistentCasingInFileNames": true,
"strict": true,
"skipLibCheck": true
}
}
