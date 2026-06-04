# TravelCheckinApp - Mobile App Requirements Document

> **Target:** Expo Router SDK 56 — User (Tourist) Role Only
> **Source:** Extracted from existing Backend + Website codebase

---

## 1. TECHNICAL REQUIREMENTS

### 1.1 Framework & Dependencies

| Requirement | Specification |
|-------------|---------------|
| Framework | Expo SDK ~56.0.8 |
| Routing | Expo Router ~56.2.8 |
| React Native | 0.85.3 |
| TypeScript | ~6.0.3 |
| Maps | react-native-maps 1.27.2 |
| Location | expo-location ~56.0.15 |
| Animation | react-native-reanimated 4.3.1 |

**Additional required packages (not yet installed):**
- `axios` — HTTP client
- `zustand` — State management
- `socket.io-client` — Realtime events
- `expo-camera` — QR scanning
- `expo-haptics` — Haptic feedback
- `expo-notifications` — Push notifications
- `expo-image-picker` — Photo selection
- `expo-file-system` — File handling
- `dayjs` — Date manipulation
- `@react-native-async-storage/async-storage` — Persistent storage

### 1.2 API Base URL

```
Default: http://localhost:3000/api
Production: Configured via environment variable
Mobile OAuth callback: travelcheckin://auth/callback
```

### 1.3 Architecture Pattern

- **State Management:** Zustand stores + AsyncStorage persistence
- **API Layer:** Axios instance with Bearer token interceptor
- **Navigation:** Expo Router file-based routing
- **Styling:** StyleSheet.create (no inline styles)
- **Lists:** FlatList (not ScrollView) for long lists
- **Performance:** useMemo/useCallback for complex computations

---

## 2. AUTHENTICATION REQUIREMENTS

### 2.1 Login Flow

| Step | Action | Endpoint |
|------|--------|----------|
| 1 | User enters email + password | `POST /api/auth/login` |
| 2 | Store tokens in SecureStore/AsyncStorage | — |
| 3 | Navigate to home based on `redirectUrl` | — |

**Response:**
```json
{
  "success": true,
  "data": {
    "user": { "user_id", "email", "phone", "full_name", "role", "avatar_url", "is_verified" },
    "accessToken": "JWT...",
    "refreshToken": "JWT...",
    "redirectUrl": "/user/dashboard"
  }
}
```

### 2.2 Registration Flow

| Step | Action | Endpoint |
|------|--------|----------|
| 1 | Submit {full_name, email, password, phone} | `POST /api/auth/register` |
| 2 | Submit {email, otp} | `POST /api/auth/verify-otp` |
| 3 | Navigate to login | — |

**Constraints:**
- Password minimum 6 characters
- Phone format: `^0\d{9}$` (10 digits starting with 0)
- OTP expires in 5 minutes
- Brute-force: 5 failed attempts → 5-minute lockout

### 2.3 Google OAuth (Mobile Server-Side Flow)

| Step | Action | Endpoint |
|------|--------|----------|
| 1 | Open WebView to | `GET /api/auth/google/mobile` |
| 2 | User consents on Google | — |
| 3 | Google redirects to backend callback | `GET /api/auth/google/callback` |
| 4 | Backend exchanges code, creates/links user | — |
| 5 | Backend redirects to deep link | `travelcheckin://auth/callback?accessToken=...&refreshToken=...` |
| 6 | App extracts tokens from URL | — |

### 2.4 Facebook OAuth (Mobile Server-Side Flow)

Same pattern as Google:
- `GET /api/auth/facebook/mobile` → consent → `GET /api/auth/facebook/callback` → deep link

### 2.5 Token Management

| Token | Expiry | Secret |
|-------|--------|--------|
| Access Token | 7 days | JWT_SECRET |
| Refresh Token | 30 days | JWT_REFRESH_SECRET |

**Axios Interceptor Requirements:**
- Request: Read token from storage, inject `Authorization: Bearer {token}`
- Response 401: Attempt token refresh via `POST /api/auth/refresh-token`
- Response SESSION_REVOKED: Show re-login modal
- Response ACCOUNT_LOCKED: Force logout

