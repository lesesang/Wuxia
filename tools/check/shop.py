import os
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),"..",".."))
import subprocess,sys,time,json
from playwright.sync_api import sync_playwright
SP=sys.argv[1]; URL='http://localhost:8125/'; tabs=sys.argv[2].split(',')
srv=subprocess.Popen(['python3','-m','http.server','8125','-d',os.path.join(ROOT,'www')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(1)
try:
 with sync_playwright() as pw:
    b=pw.chromium.launch(args=['--no-proxy-server'])
    cx=b.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True,device_scale_factor=1)
    pg=cx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(URL); pg.wait_for_selector('.start-btn')
    pg.evaluate("""()=>{localStorage.setItem('wuxia-legend',JSON.stringify({current_karma:300,total_karma:300,unlocked_origins:['무림초출','외전당가','남궁세가'],manor:{객사:1}}));}""")
    pg.reload(); pg.wait_for_selector('.start-btn')
    pg.tap('[data-act=shop]'); time.sleep(.5); print('errs0',errs)
    for t in tabs:
        pg.tap(f'[data-act=shop-tab][data-tab={t}]'); time.sleep(.2)
        pg.screenshot(path=f'{SP}/shop_{t}.png',full_page=False)
        print(t, pg.evaluate("document.documentElement.scrollHeight"))
    print('errs',errs)
finally:
    srv.terminate()
