from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .inference import predict_payload


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CASES_PATH = ROOT / "tests" / "fixtures" / "evaluation_cases.json"


def load_evaluation_cases(path: Path = DEFAULT_CASES_PATH) -> list[dict[str, Any]]:
    return json.loads(path.read_text(encoding="utf-8"))


def evaluate_cases(cases: list[dict[str, Any]]) -> dict[str, Any]:
    results = []
    passed = 0

    for case in cases:
        output = predict_payload(case["request"])
        expected = case.get("expected", {})
        ok = all(output.get(key) == value for key, value in expected.items())
        passed += 1 if ok else 0
        results.append(
            {
                "name": case.get("name"),
                "ok": ok,
                "output": output,
                "expected": expected,
            }
        )

    total = len(cases)
    return {
        "total": total,
        "passed": passed,
        "failed": total - passed,
        "accuracy": round(passed / total, 4) if total else 0,
        "results": results,
    }


def evaluate_default_cases() -> dict[str, Any]:
    return evaluate_cases(load_evaluation_cases())
