"""
은자 / 시장 시스템

시장 품목은 data/market.json 에서 로드한다.
새 품목을 추가하려면 코드를 건드릴 필요 없이 JSON에 항목만 추가하면 된다.

품목 필드:
    name, desc, category, price
    markets : 등장하는 시장 번호 (1~4차 시장, 5 = 수상한 누군가)
    always  : true면 해당 시장에 반드시 진열
    effects : 효과 목록
        heal        {"stat": "hp"|"qi", "percent": N}  (음수면 그만큼 잃음, 1 미만으로 떨어지지 않음)
        stat        {"stat": 능력치, "amount": N}      (상한 99)
        equip       {"slot": "weapon"|"armor", "bonus": N}
        skill       {"skill": 무공 키}
        boss_weaken {"percent": N}                     (천마 시작 체력 감소)

시장은 해당 턴의 행동을 마치고 "다음"을 눌렀을 때 열리며 턴을 소모하지 않는다.
은자는 회차마다 새로 시작한다.
"""

import json
import os
import random

from game.chapter import MARKET_TURNS
from game.skill import Skill

STOCK_SIZE = 6
STAT_CAP = 99
STAT_NAMES = {"external": "외공", "internal": "내공", "martial": "무리", "mind": "심경"}

_DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "market.json")


def _load_item_db():
    with open(_DATA_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


ITEM_DB = _load_item_db()


def _market_number(turn):
    """턴 번호를 시장 번호(1~5)로 바꾼다."""
    return sorted(MARKET_TURNS).index(turn) + 1


def open_market(turn):
    """이번 시장의 진열 상태를 만든다. 세션에 그대로 저장된다."""
    number = _market_number(turn)
    pool = [k for k, v in ITEM_DB.items() if number in v["markets"]]
    stock = [k for k in pool if ITEM_DB[k].get("always")]
    others = [k for k in pool if k not in stock]
    random.shuffle(others)
    stock += others[:max(0, STOCK_SIZE - len(stock))]
    return {
        "name": MARKET_TURNS[turn],
        "special": number == 5,
        "stock": [{"key": k, "sold": False} for k in stock],
        "message": None,
    }


def equipment_bonus(player, slot):
    """장착 중인 장비의 수치. 없으면 0."""
    key = getattr(player, slot, None)
    if key not in ITEM_DB:
        return 0
    for effect in ITEM_DB[key]["effects"]:
        if effect["type"] == "equip":
            return effect["bonus"]
    return 0


def _effect_is_useful(player, effect):
    kind = effect["type"]
    if kind == "heal":
        if effect["percent"] < 0:
            return False
        if effect["stat"] == "hp":
            return player.hp < player.max_hp()
        return player.qi < player.max_qi()
    if kind == "stat":
        return getattr(player, effect["stat"]) < STAT_CAP
    if kind == "equip":
        return effect["bonus"] > equipment_bonus(player, effect["slot"])
    if kind == "skill":
        return all(s.key != effect["skill"] for s in player.skills)
    if kind == "boss_weaken":
        return player.boss_weaken == 0
    return False


def block_reason(player, key):
    """살 수 없는 이유. 살 수 있으면 None."""
    item = ITEM_DB[key]
    if not any(_effect_is_useful(player, e) for e in item["effects"]):
        return "효과 없음"
    if player.silver < item["price"]:
        return "은자 부족"
    return None


def _apply_effect(player, effect):
    kind = effect["type"]
    if kind == "heal":
        stat = effect["stat"]
        maximum = player.max_hp() if stat == "hp" else player.max_qi()
        current = getattr(player, stat)
        change = int(maximum * effect["percent"] / 100)
        setattr(player, stat, max(1, min(maximum, current + change)))
    elif kind == "stat":
        stat = effect["stat"]
        setattr(player, stat, min(STAT_CAP, getattr(player, stat) + effect["amount"]))
    elif kind == "skill":
        player.learn_skill(Skill(effect["skill"]))
    elif kind == "boss_weaken":
        player.boss_weaken = effect["percent"]


def buy(player, market, key):
    """구매 처리. 성공 여부와 안내 문구를 돌려준다."""
    entry = next((s for s in market["stock"] if s["key"] == key and not s["sold"]), None)
    if entry is None:
        return False, "진열대에 없는 물건이다."

    reason = block_reason(player, key)
    if reason:
        return False, f"살 수 없다. ({reason})"

    item = ITEM_DB[key]
    player.silver -= item["price"]
    entry["sold"] = True
    for effect in item["effects"]:
        if effect["type"] == "equip":
            setattr(player, effect["slot"], key)
        else:
            _apply_effect(player, effect)
    return True, f"「{item['name']}」을(를) 샀다. (은자 -{item['price']})"


def stock_view(player, market):
    """화면 표시용 진열 목록."""
    view = []
    for entry in market["stock"]:
        item = ITEM_DB[entry["key"]]
        view.append({
            "key": entry["key"],
            "name": item["name"],
            "category": item["category"],
            "desc": item["desc"],
            "price": item["price"],
            "sold": entry["sold"],
            "blocked": None if entry["sold"] else block_reason(player, entry["key"]),
        })
    return view


def item_name(key):
    return ITEM_DB[key]["name"] if key in ITEM_DB else None
