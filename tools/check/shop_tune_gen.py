# 출신 자질과 기틀을 같은 값어치로 맞춘 표를 만든다. tools/content/shop_tune.py로 쓴다.
#   python3 tools/check/shop_tune_gen.py 뒤에 python3 tools/content/build.py
import json, sys, os
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from shop_value import value, VALUE
D = os.path.join(HERE, "..", "..", "www", "data", "")
T = json.load(open(D + "traits.json")); K = json.load(open(D + "karma.json"))

def hp(n):
    a, b = divmod(int(n), 10)
    return (f"{a}할" if a else "") + (" " if a and b else "") + (f"{b}푼" if b else "")
KOR = {1: "하나", 2: "둘", 3: "셋"}
PH = {
 "damage_reduce": "받는 피해가 {p} 줄어든다", "damage_bonus": "주는 피해가 {p} 늘어난다",
 "crit": "회심의 일격 확률이 {p} 오른다", "crit_power": "회심의 일격 피해가 {p} 늘어난다",
 "first_strike": "전투의 첫 합에서 주는 피해가 {p} 늘어난다", "secret_power": "비기의 피해가 {p} 늘어난다",
 "main_weapon_bonus": "주무공과 계열이 맞는 병기의 위력이 {p} 늘어난다", "mastery_rate": "무공 성취를 {p} 더 빠르게 얻는다",
 "mindset_power": "심법 회복이 {p} 늘어난다", "heal_rate": "요양으로 되찾는 체력과 내력이 {p} 늘어난다",
 "silver_rate": "얻는 은자가 {p} 늘어난다", "market_discount": "장터 값이 {p} 싸진다",
 "fortune_rate": "기연을 만날 확률이 {p} 오른다", "flee_rate": "달아날 확률이 {p} 오른다",
 "start_silver": "은자 {n}을 더 들고 시작한다", "start_fame": "명성 {n}으로 시작한다",
 "event_growth": "사건과 기연에서 오르는 기량이 {p} 늘어난다", "consumable_rate": "상비약 회복이 {p} 늘어난다",
 "hit_bonus": "명중이 {p} 오른다", "start_battle_tool": "주무공 계열 전투 도구를 {n}개 들고 시작한다",
 "start_style_tool": "주무공 계열 수련 도구를 {n}개 들고 시작한다", "battle_exp": "실전 경험을 싸움마다 {k} 더 얻는다",
 "poison_immune": "독에 당하지 않는다", "inflict_poison": "공격이 적을 중독시킨다",
 "start_mastery": "주무공 성취 {n}을 쌓은 채로 시작한다", "extra_stock": "장터에 물건이 {n}개 더 진열된다",
 "start_style_skill": "주무공 계열 명품 공격무공 하나를 더 익히고 시작한다",
}
JOIN = [("줄어든다", "줄어들고"), ("늘어난다", "늘어나고"), ("오른다", "오르고"), ("싸진다", "싸지고"), ("시작한다", "시작하고"),
        ("얻는다", "얻고"), ("진열된다", "진열되고"), ("회복한다", "회복하고"), ("않는다", "않고"), ("중독시킨다", "중독시키고")]
def phrase(e):
    t = e["type"]
    if t == "turn_regen":
        h, q = e.get("hp_pct", 0), e.get("qi_pct", 0)
        if h and q and h == q: return f"매달 체력과 내력을 {hp(h)}씩 더 회복한다"
        if h and q: return f"매달 체력을 {hp(h)}, 내력을 {hp(q)} 더 회복한다"
        return f"매달 {'체력' if h else '내력'}을 {hp(h or q)} 더 회복한다"
    if t == "low_hp_power": return f"체력이 {hp(e['below'])} 이하일 때 주는 피해가 {hp(e['percent'])} 늘어난다"
    p = e.get("percent"); n = e.get("amount")
    return PH[t].format(p=hp(p) if p is not None else "", n=n, k=KOR.get(n, n))
def sentence(effects):
    ps = [phrase(e) for e in effects]
    out = []
    for i, s in enumerate(ps):
        if i < len(ps) - 1:
            for a, b in JOIN:
                if s.endswith(a): s = s[: -len(a)] + b; break
        out.append(s)
    return " ".join(out) + "."
def nice(x, unit):
    if unit == "amount": return max(10, int(round(x / 10) * 10)) if x >= 10 else max(1, int(round(x)))
    if x >= 10: return int(round(x / 5) * 5)
    return max(1, int(round(x)))
CAP = {"damage_reduce": 10, "crit": 20, "damage_bonus": 10, "first_strike": 90, "flee_rate": 30, "market_discount": 20, "mindset_power": 90, "heal_rate": 100,
       "hit_bonus": 15, "battle_exp": 1, "start_battle_tool": 6, "extra_stock": 3}
SCALABLE = set(PH) | {"turn_regen", "low_hp_power"}
def scale(effects, f):
    out = []
    for e in effects:
        e = dict(e); t = e["type"]
        if t == "turn_regen":
            for k in ("hp_pct", "qi_pct"):
                if e.get(k): e[k] = min(8, nice(e[k] * f, "p"))
        elif t == "low_hp_power": e["percent"] = min(60, nice(e["percent"] * f, "p"))
        elif "percent" in e: e["percent"] = min(CAP.get(t, 999), nice(e["percent"] * f, "p"))
        elif "amount" in e and t not in ("battle_exp",): e["amount"] = min(CAP.get(t, 9999), nice(e["amount"] * f, "amount"))
        out.append(e)
    return out
def fit(effects, target):
    best = effects
    for _ in range(6):
        v = value(best)
        if v <= 0 or abs(v - target) / target < 0.08: break
        best = scale(best, target / v)
    return best
def flavor(desc):
    i = desc.find(". ")
    return desc[i + 2:] if i >= 0 else ""

TT, UT = {}, {}
for k, t in T.items():
    if not t.get("origin"): continue
    if not all(e["type"] in SCALABLE for e in t["effects"]):
        print("손으로", k, t["effects"]); continue
    eff = fit(t["effects"], 1.0)
    TT[k] = {"effects": eff, "desc": (sentence(eff) + " " + flavor(t["desc"])).strip()}
for k, u in K["upgrades"].items():
    if not u.get("origin"): continue
    if not all(e["type"] in SCALABLE for e in u["effects"]):
        print("손으로 기틀", k, u["effects"]); UT[k] = {"costs": [3, 5, 9]}; continue
    eff = fit(u["effects"], 0.32)
    UT[k] = {"costs": [3, 5, 9], "effects": eff, "desc": "단계마다 " + sentence(eff)}
with open(os.path.join(HERE, "..", "content", "shop_tune.py"), "w") as f:
    f.write("# 출신 전용 자질과 기틀을 같은 값어치로 맞춘 표(tools/check/shop_value.py의 기준). build.py가 덮어쓴다\n")
    f.write("TRAIT_TUNE = " + json.dumps(TT, ensure_ascii=False, indent=1) + "\n")
    f.write("UPGRADE_TUNE = " + json.dumps(UT, ensure_ascii=False, indent=1) + "\n")

