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
 "main_style_luck": 100,
}
FLAT = {"poison_immune": 0.35, "seal_immune": 0.15, "no_injury": 0.2, "no_mismatch": 0.2, "start_style_skill": 0.9,
        "start_style_weapon": 0.6, "start_armor": 0.3, "start_skill": 0.5, "extra_revive": 1.5}

# 성향은 길을 정할 뿐 강해지는 값이 아니므로 값을 매기지 않는다
NO_VALUE = {"start_alignment", "alignment_gain"}
# 장마다 기량이 오르는 효과는 기량의 끝에 막혀 뒤의 장일수록 덜 남는다. 네 기량에 두 장만큼 남는다고 본다
CHAPTER_GROWTH_SPAN = 2 * 4
_market = None
def item_price(key):
    global _market
    if _market is None: _market = json.load(open(os.path.join(D, "market.json"), encoding="utf-8"))
    return _market.get(key, {}).get("price", 0)

def unvalued(effects):
    """이 표로 값을 매기지 못한 효과의 종류. 이런 항목은 traitsweep.mjs로 잰다"""
    known = set(VALUE) | set(FLAT) | NO_VALUE | {"turn_regen", "start_item", "chapter_growth"}
    return sorted({e["type"] for e in effects if e["type"] not in known})

def value(effects):
    v = 0
    for e in effects:
        t = e["type"]
        if t == "turn_regen": v += e.get("hp_pct", 0) / 14 + e.get("qi_pct", 0) / 18
        elif t == "start_item": v += e.get("amount", 1) * item_price(e["item"]) / VALUE["start_silver"]  # 시작 물건은 장터 값만큼의 은자
        elif t == "chapter_growth": v += e.get("amount", 0) * CHAPTER_GROWTH_SPAN / VALUE["start_stat"]
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
        v = value(t["effects"]); rows.append((v / (t["cost"] / 7), "자질", k, t.get("origin", ""), t["cost"], v, unvalued(t["effects"])))
    for k, u in K["upgrades"].items():
        v = value(u["effects"]) * len(u["costs"]); c = sum(u["costs"])
        # 그릇은 자질 칸을 늘리므로 이 표로 재지 않는다
        rows.append((v / (c / 7), "기틀", k, u.get("origin", ""), c, v, ["자질 칸"] if not u["effects"] else unvalued(u["effects"])))
    for r in sorted(rows):
        note = f"\t재지 못한 효과: {', '.join(r[6])}" if r[6] else ""
        print(f"{r[0]:.2f}\t{r[1]}\t{r[2]}\t{r[3]}\t값 {r[4]}\t값어치 {r[5]:.2f}{note}")
    missing = [r[2] for r in rows if r[6]]
    if missing: print(f"\n재지 못한 효과가 있는 항목 {len(missing)}개는 traitsweep.mjs로 견줍니다: {', '.join(missing)}")
