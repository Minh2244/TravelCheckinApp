# Giai đoạn 5: Tiện ích User, Hồ sơ cá nhân & An toàn

Tài liệu này gom toàn bộ cụm tiện ích cá nhân của User trên Website sang Mobile. Đây là phase làm cho app thật sự “sống” như một ứng dụng du lịch hoàn chỉnh, thay vì chỉ có bản đồ và đặt dịch vụ.

## 1. Phạm vi chính thức

Giai đoạn 5 bao phủ các chức năng Website User sau:
- `website/src/pages/User/UserDashboard.tsx`
- `website/src/pages/User/Profile.tsx`
- `website/src/pages/User/SavedLocations.tsx`
- `website/src/pages/User/Checkins.tsx` (bao gồm nhật ký hành trình / diary)
- `website/src/pages/User/History.tsx`
- `website/src/pages/User/BookingReminders.tsx`
- `website/src/pages/User/Vouchers.tsx`
- `website/src/pages/User/Sos.tsx`
- Notification inbox trong `website/src/layouts/UserLayout.tsx`

Không thuộc Giai đoạn 5:
- Bản đồ và chi tiết địa điểm
- Booking / payment / wallet
- AI chat / itineraries

## 1.1. Quy tắc bắt buộc cho Giai đoạn 5

- Tất cả màn profile, saved, checkins, diary, history, reminders, vouchers, notifications, SOS phải xử lý `SafeArea` tuyệt đối cho header, nút back, tab con, action bar và nút đáy.
- Các danh sách dài phải chừa đúng `insets.bottom` để item cuối và nút thao tác cuối không bị thanh điều hướng ảo che mất.
- Điều hướng giữa `(tabs)/profile` và các màn con như `saved`, `history`, `vouchers`, `sos` phải có pattern quay lại nhất quán trên toàn app.
- Riêng màn SOS phải bảo đảm trạng thái khẩn cấp, nút dừng SOS và thông tin vị trí luôn hiển thị an toàn, không bị che bởi notch hay gesture bar.

## 2. Đối chiếu chức năng theo cụm

| Nhóm chức năng | Nguồn Website | Màn hình Mobile dự kiến |
|---|---|---|
| Dashboard nhanh | `UserDashboard.tsx` | `mobile/app/(tabs)/index.tsx` mở rộng |
| Hồ sơ cá nhân | `Profile.tsx` | `mobile/app/(tabs)/profile.tsx` |
| Địa điểm đã lưu | `SavedLocations.tsx` | `mobile/app/profile/saved.tsx` |
| Check-ins | `Checkins.tsx` | `mobile/app/profile/checkins.tsx` |
| Nhật ký hành trình | `Checkins.tsx` | nằm trong `mobile/app/profile/checkins.tsx` hoặc `mobile/app/profile/diary.tsx` |
| Lịch sử | `History.tsx` | `mobile/app/profile/history.tsx` |
| Nhắc lịch booking | `BookingReminders.tsx` | `mobile/app/profile/reminders.tsx` |
| Voucher của tôi | `Vouchers.tsx` | `mobile/app/profile/vouchers.tsx` |
| Thông báo | `UserLayout.tsx` | `mobile/app/(tabs)/notifications.tsx` |
| SOS khẩn cấp | `Sos.tsx` | `mobile/app/profile/sos.tsx` |

## 3. Bản vẽ giao diện theo cụm trải nghiệm

### 3.1. Trung tâm tiện ích cá nhân
```text
+---------------------------------------------------+
|  Xin chào, Minh                                   |
|  [ Hồ sơ ] [ Vé ] [ Voucher ]                     |
+===================================================+
|  [ Đã lưu ] [ Check-in ] [ Lịch sử ]              |
|  [ Nhắc lịch ] [ Thông báo ] [ SOS ]              |
|---------------------------------------------------|
|  Hoạt động gần đây                                |
|  - Đã check-in tại Bờ Kè Sông Hậu                 |
|  - Có 2 vé chưa sử dụng                           |
|  - Có 1 nhắc lịch trong hôm nay                   |
+---------------------------------------------------+
```

### 3.2. Danh sách địa điểm đã lưu
```text
+---------------------------------------------------+
|  [ < ] Địa điểm đã lưu                            |
+===================================================+
|  [ Ảnh ] Cafe Trung Nguyên                        |
|  📍 Cái Răng - Cần Thơ                             |
|  [ Xem chi tiết ] [ Bỏ lưu ]                      |
|---------------------------------------------------|
|  [ Ảnh ] Bờ Kè Sông Hậu                           |
|  📍 Ninh Kiều - Cần Thơ                            |
|  [ Xem chi tiết ] [ Bỏ lưu ]                      |
+---------------------------------------------------+
```

### 3.3. Màn hình SOS đang hoạt động
```text
+---------------------------------------------------+
|  [ < ] SOS khẩn cấp                               |
+===================================================+
|  🔴 SOS đang hoạt động                             |
|  Vị trí hiện tại của bạn đang được gửi liên tục   |
|  tới hệ thống quản trị.                           |
|---------------------------------------------------|
|  Kinh độ: 105.xxx                                 |
|  Vĩ độ: 10.xxx                                    |
|  Mô tả: Tôi cần hỗ trợ khẩn cấp                   |
+===================================================+
|  [ Dừng gửi SOS ]                                 |
+---------------------------------------------------+
```

## 4. Tái sử dụng Backend API và Database

### 4.1. API phải tái sử dụng

