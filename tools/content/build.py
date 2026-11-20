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
_OLD_FOES=set(dsl.ENEMIES)
NEW_SIDE=['o_sorim','o_mudang','o_ami','o_gongdong','o_moyong','o_sadoryeon','o_jegal','o_dark','o_gwimun','o_nokrim','o_heuksa','o_mangnani','o_cheongseong','o_jongnam','o_singyo','o_hongsu','o_jeomchang','o_gonryun','o_gwangbu','o_sagong','o_wiso','o_dark2','side_more','bonds_a','bonds_b','bonds_c','manor_more']
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
O['origins']['외전매화']['chapters']['2']['desc']='스승이 떠나온 화산 본산에서 스승의 젊은 날을 듣는다.'
O['origins']['외전매화'].update(sect="화산",skip=["문파대사_화산"],desc="화산의 속가 매화검수이자 천하십대고수 매화노검 백송이 산을 떠나기 전 마지막으로 거둔 제자. 화산 뒷산 스승의 초막에서 매화검법과 스승의 검을 함께 받아 일류에 올랐다. 스승은 명부의 열째 자리를 비우고 편지 한 장 없이 사라졌다.")
_h=O['origins']['외전혈승']; _h['end_turn']=120; _h['goal']='혈교의 순례승으로 개조의 의지를 거두어 혈마가 깨어나는 강림의 밤을 열고, 죽 한 그릇의 값을 마저 치른다'; _h['goal_short']='값을 치르는 날'; _h['chapters']['4']['desc']='빼앗긴 그릇을 되찾는 싸움. 그리고 강림의 밤.'; _h['chapters']['5']['desc']='혈마신교의 강호다. 죽 한 그릇의 값이 아직 남았다.'
for k,v in {"외전빙궁":["북해고수"],"외전매화":["십대고수"],"외전수로":["수적두목"],"외전야수":["천마사냥개","남만술사","백액호","금안조","철갑현귀","불가사리","천년백사"],"외전혈승":["마교심판자","혈교우호법"]}.items(): O['origins'][k]['shun']=v
# 출신마다 시작 성향과 출신의 보정. 소속의 보정은 두지 않는다
_LBL={"damage":"주는 피해","damage_reduce":"받는 피해","crit":"회심의 일격 확률","evade":"경공 회피","heal_bonus":"심법 회복량","silver":"얻는 은자","poison":"공격이 적을 중독시킨다"}
def _hp(n):
    a,b=divmod(n,10); return (f"{a}할" if a else "")+(" " if a and b else "")+(f"{b}푼" if b else "")
def _btext(b):
    out=[]
    for k,v in b.items():
        if k=="poison": out.append(_LBL[k])
        else: out.append(f"{_LBL[k]} {_hp(v)} {'감소' if k=='damage_reduce' else '증가'}")
    return ", ".join(out)
ORIGIN_TRAITS={
 "무림초출":({"정도":30},{"damage":4,"damage_reduce":3}),
 "남궁세가":({"정도":60},{"crit":8}),
 "하북팽가":({"정도":60},{"damage":8}),
 "표국표사":({"정도":40},{"damage_reduce":4,"silver":10}),
 "개방제자":({"정도":60},{"heal_bonus":20,"damage_reduce":2}),
 "권마계승":({"마도":40},{"damage":4,"crit":4}),
 "혈지생환":({"정도":20,"마도":30},{"damage":4,"heal_bonus":15}),
 "하오문":({"사도":60},{"evade":6,"silver":10}),
 "외전당가":({"정도":60},{"poison":6}),
 "외전빙궁":({"정도":40},{"damage_reduce":3,"heal_bonus":15}),
 "외전매화":({"정도":60},{"crit":8}),
 "외전살막":({"사도":60},{"crit":5,"evade":5}),
 "외전수로":({"사도":60},{"evade":5,"silver":10}),
 "외전혈승":({"마도":60},{"damage":4,"heal_bonus":15}),
 "외전야수":({"마도":40},{"damage":5,"damage_reduce":3}),
 "외전소림":({"정도":60},{"damage_reduce":6}),
 "외전무당":({"정도":60},{"heal_bonus":30}),
 "외전아미":({"정도":60},{"evade":10}),
 "외전공동":({"정도":60},{"damage_reduce":4,"damage":3}),
 "외전모용":({"정도":60},{"damage":5,"crit":3}),
 "외전사도련":({"사도":60},{"damage":4,"silver":10}),
 "외전제갈":({"정도":60},{"crit":4,"silver":10}),
 "외전귀문":({"마도":60},{"damage":3,"poison":4}),
 "외전녹림":({"사도":60},{"damage_reduce":3,"silver":10}),
 "외전흑사":({"사도":60},{"silver":15,"crit":3}),
 "외전망나니":({"사도":40},{"crit":6,"damage":3}),
 "외전청성":({"정도":60},{"heal_bonus":15,"evade":5}),
 "외전종남":({"정도":60},{"damage":4,"evade":4}),
 "외전신교":({"마도":60},{"damage":8}),
 "외전홍수":({"마도":60},{"crit":4,"evade":5}),
 "외전점창":({"정도":60},{"crit":5,"evade":5}),
 "외전곤륜":({"정도":60},{"heal_bonus":20,"damage_reduce":2}),
 "외전광부":({"사도":40},{"damage_reduce":5,"damage":2}),
 "외전사공":({"정도":30,"사도":30},{"damage_reduce":3,"heal_bonus":15}),
 "외전위소":({"정도":40},{"damage_reduce":3,"damage":4}),
}
assert set(ORIGIN_TRAITS)==set(O['order'])|set(O['side_order']), set(O['order'])|set(O['side_order'])^set(ORIGIN_TRAITS)
for _k,(_a,_b) in ORIGIN_TRAITS.items():
    O['origins'][_k]['alignment']=_a; O['origins'][_k]['bonus']=_b; O['origins'][_k]['bonus_text']=_btext(_b)
