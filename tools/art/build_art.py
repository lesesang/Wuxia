# art/의 그림을 게임용으로 줄여 www/img에 두고, 어떤 화면에 어떤 그림을 쓸지 www/data/art.json에 적는다.
#   python3 tools/art/build_art.py
# 그림을 더하거나 바꾼 뒤 다시 돌리고, node tools/build_asset_list.js로 오프라인 목록도 맞춘다.
import json, os, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ART = os.path.join(ROOT, "art")
WWW = os.path.join(ROOT, "www")
DATA = os.path.join(WWW, "data")

# (원본 폴더, 게임 폴더, 가로 크기, 품질)
SIZES = [("초상", "p", 480, 80), ("조연", "c", 400, 78), ("배경", "b", 960, 76)]


def shrink():
    for src, dst, width, quality in SIZES:
        out = os.path.join(WWW, "img", dst)
        os.makedirs(out, exist_ok=True)
        keep = set()
        for name in sorted(os.listdir(os.path.join(ART, src))):
            if not name.endswith(".webp"):
                continue
            keep.add(name)
            target = os.path.join(out, name)
            source = os.path.join(ART, src, name)
            if os.path.exists(target) and os.path.getmtime(target) >= os.path.getmtime(source):
                continue
            im = Image.open(source).convert("RGB")
            im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
            im.save(target, quality=quality, method=6)
        for name in os.listdir(out):
            if name not in keep:
                os.remove(os.path.join(out, name))


def have(folder, key):
    return os.path.exists(os.path.join(WWW, "img", folder, f"{key}.webp"))


# 적 데이터에 둘 있는 같은 사람, 주요 인물로 그린 적
ENEMY_ALIAS = {
    "잠화원로": "c/잠화무인",
    "외전_반량": "c/혈교우호법", "외전_염철": "c/화경마인", "외전_하란": "c/북해고수", "외전_적운": "c/곤륜역도",
    "외전_무령": "c/귀문술사", "외전_사마주결산": "c/외전_사마주", "호적수": "c/위무결", "단목휘": "c/연무휘",
    "은호": "c/은비", "천마": "p/천마", "혈마": "p/혈마", "무영": "p/무영", "십이마장천면": "p/환면마후",
    "십이마장쇄혼": "p/쇄혼도위극", "외전_위극": "p/쇄혼도위극", "혈불사도명": "p/혈불사도명", "무림맹주": "p/무림맹주",
    "외전_백송": "p/매화노검",
}
COMPANION = {"혈마": "p/혈마", "은비_약조": "c/은비"}

# 사건 글에 이름이 나오면 그 사람의 그림을 곁에 둔다. 앞에 있는 것이 먼저다
NPC = [
    ("천마", "p/천마", "t"), ("혈마", "p/혈마", "t"), ("혈불", "p/혈불사도명"), ("사도명", "p/혈불사도명"), ("하후창", "p/무림맹주"),
    ("맹주", "p/무림맹주", "t"), ("공손야", "p/공손야"), ("무면객", "p/무면객"), ("노구산", "p/노구산"), ("백송", "p/매화노검"),
    ("매화노검", "p/매화노검"), ("환면마후", "p/환면마후"), ("위극", "p/쇄혼도위극"), ("무영", "p/무영"),
    ("각명", "c/각명대사"), ("청허진인", "c/청허진인"), ("운암자", "c/운암자"), ("정연사태", "c/정연사태"), ("청송자", "c/청송자"),
    ("당천기", "c/당천기"), ("모용진", "c/모용진"), ("제갈현", "c/제갈현"), ("설란", "c/설란"), ("빙백검후", "c/설란"),
    ("위숙", "c/위숙"), ("붉은 옷의 여인", "c/붉은옷여인"), ("붉은 옷 여인", "c/붉은옷여인"), ("신교 사자", "c/신교사자"),
    ("수상한 누군가", "c/수상한누군가"), ("소낭", "c/하오문주"), ("위무결", "c/위무결"), ("소연화", "c/소연화"),
    ("석대우", "c/석대우"), ("묘아", "c/묘아"), ("무애", "c/무애"), ("장칠", "c/장칠"), ("적연", "c/적연"),
    ("연무휘", "c/연무휘"), ("왕백로", "c/왕백로"), ("은비", "c/은비"), ("설백", "c/설백"), ("엄대웅", "c/외전_엄대웅"),
    ("점소이", "c/점소이"), ("객잔 주인", "c/객잔주인"), ("대장장이", "c/대장장이"), ("촌장", "c/촌장"), ("포두", "c/포두"),
    ("집사", "c/장원집사"), ("기녀", "c/기녀"),
    # 외전 출신의 인연과 사건에 나오는 사람
    ("정소월", "c/사_정소월"), ("곡 노인", "c/사_곡노인"), ("연서", "c/사_연서"), ("추삼낭", "c/사_추삼낭"), ("노 영감", "c/사_노영감"),
    ("홍란", "c/사_홍란"), ("보장 백구", "c/사_백구"), ("백구가", "c/사_백구"), ("모용청", "c/사_모용청"), ("엄소정", "c/사_엄소정"),
    ("늙은 판지기", "c/사_판지기"), ("당연화", "c/사_당연화"), ("아미란", "c/사_아미란"), ("운설", "c/사_운설"), ("늙은 십장", "c/사_십장"),
    ("아쿤", "c/사_아쿤"), ("방노삼", "c/외전_방노삼"), ("구참", "c/외전_구참"), ("하란", "c/북해고수"),
]

