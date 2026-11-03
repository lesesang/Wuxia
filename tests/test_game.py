import json
import random

import pytest

from conftest import finish_event, set_player, state
from game.battle import Battle
from game.enemy import ENEMY_DB, Enemy
from game.events import EVENT_DB, RANDOM_EVENTS, STORY_EVENTS, apply_effects, validate_events
from game.karma import load_karma, save_karma
from game.market import ITEM_DB, block_reason, buy, open_market, price_of
from game.origin import ORIGINS
from game.player import Player
from game.save_manager import load_checkpoint
from game.skill import SKILL_DB, Skill
from game.traits import TRAIT_DB, trait_slots


# ---------- 데이터 ----------

def test_event_data_is_valid():
    assert validate_events() == []


def test_event_keys_do_not_collide_between_files():
    import json
    import os
    from game import events
    seen = set()
    for name in ("events_story.json", "events_random.json", "events_sect.json", "events_jianghu.json"):
        with open(os.path.join(events._DIR, name), encoding="utf-8") as f:
            keys = set(json.load(f))
        assert not keys & seen, keys & seen
        seen |= keys


def test_every_market_item_and_trait_points_to_real_data():
    for item in ITEM_DB.values():
        for effect in item["effects"]:
            if effect["type"] == "skill":
                assert effect["skill"] in SKILL_DB
    for trait in TRAIT_DB.values():
        for effect in trait["effects"]:
            if effect["type"] == "start_skill":
                assert effect["skill"] in SKILL_DB


def test_origin_skills_exist():
    for origin in ORIGINS.values():
        for key in origin["skills"]:
            assert key in SKILL_DB


def test_every_origin_has_a_prologue_and_every_chapter_has_a_story():
    prologue = {e["requires"]["origin"] for e in STORY_EVENTS.values() if e["turn"] == 1}
    assert prologue == set(ORIGINS)
    assert {13, 25, 37, 49, 60} <= {e["turn"] for e in STORY_EVENTS.values()}


def test_every_chapter_has_enough_random_events_and_enemies():
    for chapter in range(1, 6):
        assert sum(chapter in e["chapters"] for e in RANDOM_EVENTS.values()) >= 5
        assert any(chapter in e.get("chapters", []) for e in ENEMY_DB.values())


# ---------- 설계 결정 ----------

def test_stat_cap_is_99():
    player = Player()
    player.external = 98
    assert player.gain_stat("external", 5) == 1
    assert player.external == 99


def test_every_origin_costs_five_except_default():
    for key, origin in ORIGINS.items():
        assert origin["cost"] == (0 if key == "무림초출" else 5)


def test_turn_needs_explicit_next(client):
    client.post("/action", data={"action": "수련"})
    assert state(client)["player"]["turn"] == 1
    client.post("/action", data={"action": "수련"})  # 결과 확인 중에는 행동 불가
    assert state(client)["pending_next"]
    client.post("/advance_turn")
    assert state(client)["player"]["turn"] == 2


def test_advance_without_action_is_ignored(client):
    client.post("/advance_turn")
    assert state(client)["player"]["turn"] == 1


def test_codex_records_only_on_next_turn(client):
    set_player(client, pending_encounters=["산적"])
    assert "산적" not in load_karma()["global_codex"]
    with client.session_transaction() as s:
        s["pending_next"] = True
    client.post("/advance_turn")
    assert "산적" in load_karma()["global_codex"]


def test_kill_reward_raises_two_stats_in_tier_range():
    random.seed(1)
    player = Player()
    before = (player.external, player.internal, player.martial, player.mind)
    enemy = Enemy("산적")
    enemy.hp = 1
    enemy.evasion = 0
    battle = Battle(player, enemy)
    battle._hits = lambda: True
    assert battle.run_round("기본공격", skill=None).victory
    gains = [a - b for a, b in zip((player.external, player.internal, player.martial, player.mind), before)]
    assert sum(g > 0 for g in gains) == 2 and all(0 <= g <= 3 for g in gains)


# ---------- 전투 ----------