_S=load('sects')
for _v in _S.values(): _v.pop('bonus',None); _v.pop('bonus_text',None)
save('sects',_S)
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
# 문파와 세가의 최고 무공은 그 소속의 외전 출신이 잇는다. 같은 갈래의 무공과 이어진다
for _k,(_l,_r,_s) in {"달마심공":("소림심법",5,"소림"),"태극검":("무당검",4,"무당"),"태극심공":("무당심법",5,"무당"),"이십사수매화검법":("매화검",4,"화산"),"만천화우":("당가암기",4,"당가"),"사일검법":("점창검",3,"점창"),"회천창법":("모용창",4,"모용"),"구궁연노":("제갈침",3,"제갈"),"천뢰검법":(None,None,"종남"),"대라검법":(None,None,"곤륜")}.items():
    SK[_k].pop('school',None)
    if _l: SK[_k]['lineage']=_l; SK[_k]['lineage_rank']=_r
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
# 새 외전의 고비 상대는 97달 기준의 수치로 적었다. 마지막 고비의 상대는 기존 외전의 마지막 상대와 같은 곡선을 따른다
_finals={m for e in dsl.STORY.values() if e.get('turn')==120 for m in __import__('re').findall(r'"battle": "(외전_[^"]+)"', json.dumps(e,ensure_ascii=False))}
for _k in set(dsl.ENEMIES)-_OLD_FOES:
    E[_k]['level']=97
    E[_k]['hp_style'],E[_k]['attack_style']=(1.366,1.19) if _k in _finals else (1.12,1.0)
    _h,_a=side.FINAL_TUNE.get(_k,(1,1))
    _base=dsl.ENEMIES[_k][1]
    E[_k]['hp']=int(round(_base['hp']*_h/50)*50); E[_k]['attack']=int(round(_base['attack']*_a))
for _k in set(dsl.ENEMIES)&_OLD_FOES:
    if _k in side.FINAL_TUNE:
        _h,_a=side.FINAL_TUNE[_k]; _base=dsl.ENEMIES[_k][1]
        E[_k]['hp']=int(round(_base['hp']*_h/50)*50); E[_k]['attack']=int(round(_base['attack']*_a))
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
import frames_more; frames_more.apply(N)
save('endings',N)
# 카르마
K=load('karma')
K.pop('omens',None)
W=lambda name,desc,levels: {"name":name,"desc":desc,"costs":[50,100,150],"levels":levels}
K['manor']={
 "note":"강호 어느 산자락에 주인 없는 장원이 하나 있습니다. 카르마로 채를 올리면 장원이 커지고, 문패를 챙긴 강호행에만 길 위에 나타납니다. 그 강호행에서는 장원의 일이 찾아오고 길에서 만나는 일을 장원으로 풀 수 있으며, 채가 높을수록 얻는 것도 큽니다.",
 "gate":{"costs":[5,10,15,20]},"need_total":500,
 "wings":{
  "객사":W("객사","길손이 묵어가는 채. 쫓기는 사람과 갈 곳 없는 사람을 길에서 장원으로 보낼 수 있다.",["비를 긋는 길손이 든다","전란의 피난민을 받을 만큼 넓어진다","이름을 감춘 큰 손님이 묵는다"]),
  "연무장":W("연무장","무인들이 병기를 맞대는 마당. 배우려는 아이와 가르칠 사람을 길에서 장원으로 들일 수 있다.",["떠돌이 무인이 한 수를 청한다","현판을 노리는 자들이 온다","식객들이 장원의 이름으로 일을 청한다"]),
  "약방":W("약방","약초밭과 약탕기를 둔 채. 병든 마을과 다친 사람을 장원의 약으로 돌볼 수 있다.",["떠돌이 의원이 약방을 맡는다","돌림병 든 고을에 약을 댄다","약왕곡에서 사람이 온다"]),
  "서고":W("서고","흩어진 책을 모아 두는 채. 길에서 찾은 책과 사람을 장원에 들일 수 있다.",["벽 속에 묻힌 책 궤가 나온다","책을 베끼러 온 사람들이 모인다","장서를 탐내는 사람들이 온다"])}}
