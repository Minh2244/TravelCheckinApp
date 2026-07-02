from __future__ import annotations

from typing import Any

from .schemas import ActionPlan, BotRequest, ClassificationResult


def _money(value: Any) -> str:
    try:
        return f"{int(value):,}".replace(",", ".") + "đ"
    except (TypeError, ValueError):
        return "chưa có dữ liệu"


def _percent_diff(current: Any, previous: Any) -> str:
    if not isinstance(current, (int, float)) or not isinstance(previous, (int, float)) or previous <= 0:
        return "mình chưa đủ dữ liệu kỳ trước để kết luận tăng hay giảm"
    diff = ((current - previous) / previous) * 100
    direction = "tăng" if diff >= 0 else "giảm"
    return f"{direction} {abs(diff):.1f}% so với kỳ trước"


def compose_answer(
    request: BotRequest,
    classification: ClassificationResult,
    entities: dict[str, Any],
    action_plan: ActionPlan,
) -> str:
    mock = request.mock_context or {}

    if not classification.allowed:
        return (
            f"Mình không thể làm yêu cầu này vì: {classification.reason} "
            "Mình có thể hướng dẫn bạn tự thao tác ở đúng trang, nhưng sẽ không mở route cấm hoặc tự chạy hành động nhạy cảm."
        )

    if classification.intent in ("small_talk", "unknown"):
        return (
            "Mình đây. Bạn có thể hỏi mình về doanh thu, đánh giá, voucher, xu hướng hoạt động "
            "hoặc nhờ mình soạn bản nháp an toàn trước khi bạn xác nhận."
        )

    if classification.intent in ("owner_revenue_summary", "admin_read_analysis"):
        revenue = mock.get("revenue_this_month")
        previous = mock.get("revenue_last_month")
        best_item = mock.get("best_selling_item")
        trend = _percent_diff(revenue, previous)
        tail = f" Món/dịch vụ nổi bật hiện là {best_item}." if best_item else ""
        return (
            f"Mình xem theo dữ liệu hiện có: doanh thu là {_money(revenue)}, {trend}.{tail} "
            "Nếu bạn muốn, mình có thể tách tiếp theo ngày, theo địa điểm hoặc theo dịch vụ."
        )

    if classification.intent == "owner_review_summary":
        bad_count = mock.get("bad_review_count", 0)
        top_issues = mock.get("top_issues") or ["thái độ phục vụ", "thời gian chờ"]
        return (
            f"Mình thấy có {bad_count} đánh giá xấu trong dữ liệu hiện có. "
            f"Các vấn đề lặp lại nhiều nhất là: {', '.join(map(str, top_issues))}. "
            "Nên ưu tiên phản hồi lịch sự, nhận lỗi phần trải nghiệm và nêu hướng cải thiện rõ ràng."
        )

    if classification.intent == "owner_review_reply_draft":
        return (
            "Mình soạn nháp hướng phản hồi như vầy: Cảm ơn anh/chị đã góp ý. "
            "Quán xin lỗi vì trải nghiệm chưa tốt, đặc biệt ở phần phục vụ/chờ đợi. "
            "Bên mình sẽ kiểm tra lại nội bộ và điều chỉnh để lần sau phục vụ tốt hơn."
        )

    if classification.intent == "owner_review_reply_publish":
        return "Mình chỉ tạo preview phản hồi. Trước khi đăng thật, Backend phải hiển thị bản xem trước và bạn cần xác nhận."

    if classification.intent == "owner_voucher_draft":
        return (
            "Gợi ý nhanh: tạo ưu đãi cuối tuần cho khách quay lại, ví dụ giảm 10-15% hoặc tặng món nhỏ "
            "khi đạt đơn tối thiểu. Mình chỉ soạn bản nháp, chưa tự phát hành voucher."
        )

    if classification.intent == "admin_critical_action":
        return "Đây là thao tác critical của Admin. Cần preview, lý do xử lý và typed confirmation trước khi Backend được phép thực hiện."

    if classification.intent == "admin_write_action":
        return "Đây là thao tác ghi dữ liệu của Admin. Mình chỉ chuẩn bị preview; Backend phải kiểm quyền và yêu cầu xác nhận trước khi execute."

    return "Mình đã hiểu yêu cầu ở mức cơ bản và tạo ActionPlan an toàn để Backend kiểm tra tiếp."
