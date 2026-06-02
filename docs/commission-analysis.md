Phân tích hoa hồng theo 3 dịch vụ (vận hành POS/PMS)

Mục tiêu
- Lưu lại các trường hợp tính hoa hồng theo yêu cầu bạn gửi.
- Chỉ ra các điểm sai/thiếu trong hiện trạng.
- Đề xuất giải pháp theo hướng đã thống nhất.

1) Các trường hợp tính hoa hồng (theo yêu cầu)

Ăn uống (Restaurant)
- Tính hoa hồng khi khách đặt online:
  - Đặt bàn trước rồi tới quầy gọi món.
  - Đặt bàn trước, gọi món và thanh toán chuyển khoản trước, sau đó tới quầy đúng giờ.
  - Đặt trước, chuyển khoản trước, nhưng không đến và hủy đơn: owner giữ tiền, vẫn tính hoa hồng.
- Không tính hoa hồng nếu gọi món tại quầy không qua đặt trước, bất kể hình thức thanh toán.

Khách sạn (Hotel/PMS)
- Tính hoa hồng trong các trường hợp:
  - Đặt phòng trước, tới ở bao lâu thanh toán bấy lâu.
  - Đặt phòng trước, tới ở bao lâu thanh toán bấy lâu; nếu ở quá hạn thì tính phụ thu.
  - Đặt phòng trước và đã chuyển khoản; tới ở ít hơn thời gian đặt thì không hoàn tiền, vẫn tính theo số tiền đã trả trước.
  - Nếu tới ở mới thanh toán (cash/transfer) thì vẫn tính hoa hồng trên số tiền thực thu.
  - Gia hạn phòng: không tính phụ thu; nếu trước đó là đặt trước thì vẫn tính hoa hồng.
- Nếu khách không tới và hủy: tiền owner giữ, vẫn tính hoa hồng.

Du lịch (Tourist)
- Đặt vé đã thanh toán trước thì tính hoa hồng.
- Nếu khách không tới và hủy: tiền owner giữ, vẫn tính hoa hồng.

2) Những điểm sai/thiếu trong hiện trạng

Ăn uống (Restaurant)
- Logic hiện tại đúng hướng: chỉ tính hoa hồng khi transaction_source = 'online_booking'.
- Điểm cần đảm bảo: các trường hợp đặt online + tới quầy gọi món phải luôn gắn đúng booking và transaction_source, tránh bị hiểu thành onsite_pos (mất hoa hồng).

Khách sạn (Hotel/PMS)
- Sai: payment tạo tại bước checkout đang set commission_rate/commission_amount/vat_rate/vat_amount = 0.
  - Hệ quả: dù có trả tiền tại quầy thì hoa hồng vẫn = 0.
- Thiếu: khi đã có prepaid từ booking, phần phát sinh khi checkout không được tính hoa hồng đúng.

Du lịch (Tourist/POS)
- Sai: luồng bán vé tại quầy (payTouristPosTicketsBatch) cũng đặt commission/vat = 0.
  - Hệ quả: mọi payment vận hành du lịch không có hoa hồng.
- Ghi chú: trong mô tả bạn có “tính phụ thu” cho vé du lịch, nhưng thực tế nghiệp vụ là “tính hoa hồng”, vé không có phụ thu.

3) Giải pháp theo hướng đã thống nhất

Ăn uống (Restaurant)
- Giữ nguyên quy tắc: chỉ tính hoa hồng cho giao dịch online_booking.
- Khi khách đặt bàn trước rồi tới quầy:
  - Bắt buộc gắn booking_id vào POS order.
  - transaction_source phải được chuẩn hóa về 'online_booking'.
- Onsite thuần (không booking) giữ transaction_source = 'onsite_pos' => không tính hoa hồng.

Khách sạn (Hotel/PMS)
- Chuẩn hóa tính hoa hồng tại checkout:
  - Khi tạo/hoàn tất payment ở checkout, tính commission/vat theo:
    - locations.commission_rate (nếu có) hoặc system_settings.default_commission_rate
    - system_settings.vat_rate
  - Ghi đầy đủ commission_amount/vat_amount/owner_receivable vào payments.
- Prepaid từ booking:
  - Không hoàn tiền nếu ở ít hơn.
  - Hoa hồng tính theo số tiền prepaid đã completed + phần phát sinh tại checkout (nếu có).
- Phụ thu quá hạn:
  - Cộng vào amount và tính hoa hồng trên phần này.
- Gia hạn:
  - Không tính phụ thu, nhưng vẫn tính hoa hồng cho phần tiền phát sinh (nếu có).

Du lịch (Tourist)
- Chỉ tính hoa hồng cho các payment online_booking (đặt vé online đã trả trước).
- Nếu muốn tính hoa hồng cả vé bán tại quầy, cần thay đổi quy tắc; còn theo yêu cầu hiện tại thì giữ 0 cho onsite_pos.
- Với booking đã paid nhưng khách không tới: admin vẫn confirm payment để tạo commission.

4) Giữ hướng ban đầu (không ép đặt trước = thanh toán trước)

