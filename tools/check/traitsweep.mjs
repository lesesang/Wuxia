// 범용 자질 하나씩을 끼고 여러 판을 돌려, 아무 자질도 없을 때와 견준다.
//   WORLD=혈풍 node tools/check/traitsweep.mjs 300 [자질1,자질2,없음]   (SETUP=초반이면 첫 판에 가까운 바탕)
import { play, unlockAll } from "../simulate.js";
import { DB } from "../../www/js/data.js";
const count = Number(process.argv[2] || 100);
const only = process.argv[3];
const shard = process.env.SHARD ? process.env.SHARD.split("/").map(Number) : [0, 1];
unlockAll();
// SETUP=초반이면 기틀 한 단계와 누적 30, 기본은 중반(기틀 절반과 누적 120)
const EARLY = process.env.SETUP === "초반";
const UP = EARLY ? { 강골: 1, 혜안: 1, 원기: 1, 명경: 1, 감각: 1, 약상자: 1 } : { 강골: 2, 혜안: 2, 원기: 2, 명경: 2, 감각: 2, 재물: 1, 약상자: 2, 기연: 1, 깨달음: 1 };
const TOTAL = EARLY ? 30 : 120;
const keys = ["(없음)", ...Object.keys(DB.traits).filter((k) => !DB.traits[k].origin && !DB.traits[k].hidden)]
  .filter((k, i) => (!only || only.split(",").some((o) => k === o || (o === "없음" && k === "(없음)"))) && i % shard[1] === shard[0]);
for (const key of keys) {
  const rs = Array.from({ length: count }, () => play({ total: TOTAL, traits: key === "(없음)" ? [] : [key], upgrades: UP }));
  const win = rs.filter((r) => ["배드", "기본", "생사경"].includes(r.ending)).length / count;
  const turn = rs.reduce((t, r) => t + r.player.turn, 0) / count;
  const avg = rs.reduce((t, r) => t + (r.player.external + r.player.internal + r.player.martial + r.player.mind) / 4, 0) / count;
  console.log(`${key}\t${DB.traits[key]?.cost ?? 0}\t격파 ${(win * 100).toFixed(0)}\t달 ${turn.toFixed(0)}\t기량 ${avg.toFixed(0)}`);
}
