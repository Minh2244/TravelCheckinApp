# Technical Specification & System Architecture Report: User (Tourist) Role
*Target Platform: Expo Router (React Native, SDK 56)*

This master technical specification documents the exact architecture, state management, API endpoints, map/routing configurations, and business workflows extracted from the TravelCheckin codebase. It serves as the single source of truth (SSOT) to be fed into Google AI Studio to build the mobile app version.

---

## 1. Core Architecture & Technologies

### Backend Stack
* **Language & Runtime:** TypeScript / Node.js (v18+)
* **Framework:** Express.js `^5.2.1`
* **Database & Driver:** MySQL (v8.0+), using `mysql2` `^3.16.0` (with connection pooling)
* **Authentication & Security:** 
  * `jsonwebtoken` `^9.0.3` (JWT token-based auth)
  * `bcryptjs` `^3.0.3` / `bcrypt` `^6.0.0` (password hashing)
  * `helmet` `^8.1.0` (HTTP headers security)
  * In-memory Rate Limiting (Token Bucket algorithm: refill 1 token/sec, burst size 60) for Geocoding APIs.
* **Realtime Communication:** 
  * Server-Sent Events (SSE) via `/api/events` route (query-based JWT verification)
  * `socket.io` `^4.8.3` (WebSockets hub)
* **Push Notifications:** `firebase-admin` `^13.6.0` (Google Cloud Messaging)

### Web Frontend Stack
* **Framework & Build Tool:** React `^19.2.0`, Vite `^7.2.4`
* **Language:** TypeScript `~5.9.3`
* **Styling:** TailwindCSS `^3.4.17`
* **State Management:** Installed `zustand` `^5.0.9`, but the codebase primarily relies on `sessionStorage` persistence and local React states.
* **UI Components:** Ant Design (`antd`) `^6.1.4`
* **Map Engine:** Leaflet `^1.9.4` and React-Leaflet `^5.0.0` (with `leaflet-polylinedecorator` `^1.6.0`)
* **API Client:** Axios `^1.13.2`

### Decoupling Architecture
The system employs a fully decoupled, API-driven architecture. The web and mobile frontends communicate with the Express backend using standardized JSON REST APIs.
* **API URL Configuration:** Frontend uses `import.meta.env.VITE_API_URL` (web) and mobile must use `process.env.EXPO_PUBLIC_API_URL` (exposed externally via Ngrok during development).
* **Real-time Synchronization:** The frontend listens to real-time events via SSE (`/api/events?token=<accessToken>`) or WebSockets. State changes on the backend (e.g. Booking updates, POS status changes, PMS check-ins) push events which trigger immediate frontend re-fetching.

---

## 2. State Management & Authentication Flow

### State & Persistence Analysis
Although `zustand` is declared as a dependency in the web frontend, there is no active global Zustand store in the web codebase. State is managed locally and persisted across page loads using `sessionStorage`. 

#### Storage Keys & Variables:
1. `accessToken` (string): JWT Access Token.
2. `refreshToken` (string): JWT Refresh Token (used to fetch a new Access Token).
3. `user` (stringified JSON): Current logged-in user profile, conforming to the `User` interface:
   ```typescript
   export interface User {
     user_id: number;
     email: string;
     phone: string | null;
     full_name: string;
     role: "user" | "owner" | "employee" | "admin";
     avatar_url: string | null;
     is_verified: number;
   }
   ```
4. `userMapNearbyRadius` / `userMapCustomRadiusInput`: Radius configurations for map location search.
5. `userMapRoute`: Stores the active route target coordinate, routing mode, and status to persist route lines during map page reloads.

> [!TIP]
> **Mobile Implementation Recommendation:**
> For the Expo Router app, you must implement a global Zustand store (`useAuthStore`) integrated with `expo-secure-store` or `AsyncStorage` to mimic the web's storage behavior while maintaining a native user session.

### Authentication Flow Details

#### 1. Traditional Login & Registration
* **Registration (`POST /api/auth/register`):**
  * Inputs: `email`, `phone`, `password`, `full_name`.
  * Logic: Hashes password via `bcrypt.hash(password, 10)`. Inserts user into DB with `status = 'pending'` and `is_verified = 0`. Generates a 6-digit OTP code, saves it to `otp_codes`, and sends it to the user's email.
* **OTP Verification (`POST /api/auth/verify-otp`):**
  * Inputs: `email`, `otp`.
  * Logic: Verifies the code from `otp_codes`. Updates user to `is_verified = 1`, `verified_at = NOW()`, and `status = 'active'`.
