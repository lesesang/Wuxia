"""
이벤트 시스템

data/events_story.json  : 정해진 턴에 반드시 일어나는 줄거리 (kind: story / final)
data/events_random.json : 탐색 중 일어나는 사건. 회차당 한 번씩만 나온다.

코드를 고치지 않고 JSON 항목만 추가하면 새 이벤트가 된다.

requires (이벤트와 선택지 공통, 모두 선택 사항):
    origin, flag, not_flag, any_flag, min_silver, realm_min, skill, no_skill,
    stat_min {"mind": 40}, alignment_min {"정도": 5}

effects (결과):
    stats {"external": 2}, hp_pct, qi_pct, silver, set_silver, alignment {"정도": 1},
    flags ["이름"], skill, mastery, item, boss_weaken,
    battle (적 키), final_battle (true), ending (엔딩 키)
"""

import json
import os
import random

from game.alignment import ALIGNMENTS
from game.chapter import get_chapter
from game.market import ITEM_DB
from game.player import STAT_NAMES
from game.realm import REALM_ORDER
from game.skill import SKILL_DB, Skill

_DIR = os.path.join(os.path.dirname(__file__), "..", "data")


def _load(name):
    with open(os.path.join(_DIR, name), "r", encoding="utf-8") as f:
        return json.load(f)


STORY_EVENTS = _load("events_story.json")
RANDOM_EVENTS = _load("events_random.json")
EVENT_DB = {**STORY_EVENTS, **RANDOM_EVENTS}


def check_requires(player, requires):
    """조건을 모두 만족하면 True."""
    return unmet_reason(player, requires) is None


def unmet_reason(player, requires):
    """만족하지 못한 첫 조건의 설명. 모두 만족하면 None."""
    if not requires:
        return None
    if "origin" in requires and player.origin_key != requires["origin"]:
        return "출신이 다르다"
    if "flag" in requires and not player.has_flag(requires["flag"]):
        return "아직 인연이 닿지 않았다"
    if "not_flag" in requires and player.has_flag(requires["not_flag"]):
        return "이미 지나간 일이다"
    if "any_flag" in requires and not any(player.has_flag(f) for f in requires["any_flag"]):
        return "아직 인연이 닿지 않았다"
    if "min_silver" in requires and player.silver < requires["min_silver"]:
        return f"은자 {requires['min_silver']} 필요"
    if "realm_min" in requires:
        if REALM_ORDER.index(player.realm) < REALM_ORDER.index(requires["realm_min"]):
            return f"{requires['realm_min']} 이상 필요"
    if "skill" in requires and not player.has_skill(requires["skill"]):
        return "필요한 무공이 없다"
    if "no_skill" in requires and player.has_skill(requires["no_skill"]):
        return "이미 익혔다"
    for stat, value in requires.get("stat_min", {}).items():
        if getattr(player, stat) < value:
            return f"{STAT_NAMES[stat]} {value} 필요"
    for name, value in requires.get("alignment_min", {}).items():
        if player.alignment.get(name, 0) < value:
            return f"{name} {value} 필요 (현재 {player.alignment.get(name, 0)})"
    return None


def story_event_for_turn(player):
    """이번 턴에 반드시 일어나는 줄거리 이벤트의 키. 없으면 None."""
    for key, event in STORY_EVENTS.items():
        if event["turn"] == player.turn and key not in player.seen_events:
            if check_requires(player, event.get("requires")):
                return key
    return None


def pick_random_event(player):
    """탐색에서 일어날 이벤트의 키. 조건에 맞는 것이 없으면 None."""
    chapter = get_chapter(player.turn)
    options = [
        key for key, event in RANDOM_EVENTS.items()
        if chapter in event.get("chapters", [])
        and key not in player.seen_events
        and check_requires(player, event.get("requires"))
    ]
    if not options:
        return None
    # 인연이 이어지는 이벤트를 먼저 만날 가능성을 높인다
    weights = [3 if RANDOM_EVENTS[k].get("requires") else 1 for k in options]
    return random.choices(options, weights=weights)[0]


