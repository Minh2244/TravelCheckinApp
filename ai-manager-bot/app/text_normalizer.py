from __future__ import annotations

import re
import unicodedata

from .vietnamese_lexicon import PHRASE_REPLACEMENTS, SLANG_MAP


def strip_accents(value: str) -> str:
    normalized = unicodedata.normalize("NFD", value)
    without_marks = "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")
    return without_marks.replace("đ", "d").replace("Đ", "D")


def _squash_repeated_letters(value: str) -> str:
    return re.sub(r"([a-z])\1{2,}", r"\1\1", value)


def _apply_phrase_replacements(value: str) -> str:
    padded = f" {value} "
    for pattern, replacement in PHRASE_REPLACEMENTS:
        padded = re.sub(pattern, replacement, padded)
    return re.sub(r"\s+", " ", padded).strip()


def normalize_text(value: str) -> str:
    value = strip_accents(value.lower())
    value = _squash_repeated_letters(value)
    value = re.sub(r"[^a-z0-9@._+\-\s]", " ", value)
    value = re.sub(r"\s+", " ", value).strip()
    value = _apply_phrase_replacements(value)
    tokens = [SLANG_MAP.get(token, token) for token in value.split()]
    return " ".join(tokens)


def contains_any(value: str, terms: list[str] | tuple[str, ...]) -> bool:
    for term in terms:
        normalized_term = term.strip()
        if not normalized_term:
            continue
        if " " in normalized_term:
            if normalized_term in value:
                return True
            continue
        if re.search(rf"(?<![a-z0-9]){re.escape(normalized_term)}(?![a-z0-9])", value):
            return True
    return False


def normalized_contains_any(raw_value: str, terms: list[str] | tuple[str, ...]) -> bool:
    value = normalize_text(raw_value)
    normalized_terms = tuple(normalize_text(term) for term in terms)
    return contains_any(value, normalized_terms)