### 2.6 Session Management

- **Single session per user** — new login replaces old session
- Old session receives `session_revoked` via Socket.IO
- `GET /api/auth/session` — validate session on app foreground

---

## 3. SCREEN REQUIREMENTS

### 3.1 Required Screens

| Screen | Route | Description |
|--------|-------|-------------|
| Login | `/login` | Email/password + social login buttons |
| Register | `/register` | Step 1: form, Step 2: OTP verification |
| Forgot Password | `/forgot-password` | Email → OTP → new password |
| Home Dashboard | `/(tabs)/home` | Featured locations, recommendations |
| Map | `/(tabs)/map` | Full map with search, routing, markers |
| Location Detail | `/location/[id]` | Info, services, reviews, booking button |
| Booking | `/booking/[serviceId]` | Time selection, quantity, voucher, payment |
| Payment | `/payment` | VietQR display, confirm transfer |
| My Tickets | `/(tabs)/tickets` | Active tickets with QR codes |
| Profile | `/(tabs)/profile` | User info, stats, settings |
| Check-ins | `/checkins` | History of check-ins |
| Saved Locations | `/saved-locations` | Favorites list |
| Diary | `/diary` | Travel diary entries |
| Vouchers | `/vouchers` | Saved vouchers list |
| Booking Reminders | `/booking-reminders` | Upcoming booking notifications |
| Notifications | `/notifications` | Push notification history |
| SOS | `/sos` | Emergency alert with GPS |
| AI Chat | `/ai-chat` | Chat with AI assistant |
| Leaderboard | `/leaderboard` | Check-in rankings by province |

### 3.2 Tab Navigation Structure

```
(Tabs)
├── Home        — HomeDashboard
├── Map         — UserMap
├── Tickets     — MyTickets
└── Profile     — UserProfile
```

---

## 4. MAP REQUIREMENTS

### 4.1 Tile Layers (4 Modes)

| Mode | Label | URL |
|------|-------|-----|
| Standard | Bản đồ tiêu chuẩn | `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` |
| Light | Bản đồ sáng | `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png` |
| Streets | Bản đồ đường phố | `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png` |
| Satellite | Vệ tinh | `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}` |

Max zoom: 17 across all layers.

### 4.2 Map Features

- [ ] Show user current location
- [ ] Display location markers (circular avatar icons)
- [ ] Different pin colors: owner (blue), user-created (amber), search (green), picked (yellow), my position (red)
- [ ] Double-tap to pick point → show popup with actions (check-in, route, save)
- [ ] Single tap on marker → open location detail panel
- [ ] Route to destination via OSRM
- [ ] Bearing arrow pointing to destination (50m circle + arrow)
- [ ] Compass rotation using device orientation
- [ ] Search locations with ranking algorithm
- [ ] Toggle between 4 tile layers
- [ ] Max zoom enforcement (17)

### 4.3 Routing

**OSRM endpoints (dual fallback):**
```
https://router.project-osrm.org/route/v1/driving/{fromLng},{fromLat};{toLng},{toLat}?overview=full&geometries=geojson&alternatives=true
https://routing.openstreetmap.de/routed-car/route/v1/driving/{fromLng},{fromLat};{toLng},{toLat}?overview=full&geometries=geojson&alternatives=true
```

Retry: 3 attempts per URL, exponential backoff (attempt * 300ms).

When no route found (river/lake): Show haversine straight line + warning message.

### 4.4 Search Ranking

Score calculation:
- Owner boost: +1000
- System boost: +40
- Text match: up to +120
- Distance: +400 (≤5km), +250 (≤20km), +120 (≤50km), +50 (≤100km)
- Province match: +800 (query hint), +500 (user province)
- Province mismatch: -80 to -120

---

## 5. BOOKING REQUIREMENTS

### 5.1 Service Types

| Type | Description | Max Quantity |
|------|-------------|-------------|
| `ticket` | Tourist attraction tickets | 50 per transaction |
| `table` | Restaurant table reservation | Multiple tables |
| `room` | Hotel/resort room | 1 per booking, 20 per batch |
| `food` | Pre-order food items | Unlimited |
| `combo` | Combo meals | Unlimited |

