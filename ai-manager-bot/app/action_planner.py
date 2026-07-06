from __future__ import annotations
from .schemas import ActionPlan, BotRequest, ClassificationResult
from .action_registry import REGISTRY

def build_action_plan(request: BotRequest, classification: ClassificationResult) -> ActionPlan:
    if not classification.allowed:
        return ActionPlan(
            action_key="ask_clarification",
            requires_confirmation=False,
            risk_level=classification.risk_level,
            summary=classification.reason,
            warnings=[classification.reason],
        )

    action_key = classification.intent
    action_def = next((a for a in REGISTRY if a.name == action_key), None)
    
    if not action_def:
        return ActionPlan(
            action_key="ask_clarification",
            requires_confirmation=False,
            risk_level="read",
            summary="Intent không nằm trong registry.",
            warnings=[],
        )

    # Note: request.available_actions is passed from Frontend. 
    # If it is empty, we bypass the check. If it has items, we check.
    if action_key != "ask_clarification" and request.available_actions and action_key not in request.available_actions:
        return ActionPlan(
            action_key="ask_clarification",
            requires_confirmation=False,
            risk_level="read",
            summary=f"Action '{action_key}' không khả dụng ở màn hình hiện tại.",
            warnings=[],
        )

    warnings: list[str] = []
    if action_def.requires_confirmation:
        warnings.append("Cần xác nhận trước khi thực hiện.")

    return ActionPlan(
        action_key=action_key,
        requires_confirmation=action_def.requires_confirmation,
        risk_level="medium" if action_def.requires_confirmation else "read",
        summary=action_def.description,
        warnings=warnings,
    )
