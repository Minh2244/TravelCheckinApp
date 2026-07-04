from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any
from urllib import error as urllib_error
from urllib import request as urllib_request

from .action_planner import build_action_plan
from .schemas import ActionPlan, BotRequest, ClassificationResult
from .settings import get_settings


SUPPORTED_TIME_RANGES = {"today", "this_week", "this_month", "last_month"}
KNOWN_INTENTS_BY_ROLE: dict[str, set[str]] = {
    "owner": {
        "capability_help",
        "small_talk",
        "owner_revenue_summary",
        "owner_review_summary",
        "owner_review_reply_draft",
        "owner_review_reply_publish",
        "owner_voucher_draft",
        "owner_export_report",
    },
    "admin": {
        "capability_help",
        "small_talk",
        "admin_read_analysis",
        "admin_export_report",
        "admin_write_action",
        "admin_critical_action",
    },
}


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
    return get_settings().openai_enabled


def maybe_analyze_payload(
    request: BotRequest,
    classification: ClassificationResult,
    entities: dict[str, Any],
    action_plan: ActionPlan,
) -> LlmAnalysis | None:
    settings = get_settings()
    if not settings.openai_enabled:
        return None

    try:
        payload = _build_openai_payload(request, classification, entities, action_plan, settings.openai_model)
        response_json = _post_openai_json(payload, settings.openai_base_url, settings.openai_api_key, settings.request_timeout_seconds)
        content = _extract_message_content(response_json)
        parsed = _safe_parse_json(content)
        if not isinstance(parsed, dict):
            return LlmAnalysis(provider="openai", model=settings.openai_model, error="invalid_json")

        return LlmAnalysis(
            intent_candidate=_normalize_intent(request.role, parsed.get("intent_candidate")),
            confidence=_as_float(parsed.get("confidence")),
            entities=_normalize_entities(parsed.get("entities")),
            answer=_as_text(parsed.get("answer")),
            provider="openai",
            model=settings.openai_model,
        )
    except Exception as exc:  # pragma: no cover - network path is environment dependent
        return LlmAnalysis(provider="openai", model=settings.openai_model, error=str(exc))


def _build_openai_payload(
    request: BotRequest,
    classification: ClassificationResult,
    entities: dict[str, Any],
    action_plan: ActionPlan,
    model: str,
) -> dict[str, Any]:
    screen_context = request.screen_context or {}
    mock_context = request.mock_context or {}
    combined_context = {**screen_context, **mock_context}
    history = [{"from": item.from_role, "text": item.text} for item in request.chat_history[-8:]]
    system_prompt = (
        "Ban la lop hieu ngon ngu cho AI manager cua mot ung dung du lich. "
        "Nhiem vu cua ban la hieu cau hoi owner/admin, giu ngu canh chat, rut entity va viet cau tra loi tieng Viet tu nhien. "
        "Ban khong duoc cap them quyen, khong duoc mo route bi cam, khong duoc doi allowed tu false thanh true. "
        "Ban chi duoc dua tren du lieu trong screen_context/mock_context, neu thieu du lieu thi noi ro la thieu. "
        "Neu nguoi dung hoi ve chuc nang, hay tra loi dung pham vi man hinh hien tai. "
        "Tra ve DUY NHAT JSON hop le theo schema: "
        "{\"intent_candidate\": string|null, \"confidence\": number, \"entities\": object, \"answer\": string}. "
        "Khong chen markdown, khong giai thich them ngoai JSON."
    )
    user_payload = {
        "role": request.role,
        "route": request.route,
        "user_message": request.text,
        "recent_history": history,
        "local_classification": {
            "intent": classification.intent,
            "allowed": classification.allowed,
            "risk_level": classification.risk_level,
            "label": classification.label,
            "confidence": classification.confidence,
            "reason": classification.reason,
        },
        "local_entities": entities,
        "action_plan": {
            "action_key": action_plan.action_key,
            "requires_confirmation": action_plan.requires_confirmation,
            "risk_level": action_plan.risk_level,
            "summary": action_plan.summary,
            "warnings": action_plan.warnings,
        },
        "allowed_intents": sorted(KNOWN_INTENTS_BY_ROLE.get(request.role, set())),
        "screen_context": combined_context,
    }

    return {
        "model": model,
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": json.dumps(user_payload, ensure_ascii=False)},
        ],
    }