Khách sạn:
- Tính hoa hồng trong các trường hợp:
  - Đặt phòng trước, tới ở bao lâu thanh toán bấy lâu.
  - Đặt phòng trước, tới ở bao lâu thanh toán bấy lâu; nếu ở quá hạn thì tính phụ thu.
  - Đặt phòng trước và đã chuyển khoản; tới ở ít hơn thời gian đặt thì không hoàn tiền, vẫn tính theo số tiền đã trả trước.
  - Nếu tới ở mới thanh toán (cash/transfer) thì vẫn tính hoa hồng trên số tiền thực thu.
  - Gia hạn phòng: không tính phụ thu; nếu trước đó là đặt trước thì vẫn tính hoa hồng.
- Nếu khách không tới và hủy: tiền owner giữ, vẫn tính hoa hồng.

5) Phân tích chi tiết (code + database + logic)

Nguyên tắc chung:
- % hoa hồng phải lấy đúng từ locations.commission_rate (do admin cấu hình).
- Nếu location chưa có commission_rate: fallback system_settings.default_commission_rate (nếu có), cuối cùng mới dùng 2.5.
- VAT lấy từ system_settings.vat_rate (fallback 10 nếu thiếu).
- Công thức:
  - commission_amount = amount * commission_rate / 100
  - vat_amount = commission_amount * vat_rate / 100
  - owner_receivable = amount - commission_amount - vat_amount
- Tất cả giá trị làm tròn 2 chữ số thập phân.

Database (hiện có, không cần tạo bảng mới):
- locations.commission_rate (PK: location_id, FK owner_id -> users.user_id).
- payments.commission_rate, commission_amount, vat_rate, vat_amount, owner_receivable (FK: location_id -> locations.location_id, booking_id -> bookings.booking_id).
- commissions.payment_id (FK -> payments.payment_id), commissions.booking_id (FK -> bookings.booking_id).
- Lưu ý: cần đảm bảo settings key default_commission_rate và vat_rate tồn tại trong system_settings nếu muốn dùng fallback từ DB.

A) Ăn uống (POS) — backend/src/controllers/ownerController.ts
- Hàm: payPosOrder
- Hiện trạng: đã tính hoa hồng đúng theo online_booking.
- Cần đảm bảo:
  - booking_id luôn được gắn khi khách đặt online rồi tới quầy.
  - transaction_source phải là 'online_booking' khi có booking_id để commission được tính.
  - POS onsite thuần giữ transaction_source = 'onsite_pos' => commission = 0.

B) Khách sạn (PMS) — backend/src/controllers/ownerController.ts
- Hàm: checkoutHotelStay
  - Transfer init: tạo pending payment (notes: HOTEL_STAY:{id})
    - Hiện đang set commission_rate/commission_amount/vat_rate/vat_amount = 0.00.
    - Cần tính theo công thức chung và ghi đầy đủ vào payments, đồng thời cập nhật owner_receivable.
  - Transfer complete: UPDATE payment từ pending -> completed
    - Hiện chỉ cập nhật amount/owner_receivable/qr_data, chưa cập nhật commission.
    - Cần update commission_rate/commission_amount/vat_rate/vat_amount/owner_receivable theo finalAmount.
  - Cash complete: INSERT payment completed
    - Hiện set commission/vat = 0.00.
    - Cần tính commission/vat theo finalAmount và ghi vào payments.

- Hàm: checkoutHotelStaysBatch
  - Logic tương tự checkoutHotelStay nhưng áp dụng cho nhiều phòng (totalAmount).
  - Tất cả các nhánh tạo/update payment đều phải ghi commission/vat đúng theo totalAmount.
  - Ghi chú nghiệp vụ:
    - Prepaid (booking) không hoàn tiền => amount tính theo booking final_amount.
    - Phụ thu quá hạn: cộng vào amount, vẫn tính hoa hồng.
    - Gia hạn: không phụ thu, nhưng nếu phát sinh thanh toán vẫn tính hoa hồng.
    - Walk-in (không booking) vẫn tính hoa hồng trên số tiền thực thu.

C) Du lịch (Tourist) — online booking + POS
- Online booking (đặt vé trả trước):
  - Đã xử lý trong backend/src/services/bookingPaymentService.ts
  - Hàm createOrGetUserPaymentForBooking dùng commission_rate từ locations + vat_rate từ system_settings.
  - Cần giữ nguyên và đảm bảo admin confirm payment để tạo commission record.
- POS tại quầy (payTouristPosTicketsBatch):
  - Hiện đang set commission/vat = 0.00 cho cash/transfer.
  - Nếu yêu cầu chỉ tính hoa hồng cho booking online: giữ 0 cho POS là đúng.
  - Nếu muốn tính cả bán vé tại quầy: cần bổ sung logic tính commission/vat giống POS ăn uống, dùng locations.commission_rate.

D) Admin confirm — backend/src/controllers/adminController.ts
- Hàm: confirmPaymentAndCreateCommission
- Lấy commission_amount/vat_amount trực tiếp từ payments.
- Vì vậy tất cả payment tạo mới/hoàn tất ở các luồng trên bắt buộc phải ghi commission_rate/commission_amount/vat_rate/vat_amount chính xác trước khi admin confirm.
