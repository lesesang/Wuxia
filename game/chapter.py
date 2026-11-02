"""
챕터 / 시장 시스템

세계관: 1턴 = 1개월, 총 60턴 = 5년.
5개 챕터 x 12턴 구조로 진행된다.

    1장 하산   (1~12턴,  1년차) — 강호 초입
    2장 명성   (13~24턴, 2년차) — 이름이 알려지기 시작
    3장 격랑   (25~36턴, 3년차) — 정·사·마 세력이 얽히는 시기
    4장 풍운   (37~48턴, 4년차) — 천하를 뒤흔드는 사건의 중심
    5장 결전   (49~60턴, 5년차) — 최종전을 향한 마지막 해

시장은 각 챕터 종료 시점(턴을 소모하지 않는 특수 시점)에 등장한다.
59턴 종료 후에는 "수상한 누군가"가 등장하는 특수 시장이다.
"""

CHAPTER_LENGTH = 12
TOTAL_CHAPTERS = 5

CHAPTERS = {
    1: {"title": "1장 하산",  "year": 1, "range": (1, 12),  "desc": "강호 초입. 이름 없는 무인으로 첫 발을 내딛는 시기."},
    2: {"title": "2장 명성",  "year": 2, "range": (13, 24), "desc": "작은 사건들로 이름이 알려지기 시작하는 시기."},
    3: {"title": "3장 격랑",  "year": 3, "range": (25, 36), "desc": "정·사·마 세력이 본격적으로 얽히는 시기."},
    4: {"title": "4장 풍운",  "year": 4, "range": (37, 48), "desc": "천하를 뒤흔드는 사건의 중심에 서는 시기."},
    5: {"title": "5장 결전",  "year": 5, "range": (49, 60), "desc": "최종전을 향해 가는 마지막 해."},
}

# 시장이 등장하는 턴 (해당 턴의 행동을 마친 직후, 턴 소모 없이 등장)
MARKET_TURNS = {
    12: "1차 시장",
    24: "2차 시장",
    36: "3차 시장",
    48: "4차 시장",
    59: "수상한 누군가",
}


def get_chapter(turn):
    """현재 턴이 속한 챕터 번호(1~5)를 반환."""
    chapter_num = min(TOTAL_CHAPTERS, ((turn - 1) // CHAPTER_LENGTH) + 1)
    return chapter_num


def get_chapter_info(turn):
    """현재 턴이 속한 챕터 정보를 반환."""
    return CHAPTERS[get_chapter(turn)]


def get_year(turn):
    """현재 턴 기준 강호행 연차(1년차~5년차)."""
    return get_chapter_info(turn)["year"]


def get_month_in_year(turn):
    """현재 연차 내 몇 개월째인지 (1~12)."""
    return ((turn - 1) % CHAPTER_LENGTH) + 1


def is_market_turn(turn):
    """이 턴 종료 후 시장이 열리는지 여부."""
    return turn in MARKET_TURNS


def get_market_name(turn):
    return MARKET_TURNS.get(turn)
