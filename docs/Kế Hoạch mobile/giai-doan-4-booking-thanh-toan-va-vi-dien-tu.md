# Giai đoạn 4: Booking, Thanh toán VietQR & Ví điện tử của User

Tài liệu này tách riêng toàn bộ cụm chức năng đặt dịch vụ của User trên Website sang Mobile. Mục tiêu là **tái sử dụng 100% Backend hiện tại**, giữ nguyên nghiệp vụ booking phòng, booking bàn, booking vé, xác nhận chuyển khoản, ví vé, thẻ pass và lịch sử giao dịch liên quan.

## 1. Phạm vi chính thức

Giai đoạn 4 bao phủ các chức năng Website User sau:
- `website/src/pages/User/BookingPage.tsx`
- `website/src/pages/User/TicketCart.tsx`
- `website/src/pages/User/MyTickets.tsx`
- `website/src/pages/User/TableBookingPass.tsx`
- `website/src/pages/User/RoomBookingPass.tsx`
- `website/src/components/LocationChatBubble.tsx` ở vai trò hỗ trợ trong luồng booking
- Một phần logic gọi API trong:
  - `website/src/api/bookingApi.ts`
  - `website/src/api/locationApi.ts`
  - `website/src/utils/vietqr.ts`
  - `website/src/types/booking.types.ts`

Ngoài phạm vi của Giai đoạn 4:
- Dashboard tổng quan
- Saved locations
- Check-ins / history
- Vouchers tổng hợp
- SOS
- AI chat / itineraries

## 1.1. Quy tắc bắt buộc cho Giai đoạn 4

- Mọi màn booking, payment, wallet, pass đều phải xử lý `SafeArea` tuyệt đối cho header, nút back, QR card, sticky summary và CTA đáy.
- Nút xác nhận thanh toán / xác nhận chuyển khoản / hủy booking không được nằm dưới home indicator.
- Sau các luồng hoàn tất như tạo booking thành công, thanh toán thành công, confirm transfer xong, bắt buộc dùng `router.replace()` hoặc `router.dismissAll()` đúng chỗ để chặn back-loop.
- Mọi route từ `location detail -> booking -> payment -> wallet/pass` phải chạy mạch lạc, không có màn rơi vào trạng thái cụt điều hướng.

## 2. Đối chiếu theo luồng nghiệp vụ thực tế

| Luồng | Nguồn Website | Màn hình Mobile dự kiến |
|---|---|---|
| Đặt vé du lịch | `BookingPage.tsx`, `TicketCart.tsx` | `mobile/app/booking/ticket/[serviceId].tsx` |
| Đặt bàn nhà hàng / cafe | `BookingPage.tsx`, `TableBookingPass.tsx` | `mobile/app/booking/table/[serviceId].tsx` |
| Đặt phòng khách sạn / resort | `BookingPage.tsx`, `RoomBookingPass.tsx` | `mobile/app/booking/room/[serviceId].tsx` |
| Thanh toán chuyển khoản VietQR | `BookingPage.tsx`, `TicketCart.tsx` | `mobile/app/booking/payment/[bookingId].tsx` |
| Ví vé của tôi | `MyTickets.tsx` | `mobile/app/(tabs)/tickets.tsx` hoặc `mobile/app/wallet/tickets.tsx` |
| Pass bàn | `TableBookingPass.tsx` | `mobile/app/wallet/table-pass.tsx` |
| Pass phòng | `RoomBookingPass.tsx` | `mobile/app/wallet/room-pass.tsx` |
| Hủy đơn đang chờ duyệt | `BookingPage.tsx`, `TableBookingPass.tsx`, `RoomBookingPass.tsx`, `TicketCart.tsx` | nằm trong chính màn booking/pass tương ứng |

## 3. Bản vẽ giao diện theo luồng

### 3.1. Luồng vào trang đặt dịch vụ
```text
+---------------------------------------------------+
|  [ < ] Xác nhận đặt dịch vụ                       |
+===================================================+
|  [ Ảnh địa điểm ]                                 |
|  Bờ Kè Sông Hậu                                   |
|  📍 Cần Thơ                                        |
|---------------------------------------------------|
|  [ Vé du lịch ] [ Đặt bàn ] [ Đặt phòng ]         |
|---------------------------------------------------|
|  Nội dung form thay đổi theo loại dịch vụ         |
|  - Vé: số lượng từng loại vé                      |
|  - Bàn: giờ đến, số lượng bàn, món đặt trước      |
|  - Phòng: ngày đến, ngày đi, số đêm, số phòng     |
+===================================================+
|  Tạm tính: 1.250.000đ      [ Xác nhận đặt chỗ ]   |
+---------------------------------------------------+
```