def test_skill_evolves_and_unlocks_secret():
    skill = Skill("기초검법")
    multiplier = skill.get_effective_multiplier()
    messages = skill.gain_mastery(100)
    assert skill.grade == "명품" and skill.mastery == 30
    assert any("진화" in m for m in messages)
    assert skill.get_effective_multiplier() > multiplier
    assert any("해방" in m for m in skill.gain_mastery(20))
    assert skill.secret_unlocked


def test_skill_costs_qi_and_falls_back_to_fists():
    player = Player()
    skill = player.best_skill()
    enemy = Enemy("천마")
    battle = Battle(player, enemy)
    battle.player_use_skill(skill)
    assert player.qi == player.max_qi() - skill.qi_cost
    player.qi = 0
    battle.player_use_skill(skill)
    assert player.qi == 0
    assert any("기력이 모자라" in line for line in battle.log)


def test_mindset_and_movement_work():
    player = Player("곤륜파")
    player.qi = 10
    player.hp = 50
    battle = Battle(player, Enemy("산적"))
    battle.player_use_mindset()
    assert player.qi > 10 and player.hp > 50 and battle.atk_buff

    player = Player()
    player.learn_skill(Skill("능공허도"))
    enemy = Enemy("산적")
    battle = Battle(player, enemy)
    hp = player.hp
    skill = player.best_of_type("경공")
    random.seed(0)
    results = [battle.enemy_attack(skill) for _ in range(20)]
    assert 0 in results
    assert battle.counter_pct > 0 or player.hp < hp


def test_enemy_special_warns_before_firing():
    enemy = Enemy("낭인")
    battle = Battle(Player(), enemy)
    battle.round_num = 2
    assert battle.next_special_warning() == "발도"
    assert enemy.special_for_round(3)["name"] == "발도"


def test_boss_phase_raises_attack():
    enemy = Enemy("천마")
    enemy.hp = int(enemy.max_hp * 0.2)
    assert enemy.advance_phase() and enemy.advance_phase()
    assert enemy.attack_multiplier() > 1.2


def test_armor_never_reduces_damage_below_one():
    player = Player()
    player.armor = "천잠보의"
    battle = Battle(player, Enemy("산적"))
    battle.round_num = 1
    assert battle.enemy_attack() >= 1


def test_temp_buff_is_reverted_after_battle():
    player = Player(trait_keys=["전투광"])
    base = player.external
    enemy = Enemy("산적")
    battle = Battle(player, enemy)
    assert player.external == base + 5
    enemy.hp = 0
    battle._finish(victory=True)
    assert player.external >= base


def test_final_battle_cannot_flee(client):
    set_player(client, turn=59)
    with client.session_transaction() as s:
        s["pending_next"] = True
    client.post("/advance_turn")
    client.post("/market/leave")
    finish_event(client)
    assert state(client)["battle"]["is_final"]
    client.post("/battle_action", data={"battle_action": "도주"})
    current = state(client)
    assert current["battle"]["round_num"] == 0 and not current.get("ending")


def test_ordinary_death_ends_run_with_karma(client):
    set_player(client, hp=1)
    with client.session_transaction() as s:
        s["battle"] = Battle(Player.from_dict(s["player"]), Enemy("천마")).to_dict()
    client.post("/battle_action", data={"battle_action": "심법"})
    client.post("/battle_action", data={"battle_action": "기본공격"})
    current = state(client)
    assert current["ending"]["key"] == "사망"
    assert load_karma()["current_karma"] == 1
    assert load_karma()["runs"][0]["ending"] == "사망"
    assert load_checkpoint() is None
    client.post("/action", data={"action": "수련"})
    assert state(client)["ending"]["key"] == "사망"


def test_boss_is_recorded_in_codex_on_ending(client):
    set_player(client, hp=1, pending_encounters=["천마"])
    with client.session_transaction() as s:
        s["battle"] = Battle(Player.from_dict(s["player"]), Enemy("천마"), is_final=True).to_dict()
    for _ in range(5):
        if state(client).get("battle"):
            client.post("/battle_action", data={"battle_action": "심법"})
    assert "천마" in load_karma()["global_codex"]


# ---------- 이벤트 / 성향 ----------

