import re,subprocess,sys,shlex
# drive.py 스크립트 출신 접미 남시드들 녀시드들
src,who,suf=sys.argv[1:4]; ms=sys.argv[4].split(','); fs=sys.argv[5].split(',')
s=open(src).read()
S=re.search(r'^S="(.*)"$',s,re.M).group(1); X=re.search(r'^X="(.*)"$',s,re.M).group(1)
m=re.search(r'^g '+who+r' (.*?)(?=\ng |\Z)',s,re.M|re.S).group(1)
a=shlex.split(m.replace('\\\n',' '))
bg,male,fem,common,extra=a
mp="1boy, solo, wuxia protagonist, handsome, sharp facial features, heroic, charismatic, dignified posture, "+male+", "+common
fp="1girl, solo, wuxia protagonist, beautiful, elegant facial features, heroic, charismatic, dignified posture, "+fem+", "+common
for sd in ms: subprocess.run(["python3","-I","gen2.py",f"{who}{suf}_남_{sd}",sd,S,mp,bg,X+", "+extra])
for sd in fs: subprocess.run(["python3","-I","gen2.py",f"{who}{suf}_녀_{sd}",sd,S,fp,bg,X+", "+extra])
