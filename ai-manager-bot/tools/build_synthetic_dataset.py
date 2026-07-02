from __future__ import annotations

import argparse
import json
import random
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.vietnamese_lexicon import SOUTHERN_PARTICLES, YOUTH_FILLERS  # noqa: E402


INTENT_TEMPLATES: dict[str, dict[str, object]] = {
    "owner_review_summary": {
        "role": "owner",
        "label": "owner_allowed_read",
        "templates": [
            "tom tat review xau cua quan {place}",
            "khach danh gia 1 sao nhieu hong coi giup tui",
            "review thang nay dang noi gi ve {place}",
            "khach chui gi nhieu nhat trong danh gia",
            "loc may danh gia xau gan day cho toi",
            "co phan nan nao dang can xu ly khong",
        ],
    },
    "owner_review_reply_draft": {
        "role": "owner",
        "label": "owner_allowed_draft",
        "templates": [
            "soan tra loi cho danh gia 1 sao moi nhat",
            "viet giup tui cau phan hoi khach phan nan",
            "rep review xau sao cho lich su",
            "soan cau xin loi khach vi cho lau",
            "viet ban nhap tra loi review nay",
            "giup tui phan hoi khach chui thai do nhan vien",
        ],
    },
    "owner_revenue_summary": {
        "role": "owner",
        "label": "owner_allowed_read",
        "templates": [
            "doanh thu hom nay sao roi",
            "thang nay doanh thu tang hay giam",
            "co xu huong nao dang giam manh khong",
            "bao cao doanh so quan {place} cho tui",
            "mon nao ban chay nhat tuan nay",
            "so sanh doanh thu hom nay voi hom qua",
        ],
    },
    "owner_voucher_draft": {
        "role": "owner",
        "label": "owner_allowed_draft",
        "templates": [
            "goi y voucher cho ngay mua it khach",
            "soan uu dai giam gia cho khach quay lai",
            "viet ban nhap khuyen mai cuoi tuan",
            "tao y tuong ma giam gia nhung dung dang",
            "goi y deal cho {place}",
            "nghi giup tui chuong trinh sale nhe",
        ],
    },
    "owner_blocked_location_service_crud": {
        "role": "owner",
        "label": "owner_blocked_location_service_crud",
        "templates": [
            "tao dich vu cafe sua 20k cho quan",
            "them mon tra dao vao menu",
            "xoa dia diem nay giup tui",
            "sua gia phong 2 thanh 150k",
            "tao ve tre em 50k cho khu du lich",
            "cau hinh so do van hanh ban tang 1",
        ],
    },
    "owner_blocked_operations": {
        "role": "owner",
        "label": "owner_blocked_operations",
        "templates": [
            "vao front office xac nhan don ban so 3",
            "quet ve nay giup tui",
            "check in phong 2 cho khach",
            "huy don dat phong nay di",
            "thanh toan tai quay cho bill nay",
            "doi phong khach tu phong 1 sang phong 2",
        ],
    },
    "owner_blocked_security_finance": {
        "role": "owner",
        "label": "owner_blocked_security_finance",
        "templates": [
            "doi tai khoan ngan hang giup toi",
            "doi mat khau owner nay",
            "them nhan vien moi vao quan",
            "cap quyen cho nhan vien nay",
            "sua email dang nhap cua toi",
            "lay ma otp roi lam tiep giup tui",
        ],
    },
    "admin_read_analysis": {
        "role": "admin",
        "label": "admin_read",
        "templates": [
            "owner nao doanh thu giam manh tuan nay",
            "bao cao dia diem bi review xau nhieu",
            "thong ke voucher duoc dung nhieu nhat",
            "xu huong doanh thu toan he thong sao roi",
            "loc owner co ti le huy don cao",
            "phan tich khu vuc nao dang tang truong",
        ],
    },
    "admin_write_action": {
        "role": "admin",
        "label": "admin_write",
        "templates": [
            "duyet dia diem dang cho",
            "tu choi dich vu nay va soan ly do",
            "an dia diem vi bi bao cao",
            "cap nhat trang thai owner nay",
            "mo khoa dia diem nay neu du dieu kien",
            "xoa voucher vi sai quy dinh",
        ],
    },
    "admin_critical_action": {
        "role": "admin",
        "label": "admin_critical",
        "templates": [
            "khoa user nay",
            "xoa tai khoan owner nay",
            "doi quyen admin cho user nay",
            "sua hoa hong he thong",
            "khoa tai khoan vi gian lan",
            "xoa user bi spam nhieu lan",
        ],
    },
    "small_talk": {
        "role": "owner",
        "label": "small_talk_admin_owner",
        "templates": [
            "hello bot",
            "alo nghe tui noi ne",
            "hoi chan qua noi chuyen ti di",
            "cam on nha",
            "ok vay de tui coi",
            "nay lam viec tot hong",
        ],
    },
}

