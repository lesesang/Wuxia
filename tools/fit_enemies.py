#!/usr/bin/env python3
"""
적 수치를 성장 곡선에 맞춰 다시 계산하는 도구.
곡선과 목표는 www/data/balance.json 에 있다. tools/probe.js 로 잰 값을 곡선에 넣고 돌린다.
    python3 tools/fit_enemies.py
"""
import json
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "www" / "data"
balance = json.loads((DATA / "balance.json").read_text(encoding="utf-8"))
enemies = json.loads((DATA / "enemies.json").read_text(encoding="utf-8"))


def curve_at(curve, turn):
    position = max(0, min(len(curve) - 1, turn / 12))
    low = int(position)
    high = min(len(curve) - 1, low + 1)
    return curve[low] + (curve[high] - curve[low]) * (position - low)


for key, enemy in enemies.items():
    if enemy["tier"] == "보스":
        continue
    target = balance["targets"][enemy["tier"]]
    level = enemy["level"]
    enemy["hp"] = max(10, round(target["rounds"] * curve_at(balance["hp_curve"], level) * enemy.get("hp_style", 1) / 5) * 5)
    enemy["attack"] = max(1, round(target["threat"] * curve_at(balance["attack_curve"], level) * enemy.get("attack_style", 1)))

(DATA / "enemies.json").write_text(json.dumps(enemies, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(len(enemies), "enemies fitted")
