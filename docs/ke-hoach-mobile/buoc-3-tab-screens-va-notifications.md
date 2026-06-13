# Giai đoạn 3: Tab Screens + Hệ thống Thông báo

> **Ngày tạo:** 2026-06-07
> **Trạng thái:** 🔄 CHƯA BẮT ĐẦU
> **Tổng thời gian ước tính:** ~200 phút (7 bước)
> **Thứ tự:** Backend → Website → Mobile

---

## Tổng quan

Giai đoạn 3 bao gồm 2 phần:
1. **Nâng cấp hệ thống thông báo** (Backend + Website) — làm trước
2. **Xây dựng Tab Screens cho Mobile** — làm sau

| Bước | Nội dung | Platform | Thời gian | Độ khó | Trạng thái |
|------|----------|----------|-----------|--------|------------|
| 3.1 | DB Migration: Thêm cột `type` | Backend | 15 phút | Dễ | ⬜ |
| 3.2 | Backend: Cập nhật INSERT + API | Backend | 30 phút | Trung bình | ⬜ |
| 3.3 | Website: Trang Notifications riêng | Website | 40 phút | Trung bình | ⬜ |
| 3.4 | Mobile: Home Screen | Mobile | 45 phút | Trung bình | ⬜ |
| 3.5 | Mobile: Profile Screen | Mobile | 35 phút | Trung bình | ⬜ |
| 3.6 | Mobile: Notifications Screen | Mobile | 25 phút | Dễ | ⬜ |
| 3.7 | Test toàn bộ | All | 15 phút | Dễ | ⬜ |

---

## Bước 3.1 — DB Migration: Thêm cột `type`

### Mô tả
Thêm cột `type` vào bảng `push_notifications` để phân loại thông báo thay vì parse body text.

### SQL Migration

```sql
-- Thêm cột type
ALTER TABLE push_notifications ADD COLUMN type VARCHAR(50) DEFAULT 'system';

-- Cập nhật dữ liệu hiện có
UPDATE push_notifications SET type = 'safety' WHERE title = 'Cảnh báo an toàn';
UPDATE push_notifications SET type = 'reminder' WHERE title = 'Nhắc lịch trình';
UPDATE push_notifications SET type = 'invite' WHERE title = 'Lời mời khám phá địa điểm';
UPDATE push_notifications SET type = 'booking' WHERE body LIKE '[booking:%';
UPDATE push_notifications SET type = 'voucher' WHERE body LIKE '[voucher:%';

-- Index cho query nhanh
CREATE INDEX idx_push_notifications_type ON push_notifications(type);
CREATE INDEX idx_push_notifications_target ON push_notifications(target_audience, target_user_id);
```

### Các giá trị type hợp lệ

| Type | Mô tả | Trigger |
|------|-------|---------|
| `safety` | Cảnh báo an toàn | Check-in ban đêm |
| `reminder` | Nhắc lịch trình | Cron job |
| `invite` | Lời mời địa điểm | User tự gửi |
| `booking` | Đặt chỗ | Xác nhận/hủy/hết hạn |
| `voucher` | Voucher | Mới/sắp hết hạn |
| `promotion` | Khuyến mãi | Admin broadcast |
| `system` | Hệ thống | Mặc định |

### File liên quan
- `backend/src/controllers/userController.ts` — Các hàm INSERT hiện tại
- `backend/src/controllers/adminController.ts` — Admin push notification
- `backend/src/services/adminService.ts` — `sendPushNotification()`

### Tiêu chí đạt
- [ ] Cột `type` tồn tại trong bảng `push_notifications`
- [ ] Dữ liệu hiện có được cập nhật đúng type
- [ ] Không lỗi khi query

---

## Bước 3.2 — Backend: Cập nhật INSERT + API

### Mô tả
Cập nhật tất cả INSERT vào `push_notifications` để set `type` đúng. Cập nhật API trả về `type`.

### Files cần sửa

#### 3.2.1 `backend/src/controllers/userController.ts`

**a) Night check-in safety warning (line ~763):**
```ts
// THÊM type = 'safety'
INSERT INTO push_notifications (title, body, target_audience, target_user_id, sent_by, type)
VALUES (?, ?, 'specific_user', ?, NULL, 'safety')
```

