from __future__ import annotations

import datetime
import json
import sys
import unittest
from pathlib import Path
from unittest.mock import Mock, patch


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.inference import process_payload  # noqa: E402
from app.intent_service import _local_owner_intent_fallback  # noqa: E402


class ManagerAiChatUpgradeTest(unittest.TestCase):
    def test_owner_capability_chat_is_natural(self) -> None:
        result = process_payload(
            {
                "role": "owner",
                "route": "/owner/dashboard",
                "text": "bạn có thể làm gì",
                "available_actions": ["general_chat"],
            }
        )

        self.assertEqual(result["intent"], "general_chat")
        self.assertEqual(result["action_plan"]["action_key"], "general_chat")
        self.assertIn("trợ lý AI Owner", result["answer"])
        self.assertIn("tạo voucher", result["answer"])

    def test_admin_small_talk_is_natural(self) -> None:
        result = process_payload(
            {
                "role": "admin",
                "route": "/admin/dashboard",
                "text": "cảm ơn nha",
                "available_actions": ["general_chat"],
            }
        )

        self.assertEqual(result["intent"], "general_chat")
        self.assertIn("Dạ được sếp", result["answer"])

    def test_voucher_fallback_draft_hides_technical_source_and_keeps_dates(self) -> None:
        result = _local_owner_intent_fallback(
            {
                "role": "owner",
                "text": "tạo vocher giảm giá 50000 hạn dùng 3 ngày",
                "screen_context": {},
            },
            force_fallback=True,
        )

        self.assertIsNotNone(result)
        assert result is not None
        today = datetime.date.today()
        expected_end = today + datetime.timedelta(days=3)

        self.assertEqual(result["intent"], "owner_voucher_draft")
        self.assertEqual(result["parameters"]["discount_value"], 50000)
        self.assertEqual(result["parameters"]["start_date"], today.isoformat())
        self.assertEqual(result["parameters"]["end_date"], expected_end.isoformat())
        self.assertNotIn("NLP Fallback", result["answer"])
        self.assertIn("Bản nháp Voucher", result["answer"])
        self.assertIn("Hiệu lực", result["answer"])

    @patch("app.intent_service.urllib.request.urlopen")
    @patch("app.intent_service.genai.Client")
    def test_openai_is_used_before_nlp_when_gemini_fails(self, mocked_gemini_client: Mock, mocked_urlopen: Mock) -> None:
        mocked_gemini_client.return_value.models.generate_content.side_effect = RuntimeError("gemini boom")

        openai_payload = {
            "choices": [
                {
                    "message": {
                        "content": json.dumps(
                            {
                                "intent": "owner_voucher_draft",
                                "confidence": 0.91,
                                "parameters": {"discount_value": 50000},
                                "answer": "📋 Bản nháp Voucher:\n• Giảm giá: 50.000 đ\nSếp xem và bấm [Đồng ý & Thực thi] nhé.",
                            },
                            ensure_ascii=False,
                        )
                    }
                }
            ]
        }
        mocked_response = Mock()
        mocked_response.__enter__ = Mock(return_value=mocked_response)
        mocked_response.__exit__ = Mock(return_value=None)
        mocked_response.read.return_value = json.dumps(openai_payload, ensure_ascii=False).encode("utf-8")
        mocked_urlopen.return_value = mocked_response

        result = process_payload(
            {
                "role": "owner",
                "route": "/owner/dashboard",
                "text": "tạo voucher giảm giá 50000 hạn dùng 3 ngày",
                "available_actions": ["owner_voucher_draft"],
            }
        )

        self.assertEqual(result["intent"], "owner_voucher_draft")
        self.assertEqual(result["llm"]["provider"], "openai")
        self.assertEqual(result["action_plan"]["action_key"], "owner_voucher_draft")
        self.assertEqual(result["entities"]["discount_value"], 50000)
        self.assertIn("end_date", result["entities"])
        self.assertNotIn("NLP Fallback", result["answer"])

    def test_owner_cancellation_question_routes_to_cancellation_stats(self) -> None:
        result = process_payload(
            {
                "role": "owner",
                "route": "/owner/dashboard",
                "text": "tháng này tỷ lệ hủy đơn bao nhiêu vậy",
                "available_actions": ["owner_get_cancellation_stats", "general_chat"],
            }
        )

        self.assertEqual(result["intent"], "owner_get_cancellation_stats")
        self.assertEqual(result["entities"]["time_range"], "this_month")
        self.assertEqual(result["llm"]["provider"], "local")

    def test_admin_top_services_question_routes_to_top_services(self) -> None:
        result = process_payload(
            {
                "role": "admin",
                "route": "/admin/dashboard",
                "text": "tháng này dịch vụ nào người dùng vào nhiều nhất",
                "available_actions": ["admin_get_top_services", "general_chat"],
            }
        )

        self.assertEqual(result["intent"], "admin_get_top_services")
        self.assertEqual(result["entities"]["time_range"], "this_month")

    def test_admin_top_customers_question_routes_to_top_customers(self) -> None:
        result = process_payload(
            {
                "role": "admin",
                "route": "/admin/dashboard",
                "text": "top 3 người dùng chi tiêu nhiều nhất tháng 8",
                "available_actions": ["admin_get_top_customers", "general_chat"],
            }
        )

        self.assertEqual(result["intent"], "admin_get_top_customers")
        self.assertEqual(result["entities"]["months"], [8])
        self.assertEqual(result["entities"]["limit"], 3)

    def test_revenue_compare_months_routes_to_dashboard_stats(self) -> None:
        result = process_payload(
            {
                "role": "owner",
                "route": "/owner/dashboard",
                "text": "so sánh doanh thu tháng 5 và tháng 8",
                "available_actions": ["get_dashboard_stats", "general_chat"],
            }
        )

        self.assertEqual(result["intent"], "get_dashboard_stats")
        self.assertEqual(result["entities"]["months"], [5, 8])

    def test_compact_month_list_routes_to_dashboard_stats(self) -> None:
        result = process_payload(
            {
                "role": "owner",
                "route": "/owner/dashboard",
                "text": "nhận xét tỉ lệ doanh thu tháng 6 7 8",
                "available_actions": ["get_dashboard_stats", "general_chat"],
            }
        )

        self.assertEqual(result["intent"], "get_dashboard_stats")
        self.assertEqual(result["entities"]["months"], [6, 7, 8])

    def test_t_month_shortcuts_route_to_dashboard_stats(self) -> None:
        result = process_payload(
            {
                "role": "admin",
                "route": "/admin/dashboard",
                "text": "so sánh dt t6 t7 t8",
                "available_actions": ["get_dashboard_stats", "general_chat"],
            }
        )

        self.assertEqual(result["intent"], "get_dashboard_stats")
        self.assertEqual(result["entities"]["months"], [6, 7, 8])

    def test_admin_revenue_ratio_months_routes_to_dashboard_stats(self) -> None:
        result = process_payload(
            {
                "role": "admin",
                "route": "/admin/dashboard",
                "text": "nhan xet ti le doanh thu thang 6 7 8",
                "available_actions": ["get_dashboard_stats", "export_revenue_report", "general_chat"],
            }
        )

        self.assertEqual(result["intent"], "get_dashboard_stats")
        self.assertEqual(result["entities"]["months"], [6, 7, 8])
        self.assertEqual(result["action_plan"]["action_key"], "get_dashboard_stats")

    def test_export_revenue_months_takes_priority_over_dashboard_stats(self) -> None:
        result = process_payload(
            {
                "role": "admin",
                "route": "/admin/dashboard",
                "text": "xuat file doanh thu thang 7 8",
                "available_actions": ["get_dashboard_stats", "export_revenue_report", "general_chat"],
            }
        )

        current_year = datetime.date.today().year
        self.assertEqual(result["intent"], "export_revenue_report")
        self.assertEqual(result["entities"]["months"], [7, 8])
        self.assertEqual(result["entities"]["start_date"], f"{current_year}-07-01")
        self.assertEqual(result["entities"]["end_date"], f"{current_year}-08-31")
        self.assertEqual(result["action_plan"]["action_key"], "export_revenue_report")

    def test_owner_recommendation_question_routes_to_business_recommendations(self) -> None:
        result = process_payload(
            {
                "role": "owner",
                "route": "/owner/dashboard",
                "text": "gợi ý tui nên làm gì tháng này",
                "available_actions": ["owner_get_business_recommendations", "general_chat"],
            }
        )

        self.assertEqual(result["intent"], "owner_get_business_recommendations")
        self.assertEqual(result["entities"]["time_range"], "this_month")
        self.assertEqual(result["action_plan"]["action_key"], "owner_get_business_recommendations")

    def test_admin_recommendation_question_routes_to_business_recommendations(self) -> None:
        result = process_payload(
            {
                "role": "admin",
                "route": "/admin/dashboard",
                "text": "phân tích doanh thu tỷ lệ hủy rồi đề xuất chiến dịch tháng này",
                "available_actions": ["admin_get_business_recommendations", "general_chat"],
            }
        )

        self.assertEqual(result["intent"], "admin_get_business_recommendations")
        self.assertEqual(result["entities"]["time_range"], "this_month")
        self.assertEqual(result["action_plan"]["action_key"], "admin_get_business_recommendations")


if __name__ == "__main__":
    unittest.main()
