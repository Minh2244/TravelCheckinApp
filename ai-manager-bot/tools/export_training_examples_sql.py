from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.text_normalizer import normalize_text  # noqa: E402


def sql_escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace("'", "''")


def main() -> None:
    parser = argparse.ArgumentParser(description="Export JSONL training examples to MySQL insert SQL.")
    parser.add_argument("--dataset", default=str(ROOT / "datasets" / "generated" / "owner_admin_synthetic_large.jsonl"))
    parser.add_argument("--out", default=str(ROOT / "database" / "seed_ai_training_examples.sql"))
    parser.add_argument("--assistant-scope", choices=("owner", "admin"), default="owner")
    args = parser.parse_args()

    dataset = Path(args.dataset)
    output = Path(args.out)
    output.parent.mkdir(parents=True, exist_ok=True)

    rows: list[str] = []
    with dataset.open("r", encoding="utf-8") as file:
        for line in file:
            if not line.strip():
                continue
            item = json.loads(line)
            role = str(item.get("role") or "owner")
            if role not in ("owner", "admin"):
                continue
            assistant_scope = role
            text = str(item["text"])
            normalized = normalize_text(text)
            intent = str(item["intent"])
            label = str(item["label"])
            risk = "read"
            if "blocked" in label:
                risk = "blocked"
            elif "critical" in label:
                risk = "critical"
            elif "write" in label:
                risk = "medium"
            rows.append(
                "('"
                + sql_escape(assistant_scope)
                + "','synthetic','"
                + sql_escape(role)
                + "','"
                + sql_escape(text)
                + "','"
                + sql_escape(normalized)
                + "','"
                + sql_escape(intent)
                + "','"
                + sql_escape(label)
                + "',NULL,'"
                + risk
                + "','approved')"
            )

    with output.open("w", encoding="utf-8") as file:
        file.write("-- Synthetic training examples generated from ai-manager-bot dataset.\n")
        file.write("-- Run after database/001_ai_manager_bot_tables.sql.\n\n")
        if rows:
            file.write(
                "INSERT INTO ai_training_examples "
                "(assistant_scope, source, role_label, input_text, normalized_text, expected_intent, expected_label, expected_action_key, expected_risk_level, quality_status)\nVALUES\n"
            )
            file.write(",\n".join(rows))
            file.write(";\n")
    print(json.dumps({"output": str(output), "rows": len(rows)}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
