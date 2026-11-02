"""
카르마 시스템 (구 '전설 포인트', 계획서 §23)

회차를 넘어 유지되는 메타 재화.
saves/legend_data.json 파일에 저장되어 서버를 껐다 켜도 유지된다.

구조:
    current_karma : 현재 사용 가능한 카르마 (상점에서 소비)
    total_karma   : 누적 획득량. 절대 감소하지 않음. 업적/해금 판정용.
"""

import json
import os

_SAVE_PATH = os.path.join(os.path.dirname(__file__), "..", "saves", "legend_data.json")

_DEFAULT_DATA = {
    "current_karma": 0,
    "total_karma": 0,
    "unlocked_origins": ["무림초출"],
    "unlocked_traits": [],
    "global_codex": [],  # 회차를 넘어 영구 누적되는 도감 (만난 적 키 목록)
}


def _ensure_save_dir():
    os.makedirs(os.path.dirname(_SAVE_PATH), exist_ok=True)


def load_karma():
    """카르마 데이터 로드. 파일이 없으면 기본값으로 생성. 구버전 파일은 누락된 키를 채운다."""
    _ensure_save_dir()
    if not os.path.exists(_SAVE_PATH):
        save_karma(_DEFAULT_DATA.copy())
        return _DEFAULT_DATA.copy()

    with open(_SAVE_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    changed = False
    for key, default_value in _DEFAULT_DATA.items():
        if key not in data:
            data[key] = default_value.copy() if isinstance(default_value, list) else default_value
            changed = True
    if changed:
        save_karma(data)

    return data


def save_karma(data):
    _ensure_save_dir()
    with open(_SAVE_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def add_karma(amount):
    """엔딩 달성 등으로 카르마를 획득. current와 total 둘 다 증가."""
    data = load_karma()
    data["current_karma"] += amount
    data["total_karma"] += amount
    save_karma(data)
    return data


def spend_karma(amount):
    """상점에서 카르마 소비. current만 감소. 부족하면 False 반환."""
    data = load_karma()
    if data["current_karma"] < amount:
        return False
    data["current_karma"] -= amount
    save_karma(data)
    return True


def unlock_origin(origin_key, cost):
    """카르마를 소비해 출신을 해금. 이미 해금됐거나 카르마 부족이면 False."""
    data = load_karma()
    if origin_key in data["unlocked_origins"]:
        return False
    if data["current_karma"] < cost:
        return False
    data["current_karma"] -= cost
    data["unlocked_origins"].append(origin_key)
    save_karma(data)
    return True


def unlock_trait(trait_key, cost):
    """카르마를 소비해 특성을 해금. 이미 해금됐거나 카르마 부족이면 False."""
    data = load_karma()
    if trait_key in data["unlocked_traits"]:
        return False
    if data["current_karma"] < cost:
        return False
    data["current_karma"] -= cost
    data["unlocked_traits"].append(trait_key)
    save_karma(data)
    return True


def update_global_codex(enemy_keys):
    """
    새로 만난 적 키 목록을 영구 도감에 추가.
    이미 기록된 것은 건너뛴다. 실제로 추가된 키 목록을 반환.
    """
    if not enemy_keys:
        return []
    data = load_karma()
    added = []
    for key in enemy_keys:
        if key not in data["global_codex"]:
            data["global_codex"].append(key)
            added.append(key)
    if added:
        save_karma(data)
    return added
