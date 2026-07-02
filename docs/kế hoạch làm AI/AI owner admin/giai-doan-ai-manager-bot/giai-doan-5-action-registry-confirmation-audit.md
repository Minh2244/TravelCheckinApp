# Giai đoạn 5 - Action registry, confirmation và audit

## Mục tiêu

Bắt đầu cho AI hỗ trợ action thật nhưng chỉ qua Backend, có allowlist, preview, confirmation và audit.

## Module cần hoàn thiện

```text
backend/src/services/ai-manager/actionRegistry.ts
backend/src/services/ai-manager/policyEngine.ts
backend/src/services/ai-manager/actionPreview.ts
backend/src/services/ai-manager/actionExecutor.ts
backend/src/services/ai-manager/idempotency.ts
```

## Action nên làm trước

Owner:

- Đăng phản hồi review từ bản nháp.
- Tạo bản nháp voucher hoặc lưu draft nếu hệ thống có draft.
- Điều hướng tới trang được phép.

Admin:

- Soạn lý do từ chối.
- Ẩn/hiện địa điểm theo preview.
- Khóa user/owner với typed confirmation.

## Không làm trong phase này

- Owner action vận hành.
- Owner location/service CRUD.
- Payment/rollback thanh toán.
- Action không có handler trong registry.

## Database cần dùng

- `ai_action_runs`
- `ai_action_policies`
- `ai_chat_history`
- `audit_logs` hiện có nếu backend đã có.

## Tiêu chí hoàn thành

- Action không có registry thì bị chặn.
- Action write luôn có preview.
- Action write luôn cần confirmation.
- Bấm confirm 2 lần không tạo tác động lặp.
- Audit ghi actor, role, input, preview, result.
- Feature flag tắt là AI action dừng ngay.

