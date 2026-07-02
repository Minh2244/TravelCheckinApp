from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from .policy_labels import BLOCKED_OWNER_ROUTE_PREFIXES


Role = Literal["owner", "admin"]


@dataclass(frozen=True)
class PromptSuggestion:
    id: str
    title: str
    prompt: str
    intent_hint: str
    risk_level: str
    requires_confirmation: bool
    route_prefixes: tuple[str, ...] = ()

    def to_dict(self) -> dict[str, object]:
        return {
            "id": self.id,
            "title": self.title,
            "prompt": self.prompt,
            "intent_hint": self.intent_hint,
            "risk_level": self.risk_level,
            "requires_confirmation": self.requires_confirmation,
        }


OWNER_COMMON = (
    PromptSuggestion(
        id="owner_common_revenue",
        title="Doanh thu hôm nay",
        prompt="Hôm nay doanh thu quán tăng hay giảm?",
        intent_hint="owner_revenue_summary",
        risk_level="read",
        requires_confirmation=False,
    ),
    PromptSuggestion(
        id="owner_common_review_bad",
        title="Tóm tắt đánh giá xấu",
        prompt="Tóm tắt giúp tui các đánh giá xấu gần đây",
        intent_hint="owner_review_summary",
        risk_level="read",
        requires_confirmation=False,
    ),
    PromptSuggestion(
        id="owner_common_voucher",
        title="Gợi ý voucher",
        prompt="Gợi ý giúp tui voucher cuối tuần",
        intent_hint="owner_voucher_draft",
        risk_level="low",
        requires_confirmation=False,
    ),
)

OWNER_BY_ROUTE = (
    PromptSuggestion(
        id="owner_dashboard_trend",
        title="Tháng này tăng hay giảm?",
        prompt="Tháng này doanh thu tăng hay giảm so với tháng trước?",
        intent_hint="owner_revenue_summary",
        risk_level="read",
        requires_confirmation=False,
        route_prefixes=("/owner/dashboard",),
    ),
    PromptSuggestion(
        id="owner_reviews_reply",
        title="Soạn phản hồi review",
        prompt="Khách chê phục vụ lâu quá, soạn giúp tui câu trả lời lịch sự",
        intent_hint="owner_review_reply_draft",
        risk_level="low",
        requires_confirmation=False,
        route_prefixes=("/owner/reviews",),
    ),
    PromptSuggestion(
        id="owner_vouchers_weekend",
        title="Ưu đãi cuối tuần",
        prompt="Soạn giúp tui ý tưởng khuyến mãi cuối tuần",
        intent_hint="owner_voucher_draft",
        risk_level="low",
        requires_confirmation=False,
        route_prefixes=("/owner/vouchers",),
    ),
)

ADMIN_COMMON = (
    PromptSuggestion(
        id="admin_common_system_revenue",
        title="Doanh thu hệ thống",
        prompt="Tổng quan doanh thu toàn hệ thống hôm nay",
        intent_hint="admin_read_analysis",
        risk_level="read",
        requires_confirmation=False,
    ),
    PromptSuggestion(
        id="admin_common_bad_locations",
        title="Địa điểm bị đánh giá xấu",
        prompt="Địa điểm nào đang bị đánh giá xấu nhiều?",
        intent_hint="admin_read_analysis",
        risk_level="read",
        requires_confirmation=False,
    ),
    PromptSuggestion(
        id="admin_common_lock_user_preview",
        title="Preview khóa user",
        prompt="Kiểm tra và tạo preview khóa tài khoản user này",
        intent_hint="admin_critical_action",
        risk_level="critical",
        requires_confirmation=True,
    ),
)

ADMIN_BY_ROUTE = (
    PromptSuggestion(
        id="admin_users_suspicious",
        title="Kiểm tra user bất thường",
        prompt="Tóm tắt hoạt động bất thường của user này",
        intent_hint="admin_read_analysis",
        risk_level="read",
        requires_confirmation=False,
        route_prefixes=("/admin/users",),
    ),
    PromptSuggestion(
        id="admin_reviews_pending",
        title="Hồ sơ chờ duyệt",
        prompt="Tóm tắt hồ sơ địa điểm hoặc dịch vụ đang chờ duyệt",
        intent_hint="admin_read_analysis",
        risk_level="read",
        requires_confirmation=False,
        route_prefixes=("/admin/locations", "/admin/services"),
    ),
)


def owner_route_is_blocked(route: str) -> bool:
    normalized = route.lower().strip()
    return any(normalized.startswith(prefix) for prefix in BLOCKED_OWNER_ROUTE_PREFIXES)


def _matches_route(suggestion: PromptSuggestion, route: str) -> bool:
    if not suggestion.route_prefixes:
        return True
    normalized = route.lower().strip()
    return any(normalized.startswith(prefix) for prefix in suggestion.route_prefixes)


def get_prompt_suggestions(role: str, route: str) -> dict[str, object]:
    if role not in ("owner", "admin"):
        raise ValueError("role must be owner or admin")

    if role == "owner" and owner_route_is_blocked(route):
        return {
            "role": role,
            "route": route,
            "suggestions": [],
            "disabled_reason": "OWNER_AI_DISABLED_ON_OPERATIONS_ROUTE",
        }

    source = (
        (*OWNER_BY_ROUTE, *OWNER_COMMON)
        if role == "owner"
        else (*ADMIN_BY_ROUTE, *ADMIN_COMMON)
    )
    suggestions = [item.to_dict() for item in source if _matches_route(item, route)]
    return {
        "role": role,
        "route": route,
        "suggestions": suggestions[:6],
        "disabled_reason": None,
    }

