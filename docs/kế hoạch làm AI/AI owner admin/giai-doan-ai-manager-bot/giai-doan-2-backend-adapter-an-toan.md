# Giai đoạn 2 - Backend adapter an toàn

## Mục tiêu

Nối Backend Node.js với `ai-manager-bot` nhưng vẫn chưa execute action thật. Backend chỉ gọi bot để lấy intent/answer/action plan rồi tự kiểm tra lại.

## Trạng thái hiện tại

Đã làm:

- Tạo `backend/src/services/ai-manager/managerBotClient.ts`.
- Tạo `backend/src/services/ai-manager/contextSanitizer.ts`.
- Tạo `backend/src/services/ai-manager/policyEngine.ts`.
- Tạo `backend/src/services/ai-manager/actionRegistry.ts`.
- Tạo `backend/src/controllers/ownerAdminAiController.ts`.
- Tạo `backend/src/routes/ownerAdminAiRoutes.ts`.
- Gắn route vào `/api/owner/ai/*` và `/api/admin/ai/*`.
- Owner AI chỉ cho role `owner`, không cho `employee`.
- Owner route vận hành/booking/payment/location-ops/services/bank/employees bị chặn trước khi gọi bot.
- Backend lọc context trước khi gửi sang bot.
- Backend kiểm lại `action_key` bot trả về với action registry.
- `POST /plan-action` chỉ trả preview, chưa execute action thật.
- `npm run build` backend đã pass.

Chưa làm:

- Chưa test runtime bằng JWT owner/admin thật trên frontend.
- Chưa nối giao diện Website vào các endpoint này.
- Chưa tạo audit log cho lượt chat/plan-action.
- Chưa execute action thật, đúng phạm vi giai đoạn 2.

## File Backend cần thêm

```text
backend/src/services/ai-manager/managerBotClient.ts
backend/src/services/ai-manager/contextSanitizer.ts
backend/src/services/ai-manager/policyEngine.ts
backend/src/services/ai-manager/actionRegistry.ts
backend/src/controllers/ownerAdminAiController.ts
backend/src/routes/ownerAdminAiRoutes.ts
```

## API Backend cần có

```text
GET  /api/owner/ai/health
GET  /api/owner/ai/suggestions
POST /api/owner/ai/chat
POST /api/owner/ai/plan-action

GET  /api/admin/ai/health
GET  /api/admin/ai/suggestions
POST /api/admin/ai/chat
POST /api/admin/ai/plan-action
```

## Quy tắc bắt buộc

- Backend lấy `user_id`, role từ JWT, không tin payload từ frontend.
- Backend kiểm route trước khi gọi bot.
- Backend lọc context trước khi gửi bot.
- Backend không gửi token, password, OTP, bank info.
- Backend không gửi dữ liệu vận hành Owner.
- Bot trả action nào Backend cũng phải kiểm lại bằng `policyEngine`.
- Chưa execute action trong giai đoạn này.

## Env cần thêm

```env
OWNER_ADMIN_AI_ENABLED=false
OWNER_AI_ENABLED=false
ADMIN_AI_ENABLED=false
AI_MANAGER_BOT_URL=http://127.0.0.1:8090
AI_MANAGER_BOT_TIMEOUT_MS=8000
```

## Lệnh cần chạy

Bot:

```powershell
cd E:\TravelCheckinApp\ai-manager-bot
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 8090
```

Backend:

```powershell
cd E:\TravelCheckinApp\backend
npm run dev
```

Test backend health:

```powershell
Invoke-RestMethod -Uri 'http://localhost:3000/api/owner/ai/health' -Method Get
```

Test owner suggestions:

```powershell
Invoke-RestMethod -Uri 'http://localhost:3000/api/owner/ai/suggestions?route=/owner/dashboard' -Method Get -Headers @{ Authorization = 'Bearer TOKEN_OWNER' }
```

Test owner chat:

```powershell
$body = @{ route = '/owner/dashboard'; message = 'hôm nay doanh thu quán tăng hay giảm' } | ConvertTo-Json -Compress
Invoke-RestMethod -Uri 'http://localhost:3000/api/owner/ai/chat' -Method Post -ContentType 'application/json; charset=utf-8' -Headers @{ Authorization = 'Bearer TOKEN_OWNER' } -Body ([System.Text.Encoding]::UTF8.GetBytes($body))
```

Test owner route cấm:

```powershell
$body = @{ route = '/owner/front-office/restaurant'; message = 'xác nhận đơn bàn số 3' } | ConvertTo-Json -Compress
Invoke-RestMethod -Uri 'http://localhost:3000/api/owner/ai/chat' -Method Post -ContentType 'application/json; charset=utf-8' -Headers @{ Authorization = 'Bearer TOKEN_OWNER' } -Body ([System.Text.Encoding]::UTF8.GetBytes($body))
```

## Tiêu chí hoàn thành

- Backend gọi được `/health` của bot.
- Owner ở route cấm bị chặn trước khi gọi bot.
- Owner ở route được phép gọi được `/chat`.
- Admin gọi được `/chat`.
- Không có action thật nào được execute.