* **Login (`POST /api/auth/login`):**
  * Inputs: `email`, `password`.
  * Logic: Validates credentials, checks brute-force limits (locks user temporarily after 5 failed attempts), and ensures the user role is authorized. Generates a new unique `sessionId` (UUIDv4) and registers it as active in the database (automatically revokes any previous session, emitting a `session_revoked` event). Returns the `accessToken`, `refreshToken`, and `user` object.

#### 2. Social OAuth Logins (Google & Facebook)
* **Web Implementation:**
  * Opens a popup to the provider's OAuth Dialog (`https://accounts.google.com/o/oauth2/v2/auth` or `https://www.facebook.com/v18.0/dialog/oauth`) with `response_type=token` and `redirect_uri=http://localhost:5173/auth/google/callback` (or `/facebook/callback`).
  * The callback page parses the hash query parameter `access_token` and does a `window.opener.postMessage` to the parent window containing the raw provider credentials.
  * The parent window listens for this message and sends the profile details to the backend:
    `POST /api/auth/social-login`
    ```json
    {
      "provider": "google" | "facebook",
      "socialId": "oauth-unique-id",
      "email": "user@example.com",
      "fullName": "User Name",
      "avatarUrl": "https://lh3.googleusercontent.com/..."
    }
    ```
* **Backend Social Login Processing (`authController.ts`):**
  * If a user with `google_id` or `facebook_id` equal to `socialId` exists, log them in.
  * If the email exists but is not linked, link the social ID to the existing account.
  * If the user does not exist, insert a new row with `status = 'active'`, `is_verified = 1`, and `password_hash = NULL`.
  * Generate and return `accessToken`, `refreshToken`, and `user` details.

