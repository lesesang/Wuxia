// 사건 빈도 재기: 한 판에 선택지가 있는 사건을 몇 번 만나는지, 장마다 남는 사건이 얼마인지 센다.
//   node tools/check/eventcount.mjs 20 [출신] [강호]
import { readFile } from "node:fs/promises";
import { loadData, DB } from "../../www/js/data.js";
await loadData(async (n) => JSON.parse(await readFile(new URL(`../../www/data/${n}.json`, import.meta.url), "utf-8")));
const { Game } = await import("../../www/js/game.js");
const { eventView, pickRandomEvent, pickActionEvent } = await import("../../www/js/events.js");
const { loadMeta, saveMeta } = await import("../../www/js/meta.js");
const { pickArts } = await import("../arts.js");
const c = (l) => l[Math.floor(Math.random() * l.length)];
const N = +process.argv[2] || 20, ORIGIN = process.argv[3] || "무림초출", DIFF = process.argv[4] || "강호";
const tot = { 사건: 0, 줄거리: 0, 달: 0, 고른수: 0, 바닥난달: 0, 수련사건없음: 0 }; const byCh = [0, 0, 0, 0, 0, 0]; const left = [0, 0, 0, 0, 0, 0];
for (let r = 0; r < N; r++) {
  const m = loadMeta();
  m.unlocked_origins = Object.keys(DB.origins.origins); m.total_karma = 900; m.difficulty_cleared = [...DB.difficulty.order];
  m.content = Object.keys(DB.karma.content); saveMeta(m);
  const g = new Game();
  g.start(ORIGIN, [], [], { gender: "남" }, DIFF);
  let last = null;
  for (let i = 0; i < 8000 && g.player.alive && !g.ending; i++) {
    const p = g.player;
    if (g.event) {
      const key = g.event.key;
      if (key !== last) { last = key; tot.고른수++; if (DB.storyEvents[key]) tot.줄거리++; else { tot.사건++; byCh[Math.min(5, Math.ceil(p.turn / 24))]++; } }
      const open = eventView(p, key).choices.filter((x) => !x.locked);
      g.chooseEvent(c(open).index);
    } else if (g.battle) {
      p.hp = p.maxHp();
      if (g.battle.interlude) { g.battleInterlude(0); continue; }
      if (g.battle.standPending) { g.battleStand(true); continue; }
      pickArts(p); g.battleAction("기본공격");
    } else if (g.market) g.marketLeave();
    else if (g.pendingNext) {
      if (p.turn % 24 === 0) {
        const ch = p.turn / 24; const before = p.turn;
        // 이 장에서 아직 만나지 않은 무작위 사건 수
        left[ch] += Object.keys(DB.randomEvents).filter((k) => { const e = DB.randomEvents[k]; return !e.action && !e.manor_event && !e.legacy_find && (e.chapters || []).includes(ch) && !p.seenEvents.includes(k); }).length;
      }
      if (!pickRandomEvent(p)) tot.바닥난달++;
      if (!pickActionEvent(p, "수련") && !pickActionEvent(p, "명상") && !pickActionEvent(p, "휴식")) tot.수련사건없음++;
      tot.달++; last = null; g.advanceTurn();
    } else if (g.pickingArts) g.finishArtsPick?.();
    else g.action(c(["탐색", "탐색", "수련", "명상", "휴식"]));
  }
}
console.log(ORIGIN, DIFF, "판마다", Object.fromEntries(Object.entries(tot).map(([k, v]) => [k, +(v / N).toFixed(1)])), "장별 사건", byCh.slice(1).map((v) => +(v / N).toFixed(1)), "장 끝에 남은 무작위 사건(조건 무시)", left.slice(1).map((v) => Math.round(v / N)));
