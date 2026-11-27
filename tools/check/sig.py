# 명품 이상 무공의 묘리가 같은 계열 안에서 겹치는지 본다(효과의 짝이 똑같은 무공끼리). 겹침이 없으면 "깨끗"을 찍는다.
#   python3 tools/check/sig.py
import os
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),"..",".."))
import json
S=json.load(open(os.path.join(ROOT,'www','data','skills.json')))
seen={}
for k,s in S.items():
    if not s.get('gimmick') or s['grade'] not in('명품','상승','일절','신공'): continue
    sig=(s.get('category') or s['type'])+':'+','.join(sorted(x for x in s['gimmick'] if x not in('name','text')))
    seen.setdefault(sig,[]).append(k)
dup=[(sig,ks) for sig,ks in seen.items() if len(ks)>1]
for sig,ks in dup: print(sig,ks)
if not dup: print('깨끗')
