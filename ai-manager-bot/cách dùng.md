# Cach dung AI Manager Bot

Tai lieu nay ghi cach khoi chay nhanh `ai-manager-bot` moi khi dung, theo huong moi:

- `ai-manager-bot` van la lop AI noi bo cua du an.
- GPT API chi lo phan hieu ngon ngu va tra loi tu nhien hon.
- Backend va `ai-manager-bot` van giu quyen kiem soat du lieu, phan quyen, xac nhan va action.

## 1. Chuan bi 1 lan

Mo PowerShell:

```powershell
cd E:\TravelCheckinApp\ai-manager-bot
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
pip install -r requirements-ml.txt
```

Neu da cai roi thi nhung lan sau khong can cai lai.

## 2. Tao file `.env`

Trong folder `ai-manager-bot`, tao file `.env`.

Co the copy tu `.env.example`:

```powershell
cd E:\TravelCheckinApp\ai-manager-bot
Copy-Item .env.example .env
```

Noi dung de xuat:

```env
AI_MANAGER_BOT_ENV=local
AI_MANAGER_BOT_PORT=8090
AI_MANAGER_BOT_MODEL_PATH=models/latest.json
AI_MANAGER_BOT_MIN_CONFIDENCE=0.65

AI_MANAGER_BOT_LLM_PROVIDER=openai
OPENAI_API_KEY=dan_api_key_cua_ban_vao_day
OPENAI_MODEL=gpt-4.1-mini
```

Luu y:

- Khong commit file `.env`.
- Repo da ignore `.env`, nen file nay chi nam o may cua ban.

## 3. Khoi chay AI Manager Bot moi khi dung

Moi lan muon dung AI:

```powershell
cd E:\TravelCheckinApp\ai-manager-bot
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --host 127.0.0.1 --port 8090
```

Neu thay dong nay la bot da len:

```text
Uvicorn running on http://127.0.0.1:8090
```

## 4. Kiem tra bot co dang chay khong

Mo terminal khac:

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8090/health
```

Neu dung se ra:

```json
{"ok":true,"service":"ai-manager-bot","mode":"sandbox"}
```

## 5. Neu muon test nhanh bot

Test suggestions:

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8090/suggestions?role=owner&route=/owner/dashboard" -Method Get
```

Test chat:

```powershell
$body = @{ role = "owner"; route = "/owner/dashboard"; message = "doanh thu thang nay sao roi" } | ConvertTo-Json -Compress
Invoke-RestMethod -Uri "http://127.0.0.1:8090/chat" -Method Post -ContentType "application/json; charset=utf-8" -Body ([System.Text.Encoding]::UTF8.GetBytes($body))
```

## 6. Thu tu khoi chay ca bo khi test website

Nen mo 3 terminal rieng:

### Terminal 1 - AI bot

```powershell
cd E:\TravelCheckinApp\ai-manager-bot
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --host 127.0.0.1 --port 8090
```

### Terminal 2 - Backend

```powershell
cd E:\TravelCheckinApp\backend
npm run dev
```

### Terminal 3 - Website

```powershell
cd E:\TravelCheckinApp\website
npm run dev
```

## 7. Neu AI bi loi khong goi duoc

Kiem tra lan luot:

1. Bot co dang chay khong

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8090/health
```

2. Backend co dang chay khong

3. Backend co dang tro toi dung cong `8090` khong

File dang dung:

```text
backend/src/services/ai-manager/managerBotClient.ts
```

Mac dinh:

```text
http://127.0.0.1:8090
```

## 8. Ghi nho nhanh

Moi lan su dung AI:

```powershell
cd E:\TravelCheckinApp\ai-manager-bot
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --host 127.0.0.1 --port 8090
```

Sau do qua terminal khac test:

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8090/health
```
