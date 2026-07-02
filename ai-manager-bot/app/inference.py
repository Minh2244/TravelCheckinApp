from __future__ import annotations

from .action_planner import build_action_plan
from .entity_extractor import extract_entities
from .response_composer import compose_answer
from .rule_classifier import classify_request
from .schemas import BotRequest, BotResponse


def process_payload(payload: dict) -> dict:
    request = BotRequest.from_payload(payload)
    classification = classify_request(request)
    entities = extract_entities(request)
    action_plan = build_action_plan(request, classification)
    answer = compose_answer(request, classification, entities, action_plan)

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

