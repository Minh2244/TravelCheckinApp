# Lộ trình giai đoạn AI Manager Bot

Đây là bộ file tách riêng từ kế hoạch AI Owner/Admin để triển khai theo từng giai đoạn nhỏ, dễ kiểm tra và dễ dừng nếu có lỗi.

Nguyên tắc chung:

- `ai-manager-bot` là service AI riêng, chạy độc lập trước.
- Backend Node.js vẫn là lớp kiểm quyền, lấy dữ liệu thật, preview, xác nhận, execute và audit.
- Bot không tự đọc MySQL production, không tự execute action.
- Owner bị chặn tuyệt đối khỏi vận hành, booking/payment/front-office, location/service CRUD và bảo mật/tài chính.
- Admin có phạm vi rộng hơn nhưng action nguy hiểm luôn phải preview và xác nhận.

## Thứ tự làm

1. [Giai đoạn 0 - Sandbox và nền train model](./giai-doan-0-sandbox-va-train-model.md)
2. [Giai đoạn 1 - Guided prompt và câu trả lời tự nhiên](./giai-doan-1-guided-prompt-va-response.md)
3. [Giai đoạn 2 - Backend adapter an toàn](./giai-doan-2-backend-adapter-an-toan.md)
4. [Giai đoạn 3 - Owner read/draft ngoài vận hành](./giai-doan-3-owner-read-draft.md)
5. [Giai đoạn 4 - Admin read và critical preview](./giai-doan-4-admin-read-critical-preview.md)
6. [Giai đoạn 5 - Action registry, confirmation và audit](./giai-doan-5-action-registry-confirmation-audit.md)
7. [Giai đoạn 6 - Quality dashboard và rollout](./giai-doan-6-quality-dashboard-rollout.md)

## Trạng thái hiện tại

- Giai đoạn 0: Đã làm phần lớn và đã test chạy được.
- Giai đoạn 1: Đã có guided prompt, response tự nhiên hơn, bộ evaluate mặc định và endpoint `/evaluate/default`. Còn có thể mở rộng dataset lên bộ lớn hơn.
- Giai đoạn 2: Đã có backend adapter an toàn và build pass. Chưa nối UI Website, chưa execute action thật.
- Giai đoạn 3 trở đi: Chưa triển khai.
