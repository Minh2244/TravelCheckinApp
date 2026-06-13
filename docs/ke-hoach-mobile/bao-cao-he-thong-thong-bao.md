# Báo cáo Điều tra: Hệ thống Thông báo cho User

> **Ngày:** 2026-06-07
> **Mục đích:** Điều tra trước khi xây dựng tính năng thông báo trên Mobile

---

## Tóm tắt

Hệ thống thông báo cho user **chưa hoàn thiện**. Website chỉ có dropdown panel (không có trang riêng), và chỉ có 4 loại thông báo thực sự gửi cho user.

---

## 1. Các loại thông báo user nhận được

### Hiện có (4 loại)

| # | Loại | Trigger | Tiêu đề | Nội dung | Tần suất |
|---|------|---------|---------|----------|----------|
| 1 | Cảnh báo an toàn | User check-in lúc 22:00-05:00 | "Cảnh báo an toàn" | "Bạn vừa check-in vào khung giờ đêm. Hãy chú ý an toàn." | Mỗi lần check-in đêm |
| 2 | Nhắc lịch trình | Cron job (6h trước check-in, 3h trước checkout) | "Nhắc lịch trình" | "Bạn có lịch check-in/checkout sắp tới tại {locationName}." | Tự động, chống trùng |
| 3 | Lời mời địa điểm | User tự gửi (self-notification) | "Lời mời khám phá địa điểm" | "{userName} vừa gửi lại địa điểm {locationName}." | Khi user nhấn nút |
| 4 | Admin broadcast | Admin gửi qua UI | Tùy chỉnh | Tùy chỉnh | Khi admin gửi |

### Chưa có (cần phát triển thêm)

| # | Loại | Mô tả | Ưu tiên |
|---|------|-------|---------|
| 1 | Xác nhận đặt chỗ | "Đặt chỗ tại {location} đã được xác nhận" | CAO |
| 2 | Hủy đặt chỗ | "Đặt chỗ tại {location} đã bị hủy" | CAO |
| 3 | Hết hạn đặt chỗ | "Đặt chỗ tại {location} đã hết hạn" | CAO |
| 4 | Voucher mới | "Bạn có voucher mới từ {location}" | TRUNG BÌNH |
| 5 | Voucher sắp hết hạn | "Voucher {code} sẽ hết hạn trong {days} ngày" | TRUNG BÌNH |
| 6 | Đánh giá được phản hồi | "Chủ địa điểm đã phản hồi đánh giá của bạn" | THẤP |
| 7 | Thông báo hệ thống | Bảo trì, cập nhật, v.v. | THẤP |

---

## 2. Kiến trúc hiện tại

### Database

```
push_notifications
├── notification_id (PK)
├── title
├── body
├── target_audience: 'all_users' | 'all_owners' | 'specific_user'
├── target_user_id (nếu specific_user)
├── sent_by
├── target_path
└── created_at

user_notification_reads
├── notification_id (FK)
├── user_id (FK)
└── read_at

user_notification_dismissed
├── notification_id (FK)
├── user_id (FK)
└── dismissed_at
```

### API hiện có

```
GET  /api/user/notifications            → Lấy tối đa 20 thông báo
POST /api/user/notifications/read-all   → Đánh dấu đã đọc tất cả
POST /api/user/notifications/delete-all → Xóa mềm tất cả (dismiss)
POST /api/user/notifications/location-invite → Tự gửi thông báo địa điểm
```

### Website UI hiện tại

- **Không có trang riêng** — chỉ là dropdown panel trong `UserLayout.tsx`
- **Polling 15 giây** — không có realtime (SSE/Socket.IO)
- **Tự động đánh dấu đã đọc** khi mở dropdown
- **Nhận diện loại thông báo** bằng keyword trong body/title (không có cột `type`)
- **Navigation**: nhấn thông báo booking → `/user/booking-reminders`, voucher → `/user/vouchers`

### FCM Push

- Topic-based: `user_{userId}` và `all_users`
- Không lưu device token vào DB
- Chỉ gửi FCM cho: cảnh báo đêm, nhắc lịch, lời mời địa điểm, admin broadcast

---

## 3. Vấn đề cần giải quyết

### 3.1 Không có cột `type` trong bảng `push_notifications`

Hiện tại nhận diện loại thông báo bằng cách parse body text:
```ts
// Website hiện tại
const isBooking = body.includes("[booking:") || title.match(/lich|dat truoc|don hang|huy|qua han/);
const isVoucher = body.includes("[voucher:") || title.match(/voucher|khuyen mai/);
```

