import os
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),"..",".."))
import json, subprocess, sys
sys.path.insert(0,'.')
import dsl
for m in ['s1','s2','s3','s4','s5','s6']: __import__(m)
import s7
import s8
import s9
import s10
import s11
import s12
import side
# 새 외전 출신. 한 파일에 하나씩
NEW_SIDE=['o_sorim','o_mudang','o_ami','o_gongdong','o_moyong','o_sadoryeon','o_jegal','o_dark','o_gwimun','o_nokrim','o_heuksa','o_mangnani','o_hwasan','o_cheongseong','o_jongnam','o_singyo','o_hongsu','o_jeomchang','o_gonryun','o_gwangbu','o_sagong','o_wiso','o_dark2']
for _m in NEW_SIDE: __import__(_m)
D=os.path.join(ROOT,'www','data','')
def load(n): return json.load(open(D+n+'.json'))
def save(n,d):
    with open(D+n+'.json','w') as f: f.write(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
def orig(n): return json.loads(subprocess.check_output(['git','-C',ROOT,'show','HEAD:www/data/'+n+'.json']))
# 그 사람 본인과 맞서는 선택지는 그 사람이 살아 있을 때만 열린다
def _own(node):
    if isinstance(node,dict):
        for c in node.get('choices',[]) if isinstance(node.get('choices'),list) else []:
            for o in c.get('outcomes',[]):
                e=o.get('effects',{})
                if isinstance(e.get('battle'),str) and not e.get('foe') and not e['battle'].startswith('외전_'):
                    c.setdefault('requires',{})['not_slain']=e['battle']
        for v in node.values(): _own(v)
    elif isinstance(node,list):
        for v in node: _own(v)
_own(dsl.STORY); _own(dsl.RANDOM)
# 외전 출신의 신공 세 사건은 상점에서 그 출신의 신공 인연을 사야 찾아온다
for _k,_e in list(dsl.RANDOM.items())+list(dsl.STORY.items()):
    if '_신공_' in _k:
        _r={}
        for _a,_b in _e.get('requires',{}).items():
            if _a!='unlocked': _r[_a]=_b
        _r['unlocked']=_k.split('_신공_')[0]+'신공'
        _e['requires']=_r
save('events_side',{"story":dsl.STORY,"random":dsl.RANDOM})
# 싸움의 상대가 모두 있는 적인지 본다
def battles(o):
    if isinstance(o,dict):
        if isinstance(o.get('battle'),str): yield o['battle']
        for v in o.values(): yield from battles(v)
    elif isinstance(o,list):
        for v in o: yield from battles(v)
O=load('origins')
for k,v in side.ORIGINS.items():
    O['origins'][k]=v
    if k not in O['side_order']: O['side_order'].append(k)
for k,v in s7.DEEP_ORIGIN.items(): O['origins'][k]['deep']=v
for k in O['side_order']: O['origins'][k]['cost']=60
O['origins']['외전매화']['chapters']['2']['desc']='스승이 떠나온 산문에서 스승의 젊은 날을 듣는다.'
_h=O['origins']['외전혈승']; _h['end_turn']=120; _h['goal']='개조의 의지를 거두어 강림의 밤을 열고, 죽 한 그릇의 값을 마저 치른다'; _h['goal_short']='값을 치르는 날'; _h['chapters']['4']['desc']='빼앗긴 그릇을 되찾는 싸움. 그리고 강림의 밤.'; _h['chapters']['5']['desc']='혈마신교의 강호다. 죽 한 그릇의 값이 아직 남았다.'
for k,v in {"외전빙궁":["북해고수"],"외전매화":["십대고수"],"외전수로":["수적두목"],"외전야수":["천마사냥개","남만술사","백액호","금안조","철갑현귀","불가사리","천년백사"],"외전혈승":["마교심판자","혈교우호법"]}.items(): O['origins'][k]['shun']=v
SK=load('skills')
s9.patch_skills(SK,O)
for k,v in side.SKILLS.items():
    assert k not in SK or SK[k].get('origin')==v['origin'], '무공 이름이 겹친다: '+k
    SK[k]=v
_sig={}
for _k,_s in SK.items():
    if not _s.get('gimmick') or _s['grade'] not in ['명품','상승','일절','신공']: continue
    _g=(_s.get('category') or _s['type'])+':'+','.join(sorted(x for x in _s['gimmick'] if x not in('name','text')))
    if _g in _sig and (_k in side.SKILLS or _sig[_g] in side.SKILLS): print('묘리 겹침', _k, _sig[_g], _g)
    _sig.setdefault(_g,_k)
save('skills',SK)
save('origins',O)
# 적
E=load('enemies')
for key,(base,kw) in dsl.ENEMIES.items():
    b=E[base]
    e={k:b[k] for k in ['tier','realm','hp','attack','exp_reward','silver','armor','level','hp_style','attack_style'] if k in b}
    e.update(chapters=[],weight=0,named=True); e.update(kw)
    E[key]={ "name":e.pop('name'), **e}
for k,v in s7.BOSS.items(): E[k]['deep_quirks']=v
save('enemies',E)
for name in set(battles(dsl.STORY))|set(battles(dsl.RANDOM))|set(battles(dsl.MANOR)): assert name in E, name
# 결말
N=load('endings'); N['side']={}
for key,d in dsl.ENDINGS.items():
    N['titles'][key]=d['title']; N['seals'][key]=d['seal']; N['karma'][key]=d['karma']; N['text'][key]=d['text']; N['frames'][key]=d['frames']; N['side'][key]=d['origin']
for ending,index,req,text in s7.FRAMES:
    group=N['frames'][ending][index]
    group[:]=[r for r in group if r['text']!=text]
    group.insert(0,{"requires":req,"text":text})
# 장원을 둔 강호행의 맺음말. 본편의 결말에 한 줄을 더한다
_M={"기본":[({"flag":"장원_길목"},"산 아래 길목마다 장원의 불이 켜져 있었다. 〈그〉는 그 불을 따라 내려왔고, 청지기는 대문 앞 눈을 쓸어 두었다."),({"flag":"장원_마을"},"산자락의 장원 아래에는 그 뒤로 고을이 하나 생겼다. 그 고을 사람들은 주인의 별호 대신 집의 문패를 댔다."),({"flag":"장원_식구"},"산자락의 장원은 그 뒤로도 대문을 열어 두었다. 솥은 늘 식구 수보다 하나 크게 걸렸다.")],
 "생사경":[({"flag":"장원_길목"},"산 아래 길목마다 장원의 불이 켜져 있었다. 내려온 〈그〉를 청지기는 알아보았다. 달라진 것은 없다고, 국이 식기 전에 들라고 했다."),({"flag":"장원_식구"},"생사를 넘은 사람에게도 돌아갈 대문은 하나였다. 산자락의 장원은 그날도 솥을 걸었다.")],
 "배드":[({"flag":"장원_닫힌"},"산자락의 장원은 그 뒤로 대문을 연 적이 없다. 담 위의 가시나무만 해마다 자랐다."),({"flag":"장원_식구"},"산자락의 장원 사람들은 〈그〉가 돌아온 밤 대문을 열었다. 이튿날부터 하나둘 짐을 쌌다.")],
 "사망":[({"flag":"장원_길목"},"산 아래 길목의 불은 사흘을 더 타다 꺼졌다. 청지기는 대문에 빗장을 걸고 문패가 다시 오기를 기다린다."),({"flag":"장원_식구"},"산자락의 장원은 주인을 잃고 대문을 닫았다. 식구들은 흩어지기 전에 마당을 한 번 더 쓸었다.")]}
for _k,_rows in _M.items():
    _texts={t for _,t in _rows}
    N['frames'][_k]=[g for g in N['frames'][_k] if not (isinstance(g,list) and g and isinstance(g[0],dict) and g[0].get('text') in _texts)]
    N['frames'][_k].append([{"requires":r,"text":t} for r,t in _rows])
save('endings',N)
# 카르마
K=load('karma')
K.pop('omens',None)
W=lambda name,desc,levels: {"name":name,"desc":desc,"costs":[50,100,150],"levels":levels}
K['manor']={
 "note":"강호 어느 산자락에 주인 없는 장원이 하나 있습니다. 문패를 지닌 사람을 주인으로 모시는 집입니다. 카르마로 채를 올리면 장원이 커집니다. 문패를 챙긴 강호행에만 장원이 길 위에 나타나고, 그 강호행에서는 장원의 일이 때맞춰 찾아오며 길에서 만나는 일을 장원으로 풀 길이 열립니다. 채가 높을수록 장원에서 얻는 것도 큽니다. 본편과 외전 어디에서나 같습니다.",
 "gate":{"costs":[5,10,15,20]},"need_total":500,
 "wings":{
  "객사":W("객사","길손이 묵어가는 채. 쫓기는 사람과 갈 곳 없는 사람을 길에서 장원으로 보낼 수 있다.",["비를 긋는 길손이 든다","전란의 피난민을 받을 만큼 넓어진다","이름을 감춘 큰 손님이 묵는다"]),
  "연무장":W("연무장","무인들이 병기를 맞대는 마당. 배우려는 아이와 가르칠 사람을 길에서 장원으로 들일 수 있다.",["떠돌이 무인이 한 수를 청한다","현판을 노리는 자들이 온다","식객들이 장원의 이름으로 일을 청한다"]),
  "약방":W("약방","약초밭과 약탕기를 둔 채. 병든 마을과 다친 사람을 장원의 약으로 돌볼 수 있다.",["떠돌이 의원이 약방을 맡는다","돌림병 든 고을에 약을 댄다","약왕곡에서 사람이 온다"]),
  "서고":W("서고","흩어진 책을 모아 두는 채. 길에서 찾은 책과 사람을 장원에 들일 수 있다.",["벽 속에 묻힌 책 궤가 나온다","책을 베끼러 온 사람들이 모인다","장서를 탐내는 사람들이 온다"])}}
for k,u in dsl.UPGRADES.items(): K['upgrades'][k]=u
T0={k:v for k,v in load('traits').items() if k not in dsl.TRAITS and k!='물귀신숨'}
T={}; last=[k for k,v in T0.items() if v.get('rarity')=='희귀' and not v.get('hidden')][-1]
for k,v in T0.items():
    T[k]=v
    if k==last: T.update(dsl.TRAITS)
save('traits',T)
K['achievements']=[a for a in K['achievements'] if not a['key'].startswith('외전')]+[
 {"key":"외전1","name":"곁길의 끝","desc":"외전 하나를 끝맺는다.","type":"sides","value":1,"karma":5},
 {"key":"외전3","name":"세 갈래 곁길","desc":"외전 셋을 끝맺는다.","type":"sides","value":3,"karma":8},
 {"key":"외전7","name":"강호의 일곱 변두리","desc":"외전 일곱을 끝맺는다.","type":"sides","value":7,"karma":15},
 {"key":"외전14","name":"열네 갈래의 십 년","desc":"외전 열넷을 끝맺는다.","type":"sides","value":14,"karma":20},
 {"key":"외전28","name":"같은 강호의 모든 얼굴","desc":"외전 스물여덟을 모두 끝맺는다.","type":"sides","value":28,"karma":30}]
_C={}
for _k,_v in K['content'].items():
    _C[_k]=_v
    if _v.get('side') and not any(x.get('side') for x in list(K['content'].values())[list(K['content']).index(_k)+1:]):
        for _a,_b in side.CONTENT.items(): _C[_a]=_b
for _a,_b in side.CONTENT.items(): _C.setdefault(_a,_b)
K['content']=_C
save('karma',K)
print(len(dsl.STORY),len(dsl.RANDOM),len(dsl.ENDINGS),len(dsl.ENEMIES))

# 장원에서 얻는 것을 키우고 장원의 크기에 따라 더 커지게 한다
def _richer(node, rate_stat, rate_silver):
    if isinstance(node,dict):
        if 'effects' in node and isinstance(node['effects'],dict):
            e=node['effects']
            if e.get('stats'): e['stats']={k:(round(v*rate_stat) if v>0 else v) for k,v in e['stats'].items()}
            if (e.get('silver') or 0)>0: e['silver']=int(round(e['silver']*rate_silver/10)*10)
            if (e.get('stats') or (e.get('silver') or 0)>0): e['manor_scale']=True
            if not e.get('art_mastery') and not e.get('ending') and (e.get('stats') or {}).get('mind',0)>0: e['art_mastery']={'심공':4}
        for v in node.values(): _richer(v, rate_stat, rate_silver)
    elif isinstance(node,list):
        for v in node: _richer(v, rate_stat, rate_silver)
_richer(dsl.MANOR, 2.0, 1.6)
for _f,_k,_c in dsl.HOOKS: _richer(_c, 1.8, 1.5)
save('events_manor',dsl.MANOR)
for file,key,choice in dsl.HOOKS:
    d=load(file); ev=d[key]
    ev['choices']=[c for c in ev['choices'] if c['label']!=choice['label']]+[choice]
    save(file,d)
for file,key,r in dsl.REACTS:
    d=load(file); ev=d[key]
    ev['reacts']=[x for x in ev.get('reacts',[]) if x['text']!=r['text']]+[r]
    save(file,d)
print('manor',len(dsl.MANOR),'hooks',len(dsl.HOOKS),'reacts',len(dsl.REACTS))
