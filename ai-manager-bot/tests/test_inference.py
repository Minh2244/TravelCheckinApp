from __future__ import annotations

import json
import sys
import unittest
from unittest.mock import patch
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.inference import predict_payload, process_payload  # noqa: E402
from app.evaluator import evaluate_cases, load_evaluation_cases  # noqa: E402
from app.prompt_suggestions import get_prompt_suggestions  # noqa: E402


def load_fixture(name: str) -> dict:
    return json.loads((ROOT / "tests" / "fixtures" / name).read_text(encoding="utf-8"))


class AiManagerBotInferenceTest(unittest.TestCase):
    def test_owner_review_summary_allowed(self) -> None:
        payload = load_fixture("owner_review_summary.json")
        result = process_payload(payload)

        self.assertTrue(result["allowed"])
        self.assertEqual(result["intent"], "owner_review_summary")
        self.assertEqual(result["risk_level"], "read")
        self.assertEqual(result["action_plan"]["action_key"], "owner_review_summary")
        self.assertIn("selected_location_id", result["entities"])

    def test_owner_service_crud_blocked(self) -> None:
        payload = load_fixture("owner_blocked_service_crud.json")
        result = process_payload(payload)

        self.assertFalse(result["allowed"])
        self.assertEqual(result["label"], "owner_blocked_location_service_crud")
        self.assertEqual(result["action_plan"]["action_key"], "blocked")

    def test_owner_blocked_route(self) -> None:
        payload = {
            "role": "owner",
            "route": "/owner/front-office/restaurant",
            "text": "xác nhận đơn bàn số 3",
            "available_actions": [],
        }
        result = predict_payload(payload)

        self.assertFalse(result["allowed"])
        self.assertEqual(result["label"], "owner_blocked_operations")
        self.assertEqual(result["confidence"], 0.99)

    def test_admin_critical_requires_confirmation(self) -> None:
        payload = load_fixture("admin_critical_lock_user.json")
        result = process_payload(payload)

        self.assertTrue(result["allowed"])
        self.assertEqual(result["label"], "admin_critical")
        self.assertEqual(result["risk_level"], "critical")
        self.assertTrue(result["action_plan"]["requires_confirmation"])

    def test_revenue_mock_answer(self) -> None:
        payload = {
            "role": "owner",
            "route": "/owner/dashboard",
            "text": "doanh thu tháng này sao rồi",
            "available_actions": ["owner_revenue_summary"],
            "mock_context": {
                "revenue_this_month": 18500000,
                "revenue_last_month": 20000000,
            },
        }
        result = process_payload(payload)

        self.assertTrue(result["allowed"])
        self.assertEqual(result["action_plan"]["action_key"], "owner_revenue_summary")
        self.assertIn("18.500.000đ", result["answer"])
        self.assertIn("giảm", result["answer"])

    def test_owner_dashboard_suggestions(self) -> None:
        result = get_prompt_suggestions("owner", "/owner/dashboard")

        self.assertIsNone(result["disabled_reason"])
        prompts = [item["intent_hint"] for item in result["suggestions"]]
        ids = [item["id"] for item in result["suggestions"]]
        self.assertIn("owner_revenue_summary", prompts)
        self.assertIn("owner_common_revenue_month", ids)
        self.assertIn("owner_common_cancel_rate", ids)

    def test_owner_blocked_route_has_no_suggestions(self) -> None:
        result = get_prompt_suggestions("owner", "/owner/front-office/restaurant")

        self.assertEqual(result["suggestions"], [])
        self.assertEqual(result["disabled_reason"], "OWNER_AI_DISABLED_ON_OPERATIONS_ROUTE")

    def test_admin_suggestions_include_critical_preview(self) -> None:
        result = get_prompt_suggestions("admin", "/admin/users")

        suggestions = result["suggestions"]
        self.assertTrue(any(item["risk_level"] == "critical" for item in suggestions))

    def test_admin_owner_services_route_has_suggestions(self) -> None:
        result = get_prompt_suggestions("admin", "/admin/owner-services")

        self.assertIsNone(result["disabled_reason"])
        prompts = [item["id"] for item in result["suggestions"]]
        self.assertIn("admin_reviews_pending", prompts)
        self.assertIn("admin_common_month_revenue", prompts)
        self.assertIn("admin_common_cancel_rate", prompts)

    def test_noisy_southern_revenue_intent(self) -> None:
        payload = {
            "role": "owner",
            "route": "/owner/dashboard",
            "text": "bữa nay doang thu thang nay giam hong z coi gium tui dc ko",
            "available_actions": ["owner_revenue_summary"],
        }
        result = process_payload(payload)

        self.assertTrue(result["allowed"])
        self.assertEqual(result["intent"], "owner_revenue_summary")

    def test_message_alias_is_accepted(self) -> None:
        payload = {
            "role": "owner",
            "route": "/owner/dashboard",
            "message": "hôm nay doanh thu quán tăng hay giảm",
            "available_actions": ["owner_revenue_summary"],
        }
        result = process_payload(payload)

        self.assertTrue(result["allowed"])
        self.assertEqual(result["intent"], "owner_revenue_summary")

    def test_noisy_review_reply_draft(self) -> None:
        payload = {
            "role": "owner",
            "route": "/owner/reviews",
            "text": "khach chui 1 sao qua troi soan gium tui cau tra loi hen",
            "available_actions": ["owner_review_reply_draft"],
        }
        result = process_payload(payload)

        self.assertTrue(result["allowed"])
        self.assertEqual(result["intent"], "owner_review_reply_draft")

    def test_noisy_owner_service_crud_blocked(self) -> None:
        payload = {
            "role": "owner",
            "route": "/owner/dashboard",
            "text": "them dv cafe sua 20k vo quan gium tui nha",
            "available_actions": [],
        }
        result = process_payload(payload)

        self.assertFalse(result["allowed"])
        self.assertEqual(result["label"], "owner_blocked_location_service_crud")

    def test_noisy_admin_critical(self) -> None:
        payload = {
            "role": "admin",
            "route": "/admin/users",
            "text": "admin khoa tk user nay gium tui dc hong",
            "available_actions": ["admin_user_lock"],
        }
        result = process_payload(payload)

        self.assertTrue(result["allowed"])
        self.assertEqual(result["label"], "admin_critical")
        self.assertTrue(result["action_plan"]["requires_confirmation"])

    def test_admin_revenue_typo_compare_months(self) -> None:
        payload = {
            "role": "admin",
            "route": "/admin/dashboard",
            "text": "xem tat ca danh thua cua thang 5 va 6 so sanh",
            "available_actions": ["admin_revenue_analysis"],
        }
        result = process_payload(payload)

        self.assertTrue(result["allowed"])
        self.assertEqual(result["intent"], "admin_read_analysis")
        self.assertEqual(result["action_plan"]["action_key"], "admin_revenue_analysis")
        self.assertEqual(result["entities"].get("compare_months"), [5, 6])

    def test_admin_revenue_specific_month_uses_monthly_context(self) -> None:
        payload = {
            "role": "admin",
            "route": "/admin/dashboard",
            "text": "xem doanh thu tháng 6",
            "available_actions": ["admin_revenue_analysis"],
            "screen_context": {
                "periodLabel": "hôm nay",
                "totalRevenue": 0,
                "monthlyRevenue": [
                    {"monthKey": "2026-05", "month": 5, "year": 2026, "total": 5_000_000},
                    {"monthKey": "2026-06", "month": 6, "year": 2026, "total": 6_500_000},
                ],
            },
        }
        result = process_payload(payload)

        self.assertTrue(result["allowed"])
        self.assertEqual(result["entities"].get("target_month"), 6)
        self.assertIn("tháng 6/2026", result["answer"])
        self.assertIn("6.500.000", result["answer"])
        self.assertIn("tăng 30.0%", result["answer"])

    def test_admin_revenue_specific_month_missing_context_is_clear(self) -> None:
        payload = {
            "role": "admin",
            "route": "/admin/dashboard",
            "text": "xem doanh thu tháng 6",
            "available_actions": ["admin_revenue_analysis"],
            "screen_context": {
                "periodLabel": "hôm nay",
                "totalRevenue": 0,
                "monthlyRevenue": [],
            },
        }
        result = process_payload(payload)

        self.assertTrue(result["allowed"])
        self.assertIn("chưa có dữ liệu tháng đó", result["answer"])

    def test_admin_export_report_is_not_confused_with_revenue_summary(self) -> None:
        payload = {
            "role": "admin",
            "route": "/admin/dashboard",
            "text": "bạn có thể xuất file báo cáo doanh thu tháng 6 hong",
            "available_actions": ["admin_revenue_analysis", "admin_export_report"],
            "screen_context": {
                "periodLabel": "hôm nay",
                "totalRevenue": 0,
                "monthlyRevenue": [
                    {"monthKey": "2026-05", "month": 5, "year": 2026, "total": 13_841_000},
                    {"monthKey": "2026-06", "month": 6, "year": 2026, "total": 143_600_000},
                ],
            },
        }
        result = process_payload(payload)

        self.assertTrue(result["allowed"])
        self.assertEqual(result["intent"], "admin_export_report")
        self.assertEqual(result["action_plan"]["action_key"], "admin_export_report")
        self.assertTrue(result["action_plan"]["requires_confirmation"])
        self.assertIn("xuất báo cáo", result["answer"])
        self.assertIn("tháng 6/2026", result["answer"])
        self.assertIn("143.600.000", result["answer"])

    def test_owner_export_report_is_available_on_dashboard(self) -> None:
        payload = {
            "role": "owner",
            "route": "/owner/dashboard",
            "text": "xuất file báo cáo tháng này cho tui",
            "available_actions": ["owner_revenue_summary", "owner_export_report"],
            "screen_context": {
                "periodLabel": "tháng này",
                "totalRevenue": 2_400_000,
            },
        }
        result = process_payload(payload)

        self.assertTrue(result["allowed"])
        self.assertEqual(result["intent"], "owner_export_report")
        self.assertEqual(result["action_plan"]["action_key"], "owner_export_report")
        self.assertIn("owner", result["answer"])

    def test_admin_follow_up_export_inherits_month_from_history(self) -> None:
        payload = {
            "role": "admin",
            "route": "/admin/dashboard",
            "text": "xuat file bao cao giup tui",
            "chat_history": [
                {"from": "user", "text": "xem doanh thu thang 6"},
                {"from": "assistant", "text": "Doanh thu thang 6/2026 la 143.600.000d."},
            ],
            "available_actions": ["admin_revenue_analysis", "admin_export_report"],
            "screen_context": {
                "periodLabel": "hom nay",
                "totalRevenue": 0,
                "monthlyRevenue": [
                    {"monthKey": "2026-05", "month": 5, "year": 2026, "total": 13_841_000},
                    {"monthKey": "2026-06", "month": 6, "year": 2026, "total": 143_600_000},
                ],
            },
        }
        result = process_payload(payload)

        self.assertTrue(result["allowed"])
        self.assertEqual(result["intent"], "admin_export_report")
        self.assertEqual(result["entities"].get("target_month"), 6)
        self.assertIn("6/2026", result["answer"])
        self.assertIn("143.600.000", result["answer"])

    def test_owner_follow_up_revenue_inherits_month_from_history(self) -> None:
        payload = {
            "role": "owner",
            "route": "/owner/dashboard",
            "text": "thang do tang hay giam vay",
            "chat_history": [
                {"from": "owner", "text": "xem doanh thu thang 5"},
            ],
            "available_actions": ["owner_revenue_summary"],
            "screen_context": {
                "periodLabel": "hom nay",
                "monthlyRevenue": [
                    {"monthKey": "2026-04", "month": 4, "year": 2026, "total": 10_000_000},
                    {"monthKey": "2026-05", "month": 5, "year": 2026, "total": 13_841_000},
                ],
            },
        }
        result = process_payload(payload)

        self.assertTrue(result["allowed"])
        self.assertEqual(result["intent"], "owner_revenue_summary")
        self.assertEqual(result["entities"].get("target_month"), 5)
        self.assertIn("5/2026", result["answer"])
        self.assertIn("13.841.000", result["answer"])

    @patch("app.inference.maybe_analyze_payload")
    def test_llm_can_refine_unknown_to_revenue_intent(self, mocked_llm) -> None:
        from app.llm_layer import LlmAnalysis

        mocked_llm.return_value = LlmAnalysis(
            intent_candidate="owner_revenue_summary",
            confidence=0.91,
            entities={"target_month": 6, "target_year": 2026},
            answer="Doanh thu thang 6/2026 hien la 6.500.000d.",
            provider="openai",
            model="gpt-4.1-mini",
        )

        payload = {
            "role": "owner",
            "route": "/owner/dashboard",
            "text": "thang do sao roi vay",
            "chat_history": [{"from": "owner", "text": "xem doanh thu thang 6"}],
            "available_actions": ["owner_revenue_summary"],
            "screen_context": {
                "monthlyRevenue": [
                    {"monthKey": "2026-05", "month": 5, "year": 2026, "total": 5_000_000},
                    {"monthKey": "2026-06", "month": 6, "year": 2026, "total": 6_500_000},
                ],
            },
        }
        result = process_payload(payload)

        self.assertTrue(result["allowed"])
        self.assertEqual(result["intent"], "owner_revenue_summary")
        self.assertEqual(result["entities"].get("target_month"), 6)
        self.assertIn("6.500.000", result["answer"])
        self.assertEqual(result["llm"]["provider"], "openai")

    @patch("app.inference.maybe_analyze_payload")
    def test_llm_cannot_override_blocked_owner_route(self, mocked_llm) -> None:
        from app.llm_layer import LlmAnalysis

        mocked_llm.return_value = LlmAnalysis(
            intent_candidate="owner_revenue_summary",
            confidence=0.98,
            entities={"target_month": 6},
            answer="Khong duoc phep.",
            provider="openai",
            model="gpt-4.1-mini",
        )

        payload = {
            "role": "owner",
            "route": "/owner/front-office/restaurant",
            "text": "xem doanh thu thang 6",
            "available_actions": ["owner_revenue_summary"],
        }
        result = process_payload(payload)

        self.assertFalse(result["allowed"])
        self.assertEqual(result["label"], "owner_blocked_operations")

    def test_owner_capability_help(self) -> None:
        payload = {
            "role": "owner",
            "route": "/owner/dashboard",
            "text": "bạn có thể làm gì",
            "available_actions": ["owner_revenue_summary", "owner_review_summary", "owner_voucher_draft"],
        }
        result = process_payload(payload)

        self.assertTrue(result["allowed"])
        self.assertEqual(result["intent"], "capability_help")
        self.assertIn("dashboard owner", result["answer"])
        self.assertIn("tỷ lệ hủy đơn", result["answer"])
        self.assertIn("không tạo/sửa địa điểm", result["answer"])
        self.assertIn("không đụng phần chuyển tiền", result["answer"])

    def test_admin_capability_help(self) -> None:
        payload = {
            "role": "admin",
            "route": "/admin/dashboard",
            "text": "vậy bạn có thể làm gì",
            "available_actions": ["admin_revenue_analysis"],
        }
        result = process_payload(payload)

        self.assertTrue(result["allowed"])
        self.assertEqual(result["intent"], "capability_help")
        self.assertIn("dashboard admin", result["answer"])
        self.assertIn("chỉ tạo bản xem trước", result["answer"])

    @patch("app.inference.maybe_analyze_payload")
    def test_llm_answer_does_not_override_revenue_fact_answer(self, mocked_llm) -> None:
        from app.llm_layer import LlmAnalysis

        mocked_llm.return_value = LlmAnalysis(
            intent_candidate="owner_revenue_summary",
            confidence=0.97,
            entities={"target_month": 6, "target_year": 2026},
            answer="Doanh thu hôm nay là 0đ.",
            provider="openai",
            model="gpt-4.1-mini",
        )

        payload = {
            "role": "owner",
            "route": "/owner/dashboard",
            "text": "xem doanh thu tháng 6",
            "available_actions": ["owner_revenue_summary"],
            "screen_context": {
                "periodLabel": "hôm nay",
                "totalRevenue": 0,
                "monthlyRevenue": [
                    {"monthKey": "2026-05", "month": 5, "year": 2026, "total": 13_841_000},
                    {"monthKey": "2026-06", "month": 6, "year": 2026, "total": 143_600_000},
                ],
            },
        }
        result = process_payload(payload)

        self.assertTrue(result["allowed"])
        self.assertEqual(result["intent"], "owner_revenue_summary")
        self.assertIn("tháng 6/2026", result["answer"])
        self.assertIn("143.600.000", result["answer"])
        self.assertNotIn("Doanh thu hôm nay là 0đ.", result["answer"])

    def test_owner_cancellation_rate_summary(self) -> None:
        payload = {
            "role": "owner",
            "route": "/owner/dashboard",
            "text": "ti le huy don thang nay va thang truoc sao roi",
            "available_actions": ["owner_revenue_summary"],
            "screen_context": {
                "periodLabel": "thang nay",
                "monthlyCancellation": [
                    {"monthKey": "2026-05", "month": 5, "year": 2026, "total": 50, "cancelled": 4},
                    {"monthKey": "2026-06", "month": 6, "year": 2026, "total": 40, "cancelled": 6},
                ],
            },
            "chat_history": [
                {"from": "user", "text": "xem thang 6 di"},
            ],
        }
        result = process_payload(payload)

        self.assertTrue(result["allowed"])
        self.assertEqual(result["intent"], "owner_revenue_summary")
        self.assertEqual(result["entities"].get("metric_focus"), "cancellation_rate")
        self.assertIn("tháng 6/2026", result["answer"])
        self.assertIn("15.0%", result["answer"])

    def test_admin_service_trend_question_is_allowed_and_answered(self) -> None:
        payload = {
            "role": "admin",
            "route": "/admin/dashboard",
            "text": "mảng dịch vụ nào đang yếu",
            "available_actions": ["admin_revenue_analysis"],
            "screen_context": {
                "serviceTrends": {
                    "restaurant": 55,
                    "hotel": 10,
                    "tourist": 35,
                },
            },
        }
        result = process_payload(payload)

        self.assertTrue(result["allowed"])
        self.assertEqual(result["intent"], "admin_read_analysis")
        self.assertEqual(result["entities"].get("metric_focus"), "service_trend")
        self.assertIn("Khách sạn", result["answer"])
        self.assertIn("10%", result["answer"])

    def test_default_evaluation_cases_pass(self) -> None:
        result = evaluate_cases(load_evaluation_cases())

        failed_names = [item["name"] for item in result["results"] if not item["ok"]]
        self.assertEqual(failed_names, [])
        self.assertEqual(result["failed"], 0)


if __name__ == "__main__":
    unittest.main()
