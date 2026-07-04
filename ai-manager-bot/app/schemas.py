from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal


Role = Literal["owner", "admin"]


@dataclass
class ChatHistoryTurn:
    from_role: str
    text: str


@dataclass
class BotRequest:
    role: Role
    route: str
    text: str
    screen_context: dict[str, Any] = field(default_factory=dict)
    available_actions: list[str] = field(default_factory=list)
    mock_context: dict[str, Any] = field(default_factory=dict)
    chat_history: list[ChatHistoryTurn] = field(default_factory=list)

    @classmethod
    def from_payload(cls, payload: dict[str, Any]) -> "BotRequest":
        role = payload.get("role")
        if role not in ("owner", "admin"):
            raise ValueError("role must be owner or admin")

        text = str(payload.get("text") or payload.get("message") or "").strip()
        if len(text) < 2:
            raise ValueError("text or message is required")

        history_payload = payload.get("chat_history") or payload.get("history") or []
        chat_history: list[ChatHistoryTurn] = []
        if isinstance(history_payload, list):
            for item in history_payload[-8:]:
                if not isinstance(item, dict):
                    continue
                turn_text = str(item.get("text") or "").strip()
                if not turn_text:
                    continue
                chat_history.append(
                    ChatHistoryTurn(
                        from_role=str(item.get("from") or item.get("role") or ""),
                        text=turn_text,
                    ),
                )

        return cls(
            role=role,
            route=str(payload.get("route") or ""),
            text=text,
            screen_context=dict(payload.get("screen_context") or {}),
            available_actions=list(payload.get("available_actions") or []),
            mock_context=dict(payload.get("mock_context") or {}),
            chat_history=chat_history,
        )

    def recent_history_text(self, *, only_user: bool = True, limit: int = 4) -> str:
        values: list[str] = []
        for item in reversed(self.chat_history):
            if only_user and item.from_role not in ("user", "owner", "admin"):
                continue
            values.append(item.text)
            if len(values) >= limit:
                break
        return " ".join(reversed(values))


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
    llm: dict[str, Any] = field(default_factory=dict)

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
            "llm": self.llm,
        }
