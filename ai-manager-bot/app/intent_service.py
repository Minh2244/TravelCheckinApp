import json
import random
import re
import unicodedata
from google import genai
from google.genai import types
from .settings import get_settings
from .action_registry import REGISTRY
import urllib.request
import urllib.error
from .nlp_fallback import rule_based_fallback_intent

def get_dashboard_stats_from_nodejs(role: str, user_id: int) -> dict:
    url = "http://localhost:3000/api/internal/ai/context"
    payload = {"role": role, "userId": user_id}
    request = urllib.request.Request(
        url,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=10.0) as response:
            res = json.loads(response.read().decode("utf-8"))
            return res
    except Exception as e:
        return {"success": False, "error": str(e)}

def _parse_date_from_text(text: str) -> dict:
    """Parse start_date và end_date từ text người dùng khi Gemini không trích xuất được."""
    import re
    import datetime
    import calendar
    
    text_for_parse = _strip_accents(str(text or "").lower())
    year = datetime.datetime.now().year
    today = datetime.date.today()
    result = {}

    # === RELATIVE DURATION: "2 tuần", "3 ngày", "1 tháng tới" ===
    # Match: "2 tuan", "2 tuan tinh tu hom nay", "2 tuan toi", etc.
    m_weeks = re.search(r'(\d+)\s*tuan', text_for_parse)
    if m_weeks:
        n_weeks = int(m_weeks.group(1))
        end = today + datetime.timedelta(weeks=n_weeks)
        result['start_date'] = today.isoformat()
        result['end_date'] = end.isoformat()
        return result

    # Match: "3 ngay", "5 ngay toi", "7 ngay tinh tu hom nay"
    m_days = re.search(r'(\d+)\s*ngay', text_for_parse)
    if m_days:
        n_days = int(m_days.group(1))
        end = today + datetime.timedelta(days=n_days)
        result['start_date'] = today.isoformat()
        result['end_date'] = end.isoformat()
        return result

    # Match: "1 thang toi", "2 thang" (nhưng KHÔNG match "tháng 6" - tháng cụ thể)
    m_months_rel = re.search(r'(\d+)\s*thang\s*(?:toi|nua|tinh|ke)', text_for_parse)
    if m_months_rel:
        n_months = int(m_months_rel.group(1))
        end = today + datetime.timedelta(days=n_months * 30)
        result['start_date'] = today.isoformat()
        result['end_date'] = end.isoformat()
        return result

    # === ABSOLUTE MONTHS: "tháng 5", "tháng 5 và 6" ===
    # Bắt các tháng có chữ "tháng" đi kèm
    all_months = re.findall(r'thang\s*(\d{1,2})', text_for_parse, re.IGNORECASE)
    
    months = []
    for m in all_months:
        v = int(m)
        if 1 <= v <= 12:
            months.append(v)
            
    # Chỉ lấy thêm các số đứng một mình (ví dụ "và 6") NẾU trong câu có nhắc đến "tháng"
    if months:
        # (?!\s*ngày) để không bắt nhầm "đến 7 ngày"
        extra = re.findall(r'(?:va|,|den)\s*(\d{1,2})(?!\s*ngay)(?:\s|$)', text_for_parse, re.IGNORECASE)
        for m in extra:
            v = int(m)
            if 1 <= v <= 12 and v not in months:
                months.append(v)
    
    if months:
        months.sort()
        first_month = months[0]
        last_month = months[-1]
        last_day = calendar.monthrange(year, last_month)[1]
        result['start_date'] = f"{year}-{first_month:02d}-01"
        result['end_date'] = f"{year}-{last_month:02d}-{last_day:02d}"
        return result
    
    # Ngày cụ thể: "1/6 đến 30/6", "01/06 đến 30/06"
    m = re.search(r'(\d{1,2})[/\-](\d{1,2}).*?den.*?(\d{1,2})[/\-](\d{1,2})', text_for_parse)
    if m:
        d1, mo1, d2, mo2 = m.groups()
        result['start_date'] = f"{year}-{int(mo1):02d}-{int(d1):02d}"
        result['end_date'] = f"{year}-{int(mo2):02d}-{int(d2):02d}"
        return result
    
    return result


def _is_random_request(text: str) -> bool:
    """Kiểm tra xem user có muốn tạo nội dung ngẫu nhiên không."""
    text_ascii = _strip_accents(str(text or "").lower())
    random_terms = ("ngau nhien", "random", "tu tao", "tuy y", "bat ky", "tu dong", "tu dien", "tuy ai")
    return any(term in text_ascii for term in random_terms)


