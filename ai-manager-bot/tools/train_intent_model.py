from __future__ import annotations

import argparse
import hashlib
import json
import math
import random
import sys
import time
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.text_normalizer import normalize_text  # noqa: E402


def char_ngrams(text: str, min_n: int = 2, max_n: int = 4) -> list[str]:
    compact = f" {normalize_text(text)} "
    grams: list[str] = []
    for n in range(min_n, max_n + 1):
        if len(compact) < n:
            continue
        grams.extend(compact[index : index + n] for index in range(len(compact) - n + 1))
    return grams


def vectorize(text: str, dim: int) -> np.ndarray:
    vector = np.zeros(dim, dtype=np.float32)
    grams = char_ngrams(text)
    if not grams:
        return vector
    for gram in grams:
        digest = hashlib.blake2b(gram.encode("utf-8"), digest_size=8).digest()
        index = int.from_bytes(digest, byteorder="little", signed=False) % dim
        vector[index] += 1.0
    norm = np.linalg.norm(vector)
    if norm > 0:
        vector /= norm
    return vector


def load_jsonl(path: Path) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    with path.open("r", encoding="utf-8") as file:
        for line in file:
            line = line.strip()
            if not line:
                continue
            row = json.loads(line)
            if row.get("text") and row.get("intent"):
                rows.append({"text": str(row["text"]), "intent": str(row["intent"]), "role": str(row.get("role") or "")})
    if not rows:
        raise ValueError(f"No training rows found in {path}")
    return rows


def split_rows(rows: list[dict[str, str]], seed: int, valid_ratio: float) -> tuple[list[dict[str, str]], list[dict[str, str]]]:
    shuffled = rows[:]
    random.Random(seed).shuffle(shuffled)
    valid_size = max(1, int(len(shuffled) * valid_ratio))
    return shuffled[valid_size:], shuffled[:valid_size]


def batches(rows: list[dict[str, str]], batch_size: int, dim: int, labels: dict[str, int]):
    for start in range(0, len(rows), batch_size):
        chunk = rows[start : start + batch_size]
        features = np.stack([vectorize(row["text"], dim) for row in chunk])
        targets = np.asarray([labels[row["intent"]] for row in chunk], dtype=np.int64)
        yield features, targets


def import_torch():
    try:
        import torch
        import torch.nn as nn
    except ImportError as error:
        raise SystemExit(
            "PyTorch is not installed. Install GPU build first, for example:\n"
            "python -m pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121"
        ) from error
    return torch, nn


def evaluate(model, rows: list[dict[str, str]], labels: dict[str, int], dim: int, batch_size: int, device: str) -> dict[str, object]:
    torch, _ = import_torch()
    id_to_label = {value: key for key, value in labels.items()}
    correct = 0
    total = 0
    per_intent: dict[str, dict[str, int]] = {label: {"correct": 0, "total": 0} for label in labels}
    model.eval()
    with torch.no_grad():
        for features, targets in batches(rows, batch_size, dim, labels):
            x = torch.from_numpy(features).to(device)
            y = torch.from_numpy(targets).to(device)
            logits = model(x)
            preds = torch.argmax(logits, dim=1)
            correct_mask = preds.eq(y)
            correct += int(correct_mask.sum().item())
            total += int(y.numel())
            for target, pred in zip(y.cpu().tolist(), preds.cpu().tolist()):
                label = id_to_label[target]
                per_intent[label]["total"] += 1
                if target == pred:
                    per_intent[label]["correct"] += 1
    return {
        "accuracy": correct / total if total else 0.0,
        "total": total,
        "per_intent": {
            label: {
                "accuracy": values["correct"] / values["total"] if values["total"] else 0.0,
                "total": values["total"],
            }
            for label, values in per_intent.items()
        },
    }


