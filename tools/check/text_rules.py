# 화면 문장의 규칙과 세계관의 이름을 훑는다. 걸린 것이 없으면 "깨끗"을 찍는다.
#   python3 tools/check/text_rules.py [보여 줄 개수]
# 장식 부호와 이모티콘, 대사 밖의 느낌표, 현대어와 게임 용어, 플레이어의 병기를 칼이나 검으로 단정하는 말,
# 다른 사람이 같은 이름을 쓰는 곳, 길에서 나오는 적의 이름을 사건 인물이 그대로 쓰는 곳을 찾는다.
import collections, glob, json, os, re, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
D = os.path.join(ROOT, "www", "data")
SHOW = int(sys.argv[1]) if len(sys.argv) > 1 else 8
NOT_TEXT = {"key", "type", "kind", "slot", "stat", "trigger", "what", "tag", "flag", "flags", "lose_flags", "not_flag", "any_flag", "battle",
            "requires", "origin", "sect", "school", "lineage", "category", "grade", "realm", "tier", "side", "faction", "next", "ending",
            "skill", "item", "equip", "consume_item", "skip", "shun", "chapters", "order", "side_order", "unlocked", "after", "not_origin", "not_sect"}
found = collections.defaultdict(list)

def texts():
    for path in sorted(glob.glob(os.path.join(D, "*.json"))):
        name = os.path.basename(path)[:-5]
        if name == "art": continue
        def walk(o, where):
            if isinstance(o, dict):
                for k, v in o.items():
                    if k not in NOT_TEXT: yield from walk(v, f"{where}/{k}")
            elif isinstance(o, list):
                for i, v in enumerate(o): yield from walk(v, f"{where}[{i}]")
            elif isinstance(o, str) and re.search("[가-힣]", o):
                yield name + where, o
        yield from walk(json.load(open(path, encoding="utf-8")), ":")

MODERN = r"(?<![가-힣])(스트레스|오케이|레벨|스킬|퀘스트|아이템|버프|너프|보스|미션|타겟|포인트|에너지|파워|체크|리셋|팀|게임|시스템|데미지|콤보|이벤트|플레이어|캐릭터|유저)(?=$|[^가-힣]|이|가|을|를|은|는|의|에|로|으로|과|와|도|만)"
# 내 병기를 칼이나 검으로 단정하는 말. 다른 사람의 칼은 괜찮다
MY_BLADE = r"(?<![가-힣])(내 검(?![은을이]? ?(패|술))|내 칼(?!자국)|내가 뽑은 검)"
for where, t in texts():
    if re.search(r"[「」『』·—–…]", t): found["장식 부호"].append((where, t))
    if re.search(r"[\U0001F300-\U0001FAFF☀-⛿✀-➿]", t): found["이모티콘"].append((where, t))
    if "!" in re.sub(r'"[^"]*"', "", t): found["대사 밖의 느낌표"].append((where, t))
    if re.search(MODERN, t): found["현대어와 게임 용어"].append((where, t))
    if "부활" in t: found["부활"].append((where, t))

# 플레이어 병기 단정: 검이나 도를 쓰는 조건, 출신 조건 아래는 뺀다
def events():
    for path in glob.glob(os.path.join(D, "events_*.json")):
        d = json.load(open(path, encoding="utf-8"))
        if isinstance(d.get("story"), dict): d = {**d["story"], **d["random"]}
        for k, e in d.items():
            if isinstance(e, dict): yield os.path.basename(path)[:-5], k, e
for f, k, e in events():
    def walk(o, ok):
        if isinstance(o, dict):
            r = o.get("requires") or {}
            ok = ok or r.get("main_category") in ("검법", "도법") or r.get("start_style") in ("검법", "도법") or bool(r.get("origin"))
            for kk, v in o.items():
                if kk != "requires": walk(v, ok)
        elif isinstance(o, list):
            for v in o: walk(v, ok)
        elif isinstance(o, str) and not ok and re.search(MY_BLADE, re.sub(r'"[^"]*"', "", o)):
            found["내 병기를 칼이나 검으로 단정"].append((f"{f}:{k}", o))
    walk(e, bool((e.get("requires") or {}).get("origin")))

# 이름: 별호 다음의 이름이 같은데 별호가 다르면 다른 사람일 수 있다. 같은 사람을 다르게 부르는 짝은 SAME에 둔다
SAME = {"갈충", "당한", "법해", "혜명", "사갈", "오문", "귀호"}
enemies = json.load(open(os.path.join(D, "enemies.json"), encoding="utf-8"))
names = {v["name"] for v in enemies.values()}
foes = []
for f, k, e in events():
    def walk(o, guarded):
        if isinstance(o, dict):
            guarded = guarded or bool((o.get("requires") or {}).get("not_slain"))
            eff = o.get("effects") if isinstance(o.get("effects"), dict) else {}
            if isinstance(eff.get("foe"), str): foes.append((f"{f}:{k}", eff["foe"], guarded))
            for v in o.values(): walk(v, guarded)
        elif isinstance(o, list):
            for v in o: walk(v, guarded)
    walk(e, False)
by = collections.defaultdict(set)
for n in names | {x for _, x, _ in foes}:
    w = n.split()
    if len(w) >= 2 and re.fullmatch("[가-힣]{2,3}", w[-1]) and re.fullmatch("[가-힣]{2,4}", w[-2]): by[w[-1]].add(" ".join(w[-2:]))
GENERIC = {"두목", "호위", "무리", "왈패", "자객", "대장", "무사", "무인", "사내", "도적", "산적", "협객", "낭인", "도사", "혈승", "척살조", "호교대", "그림자", "칼잡이", "패거리", "사냥꾼", "표사", "표두", "도둑", "사기꾼", "졸개들", "겁화대", "적수대", "순찰조", "연락책", "복면인", "척후조", "흑기대", "혈계승", "탁발승", "고수", "설표", "호랑이", "왕지네", "표적", "진인", "사태", "백호"}
for given, fulls in sorted(by.items()):
    if len(fulls) > 1 and given not in SAME and given not in GENERIC:
        found["같은 이름을 다른 사람이 씀"].append((given, ", ".join(sorted(fulls))))
roaming = {v["name"] for v in enemies.values() if v.get("weight", 0) > 0}
for where, foe, guarded in foes:
    if foe in roaming and not guarded: found["길의 적 이름을 사건 인물이 씀"].append((where, foe))

if not found: print("깨끗")
for k, v in found.items():
    print(f"== {k} ({len(v)})")
    for where, t in v[:SHOW]: print("  ", where[:60], "|", t[:100])
