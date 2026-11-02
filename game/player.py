import random

from game.alignment import MA_HEAL_PENALTY, SA_SILVER_BONUS, dominant, new_alignment
from game.origin import ORIGINS
from game.sect import ORIGIN_SECTS, sect_bonus
from game.skill import Skill
from game.traits import apply_start_stats, has_effect, start_skills, sum_effect

START_SILVER = 30
MAX_INJURY = 3
STAT_CAP = 99
STAT_NAMES = {"external": "외공", "internal": "내공", "martial": "무리", "mind": "심경"}


class Player:
    def __init__(self, origin_key="무림초출", trait_keys=None):
        data = ORIGINS[origin_key]

        self.origin     = data["name"]
        self.origin_key = origin_key
        self.realm      = "일류"

        # 기본 능력치
        self.external = data["external"]
        self.internal = data["internal"]
        self.martial  = data["martial"]
        self.mind     = data["mind"]

        # 장착 특성
        self.traits = trait_keys or []

        # 특성의 시작 능력치 보정 적용 (능력치 확정 후 hp/qi 계산 전에 적용해야 함)
        apply_start_stats(self, self.traits)

        # 전투/자원 (특성 보정이 끝난 능력치를 기준으로 계산)
        self.hp = self.max_hp()
        self.qi = self.max_qi()

        # 전투 경험
        self.battles = 0

        # 도감용 기록 — 이번 회차에서 만난 적 키 목록 (중복 없이)
        self.encountered_enemies = []

        # 이번 턴에 새로 마주친 적 키 (다음 턴 시작 시 도감으로 확정)
        self.pending_encounters = []

        # 보유 무공과 주무공(전투에서 쓸 공격무공의 키)
        self.skills = []
        self.main_skill = None
        for key in data.get("skills", []) + start_skills(self.traits):
            if not self.has_skill(key):
                self.learn_skill(Skill(key))

        # 은자, 장비(품목 키), 소비품 가방
        self.silver = START_SILVER + sum_effect(self.traits, "start_silver", "amount")
        self.weapon = None
        self.armor = None
        self.inventory = {}
        self.boss_weaken = 0  # 최종전에서 천마 시작 체력 감소율(%)

        # 성향과 이야기 진행
        self.alignment = new_alignment()
        self.flags = []
        self.seen_events = []
        self.kills = 0

        # 명성, 문파, 내상
        self.fame = sum_effect(self.traits, "start_fame", "amount")
        self.sect = ORIGIN_SECTS.get(origin_key)
        self.injury = 0

        # 진행 (1턴 = 1개월, 60턴 = 5년 / 5챕터 x 12턴)
        self.turn     = 1
        self.max_turn = 60

        # 상태
        self.alive = True

    # ---------- 파생 수치 ----------

    def is_game_over(self):
        return self.turn > self.max_turn or self.hp <= 0

    def max_hp(self):
        return 100 + self.external * 5

    def max_qi(self):
        return 100 + self.internal * 5

    def dominant_alignment(self):
        return dominant(self.alignment)

    # ---------- 자원 변화 ----------

    def gain_stat(self, stat, amount):
        """능력치를 올리고 상한 99를 적용한다. 실제로 오른 양을 돌려준다."""
        before = getattr(self, stat)
        after = max(before, min(STAT_CAP, before + amount))
        setattr(self, stat, after)
        return after - before

    def heal_percent(self, hp_pct=0, qi_pct=0):
        """체력·기력을 최대치 비율로 회복한다. 음수면 잃되 체력은 1 아래로 내려가지 않는다."""
        penalty = 1 - MA_HEAL_PENALTY / 100 if self.dominant_alignment() == "마도" else 1
        hp_change = int(self.max_hp() * hp_pct / 100 * (penalty if hp_pct > 0 else 1))
        qi_change = int(self.max_qi() * qi_pct / 100 * (penalty if qi_pct > 0 else 1))
        hp_before, qi_before = self.hp, self.qi
        self.hp = max(1, min(self.max_hp(), self.hp + hp_change))
        self.qi = max(0, min(self.max_qi(), self.qi + qi_change))
        return self.hp - hp_before, self.qi - qi_before

    def gain_silver(self, amount):
        """은자를 얻는다. 성향과 특성 보정을 적용하고 실제 획득량을 돌려준다."""
        percent = sum_effect(self.traits, "silver_rate", "percent") + sect_bonus(self, "silver")
        if self.dominant_alignment() == "사도":
            percent += SA_SILVER_BONUS
        gained = int(amount * (1 + percent / 100))
        self.silver += gained
        return gained

    def add_injury(self, amount=1):
        """내상. 3단계까지 쌓이고 단계마다 주는 피해가 7% 준다. 회복이나 약으로 낫는다."""
        if amount > 0 and has_effect(self.traits, "no_injury"):
            return
        self.injury = max(0, min(MAX_INJURY, self.injury + amount))

    def adjust_alignment(self, name, amount):
        self.alignment[name] = max(0, self.alignment.get(name, 0) + amount)

    def has_flag(self, flag):
        return flag in self.flags

    def add_flag(self, flag):
        if flag not in self.flags:
            self.flags.append(flag)

    # ---------- 무공 ----------

    def has_skill(self, key):
        return any(s.key == key for s in self.skills)

    def get_skill(self, key):
        return next((s for s in self.skills if s.key == key), None)

    def skills_of_type(self, skill_type):
        return [s for s in self.skills if s.type == skill_type]

    def learn_skill(self, skill):
        """무공 습득. 이미 익힌 무공이면 대신 숙련도를 크게 올린다. 안내 문구 목록을 돌려준다."""
        owned = self.get_skill(skill.key)
        if owned is not None:
            return [f"이미 아는 무공이다. {owned.name}의 이해가 깊어졌다."] + owned.gain_mastery(25)
        self.skills.append(skill)
        current = self.get_skill(self.main_skill) if self.main_skill else None
        if skill.type != "공격무공":
            return []
        if current is None:
            self.main_skill = skill.key
        elif skill.get_effective_multiplier() > current.get_effective_multiplier():
            # 비기까지 해방한 무공은 함부로 바꾸지 않고 플레이어에게 맡긴다
            if current.secret_unlocked:
                return [f"상태 창에서 「{skill.name}」을(를) 주무공으로 바꿀 수 있다."]
            self.main_skill = skill.key
        return []

    def best_skill(self):
        """전투에 쓸 공격무공. 주무공이 있으면 그것을, 없으면 가장 강한 것을 고른다."""
        current = self.get_skill(self.main_skill) if self.main_skill else None
        if current is not None and current.type == "공격무공":
            return current
        attacks = self.skills_of_type("공격무공")
        if not attacks:
            return None
        return max(attacks, key=lambda s: s.get_effective_multiplier())

    def best_of_type(self, skill_type):
        """가장 등급이 높은 심공 또는 경공."""
        options = self.skills_of_type(skill_type)
        if not options:
            return None
        return max(options, key=lambda s: (s.grades_gained(), sum(max(v, 0) for v in s.effect.values())))

    def add_item(self, key, count=1):
        self.inventory[key] = self.inventory.get(key, 0) + count

    def mastery_gain_amount(self):
        """한 번에 오르는 숙련도. 무리가 높을수록 빨리 는다."""
        return random.randint(2, 4) + self.martial // 25

    # ---------- 도감 ----------

    def record_enemy_encounter(self, enemy_key):
        """적과 마주친 즉시 호출. 도감에는 바로 반영하지 않고 pending에만 쌓아둔다."""
        if (enemy_key not in self.encountered_enemies and
                enemy_key not in self.pending_encounters):
            self.pending_encounters.append(enemy_key)

    def commit_pending_encounters(self):
        """
        다음 턴이 시작되는 시점에 호출.
        직전 턴에서 새로 마주친 적을 이번 회차 도감에 반영하고,
        새로 추가된 키 목록을 반환한다.
        """
        newly_added = []
        for key in self.pending_encounters:
            if key not in self.encountered_enemies:
                self.encountered_enemies.append(key)
                newly_added.append(key)
        self.pending_encounters = []
        return newly_added

    # ---------- 저장 ----------

    def to_dict(self):
        return {
            "origin": self.origin, "origin_key": self.origin_key, "realm": self.realm,
            "external": self.external, "internal": self.internal,
            "martial": self.martial, "mind": self.mind,
            "hp": self.hp, "qi": self.qi, "battles": self.battles,
            "encountered_enemies": self.encountered_enemies,
            "pending_encounters": self.pending_encounters,
            "skills": [s.to_dict() for s in self.skills], "main_skill": self.main_skill,
            "traits": self.traits, "silver": self.silver,
            "weapon": self.weapon, "armor": self.armor, "inventory": self.inventory,
            "boss_weaken": self.boss_weaken, "alignment": self.alignment,
            "flags": self.flags, "seen_events": self.seen_events, "kills": self.kills,
            "fame": self.fame, "sect": self.sect, "injury": self.injury,
            "turn": self.turn, "max_turn": self.max_turn, "alive": self.alive,
        }

    @classmethod
    def from_dict(cls, d):
        """이전 버전 저장 파일도 읽을 수 있도록 없는 값은 기본값으로 채운다."""
        p = cls.__new__(cls)
        p.origin = d["origin"]
        p.origin_key = d.get("origin_key", "무림초출")
        p.realm = d["realm"]
        p.external, p.internal = d["external"], d["internal"]
        p.martial, p.mind = d["martial"], d["mind"]
        p.hp, p.qi = d["hp"], d["qi"]
        p.battles = d.get("battles", 0)
        p.encountered_enemies = list(d.get("encountered_enemies", []))
        p.pending_encounters = list(d.get("pending_encounters", []))
        p.skills = [Skill.from_dict(s) for s in d.get("skills", [])]
        p.main_skill = d.get("main_skill")
        p.traits = list(d.get("traits", []))
        p.silver = d.get("silver", 0)
        p.weapon, p.armor = d.get("weapon"), d.get("armor")
        p.inventory = dict(d.get("inventory", {}))
        p.boss_weaken = d.get("boss_weaken", 0)
        p.alignment = {**new_alignment(), **d.get("alignment", {})}
        p.flags = list(d.get("flags", []))
        p.seen_events = list(d.get("seen_events", []))
        p.kills = d.get("kills", 0)
        p.fame = d.get("fame", 0)
        p.sect = d.get("sect", ORIGIN_SECTS.get(p.origin_key))
        p.injury = d.get("injury", 0)
        p.turn, p.max_turn = d["turn"], d["max_turn"]
        p.alive = d["alive"]
        return p
