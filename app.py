from flask import Flask, render_template, request, session, redirect, url_for
from game.player import Player
from game.engine import GameEngine
from game.battle import Battle
from game.realm import get_progress
from game.origin import ORIGINS, ORIGIN_ORDER
from game.skill import Skill
from game.chapter import get_chapter_info, get_year, get_month_in_year, is_market_turn
from game.market import open_market, buy, stock_view, item_name, equipment_bonus
from game.karma import load_karma, unlock_origin, unlock_trait
from game.traits import TRAIT_DB, get_trait_keys
from game.save_manager import save_checkpoint, load_checkpoint, clear_checkpoint
from game.enemy import ENEMY_DB

app = Flask(__name__)
app.secret_key = "wuxia-secret-key"

# 세션은 브라우저 쿠키(약 4KB 제한)에 저장되므로 로그를 무한정 쌓지 않는다
LOG_LIMIT = 12


def get_player_dict(player):
    return {
        "origin":     player.origin,
        "origin_key": player.origin_key,
        "realm":      player.realm,
        "external":   player.external,
        "internal":   player.internal,
        "martial":    player.martial,
        "mind":       player.mind,
        "hp":         player.hp,
        "qi":         player.qi,
        "battles":    player.battles,
        "encountered_enemies": player.encountered_enemies,
        "pending_encounters":  player.pending_encounters,
        "skills":     [s.to_dict() for s in player.skills],
        "traits":     player.traits,
        "silver":     player.silver,
        "weapon":     player.weapon,
        "armor":      player.armor,
        "boss_weaken": player.boss_weaken,
        "turn":       player.turn,
        "max_turn":   player.max_turn,
        "alive":      player.alive,
    }


def load_player_from_dict(d):
    p = Player.__new__(Player)
    p.origin     = d["origin"]
    p.origin_key = d.get("origin_key", "무림초출")
    p.realm      = d["realm"]
    p.external   = d["external"]
    p.internal   = d["internal"]
    p.martial    = d["martial"]
    p.mind       = d["mind"]
    p.hp         = d["hp"]
    p.qi         = d["qi"]
    p.battles    = d.get("battles", 0)
    p.encountered_enemies = d.get("encountered_enemies", [])
    p.pending_encounters  = d.get("pending_encounters", [])
    p.skills     = [Skill.from_dict(s) for s in d.get("skills", [])]
    p.traits     = d.get("traits", [])
    p.silver     = d.get("silver", 0)
    p.weapon     = d.get("weapon")
    p.armor      = d.get("armor")
    p.boss_weaken = d.get("boss_weaken", 0)
    p.turn       = d["turn"]
    p.max_turn   = d["max_turn"]
    p.alive      = d["alive"]
    return p


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
        origins.append(o)

    unlocked_trait_keys = karma_data["unlocked_traits"]
    traits = []
    for k in get_trait_keys():
        t = dict(TRAIT_DB[k])
        t["key"] = k
        t["unlocked"] = k in unlocked_trait_keys
        traits.append(t)

    has_save = load_checkpoint() is not None

    # 영구 도감
    codex_enemies = []
    for key in karma_data.get("global_codex", []):
        if key in ENEMY_DB:
            data = ENEMY_DB[key]
            codex_enemies.append({
                "key": key, "name": data["name"], "tier": data["tier"],
                "realm": data["realm"], "hp": data["hp"], "attack": data["attack"],
            })

    return render_template("index.html", origins=origins, traits=traits,
                            karma=karma_data, has_save=has_save,
                            codex_enemies=codex_enemies)


@app.route("/continue", methods=["POST"])
def continue_game():
    """세션이 사라진 상태에서 저장된 턴 시작 지점을 불러와 이어한다."""
    checkpoint = load_checkpoint()
    if checkpoint is None:
        return redirect(url_for("home"))
    session["player"] = checkpoint["player"]
    session["log"] = checkpoint["log"][:LOG_LIMIT]
    session.pop("battle", None)
    session.pop("ending", None)
    session.pop("pending_next", None)
    session.pop("market", None)
    return redirect(url_for("game"))


