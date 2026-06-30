# Giai đoạn 4: Booking, Thanh toán VietQR & Ví điện tử của User

Trạng thái hiện tại: `completed`

Tài liệu này đã được cập nhật theo implementation đang chạy trong repo, không còn bám cứng 100% vào bản kế hoạch ban đầu. Một số route và chi tiết UX đã được điều chỉnh trong quá trình làm thật, và các khác biệt đó được chấp nhận vì đang hoạt động ổn định, đồng bộ backend tốt, và đã được kiểm thử thủ công.

## 1. Kết luận chốt phase

Giai đoạn 4 được xem là hoàn thành theo hiện trạng code ngày `2026-06-30` với các căn cứ sau:

- Luồng đặt vé, đặt bàn, đặt phòng, thanh toán VietQR, ví vé, pass bàn và pass phòng đều đã có màn hình Mobile riêng.
- Mobile tái sử dụng backend hiện tại cho booking, payment, confirm transfer, wallet/pass và cancel flow.
- TypeScript mobile đang pass với lệnh `cmd /c npx tsc --noEmit -p tsconfig.json`.
- Các khác biệt so với bản kế hoạch cũ chủ yếu là khác route hoặc tối ưu UX, không phải thiếu chức năng cốt lõi.

## 2. Phạm vi đã hoàn thành

Phase 4 hiện bao phủ đầy đủ cụm chức năng User sau từ Website:

- `website/src/pages/User/BookingPage.tsx`
- `website/src/pages/User/TicketCart.tsx`
- `website/src/pages/User/MyTickets.tsx`
- `website/src/pages/User/TableBookingPass.tsx`
- `website/src/pages/User/RoomBookingPass.tsx`
- `website/src/components/LocationChatBubble.tsx` ở mức hỗ trợ luồng trước và sau booking

Ngoài phạm vi của Phase 4:

- Dashboard tổng quan
- Saved locations
- Check-ins / history
- Vouchers tổng hợp ngoài ngữ cảnh booking
- SOS
- AI chat / itineraries

## 3. Đối chiếu implementation hiện tại

| Luồng | Nguồn Website | Implementation Mobile hiện tại |
|---|---|---|
| Đặt vé du lịch | `BookingPage.tsx`, `TicketCart.tsx` | `mobile/app/(app)/booking/ticket/[serviceId].tsx` -> `TicketBookingScreen` |
| Đặt bàn nhà hàng / cafe | `BookingPage.tsx`, `TableBookingPass.tsx` | `mobile/app/(app)/booking/table/[serviceId].tsx` |
| Đặt phòng khách sạn / resort | `BookingPage.tsx`, `RoomBookingPass.tsx` | Route chính: `mobile/app/(app)/booking/hotel/[locationId].tsx` |
| Wrapper đặt phòng cũ / single-service | bản kế hoạch cũ | `mobile/app/(app)/booking/room/[serviceId].tsx` vẫn còn để tương thích flow cũ |
| Thanh toán VietQR | `BookingPage.tsx`, `TicketCart.tsx` | `mobile/app/(app)/booking/payment/[bookingId].tsx` |
| Ví vé du lịch | `TicketCart.tsx`, `MyTickets.tsx` | `mobile/app/(app)/wallet/tickets.tsx` |
| Pass bàn | `TableBookingPass.tsx` | `mobile/app/(app)/wallet/table-pass.tsx` |
| Pass phòng | `RoomBookingPass.tsx` | `mobile/app/(app)/wallet/room-pass.tsx` |

Ghi chú quan trọng:

- Luồng room booking thực tế đã chuyển sang màn `hotel/[locationId]` để hỗ trợ multi-room và batch payment rõ ràng hơn.
- Route `booking/room/[serviceId]` không phải phần bỏ dở; nó đang là wrapper tương thích cũ.
- Ví vé du lịch Mobile đang bám hành vi Website hiện tại, bao gồm cả mã QR nhóm dạng `SB-{bookingId}-GROUP`.

## 4. Backend đang được tái sử dụng

Các API cốt lõi Phase 4 hiện đã có call site trong Mobile:

- `POST /api/bookings`
- `POST /api/bookings/batch`
- `POST /api/bookings/:id/payments`
- `POST /api/bookings/batch/payments`
- `PUT /api/bookings/batch/contact`
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
- `GET /api/locations/:id/pos/areas`
- `GET /api/locations/:id/pos/tables`
- `GET /api/chat/location/:locationId`
- `POST /api/chat/location/:locationId`

Các service Mobile liên quan:

- `mobile/src/services/booking.api.ts`
- `mobile/src/services/location.api.ts`
- `mobile/src/services/user.api.ts`
- `mobile/src/services/chat.api.ts`

## 5. Phần đã triển khai theo từng cụm

### 5.1. Shared booking foundation

Đã có:

- Type booking dùng chung tại `mobile/src/types/booking.ts`
- Service gọi API booking tại `mobile/src/services/booking.api.ts`
- Utility format ngày, tiền, QR và booking payload tại `mobile/src/lib/booking-utils.ts`
- Realtime booking notification qua SSE tại `mobile/src/hooks/useBookingNotifications.ts`
- Realtime table / public booking state qua Socket.IO tại `mobile/src/hooks/useBookingRealtime.ts`

