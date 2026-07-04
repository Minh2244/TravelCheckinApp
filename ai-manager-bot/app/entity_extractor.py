from __future__ import annotations

import re
from typing import Any

from .schemas import BotRequest
from .text_normalizer import normalize_text


TIME_RANGE_PATTERNS = {
    "today": ("hom nay", "ngay nay", "today"),
    "this_week": ("tuan nay", "7 ngay", "bay ngay"),
    "this_month": ("thang nay", "30 ngay", "ba muoi ngay"),
    "last_month": ("thang truoc", "thang roi"),
}

CANCELLATION_ANALYSIS_TERMS = (
    "ty le huy",
    "ti le huy",
    "huy don bao nhieu",
    "bao nhieu don huy",
    "cancel rate",
    "cancellation rate",
)

SERVICE_TREND_TERMS = (
    "mang dich vu nao dang yeu",
    "dich vu nao dang yeu",
    "mang nao dang yeu",
    "nhom dich vu nao dang yeu",
    "dich vu nao yeu",
    "mang nao kem",
    "nhom nao kem",
    "dich vu nao kem",
)


def _extract_compare_months(contextual: str) -> list[int]:
    months: list[int] = []

    explicit_block = re.search(
        r"\bthang\s*((?:1[0-2]|[1-9])(?:\s*(?:,|va|voi|vs|-|\s)\s*(?:1[0-2]|[1-9]))+)\b",
        contextual,
    )
    if explicit_block:
        months = [int(match) for match in re.findall(r"(1[0-2]|[1-9])", explicit_block.group(1))]
        if len(months) >= 2:
            return months

    compact_pair = re.search(
        r"\bthang\s*(1[0-2]|[1-9])\s*(?:va|voi|vs|-)\s*(1[0-2]|[1-9])\b",
        contextual,
    )
    if compact_pair:
        return [int(compact_pair.group(1)), int(compact_pair.group(2))]

    tagged_months = [int(match) for match in re.findall(r"\bthang\s*(1[0-2]|[1-9])\b", contextual)]
    if len(tagged_months) >= 2:
        return tagged_months

    return []


def extract_entities(request: BotRequest) -> dict[str, Any]:
    text = request.text
    normalized = normalize_text(text)
    history_normalized = normalize_text(request.recent_history_text())
    contextual = normalized if not history_normalized else f"{history_normalized} {normalized}"
    entities: dict[str, Any] = {}

    selected_location_id = request.screen_context.get("selected_location_id")
    if selected_location_id is not None:
        entities["selected_location_id"] = selected_location_id

    ids = [int(match) for match in re.findall(r"\b(?:id|ma|so)\s*(\d+)\b", normalized)]
    if ids:
        entities["ids"] = ids

    phone_match = re.search(r"\b(0\d{8,10})\b", normalized)
    if phone_match:
        entities["phone"] = phone_match.group(1)

    email_match = re.search(r"[\w.+-]+@[\w-]+\.[\w.-]+", text)
    if email_match:
        entities["email"] = email_match.group(0)

    for key, phrases in TIME_RANGE_PATTERNS.items():
        if any(phrase in contextual for phrase in phrases):
            entities["time_range"] = key
            break

    compared_months = _extract_compare_months(contextual)
    year_match = re.search(r"\b(20\d{2})\b", contextual)
    if year_match:
        entities["target_year"] = int(year_match.group(1))
    if len(compared_months) >= 2 and any(term in contextual for term in ("so sanh", "doi chieu", "tang giam", "so voi")):
        entities["compare_months"] = compared_months[:4]
    elif len(compared_months) == 1:
        entities["target_month"] = compared_months[0]
    else:
        single_months = [int(match) for match in re.findall(r"\bthang\s*(1[0-2]|[1-9])\b", contextual)]
        if len(single_months) == 1:
            entities["target_month"] = single_months[0]

    if "time_range" not in entities and any(term in contextual for term in ("doanh thu", "thong ke", "bao cao")):
        entities["time_range"] = "this_month"

    if any(term in contextual for term in CANCELLATION_ANALYSIS_TERMS):
        entities["metric_focus"] = "cancellation_rate"
        if "time_range" not in entities:
            entities["time_range"] = "this_month"

    if any(term in contextual for term in SERVICE_TREND_TERMS):
        entities["metric_focus"] = "service_trend"

    quoted = re.findall(r'"([^"]+)"|\'([^\']+)\'', text)
    quoted_values = [left or right for left, right in quoted if left or right]
    if quoted_values:
        entities["quoted_names"] = quoted_values

    return entities
