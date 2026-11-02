"""
턴 체크포인트 저장 시스템

"턴이 시작되는 시점"의 상태를 saves/save.json에 저장한다.
앱을 껐다 켜면 이 파일을 읽어서 가장 최근 턴 시작 지점부터 다시 진행한다.

전투, 이벤트, 시장 중간 상태는 저장하지 않는다.
다시 불러오면 그 턴의 처음으로 돌아간다.
"""

import json
import os

_SAVE_PATH = os.path.join(os.path.dirname(__file__), "..", "saves", "save.json")


def _ensure_save_dir():
    os.makedirs(os.path.dirname(_SAVE_PATH), exist_ok=True)


def save_checkpoint(player_dict, log):
    """턴 시작 지점 스냅샷을 디스크에 저장. 중간에 꺼져도 깨지지 않도록 임시 파일을 거친다."""
    _ensure_save_dir()
    data = {"player": player_dict, "log": log}
    temp_path = _SAVE_PATH + ".tmp"
    with open(temp_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(temp_path, _SAVE_PATH)


def load_checkpoint():
    """저장된 체크포인트를 불러온다. 없거나 손상됐으면 None."""
    if not os.path.exists(_SAVE_PATH):
        return None
    try:
        with open(_SAVE_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
    except (json.JSONDecodeError, OSError):
        return None
    if not isinstance(data, dict) or "player" not in data:
        return None
    return data


def clear_checkpoint():
    """체크포인트 삭제 (새 게임 시작 시 호출)."""
    if os.path.exists(_SAVE_PATH):
        os.remove(_SAVE_PATH)


def has_checkpoint():
    return load_checkpoint() is not None
