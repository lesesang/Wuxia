from flask import Flask, redirect, render_template, request, session, url_for

from game.alignment import ALIGNMENTS, benefit_text, title
from game.battle import Battle, use_consumable
from game.chapter import MARKET_TURNS, get_chapter_info, get_month_in_year, get_year, is_market_turn
from game.ending import ENDING_SEALS, ENDING_TITLES, KARMA_REWARD, build_epilogue, run_summary
from game.enemy import ENEMY_DB
from game.engine import GameEngine
from game.events import EVENT_DB, event_view, resolve_choice
from game.karma import load_karma, record_run, unlock_origin, unlock_trait, update_known
from game.market import ITEM_DB, buy, equipment_bonus, item_name, open_market, stock_view
from game.origin import ORIGIN_ORDER, ORIGINS
from game.player import Player
from game.realm import get_progress
from game.save_manager import clear_checkpoint, load_checkpoint, save_checkpoint
from game.server_session import MemorySessionInterface
from game.skill import SKILL_DB
from game.traits import TRAIT_DB, get_trait_keys, next_slot_threshold, trait_slots

app = Flask(__name__)
app.secret_key = "wuxia-secret-key"
app.session_interface = MemorySessionInterface()

LOG_LIMIT = 40
VALID_ACTIONS = {"수련", "명상", "탐색", "휴식"}
VALID_BATTLE_ACTIONS = {"기본공격", "비기", "심법", "경공", "소비품", "도주"}
TURN_STATES = ("battle", "ending", "pending_next", "market", "event")


# ---------- 공통 도우미 ----------

def _clear_turn_state():
    for key in TURN_STATES:
        session.pop(key, None)


def _store(player, log):
    session["player"] = player.to_dict()
    session["log"] = log[-LOG_LIMIT:]


def _is_busy():
    """전투, 이벤트, 시장, 결과 확인 중이거나 게임이 끝났으면 새 행동을 받지 않는다."""
    return (session.get("battle") or session.get("market") or session.get("event")
            or session.get("pending_next") or not session["player"]["alive"])


def _enter_turn(player, log):
    """새 턴에 들어왔을 때 공통 처리: 체크포인트를 저장하고 줄거리 이벤트를 연다."""
    save_checkpoint(player.to_dict(), log)
    engine = GameEngine(player)
    engine.begin_turn()
    if engine.event_started:
        session["event"] = {"key": engine.event_started, "forced": True}
    _store(player, log)


def _restore_from_checkpoint(checkpoint):
    """체크포인트에서 복구한다. 그 턴의 줄거리 이벤트는 다시 시작된다."""
    _clear_turn_state()
    player = Player.from_dict(checkpoint["player"])
    log = checkpoint.get("log", [])[-LOG_LIMIT:]
    _store(player, log)
    engine = GameEngine(player)
    engine.begin_turn()
    if engine.event_started:
        session["event"] = {"key": engine.event_started, "forced": True}


def _finish_game(player, log, victory, forced=None):
    """엔딩 처리. 카르마 지급, 회차 기록, 체크포인트 삭제."""
    engine = GameEngine(player)
    engine.resolve_ending(victory, forced)
    ending_key, karma_gained, text = engine.ending_result
    session["ending"] = {
        "key": ending_key,
        "title": ENDING_TITLES[ending_key],
        "seal": ENDING_SEALS[ending_key],
        "karma": karma_gained,
        "text": text,
        "epilogue": build_epilogue(player, ending_key),
    }
    record_run(run_summary(player, ending_key))
    for key in ("pending_next", "battle", "event", "market"):
        session.pop(key, None)
    clear_checkpoint()
    _store(player, log + engine.log)


