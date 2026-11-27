// 막힘 찾기 도구: 아무 출신, 강호, 장원으로 마구 고르며 끝까지 가 보고 오류와 막힌 사건, 깨진 문장을 센다.
//   node tools/fuzz.js 60             (60판)
//   IMMORTAL=1 node tools/fuzz.js 40  (싸움에서 쓰러지지 않게 해 끝까지 간다. 사건으로 몸이 축나 쓰러지는 일은 그대로 둔다)
import { readFile } from "node:fs/promises";
import { loadData, DB } from "../www/js/data.js";
await loadData(async (n) => JSON.parse(await readFile(new URL(`../www/data/${n}.json`, import.meta.url), "utf-8")));
const { Game } = await import("../www/js/game.js");
const { eventView } = await import("../www/js/events.js");
const { loadMeta, saveMeta } = await import("../www/js/meta.js");
const { pickArts } = await import("./arts.js");
const { personalize } = await import("../www/js/rules.js");
const P = (p) => ({ ...p.person, sectWord: "사문" });
const c = (l) => l[Math.floor(Math.random() * l.length)];
const errs = {}; const bad = {};
const note = (m, k) => { m[k] = (m[k] || 0) + 1; };
const ACTS = ["기본공격", "기본공격", "비기", "심법", "경공", "도주", "소비품"];
const N = +process.argv[2] || 100;
const origins = [...DB.origins.order, ...DB.origins.side_order];
let turns = 0, ends = {};
for (let r = 0; r < N; r++) {
  const m = loadMeta();
  m.unlocked_origins = Object.keys(DB.origins.origins); m.unlocked_traits = Object.keys(DB.traits);
  m.total_karma = 900; m.difficulty_cleared = [...DB.difficulty.order];
  m.manor = Object.fromEntries(Object.keys(DB.karma.manor.wings).map((k) => [k, Math.floor(Math.random() * 4)]));
  m.manor_gate = Math.random() < 0.5 ? 1 : 0;
  saveMeta(m);
  const g = new Game();
  const diff = c(DB.difficulty.order);
  try { g.start(c(origins), [], [], { gender: c(["남", "여"]) }, diff); } catch (e) { note(errs, "start " + e.stack.split("\n").slice(0, 2).join(" | ")); continue; }
  for (let i = 0; i < 6000 && g.player.alive && !g.ending; i++) {
    const p = g.player;
    try {
      for (const k of ["hp", "qi", "silver", "fame"]) if (!Number.isFinite(p[k])) note(bad, `${k} ${p[k]}`);
      for (const [k, v] of ["external","internal","martial","mind"].map((k) => [k, p[k]])) if (!Number.isFinite(v) || v > 999 || v < 0) note(bad, `stat ${k} ${v}`);
      if (g.event) {
        const v = eventView(p, g.event.key);
        for (const ch of v.choices) if (/undefined|NaN|〈|\$\{/.test(personalize(ch.label, P(p)))) note(bad, `label ${g.event.key} ${personalize(ch.label, P(p))}`);
        if (/undefined|NaN|〈|\$\{/.test(personalize(v.text, P(p)))) note(bad, `text ${g.event.key} ${personalize(v.text, P(p)).match(/.{0,30}(undefined|NaN|〈|\$\{).{0,30}/)?.[0]}`);
        const open = v.choices.filter((x) => !x.locked);
        if (!open.length) { note(bad, "NOCHOICE " + g.event.key); break; }
        g.chooseEvent(c(open).index);
      } else if (g.battle) {
        // 쓰러지지 않게 할 때는 체력을 채우고, 쓰러지는 순간 선천진기를 깨울 기회를 늘 남겨 둔다
        if (process.env.IMMORTAL) { p.hp = p.maxHp(); p.revives = 99; }
        if (g.battle.interlude) { g.battleInterlude(0); continue; }
        if (g.battle.standPending) { g.battleStand(process.env.IMMORTAL ? true : Math.random() < 0.7); continue; }
        pickArts(p);
        const inv = Object.keys(p.inventory).filter((k) => DB.market[k]?.consumable);
        const a = c(ACTS);
        g.battleAction(a, a === "소비품" ? c(inv) : null);
        if (g.battle && g.battle.roundNum > 300) { note(bad, "long battle " + g.battle.enemy.key); break; }
      } else if (g.market) {
        const st = g.market.stock.filter((s) => s.left > 0);
        if (st.length && Math.random() < 0.6) g.marketBuy(c(st).key);
        else if (Object.keys(p.inventory).length && Math.random() < 0.2) g.marketSell(c(Object.keys(p.inventory)));
        else g.marketLeave();
      } else if (g.pendingNext) { turns++; g.advanceTurn(); }
      else if (g.pickingArts) { g.finishArtsPick?.(); }
      else {
        if (Math.random() < 0.1 && Object.keys(p.inventory).length) g.useItem(c(Object.keys(p.inventory)));
        if (Math.random() < 0.05 && p.skills?.length) g.setMainSkill(c(p.skills).key);
        g.action(p.hp < p.maxHp() * 0.4 ? "휴식" : c(["탐색", "탐색", "수련", "명상", "휴식"]));
      }
      for (const l of g.log.slice(-8)) if (/undefined|NaN|\[object|〈|\$\{/.test(personalize(l, P(p)))) note(bad, "log " + personalize(l, P(p)).slice(0, 90));
    } catch (e) { note(errs, e.message + " @ " + (e.stack.split("\n")[1] || "").trim()); break; }
  }
  note(ends, g.ending?.key || (g.player.alive ? "멈춤" : "사망"));
  if (g.player.alive && !g.ending) console.log("STALL t" + g.player.turn, !!g.event && g.event.key, !!g.battle, !!g.market, g.pendingNext);
}
console.log("turns", turns, JSON.stringify(ends));
console.log("ERR", JSON.stringify(errs, null, 1));
console.log("BAD", JSON.stringify(bad, null, 1));
