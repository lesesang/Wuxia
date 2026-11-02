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
