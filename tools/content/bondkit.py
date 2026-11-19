# 외전 출신의 인연 두 갈래(전용 병기, 사람과 사연)와 전용 사건을 짧게 적는 도구
from dsl import *
from side import *
import s9

def chain2(o, key, name, desc, first, second, cost=8):
    """두 편짜리 인연. first, second는 (제목, 글, 선택지, 덧붙일 것).
    첫 편의 모든 결과가 다음 편으로 이어지는 진행 표시(key+'_1')를 세운다."""
    _fresh(key + "_1"); _fresh(key + "_2")
    bond(key, o, name, desc, cost)
    t1, x1, c1, extra1 = (first + ({},))[:4]
    for c in c1:
        for out in c["outcomes"]:
            out["effects"].setdefault("flags", []).append(key + "_1")
    rnd(key + "_1", [2, 3], t1, x1, c1, origin=o, req={"unlocked": key}, **extra1)
    t2, x2, c2, extra2 = (second + ({},))[:4]
    rnd(key + "_2", [3, 4], t2, x2, c2, origin=o, req={"unlocked": key, "flag": key + "_1"}, **extra2)

def _fresh(key):
    assert key not in RANDOM and key not in STORY, ("사건 키 겹침", key)

def ex(o, key, chapters, title, text, choices, **kw):
    "출신 전용 사건"
    _fresh(key)
    rnd(key, chapters, title, text, choices, origin=o, **kw)

# 사람과 사연 인연의 끝 보상: 크게 자라고, 그 이야기의 마지막 상대를 미리 흔들어 둔다
def END(**stats): return dict(full_growth=True, final_weaken=12, stats=stats)
