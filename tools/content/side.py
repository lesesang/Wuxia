# 새 외전 출신을 한 파일에 하나씩 적기 위한 도구
# 출신, 시작 무공, 신공, 신공 인연, 깊은 강호의 문장과 길과 맺음말을 한곳에서 정한다
from dsl import *
import s7, s9

ORIGINS={}; SKILLS={}; CONTENT={}
CB={"difficulty_min":"천붕"}; H={"difficulty_min":"혈풍"}; G={"difficulty_min":"겁화"}
DEPTH={"혈풍":H,"겁화":G,"천붕":CB}

def origin(key, name, desc, stats, align, weapon, goal, goal_short, fallback, chapters, **kw):
    ext,inn,mar,mnd=stats
    o={"name":name,"skills":[],"weapon":weapon,"desc":desc,"external":ext,"internal":inn,"martial":mar,"mind":mnd,
       "alignment":align,"end_turn":120,"goal":goal,"goal_short":goal_short,"fallback_ending":fallback,
       "chapters":{str(i+1):{"title":t,"desc":d} for i,(t,d) in enumerate(chapters)},
       "key":key,"side":True,"locked":True,"cost":60}
    o.update(kw)
    ORIGINS[key]=o
    return key

def start_attack(origin, name, category, desc, forms, secret, g, text):
    g=dict(g); g["text"]=text
    SKILLS[name]={"name":name,"type":"공격무공","category":category,"grade":"상승","base_multiplier":1.5,"qi_cost":9,"desc":desc,
      "forms":forms,"secret_technique":{"name":secret,"unlock_grade":"상승","unlock_mastery":60,"multiplier":2.4,"qi_cost":50},
      "origin":origin,"gimmick":g}
    ORIGINS[origin]["skills"].append(name)
def start_mind(origin, name, desc, effect, g, text):
    g=dict(g); g["text"]=text
    SKILLS[name]={"name":name,"type":"심공","category":"심공","grade":"명품","base_multiplier":1.0,"qi_cost":0,"desc":desc,
      "effect":effect,"origin":origin,"gimmick":g}
    ORIGINS[origin]["skills"].append(name)
def start_move(origin, name, desc, effect, g, text):
    SKILLS[name]=s9.move(name, origin, desc, effect, g, text, qi=6, grade="명품")
    ORIGINS[origin]["skills"].append(name)

def top_attack(origin, *a, **k): s=s9.atk(a[0], a[1], origin, *a[2:], **k); SKILLS[s["name"]]=s; return s["name"]
def top_mind(origin, name, desc, effect, g, text): s=s9.mind(name, origin, desc, effect, g, text); SKILLS[name]=s; return name
def top_move(origin, name, desc, effect, g, text): s=s9.move(name, origin, desc, effect, g, text); SKILLS[name]=s; return name
E=s9.E; M=s9.M; V=s9.V; GATE=s9.GATE

def content(short, origin, name, desc):
    "출신의 신공 인연. 신공 세 사건의 키는 short+'_신공_'으로 시작한다"
    CONTENT[short+"신공"]={"name":name,"cost":15,"desc":desc,"origin":origin,"group":"외전 전용","side":True}

def deep_text(origin, depth, c1, c4): s7.DEEP_ORIGIN.setdefault(origin,{})[depth]={"1":c1,"4":c4}
def deeper(event, hyul, geop, cb): STORY[event]["deeper"]={"혈풍":hyul,"겁화":geop,"천붕":cb}
def deep_choice(event, depth, choice):
    ev=STORY.get(event) or RANDOM[event]
    choice["requires"]=dict(DEPTH[depth], **choice.get("requires",{})); choice["hidden"]=True
    ev["choices"].append(choice)
def deep_event(key, origin, depth, chapters, title, text, choices):
    rnd(key, chapters, title, text, choices, origin=origin, req=dict(DEPTH[depth]))
def depth_lines(ending, hyul, geop, cb):
    ENDINGS[ending]["frames"].append([{"requires":dict(CB),"text":cb},{"requires":dict(G),"text":geop},{"requires":dict(H),"text":hyul}])
def rows(origin, many, *items):
    group={"rows":[{"requires":r,"text":t} for r,t in items],"many":many}
    for key,d in ENDINGS.items():
        if d["origin"]==origin: d["frames"].append(group)
def boss_deep(key, who):
    s7.BOSS[key]={"혈풍":{"text":f"({who}의 손바닥에 붉은 인이 박혀 있다. 혈교와 피의 계를 맺었다.)","quirks":[{"type":"bloodthirst","percent":15,"name":"혈계"}]},
     "겁화":{"text":f"({who}의 정수리에 검은 불길의 흉터가 있다. 신교 장로의 곁불을 받았다.)","quirks":[{"type":"bloodthirst","percent":15,"name":"혈계"},{"type":"barrier","percent":4,"every":5,"name":"곁불의 열기"}]},
     "천붕":{"text":f"({who}의 단전께에서 이따금 검은 연기가 실처럼 샌다. 천마가 숨겨 넣은 불, 잠화를 품었다. 그 불이 맞선 자의 맥을 태운다.)","quirks":[{"type":"bloodthirst","percent":12,"name":"혈계"},{"type":"sever","percent":25,"name":"숨은 불"}]}}

# 다 갖춘 강호행이 마지막 싸움을 절반 남짓 이기도록 sidefight로 잰 뒤 맞춘 배수(체력, 위력)
FINAL_TUNE={
 "외전_구양열":(1.35,1.1),"외전_육허":(1.2,1.05),"외전_단철웅":(1.35,1.1),"외전_위소경":(1.2,1.05),
 "외전_나곤":(0.85,0.95),"외전_진무":(0.85,0.95),"외전_사마주":(1.1,1.0),"외전_적암":(1.2,1.05),
 "외전_묵현":(1.35,1.1),"외전_공야반":(0.85,0.95),"외전_적운":(1.35,1.1),"외전_갈석":(1.08,1.0),
 "외전_곽호":(1.08,1.0),"외전_위극":(1.35,1.1),"외전_석무광":(1.08,1.0),"외전_아누":(1.08,1.0),
 "외전_연비":(1.2,1.05),"외전_상관혁":(0.85,0.95),"외전_반여휴":(1.08,1.0)}
