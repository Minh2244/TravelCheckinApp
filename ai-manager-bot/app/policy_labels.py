from __future__ import annotations

from dataclasses import dataclass


OWNER_ALLOWED_READ = "owner_allowed_read"
OWNER_ALLOWED_DRAFT = "owner_allowed_draft"
OWNER_ALLOWED_WRITE_SAFE = "owner_allowed_write_safe"
OWNER_BLOCKED_OPERATIONS = "owner_blocked_operations"
OWNER_BLOCKED_LOCATION_SERVICE_CRUD = "owner_blocked_location_service_crud"
OWNER_BLOCKED_SECURITY_FINANCE = "owner_blocked_security_finance"
ADMIN_READ = "admin_read"
ADMIN_WRITE = "admin_write"
ADMIN_CRITICAL = "admin_critical"
SMALL_TALK = "small_talk_admin_owner"
UNKNOWN = "unknown"


BLOCKED_OWNER_ROUTE_PREFIXES = (
    "/owner/front-office",
    "/owner/navigate",
    "/owner/location-ops",
    "/employee/front-office",
    "/owner/bookings",
    "/owner/payments",
)


@dataclass(frozen=True)
class ActionDefinition:
    action_key: str
    label: str
    risk_level: str
    requires_confirmation: bool
    allowed_roles: tuple[str, ...]


ACTION_CATALOG: dict[str, ActionDefinition] = {
    "owner_revenue_summary": ActionDefinition(
        action_key="owner_revenue_summary",
        label="Tong hop doanh thu owner",
        risk_level="read",
        requires_confirmation=False,
        allowed_roles=("owner",),
    ),
    "owner_review_summary": ActionDefinition(
        action_key="owner_review_summary",
        label="Tom tat danh gia owner",
        risk_level="read",
        requires_confirmation=False,
        allowed_roles=("owner",),
    ),
    "owner_review_reply_draft": ActionDefinition(
        action_key="owner_review_reply_draft",
        label="Soan nhap phan hoi review",
        risk_level="low",
        requires_confirmation=False,
        allowed_roles=("owner",),
    ),
    "owner_review_reply_publish": ActionDefinition(
        action_key="owner_review_reply_publish",
        label="Dang phan hoi review",
        risk_level="medium",
        requires_confirmation=True,
        allowed_roles=("owner",),
    ),
    "owner_voucher_draft": ActionDefinition(
        action_key="owner_voucher_draft",
        label="Soan nhap voucher",
        risk_level="low",
        requires_confirmation=False,
        allowed_roles=("owner",),
    ),
    "admin_revenue_analysis": ActionDefinition(
        action_key="admin_revenue_analysis",
        label="Phan tich doanh thu he thong",
        risk_level="read",
        requires_confirmation=False,
        allowed_roles=("admin",),
    ),
    "admin_location_review": ActionDefinition(
        action_key="admin_location_review",
        label="Xem/xu ly dia diem admin",
        risk_level="medium",
        requires_confirmation=True,
        allowed_roles=("admin",),
    ),
    "admin_user_lock": ActionDefinition(
        action_key="admin_user_lock",
        label="Khoa tai khoan user",
        risk_level="critical",
        requires_confirmation=True,
        allowed_roles=("admin",),
    ),
    "blocked": ActionDefinition(
        action_key="blocked",
        label="Bi chan boi policy",
        risk_level="blocked",
        requires_confirmation=False,
        allowed_roles=("owner", "admin"),
    ),
    "ask_clarification": ActionDefinition(
        action_key="ask_clarification",
        label="Hoi lai de lam ro",
        risk_level="read",
        requires_confirmation=False,
        allowed_roles=("owner", "admin"),
    ),
}

