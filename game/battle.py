"""
턴제 전투 시스템 (계획서 §18)

플레이어 행동 5종: 기본공격 / 심법 / 경공 / 비기 / 도주
적 행동: 기본공격 (보유 무공이 있으면 추후 비기 사용 확장)

현재 게임에는 "공격무공"만 데이터가 있고 심법/경공 데이터는 아직 없다.
그래서 심법/경공 버튼은 인터페이스만 만들어두고, 보유한 게 없으면
"아직 익히지 않음" 처리로 효과 없이 턴만 소모한다.
각 시스템(심법/경공 데이터)이 준비되면 실제 효과를 연결한다.

데미지 공식 (임시, 추후 조정):
    공격력 = 외공 + 무리      (계획서 §7 외공/무리 영향 반영)
    무공 사용 시 공격력 *= skill.get_effective_multiplier()
"""

import random
from game.traits import apply_growth, get_battle_buffs
from game.market import equipment_bonus


class BattleResult:
    """전투 종료 후 결과를 담는 데이터 클래스."""

    def __init__(self, victory, rounds, exp_gained, player_hp_left, enemy_name):
        self.victory = victory
        self.rounds = rounds
        self.exp_gained = exp_gained
        self.player_hp_left = player_hp_left
        self.enemy_name = enemy_name


