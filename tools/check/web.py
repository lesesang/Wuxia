import os
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),"..",".."))
import subprocess,sys,time,json
from playwright.sync_api import sync_playwright
SP=sys.argv[1]+'/web'; URL='http://localhost:8124/'
srv=subprocess.Popen(['python3','-m','http.server','8124','-d',os.path.join(ROOT,'www')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(1)
errs=[]; external=[]; fails=[]
try:
 with sync_playwright() as pw:
    b=pw.chromium.launch(args=['--no-proxy-server'])
    cx=b.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True,device_scale_factor=2,service_workers='allow')
    cx.add_init_script("try{if(!localStorage.getItem('wuxia-speed'))localStorage.setItem('wuxia-speed','0')}catch(e){}")
    pg=cx.new_page()
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.on('console',lambda m:errs.append(m.text) if m.type=='error' else None)
    pg.on('request',lambda r:external.append(r.url) if not r.url.startswith(URL) and not r.url.startswith('data:') and not r.url.startswith('blob:') else None)
    pg.on('response',lambda r:fails.append((r.status,r.url)) if r.status>=400 else None)
    pg.goto(URL); pg.wait_for_selector('.start-btn'); time.sleep(.5); pg.screenshot(path=SP+'/title.png')
    print('font',pg.evaluate("document.fonts.check('16px \"Game Serif\"')"), 'overflowX',pg.evaluate("document.documentElement.scrollWidth>innerWidth"))
    pg.tap('[data-act=setup]'); pg.wait_for_selector('.setup-bar'); pg.screenshot(path=SP+'/setup.png')
    pg.tap('[data-tab=trait]'); pg.screenshot(path=SP+'/setup_trait.png'); pg.tap('[data-tab=origin]')
    pg.tap('.setup-bar .start-btn'); pg.wait_for_selector('#help-modal.open'); pg.screenshot(path=SP+'/help.png'); pg.tap('#help-modal .modal-close')
    pg.wait_for_selector('.event-title'); pg.screenshot(path=SP+'/prologue.png')
    pg.locator('.choice-btn').nth(2).tap(); pg.wait_for_selector('.event-title'); pg.screenshot(path=SP+'/seojang.png'); print('after prelude',pg.inner_text('.event-title')); [pg.locator('.choice-btn').first.tap() for _ in range(3) if pg.locator('.event-title').count()]; pg.screenshot(path=SP+'/after_choice.png')
    pg.tap('[data-action=수련]'); pg.screenshot(path=SP+'/train.png'); pg.tap('[data-act=next]')
    t=pg.inner_text('.turn-info'); pg.reload(); pg.wait_for_selector('[data-act=continue]'); pg.screenshot(path=SP+'/title_continue.png'); pg.tap('[data-act=continue]'); pg.wait_for_selector('.turn-info'); print('restored',t,'=>',pg.inner_text('.turn-info'))
    seen=set()
    ENG=set()
    for i in range(8000):
        if pg.locator('.stand-box').count():
            print('STAND'); pg.screenshot(path=SP+'/stand.png'); pg.locator('.stand-box button').first.tap(); continue
        import re as _r
        for w in _r.findall(r'[A-Za-z]{2,}',pg.inner_text('body')): ENG.add(w)
        if pg.locator('.ending-sheet').count(): pg.screenshot(path=SP+'/ending.png'); print('ending',pg.inner_text('.ending-title'),i); break
        if pg.locator('.event-title').count():
            if pg.locator('.event-title').inner_text()=='천하제일 비무대회': pg.screenshot(path=SP+'/tourney.png')
            pg.locator('.choice-btn:not([disabled])').first.tap(); continue
        if pg.locator('.market-title').count():
            nm=pg.inner_text('.market-title')
            if nm not in seen:
                seen.add(nm)
                if '1년차' in nm: pg.screenshot(path=SP+'/market.png')
                btn=pg.locator('.buy-btn:not([disabled])')
                if btn.count(): btn.first.tap()
                if '1년차' in nm: pg.screenshot(path=SP+'/market2.png')
            pg.locator('.next-btn').tap(); continue
        if pg.locator('[data-act=interlude]').count():
            pg.locator('[data-act=interlude]').last.tap(); continue
        if pg.locator('.battle-panel').count():
            if 'battle' not in seen and pg.locator('.battle-log p').count()>=5:
                seen.add('battle'); pg.screenshot(path=SP+'/battle.png')
            if pg.evaluate("(()=>{const g=document.querySelector('.bt-btn[data-action=심법]');return document.querySelector('[data-bar=player]').style.width})()") and pg.locator('.hpbar-outer.danger').count() and 'lowbattle' not in seen:
                seen.add('lowbattle'); pg.screenshot(path=SP+'/battle_low.png')
            if pg.locator('.hpbar-outer.danger').count() and pg.locator('[data-action=도주]').count(): pg.tap('[data-action=도주]'); continue
            pg.tap('[data-action=기본공격]'); continue
        if pg.locator('[data-act=next]').count(): pg.tap('[data-act=next]'); continue
        if 'modals' not in seen and i>8:
            seen.add('modals'); pg.screenshot(path=SP+'/turn.png')
            pg.locator('[data-act=open-status][data-tab=stats]').tap(); pg.wait_for_selector('#status-modal.open'); pg.screenshot(path=SP+'/status.png')
            pg.tap('#status-modal [data-tab=skills]'); pg.screenshot(path=SP+'/status_skills.png')
            pg.go_back(); time.sleep(.2); print('back closes modal',pg.locator('.modal-overlay.open').count()==0)
            pg.tap('[data-modal=settings-modal]'); pg.screenshot(path=SP+'/settings.png'); pg.tap('#settings-modal .modal-close')
        if pg.locator('.act-btn.suggest').count(): 
            if 'advice' not in seen: seen.add('advice'); pg.screenshot(path=SP+'/advice.png')
            pg.tap('[data-action=휴식]'); continue
        pg.tap('[data-action=탐색]')
    print('seen',sorted(seen)); print('ENGLISH',ENG)
    pg.tap('[data-act=restart]'); pg.wait_for_selector('.start-btn'); print(pg.inner_text('.karma-display'))
    # 오프라인
    time.sleep(1.5); print('sw',pg.evaluate("navigator.serviceWorker.getRegistration().then(r=>!!(r&&r.active))"))
    cached=pg.evaluate("caches.keys().then(async k=>{const c=await caches.open(k[0]);return (await c.keys()).length})"); print('cached',cached)
    cx.set_offline(True); pg.reload(); pg.wait_for_selector('.start-btn',timeout=8000); pg.tap('[data-act=setup]'); pg.tap('.setup-bar .start-btn'); pg.wait_for_selector('.event-title'); print('offline play OK',pg.inner_text('.event-title')); cx.set_offline(False)
    # 기록 내보내기
    pg.reload(); pg.wait_for_selector('.start-btn'); 
    pg.tap('[data-modal=settings-modal]')
    with pg.expect_download() as d: pg.tap('[data-act=export]')
    dl=d.value; print('export',dl.suggested_filename, list(json.load(open(dl.path(),encoding='utf-8')).keys()))
    # 넓은 화면
    pg2=b.new_page(viewport={'width':1100,'height':800}); pg2.goto(URL); pg2.wait_for_selector('.start-btn'); time.sleep(.3); pg2.screenshot(path=SP+'/home_wide.png')
    # 타자 효과
    cx3=b.new_context(viewport={'width':390,'height':844}); p3=cx3.new_page(); p3.goto(URL); p3.wait_for_selector('.start-btn'); p3.click('[data-act=setup]'); p3.click('.setup-bar .start-btn'); p3.wait_for_selector('#help-modal.open'); p3.click('#help-modal .modal-close'); a=len(p3.inner_text('.event-text')); p3.wait_for_timeout(300); c=len(p3.inner_text('.event-text')); p3.mouse.click(5,300); e=len(p3.inner_text('.event-text')); print('typing',a,c,e)
    b.close()
 print('errors',errs); print('external',external); print('fails',fails)
finally: srv.terminate()
