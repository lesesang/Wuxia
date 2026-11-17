import os
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),"..",".."))
import json
S=json.load(open(os.path.join(ROOT,'www','data','skills.json')))
seen={}
for k,s in S.items():
    if not s.get('gimmick') or s['grade'] not in('명품','상승','일절','신공'): continue
    sig=(s.get('category') or s['type'])+':'+','.join(sorted(x for x in s['gimmick'] if x not in('name','text')))
    seen.setdefault(sig,[]).append(k)
for sig,ks in seen.items():
    if len(ks)>1: print(sig,ks)