**b) Location invite (line ~3181):**
```ts
// THÊM type = 'invite'
INSERT INTO push_notifications (title, body, target_audience, target_user_id, sent_by, type)
VALUES (?, ?, 'specific_user', ?, ?, 'invite')
```

**c) getUserNotifications (line ~3017):**
```ts
// THÊM type vào SELECT
SELECT pn.notification_id, pn.title, pn.body, pn.type, pn.target_audience, ...
```

#### 3.2.2 `backend/src/services/adminService.ts`

**a) sendPushNotification (line ~31):**
```ts
// THÊM tham số type
async function sendPushNotification({ title, body, targetAudience, targetUserId, targetType, sentBy, type = 'system' }) {
  // INSERT với type
  INSERT INTO push_notifications (title, body, target_audience, target_user_id, sent_by, type)
  VALUES (?, ?, ?, ?, ?, ?)
}
```

#### 3.2.3 `backend/src/server.ts`

**a) Booking reminder cron (line ~491):**
```ts
// THÊM type = 'reminder'
INSERT INTO push_notifications (title, body, target_audience, target_user_id, sent_by, type)
SELECT ?, ?, 'specific_user', ?, NULL, 'reminder'
```

#### 3.2.4 `backend/src/controllers/adminController.ts`

**a) Admin manual push (line ~11647):**
```ts
// Truyền type từ request body
const { title, body, target_audience, target_user_id, type = 'promotion' } = req.body;
```

### API Response cập nhật

```json
{
  "success": true,
  "data": [
    {
      "notification_id": 1,
      "title": "Cảnh báo an toàn",
      "body": "Bạn vừa check-in vào khung giờ đêm.",
      "type": "safety",
      "target_audience": "specific_user",
      "target_user_id": 123,
      "created_at": "2026-06-07T10:00:00",
      "is_read": 0
    }
  ]
}
```

### Tiêu chí đạt
- [ ] Tất cả INSERT có `type` đúng
- [ ] API trả về `type` trong response
- [ ] Dữ liệu cũ được migrate đúng
- [ ] Không lỗi khi gọi API

---

## Bước 3.3 — Website: Trang Notifications riêng

### Mô tả
Tạo trang `/user/notifications` riêng biệt, thay thế dropdown panel nhỏ.

### Files cần tạo/sửa

#### 3.3.1 Tạo mới: `website/src/pages/User/Notifications.tsx`

```
┌─────────────────────────────────────────────┐
│ ← Thông báo                    [Đọc tất cả] │
├─────────────────────────────────────────────┤
│ Filter: [Tất cả] [Đặt chỗ] [Voucher] [Hệ thống] │
├─────────────────────────────────────────────┤
│                                             │
│ 📅 Đặt chỗ đã xác nhận                     │  ← type: booking
│    Nhà hàng ABC - 14:00 ngày mai            │
│    2 giờ trước                          🔵  │  ← Chưa đọc
│                                             │
│ ⚠️ Cảnh báo an toàn                         │  ← type: safety
│    Bạn vừa check-in lúc 23:30              │
│    1 ngày trước                             │  ← Đã đọc
│                                             │
│ 🎁 Voucher mới từ Resort XYZ               │  ← type: voucher
│    Giảm 20% cho đơn từ 500K                │
│    2 ngày trước                             │
│                                             │
│ 📍 Lời mời khám phá                        │  ← type: invite
│    Địa điểm: Bến Ninh Kiều                 │
│    3 ngày trước                             │
│                                             │
│ 📢 Thông báo hệ thống                      │  ← type: system
│    Ứng dụng sẽ bảo trì lúc 2:00 AM         │
│    5 ngày trước                             │
│                                             │
│         [Tải thêm...]                       │  ← Pagination
└─────────────────────────────────────────────┘
```

#### 3.3.2 Logic hiển thị theo type

```ts
const NOTIFICATION_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  booking:   { icon: '📅', color: '#3b82f6', label: 'Đặt chỗ' },
  voucher:   { icon: '🎁', color: '#f59e0b', label: 'Voucher' },
  safety:    { icon: '⚠️', color: '#ef4444', label: 'An toàn' },
  reminder:  { icon: '⏰', color: '#8b5cf6', label: 'Nhắc nhở' },
  invite:    { icon: '📍', color: '#10b981', label: 'Địa điểm' },
  promotion: { icon: '📢', color: '#ec4899', label: 'Khuyến mãi' },
  system:    { icon: '🔔', color: '#6b7280', label: 'Hệ thống' },
};
```

