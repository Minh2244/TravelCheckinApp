# ⚙️ Backend API — Xương Sống Của Cả Hệ Thống

> *"Không có tui thì website, mobile, và bot chỉ là mấy tờ giấy trắng."*

Đây là server REST API trung tâm của TravelCheckinApp — xử lý toàn bộ logic nghiệp vụ, phân quyền, real-time, thanh toán, booking, và điều phối AI.

---

## 📋 Mục Lục

- [Tổng Quan](#tổng-quan)
- [Cấu Trúc Thư Mục](#cấu-trúc-thư-mục)
- [Danh Sách API Routes](#danh-sách-api-routes)
- [Danh Sách Controllers](#danh-sách-controllers)
- [Các Tính Năng Đặc Biệt](#các-tính-năng-đặc-biệt)
- [Cài Đặt & Chạy](#cài-đặt--chạy)
- [Biến Môi Trường](#biến-môi-trường)

---

## Tổng Quan

| Thông tin | Chi tiết |
|-----------|----------|
| **Ngôn ngữ** | TypeScript |
| **Runtime** | Node.js |
| **Framework** | Express 5 |
| **Database** | MySQL 2 |
| **Real-time** | Socket.IO |
| **Push Notification** | Firebase Admin SDK |
| **Auth** | JWT + bcrypt |
| **File Upload** | Multer + Sharp (xử lý ảnh) |
| **Cổng mặc định** | `3000` |
| **Build tool** | ts-node (dev) / tsc (prod) |

---

## Cấu Trúc Thư Mục

```
backend/
├── src/
│   ├── server.ts                   # Entry point — khởi tạo Express, Socket.IO, middleware
│   ├── config/                     # Cấu hình DB, Firebase, env
│   ├── controllers/
│   │   ├── adminController.ts      # Toàn bộ nghiệp vụ Admin (~365KB - file lớn nhất)
│   │   ├── ownerController.ts      # Toàn bộ nghiệp vụ Owner (~593KB - file khổng lồ nhất)
│   │   ├── userController.ts       # Nghiệp vụ User/Tourist (~125KB)
│   │   ├── authController.ts       # Đăng ký, đăng nhập, OAuth, JWT (~63KB)
│   │   ├── bookingController.ts    # Đặt dịch vụ (hotel/restaurant/ticket)
│   │   ├── locationController.ts   # Quản lý địa điểm du lịch
│   │   ├── locationChatController.ts # Chat AI theo ngữ cảnh địa điểm
│   │   ├── itineraryController.ts  # Lập lịch trình du lịch
│   │   ├── sosController.ts        # Cảnh báo SOS khẩn cấp
│   │   ├── aiController.ts         # Kết nối Gemini AI cho User
│   │   ├── ownerAdminAiController.ts # Kết nối AI Bot cho Owner/Admin
│   │   ├── internalAiController.ts # API nội bộ cung cấp ngữ cảnh cho AI Bot
│   │   ├── geoController.ts        # Định vị, bản đồ, routing
│   │   ├── imageController.ts      # Upload và xử lý ảnh
│   │   ├── pushController.ts       # Push notification qua Firebase
│   │   └── adminHistoryController.ts # Lịch sử thao tác Admin
│   ├── routes/
│   │   ├── adminRoutes.ts          # /api/admin/*
│   │   ├── ownerRoutes.ts          # /api/owner/*
│   │   ├── userRoutes.ts           # /api/user/*
│   │   ├── authRoutes.ts           # /api/auth/*
│   │   ├── bookingRoutes.ts        # /api/booking/*
│   │   ├── locationRoutes.ts       # /api/locations/*
│   │   ├── locationChatRoutes.ts   # /api/location-chat/*
│   │   ├── itineraryRoutes.ts      # /api/itinerary/*
│   │   ├── sosRoutes.ts            # /api/sos/*
│   │   ├── aiRoutes.ts             # /api/ai/*
│   │   ├── ownerAdminAiRoutes.ts   # /api/owner-admin-ai/*
│   │   ├── internalAiRoutes.ts     # /api/internal/ai/* (nội bộ)
│   │   ├── geoRoutes.ts            # /api/geo/*
│   │   ├── imageRoutes.ts          # /api/image/*
│   │   └── pushRoutes.ts           # /api/push/*
│   ├── middleware/                  # Auth middleware, rate limiting, v.v.
│   ├── services/
│   │   ├── bookingService.ts       # Logic đặt phòng/bàn/vé (~148KB)
│   │   ├── bookingPaymentService.ts # Xử lý thanh toán
│   │   ├── bookingQrService.ts     # Sinh mã QR cho vé
│   │   ├── adminService.ts         # Nghiệp vụ hỗ trợ Admin
│   │   ├── ai-manager/             # Giao tiếp với AI Manager Bot
│   │   └── ai-services/            # Giao tiếp với Google Gemini (cho User)
│   ├── cron/                       # Cron job — tự động xử lý booking hết hạn, nhắc nhở
│   ├── types/                      # TypeScript type definitions
│   ├── utils/                      # Hàm tiện ích dùng chung
│   └── scripts/                    # Script backfill, migration dữ liệu
├── migrations/                     # SQL migration files
├── package.json
├── tsconfig.json
└── nodemon.json
```

---

## Danh Sách API Routes

| Prefix | File Route | Mô tả |
|--------|-----------|-------|
| `/api/auth` | authRoutes.ts | Đăng ký, đăng nhập, refresh token, OAuth Google/Facebook |
| `/api/admin` | adminRoutes.ts | Toàn bộ chức năng Admin (duyệt, quản lý, báo cáo) |
| `/api/owner` | ownerRoutes.ts | Toàn bộ chức năng Owner (POS, PMS, dịch vụ, voucher) |
| `/api/user` | userRoutes.ts | Chức năng Tourist (booking, ví vé, nhật ký, hành trình) |
| `/api/booking` | bookingRoutes.ts | Đặt phòng/bàn/vé + xác nhận + hủy |
| `/api/locations` | locationRoutes.ts | Danh sách, chi tiết, tìm kiếm địa điểm |
| `/api/location-chat` | locationChatRoutes.ts | Chat AI theo địa điểm cụ thể |
| `/api/itinerary` | itineraryRoutes.ts | Tạo, sửa, xóa hành trình du lịch |
| `/api/sos` | sosRoutes.ts | Gửi và nhận cảnh báo SOS |
| `/api/ai` | aiRoutes.ts | Gemini AI cho User |
| `/api/owner-admin-ai` | ownerAdminAiRoutes.ts | AI Bot cho Owner và Admin |
| `/api/internal/ai` | internalAiRoutes.ts | Cung cấp ngữ cảnh DB cho AI Bot (nội bộ) |
| `/api/geo` | geoRoutes.ts | Geocoding, routing, bản đồ |
| `/api/image` | imageRoutes.ts | Upload ảnh, resize, compress |
| `/api/push` | pushRoutes.ts | Gửi push notification Firebase |

---

## Danh Sách Controllers

| Controller | Kích thước | Vai trò xử lý |
|-----------|-----------|--------------|
| `ownerController.ts` | ~593 KB | **Lớn nhất** — POS/PMS, cấu hình bàn/phòng/vé, dịch vụ, voucher, hoa hồng |
| `adminController.ts` | ~365 KB | Duyệt địa điểm/dịch vụ, quản lý tài khoản, báo cáo Excel, cài đặt hệ thống |
| `userController.ts` | ~125 KB | Booking, ví vé QR, nhật ký, hành trình, điểm leaderboard |
| `bookingController.ts` | ~24 KB | Điều phối đặt dịch vụ, xác nhận, hủy đặt |
| `authController.ts` | ~63 KB | Đăng ký/đăng nhập, JWT, OAuth Google/Facebook, quên mật khẩu |
| `locationController.ts` | ~26 KB | CRUD địa điểm, tìm kiếm, lọc theo loại |
| `locationChatController.ts` | ~29 KB | Chat AI có ngữ cảnh địa điểm cụ thể |
| `itineraryController.ts` | ~15 KB | Tạo và quản lý hành trình du lịch |
| `sosController.ts` | ~9 KB | Cảnh báo khẩn cấp + vị trí GPS |
| `geoController.ts` | ~12 KB | Geocoding + tìm đường |

---

## Các Tính Năng Đặc Biệt

### 🔐 Xác Thực & Phân Quyền
- JWT Access Token + Refresh Token
- OAuth 2.0: Google, Facebook
- Middleware kiểm tra role: `admin`, `owner`, `employee`, `user`
- Bảo vệ bằng `helmet`, `cors`

### 📡 Real-time (Socket.IO)
- Thông báo SOS theo thời gian thực đến Admin
- Cập nhật trạng thái booking live
- Push notification qua Firebase Cloud Messaging

### 💳 Hệ Thống Thanh Toán
- Thanh toán sau (Pay Later)
- Chuyển khoản ngân hàng + VietQR auto-generate
- Quản lý hoa hồng Owner ↔ Admin

### 📊 Báo Cáo & Xuất Dữ Liệu
- Xuất Excel (doanh thu, đơn hàng, hoa hồng) qua ExcelJS
- Lọc theo khoảng thời gian, theo Owner/toàn hệ thống

### ⏰ Cron Jobs Tự Động
- Tự động hủy booking quá hạn chưa thanh toán
- Gửi nhắc nhở trước giờ check-in
- Cleanup dữ liệu tạm

### 🖼️ Xử Lý Ảnh
- Upload via Multer
- Resize + compress tự động bằng Sharp
- Hỗ trợ avatar, ảnh địa điểm, ảnh dịch vụ

---

## Cài Đặt & Chạy

```bash
cd backend

# Cài thư viện
npm install

# Chạy development (tự động khởi động cả AI Bot)
npm run dev

# Build production
npm run build

# Chạy production
npm start
```

> [!NOTE]
> `npm run dev` dùng `concurrently` để chạy **đồng thời** Express server và AI Manager Bot Python.

---

## Biến Môi Trường

Tạo file `.env` từ `.env.example`:

```env
# Server
PORT=3000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=...
DB_NAME=travel_checkin

# JWT
JWT_SECRET=...
JWT_REFRESH_SECRET=...

# Google Gemini (cho User AI Chat)
GEMINI_API_KEY=...

# Firebase (Push Notification)
FIREBASE_PROJECT_ID=...

# OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# VietQR / Bank
VIETQR_CLIENT_ID=...
VIETQR_API_KEY=...
```

---

> [!IMPORTANT]
> Backend phải được khởi động **trước** AI Manager Bot. Script `npm run dev` đã xử lý thứ tự này tự động.

> [!TIP]
> Dùng `nodemon.json` để cấu hình watch file — chỉ reload khi `.ts` thay đổi, bỏ qua `node_modules` và `dist`.

---

*Được xây dựng như một phần của luận văn tốt nghiệp — Đại học Tây Đô* 🎓
