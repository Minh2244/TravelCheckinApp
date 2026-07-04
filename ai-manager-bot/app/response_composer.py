from __future__ import annotations

from typing import Any

from .schemas import ActionPlan, BotRequest, ClassificationResult


def _pick(context: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        if key in context and context[key] not in (None, ""):
            return context[key]
    return None


def _money(value: Any) -> str:
    try:
        return f"{int(float(value)):,}".replace(",", ".") + "đ"
    except (TypeError, ValueError):
        return "chưa có dữ liệu"


def _percent_diff(current: Any, previous: Any) -> str:
    if not isinstance(current, (int, float)) or not isinstance(previous, (int, float)) or previous <= 0:
        return "mình chưa đủ dữ liệu kỳ trước để kết luận tăng hay giảm"
    diff = ((current - previous) / previous) * 100
    direction = "tăng" if diff >= 0 else "giảm"
    return f"{direction} {abs(diff):.1f}% so với kỳ trước"


def _number(value: Any) -> float | None:
    try:
        parsed = float(value)
        return parsed if parsed == parsed else None
    except (TypeError, ValueError):
        return None


def _monthly_rows(context: dict[str, Any]) -> list[tuple[int, int, float]]:
    rows = context.get("monthlyRevenue")
    if not isinstance(rows, list):
        return []

    normalized_rows: list[tuple[int, int, float]] = []
    for item in rows:
        if not isinstance(item, dict):
            continue

        item_month = _number(item.get("month"))
        item_year = _number(item.get("year"))
        total = _number(item.get("total") or item.get("revenue") or item.get("amount"))

        if item_month is None or total is None:
            month_key = str(item.get("monthKey") or item.get("key") or "")
            parts = month_key.split("-")
            if len(parts) == 2:
                item_year = item_year if item_year is not None else _number(parts[0])
                item_month = item_month if item_month is not None else _number(parts[1])

        if item_month is None or total is None:
            continue

        normalized_rows.append((int(item_year or 0), int(item_month), float(total)))

    return sorted(normalized_rows, key=lambda item: (item[0], item[1]))


def _revenue_from_trend(context: dict[str, Any]) -> tuple[float | None, float | None]:
    trend = context.get("revenueTrend")
    if not isinstance(trend, list) or not trend:
        return None, None

    values: list[float] = []
    for item in trend:
        if not isinstance(item, dict):
            continue
        value = _number(item.get("total") or item.get("DoanhThu") or item.get("revenue"))
        if value is not None:
            values.append(value)

    if not values:
        return None, None

    current = values[-1]
    previous = values[-2] if len(values) >= 2 else None
    return current, previous


def _current_or_previous_month_revenue(
    context: dict[str, Any],
    time_range: str | None,
) -> tuple[float | None, float | None, str | None]:
    rows = _monthly_rows(context)
    if not rows:
        return None, None, None

    if time_range == "last_month":
        current = rows[-2] if len(rows) >= 2 else rows[-1]
        previous = rows[-3][2] if len(rows) >= 3 else None
    else:
        current = rows[-1]
        previous = rows[-2][2] if len(rows) >= 2 else None

    label = f"tháng {current[1]}/{current[0]}" if current[0] > 0 else f"tháng {current[1]}"
    return current[2], previous, label


def _monthly_comparison_text(context: dict[str, Any], months: list[int], target_year: Any = None) -> str | None:
    rows = _monthly_rows(context)
    if not rows:
        return None

    year_int = int(_number(target_year) or 0)
    picked: list[tuple[int, int, float]] = []
    for month in months:
        candidates = [
            row for row in rows if row[1] == month and (year_int <= 0 or row[0] == year_int)
        ]
        if candidates:
            picked.append(candidates[-1])

    if len(picked) < 2:
        return None

    parts = [f"tháng {month}/{year}: {_money(total)}" for year, month, total in picked]
    strongest = max(picked, key=lambda item: item[2])
    weakest = min(picked, key=lambda item: item[2])
    return (
        f"Mình so sánh nhanh các tháng bạn hỏi: {'; '.join(parts)}. "
        f"Cao nhất là tháng {strongest[1]}/{strongest[0]} với {_money(strongest[2])}, "
        f"thấp nhất là tháng {weakest[1]}/{weakest[0]} với {_money(weakest[2])}."
    )


def _cancellation_metrics(
    context: dict[str, Any],
    time_range: str | None,
    target_month: Any = None,
    target_year: Any = None,
) -> tuple[float | None, int | None, int | None, str | None]:
    if target_month is not None:
        rows = context.get("monthlyCancellation")
        month_value = _number(target_month)
        year_value = _number(target_year)
        if isinstance(rows, list) and month_value is not None:
            month_int = int(month_value)
            year_int = int(year_value or 0)
            for item in rows:
                if not isinstance(item, dict):
                    continue
                item_month = int(_number(item.get("month")) or 0)
                item_year = int(_number(item.get("year")) or 0)
                if item_month != month_int:
                    continue
                if year_int > 0 and item_year != year_int:
                    continue
                cancelled = int(_number(item.get("cancelled")) or 0)
                total = int(_number(item.get("total")) or 0)
                rate = (cancelled / total * 100) if total > 0 else 0.0
                label = f"tháng {month_int}/{item_year}" if item_year > 0 else f"tháng {month_int}"
                return rate, cancelled, total, label

    metrics = context.get("cancellationMetrics")
    if isinstance(metrics, dict):
        cancelled = int(_number(metrics.get("cancelled")) or 0)
        total = int(_number(metrics.get("total")) or 0)
        rate = _number(metrics.get("rate"))
        if rate is None:
            rate = (cancelled / total * 100) if total > 0 else 0.0
        period = str(metrics.get("period") or "").strip() or time_range
        return float(rate), cancelled, total, period

    return None, None, None, None


def _monthly_revenue_from_context(
    context: dict[str, Any],
    target_month: Any,
    target_year: Any = None,
) -> tuple[float | None, float | None, str | None]:
    month = _number(target_month)
    if month is None:
        return None, None, None

    month_int = int(month)
    year_int = int(_number(target_year) or 0)
    rows = _monthly_rows(context)
    if not rows:
        return None, None, f"tháng {month_int}"

    matched = [
        row
        for row in rows
        if row[1] == month_int and (year_int <= 0 or row[0] == year_int)
    ]
    if not matched:
        return None, None, f"tháng {month_int}" if year_int <= 0 else f"tháng {month_int}/{year_int}"

    current_year, _, current = matched[-1]
    previous_candidates = [row for row in rows if (row[0], row[1]) < (current_year, month_int)]
    previous = previous_candidates[-1][2] if previous_candidates else None
    label = f"tháng {month_int}" if current_year <= 0 else f"tháng {month_int}/{current_year}"
    return current, previous, label


def _service_trend_answer(context: dict[str, Any], role: str) -> str | None:
    service_revenue = context.get("serviceRevenue")
    if isinstance(service_revenue, list) and service_revenue:
        normalized = []
        for item in service_revenue:
            if not isinstance(item, dict):
                continue
            name = str(item.get("name") or "").strip()
            amount = _number(item.get("amount"))
            percentage = _number(item.get("percentage"))
            if name:
                normalized.append({
                    "name": name,
                    "amount": amount or 0.0,
                    "percentage": percentage or 0.0,
                })
        if normalized:
            weakest = min(normalized, key=lambda item: item["amount"])
            strongest = max(normalized, key=lambda item: item["amount"])
            return (
                f"Mảng đang yếu nhất hiện tại là {weakest['name']} với doanh thu {_money(weakest['amount'])} "
                f"({weakest['percentage']:.0f}%). Mảng mạnh nhất là {strongest['name']} với {_money(strongest['amount'])} "
                f"({strongest['percentage']:.0f}%)."
            )

    service_trends = context.get("serviceTrends")
    if isinstance(service_trends, dict) and service_trends:
        mapped = [
            ("Ăn uống", _number(service_trends.get("restaurant")) or 0.0),
            ("Khách sạn", _number(service_trends.get("hotel")) or 0.0),
            ("Du lịch", _number(service_trends.get("tourist")) or 0.0),
        ]
        weakest = min(mapped, key=lambda item: item[1])
        strongest = max(mapped, key=lambda item: item[1])
        unit = "%" if role == "admin" else ""
        return (
            f"Mảng đang yếu nhất hiện tại là {weakest[0]} với mức {weakest[1]:.0f}{unit}. "
            f"Mảng mạnh nhất là {strongest[0]} với mức {strongest[1]:.0f}{unit}."
        )

    return None


def _capability_answer(request: BotRequest) -> str:
    route = request.route.lower()

    if request.role == "owner":
        if "/owner/reviews" in route:
            focus = (
                "Ở màn đánh giá, mình có thể tóm tắt đánh giá xấu, gom các vấn đề khách hay phàn nàn, "
                "và soạn nháp câu trả lời lịch sự cho từng tình huống."
            )
        elif "/owner/vouchers" in route:
            focus = (
                "Ở màn voucher, mình có thể gợi ý ý tưởng khuyến mãi, soạn nháp nội dung voucher, "
                "và nhắc các điểm cần kiểm tra trước khi bạn tự phát hành."
            )
        else:
            focus = (
                "Ở dashboard owner, mình có thể đọc số liệu doanh thu, xu hướng tăng giảm, tỷ lệ hủy đơn, "
                "so sánh nhiều tháng, nhận diện mảng dịch vụ đang yếu, tóm tắt đánh giá, và gợi ý voucher."
            )
        guard = (
            "Mình không tạo/sửa địa điểm, không tạo/sửa dịch vụ, không vào vận hành/POS, "
            "không chọn vị trí trên bản đồ và không đụng phần chuyển tiền."
        )
        return f"{focus} {guard}"

    if request.role == "admin":
        if "/admin/reviews" in route:
            focus = (
                "Ở màn quản lý đánh giá, mình có thể tổng hợp đánh giá xấu, phát hiện nội dung cần kiểm duyệt, "
                "và chuẩn bị preview thao tác xử lý để bạn xác nhận."
            )
        elif "voucher" in route:
            focus = (
                "Ở màn voucher admin, mình có thể phân tích tình trạng voucher, gợi ý điểm bất thường, "
                "và chuẩn bị preview thao tác duyệt/ẩn nếu có quyền trên màn hình."
            )
        else:
            focus = (
                "Ở dashboard admin, mình có thể đọc tổng quan hệ thống, phân tích doanh thu, so sánh theo tháng, "
                "đọc xu hướng dịch vụ, tỷ lệ hủy đơn nếu màn hình có dữ liệu, và chỉ ra owner/địa điểm cần chú ý."
            )
        guard = (
            "Với thao tác nhạy cảm như khóa tài khoản, duyệt, ẩn hoặc xóa, mình chỉ tạo bản xem trước; "
            "backend vẫn phải kiểm quyền và bạn phải xác nhận rồi mới thực hiện."
        )
        return f"{focus} {guard}"

    return "Mình có thể hỗ trợ đọc dữ liệu và gợi ý thao tác an toàn theo quyền hiện tại của bạn."


def _export_report_answer(
    request: BotRequest,
    entities: dict[str, Any],
    context: dict[str, Any],
    action_plan: ActionPlan,
) -> str:
    target_month = entities.get("target_month")
    target_year = entities.get("target_year")
    period = _pick(context, "period_label", "periodLabel", "range_label", "rangeLabel")
    revenue = None
    previous = None
    requested_period = None

    if target_month is not None:
        revenue, previous, requested_period = _monthly_revenue_from_context(context, target_month, target_year)
    elif entities.get("time_range") in {"this_month", "last_month"}:
        revenue, previous, requested_period = _current_or_previous_month_revenue(context, entities.get("time_range"))

    period_text = requested_period or period or "bộ lọc hiện tại"
    if revenue is None:
        revenue = _pick(context, "totalRevenue", "total_revenue", "revenueToday", "todayRevenue")
    trend = _percent_diff(revenue, previous)
    role_text = "admin" if request.role == "admin" else "owner"

    if action_plan.action_key == "ask_clarification":
        return (
            f"Mình hiểu bạn muốn xuất file báo cáo doanh thu cho {period_text}, "
            "nhưng màn hình hiện tại chưa bật action xuất báo cáo cho AI. "
            "Ở giai đoạn hiện tại mình chỉ có thể đọc số liệu và hướng dẫn bạn bấm nút xuất file trên dashboard."
        )

    return (
        f"Mình có thể chuẩn bị yêu cầu xuất báo cáo cho {role_text} theo {period_text}. "
        f"Dữ liệu đang thấy: doanh thu {_money(revenue)}, {trend}. "
        "Hiện bot mới ở chế độ preview an toàn: mình tạo action plan, còn bước xuất file thật sẽ bật ở phase action có xác nhận/audit."
    )


def compose_answer(
    request: BotRequest,
    classification: ClassificationResult,
    entities: dict[str, Any],
    action_plan: ActionPlan,
) -> str:
    context = {**(request.screen_context or {}), **(request.mock_context or {})}

    if not classification.allowed:
        return (
            f"Mình không thể làm yêu cầu này vì: {classification.reason} "
            "Mình có thể hướng dẫn bạn tự thao tác ở đúng trang, nhưng sẽ không mở route cấm hoặc tự chạy hành động nhạy cảm."
        )

    if classification.intent == "capability_help":
        return _capability_answer(request)

    if classification.intent in ("small_talk", "unknown"):
        return (
            "Mình đây. Bạn có thể hỏi mình về doanh thu, đánh giá, voucher, xu hướng hoạt động "
            "hoặc nhờ mình soạn bản nháp an toàn trước khi bạn xác nhận."
        )

    if classification.intent in ("owner_export_report", "admin_export_report"):
        return _export_report_answer(request, entities, context, action_plan)

    if classification.intent in ("owner_revenue_summary", "admin_read_analysis"):
        if entities.get("metric_focus") == "service_trend":
            service_answer = _service_trend_answer(context, request.role)
            if service_answer:
                return service_answer
            return (
                "Mình hiểu bạn đang hỏi mảng dịch vụ mạnh yếu, nhưng màn hiện tại chưa có đủ dữ liệu cơ cấu dịch vụ để kết luận rõ."
            )

        requested_period = None

        if entities.get("metric_focus") == "cancellation_rate":
            rate, cancelled, total, cancel_period = _cancellation_metrics(
                context,
                entities.get("time_range"),
                entities.get("target_month"),
                entities.get("target_year"),
            )
            if rate is None:
                return (
                    "Mình hiểu bạn đang hỏi về tỷ lệ hủy đơn, nhưng context hiện tại chưa có đủ số liệu hủy và tổng đơn để tính chính xác."
                )
            period_text = cancel_period or _pick(context, "period_label", "periodLabel") or "kỳ hiện tại"
            return (
                f"Mình thấy trong {period_text}, tỷ lệ hủy đơn là {rate:.1f}%, tương ứng {cancelled} đơn hủy trên tổng {total} đơn. "
                "Nếu bạn muốn, mình có thể so tiếp với tháng trước hoặc tách theo từng địa điểm."
            )

        compare_months = entities.get("compare_months")
        if isinstance(compare_months, list) and len(compare_months) >= 2:
            comparison = _monthly_comparison_text(
                context,
                [int(month) for month in compare_months],
                entities.get("target_year"),
            )
            if comparison:
                return comparison
            return (
                "Mình hiểu bạn muốn so sánh nhiều tháng, nhưng màn hiện tại chưa có đủ dữ liệu doanh thu tháng tương ứng để kết luận chính xác."
            )

        target_month = entities.get("target_month")
        if target_month is not None:
            revenue, previous, requested_period = _monthly_revenue_from_context(
                context,
                target_month,
                entities.get("target_year"),
            )
            if revenue is None:
                return (
                    f"Mình hiểu bạn đang hỏi doanh thu {requested_period or f'tháng {target_month}'}, "
                    "nhưng context hiện tại chưa có dữ liệu tháng đó."
                )
        else:
            revenue, previous, requested_period = _current_or_previous_month_revenue(
                context,
                entities.get("time_range"),
            )

        revenue = revenue if revenue is not None else _pick(
            context,
            "revenue_this_month",
            "totalRevenue",
            "total_revenue",
            "revenueToday",
            "todayRevenue",
        )
        previous = previous if previous is not None else _pick(
            context,
            "revenue_last_month",
            "previousRevenue",
            "revenue_previous_period",
            "lastPeriodRevenue",
        )
        if revenue is None:
            revenue, trend_previous = _revenue_from_trend(context)
            previous = previous if previous is not None else trend_previous

        best_item = _pick(context, "best_selling_item", "bestSellingItem", "top_service", "topService")
        period = _pick(context, "period_label", "periodLabel", "range_label", "rangeLabel")
        period = requested_period or period
        trend = _percent_diff(revenue, previous)
        tail = f" Món/dịch vụ nổi bật hiện là {best_item}." if best_item else ""
        period_text = f" trong {period}" if period else ""
        return (
            f"Mình xem theo dữ liệu hiện có{period_text}: doanh thu là {_money(revenue)}, {trend}.{tail} "
            "Nếu bạn muốn, mình có thể tách tiếp theo ngày, theo địa điểm hoặc theo dịch vụ."
        )

    if classification.intent == "owner_review_summary":
        bad_count = _pick(context, "bad_review_count", "badReviewCount", "negative_reviews", "negativeReviews") or 0
        top_issues = _pick(context, "top_issues", "topIssues", "reviewIssues") or ["thái độ phục vụ", "thời gian chờ"]
        return (
            f"Mình thấy có {bad_count} đánh giá xấu trong dữ liệu hiện có. "
            f"Các vấn đề lặp lại nhiều nhất là: {', '.join(map(str, top_issues))}. "
            "Nên ưu tiên phản hồi lịch sự, nhận lỗi phần trải nghiệm và nêu hướng cải thiện rõ ràng."
        )

    if classification.intent == "owner_review_reply_draft":
        return (
            "Mình soạn nháp như vầy: Cảm ơn anh/chị đã góp ý. "
            "Quán xin lỗi vì trải nghiệm chưa tốt, đặc biệt ở phần phục vụ hoặc chờ đợi. "
            "Bên mình sẽ kiểm tra lại nội bộ và điều chỉnh để lần sau phục vụ tốt hơn."
        )

    if classification.intent == "owner_review_reply_publish":
        return "Mình chỉ tạo preview phản hồi. Trước khi đăng thật, backend phải hiển thị bản xem trước và bạn cần xác nhận."

    if classification.intent == "owner_voucher_draft":
        return (
            "Gợi ý nhanh: tạo ưu đãi cuối tuần cho khách quay lại, ví dụ giảm 10-15% hoặc tặng món nhỏ "
            "khi đạt đơn tối thiểu. Mình chỉ soạn bản nháp, chưa tự phát hành voucher."
        )

    if classification.intent == "admin_critical_action":
        return "Đây là thao tác critical của admin. Cần preview, lý do xử lý và xác nhận typed confirmation trước khi backend được phép thực hiện."

    if classification.intent == "admin_write_action":
        return "Đây là thao tác ghi dữ liệu của admin. Mình chỉ chuẩn bị preview; backend phải kiểm quyền và yêu cầu xác nhận trước khi execute."

    return "Mình đã hiểu yêu cầu ở mức cơ bản và tạo action plan an toàn để backend kiểm tra tiếp."
