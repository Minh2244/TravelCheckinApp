# TravelCheckinApp

**Smart Travel & POS Ecosystem**

A full-stack platform connecting tourists with service providers through integrated POS (Point of Sale), PMS (Property Management System), and Smart Check-in mechanisms.

---

## I. Project Overview

TravelCheckinApp is a comprehensive travel ecosystem consisting of three main components:

| Component | Description | Technology |
|-----------|-------------|------------|
| Backend API | RESTful server with real-time capabilities | Node.js, Express 5, TypeScript |
| Mobile App | Consumer-facing app for travelers | React Native, Expo SDK 56, TypeScript |
| Web Dashboard | Admin, Owner, and User management panels | React 19, Vite 7, Ant Design, TypeScript |

The platform enables tourists to discover locations, book services (hotel rooms, restaurant tables, tourist tickets), check in via QR codes, earn rewards through a leaderboard system, and receive emergency assistance through SOS alerts. Service owners are equipped with a full POS/PMS system to manage their business operations.

---

## II. Key Features

### A. For Travelers (Mobile App)

1. **Smart Check-in** — GPS-based check-in with geofencing and photo capture
2. **Interactive Map** — Browse locations with OpenStreetMap tiles, markers, and routing
3. **Multi-service Booking** — Reserve hotel rooms, restaurant tables, and tourist tickets in one flow
4. **QR Ticket Wallet** — Digital tickets with unique QR codes for instant verification
5. **Travel Diary** — Document trips with mood tracking and photo entries
6. **Voucher Wallet** — Claim and redeem discount vouchers from the platform and locations
7. **Leaderboard** — Gamified ranking based on check-in activity and travel engagement
8. **SOS Emergency** — Real-time GPS alert system for emergencies with admin monitoring
9. **AI Chat Assistant** — Google Gemini-powered chatbot for travel planning *(under development)*
10. **Location Chat** — Group chat per location for real-time communication with staff and other travelers
11. **Booking Reminders** — Automated notifications 6 hours before check-in and 3 hours before check-out
12. **Social Login** — Google and Facebook OAuth integration

### B. For Business Owners (Web Dashboard)

1. **Location Management** — CRUD with up to 12 images, opening hours, geo coordinates, and OSM integration
2. **Service & Category Management** — Define bookable services (rooms, tables, tickets, food, combos) with pricing
3. **Booking Management** — View, confirm, and manage all bookings with status tracking
4. **Payment Processing** — Create payments, track commission, and manage bank details
5. **Voucher System** — Create owner vouchers (admin-approved) with percentage or fixed discounts
6. **Review Management** — Respond to reviews, hide inappropriate content, report users
7. **Employee Management** — Add employees with granular JSON-based permissions per location
8. **Commission Tracking** — View commission rates, request payments, and track payment history

### C. Hotel PMS (Property Management System)

1. **Visual Room Grid** — Drag-and-drop room positioning across floors
2. **Room Status Management** — Track vacant, occupied, reserved, and cleaning states
3. **Walk-in & Online Check-in** — Handle both advance bookings and walk-in guests
4. **Stay Management** — Add minibar/service charges, extend stays, single or batch checkout
5. **Financial Tracking** — Per-stay subtotal, discount, and final amount calculation

### D. Restaurant / Cafe POS (Point of Sale)

1. **Visual Table Layout** — Drag-and-drop table positioning within dining areas
2. **Table Lifecycle** — Free, Reserved, Occupied with real-time status updates
3. **Order Management** — Add, update, delete menu items with payment processing
4. **Area Management** — Organize tables into dining sections

### E. Tourist Ticket POS

1. **QR Code Scanning** — Instant ticket validation via camera
2. **Walk-in Sales** — Sell single or batch tickets at the counter
3. **Real-time Stock** — Live ticket availability tracking
4. **Invoice Generation** — Automatic receipt creation

### F. Admin Dashboard (Web)

