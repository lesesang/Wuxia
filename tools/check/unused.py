# 자바스크립트에서 가져오기만 하고 쓰지 않는 이름을 찾는다. 없으면 "깨끗"을 찍는다.
#   python3 tools/check/unused.py
import os
os.chdir(os.path.abspath(os.path.join(os.path.dirname(__file__),"..","..")))
import re,sys,glob
found=0
for fn in sorted(glob.glob('www/js/*.js')+glob.glob('tools/*.js')+glob.glob('tests/*.js')):
    s=open(fn).read()
    for m in re.finditer(r'import\s*\{([^}]*)\}\s*from\s*"([^"]+)"',s):
        for name in [n.strip().split(' as ')[-1].strip() for n in m.group(1).split(',') if n.strip()]:
            rest=s[:m.start()]+s[m.end():]
            if not re.search(r'(?<![\w$])(?<![\w$)\]]\.)'+re.escape(name)+r'(?![\w$])',rest): print(fn,name,'<-',m.group(2)); found+=1
if not found: print('깨끗')
