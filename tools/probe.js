// 난이도 곡선 측정: 해마다 플레이어의 강함과 전투 소모, 챕터별 사망률을 본다.
//   node tools/probe.js 300 [출신]
import { equipBestGear } from "../www/js/events.js";
import { readFile } from "node:fs/promises";
import { pickArts } from "./arts.js";
import { Battle } from "../www/js/battle.js";
import { DB, loadData } from "../www/js/data.js";
import { eventView } from "../www/js/events.js";
import { Game } from "../www/js/game.js";
import { blockReason } from "../www/js/market.js";
import { loadMeta, saveMeta } from "../www/js/meta.js";
import { getChapter } from "../www/js/rules.js";
import { equipmentBonus } from "../www/js/market.js";

await loadData(async (name) => JSON.parse(await readFile(new URL(`../www/data/${name}.json`, import.meta.url), "utf-8")));

const count = Number(process.argv[2] || 200);
const origin = process.argv[3] || "무림초출";
const meta = loadMeta();
meta.unlocked_origins = Object.keys(DB.origins.origins);
saveMeta(meta);

const choice = (l) => l[Math.floor(Math.random() * l.length)];
const years = Array.from({ length: 11 }, () => ({ n: 0, atk: 0, hp: 0, armor: 0, avg: 0, silver: 0, battles: 0, realm: {} }));
const chapters = Array.from({ length: 6 }, () => ({ fights: 0, rounds: 0, lost: 0, deaths: 0, tier: {} }));
let wins = 0; let reach = 0; const endings = {};

function battleChoice(game) {
  const { player, battle } = game;
  const skill = player.bestSkill();
  const hpRatio = player.hp / player.maxHp();
  if (battle.poison && player.inventory.해독단) return ["소비품", "해독단"];
  if (battle.sealed && player.bestOfType("심공")) return ["심법"];
  if (hpRatio < 0.35) for (const k of ["구명단", "금창약"]) if (player.inventory[k]) return ["소비품", k];
  const movement = player.bestOfType("경공");
  if (battle.enemy.specialForRound(battle.roundNum + 1) && movement && player.qi >= movement.qiCost) return ["경공"];
  if (skill?.secretUnlocked && player.qi >= skill.secretQiCost) return ["비기"];
  if (skill && player.qi < skill.qiCost && player.bestOfType("심공")) return ["심법"];
  if (hpRatio < 0.25 && !battle.isFinal && battle.enemy.hp > battle.enemy.maxHp * 0.4) return ["도주"];
  return ["기본공격"];
}

