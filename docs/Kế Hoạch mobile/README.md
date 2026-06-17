# Kế Hoạch Rebuild Mobile App

## Tổng quan
Xây dựng lại mobile app từ đầu với Expo SDK 54, Expo Router, TanStack Query, Zustand.

## Tech Stack
- **Framework:** Expo SDK 54 + React Native 0.81
- **Routing:** Expo Router v6 (file-based)
- **State:** Zustand (client) + TanStack Query (server)
- **Map:** react-native-maps + OSM tiles
- **API:** Axios + interceptors
- **Build:** EAS Build (APK)

## Các giai đoạn

| Giai đoạn | Nội dung | File | Ước tính |
|---|---|---|---|
| 1 | Scaffold project + EAS Build | [giai-doan-1-scaffold.md](giai-doan-1-scaffold.md) | 1 ngày |
| 2 | Map + API Layer | [giai-doan-2-map-api.md](giai-doan-2-map-api.md) | 3-4 ngày |
| 3 | Auth Flow (login, register, OTP, social) | giai-doan-3-auth.md | 2 ngày |
| 4 | Home + Navigation | giai-doan-4-home.md | 2 ngày |
| 5 | Location Detail + Booking | giai-doan-5-booking.md | 3 ngày |
| 6 | Tickets + QR Code | giai-doan-6-tickets.md | 2 ngày |
| 7 | Profile + Settings | giai-doan-7-profile.md | 1 ngày |
| 8 | Secondary Features (vouchers, history, saved, reminders) | giai-doan-8-secondary.md | 2 ngày |
| 9 | SOS + Notifications | giai-doan-9-sos.md | 1 ngày |
| 10 | Itinerary Planning | giai-doan-10-itinerary.md | 2 ngày |
| 11 | Polish + Testing | giai-doan-11-polish.md | 2 ngày |

**Tổng ước tính: ~20 ngày**

## Features từ app cũ cần rebuild

### Core (phải có)
- [ ] Auth: Login, Register, OTP, Forgot Password, Social Login (Google/Facebook)
- [ ] Home: Dashboard, weather, quick actions, recommendations
- [ ] Map: OSM tiles, markers, routing, GPS, check-in, search, categories
- [ ] Location Detail: Info, services, reviews, vouchers, booking
- [ ] Booking: Ticket, table, room + VietQR payment
- [ ] Tickets: QR code wallet, table pass, room pass
- [ ] Profile: Info, stats, avatar, member tier

### Secondary (nên có)
- [ ] History: Check-in history
- [ ] Saved Locations: Favorites
- [ ] Vouchers: Saved/claimed vouchers
- [ ] Booking Reminders: Upcoming reminders
- [ ] Diary: Travel diary entries
- [ ] Notifications: Push notifications

### Advanced (có thể làm sau)
- [ ] SOS: Emergency alert
- [ ] Itinerary: Trip planning
- [ ] AI Chat: Chatbot
- [ ] Leaderboard: Rankings
- [ ] Chat with Owner: Location chat

## API Endpoints (tổng hợp)

| Group | Endpoints | Auth |
|---|---|---|
| Auth | 10 endpoints | Public + Bearer |
| Locations | 8 endpoints | Optional |
| Bookings | 12 endpoints | Bearer + user role |
| User | 25+ endpoints | Bearer + user role |
| Geo | 2 endpoints | Public |
| SOS | 3 endpoints | Bearer + user role |
| AI | 2 endpoints | Bearer |
| Push | 2 endpoints | Bearer |
| Chat | 3 endpoints | Bearer |
| Itinerary | 6 endpoints | Bearer |

## Cách chạy app

### Expo Go (nhanh)
```bash
cd E:\TravelCheckinApp\mobile
npx expo start
# Quét QR bằng Expo Go
```

### Custom Dev Client (ổn định)
```bash
# Build APK lần đầu
eas build --profile development --platform android

# Chạy dev server
npx expo start --dev-client
# Quét QR bằng custom APK
```
