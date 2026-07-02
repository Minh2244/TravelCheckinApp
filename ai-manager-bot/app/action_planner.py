from __future__ import annotations

from .policy_labels import ACTION_CATALOG
from .schemas import ActionPlan, BotRequest, ClassificationResult


INTENT_TO_ACTION = {
    "owner_revenue_summary": "owner_revenue_summary",
    "owner_review_summary": "owner_review_summary",
    "owner_review_reply_draft": "owner_review_reply_draft",
    "owner_review_reply_publish": "owner_review_reply_publish",
    "owner_voucher_draft": "owner_voucher_draft",
    "admin_read_analysis": "admin_revenue_analysis",
    "admin_write_action": "admin_location_review",
    "admin_critical_action": "admin_user_lock",
}


def build_action_plan(request: BotRequest, classification: ClassificationResult) -> ActionPlan:
    if not classification.allowed:
        action = ACTION_CATALOG["blocked" if classification.risk_level == "blocked" else "ask_clarification"]
        return ActionPlan(
            action_key=action.action_key,
            requires_confirmation=False,
            risk_level=classification.risk_level,
            summary=classification.reason,
            warnings=[classification.reason],
        )

    action_key = INTENT_TO_ACTION.get(classification.intent, "ask_clarification")
    action = ACTION_CATALOG[action_key]

    if action.action_key not in request.available_actions and request.available_actions:
        return ActionPlan(
            action_key="ask_clarification",
            requires_confirmation=False,
            risk_level="read",
            summary="Action khong nam trong danh sach available_actions cua man hinh hien tai.",
            warnings=["Backend sau nay van phai chan action khong co trong registry/context."],
        )

    warnings: list[str] = []
    if action.risk_level in ("medium", "high", "critical"):
        warnings.append("Can preview va xac nhan ro truoc khi thuc hien.")
    if action.risk_level == "critical":
        warnings.append("Can typed confirmation hoac re-auth theo policy.")

    return ActionPlan(
        action_key=action.action_key,
        requires_confirmation=action.requires_confirmation,
        risk_level=action.risk_level,
        summary=action.label,
        warnings=warnings,
    )