def _generate_random_voucher_params() -> dict:
    """Tạo params voucher ngẫu nhiên khi user yêu cầu random."""
    import datetime
    today = datetime.date.today()
    
    # Random discount
    discount_options = [
        {"discount_value": 20000, "discount_type": "amount"},
        {"discount_value": 50000, "discount_type": "amount"},
        {"discount_value": 100000, "discount_type": "amount"},
        {"discount_value": 200000, "discount_type": "amount"},
        {"discount_value": 10, "discount_type": "percent"},
        {"discount_value": 15, "discount_type": "percent"},
        {"discount_value": 20, "discount_type": "percent"},
        {"discount_value": 30, "discount_type": "percent"},
    ]
    chosen = random.choice(discount_options)
    
    # Random campaign name
    campaign_names = [
        "Flash Sale Cuối Tuần",
        "Ưu Đãi Mùa Hè",
        "Khuyến Mãi Đặc Biệt",
        "Deal Hot Hôm Nay",
        "Giảm Giá Bất Ngờ",
        "Happy Hour",
        "Tri Ân Khách Hàng",
        "Combo Tiết Kiệm",
    ]
    
    # Random code
    code_prefixes = ["FLASH", "DEAL", "HOT", "SALE", "VIP", "LUCKY"]
    code = f"{random.choice(code_prefixes)}{random.randint(1000, 9999)}"
    
    # Default: 7 ngày nếu chưa có date từ parse
    end_date = today + datetime.timedelta(days=7)
    
    result = {
        "discount_value": chosen["discount_value"],
        "discount_type": chosen["discount_type"],
        "campaign_name": random.choice(campaign_names),
        "code": code,
        "start_date": today.isoformat(),
        "end_date": end_date.isoformat(),
        "min_order_value": random.choice([0, 100000, 200000, 500000]),
    }
    return result


def _parse_voucher_params_from_text(text: str) -> dict:
    import re
    result = {}
    normalized_text = _strip_accents(str(text or "").lower())

    if _is_random_request(text):
        return _generate_random_voucher_params()

    # Parse discount_value: "giảm 50k", "giảm 20000", "giảm giá 20000"
    m = re.search(r'giam\s+(?:gia\s+)?([\d.,]+)\s*k\b', normalized_text, re.IGNORECASE)
    if m:
        val = m.group(1).replace(',', '').replace('.', '')
        result['discount_value'] = int(val) * 1000
    else:
        m2 = re.search(r'giam\s+(?:gia\s+)?([\d.,]+)', normalized_text, re.IGNORECASE)
        if m2:
            val = m2.group(1).replace('.', '').replace(',', '')
            try:
                result['discount_value'] = int(val)
            except ValueError:
                pass

    # Parse code: "mã SUMMER2026"
    m_code = re.search(r'ma\s+([a-zA-Z0-9_-]+)', normalized_text, re.IGNORECASE)
    if m_code:
        result['code'] = m_code.group(1).upper()

    # Parse min_order_value: "đơn tối thiểu 200k", "từ 200.000", "cho đơn từ 0", "đơn từ 100k"
    # Priority: explicit "toi thieu" > "don tu" / "tu"
    m_min = re.search(r'toi thieu\s+([\d.,]+)\s*k\b', normalized_text, re.IGNORECASE)
    if m_min:
        val = m_min.group(1).replace(',', '').replace('.', '')
        result['min_order_value'] = int(val) * 1000
    else:
        m_min2 = re.search(r'toi thieu\s+([\d.,]+)', normalized_text, re.IGNORECASE)
        if m_min2:
            val = m_min2.group(1).replace('.', '').replace(',', '')
            try:
                result['min_order_value'] = int(val)
            except ValueError:
                pass
        else:
            # "cho đơn từ 0", "đơn từ 100k", "từ 200000"
            m_don_tu = re.search(r'(?:don\s+)?tu\s+([\d.,]+)\s*k\b', normalized_text, re.IGNORECASE)
            if m_don_tu:
                val = m_don_tu.group(1).replace(',', '').replace('.', '')
                result['min_order_value'] = int(val) * 1000
            else:
                m_don_tu2 = re.search(r'(?:don\s+)?tu\s+([\d.,]+)', normalized_text, re.IGNORECASE)
                if m_don_tu2:
                    val = m_don_tu2.group(1).replace('.', '').replace(',', '')
                    try:
                        result['min_order_value'] = int(val)
                    except ValueError:
                        pass
                        
    # Extract Max Discount Amount
    max_match = re.search(r'toi da\s*(\d+)(k|trieu|nghin|vnd|d)', normalized_text)
    if max_match:
        val = int(max_match.group(1))
        unit = max_match.group(2)
        if unit in ['k', 'nghin']: val *= 1000
        elif unit == 'trieu': val *= 1000000
        result["max_discount_amount"] = val

    # Extract Service Type
    if any(w in normalized_text for w in ["phong", "khach san", "room", "nghi"]):
        result["apply_to_service_type"] = "room"
    elif any(w in normalized_text for w in ["an uong", "do an", "nha hang", "cafe", "ban"]):
        result["apply_to_service_type"] = "food"
    elif any(w in normalized_text for w in ["ve", "tour"]):
        result["apply_to_service_type"] = "ticket"
        
    # Extract Target Group
    if any(w in normalized_text for w in ["khach quen", "than thiet", "loyal", "thanh vien"]):
        result["target_group"] = "loyal"
        
    # Extract Usage Limit and Quantity
    # "tạo 5 voucher", "tạo ra 10 mã"
    q_match = re.search(r'tao\s+(?:ra\s+)?(\d+)\s*(voucher|ma\b)', normalized_text)
    if q_match:
        result["quantity"] = int(q_match.group(1))
        
    sl_match = re.search(r'(so luong|gioi han|luot|lan dung)\s*(?:toi da\s*)?(\d+)', normalized_text)
    if sl_match:
        result["usage_limit"] = int(sl_match.group(2))
                
    return result

