from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

BLOCKED_OWNER_ROUTE_PREFIXES = (
    "/owner/front-office",
    "/owner/pos",
    "/owner/hotel",
    "/owner/tourist",
    "/owner/employees",
    "/owner/bank",
    "/owner/commissions"
)


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
        title="Doanh thu hôm nay",
        prompt="Hôm nay doanh thu quán tăng hay giảm?",
        intent_hint="owner_revenue_summary",
        risk_level="read",
        requires_confirmation=False,
    ),
    PromptSuggestion(
        id="owner_common_revenue_month",
        title="Doanh thu tháng này",
        prompt="Doanh thu tháng này sao roi?",
        intent_hint="owner_revenue_summary",
        risk_level="read",
        requires_confirmation=False,
    ),
    PromptSuggestion(
        id="owner_common_cancel_rate",
        title="Tỉ lệ hủy đơn",
        prompt="Tỉ lệ hủy đơn thang nay va thang truoc sao roi?",
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
        title="Tháng này tăng hay giảm",
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
        title="Tổng quan doanh thu",
        prompt="Tổng quan doanh thu toan he thong hom nay",
        intent_hint="admin_read_analysis",
        risk_level="read",
        requires_confirmation=False,
    ),
    PromptSuggestion(
        id="admin_common_month_revenue",
        title="Doanh thu tháng này",
        prompt="Doanh thu tháng này cua he thong sao roi?",
        intent_hint="admin_read_analysis",
        risk_level="read",
        requires_confirmation=False,
    ),
    PromptSuggestion(
        id="admin_common_cancel_rate",
        title="Tỉ lệ hủy đơn",
        prompt="Tỉ lệ hủy đơn thang nay va thang truoc the nao?",
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
)

ADMIN_BY_ROUTE = (
    PromptSuggestion(
        id="admin_dashboard_trend",
        title="Xu hướng hệ thống",
        prompt="Tóm tắt xu hướng doanh thu và hoạt động hệ thống hôm nay",
        intent_hint="admin_read_analysis",
        risk_level="read",
        requires_confirmation=False,
        route_prefixes=("/admin/dashboard",),
    ),
    PromptSuggestion(
        id="admin_reviews_summary",
        title="Tóm tắt đánh giá",
        prompt="Tóm tắt các đánh giá xấu và địa điểm cần chú ý",
        intent_hint="admin_read_analysis",
        risk_level="read",
        requires_confirmation=False,
        route_prefixes=("/admin/reviews",),
    ),
    PromptSuggestion(
        id="admin_vouchers_summary",
        title="Kiểm tra voucher",
        prompt="Tóm tắt tình hình voucher và gợi ý điểm cần kiểm tra",
        intent_hint="admin_read_analysis",
        risk_level="read",
        requires_confirmation=False,
        route_prefixes=("/admin/vouchers", "/admin/system-vouchers", "/admin/owner-vouchers"),
    ),
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
        id="admin_users_lock_preview",
        title="Preview khóa user",
        prompt="Kiểm tra và tạo preview khóa tài khoản user này",
        intent_hint="admin_critical_action",
        risk_level="critical",
        requires_confirmation=True,
        route_prefixes=("/admin/users",),
    ),
    PromptSuggestion(
        id="admin_reviews_pending",
        title="Hồ sơ chờ duyệt",
        prompt="Tóm tắt hồ sơ địa điểm hoặc dịch vụ đang chờ duyệt",
        intent_hint="admin_read_analysis",
        risk_level="read",
        requires_confirmation=False,
        route_prefixes=("/admin/locations", "/admin/owner-services"),
    ),
    PromptSuggestion(
        id="admin_owners_attention",
        title="Owner cần chú ý",
        prompt="Tóm tắt owner nào cần chú ý và vì sao",
        intent_hint="admin_read_analysis",
        risk_level="read",
        requires_confirmation=False,
        route_prefixes=("/admin/owners",),
    ),
    PromptSuggestion(
        id="admin_export_report",
        title="Xuất báo cáo",
        prompt="Xuất file báo cáo cho bộ lọc hiện tại",
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
        "suggestions": suggestions[:4],
        "disabled_reason": None,
    }
