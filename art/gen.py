import json,sys,subprocess,os
# 사용: gen.py 이름 시드 "그림체" "인물" ["배경"]
name,seed,style,char=sys.argv[1:5]; extra=sys.argv[6] if len(sys.argv)>6 else ""
bg=sys.argv[5] if len(sys.argv)>5 else "mountain path, misty mountains, pine trees, morning, wind, falling leaves, east asian architecture in distance"
QUAL=", very aesthetic, masterpiece, no text"
UC=("lowres, artistic error, film grain, scan artifacts, worst quality, bad quality, jpeg artifacts, very displeasing, chromatic aberration, dithering, halftone, screentone, multiple views, logo, too many watermarks, "
    "modern clothes, glasses, wristwatch, armor plates, japanese clothes, kimono, katana, samurai, ninja, text, signature, watermark, extra fingers, bad hands, chibi")
base=style+", "+bg+QUAL
# 빼는 칸은 약 512토큰을 넘으면 뒤가 잘린다. 그 그림만의 말을 앞에 두고 겹치는 말은 한 번만 넣는다
# 부르는 쪽은 "그 그림만의 말 || 긴 공통 목록"으로 넘긴다. 순서: 그 그림만의 말, 화질 제외어, 긴 공통 목록
_first, _, _rest = extra.partition("||") if "||" in extra else (extra, "", "")
_seen=set(); _terms=[]
for _t in [t.strip() for t in _first.split(",")+UC.split(",")+_rest.split(",")]:
    if _t and _t not in _seen: _seen.add(_t); _terms.append(_t)
UC=", ".join(_terms)
body={"input":base,"model":"nai-diffusion-4-5-full","action":"generate","parameters":{
 "params_version":3,"width":int(os.environ.get("ART_W",832)),"height":int(os.environ.get("ART_H",1216)),"scale":5,"sampler":"k_euler_ancestral","steps":28,"n_samples":1,
 "ucPreset":0,"qualityToggle":True,"seed":int(seed),"noise_schedule":"karras","cfg_rescale":0,"sm":False,"sm_dyn":False,
 "dynamic_thresholding":False,"add_original_image":True,"legacy":False,"legacy_v3_extend":False,"legacy_uc":False,
 "autoSmea":False,"use_coords":False,"deliberate_euler_ancestral_bug":False,"prefer_brownian":True,
 "v4_prompt":{"caption":{"base_caption":base,"char_captions":[{"char_caption":char,"centers":[{"x":0.5,"y":0.5}]}]},"use_coords":False,"use_order":True},
 "v4_negative_prompt":{"caption":{"base_caption":UC,"char_captions":[{"char_caption":"","centers":[{"x":0.5,"y":0.5}]}]},"legacy_uc":False},
 "negative_prompt":UC,
 "characterPrompts":[{"prompt":char,"uc":"","center":{"x":0.5,"y":0.5},"enabled":True}]}}
open(name+".json","w").write(json.dumps(body))
import time
for attempt in range(8):
    r=subprocess.run(["curl","-sS","-o",name+".zip","-w","%{http_code}","-X","POST","https://image.novelai.net/ai/generate-image",
      "-H","Content-Type: application/json","-H","Authorization: Bearer dummy","--data-binary","@"+name+".json"],capture_output=True,text=True)
    if r.stdout!="429": break
    time.sleep(20*(attempt+1))  # 무료 조건은 한 번에 한 장만 받으므로 다른 생성이 끝나기를 기다린다
print(name,r.stdout,r.stderr[:300])
if r.stdout=="200":
    import zipfile
    z=zipfile.ZipFile(name+".zip"); data=z.read(z.namelist()[0]); open(name+".png","wb").write(data); os.remove(name+".zip")
else: print(open(name+".zip").read()[:500])