PLACES = ("quan nay", "Cafe Trung Nguyen", "Nha Tro Phu My", "Bo Ke Song Hau", "dia diem nay")
TYPO_REPLACEMENTS = (
    ("khong", "hong"),
    ("khong", "ko"),
    ("duoc", "dc"),
    ("giup", "gium"),
    ("dich vu", "dv"),
    ("dia diem", "dd"),
    ("review", "rv"),
    ("doanh thu", "doang thu"),
    ("danh gia", "danh gai"),
    ("khuyen mai", "km"),
    ("tai khoan", "tk"),
    ("mat khau", "mk"),
)


def maybe_noise(text: str, rng: random.Random, level: float) -> str:
    noisy = text
    for src, dst in TYPO_REPLACEMENTS:
        if src in noisy and rng.random() < level:
            noisy = noisy.replace(src, dst)
    words = noisy.split()
    if words and rng.random() < level:
        index = rng.randrange(len(words))
        if len(words[index]) > 3:
            words[index] = words[index] + rng.choice(("g", "h", "z"))
    if rng.random() < level:
        words.insert(0, rng.choice(YOUTH_FILLERS))
    if rng.random() < level:
        words.append(rng.choice(SOUTHERN_PARTICLES))
    return " ".join(words)


def build_rows(per_intent: int, seed: int, noise: float) -> list[dict[str, str]]:
    rng = random.Random(seed)
    rows: list[dict[str, str]] = []
    for intent, config in INTENT_TEMPLATES.items():
        templates = list(config["templates"])  # type: ignore[index]
        for _ in range(per_intent):
            template = rng.choice(templates)
            text = str(template).format(place=rng.choice(PLACES))
            text = maybe_noise(text, rng, noise)
            rows.append(
                {
                    "role": str(config["role"]),
                    "text": text,
                    "label": str(config["label"]),
                    "intent": intent,
                    "source": "synthetic_owner_admin_v1",
                }
            )
    rng.shuffle(rows)
    return rows


def main() -> None:
    parser = argparse.ArgumentParser(description="Build synthetic owner/admin bot dataset.")
    parser.add_argument("--per-intent", type=int, default=2500)
    parser.add_argument("--seed", type=int, default=20260701)
    parser.add_argument("--noise", type=float, default=0.45)
    parser.add_argument(
        "--out",
        default=str(ROOT / "datasets" / "generated" / "owner_admin_synthetic_large.jsonl"),
    )
    args = parser.parse_args()

    rows = build_rows(args.per_intent, args.seed, args.noise)
    output = Path(args.out)
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", encoding="utf-8") as file:
        for row in rows:
            file.write(json.dumps(row, ensure_ascii=False) + "\n")

    stats: dict[str, dict[str, int]] = {}
    for row in rows:
        stat = stats.setdefault(row["intent"], {"samples": 0, "words": 0})
        stat["samples"] += 1
        stat["words"] += len(row["text"].split())

    print(json.dumps({"output": str(output), "total_samples": len(rows), "stats": stats}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