def event_view(player, key):
    """화면 표시용 이벤트 정보."""
    event = EVENT_DB[key]
    choices = []
    for index, choice in enumerate(event["choices"]):
        reason = unmet_reason(player, choice.get("requires"))
        # 숨겨진 길은 조건이 맞을 때만 보여 준다
        if reason and choice["label"].startswith("(") and event.get("kind") == "final":
            continue
        choices.append({"index": index, "label": choice["label"], "locked": reason})
    return {"key": key, "title": event["title"], "text": event["text"], "choices": choices}


def resolve_choice(player, key, index):
    """
    선택을 처리하고 (본문, 효과 요약, 효과 원본) 을 돌려준다.
    고를 수 없는 선택이면 None.
    """
    event = EVENT_DB[key]
    if not 0 <= index < len(event["choices"]):
        return None
    choice = event["choices"][index]
    if not check_requires(player, choice.get("requires")):
        return None

    outcomes = choice["outcomes"]
    outcome = random.choices(outcomes, weights=[o.get("weight", 1) for o in outcomes])[0]
    effects = outcome.get("effects", {})
    summary = apply_effects(player, effects)
    if key not in player.seen_events:
        player.seen_events.append(key)
    return outcome["text"], summary, effects


def apply_effects(player, effects):
    """전투·엔딩을 제외한 효과를 적용하고 요약 문구 목록을 돌려준다."""
    summary = []

    for stat, amount in effects.get("stats", {}).items():
        if amount >= 0:
            gained = player.gain_stat(stat, amount)
            summary.append(f"{STAT_NAMES[stat]}+{gained}")
        else:
            setattr(player, stat, max(1, getattr(player, stat) + amount))
            summary.append(f"{STAT_NAMES[stat]}{amount}")

    if "hp_pct" in effects or "qi_pct" in effects:
        hp_change, qi_change = player.heal_percent(effects.get("hp_pct", 0), effects.get("qi_pct", 0))
        if hp_change:
            summary.append(f"체력{hp_change:+d}")
        if qi_change:
            summary.append(f"기력{qi_change:+d}")

    if "set_silver" in effects:
        lost = player.silver - effects["set_silver"]
        player.silver = effects["set_silver"]
        if lost:
            summary.append(f"은자-{lost}")

    if "silver" in effects:
        if effects["silver"] >= 0:
            summary.append(f"은자+{player.gain_silver(effects['silver'])}")
        else:
            spent = min(player.silver, -effects["silver"])
            player.silver -= spent
            summary.append(f"은자-{spent}")

    for name, amount in effects.get("alignment", {}).items():
        player.adjust_alignment(name, amount)
        summary.append(f"{name}{amount:+d}")

    for flag in effects.get("flags", []):
        player.add_flag(flag)

    if "boss_weaken" in effects:
        player.boss_weaken += effects["boss_weaken"]

    if "mastery" in effects:
        skill = player.best_skill()
        if skill is not None:
            messages = skill.gain_mastery(effects["mastery"])
            summary.append(f"{skill.name} 숙련도+{effects['mastery']}")
            summary.extend(messages)

    if "skill" in effects:
        skill = Skill(effects["skill"])
        known = player.has_skill(skill.key)
        messages = player.learn_skill(skill)
        if not known:
            summary.append(f"📕 새 무공 「{skill.name}」")
        summary.extend(messages)

    if "item" in effects:
        player.add_item(effects["item"])
        summary.append(f"「{ITEM_DB[effects['item']]['name']}」 획득")

    return summary


def validate_events():
    """데이터 오류를 찾아 목록으로 돌려준다. (테스트용)"""
    from game.enemy import ENEMY_DB
    errors = []
    for key, event in EVENT_DB.items():
        for choice in event["choices"]:
            for outcome in choice["outcomes"]:
                effects = outcome.get("effects", {})
                if "battle" in effects and effects["battle"] not in ENEMY_DB:
                    errors.append(f"{key}: 없는 적 {effects['battle']}")
                if "skill" in effects and effects["skill"] not in SKILL_DB:
                    errors.append(f"{key}: 없는 무공 {effects['skill']}")
                if "item" in effects and effects["item"] not in ITEM_DB:
                    errors.append(f"{key}: 없는 품목 {effects['item']}")
                for stat in effects.get("stats", {}):
                    if stat not in STAT_NAMES:
                        errors.append(f"{key}: 없는 능력치 {stat}")
                for name in effects.get("alignment", {}):
                    if name not in ALIGNMENTS:
                        errors.append(f"{key}: 없는 성향 {name}")
    return errors
