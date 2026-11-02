"""
적(Enemy) 시스템 (계획서 §18)

적 데이터는 data/enemies.json 에서 로드한다.
새 적을 추가하려면 JSON에 항목만 추가하면 된다.

초반 적은 비기 없음, 중후반 적은 비기 사용 — 이는 skills 목록에
숙련도 70 이상으로 시작하는 무공을 넣는지 여부로 결정한다 (추후 확장).
"""

import json
import os
from game.skill import Skill

_DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "enemies.json")


def _load_enemy_db():
    with open(_DATA_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


ENEMY_DB = _load_enemy_db()

# 적 등급별 능력치 성장 범위 (임시 수치)
# 적을 쓰러뜨리면 4개 능력치 중 랜덤 2개가 이 범위 내에서 랜덤하게 상승한다.
STAT_GROWTH_RANGE = {
    "일반": (1, 3),
    "난적": (2, 5),
    "강적": (3, 7),
    "보스": (5, 10),
}


class Enemy:
    """전투 1회용 적 인스턴스."""

    def __init__(self, key):
        if key not in ENEMY_DB:
            raise ValueError(f"알 수 없는 적: {key}")

        data = ENEMY_DB[key]
        self.key = key
        self.name = data["name"]
        self.tier = data["tier"]          # 일반 / 난적 / 강적
        self.realm = data["realm"]
        self.max_hp = data["hp"]
        self.hp = data["hp"]
        self.attack = data["attack"]
        self.exp_reward = data["exp_reward"]  # 전투 경험치 (계획서 §11)
        self.growth_range = STAT_GROWTH_RANGE.get(self.tier, (1, 3))  # 능력치 성장 범위
        self.silver_range = tuple(data.get("silver", (0, 0)))  # 처치 시 얻는 은자 범위

        # 보유 무공 (현재는 뼈대 — 전투 로직에서 사용 여부는 추후 연결)
        self.skills = [Skill(k) for k in data.get("skills", [])]

    def is_alive(self):
        return self.hp > 0

    def take_damage(self, amount):
        self.hp = max(0, self.hp - amount)

    def to_dict(self):
        return {"key": self.key, "hp": self.hp, "max_hp": self.max_hp}

    @classmethod
    def from_dict(cls, d):
        enemy = cls(d["key"])
        enemy.hp = d["hp"]
        enemy.max_hp = d.get("max_hp", enemy.max_hp)
        return enemy


def get_enemy_names():
    """등록된 모든 적 이름(키) 목록."""
    return list(ENEMY_DB.keys())


def get_enemies_by_tier(tier):
    return [k for k, v in ENEMY_DB.items() if v["tier"] == tier]