1. **Full Platform Control** — Manage users, owners, locations, and system settings
2. **Owner Approval** — Review and approve/reject owner registration applications
3. **Location Moderation** — Approve, reject, hide, or delete locations; detect and merge duplicates
4. **Commission Management** — Set per-location commission rates, track payments, send reminders
5. **Report Resolution** — Handle user reports, warn users/owners, manage violations
6. **Analytics** — Check-in analytics, dashboard statistics, and system logs
7. **Voucher Management** — Create system-wide vouchers, approve owner vouchers, track usage
8. **SOS Monitoring** — View and manage emergency alerts in real-time
9. **Push Notifications** — Broadcast announcements to all users or specific segments
10. **AI Settings** — Configure AI chatbot behavior and view chat history

---

## III. System Architecture

```
                         +---------------------------------------------+
                         |              Client Layer                    |
                         +----------------+--------------+--------------+
                         |  Mobile App    |  Website     |  Admin       |
                         |  (Expo RN)     |  (React)     |  (React)     |
                         +--------+-------+------+-------+------+-------+
                                  |             |              |
                                  +--------+----+--------------+
                                           |
                                  +--------v--------+
                                  |   Backend API   |
                                  |  (Express 5)    |
                                  |  Port: 3000     |
                                  +--+-----+-----+--+
                                     |     |     |
                             +-------+     |     +-------+
                             v             v             v
                      +-----------+  +-----------+  +-----------+
                      |   MySQL   |  |  Firebase |  |  Google   |
                      | Database  |  |  Cloud    |  |  Gemini   |
                      | 53 tables |  | Messaging |  |    AI     |
                      +-----------+  +-----------+  +-----------+

                      Real-time: Socket.IO (WebSocket) + SSE
```

---

## IV. Roles and Access Control

The platform implements **4 distinct roles** with JWT-based authentication:

| Role | Scope | Key Capabilities |
|------|-------|------------------|
| Admin | Platform-wide | Full control: user/owner management, location moderation, commission, analytics, vouchers, AI settings, SOS monitoring, push notifications |
| Owner | Business-level | Location CRUD, service/booking/payment management, hotel PMS, restaurant POS, tourist POS, employee management, vouchers, reviews |
| Employee | Location-level | Subset of owner: front-office POS, hotel PMS, ticket scanning; permissions assigned by owner via JSON config |
| User | Consumer | Booking, check-in, favorites, vouchers, reviews, travel diary, SOS, leaderboard, AI chat |

**Access Rules:**

A. Owner accounts require admin approval before accessing owner features.
B. Locked accounts are blocked at the middleware level.
C. Single active session per user — new login revokes previous sessions.
D. Token refresh with separate access and refresh tokens (JWT).

---

## V. Tech Stack

### A. Backend

| Category | Technology |
|----------|------------|
| Runtime | Node.js + TypeScript |
| Framework | Express 5.x |
| Database | MySQL (mysql2, promise-based pool) |
| Authentication | JWT (jsonwebtoken), bcrypt |
| Real-time | Socket.IO, Server-Sent Events (SSE) |
| Push Notifications | Firebase Cloud Messaging (firebase-admin) |
| AI | Google Gemini (@google/generative-ai) |
| File Uploads | Multer (memory storage) |
| Email | Nodemailer (Gmail SMTP) |
| Validation | Zod v4 |
| Security | Helmet, CORS, Compression |

### B. Mobile App

| Category | Technology |
|----------|------------|
| Framework | React Native 0.85.3 + Expo SDK 56 |
| Routing | expo-router (file-based) |
| State Management | Zustand |
| HTTP Client | Axios |
| Maps | react-native-maps |
| QR Codes | react-native-qrcode-svg |
| Date Handling | date-fns |
| Animations | react-native-reanimated |
| Gestures | react-native-gesture-handler |

### C. Website

| Category | Technology |
|----------|------------|
| Framework | React 19 + TypeScript |
| Build Tool | Vite 7 |
| Routing | react-router-dom v7 |
| UI Library | Ant Design v6 |
| State Management | Zustand |
| Styling | Tailwind CSS 3 |
| Maps | react-leaflet, @react-google-maps/api |
| QR/Barcode | qrcode.react, @zxing/browser |
| Forms | react-hook-form + Zod |
| OAuth | @react-oauth/google, @greatsumini/react-facebook-login |
| Real-time | socket.io-client |

---

## VI. Project Structure

