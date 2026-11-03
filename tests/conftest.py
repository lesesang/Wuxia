import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import game.karma as karma_module
import game.save_manager as save_module


@pytest.fixture(autouse=True)
def temp_saves(tmp_path, monkeypatch):
    """테스트가 실제 저장 파일을 건드리지 않게 한다."""
    monkeypatch.setattr(karma_module, "_SAVE_PATH", str(tmp_path / "legend.json"))
    monkeypatch.setattr(save_module, "_SAVE_PATH", str(tmp_path / "save.json"))


@pytest.fixture
def client():
    from app import app
    app.session_interface.store.clear()
    client = app.test_client()
    client.post("/start", data={"origin": "무림초출"})
    finish_event(client)
    return client


def state(client):
    with client.session_transaction() as s:
        return dict(s)


def set_player(client, **values):
    with client.session_transaction() as s:
        player = dict(s["player"])
        player.update(values)
        s["player"] = player


def finish_event(client):
    """열려 있는 이벤트의 첫 번째 고를 수 있는 선택지를 고른다."""
    from game.events import event_view
    from game.player import Player
    current = state(client)
    if current.get("event"):
        view = event_view(Player.from_dict(current["player"]), current["event"]["key"])
        choice = next(c for c in view["choices"] if not c["locked"])
        client.post("/event/choose", data={"choice": choice["index"]})