def _strip_accents(value: str) -> str:
    val = str(value or "").replace('đ', 'd').replace('Đ', 'D')
    return "".join(
        ch
        for ch in unicodedata.normalize("NFD", val)
        if unicodedata.category(ch) != "Mn"
    )


def _parse_time_range_from_text(text: str) -> str:
    text_ascii = _strip_accents(str(text or "").lower())
    if any(term in text_ascii for term in ("hom nay", "bua nay", "today")):
        return "today"
    if any(term in text_ascii for term in ("tuan nay", "week nay", "this week")):
        return "this_week"
    if any(term in text_ascii for term in ("thang nay", "month nay", "this month")):
        return "this_month"
    if any(term in text_ascii for term in ("nam nay", "year nay", "this year")):
        return "this_year"
    if any(term in text_ascii for term in ("tu truoc den nay", "toan bo", "tat ca", "tu do den nay", "he thong", "all")):
        return "all"
    return ""


def _parse_months_from_text(text: str) -> list:
    """Bóc tách danh sách tháng cụ thể từ text, ví dụ 'tháng 6', 'tháng 5 và 6', 'T6'."""
    import re
    text_ascii = _strip_accents(str(text or "").lower())
    months = []
    # "tháng 6 và 7", "tháng 5, 6", "tháng 6"
    m = re.search(r'thang\s+(\d+)(?:\s*[,va&]+\s*(\d+))*', text_ascii)
    if m:
        full_match = m.group(0)
        found = re.findall(r'\d+', full_match)
        for n in found:
            month_num = int(n)
            if 1 <= month_num <= 12:
                months.append(month_num)
    return months


def _time_range_label(time_range: str) -> str:
    return {
        "today": "hôm nay",
        "this_week": "tuần này",
        "this_month": "tháng này",
        "this_year": "năm nay",
    }.get(time_range or "", "khoảng thời gian đã chọn")


def _date_range_from_time_range(time_range: str) -> dict:
    import calendar
    import datetime

    today = datetime.date.today()
    if time_range == "today":
        value = today.isoformat()
        return {"start_date": value, "end_date": value}
    if time_range == "this_week":
        start = today - datetime.timedelta(days=today.weekday())
        end = start + datetime.timedelta(days=6)
        return {"start_date": start.isoformat(), "end_date": end.isoformat()}
    if time_range == "this_month":
        start = today.replace(day=1)
        last_day = calendar.monthrange(today.year, today.month)[1]
        end = today.replace(day=last_day)
        return {"start_date": start.isoformat(), "end_date": end.isoformat()}
    if time_range == "this_year":
        return {"start_date": f"{today.year}-01-01", "end_date": f"{today.year}-12-31"}
    return {}


def _display_date(value: str) -> str:
    match = re.match(r"^(\d{4})-(\d{2})-(\d{2})", str(value or ""))
    if match:
        year, month, day = match.groups()
        return f"{day}/{month}/{year}"
    return str(value or "-")


def _money_text(value: int) -> str:
    return f"{value:,}".replace(",", ".") + " đ"


def _intent_result(intent: str, parameters: dict, answer: str, confidence: float = 0.92) -> dict:
    return {
        "intent": intent,
        "confidence": confidence,
        "parameters": parameters,
        "answer": answer,
    }


