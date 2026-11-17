import os
os.chdir(os.path.abspath(os.path.join(os.path.dirname(__file__),"..","..")))
import re,sys,glob
for fn in sorted(glob.glob('www/js/*.js')+glob.glob('tools/*.js')+glob.glob('tests/*.js')):
    s=open(fn).read()
    for m in re.finditer(r'import\s*\{([^}]*)\}\s*from\s*"([^"]+)"',s):
        for name in [n.strip().split(' as ')[-1].strip() for n in m.group(1).split(',') if n.strip()]:
            rest=s[:m.start()]+s[m.end():]
            if not re.search(r'(?<![\w$])(?<![\w$)\]]\.)'+re.escape(name)+r'(?![\w$])',rest): print(fn,name,'<-',m.group(2))