#### 3.3.3 Navigation khi nhấn

```ts
function handleNotificationClick(item: UserNotificationItem) {
  switch (item.type) {
    case 'booking':
    case 'reminder':
      navigate('/user/booking-reminders');
      break;
    case 'voucher':
      navigate('/user/vouchers');
      break;
    case 'invite':
      // Extract location_id từ body: [invite:location:123]
      const match = item.body?.match(/\[invite:location:(\d+)\]/);
      if (match) navigate(`/user/location/${match[1]}`);
      break;
    default:
      break;
  }
}
```

#### 3.3.4 Cập nhật Router: `website/src/App.tsx`

```tsx
<Route path="/user/notifications" element={<Notifications />} />
```

#### 3.3.5 Cập nhật UserLayout

- Bell icon → navigate to `/user/notifications` thay vì mở dropdown
- Vẫn giữ unread count badge trên bell icon
- Polling 15 giây để cập nhật unread count

### Tiêu chí đạt
- [ ] Trang `/user/notifications` hiển thị đúng
- [ ] Filter theo type hoạt động
- [ ] Nhấn item → navigate đúng
- [ ] Unread count badge hiển thị đúng
- [ ] "Đọc tất cả" hoạt động
- [ ] Responsive trên mobile web

---

## Bước 3.4 — Mobile: Home Screen (`app/(tabs)/index.tsx`)

### Mô tả
Màn hình chính sau đăng nhập với thời tiết, tìm kiếm, danh sách địa điểm.

### UI
```
┌─────────────────────────────────┐
│ Xin chào, Nguyễn Văn A!    🔔  │  ← Header + notification badge
├─────────────────────────────────┤
│ 🌤️ 32°C · Cần Thơ             │  ← Weather bar
├─────────────────────────────────┤
│ 🔍 Tìm kiếm địa điểm...       │  ← Search bar
├─────────────────────────────────┤
│ [Tất cả] [Khám phá] [Ăn uống] │  ← Category chips
│ [Lưu trú] [Cà phê] [Resort]   │
├─────────────────────────────────┤
│ ┌───────┐ ┌───────┐            │
│ │  IMG  │ │  IMG  │            │  ← FlatList 2 cột
│ │ Tên   │ │ Tên   │            │
│ │ ⭐ 4.5 │ │ ⭐ 4.8 │            │
│ └───────┘ └───────┘            │
└─────────────────────────────────┘
```

### API
```ts
locationApi.getLocations({ type, keyword, source: 'mobile' })
userApi.getRecommendations()
fetch('https://api.open-meteo.com/v1/forecast?latitude=10.0452&longitude=105.7469&current_weather=true')
```

### Dependencies: `dayjs`

### Ước tính: 45 phút

---

## Bước 3.5 — Mobile: Profile Screen (`app/(tabs)/profile.tsx`)

### Mô tả
Hồ sơ cá nhân với thống kê, chỉnh sửa, đăng xuất.

### UI
```
┌─────────────────────────────────┐
│ ┌─────────────────────────────┐ │
│ │      ẢNH BÌA               │ │
│ │    ┌──────┐                 │ │
│ │    │AVATAR│   Nguyễn Văn A  │ │
│ │    └──────┘   ⭐ Silver     │ │
│ └─────────────────────────────┘ │
│ ┌────────┬────────┬────────┐   │
│ │  12    │   5    │ 2.5M   │   │
│ │Check-in│ Đơn   │ Chi tiêu│   │
│ └────────┴────────┴────────┘   │
│ Họ tên: [Nguyễn Văn A      ]  │
│ SĐT:    [0901234567         ]  │
│ [💾 Lưu thay đổi]              │
│ [📷 Đổi avatar] [🚪 Đăng xuất] │
└─────────────────────────────────┘
```

### API
```ts
userApi.getProfile()
userApi.updateProfile({ full_name, phone, address })
userApi.uploadAvatar(formData)
```

### Dependencies: `expo-image-picker`

### Ước tính: 35 phút

---

## Bước 3.6 — Mobile: Notifications Screen (`app/notifications.tsx`)

### Mô tả
Màn hình thông báo dựa trên hệ thống đã nâng cấp (có cột `type`).

