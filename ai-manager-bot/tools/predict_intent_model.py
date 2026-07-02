from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from tools.train_intent_model import import_torch, vectorize  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="Predict intent with a trained ai-manager-bot model.")
    parser.add_argument("prompt", nargs="?", help="Text to classify. You can use this instead of --text.")
    parser.add_argument("--model-dir", default=str(ROOT / "models" / "owner_admin_intent_v1"))
    parser.add_argument("--text")
    parser.add_argument("--device", choices=("auto", "cpu", "cuda"), default="auto")
    args = parser.parse_args()
    text = args.text or args.prompt
    if not text:
        parser.error("the following arguments are required: prompt or --text")

    torch, nn = import_torch()
    checkpoint = torch.load(Path(args.model_dir) / "model.pt", map_location="cpu", weights_only=False)
    metadata = checkpoint["metadata"]
    labels = metadata["labels"]
    id_to_label = {value: key for key, value in labels.items()}
    device = "cuda" if args.device == "auto" and torch.cuda.is_available() else args.device
    if device == "auto":
        device = "cpu"

    model = nn.Sequential(
        nn.Linear(metadata["feature_dim"], metadata["hidden_dim"]),
        nn.ReLU(),
        nn.Dropout(0.0),
        nn.Linear(metadata["hidden_dim"], len(labels)),
    ).to(device)
    model.load_state_dict(checkpoint["state_dict"])
    model.eval()

    x = torch.from_numpy(vectorize(text, metadata["feature_dim"])).unsqueeze(0).to(device)
    with torch.no_grad():
        probabilities = torch.softmax(model(x), dim=1).cpu().numpy()[0]
    best_index = int(probabilities.argmax())
    print(
        json.dumps(
            {
                "text": text,
                "intent": id_to_label[best_index],
                "confidence": float(probabilities[best_index]),
                "model_version": metadata["model_version"],
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
