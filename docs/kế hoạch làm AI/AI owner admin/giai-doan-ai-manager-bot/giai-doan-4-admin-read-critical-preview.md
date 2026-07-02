# Giai đoạn 4 - Admin read và critical preview

## Mục tiêu

Cho Admin dùng AI để phân tích hệ thống và tạo preview cho action quan trọng. Critical action chưa được chạy ngay.

## Chức năng Admin read

- Tổng quan doanh thu hệ thống.
- Địa điểm bị đánh giá xấu.
- Owner có doanh thu giảm.
- Voucher dùng nhiều.
- User/owner có dấu hiệu bất thường.
- Dịch vụ/địa điểm đang chờ duyệt.

## Chức năng Admin preview

- Soạn lý do từ chối địa điểm/dịch vụ.
- Soạn cảnh báo user/owner.
- Preview khóa user/owner.
- Preview ẩn địa điểm.
- Preview action rủi ro cao.

## Quy tắc critical

- Không execute ngay sau khi chat.
- Luôn hiển thị preview.
- Luôn yêu cầu xác nhận.
- Critical cần reason.
- Sau này có thể thêm re-auth/OTP.

## Guided prompt Admin

Dashboard:

```text
Tổng quan doanh thu hệ thống
Địa điểm nào bị đánh giá xấu nhiều?
Owner nào có doanh thu giảm?
Voucher nào được dùng nhiều?
```

Users:

```text
Tóm tắt hoạt động user này
Kiểm tra dấu hiệu bất thường
Soạn cảnh báo tài khoản
Khóa tài khoản này
```

## Lệnh cần chạy

Bot:

```powershell
cd E:\TravelCheckinApp\ai-manager-bot
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 8090
```

Test:

```powershell
$body = @{ role = 'admin'; message = 'admin khóa tài khoản user spam giúp tôi'; route = '/admin/users' } | ConvertTo-Json -Compress
Invoke-RestMethod -Uri 'http://127.0.0.1:8090/chat' -Method Post -ContentType 'application/json; charset=utf-8' -Body ([System.Text.Encoding]::UTF8.GetBytes($body))
```

## Tiêu chí hoàn thành

- Admin read intent trả đúng.
- Admin critical intent trả `requires_confirmation=true`.
- Backend chưa execute critical nếu chưa xác nhận.
- Mọi preview có summary, warning và risk level.

