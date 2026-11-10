// 자질, 출신, 무기 계열, 성향별 격파율을 잰다.
//   node tools/balance_report.js 150 [자질|출신|계열|성향|곡선]
import { readFile } from "node:fs/promises";
import { pickArts } from "./arts.js";
import { DB, loadData } from "../www/js/data.js";
import { eventView } from "../www/js/events.js";
import { Game } from "../www/js/game.js";
import { blockReason } from "../www/js/market.js";
import { loadMeta, saveMeta } from "../www/js/meta.js";

await loadData(async (name) => JSON.parse(await readFile(new URL(`../www/data/${name}.json`, import.meta.url), "utf-8")));

const choice = (list) => list[Math.floor(Math.random() * list.length)];
const WIN = ["배드", "기본", "생사경"];
const BASE_UPGRADES = { 강골: 1, 혜안: 1, 원기: 1, 명경: 1, 감각: 1, 약상자: 1 };

function battleChoice(game) {
  const { player, battle } = game;
  const skill = player.bestSkill();
  const hpRatio = player.hp / player.maxHp();
  if (battle.poison && player.inventory.해독단) return ["소비품", "해독단"];
  if (battle.sealed && player.bestOfType("심공")) return ["심법"];
  if (hpRatio < 0.35) for (const key of ["구명단", "금창약"]) if (player.inventory[key]) return ["소비품", key];
  const movement = player.bestOfType("경공");
  // 꺾을 수 있는 필살기는 비기로 꺾으려 든다
  if (battle.nextBreakNeed() && skill?.secretUnlocked && player.qi >= skill.secretQiCost && !battle.sealed) return ["비기"];
  if (battle.enemy.specialForRound(battle.roundNum + 1) && movement && player.qi >= movement.qiCost) return ["경공"];
  if (skill?.secretUnlocked && player.qi >= skill.secretQiCost) return ["비기"];
  if (skill && player.qi < skill.qiCost && player.bestOfType("심공")) return ["심법"];
  if (hpRatio < 0.25 && !battle.isFinal && battle.enemy.hp > battle.enemy.maxHp * 0.4) return ["도주"];
  return ["기본공격"];
}

function rank(key) {
  const types = DB.market[key].effects.map((e) => e.type);
  if (types.includes("equip")) return 0;
  if (types.includes("skill")) return 1;
  return DB.market[key].consumable ? 2 : 3;
}

/** 한 판을 끝까지 돌리고 결과를 돌려준다. side를 주면 그 성향이 오르는 선택지를 먼저 고른다. */
export function play({ origin = "무림초출", traits = [], upgrades = BASE_UPGRADES, total = 40, style = null, side = null, content = [], watch = null }) {
  const data = loadMeta();
  data.unlocked_origins = Object.keys(DB.origins.origins);
  data.unlocked_traits = Object.keys(DB.traits);
  data.upgrades = upgrades;
  data.total_karma = total;
  data.content = content;
  data.provisions = [];
  saveMeta(data);
  const game = new Game();
  game.start(origin, traits);
  for (let i = 0; i < 4000 && game.player.alive; i++) {
    const p = game.player;
    if (watch) watch(game);
    if (game.event) {
      const event = DB.events[game.event.key];
      const open = eventView(p, game.event.key).choices.filter((c) => !c.locked);
      const start = style && event.prelude && open.find((c) => event.choices[c.index]?.outcomes[0].effects.start_weapon === style);
      const lean = side && open.find((c) => {
        const all = [...(event.variants || []).filter((v) => v.choices).flatMap((v) => v.choices), ...event.choices];
        return all.find((x) => x.label === c.label)?.outcomes.some((o) => o.effects?.alignment?.[side] > 0 && !o.effects.ending);
      });
      const plain = open.filter((c) => {
        const all = [...(event.variants || []).filter((v) => v.choices).flatMap((v) => v.choices), ...event.choices];
        return !all.find((x) => x.label === c.label)?.outcomes.some((o) => o.effects?.ending);
      });
      // 한 길에 집중하는 무인은 다른 길로 기우는 선택을 되도록 피한다
      const neutral = side ? plain.filter((c) => {
        const all = [...(event.variants || []).filter((v) => v.choices).flatMap((v) => v.choices), ...event.choices];
        return !all.find((x) => x.label === c.label)?.outcomes.some((o) => Object.entries(o.effects?.alignment || {}).some(([k, v]) => k !== side && v > 0));
      }) : [];
      game.chooseEvent((start || lean || choice(neutral.length ? neutral : plain.length ? plain : open)).index);
    } else if (game.market) {
      const keys = game.market.stock.filter((s) => s.left > 0 && !blockReason(p, s.key) && DB.market[s.key].category !== "도구" && s.key !== "혈마단").map((s) => s.key);
      if (keys.length) game.marketBuy(keys.sort((a, b) => rank(a) - rank(b))[0]);
      else game.marketLeave();
    } else if (game.battle) {
      if (game.battle.interlude) { game.battleInterlude(0); continue; }
      pickArts(p);
      game.battleAction(...battleChoice(game));
    } else if (game.pendingNext) {
      game.advanceTurn();
    } else {
      let hurt = p.hp < p.maxHp() * 0.55 || p.injury >= 2;
      if (p.turn >= 118 && (p.hp < p.maxHp() * 0.9 || p.qi < p.maxQi() * 0.7)) hurt = true;
      game.action(hurt ? "휴식" : choice(["탐색", "탐색", "수련", "명상"]));
    }
  }
  return game;
}