@app.route("/start", methods=["POST"])
def start():
    origin_key = request.form.get("origin", "무림초출")
    selected_traits = request.form.getlist("trait")

    karma_data = load_karma()

    # 잠긴 출신 선택 방지
    if origin_key not in karma_data["unlocked_origins"]:
        return redirect(url_for("home"))

    # 잠긴 특성 선택 방지 (해금된 것만 실제로 적용)
    valid_traits = [t for t in selected_traits if t in karma_data["unlocked_traits"]]
    valid_traits = valid_traits[:1]  # 초기 특성 슬롯 1개 (계획서 §25)

    player = Player(origin_key, trait_keys=valid_traits)
    player.learn_skill(Skill("기초검법"))  # 임시: 테스트용 시작 무공 (추후 출신별/이벤트별 습득으로 교체)
    session["player"] = get_player_dict(player)

    intro = get_chapter_info(1)
    session["log"] = [f"📖 {intro['title']} ({intro['year']}년차) — {intro['desc']}"]
    session.pop("ending", None)
    session.pop("battle", None)
    session.pop("pending_next", None)
    session.pop("market", None)

    # 새 턴(1턴)이 시작되는 시점 — 즉시 체크포인트 저장
    save_checkpoint(session["player"], session["log"])

    return redirect(url_for("game"))


@app.route("/game")
def game():
    if "player" not in session:
        # 세션이 사라진 경우 (앱을 완전히 껐다 켠 경우) — 저장된 턴 시작 지점으로 복구
        checkpoint = load_checkpoint()
        if checkpoint is None:
            return redirect(url_for("home"))
        session["player"] = checkpoint["player"]
        session["log"] = checkpoint["log"][:LOG_LIMIT]
        session.pop("battle", None)
        session.pop("ending", None)
        session.pop("pending_next", None)
        session.pop("market", None)

    player = load_player_from_dict(session["player"])
    log = session.get("log", [])
    progress = get_progress(player)
    chapter = get_chapter_info(min(player.turn, player.max_turn))
    year = get_year(min(player.turn, player.max_turn))
    month = get_month_in_year(min(player.turn, player.max_turn))
    ending = session.get("ending")
    karma_data = load_karma()
    pending_next = session.get("pending_next", False)

    battle_state = session.get("battle")
    battle_view = None
    if battle_state:
        battle = Battle.from_dict(battle_state, player)
        battle_view = {
            "enemy_name": battle.enemy.name,
            "enemy_hp": battle.enemy.hp,
            "enemy_max_hp": battle.enemy.max_hp,
            "round_num": battle.round_num,
            "is_final": battle.is_final,
            "has_skill": len(player.skills) > 0,
            "secret_ready": any(s.secret_unlocked for s in player.skills),
        }

    # 도감 — 영구 누적 도감(global_codex) 기반으로 표시
    codex_enemies = []
    for key in karma_data.get("global_codex", []):
        if key in ENEMY_DB:
            data = ENEMY_DB[key]
            codex_enemies.append({
                "key": key, "name": data["name"], "tier": data["tier"],
                "realm": data["realm"], "hp": data["hp"], "attack": data["attack"],
            })

    market_state = session.get("market")
    market_view = None
    if market_state:
        market_view = {
            "name": market_state["name"],
            "special": market_state["special"],
            "message": market_state["message"],
            "stock": stock_view(player, market_state),
        }

    gear = {
        "weapon": item_name(player.weapon),
        "weapon_bonus": equipment_bonus(player, "weapon"),
        "armor": item_name(player.armor),
        "armor_bonus": equipment_bonus(player, "armor"),
    }

    return render_template("game.html", player=player, log=log, progress=progress,
                            chapter=chapter, year=year, month=month,
                            ending=ending, karma=karma_data, battle=battle_view,
                            pending_next=pending_next, codex_enemies=codex_enemies,
                            market=market_view, gear=gear)


@app.route("/action", methods=["POST"])
def action():
    if "player" not in session:
        return redirect(url_for("home"))

    # 전투·시장·결과 확인 중이거나 게임이 끝났으면 새 행동을 받지 않는다 (뒤로 가기 중복 입력 방지)
    if (session.get("battle") or session.get("market") or session.get("pending_next")
            or not session["player"]["alive"]):
        return redirect(url_for("game"))

    action_name = request.form.get("action")
    player = load_player_from_dict(session["player"])
    log = session.get("log", [])

    engine = GameEngine(player)
    engine.log = []
    engine.process_action(action_name)

    log = engine.log + log

    if engine.battle_started:
        # 전투가 시작됨 — 전투 화면으로 전환 (턴은 아직 끝나지 않음)
        session["battle"] = engine.battle_started.to_dict()
        session.pop("pending_next", None)
    else:
        session.pop("battle", None)
        # 행동 결과 처리가 끝남 — 턴은 아직 넘기지 않고 "다음" 버튼 대기 상태로 전환
        session["pending_next"] = True

    session["player"] = get_player_dict(player)
    session["log"] = log[:LOG_LIMIT]

    return redirect(url_for("game"))