### 5.2 Time Constraints

| Constraint | Value |
|------------|-------|
| Advance booking limit | Today + 3 days |
| Table reservation hold | 120 minutes from check-in |
| Owner acceptance window | 60 minutes before reservation |
| Auto-cancel food | 60 min after check-in |
| Auto-cancel hotel | 60 min after check-in (if not checked in) |
| Auto-cancel ticket | 1440 min (1 day) after check-in |
| Auto-confirm paid bookings | 30 min after payment |
| Room cancellation | 24 hours before check-in |
| Table cancellation | Before owner window (60 min before) |

### 5.3 Booking Flow — Tickets

```
1. Select location → view services
2. Choose ticket type + quantity (max 50, limited by remaining_today)
3. Select date (today to +3 days)
4. Apply voucher (optional)
5. Create booking → POST /api/bookings {ticket_items: [{service_id, quantity}]}
6. Get payment → POST /api/bookings/:id/payments
7. Display VietQR → user scans & pays
8. Confirm transfer → POST /api/bookings/:id/tickets/confirm-transfer
9. Receive ticket codes (format: SB-{bookingId}-{index}-{random6chars})
10. Show tickets with QR codes
```

### 5.4 Booking Flow — Restaurant Table

```
1. Select location → view POS tables
2. Choose free tables (or own existing reservations)
3. Select check-in time (within opening hours, max +3 days)
4. Enter contact_name + contact_phone (required)
5. Enable pre-order (optional) → select food/combo items
6. Apply voucher (optional)
7. Create booking → POST /api/bookings {table_ids, preorder_items}
8. Get payment → POST /api/bookings/:id/payments
9. Display VietQR → user scans & pays
10. Confirm transfer → POST /api/bookings/:id/tables/confirm-transfer
11. Show reservation with secure code (DI-{6-char-HMAC})
```

### 5.5 Booking Flow — Hotel Room

```
1. Select location → view room services
2. Choose room(s) — multi-room via batch booking
3. Select check-in date + stay duration (1-90 days)
4. Apply voucher (optional)
5. Create batch booking → POST /api/bookings/batch {service_ids}
6. Get batch payment → POST /api/bookings/batch/payments
7. Display VietQR → user scans & pays
8. Confirm transfer → POST /api/bookings/batch/rooms/confirm-transfer
9. Show reservation with secure code (RS-{6-char-HMAC})
```

### 5.6 Cancellation Rules

| Type | Can Cancel If | Cannot Cancel If |
|------|--------------|-----------------|
| Table | Not paid AND >60 min before reservation | Paid OR within 60 min |
| Room | >24 hours before check-in AND pending/confirmed | Within 24 hours |
| Ticket | Unused | Already used |

---

## 6. PAYMENT REQUIREMENTS

### 6.1 VietQR Generation

**URL Pattern:**
```
https://img.vietqr.io/image/{BIN}-{bankAccount}-compact2.png?addInfo={content}&amount={amount}&accountName={accountHolder}
```

**Bank BIN Codes:**
| Bank | BIN |
|------|-----|
| Vietcombank | 970436 |
| Vietinbank | 970415 |
| BIDV | 970418 |
| Agribank | 970405 |
| ACB | 970416 |
| Techcombank | 970407 |
| MB Bank | 970422 |
| VPBank | 970432 |
| TPBank | 970423 |
| Sacombank | 970403 |
| SHB | 970443 |
| HDBank | 970437 |
| OCB | 970448 |
| MSB | 970426 |
| Eximbank | 970431 |
| SeABank | 970440 |

### 6.2 Payment Disclaimer

> "Đã thanh toán nếu có vấn đề phát sinh hay không tới bị hủy thì tiền không được hoàn lại"

---

## 7. CHECK-IN REQUIREMENTS

### 7.1 Constraints