- `GET /api/user/profile`
- `PUT /api/user/profile`
- `POST /api/user/profile/avatar`
- `POST /api/user/profile/background`
- `GET /api/user/profile/login-history`
- `GET /api/user/favorites`
- `PATCH /api/user/favorites/:locationId`
- `DELETE /api/user/favorites/:locationId`
- `GET /api/user/checkins`
- `POST /api/user/checkins`
- `POST /api/user/checkins/photo`
- `DELETE /api/user/checkins/:id`
- `GET /api/user/diary`
- `POST /api/user/diary`
- `DELETE /api/user/diary/:id`
- `GET /api/user/booking-reminders`
- `GET /api/user/vouchers/saved`
- `GET /api/user/vouchers/location/:locationId`
- `POST /api/user/vouchers/:id/claim`
- `GET /api/user/notifications`
- `POST /api/user/notifications/read-all`
- `POST /api/user/notifications/delete-all`
- `POST /api/sos`
- `POST /api/sos/ping`
- `POST /api/sos/stop`
- `POST /api/push/device-tokens`
- `DELETE /api/push/device-tokens/:deviceId`

### 4.2. Bảng dữ liệu liên quan

- `users`
- `user_preferences`
- `favorite_locations`
- `checkins`
- `user_diary`
- `user_voucher_wallet`
- `voucher_usage_history`
- `push_notifications`
- `user_notification_reads`
- `user_notification_dismissed`
- `sos_alerts`
- `login_history`

## 5. Lộ trình triển khai chia phân hệ

### 5.1. Phân hệ 1: Dashboard User hoàn chỉnh
- **Độ ưu tiên:** Ưu tiên Số 1
- **Độ khó:** 🔥🔥

#### Code ở đâu?
- `mobile/app/(tabs)/index.tsx`
- `mobile/api/userApi.ts`
- `mobile/components/dashboard/*`

#### Việc phải làm:
- Mở rộng Home hiện tại thành dashboard cá nhân.
- Kéo đúng số liệu: check-ins, saved, vouchers, reminders.
- Cho deep-link sang các màn hình utility.

### 5.2. Phân hệ 2: Hồ sơ cá nhân & saved locations
- **Độ ưu tiên:** Ưu tiên Số 2
- **Độ khó:** 🔥🔥🔥

#### Code ở đâu?
- `mobile/app/(tabs)/profile.tsx`
- `mobile/app/profile/saved.tsx`
- `mobile/hooks/useProfile.ts`

#### Việc phải làm:
- Xem / sửa hồ sơ.
- Upload avatar, background.
- Danh sách địa điểm đã lưu.
- Bỏ lưu hoặc mở lại chi tiết địa điểm.

### 5.3. Phân hệ 3: Check-ins, history, booking reminders
- **Độ ưu tiên:** Ưu tiên Số 3
- **Độ khó:** 🔥🔥🔥

#### Code ở đâu?
- `mobile/app/profile/checkins.tsx`
- `mobile/app/profile/history.tsx`
- `mobile/app/profile/reminders.tsx`

#### Việc phải làm:
- Hiển thị check-in đã có.
- Cho tạo check-in mới khi đi từ địa điểm đủ điều kiện.
- Cho user viết, sửa lại theo kiểu upsert, và xóa nhật ký hành trình gắn với check-in như Website đang làm.
- Gom lịch sử hoạt động chính của user.
- Hiển thị reminder gần đến giờ.

### 5.4. Phân hệ 4: Voucher, notifications, push
- **Độ ưu tiên:** Ưu tiên Số 4
- **Độ khó:** 🔥🔥🔥

#### Code ở đâu?
- `mobile/app/profile/vouchers.tsx`
- `mobile/app/(tabs)/notifications.tsx`
- `mobile/services/notificationService.ts`

#### Việc phải làm:
- Danh sách voucher đã lưu.
- Nhận và đọc thông báo.
- Đăng ký token thiết bị.
- Đồng bộ thông báo booking/voucher/realtime với backend.

### 5.5. Phân hệ 5: SOS an toàn
- **Độ ưu tiên:** Ưu tiên Số 5
- **Độ khó:** 🔥🔥🔥🔥

#### Code ở đâu?
- `mobile/app/profile/sos.tsx`
- `mobile/hooks/useSosLive.ts`

#### Việc phải làm:
- Gửi SOS mới.
- Ping vị trí định kỳ khi SOS còn mở.
- Dừng SOS đúng luồng.
- Hiển thị trạng thái trực tiếp cho user biết SOS còn đang hoạt động hay đã dừng.

## 6. Tiêu chí nghiệm thu

1. User sửa hồ sơ thành công và đồng bộ lại được trên Mobile.
2. Danh sách saved locations giống Website và thao tác bỏ lưu hoạt động đúng.
3. Check-ins, history, reminders hiển thị đúng dữ liệu backend.
4. Nhật ký hành trình trong Check-ins hoạt động đúng: tạo, xem, cập nhật, xóa.
5. Voucher đã lưu hiển thị đầy đủ và không lệch trạng thái.
6. Notification inbox đọc/xóa được và có push token registration.
7. SOS hoạt động bền vững, có ping liên tục và dừng an toàn.

## 7. Rủi ro và phụ thuộc

- SOS và push notification chỉ test đầy đủ trên thiết bị thật.
- Notification state dễ lệch nếu vừa dùng SSE vừa dùng polling mà không thống nhất source of truth.
- Cần dùng đúng tên bảng schema hiện tại như `favorite_locations`, `user_diary`, `user_notification_reads`, `user_notification_dismissed`.