### 3.2. Luồng thanh toán VietQR
```text
+---------------------------------------------------+
|  [ < ] Thanh toán                                 |
+===================================================+
|  [ Mã QR VietQR ]                                 |
|                                                   |
|  Ngân hàng: Vietcombank                           |
|  Số tài khoản: 1030549759                         |
|  Chủ tài khoản: MAI NHUT MINH                     |
|  Số tiền: 1.250.000đ                              |
|  Nội dung: BK-2450-TOURTICKET                     |
|                                                   |
|  [ Sao chép STK ] [ Sao chép nội dung ]           |
+===================================================+
|  [ ✅ Xác nhận đã chuyển khoản ]                  |
+---------------------------------------------------+
```

### 3.3. Ví điện tử của user
```text
+---------------------------------------------------+
|  Vé của tôi                                       |
|  [ Vé ] [ Pass bàn ] [ Pass phòng ]               |
+===================================================+
|  [ QR ] Vé người lớn x10                          |
|  Địa điểm: Bờ Kè Sông Hậu                         |
|  Trạng thái: Chưa sử dụng                         |
|  Ngày dùng: 21-06-2026                            |
|  [ Xem chi tiết ]                                 |
|---------------------------------------------------|
|  [ QR ] Bàn số A12                                |
|  Giờ đến: 19:30                                   |
|  Trạng thái: Đã xác nhận                          |
+---------------------------------------------------+
```

## 4. Tái sử dụng Backend API và Database

### 4.1. API phải tái sử dụng nguyên vẹn

- `POST /api/bookings`
- `POST /api/bookings/batch`
- `POST /api/bookings/:id/payments`
- `POST /api/bookings/batch/payments`
- `POST /api/bookings/:id/tickets/confirm-transfer`
- `POST /api/bookings/:id/tables/confirm-transfer`
- `POST /api/bookings/:id/rooms/confirm-transfer`
- `POST /api/bookings/batch/rooms/confirm-transfer`
- `GET /api/bookings/table-reservations/mine`
- `GET /api/bookings/table-reservations/pass`
- `GET /api/bookings/room-reservations/pass`
- `POST /api/bookings/:id/tables/preorder`
- `POST /api/bookings/:id/tables/cancel`
- `POST /api/bookings/:id/cancel`
- `GET /api/user/tickets`
- `GET /api/locations/:id/services`
- `GET /api/locations/:id/pos/tables`
- `GET /api/locations/:id/tickets/realtime-stock`
- `GET /api/chat/location/:locationId`
- `POST /api/chat/location/:locationId`

### 4.2. Bảng dữ liệu liên quan

- `bookings`
- `booking_tickets`
- `booking_table_reservations`
- `booking_preorder_items`
- `payments`
- `services`
- `locations`
- `owner_profiles`
- `hotel_stays`
- `hotel_rooms`
- `pos_tables`
- `pos_orders`
- `booking_preorder_items`

### 4.3. Quy tắc kiến trúc bắt buộc

- Mobile không được tính trạng thái booking theo kiểu riêng.
- Mobile không được tự dựng QR ngân hàng bằng dữ liệu hardcode.
- Mọi trạng thái `pending`, `confirmed`, `cancelled`, `completed`, `used`, `void` phải đọc từ Backend.
- Các pass (`table-pass`, `room-pass`) phải dùng chung cấu trúc response với Website để tránh lệch trạng thái.
- Rule hủy booking phải bám backend hiện tại:
  - `POST /api/bookings/:id/cancel`: chỉ cho hủy khi booking còn `pending` tức là **chưa owner duyệt**.
  - Với bàn ăn đã thanh toán xong thì backend chặn tự hủy.
  - Khi hủy thành công phải giải phóng tài nguyên liên quan (bàn / phòng / preorder order) đúng như service backend đang làm.

### 4.4. Quy ước mã theo từng loại dịch vụ

Đã đối chiếu lại schema + backend hiện tại, phần mobile phải hiểu rõ là **không còn một kiểu "mã vé" chung cho mọi dịch vụ**:

- **Vé du lịch / ticket lẻ**:
  - Lưu ở bảng `booking_tickets.ticket_code`.
  - Backend đang sinh theo dạng: `DL-{bookingId}-{ticketIndex}-{secureHash}`.
  - Đây là mã để quét / xác thực từng vé đơn.

- **Mã chứng từ / hóa đơn giao dịch theo dịch vụ**:
  - Lưu ở `payments.invoice_code`.
  - Trigger database đang sinh theo prefix nghiệp vụ:
    - `NH-yyMMdd-seq`: ăn uống / đặt bàn
    - `DL-yyMMdd-seq`: vé du lịch
    - `KS-yyMMdd-seq`: khách sạn / lưu trú
  - Sequence đang đi theo `location_invoice_sequences`.

- **Mã giao dịch chuyển khoản**:
  - Vẫn là lớp riêng ở `payments.transaction_code` như `BK-...` hoặc `BKB-...`.
  - Mobile chỉ hiển thị theo response backend, không tự format lại.

Yêu cầu bắt buộc cho mobile:
- Không tự generate mã ở client.
- Không dùng một label chung cho tất cả trường hợp nếu dữ liệu backend đang là `ticketCode`, `invoiceCode`, `transactionCode`.
- Ở ví vé / pass / lịch sử thanh toán, phải map đúng loại mã theo đúng service type đang hiển thị.

