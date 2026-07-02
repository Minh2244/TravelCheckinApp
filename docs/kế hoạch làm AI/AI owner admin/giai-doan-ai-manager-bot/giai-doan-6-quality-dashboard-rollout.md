# Giai đoạn 6 - Quality dashboard và rollout

## Mục tiêu

Theo dõi chất lượng AI, quản lý dataset/model/prompt và rollout an toàn.

## Chức năng

- Lưu feedback hữu ích/không hữu ích.
- Lưu câu hỏi thật đã ẩn thông tin nhạy cảm.
- Evaluation batch theo role/intent.
- Model version.
- Prompt/config version.
- Activate/rollback model.
- Dashboard lỗi intent/action.
- Feature flag theo role/action.

## File/bảng cần có

Database:

- `ai_training_examples`
- `ai_model_versions`
- `ai_prompt_versions`
- `ai_assistant_feedback`
- `ai_action_runs`

Bot:

```text
ai-manager-bot/app/evaluator.py
ai-manager-bot/app/model_registry.py
ai-manager-bot/tools/evaluate_intent_model.py
```

Admin UI:

```text
/admin/ai
/admin/ai/datasets
/admin/ai/models
/admin/ai/evaluations
/admin/ai/action-runs
```

## Rollout đề xuất

1. Dev only.
2. Admin read-only.
3. Owner read-only/draft.
4. Owner write action thấp.
5. Admin write action có confirmation.
6. Admin critical action có typed confirmation/re-auth.

## Tiêu chí hoàn thành

- Có thể xem model đang active.
- Có thể rollback model/config.
- Có evaluation trước khi active model mới.
- Có metrics theo intent.
- Có nút tắt AI nhanh bằng feature flag.