def test_story_event_opens_on_turn_13(client):
    set_player(client, turn=12)
    with client.session_transaction() as s:
        s["pending_next"] = True
    client.post("/advance_turn")
    client.post("/market/leave")
    current = state(client)
    assert current["player"]["turn"] == 13 and current["event"]["key"] == "2장_세력"
    client.post("/action", data={"action": "수련"})
    assert state(client).get("event")  # 고르기 전에는 다른 행동 불가
    client.post("/event/choose", data={"choice": 0})
    current = state(client)
    assert current["player"]["alignment"]["정도"] >= 3 and "무림맹" in current["player"]["flags"]
    assert not current.get("pending_next")  # 줄거리는 이번 달 행동을 쓰지 않는다


def test_locked_choice_is_refused(client):
    set_player(client, silver=0)
    with client.session_transaction() as s:
        s["event"] = {"key": "떠돌이약장수", "forced": False}
    client.post("/event/choose", data={"choice": 0})
    assert state(client)["event"]["key"] == "떠돌이약장수"
    client.post("/event/choose", data={"choice": "엉뚱한 값"})
    assert state(client)["event"]["key"] == "떠돌이약장수"


def test_random_event_happens_once_per_run():
    from game.events import pick_random_event
    player = Player()
    player.seen_events = [k for k in RANDOM_EVENTS]
    assert pick_random_event(player) is None


def test_alignment_benefits():
    player = Player()
    base_price = price_of(player, "금창약")
    player.alignment["정도"] = 5
    assert price_of(player, "호골주") == 54 and base_price == 20
    player = Player()
    player.alignment["사도"] = 5
    assert player.gain_silver(100) == 125
    player = Player()
    player.alignment["마도"] = 5
    battle = Battle(player, Enemy("천마"))
    plain = Battle(Player(), Enemy("천마"))
    assert battle._attack_scale() > plain._attack_scale()


def test_effects_summary_and_negative_stats_stay_above_zero():
    player = Player()
    player.mind = 2
    summary = apply_effects(player, {"stats": {"mind": -5}, "silver": 10, "skill": "매화검법", "item": "금창약"})
    assert player.mind == 1 and player.has_skill("매화검법") and player.inventory["금창약"] == 1
    assert any("은자" in s for s in summary)


def test_dark_ending_choice(client):
    set_player(client, turn=59, alignment={"정도": 0, "사도": 0, "마도": 12})
    with client.session_transaction() as s:
        s["pending_next"] = True
    client.post("/advance_turn")
    client.post("/market/leave")
    assert state(client)["event"]["key"] == "결전_천마봉"
    html = client.get("/game").get_data(as_text=True)
    assert "무릎을 꿇는다" in html and "맹의 고수" not in html
    choice = next(i for i, c in enumerate(EVENT_DB["결전_천마봉"]["choices"]) if "무릎" in c["label"])
    client.post("/event/choose", data={"choice": choice})
    assert state(client)["ending"]["key"] == "귀순"
    assert "마도천하" in client.get("/game").get_data(as_text=True)


def test_ally_weakens_boss(client):
    set_player(client, turn=59, flags=["단목휘_동맹"])
    with client.session_transaction() as s:
        s["pending_next"] = True
    client.post("/advance_turn")
    client.post("/market/leave")
    client.post("/event/choose", data={"choice": 0})
    enemy = state(client)["battle"]["enemy"]
    assert enemy["max_hp"] == int(ENEMY_DB["천마"]["hp"] * 0.85)


# ---------- 시장 ----------

def test_market_opens_without_using_a_turn(client):
    set_player(client, turn=12, silver=200, hp=50)
    client.post("/action", data={"action": "수련"})
    client.post("/advance_turn")
    current = state(client)
    assert current["market"] and current["player"]["turn"] == 12
    client.post("/action", data={"action": "수련"})
    client.post("/advance_turn")
    assert state(client)["player"]["turn"] == 12
    client.post("/market/buy", data={"item": "금창약"})
    current = state(client)
    assert current["player"]["inventory"]["금창약"] == 1 and current["player"]["silver"] == 180
    client.post("/use_item", data={"item": "금창약"})
    current = state(client)
    assert current["player"]["hp"] > 50 and "금창약" not in current["player"]["inventory"]
    client.post("/market/leave")
    assert state(client)["player"]["turn"] == 13


