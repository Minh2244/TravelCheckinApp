# Mobile App Rebuild Design

**Date:** 2026-06-04
**Approach:** Hybrid — Keep auth screens, rebuild foundation + all other screens
**SDK:** Expo SDK 54 (no upgrade)

---

## 1. Overview

Rebuild the TravelCheckinApp mobile client for the `user` (tourist) role. The backend is stable and the website works correctly. The mobile app will be rebuilt from scratch (except auth screens) using a clean foundation with shared components, proper theme system, and robust API layer.

### Scope
- **Keep:** `login.tsx`, `register.tsx`, `forgot-password.tsx` (auth flow works)
- **Rebuild foundation:** Theme, shared components, API client with token refresh
- **Rebuild screens:** Home, Map, Tickets, Booking, Location Detail, Profile, History, Saved Locations, Vouchers, Booking Reminders, SOS
- **New screens:** Check-in, Diary, Notifications, Leaderboard, AI Chat

### Out of Scope
- SDK upgrade (stay on Expo SDK 54)
- Backend changes
- Website changes
- Testing framework setup

---

## 2. Foundation Layer

### 2.1 Theme System (`constants/theme.ts`)

Single source of truth for all visual tokens:

```typescript
// Colors
colors.primary = '#14b8a6'      // teal-500
colors.primaryDark = '#0d9488'  // teal-600
colors.background = '#f8fafc'   // slate-50
colors.surface = '#ffffff'
colors.text = '#0f172a'         // slate-900
colors.textSecondary = '#64748b' // slate-500
colors.border = '#e2e8f0'       // slate-200
colors.error = '#ef4444'        // red-500
colors.success = '#22c55e'      // green-500
colors.warning = '#f59e0b'      // amber-500

// Typography
fontSize.xs = 12, fontSize.sm = 14, fontSize.base = 16
fontSize.lg = 18, fontSize.xl = 20, fontSize['2xl'] = 24

// Spacing
spacing.xs = 4, spacing.sm = 8, spacing.md = 16
spacing.lg = 24, spacing.xl = 32

// Border Radius
radius.sm = 8, radius.md = 12, radius.lg = 16, radius.full = 9999
```

### 2.2 Shared Components (`components/`)

| Component | Props | Description |
|---|---|---|
| `Button` | `title`, `onPress`, `variant` (primary/secondary/outline/danger), `loading`, `disabled`, `icon` | Unified button with loading state |
| `Card` | `children`, `style`, `onPress` | Shadow + rounded corners + padding |
| `Modal` | `visible`, `onClose`, `title`, `children` | Bottom sheet or center modal with backdrop |
| `LoadingOverlay` | `visible`, `message` | Full-screen spinner with optional message |
| `EmptyState` | `icon`, `title`, `description`, `actionLabel`, `onAction` | "No data" placeholder |
| `Header` | `title`, `showBack`, `rightAction` | Navigation header |
| `Input` | `label`, `value`, `onChangeText`, `error`, `type` (text/password/email/phone) | Form input with validation display |
| `Badge` | `text`, `variant` (success/warning/error/info) | Status badge |
| `Skeleton` | `width`, `height`, `borderRadius` | Loading skeleton placeholder |
| `Avatar` | `uri`, `size`, `fallback` | User/location avatar with fallback |
| `SegmentedControl` | `options`, `selected`, `onChange` | Tab switcher (used in Tickets, Location Detail) |
| `RatingStars` | `rating`, `size`, `interactive`, `onChange` | Star rating display/input |

### 2.3 API Layer (`api/`)

**`axiosClient.ts`** — improved:
- Request interceptor: inject Bearer token from auth store
- Response interceptor:
  - 401 → attempt `POST /auth/refresh-token` with refreshToken → retry original request
  - If refresh fails → logout + redirect to login
  - SESSION_REVOKED code → set `isSessionRevoked` flag
  - ACCOUNT_LOCKED → force logout
- Remove verbose console.log (use proper logging if needed)

**`useApi.ts`** — custom hook:
```typescript
function useApi<T>(url: string, options?: { immediate?: boolean, deps?: any[] }) {
  return { data: T | null, loading: boolean, error: string | null, refetch: () => Promise<void> }
}
```