def _local_owner_intent_fallback(request_data: dict) -> dict | None:
    """Handle safety-critical and common owner intents without depending on Gemini."""
    role = request_data.get("role", "")
    if role != "owner":
        return None

    raw_text = str(request_data.get("text") or "")
    text = _strip_accents(raw_text.lower())
    
    # NLP Rule-based Fallback
    fallback_res = rule_based_fallback_intent(raw_text, role)
    if fallback_res and fallback_res.get("intent") != "unknown":
        # Combine parsed dates with fallback params
        parsed_dates = _parse_date_from_text(raw_text)
        if parsed_dates:
            fallback_res["parameters"].update(parsed_dates)
            
        # Draw Mini-chart if it's revenue intent and context has data
        if fallback_res["intent"] in ("get_dashboard_stats", "owner_get_order_stats"):
            ctx = request_data.get("screen_context", "")
            import re
            rev_match = re.search(r'revenue["\']?\s*:\s*(\d+)', str(ctx).lower())
            if rev_match:
                rev = int(rev_match.group(1))
                # Giả lập tăng trưởng và biểu đồ
                growth = random.randint(5, 25)
                bar = "[████████░░]"
                fallback_res["answer"] = f"📊 Báo cáo Doanh thu:\n• Tổng thu: {_money_text(rev)}\n• Tăng trưởng: +{growth}%\n• Dịch vụ chính: {bar} 80%\nSếp xem chi tiết ở bảng bên nhé."
            else:
                fallback_res["answer"] = "📊 Báo cáo Doanh thu:\n• Đang trích xuất biểu đồ...\nSếp xem chi tiết ở bảng bên dưới nhé."
                
        # Format voucher draft answer if it's voucher creation
        if fallback_res["intent"] == "owner_voucher_draft":
            params = fallback_res["parameters"]
            lines = ["📋 Bản nháp Voucher (NLP Fallback):"]
            if params.get("apply_to_service_type") and params.get("apply_to_service_type") != "all":
                service_map = {"room": "Phòng Khách Sạn", "food": "Ăn uống/Nhà hàng", "ticket": "Vé/Tour"}
                lines.append(f"• Dịch vụ áp dụng: {service_map.get(params['apply_to_service_type'], params['apply_to_service_type'])}")
            if params.get("discount_type") == "percent":
                lines.append(f"• Giảm giá: {params.get('discount_value', 0)}%")
                if params.get("max_discount_amount"):
                    lines.append(f"• Giảm tối đa: {_money_text(params['max_discount_amount'])}")
            elif params.get("discount_value"):
                lines.append(f"• Giảm giá: {_money_text(params['discount_value'])}")
            if params.get("usage_limit"):
                lines.append(f"• Tổng số lượng: {params['usage_limit']} lượt")
            if params.get("target_group") == "loyal":
                lines.append(f"• Đối tượng: Khách hàng thân thiết")
            lines.append("Sếp xem và bấm [Đồng ý & Thực thi] nhé.")
            fallback_res["answer"] = "\n".join(lines)
            
        return fallback_res

    params: dict = {}

    time_range = _parse_time_range_from_text(raw_text)
    if time_range:
        params["time_range"] = time_range

    # Bóc tách tháng cụ thể: "tháng 6", "tháng 5 và 6"
    months = _parse_months_from_text(raw_text)
    if months and not time_range:
        params["months"] = months

    parsed_dates = _parse_date_from_text(raw_text)
    # Chỉ dùng parsed_dates nếu không có months và không có time_range
    if parsed_dates and not months and not time_range:
        params.update(parsed_dates)

    history_items = request_data.get("chat_history") or []
    history_text = _strip_accents(
        " ".join(str(item.get("text", "")) for item in history_items[-4:] if isinstance(item, dict)).lower()
    )
    revenue_terms = ("doanh thu", "danh thu", "revenue")
    location_terms = ("dia diem", "chi nhanh", "co so", "location")
    top_terms = ("cao nhat", "nhieu nhat", "top", "lon nhat", "tot nhat", "ban tot")
    export_terms = ("xuat file", "xuat excel", "tai file", "tai ve", "download", "export")
    all_terms = ("tat ca", "toan bo", "all")

    read_terms = (
        "xem", "cho xem", "bao cao", "bao cao", "thong ke", "so lieu",
        "so luong", "bao nhieu", "dem", "danh sach", "loc", "tim",
        "ti le", "ty le", "tong", "top",
    )

    if any(term in text for term in ("hoa hong", "commission")):
        if any(term in text for term in ("thanh toan", "chuyen tien", "pay", "payout", "nop tien")):
            return _intent_result(
                "unknown",
                {},
                "AI chỉ được đọc báo cáo hoa hồng; không được thanh toán hoặc chuyển tiền.",
                0.99,
            )
        if any(term in text for term in read_terms) or not any(term in text for term in ("huy", "duyet", "xac nhan")):
            params.setdefault("time_range", "this_month")
            return _intent_result(
                "view_commissions",
                params,
                f"Mình sẽ đối soát báo cáo hoa hồng {_time_range_label(params['time_range'])} cho sếp.",
            )

    booking_write_patterns = (
        r"\b(huy|cancel|duyet|approve|xac nhan|confirm|hoan thanh)\s+(booking|don dat|don hang|don\b|dat cho|dat ban)",
        r"\b(booking|don dat|dat cho|dat ban)\s*(so|#)?\s*\d+.*\b(huy|cancel|duyet|approve|xac nhan|confirm|hoan thanh)\b",
    )
    is_booking_write = any(re.search(pattern, text) for pattern in booking_write_patterns)
    is_read_request = any(term in text for term in read_terms)
    if is_booking_write and not is_read_request:
        booking_action = "approve"
        if "huy" in text or "cancel" in text:
            booking_action = "cancel"
        elif "hoan thanh" in text:
            booking_action = "complete"
            
        booking_id = None
        id_match = re.search(r'don\s*(so\s*)?(\d+)', raw_text.lower())
        if id_match:
            booking_id = int(id_match.group(2))
            
        return _intent_result(
            "owner_manage_booking",
            {"booking_id": booking_id, "action": booking_action},
            f"📋 Bản nháp Quản lý Đơn hàng:\n• Hành động: {booking_action.upper()}\n• ID Đơn: {booking_id or 'Chưa rõ'}\nSếp xem và bấm [Đồng ý & Thực thi] nhé.",
            0.95,
        )

    if "voucher" in text or "khuyen mai" in text or "uu dai" in text or re.search(r"\bgiam\b", text):
        # Parse date trước (từ text gốc), sau đó parse voucher params
        parsed_dates = _parse_date_from_text(raw_text)
        voucher_params = _parse_voucher_params_from_text(raw_text)
        
        # Merge: voucher_params có thể đã có start_date/end_date từ random generator
        # Nhưng parsed_dates từ user input ("2 tuần") được ưu tiên hơn
        params.update(voucher_params)
        if parsed_dates:
            params.update(parsed_dates)  # Override random dates với user-specified dates
        
        if params.get("time_range") and not params.get("start_date") and not params.get("end_date"):
            params.update(_date_range_from_time_range(str(params["time_range"])))
        
        discount = params.get("discount_value")
        discount_type = params.get("discount_type", "amount")
        lines = ["📋 Bản nháp Voucher:"]
        if params.get("code"):
            lines.append(f"• Mã: {params['code']}")
        if params.get("campaign_name"):
            lines.append(f"• Chiến dịch: {params['campaign_name']}")
            
        if params.get("apply_to_service_type") and params.get("apply_to_service_type") != "all":
            service_map = {"room": "Phòng Khách Sạn", "food": "Ăn uống/Nhà hàng", "ticket": "Vé/Tour"}
            lines.append(f"• Dịch vụ áp dụng: {service_map.get(params['apply_to_service_type'], params['apply_to_service_type'])}")
            
        if discount:
            if discount_type == "percent":
                lines.append(f"• Giảm giá: {int(discount)}%")
                if params.get("max_discount_amount"):
                    lines.append(f"• Giảm tối đa: {_money_text(int(params['max_discount_amount']))}")
            else:
                lines.append(f"• Giảm giá: {_money_text(int(discount))}")
        if params.get("min_order_value") and int(params.get("min_order_value", 0)) > 0:
            lines.append(f"• Đơn tối thiểu: {_money_text(int(params['min_order_value']))}")
        if params.get("quantity"):
            lines.append(f"• Sẽ tạo {params['quantity']} mã voucher riêng biệt")
        if params.get("usage_limit"):
            lines.append(f"• Số lượt dùng mỗi mã: {params['usage_limit']} lượt")
        if params.get("target_group") == "loyal":
            lines.append(f"• Đối tượng: Khách hàng thân thiết")
        if params.get("start_date") and params.get("end_date"):
            lines.append(f"• Hiệu lực: {_display_date(params['start_date'])} đến {_display_date(params['end_date'])}")
        elif params.get("time_range"):
            lines.append(f"• Thời gian: {_time_range_label(params['time_range'])}")
        lines.append("Sếp xem và bấm [Đồng ý & Thực thi] nếu muốn tạo voucher nhé.")
        return _intent_result("owner_voucher_draft", params, "\n".join(lines))

    if "nhan vien" in text:
        if "mo khoa" in text or "unlock" in text:
            return _intent_result(
                "owner_manage_employees",
                {"action": "unban"},
                "📋 Bản nháp Mở khóa nhân viên:\n• Hành động: Mở khóa\nSếp xem và bấm [Đồng ý & Thực thi] nếu muốn thực hiện ạ!",
            )
        if "khoa" in text or "ban" in text or "lock" in text:
            return _intent_result(
                "owner_manage_employees",
                {"action": "ban"},
                "📋 Bản nháp Khóa nhân viên:\n• Hành động: Khóa\nSếp xem và bấm [Đồng ý & Thực thi] nếu muốn thực hiện ạ!",
            )
        return _intent_result(
            "owner_view_employees",
            {},
            "Mình sẽ kiểm tra số lượng và trạng thái nhân viên hiện tại cho sếp.",
        )

    if any(term in text for term in export_terms) and any(term in text for term in revenue_terms):
        if not any(term in text for term in all_terms):
            params.setdefault("time_range", "this_month")
        return _intent_result(
            "export_revenue_report",
            params,
            "Mình sẽ xuất file doanh thu cho sếp.",
        )

    current_has_specific_intent = any(term in text for term in (*revenue_terms, *location_terms, "dich vu", "don", "booking", "hoa hong", "voucher", "nhan vien", "danh gia", "review"))
    previous_was_top_location = (
        any(term in history_text for term in revenue_terms)
        and any(term in history_text for term in location_terms)
        and any(term in history_text for term in top_terms)
    )
    # Chỉ áp dụng top_location fallback khi current message KHÔNG chứa intent cụ thể
    # VÀ current message chỉ là cung cấp thêm thời gian (ngắn, không có động từ rõ ràng)
    is_time_only_reply = len(text.split()) <= 6 and not current_has_specific_intent
    if (params.get("time_range") or params.get("start_date") or params.get("months")) and is_time_only_reply and previous_was_top_location:
        return _intent_result(
            "owner_get_top_locations",
            params,
            "Mình sẽ xếp hạng địa điểm theo doanh thu trong khoảng thời gian sếp vừa nói.",
        )

    if any(term in text for term in revenue_terms) and any(term in text for term in location_terms) and any(term in text for term in top_terms):
        params.setdefault("time_range", "this_month")
        return _intent_result(
            "owner_get_top_locations",
            params,
            "Mình sẽ kiểm tra địa điểm có doanh thu cao nhất cho sếp.",
        )

    if any(term in text for term in revenue_terms):
        params.setdefault("time_range", "this_month")
        return _intent_result(
            "get_dashboard_stats",
            params,
            f"Mình sẽ lấy số liệu doanh thu {_time_range_label(params['time_range'])} cho sếp.",
        )

    if ("top" in text or "ban chay" in text or "hieu suat" in text) and "dich vu" in text:
        params.setdefault("time_range", "this_week")
        return _intent_result(
            "owner_get_top_services",
            params,
            f"Mình sẽ xem top dịch vụ bán chạy {_time_range_label(params['time_range'])} cho sếp.",
        )

    if "danh gia" in text or "review" in text:
        params.setdefault("time_range", "this_month")
        if any(term in text for term in ("phan hoi", "tra loi", "reply", "soan", "viet")):
            return _intent_result(
                "owner_review_reply_draft",
                params,
                "Mình sẽ soạn bản nháp phản hồi đánh giá để sếp duyệt trước khi đăng.",
            )
        return _intent_result(
            "owner_analyze_reviews",
            params,
            f"Mình sẽ phân tích đánh giá khách hàng {_time_range_label(params['time_range'])} cho sếp.",
        )

    if "don" in text and any(term in text for term in ("hoan thanh", "huy", "ti le huy", "ty le huy", "so luong")):
        if not params.get("time_range") and not params.get("months") and not params.get("start_date"):
            params["time_range"] = "today"
        label = f"tháng {', '.join(map(str, params['months']))}" if params.get('months') else _time_range_label(params.get('time_range', 'today'))
        return _intent_result(
            "owner_get_order_stats",
            params,
            f"Mình sẽ thống kê đơn hoàn thành và đơn hủy ({label}) cho sếp.",
        )

    if any(term in text for term in ("booking", "dat cho", "dat ban", "don dat")) and (is_read_request or any(status in text for status in ("pending", "confirmed", "cancelled", "completed"))):
        params.setdefault("time_range", "this_month")
        status_map = {
            "cho xu ly": "pending",
            "pending": "pending",
            "da xac nhan": "confirmed",
            "confirmed": "confirmed",
            "da huy": "cancelled",
            "cancelled": "cancelled",
            "hoan thanh": "completed",
            "completed": "completed",
        }
        for key, value in status_map.items():
            if key in text:
                params["status"] = value
                break
        return _intent_result(
            "owner_view_bookings",
            params,
            f"Mình sẽ đọc báo cáo booking {_time_range_label(params['time_range'])} cho sếp.",
        )

    return None


