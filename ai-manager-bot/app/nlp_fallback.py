from __future__ import annotations
import os
import re
import urllib.request
import logging
from typing import Any
from .text_normalizer import normalize_text, strip_accents

logger = logging.getLogger(__name__)

CACHE_DIR = os.path.join(os.path.dirname(__file__), "cache")
DICT_FILE = os.path.join(CACHE_DIR, "vietnamese_stopwords.txt")
DICT_URL = "https://raw.githubusercontent.com/stopwords/vietnamese-stopwords/master/vietnamese-stopwords.txt"

_stopwords = set()

def load_dictionary() -> None:
    global _stopwords
    if not os.path.exists(CACHE_DIR):
        os.makedirs(CACHE_DIR)
    
    if not os.path.exists(DICT_FILE):
        try:
            logger.info("Downloading Vietnamese dictionary from GitHub...")
            urllib.request.urlretrieve(DICT_URL, DICT_FILE)
            logger.info("Download completed.")
        except Exception as e:
            logger.error(f"Failed to download dictionary: {e}")
            return
            
    try:
        with open(DICT_FILE, "r", encoding="utf-8") as f:
            for line in f:
                word = line.strip()
                if word:
                    _stopwords.add(strip_accents(word.lower()))
    except Exception as e:
        logger.error(f"Failed to load dictionary: {e}")

def get_stopwords() -> set[str]:
    if not _stopwords:
        load_dictionary()
    return _stopwords

def remove_stopwords(text: str) -> str:
    stop_words = get_stopwords()
    tokens = text.split()
    return " ".join([t for t in tokens if t not in stop_words])

