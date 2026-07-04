# Giai doan 0 - Sandbox, model local va LLM provider

## Muc tieu

Dung `ai-manager-bot` doc lap, co env ro rang, co health check, co model local va san cho huong hybrid voi GPT API.

## Can co trong giai doan nay

- Folder `ai-manager-bot/`
- FastAPI service
- Health check
- Predict/chat/plan-action
- Model local de lam guard classifier
- `.env.example`
- file `.env` local
- tuy chon LLM provider:
  - `local`
  - `openai`

## Bien moi truong can chot

```env
AI_MANAGER_BOT_ENV=local
AI_MANAGER_BOT_PORT=8090
AI_MANAGER_BOT_MODEL_PATH=models/latest.json
AI_MANAGER_BOT_MIN_CONFIDENCE=0.65

AI_MANAGER_BOT_LLM_PROVIDER=openai
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
```

## Nguyen tac

- Khong hard-code API key vao source code.
- Khong commit `.env`.
- Neu GPT API loi, bot phai co fallback local/rule de khong sap toan bo.

## Lenh khoi chay

```powershell
cd E:\TravelCheckinApp\ai-manager-bot
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --host 127.0.0.1 --port 8090
```

## Tieu chi hoan thanh

- `GET /health` ra `200 OK`
- Bot doc duoc `.env`
- Bot biet dang chay `provider=openai` hay `provider=local`
- Chua goi action that
- Chua doc DB production truc tiep
