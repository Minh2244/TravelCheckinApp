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
        id="owner_common_revenue_today",
        title="Doanh thu hom nay",
        prompt="Hom nay doanh thu quan tang hay giam?",
        intent_hint="owner_revenue_summary",
        risk_level="read",
        requires_confirmation=False,
    ),
    PromptSuggestion(
        id="owner_common_revenue_month",
        title="Doanh thu thang nay",
        prompt="Doanh thu thang nay sao roi?",
        intent_hint="owner_revenue_summary",
        risk_level="read",
        requires_confirmation=False,
    ),
    PromptSuggestion(
        id="owner_common_cancel_rate",
        title="Ti le huy don",
        prompt="Ti le huy don thang nay va thang truoc sao roi?",
        intent_hint="owner_revenue_summary",
        risk_level="read",
        requires_confirmation=False,
    ),
    PromptSuggestion(
        id="owner_common_review_bad",
        title="Tom tat danh gia xau",
        prompt="Tom tat giup tui cac danh gia xau gan day",
        intent_hint="owner_review_summary",
        risk_level="read",
        requires_confirmation=False,
    ),
    PromptSuggestion(
        id="owner_common_voucher",
        title="Goi y voucher",
        prompt="Goi y giup tui voucher cuoi tuan",
        intent_hint="owner_voucher_draft",
        risk_level="low",
        requires_confirmation=False,
    ),
)

OWNER_BY_ROUTE = (
    PromptSuggestion(
        id="owner_dashboard_trend",
        title="Thang nay tang hay giam",
        prompt="Thang nay doanh thu tang hay giam so voi thang truoc?",
        intent_hint="owner_revenue_summary",
        risk_level="read",
        requires_confirmation=False,
        route_prefixes=("/owner/dashboard",),
    ),
    PromptSuggestion(
        id="owner_reviews_reply",
        title="Soan phan hoi review",
        prompt="Khach che phuc vu lau qua, soan giup tui cau tra loi lich su",
        intent_hint="owner_review_reply_draft",
        risk_level="low",
        requires_confirmation=False,
        route_prefixes=("/owner/reviews",),
    ),
    PromptSuggestion(
        id="owner_vouchers_weekend",
        title="Uu dai cuoi tuan",
        prompt="Soan giup tui y tuong khuyen mai cuoi tuan",
        intent_hint="owner_voucher_draft",
        risk_level="low",
        requires_confirmation=False,
        route_prefixes=("/owner/vouchers",),
    ),
)

ADMIN_COMMON = (
    PromptSuggestion(
        id="admin_common_system_revenue",
        title="Tong quan doanh thu",
        prompt="Tong quan doanh thu toan he thong hom nay",
        intent_hint="admin_read_analysis",
        risk_level="read",
        requires_confirmation=False,
    ),
    PromptSuggestion(
        id="admin_common_month_revenue",
        title="Doanh thu thang nay",
        prompt="Doanh thu thang nay cua he thong sao roi?",
        intent_hint="admin_read_analysis",
        risk_level="read",
        requires_confirmation=False,
    ),
    PromptSuggestion(
        id="admin_common_cancel_rate",
        title="Ti le huy don",
        prompt="Ti le huy don thang nay va thang truoc the nao?",
        intent_hint="admin_read_analysis",
        risk_level="read",
        requires_confirmation=False,
    ),
    PromptSuggestion(
        id="admin_common_bad_locations",
        title="Dia diem bi danh gia xau",
        prompt="Dia diem nao dang bi danh gia xau nhieu?",
        intent_hint="admin_read_analysis",
        risk_level="read",
        requires_confirmation=False,
    ),
)

ADMIN_BY_ROUTE = (
    PromptSuggestion(
        id="admin_dashboard_trend",
        title="Xu huong he thong",
        prompt="Tom tat xu huong doanh thu va hoat dong he thong hom nay",
        intent_hint="admin_read_analysis",
        risk_level="read",
        requires_confirmation=False,
        route_prefixes=("/admin/dashboard",),
    ),
    PromptSuggestion(
        id="admin_reviews_summary",
        title="Tom tat danh gia",
        prompt="Tom tat cac danh gia xau va dia diem can chu y",
        intent_hint="admin_read_analysis",
        risk_level="read",
        requires_confirmation=False,
        route_prefixes=("/admin/reviews",),
    ),
    PromptSuggestion(
        id="admin_vouchers_summary",
        title="Kiem tra voucher",
        prompt="Tom tat tinh hinh voucher va goi y diem can kiem tra",
        intent_hint="admin_read_analysis",
        risk_level="read",
        requires_confirmation=False,
        route_prefixes=("/admin/vouchers", "/admin/system-vouchers", "/admin/owner-vouchers"),
    ),
    PromptSuggestion(
        id="admin_users_suspicious",
        title="Kiem tra user bat thuong",
        prompt="Tom tat hoat dong bat thuong cua user nay",
        intent_hint="admin_read_analysis",
        risk_level="read",
        requires_confirmation=False,
        route_prefixes=("/admin/users",),
    ),
    PromptSuggestion(
        id="admin_users_lock_preview",
        title="Preview khoa user",
        prompt="Kiem tra va tao preview khoa tai khoan user nay",
        intent_hint="admin_critical_action",
        risk_level="critical",
        requires_confirmation=True,
        route_prefixes=("/admin/users",),
    ),
    PromptSuggestion(
        id="admin_reviews_pending",
        title="Ho so cho duyet",
        prompt="Tom tat ho so dia diem hoac dich vu dang cho duyet",
        intent_hint="admin_read_analysis",
        risk_level="read",
        requires_confirmation=False,
        route_prefixes=("/admin/locations", "/admin/owner-services"),
    ),
    PromptSuggestion(
        id="admin_owners_attention",
        title="Owner can chu y",
        prompt="Tom tat owner nao can chu y va vi sao",
        intent_hint="admin_read_analysis",
        risk_level="read",
        requires_confirmation=False,
        route_prefixes=("/admin/owners",),
    ),
    PromptSuggestion(
        id="admin_export_report",
        title="Xuat bao cao",
        prompt="Xuat file bao cao cho bo loc hien tai",
        intent_hint="admin_export_report",
        risk_level="low",
        requires_confirmation=True,
        route_prefixes=(
            "/admin/dashboard",
            "/admin/locations",
            "/admin/reviews",
            "/admin/vouchers",
            "/admin/system-vouchers",
            "/admin/owner-vouchers",
        ),
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

    source = (*OWNER_BY_ROUTE, *OWNER_COMMON) if role == "owner" else (*ADMIN_BY_ROUTE, *ADMIN_COMMON)
    suggestions = [item.to_dict() for item in source if _matches_route(item, route)]
    return {
        "role": role,
        "route": route,
        "suggestions": suggestions[:6],
        "disabled_reason": None,
    }
