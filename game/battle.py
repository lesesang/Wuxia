"""
턴제 전투 시스템

플레이어 행동: 기본공격 / 비기 / 심법 / 경공 / 소비품 / 도주
능력치의 역할:
    외공 + 무리 : 공격력 (내공도 일부 더해진다)
    내공        : 비기 위력
    무리        : 명중률, 숙련도 상승량
    심경        : 치명타 확률

적은 주기적으로 필살기를 쓰고 직전 라운드에 기세를 드러낸다.
경공으로 흘려내면 다음 공격이 강해지고, 심법으로 숨을 고르며 기력을 되찾을 수 있다.

상태 이상:
    중독  : 라운드마다 피해. 해독단으로 푼다.
    점혈  : 정해진 라운드 동안 무공을 펼치지 못한다. 심법으로 풀 수 있다.
    내상  : 전투가 끝나도 남고 단계마다 주는 피해가 준다. 회복이나 약으로 낫는다.
    주화입마 : 마공의 비기를 심경이 낮은 채 쓰면 내상을 입는다.
"""

import random

from game.alignment import MA_DAMAGE_BONUS
from game.market import ITEM_DB, equipment_bonus
from game.player import MAX_INJURY
from game.realm import realm_bonus
from game.sect import sect_bonus
from game.skill import Skill
from game.traits import apply_growth, get_battle_buffs, has_effect, sum_effect

BASE_HIT = 0.88
SECRET_INTERNAL_RATE = 1.0
INTERNAL_ATTACK_RATE = 0.3  # 내공이 깊을수록 평범한 초식도 무겁다
FLEE_BASE = 0.5
INJURY_PENALTY = 7
FAME_BY_TIER = {"일반": 1, "난적": 2, "강적": 4, "보스": 10}


class BattleResult:
    """전투 종료 후 결과를 담는 데이터 클래스."""

    def __init__(self, victory, rounds, exp_gained, player_hp_left, enemy_name, fled=False):
        self.victory = victory
        self.rounds = rounds
        self.exp_gained = exp_gained
        self.player_hp_left = player_hp_left
        self.enemy_name = enemy_name
        self.fled = fled


