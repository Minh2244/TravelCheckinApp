from __future__ import annotations

from .policy_labels import (
    ADMIN_CRITICAL,
    ADMIN_READ,
    ADMIN_WRITE,
    BLOCKED_OWNER_ROUTE_PREFIXES,
    OWNER_ALLOWED_DRAFT,
    OWNER_ALLOWED_READ,
    OWNER_ALLOWED_WRITE_SAFE,
    OWNER_BLOCKED_LOCATION_SERVICE_CRUD,
    OWNER_BLOCKED_OPERATIONS,
    OWNER_BLOCKED_SECURITY_FINANCE,
    SMALL_TALK,
    UNKNOWN,
)
from .schemas import BotRequest, ClassificationResult
from .text_normalizer import contains_any, normalize_text


OWNER_OPERATION_TERMS = (
    "front office",
    "frontoffice",
    "pos",
    "van hanh",
    "xac nhan don",
    "tu choi don",
    "huy don",
    "check in",
    "checkin",
    "check out",
    "checkout",
    "quet ve",
    "ban ve tai quay",
    "thanh toan tai quay",
    "mo ban",
    "chuyen ban",
    "doi phong",
    "ban so",
    "phong so",
    "dat ban",
    "dat phong",
    "ban ve",
    "doi phong",
)

OWNER_LOCATION_SERVICE_CRUD_TERMS = (
    "tao dia diem",
    "them dia diem",
    "sua dia diem",
    "xoa dia diem",
    "an dia diem",
    "tao dich vu",
    "them dich vu",
    "sua dich vu",
    "xoa dich vu",
    "tao mon",
    "them mon",
    "sua mon",
    "xoa mon",
    "tao phong",
    "them phong",
    "sua phong",
    "xoa phong",
    "tao ve",
    "them ve",
    "sua ve",
    "xoa ve",
    "so do van hanh",
    "cau hinh so do",
    "them dv",
    "tao dv",
    "sua dv",
    "xoa dv",
    "them dd",
    "tao dd",
    "sua dd",
    "xoa dd",
)

SECURITY_FINANCE_TERMS = (
    "tai khoan ngan hang",
    "ngan hang",
    "mat khau",
    "otp",
    "phan quyen",
    "nhan vien",
    "bao mat",
    "doi email dang nhap",
    "so tai khoan",
    "stk",
    "cap quyen",
)

REVIEW_TERMS = ("review", "danh gia", "1 sao", "sao xau", "phan hoi", "phan nan", "khach chui", "feedback", "comment")
REVIEW_REPLY_TERMS = ("soan", "viet", "tra loi", "phan hoi", "rep")
REVIEW_COMPLAINT_TERMS = ("che", "phuc vu lau", "phuc vu cham", "khach chui", "phan nan")
REVENUE_TERMS = (
    "doanh thu",
    "doanh so",
    "bao cao",
    "thong ke",
    "xu huong",
    "tang giam",
    "tang hay giam",
    "giam manh",
    "so sanh",
    "doi chieu",
    "ban chay",
    "tien",
    "loi nhuan",
    "mang dich vu nao dang yeu",
    "dich vu nao dang yeu",
    "mang nao dang yeu",
    "nhom dich vu nao dang yeu",
    "dich vu nao yeu",
    "mang nao kem",
    "nhom nao kem",
    "dich vu nao kem",
)
CANCELLATION_ANALYSIS_TERMS = (
    "ty le huy",
    "ti le huy",
    "huy don bao nhieu",
    "bao nhieu don huy",
    "ti le huy don",
    "ty le huy don",
    "cancel rate",
    "cancellation rate",
    "don huy thang nay",
    "huy don thang nay",
    "huy don thang truoc",
)
EXPORT_REPORT_TERMS = (
    "xuat file",
    "xuat bao cao",
    "xuat hoa don",
    "xuat excel",
    "tai file",
    "tai bao cao",
    "download bao cao",
    "export",
    "bao cao doanh thu",
    "file bao cao",
)
VOUCHER_TERMS = ("voucher", "khuyen mai", "ma giam", "uu dai", "sale", "deal", "giam gia")
WRITE_TERMS = ("dang", "gui", "luu", "tao", "sua", "an", "duyet", "tu choi", "khoa", "mo khoa", "xoa")
ADMIN_CRITICAL_TERMS = ("khoa user", "khoa tai khoan", "xoa user", "xoa tai khoan", "xoa owner", "doi quyen", "phan quyen", "commission", "hoa hong", "hoa khong", "khoa tk", "xoa tk")
ADMIN_WRITE_TERMS = ("duyet", "tu choi", "an dia diem", "mo khoa", "cap nhat", "sua", "xoa")
SMALL_TALK_TERMS = ("hello", "hi", "alo", "chao", "cam on", "thanks", "hoi chan", "noi chuyen", "tam chut")
CAPABILITY_TERMS = (
    "co the lam gi",
    "lam duoc gi",
    "giup duoc gi",
    "giup gi",
    "lam gi duoc",
    "bot lam gi",
    "bot lam duoc gi",
    "tro ly lam gi",
    "tro ly lam duoc gi",
    "ai lam gi",
    "ai lam duoc gi",
    "ban lam gi",
    "ban lam duoc gi",
    "ban co the giup gi",
    "ban co the lam gi",
    "chuc nang cua ban",
    "huong dan tui",
)