### 2.4 Auth Store (`store/useAuthStore.ts`)

Keep current structure, add:
- `refreshAccessToken()` action — calls `/auth/refresh-token` and updates tokens
- Proper error handling in `setAuth()`

---

## 3. Screen-by-Screen Plan

### Phase 1: Core Screens (priority)

#### 3.1 Home Dashboard (`(tabs)/index.tsx`)
- User avatar + greeting with member tier badge
- Weather widget (Open-Meteo API)
- Quick action buttons (5 items)
- Recommended locations FlatList (2-column)
- Pull-to-refresh
- **API:** `GET /user/profile`, `GET /user/recommendations/locations`

#### 3.2 Map (`(tabs)/map.tsx`)
- react-native-maps with OSM tile overlay
- 4 tile layer options (Voyager, Positron, OSM, Satellite)
- GPS location button
- Search bar with category filters
- Location markers with circular avatars
- Tap marker → detail panel → navigate to Location Detail
- OSRM routing (driving/foot profiles)
- **API:** `GET /locations`, `GET /user/favorites`

#### 3.3 Location Detail (`location/[id].tsx`)
- Hero image + basic info
- 3 tabs: Overview, Services, Reviews
- Favorite toggle
- Voucher claim
- Service → navigate to Booking
- **API:** `GET /locations/:id`, `GET /locations/:id/services`, `GET /locations/:id/reviews`, `GET /user/vouchers/location/:id`

#### 3.4 Booking (`booking/[serviceId].tsx`)
- Dynamic form based on service type (ticket/table/room)
- Date/time picker, quantity selector
- Voucher input
- Create booking → show VietQR payment
- Confirm transfer → success
- **API:** `POST /bookings`, `POST /bookings/:id/payments`, `POST /bookings/:id/*/confirm-transfer`

#### 3.5 Tickets (`(tabs)/tickets.tsx`)
- 3 segmented tabs: Tickets, Table passes, Room passes
- Ticket cards with status badges
- QR code modal (react-native-qrcode-svg)
- VietQR payment modal for pending bookings
- Cancel booking
- **API:** `GET /user/tickets`, `GET /bookings/table-reservations/pass`, `GET /bookings/room-reservations/pass`

### Phase 2: Supporting Screens

#### 3.6 Profile (`(tabs)/profile.tsx`)
- Avatar, name, email
- Stats (checkins, saved, vouchers)
- Login history
- Logout
- Navigate to: Saved Locations, Vouchers, Booking Reminders, Notifications, Leaderboard, Diary
- **API:** `GET /user/profile`, `GET /user/profile/login-history`

#### 3.7 History (`(tabs)/history.tsx`) — renamed from hidden tab
- Check-in history FlatList
- Status badges (verified/pending/failed)
- **API:** `GET /user/checkins`

#### 3.8 Saved Locations (`saved-locations.tsx`)
- Favorites list with unfavorite
- **API:** `GET /user/favorites`, `DELETE /user/favorites/:id`

#### 3.9 Vouchers (`vouchers.tsx`)
- Saved vouchers list
- **API:** `GET /user/vouchers/saved`

#### 3.10 Booking Reminders (`booking-reminders.tsx`)
- Upcoming reminders
- **API:** `GET /user/booking-reminders`

#### 3.11 SOS (`sos/index.tsx`)
- GPS location + big SOS button
- Call police (113)
- **API:** `POST /sos`

### Phase 3: New Screens

#### 3.12 Check-in (`checkin.tsx`)
- Get GPS location
- Auto-match nearby location within 80m
- Rate limit display (30s min interval)
- Night safety warning (22:00-05:00)
- **API:** `POST /user/checkins`

#### 3.13 Diary (`diary.tsx`)
- Travel diary entries with mood tracking
- Add/edit entries with photos
- Mood selector (happy/excited/neutral/sad/angry/tired)
- **API:** `GET /user/diary`, `POST /user/diary`, `PUT /user/diary/:id`

#### 3.14 Notifications (`notifications.tsx`)
- Push notification history
- Read/unread status
- **API:** `GET /user/notifications`

#### 3.15 Leaderboard (`leaderboard.tsx`)
- Check-in rankings by province/month
- **API:** `GET /user/leaderboard`

