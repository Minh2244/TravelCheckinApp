from __future__ import annotations

from .action_planner import build_action_plan
from .entity_extractor import extract_entities
from .llm_layer import maybe_analyze_payload, maybe_override_classification, merge_entities
from .response_composer import compose_answer
from .rule_classifier import classify_request
from .schemas import BotRequest, BotResponse


LLM_DIRECT_ANSWER_INTENTS = {
    "small_talk",
    "unknown",
    "owner_review_reply_draft",
    "owner_voucher_draft",
}


def process_payload(payload: dict) -> dict:
    request = BotRequest.from_payload(payload)
    classification = classify_request(request)
    entities = extract_entities(request)
    initial_action_plan = build_action_plan(request, classification)

    llm_analysis = maybe_analyze_payload(request, classification, entities, initial_action_plan)
    classification = maybe_override_classification(request, classification, llm_analysis)
    entities = merge_entities(entities, llm_analysis.entities if llm_analysis else {})
    action_plan = build_action_plan(request, classification)
    local_answer = compose_answer(
        request,
        classification,
        entities,
        action_plan,
    )
    llm_answer = llm_analysis.answer if llm_analysis and llm_analysis.answer else None
    answer = llm_answer if llm_answer else local_answer

    response = BotResponse(
        intent=classification.intent,
        label=classification.label,
        confidence=classification.confidence,
        risk_level=classification.risk_level,
        allowed=classification.allowed,
        entities=entities,
        answer=answer,
        action_plan=action_plan,
        warnings=action_plan.warnings,
        llm={
            "enabled": bool(llm_analysis and llm_analysis.provider),
            "provider": llm_analysis.provider if llm_analysis else "local",
            "model": llm_analysis.model if llm_analysis else None,
            "used": bool(llm_analysis and llm_analysis.answer),
            "error": llm_analysis.error if llm_analysis else None,
        },
    )
    return response.to_dict()


def predict_payload(payload: dict) -> dict:
    request = BotRequest.from_payload(payload)
    classification = classify_request(request)
    return {
        "intent": classification.intent,
        "label": classification.label,
        "confidence": classification.confidence,
        "allowed": classification.allowed,
        "risk_level": classification.risk_level,
        "reason": classification.reason,
    }
