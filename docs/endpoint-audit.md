# Endpoint Audit Report

Generated: 2026-02-05T04:35:28.788Z

## Summary

- Backend endpoints found: 237
- Website axios calls found: 188
- Website axios calls matched to backend: 188
- Website axios calls with no backend match: 0
- Backend endpoints with no website caller: 52
- Website fetch calls found: 5
- External fetch calls: 5
- Non-external fetch calls (review manually): 0

## Website calls with no backend match

(none)

## Backend endpoints with no website caller

- GET /api/admin/ai/logs (from backend/src/routes/adminRoutes.ts)
- GET /api/admin/backgrounds/history (from backend/src/routes/adminRoutes.ts)
- POST /api/admin/backgrounds/use/:id (from backend/src/routes/adminRoutes.ts)
- POST /api/admin/payments/:id/confirm (from backend/src/routes/adminRoutes.ts)
- GET /api/admin/profile/avatar/history (from backend/src/routes/adminRoutes.ts)
- GET /api/admin/profile/avatar/history/:avatarId (from backend/src/routes/adminRoutes.ts)
- POST /api/admin/profile/avatar/use/:avatarId (from backend/src/routes/adminRoutes.ts)
- GET /api/admin/users/:id/search-history (from backend/src/routes/adminRoutes.ts)
- GET /api/admin/vouchers/:id/usage-history (from backend/src/routes/adminRoutes.ts)
- POST /api/ai/chat (from backend/src/routes/aiRoutes.ts)
- GET /api/ai/history (from backend/src/routes/aiRoutes.ts)
- GET /api/auth/background/files/:id (from backend/src/routes/authRoutes.ts)
- POST /api/bookings (from backend/src/routes/bookingRoutes.ts)
- GET /api/locations (from backend/src/routes/locationRoutes.ts)
- GET /api/locations/:id (from backend/src/routes/locationRoutes.ts)
- GET /api/locations/search (from backend/src/routes/locationRoutes.ts)
- GET /api/owner/me (from backend/src/routes/ownerRoutes.ts)
- GET /api/owner/vouchers/:id/usage-history (from backend/src/routes/ownerRoutes.ts)
- POST /api/push/device-tokens (from backend/src/routes/pushRoutes.ts)
- DELETE /api/push/device-tokens/:deviceId (from backend/src/routes/pushRoutes.ts)
- POST /api/sos (from backend/src/routes/sosRoutes.ts)
- POST /api/sos/ping (from backend/src/routes/sosRoutes.ts)
- POST /api/sos/stop (from backend/src/routes/sosRoutes.ts)
- GET /api/users/booking-reminders (from backend/src/routes/userRoutes.ts)
- GET /api/users/checkins (from backend/src/routes/userRoutes.ts)
- POST /api/users/checkins (from backend/src/routes/userRoutes.ts)
- DELETE /api/users/checkins/:id (from backend/src/routes/userRoutes.ts)
- POST /api/users/checkins/photo (from backend/src/routes/userRoutes.ts)
- GET /api/users/created-locations (from backend/src/routes/userRoutes.ts)
- DELETE /api/users/created-locations/:id (from backend/src/routes/userRoutes.ts)
- PATCH /api/users/created-locations/:id (from backend/src/routes/userRoutes.ts)
- GET /api/users/diary (from backend/src/routes/userRoutes.ts)
- POST /api/users/diary (from backend/src/routes/userRoutes.ts)
- GET /api/users/favorites (from backend/src/routes/userRoutes.ts)
- DELETE /api/users/favorites/:locationId (from backend/src/routes/userRoutes.ts)
- PATCH /api/users/favorites/:locationId (from backend/src/routes/userRoutes.ts)
- GET /api/users/groups (from backend/src/routes/userRoutes.ts)
- POST /api/users/groups/create (from backend/src/routes/userRoutes.ts)
- POST /api/users/groups/join (from backend/src/routes/userRoutes.ts)
- POST /api/users/groups/leave (from backend/src/routes/userRoutes.ts)
- GET /api/users/itineraries (from backend/src/routes/userRoutes.ts)
- POST /api/users/itineraries (from backend/src/routes/userRoutes.ts)
- GET /api/users/leaderboard (from backend/src/routes/userRoutes.ts)
- GET /api/users/profile (from backend/src/routes/userRoutes.ts)
- PUT /api/users/profile (from backend/src/routes/userRoutes.ts)
- POST /api/users/profile/avatar (from backend/src/routes/userRoutes.ts)
- GET /api/users/profile/login-history (from backend/src/routes/userRoutes.ts)
- GET /api/users/recommendations/locations (from backend/src/routes/userRoutes.ts)
- POST /api/users/reports/location (from backend/src/routes/userRoutes.ts)
- POST /api/users/reviews (from backend/src/routes/userRoutes.ts)
- POST /api/users/reviews/upload (from backend/src/routes/userRoutes.ts)
- GET /api/users/vouchers (from backend/src/routes/userRoutes.ts)

## External fetch calls (expected)

- https://router.project-osrm.org/route/v1/${routeProfile}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson (from website/src/pages/User/LocationDetail.tsx)
- https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=6&q=${encodeURIComponent(
            query,
          )} (from website/src/pages/User/UserMap.tsx)
- https://router.project-osrm.org/route/v1/${routeProfile}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&alternatives=true (from website/src/pages/User/UserMap.tsx)
- https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${accessToken} (from website/src/pages/Auth/FacebookCallback.tsx)
- https://www.googleapis.com/oauth2/v2/userinfo (from website/src/pages/Auth/GoogleCallback.tsx)

## Non-external fetch calls (review)

(none)
