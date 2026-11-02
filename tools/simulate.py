"""
밸런스 확인 도구: 단순한 규칙으로 움직이는 봇이 게임 전체를 여러 번 플레이한다.

    python tools/simulate.py            (조건마다 100판)
    python tools/simulate.py 300

실제 저장 파일을 건드리지 않도록 임시 폴더를 저장 위치로 쓴다.
"""

import collections
import os
import random
import statistics
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import game.karma as karma_module  # noqa: E402
import game.save_manager as save_module

_temp = tempfile.mkdtemp()
karma_module._SAVE_PATH = os.path.join(_temp, "legend.json")
save_module._SAVE_PATH = os.path.join(_temp, "save.json")

from app import app
from game.karma import load_karma, save_karma
from game.market import ITEM_DB, block_reason
from game.player import Player

_data = load_karma()
_data["unlocked_origins"] = ["무림초출", "남궁세가", "곤륜파", "하오문", "권마계승"]
_data["unlocked_traits"] = ["천하제일기재", "천생근골", "오성"]
_data["total_karma"] = 100
save_karma(_data)


STYLES = {"섞어서": ("탐색", "탐색", "수련", "명상"), "탐색 위주": ("탐색", "탐색", "탐색", "수련"),
          "수련 위주": ("수련", "명상", "수련", "명상", "탐색")}


def choose_event(event, prefer):
    open_choices = [c for c in event["choices"] if not c["locked"]]
    if prefer:
        for c in open_choices:
            if c["label"].startswith(f"({prefer})") and "무릎" not in c["label"]:
                return c["index"]
    return random.choice(open_choices)["index"]


def buy_priority(key):
    item = ITEM_DB[key]
    kinds = {e["type"] for e in item["effects"]}
    if "equip" in kinds:
        return 0
    if "skill" in kinds:
        return 1
    if item.get("consumable"):
        return 2
    return 3


def play(style, use_market=True, origin="무림초출", traits=()):
    from game.events import event_view

    client = app.test_client()
    client.post("/start", data={"origin": origin, "trait": list(traits)})

    for _ in range(2000):
        with client.session_transaction() as s:
            state = dict(s)
        player = Player.from_dict(state["player"])
        if not player.alive:
            break

        if state.get("event"):
            view = event_view(player, state["event"]["key"])
            client.post("/event/choose", data={"choice": choose_event(view, player.dominant_alignment())})
        elif state.get("market"):
            bought = False
            if use_market:
                keys = [s["key"] for s in state["market"]["stock"] if s["left"] > 0 and not block_reason(player, s["key"])]
                if keys:
                    client.post("/market/buy", data={"item": sorted(keys, key=buy_priority)[0]})
                    bought = True
            if not bought:
                client.post("/market/leave")
        elif state.get("battle"):
            client.post("/battle_action", data=battle_choice(player, state["battle"]))
        elif state.get("pending_next"):
            client.post("/advance_turn")
        else:
            act = "휴식" if player.hp < player.max_hp() * 0.55 else random.choice(STYLES[style])
            client.post("/action", data={"action": act})

    with client.session_transaction() as s:
        return s.get("ending", {}).get("key", "없음"), Player.from_dict(s["player"])


def battle_choice(player, battle_state):
    from game.battle import Battle
    battle = Battle.from_dict(battle_state, player)
    skill = player.best_skill()
    hp_ratio = player.hp / player.max_hp()

    if hp_ratio < 0.35:
        for key in ("구명단", "금창약"):
            if player.inventory.get(key):
                return {"battle_action": "소비품", "item": key}
    movement = player.best_of_type("경공")
    if battle.enemy.special_for_round(battle.round_num + 1) and movement and player.qi >= movement.qi_cost:
        return {"battle_action": "경공"}
    if skill and skill.secret_unlocked and player.qi >= skill.secret_qi_cost:
        return {"battle_action": "비기"}
    if skill and player.qi < skill.qi_cost and player.best_of_type("심공"):
        return {"battle_action": "심법"}
    if hp_ratio < 0.25 and not battle.is_final and battle.enemy.hp > battle.enemy.max_hp * 0.4:
        return {"battle_action": "도주"}
    return {"battle_action": "기본공격"}


def report(name, results):
    endings = collections.Counter(r[0] for r in results)
    realms = collections.Counter(r[1].realm for r in results)
    reached = sum(r[1].turn >= 60 for r in results)
    stats = [(r[1].external + r[1].internal + r[1].martial + r[1].mind) / 4 for r in results]
    print(f"{name}: {dict(endings)}")
    print(f"    60턴 도달 {reached}/{len(results)}, 경지 {realms.most_common(4)}, "
          f"평균 능력치 {statistics.mean(stats):.0f}, 평균 은자 {statistics.mean(r[1].silver for r in results):.0f}")


if __name__ == "__main__":
    count = int(sys.argv[1]) if len(sys.argv) > 1 else 100
    for style in STYLES:
        report(f"{style} / 시장 이용", [play(style) for _ in range(count)])
    report("섞어서 / 시장 안 씀", [play("섞어서", use_market=False) for _ in range(count)])
    for origin in ("남궁세가", "곤륜파", "하오문", "권마계승"):
        report(f"섞어서 / {origin}", [play("섞어서", origin=origin) for _ in range(count)])
    report("탐색 위주 / 특성 3개", [play("탐색 위주", traits=("천하제일기재", "천생근골", "오성")) for _ in range(count)])