def test_market_stock_is_unique_and_excludes_known_skills():
    player = Player()
    player.learn_skill(Skill("초상비"))
    for turn in (12, 24, 36, 48, 59):
        for _ in range(30):
            keys = [s["key"] for s in open_market(turn, player)["stock"]]
            assert len(keys) == len(set(keys)) and len(keys) >= 4
            assert "초상비비급" not in keys


def test_alignment_goods_only_for_that_path():
    player = Player()
    assert all("혈영도법비급" != s["key"] for _ in range(30) for s in open_market(24, player)["stock"])
    player.alignment["마도"] = 5
    assert any(s["key"] == "혈영도법비급" for s in open_market(24, player)["stock"])


def test_cannot_buy_when_poor_or_item_not_in_stock():
    player = Player()
    player.silver = 0
    market = {"stock": [{"key": "금창약", "left": 1}]}
    assert not buy(player, market, "금창약")[0]
    player.silver = 999
    assert not buy(player, market, "대환단")[0]
    assert buy(player, market, "금창약")[0]
    assert not buy(player, market, "금창약")[0]


def test_weaker_equipment_is_blocked():
    player = Player()
    player.silver = 999
    player.weapon = "운철보검"
    assert block_reason(player, "철검") == "효과 없음"


# ---------- 저장 ----------

def test_checkpoint_restores_turn_start(client):
    from app import app
    set_player(client, silver=77)
    with client.session_transaction() as s:
        s["pending_next"] = True
    client.post("/advance_turn")
    assert load_checkpoint()["player"]["turn"] == 2
    client.post("/action", data={"action": "수련"})
    app.session_interface.store.clear()  # 앱을 껐다 켠 상황
    fresh = app.test_client()
    assert fresh.get("/game").status_code == 200
    current = state(fresh)
    assert current["player"]["turn"] == 2 and current["player"]["silver"] == 77
    assert not current.get("pending_next")


def test_restored_turn_60_returns_to_final_event(client):
    from app import app
    set_player(client, turn=59)
    with client.session_transaction() as s:
        s["pending_next"] = True
    client.post("/advance_turn")
    client.post("/market/leave")
    client.post("/event/choose", data={"choice": 0})
    assert state(client)["battle"]["is_final"]
    app.session_interface.store.clear()
    fresh = app.test_client()
    fresh.get("/game")
    assert state(fresh)["event"]["key"] == "결전_천마봉"


def test_old_save_files_still_load():
    from app import app
    from game import save_manager
    app.session_interface.store.clear()
    old_player = {
        "origin": "무림초출", "origin_key": "무림초출", "realm": "일류",
        "external": 30, "internal": 30, "martial": 30, "mind": 30, "hp": 100, "qi": 100,
        "battles": 1, "encountered_enemies": [], "skills": [{"key": "기초검법", "grade": "기본", "mastery": 5, "secret_unlocked": False}],
        "traits": [], "turn": 5, "max_turn": 60, "alive": True,
    }
    save_manager.save_checkpoint(old_player, ["옛 기록"])
    fresh = app.test_client()
    response = fresh.get("/game")
    assert response.status_code == 200 and "은자" in response.get_data(as_text=True)
    fresh.post("/action", data={"action": "수련"})
    assert state(fresh)["pending_next"]


def test_broken_save_files_do_not_crash(tmp_path):
    import game.karma as karma_module
    import game.save_manager as save_module
    from app import app
    open(karma_module._SAVE_PATH, "w").write("{깨진 파일")
    open(save_module._SAVE_PATH, "w").write("{깨진 파일")
    app.session_interface.store.clear()
    assert app.test_client().get("/").status_code == 200


def test_old_legend_data_gets_new_fields():
    save_karma({"current_karma": 3, "total_karma": 3, "unlocked_origins": ["무림초출"], "unlocked_traits": []})
    data = load_karma()
    assert data["runs"] == [] and data["global_codex"] == [] and data["current_karma"] == 3


# ---------- 메타 ----------

def test_trait_slots_grow_with_total_karma():
    assert [trait_slots(k) for k in (0, 19, 20, 49, 50)] == [1, 1, 2, 2, 3]