def train(args: argparse.Namespace) -> dict[str, object]:
    torch, nn = import_torch()

    rows = load_jsonl(Path(args.dataset))
    train_rows, valid_rows = split_rows(rows, args.seed, args.valid_ratio)
    intent_names = sorted({row["intent"] for row in rows})
    labels = {intent: index for index, intent in enumerate(intent_names)}

    if args.device == "auto":
        device = "cuda" if torch.cuda.is_available() else "cpu"
    else:
        device = args.device
    if device == "cuda" and not torch.cuda.is_available():
        raise SystemExit("CUDA was requested but torch.cuda.is_available() is false.")

    torch.manual_seed(args.seed)
    model = nn.Sequential(
        nn.Linear(args.feature_dim, args.hidden_dim),
        nn.ReLU(),
        nn.Dropout(args.dropout),
        nn.Linear(args.hidden_dim, len(labels)),
    ).to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.learning_rate, weight_decay=args.weight_decay)
    criterion = nn.CrossEntropyLoss()

    start_time = time.time()
    for epoch in range(1, args.epochs + 1):
        random.Random(args.seed + epoch).shuffle(train_rows)
        model.train()
        total_loss = 0.0
        step_count = 0
        for features, targets in batches(train_rows, args.batch_size, args.feature_dim, labels):
            x = torch.from_numpy(features).to(device)
            y = torch.from_numpy(targets).to(device)
            optimizer.zero_grad(set_to_none=True)
            loss = criterion(model(x), y)
            loss.backward()
            optimizer.step()
            total_loss += float(loss.item())
            step_count += 1
        metrics = evaluate(model, valid_rows, labels, args.feature_dim, args.batch_size, device)
        print(
            json.dumps(
                {
                    "epoch": epoch,
                    "loss": total_loss / max(step_count, 1),
                    "valid_accuracy": metrics["accuracy"],
                    "device": device,
                },
                ensure_ascii=False,
            )
        )

    output_dir = Path(args.out)
    output_dir.mkdir(parents=True, exist_ok=True)
    metrics = evaluate(model, valid_rows, labels, args.feature_dim, args.batch_size, device)
    metadata = {
        "model_type": "hash_ngram_mlp",
        "model_version": args.model_version,
        "created_at_unix": int(time.time()),
        "train_samples": len(train_rows),
        "valid_samples": len(valid_rows),
        "feature_dim": args.feature_dim,
        "hidden_dim": args.hidden_dim,
        "labels": labels,
        "device": device,
        "cuda_name": torch.cuda.get_device_name(0) if device == "cuda" else None,
        "elapsed_seconds": math.floor(time.time() - start_time),
        "metrics": metrics,
    }

    torch.save({"state_dict": model.state_dict(), "metadata": metadata}, output_dir / "model.pt")
    (output_dir / "metadata.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
    return metadata


def main() -> None:
    parser = argparse.ArgumentParser(description="Train Owner/Admin intent classifier with optional GPU.")
    parser.add_argument("--dataset", default=str(ROOT / "datasets" / "generated" / "owner_admin_synthetic_large.jsonl"))
    parser.add_argument("--out", default=str(ROOT / "models" / "owner_admin_intent_v1"))
    parser.add_argument("--model-version", default="owner_admin_intent_v1")
    parser.add_argument("--device", choices=("auto", "cpu", "cuda"), default="auto")
    parser.add_argument("--epochs", type=int, default=8)
    parser.add_argument("--batch-size", type=int, default=128)
    parser.add_argument("--feature-dim", type=int, default=4096)
    parser.add_argument("--hidden-dim", type=int, default=256)
    parser.add_argument("--dropout", type=float, default=0.15)
    parser.add_argument("--learning-rate", type=float, default=0.001)
    parser.add_argument("--weight-decay", type=float, default=0.0001)
    parser.add_argument("--valid-ratio", type=float, default=0.15)
    parser.add_argument("--seed", type=int, default=20260702)
    args = parser.parse_args()

    metadata = train(args)
    print(json.dumps({"saved": args.out, "metrics": metadata["metrics"]}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
