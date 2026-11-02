"""게임을 끝까지 무작위로 플레이하며 모든 화면이 오류 없이 그려지는지 확인한다."""
import random

from conftest import state
from game.events import event_view
from game.player import Player


def play_one(app, origin):
    client = app.test_client()
    client.post("/start", data={"origin": origin})
    for _ in range(3000):
        assert client.get("/game").status_code == 200
        current = state(client)
        player = Player.from_dict(current["player"])
        if not player.alive:
            return current["ending"]["key"]
        if current.get("event"):
            view = event_view(player, current["event"]["key"])
            client.post("/event/choose", data={"choice": random.choice([c for c in view["choices"] if not c["locked"]])["index"]})
        elif current.get("market"):
            for entry in current["market"]["stock"]:
                client.post("/market/buy", data={"item": entry["key"]})
            client.post("/market/leave")
        elif current.get("battle"):
            action = random.choice(["기본공격", "기본공격", "비기", "심법", "경공", "소비품", "도주"])
            client.post("/battle_action", data={"battle_action": action, "item": next(iter(player.inventory), "")})
        elif current.get("pending_next"):
            client.post("/advance_turn")
        else:
            action = "휴식" if player.hp < player.max_hp() / 2 else random.choice(["탐색", "수련", "명상"])
            client.post("/action", data={"action": action})
    raise AssertionError("게임이 끝나지 않았다")
