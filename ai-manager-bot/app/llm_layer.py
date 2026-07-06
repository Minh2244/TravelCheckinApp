from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any
from .schemas import ActionPlan, BotRequest, ClassificationResult
from .intent_service import call_gemini_intent_service, get_dashboard_stats_from_nodejs

@dataclass
class LlmAnalysis:
    intent_candidate: str | None = None
    confidence: float | None = None
    entities: dict[str, Any] = field(default_factory=dict)
    answer: str | None = None
    model: str | None = None
    provider: str | None = None
    error: str | None = None

def llm_is_enabled() -> bool:
    return True

def maybe_analyze_payload(
    request: BotRequest,
    classification: ClassificationResult,
    entities: dict[str, Any],
    action_plan: ActionPlan,
) -> LlmAnalysis | None:
    
    # Chuẩn bị dữ liệu gửi cho Gemini
    request_data = {
        "role": request.role,
        "actor_user_id": request.actor_user_id,
        "text": request.text,
        "chat_history": [{"from": item.from_role, "text": item.text} for item in request.chat_history[-8:]],
        "screen_context": request.screen_context
    }
    
    # Bước 1: Gọi LLM lần 1 để lấy Intent
    first_pass = call_gemini_intent_service(request_data)
    
    intent = first_pass.get("intent", "unknown")
    confidence = first_pass.get("confidence", 0.0)
    parameters = first_pass.get("parameters", {})
    answer = first_pass.get("answer", "")
    
    # Xóa bước 2 vì Frontend sẽ tự gọi executeAction để hiển thị số liệu từ NodeJS

    return LlmAnalysis(
        intent_candidate=intent,
        confidence=confidence,
        entities=parameters,
        answer=answer,
        provider="gemini",
        model="gemini-2.5-flash",
    )

def merge_entities(local_entities: dict[str, Any], llm_entities: dict[str, Any]) -> dict[str, Any]:
    merged = dict(local_entities)
    for key, value in llm_entities.items():
        if value in (None, "", [], {}):
            continue
        merged[key] = value
    return merged

def maybe_override_classification(
    request: BotRequest,
    local: ClassificationResult,
    llm_analysis: LlmAnalysis | None,
) -> ClassificationResult:
    if not llm_analysis or not llm_analysis.intent_candidate:
        return local

    from .action_registry import REGISTRY
    intent = llm_analysis.intent_candidate
    
    # Tìm thông tin intent trong registry
    action_def = next((a for a in REGISTRY if a.name == intent), None)
    
    if action_def:
        local.intent = intent
        local.confidence = llm_analysis.confidence or 0.9
        local.label = action_def.description
    
    return local