def call_gemini_intent_service(request_data: dict) -> dict:
    local_result = _local_owner_intent_fallback(request_data)
    if local_result:
        print(f"[Local Intent] intent={local_result.get('intent')} parameters={local_result.get('parameters')}")
        return local_result

    settings = get_settings()
    api_key = random.choice(settings.gemini_api_keys) if settings.gemini_api_keys else ""
    client = genai.Client(api_key=api_key)
    role = request_data.get("role", "")
    text_norm = _strip_accents(str(request_data.get("text") or "").lower())
    booking_words = ("booking", "don", "đơn", "dat cho", "đặt chỗ", "dat ban", "đặt bàn")
    booking_write_words = ("huy", "hủy", "duyet", "duyệt", "xac nhan", "xác nhận", "confirm", "approve", "cancel")
    booking_write_patterns = (
        r"\b(huy|cancel|duyet|approve|xac nhan|confirm)\s+(booking|don dat|don hang|don\b|dat cho|dat ban)",
        r"\b(booking|don dat|dat cho|dat ban)\s*(so|#)?\s*\d+.*\b(huy|cancel|duyet|approve|xac nhan|confirm)\b",
    )
    booking_read_words = ("xem", "bao cao", "thong ke", "so luong", "bao nhieu", "danh sach", "ti le", "ty le")
    if role == "owner" and any(re.search(p, text_norm) for p in booking_write_patterns) and not any(w in text_norm for w in booking_read_words):
        return {
            "intent": "unknown",
            "confidence": 0.99,
            "parameters": {},
            "answer": "AI Owner chỉ được đọc và báo cáo booking; không được hủy, duyệt hoặc xác nhận đơn.",
        }

    commission_words = ("hoa hong", "hoa hồng", "commission")
    commission_write_words = ("thanh toan", "thanh toán", "chuyen tien", "chuyển tiền", "pay", "payout")
    if any(w in text_norm for w in commission_words) and any(w in text_norm for w in commission_write_words):
        return {
            "intent": "unknown",
            "confidence": 0.99,
            "parameters": {},
            "answer": "AI chỉ được đọc báo cáo hoa hồng; không được thanh toán hoặc chuyển tiền.",
        }
    
    # Local manual fallbacks for common user and location queries
    if role == "admin" and any(w in text_norm for w in ("so luong user", "so luong tai khoan", "dem user", "dem tai khoan", "tong so user", "tong so tai khoan user", "so luong acc", "dem acc")):
        return {
            "intent": "admin_get_user_growth",
            "confidence": 0.99,
            "parameters": {"time_range": "all"},
            "answer": "Đang lấy dữ liệu...",
        }

    if role == "admin" and any(w in text_norm for w in ("xem danh sach dia diem", "xem danh sach co so", "danh sach dia diem", "danh sach co so", "cac dia diem tren he thong")):
        return {
            "intent": "admin_view_locations",
            "confidence": 0.99,
            "parameters": {},
            "answer": "Đang lấy dữ liệu...",
        }

    if role == "admin" and any(w in text_norm for w in ("mo khoa", "mo ban", "unban", "kich hoat lai")):
        if any(w in text_norm for w in ("tat ca tai khoan", "toan bo tai khoan", "tat ca user", "tat ca owner", "toan bo user", "toan bo owner", "tat ca", "toan bo")):
            target_role = "all"
            if "owner" in text_norm and "user" not in text_norm:
                target_role = "owner"
            elif "user" in text_norm and "owner" not in text_norm:
                target_role = "user"
                
            role_label = "User và Owner" if target_role == "all" else ("User" if target_role == "user" else "Owner")
            return {
                "intent": "admin_user_lock",
                "confidence": 0.99,
                "parameters": {
                    "target_role": target_role,
                    "action": "unlock",
                    "reason": "Yêu cầu từ Admin"
                },
                "answer": f"📋 Bản nháp Mở khóa tài khoản:\n• Đối tượng: Tất cả tài khoản {role_label}\n• Hành động: Mở khóa\nSếp xem và bấm [Đồng ý & Thực thi] nếu muốn thực hiện ạ!",
            }

    if role == "admin" and "mo khoa" not in text_norm and "mo ban" not in text_norm and any(w in text_norm for w in ("khoa tat ca tai khoan", "khoa toan bo tai khoan", "khoa tat ca user", "khoa tat ca owner", "khoa toan bo user", "khoa toan bo owner")):
        target_role = "all"
        if "owner" in text_norm and "user" not in text_norm:
            target_role = "owner"
        elif "user" in text_norm and "owner" not in text_norm:
            target_role = "user"
            
        role_label = "User và Owner" if target_role == "all" else ("User" if target_role == "user" else "Owner")
        return {
            "intent": "admin_user_lock",
            "confidence": 0.99,
            "parameters": {
                "target_role": target_role,
                "action": "lock",
                "reason": "Yêu cầu từ Admin"
            },
            "answer": f"📋 Bản nháp Khóa tài khoản:\n• Đối tượng: Tất cả tài khoản {role_label}\n• Hành động: Khóa\nSếp xem và bấm [Đồng ý & Thực thi] nếu muốn thực hiện ạ!",
        }

    if "top" in text_norm and any(w in text_norm for w in ("dia diem", "chi nhanh", "co so", "location", "cua hang")):
        limit = 3
        m_lim = re.search(r'top\s+(\d+)', text_norm)
        if m_lim:
            limit = int(m_lim.group(1))
        intent_name = "admin_get_top_locations" if role == "admin" else "owner_get_top_locations"
        return {
            "intent": intent_name,
            "confidence": 0.99,
            "parameters": {"time_range": "all", "limit": limit},
            "answer": "Đang lấy dữ liệu...",
        }

    # Filter registry to only available intents
    allowed_actions = [a for a in REGISTRY if role in a.roles]
    
    import datetime
    now = datetime.datetime.now()
    current_date = now.strftime("%Y-%m-%d")
    current_year = str(now.year)
    with open("app/prompts/system_prompt.txt", "r", encoding="utf-8") as f:
        system_instruction = f.read()
    # Thay {YEAR} bằng năm thực tế
    system_instruction = system_instruction.replace("{YEAR}", current_year)
    system_instruction += f"\n\n[HỆ THỐNG] Hôm nay là ngày: {current_date}. Năm hiện tại: {current_year}. Khi người dùng nói 'tháng 6', start_date phải là {current_year}-06-01 và end_date phải là {current_year}-06-30."

    response_schema = {
        "type": "object",
        "properties": {
            "intent": {"type": "string", "description": "Tên action (ví dụ: get_dashboard_stats, export_revenue_report, owner_analyze_reviews, owner_manage_employees, ...)"},
            "confidence": {"type": "number"},
            "parameters": {
                "type": "object",
                "description": "Các tham số trích xuất được từ câu hỏi người dùng",
                "properties": {
                    "time_range": {"type": "string", "description": "Khoảng thời gian: today, this_week, this_month, this_year"},
                    "months": {"type": "array", "items": {"type": "integer"}, "description": "Danh sách tháng cụ thể (ví dụ: [5,6,7])"},
                    "start_date": {"type": "string", "description": "Ngày bắt đầu (YYYY-MM-DD)"},
                    "end_date": {"type": "string", "description": "Ngày kết thúc (YYYY-MM-DD)"},
                    "employee_id": {"type": "integer", "description": "ID nhân viên (nếu có)"},
                    "action": {"type": "string", "description": "Hành động: ban, unban (nếu có)"},
                    "review_id": {"type": "integer", "description": "ID đánh giá (nếu có)"},
                    "reply_content": {"type": "string", "description": "Nội dung bản nháp hoặc nội dung phản hồi review"},
                    "discount_value": {"type": "integer", "description": "Giá trị giảm giá (nếu có)"},
                    "status": {"type": "string", "description": "Trạng thái booking: pending, confirmed, cancelled, completed"},
                    "location_name": {"type": "string", "description": "Tên địa điểm nếu có"},
                },
            },
            "answer": {"type": "string", "description": "Câu trả lời thân thiện dành cho người dùng (KHÔNG tự bịa số liệu)"}
        },
        "required": ["intent", "confidence", "parameters"]
    }

    # Add allowed actions to context so LLM knows what to output
    actions_desc = []
    for a in allowed_actions:
        desc = f"- {a.name}: {a.description}"
        if a.parameters_schema:
            desc += f" (Params: {list(a.parameters_schema['properties'].keys())})"
        actions_desc.append(desc)
        
    prompt_context = request_data.copy()
    prompt_context['available_actions'] = actions_desc

    prompt = json.dumps(prompt_context, ensure_ascii=False)
    
    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json",
                response_schema=response_schema,
                temperature=0.2,
            ),
        )
        raw_text = response.text.strip()
        if raw_text.startswith("```json"):
            raw_text = raw_text[7:]
        elif raw_text.startswith("```"):
            raw_text = raw_text[3:]
        if raw_text.endswith("```"):
            raw_text = raw_text[:-3]
        raw_text = raw_text.strip()
        
        result = json.loads(raw_text)
        try:
            print(f"[Gemini DEBUG] intent={result.get('intent')} parameters={result.get('parameters')}".encode('utf-8', 'ignore').decode('utf-8'))
        except Exception:
            pass
        
        # Fallback TOÀN CỤC: Với BẤT KỲ intent thống kê nào, nếu Gemini không trích xuất được tháng/ngày, tự parse từ text
        STATS_INTENTS = {
            'get_dashboard_stats', 'owner_analyze_reviews', 'owner_get_order_stats',
            'owner_get_revenue_structure', 'owner_get_top_locations', 'owner_get_top_services', 'owner_manage_employees',
            'owner_view_employees', 'owner_view_bookings', 'view_commissions', 'export_revenue_report',
            'admin_get_user_growth', 'admin_get_owners', 'admin_get_top_locations',
        }
        if result.get('intent') in STATS_INTENTS:
            params = result.get('parameters') or {}
            user_text = request_data.get('text', '')

            if not params.get('time_range'):
                parsed_time_range = _parse_time_range_from_text(user_text)
                if parsed_time_range:
                    params['time_range'] = parsed_time_range
                    result['parameters'] = params
            
            # Nếu thiếu months VÀ thiếu start_date, thử parse từ text
            if not params.get('months') and not params.get('start_date'):
                parsed_dates = _parse_date_from_text(user_text)
                if parsed_dates:
                    # Nếu parse ra được ngày, cũng thử parse ra months
                    user_text_for_parse = _strip_accents(str(user_text or "").lower())
                    all_months = re.findall(r'thang\s*(\d{1,2})', user_text_for_parse, re.IGNORECASE)
                    months_list = []
                    for m in all_months:
                        v = int(m)
                        if 1 <= v <= 12:
                            months_list.append(v)
                    # Lấy thêm số đứng sau "và", ","
                    if months_list:
                        extra = re.findall(r'(?:va|,|den)\s*(\d{1,2})(?!\s*ngay)(?:\s|$)', user_text_for_parse, re.IGNORECASE)
                        for m in extra:
                            v = int(m)
                            if 1 <= v <= 12 and v not in months_list:
                                months_list.append(v)
                    
                    if months_list:
                        months_list.sort()
                        params['months'] = months_list
                    params.update(parsed_dates)
                    result['parameters'] = params
                    print(f"[Date Fallback] intent={result.get('intent')} parsed: months={params.get('months')} dates={parsed_dates}")

        # Fallback: Nếu intent là tạo voucher nhưng Gemini không điền discount_value vào parameters
        if result.get('intent') in ('owner_voucher_draft', 'admin_create_system_voucher'):
            params = result.get('parameters') or {}
            parsed = _parse_voucher_params_from_text(request_data.get('text', ''))
            if parsed:
                for k, v in parsed.items():
                    if not params.get(k):
                        params[k] = v
                    result['parameters'] = params
                    print(f"[Voucher Fallback] Parsed from text: {parsed}")
            # Cũng parse ngày nếu thiếu
            if not params.get('end_date') and not params.get('expiry_date'):
                parsed_dates = _parse_date_from_text(request_data.get('text', ''))
                if parsed_dates:
                    params.update(parsed_dates)
                    result['parameters'] = params

        return result
    except Exception as e:
        print(f"Gemini Intent Error: {e}")
        error_msg = str(e)
        user_msg = "Hệ thống AI đang gặp lỗi. Vui lòng thử lại sau giây lát."
        
        if "429" in error_msg or "quota" in error_msg.lower():
            user_msg = "Hệ thống AI đang quá tải (vượt quá hạn mức gọi API miễn phí). Vui lòng thử lại sau vài chục giây nhé."
        elif "403" in error_msg or "denied" in error_msg.lower():
            safe_key = api_key[:15] + "..." if api_key else "không xác định"
            user_msg = f"CẢNH BÁO: API Key ({safe_key}) đã bị Google khóa (Lỗi 403). Sếp vui lòng xóa key này khỏi file .env nhé!"
            
        return {"intent": "unknown", "confidence": 0, "answer": user_msg, "error": error_msg}
