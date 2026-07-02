from __future__ import annotations

import json
import sys
import unittest
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
        self.assertIn("owner_revenue_summary", prompts)

    def test_owner_blocked_route_has_no_suggestions(self) -> None:
        result = get_prompt_suggestions("owner", "/owner/front-office/restaurant")

        self.assertEqual(result["suggestions"], [])
        self.assertEqual(result["disabled_reason"], "OWNER_AI_DISABLED_ON_OPERATIONS_ROUTE")

    def test_admin_suggestions_include_critical_preview(self) -> None:
        result = get_prompt_suggestions("admin", "/admin/users")

        suggestions = result["suggestions"]
        self.assertTrue(any(item["risk_level"] == "critical" for item in suggestions))

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

    def test_default_evaluation_cases_pass(self) -> None:
        result = evaluate_cases(load_evaluation_cases())

        failed_names = [item["name"] for item in result["results"] if not item["ok"]]
        self.assertEqual(failed_names, [])
        self.assertEqual(result["failed"], 0)


if __name__ == "__main__":
    unittest.main()
