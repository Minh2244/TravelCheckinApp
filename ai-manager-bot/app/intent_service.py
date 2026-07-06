import json
import random
from google import genai
from google.genai import types
from .settings import get_settings
from .action_registry import REGISTRY
import urllib.request
import urllib.error

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
    
    year = datetime.datetime.now().year
    result = {}
    
    # Bắt các tháng có chữ "tháng" đi kèm
    all_months = re.findall(r'tháng\s*(\d{1,2})', text, re.IGNORECASE)
    
    months = []
    for m in all_months:
        v = int(m)
        if 1 <= v <= 12:
            months.append(v)
            
    # Chỉ lấy thêm các số đứng một mình (ví dụ "và 6") NẾU trong câu có nhắc đến "tháng"
    if months:
        # (?!\s*ngày) để không bắt nhầm "đến 7 ngày"
        extra = re.findall(r'(?:và|,|đến)\s*(\d{1,2})(?!\s*ngày)(?:\s|$)', text, re.IGNORECASE)
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
    m = re.search(r'(\d{1,2})[/\-](\d{1,2}).*?đến.*?(\d{1,2})[/\-](\d{1,2})', text)
    if m:
        d1, mo1, d2, mo2 = m.groups()
        result['start_date'] = f"{year}-{int(mo1):02d}-{int(d1):02d}"
        result['end_date'] = f"{year}-{int(mo2):02d}-{int(d2):02d}"
        return result
    
    return result


def _parse_voucher_params_from_text(text: str) -> dict:
    """Parse discount_value từ text người dùng khi Gemini không điền vào parameters."""
    import re
    result = {}

    # "giảm 50k", "giảm 100K"
    m = re.search(r'giảm\s+([\d.,]+)\s*k\b', text, re.IGNORECASE)
    if m:
        val = m.group(1).replace(',', '').replace('.', '')
        result['discount_value'] = int(val) * 1000
        return result

    # "giảm 200000", "giảm 200.000", "giảm 50,000"
    m = re.search(r'giảm\s+([\d.,]+)', text, re.IGNORECASE)
    if m:
        val = m.group(1).replace('.', '').replace(',', '')
        result['discount_value'] = int(val)
        return result

    # Bất kỳ số dạng "100k", "50K" trong câu
    m = re.search(r'\b([\d.,]+)\s*k\b', text, re.IGNORECASE)
    if m:
        val = m.group(1).replace(',', '').replace('.', '')
        result['discount_value'] = int(val) * 1000
        return result

    return result


def call_gemini_intent_service(request_data: dict) -> dict:
    settings = get_settings()
    api_key = random.choice(settings.gemini_api_keys) if settings.gemini_api_keys else ""
    client = genai.Client(api_key=api_key)
    role = request_data.get("role", "")
    
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
                    "discount_value": {"type": "integer", "description": "Giá trị giảm giá (nếu có)"},
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
        print(f"[Gemini DEBUG] intent={result.get('intent')} parameters={result.get('parameters')}")
        
        # Fallback TOÀN CỤC: Với BẤT KỲ intent thống kê nào, nếu Gemini không trích xuất được tháng/ngày, tự parse từ text
        STATS_INTENTS = {
            'get_dashboard_stats', 'owner_analyze_reviews', 'owner_get_order_stats',
            'owner_get_revenue_structure', 'owner_get_top_services', 'owner_manage_employees',
            'owner_view_employees', 'export_revenue_report',
        }
        if result.get('intent') in STATS_INTENTS:
            params = result.get('parameters') or {}
            user_text = request_data.get('text', '')
            
            # Nếu thiếu months VÀ thiếu start_date, thử parse từ text
            if not params.get('months') and not params.get('start_date'):
                parsed_dates = _parse_date_from_text(user_text)
                if parsed_dates:
                    # Nếu parse ra được ngày, cũng thử parse ra months
                    import re
                    all_months = re.findall(r'tháng\s*(\d{1,2})', user_text, re.IGNORECASE)
                    months_list = []
                    for m in all_months:
                        v = int(m)
                        if 1 <= v <= 12:
                            months_list.append(v)
                    # Lấy thêm số đứng sau "và", ","
                    if months_list:
                        extra = re.findall(r'(?:và|,|đến)\s*(\d{1,2})(?!\s*ngày)(?:\s|$)', user_text, re.IGNORECASE)
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
            if not params.get('discount_value') and not params.get('discount_amount'):
                parsed = _parse_voucher_params_from_text(request_data.get('text', ''))
                if parsed:
                    params.update(parsed)
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