# 사건의 제목과 글에 나오는 말로 배경을 고른다. 앞에 있는 것이 먼저다
SCENE = [
    (["천마봉 정상", "옥좌", "결전"], "천마봉_정상"), (["천마봉"], "천마봉"), (["피 연못", "피연못", "혈지"], "피연못"),
    (["겁화전", "화로"], "겁화전"), (["흑수동"], "흑수동"), (["검사관", "검문"], "검문소"), (["봉마진"], "봉마진"),
    (["비동", "석실", "폐관"], "비동"), (["낙양"], "낙양_불"), (["정마대전", "전장", "싸움터"], "정마대전"),
    (["청운장"], "청운장"), (["분타"], "신교분타"), (["혈교", "잿빛 가사", "혈승"], "혈교산사"),
    (["비무대", "비무 대회", "비무대회", "태산"], "태산_비무대"), (["무림맹", "맹의 회의", "맹 본청"], "무림맹_본청"),
    (["장경각"], "장경각"), (["무승원"], "무승원"), (["소림"], "소림사"), (["무당"], "무당산"), (["화산"], "화산"),
    (["아미", "금정"], "아미금정"), (["곤륜"], "곤륜설산"), (["종남"], "종남산"), (["점창", "창산"], "점창산"),
    (["청성"], "청성산"), (["공동"], "공동산"), (["당가"], "당가"), (["모용"], "모용세가"), (["천기각"], "천기각"),
    (["제갈"], "제갈세가"), (["남궁"], "남궁폐허"), (["팽가"], "팽가폐허"), (["개방", "거지"], "개방총타"),
    (["사도련"], "사도련본단"), (["살막"], "살막"), (["귀문"], "귀문교"), (["북해", "빙궁"], "북해빙궁"),
    (["빙원"], "빙원"), (["남만", "야수궁", "밀림"], "남만밀림"), (["서역", "사막", "모래바람"], "서역길"),
    (["초원"], "초원"), (["산해관"], "산해관"), (["황하"], "황하나루"), (["위소", "성벽"], "위소성벽"),
    (["해적", "흑조단"], "해적선"), (["수채", "수로채", "수적"], "수채"), (["은광", "갱도", "폐광"], "폐광"),
    (["경매"], "경매장"), (["혼례", "혼담"], "혼례장"), (["형장", "망나니"], "형장"), (["장강"], "장강"),
    (["나루", "뱃사공", "사공"], "나루"), (["녹림", "산채", "산적"], "녹림산채"), (["표국", "표사", "표물", "표행"], "표국"),
    (["관아", "포도", "포졸"], "관아"), (["기루", "기녀"], "기루"), (["하오문", "뒷골목", "골목"], "하오문_골목"),
    (["다리 밑"], "다리밑"), (["주루"], "주루"), (["객잔", "점소이"], "객잔"), (["장터", "시장", "저잣거리"], "장터"),
    (["약방", "의원", "약초"], "약방"), (["서고", "서책"], "서고"), (["장원"], "장원"), (["연무장"], "연무장"),
    (["무덤", "장례", "봉분"], "무덤"), (["대나무", "대숲", "죽림"], "대나무숲"), (["설산", "눈보라"], "설산고개"),
    (["정자", "호숫가"], "정자"), (["고갯길", "산길"], "고갯길"), (["일출", "산정"], "산정_일출"),
]
ACTION = {"수련": "연무장", "명상": "비동", "휴식": "약방", "탐색": "고갯길"}
CHAPTER = {"1": "고갯길", "2": "장터", "3": "청운장", "4": "정마대전", "5": "천마봉"}


def main():
    shrink()
    enemies = json.load(open(os.path.join(DATA, "enemies.json"), encoding="utf-8"))
    companions = json.load(open(os.path.join(DATA, "companions.json"), encoding="utf-8"))
    enemy = {}
    for key in enemies:
        if key in ENEMY_ALIAS:
            enemy[key] = ENEMY_ALIAS[key]
        elif have("c", key):
            enemy[key] = f"c/{key}"
        else:
            sys.exit(f"적 {key}의 그림이 없습니다")
    foes = json.load(open(os.path.join(ROOT, "tools", "art", "foe_names.json"), encoding="utf-8"))
    foe = {name: f"c/{key}" for name, key in foes.items()}
    for path in foe.values():
        assert have("c", path[2:]), path
    companion = {key: COMPANION.get(key) or f"c/{key}" for key in companions}
    for path in list(companion.values()) + [n[1] for n in NPC] + list(enemy.values()):
        assert have(path[0], path[2:]), path
    scenes = [[words, name] for words, name in SCENE]
    for _, name in scenes:
        assert have("b", name), name
    out = {
        "enemy": enemy, "foe": foe, "companion": companion, "npc": NPC, "scene": scenes,
        "action": ACTION, "chapter": CHAPTER,
    }
    with open(os.path.join(DATA, "art.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print("그림", sum(len(os.listdir(os.path.join(WWW, "img", d))) for _, d, _, _ in SIZES), "장, 적", len(enemy), "사건 상대", len(foe))


if __name__ == "__main__":
    main()
