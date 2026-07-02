# Giai đoạn 1 - Guided prompt và câu trả lời tự nhiên

## Mục tiêu

Làm bot dễ dùng hơn trước khi nối Backend thật:

- Có câu hỏi gợi ý theo role/route.
- Người dùng bấm chip gợi ý thì bot hiểu intent tốt hơn.
- Câu trả lời bớt thô, giống trợ lý hơn.
- Có mock context đủ để test doanh thu, review, voucher, admin.

## Trạng thái hiện tại

Đã làm:

- Tạo `ai-manager-bot/app/prompt_suggestions.py`.
- Thêm endpoint `GET /suggestions`.
- Owner route cấm trả suggestion rỗng.
- Owner dashboard/reviews/vouchers có guided prompt.
- Admin có guided prompt read và critical preview.
- Sửa `response_composer.py` để trả lời tự nhiên hơn và có dấu.
- Thêm unit test cho suggestions và response.
- Tạo `ai-manager-bot/tests/fixtures/evaluation_cases.json` để có bộ câu cố định.
- Tạo `ai-manager-bot/app/evaluator.py`.
- Thêm endpoint `GET /evaluate/default` để chạy nhanh bộ câu cố định.
- Sửa matcher từ khóa để tránh lỗi dính từ ngắn như `hi` trong `tình hình`, `cấu hình`.
- Bổ sung rule cho câu miền Nam/viết tắt như `rep`, `chê`, `ưu đãi`, `hoa hồng`.

Chưa làm:

- Chưa mở rộng `evaluation_cases.json` lên bộ lớn 20+ câu cho mỗi nhóm.
- Chưa nối guided prompt lên Website.

## Chức năng cần làm

### 1. Guided prompt trong `ai-manager-bot`

Tạo module:

```text
ai-manager-bot/app/prompt_suggestions.py
```

Endpoint:

```text
GET /suggestions?role=owner&route=/owner/dashboard
GET /suggestions?role=admin&route=/admin/users
```

Response:

```json
{
  "suggestions": [
    {
      "id": "owner_dashboard_revenue_today",
      "title": "Doanh thu hôm nay",
      "prompt": "Hôm nay doanh thu quán tăng hay giảm?",
      "intent_hint": "owner_revenue_summary",
      "risk_level": "read",
      "requires_confirmation": false
    }
  ]
}
```

### 2. Route policy cho suggestion

Owner không được nhận suggestion ở route cấm:

```text
/owner/front-office
/owner/front-office/*
/owner/bookings
/owner/payments
/owner/location-ops/*
```

Nếu route bị cấm:

```json
{
  "suggestions": [],
  "disabled_reason": "OWNER_AI_DISABLED_ON_OPERATIONS_ROUTE"
}
```

### 3. Response composer tự nhiên hơn

Sửa:

```text
ai-manager-bot/app/response_composer.py
```

Mục tiêu:

- Với doanh thu: nếu có mock context thì nói số liệu, so sánh tăng/giảm, gợi ý hành động.
- Với review: tóm tắt vấn đề, gợi ý câu trả lời.
- Với voucher: gợi ý ưu đãi cụ thể.
- Với small talk: trả lời thân thiện nhưng không lan man.
- Với blocked action: nói rõ vì sao không làm được và hướng dẫn user tự thao tác.

### 4. Evaluation cases

Tạo:

```text
ai-manager-bot/tests/fixtures/evaluation_cases.json
```

Nội dung nên có tối thiểu:

- 20 câu Owner doanh thu.
- 20 câu Owner review.
- 20 câu Owner voucher.
- 20 câu Owner bị cấm.
- 20 câu Admin read.
- 20 câu Admin critical.
- 20 câu small talk.

## Lệnh cần chạy

Trong terminal đang activate `.venv`:

```powershell
cd E:\TravelCheckinApp\ai-manager-bot
python -m unittest discover -s tests -p "test_*.py"
```

Chạy API:

```powershell
uvicorn app.main:app --reload --port 8090
```

Test suggestions:

```powershell
Invoke-RestMethod -Uri 'http://127.0.0.1:8090/suggestions?role=owner&route=/owner/dashboard' -Method Get
```

Test chat:

```powershell
$body = @{ role = 'owner'; message = 'hôm nay doanh thu quán tăng hay giảm'; route = '/owner/dashboard' } | ConvertTo-Json -Compress
Invoke-RestMethod -Uri 'http://127.0.0.1:8090/chat' -Method Post -ContentType 'application/json; charset=utf-8' -Body ([System.Text.Encoding]::UTF8.GetBytes($body))
```

Test bộ câu cố định:

```powershell
Invoke-RestMethod -Uri 'http://127.0.0.1:8090/evaluate/default' -Method Get
```

## Tiêu chí hoàn thành

- `/suggestions` trả đúng prompt theo role/route.
- Owner route cấm không có suggestion.
- `/chat` trả câu tự nhiên hơn, không còn câu thô kiểu “Action đề xuất”.
- `/evaluate/default` chạy được và không có case fail ở bộ test hiện tại.
- Unit test OK.
- Không cần nối Backend thật.
