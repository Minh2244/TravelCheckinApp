# Multi-role Travel Management and Experience System with AI Integration

### Hệ thống quản lý và trải nghiệm du lịch đa vai trò tích hợp trí tuệ nhân tạo

[![Copyright](https://img.shields.io/badge/Copyright-©%202026%20Mai%20Nhut%20Minh-blue)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-v20+-339933)](https://nodejs.org/)
[![MySQL](https://img.shields.io/badge/MySQL-v8.0+-4479A1)](https://mysql.com/)
[![React](https://img.shields.io/badge/React-19-61DAFB)](https://react.dev/)

A comprehensive full-stack travel ecosystem connecting tourists with service providers through integrated POS (Point of Sale), PMS (Property Management System), Smart Check-in, and AI-powered features. Built as a graduation thesis at Tay Do University.

---

## Table of Contents

- [I. Project Overview](#i-project-overview)
- [II. Key Features](#ii-key-features)
- [III. System Architecture](#iii-system-architecture)
- [IV. Roles and Access Control](#iv-roles-and-access-control)
- [V. Tech Stack](#v-tech-stack)
- [VI. Project Structure](#vi-project-structure)
- [VII. Database Schema (56 Tables)](#vii-database-schema-56-tables)
- [VIII. Getting Started](#viii-getting-started)
- [IX. API Documentation](#ix-api-documentation)
- [X. Development Progress](#x-development-progress)
- [XI. Author](#xi-author)
- [XII. Copyright and License](#xii-copyright-and-license)

---

## I. Project Overview

This project is a full-stack travel ecosystem consisting of three main components:

| Component | Description | Technology |
|-----------|-------------|------------|
| **Backend API** | RESTful server with real-time capabilities | Node.js, Express 5, TypeScript |
| **Web Dashboard** | Admin, Owner, and User management panels | React 19, Vite 7, Ant Design, TypeScript |
| **Mobile App** | Tourist client for check-ins, maps, and service bookings | Expo (React Native), TypeScript, OSM Maps |

The system enables tourists to discover locations, book services (hotel rooms, restaurant tables, tourist tickets), check in via QR codes, plan itineraries, earn rewards through a leaderboard system, and receive emergency assistance through SOS alerts. Service owners are equipped with a full POS/PMS system to manage their business operations. The platform integrates Google Gemini AI for intelligent chatbot assistance and personalized recommendations.

---

## II. Key Features

### A. For Travelers

1. **Smart Check-in** — GPS-based check-in with geofencing and photo capture
2. **Interactive Map** — Browse locations with OpenStreetMap tiles, markers, and routing (OSRM)
3. **Multi-service Booking** — Reserve hotel rooms, restaurant tables, and tourist tickets in one flow
4. **QR Ticket Wallet** — Digital tickets with unique QR codes for instant verification
5. **Travel Diary** — Document trips with mood tracking and photo entries
6. **Itinerary Planning** — Create day-by-day travel plans with location search and navigation
7. **Voucher Wallet** — Claim and redeem discount vouchers from the platform and locations
8. **Leaderboard** — Gamified ranking based on check-in activity and travel engagement
9. **SOS Emergency** — Real-time GPS alert system for emergencies with admin monitoring
10. **AI Chat Assistant** — Google Gemini-powered chatbot for travel planning
11. **Location Chat** — Real-time chat with location owners via Socket.IO
12. **Booking Reminders** — Automated notifications for upcoming bookings
13. **Social Login** — Google and Facebook OAuth integration
14. **Personalized Recommendations** — AI-driven location suggestions based on travel history

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

### G. Mobile App (Tourist Experience & Bookings)

1. **Interactive Compass Map**:
   - Integrated OpenStreetMap (OSM) rendering with Expo React Native Maps.
   - Real-time compass-driven user orientation arrow with a Low-Pass Filter to eliminate sensor noise, and native-driven animation values to ensure smooth, lag-free rotations.
   - Intelligent routing (OSRM Polyline decoding) with GPS Drift filtration to prevent redundant API calls for movements under 15 meters.
2. **Multi-Service Booking UI**:
   - **Restaurant/Cafe**: Support booking single or multiple tables. Pre-ordering meals is allowed for single table reservations, requiring online prepayment.
   - **Hotel PMS Stays**: Book hotel rooms (up to 20 rooms per transaction) with auto check-out date calculation.
   - **Tourist Tickets**: Custom quantity booking with an enforced transaction limit of 50 tickets maximum.
3. **Dynamic VietQR Prepayment Gateway**:
   - Backend automatically fetches owner-specific bank details (`bank_name`, `bank_account`, `account_holder`) from the `owner_profiles` database table based on location.
   - The Mobile app displays billing details completely dynamically from the API response to avoid hardcoded bank credentials on the frontend, with a "one-tap to copy" feature to copy credentials into the clipboard.
4. **Token Lifecycle & Security**:
   - Auto Access Token injection and automatic Silent Refresh via Axios interceptors utilizing Expo SecureStore, avoiding user log-out during active transactions.
5. **Offline Ticket Wallet & Push Notifications**:
   - Offline ticket visualization using AsyncStorage cache for seamless check-in at locations with poor network coverage.
   - Expo/FCM push notifications integration to notify users about booking updates, confirmations, or check-in schedules.

---


## III. System Architecture

```text
                         +---------------------------------------------+
                         |              Client Layer                    |
                         +-------------------------------+--------------+
                         |  Website (Owner/User)         |  Admin       |
                         |  (React SPA)                  |  (React)     |
                         +-----------------------+-------+------+-------+
                                                 |              |
                                                 +----+---------+
                                                      |
                                          +-----------v-----------+
                                          |      Backend API      |
                                          |     (Express 5)       |
                                          |     Port: 3000        |
                                          +---+-------+-------+---+
                                              |       |       |
                              +---------------+       |       +---------------+
                              v                       v                       v
                       +-------------+         +-------------+         +-------------+
                       |    MySQL    |         |  Firebase   |         |   Google    |
                       |  Database   |         |    Cloud    |         |   Gemini    |
                       |  56 tables  |         |  Messaging  |         |     AI      |
                       +-------------+         +-------------+         +-------------+

                       Real-time: Socket.IO (WebSocket) + SSE
```

---

## IV. Roles and Access Control

The system implements **4 distinct roles** with JWT-based authentication:

| Role | Scope | Key Capabilities |
|------|-------|------------------|
| **Admin** | Platform-wide | Full control: user/owner management, location moderation, commission, analytics, vouchers, AI settings, SOS monitoring, push notifications |
| **Owner** | Business-level | Location CRUD, service/booking/payment management, hotel PMS, restaurant POS, tourist POS, employee management, vouchers, reviews |
| **Employee** | Location-level | Subset of owner: front-office POS, hotel PMS, ticket scanning; permissions assigned by owner via JSON config |
| **User** | Consumer | Booking, check-in, favorites, vouchers, reviews, travel diary, itinerary, SOS, leaderboard, AI chat |

**Access Rules:**

- Owner accounts require admin approval before accessing owner features.
- Locked accounts are blocked at the middleware level.
- Single active session per user — new login revokes previous sessions.
- Token refresh with separate access and refresh tokens (JWT).

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
| Image Processing | Sharp (resize, compress) |
| File Storage | MySQL LONGBLOB (images table) |
| Email | Nodemailer (Gmail SMTP) |
| Validation | Zod v4 |
| Security | Helmet, CORS, Compression |

### B. Website

| Category | Technology |
|----------|------------|
| Framework | React 19 + TypeScript |
| Build Tool | Vite 7 |
| Routing | react-router-dom v7 |
| UI Library | Ant Design v6 |
| State Management | Zustand |
| Styling | Tailwind CSS 3 |
| Maps | react-leaflet (OpenStreetMap) |
| QR/Barcode | qrcode.react, @zxing/browser |
| Forms | react-hook-form + Zod |
| OAuth | @react-oauth/google, @greatsumini/react-facebook-login |
| Real-time | socket.io-client, EventSource (SSE) |

---

## VI. Project Structure

```text
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
|   |   |   +-- locationChatController.ts
|   |   |   +-- aiController.ts
|   |   |   +-- geoController.ts
|   |   |   +-- pushController.ts
|   |   |   +-- imageController.ts
|   |   |   +-- itineraryController.ts
|   |   +-- middleware/              # Auth, role-based access control
|   |   +-- routes/                  # 11 API route groups
|   |   +-- services/                # Business logic layer
|   |   +-- utils/                   # Helpers (email, OTP, geocoding, AI, socketHub)
|   |   +-- server.ts                # Entry point
|   +-- .env.example                 # Environment variables template
|   +-- package.json
|
+-- website/                         # React SPA (Admin + Owner + User)
|   +-- src/
|   |   +-- api/                     # 11 API modules
|   |   +-- components/              # Shared components
|   |   +-- layouts/                 # MainLayout, UserLayout, FrontOffice
|   |   +-- pages/
|   |       +-- Admin/               # 18 admin pages
|   |       +-- Owner/               # 20 owner pages (incl. PMS and POS)
|   |       +-- User/                # 19 user pages
|   |       +-- Auth/                # Login, Register, OAuth callbacks
|   +-- package.json
|
+-- docs/                            # Project documentation
|
+-- mobile/                          # Expo / React Native Mobile App (Tourist Client)
|   +-- app/                         # App routes (Expo Router)
|   |   +-- (tabs)/                  # Main tabs (explore, booking, profile, etc.)
|   |   +-- location/                # Location details & reviews
|   |   +-- booking/                 # Booking details, tickets, and payments
|   +-- hooks/                       # Business logic (useCompass, useBookingCalculator, etc.)
|   +-- api/                         # API Client modules (Axios integration)
|   +-- components/                  # Reusable UI elements (UI Shell components)
|
+-- TravelCheckinApp.sql             # MySQL database dump (56 tables)
+-- LICENSE                          # License file
+-- .gitignore
+-- README.md
```

---

## VII. Database Schema (56 Tables)

The system uses a relational **MySQL** database with **56 tables** organized across 12 functional domains to ensure data integrity for complex business workflows. The complete schema with foreign key constraints and query-optimized indexes is stored in `TravelCheckinApp.sql` at the project root.

### A. Complete Table Inventory

#### 1. Authentication and Users (8 tables)

| # | Table | Description |
|---|-------|-------------|
| 1 | `users` | Core user accounts with role-based access (admin, owner, employee, user) |
| 2 | `owner_profiles` | Extended business profile for owners (bank info, approval status, commission) |
| 3 | `user_active_sessions` | JWT session tracking — single active session per user |
| 4 | `login_history` | Complete login audit trail with IP, device, and timestamp |
| 5 | `login_attempts` | Failed login tracking for brute-force protection |
| 6 | `otp_codes` | One-time passwords for email verification and password reset |
| 7 | `account_blacklist` | Banned accounts with reason and expiration |
| 8 | `user_preferences` | User settings and notification preferences |

#### 2. Locations and Services (3 tables)

| # | Table | Description |
|---|-------|-------------|
| 9 | `locations` | Business locations with geo coordinates, images, opening hours, and auto-config |
| 10 | `services` | Bookable services per location (rooms, tables, tickets, food, combos) |
| 11 | `service_categories` | Service type classification and grouping |

#### 3. Bookings and Payments (7 tables)

| # | Table | Description |
|---|-------|-------------|
| 12 | `bookings` | Core booking records with status tracking and voucher integration |
| 13 | `booking_tickets` | QR-coded digital tickets for tourist attractions |
| 14 | `booking_table_reservations` | Restaurant table reservations linked to bookings |
| 15 | `booking_preorder_items` | Pre-ordered food/menu items for table reservations |
| 16 | `payments` | Payment transactions with commission calculation |
| 17 | `commissions` | Platform commission records per owner |
| 18 | `commission_history` | Commission payment history and settlement tracking |

#### 4. Hotel PMS (3 tables)

| # | Table | Description |
|---|-------|-------------|
| 19 | `hotel_rooms` | Room inventory with floor, number, type, and status |
| 20 | `hotel_stays` | Active and historical guest stays with check-in/out |
| 21 | `hotel_stay_items` | Minibar charges, service fees, and additional costs per stay |

#### 5. Restaurant POS (5 tables)

| # | Table | Description |
|---|-------|-------------|
| 22 | `pos_areas` | Dining area sections (indoor, outdoor, VIP, etc.) |
| 23 | `pos_tables` | Physical tables with drag-and-drop positioning |
| 24 | `pos_orders` | Active orders linked to occupied tables |
| 25 | `pos_order_items` | Individual items within each order |
| 26 | `pos_tickets` | Tourist attraction tickets sold via POS |

#### 6. Check-in and SOS (2 tables)

| # | Table | Description |
|---|-------|-------------|
| 27 | `checkins` | GPS-based location check-ins with photo and geofence data |
| 28 | `sos_alerts` | Emergency alerts with real-time GPS coordinates and resolution status |

#### 7. Reviews and Reports (4 tables)

| # | Table | Description |
|---|-------|-------------|
| 29 | `reviews` | User reviews and ratings for locations |
| 30 | `review_replies` | Owner responses to user reviews |
| 31 | `reports` | User-submitted reports (content violations, abuse) |
| 32 | `owner_violations` | Tracked violations and warnings issued to owners |

#### 8. Voucher System (5 tables)

| # | Table | Description |
|---|-------|-------------|
| 33 | `vouchers` | Voucher definitions with type, discount, and validity |
| 34 | `voucher_locations` | Voucher-to-location mapping (which locations accept which vouchers) |
| 35 | `voucher_usage_history` | Redemption tracking per user per voucher |
| 36 | `voucher_reviews` | User reviews tied to voucher usage |
| 37 | `user_voucher_wallet` | User's claimed vouchers stored in personal wallet |

#### 9. Chat and Notifications (6 tables)

| # | Table | Description |
|---|-------|-------------|
| 38 | `chat_messages` | General real-time chat messages (Socket.IO) |
| 39 | `location_chat_messages` | Location-specific chat between users and owners |
| 40 | `push_notifications` | Push notification records (Firebase Cloud Messaging) |
| 41 | `user_notification_reads` | Read status tracking for user notifications |
| 42 | `user_notification_dismissed` | Dismissed notification tracking for users |
| 43 | `owner_notification_reads` | Read status tracking for owner notifications |

#### 10. Image Storage (3 tables)

| # | Table | Description |
|---|-------|-------------|
| 44 | `images` | Binary image data stored as LONGBLOB with metadata |
| 45 | `entity_images` | Polymorphic junction table linking images to any entity |
| 46 | `image_categories` | Image type definitions with size/quality constraints |

#### 11. Itinerary (2 tables)

| # | Table | Description |
|---|-------|-------------|
| 47 | `itineraries` | User-created travel itineraries with date range |
| 48 | `itinerary_items` | Day-by-day itinerary items with location and notes |

#### 12. System and Utilities (8 tables)

| # | Table | Description |
|---|-------|-------------|
| 49 | `favorites` | User's saved/favorite locations |
| 50 | `user_diary` | Travel diary entries with mood, text, and photos |
| 51 | `ai_chat_history` | AI chatbot conversation logs (Google Gemini) |
| 52 | `audit_logs` | System-wide audit trail for admin actions |
| 53 | `system_settings` | Key-value system configuration store |
| 54 | `background_schedules` | Scheduled tasks (auto-confirm, auto-cancel, cleanup) |
| 55 | `owner_notification_dismissed` | Dismissed notification tracking for owners |
| 56 | `employee_locations` | Employee-to-location permission assignments |

### B. Core Entity Relationships

```text
+----------------+       +--------------------+       +--------------------+
|     users      |       |     locations      |       |     services       |
|----------------|       |--------------------|       |--------------------|
| id (PK)        |<--+   | id (PK)            |<--+   | id (PK)            |
| name           |   |   | name               |   +---| location_id (FK)   |
| email          |   |   | type               |   |   | name               |
| role           |   |   | province           |   |   | price              |
| password       |   |   | latitude           |   |   | quantity           |
| avatar_url     |   |   | longitude          |   |   | pos_id             |
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

### C. PMS and POS Subsystems

```text
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

### D. Image Storage System

```text
    +----------------+  +----------------+  +----------------+
    |    images      |  | entity_images  |  |image_categories|
    |----------------|  |----------------|  |----------------|
    | id (PK)        |  | id (PK)        |  | id (PK)        |
    | category_id FK |  | image_id (FK)  |  | name           |
    | original_name  |  | entity_type    |  | max_width      |
    | mime_type      |  | entity_id      |  | max_height     |
    | file_size      |  | role           |  | quality        |
    | data (LONGBLOB)|  | sort_order     |  | max_file_size  |
    | uploaded_by    |  | is_primary     |  +----------------+
    +----------------+  +----------------+
```

---

## VIII. Getting Started

### 1. Prerequisites

| Requirement | Version |
|-------------|---------|
| Node.js | v20.x or later |
| MySQL | v8.0 or later |
| npm | v9.x or later |
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

```text
http://localhost:3000/api
```

### B. Route Groups

| Group | Endpoint | Auth | Description |
|-------|----------|------|-------------|
| Auth | `/auth` | Public + Protected | Login, register, OAuth, token refresh |
| Admin | `/admin` | Admin only | 100+ endpoints for platform management |
| Owner | `/owner` | Owner + Employee | 100+ endpoints for business management |
| User | `/user` | User only | Consumer features (checkins, favorites, diary, vouchers, itinerary, notifications) |
| Bookings | `/bookings` | User only | Booking and reservation system |
| Locations | `/locations` | Optional | Public location data and search |
| Images | `/images` | Optional | Image serving (binary) from database |
| Itinerary | `/user/itineraries` | User only | Travel itinerary CRUD |
| SOS | `/sos` | User only | Emergency alerts |
| Chat | `/chat` | Authenticated | Location-based real-time chat |
| AI | `/ai` | Authenticated | AI chat assistant (Google Gemini) |
| Geocoding | `/geo` | Public | Forward/reverse geocoding (Nominatim) |
| Push | `/push` | Authenticated | Device token management (FCM) |
| Events | `/events` | Query token | SSE real-time booking updates |

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

- [x] **Phase 1** — Database Schema Design & Core Backend API (Auth, Roles, Middleware)
- [x] **Phase 2** — Web Dashboard for Admin & Owner management module
- [x] **Phase 3** — Complete database schema (56 tables) and restore full functionality
- [x] **Phase 4** — Mobile App Phase 3 Planning (UI Shell, API Client, Custom Hooks design & Dynamic VietQR specification)
- [ ] **Phase 5** — Mobile App Implementation (OSM Maps, Stays/POS Booking Flow, and Payment integration)
- [ ] **Phase 6** — Hotel PMS and Restaurant POS drag-and-drop refinement
- [ ] **Phase 7** — AI Chat Integration with Google Gemini

---

## XI. Author

**Mai Nhut Minh**

- GitHub: [@Minh2244](https://github.com/Minh2244)
- Email: minhmap3367@gmail.com
- Institution: Tay Do University
- Class: CNTT17A
- Year: 2026

---

## XII. Copyright and License

### Project Information

| Field | Details |
|-------|---------|
| **Project Name (Vietnamese)** | Hệ thống quản lý và trải nghiệm du lịch đa vai trò tích hợp trí tuệ nhân tạo |
| **Project Name (English)** | Multi-role Travel Management and Experience System with AI Integration |
| **Author** | Mai Nhut Minh |
| **Institution** | Tay Do University |
| **Class** | CNTT17A |
| **Year** | 2026 |
| **Project Type** | Graduation Thesis |

### Copyright Notice

```text
Copyright (c) 2026 Mai Nhut Minh. All rights reserved.

This project is an original graduation thesis developed at Tay Do University,
Vietnam. All intellectual property rights, including but not limited to source
code, database design, system architecture, UI/UX design, and documentation,
belong exclusively to the author.

Unauthorized use is strictly prohibited. The following activities require
prior written consent from the author:

  1. Copying, reproducing, or distributing all or part of the source code
  2. Using this project or its derivatives for commercial purposes
  3. Registering copyright or patent under any other name
  4. Modifying, adapting, or creating derivative works for redistribution
  5. Removing or altering this copyright notice
  6. Claiming authorship of any portion of this work

This project is provided "as-is" for educational and academic reference only.
The author makes no warranties regarding its fitness for any particular purpose.

Any violation of these terms will be pursued under the Intellectual Property
Law of Vietnam (Law No. 50/2005/QH11, amended by Law No. 36/2009/QH12) and
applicable international copyright treaties.

For permissions or inquiries, contact the author at:
  GitHub:  https://github.com/Minh2244
  Email:   minhmap3367@gmail.com
```

### Trademark and Branding

The project name "Travel Check-in" and all associated logos, marks, and branding
elements are the property of Mai Nhut Minh. Use of the brand name in any
derivative, fork, or related project without written permission is prohibited.

### Third-Party Acknowledgments

This project uses the following open-source technologies. Their respective
licenses apply to their own code:

| Technology | License |
|------------|---------|
| Node.js | MIT |
| Express | MIT |
| React | MIT |
| Ant Design | MIT |
| Tailwind CSS | MIT |
| Socket.IO | MIT |
| MySQL | GPL v2 (server) / MIT (client driver) |
| Google Gemini API | Google API Terms of Service |
| Firebase | Google Firebase Terms of Service |
| OpenStreetMap | Open Database License (ODbL) |

---

*This README was last updated on June 16, 2026.*