_base_traits=load('traits')
for k,v in dsl.TRAITS.items():
    assert k not in _base_traits or _base_traits[k].get('origin')==v.get('origin'), ('자질 이름 겹침',k)
for k,v in dsl.UPGRADES.items():
    assert k not in K['upgrades'] or K['upgrades'][k].get('origin')==v.get('origin'), ('기틀 이름 겹침',k)
for k,v in side.CONTENT.items():
    assert k not in K['content'] or K['content'][k].get('origin')==v.get('origin'), ('인연 이름 겹침',k)
for k,u in dsl.UPGRADES.items(): K['upgrades'][k]=u
T0={k:v for k,v in load('traits').items() if k not in dsl.TRAITS and k!='물귀신숨'}
T={}; last=[k for k,v in T0.items() if v.get('rarity')=='희귀' and not v.get('hidden')][-1]
for k,v in T0.items():
    T[k]=v
    if k==last: T.update(dsl.TRAITS)
# 출신 전용 자질과 기틀은 같은 값어치로 맞춘 표를 따른다(tools/check/shop_value.py)
from shop_tune import TRAIT_TUNE, UPGRADE_TUNE
for _k,_v in TRAIT_TUNE.items(): T[_k].update(_v)
for _k,_v in UPGRADE_TUNE.items(): K['upgrades'][_k].update(_v)
# 등급은 값을 따른다: 7 미만은 일반, 7 이상은 희귀. 자질 데이터는 등급, 출신 차례, 값 순
for _v in T.values():
    if not _v.get('hidden') and _v.get('rarity')!='전설': _v['rarity']='희귀' if _v['cost']>=7 else '일반'
_RO=['일반','희귀','전설']; _OO=[None]+O['order']+O['side_order']
T=dict(sorted(T.items(), key=lambda kv:(1 if kv[1].get('hidden') else 0, _RO.index(kv[1].get('rarity','일반')) if not kv[1].get('hidden') else 0, _OO.index(kv[1].get('origin')), kv[1].get('cost',0))))
save('traits',T)
K['achievements']=[a for a in K['achievements'] if not a['key'].startswith('외전')]+[
 {"key":"외전1","name":"곁길의 끝","desc":"외전 하나를 끝맺는다.","type":"sides","value":1,"karma":5},
 {"key":"외전3","name":"세 갈래 곁길","desc":"외전 셋을 끝맺는다.","type":"sides","value":3,"karma":8},
 {"key":"외전7","name":"강호의 일곱 변두리","desc":"외전 일곱을 끝맺는다.","type":"sides","value":7,"karma":15},
 {"key":"외전14","name":"열네 갈래의 십 년","desc":"외전 열넷을 끝맺는다.","type":"sides","value":14,"karma":20},
 {"key":"외전28","name":"같은 강호의 모든 얼굴","desc":"외전을 모두 끝맺는다.","type":"sides","value":len(O['side_order']),"karma":30}]
_C={}
for _k,_v in K['content'].items():
    _C[_k]=_v
    if _v.get('side') and not any(x.get('side') for x in list(K['content'].values())[list(K['content']).index(_k)+1:]):
        for _a,_b in side.CONTENT.items(): _C[_a]=_b
for _a,_b in side.CONTENT.items(): _C.setdefault(_a,_b)
# 외전 출신의 인연도 출신 전용 묶음에 둔다. 신공 인연은 본편과 같은 값이고, 합쳐진 최고 무공의 이름을 쓴다
_REN={"태을직검":"천뢰검법","무상선정공":"달마심공","태청무극검":"태극검","양의귀원공":"태극심공","한매삼영검":"이십사수매화검법","천라추혼침":"만천화우","만년설붕검":"대라검법","섬전탈혼검":"사일검법","연운비천창":"회천창법","목우유성침":"구궁연노"}
for _k,_v in _C.items():
    if _v.get('side'):
        _v['group']='출신 전용'
        if _k.endswith('신공'): _v['cost']=10
        for _a,_b in _REN.items(): _v['desc']=_v['desc'].replace(_a,_b)
# 상점 데이터는 묶음, 출신 차례, 값 순
_groups=[]
for _v in _C.values():
    if _v.get('group') not in _groups: _groups.append(_v.get('group'))
_ord=[None]+O['order']+O['side_order']
_C=dict(sorted(_C.items(), key=lambda kv:(_groups.index(kv[1].get('group')), _ord.index(kv[1].get('origin')), kv[1].get('cost',0))))
K['content']=_C
save('karma',K)
_MK=load('market')
for _k,_v in dsl.MARKET.items():
    assert _k not in _MK or _MK[_k].get('origin')==_v['origin'], ('물건 이름 겹침',_k)
    _MK[_k]=_v
save('market',_MK)
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