### 5.2. Vé du lịch

Đã có:

- Mua nhiều loại vé trong cùng một giao dịch
- Giới hạn tối đa `50` vé mỗi lần
- Chuyển sang payment screen ngay sau khi tạo booking
- Ví vé du lịch có grouping theo booking
- Hiển thị QR từng vé và QR nhóm tương thích Website

Điều chỉnh so với kế hoạch cũ:

- Mobile dùng `TicketBookingScreen` theo location-level flow thay vì chỉ bám một service đơn lẻ
- Stock hiện được đọc từ response service hiện tại của backend thay vì tách riêng một màn realtime stock độc lập

### 5.3. Đặt bàn & preorder

Đã có:

- Chọn bàn theo sơ đồ public table
- Hỗ trợ preload menu preorder
- Hỗ trợ voucher trong luồng preorder
- Hủy booking pending từ ví bàn
- Realtime xử lý conflict bàn qua Socket.IO
- Payment flow cho preorder qua VietQR

### 5.4. Đặt phòng & batch booking

Đã có:

- Chọn nhiều phòng trong một giao dịch
- Batch booking
- Batch payment
- Cập nhật contact cho batch booking
- Ví pass phòng và hủy booking pending
- Hỗ trợ prepay bằng VietQR cho room batch

Điều chỉnh so với kế hoạch cũ:

- Màn chính hiện tại là `HotelBookingScreen`
- Flow room ưu tiên chọn theo location rồi batch theo room IDs

### 5.5. Thanh toán VietQR

Đã có:

- Hiển thị QR động từ response payment
- Hiển thị ngân hàng, số tài khoản, chủ tài khoản, số tiền, nội dung chuyển khoản
- Confirm transfer theo từng mode: ticket, table, room, room-batch
- Polling trạng thái payment để khóa nút khi đã `completed`
- Redirect hợp lý về đúng ví tương ứng sau confirm

Khác với bản kế hoạch cũ:

- Bản hiện tại không có shortcut copy riêng cho từng trường
- UX thanh toán được tối giản theo hướng xem thông tin và bấm xác nhận

### 5.6. Wallet, pass và realtime sync

Đã có:

- `wallet/tickets.tsx`
- `wallet/table-pass.tsx`
- `wallet/room-pass.tsx`
- SSE phát `booking_updated` để các ví tự reload
- Đồng bộ trạng thái `pending`, `confirmed`, `completed`, `cancelled` theo backend

## 6. Sai khác đã được chấp nhận

Các sai khác dưới đây không còn được xem là blocker cho Phase 4:

- Route room booking thực tế dùng `booking/hotel/[locationId]` thay vì chỉ `booking/room/[serviceId]`
- Payment screen không có nút copy riêng
- Mobile bám theo QR nhóm `SB-{bookingId}-GROUP` giống Website hiện tại
- Một số wording/UI mobile đã được tinh giản hoặc đổi nhãn so với mock cũ

## 7. Kết quả rà lỗi ẩn

Sau khi rà lại code hiện tại, kết luận:

- Không thấy blocker nào đủ lớn để giữ Phase 4 ở trạng thái `in-progress`
- Đã vá một lỗi ngầm ở luồng ticket booking: parse ngày `YYYY-MM-DD` theo local date để tránh lệch timezone khi tạo payload booking
- Đã chỉnh lại một số nhãn trạng thái ở wallet/pass để bớt gây hiểu nhầm
- Đã chỉnh note trên payment screen để khớp đúng mode ticket / table / room

Rủi ro còn lại ở mức thấp:

- Payment screen hiện chưa có nút copy nhanh cho từng trường chuyển khoản
- Luồng ticket nên tiếp tục regression test khi đổi timezone thiết bị
- Room batch vẫn là cụm cần test kỹ nhất mỗi lần backend đổi rule booking

## 8. Biên bản chốt Phase 4

Biên bản chốt theo hiện trạng code:

- Trạng thái: `completed`
- Ngày chốt: `2026-06-30`
- Căn cứ chốt:
  - Code mobile đã có đủ các màn booking, payment, wallet/pass thuộc Phase 4
  - Backend reuse đầy đủ cho nghiệp vụ chính
  - TypeScript mobile pass
  - Sai khác so với kế hoạch cũ đã được chấp nhận vì implementation mới hoạt động tốt hơn

## 9. Điều kiện sang Giai đoạn 5

Đánh giá hiện tại: `có thể chuyển sang Giai đoạn 5`

Lý do:

- Giai đoạn 4 không còn blocker chức năng ở mức phase
- Luồng từ location detail -> booking -> payment -> wallet/pass đã hình thành đầy đủ
- Các phần còn lại chủ yếu là tối ưu UX nhỏ và regression test, không cần giữ Phase 4 mở

Khuyến nghị trước khi mở nhiều việc ở Phase 5:

- Giữ một checklist smoke test ngắn cho ticket / table / room / payment / wallet
- Khi backend đổi logic booking, rerun nhanh 4 flow cốt lõi của Phase 4
