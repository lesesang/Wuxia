import json
STORY={}; RANDOM={}; ENDINGS={}; ENEMIES={}
def O(text, req=None, lead=False, **eff):
    o={"text":text,"effects":eff}
    if req: o["requires"]=req
    if lead: o["lead"]=True
    return o
def C(label, *outs, req=None, hidden=False):
    c={"label":label,"outcomes":list(outs)}
    if req: c["requires"]=req
    if hidden: c["hidden"]=True
    return c
def story(key, origin, turn, title, text, choices, parts=None, variants=None):
    e={"kind":"story","turn":turn,"title":title,"requires":{"origin":origin},"text":text,"choices":choices}
    if parts: e["parts"]=parts
    if variants: e["variants"]=variants
    STORY[key]=e
def part(text, choices): return {"text":text,"choices":choices}
def rnd(key, chapters, title, text, choices, origin=None, req=None, variants=None, reacts=None, parts=None):
    e={"chapters":chapters,"title":title,"text":text,"choices":choices}
    r=dict(req or {})
    if origin: r["origin"]=origin
    if r: e["requires"]=r
    if variants: e["variants"]=variants
    if reacts: e["reacts"]=reacts
    if parts: e["parts"]=parts
    RANDOM[key]=e
def ending(key, origin, title, seal, karma, text, frames):
    ENDINGS[key]=dict(origin=origin,title=title,seal=seal,karma=karma,text=text,frames=frames)
def F(*rows):
    "한 묶음: (조건, 문장) 여럿. 조건이 맞는 첫 문장을 쓴다"
    return [{"requires":r,"text":t} for r,t in rows]
def enemy(key, base, **kw):
    ENEMIES[key]=(base,kw)
AL=lambda **k: {{"j":"정도","s":"사도","m":"마도"}[a]:v for a,v in k.items()}
MANOR={}; HOOKS=[]
def manor(key, chapters, need, title, text, choices, variants=None, parts=None):
    e={"chapters":chapters,"title":title,"requires":{"manor":need},"text":text,"choices":choices}
    if variants: e["variants"]=variants
    if parts: e["parts"]=parts
    MANOR[key]=e
def hook(file, key, choice): HOOKS.append((file,key,choice))
TRAITS={}; UPGRADES={}; MARKET={}
def relic(key, origin, style, desc, bonus, g, text, slot="weapon", category="무기", name=None):
    "출신 인연으로 얻는 전용 신물. 장터와 드롭에 나오지 않는다"
    g=dict(g); g["text"]=text
    eff={"type":"equip","slot":slot,"bonus":bonus}
    if style: eff["style"]=style
    MARKET[key]={"name":name or key,"category":category,"price":0,"markets":[],"desc":desc,"effects":[eff],"grade":"신물","gimmick":g,"origin":origin,"no_drop":True}
def trait(key, origin, name, desc, *eff): TRAITS[key]={"name":name,"desc":desc,"rarity":"희귀","cost":7,"effects":list(eff),"origin":origin}
def upgrade(key, origin, name, desc, *eff): UPGRADES[key]={"group":"출신 전용","name":name,"desc":desc,"costs":[10,20,30],"effects":list(eff),"origin":origin}
T=lambda t,**k: {"type":t,**k}

REACTS=[]
def react(file, key, req, text): REACTS.append((file,key,{"requires":req,"text":text}))
