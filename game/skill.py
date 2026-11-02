"""
무공 시스템 (계획서 §12~16)

- 무공 데이터는 data/skills.json 에서 로드한다.
  새 무공을 추가하려면 코드를 건드릴 필요 없이 JSON에 항목만 추가하면 된다.
- 등급(grade) 진화: 기본 → 명품 → 상승 → 신공 → 천상
  (천상 제외 전부 진화 가능. §13)
- 숙련도(mastery): 0~100. 100 도달 시 진화 가능, 진화 후 30으로 초기화. (§14)
- 비기(secret_technique): 상승 등급 + 숙련도 70 이상에서 해방. (§15)
"""

import json
import os

GRADE_ORDER = ["기본", "명품", "상승", "신공", "천상"]

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
        self.type = data["type"]            # 공격무공 / 심공 / 경공 / 비기 (현재는 공격무공 위주 뼈대)
        self.category = data["category"]    # 검법 / 도법 / 장법 ...
        self.grade = data["grade"]           # 시작 등급 (보통 "기본")
        self.base_multiplier = data["base_multiplier"]

        self.mastery = 0  # 0~100

        secret = data.get("secret_technique", {})
        self.secret_name = secret.get("name")
        self.secret_unlock_grade = secret.get("unlock_grade", "상승")
        self.secret_unlock_mastery = secret.get("unlock_mastery", 70)
        self.secret_unlocked = False

    # ---------- 숙련도 / 진화 ----------

    def gain_mastery(self, amount):
        """숙련도 획득. 100 도달 시 진화 가능 여부를 반환."""
        self.mastery = min(100, self.mastery + amount)
        self._check_secret_unlock()
        return self.can_evolve()

    def can_evolve(self):
        if self.grade == "천상":
            return False
        return self.mastery >= 100

    def evolve(self):
        """등급을 한 단계 올리고 숙련도를 30으로 초기화. (§14)"""
        if not self.can_evolve():
            return False

        idx = GRADE_ORDER.index(self.grade)
        self.grade = GRADE_ORDER[idx + 1]
        self.mastery = 30
        self._check_secret_unlock()
        return True

    # ---------- 비기 ----------

    def _check_secret_unlock(self):
        if self.secret_unlocked or self.secret_name is None:
            return
        grade_ok = GRADE_ORDER.index(self.grade) >= GRADE_ORDER.index(self.secret_unlock_grade)
        mastery_ok = self.mastery >= self.secret_unlock_mastery
        if grade_ok and mastery_ok:
            self.secret_unlocked = True

    # ---------- 전투 계산용 ----------

    def get_effective_multiplier(self):
        """숙련도를 반영한 실제 위력 계수. (예: 기본계수 + 숙련도*0.005)"""
        return self.base_multiplier + (self.mastery * 0.005)

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
        skill.grade = d["grade"]
        skill.mastery = d["mastery"]
        skill.secret_unlocked = d["secret_unlocked"]
        return skill


def get_skill_names():
    """등록된 모든 무공 이름(키) 목록."""
    return list(SKILL_DB.keys())
