"""
성향 시스템 (정도 / 사도 / 마도)

이벤트의 선택에 따라 세 성향 수치가 쌓인다.
가장 높은 성향이 기준치 이상이면 그 길을 걷는 것으로 보고 혜택을 준다.

    정도: 시장 가격 10% 할인 (협객에게는 상인도 값을 깎아 준다)
    사도: 얻는 은자 25% 증가 (돈 냄새를 잘 맡는다)
    마도: 주는 피해 10% 증가, 회복 효율 20% 감소 (몸이 망가지는 힘)
"""

ALIGNMENTS = ["정도", "사도", "마도"]
DOMINANT_THRESHOLD = 3

JUNG_DISCOUNT = 10
SA_SILVER_BONUS = 25
MA_DAMAGE_BONUS = 10
MA_HEAL_PENALTY = 20

TITLES = {
    "정도": [(3, "협객"), (8, "대협"), (14, "무림의 기둥")],
    "사도": [(3, "뒷골목의 이름"), (8, "사도의 거물"), (14, "녹림의 그림자")],
    "마도": [(3, "마에 물든 자"), (8, "마도의 칼"), (14, "천마의 후계")],
}


def new_alignment():
    return {name: 0 for name in ALIGNMENTS}


def dominant(alignment):
    """가장 높은 성향의 이름. 기준치 미만이거나 동률이면 None."""
    top = max(ALIGNMENTS, key=lambda a: alignment.get(a, 0))
    value = alignment.get(top, 0)
    if value < DOMINANT_THRESHOLD:
        return None
    if sum(1 for a in ALIGNMENTS if alignment.get(a, 0) == value) > 1:
        return None
    return top


def title(alignment):
    """강호에서 불리는 별호."""
    top = dominant(alignment)
    if top is None:
        return "이름 없는 무인"
    name = TITLES[top][0][1]
    for threshold, candidate in TITLES[top]:
        if alignment[top] >= threshold:
            name = candidate
    return name


def benefit_text(alignment):
    top = dominant(alignment)
    if top == "정도":
        return f"시장 가격 {JUNG_DISCOUNT}% 할인"
    if top == "사도":
        return f"얻는 은자 {SA_SILVER_BONUS}% 증가"
    if top == "마도":
        return f"주는 피해 {MA_DAMAGE_BONUS}% 증가, 회복 효율 {MA_HEAL_PENALTY}% 감소"
    return "아직 어느 길에도 서지 않았다"
