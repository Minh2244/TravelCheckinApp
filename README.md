# Multi-role Travel Management and Experience System with AI Integration

### Hệ thống quản lý và trải nghiệm du lịch đa vai trò tích hợp trí tuệ nhân tạo

A comprehensive full-stack travel ecosystem connecting tourists with service providers through integrated POS (Point of Sale), PMS (Property Management System), Smart Check-in, and AI-powered features. Built as a graduation thesis at Tay Do University.

---

## Table of Contents

- [I. Project Overview](#i-project-overview)
- [II. Website Dashboard (Admin, Owner, User)](#ii-website-dashboard-admin-owner-user)
- [III. Backend API & AI Services](#iii-backend-api--ai-services)
- [IV. Mobile App (Tourist Client)](#iv-mobile-app-tourist-client)
- [V. System Architecture & Roles](#v-system-architecture--roles)
- [VI. Database Schema (59 Tables)](#vi-database-schema-59-tables)
- [VII. Development Progress](#vii-development-progress)
- [VIII. Author & License](#viii-author--license)

---

## I. Project Overview

This project is a full-stack travel ecosystem consisting of three main components:

| Component | Description | Technology |
|-----------|-------------|------------|
| **Website Dashboard** | Admin, Owner, and User management panels | React 19, Vite 7, Ant Design, TypeScript |
| **Backend API & AI** | RESTful server, Real-time services & AI Bot | Node.js, Express 5, Python (AI), MySQL |
| **Mobile App** | Tourist client for check-in & exploration | Expo (React Native), TypeScript |

The system enables tourists to discover locations, book services (hotel rooms, restaurant tables, tourist tickets), check in via QR codes, plan itineraries, earn rewards through a leaderboard system, and receive emergency assistance through SOS alerts. Service owners are equipped with a full POS/PMS system to manage their business operations. The platform integrates Google Gemini AI for intelligent chatbot assistance and personalized recommendations.

---

## II. Detailed Features & Permissions by Role

The system provides tailored interfaces and features for four distinct roles: Admin, Owner, Employee, and User (Tourist). Each role has access to specific pages and functionalities.

### 1. User Role (Tourist / Consumer)
Tourists use both the Web Portal and the Mobile App to discover and experience travel.
- **Dashboard:** Features location recommendations and a real-time weather widget.
- **Interactive Map:** A split-screen interface (Map on the left, Location Details on the right). Clicking a location instantly fetches its local weather. Supports full routing/navigation. Users can also select any "free location" on the map to save or navigate to.
- **Location Details:** Google Maps-style detailed information and comments, with direct links to pre-book services.
- **Distinct Booking UIs:** Three completely independent interfaces for booking Food (Restaurants), Hotels, and Tourism Tickets. Supported payment methods include Pay Later and Bank Transfer.
- **Ticket Wallet (Vỏ vé):** A smart wallet storing invoices, ticket codes, and dynamically generated QR codes. (Fun fact: Originally designed for tourist tickets, this feature was cleverly adapted for restaurants and hotels using descriptive stickers instead of full images, taking a week to perfect!). Staff can scan the QR or enter the code to verify.
- **Saved Locations:** Bookmark favorite spots.
- **Travel Diary:** Log past check-ins, write personal emotions, and upload photos (private visibility).
- **Itinerary Planner:** A straightforward planner to select destinations and times to create a customized travel journey.
- **SOS Alert:** A panic button that instantly sends emergency notifications and location data to the Admin.
- **Profile:** Basic info management featuring an advanced, Zalo-style avatar cropping and zooming tool.

### 2. Admin Role (Platform Administrator)
The Admin has absolute control over the platform, ensuring quality, safety, and financial operations.
- **Dashboard:** System overview and analytics.
- **Account Management:** Can lock or delete accounts across all roles (Users, Owners, Employees, Admins).
- **Location Moderation:** Review location info and map coordinates before approving or rejecting newly registered business locations.
- **Service Moderation:** Review and approve/reject specific services, prices, and images submitted by Owners.
- **Review Moderation:** Monitor user reviews and owner replies. Admins can delete inappropriate reviews but cannot participate in the comment thread.
- **Commission Management:** Track commission history and exact amounts. Admins manually confirm receipt of commission transfers from Owners.
- **Bank Configuration:** Admins set up their receiving bank account. The system automatically generates a VietQR code for Owners to pay their commissions.
- **System Settings:** Update website/mobile background images and set the default global commission percentage.
- **Export Reports (Excel):** Export detailed revenue, order, and commission reports for individual Owners or the entire platform.
- **System Vouchers:** Create platform-wide promotional vouchers.
- *(Upcoming)* AI capabilities.

### 3. Owner Role (Business Partner)
Owners are travel service providers. Their experience is divided into two distinct flows: **Normal Mode** and **Operational Mode**.

#### I. Normal Mode (Business Management)
- **Dashboard:** Business overview with a quick-access button to switch to Operational Mode.
- **Location Creation:** Pick a spot on the map, enter details, choose a service type, and submit for Admin approval.
- **Configuration (Post-Approval):** Set up specific layouts based on business type:
  - Food: Table and seating layout.
  - Hotel: Room layout.
  - Tourism: Ticket types.
- **Service Creation:** Create categories and services, subject to Admin approval (any subsequent edits require re-approval).
- **History:** Comprehensive logs of transactions, financial data, and timestamps.
- **Bank Configuration:** Owners set up their own bank details for direct user bank transfers.
- **Commission Settlement:** View owed commissions, perform reconciliation, and pay the Admin (clicking the button pops up a QR code with the exact owed amount).
- **Employee Management:** Create and manage staff accounts.
- **Owner Vouchers:** Create location-specific vouchers (fixed amount or percentage) without needing Admin approval.
- **Export Reports (Excel):** Export business-specific revenue and order reports.
- **Customer Chat:** Direct messaging with users.
- *(Upcoming)* AI capabilities.

#### II. Operational Mode (Trang vận hành)
Accessible by Owners and their Employees. Users enter this mode by selecting a specific location to operate.
- **Food (Restaurant/Cafe):** Select a table, choose services/food, and process usage.
- **Hotel:** Select a room, enter guest info, check-in, and calculate payment based on stay duration.
- **Tourism:** Direct offline ticket sales.
- **Shared Features:** All three services support online pre-booking. An operational history page separates offline and online sales (platform commission only applies to online pre-bookings) and features revenue charts.

### 4. Employee Role (Staff)
- **Restricted Access:** Employees log in and are directed primarily to the **Operational Mode** for the specific locations assigned to them by the Owner.
- **Operational Tasks:** They handle day-to-day tasks like assigning tables, checking in hotel guests, or selling/scanning tickets.

---

## III. Backend API & AI Services

The backend serves as the central nervous system, handling data persistence, business logic, real-time communication, and AI integration.

### 1. Tech Stack
| Category | Technology |
|----------|------------|
| Runtime | Node.js + TypeScript |
| Framework | Express 5.x |
| Database | MySQL (mysql2, promise-based pool) |
| Authentication | JWT (jsonwebtoken), bcrypt |
| Real-time | Socket.IO, Server-Sent Events (SSE) |
| AI | Google Gemini (@google/generative-ai) |
| Push Notifications | Firebase Cloud Messaging (firebase-admin) |
| File Storage | MySQL LONGBLOB (images table) |

### 2. Key Features
- **11 Robust API Route Groups:** Covering auth, admin, owner, user, bookings, locations, SOS, chat, geo, push, and events.
- **Role-Based Access Control:** Strict JWT middleware to segregate Admin, Owner, Employee, and User operations.
- **Real-Time Engine:** Websockets for location chat, SSE for booking status updates.
- **AI Integration (Customer Assistant):** Context-aware Gemini AI integrated into the user flow.
- **AI Manager Bot (Microservice):** Isolated Python-based AI service for Admin/Owner analytics and reviews processing.
- **Image Processing:** Automated resizing and compression using Sharp before storing in MySQL LONGBLOB.

---

## IV. Mobile App (Tourist Client)

A dedicated mobile application designed for tourists on the go, focusing on location-based services and seamless travel experiences.

### 1. Tech Stack
| Category | Technology |
|----------|------------|
| Framework | Expo / React Native |
| Language | TypeScript |
| Routing | Expo Router |
| Networking | Axios |

### 2. Key Features
- **Smart Check-in:** GPS-based check-in with geofencing and mandatory photo capture.
- **QR Ticket Wallet:** Mobile access to digital tickets with unique QR codes for instant verification at attraction gates.
- **Interactive Map:** Browse nearby locations, view markers, and navigate.
- **SOS Emergency:** One-tap real-time GPS alert system for emergencies.
- **Leaderboard:** Gamified ranking based on check-in activity and travel engagement.

*(Note: The Mobile App component is currently under active development)*

---

## V. System Architecture & Roles

```text
TravelCheckinApp/
├── website/                         # React SPA (Admin + Owner + User)
│   └── src/pages/ (Admin, Owner, User, Auth)
│
├── backend/                         # Node.js + Express REST API
│   └── src/
│       ├── controllers/             # 11 route controllers
│       ├── services/                # Business logic
│       │   └── ai-services/         # AI Customer Assistant for Users
│       └── utils/
│
├── ai-manager-bot/                  # Python Microservice (Owner/Admin AI)
│   └── app/services/                # Analytics and report processing
│
└── mobile/                          # Expo / React Native Mobile App
    └── app/(tabs)/                  # Main travel tabs
```

### Roles and Access Control

| Role | Scope | Key Capabilities |
|------|-------|------------------|
| **Admin** | Platform-wide | Full control: user/owner management, location moderation, commission, AI settings, SOS |
| **Owner** | Business-level | Location CRUD, POS/PMS management, employee management, vouchers, reviews |
| **Employee** | Location-level | Subset of owner: front-office POS, hotel PMS, ticket scanning (assigned by owner) |
| **User** | Consumer | Booking, check-in, favorites, vouchers, reviews, itinerary, SOS, AI chat |

---

## VI. Database Schema (59 Tables)

The system uses a relational **MySQL** database with **59 tables** organized across 12 functional domains to ensure data integrity for complex business workflows. 

1. **Authentication and Users (8 tables):** Core user accounts, owner profiles, JWT sessions, OTP, blacklist.
2. **Locations and Services (3 tables):** Business locations, bookable services, service categories.
3. **Bookings and Payments (7 tables):** Bookings, QR tickets, table reservations, pre-orders, payments, commissions.
4. **Hotel PMS (3 tables):** Room inventory, guest stays, minibar/service charges.
5. **Restaurant POS (5 tables):** Dining areas, drag-and-drop tables, active orders, order items.
6. **Check-in and SOS (2 tables):** GPS check-ins, emergency alerts.
7. **Reviews and Reports (4 tables):** User reviews, owner replies, reports, owner violations.
8. **Voucher System (5 tables):** Voucher definitions, mapping, usage history, user wallet.
9. **Chat and Notifications (6 tables):** General chat, location chat, push notifications, read tracking.
10. **Image Storage (3 tables):** Binary image data (LONGBLOB), polymorphic links.
11. **Itinerary (2 tables):** Travel itineraries, day-by-day items.
12. **System and Utilities (8 tables):** Favorites, diary, AI chat history, audit logs, background tasks.

*(The complete schema with foreign key constraints and query-optimized indexes is stored in `TravelCheckinApp.sql` at the project root).*

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

#### 5. Restaurant POS (6 tables)

| # | Table | Description |
|---|-------|-------------|
| 22 | `pos_areas` | Dining area sections (indoor, outdoor, VIP, etc.) |
| 23 | `pos_tables` | Physical tables with drag-and-drop positioning |
| 24 | `pos_orders` | Active orders linked to occupied tables |
| 25 | `pos_order_items` | Individual items within each order |
| 26 | `pos_tickets` | Tourist attraction tickets sold via POS |
| 27 | `location_invoice_sequences` | Auto-generated invoice sequences for each location |

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

#### 12. System and Utilities (10 tables)

| # | Table | Description |
|---|-------|-------------|
| 50 | `favorite_locations` | User's saved/favorite locations |
| 51 | `user_diary` | Travel diary entries with mood, text, and photos |
| 52 | `ai_chat_history` | AI chatbot conversation logs (Google Gemini) |
| 53 | `ai_conversations` | Independent AI conversation sessions management |
| 54 | `ai_assistant_feedback` | User feedback regarding AI responses |
| 55 | `audit_logs` | System-wide audit trail for admin actions |
| 56 | `system_settings` | Key-value system configuration store |
| 57 | `background_schedules` | Scheduled tasks (auto-confirm, auto-cancel, cleanup) |
| 58 | `owner_notification_dismissed` | Dismissed notification tracking for owners |
| 59 | `employee_locations` | Employee-to-location permission assignments |

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
    | ticket_code    |  | amount         |  | commission     |  | table_id                |
    | qr_code        |  | status         |  | status                  |
    | status         |  +----------------+  +-------------------------+
    +----------------+
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

## VII. Development Progress

- ✔️ **Phase 1** — Database Schema Design & Core Backend API (Auth, Roles, Middleware)
- ✔️ **Phase 2** — Web Dashboard for Admin & Owner management module
- ✔️ **Phase 3** — Complete database schema (59 tables) and restore full functionality
- ✔️ **Phase 4** — Mobile App Development (Auth, Home, Map, Booking & Unified Wallet)
- ❌ **Phase 5** — Mobile App (User Utilities, Saved Locations, Diary, SOS & Vouchers)
- ❌ **Phase 6** — Mobile App (AI Chat, Location Chat & Itinerary Planner)
- ❌ **Phase 7** — Hotel PMS and Restaurant POS drag-and-drop refinement
- ❌ **Phase 8** — AI Integration across Web and Mobile with Google Gemini

---

## VIII. Author & License

### Project Information

| Field | Details |
|-------|---------|
| **Project Name (Vietnamese)** | Hệ thống quản lý và trải nghiệm du lịch đa vai trò tích hợp trí tuệ nhân tạo |
| **Project Name (English)** | Multi-role Travel Management and Experience System with AI Integration |
| **Author** | **Mai Nhut Minh** (minhmap3367@gmail.com) |
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
```

### Trademark and Branding
The project name "Travel Check-in" and all associated logos, marks, and branding elements are the property of Mai Nhut Minh. Use of the brand name in any derivative, fork, or related project without written permission is prohibited.

### Third-Party Acknowledgments
This project uses the following open-source technologies: Node.js, Express, React, Ant Design, Tailwind CSS, Socket.IO, MySQL, Google Gemini API, Firebase, and OpenStreetMap.

---

*This README was last updated on June 26, 2026.*
