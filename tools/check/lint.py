# 화면 문장의 자리표시, 조사, 경지의 기운, 낱말 겹침 같은 것을 훑는다. 걸린 것이 없으면 "깨끗"을 찍는다.
#   python3 tools/check/lint.py [찾을 갈래] [보여 줄 개수]
import os
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),"..",".."))
import json,glob,re,sys,collections
D=os.path.join(ROOT,'www','data','')
TEXT_KEYS={'text','title','label','desc','name','intro','outro','spar_outro','foe_line','returned','goal','goal_short','note','line','rise','lead_text'}
js=open(os.path.join(ROOT,'www','js','rules.js')).read()
m=re.search(r'PERSON_WORDS\s*=\s*\{(.*?)\};',js,re.S)
# 자리표시마다 실제로 들어갈 수 있는 말(남성, 여성). 이름처럼 미리 알 수 없는 말은 None
OUTS={k:[a,b] for k,a,b in re.findall(r'([가-힣]+):\s*\["([^"]+)",\s*"([^"]+)"\]',m.group(1))}
OUTS.update({'성':None,'이름':None,'성명':None,'별호':None,'별호들':None,'유산':None,'사문':['사문','가문'],
             '성대협':['대협','여협'],'성소협':['소협','소저']})
AURA=json.load(open(os.path.join(ROOT,'www','data','realms.json')))['aura']
OUTS['기']=[v[0] for v in AURA.values()]; OUTS['강']=[v[1] for v in AURA.values()]; OUTS['기상인']=[v[2] for v in AURA.values()]
def tail(w):
    c=ord(w[-1])-0xAC00
    if not 0<=c<11172: return 'x'
    j=c%28
    return 'ㄹ' if j==8 else ('o' if j else '-')
def fixed_tail(ph):
    outs=OUTS.get(ph)
    return outs is not None and len({tail(o) for o in outs})==1
finds=collections.defaultdict(list)
# 화면에 나오지 않는 이름표(깃발, 키, 조건의 목록)는 문장으로 보지 않는다
NOT_TEXT={'flags','lose_flags','not_flag','any_flag','flag_any','skip','shun','not_origin','not_sect','sect_any','traits','dominant_in','not_dominant',
          'keys','order','side_order','tags','chapters','unlocked','requires','origin','sect','items','skills','gear','enemies','foes','allies_keys','content','upgrades'}
def walk(o,path,f,parent=None):
    if isinstance(o,dict):
        for k,v in o.items():
            if k in NOT_TEXT: continue
            if isinstance(v,str) and (k in TEXT_KEYS or k in('foe',)): check(v,path+'/'+k,f)
            else: walk(v,path+'/'+str(k),f,k)
    elif isinstance(o,list):
        for i,v in enumerate(o):
            if isinstance(v,str): check(v,path+f'[{i}]',f)
            else: walk(v,path+f'[{i}]',f,parent)
BAD=set('·—–「」『』…~♪★☆※◆◇■□▶▷◀◁♥♡《》')
def check(s,path,f):
    loc=f+path
    for ch in s:
        if ch in BAD: finds['부호 '+ch].append((loc,s[:80])); break
        if ord(ch)>0x1F000: finds['이모티콘'].append((loc,s[:80])); break
    if re.search(r'[A-Za-z]{2,}',s): finds['영문'].append((loc,s[:80]))
    for w in ['부활','전생','환생','회차','윤회','소교주','전대 천마','전대천마','첫 천마','천마의 아들','천마의 딸','후계자','레벨','스킬','버프','보스','스탯','HP','아이템','퀘스트','마단','약물']:
        if w in s.replace('혈마단',''): finds['금칙어 '+w].append((loc,s[:90]))  # 혈마단은 장터의 금단 이름
    for ph in re.findall(r'〈([^〉]*)〉',s):
        base=ph.split(':')[0]
        if base not in OUTS: finds['모르는 자리표시 '+base].append((loc,s[:80]))
    # 받침이 말마다 달라지는 자리표시 뒤에 조사를 바로 붙이면 틀릴 수 있다. 〈이름:이/가〉처럼 쓴다
    for ph in re.findall(r'〈([^〉:]+)〉(?:은|는|이|가|을|를|과|와|으로|로|아|야)(?=[ ,.\"\'?]|$)',s):
        if not fixed_tail(ph): finds['조사 직접'].append((loc,s[:90]))
    if s.count('"')%2: finds['따옴표 홀수'].append((loc,s[:90]))
    if '  ' in s: finds['두 칸 띄움'].append((loc,s[:80]))
    if re.search(r'[가-힣]\.[가-힣]',s): finds['마침표 뒤 붙음'].append((loc,s[:80]))
    if re.search(r'\s[,.]',s): finds['부호 앞 공백'].append((loc,s[:80]))
    if '　' in s or '\t' in s: finds['이상한 공백'].append((loc,s[:80]))
    if re.search(r'(을를|은는|와과)(?=[ ,.\"]|$)',s): finds['조사 겹침'].append((loc,s[:80]))
    for m2 in re.finditer(r'(?:(?<=\s)|^)([가-힣]{2,}) \1(?=[ ,.\"]|$)',s):
        w=m2.group(1)
        if w.endswith(('도','고','며','면','씩')) or w in('하나','둘','셋','한번','어서','천천히'): continue
        finds['낱말 겹침'].append((loc,m2.group(0)+' | '+s[:60]))
for f in sorted(glob.glob(D+'*.json')):
    walk(json.load(open(f)),'',f.split('/')[-1][:-5]+':')
only=sys.argv[1] if len(sys.argv)>1 else None
if not any(v for k,v in finds.items() if not only or only in k): print('깨끗')
for k,v in sorted(finds.items()):
    if only and only not in k: continue
    print(f'== {k} ({len(v)})')
    for loc,s in v[:int(sys.argv[2]) if len(sys.argv)>2 else 6]: print('  ',loc[:70],'|',s)
