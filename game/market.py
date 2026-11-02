"""
은자 / 시장 시스템

시장 품목은 data/market.json 에서 로드한다.
새 품목을 추가하려면 코드를 건드릴 필요 없이 JSON에 항목만 추가하면 된다.

품목 필드:
    name, desc, category, price
    markets    : 등장하는 시장 번호 (1~4차 시장, 5 = 수상한 누군가)
    always     : true면 해당 시장에 반드시 진열
    dominant   : 해당 성향의 길을 걷는 사람에게만 진열 (정도/사도/마도)
    consumable : true면 가방에 넣어 두었다가 전투 안팎에서 사용
    stock_qty  : 진열 수량 (기본 1)
    effects    : 효과 목록
        heal        {"stat": "hp"|"qi", "percent": N}  (음수면 그만큼 잃음, 1 미만으로 떨어지지 않음)
        stat        {"stat": 능력치, "amount": N}      (상한 99)
        equip       {"slot": "weapon"|"armor", "bonus": N}
        skill       {"skill": 무공 키}
        boss_weaken {"percent": N}                     (천마 시작 체력 감소)
        cure        {"what": "poison"|"injury", "amount": N}  (해독, 내상 치료)

시장은 해당 턴의 행동을 마치고 "다음"을 눌렀을 때 열리며 턴을 소모하지 않는다.
은자는 회차마다 새로 시작한다.
"""

import json
import os
import random

from game.alignment import JUNG_DISCOUNT
from game.chapter import MARKET_TURNS
from game.skill import Skill
from game.traits import sum_effect

STOCK_SIZE = 8
STAT_CAP = 99

_DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "market.json")


def _load_item_db():
    with open(_DATA_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


ITEM_DB = _load_item_db()


def _market_number(turn):
    """턴 번호를 시장 번호(1~5)로 바꾼다."""
    return sorted(MARKET_TURNS).index(turn) + 1


def open_market(turn, player):
    """이번 시장의 진열 상태를 만든다. 세션에 그대로 저장된다."""
    number = _market_number(turn)
    top = player.dominant_alignment()
    pool = [k for k, v in ITEM_DB.items()
            if number in v["markets"] and v.get("dominant") in (None, top)]
    # 이미 익힌 무공의 비급은 진열하지 않는다
    pool = [k for k in pool if not any(
        e["type"] == "skill" and player.has_skill(e["skill"]) for e in ITEM_DB[k]["effects"])]

    stock = [k for k in pool if ITEM_DB[k].get("always")]
    stock += _gear_for_sale(pool, player)
    others = [k for k in pool if k not in stock]
    random.shuffle(others)
    stock += others[:max(0, STOCK_SIZE - len(stock))]
    return {
        "name": MARKET_TURNS[turn],
        "special": number == 5,
        "stock": [{"key": k, "left": ITEM_DB[k].get("stock_qty", 1)} for k in stock],
        "message": None,
    }


def _gear_for_sale(pool, player):
    """무기와 방어구는 지금 것보다 나은 물건을 하나씩 꼭 진열한다."""
    picks = []
    for slot in ("weapon", "armor"):
        better = [k for k in pool for e in ITEM_DB[k]["effects"]
                  if e["type"] == "equip" and e["slot"] == slot and e["bonus"] > equipment_bonus(player, slot)]
        if better:
            picks.append(random.choice(better))
    return picks


def equipment_bonus(player, slot):
    """장착 중인 장비의 수치. 없으면 0."""
    key = getattr(player, slot, None)
    if key not in ITEM_DB:
        return 0
    for effect in ITEM_DB[key]["effects"]:
        if effect["type"] == "equip":
            return effect["bonus"]
    return 0


def price_of(player, key):
    """성향과 특성 할인을 적용한 가격."""
    percent = sum_effect(player.traits, "market_discount", "percent")
    if player.dominant_alignment() == "정도":
        percent += JUNG_DISCOUNT
    return max(1, int(ITEM_DB[key]["price"] * (100 - percent) / 100))


def _effect_is_useful(player, effect):
    kind = effect["type"]
    if kind in ("heal", "cure"):
        return effect.get("percent", 1) > 0
    if kind == "stat":
        return getattr(player, effect["stat"]) < STAT_CAP
    if kind == "equip":
        return effect["bonus"] > equipment_bonus(player, effect["slot"])
    if kind == "skill":
        return not player.has_skill(effect["skill"])
    if kind == "boss_weaken":
        return player.boss_weaken == 0
    return False


def block_reason(player, key):
    """살 수 없는 이유. 살 수 있으면 None."""
    if not any(_effect_is_useful(player, e) for e in ITEM_DB[key]["effects"]):
        return "효과 없음"
    if player.silver < price_of(player, key):
        return "은자 부족"
    return None


def _apply_effect(player, key, effect):
    kind = effect["type"]
    if kind == "heal":
        if effect["stat"] == "hp":
            player.heal_percent(hp_pct=effect["percent"])
        else:
            player.heal_percent(qi_pct=effect["percent"])
    elif kind == "stat":
        player.gain_stat(effect["stat"], effect["amount"])
    elif kind == "equip":
        setattr(player, effect["slot"], key)
    elif kind == "skill":
        player.learn_skill(Skill(effect["skill"]))
    elif kind == "boss_weaken":
        player.boss_weaken += effect["percent"]


def buy(player, market, key):
    """구매 처리. 성공 여부와 안내 문구를 돌려준다."""
    entry = next((s for s in market["stock"] if s["key"] == key and s["left"] > 0), None)
    if entry is None:
        return False, "진열대에 없는 물건이다."

    reason = block_reason(player, key)
    if reason:
        return False, f"살 수 없다. ({reason})"

    item = ITEM_DB[key]
    price = price_of(player, key)
    player.silver -= price
    entry["left"] -= 1
    if item.get("consumable"):
        player.add_item(key)
        where = "가방에 넣었다."
    else:
        for effect in item["effects"]:
            _apply_effect(player, key, effect)
        where = ""
    return True, f"「{item['name']}」을(를) 샀다. (은자 -{price}) {where}".strip()


def stock_view(player, market):
    """화면 표시용 진열 목록."""
    view = []
    for entry in market["stock"]:
        item = ITEM_DB[entry["key"]]
        sold = entry["left"] <= 0
        view.append({
            "key": entry["key"],
            "name": item["name"],
            "category": item["category"],
            "desc": item["desc"],
            "price": price_of(player, entry["key"]),
            "list_price": item["price"],
            "left": entry["left"],
            "stackable": item.get("stock_qty", 1) > 1,
            "sold": sold,
            "blocked": None if sold else block_reason(player, entry["key"]),
        })
    return view


def item_name(key):
    return ITEM_DB[key]["name"] if key in ITEM_DB else None
