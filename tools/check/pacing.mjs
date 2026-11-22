// 강호행의 흐름 재기: 균형 확인 봇(tools/simulate.js)이 끝까지 걷는 동안 달마다 무슨 일이 있었는지(사건, 싸움, 아무 일 없음) 적는다.
// 아무 일 없는 달이 몇 달씩 이어지는지, 한 판에 새로 보는 사건이 몇이고 모두 보려면 몇 판이 드는지 잰다.
//   node tools/check/pacing.mjs 30 [출신] [강호] [바탕: 첫판|중반|완성]
import { play, unlockAll, ALL_UPGRADES } from "../simulate.js";
import { DB } from "../../www/js/data.js";
const N = +process.argv[2] || 30, ORIGIN = process.argv[3] || "무림초출", DIFF = process.argv[4] || "강호", BASE = process.argv[5] || "중반";
const SETUP = { 첫판: {}, 중반: { total: 120, traits: ["천생근골", "오성"], upgrades: { 강골: 2, 혜안: 2, 원기: 2, 명경: 2, 감각: 2, 재물: 1, 약상자: 2, 기연: 1, 깨달음: 1 } },
  완성: { total: 400, traits: ["천하제일기재", "천생근골", "오성"], upgrades: ALL_UPGRADES } }[BASE];
unlockAll();
const seenAll = new Set(); const curve = [];
const sum = { 달: 0, 사건달: 0, 싸움달: 0, 빈달: 0, 가장긴빈: 0, 사건: 0, 싸움: 0, 끝달: 0, 결말: 0 };
const byCh = Array.from({ length: 6 }, () => ({ 달: 0, 사건: 0, 싸움: 0, 빈: 0 }));
const foeNames = {}; const repeats = { 같은달같은적: 0 };
for (let r = 0; r < N; r++) {
  let month = null, cur = { 사건: 0, 싸움: 0 }, streak = 0, longest = 0, lastEv = null, lastBattle = null;
  const close = (turn) => {
    if (month === null) return;
    const ch = Math.min(5, Math.ceil(Math.max(1, month) / 24));
    sum.달++; byCh[ch].달++;
    if (cur.사건) { sum.사건달++; byCh[ch].사건++; }
    if (cur.싸움) { sum.싸움달++; byCh[ch].싸움++; }
    sum.사건 += cur.사건; sum.싸움 += cur.싸움;
    if (!cur.사건 && !cur.싸움) { sum.빈달++; byCh[ch].빈++; streak++; longest = Math.max(longest, streak); } else streak = 0;
    cur = { 사건: 0, 싸움: 0 };
  };
  const res = play({ ...SETUP, origin: ORIGIN, world: DIFF, observe: (g) => {
    const t = g.player.turn;
    if (t !== month) { close(t); month = t; lastEv = null; }
    if (g.event && g.event.key !== lastEv) { lastEv = g.event.key; cur.사건++; seenAll.add(g.event.key); }
    if (g.battle && g.battle !== lastBattle) { lastBattle = g.battle; cur.싸움++; const n = g.battle.enemy.name; foeNames[n] = (foeNames[n] || 0) + 1; }
  } });
  close();
  sum.가장긴빈 += longest; sum.끝달 += Math.min(res.player.turn, res.player.maxTurn); if (res.ending !== "사망") sum.결말++;
  curve.push(seenAll.size);
}
const pool = Object.keys(DB.randomEvents).filter((k) => !DB.randomEvents[k].manor_event).length + Object.keys(DB.storyEvents).length;
const f = (v) => +(v / N).toFixed(1);
console.log(`${ORIGIN} ${DIFF} ${BASE} ${N}판, 끝까지 간 판 ${Math.round(sum.결말 * 100 / N)}%`);
console.log(`한 판: ${f(sum.끝달)}달, 사건 ${f(sum.사건)}번(사건 있는 달 ${Math.round(sum.사건달 * 100 / sum.달)}%), 싸움 ${f(sum.싸움)}번(싸움 있는 달 ${Math.round(sum.싸움달 * 100 / sum.달)}%), 아무 일 없는 달 ${Math.round(sum.빈달 * 100 / sum.달)}%, 가장 길게 이어진 빈 달 평균 ${f(sum.가장긴빈)}달`);
console.log("장마다 사건/싸움/빈 달 %:", byCh.slice(1).map((c, i) => `${i + 1}장 ${Math.round(c.사건 * 100 / Math.max(1, c.달))}/${Math.round(c.싸움 * 100 / Math.max(1, c.달))}/${Math.round(c.빈 * 100 / Math.max(1, c.달))}`).join(", "));
console.log(`본 사건 누적(판 1, 3, 5, 10, 20, 끝): ${[1, 3, 5, 10, 20, N].filter((x) => x <= N).map((x) => curve[x - 1]).join(", ")} / 사건 모두 약 ${pool}`);
console.log("판마다 자주 만나는 적:", Object.entries(foeNames).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([n, c]) => `${n} ${f(c)}`).join(", "));