def test_start_respects_locks_and_slots():
    from app import app
    app.session_interface.store.clear()
    data = load_karma()
    data["unlocked_traits"] = ["금전운", "철옹성"]
    save_karma(data)

    client = app.test_client()
    assert client.post("/start", data={"origin": "권마계승"}).status_code == 302
    assert "player" not in state(client)

    client.post("/start", data={"origin": "무림초출", "trait": ["금전운", "철옹성", "전투광"]})
    assert state(client)["player"]["traits"] == ["금전운"]


def test_shop_unlocks_and_spends_karma():
    from app import app
    app.session_interface.store.clear()
    data = load_karma()
    data["current_karma"] = 5
    save_karma(data)
    client = app.test_client()
    client.post("/shop/buy_origin", data={"origin": "곤륜파"})
    data = load_karma()
    assert "곤륜파" in data["unlocked_origins"] and data["current_karma"] == 0


def test_all_screens_render(client):
    assert client.get("/game").status_code == 200
    set_player(client, turn=59)
    with client.session_transaction() as s:
        s["pending_next"] = True
    client.post("/advance_turn")
    html = client.get("/game").get_data(as_text=True)
    assert "수상한 누군가" in html and "천마의 약점 기록" in html
    client.post("/market/leave")
    assert "천마봉" in client.get("/game").get_data(as_text=True)
    client.post("/event/choose", data={"choice": 0})
    html = client.get("/game").get_data(as_text=True)
    assert "천마와의 결전" in html and "도주" not in html.split("battle-actions")[-1].split("status-modal")[0]


@pytest.mark.parametrize("origin", list(ORIGINS))
def test_full_run_never_errors(origin):
    from app import app
    from tools_bot import play_one
    app.session_interface.store.clear()
    data = load_karma()
    data["unlocked_origins"] = list(ORIGINS)
    save_karma(data)
    random.seed(hash(origin) % 1000)
    for _ in range(3):
        ending = play_one(app, origin)
        assert ending in ("사망", "배드", "기본", "생사경", "귀순")


# ---------- 문파 / 무협 요소 ----------

def test_sect_data_and_origin_sects():
    from game.sect import SECT_DB, sect_bonus
    assert Player("곤륜파").sect == "곤륜" and Player("무림초출").sect is None
    player = Player()
    player.sect = "소림"
    assert sect_bonus(player, "damage_reduce") == 6
    for key in SECT_DB:
        joins = [e for e in EVENT_DB.values() for c in e["choices"] for o in c["outcomes"]
                 if o.get("effects", {}).get("join_sect") == key]
        assert joins or key in ("곤륜", "남궁", "하오문")


def test_join_event_requires_no_sect(client):
    from game.events import check_requires
    player = Player()
    assert check_requires(player, RANDOM_EVENTS["소림_입문"]["requires"])
    apply_effects(player, {"join_sect": "소림", "skill": "나한권"})
    assert player.sect == "소림" and player.has_skill("나한권")
    assert not check_requires(player, RANDOM_EVENTS["무당_입문"]["requires"])
    assert check_requires(player, RANDOM_EVENTS["소림_동인진"]["requires"])
    assert not check_requires(player, RANDOM_EVENTS["소림_비전"]["requires"])


def test_tournament_runs_three_fights_then_rewards(client):
    set_player(client, turn=29, external=90, martial=90, internal=90, mind=90, hp=550, qi=550)
    with client.session_transaction() as s:
        s["pending_next"] = True
    client.post("/advance_turn")
    current = state(client)
    assert current["event"]["key"] == "천하제일비무"
    client.post("/event/choose", data={"choice": 0})
    seen = []
    for _ in range(100):
        current = state(client)
        if not current.get("battle"):
            break
        key = current["battle"]["enemy"]["key"]
        if key not in seen:
            seen.append(key)
        set_player(client, hp=550)
        client.post("/battle_action", data={"battle_action": "기본공격"})
    current = state(client)
    assert seen == ["비무청성", "비무철권", "비무결승"]
    assert current["pending_next"] and not current.get("gauntlet")
    assert "대회우승" in current["player"]["flags"] and current["player"]["fame"] >= 14
    assert current["player"]["weapon"] == "태산신검"


