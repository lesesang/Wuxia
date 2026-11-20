# 카르마 상점의 자질과 기틀을 효과의 값어치로 견준다.
#   python3 tools/check/shop_value.py
# 무게는 모의 강호행(tools/check/traitsweep.mjs)에서 실제로 얼마나 차이 나는지를 보고 맞춘다.
# 값어치 1은 카르마 7짜리 희귀 자질 하나만큼이다(VALUE의 수만큼이면 1).
import json, os
D = os.path.join(os.path.dirname(__file__), "..", "..", "www", "data")
VALUE = {
 "damage_reduce": 8, "damage_bonus": 8, "crit": 20, "crit_power": 70, "first_strike": 260, "low_hp_power": 60,
 "secret_power": 18, "main_weapon_bonus": 60, "mastery_rate": 70, "mindset_power": 120, "heal_rate": 200,
 "silver_rate": 100, "market_discount": 35, "fortune_rate": 90, "flee_rate": 45, "start_silver": 400, "start_fame": 120,
 "event_growth": 100, "consumable_rate": 60, "hit_bonus": 15, "start_battle_tool": 16, "start_style_tool": 19,
 "start_mastery": 100, "extra_stock": 10, "start_battles": 100, "growth_rate": 50, "start_stat": 240,
 "inflict_poison": 20, "battle_exp": 2, "qi_cost_cut": 70, "start_mindset_mastery": 200, "evolve_mastery": 60,
}
FLAT = {"poison_immune": 0.35, "seal_immune": 0.15, "no_injury": 0.2, "no_mismatch": 0.2, "start_style_skill": 0.9,
        "start_style_weapon": 0.6, "start_armor": 0.3, "start_skill": 0.5, "extra_revive": 1.5, "main_style_luck": 0.0}

def value(effects):
    v = 0
    for e in effects:
        t = e["type"]
        if t == "turn_regen": v += e.get("hp_pct", 0) / 14 + e.get("qi_pct", 0) / 18
        elif t in VALUE:
            amt = e.get("percent", e.get("amount", 0))
            v += amt / VALUE[t]
        elif t in FLAT: v += FLAT[t]
    return v

if __name__ == "__main__":
    T = json.load(open(os.path.join(D, "traits.json"))); K = json.load(open(os.path.join(D, "karma.json")))
    rows = []
    for k, t in T.items():
        if t.get("hidden"): continue
        v = value(t["effects"]); rows.append((v / (t["cost"] / 7), "자질", k, t.get("origin", ""), t["cost"], v))
    for k, u in K["upgrades"].items():
        v = value(u["effects"]) * len(u["costs"]); c = sum(u["costs"])
        rows.append((v / (c / 7), "기틀", k, u.get("origin", ""), c, v))
    for r in sorted(rows): print(f"{r[0]:.2f}\t{r[1]}\t{r[2]}\t{r[3]}\t값 {r[4]}\t값어치 {r[5]:.2f}")
