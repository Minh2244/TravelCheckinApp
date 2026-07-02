# Giai đoạn 0 - Sandbox và nền train model

## Mục tiêu

Tạo `ai-manager-bot` chạy độc lập, train được model intent, test được API nội bộ mà chưa nối Backend thật.

## Đã có

- Folder `ai-manager-bot/`.
- FastAPI service với endpoint:
  - `GET /health`
  - `POST /predict`
  - `POST /chat`
  - `POST /plan-action`
  - `POST /evaluate`
- Dataset synthetic lớn cho Owner/Admin.
- Text normalizer tiếng Việt đời thường: `ko`, `hong`, `hok`, `gium`, `dc`, sai chính tả nhẹ.
- Rule classifier.
- Entity extractor cơ bản.
- Action planner sandbox.
- Response composer sandbox.
- Script train GPU/CPU.
- Script predict.
- Model đã train: `models/owner_admin_intent_v1`.
- Test unit đã chạy OK.

## Lệnh đã dùng

Tạo môi trường:

```powershell
cd E:\TravelCheckinApp\ai-manager-bot
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
pip install -r requirements-ml.txt
python -m pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
```

Train GPU:

```powershell
python tools\train_intent_model.py --device cuda --epochs 8 --batch-size 32 --hidden-dim 128
```

Test predict:

```powershell
python tools\predict_intent_model.py "hôm nay doanh thu quán tăng hay giảm"
python tools\predict_intent_model.py "khách chê phục vụ lâu quá rep sao cho lịch sự"
python tools\predict_intent_model.py "gợi ý giúp tui voucher cuối tuần"
```

Chạy API:

```powershell
uvicorn app.main:app --reload --port 8090
```

Test API bằng PowerShell 5.1:

```powershell
$body = @{ role = 'owner'; message = 'hôm nay doanh thu quán tăng hay giảm' } | ConvertTo-Json -Compress
Invoke-RestMethod -Uri 'http://127.0.0.1:8090/chat' -Method Post -ContentType 'application/json; charset=utf-8' -Body ([System.Text.Encoding]::UTF8.GetBytes($body))
```

## Tiêu chí hoàn thành

- `/health` trả `200 OK`.
- `/chat` nhận được tiếng Việt.
- Intent doanh thu ra `owner_revenue_summary`.
- Intent phản hồi review ra `owner_review_reply_draft`.
- Intent voucher ra `owner_voucher_draft`.
- Admin critical ra `admin_critical_action`.
- Test unit OK.

## Việc còn nên làm trước khi đóng hẳn

- Bổ sung endpoint `/suggestions` ở giai đoạn 1.
- Bổ sung response tự nhiên hơn ở giai đoạn 1.
- Tạo bộ evaluation JSON nhiều câu thật hơn.

