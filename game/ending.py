"""
엔딩 시스템 (계획서 §28)

최종전(천마와의 결전)을 거친 뒤 호출되어 엔딩을 판정한다.

판정 우선순위:
    사망 → 생사경 → 기본 엔딩 → 배드 엔딩

각 엔딩은 카르마(구 전설 포인트) 보상을 가지며,
카르마는 회차를 넘어 유지되는 메타 재화다 (game/karma.py 참고).
"""

from game.realm import check_saengsa, check_good_ending

# 엔딩별 카르마 보상 (임시 수치)
KARMA_REWARD = {
    "사망":   1,
    "배드":   3,
    "기본":   5,
    "생사경": 10,
}

ENDING_TEXT = {
    "사망":   "강호의 한 줄기 바람이 되어 사라졌다. 그의 이야기는 여기서 끝난다.",
    "배드":   "천마를 쓰러뜨렸으나, 그 대가로 몸과 마음이 크게 상했다. 불완전한 승리였다.",
    "기본":   "천마를 쓰러뜨리고 강호에 새로운 전설을 새겼다.",
    "생사경": "천마를 쓰러뜨린 그 순간, 마침내 생사의 경계를 넘어섰다. 전설이 되었다.",
}


def judge_ending(player, final_battle_victory):
    """
    최종전(천마) 종료 후 호출.
    final_battle_victory: 최종전 승리 여부 (False면 사망 처리)
    반환: (ending_key, karma_gained, text)
    """
    if not final_battle_victory or player.hp <= 0:
        ending = "사망"
    elif check_saengsa(player):
        ending = "생사경"
    elif check_good_ending(player):
        ending = "기본"
    else:
        ending = "배드"

    karma = KARMA_REWARD[ending]
    text = ENDING_TEXT[ending]
    return ending, karma, text
