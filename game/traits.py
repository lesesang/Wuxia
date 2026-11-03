"""
특성(Trait) 시스템 (계획서 §25)

특성 데이터는 data/traits.json 에서 로드한다.
새 특성을 추가하려면 코드를 건드릴 필요 없이 JSON에 항목만 추가하면 된다.

효과(effect) 종류 3가지:
    1. start_stat   — 게임 시작 시 1회, 능력치 고정값 보정 (예: 외공 +10)
    2. growth_rate  — 능력치가 성장할 때마다 비율 보정, 소수점은 올림 (예: 외공 성장 +10%)
    3. battle_buff  — 전투 중/후 발동하는 특수 효과
        trigger:
            on_battle_start — 전투 시작 시 (예: 외공 +5, 99 한계 무시하고 임시 적용)
            on_battle_end   — 전투 종료 시 (예: 체력/기력 25% 즉시 회복)
    4. start_silver / market_discount / silver_rate / crit / turn_regen / start_skill
       — 은자, 시장, 치명타, 턴 회복, 시작 무공에 대한 보정

특성은 카르마(영구 재화)로 해금하며, 해금된 특성은 게임 시작 시 장착할 수 있다.
장착 슬롯은 1개로 시작해 누적 카르마에 따라 최대 3개까지 늘어난다.
"""

import json
import math
import os

_DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "traits.json")


def _load_trait_db():
    with open(_DATA_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


TRAIT_DB = _load_trait_db()


# (누적 카르마, 슬롯 수)
SLOT_THRESHOLDS = [(0, 1), (20, 2), (50, 3)]


def trait_slots(total_karma):
    """누적 카르마로 열린 특성 슬롯 수."""
    slots = 1
    for threshold, count in SLOT_THRESHOLDS:
        if total_karma >= threshold:
            slots = count
    return slots


def next_slot_threshold(total_karma):
    """다음 슬롯이 열리는 누적 카르마. 모두 열렸으면 None."""
    for threshold, _ in SLOT_THRESHOLDS:
        if total_karma < threshold:
            return threshold
    return None


def _effects_of_type(trait_keys, effect_type):
    for key in trait_keys:
        trait = TRAIT_DB.get(key)
        if not trait:
            continue
        for effect in trait["effects"]:
            if effect["type"] == effect_type:
                yield effect


def sum_effect(trait_keys, effect_type, field):
    """특정 종류 효과의 수치 합계."""
    return sum(e.get(field, 0) for e in _effects_of_type(trait_keys, effect_type))


def has_effect(trait_keys, effect_type):
    return any(True for _ in _effects_of_type(trait_keys, effect_type))


def start_skills(trait_keys):
    """특성으로 얻는 시작 무공 키 목록."""
    return [e["skill"] for e in _effects_of_type(trait_keys, "start_skill")]


def get_trait(key):
    return TRAIT_DB[key]


def get_trait_keys():
    return list(TRAIT_DB.keys())


# ---------- 효과 적용 ----------

def apply_start_stats(player, trait_keys):
    """게임 시작 시 1회 호출. 장착한 특성들의 start_stat 효과를 능력치에 더한다."""
    for key in trait_keys:
        trait = TRAIT_DB.get(key)
        if not trait:
            continue
        for effect in trait["effects"]:
            if effect["type"] == "start_stat":
                stat = effect["stat"]
                amount = effect["amount"]
                setattr(player, stat, getattr(player, stat) + amount)


def get_growth_bonus_percent(trait_keys, stat):
    """해당 능력치(stat)에 적용되는 모든 growth_rate 효과의 총 퍼센트를 반환."""
    total = 0
    for key in trait_keys:
        trait = TRAIT_DB.get(key)
        if not trait:
            continue
        for effect in trait["effects"]:
            if effect["type"] == "growth_rate" and effect["stat"] == stat:
                total += effect["percent"]
    return total


def apply_growth(base_amount, trait_keys, stat):
    """
    기본 성장량(base_amount)에 특성의 성장률 보정을 적용한 최종값을 반환.
    소수점은 올림 처리한다 (계획서 요청 사항).
    """
    bonus_percent = get_growth_bonus_percent(trait_keys, stat)
    if bonus_percent == 0:
        return base_amount
    return math.ceil(base_amount * (1 + bonus_percent / 100))


def get_battle_buffs(trait_keys, trigger):
    """trigger(on_battle_start / on_battle_end)에 해당하는 모든 battle_buff 효과 목록 반환."""
    buffs = []
    for key in trait_keys:
        trait = TRAIT_DB.get(key)
        if not trait:
            continue
        for effect in trait["effects"]:
            if effect["type"] == "battle_buff" and effect["trigger"] == trigger:
                buffs.append(effect)
    return buffs
