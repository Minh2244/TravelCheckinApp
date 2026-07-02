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


def extract_entities(request: BotRequest) -> dict[str, Any]:
    text = request.text
    normalized = normalize_text(text)
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
        if any(phrase in normalized for phrase in phrases):
            entities["time_range"] = key
            break

    if "time_range" not in entities and any(term in normalized for term in ("doanh thu", "thong ke", "bao cao")):
        entities["time_range"] = "this_month"

    quoted = re.findall(r'"([^"]+)"|\'([^\']+)\'', text)
    quoted_values = [left or right for left, right in quoted if left or right]
    if quoted_values:
        entities["quoted_names"] = quoted_values

    return entities

