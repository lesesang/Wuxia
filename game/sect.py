"""
문파 시스템

문파 데이터는 data/sects.json 에서 로드한다.
이벤트로 입문하거나(join_sect 효과) 출신 문파로 시작하며, 한 회차에 하나만 소속된다.

bonus 필드:
    damage_reduce (%), damage (%), heal_bonus (%), crit (%), evade (%), silver (%),
    poison (공격이 맞으면 적에게 걸리는 라운드당 피해의 기준값)
"""

import json
import os

_DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "sects.json")

with open(_DATA_PATH, "r", encoding="utf-8") as f:
    SECT_DB = json.load(f)

ORIGIN_SECTS = {"곤륜파": "곤륜", "남궁세가": "남궁", "하오문": "하오문"}


def sect_bonus(player, field):
    """소속 문파의 혜택 수치. 없으면 0."""
    sect = SECT_DB.get(player.sect)
    if not sect:
        return 0
    return sect.get("bonus", {}).get(field, 0)