def _codex_data(karma_data):
    """도감 화면 데이터. 메인 화면과 게임 화면에서 함께 쓴다."""
    enemies = []
    for key in karma_data.get("global_codex", []):
        if key in ENEMY_DB:
            data = ENEMY_DB[key]
            enemies.append({
                "key": key, "name": data["name"], "tier": data["tier"], "realm": data["realm"],
                "hp": data["hp"], "attack": data["attack"], "desc": data.get("desc", ""),
            })
    skills = [{"name": SKILL_DB[k]["name"], "type": SKILL_DB[k]["type"], "grade": SKILL_DB[k]["grade"],
               "desc": SKILL_DB[k].get("desc", "")}
              for k in karma_data.get("known_skills", []) if k in SKILL_DB]
    items = [{"name": ITEM_DB[k]["name"], "category": ITEM_DB[k]["category"], "desc": ITEM_DB[k]["desc"]}
             for k in karma_data.get("known_items", []) if k in ITEM_DB]
    endings = [{"key": k, "title": ENDING_TITLES[k], "seen": k in karma_data.get("endings_seen", []),
                "karma": KARMA_REWARD[k]} for k in ENDING_TITLES]
    return {
        "enemies": enemies, "enemy_total": len(ENEMY_DB),
        "skills": skills, "skill_total": len(SKILL_DB),
        "goods": items, "item_total": len(ITEM_DB),
        "endings": endings,
        "runs": [{**r, "ending_title": ENDING_TITLES.get(r["ending"], r["ending"])}
                 for r in karma_data.get("runs", [])],
        "total_runs": karma_data.get("total_runs", 0),
    }


# ---------- 메인 화면 ----------

@app.route("/")
def home():
    # 진행 중인 세션이 있으면 곧바로 게임 화면으로
    if "player" in session:
        return redirect(url_for("game"))

    karma_data = load_karma()
    unlocked_origins = karma_data["unlocked_origins"]

    origins = []
    for k in ORIGIN_ORDER:
        o = dict(ORIGINS[k])
        o["locked"] = k not in unlocked_origins
        o["skill_names"] = [SKILL_DB[s]["name"] for s in o.get("skills", [])]
        origins.append(o)

    traits = []
    for k in get_trait_keys():
        t = dict(TRAIT_DB[k])
        t["key"] = k
        t["unlocked"] = k in karma_data["unlocked_traits"]
        traits.append(t)

    return render_template(
        "index.html", origins=origins, traits=traits, karma=karma_data,
        has_save=load_checkpoint() is not None, codex=_codex_data(karma_data),
        slots=trait_slots(karma_data["total_karma"]),
        next_slot=next_slot_threshold(karma_data["total_karma"]),
    )


@app.route("/continue", methods=["POST"])
def continue_game():
    """세션이 사라진 상태에서 저장된 턴 시작 지점을 불러와 이어한다."""
    checkpoint = load_checkpoint()
    if checkpoint is None:
        return redirect(url_for("home"))
    _restore_from_checkpoint(checkpoint)
    return redirect(url_for("game"))


@app.route("/start", methods=["POST"])
def start():
    origin_key = request.form.get("origin", "무림초출")
    karma_data = load_karma()

    # 잠긴 출신 선택 방지
    if origin_key not in karma_data["unlocked_origins"] or origin_key not in ORIGINS:
        return redirect(url_for("home"))

    # 해금된 특성만, 열린 슬롯 수만큼 적용
    selected = list(dict.fromkeys(request.form.getlist("trait")))
    valid_traits = [t for t in selected if t in karma_data["unlocked_traits"]]
    valid_traits = valid_traits[:trait_slots(karma_data["total_karma"])]

    player = Player(origin_key, trait_keys=valid_traits)
    update_known(skill_keys=[s.key for s in player.skills])

    intro = get_chapter_info(1)
    log = [f"📖 {intro['title']} ({intro['year']}년차) — {intro['desc']}"]
    _clear_turn_state()
    _enter_turn(player, log)
    return redirect(url_for("game"))


# ---------- 게임 화면 ----------

