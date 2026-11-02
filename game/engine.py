import random
from game.realm import check_breakthrough
from game.battle import Battle
from game.enemy import Enemy, get_enemies_by_tier, ENEMY_DB
from game.chapter import get_chapter_info, get_month_in_year, get_year
from game.ending import judge_ending
from game.karma import add_karma, update_global_codex
from game.traits import apply_growth

class GameEngine:
    """
    턴 진행 구조:

        [턴 N 시작] → (호출하는 쪽에서 즉시 체크포인트 저장)
            → process_action() 으로 행동 결과 처리 (전투면 라운드별 진행)
            → 행동 결과가 모두 끝나면 "다음" 버튼 대기 상태
            → advance_turn() 호출 시 턴 N+1 로 넘어감
        [턴 N+1 시작] → 다시 체크포인트 저장 ...

    즉, process_action()은 더 이상 자동으로 턴을 증가시키지 않는다.
    턴 증가는 사용자가 "다음" 버튼을 눌러 advance_turn()을 호출할 때만 일어난다.
    """

    def __init__(self, player):
        self.player = player
        self.log = []
        self.ending_result = None     # (ending_key, karma_gained, text) — 게임 종료 시에만 채워짐
        self.battle_started = None    # 전투가 새로 시작됐으면 Battle 인스턴스 (사용자 입력 대기)

    def get_actions(self):
        return ["수련", "명상", "탐색", "휴식"]

    def process_action(self, action):
        """
        행동 1개를 처리. 턴 증가는 하지 않는다.
        전투가 시작되면 self.battle_started 가 채워지고, 그 전투가 끝날 때까지는
        advance_turn()을 호출하지 않는다 (app.py에서 전투 종료를 확인한 뒤 호출).
        """
        p = self.player

        if action == "수련":
            gain_ext = apply_growth(random.randint(1, 3), p.traits, "external")
            gain_mar = apply_growth(random.randint(1, 3), p.traits, "martial")
            p.external += gain_ext
            p.martial += gain_mar
            self.log.append(f"수련: 외공+{gain_ext}, 무리+{gain_mar}")

        elif action == "명상":
            gain_int = apply_growth(random.randint(1, 3), p.traits, "internal")
            gain_mind = apply_growth(random.randint(1, 3), p.traits, "mind")
            p.internal += gain_int
            p.mind += gain_mind
            self.log.append(f"명상: 내공+{gain_int}, 심경+{gain_mind}")

        elif action == "탐색":
            self._explore()

        elif action == "휴식":
            heal = random.randint(5, 15)
            qi = random.randint(5, 10)
            p.hp += heal
            p.qi += qi
            self.log.append(f"휴식: 체력+{heal}, 기력+{qi}")

    def advance_turn(self):
        """
        '다음' 버튼을 눌렀을 때 호출. 현재 턴을 마무리하고 다음 턴으로 넘어간다.
        이 함수가 끝난 시점이 곧 "새 턴이 시작되는 시점"이며,
        호출하는 쪽(app.py)에서 이 직후 체크포인트를 저장해야 한다.
        """
        p = self.player

        # 새 턴이 시작되는 시점 — 직전 턴에서 새로 마주친 적이 있으면 도감에 반영
        newly_added = p.commit_pending_encounters()
        update_global_codex(newly_added)  # 영구 도감(legend_data.json)에도 반영
        for key in newly_added:
            name = ENEMY_DB.get(key, {}).get("name", key)
            self.log.append(f"📖 강호 도감에 「{name}」이(가) 기록되었다.")

        # 능력치 상한 99 적용 (계획서 §7)
        self._cap_stats(p)

        # 경지 돌파 확인
        self._check_realm(p)

        # 턴 증가 — 여기서부터 "다음 턴"이 시작된다
        p.turn += 1

        # 챕터 전환 확인 (턴 증가 후, 새 챕터 진입 시 안내)
        self._check_chapter_transition(p)

        # HP/QI 보정
        self._normalize(p)

        # 최종 턴(60턴) 진입 시 — 일반 행동 없이 곧바로 천마와의 최종전 발생
        if p.turn >= p.max_turn and self.ending_result is None:
            self._start_final_battle()
        elif not self.log:
            # 특별한 일이 없는 턴에도 중앙 영역이 비거나 이전 턴 내용이 남지 않도록 한다
            self.log.append(f"{get_year(p.turn)}년차 {get_month_in_year(p.turn)}월. 무엇을 할까?")

    def _check_chapter_transition(self, p):
        """턴 증가 후 새 챕터로 넘어갔다면 안내 로그 추가."""
        if p.turn > p.max_turn:
            return
        chapter_start_turns = {12 + 1, 24 + 1, 36 + 1, 48 + 1}  # 13, 25, 37, 49턴
        if p.turn in chapter_start_turns:
            info = get_chapter_info(p.turn)
            self.log.append(f"📖 {info['title']} ({info['year']}년차) — {info['desc']}")

    def _explore(self):
        """탐색 시 전투/기연 중 하나가 발생. (계획서 §6 강호 탐색)"""
        event = random.choice(["전투", "기연"])

        if event == "전투":
            self._start_battle()
        else:
            gain = apply_growth(random.randint(3, 7), self.player.traits, "internal")
            silver = random.randint(5, 15)
            self.player.internal += gain
            self.player.silver += silver
            self.log.append(f"기연! 내공+{gain}, 은자+{silver}")

    def _start_battle(self):
        """
        현재 경지에 맞는 적을 골라 전투를 시작한다.
        실제 라운드 진행은 사용자가 행동을 선택할 때마다 battle.run_round()로 처리되며
        (app.py의 /battle_action 라우트), 여기서는 적과의 조우와 전투 객체 생성만 한다.
        """
        enemy_key = self._pick_enemy_for_realm()
        enemy = Enemy(enemy_key)
        self.player.record_enemy_encounter(enemy_key)
        battle = Battle(self.player, enemy)

        self.log.append(f"⚔️ {enemy.name}과(와) 마주쳤다!")
        self.log.extend(battle.log)  # 전투 시작 버프 등 발동 로그

        self.battle_started = battle

    def _pick_enemy_for_realm(self):
        """플레이어 경지에 맞는 티어의 적을 랜덤 선택. 못 찾으면 '일반' 티어로 대체."""
        tier_by_realm = {
            "일류":   "일반",
            "절정":   "일반",
            "초절정": "난적",
            "화경":   "강적",
            "현경":   "강적",
        }
        tier = tier_by_realm.get(self.player.realm, "일반")
        candidates = get_enemies_by_tier(tier) or get_enemies_by_tier("일반")
        return random.choice(candidates)

    # ---------- 최종전 / 엔딩 ----------

    def _start_final_battle(self):
        """60턴(max_turn) 도달 시 천마와의 최종전을 시작한다. (사용자 입력 대기)"""
        self.log.append("⚡ 천마가 그 앞을 막아섰다. 강호행의 마지막 결전이 시작된다.")

        enemy = Enemy("천마")
        if self.player.boss_weaken:
            enemy.max_hp = enemy.hp = int(enemy.max_hp * (100 - self.player.boss_weaken) / 100)
            self.log.append("📜 약점 기록대로 천마의 빈틈을 파고든다. 천마의 체력이 줄어든 채 싸움이 시작된다.")
        self.player.record_enemy_encounter("천마")
        battle = Battle(self.player, enemy, is_final=True)

        self.log.extend(battle.log)
        self.battle_started = battle

    def resolve_ending(self, victory):
        """최종전이 끝난 뒤 호출되어 엔딩을 판정하고 카르마를 지급한다."""
        ending_key, karma_gained, text = judge_ending(self.player, victory)
        add_karma(karma_gained)

        self.player.alive = False  # 최종전 이후엔 더 이상 진행하지 않음

        self.log.append(f"🏁 {text}")
        self.log.append(f"💠 획득한 카르마: +{karma_gained}")

        self.ending_result = (ending_key, karma_gained, text)

    # ---------- 경지 / 능력치 보정 ----------

    def _check_realm(self, p):
        new_realm = check_breakthrough(p)
        if new_realm:
            old_realm = p.realm
            p.realm = new_realm
            self.log.append(f"🌟 경지 돌파! {old_realm} → {new_realm}")

    def _cap_stats(self, p):
        p.external = min(p.external, 99)
        p.internal = min(p.internal, 99)
        p.martial  = min(p.martial, 99)
        p.mind     = min(p.mind, 99)

    def _normalize(self, p):
        p.hp = max(0, min(p.hp, p.max_hp()))
        p.qi = max(0, min(p.qi, p.max_qi()))
