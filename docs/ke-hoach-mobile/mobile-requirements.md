# Yêu cầu Mobile App — User (Tourist) Role

> **Target:** Expo Router SDK 56
> **Nguồn:** Phân tích codebase Backend + Website

---

## 1. Framework & Dependencies

| Yêu cầu | Chi tiết |
|---------|---------|
| Expo SDK | ~56.0.8 |
| Expo Router | ~56.2.8 |
| React Native | 0.85.3 |
| TypeScript | ~6.0.3 |
| Maps | react-native-maps 1.27.2 |
| Location | expo-location ~56.0.15 |

**Packages cần thêm:**
- `axios`, `zustand`, `socket.io-client`
- `expo-camera`, `expo-haptics`, `expo-notifications`
- `expo-image-picker`, `expo-file-system`
- `dayjs`, `@react-native-async-storage/async-storage`

---

## 2. Screens cần xây dựng

| Screen | Route | Mô tả |
|--------|-------|-------|
| Login | `/login` | Email/password + Google |
| Register | `/register` | 2 bước: form + OTP |
| Forgot Password | `/forgot-password` | 3 bước: email → OTP → MK mới |
| Home | `/(tabs)/home` | Thời tiết, search, category, location cards |
| Map | `/(tabs)/map` | OSM, markers, routing, GPS |
| Location Detail | `/location/[id]` | Ảnh, thông tin, reviews, booking |
| Booking | `/booking/[serviceId]` | Time, quantity, voucher, payment |
| Payment | `/payment` | VietQR, confirm transfer |
| My Tickets | `/(tabs)/tickets` | QR codes, trạng thái |
| Profile | `/(tabs)/profile` | Stats, edit, avatar, logout |
| Check-ins | `/checkins` | Lịch sử check-in |
| Saved Locations | `/saved-locations` | Favorites |
| Diary | `/diary` | Nhật ký du lịch |
| Vouchers | `/vouchers` | Voucher đã lưu |
| Booking Reminders | `/booking-reminders` | Nhắc nhở |
| Notifications | `/notifications` | Thông báo push |
| SOS | `/sos` | Khẩn cấp + GPS |
| AI Chat | `/ai-chat` | Chat AI |
| Leaderboard | `/leaderboard` | Xếp hạng |

---

## 3. Luồng đặt chỗ

### Vé du lịch
1. Chọn địa điểm → xem services
2. Chọn loại vé + số lượng (tối đa 50)
3. Chọn ngày (hôm nay → +3 ngày)
4. Áp dụng voucher (tùy chọn)
5. Tạo booking → lấy payment → hiển thị VietQR
6. Xác nhận chuyển khoản → nhận mã vé

### Đặt bàn
1. Chọn địa điểm → xem POS tables
2. Chọn bàn trống + thời gian check-in
3. Nhập contact_name + contact_phone (bắt buộc)
4. Đặt trước món ăn (tùy chọn)
5. Tạo booking → thanh toán → xác nhận

### Đặt phòng
1. Chọn địa điểm → xem phòng
2. Chọn phòng + thời gian ở (1-90 ngày)
3. Tạo batch booking → thanh toán → xác nhận

---

## 4. Ràng buộc chính

| Ràng buộc | Giá trị |
|-----------|---------|
| Mật khẩu tối thiểu | 6 ký tự |
| OTP hết hạn | 5 phút |
| Khóa brute-force | 5 lần → 5 phút |
| Access token | 7 ngày |
| Refresh token | 30 ngày |
| Phiên đơn | Có |
| Check-in SĐT | `^0\d{9}$` |
| Phạm vi VN | lat 8-23.5, lng 102-110.5 |
| Tự động khớp | 80 mét |
| Khoảng cách tối đa | 500 mét |
| Tối đa vé/giao dịch | 50 |
| Đặt trước | Hôm nay + 3 ngày |
| Giữ bàn | 120 phút |
| Tự hủy | 60 phút sau check-in |
| Hoa hồng | 2.5% mặc định |

---

## 5. Non-functional

| Yêu cầu | Chi tiết |
|---------|---------|
| Ngôn ngữ UI | Tiếng Việt |
| Comments | Tiếng Việt (giải thích "tại sao") |
| Không emoji | Trong source code |
| Không `any` type | Interface rõ ràng |
| Styling | StyleSheet.create |
| Lists | FlatList |
| Performance | useMemo/useCallback |

---

*Tạo: 2026-06-07*
