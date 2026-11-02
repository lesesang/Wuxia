"""
엔딩 시스템

판정 우선순위:
    사망 → 귀순(천마봉에서 선택) → 생사경 → 기본 엔딩 → 배드 엔딩

각 엔딩은 카르마 보상을 가지며, 성향과 이야기 선택에 따라 맺음말이 달라진다.
"""

from game.alignment import title
from game.realm import check_good_ending, check_saengsa

# 엔딩별 카르마 보상 (임시 수치)
KARMA_REWARD = {
    "사망":   1,
    "귀순":   3,
    "배드":   3,
    "기본":   5,
    "생사경": 10,
}

ENDING_TITLES = {
    "사망":   "⚰️ 사망",
    "귀순":   "🩸 마도천하",
    "배드":   "🌧️ 상처뿐인 승리",
    "기본":   "🏆 강호의 전설",
    "생사경": "✨ 생사경",
}

# 엔딩 화면 인장에 새기는 글자
ENDING_SEALS = {"사망": "사망", "귀순": "귀순", "배드": "상흔", "기본": "전설", "생사경": "생사"}

ENDING_TEXT = {
    "사망":   "강호의 한 줄기 바람이 되어 사라졌다. 그의 이야기는 여기서 끝난다.",
    "귀순":   "천마의 곁에 선 그날 이후, 강호에 정도라는 말은 사라졌다. 사람들은 두 번째 그림자의 이름을 입에 올리지 못했다.",
    "배드":   "천마를 쓰러뜨렸으나, 그 대가로 몸과 마음이 크게 상했다. 불완전한 승리였다.",
    "기본":   "천마를 쓰러뜨리고 강호에 새로운 전설을 새겼다.",
    "생사경": "천마를 쓰러뜨린 그 순간, 마침내 생사의 경계를 넘어섰다. 전설이 되었다.",
}

# 승리 엔딩의 맺음말 (가장 강한 성향 기준)
EPILOGUE = {
    "정도": "사람들은 그를 맹주로 추대하려 했지만, 그는 낙양의 무너진 성벽을 고치러 떠났다.",
    "사도": "천마가 사라진 강호의 돈줄은 어느새 모두 한 사람에게로 흘렀다. 아무도 그의 진짜 이름을 몰랐다.",
    "마도": "천마봉의 빈자리에 새로운 그림자가 앉았다. 강호는 환호했고, 곧 그 환호를 후회했다.",
    None:   "그는 어느 깃발도 들지 않은 채 강호를 떠났다. 다리 위에서 그를 봤다는 사람만 드물게 있었다.",
}

FLAG_EPILOGUE = [
    ("찬탈", "「내가 다음 천마다.」 그 말은 끝내 사실이 되었다."),
    ("단목휘_동맹", "천마봉을 내려오는 길, 단목휘가 말했다. \"다리 값은 이걸로 퉁칩시다.\" 그는 여전히 웃고 있었다."),
    ("단목휘_죽음", "돌다리를 건널 때마다 그는 걸음을 멈추곤 했다."),
    ("청운장소년", "청운장에서 살아남은 소년은 훗날 무림맹의 검이 되어 찾아와 깊이 절했다."),
    ("노인_검결", "산중 초막은 비어 있었다. 장작만이 석 달 치 쌓여 있었다."),
    ("가문재건", "다시 세운 사당에 창궁의 깃발이 올랐다."),
    ("가문복수", "붉은 표식의 주인들은 하나씩 사라졌다. 사당은 끝내 다시 세워지지 않았다."),
    ("권마의유언", "동굴의 백골 앞에 천마의 부러진 검이 놓였다. 값은 치러졌다."),
]


def judge_ending(player, final_battle_victory, forced=None):
    """
    최종전(천마) 종료 또는 사망 시 호출.
    forced: 이벤트가 정한 엔딩 키 (없으면 조건으로 판정)
    반환: (ending_key, karma_gained, text)
    """
    if forced:
        ending = forced
    elif not final_battle_victory or player.hp <= 0:
        ending = "사망"
    elif check_saengsa(player):
        ending = "생사경"
    elif check_good_ending(player):
        ending = "기본"
    else:
        ending = "배드"

    return ending, KARMA_REWARD[ending], ENDING_TEXT[ending]


def build_epilogue(player, ending):
    """엔딩 화면 아래에 붙는 맺음말 문장 목록."""
    if ending not in ("기본", "생사경", "배드"):
        return []
    lines = [EPILOGUE[player.dominant_alignment()]]
    lines += [text for flag, text in FLAG_EPILOGUE if player.has_flag(flag)]
    return lines


def run_summary(player, ending):
    """회차 기록에 남길 요약."""
    return {
        "ending": ending,
        "origin": player.origin,
        "realm": player.realm,
        "turn": min(player.turn, player.max_turn),
        "kills": player.kills,
        "title": title(player.alignment),
    }