class Battle:
    """1회 전투를 처리하는 엔진. 한 번 생성해서 run() 또는 단계별로 진행한다."""

    def __init__(self, player, enemy, is_final=False, _skip_start_buff=False):
        self.player = player
        self.enemy = enemy
        self.log = []
        self.round_num = 0
        self.is_final = is_final  # 최종전(천마) 여부 — 엔딩 판정에 사용
        self._temp_buffs = []  # (stat, amount) — 전투 종료 시 되돌릴 임시 버프 목록
        if not _skip_start_buff:
            self._apply_battle_start_buffs()

    def to_dict(self):
        """세션 저장용 직렬화. player는 별도로 저장되므로 포함하지 않는다."""
        return {
            "enemy": self.enemy.to_dict(),
            "round_num": self.round_num,
            "is_final": self.is_final,
            "temp_buffs": self._temp_buffs,
        }

    @classmethod
    def from_dict(cls, d, player):
        from game.enemy import Enemy
        enemy = Enemy.from_dict(d["enemy"])
        battle = cls(player, enemy, is_final=d["is_final"], _skip_start_buff=True)
        battle.round_num = d["round_num"]
        battle._temp_buffs = [tuple(b) for b in d["temp_buffs"]]
        return battle

    # ---------- 특성: 전투 버프 ----------

    def _apply_battle_start_buffs(self):
        """전투 시작 시 발동하는 특성 효과 적용 (예: 외공 +5, 99 한계 무시하고 임시 적용)."""
        for buff in get_battle_buffs(self.player.traits, "on_battle_start"):
            stat = buff["stat"]
            amount = buff["amount"]
            setattr(self.player, stat, getattr(self.player, stat) + amount)
            self._temp_buffs.append((stat, amount))
            self.log.append(f"({stat} 임시 +{amount} 발동)")

    def _revert_temp_buffs(self):
        """전투 종료 시 on_battle_start에서 부여한 임시 버프를 되돌린다."""
        for stat, amount in self._temp_buffs:
            setattr(self.player, stat, getattr(self.player, stat) - amount)
        self._temp_buffs = []

    def _apply_battle_end_buffs(self):
        """전투 종료 시 발동하는 특성 효과 적용 (예: 체력/내공 25% 즉시 회복)."""
        for buff in get_battle_buffs(self.player.traits, "on_battle_end"):
            stat = buff["stat"]
            percent = buff.get("percent", 0)
            if stat == "hp":
                max_hp = self.player.max_hp()
                heal = int(max_hp * percent / 100)
                self.player.hp = min(max_hp, self.player.hp + heal)
                self.log.append(f"(특성 효과: 체력 {percent}% 회복, +{heal})")
            elif stat == "qi":
                max_qi = self.player.max_qi()
                heal = int(max_qi * percent / 100)
                self.player.qi = min(max_qi, self.player.qi + heal)
                self.log.append(f"(특성 효과: 내공 {percent}% 회복, +{heal})")

    # ---------- 공격력 계산 ----------

    def _player_attack_power(self, skill=None):
        base = self.player.external + self.player.martial + equipment_bonus(self.player, "weapon")
        if skill is not None:
            base = base * skill.get_effective_multiplier()
        return max(1, int(base))

    def _enemy_attack_power(self):
        return self.enemy.attack

    # ---------- 행동: 기본 공격 ----------

    def player_basic_attack(self):
        dmg = self._player_attack_power()
        self.enemy.take_damage(dmg)
        self.log.append(f"{self.player.origin}의 공격! {self.enemy.name}에게 {dmg}의 피해.")
        return dmg

    def player_use_skill(self, skill):
        """무공을 사용한 공격. (skill: Skill 인스턴스)"""
        dmg = self._player_attack_power(skill=skill)
        self.enemy.take_damage(dmg)
        skill.gain_mastery(random.randint(1, 3))  # 전투에서 숙련도 자연 상승
        self.log.append(f"{skill.name} 사용! {self.enemy.name}에게 {dmg}의 피해.")
        return dmg

    def player_use_secret(self, skill):
        """비기 사용. 비기가 해방되지 않았으면 사용 불가."""
        if not skill.secret_unlocked:
            self.log.append(f"{skill.name}의 비기는 아직 해방되지 않았다.")
            return 0
        dmg = self._player_attack_power(skill=skill) * 2  # 임시: 비기는 2배 위력
        dmg = int(dmg)
        self.enemy.take_damage(dmg)
        self.log.append(f"비기 「{skill.secret_name}」 발동! {self.enemy.name}에게 {dmg}의 피해.")
        return dmg

    def player_use_mindset(self):
        """심법 발동. 현재 심법 데이터가 없어 효과 없음 (뼈대)."""
        self.log.append("아직 익힌 심법이 없다. (효과 없음)")
        return 0

    def player_use_movement(self):
        """경공 사용. 현재 경공 데이터가 없어 효과 없음 (뼈대)."""
        self.log.append("아직 익힌 경공이 없다. (효과 없음)")
        return 0

    def player_flee(self):
        """도주 시도. 성공률은 임시로 50% (추후 경공 연결)."""
        success = random.random() < 0.5
        if success:
            self.log.append("도주에 성공했다.")
        else:
            self.log.append("도주에 실패했다!")
        return success

    # ---------- 적 행동 ----------

    def enemy_attack(self):
        dmg = max(1, self._enemy_attack_power() - equipment_bonus(self.player, "armor"))
        self.player.hp = max(0, self.player.hp - dmg)
        self.log.append(f"{self.enemy.name}의 공격! {dmg}의 피해를 입었다.")
        return dmg

    # ---------- 전투 진행 ----------

    def is_over(self):
        return (not self.enemy.is_alive()) or self.player.hp <= 0

    def run_round(self, player_action="기본공격", skill=None):
        """
        한 라운드(플레이어 행동 1번 + 적 반격 1번) 진행.
        player_action: "기본공격" | "심법" | "경공" | "비기" | "도주"
        skill: "기본공격" / "비기"에 사용할 Skill 인스턴스 (없으면 맨손/무공 없이 처리)
        """
        self.round_num += 1

        if player_action == "도주":
            if self.player_flee():
                return self._finish(victory=False, fled=True)
            # 도주 실패 시 적의 공격은 그대로 들어감

        elif player_action == "비기" and skill is not None:
            self.player_use_secret(skill)

        elif player_action == "심법":
            self.player_use_mindset()

        elif player_action == "경공":
            self.player_use_movement()

        elif player_action == "기본공격" and skill is not None:
            # 보유 무공이 있으면 무공으로 기본 공격 (숙련도 상승 포함)
            self.player_use_skill(skill)

        else:  # 기본공격 (무공 없을 때 맨손)
            self.player_basic_attack()

        if not self.enemy.is_alive():
            return self._finish(victory=True)

        # 적 반격
        self.enemy_attack()

        if self.player.hp <= 0:
            return self._finish(victory=False)

        return None  # 전투 계속

    def _finish(self, victory, fled=False):
        # 전투 시작 시 부여된 임시 버프는 전투가 어떻게 끝나든 되돌린다.
        self._revert_temp_buffs()

        if fled:
            return BattleResult(False, self.round_num, 0, max(0, self.player.hp), self.enemy.name)

        exp = self.enemy.exp_reward if victory else 0
        if victory:
            self.player.battles += exp
            self.log.append(f"{self.enemy.name}을 쓰러뜨렸다! 전투 경험 +{exp}")
            self._apply_stat_growth()
            self._gain_silver()
        else:
            self.log.append(f"{self.enemy.name}에게 패배했다...")

        # 전투 종료 시 발동하는 특성 효과 (예: 체력/내공 회복)
        self._apply_battle_end_buffs()

        return BattleResult(victory, self.round_num, exp, max(0, self.player.hp), self.enemy.name)

    def _gain_silver(self):
        low, high = self.enemy.silver_range
        amount = random.randint(low, high)
        if amount > 0:
            self.player.silver += amount
            self.log.append(f"은자 +{amount}")

    def _apply_stat_growth(self):
        """
        승리 시 4개 능력치 중 랜덤 2개를 적 등급에 맞는 범위만큼 상승시킨다.
        (적 등급별 범위: 일반 1~3, 난적 2~5, 강적 3~7 — game/enemy.py STAT_GROWTH_RANGE)
        특성의 성장률 보정(growth_rate)도 함께 적용된다.
        """
        stat_names = {
            "external": "외공",
            "internal": "내공",
            "martial":  "무리",
            "mind":     "심경",
        }
        chosen = random.sample(list(stat_names.keys()), 2)
        low, high = self.enemy.growth_range

        gains = []
        for stat in chosen:
            base_amount = random.randint(low, high)
            amount = apply_growth(base_amount, self.player.traits, stat)
            setattr(self.player, stat, getattr(self.player, stat) + amount)
            gains.append(f"{stat_names[stat]}+{amount}")

        self.log.append(f"성장: {', '.join(gains)}")
