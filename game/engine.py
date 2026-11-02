import random

from game.battle import Battle
from game.chapter import get_chapter, get_chapter_info, get_month_in_year, get_year
from game.ending import judge_ending
from game.enemy import ENEMY_DB, Enemy, get_enemy_pool
from game.events import pick_random_event, story_event_for_turn
from game.karma import add_karma, update_global_codex, update_known
from game.player import STAT_NAMES
from game.realm import REALM_ORDER, check_breakthrough
from game.traits import apply_growth, sum_effect

NATURAL_REGEN = 5     # 턴이 지나면 저절로 회복되는 체력·기력 비율(%)
EXPLORE_BATTLE = 0.45
EXPLORE_EVENT = 0.40  # 나머지 0.15는 기연


class GameEngine:
    """
    턴 진행 구조:

        begin_turn()    → 이번 턴에 반드시 일어날 줄거리·최종전을 확인
        process_action() → 행동 결과 처리 (턴 증가 없음)
        "다음" 버튼      → advance_turn() 으로 턴 증가

    턴 증가는 사용자가 "다음" 버튼을 눌러 advance_turn()을 호출할 때만 일어난다.
    """

    def __init__(self, player):
        self.player = player
        self.log = []
        self.ending_result = None   # (ending_key, karma_gained, text)
        self.battle_started = None  # 전투가 새로 시작됐으면 Battle 인스턴스
        self.event_started = None   # 이벤트가 새로 시작됐으면 이벤트 키

    def get_actions(self):
        return ["수련", "명상", "탐색", "휴식"]

    def begin_turn(self):
        """턴 시작 시 호출. 줄거리 이벤트나 천마봉 이벤트를 확인한다."""
        self.event_started = story_event_for_turn(self.player)

    def process_action(self, action):
        """행동 1개를 처리한다. 턴 증가는 하지 않는다."""
        p = self.player

        if action == "수련":
            ext = self._grow("external", random.randint(1, 2))
            mar = self._grow("martial", random.randint(1, 2))
            self.log.append(f"수련: 외공+{ext}, 무리+{mar}")
            skill = p.best_skill()
            if skill is not None:
                self.log.extend(skill.gain_mastery(p.mastery_gain_amount()))

        elif action == "명상":
            int_gain = self._grow("internal", random.randint(1, 2))
            mind = self._grow("mind", random.randint(1, 2))
            _, qi = p.heal_percent(qi_pct=15)
            self.log.append(f"명상: 내공+{int_gain}, 심경+{mind}, 기력+{qi}")
            skill = p.best_of_type("심공")
            if skill is not None:
                self.log.extend(skill.gain_mastery(p.mastery_gain_amount()))

        elif action == "탐색":
            self._explore()

        elif action == "휴식":
            hp, qi = p.heal_percent(hp_pct=35, qi_pct=45)
            self.log.append(f"휴식: 체력+{hp}, 기력+{qi}")

    def _grow(self, stat, amount):
        """수련·명상 성장. 심경이 높으면 가끔 1 더 오른다."""
        p = self.player
        if random.random() < p.mind / 300:
            amount += 1
        return p.gain_stat(stat, apply_growth(amount, p.traits, stat))

    def advance_turn(self):
        """'다음' 버튼을 눌렀을 때 호출. 현재 턴을 마무리하고 다음 턴으로 넘어간다."""
        p = self.player

        self._commit_codex()
        self._check_realm(p)

        p.turn += 1

        self._check_chapter_transition(p)
        self._apply_turn_regen(p)
        self._normalize(p)

        if not self.log:
            self.log.append(f"{get_year(p.turn)}년차 {get_month_in_year(p.turn)}월. 무엇을 할까?")

        self.begin_turn()

    def _commit_codex(self):
        """직전 턴의 조우와 습득을 영구 도감에 반영한다."""
        p = self.player
        newly_added = p.commit_pending_encounters()
        update_global_codex(newly_added)
        update_known(skill_keys=[s.key for s in p.skills])
        for key in newly_added:
            name = ENEMY_DB.get(key, {}).get("name", key)
            self.log.append(f"📖 강호 도감에 「{name}」이(가) 기록되었다.")

    def _apply_turn_regen(self, p):
        hp_pct = NATURAL_REGEN + sum_effect(p.traits, "turn_regen", "hp_pct")
        qi_pct = NATURAL_REGEN + sum_effect(p.traits, "turn_regen", "qi_pct")
        p.heal_percent(hp_pct, qi_pct)

    def _check_chapter_transition(self, p):
        """턴 증가 후 새 챕터로 넘어갔다면 안내 로그 추가."""
        if p.turn > p.max_turn:
            return
        if p.turn in {13, 25, 37, 49}:
            info = get_chapter_info(p.turn)
            self.log.append(f"📖 {info['title']} ({info['year']}년차) — {info['desc']}")

    # ---------- 탐색 ----------

    def _explore(self):
        """탐색 시 전투, 이벤트, 기연 중 하나가 발생한다."""
        roll = random.random()
        if roll < EXPLORE_BATTLE:
            self._start_battle()
            return
        if roll < EXPLORE_BATTLE + EXPLORE_EVENT:
            event = pick_random_event(self.player)
            if event:
                self.event_started = event
                return
        self._fortune()

    def _fortune(self):
        """기연: 능력치 하나와 은자를 얻는다."""
        p = self.player
        stat = random.choice(list(STAT_NAMES))
        gain = p.gain_stat(stat, apply_growth(random.randint(2, 4), p.traits, stat))
        silver = p.gain_silver(random.randint(8, 16) * get_chapter(p.turn))
        self.log.append(random.choice([
            "기연! 절벽 틈에서 이름 모를 고수의 수련 흔적을 찾았다.",
            "기연! 산중에서 오래 묵은 영초를 발견했다.",
            "기연! 지나가던 노인이 무심코 던진 한마디가 벼락처럼 박혔다.",
            "기연! 무너진 사당 아래에서 옛 무인의 유품을 찾았다.",
        ]))
        self.log.append(f"{STAT_NAMES[stat]}+{gain}, 은자+{silver}")

    def _start_battle(self):
        """현재 챕터와 경지에 맞는 적을 골라 전투를 시작한다."""
        self.start_battle_with(self._pick_enemy())

    def start_battle_with(self, enemy_key):
        enemy = Enemy(enemy_key)
        self.player.record_enemy_encounter(enemy_key)
        battle = Battle(self.player, enemy)
        self.log.append(f"⚔️ {enemy.name}과(와) 마주쳤다!")
        self.log.extend(battle.log)
        battle.log = []
        self.battle_started = battle

    def _pick_enemy(self):
        """챕터별 적 중에서 비중에 따라 고른다. 일류에게 강적은 나오지 않는다."""
        pool = get_enemy_pool(get_chapter(self.player.turn))
        if REALM_ORDER.index(self.player.realm) < REALM_ORDER.index("초절정"):
            pool = [k for k in pool if ENEMY_DB[k]["tier"] != "강적"] or pool
        return random.choices(pool, weights=[ENEMY_DB[k]["weight"] for k in pool])[0]

    # ---------- 최종전 / 엔딩 ----------

    def start_final_battle(self):
        """천마와의 최종전을 시작한다."""
        p = self.player
        enemy = Enemy("천마")
        weaken = p.boss_weaken
        if p.has_flag("단목휘_동맹"):
            weaken += 15
            self.log.append("🗡️ 뒤에서 익숙한 웃음소리가 들렸다. \"다리 값 받으러 왔소.\" 단목휘의 검이 천마의 옆구리를 스쳤다!")
        if weaken:
            enemy.max_hp = enemy.hp = int(enemy.max_hp * (100 - min(weaken, 60)) / 100)
            self.log.append(f"천마의 기세가 꺾인 채 싸움이 시작된다. (체력 {min(weaken, 60)}% 감소)")
        p.record_enemy_encounter("천마")
        battle = Battle(p, enemy, is_final=True)
        self.log.append("⚡ 강호행의 마지막 결전이 시작된다.")
        self.log.extend(battle.log)
        battle.log = []
        self.battle_started = battle

    def resolve_ending(self, victory, forced=None):
        """게임이 끝날 때 호출되어 엔딩을 판정하고 카르마를 지급한다."""
        self._commit_codex()
        ending_key, karma_gained, text = judge_ending(self.player, victory, forced)
        add_karma(karma_gained)
        self.player.alive = False
        self.log.append(f"🏁 {text}")
        self.log.append(f"💠 획득한 카르마: +{karma_gained}")
        self.ending_result = (ending_key, karma_gained, text)

    # ---------- 경지 / 능력치 보정 ----------

    def _check_realm(self, p):
        new_realm = check_breakthrough(p)
        if not new_realm:
            return
        old_realm = p.realm
        p.realm = new_realm
        self.log.append(f"🌟 경지 돌파! {old_realm} → {new_realm}")
        # 심경이 조건보다 충분히 높지 않으면 돌파가 거칠어 내상을 입는다
        if random.random() < max(0, 60 - p.mind) * 0.01:
            p.heal_percent(hp_pct=-25, qi_pct=-25)
            self.log.append("심경이 흔들려 기가 역류했다. 간신히 돌파했지만 내상을 입었다. (체력·기력 -25%)")
        else:
            p.heal_percent(hp_pct=50, qi_pct=50)
            self.log.append("막혀 있던 혈맥이 뚫리며 온몸에 기운이 찬다. (체력·기력 회복)")

    def _normalize(self, p):
        p.hp = max(0, min(p.hp, p.max_hp()))
        p.qi = max(0, min(p.qi, p.max_qi()))