INTENT_PROFILES: dict[tuple[str, str], dict[str, object]] = {
    ("owner", "capability_help"): {
        "label": SMALL_TALK,
        "allowed": True,
        "risk_level": "read",
    },
    ("owner", "small_talk"): {
        "label": SMALL_TALK,
        "allowed": True,
        "risk_level": "read",
    },
    ("owner", "owner_revenue_summary"): {
        "label": OWNER_ALLOWED_READ,
        "allowed": True,
        "risk_level": "read",
    },
    ("owner", "owner_review_summary"): {
        "label": OWNER_ALLOWED_READ,
        "allowed": True,
        "risk_level": "read",
    },
    ("owner", "owner_review_reply_draft"): {
        "label": OWNER_ALLOWED_DRAFT,
        "allowed": True,
        "risk_level": "low",
    },
    ("owner", "owner_review_reply_publish"): {
        "label": OWNER_ALLOWED_WRITE_SAFE,
        "allowed": True,
        "risk_level": "medium",
    },
    ("owner", "owner_voucher_draft"): {
        "label": OWNER_ALLOWED_DRAFT,
        "allowed": True,
        "risk_level": "low",
    },
    ("owner", "owner_export_report"): {
        "label": OWNER_ALLOWED_WRITE_SAFE,
        "allowed": True,
        "risk_level": "low",
    },
    ("owner", "unknown"): {
        "label": UNKNOWN,
        "allowed": False,
        "risk_level": "read",
    },
    ("admin", "capability_help"): {
        "label": SMALL_TALK,
        "allowed": True,
        "risk_level": "read",
    },
    ("admin", "small_talk"): {
        "label": SMALL_TALK,
        "allowed": True,
        "risk_level": "read",
    },
    ("admin", "admin_read_analysis"): {
        "label": ADMIN_READ,
        "allowed": True,
        "risk_level": "read",
    },
    ("admin", "admin_export_report"): {
        "label": ADMIN_WRITE,
        "allowed": True,
        "risk_level": "low",
    },
    ("admin", "admin_write_action"): {
        "label": ADMIN_WRITE,
        "allowed": True,
        "risk_level": "medium",
    },
    ("admin", "admin_critical_action"): {
        "label": ADMIN_CRITICAL,
        "allowed": True,
        "risk_level": "critical",
    },
    ("admin", "unknown"): {
        "label": UNKNOWN,
        "allowed": False,
        "risk_level": "read",
    },
}


def classification_from_intent(
    role: str,
    intent: str,
    *,
    confidence: float,
    reason: str,
) -> ClassificationResult | None:
    profile = INTENT_PROFILES.get((role, intent))
    if not profile:
        return None
    return ClassificationResult(
        intent=intent,
        label=str(profile["label"]),
        confidence=confidence,
        allowed=bool(profile["allowed"]),
        risk_level=str(profile["risk_level"]),
        reason=reason,
    )


def _owner_route_blocked(route: str) -> bool:
    normalized_route = route.lower().strip()
    return any(normalized_route.startswith(prefix) for prefix in BLOCKED_OWNER_ROUTE_PREFIXES)


