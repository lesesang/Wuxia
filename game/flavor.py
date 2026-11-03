"""
무협 분위기 문장, 명성 등급, 별호 생성

data/flavor.json 에서 문장을 읽는다. 문장을 늘리려면 JSON에 추가하면 된다.
"""

import json
import os
import random

from game.alignment import dominant

_DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "flavor.json")

with open(_DATA_PATH, "r", encoding="utf-8") as f:
    FLAVOR = json.load(f)


def month_line(month):
    return random.choice(FLAVOR["months"][str(month)])


def action_line(action):
    return random.choice(FLAVOR["actions"][action])


def fame_rank(fame):
    """명성 등급 이름."""
    name = FLAVOR["fame_ranks"][0][1]
    for threshold, rank in FLAVOR["fame_ranks"]:
        if fame >= threshold:
            name = rank
    return name


def fame_rank_changed(before, after):
    """명성이 다음 등급을 넘었으면 새 등급 이름, 아니면 None."""
    return fame_rank(after) if fame_rank(before) != fame_rank(after) else None


def _stable_pick(options, seed_text):
    """회차 내내 별호가 흔들리지 않도록 출신 이름으로 고정해 고른다."""
    return options[sum(ord(c) for c in seed_text) % len(options)]


def byname(player):
    """
    강호에서 불리는 별호. 명성이 8 미만이면 아직 별호가 없다.
    성향과 주무공 계열에 따라 정해지고, 명성이 오르면 뒷글자가 무거워진다.
    """
    if player.fame < 8:
        return "이름 없는 무인"
    top = dominant(player.alignment) or "중립"
    skill = player.best_skill()
    category = skill.category if skill else "맨손"
    names = FLAVOR["bynames"]
    prefix = _stable_pick(names["prefix"][top], player.origin)
    suffix_list = names["suffix"].get(category, names["suffix"]["맨손"])
    tier = 0 if player.fame < 30 else 1 if player.fame < 65 else 2
    return prefix + suffix_list[tier]