## 5. Lộ trình triển khai chia phân hệ

### 5.1. Phân hệ 1: Shared Booking Foundation
- **Độ ưu tiên:** Ưu tiên Số 1
- **Độ khó:** 🔥🔥🔥

#### Code ở đâu?
- `mobile/types/booking.ts`
- `mobile/api/bookingApi.ts`
- `mobile/utils/vietqr.ts`
- `mobile/hooks/useBookingRealtime.ts`

#### Việc phải làm:
- Đồng bộ type booking từ Website sang Mobile.
- Tách rõ 3 service type: `ticket`, `table`, `room`.
- Chuẩn hóa formatter tiền, ngày, trạng thái.
- Dựng listener SSE / socket cho trạng thái booking nếu user đang mở màn hình thanh toán hoặc ví vé.

### 5.2. Phân hệ 2: Vé du lịch & Ticket Cart
- **Độ ưu tiên:** Ưu tiên Số 2
- **Độ khó:** 🔥🔥🔥

#### Code ở đâu?
- `mobile/app/booking/ticket/[serviceId].tsx`
- `mobile/app/wallet/tickets.tsx`
- `mobile/hooks/useTicketBooking.ts`

#### Việc phải làm:
- Chọn số lượng vé theo từng loại dịch vụ.
- Chặn giới hạn tối đa 50 vé mỗi giao dịch như Website.
- Hiển thị realtime stock từ API.
- Sau thanh toán thành công, điều hướng thẳng sang ví vé bằng `router.replace()`.

### 5.3. Phân hệ 3: Đặt bàn & món đặt trước
- **Độ ưu tiên:** Ưu tiên Số 3
- **Độ khó:** 🔥🔥🔥🔥

#### Code ở đâu?
- `mobile/app/booking/table/[serviceId].tsx`
- `mobile/app/wallet/table-pass.tsx`
- `mobile/hooks/useTableBooking.ts`

#### Việc phải làm:
- Chọn giờ đến và bàn còn trống.
- Gắn `preorder_items` đúng theo API hiện tại.
- Hỗ trợ hủy booking bàn của chính user khi đơn còn `pending` / chưa owner duyệt.
- Đồng bộ trạng thái pass bàn với backend.
- Nếu đang ở màn booking hoặc pass, cho mở chat với địa điểm như website đang làm qua `LocationChatBubble`.

### 5.4. Phân hệ 4: Đặt phòng & batch booking
- **Độ ưu tiên:** Ưu tiên Số 4
- **Độ khó:** 🔥🔥🔥🔥🔥

#### Code ở đâu?
- `mobile/app/booking/room/[serviceId].tsx`
- `mobile/app/wallet/room-pass.tsx`
- `mobile/hooks/useRoomBooking.ts`

#### Việc phải làm:
- Hỗ trợ nhiều phòng trong một giao dịch giống Website.
- Tính check-in, check-out, số đêm, tổng tiền.
- Đồng bộ `batch booking`, `batch payment`, `contact update`.
- Hiển thị room pass và trạng thái lưu trú từ backend.
- Hỗ trợ user tự hủy booking phòng khi đơn còn `pending` / chưa owner duyệt.

### 5.5. Phân hệ 5: Thanh toán VietQR & xác nhận chuyển khoản
- **Độ ưu tiên:** Ưu tiên Số 5
- **Độ khó:** 🔥🔥🔥🔥

#### Code ở đâu?
- `mobile/app/booking/payment/[bookingId].tsx`
- `mobile/components/payment/VietQrCard.tsx`
- `mobile/services/paymentClipboard.ts`

#### Việc phải làm:
- Hiển thị QR động từ response payment.
- Cho copy `bank_account`, `amount`, `content`.
- User bấm `Xác nhận đã chuyển khoản` để gọi API confirm tương ứng.
- Nếu backend trả trạng thái completed, mobile phải khóa nút tránh gửi đúp.

## 6. Tiêu chí nghiệm thu

1. User đặt được vé, bàn, phòng bằng chung backend hiện tại.
2. Mobile hiển thị đúng QR VietQR động theo từng owner.
3. Không có back-loop quay lại màn hình thanh toán sau khi hoàn tất.
4. Ví vé, pass bàn, pass phòng hiển thị đúng trạng thái như Website.
5. Booking bị hủy hoặc được xác nhận từ backend phải cập nhật realtime trên Mobile.
6. Không có chỗ nào hardcode thông tin ngân hàng ở client.
7. User hủy được đơn ăn uống / khách sạn trước khi owner duyệt và UI cập nhật đúng trạng thái `cancelled`.

## 7. Phụ thuộc và rủi ro

- Giai đoạn 4 phụ thuộc hoàn chỉnh vào `Giai đoạn 3` vì user phải đi từ `Chi tiết địa điểm` sang luồng booking.
- Batch room booking là phần rủi ro cao nhất, cần test riêng.
- Các endpoint auth / refresh token trên Mobile phải khớp chính xác với backend trước khi đóng phase này.
