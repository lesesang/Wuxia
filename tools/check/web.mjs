// 브라우저로 게임을 돌려 보는 점검. 오류, 영어 노출, 바깥 요청, 실패한 응답, 가로 넘침을 모으고 화면을 찍는다.
//   node tools/check/web.mjs <출력 폴더>                     한 판을 끝까지(WEB_STEPS=40이면 마흔 걸음만) 돌며 이어하기, 오프라인, 기록 내보내기, 글자 찍히는 효과까지 본다
//   node tools/check/web.mjs <출력 폴더> shop manor,side     카르마 상점의 칸마다 화면을 찍는다
// 작은 화면, 가로로 눕힌 화면, 넓은 화면의 첫 화면과 출발 화면도 함께 찍는다.
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)("playwright");
const ROOT = resolve(new URL("../..", import.meta.url).pathname);
const OUT = process.argv[2];
if (!OUT) { console.error("출력 폴더를 주세요"); process.exit(1); }
mkdirSync(OUT, { recursive: true });
const MODE = process.argv[3] || "play";
const PORT = 8124 + Math.floor(Math.random() * 500);
const BASE = `http://localhost:${PORT}/`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (pg, name) => pg.screenshot({ path: join(OUT, `${name}.png`) });

const srv = spawn("python3", ["-m", "http.server", String(PORT), "-d", join(ROOT, "www")], { stdio: "ignore" });
const errs = [], external = [], fails = [], english = new Set();
let browser;
let failed = false;
try {
  await sleep(1000);
  browser = await chromium.launch({ args: ["--no-proxy-server"] });
  const watch = (pg) => {
    pg.on("pageerror", (e) => errs.push(String(e)));
    pg.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
    pg.on("request", (r) => { const u = r.url(); if (!u.startsWith(BASE) && !u.startsWith("data:") && !u.startsWith("blob:")) external.push(u); });
    pg.on("response", (r) => { if (r.status() >= 400) fails.push(`${r.status()} ${r.url()}`); });
  };
  const context = (viewport, mobile = true) => browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  const overflow = (pg) => pg.evaluate(() => document.documentElement.scrollWidth > innerWidth);

  if (MODE === "shop") {
    const tabs = (process.argv[4] || "origin,trait,upgrade,content,provision,manor,legacy,side").split(",");
    const cx = await context({ width: 390, height: 844 });
    const pg = await cx.newPage(); watch(pg);
    await pg.goto(BASE); await pg.waitForSelector(".start-btn");
    await pg.evaluate(() => localStorage.setItem("wuxia-legend", JSON.stringify({ current_karma: 300, total_karma: 600, unlocked_origins: ["무림초출", "외전당가", "남궁세가"], endings_seen: ["생사경"], manor: { 객사: 1 } })));
    await pg.reload(); await pg.waitForSelector(".start-btn");
    await pg.tap("[data-act=shop]"); await sleep(400);
    for (const t of tabs) {
      const tab = pg.locator(`[data-act=shop-tab][data-tab=${t}]`);
      if (!(await tab.count())) { console.log(t, "칸 없음"); continue; }
      await tab.tap(); await sleep(200); await shot(pg, `shop_${t}`);
      console.log(t, "높이", await pg.evaluate(() => document.documentElement.scrollHeight), "가로 넘침", await overflow(pg));
    }
  } else {
    // 세 크기의 첫 화면과 출발 화면
    for (const [name, vp, mobile] of [["phone", { width: 390, height: 844 }, true], ["land", { width: 844, height: 390 }, true], ["wide", { width: 1440, height: 900 }, false]]) {
      const cx = await context(vp, mobile); const pg = await cx.newPage(); watch(pg);
      await pg.goto(BASE); await pg.waitForSelector(".start-btn"); await shot(pg, `${name}_title`);
      await pg.click("[data-act=setup]"); await pg.waitForSelector(".setup-bar"); await shot(pg, `${name}_setup`);
      if (await overflow(pg)) errs.push(`${name} 가로 넘침`);
      await cx.close();
    }

    const cx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, acceptDownloads: true });
    await cx.addInitScript(() => { try { if (!localStorage.getItem("wuxia-speed")) localStorage.setItem("wuxia-speed", "0"); } catch (e) { /* 저장소가 없어도 된다 */ } });
    const pg = await cx.newPage(); watch(pg);
    await pg.goto(BASE); await pg.waitForSelector(".start-btn");
    console.log("글꼴", await pg.evaluate(() => document.fonts.check('16px "Game Serif"')));
    await pg.tap("[data-act=setup]"); await pg.waitForSelector(".setup-bar");
    await pg.tap(".setup-bar .start-btn"); await pg.waitForSelector("#help-modal.open"); await shot(pg, "help"); await pg.tap("#help-modal .modal-close");
    await pg.waitForSelector(".event-title"); await shot(pg, "prologue");
    // 이어하기: 달을 하나 넘긴 뒤 다시 열어 같은 달에서 이어지는지 본다
    for (let i = 0; i < 20 && !(await pg.locator("[data-action=수련]").count()); i++) {
      if (await pg.locator(".choice-btn:not([disabled])").count()) await pg.locator(".choice-btn:not([disabled])").first().tap();
      else if (await pg.locator("[data-act=next]").count()) await pg.tap("[data-act=next]");
      else await sleep(100);
    }
    await pg.tap("[data-action=수련]"); await pg.tap("[data-act=next]").catch(() => {});
    await pg.waitForSelector(".turn-info");
    const before = await pg.innerText(".turn-info");
    await pg.reload(); await pg.waitForSelector("[data-act=continue]"); await pg.tap("[data-act=continue]"); await pg.waitForSelector(".turn-info");
    console.log("이어하기", before.split("\n")[0], "→", (await pg.innerText(".turn-info")).split("\n")[0]);

    const seen = new Set();
    let ending = null;
    for (let i = 0; i < Number(process.env.WEB_STEPS || 9000); i++) {
      if (i % 40 === 0) {
        for (const w of (await pg.innerText("body")).match(/[A-Za-z]{2,}/g) || []) english.add(w);
        if (await overflow(pg)) seen.add("가로 넘침");
      }
      if (await pg.locator(".ending-sheet").count()) { await shot(pg, "ending"); ending = await pg.innerText(".ending-title"); break; }
      if (await pg.locator(".stand-box").count()) { await pg.locator(".stand-box button").first().tap(); continue; }
      if (await pg.locator(".event-title").count()) { await pg.locator(".choice-btn:not([disabled])").first().tap(); continue; }
      if (await pg.locator(".market-title").count()) {
        if (!seen.has("market")) { seen.add("market"); await shot(pg, "market"); }
        const buy = pg.locator(".buy-btn:not([disabled])"); if (await buy.count()) await buy.first().tap();
        await pg.locator(".next-btn").tap(); continue;
      }
      if (await pg.locator("[data-act=interlude]").count()) { await pg.locator("[data-act=interlude]").last().tap(); continue; }
      if (await pg.locator(".battle-panel").count()) {
        if (!seen.has("battle") && (await pg.locator(".battle-log p").count()) >= 4) { seen.add("battle"); await shot(pg, "battle"); }
        if ((await pg.locator(".hpbar-outer.danger").count()) && (await pg.locator("[data-action=도주]").count())) await pg.tap("[data-action=도주]");
        else await pg.tap("[data-action=기본공격]");
        continue;
      }
      if (await pg.locator("[data-act=next]").count()) { await pg.tap("[data-act=next]"); continue; }
      if (await pg.locator(".modal-overlay.open").count()) { await pg.keyboard.press("Escape"); continue; }
      if (!seen.has("modals") && i > 8) {
        seen.add("modals"); await shot(pg, "turn");
        await pg.locator("[data-act=open-status][data-tab=stats]").tap(); await pg.waitForSelector("#status-modal.open"); await shot(pg, "status");
        await pg.goBack(); await sleep(200); console.log("뒤로 가기로 창 닫힘", (await pg.locator(".modal-overlay.open").count()) === 0);
      }
      if (await pg.locator(".act-btn.suggest").count()) await pg.tap("[data-action=휴식]");
      else await pg.tap("[data-action=탐색]");
    }
    console.log("결말", ending, "본 것", [...seen].join(", "));

    // 오프라인: 서비스 워커가 받아 둔 것으로 다시 열리는지
    await pg.goto(BASE); await pg.waitForSelector(".start-btn");
    // 서비스 워커가 오프라인 목록을 다 받아 둘 때까지 기다린다
    const cached = await pg.evaluate(async () => {
      await navigator.serviceWorker.ready;
      const need = (await (await fetch("asset-list.json")).json()).length;
      for (let i = 0; i < 60; i++) {
        const keys = await caches.keys();
        const have = keys.length ? (await (await caches.open(keys[0])).keys()).length : 0;
        if (have >= need) return `${have}/${need}`;
        await new Promise((r) => setTimeout(r, 500));
      }
      return "다 받지 못함";
    });
    console.log("서비스 워커가 받아 둔 파일", cached);
    await cx.setOffline(true); await pg.reload(); await pg.waitForSelector(".start-btn", { timeout: 8000 });
    // 진행 중인 판이 있으면 이어 하고, 없으면 새로 나선다
    if (await pg.locator("[data-act=continue]").count()) { await pg.tap("[data-act=continue]"); await pg.waitForSelector(".turn-info"); }
    else { await pg.tap("[data-act=setup]"); await pg.tap(".setup-bar .start-btn"); await pg.waitForSelector(".event-title, #help-modal.open"); }
    console.log("오프라인 실행", true); await cx.setOffline(false);

    // 기록 내보내기
    await pg.reload(); await pg.waitForSelector(".start-btn"); await pg.tap("[data-modal=settings-modal]");
    const [download] = await Promise.all([pg.waitForEvent("download"), pg.tap("[data-act=export]")]);
    const saved = join(OUT, download.suggestedFilename()); await download.saveAs(saved);
    console.log("기록 내보내기", download.suggestedFilename(), Object.keys(JSON.parse(readFileSync(saved, "utf-8"))).join(", "));

    // 글자가 찍히는 효과: 달의 기록 줄(data-type)이 기다리면 늘고, 누르면 끝까지 보인다
    const cx3 = await browser.newContext({ viewport: { width: 390, height: 844 } }); const p3 = await cx3.newPage(); watch(p3);
    await p3.goto(BASE); await p3.waitForSelector(".start-btn"); await p3.click("[data-act=setup]"); await p3.click(".setup-bar .start-btn");
    await p3.waitForSelector("#help-modal.open"); await p3.click("#help-modal .modal-close");
    for (let i = 0; i < 30 && !(await p3.locator("[data-action=수련]").count()); i++) {
      if (await p3.locator(".choice-btn:not([disabled])").count()) await p3.locator(".choice-btn:not([disabled])").first().click();
      else if (await p3.locator("[data-act=next]").count()) await p3.click("[data-act=next]");
      else await sleep(100);
    }
    const typed = () => p3.evaluate(() => [...document.querySelectorAll("[data-type]")].reduce((n, el) => n + el.textContent.length, 0));
    await p3.click("[data-action=수련]");
    const a = await typed(); await p3.waitForTimeout(250);
    const c = await typed(); await p3.mouse.click(5, 300);
    const e = await typed();
    console.log("글자 찍기", a, c, e, a < c && c <= e ? "찍힘" : "확인 필요");
  }
} catch (e) {
  failed = true; console.error("점검이 멈췄다:", e.message.split("\n")[0]);
} finally {
  await browser?.close(); srv.kill();
}
console.log("오류", errs.slice(0, 10)); console.log("바깥 요청", external.slice(0, 10)); console.log("실패한 응답", fails.slice(0, 10));
if (MODE !== "shop") console.log("영어", [...english].slice(0, 20));
if (failed || errs.length || external.length || fails.length || english.size) process.exitCode = 1;
