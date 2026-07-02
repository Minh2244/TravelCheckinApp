from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal


Role = Literal["owner", "admin"]


@dataclass
class BotRequest:
    role: Role
    route: str
    text: str
    screen_context: dict[str, Any] = field(default_factory=dict)
    available_actions: list[str] = field(default_factory=list)
    mock_context: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_payload(cls, payload: dict[str, Any]) -> "BotRequest":
        role = payload.get("role")
        if role not in ("owner", "admin"):
            raise ValueError("role must be owner or admin")

        text = str(payload.get("text") or payload.get("message") or "").strip()
        if len(text) < 2:
            raise ValueError("text or message is required")

        return cls(
            role=role,
            route=str(payload.get("route") or ""),
            text=text,
            screen_context=dict(payload.get("screen_context") or {}),
            available_actions=list(payload.get("available_actions") or []),
            mock_context=dict(payload.get("mock_context") or {}),
        )


@dataclass
class ClassificationResult:
    intent: str
    label: str
    confidence: float
    allowed: bool
    risk_level: str
    reason: str


@dataclass
class ActionPlan:
    action_key: str
    requires_confirmation: bool
    risk_level: str
    summary: str
    warnings: list[str] = field(default_factory=list)


@dataclass
class BotResponse:
    intent: str
    label: str
    confidence: float
    risk_level: str
    allowed: bool
    entities: dict[str, Any]
    answer: str
    action_plan: ActionPlan
    warnings: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "intent": self.intent,
            "label": self.label,
            "confidence": self.confidence,
            "risk_level": self.risk_level,
            "allowed": self.allowed,
            "entities": self.entities,
            "answer": self.answer,
            "action_plan": {
                "action_key": self.action_plan.action_key,
                "requires_confirmation": self.action_plan.requires_confirmation,
                "risk_level": self.action_plan.risk_level,
                "summary": self.action_plan.summary,
                "warnings": self.action_plan.warnings,
            },
            "warnings": self.warnings,
        }