@app.route("/game")
def game():
    if "player" not in session:
        # 세션이 사라진 경우 (앱을 완전히 껐다 켠 경우) — 저장된 턴 시작 지점으로 복구
        checkpoint = load_checkpoint()
        if checkpoint is None:
            return redirect(url_for("home"))
        _restore_from_checkpoint(checkpoint)

    player = Player.from_dict(session["player"])
    turn = min(player.turn, player.max_turn)
    karma_data = load_karma()

    battle_view = None
    if session.get("battle"):
        battle = Battle.from_dict(session["battle"], player)
        skill = player.best_skill()
        mindset = player.best_of_type("심공")
        movement = player.best_of_type("경공")
        battle_view = {
            "enemy_name": battle.enemy.name,
            "enemy_hp": battle.enemy.hp,
            "enemy_max_hp": battle.enemy.max_hp,
            "enemy_desc": ENEMY_DB[battle.enemy.key].get("desc", ""),
            "round_num": battle.round_num,
            "is_final": battle.is_final,
            "skill": skill,
            "secret_ready": bool(skill and skill.secret_unlocked and player.qi >= skill.secret_qi_cost),
            "mindset": mindset,
            "movement": movement,
            "warning": battle.next_special_warning(),
            "poison": battle.poison,
            "atk_buff": battle.atk_buff,
            "counter_pct": battle.counter_pct,
        }

    market_view = None
    if session.get("market"):
        market_state = session["market"]
        market_view = {
            "name": market_state["name"],
            "special": market_state["special"],
            "message": market_state["message"],
            "stock": stock_view(player, market_state),
        }

    event = event_view(player, session["event"]["key"]) if session.get("event") else None

    gear = {
        "weapon": item_name(player.weapon),
        "weapon_bonus": equipment_bonus(player, "weapon"),
        "armor": item_name(player.armor),
        "armor_bonus": equipment_bonus(player, "armor"),
    }
    inventory = [{"key": k, "name": ITEM_DB[k]["name"], "count": n, "desc": ITEM_DB[k]["desc"]}
                 for k, n in player.inventory.items() if k in ITEM_DB]
    alignment_view = {
        "values": [(name, player.alignment.get(name, 0)) for name in ALIGNMENTS],
        "title": title(player.alignment),
        "benefit": benefit_text(player.alignment),
    }
    next_market = next((t for t in sorted(MARKET_TURNS) if t >= player.turn), None)

    return render_template(
        "game.html", player=player, log=session.get("log", []), progress=get_progress(player),
        chapter=get_chapter_info(turn), year=get_year(turn), month=get_month_in_year(turn),
        ending=session.get("ending"), karma=karma_data, battle=battle_view,
        pending_next=session.get("pending_next", False), codex=_codex_data(karma_data),
        market=market_view, event=event, gear=gear, inventory=inventory,
        alignment=alignment_view, traits=[TRAIT_DB[k] for k in player.traits if k in TRAIT_DB],
        next_market=next_market,
    )


# ---------- 행동 ----------

@app.route("/action", methods=["POST"])
def action():
    if "player" not in session:
        return redirect(url_for("home"))
    if _is_busy():
        return redirect(url_for("game"))

    action_name = request.form.get("action")
    if action_name not in VALID_ACTIONS:
        return redirect(url_for("game"))

    player = Player.from_dict(session["player"])
    # 중앙 영역은 이번 턴의 일만 보여 준다. 행동을 시작하면 턴 시작 안내 문구는 지운다.
    engine = GameEngine(player)
    engine.process_action(action_name)
    log = list(engine.log)

    if engine.battle_started:
        session["battle"] = engine.battle_started.to_dict()
    elif engine.event_started:
        session["event"] = {"key": engine.event_started, "forced": False}
    else:
        session["pending_next"] = True

    _store(player, log)
    return redirect(url_for("game"))


@app.route("/event/choose", methods=["POST"])
def event_choose():
    if "player" not in session or not session.get("event"):
        return redirect(url_for("game"))

    state = session["event"]
    player = Player.from_dict(session["player"])
    log = list(session.get("log", []))

    try:
        index = int(request.form.get("choice", ""))
    except ValueError:
        return redirect(url_for("game"))

    result = resolve_choice(player, state["key"], index)
    if result is None:
        return redirect(url_for("game"))

    text, summary, effects = result
    event_title = EVENT_DB[state["key"]]["title"]
    log = (log if state["forced"] else []) + [f"「{event_title}」", text]
    if summary:
        log.append(", ".join(summary))
    session.pop("event", None)

    if "ending" in effects:
        _finish_game(player, log, victory=True, forced=effects["ending"])
        return redirect(url_for("game"))

    engine = GameEngine(player)
    if effects.get("final_battle"):
        engine.start_final_battle()
    elif "battle" in effects:
        engine.start_battle_with(effects["battle"])

    if engine.battle_started:
        session["battle"] = engine.battle_started.to_dict()
        log += engine.log
    elif not state["forced"]:
        session["pending_next"] = True

    _store(player, log)
    return redirect(url_for("game"))