def classify_request(request: BotRequest) -> ClassificationResult:
    normalized = normalize_text(request.text)
    history_normalized = normalize_text(request.recent_history_text())
    contextual = normalized if not history_normalized else f"{history_normalized} {normalized}"

    if contains_any(normalized, CAPABILITY_TERMS):
        return ClassificationResult(
            intent="capability_help",
            label=SMALL_TALK,
            confidence=0.92,
            allowed=True,
            risk_level="read",
            reason="Nguoi dung hoi AI co the ho tro nhung gi tren man hinh hien tai.",
        )

    if contains_any(normalized, SMALL_TALK_TERMS):
        return ClassificationResult(
            intent="small_talk",
            label=SMALL_TALK,
            confidence=0.75,
            allowed=True,
            risk_level="read",
            reason="Small talk hoac loi chao thong thuong.",
        )

    if request.role == "owner":
        if _owner_route_blocked(request.route):
            return ClassificationResult(
                intent="owner_blocked_route",
                label=OWNER_BLOCKED_OPERATIONS,
                confidence=0.99,
                allowed=False,
                risk_level="blocked",
                reason="Owner AI khong duoc hoat dong trong route van hanh.",
            )

        if "voucher" in request.route.lower() and contains_any(contextual, VOUCHER_TERMS):
            return ClassificationResult(
                intent="owner_voucher_draft",
                label=OWNER_ALLOWED_DRAFT,
                confidence=0.8,
                allowed=True,
                risk_level="low",
                reason="AI chi soan nhap voucher, khong tu publish.",
            )

        if contains_any(contextual, OWNER_LOCATION_SERVICE_CRUD_TERMS):
            return ClassificationResult(
                intent="owner_blocked_location_service_crud",
                label=OWNER_BLOCKED_LOCATION_SERVICE_CRUD,
                confidence=0.96,
                allowed=False,
                risk_level="blocked",
                reason="Owner AI khong duoc tao/sua/xoa dia diem hoac dich vu.",
            )

        if contains_any(contextual, CANCELLATION_ANALYSIS_TERMS):
            return ClassificationResult(
                intent="owner_revenue_summary",
                label=OWNER_ALLOWED_READ,
                confidence=0.84,
                allowed=True,
                risk_level="read",
                reason="Phan tich ti le huy don duoc phep.",
            )

        if contains_any(contextual, OWNER_OPERATION_TERMS):
            return ClassificationResult(
                intent="owner_blocked_operations",
                label=OWNER_BLOCKED_OPERATIONS,
                confidence=0.97,
                allowed=False,
                risk_level="blocked",
                reason="Yeu cau thuoc nhom van hanh/POS/booking bi cam cho Owner AI.",
            )

        if contains_any(contextual, SECURITY_FINANCE_TERMS):
            return ClassificationResult(
                intent="owner_blocked_security_finance",
                label=OWNER_BLOCKED_SECURITY_FINANCE,
                confidence=0.96,
                allowed=False,
                risk_level="blocked",
                reason="Yeu cau thuoc nhom bao mat/tai chinh bi chan.",
            )

        if contains_any(contextual, EXPORT_REPORT_TERMS):
            return ClassificationResult(
                intent="owner_export_report",
                label=OWNER_ALLOWED_WRITE_SAFE,
                confidence=0.88,
                allowed=True,
                risk_level="low",
                reason="Xuat bao cao la action doc/xuat file, can preview va xac nhan truoc khi thuc hien.",
            )

        if (
            contains_any(contextual, REVIEW_TERMS + REVIEW_COMPLAINT_TERMS)
            and contains_any(contextual, REVIEW_REPLY_TERMS)
        ):
            if contains_any(contextual, ("dang", "gui luon", "luu luon")):
                return ClassificationResult(
                    intent="owner_review_reply_publish",
                    label=OWNER_ALLOWED_WRITE_SAFE,
                    confidence=0.86,
                    allowed=True,
                    risk_level="medium",
                    reason="Dang phan hoi review can preview va confirmation.",
                )
            return ClassificationResult(
                intent="owner_review_reply_draft",
                label=OWNER_ALLOWED_DRAFT,
                confidence=0.88,
                allowed=True,
                risk_level="low",
                reason="Soan ban nhap phan hoi review duoc phep.",
            )

        if contains_any(contextual, REVIEW_TERMS):
            return ClassificationResult(
                intent="owner_review_summary",
                label=OWNER_ALLOWED_READ,
                confidence=0.88,
                allowed=True,
                risk_level="read",
                reason="Doc va tom tat review duoc phep.",
            )

        if contains_any(contextual, REVENUE_TERMS + CANCELLATION_ANALYSIS_TERMS):
            return ClassificationResult(
                intent="owner_revenue_summary",
                label=OWNER_ALLOWED_READ,
                confidence=0.86,
                allowed=True,
                risk_level="read",
                reason="Phan tich doanh thu tong hop duoc phep.",
            )

        if contains_any(contextual, VOUCHER_TERMS):
            return ClassificationResult(
                intent="owner_voucher_draft",
                label=OWNER_ALLOWED_DRAFT,
                confidence=0.8,
                allowed=True,
                risk_level="low",
                reason="AI chi soan nhap voucher, khong tu publish.",
            )

    if request.role == "admin":
        if contains_any(contextual, ADMIN_CRITICAL_TERMS):
            return ClassificationResult(
                intent="admin_critical_action",
                label=ADMIN_CRITICAL,
                confidence=0.9,
                allowed=True,
                risk_level="critical",
                reason="Admin critical action can preview + typed confirmation.",
            )

        if contains_any(contextual, EXPORT_REPORT_TERMS):
            return ClassificationResult(
                intent="admin_export_report",
                label=ADMIN_WRITE,
                confidence=0.88,
                allowed=True,
                risk_level="low",
                reason="Admin xuat bao cao la action tao file/doc du lieu va can action handler rieng.",
            )

        if contains_any(contextual, ADMIN_WRITE_TERMS):
            return ClassificationResult(
                intent="admin_write_action",
                label=ADMIN_WRITE,
                confidence=0.82,
                allowed=True,
                risk_level="medium",
                reason="Admin write action can run only after preview and confirmation.",
            )

        if contains_any(contextual, REVENUE_TERMS + REVIEW_TERMS + VOUCHER_TERMS + CANCELLATION_ANALYSIS_TERMS):
            return ClassificationResult(
                intent="admin_read_analysis",
                label=ADMIN_READ,
                confidence=0.82,
                allowed=True,
                risk_level="read",
                reason="Admin read/analysis request.",
            )

    return ClassificationResult(
        intent="unknown",
        label=UNKNOWN,
        confidence=0.45,
        allowed=False,
        risk_level="read",
        reason="Bot chua du du lieu de hieu chac yeu cau.",
    )
