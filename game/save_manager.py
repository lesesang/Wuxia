"""
턴 체크포인트 저장 시스템 (계획서 §4)

"턴이 시작되는 시점"의 상태를 saves/save.json에 저장한다.
브라우저 세션이 완전히 사라져도(앱을 껐다 켜도) 이 파일을 읽어서
가장 최근 턴 시작 지점부터 다시 진행할 수 있게 한다.

저장 시점: 한 턴의 모든 처리(전투 포함)가 완전히 끝나서
           다음 턴이 시작되려는 순간 (engine._finish_turn() 직후).
전투 중간 상태는 이 파일에 저장하지 않는다 — 전투는 세션에서만 임시로 다룬다.
"""

import json
import os

_SAVE_PATH = os.path.join(os.path.dirname(__file__), "..", "saves", "save.json")


def _ensure_save_dir():
    os.makedirs(os.path.dirname(_SAVE_PATH), exist_ok=True)


def save_checkpoint(player_dict, log):
    """턴 시작 지점 스냅샷을 디스크에 저장."""
    _ensure_save_dir()
    data = {"player": player_dict, "log": log}
    with open(_SAVE_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def load_checkpoint():
    """저장된 체크포인트를 불러온다. 없으면 None."""
    if not os.path.exists(_SAVE_PATH):
        return None
    with open(_SAVE_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def clear_checkpoint():
    """체크포인트 삭제 (새 게임 시작 시 호출)."""
    if os.path.exists(_SAVE_PATH):
        os.remove(_SAVE_PATH)


def has_checkpoint():
    return os.path.exists(_SAVE_PATH)