@app.route("/battle_action", methods=["POST"])
def battle_action():
    if "player" not in session or not session.get("battle"):
        return redirect(url_for("game"))

    player_action = request.form.get("battle_action", "기본공격")
    if player_action not in VALID_BATTLE_ACTIONS:
        return redirect(url_for("game"))

    player = Player.from_dict(session["player"])
    battle = Battle.from_dict(session["battle"], player)

    # 최종전에서는 도망칠 수 없다
    if player_action == "도주" and battle.is_final:
        return redirect(url_for("game"))

    log = list(session.get("log", []))
    result = battle.run_round(player_action=player_action, skill=player.best_skill(),
                              item_key=request.form.get("item"))
    log += battle.log

    if result is None:
        session["battle"] = battle.to_dict()
        _store(player, log)
        return redirect(url_for("game"))

    session.pop("battle", None)

    if result.victory:
        log.append(f"승리! (전투 경험 +{result.exp_gained})")
    elif result.fled:
        log.append("가까스로 전장을 벗어났다.")
    else:
        log.append("패배...")

    if battle.is_final or player.hp <= 0:
        # 최종전이거나 체력이 다했으면 곧바로 엔딩으로 이어진다
        _finish_game(player, log, victory=result.victory)
    else:
        session["pending_next"] = True
        _store(player, log)
    return redirect(url_for("game"))


@app.route("/use_item", methods=["POST"])
def use_item():
    """전투 밖에서 소비품을 쓴다. 턴을 소모하지 않는다."""
    if "player" not in session or session.get("battle") or not session["player"]["alive"]:
        return redirect(url_for("game"))
    player = Player.from_dict(session["player"])
    key = request.form.get("item")
    if key in ITEM_DB and player.inventory.get(key, 0) > 0:
        use_consumable(player, key)
        session["player"] = player.to_dict()
    return redirect(url_for("game"))


@app.route("/set_main_skill", methods=["POST"])
def set_main_skill():
    """주무공을 바꾼다. 턴을 소모하지 않는다."""
    if "player" not in session:
        return redirect(url_for("home"))
    if session.get("battle"):
        return redirect(url_for("game"))
    player = Player.from_dict(session["player"])
    skill = player.get_skill(request.form.get("skill"))
    if skill is not None and skill.type == "공격무공":
        player.main_skill = skill.key
        session["player"] = player.to_dict()
    return redirect(url_for("game"))


@app.route("/advance_turn", methods=["POST"])
def advance_turn():
    """'다음' 버튼. 시장이 열리는 턴이면 시장으로, 아니면 다음 턴으로 넘어간다."""
    if "player" not in session:
        return redirect(url_for("home"))

    if not session.get("pending_next") or session.get("market"):
        return redirect(url_for("game"))

    if is_market_turn(session["player"]["turn"]):
        player = Player.from_dict(session["player"])
        session["market"] = open_market(player.turn, player)
        return redirect(url_for("game"))

    return _start_next_turn()


def _start_next_turn():
    """이번 턴을 완전히 마무리하고 다음 턴을 시작한다."""
    player = Player.from_dict(session["player"])

    engine = GameEngine(player)
    engine.advance_turn()
    session.pop("pending_next", None)

    # 중앙 영역은 매 턴 완전히 교체한다
    _enter_turn(player, engine.log)
    return redirect(url_for("game"))


# ---------- 시장 ----------

@app.route("/market/buy", methods=["POST"])
def market_buy():
    if "player" not in session or not session.get("market"):
        return redirect(url_for("game"))

    player = Player.from_dict(session["player"])
    market = session["market"]
    key = request.form.get("item")
    success, message = buy(player, market, key)
    market["message"] = message
    if success:
        update_known(item_keys=[key])

    session["market"] = market
    session["player"] = player.to_dict()
    return redirect(url_for("game"))


@app.route("/market/leave", methods=["POST"])
def market_leave():
    if "player" not in session or not session.get("market"):
        return redirect(url_for("game"))

    session.pop("market", None)
    return _start_next_turn()


@app.route("/restart", methods=["POST"])
def restart():
    session.clear()
    clear_checkpoint()
    return redirect(url_for("home"))


# ---------- 카르마 상점 ----------

@app.route("/shop/buy_origin", methods=["POST"])
def shop_buy_origin():
    origin_key = request.form.get("origin")
    if origin_key in ORIGINS:
        unlock_origin(origin_key, ORIGINS[origin_key]["cost"])
    return redirect(url_for("home"))


@app.route("/shop/buy_trait", methods=["POST"])
def shop_buy_trait():
    trait_key = request.form.get("trait")
    if trait_key in TRAIT_DB:
        unlock_trait(trait_key, TRAIT_DB[trait_key]["cost"])
    return redirect(url_for("home"))


if __name__ == "__main__":
    app.run(debug=True)