for (let run = 0; run < count; run++) {
  const game = new Game();
  // 판마다 쌓이는 카르마가 누적 보상으로 끼어들지 않게 한다
  const fresh = loadMeta();
  fresh.total_karma = 0;
  saveMeta(fresh);
  game.start(origin);
  let lastYear = -1; let fight = null;
  for (let i = 0; i < 6000 && game.player.alive; i++) {
    const p = game.player;
    const y = Math.floor((p.turn - 1) / 12) + 1;
    if (y !== lastYear && !game.battle && y <= 10) {
      lastYear = y;
      const b = new Battle(p, { armor: 0, evasion: 0 });
      const s = years[y];
      s.n++; s.atk += b.attackPower(p.bestSkill()); s.hp += p.maxHp(); s.armor += equipmentBonus(p, "armor");
      s.avg += (p.external + p.internal + p.martial + p.mind) / 4; s.silver += p.silver; s.battles += p.battles;
      s.realm[p.realm] = (s.realm[p.realm] || 0) + 1;
    }
    if (game.battle && (!fight || fight.battle !== game.battle)) {
      fight = { battle: game.battle, hp: p.hp, ch: getChapter(p.turn), tier: game.battle.enemy.tier };
    }
    const wasBattle = game.battle;
    if (!game.battle) equipBestGear(game.player); // 사람은 더 좋은 병장기를 얻으면 바꿔 든다
    // 사람은 행낭의 영약과 책을 그때그때 먹고 읽는다
    if (!game.battle && !game.event) {
      for (const key of Object.keys(game.player.inventory)) {
        const item = DB.market[key];
        if (item && !item.battle_only && item.effects.some((e) => ["stat", "mastery"].includes(e.type))) game.useItem(key);
      }
    }
    if (game.event && DB.events[game.event.key].prelude) {
      // 사람은 대개 지금 무공에 맞는 무기를 고른다
      const list = eventView(p, game.event.key).choices;
      const own = list.find((c) => DB.events[game.event.key].choices[c.index]?.outcomes[0].effects.start_weapon === p.bestSkill().category);
      game.chooseEvent((own || choice(list)).index);
    } else if (game.event) {
      const open = eventView(p, game.event.key).choices.filter((c) => !c.locked);
      const top = p.dominantAlignment();
      game.chooseEvent((top && open.find((c) => c.label.startsWith(`(${top})`) && !c.label.includes("무릎")) || choice(open)).index);
    } else if (game.market) {
      const keys = game.market.stock.filter((s) => s.left > 0 && !blockReason(p, s.key) && DB.market[s.key].category !== "도구" && s.key !== "혈마단").map((s) => s.key);
      const rank = (k) => { const it = DB.market[k]; const t = it.effects.map((e) => e.type); return t.includes("equip") ? 0 : t.includes("skill") ? 1 : it.consumable ? 2 : 3; };
      if (keys.length) game.marketBuy(keys.sort((a, b) => rank(a) - rank(b))[0]); else game.marketLeave();
    } else if (game.battle) {
      pickArts(game.player);
      game.battleAction(...battleChoice(game));
    } else if (game.pendingNext) {
      game.advanceTurn();
    } else {
      let hurt = p.hp < p.maxHp() * 0.55 || p.injury >= 2;
      if (p.turn >= 118 && (p.hp < p.maxHp() * 0.9 || p.qi < p.maxQi() * 0.7)) hurt = true;
      game.action(hurt ? "휴식" : choice(["탐색", "탐색", "수련", "명상"]));
    }
    if (wasBattle && !game.battle || (wasBattle && game.battle !== wasBattle)) {
      if (fight && !wasBattle.isFinal) {
        const c = chapters[fight.ch];
        c.fights++; c.rounds += wasBattle.roundNum; c.lost += Math.max(0, fight.hp - p.hp) / p.maxHp();
        c.tier[fight.tier] = (c.tier[fight.tier] || 0) + 1;
      }
      fight = null;
    }
  }
  const p = game.player;
  endings[game.ending?.key] = (endings[game.ending?.key] || 0) + 1;
  if (p.turn >= 120) reach++; else chapters[getChapter(p.turn)].deaths++;
  if (["배드", "기본", "생사경"].includes(game.ending?.key)) wins++;
}

console.log(`${origin} ${count}판: 격파 ${Math.round(wins * 100 / count)}%, 120달 도달 ${Math.round(reach * 100 / count)}%`, JSON.stringify(endings));
console.log("년차  위력  체력  방어  평균능력  은자  전투경험  경지");
for (let y = 1; y <= 10; y++) {
  const s = years[y];
  if (!s.n) continue;
  const top = Object.entries(s.realm).sort((a, b) => b[1] - a[1])[0][0];
  console.log(`${String(y).padStart(3)} ${(s.atk / s.n).toFixed(0).padStart(7)} ${(s.hp / s.n).toFixed(0).padStart(5)} ${(s.armor / s.n).toFixed(0).padStart(5)} ${(s.avg / s.n).toFixed(0).padStart(7)} ${(s.silver / s.n).toFixed(0).padStart(6)} ${(s.battles / s.n).toFixed(0).padStart(7)}   ${top} (${s.n})`);
}
console.log("장   전투수/판  합  전투당체력소모  사망");
for (let c = 1; c <= 5; c++) {
  const s = chapters[c];
  console.log(`${c}장 ${(s.fights / count).toFixed(1).padStart(8)} ${(s.rounds / (s.fights || 1)).toFixed(1).padStart(7)} ${(s.lost * 100 / (s.fights || 1)).toFixed(0).padStart(9)}% ${String(s.deaths).padStart(8)}  ${JSON.stringify(s.tier)}`);
}