**Đề xuất:** Thêm cột `type` vào bảng `push_notifications`:
```sql
ALTER TABLE push_notifications ADD COLUMN type VARCHAR(50) DEFAULT 'system';
-- Các giá trị: 'booking', 'voucher', 'safety', 'invite', 'system', 'promotion'
```

### 3.2 Không có realtime

SSE và Socket.IO **không được dùng** cho thông báo. Website polling 15 giây.

**Đề xuất cho Mobile:**
- Dùng FCM push notification (đã có) để hiển thị notification trên thiết bị
- Khi user mở app → gọi API lấy danh sách thông báo
- Không cần polling liên tục (tiết kiệm pin)

### 3.3 Chỉ lấy tối đa 20 thông báo

```sql
LIMIT 20  -- Không có phân trang
```

**Đề xuất:** Thêm phân trang hoặc infinite scroll.

### 3.4 Không có xóa từng item

Chỉ có "Xóa tất cả". Không có API xóa từng thông báo.

**Đề xuất:** Thêm `DELETE /api/user/notifications/:id`.

---

## 4. Đề xuất cho Mobile

### Màn hình Notifications trên Mobile

```
┌─────────────────────────────────┐
│ ← Thông báo        [Đọc tất cả]│
├─────────────────────────────────┤
│ 📅 Đặt chỗ đã xác nhận         │  ← Loại: booking
│    Nhà hàng ABC - 14:00         │
│    2 giờ trước              🔵  │  ← Chưa đọc
├─────────────────────────────────┤
│ ⚠️ Cảnh báo an toàn             │  ← Loại: safety
│    Bạn vừa check-in lúc 23:30   │
│    1 ngày trước                 │  ← Đã đọc
├─────────────────────────────────┤
│ 🎁 Voucher mới                  │  ← Loại: voucher
│    Giảm 20% tại Resort XYZ      │
│    2 ngày trước                 │
├─────────────────────────────────┤
│ 📍 Lời mời khám phá            │  ← Loại: invite
│    Địa điểm: Bến Ninh Kiều      │
│    3 ngày trước                 │
└─────────────────────────────────┘
```

### Xử lý notification type trên Mobile

```ts
// Nhận diện loại thông báo từ body text (giống website)
function getNotificationType(item: UserNotificationItem): string {
  const body = item.body || '';
  const title = item.title || '';

  if (body.includes('[booking:')) return 'booking';
  if (body.includes('[invite:location:')) return 'invite';
  if (body.includes('[voucher:')) return 'voucher';
  if (title.includes('Cảnh báo an toàn')) return 'safety';
  if (title.includes('Nhắc lịch trình')) return 'reminder';
  return 'system';
}

// Icon theo loại
const NOTIFICATION_ICONS: Record<string, string> = {
  booking: 'calendar',
  invite: 'location',
  voucher: 'gift',
  safety: 'warning',
  reminder: 'alarm',
  system: 'information-circle',
};
```

### Navigation khi nhấn thông báo

```ts
function handleNotificationPress(item: UserNotificationItem) {
  const type = getNotificationType(item);

  switch (type) {
    case 'booking':
    case 'reminder':
      router.push('/booking-reminders');
      break;
    case 'voucher':
      router.push('/vouchers');
      break;
    case 'invite':
      // Extract location_id từ body: [invite:location:123]
      const match = item.body?.match(/\[invite:location:(\d+)\]/);
      if (match) router.push(`/location/${match[1]}`);
      break;
    default:
      break;
  }
}
```

---

## 5. Kết luận

| Khía cạnh | Trạng thái | Cần làm |
|-----------|------------|---------|
| Backend API | ✅ Hoạt động | Bổ sung type column, phân trang |
| FCM Push | ✅ Hoạt động | Không cần sửa |
| Website UI | ⚠️ Cơ bản | Cần cải thiện (dropdown → trang riêng) |
| Mobile UI | ⬜ Chưa có | Xây dựng mới |
| Notification types | ⚠️ Parse text | Thêm cột type vào DB |
| Realtime | ⚠️ Polling 15s | Dùng FCM cho mobile |

### Khuyến nghị

1. **Mobile:** Xây dựng màn hình notifications với logic nhận diện type từ body text (giống website) — không cần sửa backend
2. **Tương lai:** Thêm cột `type` vào bảng `push_notifications` để dễ query và filter
3. **Tương lai:** Thêm API xóa từng thông báo
4. **Tương lai:** Thêm phân trang (cursor-based hoặc offset)

---

*Điều tra: 2026-06-07*
