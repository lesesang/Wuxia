"""
적(Enemy) 시스템

적 데이터는 data/enemies.json 에서 로드한다.
새 적을 추가하려면 JSON에 항목만 추가하면 된다.

주요 필드:
    chapters / weight : 탐색에서 등장하는 챕터와 등장 비중 (이벤트 전용 적은 chapters가 빈 목록)
    armor             : 받는 피해 고정 감소
    evasion           : 회피 확률(0~1)
    silver            : 처치 시 은자 범위
    drop              : {"skill": 무공 키, "chance": 확률}
    intro / outro     : 싸움 전후의 한마디
    specials          : 주기적인 필살기. every 라운드마다 발동하고 직전 라운드에 예고된다.
                        mult(위력 배율), poison, qi_drain(%), heal_pct(%),
                        seal(점혈: 그 라운드 수만큼 무공 봉쇄), injury(내상 +1)
    phases            : 체력 비율 이하가 되면 공격력이 오르는 단계
"""

import json
import os

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
        self.tier = data["tier"]
        self.realm = data["realm"]
        self.max_hp = data["hp"]
        self.hp = data["hp"]
        self.attack = data["attack"]
        self.exp_reward = data["exp_reward"]
        self.armor = data.get("armor", 0)
        self.evasion = data.get("evasion", 0)
        self.specials = data.get("specials", [])
        self.phases = data.get("phases", [])
        self.drop = data.get("drop")
        self.intro = data.get("intro")
        self.outro = data.get("outro")
        self.growth_range = STAT_GROWTH_RANGE.get(self.tier, (1, 3))
        self.silver_range = tuple(data.get("silver", (0, 0)))
        self.phase = 0  # 지금까지 넘어간 단계 수

    def is_alive(self):
        return self.hp > 0

    def take_damage(self, amount):
        self.hp = max(0, self.hp - amount)

    def attack_multiplier(self):
        """현재 단계의 공격력 배율."""
        if self.phase == 0:
            return 1.0
        return self.phases[self.phase - 1]["attack_mult"]

    def advance_phase(self):
        """체력이 다음 단계 기준 아래로 내려갔으면 단계를 올리고 그 문구를 돌려준다."""
        if self.phase < len(self.phases):
            next_phase = self.phases[self.phase]
            if self.hp <= self.max_hp * next_phase["hp_pct"] / 100:
                self.phase += 1
                return next_phase["text"]
        return None

    def special_for_round(self, round_num):
        """이 라운드에 발동할 필살기. 없으면 None. 주기가 긴 필살기를 우선한다."""
        chosen = None
        for special in self.specials:
            if round_num % special["every"] == 0:
                if chosen is None or special["every"] > chosen["every"]:
                    chosen = special
        return chosen

    def to_dict(self):
        return {"key": self.key, "hp": self.hp, "max_hp": self.max_hp, "phase": self.phase}

    @classmethod
    def from_dict(cls, d):
        enemy = cls(d["key"])
        enemy.hp = d["hp"]
        enemy.max_hp = d.get("max_hp", enemy.max_hp)
        enemy.phase = d.get("phase", 0)
        return enemy


def get_enemy_names():
    """등록된 모든 적 이름(키) 목록."""
    return list(ENEMY_DB.keys())


def get_enemies_by_tier(tier):
    return [k for k, v in ENEMY_DB.items() if v["tier"] == tier]


def get_enemy_pool(chapter):
    """이 챕터의 탐색에서 나올 수 있는 적 키 목록."""
    return [k for k, v in ENEMY_DB.items() if chapter in v.get("chapters", [])]
