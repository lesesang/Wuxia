import os
os.chdir(os.path.abspath(os.path.join(os.path.dirname(__file__),"..","..")))
import json,glob,re
src=open('www/js/rules.js').read()
pw=dict(re.findall(r'(\S+?): \["([^"]+)", "([^"]+)"\]',src.split('const PERSON_WORDS = {')[1].split('};')[0]) and [])
words={}
for m in re.finditer(r'([가-힣]+): \["([^"]+)", "([^"]+)"\]',src.split('const PERSON_WORDS = {')[1].split('};')[0]):
  words[m.group(1)]=(m.group(2),m.group(3))
words['성대협']=('X 대협','X 여협'); words['성소협']=('X 소협','X 소저')
def jong(w):
  c=ord(w[-1])-0xAC00
  if not 0<=c<11172: return None
  return c%28
def cls(w,p):
  j=jong(w)
  if p in('으로','로'): return 'R' if j in (0,8) else 'E'
  return 'J' if j else 'N'
VAR={'이름','성명','성'}
out=[]
for f in glob.glob('www/data/*.json'):
  s=open(f).read()
  for m in re.finditer(r'〈([^〉:]+)〉(은|는|이|가|을|를|과|와|으로|로|아|야|이여|이라|라)(?![가-힣])',s):
    w,p=m.group(1),m.group(2)
    if w in VAR: out.append((f,w,p,s[m.start()-30:m.end()+10])); continue
    if w in words:
      a,b=words[w]
      if cls(a,p)!=cls(b,p) or cls(a,p)!=('J' if p in('은','이','을','과','아','이여','이라') else 'N' if p in('는','가','를','와','야','라') else cls(a,p)):
        out.append((f,w,p,s[m.start()-30:m.end()+10]))
for o in out: print(o[0].split('/')[-1],o[1],o[2],repr(o[3]))
print(len(out))
