# TravelCheckinApp - Mobile App Technical Specification

> **Purpose:** Master technical specification for building the Mobile App (Tourist/User role) using Expo Router (SDK 56).
> Generated from actual codebase analysis — not placeholders.

---

## Table of Contents

1. [Core Architecture & Technologies](#1-core-architecture--technologies)
2. [State Management & Authentication Flow](#2-state-management--authentication-flow)
3. [Full User API Endpoints Specification](#3-full-user-api-endpoints-specification)
4. [Advanced OpenStreetMap (OSM) & Routing Logic](#4-advanced-openstreetmap-osm--routing-logic)
5. [Business Logic & Detailed Workflows](#5-business-logic--detailed-workflows)
6. [Database Schema Reference](#6-database-schema-reference)

---

## 1. Core Architecture & Technologies

### 1.1 Backend Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| Runtime | Node.js | LTS |
| Framework | Express | ^5.2.1 |
| Language | TypeScript | ^5.9.3 |
| Database | MySQL via mysql2/promise | ^3.16.0 |
| Auth | JWT (jsonwebtoken) | ^9.0.3 |
| Password | bcryptjs | ^3.0.3 |
| Validation | Zod | ^4.3.5 |
| Realtime | Socket.IO | ^4.8.3 |
| AI | @google/generative-ai | ^0.24.1 |
| Push | Firebase Admin | ^13.6.0 |
| Upload | Multer | ^2.0.2 |
| Security | Helmet | ^8.1.0 |
| Email | Nodemailer | ^7.0.12 |

**Architecture:** Layered Controller → Service → Model pattern. Raw SQL via `mysql2/promise` with prepared statements (`?` placeholders).

**Server entry point:** `backend/src/server.ts` — runs on `PORT` (default 3000).

### 1.2 Web Frontend Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| Framework | React | ^19.2.0 |
| Bundler | Vite | ^7.2.4 |
| Language | TypeScript | ~5.9.3 |
| Routing | React Router DOM | ^7.12.0 |
| State | sessionStorage + React hooks | — |
| UI | Ant Design + TailwindCSS | ^6.1.4 / ^3.4.17 |
| Maps | Leaflet + React-Leaflet | ^1.9.4 / ^5.0.0 |
| HTTP | Axios | ^1.13.2 |
| Realtime | Socket.IO Client | ^4.8.3 |
| Forms | React Hook Form + Zod | ^7.70.0 / ^4.3.5 |

### 1.3 Mobile Stack (Current)

| Component | Technology | Version |
|-----------|-----------|---------|
| Framework | Expo SDK | ~56.0.8 |
| Routing | Expo Router | ~56.2.8 |
| React | React | 19.2.3 |
| React Native | react-native | 0.85.3 |
| Maps | react-native-maps | 1.27.2 |
| Animation | react-native-reanimated | 4.3.1 |
| Location | expo-location | ~56.0.15 |
| TypeScript | TypeScript | ~6.0.3 |

### 1.4 Decoupling Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Mobile App  │     │  Website    │     │  Admin Panel │
│  (Expo)      │     │  (React)    │     │  (React)     │
└──────┬───────┘     └──────┬──────┘     └──────┬───────┘
       │                    │                    │
       └────────────────────┼────────────────────┘
                            │
                    ┌───────▼───────┐
                    │  Backend API  │
                    │  (Express)    │
                    │  Port 3000    │
                    └───────┬───────┘
                            │
                    ┌───────▼───────┐
                    │  MySQL DB     │
                    │  (TravelCheckinApp) │
                    └───────────────┘
```

- All clients communicate via REST API (`/api/*`)
- SSE endpoint at `/api/events?token=...` for realtime push (token in query param because SSE cannot send Authorization headers)
- Socket.IO for session revocation notifications
- Backend serves static uploads from `backend/uploads/` (avatars, backgrounds, locations, services, reviews, checkins)

### 1.5 Environment Variables

**Backend** (`backend/.env`):
```
PORT=3000
NODE_ENV=development
DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
JWT_SECRET, JWT_REFRESH_SECRET
GEMINI_API_KEY
FIREBASE_SERVICE_ACCOUNT_PATH
CORS_ORIGIN, CORS_CREDENTIALS
EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASSWORD, EMAIL_FROM
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
FACEBOOK_APP_ID, FACEBOOK_APP_SECRET
API_URL, FRONTEND_URL
```

**Website** (`website/.env`):
```
VITE_API_URL=http://localhost:3000/api
VITE_GOOGLE_CLIENT_ID
VITE_FACEBOOK_APP_ID
VITE_GOOGLE_MAPS_API_KEY
VITE_MAPBOX_TOKEN
```

---

## 2. State Management & Authentication Flow

### 2.1 State Management Strategy

**There are NO Zustand stores in the web codebase.** All state is managed via:

- **sessionStorage** for persistence: `accessToken`, `refreshToken`, `user` (JSON stringified)
- **React useState/useCallback hooks** for component state
- **Custom hooks** (`useBookings`, `useLocations`, `useLocationDetail`) wrapping useState + API calls

**sessionStorage keys used:**
| Key | Purpose |
|-----|---------|
| `accessToken` | JWT Bearer token |
| `refreshToken` | JWT refresh token |
| `user` | JSON-stringified User object |
| `userMapNearbyRadius` | Map nearby search radius |
| `userMapCustomRadiusInput` | Custom radius input |
| `userMapRoute` | Active route state |
| `userMapSelected` | Selected location on map |
| `last_hotel_batch_booking_v1` | Hotel booking cache |
| `hotel_booking_notices_v1` | Hotel booking notices |
| `last_table_booking_success_v1` | Table booking success cache |
| `ticket_issued_blocks_v1` | Ticket issued blocks |
| `tc_booking_fade_message` | Booking fade message |

### 2.2 Axios Client Configuration

**File:** `website/src/api/axiosClient.ts`

**Base URL:**
```ts
const baseURL = (import.meta.env.VITE_API_URL as string | undefined) || "http://localhost:3000/api";
```

**Request Interceptor — Bearer Token Injection:**
```ts
// Reads from sessionStorage
const token = sessionStorage.getItem("accessToken");
config.headers.Authorization = `Bearer ${token}`;
```

**Response Interceptor — Error Handling:**
- **SESSION_REVOKED:** If `error.response?.data?.code === "SESSION_REVOKED"`, dispatches `CustomEvent("tc-session-revoked")`. Does NOT auto-logout — triggers a modal.
- **Force Logout (`shouldForceLogout`):** Triggers when:
  - `status === 401`
  - OR `status === 403` AND (`code === "ACCOUNT_LOCKED"` OR `code === "OWNER_NOT_APPROVED"`)
- On force logout: removes `accessToken`, `refreshToken`, `user` from sessionStorage → redirects to `/login`

**Important:** There is NO automatic token refresh interceptor. The `authApi.refreshToken` endpoint exists but is not wired into the axios interceptor.

### 2.3 User Interface

**File:** `website/src/types/authApi.ts` (inferred from authApi.ts)

```ts
interface User {
  user_id: number;
  email: string;
  phone: string | null;
  full_name: string;
  role: "user" | "owner" | "employee" | "admin";
  avatar_url: string | null;
  is_verified: number;
}

interface AuthResponse {
  success: boolean;
  message: string;
  warning?: string;
  data: {
    user: User;
    accessToken: string;
    refreshToken: string;
    redirectUrl: string;
  };
}
```

### 2.4 Login Flow

**File:** `website/src/pages/Auth/Login.tsx`

1. User submits `{email, password}` → `authApi.login()`
2. On success, stores in sessionStorage: `accessToken`, `refreshToken`, `user`
3. Navigates to `response.data.redirectUrl` (server decides based on role)
4. For "user" role, redirectUrl = `/user/dashboard`
5. Shows `response.warning` if present

### 2.5 Registration Flow

**File:** `website/src/pages/Auth/Register.tsx`

1. **Step 1:** Submit `{full_name, email, password, phone}` → `POST /api/auth/register`
2. Backend creates user with `role='user'`, `status='pending'`, `is_verified=0`
3. Sends OTP to email (6-digit, expires in 5 minutes)
4. **Step 2:** Submit `{email, otp}` → `POST /api/auth/verify-otp`
5. On success: `is_verified=1`, `status='active'` (users do NOT need admin approval)
6. Navigate to `/login`

### 2.6 Google OAuth Flow

**File:** `website/src/pages/Auth/GoogleCallback.tsx`

1. Popup opens: `https://accounts.google.com/o/oauth2/v2/auth` with `response_type=token`
2. `redirectUri = "http://localhost:5173/auth/google/callback"`
3. Callback extracts `access_token` from URL hash fragment
4. Fetches user info from `https://www.googleapis.com/oauth2/v2/userinfo`
5. Posts `{type: "GOOGLE_AUTH_SUCCESS", profile: {sub, email, name, picture}}` to parent via `window.opener.postMessage`
6. Parent calls `authApi.socialLogin({provider: "google", socialId: sub, email, fullName: name, avatarUrl: picture})`
7. Backend `POST /api/auth/social-login` — three lookup paths:
   - Find by `google_id` → update user
   - Find by `email` → link Google ID to existing account
   - Not found → create new user with `role='user'`, `status='active'`, `is_verified=1`, `password_hash=NULL`
8. Stores tokens identically to normal login

### 2.7 Facebook OAuth Flow

**File:** `website/src/pages/Auth/FacebookCallback.tsx`

1. Popup opens: `https://www.facebook.com/v18.0/dialog/oauth` with `response_type=token`
2. `redirectUri = "http://localhost:5173/auth/facebook/callback"`
3. Fetches from `https://graph.facebook.com/me?fields=id,name,email,picture`
4. Posts `{type: "FACEBOOK_AUTH_SUCCESS", profile}` to parent
5. If email is missing, uses `facebook_${id}@temp.local`
6. Same backend flow as Google

### 2.8 Mobile OAuth Flow (Server-Side)

**File:** `backend/src/controllers/authController.ts`

For mobile, the backend supports server-side OAuth:

1. `GET /api/auth/google/mobile` — redirects to Google OAuth consent screen
2. `GET /api/auth/google/callback` — exchanges code for token, gets userinfo, calls `processSocialLogin`, redirects to deep link `travelcheckin://auth/callback` with tokens
3. Same pattern for Facebook via `GET /api/auth/facebook/mobile` and `/api/auth/facebook/callback`
4. `sendMobileRedirect` — renders HTML page with button that deep-links back to mobile app (needed because Chrome Android cannot handle `exp://` scheme redirects)

### 2.9 Token Structure

**JWT Payload:**
```ts
interface JwtPayload {
  userId: number;
  role: string;
  sessionId?: string;
}
```

- Access token: expires in 7 days
- Refresh token: expires in 30 days (different secret)
- Secrets: `process.env.JWT_SECRET` and `process.env.JWT_REFRESH_SECRET`

### 2.10 Session Management (Single-Session Enforcement)

**Table:** `user_active_sessions`
```
user_id    INT PRIMARY KEY
session_id VARCHAR(64) NOT NULL
created_at DATETIME
updated_at DATETIME
```

- Only ONE active session per user
- New login replaces old session via `setActiveSessionId(userId, sessionId)` — INSERT ... ON DUPLICATE KEY UPDATE
- When replacing: `emitSessionRevoked(userId, newSessionId)` via Socket.IO to notify old client
- `authenticateToken` middleware compares JWT `sessionId` with DB `sessionId` — mismatch returns 401 with `code: "SESSION_REVOKED"`

### 2.11 Role Verification

**Middleware chain:**
1. `authenticateToken` — verifies JWT, checks user exists in DB, checks status not locked, checks session active
2. `requireRole("user")` — checks `req.userRole` against allowed list
3. For owners: additionally checks `owner_profiles.approval_status = 'approved'`

### 2.12 Brute-Force Protection

**Table:** `login_attempts`
```
email         VARCHAR(255) PRIMARY KEY
attempts      INT NOT NULL DEFAULT 0
locked_until  DATETIME NULL
```

- On each failed login: increments counter
- After 5 failures: locks account for 5 minutes (`DATE_ADD(NOW(), INTERVAL 5 MINUTE)`)
- On successful login: DELETEs the attempt counter

---

## 3. Full User API Endpoints Specification

### 3.1 Auth Endpoints (Public)

| Method | Path | Request Body | Response |
|--------|------|-------------|----------|
| `POST` | `/api/auth/register` | `{full_name, email, password, phone}` | `{success, message}` |
| `POST` | `/api/auth/verify-otp` | `{email, otp}` | `{success, message}` |
| `POST` | `/api/auth/login` | `{email, password}` | `{success, data: {user, accessToken, refreshToken, redirectUrl}}` |
| `POST` | `/api/auth/social-login` | `{provider, socialId, email, fullName, avatarUrl?}` | Same as login |
| `POST` | `/api/auth/forgot-password` | `{email}` | `{success, message}` |
| `POST` | `/api/auth/verify-reset-otp` | `{email, otp}` | `{success, message}` |
| `POST` | `/api/auth/reset-password` | `{email, otp, newPassword}` | `{success, message}` |
| `POST` | `/api/auth/refresh-token` | `{refreshToken}` | `{success, data: {accessToken}}` |
| `GET` | `/api/auth/background` | — | `{success, data: {image_url}}` |
| `GET` | `/api/auth/app-background` | — | `{success, data: {image_url}}` |
| `GET` | `/api/auth/google/mobile` | — | Redirect to Google OAuth |
| `GET` | `/api/auth/google/callback` | `?code=` | Redirect to deep link |
| `GET` | `/api/auth/facebook/mobile` | — | Redirect to Facebook OAuth |
| `GET` | `/api/auth/facebook/callback` | `?code=` | Redirect to deep link |

### 3.2 Auth Endpoints (Protected — requires Bearer token)

| Method | Path | Request Body | Response |
|--------|------|-------------|----------|
| `POST` | `/api/auth/logout` | — | `{success}` |
| `GET` | `/api/auth/session` | — | `{success}` (200 if valid) |

### 3.3 User Endpoints (Protected — requires role "user")

**File:** `backend/src/routes/userRoutes.ts`

All routes prefixed with `/api/user`, require `authenticateToken` + `requireRole("user")`.

#### Profile

| Method | Path | Request | Response |
|--------|------|---------|----------|
| `GET` | `/api/user/profile` | — | `UserProfile` (includes stats: total_orders, total_spending, favorite_location, member_tier) |
| `PUT` | `/api/user/profile` | `{full_name, phone?, avatar_url?, skip_avatar?, background_url?, skip_background?, address?, username?}` | `{success}` |
| `POST` | `/api/user/profile/avatar` | FormData: `avatar` file (max 50MB) | `{success, data: {avatar_url}}` |
| `POST` | `/api/user/profile/background` | FormData: `background` file (max 50MB) | `{success, data: {background_url}}` |
| `GET` | `/api/user/profile/login-history` | `?page=&limit=&success=&from=&to=&q=` | `{data: [], pagination}` |

**Member Tiers:**
- 0-4 check-ins: "Newbie"
- 5-15: "Silver Traveler"
- 16-30: "Gold Explorer"
- 31+: "Diamond Pathfinder"

#### Check-ins

| Method | Path | Request | Response |
|--------|------|---------|----------|
| `GET` | `/api/user/checkins` | — | `CheckinItem[]` |
| `POST` | `/api/user/checkins` | `{location_id?, latitude, longitude, notes?, action: "checkin"|"save"}` | `{checkin_id, safety_warning?, safety_message?}` |
| `POST` | `/api/user/checkins/photo` | FormData: `photo` file + checkin data | `{checkin_id}` |
| `DELETE` | `/api/user/checkins/:id` | — | `{success}` |

#### Favorites

| Method | Path | Request | Response |
|--------|------|---------|----------|
| `GET` | `/api/user/favorites` | — | `Location[]` |
| `PATCH` | `/api/user/favorites/:locationId` | `{note?, tags?}` | `{success}` |
| `DELETE` | `/api/user/favorites/:locationId` | — | `{success}` |

#### Recommendations & Created Locations

| Method | Path | Request | Response |
|--------|------|---------|----------|
| `GET` | `/api/user/recommendations/locations` | — | `Location[]` |
| `GET` | `/api/user/created-locations` | — | `Location[]` |
| `PATCH` | `/api/user/created-locations/:id` | `UpdatePayload` | `{success}` |
| `DELETE` | `/api/user/created-locations/:id` | — | `{success}` |

#### Vouchers

| Method | Path | Request | Response |
|--------|------|---------|----------|
| `GET` | `/api/user/vouchers/location/:locationId` | — | `VoucherItem[]` |
| `GET` | `/api/user/vouchers/saved` | — | `VoucherItem[]` |
| `POST` | `/api/user/vouchers/:id/claim` | — | `{success}` |

#### Tickets

| Method | Path | Request | Response |
|--------|------|---------|----------|
| `GET` | `/api/user/tickets` | `?location_id=` | `UserTouristTicketItem[]` |

#### Diary

| Method | Path | Request | Response |
|--------|------|---------|----------|
| `GET` | `/api/user/diary` | — | `DiaryItem[]` |
| `POST` | `/api/user/diary` | `{location_id?, location_name?, mood?, notes?, images?}` | `{success}` |
| `DELETE` | `/api/user/diary/:id` | — | `{success}` |

#### Reviews

| Method | Path | Request | Response |
|--------|------|---------|----------|
| `POST` | `/api/user/reviews/upload` | FormData: `image` file | `{url}` |
| `POST` | `/api/user/reviews` | `{location_id, rating, comment?, images?}` | `{success}` |
| `DELETE` | `/api/user/reviews/:id` | — | `{success}` |
| `POST` | `/api/user/reviews/:id/reply` | `{content, images?}` | `{success}` |

#### Reports

| Method | Path | Request | Response |
|--------|------|---------|----------|
| `POST` | `/api/user/reports/location` | `{location_id, description, report_type?, severity?}` | `{success}` |

#### Leaderboard & Reminders

| Method | Path | Request | Response |
|--------|------|---------|----------|
| `GET` | `/api/user/leaderboard` | `?province=&month=` | `LeaderboardRow[]` |
| `GET` | `/api/user/booking-reminders` | — | `BookingReminderItem[]` |

#### Notifications

| Method | Path | Request | Response |
|--------|------|---------|----------|
| `GET` | `/api/user/notifications` | — | `UserNotificationItem[]` |
| `POST` | `/api/user/notifications/read-all` | — | `{success}` |
| `POST` | `/api/user/notifications/delete-all` | — | `{success}` |
| `POST` | `/api/user/notifications/location-invite` | `{location_id}` | `{success}` |

### 3.4 Booking Endpoints (Protected — requires role "user")

**File:** `backend/src/routes/bookingRoutes.ts`

All routes prefixed with `/api/bookings`.

| Method | Path | Request | Response |
|--------|------|---------|----------|
| `POST` | `/api/bookings` | `CreateBookingPayload` | `CreateBookingResult` |
| `POST` | `/api/bookings/batch` | `CreateBookingBatchPayload` | `CreateBookingBatchResult` |
| `POST` | `/api/bookings/:id/payments` | — | `BookingPaymentResult` |
| `POST` | `/api/bookings/batch/payments` | `{booking_ids: number[]}` | `BookingPaymentResult` |
| `PUT` | `/api/bookings/batch/contact` | `{booking_ids, contact_name, contact_phone}` | `{success}` |
| `POST` | `/api/bookings/:id/tickets/confirm-transfer` | — | `ConfirmTicketTransferResult` |
| `POST` | `/api/bookings/:id/tables/confirm-transfer` | — | `{success}` |
| `POST` | `/api/bookings/:id/rooms/confirm-transfer` | — | `{success}` |
| `POST` | `/api/bookings/batch/rooms/confirm-transfer` | `{payment_id}` | `{success}` |
| `GET` | `/api/bookings/table-reservations/mine` | `?location_id=` | `TableReservationItem[]` |
| `GET` | `/api/bookings/table-reservations/pass` | `?location_id=` | `TableReservationItem[]` |
| `GET` | `/api/bookings/room-reservations/pass` | `?location_id=` | `RoomReservationItem[]` |
| `POST` | `/api/bookings/:id/tables/cancel` | — | `{success}` |
| `POST` | `/api/bookings/:id/cancel` | — | `{success}` |
| `POST` | `/api/bookings/:id/tables/preorder` | `{preorder_items: [{service_id, quantity}]}` | `{success}` |

**CreateBookingPayload:**
```ts
{
  location_id: number;
  service_id?: number;
  check_in_date: string;        // ISO datetime
  check_out_date?: string | null;
  quantity?: number;
  source?: "web" | "mobile";
  contact_name?: string | null;
  contact_phone?: string | null;
  notes?: string | null;
  voucher_code?: string | null;
  reserve_on_confirm?: boolean;
  table_ids?: number[];
  preorder_items?: { service_id: number; quantity: number }[];
  ticket_items?: { service_id: number; quantity: number }[];
}
```

### 3.5 Location Endpoints (Public — optional auth)

**File:** `backend/src/routes/locationRoutes.ts`

All routes prefixed with `/api/locations`, use `authenticateTokenOptional`.

| Method | Path | Request | Response |
|--------|------|---------|----------|
| `GET` | `/api/locations` | `?type=&keyword=&province=&source=` | `Location[]` |
| `GET` | `/api/locations/search` | Same params | `Location[]` |
| `GET` | `/api/locations/:id` | `?source=` | `Location` |
| `GET` | `/api/locations/:id/services` | `?type=` | `Service[]` |
| `GET` | `/api/locations/:id/pos/areas` | — | `PosArea[]` |
| `GET` | `/api/locations/:id/pos/tables` | `?area_id=&check_in_date=` | `PosTable[]` |
| `GET` | `/api/locations/:id/tickets/realtime-stock` | — | `{service_id, service_type, remaining_today}[]` |
| `GET` | `/api/locations/:id/reviews` | — | `LocationReview[]` |

**Public consumer filter:** `source=web|mobile` adds `status='active'` and excludes user-created locations.

### 3.6 Chat Endpoints (Protected — any role)

**File:** `backend/src/routes/locationChatRoutes.ts`

| Method | Path | Request | Response |
|--------|------|---------|----------|
| `GET` | `/api/chat/location/:locationId` | — | `LocationChatMessageItem[]` |
| `POST` | `/api/chat/location/:locationId` | `{content}` | `{success}` |

### 3.7 Push Notification Endpoints (Protected)

**File:** `backend/src/routes/pushRoutes.ts`

| Method | Path | Request | Response |
|--------|------|---------|----------|
| `POST` | `/api/push/device-tokens` | `{token, deviceId, platform}` | `{success}` |
| `DELETE` | `/api/push/device-tokens/:deviceId` | — | `{success}` |

Uses topic-based FCM. Subscribes to `user_{userId}` and `all_users` topics.

### 3.8 AI Endpoints (Protected — any role)

**File:** `backend/src/routes/aiRoutes.ts`

| Method | Path | Request | Response |
|--------|------|---------|----------|
| `POST` | `/api/ai/chat` | `{prompt}` | `{response}` |
| `GET` | `/api/ai/history` | — | `AiChatHistoryItem[]` |

Currently returns a maintenance message. Stores chat in `ai_chat_history` table.

### 3.9 SOS Endpoints (Protected — requires role "user")

**File:** `backend/src/routes/sosRoutes.ts`

| Method | Path | Request | Response |
|--------|------|---------|----------|
| `POST` | `/api/sos` | `{latitude, longitude, location_text?, message?, alert_id?}` | `{success, alert_id}` |
| `POST` | `/api/sos/ping` | Same | `{success}` |
| `POST` | `/api/sos/stop` | `{alert_id?}` | `{success}` |

Uses MySQL spatial data: `ST_GeomFromText('POINT(lng lat)')`.

### 3.10 Geo Endpoints (Public)

**File:** `backend/src/routes/geoRoutes.ts`

| Method | Path | Request | Response |
|--------|------|---------|----------|
| `GET` | `/api/geo/search` | `?q=&limit=` | `GeoSearchResult[]` |
| `GET` | `/api/geo/reverse` | `?lat=&lng=` | `GeoReverseResult` |

Proxies to Nominatim OpenStreetMap. Rate limiter: 60 burst tokens, refills at 1/sec. Caches: 1 hour for search, 24 hours for reverse. Filters results to Vietnam bounding box.

### 3.11 SSE Events Endpoint

**File:** `backend/src/server.ts`

| Method | Path | Request | Response |
|--------|------|---------|----------|
| `GET` | `/api/events` | `?token=<JWT>` | SSE stream |

Verifies JWT from query parameter. Streams events: `booking_expired`, `pos_updated`, `tourist_updated`, `hotel_updated`, `booking_checked_in`, `booking_cancelled`, `session_revoked`. Heartbeat every 25 seconds.

---

## 4. Advanced OpenStreetMap (OSM) & Routing Logic

### 4.1 Tile Layer Switching (4 Modes)

**File:** `website/src/pages/User/UserMap.tsx` (lines 1267-1303)

```ts
type BaseLayerKey = "osm" | "positron" | "voyager" | "satellite";

const tileOptions = [
  {
    key: "osm",
    label: "Bản đồ tiêu chuẩn",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    maxZoom: 17,
  },
  {
    key: "positron",
    label: "Bản đồ sáng",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    maxZoom: 17,
  },
  {
    key: "voyager",
    label: "Bản đồ đường phố",
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    maxZoom: 17,
  },
  {
    key: "satellite",
    label: "Vệ tinh",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    maxZoom: 17,
  },
];
```

`activeTile` is computed from `mapStyle` state. `MAX_ZOOM` is locked to 17 across all layers.

### 4.2 Point-Clicking Event Handlers

**File:** `website/src/pages/User/UserMap.tsx`

- **Double-click** on map (`MapClickHandler` component, line 337): Creates a picked point marker with popup showing coordinates, nearby location suggestion, and action buttons (check-in, route, save).
- **Single click** on location marker: Calls `handleSelectLocation(item, coords)` → sets selected location, opens sidebar panel, flies to location.
- **Route request** (`ensureRouteToTarget`, line 1737): Sets `routeEnabled=true`, `routeTarget=target`, triggers routing effect.
- **Bearing arrow** (`BearingArrow`, line 535): Shows blue circle (50m radius) + arrow pointing toward destination, rotation adjusted by device heading on mobile.

### 4.3 Routing Service Integration

**File:** `website/src/pages/User/UserMap.tsx` (lines 1497-1619)

**OSRM URLs (dual fallback):**
```ts
const urls = [
  `https://router.project-osrm.org/route/v1/${routeProfile}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&alternatives=true`,
  `https://routing.openstreetmap.de/routed-car/route/v1/${routeProfile}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&alternatives=true`
];
```

Both use `routeProfile = "driving"` regardless of motorbike/car selection (OSRM limitation).

Retry logic: each URL tried up to 3 times with exponential backoff (`attempt * 300ms`).

### 4.4 River-Blocking Algorithm (Chặn chỉ đường xuống sông Cần Thơ)

**File:** `website/src/pages/User/UserMap.tsx` (lines 1497-1619)

**There is NO explicit river-blocking algorithm with coordinate arrays or bounding boxes.** The system uses a fallback approach:

1. OSRM returns `NoRoute` when no road bridge/path exists (e.g., across rivers in Cần Thơ)
2. When `NoRoute` is detected, falls back to straight-line haversine connection:
   ```ts
   setRouteLines([[from, to]]);
   setRouteInfo({
     distanceM: fallbackDistance,
     source: "haversine",
     hasNoRoute: true,
   });
   ```
3. UI displays: "Không tìm thấy đường bộ đến điểm này (ngoài khơi, sông hồ hoặc vùng biệt lập)"

The river blocking is implicit — OSRM simply cannot route across water where no bridges exist, and the fallback haversine line visually indicates the issue to the user.

### 4.5 Custom Circular Avatar Markers

**File:** `website/src/pages/User/UserMap.tsx` (lines 383-445)

`getCircleImageIcon(imageUrl, isSelected, size)` creates circular avatar markers:

```ts
// With image: circular div
{
  borderRadius: "50%",
  objectFit: "cover",
  border: "3px solid white",
  boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
}

// Without image: gradient fallback
{
  background: "linear-gradient(135deg, #99f6e4, #a7f3d0)",
  // SVG pin icon inside
}

// Selected state: teal ring
{
  boxShadow: "0 0 0 3px #14b8a6",
}
```

Cache limit: 200 icons (then clears cache to prevent memory leak).

### 4.6 Pin Icon Colors by Kind

**File:** `website/src/utils/leafletPinIcons.ts`

```ts
const PIN_COLORS = {
  owner: "#3b82f6",              // Blue
  ownerSelected: "#2563eb",      // Dark blue
  userCreated: "#f59e0b",        // Amber
  userCreatedSelected: "#d97706", // Dark amber
  search: "#22c55e",             // Green
  picked: "#fbbf24",             // Yellow
  myPosition: "#ef4444",         // Red
};
```

### 4.7 Search Ranking Algorithm

**File:** `website/src/pages/User/UserMap.tsx` (lines 689-756)

`scoreSearchResult()` scores results by:
- `ownerBoost`: +1000 for owner/system results
- `systemBoost`: +40 for system locations
- `textScore`: up to +120 based on position of query match in display name
- `distanceBoost`: +400 (≤5km), +250 (≤20km), +120 (≤50km), +50 (≤100km)
- `queryProvinceBoost`: +800 if province matches query hint
- `userProvinceBoost`: +500 if province matches user's current province
- `outsideProvincePenalty`: -80 if different province
- `nonHintPenalty`: -120 if province doesn't match query hint

### 4.8 Map Helper Components

| Component | Purpose |
|-----------|---------|
| `MapViewTracker` | Tracks map center/zoom via `useMapEvents` |
| `MapRecenter` | Programmatic re-centering with `map.setView()` |
| `MapMaxZoomSync` | Enforces `MAX_ZOOM = 17` |
| `MapInteractionWatcher` | Detects user drag to block auto-fitBounds |
| `MapResizeObserver` | Invalidates map size on container resize |
| `MapRefBinder` | Stores map instance in ref |
| `CompassMarker` | SVG arrow rotated by `DeviceOrientationEvent.alpha` |
| `RouteArrowDecorator` | `L.polylineDecorator` with arrowhead at offset 16px from start |
| `BearingArrow` | Blue circle (50m) + arrow pointing at destination |

---

## 5. Business Logic & Detailed Workflows

### 5.1 Restaurant & Hotel Booking

#### Time-Slot Check-In Validation

**File:** `backend/src/services/bookingService.ts`

- **Advance booking limit:** today + 3 days (end of day 3). `getMaxAdvanceLimitEnd` computes this.
- **For non-tickets:** check-in time must be in the future.
- **For tickets:** check-in date must be today or later (date-only, no time).
- **For tables:** check-in time must be within opening hours.
- **Room check-out default:** If no `check_out_date` provided, defaults to `check_in + 24 hours`.

#### Opening Hours Enforcement

**File:** `backend/src/utils/openingHours.ts`

```ts
isWithinOpeningHours(opening_hours, now)
```

- Supports multiple formats: Array of `{day, open, close}` objects, or `{open, close}` object
- Day names: `mon/tue/wed/thu/fri/sat/sun`, or Vietnamese `t2/t3/etc`, or numbers 0-7
- Supports overnight schedules (close < open means spans midnight)
- If `open === close`, treated as 24h
- Returns `true` if no schedule set (no blocking)

#### +/- 1-Hour Holding/Auto-Cancellation Logic

**File:** `backend/src/server.ts` + `backend/src/services/bookingService.ts`

**Table reservations:**
- `TABLE_RESERVATION_SLOT_MINUTES = 120` — each table held for 2 hours from check-in time
- `TABLE_RESERVATION_OWNER_WINDOW_MINUTES = 60` — owner can start accepting 1 hour before reservation
- `computeTableReservationEnd(checkIn)` = checkIn + 120 minutes
- `computeOwnerReservationWindowStart(checkIn)` = checkIn - 60 minutes

**Auto-cancellation (runs every 60 seconds):**
- **Food bookings:** If `check_in_date` has passed by `auto_cancel_food_minutes` (default 60 min) → auto-cancel
- **Hotel bookings:** If `check_in_date` has passed by `auto_cancel_hotel_minutes` (default 60 min) AND no active `hotel_stays` (not checked in) → auto-cancel
- **Ticket bookings:** If `check_in_date` has passed by `auto_cancel_ticket_minutes` (default 1440 = 1 day) → auto-cancel. Also cancels tickets whose `check_out_date` (closing time) has passed.

**Auto-confirm (runs every 60 seconds):**
- If booking has been pending with completed payment for longer than `auto_confirm_minutes` (default 30) → auto-set to 'confirmed'

**Cancellation rules (user-initiated):**
- **Table:** Cannot cancel if already paid (must contact admin). Cannot cancel if within 60 minutes of reservation start time.
- **Room:** Cannot cancel if within 24 hours of check-in AND status is pending/confirmed.
- **Generic:** Releases table reservations, cancels hotel_stays, frees hotel_rooms, frees pos_tables, cancels pos_orders, voids booking_tickets.

#### Pre-Ordering Calculations

**File:** `website/src/pages/User/BookingPage.tsx`

- `preorderEnabled` toggle (requires bank transfer payment)
- `preorderQtyByServiceId: Record<number, number>` tracks quantities
- Menu services filtered by type: `food`, `combo`, `other`
- Preorder grouped by `category_name` with category sidebar
- `preorderTotal = sum of (price * quantity)` per service
- Only 1 table allowed when pre-ordering
- Two-step flow: (1) create booking + payment, (2) confirm transfer

**Backend preorder attachment** (`attachPreorderToMyTableBooking`):
- Requires exactly 1 active table reservation
- Menu items must be food/combo/other type, approved, and available
- Creates or updates POS order linked to the booking
- Updates booking `total_amount` and `final_amount`

### 5.2 Tourist Tickets

#### 1-Day Expiration Rule

**File:** `backend/src/services/bookingService.ts` — `computeTicketValidUntil`

- Uses opening hours to determine expiry
- If location has a closing time → ticket expires at closing time
- If overnight schedule (close < open) → expiry is next day at closing
- If no opening hours or 24h schedule → expires at 23:59:59

#### Closing-Time Invalidation

**Auto-expiration (runs every 60 seconds):**
- Tickets whose `check_in_date` has passed by `auto_cancel_ticket_minutes` (default 1440 min = 1 day) → auto-cancel
- Tickets whose `check_out_date` (closing time) has passed → auto-cancel

#### Ticket Stock Calculation

**File:** `backend/src/services/bookingService.ts` — `getServiceRemainingQuantity`

```ts
remaining = maxCapacity - (onlineSold + posSold)
```

- `onlineSold` = COUNT from `booking_tickets` WHERE `status != 'void'` AND `DATE(check_in_date) = targetDate`
- `posSold` = COUNT from `pos_tickets` WHERE `DATE(sold_at) = targetDate`
- No static stock decrement — stock is calculated dynamically
- Max 50 tickets per transaction (`totalTicketQty > 50` throws error)

#### Ticket Code Format

```
SB-{bookingId}-{index}-{random6chars}
```

#### Ticket Confirmation Flow

1. User creates booking with `ticket_items: [{service_id, quantity}]`
2. Backend validates stock, creates booking + payment with VietQR data
3. User scans QR and pays
4. User calls `POST /api/bookings/:id/tickets/confirm-transfer`
5. Backend re-checks dynamic stock, issues tickets, marks payment completed
6. Booking status set to 'pending' (for owner to later confirm)

### 5.3 Flexible Commission System

**File:** `backend/src/services/bookingPaymentService.ts`

Each location can have its own commission rate stored in `locations.commission_rate`.

**Commission calculation (for ticket payments):**
```ts
commissionAmount = amount * commissionRate / 100
vatAmount = commissionAmount * vatRate / 100
ownerReceivable = amount - commissionAmount - vatAmount
```

- Default commission rate: 2.5% (from `system_settings.default_commission_rate`)
- Default VAT rate: 10% (from `system_settings.vat_rate`)
- Per-location override: `locations.commission_rate`

**Payment record structure:**
```ts
{
  payment_id, user_id, location_id, booking_id,
  amount,
  transaction_source: "online_booking" | "pos" | "admin",
  commission_rate, commission_amount,
  vat_rate, vat_amount,
  owner_receivable,
  payment_method: "VietQR",
  transaction_code, qr_data,
  status: "pending" | "completed" | "failed" | "refunded",
  performed_by_user_id, performed_by_role, performed_by_name,
  payment_time
}
```

### 5.4 Omni-Channel Workflow

**Unified booking table:** Both Online and Counter (Offline) bookings use the same `bookings` table.

**Source field:**
- `source: "web"` — from website
- `source: "mobile"` — from mobile app
- `source: "admin"` — from admin panel
- Counter bookings created by employees via POS system

**POS integration:**
- `pos_orders` table tracks in-person orders
- `pos_order_items` tracks line items
- `pos_tickets` tracks counter-sold tickets
- `pos_tables` tracks table status (free/reserved/occupied)

**Stock unification:**
```ts
remaining = maxCapacity - (onlineSold + posSold)
```
Both online (`booking_tickets`) and counter (`pos_tickets`) sales are counted together.

**Hotel stays unification:**
- `hotel_stays` table tracks both online bookings and walk-in guests
- Status flow: `reserved` → `inhouse` → `checked_out` | `cancelled`
- `hotel_rooms` status: `vacant` → `reserved` → `occupied`

### 5.5 Invoice Flow — VietQR Generator

**File:** `website/src/utils/vietqr.ts`

**URL Pattern:**
```
https://img.vietqr.io/image/{BIN}-{bankAccount}-{template}.png?addInfo={addInfo}&amount={amount}&accountName={accountHolder}
```

**Function:**
```ts
buildVietQrImageUrl({
  bankName?: string | null,
  bankAccount?: string | null,
  accountHolder?: string | null,
  amount?: number | null,
  addInfo?: string | null,
  template?: "qr_only" | "compact2"
}): { url: string | null; error: string | null }
```

**Bank BIN mapping (`BANK_BIN_MAP`):**
```ts
{
  vcb: "970436",        // Vietcombank
  ctg: "970415",        // Vietinbank
  bidv: "970418",
  vba: "970405",        // Agribank
  acb: "970416",
  tcb: "970407",        // Techcombank
  mb: "970422",
  vpbank: "970432",
  tpbank: "970423",
  sacombank: "970403",
  vpb: "970432",
  shb: "970443",
  hdbank: "970437",
  ocb: "970448",
  msb: "970426",
  eximbank: "970431",
  seabank: "970440",
}
```

`normalizeBankKey()` strips non-alphanumeric chars and replaces common names to match the map.

**QR data from backend:**
```ts
{
  bank_name: string,
  bank_account: string,
  account_holder: string,
  amount: number,
  content: string,        // Transaction description
  transaction_code: string,
  ticket_items: [{service_id, quantity}],  // For tickets
  use_date: string
}
```

**Usage in BookingPage:**
```ts
const qrImg = buildVietQrImageUrl({
  bankName: String(qr.bank_name || ""),
  bankAccount: String(qr.bank_account || ""),
  accountHolder: String(qr.account_holder || ""),
  amount: Number(qr.amount || 0),
  addInfo: String(qr.content || ""),
  template: "compact2",
});
```

**Payment notes include disclaimer:**
> "Đã thanh toán nếu có vấn đề phát sinh hay không tới bị hủy thì tiền không được hoàn lại"

**"View-and-disappear" checkout transition:**
After user confirms bank transfer:
1. `POST /api/bookings/:id/tickets/confirm-transfer` (or tables/rooms variant)
2. Backend re-validates stock, issues tickets/reservations
3. Payment marked as completed
4. Success screen shows with issued tickets/QR codes
5. SSE events (`booking_checked_in`) trigger UI cleanup of success notices

### 5.6 Voucher Validation Logic

**File:** `backend/src/services/bookingService.ts` — `validateVoucherForBooking`

**Validation steps:**
1. Voucher must be `status = 'active'`
2. Must be within `start_date` → `end_date` range
3. Must not be fully used (`used_count < usage_limit`)
4. **System vouchers** (admin-created): can be global or location-specific
5. **Owner vouchers:** must match the location's owner
6. Checks `apply_to_location_type` (all/hotel/restaurant/tourist/cafe/resort/other)
7. Checks `apply_to_service_type` (all/room/food/ticket/other)
8. Checks `min_order_value`
9. Checks `max_uses_per_user` against user's previous bookings with this voucher code
10. **Loyal customer check:** if `target_group='loyal'`, checks `SUM(final_amount) FROM bookings WHERE user_id=? AND location_id=? AND status='completed'` >= `loyalty_min_spend`

**Discount calculation:**
```ts
if (discount_type === "percent") {
  discount = (total * discount_value) / 100;
  if (max_discount_amount) discount = Math.min(discount, max_discount_amount);
} else {
  discount = discount_value;
}
discount = Math.min(discount, total); // Cannot exceed total
```

### 5.7 Check-In Business Rules

**File:** `backend/src/controllers/userController.ts`

| Constraint | Value |
|------------|-------|
| Phone required for check-in | Yes (format: `^0\d{9}$`) |
| Vietnam geofence | lat 8-23.5, lng 102-110.5 |
| Nearby location radius | 80 meters (Haversine) |
| Max distance from location | 500 meters |
| Min interval between any check-ins | 30 seconds |
| Max check-ins per hour | 20 |
| Max check-ins per day | 100 |
| Min interval same location | 2 minutes |
| Max user-created locations/day | 20 |
| Night check-in hours | 22:00 - 05:00 (safety warning + push notification) |

**Nearest-location matching:**
1. If no `location_id` but coordinates given → search `locations` table using Haversine formula within 80 meters
2. If found → attach to that location
3. If not found → create new location with `source='owner'` (rate-limited to 20/day)

### 5.8 Review Rules

**File:** `backend/src/controllers/userController.ts`

- Rating: 1-5, must be in 0.5 steps (`Number.isInteger(rating * 2)`)
- Recalculates location rating as weighted average
- Users can reply to reviews on locations they have reviewed
- Soft-delete on removal (`status='deleted'`)

### 5.9 Booking Reminders

**File:** `backend/src/server.ts` (runs every 30 minutes)

- **6 hours before check-in:** Push notification reminder
- **3 hours before check-out:** Push notification reminder

### 5.10 Secure QR Payload

**File:** `backend/src/services/bookingQrService.ts`

Generates HMAC-SHA256 signed QR payloads:
```json
{
  "booking_id": 123,
  "location_id": 456,
  "service_type": "ticket",
  "secure_token": "hex_signature"
}
```

`verifySecureQrPayload`: Verifies signature AND checks `location_id` matches the scanning staff's location (cross-location prevention).

Secure codes:
- Tickets: `DI-{6-char-HMAC}`
- Rooms: `RS-{6-char-HMAC}`

---

## 6. Database Schema Reference

### 6.1 Core Tables

#### `users`
```sql
user_id              INT AUTO_INCREMENT PRIMARY KEY
email                VARCHAR(255) NULL
phone                VARCHAR(30) NULL
password_hash        VARCHAR(255) NULL
full_name            VARCHAR(255) NOT NULL
role                 VARCHAR(50) NOT NULL  -- 'admin','owner','employee','user'
status               VARCHAR(50) NOT NULL  -- 'pending','active','locked'
avatar_url           VARCHAR(500) NULL
avatar_path          VARCHAR(500) NULL
avatar_source        ENUM('upload','url') NULL
avatar_updated_at    DATETIME NULL
is_verified          TINYINT NOT NULL DEFAULT 0
verified_at          DATETIME NULL
google_id            VARCHAR(255) NULL
facebook_id          VARCHAR(255) NULL
refresh_token        TEXT NULL
address              VARCHAR(500) NULL
username             VARCHAR(100) NULL
background_url       VARCHAR(500) NULL
background_path      VARCHAR(500) NULL
background_source    ENUM('upload','url') NULL
background_updated_at DATETIME NULL
deleted_at           DATETIME NULL
created_at           DATETIME DEFAULT CURRENT_TIMESTAMP
updated_at           DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
```

#### `owner_profiles`
```sql
owner_id              INT PRIMARY KEY  -- FK -> users(user_id)
approval_status       VARCHAR(50) DEFAULT 'pending'  -- 'pending','approved','rejected'
bank_account          VARCHAR(50) NULL
bank_name             VARCHAR(100) NULL
account_holder        VARCHAR(200) NULL
terms_token           VARCHAR(255) NULL
terms_token_expires   DATETIME NULL
terms_accepted_at     DATETIME NULL
```

#### `locations`
```sql
location_id          INT AUTO_INCREMENT PRIMARY KEY
owner_id             INT NULL  -- FK -> users(user_id)
location_name        VARCHAR(255) NOT NULL
location_type        VARCHAR(50) NOT NULL  -- 'hotel','restaurant','tourist','cafe','resort','other'
description          TEXT NULL
address              VARCHAR(500) NULL
province             VARCHAR(100) NULL
latitude             DECIMAL(10,8) NULL
longitude            DECIMAL(11,8) NULL
first_image          VARCHAR(500) NULL
images               JSON NULL
is_eco_friendly      TINYINT DEFAULT 0
status               VARCHAR(50) DEFAULT 'active'  -- 'active','inactive'
source               VARCHAR(50) NULL  -- 'owner','admin'
is_user_created      TINYINT DEFAULT 0
rating               DECIMAL(3,1) DEFAULT 0
total_reviews        INT DEFAULT 0
total_checkins       INT DEFAULT 0
opening_hours        JSON NULL
commission_rate      DECIMAL(5,2) NULL
auto_confirm_minutes INT DEFAULT 30
auto_cancel_food_minutes INT DEFAULT 60
auto_cancel_hotel_minutes INT DEFAULT 4320
auto_cancel_ticket_minutes INT DEFAULT 1440
deleted_at           DATETIME NULL
created_at           DATETIME DEFAULT CURRENT_TIMESTAMP
updated_at           DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
```

#### `services`
```sql
service_id       INT AUTO_INCREMENT PRIMARY KEY
location_id      INT NOT NULL  -- FK -> locations(location_id)
category_id      INT NULL
service_name     VARCHAR(255) NOT NULL
service_type     VARCHAR(50) NOT NULL  -- 'room','table','ticket','food','combo','other'
description      TEXT NULL
price            DECIMAL(12,2) NOT NULL DEFAULT 0.00
quantity         INT DEFAULT 0
unit             VARCHAR(50) NULL
status           VARCHAR(50) DEFAULT 'available'  -- 'available','reserved','unavailable'
images           JSON NULL
admin_status     VARCHAR(50) DEFAULT 'pending'  -- 'pending','approved','rejected'
deleted_at       DATETIME NULL
created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
```

#### `bookings`
```sql
booking_id      INT AUTO_INCREMENT PRIMARY KEY
user_id         INT NOT NULL  -- FK -> users(user_id)
service_id      INT NOT NULL  -- FK -> services(service_id)
location_id     INT NOT NULL  -- FK -> locations(location_id)
check_in_date   DATETIME NOT NULL
check_out_date  DATETIME NULL
quantity        INT NOT NULL DEFAULT 1
total_amount    DECIMAL(12,2) NOT NULL DEFAULT 0
discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0
final_amount    DECIMAL(12,2) NOT NULL DEFAULT 0
voucher_code    VARCHAR(100) NULL
status          VARCHAR(50) NOT NULL DEFAULT 'pending'  -- 'pending','confirmed','cancelled','completed'
source          VARCHAR(20) NULL  -- 'web','mobile','admin'
contact_name    VARCHAR(100) NULL
contact_phone   VARCHAR(30) NULL
notes           TEXT NULL
pos_order_id    INT NULL  -- FK -> pos_orders(order_id)
cancelled_at    DATETIME NULL
cancelled_by    INT NULL
created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
```

#### `booking_tickets`
```sql
ticket_id    INT AUTO_INCREMENT PRIMARY KEY
booking_id   INT NOT NULL  -- FK -> bookings(booking_id)
service_id   INT NOT NULL  -- FK -> services(service_id)
ticket_code  VARCHAR(100) NOT NULL  -- Format: SB-{bookingId}-{index}-{random6chars}
status       VARCHAR(50) DEFAULT 'unused'  -- 'unused','used','void'
issued_at    DATETIME NULL
used_at      DATETIME NULL
```

#### `payments`
```sql
payment_id             INT AUTO_INCREMENT PRIMARY KEY
user_id                INT NULL
location_id            INT NOT NULL
booking_id             INT NOT NULL  -- FK -> bookings(booking_id)
amount                 DECIMAL(12,2) NOT NULL
transaction_source     VARCHAR(50) NULL  -- 'online_booking','pos','admin'
commission_rate        DECIMAL(5,2) NULL
commission_amount      DECIMAL(12,2) NULL
vat_rate               DECIMAL(5,2) NULL
vat_amount             DECIMAL(12,2) NULL
owner_receivable       DECIMAL(12,2) NULL
payment_method         VARCHAR(50) NULL
transaction_code       VARCHAR(100) NULL
qr_data                JSON NULL
status                 VARCHAR(50) DEFAULT 'pending'  -- 'pending','completed','failed','refunded'
notes                  TEXT NULL
performed_by_user_id   INT NULL
performed_by_role      VARCHAR(50) NULL
performed_by_name      VARCHAR(200) NULL
payment_time           DATETIME NULL
created_at             DATETIME DEFAULT CURRENT_TIMESTAMP
```

#### `vouchers`
```sql
voucher_id              INT AUTO_INCREMENT PRIMARY KEY
owner_id                INT NOT NULL  -- FK -> users(user_id)
location_id             INT NULL  -- FK -> locations(location_id)
code                    VARCHAR(100) NOT NULL
campaign_name           VARCHAR(255) NULL
campaign_description    TEXT NULL
discount_type           ENUM('percent','amount') NOT NULL
discount_value          DECIMAL(12,2) NOT NULL
apply_to_service_type   ENUM('all','room','food','ticket','other') DEFAULT 'all'
apply_to_location_type  ENUM('all','hotel','restaurant','tourist','cafe','resort','other') DEFAULT 'all'
min_order_value         DECIMAL(12,2) DEFAULT 0
max_discount_amount     DECIMAL(12,2) NULL
usage_limit             INT DEFAULT 1
used_count              INT DEFAULT 0
max_uses_per_user       INT DEFAULT 1
target_group            VARCHAR(50) DEFAULT 'all'  -- 'all','loyal','new'
loyalty_min_spend       DECIMAL(12,2) NULL
status                  VARCHAR(50) DEFAULT 'active'  -- 'active','expired','disabled'
start_date              DATETIME NOT NULL
end_date                DATETIME NOT NULL
created_at              DATETIME DEFAULT CURRENT_TIMESTAMP
```

### 6.2 Supporting Tables

#### `user_active_sessions`
```sql
user_id    INT PRIMARY KEY  -- FK -> users(user_id)
session_id VARCHAR(64) NOT NULL
created_at DATETIME DEFAULT CURRENT_TIMESTAMP
updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
```

#### `checkins`
```sql
checkin_id         INT AUTO_INCREMENT PRIMARY KEY
user_id            INT NOT NULL  -- FK -> users(user_id)
location_id        INT NOT NULL  -- FK -> locations(location_id)
checkin_latitude   DECIMAL(10,8) NULL
checkin_longitude  DECIMAL(11,8) NULL
notes              TEXT NULL
device_info        VARCHAR(500) NULL
image_url          VARCHAR(500) NULL
status             VARCHAR(50) DEFAULT 'verified'
checkin_time       DATETIME DEFAULT CURRENT_TIMESTAMP
```

#### `reviews`
```sql
review_id    INT AUTO_INCREMENT PRIMARY KEY
user_id      INT NOT NULL  -- FK -> users(user_id)
location_id  INT NOT NULL  -- FK -> locations(location_id)
rating       DECIMAL(3,1) NOT NULL
comment      TEXT NULL
images       JSON NULL
status       VARCHAR(50) DEFAULT 'active'  -- 'active','deleted'
deleted_at   DATETIME NULL
created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
```

#### `favorite_locations`
```sql
id          INT AUTO_INCREMENT PRIMARY KEY
user_id     INT NOT NULL  -- FK -> users(user_id)
location_id INT NOT NULL  -- FK -> locations(location_id)
note        TEXT NULL
tags        VARCHAR(500) NULL
added_at    DATETIME DEFAULT CURRENT_TIMESTAMP
UNIQUE KEY (user_id, location_id)
```

#### `user_diary`
```sql
diary_id    INT AUTO_INCREMENT PRIMARY KEY
user_id     INT NOT NULL  -- FK -> users(user_id)
location_id INT NULL  -- FK -> locations(location_id)
images      JSON NULL
mood        VARCHAR(50) DEFAULT 'happy'  -- 'happy','excited','neutral','sad','angry','tired'
notes       TEXT NULL
created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
```

#### `booking_table_reservations`
```sql
reservation_id       BIGINT AUTO_INCREMENT PRIMARY KEY
booking_id           INT NOT NULL  -- FK -> bookings(booking_id)
table_id             INT NOT NULL  -- FK -> pos_tables(table_id)
location_id          INT NOT NULL
start_time           DATETIME NOT NULL
end_time             DATETIME NOT NULL
status               ENUM('active','checked_in','cancelled','no_show','released') DEFAULT 'active'
checked_in_at        DATETIME NULL
actual_end_time      DATETIME NULL
cancelled_at         DATETIME NULL
created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP
updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
```

#### `hotel_rooms`
```sql
room_id       INT AUTO_INCREMENT PRIMARY KEY
location_id   INT NOT NULL
service_id    INT NOT NULL  -- UNIQUE(location_id, service_id)
area_id       INT NULL
floor_number  INT DEFAULT 0
room_number   VARCHAR(20) NULL
status        VARCHAR(50) DEFAULT 'vacant'  -- 'vacant','reserved','occupied'
```

#### `hotel_stays`
```sql
stay_id           INT AUTO_INCREMENT PRIMARY KEY
location_id       INT NOT NULL
room_id           INT NOT NULL  -- FK -> hotel_rooms(room_id)
user_id           INT NULL
booking_id        INT NULL  -- FK -> bookings(booking_id)
status            VARCHAR(50) DEFAULT 'reserved'  -- 'reserved','inhouse','checked_out','cancelled'
checkin_time      DATETIME NULL
checkout_time     DATETIME NULL
expected_checkin  DATETIME NOT NULL
expected_checkout DATETIME NOT NULL
subtotal_amount   DECIMAL(12,2) NULL
discount_amount   DECIMAL(12,2) NULL
final_amount      DECIMAL(12,2) NULL
notes             TEXT NULL
created_at        DATETIME DEFAULT CURRENT_TIMESTAMP
```

#### `otp_codes`
```sql
id          INT AUTO_INCREMENT PRIMARY KEY
email       VARCHAR(255) NOT NULL
otp_code    VARCHAR(10) NOT NULL
type        VARCHAR(50) NOT NULL  -- 'REGISTER','FORGOT_PASSWORD'
expires_at  DATETIME NOT NULL
is_used     TINYINT DEFAULT 0
created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
```

#### `login_attempts`
```sql
email         VARCHAR(255) PRIMARY KEY
attempts      INT NOT NULL DEFAULT 0
locked_until  DATETIME NULL
updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
```

#### `account_blacklist`
```sql
blacklist_id   BIGINT AUTO_INCREMENT PRIMARY KEY
user_id        INT NULL  -- FK -> users(user_id)
email          VARCHAR(255) NULL UNIQUE
phone          VARCHAR(30) NULL UNIQUE
reason         VARCHAR(255) NULL
created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
```

### 6.3 POS Tables

#### `pos_tables`
```sql
table_id    INT AUTO_INCREMENT PRIMARY KEY
location_id INT NOT NULL
table_name  VARCHAR(100) NULL
status      VARCHAR(50) DEFAULT 'free'  -- 'free','reserved','occupied'
```

#### `pos_orders`
```sql
order_id         INT AUTO_INCREMENT PRIMARY KEY
location_id      INT NOT NULL
table_id         INT NULL
status           VARCHAR(50) DEFAULT 'open'  -- 'open','closed','cancelled'
order_source     VARCHAR(50) NULL  -- 'online_booking','pos','admin'
subtotal_amount  DECIMAL(12,2) DEFAULT 0
discount_amount  DECIMAL(12,2) DEFAULT 0
final_amount     DECIMAL(12,2) DEFAULT 0
created_by       INT NULL
created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
```

#### `pos_order_items`
```sql
order_id    INT NOT NULL  -- FK -> pos_orders(order_id)
service_id  INT NOT NULL  -- FK -> services(service_id)
quantity    INT NOT NULL
unit_price  DECIMAL(12,2) NOT NULL
line_total  DECIMAL(12,2) NOT NULL
```

### 6.4 Notification Tables

#### `push_notifications`
```sql
notification_id   INT AUTO_INCREMENT PRIMARY KEY
title             VARCHAR(255) NOT NULL
body              TEXT NOT NULL
target_audience   VARCHAR(50) NOT NULL  -- 'all_users','all_owners','specific_user'
target_user_id    INT NULL
target_path       VARCHAR(500) NULL
sent_by           INT NULL
created_at        DATETIME DEFAULT CURRENT_TIMESTAMP
```

#### `user_notification_reads`
```sql
notification_id INT NOT NULL  -- FK -> push_notifications(notification_id)
user_id         INT NOT NULL  -- FK -> users(user_id)
read_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
PK (notification_id, user_id)
```

#### `user_notification_dismissed`
```sql
notification_id INT NOT NULL  -- FK -> push_notifications(notification_id)
user_id         INT NOT NULL  -- FK -> users(user_id)
dismissed_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
PK (notification_id, user_id)
```

### 6.5 System Tables

#### `system_settings`
```sql
setting_key       VARCHAR(100) PRIMARY KEY
setting_value     TEXT NULL
setting_value_file VARCHAR(500) NULL
```

Known keys: `login_background_url`, `app_background_url`, `default_commission_rate`, `vat_rate`

#### `background_schedules`
```sql
schedule_id          INT AUTO_INCREMENT PRIMARY KEY
title                VARCHAR(255) NULL
image_url            VARCHAR(500) NULL
image_path           VARCHAR(500) NULL
is_active            TINYINT DEFAULT 0
applied_to_setting   VARCHAR(100) NOT NULL  -- 'login_background','app_background'
start_date           DATETIME NOT NULL
end_date             DATETIME NOT NULL
updated_at           DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
```

---

## Appendix A: Key Business Constraints Summary

| Constraint | Value | Source File |
|------------|-------|-------------|
| Password minimum length | 6 characters | authController.ts |
| OTP expiry | 5 minutes | authController.ts |
| Login brute-force lockout | 5 failures → 5 min lock | authController.ts |
| Access token expiry | 7 days | authController.ts |
| Refresh token expiry | 30 days | authController.ts |
| Single session per user | Yes | session.ts |
| Check-in phone required | Yes (`^0\d{9}$`) | userController.ts |
| Vietnam geofence | lat 8-23.5, lng 102-110.5 | userController.ts |
| Nearby location radius | 80 meters | userController.ts |
| Max distance from location | 500 meters | userController.ts |
| Min interval between check-ins | 30 seconds | userController.ts |
| Max check-ins per hour | 20 | userController.ts |
| Max check-ins per day | 100 | userController.ts |
| Min interval same location | 2 minutes | userController.ts |
| Max user-created locations/day | 20 | userController.ts |
| Night check-in hours | 22:00 - 05:00 | userController.ts |
| Review rating range | 1-5, step 0.5 | userController.ts |
| Max tickets per transaction | 50 | bookingService.ts |
| Max rooms per batch booking | 20 | bookingService.ts |
| Advance booking limit | 3 days | bookingService.ts |
| Table reservation hold | 120 minutes | tableReservations.ts |
| Owner reservation window | 60 minutes before | tableReservations.ts |
| Room cancellation window | 24 hours before check-in | bookingService.ts |
| Table cancellation window | Before owner window (60 min before) | bookingService.ts |
| Table cancel blocked if paid | Yes | bookingService.ts |
| Default commission rate | 2.5% | bookingPaymentService.ts |
| Default VAT rate | 10% | bookingPaymentService.ts |
| Auto-cancel food bookings | 60 min after check-in | server.ts |
| Auto-cancel hotel bookings | 60 min after check-in | server.ts |
| Auto-cancel ticket bookings | 1440 min (1 day) after check-in | server.ts |
| Auto-confirm pending paid bookings | 30 min after payment | server.ts |
| Booking reminders | 6h before check-in, 3h before checkout | server.ts |
| Person name pattern | Vietnamese letters + spaces only | bookingService.ts |
| Phone pattern | `^0\d{9}$` | bookingService.ts |

---

## Appendix B: Mobile-Specific OAuth Deep Links

**Google OAuth redirect:** `travelcheckin://auth/callback`
**Facebook OAuth redirect:** `travelcheckin://auth/callback`

Mobile flow:
1. `GET /api/auth/google/mobile` → redirects to Google consent screen
2. Google redirects to `/api/auth/google/callback`
3. Backend exchanges code, gets userinfo, creates/links user
4. Redirects to `travelcheckin://auth/callback?accessToken=...&refreshToken=...`

For Chrome Android workaround: backend renders HTML page with button that deep-links to mobile app (cannot handle `exp://` scheme redirects directly).

---

## Appendix C: FCM Push Notification Topics

- `user_{userId}` — user-specific notifications
- `all_users` — broadcast to all users
- `owner_{ownerId}` — owner-specific notifications
- `all_owners` — broadcast to all owners

Subscribe via `POST /api/push/device-tokens` with `{token, deviceId, platform}`.

---

## Appendix D: Realtime Events (SSE)

| Event | Description |
|-------|-------------|
| `session_revoked` | Session replaced by new login |
| `booking_expired` | Booking auto-cancelled |
| `booking_checked_in` | Booking checked in by staff |
| `booking_cancelled` | Booking cancelled |
| `pos_updated` | POS order/table changed |
| `tourist_updated` | Tourist service updated |
| `hotel_updated` | Hotel room/stay updated |

---

*Generated from codebase analysis on 2026-06-04. All file paths, method names, variable states, and endpoint patterns are extracted from actual source code.*