### Axios Interceptors & Token Injection
File Path: [axiosClient.ts](file:///e:/TravelCheckinApp/website/src/api/axiosClient.ts)

#### Request Interceptor:
Automatically reads the token from `sessionStorage` and injects it as a Bearer token:
```typescript
axiosClient.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("accessToken");
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

#### Response Interceptor & Global Error Handling:
1. **Concurrent Login Check (`SESSION_REVOKED`):**
   If the response data contains a code of `SESSION_REVOKED` (due to another device logging in), a custom window event `"tc-session-revoked"` is dispatched to warn the user.
2. **Forced Logout Cases:**
   If the HTTP status code is `401` (Unauthorized) or `403` (Forbidden) due to:
   * Account being locked (`ACCOUNT_LOCKED` or "tài khoản đã bị khóa")
   * Owner profile pending approval (`OWNER_NOT_APPROVED` or "owner đang chờ admin duyệt")
   The interceptor immediately removes all session variables (`accessToken`, `refreshToken`, `user`, etc.) and redirects the browser window to `/login`.

---

## 3. Full User API Endpoints Specification
All user-role API endpoints require an active JWT authorization header (`Authorization: Bearer <accessToken>`).

### 1. Authentication Endpoints (`/api/auth`)
* `POST /api/auth/register` - Create a pending user account.
* `POST /api/auth/verify-otp` - Confirm registration using 6-digit email OTP.
* `POST /api/auth/login` - Authenticate email and password. Returns tokens.
* `POST /api/auth/social-login` - Social OAuth login wrapper (Google/Facebook).
* `POST /api/auth/forgot-password` - Trigger password reset OTP email.
* `POST /api/auth/verify-reset-otp` - Validate password reset OTP.
* `POST /api/auth/reset-password` - Set a new password using verified OTP.
* `POST /api/auth/refresh-token` - Request a new `accessToken` using `refreshToken`.
* `POST /api/auth/logout` - Invalidate user session.
* `GET /api/auth/session` - Check status of current session token.
* `GET /api/auth/background` - Fetch login background image.
* `GET /api/auth/app-background` - Fetch general application background image.

### 2. User Profile & Social Interaction (`/api/user`)
* `GET /api/user/profile` - Retrieve full profile details for the logged-in tourist.
* `PUT /api/user/profile` - Update user details (name, phone, address, etc.).
* `POST /api/user/profile/avatar` - Upload a new profile avatar (multipart file `avatar`).
* `POST /api/user/profile/background` - Upload profile page background image (multipart file `background`).
* `GET /api/user/profile/login-history` - Get user login logs (supports params `page`, `limit`, `success`, `from`, `to`).
* `GET /api/user/checkins` - List all check-ins and saved location histories.
* `POST /api/user/checkins` - Log a check-in event at a location coordinates.
* `DELETE /api/user/checkins/:id` - Delete a check-in record.
* `POST /api/user/checkins/photo` - Log check-in with an uploaded image.
* `GET /api/user/favorites` - Get favorite/saved locations.
* `PATCH /api/user/favorites/:locationId` - Add/edit custom notes and tags for a favorite location.
* `DELETE /api/user/favorites/:locationId` - Unfavorite a location.
* `GET /api/user/recommendations/locations` - Fetch AI or location recommendation list.
* `GET /api/user/created-locations` - Fetch locations suggested/created by this user.
* `PATCH /api/user/created-locations/:id` - Edit user-suggested location.
* `DELETE /api/user/created-locations/:id` - Delete user-suggested location.
* `GET /api/user/vouchers/location/:locationId` - Get list of vouchers available for claiming at a location.
* `GET /api/user/vouchers/saved` - Get claimed vouchers (unused/used/expired).
* `POST /api/user/vouchers/:id/claim` - Claim a voucher.
* `GET /api/user/tickets` - Get active, unused, or void tourist ticket purchases (supports `location_id` filter).
* `GET /api/user/diary` - Get list of diary items.
* `POST /api/user/diary` - Create a diary log (mood, notes, photos, location).
* `DELETE /api/user/diary/:id` - Delete a diary entry.
* `POST /api/user/reviews/upload` - Upload image asset for location review.
* `POST /api/user/reviews` - Post rating and comment for a location.
* `DELETE /api/user/reviews/:id` - Remove a user review.
* `POST /api/user/reviews/:id/reply` - Reply to an existing review thread.
* `POST /api/user/reports/location` - File issue report (spam, fraud, etc.).
* `GET /api/user/leaderboard` - Fetch points leaderboard.
* `GET /api/user/booking-reminders` - Retrieve schedule alerts.
* `GET /api/user/notifications` - Get user push alerts.
* `POST /api/user/notifications/read-all` - Clear notification unread badges.
* `POST /api/user/notifications/delete-all` - Purge notifications history.
* `POST /api/user/notifications/location-invite` - Dispatch location check-in invites.

### 3. Bookings & Transactions (`/api/bookings`)
* `POST /api/bookings` - Create booking. Parameters:
  ```json
  {
    "location_id": 10,
    "service_id": 25,
    "check_in_date": "YYYY-MM-DD HH:mm:ss",
    "check_out_date": "YYYY-MM-DD HH:mm:ss",
    "quantity": 1,
    "source": "mobile",
    "contact_name": "Name",
    "contact_phone": "0987654321",
    "notes": "Optional notes",
    "voucher_code": "VCH10",
    "reserve_on_confirm": true,
    "table_ids": [1, 2],
    "preorder_items": [{"service_id": 12, "quantity": 2}],
    "ticket_items": [{"service_id": 15, "quantity": 3}]
  }
  ```
* `POST /api/bookings/batch` - Create batch booking (multiple hotel rooms).
* `POST /api/bookings/batch/payments` - Get combined VietQR payment code for batch room booking.
* `POST /api/bookings/batch/rooms/confirm-transfer` - Confirm bank transfer for batch rooms.
* `PUT /api/bookings/batch/contact` - Update guest contact info for batch rooms.
* `POST /api/bookings/:id/payments` - Generate/fetch single booking payment details (VietQR configuration).
* `POST /api/bookings/:id/tickets/confirm-transfer` - Confirm ticket payment transfer.
* `POST /api/bookings/:id/tables/confirm-transfer` - Confirm table preorder payment transfer.
* `POST /api/bookings/:id/rooms/confirm-transfer` - Confirm room payment transfer.
* `GET /api/bookings/table-reservations/mine` - Get active table bookings.
* `GET /api/bookings/table-reservations/pass` - Fetch active table booking pass QR shells.
* `GET /api/bookings/room-reservations/pass` - Fetch room reservation tickets.
* `POST /api/bookings/:id/tables/cancel` - Cancel a table reservation.
* `POST /api/bookings/:id/tables/preorder` - Append/update food pre-orders for a table.
* `POST /api/bookings/:id/cancel` - Cancel room or ticket booking.

---

## 4. Advanced OpenStreetMap (OSM) & Routing Logic

### Map Tiles Configuration
The map in `UserMap.tsx` configures four distinct style tiles:
```typescript
const tileOptions = [
  {
    key: "osm",
    label: "Bản đồ tiêu chuẩn",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  },
  {
    key: "positron",
    label: "Bản đồ sáng",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
  },
  {
    key: "voyager",
    label: "Bản đồ đường phố",
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
  },
  {
    key: "satellite",
    label: "Vệ tinh",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: '&copy; <a href="https://www.esri.com/">Esri</a> &mdash; Source: Esri, Maxar, Earthstar Geographics...'
  }
];
```

### Point-Clicking & Route Dispatching
1. Map is wrapped in a click listener component (`MapClickHandler`) which intercepts **double clicks (`dblclick`)** to prevent accidental pins. Double clicking sets `pickedCoords` containing `{ lat, lng }` coordinates.
2. Routing requests are dispatched when `routeEnabled` is true, targeting `routeTarget` from user's current GPS location `myPosition`.
3. Coordinates are passed to the routing endpoint using long/lat structure:
   * **Endpoint URL 1:** `https://router.project-osrm.org/route/v1/${routeProfile}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&alternatives=true`
   * **Endpoint URL 2 (OSM fallback):** `https://routing.openstreetmap.de/routed-${routeProfile}/route/v1/${routeProfile}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&alternatives=true`
   * `routeProfile` is set to `"driving"` (default motor vehicle) or `"foot"`.

### River Routing Block (Chặn chỉ đường xuống sông Cần Thơ)
Rather than hardcoding arbitrary coordinate boundary arrays inside the client, the application implements a dynamic, OSRM-driven route fallback algorithm.

1. **Topology Check:** When a user requests routing to a target coordinate situated in a water body (such as the middle of the Cần Thơ River, floating markets without bridge linkages, or isolated areas), the routing server (OSRM) fails to locate a nearby terrestrial road network segment.
2. **Error Catching:** The OSRM API returns a `400/422` error payload with `code: "NoRoute"`. The frontend router loop catches this error:
   ```typescript
   if (errBody.code === "NoRoute") {
     throw new Error("NoRoute");
   }
   ```
3. **Haversine Fallback:** Upon catching `NoRoute`, the routing state switches to **"haversine"** mode:
   * The route lines are fallbacked to a straight vector connecting the start and endpoint: `setRouteLines([[from, to]])`.
   * The `routeInfo` status is populated with `hasNoRoute: true` and the distance is calculated via the Haversine formula `haversineMeters(from, to)`.
4. **User Feedback:** The UI renders an amber warning banner:
   * **Warning Text:** `"Không tìm thấy đường bộ đến điểm này (ngoài khơi, sông hồ hoặc vùng biệt lập)"`
   * **Details:** Displays the straight-line distance ("Khoảng cách chim bay: X.XX km") and marks travel duration as unavailable.

### Custom Circular Owner Avatar Markers
Markers representing location owners use custom circular avatar icons. The structure is dynamically generated as an `L.divIcon` using the owner's profile picture:

```typescript
const getCircleImageIcon = (imageUrl: string | null, isSelected: boolean, size = 56) => {
  const borderStyle = isSelected ? `3px solid white` : `2px solid white`;
  const shadow = isSelected
    ? `0 0 0 3px #14b8a6, 0 2px 10px rgba(0,0,0,0.35)`
    : `0 2px 6px rgba(0,0,0,0.2)`;

  return L.divIcon({
    className: "",
    html: imageUrl 
      ? `<div style="
          width: ${size}px; height: ${size}px;
          border-radius: 50%;
          border: ${borderStyle};
          box-shadow: ${shadow};
          overflow: hidden;
          background: #e2e8f0;
        ">
          <img src="${imageUrl}" style="width:100%;height:100%;object-fit:cover;pointer-events:none;" 
               onerror="this.parentElement.style.background='linear-gradient(135deg,#99f6e4,#a7f3d0)';this.style.display='none';" />
        </div>`
      : `<div style="
          width: ${size}px; height: ${size}px;
          border-radius: 50%;
          border: ${borderStyle};
          box-shadow: ${shadow};
          background: linear-gradient(135deg, #99f6e4, #a7f3d0);
          display: flex; align-items: center; justify-content: center;
        ">
          <svg width="${size * 0.5}" height="${size * 0.5}" viewBox="0 0 24 24" fill="none" stroke="#14b8a6" stroke-width="2">
            <path d="M12 3a7 7 0 0 1 7 7c0 5-7 11-7 11s-7-6-7-11a7 7 0 0 1 7-7z" />
            <circle cx="12" cy="10" r="2.5" />
          </svg>
        </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 4)]
  });
};
```

---

## 5. Business Logic & Detailed Workflows

### 1. Restaurant & Hotel Bookings
* **Time-slot Check-in Validation:**
  * Bookings must have check-in times in the future.
  * Advance limit: Users are restricted to booking at most 3 days in advance (measured from local date midnight + 3 days) via the helper `getMaxAdvanceLimitEnd`.
  * Open hours validation: Table reservations are verified against the target location's opening hours array: `isWithinOpeningHours(openingHours, checkInLocal)`.
* **holding / Auto-Cancellation Logic:**
  * Driven by a background thread running on the Express server every 60 seconds (`autoCancelAndExpireBookings` in `server.ts`).
  * **Table Reservations:** Automatically cancelled (`status = 'cancelled'`) if the current time exceeds the check-in time by `auto_cancel_food_minutes` (configured per location, defaulting to 60 minutes).
  * **Hotel Rooms:** Automatically cancelled if the check-in time is exceeded by `auto_cancel_hotel_minutes` (default 60 minutes) and the booking status in `hotel_stays` is still `'reserved'` (guest has not checked in to `'inhouse'` or `'checked_out'`).
* **Pre-ordering Calculations:**
  * For tables, users can select menu items to preorder (`preorderItems`).
  * The system locks prices for all items by querying active prices from the `services` table.
  * Formula: `totalAmount = baseBookingFee (0 for tables) + SUM(menu_price * quantity)`.
  * Preorders are only allowed when booking exactly 1 table.

### 2. Tourist Tickets
* **1-Day Expiration Rule:**
  * When a tourist ticket booking is created, the system normalizes the check-in time to local `00:00:00` of the chosen date.
  * The ticket expiration (`check_out_date`) is automatically computed as the location's closing time of that date using the location's opening hours profile.
* **Attraction Closing Invalidation:**
  * At closing time (`b.check_out_date <= NOW()`), any ticket booking that remains in `pending` or `confirmed` status is marked as expired:
    `UPDATE bookings SET status = 'cancelled', notes = '[SYSTEM] Ticket expired: hết hạn khi đóng cửa' ...`
  * Associated ticket instances are updated: `UPDATE booking_tickets SET status = 'void' WHERE status = 'unused'`.

### 3. Flexible Commission System
Each booking tracks and records financial transaction values for platform bookkeeping.
* **Rate Determination:** The system queries `locations.commission_rate`. If it is null, it falls back to the database config `system_settings.default_commission_rate` (default: 2.5%).
* **Tax Rate:** Read from `system_settings.vat_rate` (default: 10%).
* **Calculations:**
  * `commissionAmount = amount * commissionRate / 100` (rounded to 2 decimal places)
  * `vatAmount = commissionAmount * vatRate / 100` (rounded to 2 decimal places)
  * `ownerReceivable = amount - commissionAmount - vatAmount` (remaining balance sent to owner account)

### 4. Omni-Channel Capacity Unification
To unify online bookings with counter offline sales, the database maintains capacity integrity under the same table schema:
* When buying a ticket or booking a service, `getServiceRemainingQuantity` queries availability by subtracting both online and offline sales from maximum capacity:
  $$\text{Remaining Quantity} = \text{Capacity} - (\text{Online Sold} + \text{POS Offline Sold})$$
  * **Online Sold:** Sum of tickets purchased online via bookings:
    `SELECT COUNT(*) FROM booking_tickets WHERE service_id = ? AND DATE(check_in_date) = ? AND status <> 'void'`
  * **POS Offline Sold:** Sum of tickets sold at the counter POS:
    `SELECT COUNT(*) FROM pos_tickets WHERE service_id = ? AND DATE(sold_at) = ? AND status <> 'void'`

### 5. Invoice Flow & VietQR Integration
* **VietQR Generation:**
  * Bank parameters are fetched from `owner_profiles` linked to the location owner: `bank_name`, `bank_account`, `account_holder`.
  * The bank name is normalized to resolve the correct 6-digit BIN code from `BANK_BIN_MAP` (e.g., `"vietcombank"` $\rightarrow$ `"970436"`, `"techcombank"` $\rightarrow$ `"970407"`).
  * Constructs the image URL pointing to the VietQR API:
    `https://img.vietqr.io/image/${inferredBin}-${encodeURIComponent(bankAccount)}-compact2.png?addInfo=${addInfo}&amount=${amount}&accountName=${accountHolder}`
    * `addInfo` contains the unique transaction code (e.g. `BK-bookingId...` or `BKB-batchId...`).
* **Checkout "View-and-Disappear" Interface Transition:**
  * While the payment is pending, the invoice/VietQR card is visible.
  * Once the user completes the transfer and clicks "Xác nhận đã chuyển khoản", the app calls `confirmTicketTransfer` / `confirmTableTransfer`.
  * Upon verification, the payment status changes to `completed`.
  * The frontend writes a success message `"Đơn đặt trước của bạn đã thành công..."` to `sessionStorage` (under key `tc_booking_fade_message`) and calls `window.location.reload()`.
  * On reload, the checkout UI detects that the active payment status is `completed`. It instantly hides the VietQR/Invoice elements ("disappears") and redirects the user to the active ticket screen `/user/tickets` to display the scan-ready QR passes.