```
TravelCheckinApp/
|
+-- backend/                         # Node.js + Express REST API
|   +-- src/
|   |   +-- config/                  # Database, Firebase configuration
|   |   +-- controllers/             # 11 route controllers
|   |   |   +-- authController.ts
|   |   |   +-- adminController.ts
|   |   |   +-- ownerController.ts
|   |   |   +-- userController.ts
|   |   |   +-- bookingController.ts
|   |   |   +-- locationController.ts
|   |   |   +-- sosController.ts
|   |   |   +-- chatController.ts
|   |   |   +-- aiController.ts
|   |   |   +-- geoController.ts
|   |   |   +-- pushController.ts
|   |   +-- middleware/              # Auth, role-based access control
|   |   +-- routes/                  # 11 API route groups
|   |   +-- services/                # Business logic layer
|   |   +-- utils/                   # Helpers (email, OTP, geocoding, AI)
|   |   +-- server.ts                # Entry point
|   +-- .env.example                 # Environment variables template
|   +-- package.json
|
+-- mobile/                          # React Native (Expo) Mobile App
|   +-- app/                         # File-based routing (15+ screens)
|   |   +-- (tabs)/                  # Tab navigation
|   |   |   +-- index.tsx            #   Home
|   |   |   +-- map.tsx              #   Map
|   |   |   +-- history.tsx          #   History
|   |   |   +-- tickets.tsx          #   Tickets
|   |   |   +-- profile.tsx          #   Profile
|   |   +-- booking/[serviceId].tsx  # Dynamic booking
|   |   +-- location/[id].tsx        # Location detail
|   |   +-- checkin.tsx              # Check-in
|   |   +-- diary.tsx                # Travel diary
|   |   +-- leaderboard.tsx          # Leaderboard
|   |   +-- vouchers.tsx             # Voucher wallet
|   |   +-- notifications.tsx        # Notifications
|   |   +-- saved-locations.tsx      # Favorites
|   |   +-- sos/                     # SOS emergency
|   |   +-- login.tsx                # Auth screens
|   |   +-- register.tsx
|   |   +-- forgot-password.tsx
|   +-- api/                         # Axios client and endpoints
|   +-- components/                  # Reusable UI components
|   +-- constants/                   # Theme, colors, spacing
|   +-- hooks/                       # Custom React hooks
|   +-- store/                       # Zustand state stores
|   +-- types/                       # TypeScript interfaces
|   +-- utils/                       # Helper functions
|
+-- website/                         # React SPA (Admin + Owner + User)
|   +-- src/
|   |   +-- api/                     # 11 API modules
|   |   +-- components/              # Shared components
|   |   +-- layouts/                 # MainLayout, UserLayout, FrontOffice
|   |   +-- pages/
|   |       +-- Admin/               # 18 admin pages
|   |       +-- Owner/               # 20 owner pages (incl. PMS and POS)
|   |       +-- User/                # 17 user pages
|   |       +-- Auth/                # Login, Register, OAuth callbacks
|   +-- package.json
|
+-- docs/                            # Project documentation
+-- TravelCheckinApp.sql             # MySQL database dump (53 tables)
+-- .gitignore
+-- README.md
```

---

## VII. Database Schema

The system uses a relational **MySQL** database with **53 tables** to ensure data integrity for complex business workflows. Below is the architecture of core entities:

*   **Core Entity System:** `users` ───< `locations` ───< `services` ───< `bookings`
*   **Hotel PMS Subsystem:** `hotel_rooms` >─── `hotel_stays` (Real-time room status tracking)
*   **Restaurant POS Subsystem:** `pos_tables` ───< `pos_orders` ───< `pos_order_items`
*   **Utilities & AI:** `vouchers`, `user_diary`, `sos_alerts`, `ai_chat_history`

> **Note:** The complete schema with foreign key constraints and query-optimized indexes is stored in `TravelCheckinApp.sql` at the project root.

### A. Core Entity Relationships