| Constraint | Value |
|------------|-------|
| Phone required | Yes (`^0\d{9}$`) |
| Vietnam geofence | lat 8-23.5, lng 102-110.5 |
| Nearby location auto-match | 80 meters |
| Max distance from location | 500 meters |
| Min interval (any) | 30 seconds |
| Max per hour | 20 |
| Max per day | 100 |
| Min interval (same location) | 2 minutes |
| Max user-created locations/day | 20 |
| Night safety warning | 22:00 - 05:00 |

### 7.2 Flow

```
1. Get current GPS location
2. Verify within Vietnam bounds
3. Search nearby locations (80m radius, Haversine formula)
4. If found → attach to location
5. If not found → create user location (rate-limited)
6. Check opening hours
7. Apply rate limits
8. Create check-in → POST /api/user/checkins
9. If night time → show safety warning + send push notification
```

---

## 8. VOUCHER REQUIREMENTS

### 8.1 Validation Rules

1. Status must be `active`
2. Within `start_date` → `end_date` range
3. `used_count < usage_limit`
4. Location matching (single or multi-location)
5. Service type matching (all/room/food/ticket/other)
6. Location type matching (all/hotel/restaurant/tourist/cafe/resort/other)
7. `min_order_value` check
8. `max_uses_per_user` check
9. Loyal customer check (if `target_group='loyal'`)

### 8.2 Discount Calculation

```ts
if (discount_type === "percent") {
  discount = (total * discount_value) / 100;
  if (max_discount_amount) discount = min(discount, max_discount_amount);
} else {
  discount = discount_value;
}
discount = min(discount, total);
```

---

## 9. REALTIME REQUIREMENTS

### 9.1 SSE Events

Connect to: `GET /api/events?token={JWT}`

| Event | Action |
|-------|--------|
| `session_revoked` | Show re-login modal |
| `booking_expired` | Remove expired booking from UI |
| `booking_checked_in` | Update booking status |
| `booking_cancelled` | Update booking status |
| `pos_updated` | Refresh tables, orders |
| `tourist_updated` | Refresh services |
| `hotel_updated` | Refresh rooms |

### 9.2 Push Notifications (FCM)

Topics:
- `user_{userId}` — user-specific
- `all_users` — broadcast

Register: `POST /api/push/device-tokens` with `{token, deviceId, platform}`

---

## 10. SOS REQUIREMENTS

| Feature | Detail |
|---------|--------|
| Create alert | `POST /api/sos` with GPS coordinates |
| Ping (update location) | `POST /api/sos/ping` |
| Stop alert | `POST /api/sos/stop` |
| GPS format | `ST_GeomFromText('POINT(lng lat)')` |

---

## 11. GEO REQUIREMENTS

| Feature | Endpoint | Cache |
|---------|----------|-------|
| Search places | `GET /api/geo/search?q=&limit=` | 1 hour |
| Reverse geocode | `GET /api/geo/reverse?lat=&lng=` | 24 hours |
| Rate limit | 60 burst tokens, refill 1/sec | — |
| Bounds | Vietnam only (lat 8-23.5, lng 102-110.5) | — |

---

## 12. COMMISSION SYSTEM

```ts
commissionAmount = amount * commissionRate / 100
vatAmount = commissionAmount * vatRate / 100
ownerReceivable = amount - commissionAmount - vatAmount
```

| Rate | Default | Override |
|------|---------|----------|
| Commission | 2.5% | Per-location `commission_rate` |
| VAT | 10% | System setting `vat_rate` |

---

## 13. MEMBER TIERS

| Tier | Check-ins |
|------|-----------|
| Newbie | 0-4 |
| Silver Traveler | 5-15 |
| Gold Explorer | 16-30 |
| Diamond Pathfinder | 31+ |

---

## 14. NON-FUNCTIONAL REQUIREMENTS

| Requirement | Specification |
|-------------|---------------|
| Language | Vietnamese UI |
| Comments | Vietnamese (explain "why", not "what") |
| No emojis | In source code |
| No `any` type | Explicit interfaces |
| Styling | StyleSheet.create |
| Lists | FlatList |
| Performance | useMemo/useCallback |
| Error handling | Try/catch on all async |
| API errors | Show user-friendly Vietnamese messages |

---

*Generated from codebase analysis on 2026-06-04.*
