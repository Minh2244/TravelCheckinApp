from typing import Any, Callable, Dict, List, Optional
from pydantic import BaseModel, Field

# ---------------------------------------------------------
# CẤU TRÚC ĐỊNH NGHĨA ACTION (SCHEMA)
# ---------------------------------------------------------
class ActionDefinition(BaseModel):
    name: str
    description: str
    roles: List[str]  # ["admin", "owner"]
    requires_confirmation: bool = False
    # Định nghĩa các tham số cần AI trích xuất (nếu có)
    parameters_schema: Optional[Dict[str, Any]] = None

# ---------------------------------------------------------
# DANH SÁCH CÁC CHỨC NĂNG ĐƯỢC PHÉP (ACTION REGISTRY)
# ---------------------------------------------------------

REGISTRY: List[ActionDefinition] = [

    # ==========================================
    # CHUNG (DÙNG CHO CẢ ADMIN VÀ OWNER)
    # ==========================================
    ActionDefinition(
        name="get_dashboard_stats",
        description="Lấy dữ liệu thống kê doanh thu tổng quan. BẮT BUỘC trích xuất thời gian người dùng muốn xem (hôm nay, tuần này, tháng này, năm nay).",
        roles=["admin", "owner"],
        requires_confirmation=False,
        parameters_schema={
            "type": "object",
            "properties": {
                "time_range": {"type": "string", "enum": ["today", "this_week", "this_month", "this_year"], "description": "Khoảng thời gian cần xem (mặc định: this_month)"}
            }
        }
    ),
    ActionDefinition(
        name="export_revenue_report",
        description="Xuất báo cáo doanh thu ra file Excel. Bắt buộc phải có start_date và end_date.",
        roles=["admin", "owner"],
        requires_confirmation=False,
        parameters_schema={
            "type": "object",
            "properties": {
                "start_date": {"type": "string", "description": "Ngày bắt đầu (YYYY-MM-DD)"},
                "end_date": {"type": "string", "description": "Ngày kết thúc (YYYY-MM-DD)"}
            },
            "required": ["start_date", "end_date"]
        }
    ),
    ActionDefinition(
        name="view_commissions",
        description="Xem danh sách chi tiết hoa hồng (Chỉ xem, tuyệt đối KHÔNG thực hiện thanh toán).",
        roles=["admin", "owner"],
        requires_confirmation=False
    ),

    # ==========================================
    # DÀNH RIÊNG CHO OWNER (PHASE 1 - BÁO CÁO)
    # ==========================================
    ActionDefinition(
        name="owner_get_order_stats",
        description="Lấy số lượng đơn hoàn thành và đơn bị hủy. BẮT BUỘC trích xuất time_range.",
        roles=["owner"],
        requires_confirmation=False,
        parameters_schema={
            "type": "object",
            "properties": {
                "time_range": {"type": "string", "enum": ["today", "this_week", "this_month", "this_year"], "description": "Khoảng thời gian cần xem"},
                "months": {"type": "array", "items": {"type": "integer"}}, "start_date": {"type": "string"}, "end_date": {"type": "string"}
            } }
    ),
    ActionDefinition(
        name="owner_get_revenue_structure",
        description="Lấy cơ cấu doanh thu theo mảng kinh doanh (Du lịch, Khách sạn, Ăn uống) của tất cả địa điểm.",
        roles=["owner"],
        requires_confirmation=False,
        parameters_schema={
            "type": "object",
            "properties": {
                "time_range": {"type": "string", "enum": ["today", "this_week", "this_month", "this_year"], "description": "Khoảng thời gian cần xem"},
                "months": {"type": "array", "items": {"type": "integer"}}, "start_date": {"type": "string"}, "end_date": {"type": "string"}
            } }
    ),
    ActionDefinition(
        name="owner_get_top_services",
        description="Phân tích hiệu suất dịch vụ (dịch vụ nào bán chạy nhất, được yêu thích nhất).",
        roles=["owner"],
        requires_confirmation=False,
        parameters_schema={
            "type": "object",
            "properties": {
                "time_range": {"type": "string", "enum": ["today", "this_week", "this_month", "this_year"], "description": "Khoảng thời gian cần xem"},
                "location_name": {"type": "string", "description": "Tên địa điểm khách hàng muốn xem (nếu có)"},
                "months": {"type": "array", "items": {"type": "integer"}}, "start_date": {"type": "string"}, "end_date": {"type": "string"}
            } }
    ),
    ActionDefinition(
        name="owner_analyze_reviews",
        description="Tổng hợp, phân tích các đánh giá và tính số sao trung bình.",
        roles=["owner"],
        requires_confirmation=False,
        parameters_schema={
            "type": "object",
            "properties": {
                "time_range": {"type": "string", "enum": ["today", "this_week", "this_month", "this_year"], "description": "Khoảng thời gian cần xem"},
                "months": {"type": "array", "items": {"type": "integer"}, "description": "Danh sách các tháng cụ thể nếu có (ví dụ: [5,6])"}
            } }
    ),

    ActionDefinition(
        name="owner_get_cancellation_stats",
        description="Thong ke so don huy va ty le huy don cua owner theo thoi gian.",
        roles=["owner"],
        requires_confirmation=False,
        parameters_schema={
            "type": "object",
            "properties": {
                "time_range": {"type": "string", "enum": ["today", "this_week", "this_month", "this_year", "all"]},
                "months": {"type": "array", "items": {"type": "integer"}},
                "start_date": {"type": "string"},
                "end_date": {"type": "string"}
            }
        }
    ),
    ActionDefinition(
        name="owner_get_top_customers",
        description="Thong ke top khach hang chi tieu nhieu nhat tai cac dia diem cua owner.",
        roles=["owner"],
        requires_confirmation=False,
        parameters_schema={
            "type": "object",
            "properties": {
                "time_range": {"type": "string", "enum": ["today", "this_week", "this_month", "this_year", "all"]},
                "months": {"type": "array", "items": {"type": "integer"}},
                "start_date": {"type": "string"},
                "end_date": {"type": "string"},
                "limit": {"type": "integer"}
            }
        }
    ),
    ActionDefinition(
        name="owner_get_business_recommendations",
        description="Phan tich doanh thu, ty le huy, dia diem yeu va dich vu tot de dua ra khuyen nghi van hanh/voucher cho owner.",
        roles=["owner"],
        requires_confirmation=False,
        parameters_schema={
            "type": "object",
            "properties": {
                "time_range": {"type": "string", "enum": ["today", "this_week", "this_month", "this_year", "all"]},
                "months": {"type": "array", "items": {"type": "integer"}},
                "start_date": {"type": "string"},
                "end_date": {"type": "string"}
            }
        }
    ),

    # ==========================================
    # DÀNH RIÊNG CHO OWNER (PHASE 2 - VẬN HÀNH)
    # ==========================================
    ActionDefinition(
        name="owner_view_bookings",
        description="Xem danh sách các đơn đặt chỗ (đặt bàn, khách sạn, vé).",
        roles=["owner"],
        requires_confirmation=False
    ),
    ActionDefinition(
        name="owner_view_payments",
        description="Xem danh sách các giao dịch thanh toán của khách hàng.",
        roles=["owner"],
        requires_confirmation=False
    ),
    ActionDefinition(
        name="owner_view_reviews",
        description="Xem danh sách các bài đánh giá (review) từ khách hàng.",
        roles=["owner"],
        requires_confirmation=False
    ),
    ActionDefinition(
        name="owner_review_reply_publish",
        description="Trả lời bình luận đánh giá của khách hàng.",
        roles=["owner"],
        requires_confirmation=True,
        parameters_schema={
            "type": "object",
            "properties": {
                "review_id": {"type": "integer"},
                "reply_content": {"type": "string"}
            },
            "required": ["review_id", "reply_content"]
        }
    ),
    ActionDefinition(
        name="owner_view_vouchers",
        description="Xem danh sách các mã giảm giá (Voucher) do Owner tạo.",
        roles=["owner"],
        requires_confirmation=False
    ),
    ActionDefinition(
        name="owner_voucher_draft",
        description="Tạo bản nháp mã giảm giá mới cho chi nhánh. Trích xuất đầy đủ các trường: code, discount_value, start_date, end_date, min_order_value.",
        roles=["owner"],
        requires_confirmation=True,
        parameters_schema={
            "type": "object",
            "properties": {
                "code": {"type": "string", "description": "Mã voucher (vd: SUMMER2026). Tự tạo ngẫu nhiên nếu không có."},
                "discount_value": {"type": "number", "description": "Số tiền giảm giá (VND). Ví dụ: 200000, 50000, 100000"},
                "start_date": {"type": "string", "description": "Ngày bắt đầu hiệu lực (YYYY-MM-DD). Mặc định: hôm nay"},
                "end_date": {"type": "string", "description": "Ngày hết hạn (YYYY-MM-DD). Mặc định: 7 ngày sau"},
                "min_order_value": {"type": "number", "description": "Giá trị đơn hàng tối thiểu được áp dụng (VND). Mặc định: 0"},
                "apply_to_service_type": {"type": "string", "enum": ["room", "food", "ticket", "all"], "description": "Loại dịch vụ áp dụng"},
                "apply_to_location_type": {"type": "string", "enum": ["hotel", "restaurant", "tourist", "cafe", "resort", "all"], "description": "Loại hình cơ sở áp dụng"},
                "max_discount_amount": {"type": "number", "description": "Số tiền giảm tối đa (cho voucher dạng phần trăm)"},
                "usage_limit": {"type": "integer", "description": "Giới hạn tổng số lượt sử dụng voucher"},
                "max_uses_per_user": {"type": "integer", "description": "Giới hạn số lần dùng tối đa cho mỗi user"},
                "target_group": {"type": "string", "enum": ["all", "loyal"], "description": "Đối tượng khách hàng áp dụng"},
                "target_location_name": {"type": "string", "description": "Tên địa điểm/chi nhánh cụ thể muốn áp dụng voucher này (nếu có)"},
                "quantity": {"type": "integer", "description": "Số lượng voucher riêng biệt cần tạo (nếu tạo hàng loạt)"}
            },
            "required": ["discount_value"]
        }
    ),
    ActionDefinition(
        name="owner_view_employees",
        description="Xem danh sách, đếm tổng số lượng, thống kê nhân viên hiện tại của chi nhánh. Dùng khi người dùng hỏi 'có bao nhiêu nhân viên', 'thống kê nhân viên', 'danh sách nhân viên'.",
        roles=["owner"],
        requires_confirmation=False
    ),
    ActionDefinition(
        name="owner_manage_employees",
        description="Khóa/mở khóa nhân viên. Nếu khóa tất cả (KHÓA HẾT), BỎ TRỐNG employee_id, chỉ truyền action='ban'.",
        roles=["owner"],
        requires_confirmation=True,
        parameters_schema={
            "type": "object",
            "properties": {
                "employee_id": {"type": "integer", "description": "ID nhân viên. KHÔNG điền nếu muốn khóa/mở khóa tất cả"},
                "action": {"type": "string", "enum": ["ban", "unban"]}
            },
            "required": ["action"]
        }
    ),
    # ==========================================
    # DÀNH RIÊNG CHO ADMIN TỔNG
    # ==========================================
    ActionDefinition(
        name="admin_view_users",
        description="Xem danh sách người dùng (User) trên toàn hệ thống.",
        roles=["admin"],
        requires_confirmation=False
    ),
    ActionDefinition(
        name="admin_user_lock",
        description="Khóa tạm thời hoặc hàng loạt tài khoản người dùng/chủ cơ sở (Cấm XÓA).",
        roles=["admin"],
        requires_confirmation=True,
        parameters_schema={
            "type": "object",
            "properties": {
                "user_id": {"type": "integer", "description": "ID người dùng cụ thể cần khóa (nếu có)"},
                "target_role": {"type": "string", "enum": ["all", "user", "owner"], "description": "Nhóm tài khoản cần khóa (nếu khóa hàng loạt, ví dụ: all, user, owner)"},
                "reason": {"type": "string", "description": "Lý do khóa tài khoản"}
            },
            "required": []
        }
    ),
    ActionDefinition(
        name="admin_view_locations",
        description="Xem danh sách toàn bộ các địa điểm (Locations) trên hệ thống.",
        roles=["admin"],
        requires_confirmation=False
    ),
    ActionDefinition(
        name="admin_location_review",
        description="Duyệt (Approve) cho phép địa điểm mới hoạt động.",
        roles=[],
        requires_confirmation=True,
        parameters_schema={
            "type": "object",
            "properties": {
                "location_id": {"type": "integer"}
            },
            "required": ["location_id"]
        }
    ),
    ActionDefinition(
        name="admin_view_sos_alerts",
        description="Xem danh sách các cảnh báo khẩn cấp (SOS Alerts) từ người dùng.",
        roles=["admin"],
        requires_confirmation=False
    ),
    ActionDefinition(
        name="admin_send_push_notification",
        description="Gửi thông báo đẩy (Push Notification) đến toàn bộ hoặc một nhóm người dùng.",
        roles=["admin"],
        requires_confirmation=True,
        parameters_schema={
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "message": {"type": "string"}
            },
            "required": ["title", "message"]
        }
    ),
    ActionDefinition(
        name="admin_create_system_voucher",
        description="Tạo voucher hệ thống (Áp dụng cho mọi chi nhánh).",
        roles=["admin"],
        requires_confirmation=True,
        parameters_schema={
            "type": "object",
            "properties": {
                "code": {"type": "string"},
                "discount_value": {"type": "number"},
                "apply_to_service_type": {"type": "string", "enum": ["room", "food", "ticket", "all"]},
                "apply_to_location_type": {"type": "string", "enum": ["hotel", "restaurant", "tourist", "cafe", "resort", "all"]},
                "max_discount_amount": {"type": "number"},
                "usage_limit": {"type": "integer", "description": "Tổng số lượt dùng của một mã voucher"},
                "max_uses_per_user": {"type": "integer", "description": "Giới hạn số lần dùng tối đa cho mỗi user"},
                "target_group": {"type": "string", "enum": ["all", "loyal"]},
                "quantity": {"type": "integer", "description": "Số lượng mã voucher độc lập cần tạo"},
                "target_location_name": {"type": "string", "description": "Tên quán hoặc chủ cơ sở cụ thể mà voucher này hướng tới (nếu có)"},
                "target_id": {"type": "integer", "description": "ID của quán hoặc chủ cơ sở cụ thể (nếu có)"}
            },
            "required": ["discount_value"]
        }
    ),
    ActionDefinition(
        name="general_chat",
        description="Dùng khi người dùng muốn trò chuyện thông thường, hỏi đáp linh tinh không liên quan đến hệ thống.",
        roles=["admin", "owner"],
        requires_confirmation=False
    ),
    ActionDefinition(
        name="admin_get_user_growth",
        description="Thống kê tổng số và danh sách người dùng đăng ký mới. BẮT BUỘC trích xuất thời gian (tháng này, năm nay, từ ngày A đến B).",
        roles=["admin"],
        requires_confirmation=False,
        parameters_schema={
            "type": "object",
            "properties": {
                "time_range": {"type": "string", "enum": ["today", "this_week", "this_month", "this_year", "all"], "description": "Khoảng thời gian"},
                "months": {"type": "array", "items": {"type": "integer"}},
                "start_date": {"type": "string"},
                "end_date": {"type": "string"}
            }
        }
    ),
    ActionDefinition(
        name="admin_get_owners",
        description="Thống kê top chủ cơ sở (owner) kinh doanh tốt nhất hệ thống.",
        roles=["admin"],
        requires_confirmation=False,
        parameters_schema={
            "type": "object",
            "properties": {
                "limit": {"type": "integer", "description": "Số lượng top owner cần lấy (ví dụ 10, 20). Mặc định 5."}
            }
        }
    ),
    ActionDefinition(
        name="admin_get_top_locations",
        description="Thống kê top địa điểm (locations) có doanh thu cao nhất hệ thống.",
        roles=["admin"],
        requires_confirmation=False,
        parameters_schema={
            "type": "object",
            "properties": {
                "time_range": {"type": "string", "enum": ["today", "this_week", "this_month", "this_year", "all"], "description": "Khoảng thời gian"},
                "months": {"type": "array", "items": {"type": "integer"}},
                "start_date": {"type": "string"},
                "end_date": {"type": "string"},
                "limit": {"type": "integer", "description": "Số lượng top địa điểm cần lấy. Mặc định 3."}
            }
        }
    ),
    ActionDefinition(
        name="admin_get_cancellation_stats",
        description="Thong ke so don huy va ty le huy don toan he thong theo thoi gian.",
        roles=["admin"],
        requires_confirmation=False,
        parameters_schema={
            "type": "object",
            "properties": {
                "time_range": {"type": "string", "enum": ["today", "this_week", "this_month", "this_year", "all"]},
                "months": {"type": "array", "items": {"type": "integer"}},
                "start_date": {"type": "string"},
                "end_date": {"type": "string"}
            }
        }
    ),
    ActionDefinition(
        name="admin_get_top_services",
        description="Thong ke top dich vu duoc su dung hoac ban nhieu nhat tren toan he thong.",
        roles=["admin"],
        requires_confirmation=False,
        parameters_schema={
            "type": "object",
            "properties": {
                "time_range": {"type": "string", "enum": ["today", "this_week", "this_month", "this_year", "all"]},
                "months": {"type": "array", "items": {"type": "integer"}},
                "start_date": {"type": "string"},
                "end_date": {"type": "string"},
                "limit": {"type": "integer"}
            }
        }
    ),
    ActionDefinition(
        name="admin_get_top_customers",
        description="Thong ke top nguoi dung hoac khach hang chi tieu nhieu nhat tren he thong.",
        roles=["admin"],
        requires_confirmation=False,
        parameters_schema={
            "type": "object",
            "properties": {
                "time_range": {"type": "string", "enum": ["today", "this_week", "this_month", "this_year", "all"]},
                "months": {"type": "array", "items": {"type": "integer"}},
                "start_date": {"type": "string"},
                "end_date": {"type": "string"},
                "limit": {"type": "integer"}
            }
        }
    ),
    ActionDefinition(
        name="admin_get_business_recommendations",
        description="Phan tich doanh thu, ty le huy, dia diem yeu va dich vu tot de dua ra khuyen nghi van hanh/voucher toan he thong.",
        roles=["admin"],
        requires_confirmation=False,
        parameters_schema={
            "type": "object",
            "properties": {
                "time_range": {"type": "string", "enum": ["today", "this_week", "this_month", "this_year", "all"]},
                "months": {"type": "array", "items": {"type": "integer"}},
                "start_date": {"type": "string"},
                "end_date": {"type": "string"}
            }
        }
    ),
    ActionDefinition(
        name="admin_adjust_commission_rate",
        description="Điều chỉnh chính sách tỷ lệ hoa hồng (commission_rate) cho một địa điểm hoặc một chủ cơ sở.",
        roles=["admin"],
        requires_confirmation=True,
        parameters_schema={
            "type": "object",
            "properties": {
                "commission_rate": {"type": "number", "description": "Tỷ lệ hoa hồng mới (phần trăm, ví dụ 10, 12.5)"},
                "location_id": {"type": "integer", "description": "ID địa điểm cụ thể cần chỉnh sửa (nếu có)"},
                "owner_id": {"type": "integer", "description": "ID chủ cơ sở cần chỉnh sửa toàn bộ địa điểm (nếu có)"}
            },
            "required": ["commission_rate"]
        }
    ),
    ActionDefinition(
        name="owner_manage_booking",
        description="Duyệt, hủy hoặc hoàn thành đơn hàng (booking) cho chi nhánh.",
        roles=["owner"],
        requires_confirmation=True,
        parameters_schema={
            "type": "object",
            "properties": {
                "booking_id": {"type": "integer", "description": "ID đơn hàng"},
                "action": {"type": "string", "enum": ["approve", "cancel", "complete"], "description": "Hành động duyệt (approve), hủy (cancel), hoàn thành (complete)"}
            },
            "required": ["booking_id", "action"]
        }
    )
]

# ---------------------------------------------------------
# DANH SÁCH CÁC CHỨC NĂNG BỊ CẤM (BLACKLIST)
# ---------------------------------------------------------
# Để tăng tính an toàn, cấu hình thêm blacklist để chặn ngay từ đầu
FORBIDDEN_ACTIONS = [
    "create_location",      # Không tạo địa điểm
    "create_service",       # Không tạo dịch vụ địa điểm
    "pay_commission",       # Không thanh toán hoa hồng
    "delete_account",       # Không xóa tài khoản (nhân viên, user, owner)
    "delete_location",      # Không xóa địa điểm
]
