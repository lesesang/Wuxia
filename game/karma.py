"""
카르마 / 영구 기록 시스템

회차를 넘어 유지되는 메타 데이터.
saves/legend_data.json 파일에 저장되어 서버를 껐다 켜도 유지된다.

구조:
    current_karma : 현재 사용 가능한 카르마 (상점에서 소비)
    total_karma   : 누적 획득량. 절대 감소하지 않음. 특성 슬롯 판정에 사용.
    global_codex  : 만난 적 키
    known_skills / known_items : 도감에 기록된 무공과 품목
    endings_seen  : 본 엔딩 키 목록
    runs          : 최근 회차 기록 (최대 RUN_HISTORY_LIMIT개)
    total_runs    : 끝낸 회차 수
"""

import copy
import json
import os

_SAVE_PATH = os.path.join(os.path.dirname(__file__), "..", "saves", "legend_data.json")

RUN_HISTORY_LIMIT = 10

_DEFAULT_DATA = {
    "current_karma": 0,
    "total_karma": 0,
    "unlocked_origins": ["무림초출"],
    "unlocked_traits": [],
    "global_codex": [],
    "known_skills": [],
    "known_items": [],
    "endings_seen": [],
    "runs": [],
    "total_runs": 0,
}


def _ensure_save_dir():
    os.makedirs(os.path.dirname(_SAVE_PATH), exist_ok=True)


def load_karma():
    """데이터 로드. 파일이 없거나 손상됐으면 기본값을 쓴다. 구버전 파일은 누락된 키를 채운다."""
    _ensure_save_dir()
    data = None
    if os.path.exists(_SAVE_PATH):
        try:
            with open(_SAVE_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
        except (json.JSONDecodeError, OSError):
            # 손상된 파일은 지우지 않고 옆에 남겨 둔다
            os.replace(_SAVE_PATH, _SAVE_PATH + ".broken")

    if not isinstance(data, dict):
        data = copy.deepcopy(_DEFAULT_DATA)
        save_karma(data)
        return data

    changed = False
    for key, default_value in _DEFAULT_DATA.items():
        if key not in data:
            data[key] = copy.deepcopy(default_value)
            changed = True
    if changed:
        save_karma(data)
    return data


def save_karma(data):
    """중간에 꺼져도 파일이 깨지지 않도록 임시 파일에 쓴 뒤 교체한다."""
    _ensure_save_dir()
    temp_path = _SAVE_PATH + ".tmp"
    with open(temp_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(temp_path, _SAVE_PATH)


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


def _unlock(list_name, key, cost):
    data = load_karma()
    if key in data[list_name] or data["current_karma"] < cost:
        return False
    data["current_karma"] -= cost
    data[list_name].append(key)
    save_karma(data)
    return True


def unlock_origin(origin_key, cost):
    """카르마를 소비해 출신을 해금. 이미 해금됐거나 카르마 부족이면 False."""
    return _unlock("unlocked_origins", origin_key, cost)


def unlock_trait(trait_key, cost):
    """카르마를 소비해 특성을 해금. 이미 해금됐거나 카르마 부족이면 False."""
    return _unlock("unlocked_traits", trait_key, cost)


def _add_to_list(list_name, keys):
    if not keys:
        return []
    data = load_karma()
    added = [k for k in dict.fromkeys(keys) if k not in data[list_name]]
    if added:
        data[list_name].extend(added)
        save_karma(data)
    return added


def update_global_codex(enemy_keys):
    """새로 만난 적 키 목록을 영구 도감에 추가하고, 실제로 추가된 키 목록을 반환."""
    return _add_to_list("global_codex", enemy_keys)


def update_known(skill_keys=(), item_keys=()):
    """도감에 무공과 품목을 기록한다."""
    _add_to_list("known_skills", list(skill_keys))
    _add_to_list("known_items", list(item_keys))


def record_run(summary):
    """회차 결과를 기록한다."""
    data = load_karma()
    data["total_runs"] += 1
    data["runs"] = ([summary] + data["runs"])[:RUN_HISTORY_LIMIT]
    if summary["ending"] not in data["endings_seen"]:
        data["endings_seen"].append(summary["ending"])
    save_karma(data)