function rate(count, options) {
  let wins = 0; let reached = 0; let top = 0; let weaken = 0; let silver = 0;
  for (let i = 0; i < count; i++) {
    const g = play(options);
    if (WIN.includes(g.ending?.key)) wins += 1;
    if (g.player.turn >= 120) reached += 1;
    if (g.ending?.key === "생사경") top += 1;
    weaken += g.player.bossWeaken;
    silver += g.player.silver;
  }
  return { win: Math.round(wins * 100 / count), reach: Math.round(reached * 100 / count), top: Math.round(top * 100 / count), weaken: Math.round(weaken / count), silver: Math.round(silver / count) };
}

const count = Number(process.argv[2] || 100);
const part = process.argv[3];
const show = (name, r, extra = "") => console.log(`${name.padEnd(14)} 격파 ${String(r.win).padStart(3)}%  도달 ${String(r.reach).padStart(3)}%  생사경 ${String(r.top).padStart(2)}%  약화 ${r.weaken}  은자 ${r.silver} ${extra}`);

if (part === "네기량") {
  show("기준", rate(count, {}));
  for (const key of ["강건한_육체", "선천진기", "타고난안목", "총명", "천둥벌거숭이", "병약한몸", "잔재주꾼", "저잣거리아이", "천생근골", "오성", "혼원지체", "철심석장", "통현지재", "혜근"]) show(DB.traits[key].name, rate(count, { traits: [key] }));
}
if (part === "기틀") {
  show("기준", rate(count, { upgrades: {} , total: 0}));
  for (const [key, u] of Object.entries(DB.karma.upgrades)) {
    if (u.origin || key === "그릇") continue;
    show(u.name, rate(count, { upgrades: { [key]: u.costs.length }, total: 0 }), `${u.costs.join(",")}`);
  }
}
if (!part || part === "자질") {
  const base = rate(count * 3, {});
  show("기준(자질 없음)", base);
  const rows = Object.entries(DB.traits).filter(([, t]) => !t.hidden && !t.origin)
    .map(([key, t]) => [t, rate(count, { traits: [key] })]).sort((a, b) => b[1].win - a[1].win);
  for (const [t, r] of rows) show(t.name, r, `${t.rarity} ${t.cost}`);
}
if (!part || part === "출신") {
  for (const key of DB.origins.order) show(DB.origins.origins[key].name.slice(0, 10), rate(count, { origin: key }));
  for (const [key, t] of Object.entries(DB.traits)) if (t.origin) show(t.name, rate(count, { origin: t.origin, traits: [key] }), `${t.origin}`);
}
if (!part || part === "계열") {
  for (const style of ["검법", "도법", "창법", "봉법", "권법", "장법", "암기"]) show(style, rate(count, { style }));
}
if (!part || part === "성향") {
  for (const side of ["정도", "사도", "마도"]) show(side, rate(count, { side }));
}
if (!part || part === "곡선") {
  const levels = [["기본", {}]];
  for (const [name, o] of levels) show(name, rate(count, o));
}