class Battle:
    """1회 전투를 처리한다. 라운드마다 세션에 저장되고 복원된다."""

    def __init__(self, player, enemy, is_final=False, _skip_start_buff=False):
        self.player = player
        self.enemy = enemy
        self.log = []
        self.round_num = 0
        self.is_final = is_final
        self._temp_buffs = []
        self.poison = None        # {"damage": N, "rounds": N}
        self.atk_buff = None      # {"percent": N, "rounds": N}
        self.counter_pct = 0      # 경공 성공 후 다음 공격 보너스
        self.sealed = 0           # 점혈로 무공을 못 쓰는 남은 라운드
        self.enemy_poison = None  # 적이 입은 독 {"damage": N, "rounds": N}
        self.stand_used = False   # 특성 「불굴」을 이미 썼는지
        if not _skip_start_buff:
            self._apply_battle_start_buffs()

    def to_dict(self):
        """세션 저장용 직렬화. player는 별도로 저장되므로 포함하지 않는다."""
        return {
            "enemy": self.enemy.to_dict(),
            "round_num": self.round_num,
            "is_final": self.is_final,
            "temp_buffs": self._temp_buffs,
            "poison": self.poison,
            "atk_buff": self.atk_buff,
            "counter_pct": self.counter_pct,
            "sealed": self.sealed,
            "enemy_poison": self.enemy_poison,
            "stand_used": self.stand_used,
        }

    @classmethod
    def from_dict(cls, d, player):
        from game.enemy import Enemy
        enemy = Enemy.from_dict(d["enemy"])
        battle = cls(player, enemy, is_final=d["is_final"], _skip_start_buff=True)
        battle.round_num = d["round_num"]
        battle._temp_buffs = [tuple(b) for b in d["temp_buffs"]]
        battle.poison = d.get("poison")
        battle.atk_buff = d.get("atk_buff")
        battle.counter_pct = d.get("counter_pct", 0)
        battle.sealed = d.get("sealed", 0)
        battle.enemy_poison = d.get("enemy_poison")
        battle.stand_used = d.get("stand_used", False)
        return battle

    # ---------- 특성 ----------

    def _apply_battle_start_buffs(self):
        """전투 시작 시 발동하는 특성 효과 (99 한계 무시, 전투가 끝나면 되돌림)."""
        for buff in get_battle_buffs(self.player.traits, "on_battle_start"):
            stat, amount = buff["stat"], buff["amount"]
            setattr(self.player, stat, getattr(self.player, stat) + amount)
            self._temp_buffs.append((stat, amount))
            self.log.append(f"(특성 효과: {stat_name(stat)} 임시 +{amount})")

    def _revert_temp_buffs(self):
        for stat, amount in self._temp_buffs:
            setattr(self.player, stat, getattr(self.player, stat) - amount)
        self._temp_buffs = []

    def _apply_battle_end_buffs(self):
        for buff in get_battle_buffs(self.player.traits, "on_battle_end"):
            stat, percent = buff["stat"], buff.get("percent", 0)
            if stat == "hp":
                healed, _ = self.player.heal_percent(hp_pct=percent)
                self.log.append(f"(특성 효과: 체력 +{healed})")
            elif stat == "qi":
                _, healed = self.player.heal_percent(qi_pct=percent)
                self.log.append(f"(특성 효과: 기력 +{healed})")

    # ---------- 피해 계산 ----------

    def _attack_scale(self):
        """경지, 성향, 심법 효과를 합친 피해 배율."""
        scale = 1 + realm_bonus(self.player.realm)
        scale *= 1 + sect_bonus(self.player, "damage") / 100
        scale *= 1 - self.player.injury * INJURY_PENALTY / 100
        if self.player.dominant_alignment() == "마도":
            scale *= 1 + MA_DAMAGE_BONUS / 100
        if self.atk_buff:
            scale *= 1 + self.atk_buff["percent"] / 100
        return scale

    def _player_attack_power(self, skill=None):
        base = (self.player.external + self.player.martial + equipment_bonus(self.player, "weapon")
                + self.player.internal * INTERNAL_ATTACK_RATE)
        if skill is not None:
            base *= skill.get_effective_multiplier()
        return max(1, int(base * self._attack_scale()))

    def _secret_power(self, skill):
        base = (self.player.external + self.player.martial
                + equipment_bonus(self.player, "weapon")
                + self.player.internal * SECRET_INTERNAL_RATE)
        return max(1, int(base * skill.get_effective_multiplier()
                          * skill.secret_multiplier * self._attack_scale()))

    def _hits(self):
        chance = BASE_HIT + self.player.martial * 0.001 - self.enemy.evasion
        return random.random() < chance

    def _crit_chance(self):
        return (self.player.mind / 400
                + (sum_effect(self.player.traits, "crit", "percent") + sect_bonus(self.player, "crit")) / 100)

    def _strike(self, power, label, skill=None):
        """피해 적용 공통 처리. 빗나감, 변동, 치명타, 방어력, 경공 반격을 반영한다."""
        if not self._hits():
            self.log.append(f"{label} — 그러나 {self.enemy.name}이(가) 몸을 틀어 피했다.")
            self.counter_pct = 0
            return 0

        damage = power * random.uniform(0.9, 1.1)
        notes = []
        if self.counter_pct:
            damage *= 1 + self.counter_pct / 100
            notes.append("빈틈을 찔렀다!")
            self.counter_pct = 0
        if random.random() < self._crit_chance():
            damage *= 1.5
            notes.append("치명타!")

        damage = max(1, int(damage) - self.enemy.armor)
        self.enemy.take_damage(damage)
        suffix = " " + " ".join(notes) if notes else ""
        self.log.append(f"{label} {self.enemy.name}에게 {damage}의 피해.{suffix}")
        self._apply_poison_on_hit(skill)
        return damage

    def _apply_poison_on_hit(self, skill):
        """독공 무공이나 사천당가의 비전으로 적을 중독시킨다."""
        power = sect_bonus(self.player, "poison")
        if skill is not None and skill.inflict:
            power += skill.inflict.get("poison", 0)
        if power:
            damage = power + self.player.internal // 5
            self.enemy_poison = {"damage": damage, "rounds": 3}

    def _skill_label(self, skill):
        """초식 이름을 넣은 공격 문장."""
        if skill.forms:
            index = random.randrange(len(skill.forms))
            return f"{skill.name} 제{index + 1}초 「{skill.forms[index]}」!"
        return f"{skill.name}!"

    # ---------- 플레이어 행동 ----------

    def player_basic_attack(self):
        return self._strike(self._player_attack_power(), "맨손으로 일격!")

    def player_use_skill(self, skill):
        """무공 공격. 기력이 모자라면 맨손으로 싸운다."""
        if self.sealed:
            self.log.append("혈도가 막혀 무공을 펼칠 수 없다.")
            return self.player_basic_attack()
        if self.player.qi < skill.qi_cost:
            self.log.append(f"기력이 모자라 {skill.name}을(를) 펼치지 못했다.")
            return self.player_basic_attack()
        self.player.qi -= skill.qi_cost
        damage = self._strike(self._player_attack_power(skill), self._skill_label(skill), skill)
        self.log.extend(skill.gain_mastery(self.player.mastery_gain_amount()))
        return damage

    def player_use_secret(self, skill):
        if not skill.secret_unlocked:
            self.log.append(f"{skill.name}의 비기는 아직 해방되지 않았다.")
            return 0
        if self.player.qi < skill.secret_qi_cost:
            self.log.append(f"기력이 모자라 비기를 펼치지 못했다. (기력 {skill.secret_qi_cost} 필요)")
            return 0
        if self.sealed:
            self.log.append("혈도가 막혀 비기를 펼칠 수 없다.")
            return 0
        self.player.qi -= skill.secret_qi_cost
        damage = self._strike(self._secret_power(skill), f"비기 「{skill.secret_name}」!", skill)
        self._check_qi_deviation(skill)
        self.log.extend(skill.gain_mastery(self.player.mastery_gain_amount()))
        return damage

    def _check_qi_deviation(self, skill):
        """주화입마: 마공의 비기는 심경이 70보다 낮을수록 위험하다."""
        if not skill.risky:
            return
        if random.random() < max(0, 70 - self.player.mind) * 0.015:
            self.player.add_injury(1)
            self.log.append(f"🩸 기가 역류한다! 주화입마의 기운에 내상을 입었다. (내상 {self.player.injury}단계)")

    def player_use_mindset(self):
        """심법: 숨을 고르며 체력과 기력을 되찾고 잠시 공격력을 올린다."""
        skill = self.player.best_of_type("심공")
        if skill is None:
            self.log.append("아직 익힌 심공이 없다.")
            return
        boost = 1 + sect_bonus(self.player, "heal_bonus") / 100
        hp_value, qi_value = skill.effect_value("heal_hp_pct"), skill.effect_value("heal_qi_pct")
        hp_change, qi_change = self.player.heal_percent(
            hp_value * boost if hp_value > 0 else hp_value, qi_value * boost)
        self.log.append(f"{skill.name}을(를) 운기했다. (체력 {hp_change:+d}, 기력 {qi_change:+d})")
        if self.sealed:
            self.sealed = 0
            self.log.append("막혔던 혈도가 풀렸다.")
        percent, rounds = skill.effect_value("atk_buff_pct"), skill.effect.get("buff_rounds", 0)
        if percent > 0 and rounds > 0:
            self.atk_buff = {"percent": percent, "rounds": rounds + 1}
            self.log.append(f"기세가 오른다. ({rounds}라운드 동안 공격력 +{percent}%)")
        self.log.extend(skill.gain_mastery(self.player.mastery_gain_amount()))

    def player_use_movement(self):
        """경공: 이번 적의 공격을 흘려낼 태세. 성공하면 다음 공격이 강해진다."""
        skill = self.player.best_of_type("경공")
        if skill is None:
            self.log.append("아직 익힌 경공이 없다.")
            return None
        if self.player.qi < skill.qi_cost:
            self.log.append("기력이 모자라 경공을 펼치지 못했다.")
            return None
        self.player.qi -= skill.qi_cost
        self.log.append(f"{skill.name}으로 몸을 띄웠다.")
        self.log.extend(skill.gain_mastery(self.player.mastery_gain_amount()))
        return skill

    def player_use_item(self, key):
        """소비품 사용. 라운드를 소모한다."""
        if self.player.inventory.get(key, 0) <= 0 or key not in ITEM_DB:
            self.log.append("가방에 없는 물건이다.")
            return
        item = ITEM_DB[key]
        if any(e["type"] == "cure" and e.get("what") == "poison" for e in item["effects"]):
            self.poison = None
        use_consumable(self.player, key)
        self.log.append(f"{item['name']}을(를) 썼다. ({item['desc']})")

    def player_flee(self):
        chance = FLEE_BASE
        skill = self.player.best_of_type("경공")
        if skill is not None:
            chance += skill.effect_value("flee_bonus") / 100
        if random.random() < chance:
            self.log.append("도주에 성공했다.")
            return True
        self.log.append("도주에 실패했다!")
        return False

    # ---------- 적 행동 ----------

    def _incoming(self, multiplier=1.0):
        base = self.enemy.attack * self.enemy.attack_multiplier() * multiplier
        base *= 1 - realm_bonus(self.player.realm) / 2
        base *= 1 - sect_bonus(self.player, "damage_reduce") / 100
        return max(1, int(base * random.uniform(0.9, 1.1)) - equipment_bonus(self.player, "armor"))

    def enemy_attack(self, evade_skill=None):
        special = self.enemy.special_for_round(self.round_num)
        multiplier = special["mult"] if special else 1.0
        name = f"「{special['name']}」" if special else "공격"

        evade_chance = evade_skill.effect_value("evade") + sect_bonus(self.player, "evade") if evade_skill else 0
        if evade_skill is not None and random.randint(1, 100) <= evade_chance:
            self.counter_pct = evade_skill.effect_value("counter_pct")
            self.log.append(f"{self.enemy.name}의 {name}을(를) 흘려냈다! (다음 공격 +{self.counter_pct}%)")
            return 0

        damage = self._incoming(multiplier)
        if evade_skill is not None:
            # 다 피하지 못해도 몸을 띄운 만큼 위력을 흘린다
            damage = max(1, damage // 2)
            self.log.append("완전히 피하지는 못했지만 위력을 절반 흘렸다.")
        self.player.hp = max(0, self.player.hp - damage)
        self.log.append(f"{self.enemy.name}의 {name}! {damage}의 피해를 입었다.")
        self._check_last_stand()

        if special:
            self._apply_special_effects(special)
        return damage

    def _apply_special_effects(self, special):
        if special.get("seal"):
            self.sealed = special["seal"] + 1
            self.log.append(f"혈도를 짚였다! ({special['seal']}라운드 동안 무공 봉쇄, 심법으로 풀 수 있다)")
        if special.get("injury") and self.player.injury < MAX_INJURY:
            self.player.add_injury(1)
            self.log.append(f"장력이 내부를 흔든다! (내상 {self.player.injury}단계)")
        if "poison" in special:
            self.poison = dict(special["poison"])
            self.log.append(f"독이 퍼진다. ({self.poison['rounds']}라운드 동안 매 라운드 {self.poison['damage']} 피해)")
        if "qi_drain" in special:
            drained = int(self.player.max_qi() * special["qi_drain"] / 100)
            self.player.qi = max(0, self.player.qi - drained)
            self.log.append(f"기력을 빼앗겼다! (기력 -{drained})")
        if "heal_pct" in special:
            healed = int(self.enemy.max_hp * special["heal_pct"] / 100)
            self.enemy.hp = min(self.enemy.max_hp, self.enemy.hp + healed)
            self.log.append(f"{self.enemy.name}의 상처가 아문다. (체력 +{healed})")

    def _check_last_stand(self):
        if self.player.hp <= 0 and not self.stand_used and has_effect(self.player.traits, "last_stand"):
            self.stand_used = True
            self.player.hp = 1
            self.log.append("🔥 쓰러지지 않았다! 불굴의 의지로 다시 일어선다.")

    def next_special_warning(self):
        """다음 라운드에 필살기가 오면 그 이름을 돌려준다. (화면 예고용)"""
        special = self.enemy.special_for_round(self.round_num + 1)
        return special["name"] if special else None

    def _tick_effects(self):
        """라운드 끝에 독과 버프의 남은 시간을 처리한다."""
        if self.poison:
            self.player.hp = max(0, self.player.hp - self.poison["damage"])
            self.log.append(f"독이 살을 태운다. ({self.poison['damage']} 피해)")
            self._check_last_stand()
            self.poison["rounds"] -= 1
            if self.poison["rounds"] <= 0:
                self.poison = None
        if self.enemy_poison:
            self.enemy.take_damage(self.enemy_poison["damage"])
            self.log.append(f"독이 {self.enemy.name}의 혈맥을 태운다. ({self.enemy_poison['damage']} 피해)")
            self.enemy_poison["rounds"] -= 1
            if self.enemy_poison["rounds"] <= 0:
                self.enemy_poison = None
        if self.sealed:
            self.sealed -= 1
        if self.atk_buff:
            self.atk_buff["rounds"] -= 1
            if self.atk_buff["rounds"] <= 0:
                self.atk_buff = None

    # ---------- 전투 진행 ----------

    def is_over(self):
        return (not self.enemy.is_alive()) or self.player.hp <= 0

    def run_round(self, player_action="기본공격", skill=None, item_key=None):
        """
        한 라운드(플레이어 행동 1번 + 적 반격 1번) 진행.
        player_action: "기본공격" | "비기" | "심법" | "경공" | "소비품" | "도주"
        skill: 공격에 쓸 Skill 인스턴스 (없으면 맨손)
        """
        self.round_num += 1
        evade_skill = None

        if player_action == "도주" and not self.is_final:
            if self.player_flee():
                return self._finish(victory=False, fled=True)
        elif player_action == "비기" and skill is not None:
            self.player_use_secret(skill)
        elif player_action == "심법":
            self.player_use_mindset()
        elif player_action == "경공":
            evade_skill = self.player_use_movement()
        elif player_action == "소비품":
            self.player_use_item(item_key)
        elif skill is not None:
            self.player_use_skill(skill)
        else:
            self.player_basic_attack()

        if not self.enemy.is_alive():
            return self._finish(victory=True)

        phase_text = self.enemy.advance_phase()
        if phase_text:
            self.log.append(f"⚠️ {phase_text}")

        self.enemy_attack(evade_skill)
        if self.player.hp > 0:
            self._tick_effects()
        if self.player.hp <= 0:
            return self._finish(victory=False)
        if not self.enemy.is_alive():
            return self._finish(victory=True)

        warning = self.next_special_warning()
        if warning:
            self.log.append(f"⚠️ {self.enemy.name}이(가) 「{warning}」의 기세를 끌어올린다!")
        return None

    def _finish(self, victory, fled=False):
        # 전투 시작 시 부여된 임시 버프는 전투가 어떻게 끝나든 되돌린다.
        self._revert_temp_buffs()

        if fled:
            return BattleResult(False, self.round_num, 0, max(0, self.player.hp), self.enemy.name, fled=True)

        exp = self.enemy.exp_reward if victory else 0
        if victory:
            self.player.battles += exp
            self.player.kills += 1
            if self.enemy.outro:
                self.log.append(self.enemy.outro)
            self.log.append(f"{self.enemy.name}을(를) 쓰러뜨렸다! 전투 경험 +{exp}")
            self._gain_fame()
            self._apply_stat_growth()
            self._gain_silver()
            self._roll_drop()
            self._apply_battle_end_buffs()
        else:
            self.log.append(f"{self.enemy.name}에게 패배했다...")

        return BattleResult(victory, self.round_num, exp, max(0, self.player.hp), self.enemy.name)

    def _gain_fame(self):
        self.player.fame += FAME_BY_TIER.get(self.enemy.tier, 0)

    def _gain_silver(self):
        low, high = self.enemy.silver_range
        amount = random.randint(low, high)
        if amount > 0:
            self.log.append(f"은자 +{self.player.gain_silver(amount)}")

    def _roll_drop(self):
        drop = self.enemy.drop
        if drop and random.random() < drop["chance"] and not self.player.has_skill(drop["skill"]):
            skill = Skill(drop["skill"])
            self.log.extend(self.player.learn_skill(skill))
            self.log.append(f"📕 품에서 비급이 떨어졌다. 새 무공 「{skill.name}」을(를) 익혔다!")

    def _apply_stat_growth(self):
        """승리 시 4개 능력치 중 랜덤 2개를 적 등급에 맞는 범위만큼 상승시킨다."""
        chosen = random.sample(["external", "internal", "martial", "mind"], 2)
        low, high = self.enemy.growth_range

        gains = []
        for stat in chosen:
            amount = apply_growth(random.randint(low, high), self.player.traits, stat)
            gained = self.player.gain_stat(stat, amount)
            gains.append(f"{stat_name(stat)}+{gained}")

        self.log.append(f"성장: {', '.join(gains)}")


def stat_name(stat):
    return {"external": "외공", "internal": "내공", "martial": "무리", "mind": "심경"}.get(stat, stat)


def use_consumable(player, key):
    """가방의 소비품 1개를 사용한다. 전투 안팎에서 공통으로 쓴다."""
    for effect in ITEM_DB[key]["effects"]:
        if effect["type"] == "heal":
            if effect["stat"] == "hp":
                player.heal_percent(hp_pct=effect["percent"])
            else:
                player.heal_percent(qi_pct=effect["percent"])
        elif effect["type"] == "cure" and effect.get("what") == "injury":
            player.add_injury(-effect.get("amount", 1))
    player.inventory[key] -= 1
    if player.inventory[key] <= 0:
        del player.inventory[key]
