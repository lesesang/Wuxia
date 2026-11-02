# 경지 순서 (생사경은 별도 판정이라 순서에는 포함하되 일반 돌파로는 도달 불가)
REALM_ORDER = ["일류", "절정", "초절정", "화경", "현경", "생사경"]

# 경지 돌파 조건 — "평균" + "최소" + "전투 경험" 3중 조건
# 능력치 최대 99 기준 (계획서 §7, §9)
REALM_REQUIREMENTS = {
    "절정":  {"avg": 35, "min_stat": 30, "battles": 5},
    "초절정": {"avg": 50, "min_stat": 45, "battles": 7},
    "화경":  {"avg": 65, "min_stat": 60, "battles": 12},
    "현경":  {"avg": 80, "min_stat": 75, "battles": 18},
}

# 생사경 조건 — 일반 돌파와 별개. 최종전 클리어 시점에만 판정 (계획서 §10)
SAENGSA_REQUIREMENTS = {
    "min_stat": 95,   # 모든 능력치 95 이상
    "battles": 25,
    "hp_ratio": 0.8,  # 체력 80% 이상 (예: 최종전 종료 시점 기준, 추후 전투 시스템과 연결)
    "qi_ratio": 0.8,  # 내공 80% 이상
}

# 기본 엔딩(정상 클리어) 충족 조건 — 최종전(천마) 클리어 후 판정 (계획서 §28, 임시 수치)
GOOD_ENDING_REQUIREMENTS = {
    "min_realm": "화경",   # 최종 경지가 화경 이상이어야 함
    "hp_ratio": 0.3,        # 체력 30% 이상 남아있어야 함
    "qi_ratio": 0.3,        # 내공 30% 이상 남아있어야 함
}


def _stats(player):
    return [player.external, player.internal, player.martial, player.mind]


def get_next_realm(current_realm):
    """다음 경지를 반환. 생사경은 일반 돌파로 도달하지 않으므로 현경 다음은 None."""
    if current_realm == "현경" or current_realm == "생사경":
        return None
    idx = REALM_ORDER.index(current_realm)
    return REALM_ORDER[idx + 1]


def check_breakthrough(player):
    """
    경지 돌파 조건을 확인 (평균 + 최소 + 전투 경험).
    돌파 가능하면 새 경지 이름을 반환, 아니면 None.
    """
    next_realm = get_next_realm(player.realm)
    if next_realm is None:
        return None

    req = REALM_REQUIREMENTS[next_realm]
    stats = _stats(player)
    avg = sum(stats) / len(stats)
    min_stat = min(stats)

    if (avg >= req["avg"] and
        min_stat >= req["min_stat"] and
        player.battles >= req["battles"]):
        return next_realm

    return None


def get_progress(player):
    """
    다음 경지까지 남은 조건을 딕셔너리로 반환.
    이미 현경이면 빈 딕셔너리.
    """
    next_realm = get_next_realm(player.realm)
    if next_realm is None:
        return {}

    req = REALM_REQUIREMENTS[next_realm]
    stats = _stats(player)
    avg = sum(stats) / len(stats)
    min_stat = min(stats)

    return {
        "next_realm": next_realm,
        "avg_current": round(avg, 1),
        "avg_required": req["avg"],
        "avg_remain": max(0, round(req["avg"] - avg, 1)),
        "min_current": min_stat,
        "min_required": req["min_stat"],
        "min_remain": max(0, req["min_stat"] - min_stat),
        "battles_current": player.battles,
        "battles_required": req["battles"],
        "battles_remain": max(0, req["battles"] - player.battles),
    }


def check_saengsa(player):
    """
    생사경 조건 확인. 최종전 클리어 시점에 호출.
    조건 충족 시 True.
    """
    req = SAENGSA_REQUIREMENTS
    stats = _stats(player)
    min_stat = min(stats)

    max_hp = 100 + player.external * 5
    max_qi = 100 + player.internal * 5

    return (
        min_stat >= req["min_stat"] and
        player.battles >= req["battles"] and
        player.hp >= max_hp * req["hp_ratio"] and
        player.qi >= max_qi * req["qi_ratio"]
    )


def check_good_ending(player):
    """
    기본(정상) 엔딩 조건 확인. 최종전 클리어했지만 생사경엔 못 미친 경우 호출.
    조건 충족 시 True, 아니면 배드 엔딩.
    """
    req = GOOD_ENDING_REQUIREMENTS
    max_hp = 100 + player.external * 5
    max_qi = 100 + player.internal * 5

    realm_ok = REALM_ORDER.index(player.realm) >= REALM_ORDER.index(req["min_realm"])
    hp_ok = player.hp >= max_hp * req["hp_ratio"]
    qi_ok = player.qi >= max_qi * req["qi_ratio"]

    return realm_ok and hp_ok and qi_ok
