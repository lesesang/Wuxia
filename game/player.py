from game.origin import ORIGINS
from game.traits import apply_start_stats

START_SILVER = 30


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

        # 장착 특성 (카르마 상점에서 해금한 것 중 선택, 계획서 §25)
        self.traits = trait_keys or []

        # 특성의 시작 능력치 보정 적용 (능력치 확정 후 hp/qi 계산 전에 적용해야 함)
        apply_start_stats(self, self.traits)

        # 전투/자원 (특성 보정이 끝난 능력치를 기준으로 계산)
        self.hp = 100 + self.external * 5
        self.qi = 100 + self.internal * 5

        # 전투 기록 (전투 경험치, 계획서 §11)
        self.battles = 0

        # 도감용 기록 — 이번 회차에서 만난 적 키 목록 (중복 없이)
        self.encountered_enemies = []

        # 이번 턴에 새로 마주친 적 키 (다음 턴 시작 시 도감으로 확정)
        self.pending_encounters = []

        # 보유 무공 (Skill 인스턴스 리스트)
        self.skills = []

        # 은자와 장비 (시장에서 사용, game/market.py). 장비는 품목 키를 저장한다.
        self.silver = START_SILVER
        self.weapon = None
        self.armor = None
        self.boss_weaken = 0  # 최종전에서 천마 시작 체력 감소율(%)

        # 진행 (1턴 = 1개월, 60턴 = 5년 / 5챕터 x 12턴)
        self.turn     = 1
        self.max_turn = 60

        # 상태
        self.alive = True

    def is_game_over(self):
        return self.turn > self.max_turn or self.hp <= 0

    def max_hp(self):
        return 100 + self.external * 5

    def max_qi(self):
        return 100 + self.internal * 5

    def learn_skill(self, skill):
        """무공 습득. 이미 보유 중이면 중복 획득 처리는 추후 확장."""
        self.skills.append(skill)

    def best_skill(self):
        """전투에 사용할 무공. 현재 위력이 가장 높은 것을 고른다."""
        if not self.skills:
            return None
        return max(self.skills, key=lambda s: s.get_effective_multiplier())

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