def rule_based_fallback_intent(text: str, role: str) -> dict[str, Any]:
    """
    Cỗ máy Rule-based mạnh mẽ phân tích ý định dựa trên Regex và từ điển.
    Dùng khi Gemini báo lỗi Quota Exceeded.
    """
    norm_text = normalize_text(text)
    clean_text = remove_stopwords(norm_text)
    
    intent = "unknown"
    parameters = {}
    
    # 1. Báo cáo Doanh thu (Đã xử lý Role)
    if any(k in norm_text for k in ["doanh thu", "bao cao", "thong ke", "doanh so", "danh thu", "danh so"]):
        export_terms = ["xuat file", "xuat excel", "tai file", "tai ve", "download", "export"]
        if any(k in norm_text for k in export_terms):
            intent = "export_revenue_report"
        else:
            intent = "get_dashboard_stats"
        # Bắt thời gian đơn giản
        if "hom nay" in norm_text:
            parameters["time_range"] = "today"
        elif "tuan nay" in norm_text:
            parameters["time_range"] = "this_week"
        elif "thang nay" in norm_text:
            parameters["time_range"] = "this_month"
        elif "nam nay" in norm_text:
            parameters["time_range"] = "this_year"
            
    # 2. Tạo Voucher (Voucher Draft)
    elif re.search(r'tao.*(?:voucher|vocher|ma giam gia|ma khuyen mai)', norm_text) or any(k in norm_text for k in ["khuyen mai", "chuong trinh giam"]):
        intent = "admin_create_system_voucher" if role == "admin" else "owner_voucher_draft"
        
        # Bóc tách % hoặc VND
        pct_match = re.search(r'(\d+)\s*%', norm_text)
        vnd_match = re.search(r'(\d+)(k|trieu|nghin|vnd|d)', norm_text)
        
        if pct_match:
            parameters["discount_value"] = int(pct_match.group(1))
            parameters["discount_type"] = "percent"
            # Bắt max discount
            max_match = re.search(r'toi da\s*(\d+)(k|trieu|nghin|vnd|d)', norm_text)
            if max_match:
                val = int(max_match.group(1))
                unit = max_match.group(2)
                if unit in ['k', 'nghin']: val *= 1000
                elif unit == 'trieu': val *= 1000000
                parameters["max_discount_amount"] = val
        elif vnd_match:
            val = int(vnd_match.group(1))
            unit = vnd_match.group(2)
            if unit in ['k', 'nghin']: val *= 1000
            elif unit == 'trieu': val *= 1000000
            parameters["discount_value"] = val
            parameters["discount_type"] = "amount"
            
        # Loại dịch vụ
        if any(w in norm_text for w in ["phong", "khach san", "room", "nghi"]):
            parameters["apply_to_service_type"] = "room"
        elif any(w in norm_text for w in ["an uong", "do an", "nha hang", "cafe", "ban"]):
            parameters["apply_to_service_type"] = "food"
        elif any(w in norm_text for w in ["ve", "tour"]):
            parameters["apply_to_service_type"] = "ticket"
            
        # Khách quen
        if any(w in norm_text for w in ["khach quen", "than thiet", "loyal", "thanh vien"]):
            parameters["target_group"] = "loyal"
            
        # Số lượng voucher (tạo 5 voucher)
        q_match = re.search(r'tao\s+(?:ra\s+)?(\d+)\s*(voucher|vocher|ma\b)', norm_text)
        if q_match:
            parameters["quantity"] = int(q_match.group(1))
            
        # Giới hạn lượt dùng của 1 user
        user_match = re.search(r'(moi user|moi nguoi|moi khach|1 user|1 nguoi|1 khach|tung user)[^\d]*(\d+)', norm_text)
        if user_match:
            parameters["max_uses_per_user"] = int(user_match.group(2))
        else:
            # Số lượng / Giới hạn lượt dùng tổng (nếu không nói mỗi user)
            sl_match = re.search(r'(so luong|gioi han|luot|lan dung)\s*(?:toi da\s*)?(\d+)', norm_text)
            if sl_match:
                parameters["usage_limit"] = int(sl_match.group(2))
                
        # Tên chiến dịch / voucher (lấy nguyên dấu từ text.lower)
        name_match = re.search(r't[eê]n\s+(?:voucher|vocher|chi[eê]n d[iị]ch|chuy[eê]n d[iị]ch)?\s*(?:l[aà]\s+)?([\w\s_\u00c0-\u1ef9]+?)(?=$|,|\.)', text.lower())
        if name_match:
            parameters["campaign_name"] = name_match.group(1).strip()
            
        # Tên quán/đối tác / chi nhánh
        id_match = re.search(r'(?:id|m[aã]|m[aạ]ng)\s+(?:l[aà]\s+)?(\d+)', text.lower())
        if id_match:
            parameters["target_id"] = int(id_match.group(1))
        else:
            loc_match = re.search(r'(?:cho|t[ừư]|c[ủu]a)\s+(?:t[ấa]t c[ảa]\s+(?:c[aá]c\s+)?(?:đ[ịi]a đi[ểe]m|chi nh[aá]nh|qu[aá]n)\s+(?:t[ừư]|c[ủu]a)\s+)?(?:qu[aá]n\s+cafe\s+|qu[aá]n\s+|owner\s+|nh[aà]\s+h[aà]ng\s+|đ[ịi]a đi[ểe]m\s+|chi nh[aá]nh\s+)?([\w\s_\u00c0-\u1ef9]+?)(?=\s+voucher|\s+vocher|\s+giam|\s+gi[aả]m|\s+tang|\s+t[aặ]ng|,|\.|$)', text.lower())
            if loc_match:
                parameters["target_location_name"] = loc_match.group(1).strip()
            
        # Thời hạn (hạn 2 tháng, hạn 30 ngày)
        duration_match = re.search(r'han\s+la\s+(\d+)\s+(thang|ngay|tuan)', norm_text)
        if not duration_match:
            duration_match = re.search(r'han\s+(\d+)\s+(thang|ngay|tuan)', norm_text)
            
        if duration_match:
            try:
                import datetime
                num = int(duration_match.group(1))
                unit = duration_match.group(2)
                today = datetime.date.today()
                
                if unit == "thang":
                    # Cộng đại khái 30 ngày mỗi tháng
                    end_d = today + datetime.timedelta(days=num * 30)
                elif unit == "tuan":
                    end_d = today + datetime.timedelta(days=num * 7)
                else: # ngay
                    end_d = today + datetime.timedelta(days=num)
                    
                parameters["end_date"] = end_d.isoformat()
            except Exception:
                pass
            
    # 3. Quản lý Booking (Owner)
    elif role == "owner" and any(k in norm_text for k in ["huy don", "duyet don", "hoan thanh don"]):
        intent = "owner_manage_booking"
        id_match = re.search(r'don\s*(so\s*)?(\d+)', norm_text)
        if id_match:
            parameters["booking_id"] = int(id_match.group(2))
        
        if "huy" in norm_text:
            parameters["action"] = "cancel"
        elif "duyet" in norm_text or "xac nhan" in norm_text:
            parameters["action"] = "approve"
        elif "hoan thanh" in norm_text:
            parameters["action"] = "complete"

    return {
        "intent": intent,
        "confidence": 0.85,
        "parameters": parameters,
        "answer": ""
    }
