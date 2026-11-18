import os
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),"..",".."))
import json,glob,re,sys,collections
D=os.path.join(ROOT,'www','data','')
TEXT_KEYS={'text','title','label','desc','name','intro','outro','spar_outro','foe_line','returned','goal','goal_short','note','line','rise','lead_text'}
PERSON=None
js=open(os.path.join(ROOT,'www','js','rules.js')).read()+open(os.path.join(ROOT,'www','js','josa.js')).read()
m=re.search(r'PERSON_WORDS\s*=\s*(\{.*?\}|\[.*?\]);',js,re.S)
words=set(re.findall(r'[가-힣]+',m.group(1))) if m else set()
finds=collections.defaultdict(list)
def walk(o,path,f):
    if isinstance(o,dict):
        for k,v in o.items():
            if isinstance(v,str) and (k in TEXT_KEYS or k in('foe',)): check(v,path+'/'+k,f)
            else: walk(v,path+'/'+str(k),f)
    elif isinstance(o,list):
        for i,v in enumerate(o):
            if isinstance(v,str): check(v,path+f'[{i}]',f)
            else: walk(v,path+f'[{i}]',f)
BAD=set('·—–「」『』…~♪★☆※◆◇■□▶▷◀◁♥♡《》')
def check(s,path,f):
    loc=f+path
    for ch in s:
        if ch in BAD: finds['부호 '+ch].append((loc,s[:80])); break
        if ord(ch)>0x1F000: finds['이모티콘'].append((loc,s[:80])); break
    if re.search(r'[A-Za-z]{2,}',s): finds['영문'].append((loc,s[:80]))
    for w in ['부활','전생','환생','회차','윤회','소교주','전대 천마','전대천마','첫 천마','천마의 아들','천마의 딸','후계자','레벨','스킬','버프','보스','스탯','HP','아이템','퀘스트','마단','약물']:
        if w in s: finds['금칙어 '+w].append((loc,s[:90]))
    for ph in re.findall(r'〈([^〉]*)〉',s):
        base=ph.split(':')[0]
        if words and base not in words: finds['자리표시 '+base].append((loc,s[:80]))
    if re.search(r'〈[^〉:]+〉(은|는|이|가|을|를|과|와|으로|로|아|야)(?=[ ,.\"]|$)',s): finds['조사 직접'].append((loc,s[:90]))
    if s.count('"')%2: finds['따옴표 홀수'].append((loc,s[:90]))
    if '  ' in s: finds['두 칸 띄움'].append((loc,s[:80]))
    if re.search(r'[가-힣]\.[가-힣]',s): finds['마침표 뒤 붙음'].append((loc,s[:80]))
    if re.search(r'\s[,.]',s): finds['부호 앞 공백'].append((loc,s[:80]))
    if '　' in s or '\t' in s: finds['이상한 공백'].append((loc,s[:80]))
    if re.search(r'(을를|이가|은는|와과)\b',s): finds['조사 겹침'].append((loc,s[:80]))
    if re.search(r'(\S+) \1 ',s) and not re.search(r'(둘|셋|하나|한|두|세|또|더|꼭|참|잘|못|안|다|늘|그) \1',s): 
        m2=re.search(r'(\S{2,}) \1 ',s)
        if m2: finds['낱말 겹침'].append((loc,m2.group(0)+' | '+s[:60]))
for f in sorted(glob.glob(D+'*.json')):
    walk(json.load(open(f)),'',f.split('/')[-1][:-5]+':')
only=sys.argv[1] if len(sys.argv)>1 else None
for k,v in sorted(finds.items()):
    if only and only not in k: continue
    print(f'== {k} ({len(v)})')
    for loc,s in v[:int(sys.argv[2]) if len(sys.argv)>2 else 6]: print('  ',loc[:70],'|',s)