#### 3.16 AI Chat (`ai-chat.tsx`)
- Chat interface with AI assistant
- **API:** `POST /ai/chat` (currently returns maintenance message)

---

## 4. Navigation Structure

```
Stack (root)
├── login (screen)
├── register (screen)
├── forgot-password (screen)
├── (tabs)
│   ├── index → Home Dashboard
│   ├── map → Map
│   ├── tickets → My Tickets
│   ├── profile → Profile
│   └── history → Check-in History (hidden tab)
├── location/[id] → Location Detail
├── booking/[serviceId] → Booking Form
├── checkin → Check-in
├── saved-locations → Saved Locations
├── vouchers → Vouchers
├── booking-reminders → Booking Reminders
├── notifications → Notifications
├── diary → Travel Diary
├── leaderboard → Leaderboard
├── ai-chat → AI Chat
└── sos (modal) → SOS Emergency
```

---

## 5. File Structure

```
mobile/
├── app/
│   ├── _layout.tsx              # Root layout (keep, minor updates)
│   ├── login.tsx                # KEEP
│   ├── register.tsx             # KEEP
│   ├── forgot-password.tsx      # KEEP
│   ├── (tabs)/
│   │   ├── _layout.tsx          # Tab bar layout
│   │   ├── index.tsx            # Home Dashboard
│   │   ├── map.tsx              # Map
│   │   ├── tickets.tsx          # My Tickets
│   │   ├── profile.tsx          # Profile
│   │   └── history.tsx          # Check-in History
│   ├── location/[id].tsx        # Location Detail
│   ├── booking/[serviceId].tsx  # Booking Form
│   ├── checkin.tsx              # Check-in (NEW)
│   ├── saved-locations.tsx
│   ├── vouchers.tsx
│   ├── booking-reminders.tsx
│   ├── notifications.tsx        # NEW
│   ├── diary.tsx                # NEW
│   ├── leaderboard.tsx          # NEW
│   ├── ai-chat.tsx              # NEW
│   └── sos/
│       ├── _layout.tsx
│       └── index.tsx
├── api/
│   ├── axiosClient.ts           # Improved with token refresh
│   └── endpoints.ts             # API endpoint constants
├── components/
│   ├── Button.tsx
│   ├── Card.tsx
│   ├── Modal.tsx
│   ├── LoadingOverlay.tsx
│   ├── EmptyState.tsx
│   ├── Header.tsx
│   ├── Input.tsx
│   ├── Badge.tsx
│   ├── Skeleton.tsx
│   ├── Avatar.tsx
│   ├── SegmentedControl.tsx
│   └── RatingStars.tsx
├── constants/
│   └── theme.ts                 # Colors, typography, spacing
├── hooks/
│   └── useApi.ts                # Data fetching hook
├── store/
│   └── useAuthStore.ts          # Auth state (improved)
├── utils/
│   ├── vietqr.ts                # Keep
│   └── openingHours.ts          # Keep
└── types/
    └── index.ts                 # Shared TypeScript interfaces
```

---

## 6. Technical Decisions

| Decision | Choice | Reason |
|---|---|---|
| SDK version | Expo SDK 54 | User's phone requirement |
| State management | Zustand + AsyncStorage | Already working, lightweight |
| Maps | react-native-maps | Already installed, OSM tiles work |
| Styling | StyleSheet.create + theme constants | Performance, consistency |
| Navigation | Expo Router file-based | Already set up |
| QR codes | react-native-qrcode-svg | Already installed |
| HTTP client | Axios with interceptors | Already set up, needs improvement |
| Language | Vietnamese UI | User requirement |

---

## 7. Success Criteria

- [ ] All 19 screens functional and matching website behavior
- [ ] Token refresh works transparently (no forced logout on expiry)
- [ ] Consistent theme across all screens
- [ ] Shared components used everywhere (no duplicate styles)
- [ ] All API calls match backend endpoints correctly
- [ ] Data displayed matches what website shows
- [ ] No `any` types — all interfaces defined
- [ ] Vietnamese comments explaining "why"
- [ ] No emojis in source code
- [ ] Runs on Expo Go on real device