```
+----------------+       +--------------------+       +--------------------+
|     users      |       |     locations      |       |     services       |
|----------------|       |--------------------|       |--------------------|
| id (PK)        |<--+   | id (PK)            |<--+   | id (PK)            |
| name           |   |   | name               |   +---| location_id (FK)   |
| email          |   |   | type               |   |   | name               |
| role           |   |   | province           |   |   | type               |
| password       |   |   | latitude           |   |   | price              |
| avatar         |   |   | longitude          |   |   | quantity           |
| status         |   |   | owner_id (FK) -----+---+   +--------+-----------+
+--------+-------+   |   | images (JSON)      |                |
         |           |   | opening_hours      |                |
         v           |   +--------------------+                |
+----------------+   |                                         |
|owner_profiles  |   |   +--------------------+                |
|----------------|   |   |     bookings       |                |
| user_id (FK)   |---+   |--------------------|                |
| bank_name      |       | id (PK)            |                |
| bank_number    |       | user_id (FK) ------+----------------+---+
| approval       |       | service_id (FK) ---+----------------+   |
| commission_rate|       | status             |                    |
+----------------+       | voucher_id (FK)    |                    |
                         | check_in_date      |                    |
                         | total_amount       |                    |
                         +--------+-----------+                    |
                                  |                                |
              +-------------------+-------------------+            |
              v                   v                   v            v
    +----------------+  +----------------+  +-------------------------+
    |booking_tickets |  |    payments    |  |booking_table_           |
    |----------------|  |----------------|  |  reservations           |
    | id (PK)        |  | id (PK)        |  |-------------------------|
    | booking_id     |  | booking_id     |  | id (PK)                 |
    | ticket_code    |  | amount         |  | booking_id              |
    | qr_code        |  | commission     |  | table_id                |
    | status         |  | status         |  | status                  |
    +----------------+  +----------------+  +-------------------------+
```

### B. PMS and POS Subsystems

```
    +----------------+  +----------------+  +----------------+
    |  hotel_rooms   |  |   pos_tables   |  |    vouchers    |
    |----------------|  |----------------|  |----------------|
    | id (PK)        |  | id (PK)        |  | id (PK)        |
    | location_id    |  | area_id (FK)   |  | code           |
    | room_number    |  | table_number   |  | discount_type  |
    | floor          |  | status         |  | discount_value |
    | status         |  | position       |  | scope          |
    +-------+--------+  +-------+--------+  +----------------+
            |                   |
            v                   v
    +----------------+  +----------------+
    |  hotel_stays   |  |   pos_orders   |
    |----------------|  |----------------|
    | id (PK)        |  | id (PK)        |
    | room_id (FK)   |  | table_id (FK)  |
    | user_id (FK)   |  | user_id (FK)   |
    | status         |  | status         |
    | check_in       |  | total_amount   |
    | check_out      |  +-------+--------+
    +----------------+          |
                                v
                        +----------------+
                        | pos_order_items|
                        |----------------|
                        | id (PK)        |
                        | order_id (FK)  |
                        | item_name      |
                        | quantity       |
                        | price          |
                        +----------------+
```

### C. Table Summary by Domain

| Domain | Tables | Key Entities |
|--------|:------:|--------------|
| Auth and Users | 8 | users, owner_profiles, active_sessions, login_history, login_attempts, otp_codes, blacklist, preferences |
| Locations and Services | 3 | locations, services, service_categories |
| Bookings and Payments | 7 | bookings, booking_tickets, table_reservations, preorder_items, payments, commissions, commission_history |
| Hotel PMS | 3 | hotel_rooms, hotel_stays, hotel_stay_items |
| Restaurant POS | 5 | pos_areas, pos_tables, pos_orders, pos_order_items, pos_tickets |
| Check-in and SOS | 2 | checkins, sos_alerts |
| Reviews and Reports | 4 | reviews, review_replies, reports, owner_violations |
| Vouchers | 5 | vouchers, voucher_locations, voucher_usage_history, voucher_reviews, user_voucher_wallet |
| Chat and Notifications | 6 | chat_messages, location_chat_messages, push_notifications, notification_reads/dismissed |
| Other | 10 | favorites, diary, ai_chat_history, audit_logs, system_settings, background_schedules |

---

## VIII. Getting Started

### 1. Prerequisites

| Requirement | Version |
|-------------|---------|
| Node.js | v20.x or later |
| MySQL | v8.0 or later |
| npm | v9.x or later |
| Expo Go App | Latest (for testing on real mobile devices) |
| Git | Any |