@app.route("/battle_action", methods=["POST"])
def battle_action():
    if "player" not in session or "battle" not in session:
        return redirect(url_for("game"))

    player_action = request.form.get("battle_action", "기본공격")

    player = load_player_from_dict(session["player"])
    battle = Battle.from_dict(session["battle"], player)
    log = session.get("log", [])

    skill = player.best_skill()
    result = battle.run_round(player_action=player_action, skill=skill)

    log = battle.log + log
    battle.log = []  # 다음 라운드 로그와 섞이지 않도록 비움

    if result is None:
        # 전투 계속 — 다음 라운드 대기
        session["battle"] = battle.to_dict()
        session["player"] = get_player_dict(player)
        session["log"] = log[:LOG_LIMIT]
        return redirect(url_for("game"))

    # 전투 종료 — 턴은 아직 넘기지 않고 "다음" 버튼 대기 상태로 전환
    session.pop("battle", None)

    if result.victory:
        log.insert(0, f"승리! (전투 경험 +{result.exp_gained})")
    elif result.player_hp_left <= 0:
        log.insert(0, "패배...")

    if battle.is_final or player.hp <= 0:
        # 최종전이거나 체력이 다했으면 결과가 바로 엔딩으로 이어지므로 "다음" 버튼 없이 즉시 엔딩 처리
        engine = GameEngine(player)
        engine.log = []
        engine.resolve_ending(result.victory)
        log = engine.log + log
        ending_key, karma_gained, text = engine.ending_result
        session["ending"] = {"key": ending_key, "karma": karma_gained, "text": text}
        session.pop("pending_next", None)
        # 게임 오버 — 체크포인트는 더 이상 필요 없으므로 삭제
        clear_checkpoint()
    else:
        session["pending_next"] = True

    session["player"] = get_player_dict(player)
    session["log"] = log[:LOG_LIMIT]

    return redirect(url_for("game"))


@app.route("/advance_turn", methods=["POST"])
def advance_turn():
    """'다음' 버튼. 시장이 열리는 턴이면 시장으로, 아니면 다음 턴으로 넘어간다."""
    if "player" not in session:
        return redirect(url_for("home"))

    if not session.get("pending_next") or session.get("market"):
        return redirect(url_for("game"))

    if is_market_turn(session["player"]["turn"]):
        session["market"] = open_market(session["player"]["turn"])
        return redirect(url_for("game"))

    return _start_next_turn()


def _start_next_turn():
    """이번 턴을 완전히 마무리하고 다음 턴을 시작한다."""
    player = load_player_from_dict(session["player"])

    engine = GameEngine(player)
    engine.log = []
    engine.advance_turn()

    # 중앙 영역은 매 턴 완전히 교체한다 (이전 턴 로그를 이어 붙이지 않음)
    log = engine.log[:LOG_LIMIT]

    if engine.battle_started:
        # 새 턴이 시작되자마자 최종전(천마)이 발생한 경우
        session["battle"] = engine.battle_started.to_dict()
        session.pop("pending_next", None)
        session["player"] = get_player_dict(player)
        session["log"] = log
        return redirect(url_for("game"))

    if player.is_game_over():
        player.alive = False

    session.pop("pending_next", None)
    session["player"] = get_player_dict(player)
    session["log"] = log

    # 새 턴이 시작되는 시점 — 즉시 체크포인트 저장
    save_checkpoint(get_player_dict(player), log)

    return redirect(url_for("game"))


# ---------- 시장 ----------

@app.route("/market/buy", methods=["POST"])
def market_buy():
    if "player" not in session or not session.get("market"):
        return redirect(url_for("game"))

    player = load_player_from_dict(session["player"])
    market = session["market"]
    _, message = buy(player, market, request.form.get("item"))
    market["message"] = message

    session["market"] = market
    session["player"] = get_player_dict(player)
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
