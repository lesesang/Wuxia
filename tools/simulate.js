// 밸런스 확인 도구: 규칙대로 움직이는 봇이 게임을 여러 번 끝까지 플레이한다.
//   node tools/simulate.js 300            (조건마다 300판)
//   node tools/simulate.js 300 시장       (이름에 "시장"이 들어간 조건만)
import { readFile } from "node:fs/promises";
import { loadData } from "../www/js/data.js";
import { eventView } from "../www/js/events.js";
import { Game } from "../www/js/game.js";
import { blockReason, buy } from "../www/js/market.js";
import { loadMeta, saveMeta } from "../www/js/meta.js";
import { DB } from "../www/js/data.js";

await loadData(async (name) => JSON.parse(await readFile(new URL(`../www/data/${name}.json`, import.meta.url), "utf-8")));

const STYLES = {
  섞어서: ["탐색", "탐색", "수련", "명상"],
  "탐색 위주": ["탐색", "탐색", "탐색", "수련"],
  "수련 위주": ["수련", "명상", "수련", "명상", "탐색"],
};
const choice = (list) => list[Math.floor(Math.random() * list.length)];

function unlockAll() {
  const data = loadMeta();
  data.unlocked_origins = Object.keys(DB.origins.origins);
  data.unlocked_traits = Object.keys(DB.traits);
  data.total_karma = 100;
  saveMeta(data);
}

function buyPriority(key) {
  const item = DB.market[key];
  const kinds = item.effects.map((e) => e.type);
  if (kinds.includes("equip")) return 0;
  if (kinds.includes("skill")) return 1;
  if (item.consumable) return 2;
  return 3;
}

function battleChoice(game) {
  const { player, battle } = game;
  const skill = player.bestSkill();
  const hpRatio = player.hp / player.maxHp();
  if (battle.poison && player.inventory.해독단) return ["소비품", "해독단"];
  if (battle.sealed && player.bestOfType("심공")) return ["심법"];
  if (hpRatio < 0.35) {
    for (const key of ["구명단", "금창약"]) if (player.inventory[key]) return ["소비품", key];
  }
  const movement = player.bestOfType("경공");
  if (battle.enemy.specialForRound(battle.roundNum + 1) && movement && player.qi >= movement.qiCost) return ["경공"];
  if (skill?.secretUnlocked && player.qi >= skill.secretQiCost) return ["비기"];
  if (skill && player.qi < skill.qiCost && player.bestOfType("심공")) return ["심법"];
  if (hpRatio < 0.25 && !battle.isFinal && battle.enemy.hp > battle.enemy.maxHp * 0.4) return ["도주"];
  return ["기본공격"];
}

function setUpgrades(upgrades = {}) {
  const data = loadMeta();
  data.upgrades = upgrades;
  data.total_karma = 200;
  saveMeta(data);
}

const ALL_UPGRADES = { 근골: 3, 심지: 3, 감각: 3, 재물: 3, 약상자: 3, 기연: 3, 깨달음: 3, 인맥: 3 };

function play({ style = "섞어서", useMarket = true, origin = "무림초출", traits = [], upgrades = {} }) {
  setUpgrades(upgrades);
  const game = new Game();
  game.start(origin, traits);
  for (let i = 0; i < 3000 && game.player.alive; i++) {
    const p = game.player;
    if (game.event && DB.events[game.event.key].prelude) {
      // 사람은 대개 지금 무공에 맞는 무기를 고른다
      const list = eventView(p, game.event.key).choices;
      const own = list.find((c) => DB.events[game.event.key].choices[c.index]?.outcomes[0].effects.start_weapon === p.bestSkill().category);
      game.chooseEvent((own || choice(list)).index);
    } else if (game.event) {
      const view = eventView(p, game.event.key);
      const open = view.choices.filter((c) => !c.locked);
      const top = p.dominantAlignment();
      const special = top && open.find((c) => c.label.startsWith(`(${top})`) && !c.label.includes("무릎"));
      game.chooseEvent((special || choice(open)).index);
    } else if (game.market) {
      const keys = useMarket ? game.market.stock
        .filter((s) => s.left > 0 && !blockReason(p, s.key) && s.key !== "혈마단").map((s) => s.key) : [];
      if (keys.length) game.marketBuy(keys.sort((a, b) => buyPriority(a) - buyPriority(b))[0]);
      else game.marketLeave();
    } else if (game.battle) {
      game.battleAction(...battleChoice(game));
    } else if (game.pendingNext) {
      game.advanceTurn();
    } else {
      let hurt = p.hp < p.maxHp() * 0.55 || p.injury >= 2;
      if (p.turn >= 118 && (p.hp < p.maxHp() * 0.9 || p.qi < p.maxQi() * 0.7)) hurt = true;
      if (hurt && p.inventory.활혈단 && p.injury >= 2) {
        game.useItem("활혈단");
        continue;
      }
      game.action(hurt ? "휴식" : choice(STYLES[style]));
    }
  }
  return { ending: game.ending?.key ?? "없음", player: game.player };
}

const ROWS = [
  ["첫 판(아무것도 없음)", {}],
  ["초반(특성 1, 강화 조금)", { traits: ["천생근골"], upgrades: { 근골: 1, 심지: 1, 감각: 1, 약상자: 1 } }],
  ["중반(특성 2, 강화 절반)", { traits: ["천생근골", "오성"], upgrades: { 근골: 2, 심지: 2, 감각: 2, 재물: 1, 약상자: 2, 기연: 1, 깨달음: 1 } }],
  ["완성(특성 3, 강화 전부)", { traits: ["천하제일기재", "천생근골", "오성"], upgrades: ALL_UPGRADES }],
  ["탐색 위주 / 시장 이용", { style: "탐색 위주" }],
  ["수련 위주 / 시장 이용", { style: "수련 위주" }],
  ["섞어서 / 시장 안 씀", { useMarket: false }],
  ["섞어서 / 남궁세가", { origin: "남궁세가" }],
  ["섞어서 / 곤륜파", { origin: "곤륜파" }],
  ["섞어서 / 하오문", { origin: "하오문" }],
  ["섞어서 / 권마계승", { origin: "권마계승" }],
  ["탐색 위주 / 특성 1개", { style: "탐색 위주", traits: ["천생근골"] }],
  ["탐색 위주 / 특성 3개", { style: "탐색 위주", traits: ["천하제일기재", "천생근골", "오성"] }],
];

const count = Number(process.argv[2] || 100);
const filter = process.argv[3];
unlockAll();
for (const [name, options] of ROWS) {
  if (filter && !name.includes(filter)) continue;
  const results = Array.from({ length: count }, () => play(options));
  const tally = {};
  for (const r of results) tally[r.ending] = (tally[r.ending] || 0) + 1;
  const wins = results.filter((r) => ["배드", "기본", "생사경"].includes(r.ending)).length;
  const reached = results.filter((r) => r.player.turn >= 120).length;
  const avg = results.reduce((t, r) => t + (r.player.external + r.player.internal + r.player.martial + r.player.mind) / 4, 0) / count;
  console.log(`${name}: 격파 ${Math.round(wins * 100 / count)}%, 120달 도달 ${Math.round(reached * 100 / count)}%, 평균 능력치 ${avg.toFixed(0)}`, JSON.stringify(tally));
}