### 2. Clone the Repository

```bash
git clone https://github.com/Minh2244/TravelCheckinApp.git
cd TravelCheckinApp
```

### 3. Setup the Database

```bash
mysql -u root -p
```

```sql
CREATE DATABASE TravelCheckinApp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;
```

```bash
mysql -u root -p TravelCheckinApp < TravelCheckinApp.sql
```

### 4. Configure Environment Variables

Create a `.env` file in the `backend/` directory:

```bash
cd backend
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# ==================== SERVER ====================
PORT=3000
NODE_ENV=development

# ==================== DATABASE (MySQL) ====================
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=TravelCheckinApp

# ==================== JWT (Security) ====================
JWT_SECRET=your_random_secret_string_here
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=your_another_random_secret
JWT_REFRESH_EXPIRES_IN=30d

# ==================== GOOGLE GEMINI AI ====================
GEMINI_API_KEY=your_gemini_api_key

# ==================== FIREBASE (Push Notifications) ====================
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json

# ==================== CORS ====================
CORS_ORIGIN=*
CORS_CREDENTIALS=true

# ==================== EMAIL (Gmail for OTP) ====================
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_gmail_app_password
EMAIL_FROM=Travel Check-in <no-reply@travelapp.com>

# ==================== OAUTH (Social Login) ====================
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret

# ==================== URLs ====================
API_URL=http://localhost:3000
FRONTEND_URL=http://localhost:5173
```

### 5. Install Dependencies and Run

**Backend:**

```bash
cd backend
npm install
npm run dev
# Server runs at http://localhost:3000
```

**Mobile App (new terminal):**

```bash
cd mobile
npm install
npx expo start
# Scan QR code with Expo Go app
```

**Website (new terminal):**

```bash
cd website
npm install
npm run dev
# Opens at http://localhost:5173
```

---

## IX. API Documentation

### A. Base URL

```
http://localhost:3000/api
```

### B. Route Groups

| Group | Endpoint | Auth | Description |
|-------|----------|------|-------------|
| Auth | `/auth` | Public + Protected | Login, register, OAuth, token refresh |
| Admin | `/admin` | Admin only | 100+ endpoints for platform management |
| Owner | `/owner` | Owner + Employee | 100+ endpoints for business management |
| User | `/user` | User only | Consumer features |
| Bookings | `/bookings` | User only | Booking and reservation system |
| Locations | `/locations` | Optional | Public location data and search |
| SOS | `/sos` | User only | Emergency alerts |
| Chat | `/chat` | Authenticated | Location-based group chat |
| AI | `/ai` | Authenticated | AI chat assistant |
| Geocoding | `/geo` | Public | Forward/reverse geocoding |
| Push | `/push` | Authenticated | Device token management |
| Events | `/events` | Query token | SSE real-time updates |

### C. Example: Create a Booking

```bash
curl -X POST http://localhost:3000/api/bookings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your_jwt_token>" \
  -d '{
    "service_id": 1,
    "check_in_date": "2026-06-15",
    "check_out_date": "2026-06-17",
    "quantity": 2,
    "voucher_code": "SUMMER20"
  }'
```

---

## X. Development Progress

The project is currently in the final sprint to complete advanced features for the graduation thesis defense:

- [x] **Phase 1** — Database Schema Design & Core Backend API (Auth, Roles, Middleware)
- [x] **Phase 2** — Mobile App Development (Check-in, Map, Booking, QR Wallet, Diary)
- [x] **Phase 3** — Web Dashboard for Admin & Owner management module
- [ ] **Phase 4** — Complete drag-and-drop core for Hotel PMS and Restaurant POS *(90% done)*
- [ ] **Phase 5** — Full Firebase Push Notification integration & Socket.IO real-time stress testing
- [ ] **Phase 6** — AI Chat Integration with Google Gemini *(placeholder only, not yet connected)*

---

## XI. Author

**Mai Nhut Minh**

- GitHub: [@Minh2244](https://github.com/Minh2244)
- Institution: Tay Do University
- Class: CNTT17A
- Project: Travel Checkin

---

## XII. License

Copyright belongs to the author. All rights reserved.
