# KẾ HOẠCH REBUILD MOBILE APP - Chi tiết

## TỔNG QUAN
Rebuild toàn bộ giao diện mobile cho User role, đồng bộ 100% với website.
Design system: Earth & Ether (Deep Forest Green + Champagne Gold + Sand).

## TRẠNG THÁI HIỆN TẠI
- Auth: HOÀN THÀNH (login, register, OAuth, token refresh)
- Home: HOÀN THÀNH (bento grid, carousel, quick actions, stats)
- 10 screens: PLACEHOLDER (cần làm UI)
- API layer: CẦN BỔ SUNG endpoints
- Types: CẦN BỔ SUNG interfaces

---

## GIAI ĐOẠN 1: NỀN TẢNG API + TYPES (làm trước)

### 1.1 Bổ sung types/index.ts
- NotificationItem
- BookingReminderItem
- GroupInfo, GroupMember, GroupCheckinItem
- ItineraryItem, ItineraryLocation
- CreateBookingPayload
- BookingPaymentResponse
- SosPayload
- AiChatMessage

### 1.2 Bổ sung userApi.ts
- GET /user/checkins
- POST /user/checkins
- DELETE /user/checkins/:id
- GET /user/favorites
- PATCH /user/favorites/:id
- DELETE /user/favorites/:id
- GET /user/vouchers/saved
- GET /user/vouchers/location/:id
- POST /user/vouchers/:id/claim
- GET /user/diary
- POST /user/diary
- DELETE /user/diary/:id
- GET /user/itineraries
- POST /user/itineraries
- GET /user/groups
- POST /user/groups/create
- POST /user/groups/join
- POST /user/groups/leave
- GET /user/booking-reminders
- GET /user/notifications
- POST /user/notifications/read-all
- POST /user/reviews
- POST /user/reviews/upload
- POST /user/reports/location
- GET /user/profile
- PUT /user/profile
- POST /user/profile/avatar
- GET /user/tickets
- GET /user/recommendations/locations

### 1.3 Bổ sung bookingApi.ts
- POST /bookings (create)
- POST /bookings/:id/payments
- POST /bookings/:id/tickets/confirm-transfer
- POST /bookings/:id/tables/confirm-transfer
- POST /bookings/:id/rooms/confirm-transfer
- POST /bookings/:id/tables/preorder
- POST /bookings/:id/cancel

### 1.4 Bổ sung locationApi.ts
- GET /locations/:id/tickets/realtime-stock
- GET /locations/:id/pos/areas
- GET /locations/:id/pos/tables

### 1.5 Tạo mới sosApi.ts
- POST /sos
- POST /sos/ping
- POST /sos/stop

### 1.6 Tạo mới aiApi.ts
- POST /ai/chat
- GET /ai/history

---

## GIAI ĐOẠN 2: MAP SCREEN (quan trọng sau Home)

### UI Components
- Full screen OpenStreetMap (WebView Leaflet)
- Search overlay (glassmorphism)
- Location markers color-coded by type
- My location button (GPS)
- Filter chips (all/food/tourist/hotel)
- Bottom sheet với 3 tab:
  - Tab "Dia diem": search + filter + location list
  - Tab "Chi tiet": selected location info
  - Tab "Danh gia": reviews

### API calls
- GET /locations (all)
- GET /user/favorites
- POST /user/checkins (GPS check-in)
- GET /geo/search, /geo/reverse

### Design reference
- luxury_map_discovery/code.html

---

## GIAI ĐOẠN 3: LOCATION DETAIL

### UI Components
- Hero image với gradient overlay
- Name + rating + type badge
- Action buttons: Chi duong | Luu | Chia se
- Tabs: Tong quan | Danh gia | Gioi thieu
- Voucher section (claim)
- Nut "Dat truoc" → booking

### API calls
- GET /locations/:id
- GET /locations/:id/services
- GET /locations/:id/reviews
- GET /user/favorites + PATCH toggle
- GET /user/vouchers/location/:id + POST claim
- POST /user/reviews + upload

### Design reference
- luxury_location_details/code.html

---

## GIAI ĐOẠN 4: MY TICKETS

### UI Components
- 3 tabs: Du lich | An uong | Khach san
- Tab Du lich: boarding-pass card + QR code
- Tab An uong: table reservation card + QR
- Tab Khach san: room booking card + QR
- Status badges (unused/used/expired/pending/confirmed)

### API calls
- GET /user/tickets (tourist)
- GET /bookings/table-reservations/pass (food)
- GET /bookings/room-reservations/pass (hotel)
- POST /bookings/:id/cancel

### Design reference
- luxury_my_tickets/code.html

---

## GIAI ĐOẠN 5: BOOKING FLOW

### UI Components (thay doi theo location_type)
- Restaurant: chon ngay/gio + chon ban + dat do an + lien he + voucher + VietQR
- Hotel: chon ngay check-in/out + chon phong + lien he + voucher + VietQR
- Tourist: chon loai ve + so luong + ngay + voucher + VietQR

### API calls
- GET /locations/:id/services
- GET /locations/:id/pos/tables (restaurant)
- GET /locations/:id/tickets/realtime-stock (tourist)
- GET /user/vouchers/saved
- POST /bookings
- POST /bookings/:id/payments
- POST /bookings/:id/tickets/confirm-transfer
- POST /bookings/:id/tables/confirm-transfer
- POST /bookings/:id/rooms/confirm-transfer

---

## GIAI ĐOẠN 6: PROFILE + SUB-SCREENS

### 6.1 Profile (tabs/profile.tsx)
- Avatar (upload)
- Ten, email, SDT (editable)
- Menu items → sub-screens
- Nut dang xuat

### 6.2 Diary (diary.tsx)
- Stats: tong luot di, so dia diem
- Timeline (vertical line + dot markers)
- Mood selector (6 moods)
- Form viet nhat ky

### 6.3 Saved (saved.tsx)
- Card list: anh, ten, rating, dia chi
- Nut bo luu (heart)

### 6.4 Vouchers (vouchers.tsx)
- Tabs: Tat ca | Con hieu luc | Het han
- Card: gia tri, campaign, ngay

### 6.5 SOS (sos.tsx)
- Nut SOS lon (do, pulsing)
- GPS ping moi 20 giay
- Trang thai

### 6.6 AI Chat (ai-chat.tsx)
- Chat bubbles
- Input + send

### 6.7 Itinerary (itinerary.tsx)
- Form tao lich trinh
- Danh sach da luu

### 6.8 Groups (groups.tsx)
- Tao/tham gia nhom
- Ma nhom (6 ky tu)
- Danh sach thanh vien

### 6.9 Reminders (reminders.tsx)
- Stats: tong, sap dien ra, hoan thanh, huy
- Card nhac lich

---

## THU TỰ ƯU TIÊN
1. API + Types (nen tang)
2. Map (dung nhieu sau Home)
3. Location Detail (can truoc Booking)
4. My Tickets (hien thi bookings)
5. Booking Flow (core feature)
6. Profile + Diary + Saved + Vouchers
7. SOS + AI Chat + Itinerary + Groups + Reminders

## THOI GIAN UOC TINH
- Giai doan 1: 1 ngay
- Giai doan 2: 2 ngay
- Giai doan 3: 1 ngay
- Giai doan 4: 1 ngay
- Giai doan 5: 2 ngay
- Giai doan 6: 2 ngay
- Tong: ~9 ngay