### UI
```
┌─────────────────────────────────┐
│ ← Thông báo        [Đọc tất cả]│
├─────────────────────────────────┤
│ [Tất cả] [Đặt chỗ] [Voucher]   │  ← Filter chips
├─────────────────────────────────┤
│ 📅 Đặt chỗ đã xác nhận         │  ← type: booking
│    Nhà hàng ABC - 14:00        │
│    2 giờ trước              🔵  │
├─────────────────────────────────┤
│ ⚠️ Cảnh báo an toàn             │  ← type: safety
│    Check-in lúc 23:30           │
│    1 ngày trước                 │
├─────────────────────────────────┤
│ 🎁 Voucher mới                  │  ← type: voucher
│    Giảm 20% tại Resort XYZ     │
│    2 ngày trước                 │
└─────────────────────────────────┘
```

### Logic type (dùng cột `type` từ DB, không parse text)

```ts
const NOTIFICATION_CONFIG = {
  booking:   { icon: 'calendar', color: '#3b82f6', label: 'Đặt chỗ' },
  voucher:   { icon: 'gift', color: '#f59e0b', label: 'Voucher' },
  safety:    { icon: 'warning', color: '#ef4444', label: 'An toàn' },
  reminder:  { icon: 'alarm', color: '#8b5cf6', label: 'Nhắc nhở' },
  invite:    { icon: 'location', color: '#10b981', label: 'Địa điểm' },
  promotion: { icon: 'megaphone', color: '#ec4899', label: 'Khuyến mãi' },
  system:    { icon: 'information-circle', color: '#6b7280', label: 'Hệ thống' },
};
```

### Navigation
```ts
function handlePress(item) {
  switch (item.type) {
    case 'booking': case 'reminder':
      router.push('/booking-reminders'); break;
    case 'voucher':
      router.push('/vouchers'); break;
    case 'invite':
      const match = item.body?.match(/\[invite:location:(\d+)\]/);
      if (match) router.push(`/location/${match[1]}`); break;
  }
}
```

### API
```ts
userApi.getNotifications()        // GET /api/user/notifications
userApi.markAllRead()             // POST /api/user/notifications/read-all
userApi.deleteAllNotifications()  // POST /api/user/notifications/delete-all
```

### Ước tính: 25 phút

---

## Bước 3.7 — Test toàn bộ

### Test Backend
| # | Test | Kết quả |
|---|------|---------|
| 1 | INSERT notification với type | type được lưu đúng |
| 2 | GET /api/user/notifications | trả về có trường type |
| 3 | Dữ liệu cũ đã migrate | type đúng cho từng loại |

### Test Website
| # | Test | Kết quả |
|---|------|---------|
| 1 | Mở trang /user/notifications | Hiển thị danh sách |
| 2 | Filter theo type | Lọc đúng |
| 3 | Nhấn item booking | Navigate đến booking-reminders |
| 4 | Nhấn item voucher | Navigate đến vouchers |
| 5 | "Đọc tất cả" | Chấm xanh biến mất |

### Test Mobile
| # | Test | Kết quả |
|---|------|---------|
| 1 | Tab Home | Thời tiết + danh sách địa điểm |
| 2 | Tab Profile | Thông tin + stats |
| 3 | Notifications | Danh sách + filter + navigate |
| 4 | Safe area | Không bị che tai thỏ/nút điều hướng |

---

## Dependencies tổng hợp

| Package | Platform | Bước | Lý do |
|---------|----------|------|-------|
| `dayjs` | Mobile | 3.4 | Format thời gian |
| `expo-image-picker` | Mobile | 3.5 | Chọn ảnh avatar |

---

## Thứ tự thực hiện

```
3.1 DB Migration (15p)
    ↓
3.2 Backend UPDATE (30p)
    ↓
3.3 Website Notifications Page (40p)
    ↓
3.4 Mobile Home Screen (45p)
    ↓
3.5 Mobile Profile Screen (35p)
    ↓
3.6 Mobile Notifications Screen (25p)
    ↓
3.7 Test toàn bộ (15p)
    ↓
✅ HOÀN THÀNH GIAI ĐOẠN 3
```

---

## Bước tiếp theo

**Giai đoạn 4: Map & Check-in** — Bản đồ OSM, GPS, check-in, chỉ đường

---

*Cập nhật: 2026-06-07*
