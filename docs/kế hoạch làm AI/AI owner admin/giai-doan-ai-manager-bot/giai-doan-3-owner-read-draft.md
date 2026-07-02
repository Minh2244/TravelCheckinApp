# Giai đoạn 3 - Owner read/draft ngoài vận hành

## Mục tiêu

Cho Owner dùng AI ở các trang quản trị được phép, chỉ đọc dữ liệu tổng hợp và tạo bản nháp. Không chạm vận hành.

## Route Owner được bật AI

```text
/owner/dashboard
/owner/locations
/owner/services
/owner/reviews
/owner/vouchers
/owner/commission
/owner/logs
/owner/profile
```

## Route Owner không được bật AI

```text
/owner/front-office
/owner/bookings
/owner/payments
/owner/location-ops
/employee/front-office
```

## Chức năng

- Dashboard: giải thích doanh thu, xu hướng tăng/giảm.
- Reviews: tóm tắt đánh giá xấu, soạn phản hồi nháp.
- Vouchers: gợi ý voucher, soạn nội dung nháp.
- Services/Locations: chỉ tóm tắt, điều hướng, không tạo/sửa/xóa.
- Commission/logs: giải thích số liệu và log.

## Không được làm

- Không xác nhận/hủy booking.
- Không check-in/check-out.
- Không bán/soát vé.
- Không thanh toán tại quầy.
- Không tạo/sửa/xóa địa điểm.
- Không tạo/sửa/xóa dịch vụ.
- Không sửa sơ đồ vận hành.

## UI Website cần làm

- AI bubble chỉ hiện ở route được phép.
- Guided prompt chips theo màn hình.
- Click chip gửi message vào chat rồi ẩn/disable chip để tránh spam.
- Chat tự do vẫn cho nhập.
- Hiển thị action preview nếu bot đề xuất draft.

## Lệnh cần chạy

Bot:

```powershell
cd E:\TravelCheckinApp\ai-manager-bot
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 8090
```

Website:

```powershell
cd E:\TravelCheckinApp
npm run dev
```

Backend:

```powershell
cd E:\TravelCheckinApp\backend
npm run dev
```

## Tiêu chí hoàn thành

- Owner thấy AI ở dashboard/reviews/voucher.
- Owner không thấy AI ở front-office/booking/payment/location-ops.
- Review reply chỉ là bản nháp.
- Voucher chỉ là bản nháp.
- Không action ghi dữ liệu nào chạy khi chưa confirm.