def test_fleeing_tournament_ends_it(client):
    set_player(client, turn=30)
    with client.session_transaction() as s:
        s["gauntlet"] = {"name": "대회", "enemies": ["비무철권"], "reward": {"fame": 9}, "round": 1, "total": 2}
        s["battle"] = Battle(Player.from_dict(s["player"]), Enemy("산적")).to_dict()
    random.seed(0)
    for _ in range(40):
        if not state(client).get("battle"):
            break
        client.post("/battle_action", data={"battle_action": "도주"})
    current = state(client)
    assert not current.get("gauntlet") and current["player"]["fame"] < 9


def test_injury_lowers_damage_and_rest_heals_it():
    player = Player()
    battle = Battle(player, Enemy("천마"))
    plain = battle._attack_scale()
    player.add_injury(2)
    assert battle._attack_scale() < plain
    from game.engine import GameEngine
    GameEngine(player).process_action("휴식")
    assert player.injury == 1


def test_seal_blocks_skills_and_mindset_clears_it():
    player = Player()
    skill = player.best_skill()
    battle = Battle(player, Enemy("천마"))
    battle.sealed = 2
    qi = player.qi
    battle.player_use_skill(skill)
    assert player.qi == qi and any("혈도" in l for l in battle.log)
    battle.player_use_mindset()
    assert battle.sealed == 0


def test_poison_on_enemy_ticks_and_can_kill():
    player = Player()
    player.sect = "당가"
    enemy = Enemy("산적")
    battle = Battle(player, enemy)
    battle._hits = lambda: True
    battle.player_use_skill(player.best_skill())
    assert battle.enemy_poison
    enemy.hp = 1
    battle._tick_effects()
    assert not enemy.is_alive()


def test_qi_deviation_on_risky_secret():
    random.seed(1)
    player = Player()
    player.mind = 1
    player.learn_skill(Skill("천마파천공"))
    skill = player.get_skill("천마파천공")
    skill.secret_unlocked = True
    player.main_skill = skill.key
    battle = Battle(player, Enemy("천마"))
    for _ in range(10):
        player.qi = player.max_qi()
        battle.player_use_secret(skill)
    assert player.injury > 0


def test_last_stand_trait_once_per_battle():
    player = Player(trait_keys=["불굴"])
    enemy = Enemy("천마")
    battle = Battle(player, enemy)
    battle.round_num = 1
    player.hp = 1
    battle.enemy_attack()
    assert player.hp == 1 and battle.stand_used
    battle.enemy_attack()
    assert player.hp == 0


def test_no_injury_trait():
    player = Player(trait_keys=["금강불괴"])
    player.add_injury(2)
    assert player.injury == 0


def test_market_always_offers_better_gear():
    player = Player()
    for _ in range(30):
        keys = [s["key"] for s in open_market(12, player)["stock"]]
        assert any(k in keys for k in ("철검", "강철검")) and any(k in keys for k in ("가죽호구", "철사갑의"))


def test_new_skill_does_not_replace_main_with_secret():
    player = Player()
    current = player.best_skill()
    current.secret_unlocked = True
    messages = player.learn_skill(Skill("태허검결"))
    assert player.main_skill == current.key and any("주무공" in m for m in messages)


def test_byname_and_fame():
    from game.flavor import byname, fame_rank
    player = Player()
    assert byname(player) == "이름 없는 무인" and fame_rank(0) == "무명소졸"
    player.fame = 40
    player.alignment["정도"] = 5
    assert byname(player).endswith("검협") and fame_rank(40) == "일방의 고수"


def test_battle_log_shows_form_names():
    player = Player()
    battle = Battle(player, Enemy("천마"))
    battle._hits = lambda: True
    battle.player_use_skill(player.best_skill())
    assert any("제" in l and "초" in l and "「" in l for l in battle.log)


def test_every_month_has_flavor_text():
    from game.flavor import FLAVOR
    assert set(FLAVOR["months"]) == {str(i) for i in range(1, 13)}


def test_breakthrough_hint_when_only_experience_is_missing():
    from game.realm import breakthrough_block
    player = Player()
    player.external = player.internal = player.martial = player.mind = 40
    assert "실전" in breakthrough_block(player)
    player.battles = 5
    assert breakthrough_block(player) is None
