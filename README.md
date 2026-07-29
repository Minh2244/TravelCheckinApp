<div align="center">

# 🗺️ Travel Check-in

### Hệ Thống Quản Lý & Trải Nghiệm Du Lịch Đa Vai Trò Tích Hợp AI

*Nền tảng du lịch full-stack toàn diện kết nối du khách với nhà cung cấp dịch vụ thông qua POS tích hợp, PMS, Check-in thông minh bằng QR và các tính năng AI.*

[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Expo](https://img.shields.io/badge/Expo_SDK-54-000020?logo=expo&logoColor=white)](https://expo.dev)
[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?logo=python&logoColor=white)](https://python.org)
[![MySQL](https://img.shields.io/badge/MySQL-8.0-4479A1?logo=mysql&logoColor=white)](https://mysql.com)
[![Express](https://img.shields.io/badge/Express-5.x-000000?logo=express&logoColor=white)](https://expressjs.com)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4-010101?logo=socket.io&logoColor=white)](https://socket.io)
[![Firebase](https://img.shields.io/badge/Firebase-FCM-FFCA28?logo=firebase&logoColor=black)](https://firebase.google.com)
[![Status](https://img.shields.io/badge/Trạng_thái-✅_Hoàn_thành-brightgreen)](.)<br>
[![Platforms](https://img.shields.io/badge/Nền_tảng-Web_·_Mobile_·_API-blueviolet)](.)<br>

🇬🇧 [English Version](../README.md)

</div>

---

## ✨ Điểm Nổi Bật

<div align="center">

| 🗄️ 62 Bảng DB | 🔌 16 Controllers | 🌐 59+ API Routes | 📱 4 Nền Tảng |
|:---:|:---:|:---:|:---:|
| **59 Trang Web** | **6 Giai Đoạn** | **2 AI Engine** | **4 Vai Trò** |

</div>

---

## Mục Lục

- [Tổng Quan](#i-tổng-quan)
- [Kiến Trúc Hệ Thống](#ii-kiến-trúc-hệ-thống)
- [Tính Năng Theo Vai Trò](#iii-tính-năng-theo-vai-trò)
- [Công Nghệ Sử Dụng](#iv-công-nghệ-sử-dụng)
- [Cơ Sở Dữ Liệu](#v-cơ-sở-dữ-liệu--62-bảng)
- [Cấu Trúc Dự Án](#vi-cấu-trúc-dự-án)
- [Hướng Dẫn Cài Đặt](#vii-hướng-dẫn-cài-đặt)
- [Tiến Độ Phát Triển](#viii-tiến-độ-phát-triển)

---

## I. Tổng Quan

**Travel Check-in** là nền tảng quản lý du lịch full-stack đa vai trò gồm **bốn thành phần tích hợp chặt chẽ**:

| Thành Phần | Mô Tả | Công Nghệ |
|------------|-------|-----------|
| **[Website Dashboard](../website/README.md)** | Bảng quản trị Admin · Owner · User | React 19, Vite 7, Ant Design 6 |
| **[Backend API](../backend/README.md)** | REST API, real-time engine, xử lý nghiệp vụ | Express 5, Node.js, MySQL |
| **[AI Manager Bot](../ai-manager-bot/README.md)** | Microservice AI cho Admin & Owner | Python, FastAPI, Gemini, GPT |
| **[Mobile App](../mobile/README.md)** | App du khách — khám phá & check-in | Expo SDK 54, React Native |

---

## II. Kiến Trúc Hệ Thống

```mermaid
graph TB
    subgraph Clients["Clients"]
        W[🌐 Website<br/>React 19 · :5173]
        M[📱 Mobile App<br/>Expo 54 · :8081]
    end

    subgraph Backend["Backend Services"]
        B[⚙️ Backend API<br/>Express 5 · :3000]
        AI[🤖 AI Manager Bot<br/>FastAPI · :8090]
    end

    subgraph Storage["Storage & External"]
        DB[(🗄️ MySQL 8<br/>62 Bảng)]
        FCM[🔔 Firebase FCM]
        GEMINI[✨ Google Gemini]
        GPT[🧠 OpenAI GPT]
    end

    W -- REST + Socket.IO --> B
    M -- REST + Socket.IO --> B
    B -- Forward AI requests --> AI
    B --> DB
    AI --> DB
    AI --> GEMINI
    AI --> GPT
    B --> FCM
    B --> GEMINI
```

### Phân Quyền Theo Vai Trò (RBAC)

| Vai Trò | Phạm Vi | Quyền Truy Cập |
|---------|---------|----------------|
| **Admin** | Toàn nền tảng | Tài khoản, duyệt địa điểm, hoa hồng, SOS, cài đặt, báo cáo |
| **Owner** | Cấp doanh nghiệp | POS/PMS, dịch vụ, nhân viên, voucher, thanh toán hoa hồng |
| **Employee** | Cấp địa điểm | Chỉ Operational Mode: bàn ăn, hotel check-in/out, quét vé |
| **User / Tourist** | Người tiêu dùng | Đặt dịch vụ, ví QR, check-in, nhật ký, hành trình, SOS, AI chat |

---

## III. Tính Năng Theo Vai Trò

<details>
<summary><strong>🧳 User / Tourist</strong> — có trên cả Web & Mobile</summary>

- **Dashboard** — Gợi ý địa điểm + widget thời tiết thời gian thực
- **Bản đồ Tương tác** — Màn hình chia đôi, xem thời tiết khi click, routing & chọn tự do
- **Hệ thống Đặt dịch vụ** — 3 luồng độc lập:
  - 🍽️ **Nhà hàng** — Chọn bàn, sĩ số, ngày giờ
  - 🏨 **Khách sạn** — Chọn phòng, ngày check-in/out
  - 🎡 **Vé Du lịch** — Loại vé, số lượng. Thanh toán: Pay Later hoặc VietQR
- **Ví Vé QR (Vỏ Vé)** — Ví thông minh với hóa đơn, mã vé và QR động để nhân viên xác nhận
- **Địa Điểm Đã Lưu** · **Nhật Ký Du Lịch** · **Lập Hành Trình** · **SOS Khẩn Cấp** (gửi GPS tức thì đến Admin)
- **AI Chat** — Google Gemini tư vấn địa điểm & hỗ trợ du lịch
- **Hồ Sơ** — Công cụ cắt/phóng to avatar kiểu Zalo

</details>

<details>
<summary><strong>👑 Admin</strong> — kiểm soát toàn nền tảng</summary>

- Dashboard KPI tổng hệ thống, Quản lý tài khoản (khóa/xóa mọi vai trò)
- Duyệt/từ chối địa điểm & dịch vụ của Owner
- Quản lý hoa hồng & cấu hình ngân hàng (tự động tạo VietQR cho Owner)
- Xuất báo cáo Excel, Voucher toàn hệ thống
- Nhận & xử lý SOS real-time, Gửi Push Notification đến tất cả user

</details>

<details>
<summary><strong>🏢 Owner</strong> — hai chế độ hoạt động</summary>

**Chế Độ Quản Lý Thông Thường**
Dashboard, Đăng ký địa điểm (map picker → duyệt Admin), Thiết lập layout (kéo thả bàn ăn / phòng khách sạn / loại vé), Quản lý dịch vụ, Xử lý đặt chỗ online, Lịch sử thanh toán, Voucher riêng, Thanh toán hoa hồng, Quản lý nhân viên, Phản hồi đánh giá, Xuất báo cáo Excel

**Chế Độ Vận Hành (POS/PMS)**
- 🍽️ **Restaurant POS** — Quản lý khu vực & bàn, tạo order, xuất hóa đơn, xác nhận QR
- 🏨 **Hotel PMS** — Sơ đồ phòng, guest check-in/out, tính tiền minibar, tổng kết thanh toán
- 🎡 **Tourism POS** — Bán vé offline & quét vé QR/mã số

</details>

<details>
<summary><strong>👷 Employee</strong> — front-office hạn chế</summary>

Chỉ truy cập **Chế Độ Vận Hành** cho địa điểm được phân công — bàn ăn, hotel check-in/out, quét vé.

</details>

---

## IV. Công Nghệ Sử Dụng

<details>
<summary><strong>Backend</strong></summary>

| Hạng Mục | Công Nghệ |
|----------|-----------|
| Runtime | Node.js + TypeScript |
| Framework | Express 5.x |
| Database | MySQL 8 (mysql2 promise pool) |
| Xác thực | JWT + bcrypt · OAuth (Google, Facebook) |
| Real-time | Socket.IO + Server-Sent Events (SSE) |
| Push Notification | Firebase Cloud Messaging |
| AI (User) | Google Gemini (`@google/genai`) |
| Xử lý File | Multer (upload) + Sharp (resize/compress) |
| Lịch biểu | node-cron (tự hủy booking, nhắc nhở) |
| Validation | Zod · Email: Nodemailer |

</details>

<details>
<summary><strong>Website Dashboard</strong></summary>

| Hạng Mục | Công Nghệ |
|----------|-----------|
| Framework | React 19 + Vite 7 |
| Ngôn ngữ | TypeScript |
| UI Library | Ant Design 6 |
| Routing | React Router DOM v7 |
| State | Zustand + React Context |
| Bản đồ | React Leaflet + Google Maps API |
| Biểu đồ | Recharts · Calendar: React Big Calendar |
| Real-time | Socket.IO Client |
| QR | qrcode.react (tạo) + @zxing/browser (quét) |
| Export | ExcelJS · Forms: React Hook Form + Zod |

</details>

<details>
<summary><strong>AI Manager Bot</strong></summary>

| Hạng Mục | Công Nghệ |
|----------|-----------|
| Ngôn ngữ | Python 3.x |
| Framework | FastAPI + Uvicorn |
| LLM | Google Gemini + OpenAI GPT (fallback) |
| NLP | Custom Vietnamese NLP + rule-based fallback |
| Database | MySQL (kết nối trực tiếp lấy ngữ cảnh) |
| Cổng | 8090 |

</details>

<details>
<summary><strong>Mobile App</strong></summary>

| Hạng Mục | Công Nghệ |
|----------|-----------|
| Framework | Expo SDK 54 + React Native 0.81.5 |
| Ngôn ngữ | TypeScript |
| Navigation | Expo Router (file-based routing) |
| Styling | NativeWind (TailwindCSS cho RN) |
| Bản đồ | React Native Maps |
| State | Zustand |
| Forms | React Hook Form + Zod |
| Real-time | Socket.IO Client |
| Lưu trữ | expo-secure-store · GPS: expo-location |

</details>

---

## V. Cơ Sở Dữ Liệu — 62 Bảng

> 📄 Schema SQL đầy đủ với FK constraints & index: `TravelCheckinApp.sql`

<details>
<summary><strong>Xem tất cả 12 domain nghiệp vụ</strong></summary>

| # | Domain | Bảng | Bảng Chính |
|---|--------|:----:|------------|
| 1 | Xác thực & Người dùng | 8 | `users`, `owner_profiles`, `user_active_sessions`, `login_history` |
| 2 | Địa điểm & Dịch vụ | 3 | `locations`, `services`, `service_categories` |
| 3 | Đặt dịch vụ & Thanh toán | 7 | `bookings`, `booking_tickets`, `payments`, `commissions` |
| 4 | Hotel PMS | 4 | `hotel_rooms`, `hotel_guests`, `hotel_stays`, `hotel_stay_items` |
| 5 | Restaurant POS | 6 | `pos_areas`, `pos_tables`, `pos_orders`, `pos_order_items` |
| 6 | Check-in & SOS | 2 | `checkins`, `sos_alerts` |
| 7 | Đánh giá & Báo cáo | 4 | `reviews`, `review_replies`, `reports`, `owner_violations` |
| 8 | Voucher | 5 | `vouchers`, `voucher_locations`, `user_voucher_wallet` |
| 9 | Chat & Thông báo | 6 | `chat_messages`, `location_chat_messages`, `push_notifications` |
| 10 | Lưu trữ ảnh | 3 | `images` (LONGBLOB), `entity_images`, `image_categories` |
| 11 | Hành trình | 2 | `itineraries`, `itinerary_items` |
| 12 | Hệ thống & Tiện ích | 12 | `audit_logs`, `system_settings`, `ai_chat_history`, `ai_action_runs` |

</details>

---

## VI. Cấu Trúc Dự Án

```
TravelCheckinApp/
├── website/            # React 19 + Vite 7 + Ant Design 6   → website/README.md
├── backend/            # Node.js + Express 5 + TypeScript    → backend/README.md
├── ai-manager-bot/     # Python + FastAPI AI microservice    → ai-manager-bot/README.md
├── mobile/             # Expo SDK 54 + React Native          → mobile/README.md
├── docs/               # Tài liệu & README tiếng Việt (file này)
└── TravelCheckinApp.sql # Schema CSDL đầy đủ (62 bảng)
```

---

## VII. Hướng Dẫn Cài Đặt

### Yêu Cầu
```
Node.js >= 18    Python >= 3.10    MySQL >= 8.0    Expo CLI
```

### Cài Đặt

```bash
# 1. Khởi tạo Database
mysql -u root -p < TravelCheckinApp.sql

# 2. Backend (AI Bot tự động khởi động trên cổng 8090)
cd backend && cp .env.example .env && npm install && npm run dev

# 3. Website → http://localhost:5173
cd website && cp .env.example .env && npm install && npm run dev

# 4. Mobile → quét QR bằng Expo Go
cd mobile && cp .env.example .env && npm install && npm start
```

> 💡 Xem `README.md` trong từng thư mục để biết đầy đủ các biến môi trường `.env`.

---

## VIII. Tiến Độ Phát Triển

### ✅ Hoàn Thành 6/6 Giai Đoạn — Tháng 7/2026

| Giai Đoạn | Mô Tả | Trạng Thái |
|:---------:|-------|:----------:|
| **1** | **Hệ thống Backend** — Core API, Auth, RBAC & Middleware | ✅ |
| **2** | **Cổng Website** — Admin Dashboard & Business Owner Modules | ✅ |
| **3** | **Cơ sở Dữ liệu & Logic** — 62 Bảng & Quy tắc Nghiệp vụ Phức tạp | ✅ |
| **4** | **Mobile App (Cốt lõi)** — Bản đồ, Đặt chỗ, Ví QR & Front-office | ✅ |
| **5** | **Mobile App (Xã hội)** — Địa điểm đã lưu, Nhật ký, Vouchers & SOS | ✅ |
| **6** | **Hệ sinh thái AI** — Dual AI Chatbot, NLP & Lập Hành trình Thông minh | ✅ |

| Module | Tiến Độ | Chi Tiết |
|--------|:-------:|---------|
| Backend API | ✅ 100% | 16 controllers · 15 nhóm routes · real-time · cron |
| Website — Admin | ✅ 100% | 18 trang |
| Website — Owner | ✅ 100% | 21 trang |
| Website — User | ✅ 100% | 20 trang |
| Mobile App | ✅ 100% | Bản đồ · check-in · ví QR · SOS · AI chat · hành trình |
| AI Manager Bot | ✅ 100% | Phân loại intent · lập kế hoạch · Gemini + GPT |
| Cơ Sở Dữ Liệu | ✅ 100% | 62 bảng · 12 domain |

---

<div align="center">

**Công nghệ bên thứ ba:** Node.js · Express · React · Ant Design · NativeWind · Socket.IO · MySQL · Expo · React Native · Google Gemini · OpenAI · Firebase · Leaflet · OpenStreetMap · VietQR · ExcelJS

*Cập nhật lần cuối: 30 tháng 7 năm 2026*

</div>