def _post_openai_json(
    payload: dict[str, Any],
    url: str,
    api_key: str,
    timeout_seconds: float,
) -> dict[str, Any]:
    request = urllib_request.Request(
        url,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib_request.urlopen(request, timeout=timeout_seconds) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib_error.HTTPError as exc:  # pragma: no cover - network path is environment dependent
        detail = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"openai_http_{exc.code}: {detail}") from exc
    except urllib_error.URLError as exc:  # pragma: no cover - network path is environment dependent
        raise RuntimeError(f"openai_network_error: {exc.reason}") from exc


def _extract_message_content(response_json: dict[str, Any]) -> str:
    choices = response_json.get("choices")
    if not isinstance(choices, list) or not choices:
        return ""
    message = choices[0].get("message") if isinstance(choices[0], dict) else None
    if not isinstance(message, dict):
        return ""
    content = message.get("content")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        values: list[str] = []
        for item in content:
            if isinstance(item, dict) and item.get("type") == "text":
                text = item.get("text")
                if isinstance(text, str):
                    values.append(text)
        return "\n".join(values)
    return ""


def _safe_parse_json(content: str) -> Any:
    if not content:
        return None
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        start = content.find("{")
        end = content.rfind("}")
        if start >= 0 and end > start:
            return json.loads(content[start : end + 1])
    return None


def _normalize_intent(role: str, value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    intent = value.strip()
    if intent in KNOWN_INTENTS_BY_ROLE.get(role, set()):
        return intent
    return None


def _as_float(value: Any) -> float | None:
    try:
        parsed = float(value)
        if parsed != parsed:
            return None
        return parsed
    except (TypeError, ValueError):
        return None


def _as_text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _normalize_entities(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict):
        return {}

    entities: dict[str, Any] = {}

    time_range = value.get("time_range")
    if isinstance(time_range, str) and time_range in SUPPORTED_TIME_RANGES:
        entities["time_range"] = time_range

    target_month = _coerce_int(value.get("target_month"))
    if target_month is not None and 1 <= target_month <= 12:
        entities["target_month"] = target_month

    target_year = _coerce_int(value.get("target_year"))
    if target_year is not None and 2000 <= target_year <= 2100:
        entities["target_year"] = target_year

    compare_months = value.get("compare_months")
    if isinstance(compare_months, list):
        normalized_months = [_coerce_int(item) for item in compare_months]
        normalized_months = [item for item in normalized_months if item is not None and 1 <= item <= 12]
        if len(normalized_months) >= 2:
            entities["compare_months"] = normalized_months[:4]

    metric_focus = value.get("metric_focus")
    if isinstance(metric_focus, str) and metric_focus.strip():
        entities["metric_focus"] = metric_focus.strip()

    quoted_names = value.get("quoted_names")
    if isinstance(quoted_names, list):
        clean_names = [str(item).strip() for item in quoted_names if str(item).strip()]
        if clean_names:
            entities["quoted_names"] = clean_names[:8]

    return entities


def _coerce_int(value: Any) -> int | None:
    try:
        if value is None or value == "":
            return None
        return int(value)
    except (TypeError, ValueError):
        return None


def merge_entities(local_entities: dict[str, Any], llm_entities: dict[str, Any]) -> dict[str, Any]:
    merged = dict(local_entities)
    for key, value in llm_entities.items():
        if value in (None, "", [], {}):
            continue
        if key == "compare_months" and key in merged:
            continue
        if key == "target_month" and "compare_months" in merged:
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

    if not local.allowed:
        return local

    if local.intent == llm_analysis.intent_candidate:
        return local

    local_action_plan = build_action_plan(request, local)
    if local_action_plan.action_key == "ask_clarification" or local.intent in {"unknown", "small_talk", "capability_help"}:
        from .rule_classifier import classification_from_intent

        overridden = classification_from_intent(
            request.role,
            llm_analysis.intent_candidate,
            confidence=max(llm_analysis.confidence or 0.75, local.confidence),
            reason="LLM refined the user intent from message + history + screen context.",
        )
        return overridden or local

    return local
