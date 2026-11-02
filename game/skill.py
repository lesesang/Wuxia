"""
무공 시스템

- 무공 데이터는 data/skills.json 에서 로드한다.
  새 무공을 추가하려면 코드를 건드릴 필요 없이 JSON에 항목만 추가하면 된다.
- 종류: 공격무공 / 심공(전투의 '심법' 행동) / 경공(전투의 '경공' 행동)
- 등급 진화: 기본 → 명품 → 상승 → 신공 → 천상. 등급이 오를 때마다 위력이 오른다.
- 숙련도: 0~100. 100에 도달하면 자동으로 진화하고 숙련도는 30이 된다.
- 비기: 무공별 조건(등급 + 숙련도)을 채우면 해방된다.
"""

import json
import os

GRADE_ORDER = ["기본", "명품", "상승", "신공", "천상"]
GRADE_BONUS = 0.25       # 진화 1단계당 위력 계수 증가
MASTERY_BONUS = 0.003    # 숙련도 1당 위력 계수 증가
EFFECT_GRADE_BONUS = 0.2 # 심공·경공 진화 1단계당 효과 증가율

_DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "skills.json")


def _load_skill_db():
    with open(_DATA_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


SKILL_DB = _load_skill_db()


class Skill:
    """플레이어가 보유한 무공 1개의 인스턴스."""

    def __init__(self, key):
        if key not in SKILL_DB:
            raise ValueError(f"알 수 없는 무공: {key}")

        data = SKILL_DB[key]
        self.key = key
        self.name = data["name"]
        self.type = data["type"]
        self.category = data["category"]
        self.grade = data["grade"]
        self.start_grade = data["grade"]
        self.base_multiplier = data["base_multiplier"]
        self.qi_cost = data.get("qi_cost", 0)
        self.desc = data.get("desc", "")
        self.effect = data.get("effect", {})

        self.mastery = 0

        secret = data.get("secret_technique", {})
        self.secret_name = secret.get("name")
        self.secret_unlock_grade = secret.get("unlock_grade", "상승")
        self.secret_unlock_mastery = secret.get("unlock_mastery", 70)
        self.secret_multiplier = secret.get("multiplier", 2.0)
        self.secret_qi_cost = secret.get("qi_cost", 30)
        self.secret_unlocked = False

    # ---------- 숙련도 / 진화 ----------

    def gain_mastery(self, amount):
        """숙련도를 올리고, 진화·비기 해방이 일어나면 안내 문구 목록을 돌려준다."""
        messages = []
        self.mastery = min(100, self.mastery + amount)
        if self.can_evolve():
            self.evolve()
            messages.append(f"🌟 {self.name}이(가) {self.grade} 등급으로 진화했다!")
        if self._check_secret_unlock():
            messages.append(f"✨ 비기 「{self.secret_name}」이(가) 해방되었다!")
        return messages

    def can_evolve(self):
        return self.grade != "천상" and self.mastery >= 100

    def evolve(self):
        """등급을 한 단계 올리고 숙련도를 30으로 초기화한다."""
        if not self.can_evolve():
            return False
        self.grade = GRADE_ORDER[GRADE_ORDER.index(self.grade) + 1]
        self.mastery = 30
        return True

    def grades_gained(self):
        return GRADE_ORDER.index(self.grade) - GRADE_ORDER.index(self.start_grade)

    # ---------- 비기 ----------

    def _check_secret_unlock(self):
        """이번 호출로 새로 해방되었으면 True."""
        if self.secret_unlocked or self.secret_name is None:
            return False
        grade_ok = GRADE_ORDER.index(self.grade) >= GRADE_ORDER.index(self.secret_unlock_grade)
        if grade_ok and self.mastery >= self.secret_unlock_mastery:
            self.secret_unlocked = True
            return True
        return False

    # ---------- 전투 계산용 ----------

    def get_effective_multiplier(self):
        """등급과 숙련도를 반영한 실제 위력 계수."""
        return self.base_multiplier + self.grades_gained() * GRADE_BONUS + self.mastery * MASTERY_BONUS

    def effect_value(self, name):
        """심공·경공 효과 수치. 진화할수록 강해지며, 양수만 증가한다."""
        value = self.effect.get(name, 0)
        if value <= 0:
            return value
        scale = 1 + self.grades_gained() * EFFECT_GRADE_BONUS + self.mastery * 0.002
        return int(value * scale)

    def to_dict(self):
        return {
            "key": self.key,
            "grade": self.grade,
            "mastery": self.mastery,
            "secret_unlocked": self.secret_unlocked,
        }

    @classmethod
    def from_dict(cls, d):
        skill = cls(d["key"])
        skill.grade = d.get("grade", skill.grade)
        skill.mastery = d.get("mastery", 0)
        skill.secret_unlocked = d.get("secret_unlocked", False)
        return skill


def get_skill_names():
    """등록된 모든 무공 이름(키) 목록."""
    return list(SKILL_DB.keys())
