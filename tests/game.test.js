import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { seed } from "./helpers.js";
import { listAssets } from "../tools/build_asset_list.js";
import { Battle, Enemy, statureEnemy, useConsumable } from "../www/js/battle.js";
import { GRADE_ORDER, Player, Skill } from "../www/js/character.js";
import { DB } from "../www/js/data.js";
import { applyEffects, grantStartGifts, canStartChain, checkRequires, enemyIntro, eventView, LAST_CHAIN_TURN, pickRandomEvent, resolveChoice, validateChains, validateEvents } from "../www/js/events.js";
import { buildEpilogue, Game } from "../www/js/game.js";
import { josa } from "../www/js/josa.js";
import { blockReason, buy, equipmentBonus, openMarket, priceOf } from "../www/js/market.js";
import {
  activeContent, addKarma, buyContent, buyProvision, refundProvision, upgradeTraits, buyUpgrade, exportRecords, importRecords, extraSlots, loadCheckpoint, legacyAvailable, loadEventLog, loadMeta, nextReward, recordEventPick, openLegacy, saveMeta, takeLegacy, toggleContent, unlockOrigin,
} from "../www/js/meta.js";
import { applyGrowth, breakthroughBlock, byname, fameRank, getChapter, getYear, marketTurns, traitSlots } from "../www/js/rules.js";
import { storage } from "../www/js/storage.js";

function newGame(origin = "무림초출") {
  const game = new Game();
  game.start(origin);
  // 강호초출은 번외 시간에 기초검법과 토납법을 고른다
  while (game.event && DB.events[game.event.key].prelude) {
    const index = DB.events[game.event.key].choices.findIndex((c) => {
      const e = c.outcomes[0].effects;
      return e.start_weapon === "검법" || e.start_mindset === "토납법";
    });
    game.chooseEvent(index);
  }
  if (game.event) firstChoice(game);
  return game;
}
function firstChoice(game) {
  game.chooseEvent(eventView(game.player, game.event.key).choices.find((c) => !c.locked).index);
}
function toTurnEnd(game, turn) {
  game.player.turn = turn;
  game.event = null;
  game.pendingNext = true;
}

// ---------- 데이터 ----------

test("이벤트 데이터가 올바르다", () => assert.deepEqual(validateEvents(), []));

test("이벤트 키가 파일끼리 겹치지 않는다", () => {
  const seen = new Set();
  for (const name of ["events_story", "events_random", "events_sect", "events_jianghu"]) {
    for (const key of Object.keys(DB[name])) {
      assert.ok(!seen.has(key), `겹침: ${key}`);
      seen.add(key);
    }
  }
});

test("시장, 특성, 출신이 실제 무공을 가리킨다", () => {
  for (const item of Object.values(DB.market)) {
    for (const e of item.effects) if (e.type === "skill") assert.ok(DB.skills[e.skill], e.skill);
  }
  for (const t of Object.values(DB.traits)) {
    for (const e of t.effects) if (e.type === "start_skill") assert.ok(DB.skills[e.skill]);
  }
  for (const o of Object.values(DB.origins.origins)) for (const k of o.skills) assert.ok(DB.skills[k]);
});

test("출신별 서장과 챕터 줄거리가 있다", () => {
  const stories = Object.values(DB.storyEvents);
  const prologues = new Set(stories.filter((e) => e.turn === 1 && !e.prelude).map((e) => e.requires.origin));
  assert.deepEqual([...prologues].sort(), Object.keys(DB.origins.origins).sort());
  const turns = stories.map((e) => e.turn);
  for (const t of [25, 49, 60, 73, 97, 115, 120]) assert.ok(turns.includes(t));
});

test("챕터마다 사건, 적이 충분하다", () => {
  for (let chapter = 1; chapter <= 5; chapter++) {
    assert.ok(Object.values(DB.randomEvents).filter((e) => e.chapters.includes(chapter)).length >= 5);
    assert.ok(Object.values(DB.enemies).some((e) => (e.chapters || []).includes(chapter)));
  }
});

// ---------- 설계 결정 ----------

test("능력치 상한은 999", () => {
  const p = new Player();
  p.external = 998;
  assert.equal(p.gainStat("external", 5), 1);
  assert.equal(p.external, 999);
});

test("출신 개방 비용은 무림초출 0, 나머지 5", () => {
  for (const [key, o] of Object.entries(DB.origins.origins)) assert.equal(o.cost, key === "무림초출" ? 0 : 5);
});

test("달은 다음 버튼으로만 넘어간다", () => {
  const game = newGame();
  game.advanceTurn();
  assert.equal(game.player.turn, 1);
  game.action("수련");
  assert.equal(game.player.turn, 1);
  const before = game.player.external;
  game.action("수련");
  assert.equal(game.player.external, before);
  game.advanceTurn();
  assert.equal(game.player.turn, 2);
});

test("도감은 다음 달 시작에 기록된다", () => {
  const game = newGame();
  game.player.pendingEncounters = ["산적"];
  assert.ok(!loadMeta().global_codex.includes("산적"));
  game.pendingNext = true;
  game.advanceTurn();
  assert.ok(loadMeta().global_codex.includes("산적"));
});

test("처치 보상은 능력치 2종, 등급 범위 안", () => {
  seed(1);
  const p = new Player();
  const before = [p.external, p.internal, p.martial, p.mind];
  const enemy = new Enemy("산적");
  enemy.hp = 1;
  const battle = new Battle(p, enemy);
  battle.hits = () => true;
  assert.ok(battle.runRound("기본공격").victory);
  const gains = [p.external, p.internal, p.martial, p.mind].map((v, i) => v - before[i]);
  assert.equal(gains.filter((g) => g > 0).length, 2);
  assert.ok(gains.every((g) => g >= 0 && g <= 20));
});

// ---------- 전투 ----------

test("무공 승급과 비기 터득", () => {
  const skill = new Skill("기초검법");
  const multiplier = skill.effectiveMultiplier();
  const messages = skill.gainMastery(101);
  assert.equal(skill.grade, "명품");
  assert.equal(skill.mastery, 30);
  assert.ok(messages.some((m) => m.includes("승급")));
  assert.ok(skill.effectiveMultiplier() > multiplier);
  assert.ok(skill.gainMastery(20).some((m) => m.includes("터득")));
});

test("무공은 기력을 쓰고 모자라면 맨손", () => {
  const p = new Player();
  const skill = p.bestSkill();
  const battle = new Battle(p, new Enemy("천마"));
  battle.useSkill(skill);
  assert.equal(p.qi, p.maxQi() - skill.qiCost);
  p.qi = 0;
  battle.useSkill(skill);
  assert.equal(p.qi, 0);
  assert.ok(battle.log.some((l) => l.includes("내력이 모자라")));
});

test("심법은 회복하고 점혈을 푼다", () => {
  const p = new Player("남궁세가");
  p.qi = 10;
  p.hp = 50;
  const battle = new Battle(p, new Enemy("산적"));
  battle.sealed = 2;
  battle.useMindset();
  assert.ok(p.qi > 10 && p.hp > 50 && battle.atkBuff);
  assert.equal(battle.sealed, 0);
});

test("점혈이면 무공을 쓰지 못한다", () => {
  const p = new Player();
  const battle = new Battle(p, new Enemy("천마"));
  battle.sealed = 1;
  const qi = p.qi;
  battle.useSkill(p.bestSkill());
  assert.equal(p.qi, qi);
});

test("경공은 실패해도 피해를 줄이고 성공하면 반격이 강해진다", () => {
  const p = new Player();
  p.learnSkill(new Skill("능공허도"));
  const skill = p.bestOfType("경공");
  const battle = new Battle(p, new Enemy("천마"));
  battle.roundNum = 1;
  seed(3);
  const results = Array.from({ length: 30 }, () => {
    p.hp = p.maxHp();
    return battle.enemyAttack(skill);
  });
  assert.ok(results.includes(0));
  assert.ok(battle.counterPct > 0);
  const hit = results.find((r) => r > 0);
  if (hit) assert.ok(hit < DB.enemies.천마.attack);
});

test("필살기는 직전 합에 예고된다", () => {
  const enemy = new Enemy("낭인");
  const battle = new Battle(new Player(), enemy);
  battle.roundNum = 2;
  assert.equal(battle.nextSpecialWarning(), "발도");
  assert.equal(enemy.specialForRound(3).name, "발도");
});

test("천마는 체력이 줄면 강해진다", () => {
  const enemy = new Enemy("천마");
  enemy.hp = Math.trunc(enemy.maxHp * 0.2);
  assert.ok(enemy.advancePhase() && enemy.advancePhase());
  assert.ok(enemy.attackMultiplier() > 1.2);
});

test("방어구가 있어도 피해는 최소 1", () => {
  const p = new Player();
  p.armor = "천잠보의";
  const battle = new Battle(p, new Enemy("산적"));
  battle.roundNum = 1;
  assert.ok(battle.enemyAttack() >= 1);
});

test("전투 임시 버프는 끝나면 되돌린다", () => {
  const p = new Player("무림초출", ["전투광"]);
  const base = p.external;
  const enemy = new Enemy("산적");
  const battle = new Battle(p, enemy);
  assert.equal(p.external, base + 40);
  battle.finish(false, true);
  assert.equal(p.external, base);
});

test("일반 전투 사망은 곧바로 엔딩과 카르마", () => {
  const game = newGame();
  game.player.hp = 1;
  game.startBattle("천마");
  for (let i = 0; i < 5 && game.battle; i++) game.battleAction("심법");
  assert.equal(game.ending.key, "사망");
  assert.equal(loadMeta().current_karma, 1);
  assert.equal(loadMeta().runs[0].ending, "사망");
  assert.equal(loadCheckpoint(), null);
  const ext = game.player.external;
  game.action("수련");
  assert.equal(game.player.external, ext);
});

test("천마는 엔딩 때 도감에 기록된다", () => {
  const game = newGame();
  game.player.hp = 1;
  toTurnEnd(game, 120);
  game.pendingNext = false;
  game.startFinalBattle();
  for (let i = 0; i < 5 && game.battle; i++) game.battleAction("심법");
  assert.ok(loadMeta().global_codex.includes("천마"));
});

test("최종전에서는 도망칠 수 없다", () => {
  const game = newGame();
  toTurnEnd(game, 119);
  game.advanceTurn();
  game.marketLeave();
  game.chooseEvent(0);
  assert.ok(game.battle.isFinal);
  game.battleAction("도주");
  assert.equal(game.battle.roundNum, 0);
  assert.equal(game.ending, null);
});

test("특성 불굴은 전투마다 한 번", () => {
  const p = new Player("무림초출", ["불굴"]);
  const battle = new Battle(p, new Enemy("천마"));
  battle.roundNum = 1;
  p.hp = 1;
  battle.enemyAttack();
  assert.equal(p.hp, 1);
  battle.enemyAttack();
  assert.equal(p.hp, 0);
});

test("금강불괴는 내상을 막는다", () => {
  const p = new Player("무림초출", ["금강불괴"]);
  p.addInjury(2);
  assert.equal(p.injury, 0);
});

test("내상은 피해를 줄이고 회복으로 낫는다", () => {
  const game = newGame();
  const battle = new Battle(game.player, new Enemy("천마"));
  const plain = battle.attackScale();
  game.player.addInjury(2);
  assert.ok(battle.attackScale() < plain);
  game.action("휴식");
  assert.equal(game.player.injury, 1);
});

test("적 중독은 합마다 피해를 준다", () => {
  const p = new Player();
  p.sect = "당가";
  const enemy = new Enemy("산적");
  const battle = new Battle(p, enemy);
  battle.hits = () => true;
  battle.useSkill(p.bestSkill());
  assert.ok(battle.enemyPoison);
  enemy.hp = 1;
  battle.tickEffects();
  assert.ok(!enemy.isAlive());
});

test("주화입마: 심경이 낮으면 마공 비기에 내상", () => {
  seed(1);
  const p = new Player();
  p.mind = 1;
  p.learnSkill(new Skill("천마파천공"));
  const skill = p.getSkill("천마파천공");
  skill.secretUnlocked = true;
  const battle = new Battle(p, new Enemy("천마"));
  for (let i = 0; i < 10; i++) {
    p.qi = p.maxQi();
    battle.useSecret(skill);
  }
  assert.ok(p.injury > 0);
});

test("초식 이름이 전투 문장에 나온다", () => {
  const p = new Player();
  const battle = new Battle(p, new Enemy("천마"));
  battle.hits = () => true;
  battle.useSkill(p.bestSkill());
  assert.ok(battle.log.some((l) => /제\d초 「/.test(l)));
});

// ---------- 이벤트와 성향 ----------

test("25달 줄거리는 행동을 쓰지 않고 고를 때까지 막는다", () => {
  const game = newGame();
  toTurnEnd(game, 24);
  game.advanceTurn();
  game.marketLeave();
  assert.equal(game.player.turn, 25);
  assert.equal(game.event.key, "2장_세력");
  game.action("수련");
  assert.ok(game.event);
  game.chooseEvent(0);
  assert.ok(game.player.alignment.정도 >= 3 && game.player.hasFlag("무림맹"));
  assert.equal(game.pendingNext, false);
});

test("조건이 안 맞는 선택은 거절된다", () => {
  const game = newGame();
  game.player.silver = 0;
  game.event = { key: "떠돌이약장수", forced: false };
  game.chooseEvent(0);
  assert.ok(game.event);
  game.chooseEvent(99);
  assert.ok(game.event);
});

test("무작위 사건은 생당 한 번", () => {
  const p = new Player();
  p.seenEvents = Object.keys(DB.randomEvents);
  assert.equal(pickRandomEvent(p), null);
});

test("성향 혜택", () => {
  let p = new Player();
  p.alignment.정도 = 5;
  assert.equal(priceOf(p, "호골주"), Math.trunc(DB.market.호골주.price * 0.9));
  p = new Player();
  p.alignment.사도 = 5;
  assert.equal(p.gainSilver(100), 125);
  p = new Player();
  p.alignment.마도 = 5;
  assert.ok(new Battle(p, new Enemy("천마")).attackScale() > new Battle(new Player(), new Enemy("천마")).attackScale());
});

test("능력치는 1 아래로 내려가지 않고 효과 요약이 나온다", () => {
  const p = new Player();
  p.mind = 2;
  const summary = applyEffects(p, { stats: { mind: -5 }, silver: 10, skill: "매화검법", item: "금창약" });
  assert.equal(p.mind, 1);
  assert.ok(p.hasSkill("매화검법") && p.inventory.금창약 === 1);
  assert.ok(summary.some((s) => s.includes("은자")));
});

test("마도 10이면 천마봉에서 귀순할 수 있다", () => {
  const game = newGame();
  toTurnEnd(game, 119);
  game.player.alignment = { 정도: 0, 사도: 0, 마도: 12 };
  game.advanceTurn();
  game.marketLeave();
  assert.equal(game.event.key, "결전_천마봉");
  const view = eventView(game.player, game.event.key);
  assert.ok(view.choices.some((c) => c.label.includes("무릎")));
  assert.ok(!view.choices.some((c) => c.label.includes("맹의 고수")));
  game.chooseEvent(view.choices.find((c) => c.label.includes("무릎")).index);
  assert.equal(game.ending.key, "귀순");
});

test("결전은 세 막이고 막간에서 인연이 끼어들고 선택을 한다", () => {
  const game = newGame();
  toTurnEnd(game, 119);
  game.player.addFlag("단목휘_동맹");
  game.advanceTurn();
  game.marketLeave();
  game.chooseEvent(0);
  const { battle } = game;
  assert.equal(battle.enemy.maxHp, DB.enemies.천마.hp);
  game.player.hp = game.player.maxHp() * 50;
  battle.enemy.hp = Math.trunc(battle.enemy.maxHp * 0.55);
  const before = battle.enemy.hp;
  game.battleAction("심법");
  assert.ok(battle.interlude, "제이막 막간이 열린다");
  assert.equal(battle.enemy.phase, 1);
  assert.ok(battle.enemy.hp <= before - Math.trunc(battle.enemy.maxHp * 0.15), "단목휘가 끼어든다");
  assert.ok(game.log.some((l) => l.includes("다리 값")));
  const round = battle.roundNum;
  game.battleInterlude(0);
  assert.equal(battle.interlude, null);
  assert.equal(battle.roundNum, round, "막간을 고르는 데 합을 쓰지 않는다");
  assert.ok(battle.atkBuff);
  battle.enemy.hp = Math.trunc(battle.enemy.maxHp * 0.2);
  game.battleAction("심법");
  assert.ok(battle.interlude, "제삼막 막간이 열린다");
  assert.ok(battle.interlude.choices.some((c) => c.tag === "출신"));
  assert.ok(battle.enemy.specials.some((s) => s.name === "천마멸겁"));
  game.battleAction("심법");
  assert.equal(battle.interlude, null, "고르지 않으면 첫 선택지를 따른다");
});

test("결전 막간과 맺음말은 출신마다 다르고 생사경 조건을 건드리지 않는다", () => {
  const { 천마 } = DB.enemies;
  const act3 = 천마.phases[1].interlude;
  for (const key of DB.origins.order) {
    assert.ok(act3.choices.some((c) => c.requires?.origin === key), `${key} 결단`);
    assert.ok(천마.outros.some((o) => o.requires?.origin === key), `${key} 맺음말`);
    assert.ok(천마.phases[0].interlude.texts.some((t) => t.requires?.origin === key), `${key} 제이막`);
  }
  for (const choice of [...act3.choices, ...act3.allies]) {
    assert.ok(!choice.effects.stats, "막간은 능력치를 올리지 않는다");
  }
  for (const choice of act3.choices) assert.ok(!(choice.effects.hp_pct > 0), "제삼막 선택은 체력을 채우지 않는다");
});

// ---------- 문파, 대회, 명성 ----------

test("문파 입문은 사문이 없을 때만", () => {
  const p = new Player();
  assert.ok(checkRequires(p, DB.randomEvents.소림_입문.requires));
  applyEffects(p, { join_sect: "소림", skill: "나한권" });
  assert.equal(p.sect, "소림");
  assert.ok(!checkRequires(p, DB.randomEvents.무당_입문.requires));
  assert.ok(checkRequires(p, DB.randomEvents.소림_동인진.requires));
  assert.ok(!checkRequires(p, DB.randomEvents.소림_비전.requires));
  assert.equal(new Player("남궁세가").sect, "남궁");
});

test("비무대회는 세 번 싸우고 보상을 준다", () => {
  const game = newGame();
  const p = game.player;
  Object.assign(p, { external: 950, martial: 950, internal: 950, mind: 950, hp: 575, qi: 575 });
  toTurnEnd(game, 59);
  game.advanceTurn();
  assert.equal(game.event.key, "천하제일비무");
  game.chooseEvent(0);
  const seen = [];
  for (let i = 0; i < 100 && game.battle; i++) {
    if (!seen.includes(game.battle.enemy.key)) seen.push(game.battle.enemy.key);
    p.hp = p.maxHp();
    game.battleAction("기본공격");
  }
  assert.deepEqual(seen, ["비무청성", "비무철권", "비무결승"]);
  assert.ok(game.pendingNext && !game.gauntlet);
  assert.ok(p.hasFlag("대회우승") && p.fame >= 14);
  assert.equal(p.weapon, "태산신검");
});

test("도망치면 대회가 끝난다", () => {
  const game = newGame();
  game.gauntlet = { name: "대회", enemies: ["비무철권"], reward: { fame: 9 }, round: 1, total: 2 };
  game.startBattle("산적");
  seed(0);
  for (let i = 0; i < 40 && game.battle; i++) game.battleAction("도주");
  assert.equal(game.gauntlet, null);
  assert.ok(game.player.fame < 9);
});

test("별호와 명성", () => {
  const p = new Player();
  assert.equal(byname(p), "이름 없는 무인");
  assert.equal(fameRank(0), "무명소졸");
  p.fame = 40;
  p.alignment.정도 = 5;
  assert.ok(byname(p).endsWith("검협"));
  assert.equal(fameRank(60), "일방의 고수");
});

test("전투 경험만 모자라면 알려 준다", () => {
  const p = new Player();
  p.external = p.internal = p.martial = p.mind = 400;
  assert.ok(breakthroughBlock(p).includes("실전"));
  p.battles = 8;
  assert.equal(breakthroughBlock(p), null);
});

// ---------- 시장 ----------

test("시장은 달을 쓰지 않고 소비품은 가방에 들어간다", () => {
  const game = newGame();
  const p = game.player;
  Object.assign(p, { turn: 12, silver: 200, hp: 50 });
  game.action("수련");
  p.silver = 200;
  game.advanceTurn();
  assert.ok(game.market);
  assert.equal(p.turn, 12);
  game.market.stock = [{ key: "금창약", left: 3 }];
  game.action("수련");
  game.advanceTurn();
  assert.equal(p.turn, 12);
  game.marketBuy("금창약");
  assert.equal(p.inventory.금창약, 1);
  assert.equal(p.silver, 180);
  game.useItem("금창약");
  assert.ok(p.hp > 50 && !p.inventory.금창약);
  game.marketLeave();
  assert.equal(p.turn, 13);
});

test("진열은 겹치지 않고 아는 비급은 빠지며 더 좋은 장비가 있다", () => {
  const p = new Player();
  p.learnSkill(new Skill("초상비"));
  for (const turn of [12, 24, 36, 48, 60, 72, 84, 96, 108, 119]) {
    for (let i = 0; i < 30; i++) {
      const keys = openMarket(turn, p).stock.map((s) => s.key);
      assert.equal(new Set(keys).size, keys.length);
      assert.ok(keys.length >= 4 && !keys.includes("초상비비급"));
    }
  }
  for (let i = 0; i < 30; i++) {
    const keys = openMarket(12, new Player()).stock.map((s) => s.key);
    assert.ok(keys.some((k) => DB.market[k].category === "무기") && keys.includes("가죽호구"));
    assert.ok(keys.some((k) => DB.market[k].category === "소비품" || DB.market[k].category === "영약"));
  }
});

test("성향 전용 물건은 그 길을 걷는 사람에게만", () => {
  const p = new Player();
  for (let i = 0; i < 30; i++) assert.ok(!openMarket(36, p).stock.some((s) => s.key === "혈영도법비급"));
  p.alignment.마도 = 5;
  assert.ok(openMarket(36, p).stock.some((s) => s.key === "혈영도법비급"));
});

test("은자가 없거나 진열에 없으면 살 수 없다", () => {
  const p = new Player();
  p.silver = 0;
  const market = { stock: [{ key: "금창약", left: 1 }] };
  assert.ok(!buy(p, market, "금창약")[0]);
  p.silver = 999;
  assert.ok(!buy(p, market, "대환단")[0]);
  assert.ok(buy(p, market, "금창약")[0]);
  assert.ok(!buy(p, market, "금창약")[0]);
});

test("지금보다 나쁜 장비는 효과 없음", () => {
  const p = new Player();
  p.silver = 999;
  p.weapon = "운철보검";
  assert.equal(blockReason(p, "철검"), "효과 없음");
});

test("비기를 터득한 주무공은 자동으로 바뀌지 않는다", () => {
  const p = new Player();
  const current = p.bestSkill();
  current.secretUnlocked = true;
  const messages = p.learnSkill(new Skill("태허검결"));
  assert.equal(p.mainSkill, current.key);
  assert.ok(messages.some((m) => m.includes("골라 쓸 수")));
});

// ---------- 저장 ----------

test("저장은 달 시작 지점으로 복구된다", () => {
  const game = newGame();
  game.player.silver = 77;
  game.pendingNext = true;
  game.advanceTurn();
  assert.equal(loadCheckpoint().player.turn, 2);
  game.action("수련");
  const fresh = new Game();
  assert.ok(fresh.continueFromSave());
  assert.equal(fresh.player.turn, 2);
  assert.equal(fresh.player.silver, 77);
  assert.equal(fresh.pendingNext, false);
});

test("120달에서 복구하면 천마봉 선택부터", () => {
  const game = newGame();
  toTurnEnd(game, 119);
  game.advanceTurn();
  game.marketLeave();
  game.chooseEvent(0);
  assert.ok(game.battle.isFinal);
  const fresh = new Game();
  fresh.continueFromSave();
  assert.equal(fresh.event.key, "결전_천마봉");
});

test("줄거리 선택 전 저장에서 복구하면 다시 고른다", () => {
  const game = new Game();
  game.start("무림초출");
  assert.equal(game.event.key, "시작_병기고");
  const fresh = new Game();
  fresh.continueFromSave();
  assert.equal(fresh.event.key, "시작_병기고");
});

test("손상된 저장도 게임을 멈추지 않는다", () => {
  storage.set("wuxia-legend", "{깨진");
  storage.set("wuxia-save", "{깨진");
  assert.equal(loadMeta().current_karma, 0);
  assert.equal(loadCheckpoint(), null);
});

test("기록 내보내기와 가져오기", () => {
  const data = loadMeta();
  data.current_karma = 7;
  data.global_codex = ["산적"];
  saveMeta(data);
  const game = newGame();
  game.player.silver = 123;
  game.pendingNext = true;
  game.advanceTurn();
  const text = exportRecords();
  storage.clearMemory();
  assert.equal(loadMeta().current_karma, 0);
  assert.ok(importRecords(text));
  assert.equal(loadMeta().current_karma, 7);
  assert.equal(loadCheckpoint().player.silver, 123);
});

test("예전 PC 버전 legend_data.json도 가져온다", () => {
  assert.ok(importRecords(JSON.stringify({ current_karma: 3, total_karma: 9, unlocked_origins: ["무림초출", "남궁세가"], unlocked_traits: [] })));
  const data = loadMeta();
  assert.equal(data.total_karma, 9);
  assert.deepEqual(data.runs, []);
  assert.ok(data.unlocked_origins.includes("남궁세가"));
});

test("엉뚱한 파일은 거절한다", () => {
  assert.ok(!importRecords("안녕"));
  assert.ok(!importRecords(JSON.stringify({ a: 1 })));
});

// ---------- 메타 ----------

test("특성 칸는 누적 카르마로 늘어난다", () => {
  assert.deepEqual([0, 29, 30, 89, 90].map(traitSlots), [1, 1, 2, 2, 3]);
});

test("잠긴 출신과 자리를 넘는 특성은 막힌다", () => {
  const data = loadMeta();
  data.unlocked_traits = ["금전운", "철옹성"];
  saveMeta(data);
  const game = new Game();
  assert.equal(game.start("권마계승"), false);
  assert.equal(game.player, null);
  game.start("무림초출", ["금전운", "철옹성", "전투광"]);
  assert.deepEqual(game.player.traits, ["금전운"]);
});

test("카르마로 개방하면 차감된다", () => {
  const data = loadMeta();
  data.current_karma = 5;
  saveMeta(data);
  assert.ok(unlockOrigin("남궁세가", 5));
  assert.equal(loadMeta().current_karma, 0);
  assert.ok(!unlockOrigin("하오문", 5));
});

// ---------- 시간과 난이도 ----------

test("게임은 120달, 10년이다", () => {
  const p = new Player();
  assert.equal(p.maxTurn, 120);
  assert.equal(getYear(120), 10);
  assert.equal(getChapter(24), 1);
  assert.equal(getChapter(25), 2);
  assert.equal(getChapter(120), 5);
  assert.equal(marketTurns().length, 10);
  assert.equal(marketTurns().at(-1), 119);
});

test("적은 시기가 지나면 강해지고 천마는 그대로다", () => {
  const early = new Enemy("낭인", DB.enemies.낭인.level);
  const late = new Enemy("낭인", 48);
  assert.equal(early.maxHp, DB.enemies.낭인.hp);
  assert.ok(late.maxHp > early.maxHp && late.attack > early.attack);
  assert.equal(new Enemy("천마", 120).maxHp, DB.enemies.천마.hp);
});

test("초반 적도 한 방에 쓰러지지 않는다", () => {
  const p = new Player();
  const power = new Battle(p, new Enemy("천마")).attackPower(p.bestSkill());
  for (const key of ["산적", "낭인", "늑대무리", "사이비도사"]) {
    assert.ok(new Enemy(key, 1).maxHp > power * 1.5, key);
  }
});

test("모든 적이 기준 시기를 가진다", () => {
  for (const [key, enemy] of Object.entries(DB.enemies)) {
    if (enemy.tier !== "보스") assert.ok(enemy.level >= 1 && enemy.level <= 120, key);
  }
});

test("60달 시절의 저장은 시간표를 늘려 이어 간다", () => {
  const p = new Player();
  const old = { ...p.toDict(), turn: 30, max_turn: 60, battles: 10 };
  const moved = Player.fromDict(old);
  assert.equal(moved.maxTurn, 120);
  assert.equal(moved.turn, 59);
  assert.equal(moved.battles, 20);
});

test("성장 특성은 작은 수에서 두 배가 되지 않는다", () => {
  seed(5);
  let total = 0;
  for (let i = 0; i < 1000; i++) total += applyGrowth(1, ["오성"], "mind");
  assert.ok(total > 1050 && total < 1150, String(total));
});

// ---------- 소속과 상황별 반응 ----------

test("문파 입문은 모두 사문이 없을 때만 나온다", () => {
  for (const [key, event] of Object.entries(DB.events)) {
    const joins = event.choices.some((c) => c.outcomes.some((o) => o.effects?.join_sect));
    if (joins) assert.ok(event.requires?.no_sect, key);
  }
});

test("사문이 있으면 어긋나는 세력 선택지가 보이지 않는다", () => {
  const labels = (p) => eventView(p, "2장_세력").choices.map((c) => c.label).join("|");
  const free = new Player();
  assert.ok(labels(free).includes("무림맹") && labels(free).includes("사도련") && labels(free).includes("붉은"));
  const monk = new Player();
  monk.sect = "소림";
  assert.ok(labels(monk).includes("무림맹") && !labels(monk).includes("사도련") && !labels(monk).includes("붉은"));
  const poison = new Player();
  poison.sect = "당가";
  assert.ok(!labels(poison).includes("무림맹") && labels(poison).includes("사도련"));
  const cult = new Player();
  cult.sect = "마교";
  assert.ok(!labels(cult).includes("무림맹") && !labels(cult).includes("사도련"));
  assert.ok(!eventView(monk, "4장_풍운").choices.some((c) => c.label.includes("마교의 선봉")));
});

test("어떻게 플레이해도 사문이 있으면 입문 사건이 뽑히지 않는다", () => {
  const p = new Player("남궁세가");
  for (const turn of [1, 25, 49, 73, 97]) {
    p.turn = turn;
    for (let i = 0; i < 300; i++) {
      const key = pickRandomEvent(p);
      assert.ok(!key || !DB.randomEvents[key].requires?.no_sect, key);
    }
  }
});

test("입문 효과는 사문이 있으면 덮어쓰지 않는다", () => {
  const p = new Player("남궁세가");
  applyEffects(p, { join_sect: "마교" });
  assert.equal(p.sect, "남궁");
});

test("상황별 반응: 지닌 물건에 따라 선택지가 생기고 쓰면 사라진다", () => {
  const p = new Player();
  const count = () => eventView(p, "독사의계곡").choices.length;
  const base = count();
  p.addItem("해독단");
  assert.equal(count(), base + 1);
  const view = eventView(p, "독사의계곡");
  assert.equal(view.choices[0].tag, "해독단");
  assert.ok(resolveChoice(p, "독사의계곡", view.choices[0].index));
  assert.ok(!p.inventory.해독단);
});

test("상황별 반응: 출신과 사문에 따라 본문이 달라진다", () => {
  const plain = eventView(new Player(), "표국호위").text;
  const data = loadMeta();
  saveMeta(data);
  assert.notEqual(eventView(new Player("남궁세가"), "표국호위").text, plain);
  const monk = new Player();
  monk.sect = "소림";
  assert.notEqual(eventView(monk, "폐사찰").text, eventView(new Player(), "폐사찰").text);
});

test("상황별 반응: 상태와 무공, 무기에 따라 달라진다", () => {
  const p = new Player();
  const base = eventView(p, "명의").choices.length;
  p.addInjury(1);
  assert.equal(eventView(p, "명의").choices.length, base + 1);
  const q = new Player();
  const finalBase = eventView(q, "결전_천마봉").choices.length;
  q.learnSkill(new Skill("태허검결"));
  q.weapon = "태산신검";
  assert.equal(eventView(q, "결전_천마봉").choices.length, finalBase + 2);
});

test("상황별 반응: 출신, 무공, 명성, 능력치, 시작 특성이 고르게 쓰인다", () => {
  const events = Object.values(DB.events).filter((e) => e.kind !== "story" && e.kind !== "final" && !e.chain && !e.requires?.origin && !e.requires?.sect && !e.requires?.no_sect);
  const uses = { origin: 0, min_fame: 0, max_fame: 0, stat_min: 0, trait: 0, any_skill: 0, main_category: 0 };
  let reactive = 0;
  for (const event of events) {
    if (event.variants?.length) reactive += 1;
    for (const variant of event.variants || []) {
      for (const key of Object.keys(uses)) if (variant.requires?.[key]) uses[key] += 1;
    }
  }
  assert.ok(reactive / events.length >= 0.75, `반응 있는 사건 ${reactive}/${events.length}`);
  assert.ok(uses.origin >= 25, "출신 반응");
  assert.ok(uses.min_fame >= 15, "명성 높을 때");
  assert.ok(uses.max_fame >= 6, "명성 낮을 때");
  assert.ok(uses.stat_min >= 10, "능력치");
  assert.ok(uses.trait >= 25, "시작 특성");
  assert.ok(uses.any_skill >= 5, "지닌 무공");
  const p = new Player();
  p.fame = 150;
  assert.ok(eventView(p, "수로채").text.includes("대협"));
  p.fame = 0;
  assert.ok(eventView(p, "살막의명부").text.includes("두 냥"));
  p.external = 700;
  assert.ok(eventView(p, "철권씨름").choices.some((c) => c.label.includes("한 손으로")));
});

test("적의 대사가 명성과 경지에 따라 달라진다", () => {
  const p = new Player();
  p.fame = 150;
  assert.ok(enemyIntro(p, "산적").includes("저 얼굴"));
  p.fame = 0;
  assert.ok(enemyIntro(p, "산적").includes("초행길"));
});

test("천마의 맺음말은 출신을 따른다", () => {
  const p = new Player("표국표사");
  const enemy = new Enemy("천마");
  const battle = new Battle(p, enemy, true);
  enemy.hp = 0;
  battle.finish(true);
  assert.ok(battle.log.some((l) => l.includes("표물, 도착했소")));
});

test("상황별 반응: 선택 번호는 반응 선택지를 포함해 맞게 처리된다", () => {
  const game = newGame();
  game.player.addItem("해독단");
  game.event = { key: "독사의계곡", forced: false };
  const view = eventView(game.player, "독사의계곡");
  const last = view.choices.at(-1);
  game.chooseEvent(last.index);
  assert.equal(game.event, null);
  assert.equal(game.player.inventory.해독단, 1);
});

test("적의 대사가 상황에 따라 달라진다", () => {
  const plain = enemyIntro(new Player(), "천마");
  assert.notEqual(enemyIntro(new Player("남궁세가"), "천마"), plain);
  assert.notEqual(enemyIntro(new Player("권마계승"), "천마"), plain);
});

test("손을 씻으면 사문을 떠나고 새 입문이 열린다", () => {
  const p = new Player("하오문");
  applyEffects(p, { leave_sect: true });
  assert.equal(p.sect, null);
  assert.ok(checkRequires(p, DB.randomEvents.개방_입문.requires));
});

test("화면에 나오는 문장에 영어가 없다", () => {
  const bad = [];
  const skip = new Set(["type", "kind", "slot", "stat", "trigger", "what"]);
  const collect = (node, key) => {
    if (typeof node === "string") { if (!skip.has(key) && /[A-Za-z]/.test(node)) bad.push(node); } else if (Array.isArray(node)) node.forEach((n) => collect(n, key));
    else if (node && typeof node === "object") Object.entries(node).forEach(([k, v]) => collect(v, k));
  };
  for (const name of ["skills", "enemies", "market", "traits", "sects", "flavor", "fortunes", "origins", "chapters", "endings", "events"]) collect(DB[name]);
  assert.deepEqual(bad, []);
});

// ---------- 무기와 무공의 다양함 ----------

test("계열마다 무공과 무기가 고르게 있다", () => {
  const styles = ["검법", "도법", "창법", "봉법", "권법", "장법", "암기"];
  const attacks = Object.values(DB.skills).filter((s) => s.type === "공격무공");
  for (const style of styles) {
    assert.ok(attacks.filter((s) => s.category === style).length >= 3, style);
  }
  for (const style of ["검법", "도법", "창법", "봉법", "권법", "장법", "암기"]) {
    const weapons = Object.values(DB.market).filter((i) => i.category === "무기" && i.markets.length && i.effects.some((e) => e.style === style));
    assert.equal(weapons.length, 6, style);
  }
});

test("익힌 무공과 맞는 물건이 시장에 더 자주 나온다", () => {
  const spear = new Player();
  spear.learnSkill(new Skill("기초창법"));
  spear.mainSkill = "기초창법";
  const sword = new Player();
  const count = (p, style) => {
    let n = 0;
    for (let i = 0; i < 400; i++) {
      for (const s of openMarket(36, p).stock) {
        const item = DB.market[s.key];
        if (item.effects.some((e) => e.style === style || DB.skills[e.skill]?.category === style)) n++;
      }
    }
    return n;
  };
  assert.ok(count(spear, "창법") > count(sword, "창법") * 1.5);
  assert.ok(count(sword, "도법") > 0, "다른 계열도 나온다");
});

test("주무공과 맞지 않는 무기는 3/4만 적용된다", () => {
  const p = new Player();
  p.weapon = "철검";
  assert.equal(equipmentBonus(p, "weapon"), 10);
  p.weapon = "박도";
  assert.equal(equipmentBonus(p, "weapon"), 7);
  p.weapon = "태산신검";
  assert.equal(equipmentBonus(p, "weapon"), 60);
});

test("강호초출은 달이 지나지 않는 번외 시간에 첫 병기와 첫 심법을 고른다", () => {
  const game = new Game();
  game.start("무림초출");
  assert.equal(game.event.key, "시작_병기고");
  const view = eventView(game.player, game.event.key);
  assert.equal(view.choices.length, 7);
  game.chooseEvent(view.choices.find((c) => c.label.includes("창")).index);
  assert.equal(game.player.turn, 1);
  assert.equal(game.player.bestSkill().key, "기초창법");
  assert.equal(game.player.skills.filter((s) => s.type === "공격무공").length, 1, "고른 계열 무공 하나로 시작한다");
  assert.equal(game.player.weapon, "낡은창");
  assert.equal(game.event.key, "시작_심법");
  game.chooseEvent(eventView(game.player, game.event.key).choices.find((c) => c.label.includes("양생공")).index);
  assert.equal(game.player.bestOfType("심공").key, "양생공");
  assert.equal(game.player.skills.filter((s) => s.type === "심공").length, 1);
  assert.equal(game.event.key, "서장_무림초출", "곧바로 서장으로 이어진다");
  game.chooseEvent(0);
  assert.equal(game.player.turn, 1);
  assert.ok(!game.pendingNext && !game.event, "첫 달의 행동은 그대로 남아 있다");
});

test("출신은 여덟이고 일곱 계열에 하나씩이며 심법이 모두 다르다", () => {
  const order = DB.origins.order;
  assert.equal(order.length, 8);
  assert.equal(order[0], "무림초출");
  assert.equal(DB.origins.origins.무림초출.name, "강호초출");
  const rest = order.slice(1);
  const styles = rest.map((k) => new Player(k).bestSkill().category).sort();
  assert.deepEqual(styles, ["검법", "권법", "도법", "봉법", "암기", "장법", "창법"].sort());
  const hearts = order.map((k) => new Player(k).bestOfType("심공").key);
  assert.equal(new Set(hearts).size, 8);
  for (const k of rest) {
    const g = new Game();
    const meta = loadMeta();
    meta.unlocked_origins = order;
    saveMeta(meta);
    g.start(k);
    assert.ok(!DB.events[g.event.key].prelude, `${k}는 번외 고르기가 없다`);
    assert.equal(DB.market[g.player.weapon].effects[0].style, g.player.bestSkill().category, k);
  }
});

test("새해가 시작되면 체력, 내력, 내상이 모두 회복된다", () => {
  const game = newGame();
  const p = game.player;
  p.turn = 12;
  p.hp = 1;
  p.qi = 0;
  p.addInjury(3);
  game.pendingNext = true;
  game.market = null;
  game.startNextTurn();
  assert.equal(p.turn, 13);
  assert.equal(p.hp, p.maxHp());
  assert.equal(p.qi, p.maxQi());
  assert.equal(p.injury, 0);
});

test("해 중간에는 내상이 그대로 남는다", () => {
  const game = newGame();
  const p = game.player;
  p.addInjury(2);
  game.pendingNext = true;
  game.advanceTurn();
  assert.equal(p.injury, 2);
});

test("새 특성들이 작동한다", () => {
  const sword = new Player("무림초출", ["병기광"]);
  sword.weapon = "박도";
  assert.equal(equipmentBonus(sword, "weapon"), 10);
  const lone = new Player("무림초출", ["외길"]);
  lone.weapon = "철검";
  assert.equal(equipmentBonus(lone, "weapon"), 14);
  const herb = new Player("무림초출", ["약초꾼"]);
  assert.equal(herb.inventory.금창약, 5);
  assert.equal(new Player("무림초출", ["가보의호구"]).armor, "철사갑의");
  assert.equal(new Player("무림초출", ["대기만성"]).external, new Player().external - 40);
  const keen = new Player("무림초출", ["눈썰미"]);
  assert.ok(openMarket(12, keen).stock.length > openMarket(12, new Player()).stock.length);
  const game = newGame();
  game.player.traits = ["대기만성"];
  const before = game.player.external;
  game.player.turn = 24;
  game.startNextTurn();
  assert.equal(game.player.external, before + 40);
});

test("독인은 독에 당하지 않고 맑은 정신은 점혈되지 않는다", () => {
  const p = new Player("무림초출", ["독인", "맑은정신"]);
  const battle = new Battle(p, new Enemy("낭인"));
  battle.enemy.specials = [{ name: "독수", every: 1, mult: 1, poison: { damage: 5, rounds: 3 }, seal: 2 }];
  battle.runRound("기본공격", p.bestSkill());
  assert.ok(!battle.poison && !battle.sealed);
});

test("새 출신은 물건과 은자, 무기를 들고 시작한다", () => {
  assert.equal(new Player("남궁세가").weapon, "낡은검");
  assert.ok(new Player("표국표사").silver > new Player().silver);
});

test("특성 반응이 선택지를 바꾼다", () => {
  const plain = new Player();
  const poison = new Player("무림초출", ["독인"]);
  assert.ok(eventView(poison, "독버섯숲").choices.length > eventView(plain, "독버섯숲").choices.length);
});

test("주무공에 맞는 무기를 받는다", () => {
  const p = new Player();
  p.learnSkill(new Skill("기초창법"));
  p.mainSkill = "기초창법";
  applyEffects(p, { style_weapon: 3 });
  assert.equal(p.weapon, "현철창");
});

test("문장에서 플레이어 무기를 검으로 단정하지 않는다", () => {
  const events = DB.storyEvents.결전_천마봉.choices.map((c) => c.label).join();
  assert.ok(!events.includes("검을 뽑는다"));
});

test("주무공에 따라 반응이 달라진다", () => {
  const p = new Player();
  const base = eventView(p, "노병의창").choices.length;
  p.learnSkill(new Skill("기초창법"));
  p.mainSkill = "기초창법";
  assert.equal(eventView(p, "노병의창").choices.length, base + 1);
});

test("기연의 비급은 익힌 계열이 더 자주 나온다", () => {
  const p = new Player();
  p.learnSkill(new Skill("기초도법"));
  p.mainSkill = "기초도법";
  let saber = 0;
  for (let i = 0; i < 300; i++) {
    const q = Player.fromDict(p.toDict());
    applyEffects(q, { random_skill: { max_grade: "명품" } });
    const learned = q.skills.at(-1);
    if (learned.category === "도법") saber++;
  }
  assert.ok(saber > 300 / 7);
});

// ---------- 새 특성과 출신 ----------

test("적 대사와 사건 반응의 조건이 실제 데이터를 가리킨다", () => {
  const check = (r, where) => {
    if (!r) return;
    if (r.origin) assert.ok(DB.origins.origins[r.origin], where);
    if (r.trait) assert.ok(DB.traits[r.trait], `${where} ${r.trait}`);
    if (r.sect) assert.ok(DB.sects[r.sect], where);
    if (r.item) assert.ok(DB.market[r.item], where);
    for (const k of r.any_skill || []) assert.ok(DB.skills[k], `${where} ${k}`);
  };
  for (const [key, enemy] of Object.entries(DB.enemies)) for (const i of enemy.intros || []) check(i.requires, key);
  for (const [key, event] of Object.entries(DB.events)) for (const v of event.variants || []) check(v.requires, key);
});

test("이벤트에서 만들어 쓰는 인연 표시는 어딘가에서 얻을 수 있다", () => {
  const given = new Set();
  const used = new Set();
  const walk = (node) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== "object") return undefined;
    for (const f of node.flags || []) given.add(f);
    for (const name of ["flag", "not_flag"]) if (node[name]) used.add(node[name]);
    for (const f of node.any_flag || []) used.add(f);
    return Object.values(node).forEach(walk);
  };
  walk(DB.events);
  for (const flag of used) assert.ok(given.has(flag), flag);
});


test("잠이 보약과 약초꾼은 회복량을 늘린다", () => {
  const heal = (traits, act) => {
    const p = new Player("무림초출", traits);
    p.hp = 1;
    act(p);
    return p.hp;
  };
  const rest = (p) => {
    const game = new Game();
    game.player = p;
    game.action("휴식");
  };
  assert.ok(heal(["잠이보약"], rest) > heal([], rest));
  const potion = (p) => { p.inventory.금창약 = 1; useConsumable(p, "금창약"); };
  assert.ok(heal(["약초꾼"], potion) > heal([], potion));
});

test("철옹성은 받는 피해를 줄인다", () => {
  const taken = (traits) => {
    const p = new Player("무림초출", traits);
    const b = new Battle(p, new Enemy("낭인", 1));
    let sum = 0;
    for (let i = 0; i < 300; i++) sum += b.incoming();
    return sum;
  };
  assert.ok(taken(["철옹성"]) < taken([]));
});

test("특성에 따라 사건 선택지가 늘어난다", () => {
  const plain = eventView(new Player(), "밀주꾼").choices.length;
  assert.equal(eventView(new Player("무림초출", ["주당"]), "밀주꾼").choices.length, plain + 1);
});

test("없어진 출신은 카르마를 돌려주고 저장도 이어 갈 수 있다", () => {
  const meta = loadMeta();
  meta.unlocked_origins = ["무림초출", "낙방서생"];
  meta.current_karma = 2;
  saveMeta(meta);
  const after = loadMeta();
  assert.ok(!after.unlocked_origins.includes("낙방서생"));
  assert.equal(after.current_karma, 7);
  const dict = new Player().toDict();
  dict.origin_key = "낙방서생";
  dict.origin = "낙방한 서생";
  assert.equal(Player.fromDict(dict).originKey, "무림초출");
  assert.ok(!DB.origins.origins.낙방서생);
});

test("모든 출신은 시작 경지가 일류인 까닭을 설명하고 맺음말이 있다", () => {
  for (const [key, origin] of Object.entries(DB.origins.origins)) {
    assert.ok(DB.endings.frames.기본.flat().some((r) => r.requires?.origin === key), key);
    assert.ok(new Player(key).realm === "일류", key);
    if (!["남궁세가", "곤륜파", "하오문", "권마계승"].includes(key)) assert.ok(origin.desc.includes("일류"), key);
  }
  });

test("강호행의 굵직한 일이 기록으로 남고 저장된다", () => {
  const game = newGame();
  game.chooseEvent(0);
  assert.ok(game.player.chronicle.some((c) => c.text.startsWith("첫 병기")));
  game.player.note("시험");
  assert.equal(Player.fromDict(game.player.toDict()).chronicle.at(-1).text, "시험");
  const old = game.player.toDict();
  delete old.chronicle;
  assert.deepEqual(Player.fromDict(old).chronicle, []);
});

// ---------- 카르마, 강화, 인연, 유산 ----------

function withKarma(amount, extra = {}) {
  const data = loadMeta();
  Object.assign(data, { current_karma: amount, total_karma: amount, upgrades: {}, content: [], content_off: [], legacy_open: false, legacies: [], endings_seen: [], milestones: [] }, extra);
  saveMeta(data);
}

test("기틀은 장착 없이 적용되고 단계마다 비용이 오른다", () => {
  withKarma(30);
  assert.ok(buyUpgrade("강골"));
  assert.ok(buyUpgrade("강골"));
  assert.equal(loadMeta().current_karma, 24);
  const game = new Game();
  game.start("무림초출");
  assert.equal(game.player.external, 320);
  assert.ok(buyUpgrade("강골"));
  assert.ok(!buyUpgrade("강골"), "최고 단계를 넘을 수 없다");
  withKarma(0);
});

test("능력치 기틀과 자질은 네 기량에 고르게 있다", () => {
  const stats = ["external", "internal", "martial", "mind"];
  const upgrades = Object.values(DB.karma.upgrades);
  for (const type of ["start_stat", "growth_rate"]) {
    const found = stats.map((stat) => upgrades.filter((u) => u.effects.length === 1 && u.effects[0].type === type && u.effects[0].stat === stat));
    assert.ok(found.every((list) => list.length === 1), type);
    assert.ok(found.every((list) => JSON.stringify(list[0].costs) === JSON.stringify(found[0][0].costs)), `${type} 비용`);
  }
  const single = Object.values(DB.traits).filter((t) => !t.hidden && t.effects.length === 2);
  for (const stat of stats) {
    assert.ok(single.some((t) => t.effects.some((e) => e.type === "start_stat" && e.stat === stat && e.amount === 120)
      && t.effects.some((e) => e.type === "growth_rate" && e.stat === stat && e.percent === 15)), stat);
  }
});

test("새로 얻거나 품계가 높아도 쓰던 무공이 바뀌지 않는다", () => {
  const p = new Player("하북팽가");
  const main = p.mainSkill;
  const mind = p.bestOfType("심공").key;
  assert.ok(p.learnSkill(new Skill("오호단혼도")).some((l) => l.includes("골라 쓸 수")));
  p.learnSkill(new Skill("오호맹혼공"));
  p.learnSkill(new Skill("이형환위"));
  assert.equal(p.mainSkill, main);
  assert.equal(p.bestOfType("심공").key, mind);
  assert.equal(p.bestOfType("경공").key, "이형환위", "처음 익힌 경공은 바로 쓴다");
  p.learnSkill(new Skill("초상비"));
  assert.equal(p.bestOfType("경공").key, "이형환위");
  const game = new Game();
  game.player = p;
  game.setMainSkill("오호단혼도");
  game.setMainSkill("오호맹혼공");
  assert.equal(p.bestSkill().key, "오호단혼도");
  assert.equal(p.bestOfType("심공").key, "오호맹혼공");
  const again = Player.fromDict(p.toDict());
  assert.equal(again.bestOfType("심공").key, "오호맹혼공");
});

test("성향과 명성에 따라 찾아오는 적이 달라진다", () => {
  const seen = (setup, turn = 60, n = 400) => {
    const game = newGame();
    setup(game.player);
    game.player.turn = turn;
    const names = new Set();
    for (let i = 0; i < n; i++) names.add(game.pickEnemy());
    return names;
  };
  const dark = seen((p) => { p.alignment.마도 = 10; });
  assert.ok(dark.has("구파협객"), "마도를 걸으면 정파 협객이 나온다");
  assert.ok(!dark.has("사파복수귀"));
  const right = seen((p) => { p.alignment.정도 = 10; });
  assert.ok(right.has("사파복수귀"));
  assert.ok(!right.has("구파협객"), "정도에게는 정파 협객이 덤비지 않는다");
  const shady = seen((p) => { p.alignment.사도 = 10; });
  assert.ok(shady.has("포도대장"));
  const plain = seen(() => {});
  assert.ok(!plain.has("구파협객") && !plain.has("포도대장") && !plain.has("사파복수귀"));
  const famous = seen((p) => { p.fame = 150; p.realm = "화경"; }, 80);
  assert.ok(famous.has("십대고수"), "이름이 높으면 고수가 찾아온다");
  const nameless = seen((p) => { p.fame = 0; }, 30);
  assert.ok(nameless.has("무명사냥꾼"), "이름이 없으면 얕보인다");
  for (const dominant of ["마도", "정도", "사도"]) {
    for (const chapter of [2, 3, 4, 5]) {
      assert.ok(Object.values(DB.enemies).some((e) => e.requires?.dominant === dominant && e.chapters.includes(chapter)), `${dominant} ${chapter}장`);
    }
  }
});

test("성향과 명성에 따라 사건이 달라진다", () => {
  const p = new Player();
  p.alignment.마도 = 10;
  assert.ok(eventView(p, "쫓기는소녀").text.includes("그쪽이 낫다"));
  assert.ok(checkRequires(p, DB.events.마도_토벌령.requires));
  assert.ok(!checkRequires(p, DB.events.정도_은인.requires));
  const events = Object.values(DB.events);
  for (const dominant of ["마도", "정도", "사도"]) {
    assert.ok(events.filter((e) => e.requires?.dominant === dominant).length >= 2, dominant);
    assert.ok(events.filter((e) => (e.variants || []).some((v) => v.requires?.dominant === dominant)).length >= 4, `${dominant} 반응`);
  }
  assert.ok(events.filter((e) => e.requires?.min_fame >= 60).length >= 3);
});

test("기량 최대는 999이고 예전 저장은 단위를 맞춘다", () => {
  const p = new Player();
  p.external = 995;
  assert.equal(p.gainStat("external", 50), 4);
  assert.equal(p.external, 999);
  const old = { ...new Player().toDict(), external: 30, internal: 28, martial: 28, mind: 28 };
  delete old.stat_scale;
  const loaded = Player.fromDict(old);
  assert.equal(loaded.external, 300);
  assert.equal(Player.fromDict(loaded.toDict()).external, 300);
  assert.equal(DB.realms.saengsa.min_stat, 950);
});

test("자질의 기량 효과는 네 기량에 고르다", () => {
  const stats = ["external", "internal", "martial", "mind"];
  const total = (type, field) => stats.map((stat) => Object.values(DB.traits).filter((t) => !t.hidden)
    .flatMap((t) => t.effects).filter((e) => e.type === type && e.stat === stat).reduce((sum, e) => sum + e[field], 0));
  for (const [type, field] of [["start_stat", "amount"], ["growth_rate", "percent"], ["battle_buff", "amount"]]) {
    assert.equal(new Set(total(type, field)).size, 1, `${type} ${total(type, field)}`);
  }
});

test("두 기량 자질은 여섯 묶음이 모두 있고 같은 값이며 맞바꾸는 자질은 네 기량이 한 번씩 오르내린다", () => {
  const stats = ["external", "internal", "martial", "mind"];
  const starts = (t) => t.effects.filter((e) => e.type === "start_stat");
  const traits = Object.values(DB.traits).filter((t) => !t.hidden);
  const pairs = traits.filter((t) => starts(t).length === 2 && starts(t).every((e) => e.amount > 0));
  const seen = new Set(pairs.map((t) => starts(t).map((e) => e.stat).sort().join("+")));
  assert.equal(seen.size, 6, [...seen].join(" "));
  assert.equal(pairs.length, 6);
  assert.equal(new Set(pairs.map((t) => `${t.cost}/${t.rarity}/${starts(t)[0].amount}`)).size, 1);
  const swaps = traits.filter((t) => starts(t).length === 2 && starts(t).some((e) => e.amount < 0));
  for (const sign of [1, -1]) {
    const moved = swaps.flatMap((t) => starts(t).filter((e) => Math.sign(e.amount) === sign).map((e) => e.stat)).sort();
    assert.deepEqual(moved, [...stats].sort());
  }
});

test("사건에 반응한다고 적힌 자질은 실제로 반응하는 사건이 있다", () => {
  const text = readdirSync("www/data").filter((f) => f.startsWith("events_")).map((f) => readFileSync(`www/data/${f}`, "utf8")).join("");
  for (const [key, trait] of Object.entries(DB.traits)) {
    if (trait.reacts) assert.ok(text.includes(`"trait": "${key}"`), key);
  }
});

test("자질은 등급별로 모여 있고 등급마다 값의 범위가 겹치지 않는다", () => {
  const traits = Object.values(DB.traits).filter((t) => !t.hidden);
  const order = traits.map((t) => t.rarity).filter((r, i, all) => r !== all[i - 1]);
  assert.deepEqual(order, ["일반", "희귀", "전설"]);
  const range = (r) => traits.filter((t) => t.rarity === r).map((t) => t.cost);
  assert.ok(Math.max(...range("일반")) < Math.min(...range("희귀")));
  assert.ok(Math.max(...range("희귀")) < Math.min(...range("전설")));
});

test("한 기량 자질은 네 기량이 값도 반응 사건 수도 같다", () => {
  const text = readdirSync("www/data").filter((f) => f.startsWith("events_")).map((f) => readFileSync(`www/data/${f}`, "utf8")).join("");
  const keys = ["강건한_육체", "선천진기", "타고난안목", "총명"];
  assert.equal(new Set(keys.map((k) => DB.traits[k].cost)).size, 1);
  assert.equal(new Set(keys.map((k) => text.split(`"trait": "${k}"`).length)).size, 1);
});

test("공통 자질의 설명은 출신을 단정하지 않는다", () => {
  for (const t of Object.values(DB.traits)) {
    if (!t.hidden && !t.origin) assert.doesNotMatch(t.desc, /어릴|집안|태어|자제|가문/, t.name);
  }
});

test("채비는 다음 강호행 한 번만 쓰이고 값이 싸며 네 기량이 같다", () => {
  withKarma(50);
  assert.ok(buyProvision("호골주"));
  assert.ok(!buyProvision("호골주"), "같은 것은 하나만");
  assert.ok(buyProvision("약꾸러미"));
  assert.ok(buyProvision("노자"));
  assert.ok(refundProvision("노자"));
  assert.equal(loadMeta().current_karma, 47);
  const first = new Game();
  first.start("무림초출");
  const second = new Game();
  second.start("무림초출");
  assert.equal(first.player.external, second.player.external + 40);
  assert.equal(first.player.inventory.금창약, (second.player.inventory.금창약 || 0) + 3);
  assert.deepEqual(loadMeta().provisions, []);
  assert.ok(Object.values(DB.karma.provisions).every((p) => p.cost <= 3));
  const singles = Object.values(DB.karma.provisions).map((p) => p.effects).filter((e) => e.length === 1 && e[0].type === "start_stat");
  assert.deepEqual(singles.map((e) => e[0].stat).sort(), ["external", "internal", "martial", "mind"].sort());
  assert.equal(new Set(singles.map((e) => e[0].amount)).size, 1);
  withKarma(0);
});

test("출신 전용 기틀은 그 출신에만 적용된다", () => {
  const data = loadMeta();
  data.upgrades = { 창궁검리: 2 };
  assert.equal(upgradeTraits(data, "남궁세가").length, 2);
  assert.equal(upgradeTraits(data, "하오문").length, 0);
});

test("출신 고유 무공은 장터나 적에게서 얻지 못하고 권마의 시험은 권마 출신 전용이다", () => {
  const owned = Object.keys(DB.skills).filter((k) => DB.skills[k].origin);
  for (const k of owned) {
    assert.ok(!Object.values(DB.market).some((i) => i.effects.some((e) => e.skill === k)), k);
    assert.ok(!Object.values(DB.enemies).some((e) => e.drop?.skill === k), k);
  }
  assert.equal(DB.events.권마시험.requires.origin, "권마계승");
  assert.equal(DB.karma.content.권마의시험.origin, "권마계승");
});

test("누적 카르마는 마지막 보상을 넘어도 계속 쌓인다", () => {
  withKarma(0);
  addKarma(1500);
  assert.equal(loadMeta().total_karma, 1500);
  assert.equal(loadMeta().current_karma, 1500);
  withKarma(0);
});

test("조사는 받침에 맞게 붙는다", () => {
  assert.equal(josa("천마", "을/를"), "를");
  assert.equal(josa("낭인", "을/를"), "을");
  assert.equal(josa("「백보신권」", "이/가"), "이");
  assert.equal(josa("칼", "으로"), "로");
  assert.equal(josa("봉", "으로"), "으로");
});

test("화면 문장에 받침 조사를 얼버무린 표기가 없다", () => {
  for (const dir of ["www/data", "www/js"]) {
    for (const f of readdirSync(dir)) {
      assert.doesNotMatch(readFileSync(`${dir}/${f}`, "utf8"), /[을이은과와]\((를|가|는|와|과)\)/, f);
    }
  }
});

test("끝난 판의 카르마: 천마까지 가면 결과가 장을 대체하고 경지를 더한다", () => {
  const finish = (turn, realm, victory, setup = () => {}) => {
    withKarma(0);
    const data = loadMeta();
    data.achievements = DB.karma.achievements.map((x) => x.key); // 공적 카르마는 빼고 잰다
    saveMeta(data);
    const game = new Game();
    game.start("무림초출");
    Object.assign(game.player, { turn, realm });
    game.player.fame = 0;
    setup(game.player);
    game.finishGame(victory);
    return game.ending;
  };
  assert.equal(finish(10, "일류", false).karma, 1, "1장, 일류");
  assert.equal(finish(100, "화경", false).karma, 5 + 3, "5장, 화경");
  assert.equal(finish(120, "현경", false).karma, 5 + 4, "천마에게 지면 5와 경지");
  const hurt = finish(120, "일류", true);
  assert.equal(hurt.key, "배드");
  assert.equal(hurt.karma, 7, "상처뿐인 승리 7, 장은 더하지 않는다");
  assert.ok(!hurt.karmaLines.some((l) => l.includes("도달한 장")));
  const hero = (p) => { p.hp = p.maxHp(); p.qi = p.maxQi(); };
  const legend = finish(120, "화경", true, hero);
  assert.equal(legend.key, "기본");
  assert.equal(legend.karma, 10 + 3);
  const saengsa = finish(120, "현경", true, (p) => {
    p.external = p.internal = p.martial = p.mind = 999;
    p.battles = 60;
    hero(p);
  });
  assert.equal(saengsa.key, "생사경");
  assert.equal(saengsa.karma, 25, "생사경은 경지를 더하지 않고 총 25");
  assert.equal(DB.endings.karma.귀순, 7);
  const clean = loadMeta();
  clean.achievements = [];
  saveMeta(clean);
  withKarma(0);
});

test("첫 천마 격파의 카르마는 공적으로 받는다", () => {
  assert.equal(DB.karma.milestones, undefined);
  assert.equal(DB.karma.achievements.find((a) => a.key === "첫승리").karma, 5);
});

const endingRows = (key) => DB.endings.frames[key].flatMap((g) => (Array.isArray(g) ? g : g.rows));

test("결말은 출신, 성향, 명성, 쓰던 무공마다 문장이 있다", () => {
  assert.deepEqual(Object.keys(DB.endings.titles).sort(), ["귀순", "기본", "배드", "사망", "생사경"].sort());
  for (const key of Object.keys(DB.endings.titles)) {
    const rows = endingRows(key);
    for (const origin of DB.origins.order) assert.ok(rows.some((r) => r.requires.origin === origin), `${key} ${origin}`);
    for (const style of ["검법", "도법", "창법", "봉법", "권법", "장법", "암기"]) {
      assert.ok(rows.some((r) => r.requires.main_category === style), `${key} ${style}`);
    }
    assert.ok(rows.some((r) => r.requires.min_fame), `${key} 높은 명성`);
    assert.ok(rows.some((r) => r.requires.max_fame), `${key} 낮은 명성`);
  }
  for (const key of ["사망", "배드", "기본", "생사경"]) {
    for (const side of ["정도", "사도", "마도"]) assert.ok(endingRows(key).some((r) => r.requires.dominant === side), `${key} ${side}`);
  }
  const attacks = Object.keys(DB.skills).filter((k) => DB.skills[k].grade === "신공" && DB.skills[k].type === "공격무공");
  for (const k of attacks) assert.ok(endingRows("기본").some((r) => r.requires.main_skill === k), k);
});

test("결말 문장은 상황을 따르고 서로 부딪치지 않는다", () => {
  const text = (origin, setup, ending) => {
    const p = new Player(origin);
    setup(p);
    return buildEpilogue(p, ending).join(" ");
  };
  assert.notEqual(text("남궁세가", () => {}, "사망"), text("하오문", () => {}, "사망"));
  assert.ok(text("하오문", (p) => { p.fame = 150; p.turn = 100; }, "사망").includes("잔이 하나씩"));
  assert.ok(text("하오문", (p) => { p.fame = 0; }, "사망").includes("무명"));
  assert.ok(text("하오문", (p) => { p.alignment.마도 = 10; }, "사망").includes("잔치"));
  assert.ok(text("하북팽가", () => {}, "귀순").includes("네 형"));
  // 이벤트 결과를 겪지 않았으면 겪은 것처럼 말하지 않는다
  assert.ok(text("개방제자", () => {}, "기본").includes("범인은 아직"));
  assert.ok(text("개방제자", (p) => p.addFlag("개방_범인"), "기본").includes("범인은 찾았소"));
  assert.ok(!text("남궁세가", (p) => p.addFlag("가문복수"), "기본").includes("창궁의 깃발"));
  assert.ok(!text("표국표사", () => {}, "배드").includes("표물은 닿았다"));
  // 쓰는 무공을 따른다. 익히기만 한 신공은 말하지 않는다
  const p = new Player("남궁세가");
  p.learnSkill(new Skill("제왕검형"));
  assert.ok(!buildEpilogue(p, "기본").join(" ").includes("제왕검형"));
  p.mainSkill = "제왕검형";
  assert.ok(buildEpilogue(p, "기본").join(" ").includes("제왕검형"));
  // 모든 경우를 돌려 빈 값이나 겹친 문장, 어긋나는 명성 문장이 없는지 본다
  const famousWords = ["천하가", "별호"];
  for (const key of Object.keys(DB.endings.titles)) {
    for (const origin of DB.origins.order) {
      for (const side of [null, "정도", "사도", "마도"]) {
        for (const fame of [0, 20, 40, 70, 150]) {
          const q = new Player(origin);
          q.fame = fame;
          if (side) q.alignment[side] = 12;
          q.turn = 120;
          for (const flag of ["찬탈", "단목휘_죽음", "단목휘_동맹", "제자_완성", "가문재건"]) if (fame === 150) q.addFlag(flag);
          const lines = buildEpilogue(q, key);
          assert.ok(lines.length >= 2, `${key} ${origin}`);
          assert.equal(new Set(lines).size, lines.length, `${key} 겹친 문장`);
          for (const line of lines) {
            assert.ok(typeof line === "string" && line.length > 3 && !/undefined|null|NaN/.test(line), line);
          }
          if (fame <= 29) for (const w of famousWords) assert.ok(!lines.join(" ").includes(w), `${key} 무명인데 ${w}`);
        }
      }
    }
  }
  assert.ok(!text("남궁세가", (p) => p.addFlag("찬탈"), "배드").includes("끝내 사실"));
  const all = JSON.stringify(DB.endings.frames);
  for (const word of ["전생", "회차", "다음 생"]) assert.ok(!all.includes(word), word);
  for (const key of ["사망", "귀순"]) assert.ok(!endingRows(key).some((r) => /천마를 (쓰러|넘)/.test(r.text)), key);
});

test("마도천하는 천마를 넘은 것으로 치지 않는다", () => {
  withKarma(0);
  const data = loadMeta();
  data.achievements = [];
  data.endings_seen = [];
  data.total_wins = 0;
  data.origin_wins = [];
  saveMeta(data);
  const game = new Game();
  game.start("무림초출");
  game.finishGame(true, "귀순");
  const after = loadMeta();
  assert.ok(!after.achievements.includes("첫승리"));
  assert.equal(after.total_wins, 0);
  assert.deepEqual(after.origin_wins, []);
  assert.ok(!legacyAvailable(after));
  withKarma(0);
});

test("처음 이른 경지에 주는 카르마는 없고 생사경은 강호의 전설 다음 결말이다", () => {
  assert.equal(DB.karma.milestones, undefined);
  assert.equal(DB.endings.karma.생사경, 25);
  assert.ok(DB.endings.karma.생사경 > DB.endings.karma.기본);
  const order = Object.keys(DB.endings.titles);
  assert.equal(order.indexOf("생사경"), order.indexOf("기본") + 1);
  assert.equal(DB.karma.rewards[DB.karma.rewards.length - 1].at, 1000);
  for (const r of DB.karma.rewards.filter((x) => x.slot)) assert.ok(r.desc.includes("하나 더"));
});

test("적은 장에 맞는 위상으로 나온다", () => {
  for (const [key, e] of Object.entries(DB.enemies)) {
    for (const chapter of e.chapters || []) {
      if (e.ranks) assert.ok(chapter >= e.ranks[0] && chapter <= e.ranks[1], `${key} ${chapter}장`);
    }
    if (!e.ranks) continue;
    for (const chapter of [1, 2, 3, 4, 5]) {
      const fit = DB.enemies[statureEnemy(key, chapter)];
      const below = chapter < e.ranks[0] && !e.below;
      const above = chapter > e.ranks[1] && !e.above;
      if (!below && !above) assert.ok(!fit.ranks || (chapter >= fit.ranks[0] && chapter <= fit.ranks[1]) || !fit.above || !fit.below, `${key} ${chapter}장 ${fit.name}`);
    }
  }
  assert.equal(statureEnemy("산적", 1), "산적");
  assert.notEqual(statureEnemy("산적", 5), "산적", "5장에 산적이 나오지 않는다");
  assert.equal(statureEnemy("낭인", 4), "독고객");
  assert.equal(statureEnemy("낭인", 5), "혈마대귀");
  assert.equal(statureEnemy("십이마장", 3), "화경마인");
  assert.equal(statureEnemy("권마의그림자", 2), "권마의그림자", "정해진 인물은 그대로 나온다");
  const game = newGame();
  game.player.turn = 100;
  game.startBattle("산적");
  assert.equal(game.battle.enemy.name, DB.enemies[statureEnemy("산적", 5)].name);
});

test("이미 강호록에 있는 인물은 다시 알리지 않는다", () => {
  const data = loadMeta();
  data.global_codex = data.global_codex.filter((k) => k !== "산적");
  saveMeta(data);
  const game = newGame();
  game.player.recordEnemyEncounter("산적");
  assert.equal(game.commitCodex().length, 1);
  const second = newGame();
  second.player.recordEnemyEncounter("산적");
  assert.equal(second.commitCodex().length, 0);
  recordEventPick("시험사건", "본문", "선택", "결과");
  const before = JSON.stringify(loadEventLog().시험사건);
  recordEventPick("시험사건", "본문", "선택", "결과");
  assert.equal(JSON.stringify(loadEventLog().시험사건), before, "같은 선택과 결과는 다시 쓰지 않는다");
  recordEventPick("시험사건", "본문", "다른 선택", "다른 결과");
  assert.equal(Object.keys(loadEventLog().시험사건.picks).length, 2, "고르지 않았던 선택은 기록한다");
  delete loadEventLog().시험사건;
});

test("큰 그릇은 세 번까지 사고 없어진 자질은 값을 돌려준다", () => {
  withKarma(500);
  assert.ok(buyUpgrade("그릇"));
  assert.ok(buyUpgrade("그릇"));
  assert.ok(buyUpgrade("그릇"));
  assert.ok(!buyUpgrade("그릇"));
  assert.equal(extraSlots(loadMeta()), 3);
  withKarma(0);
  const data = loadMeta();
  data.unlocked_traits = ["무골", "외길"];
  saveMeta(data);
  const after = loadMeta();
  assert.deepEqual(after.unlocked_traits, ["외길"]);
  assert.equal(after.current_karma, 5);
  after.unlocked_traits = [];
  saveMeta(after);
  withKarma(0);
});

test("생사경 결말의 카르마는 25이다", () => {
  assert.equal(DB.endings.karma.생사경, 25);
});

test("자질의 새 효과가 동작한다", () => {
  const veteran = new Player("무림초출", ["백전노장"]);
  assert.equal(veteran.battles, 8);
  const p = new Player("무림초출", ["절세미공"]);
  const skill = p.bestSkill();
  skill.mastery = 100;
  skill.gainMastery(1);
  assert.equal(skill.grade, "명품");
  assert.equal(skill.mastery, 60);
  const q = new Player("남궁세가", ["이기어검"]);
  const battle = new Battle(q, new Enemy("산적"));
  assert.ok(battle.artCost(q.bestSkill()) < q.bestSkill().qiCost || q.bestSkill().qiCost <= 1);
  const poison = new Player("남궁세가", ["독인"]);
  const b2 = new Battle(poison, new Enemy("산적"));
  b2.applyPoisonOnHit(poison.bestSkill());
  assert.ok(b2.enemyPoison);
});

test("예전 묶음 강화는 낱개 기틀로 옮겨진다", () => {
  withKarma(0);
  const data = loadMeta();
  data.upgrades = { 근골: 2, 심지: 1 };
  saveMeta(data);
  const after = loadMeta();
  assert.deepEqual(after.upgrades, { 강골: 2, 혜안: 2, 원기: 1, 명경: 1 });
  data.upgrades = {};
  saveMeta(data);
});

test("카르마 상점에 전생과 회차 표현이 없다. 유산만 예외다", () => {
  const texts = (list) => list.map((x) => `${x.name} ${x.desc}`).join(" ");
  const { upgrades, content, rewards, achievements } = DB.karma;
  const shop = texts([...Object.values(upgrades), ...Object.values(content), ...rewards, ...achievements]);
  const traits = texts(Object.values(DB.traits).filter((t) => !t.hidden));
  for (const word of ["전생", "환생", "회차", "윤회", "다음 생", "번의 생"]) {
    assert.ok(!shop.includes(word), `상점 ${word}`);
    assert.ok(!traits.includes(word), `자질 ${word}`);
  }
});

test("출신마다 전용 자질과 인연이 있고 그 출신만 쓴다", () => {
  for (const key of DB.origins.order) {
    const traits = Object.keys(DB.traits).filter((t) => DB.traits[t].origin === key);
    assert.equal(traits.length, 2, `${key} 자질`);
    const content = Object.keys(DB.karma.content).filter((c) => DB.karma.content[c].origin === key);
    assert.equal(content.length, 2, `${key} 인연`);
    for (const c of content) assert.ok(Object.values(DB.events).some((e) => e.requires?.origin === key && e.requires?.unlocked === c), `${key} 인연 사건 ${c}`);
    assert.equal(Object.values(DB.karma.upgrades).filter((u) => u.origin === key).length, 1, `${key} 기틀`);
    for (const trait of traits) {
      const reacts = Object.values(DB.events).filter((e) => (e.variants || []).some((v) => v.requires?.trait === trait));
      assert.ok(reacts.length >= 2, `${trait} 반응 ${reacts.length}`);
    }
  }
  const data = loadMeta();
  data.unlocked_origins = Object.keys(DB.origins.origins);
  data.unlocked_traits = ["창궁의혈통"];
  saveMeta(data);
  const game = new Game();
  game.start("하오문", ["창궁의혈통"]);
  assert.ok(!game.player.traits.includes("창궁의혈통"), "다른 출신은 장착할 수 없다");
  game.start("남궁세가", ["창궁의혈통"]);
  assert.ok(game.player.traits.includes("창궁의혈통"));
  assert.equal(game.player.skills.find((s) => s.key === "창궁검법").mastery, 30);
  data.unlocked_traits = [];
  saveMeta(data);
});

test("사건 반응 자질은 실제로 사건에 반응한다", () => {
  for (const [key, trait] of Object.entries(DB.traits)) {
    if (trait.hidden || !trait.reacts) continue;
    const n = Object.values(DB.events).filter((e) => (e.variants || []).some((v) => v.requires?.trait === key)).length;
    assert.ok(n >= 3, `${key} ${n}`);
  }
});

test("시작 선물은 주무공 계열을 따른다", () => {
  const p = new Player("하북팽가", ["병기광", "수련도구", "비장의도구", "가전비급"]);
  const lines = grantStartGifts(p);
  assert.ok(lines.length >= 4);
  assert.ok(equipmentBonus(p, "weapon") >= 10);
  assert.equal(DB.market[p.weapon].effects[0].style, "도법");
  assert.equal(p.inventory.베기짚단, 4);
  assert.equal(p.inventory.맹호도유, 4);
  assert.ok(p.skills.some((s) => s.category === "도법" && s.grade === "명품" && s.key !== "오호단문도"));
  const drifter = new Player("무림초출", ["수련도구", "현기의호흡"]);
  applyEffects(drifter, { start_weapon: "창법", start_mindset: "양생공" });
  assert.equal(drifter.inventory.납창추, 4, "강호초출은 첫 병기를 고른 뒤 받는다");
  assert.ok(drifter.hasSkill("곤륜현기공"), "자질로 받은 심법은 첫 심법을 골라도 남는다");
});

test("누적 카르마 보상은 넘긴 만큼 적용되고 자질 칸과 맞는다", () => {
  const { rewards } = DB.karma;
  assert.ok(rewards.every((r, i) => i === 0 || r.at > rewards[i - 1].at));
  let slots = 1;
  for (const r of rewards.filter((x) => x.slot)) {
    slots += 1;
    assert.equal(traitSlots(r.at), slots);
    assert.equal(traitSlots(r.at - 1), slots - 1);
  }
  const data = loadMeta();
  const before = data.total_karma;
  data.total_karma = 120;
  data.unlocked_origins = Object.keys(DB.origins.origins);
  saveMeta(data);
  const game = new Game();
  game.start("남궁세가");
  assert.ok(game.player.traits.includes("누적_120"));
  assert.ok(!game.player.traits.includes("누적_150"));
  assert.equal(nextReward(loadMeta()).at, 150);
  data.total_karma = before;
  saveMeta(data);
});

test("강호록은 사건에서 본 본문과 고른 선택, 결과를 남긴다", () => {
  const p = new Player();
  resolveChoice(p, "폐사찰", 0);
  const entry = loadEventLog().폐사찰;
  assert.ok(entry.texts.length >= 1);
  assert.ok(entry.texts[0].includes("노승"));
  const [label, results] = Object.entries(entry.picks)[0];
  assert.ok(label.length && results[0].length);
  assert.ok(JSON.parse(exportRecords()).event_log.폐사찰, "내보내기에 들어간다");
  resolveChoice(p, "주막싸움", 0);
  resolveChoice(p, "주막싸움", 2);
  assert.equal(Object.keys(loadEventLog().주막싸움.picks).length, 2, "고른 선택마다 따로 남는다");
});

test("강화는 상태 창과 고르는 화면에 특성으로 보이지 않는다", () => {
  assert.ok(DB.traits.환생_강골_1.hidden);
  assert.ok(Object.values(DB.traits).filter((t) => !t.hidden).every((t) => t.rarity));
});

test("인연은 사야 나오고 꺼 두면 나오지 않는다", () => {
  withKarma(12);
  const plain = new Game();
  plain.start("무림초출");
  assert.ok(!checkRequires(plain.player, DB.events.유적_석문.requires));
  assert.ok(buyContent("숨겨진유적"));
  const game = new Game();
  game.start("무림초출");
  assert.ok(checkRequires(game.player, DB.events.유적_석문.requires));
  toggleContent("숨겨진유적");
  assert.deepEqual(activeContent(), []);
  const off = new Game();
  off.start("무림초출");
  assert.ok(!checkRequires(off.player, DB.events.유적_석문.requires));
  withKarma(0);
});

test("모든 인연에 사건이나 기연이 있다", () => {
  const text = JSON.stringify([DB.events, DB.fortunes]);
  for (const key of Object.keys(DB.karma.content)) assert.ok(text.includes(`"unlocked":"${key}"`), key);
});

test("유산은 천마를 쓰러뜨린 뒤 열리고, 남기고, 이어받으면 사라진다", () => {
  withKarma(30);
  assert.ok(!openLegacy(), "아직 천마를 쓰러뜨리지 못했다");
  withKarma(30, { endings_seen: ["기본"] });
  assert.ok(openLegacy());
  const first = new Game();
  first.start("무림초출");
  first.player.learnSkill(Skill.fromDict({ key: "양가창법", grade: "일절", mastery: 80 }));
  first.player.weapon = "운철보검";
  first.finishGame(false);
  const options = first.legacyOptions();
  const index = options.findIndex((o) => o.key === "양가창법");
  first.leaveLegacy(index);
  first.leaveLegacy(index);
  assert.equal(loadMeta().legacies.length, 1, "한 판에 하나만 남긴다");

  const next = new Game();
  next.start("무림초출", [], 0);
  const skill = next.player.skills.find((s) => s.key === "양가창법");
  assert.equal(skill.grade, "상승", "한 등급 낮아지고 상승을 넘지 않는다");
  assert.ok(next.player.hasSkill("양가창법"));
  assert.notEqual(next.player.mainSkill, "양가창법", "이어받아도 쓰던 주무공은 그대로다");
  assert.equal(loadMeta().legacies.length, 0);

  first.ending.legacyLeft = null;
  first.leaveLegacy(options.findIndex((o) => o.key === "운철보검"));
  const third = new Game();
  third.start("무림초출", [], 0);
  assert.equal(third.player.weapon, "강철검", "장비는 낮은 단계로 돌아온다");
  withKarma(0);
});

test("카르마는 도달한 장과 경지, 처음 이룬 일만큼 늘어난다", () => {
  withKarma(0);
  const game = new Game();
  game.start("무림초출");
  game.player.turn = 80;
  game.player.realm = "화경";
  game.finishGame(false);
  assert.equal(game.ending.karma, 1 + 3 + 3);
  const again = new Game();
  again.start("무림초출");
  again.player.turn = 80;
  again.player.realm = "화경";
  again.finishGame(false);
  assert.equal(again.ending.karma, 1 + 3 + 3, "처음 이른 경지에 주는 보상은 없다");
  withKarma(0);
});

test("수상한 누군가에게 카르마로 거래한다", () => {
  withKarma(4);
  const game = new Game();
  game.start("무림초출");
  const market = openMarket(119, game.player);
  assert.ok(market.stock.some((s) => s.key === "생사단"));
  assert.equal(blockReason(game.player, "운명의패"), "카르마 부족");
  const before = game.player.external;
  assert.ok(buy(game.player, market, "생사단")[0]);
  assert.equal(game.player.external, before + 30);
  assert.equal(loadMeta().current_karma, 1);
  withKarma(0);
});

// ---------- 연계 인카운터 ----------

/** 전투를 바로 끝내며 끝까지 굴린다. 첫 편은 강제로 시작해 볼 수 있다. */
function runToEnd(game, { accept = true, giveUp = false, onEvent = () => {} } = {}) {
  for (let i = 0; i < 6000 && game.player.alive; i++) {
    const p = game.player;
    p.hp = p.maxHp();
    if (game.battle) {
      // 연계 일정만 보는 시험이라 약한 몸으로 강적에게 죽지 않게 한다
      game.battle.enemy.hp = 1;
      game.battle.enemy.attack = 0;
      game.battleAction("기본공격");
      continue;
    }
    if (game.event) {
      onEvent(game);
      const view = eventView(p, game.event.key);
      const open = view.choices.filter((c) => !c.locked);
      const event = DB.events[game.event.key];
      const list = event.choices;
      const pickBy = (name) => open.find((c) => {
        const raw = view.choices.find((x) => x.index === c.index);
        return raw && (list.find((x) => x.label === c.label) || {}).outcomes?.some((o) => o.effects?.[name]);
      });
      const chosen = (event.chain && event.chain.index === 0 && accept && pickBy("chain_start"))
        || (event.chain && giveUp && pickBy("chain_abandon"))
        || open.find((c) => { const x = list.find((y) => y.label === c.label); return !x?.outcomes.some((o) => o.effects?.chain_abandon || o.effects?.ending); })
        || open[0];
      game.chooseEvent(chosen.index);
      continue;
    }
    if (game.market) { game.marketLeave(); continue; }
    if (game.pendingNext) { game.advanceTurn(); continue; }
    if (game.ending) break;
    game.action("탐색");
  }
}

test("연계 데이터가 규칙을 지킨다", () => {
  assert.deepEqual(validateChains(), []);
  assert.ok(Object.keys(DB.chains).length >= 8);
});

test("남은 달이 모자라면 연계가 시작되지 않는다", () => {
  const p = new Player();
  const id = "제자를키우다";
  p.turn = LAST_CHAIN_TURN - DB.chains[id].span - 2;
  assert.ok(canStartChain(p, id));
  p.turn += 1;
  assert.ok(!canStartChain(p, id));
  p.turn = 1;
  p.chains = [{ id: "역병의고을", next: 1, due: 5 }, { id: "장강수로", next: 1, due: 5 }];
  assert.ok(!canStartChain(p, id), "동시에 둘까지만");
});

test("시작한 연계는 포기하지 않으면 천마봉 전에 끝까지 나온다", () => {
  for (let run = 0; run < 150; run++) {
    const game = new Game();
    game.start("무림초출");
    const started = new Set();
    const seen = {};
    let finalWithChains = 0;
    runToEnd(game, {
      onEvent: (g) => {
        const { chain } = DB.events[g.event.key];
        if (chain) {
          (seen[chain.id] ||= new Set()).add(chain.index);
          if (chain.index === 0) started.add(chain.id);
        }
        if (DB.events[g.event.key].kind === "final" && g.player.chains.length) finalWithChains++;
      },
    });
    assert.equal(finalWithChains, 0, "천마봉에 남은 연계가 있다");
    for (const id of started) {
      if (!game.player.chronicle.some((c) => c.text.includes(DB.chains[id].title))) continue;
      assert.equal(seen[id].size, DB.chains[id].keys.length, `${id}가 끝까지 나오지 않았다`);
    }
  }
});

test("어느 달에 강제로 시작해도 천마봉 전에 끝난다", () => {
  for (const id of Object.keys(DB.chains)) {
    const span = DB.chains[id].span;
    for (const turn of [LAST_CHAIN_TURN - span - 2, 60, 96]) {
      if (turn < 1) continue;
      const game = new Game();
      game.start("무림초출");
      game.player.turn = turn;
      game.event = null;
      if (!canStartChain(game.player, id)) continue;
      game.event = { key: DB.chains[id].keys[0], forced: false };
      const start = DB.events[DB.chains[id].keys[0]].choices.findIndex((c) => c.outcomes.some((o) => o.effects?.chain_start));
      const extra = eventView(game.player, game.event.key).choices.findIndex((c) => c.index === start);
      game.chooseEvent(extra < 0 ? start : start);
      assert.equal(game.player.chains.length, 1);
      let finalLeft = -1;
      runToEnd(game, { onEvent: (g) => { if (DB.events[g.event.key].kind === "final") finalLeft = g.player.chains.length; } });
      assert.equal(finalLeft, 0, `${id} ${turn}달 시작`);
    }
  }
});

test("중간에 손을 떼면 다음 편이 나오지 않는다", () => {
  const game = new Game();
  game.start("무림초출");
  game.event = { key: DB.chains.과부의복수.keys[0], forced: false };
  game.chooseEvent(0);
  assert.equal(game.player.chains.length, 1);
  game.player.turn = game.player.chains[0].due;
  game.pendingNext = false;
  game.openStoryEvent();
  game.event = { key: DB.chains.과부의복수.keys[1], forced: false };
  const index = eventView(game.player, game.event.key).choices.find((c) => c.label === "여기서 손을 뗀다").index;
  game.chooseEvent(index);
  assert.equal(game.player.chains.length, 0);
});

test("저장했다 이어 해도 연계가 유지된다", () => {
  const p = new Player();
  p.chains = [{ id: "역병의고을", next: 1, due: 9 }];
  assert.deepEqual(Player.fromDict(p.toDict()).chains, p.chains);
});

// ---------- 무공과 출신의 고른 분포 ----------

test("무기 계열마다 무공 수가 같고 등급이 고르다", () => {
  const styles = ["검법", "도법", "창법", "봉법", "권법", "장법", "암기"];
  const attacks = Object.values(DB.skills).filter((s) => s.type === "공격무공");
  for (const style of styles) {
    const list = attacks.filter((s) => s.category === style);
    assert.equal(list.length, 13, style);
    for (const [grade, min] of [["기본", 2], ["명품", 3], ["상승", 3], ["일절", 1], ["신공", 2]]) {
      assert.ok(list.filter((s) => s.grade === grade).length >= min, `${style} ${grade}`);
    }
    const sold = list.filter((s) => Object.values(DB.market).some((i) => i.effects.some((e) => e.skill === s.key || e.skill === s.name)));
    assert.ok(sold.length >= 3, `${style} 파는 비급`);
  }
  for (const style of ["도법", "창법", "봉법", "권법", "장법", "암기"]) {
    assert.ok(attacks.some((s) => s.category === style && s.legend), `${style} 전설`);
  }
});

test("각 출신에 서장과 맺음말, 천마 대사가 있다", () => {
  for (const origin of DB.origins.order) {
    assert.ok(Object.values(DB.storyEvents).some((e) => e.requires?.origin === origin && e.turn === 1), origin);
    assert.ok(DB.endings.frames.기본.flat().some((r) => r.requires?.origin === origin), origin);
  }
  for (const origin of DB.origins.order.slice(1)) {
    assert.ok(DB.enemies.천마.intros.some((i) => i.requires.origin === origin), origin);
  }
});

// ---------- 도구, 도감, 업적 ----------

test("계열마다 수련 도구와 전투 도구가 하나씩 있다", () => {
  for (const style of ["검법", "도법", "창법", "봉법", "권법", "장법", "암기"]) {
    const tools = Object.values(DB.market).filter((i) => i.category === "도구" && i.effects[0].style === style);
    assert.equal(tools.filter((i) => i.effects[0].type === "mastery").length, 1, style);
    assert.equal(tools.filter((i) => i.effects[0].type === "atk_buff").length, 1, style);
  }
});

test("수련 도구는 숙련도를 올리고 맞지 않으면 절반이다", () => {
  const p = new Player();
  p.addItem("매화숫돌");
  p.addItem("베기짚단");
  const main = p.bestSkill();
  useConsumable(p, "매화숫돌");
  assert.equal(main.mastery, 25);
  useConsumable(p, "베기짚단");
  assert.equal(main.mastery, 37);
});

test("전투 도구는 전투에서만 쓰고 공격력을 올린다", () => {
  const game = newGame();
  game.player.addItem("벽력검유");
  game.useItem("벽력검유");
  assert.equal(game.player.inventory.벽력검유, 1, "전투 밖에서는 쓰이지 않는다");
  const battle = new Battle(game.player, new Enemy("낭인", 1));
  battle.useItem("벽력검유");
  assert.equal(battle.atkBuff.percent, 40);
  game.player.addItem("맹호도유");
  battle.useItem("맹호도유");
  assert.equal(battle.atkBuff.percent, 20, "다른 계열은 절반");
});

test("겪은 사건이 도감에 남고 번외 시간은 남지 않는다", () => {
  const game = new Game();
  game.start("무림초출");
  assert.equal(game.event.key, "시작_병기고");
  game.chooseEvent(0);
  game.chooseEvent(0);
  assert.ok(!loadMeta().known_events.includes("시작_병기고"), "첫 병기는 기록하지 않는다");
  const key = game.event.key;
  game.chooseEvent(0);
  assert.ok(loadMeta().known_events.includes(key));
});

test("업적이 기록되고 카르마를 주며 한 번만 받는다", () => {
  const data = loadMeta();
  Object.assign(data, { achievements: [], known_events: [], origin_wins: [], total_runs: 0, milestones: ["절정", "초절정", "화경", "현경", "격파"] });
  saveMeta(data);
  const game = newGame();
  game.player.kills = 40;
  game.finishGame(true);
  assert.ok(loadMeta().achievements.includes("백인"));
  assert.ok(loadMeta().achievements.includes("첫승리"));
  assert.ok(game.ending.karmaLines.some((l) => l.includes("마흔 명의 이름")));
  const again = newGame();
  again.player.kills = 40;
  again.finishGame(true);
  assert.ok(!again.ending.karmaLines.some((l) => l.includes("마흔 명의 이름")));
  assert.deepEqual(loadMeta().origin_wins, ["무림초출"]);
});

test("없어진 출신을 샀던 기록은 카르마로 돌려준다", () => {
  const data = loadMeta();
  data.unlocked_origins = ["무림초출", "세외도객", "살문탈주"];
  data.current_karma = 0;
  saveMeta(data);
  const after = loadMeta();
  assert.equal(after.current_karma, 10);
  assert.deepEqual(after.unlocked_origins, ["무림초출"]);
});

test("개방 출신은 사문을 지니고 시작한다", () => {
  assert.equal(new Player("개방제자").sect, "개방");
});

// ---------- 생사경과 출신의 위치 ----------

test("생사경은 기록대로 천마를 이긴 순간에만 판정된다", () => {
  const req = DB.realms.saengsa;
  assert.deepEqual([req.min_stat, req.battles, req.hp_ratio, req.qi_ratio], [950, 50, 0.8, 0.8]);
  const hero = () => {
    const g = newGame();
    const p = g.player;
    p.external = p.internal = p.martial = p.mind = 999;
    p.realm = "현경";
    p.battles = 60;
    p.hp = p.maxHp();
    p.qi = p.maxQi();
    return g;
  };
  const win = hero();
  win.finishGame(true);
  assert.equal(win.ending.key, "생사경");
  assert.equal(win.player.realm, "생사경");
  const hurt = hero();
  hurt.player.qi = Math.floor(hurt.player.maxQi() * 0.5);
  hurt.finishGame(true);
  assert.notEqual(hurt.ending.key, "생사경", "기력이 모자라면 아니다");
  const dead = hero();
  dead.finishGame(false);
  assert.equal(dead.ending.key, "사망");
  const climbing = hero();
  climbing.player.realm = "현경";
  assert.equal(breakthroughBlock(climbing.player), null, "일반 돌파로는 오르지 못한다");
});

test("어떤 사건이나 인연도 생사경 조건을 건드리지 않는다", () => {
  const text = JSON.stringify([DB.events, DB.karma.content, DB.traits]);
  assert.ok(!text.includes("생사경"));
  const shown = DB.karma.achievements.filter((a) => !a.hidden);
  assert.ok(!JSON.stringify(shown).includes("생사경"), "히든 엔딩을 미리 알리지 않는다");
});

test("출신은 너무 낮지도 높지도 않은 어엿한 위치의 인물이다", () => {
  const text = JSON.stringify(Object.values(DB.origins.origins).map((o) => [o.name, o.desc]));
  for (const word of ["방계", "서자", "탈주", "도망자", "탈영", "점소이", "파문", "소가주", "소장주", "소막주", "소교주", "소표두", "수제자", "후개", "후계"]) assert.ok(!text.includes(word), word);
});

test("이름이 바뀐 출신은 해금과 저장을 잃지 않고, 없어진 출신은 카르마로 돌려준다", () => {
  const data = loadMeta();
  data.unlocked_origins = ["무림초출", "소교주", "곤륜파"];
  data.current_karma = 0;
  saveMeta(data);
  const after = loadMeta();
  assert.deepEqual(after.unlocked_origins, ["무림초출", "혈지생환"]);
  assert.equal(after.current_karma, 5);
  const dict = new Player("혈지생환").toDict();
  dict.origin_key = "소교주";
  const p = Player.fromDict(dict);
  assert.equal(p.originKey, "혈지생환");
  assert.equal(p.origin, "피 연못의 생환자");
});

test("카르마를 늘리는 강화는 없고, 샀던 것은 돌려준다", () => {
  assert.ok(!DB.karma.upgrades.윤회);
  const data = loadMeta();
  data.upgrades = { 윤회: 2, 강골: 1 };
  data.current_karma = 1;
  saveMeta(data);
  const after = loadMeta();
  assert.equal(after.current_karma, 16);
  assert.deepEqual(after.upgrades, { 강골: 1 });
  data.upgrades = {};
  saveMeta(after);
});

test("격파 기록과 가장 오래 간 달이 남는다", () => {
  const data = loadMeta();
  data.total_wins = 0;
  data.best_turn = 0;
  saveMeta(data);
  const game = newGame();
  game.player.turn = 50;
  game.finishGame(true);
  assert.equal(loadMeta().total_wins, 1);
  assert.equal(loadMeta().best_turn, 50);
});

// ---------- 성취 옮기기 ----------

test("같은 계열의 낮거나 같은 품계 무공만 주무공으로 성취를 옮긴다", () => {
  const game = newGame();
  const p = game.player;
  const main = p.bestSkill();
  main.grade = "명품";
  main.mastery = 10;
  const same = new Skill("매화검법");
  same.grade = "명품";
  same.mastery = 40;
  const low = new Skill("운룡검법");
  low.grade = "기본";
  low.mastery = 50;
  const high = new Skill("천뢰검법");
  high.grade = "상승";
  high.mastery = 50;
  const other = new Skill("기초도법");
  other.mastery = 50;
  p.skills.push(same, low, high, other);
  assert.equal(same.masteryFor(main), 20);
  assert.equal(low.masteryFor(main), 15);
  assert.equal(high.masteryFor(main), 0, "더 높은 품계는 옮기지 못한다");
  assert.equal(other.masteryFor(main), 0, "다른 계열은 옮기지 못한다");
  assert.equal(main.masteryFor(main), 0);
  p.mainSkill = main.key;
  game.transferMastery(same.key);
  assert.equal(main.mastery, 30);
  assert.equal(same.mastery, 0);
  game.transferMastery(high.key);
  assert.equal(high.mastery, 50);
  assert.equal(main.mastery, 30);
});

test("옮긴 성취로 승급할 수 있고 전투 중에는 옮길 수 없다", () => {
  const game = newGame();
  const p = game.player;
  const main = p.bestSkill();
  main.mastery = 90;
  const low = new Skill("운룡검법");
  low.mastery = 60;
  p.skills.push(low);
  const grade = main.grade;
  game.battle = {};
  game.transferMastery(low.key);
  assert.equal(low.mastery, 60);
  game.battle = null;
  game.transferMastery(low.key);
  assert.notEqual(main.grade, grade);
});

test("출신 서사: 8개 모두 일류 이유, 천마와의 인연, 맺음말을 갖고 천마의 수하가 없다", () => {
  const text = JSON.stringify(Object.values(DB.origins.origins));
  assert.ok(!text.includes("사자"));
  assert.ok(!Object.keys(DB.origins.origins).includes("신교사자"));
  assert.equal(new Player("혈지생환").sect, null);
  for (const key of ["혈지생환", "하북팽가", "표국표사", "개방제자", "하오문"]) {
    assert.ok(Object.values(DB.randomEvents).filter((e) => e.requires?.origin === key).length >= 2, key);
    assert.ok(DB.storyEvents.결전_천마봉.variants.some((v) => v.requires.origin === key), key);
  }
});

test("성취 100을 넘겨 더 쌓아야 승급하고, 승급은 일절까지다", () => {
  assert.deepEqual(GRADE_ORDER, ["기본", "명품", "상승", "일절", "신공"]);
  const s = new Skill("기초검법");
  s.mastery = 95;
  assert.deepEqual(s.gainMastery(5), []);
  assert.equal(s.mastery, 100);
  assert.equal(s.grade, "기본", "정확히 100이면 아직 승급하지 않는다");
  assert.ok(s.gainMastery(1).some((m) => m.includes("승급")));
  assert.equal(s.grade, "명품");
  assert.equal(s.mastery, 30);
  const top = new Skill("기초검법");
  top.grade = "상승";
  top.mastery = 100;
  top.gainMastery(1);
  assert.equal(top.grade, "일절", "상승에서 일절로는 오른다");
  top.mastery = 100;
  assert.deepEqual(top.gainMastery(50).filter((m) => m.includes("승급")), []);
  assert.equal(top.grade, "일절", "일절에서 신공으로는 오르지 않는다");
  assert.equal(top.mastery, 100);
});

test("신공은 공격, 심법, 보법에 있고 출신이나 카르마 인연으로만 얻는다", () => {
  const tops = Object.keys(DB.skills).filter((k) => DB.skills[k].grade === "신공");
  const origins = DB.origins.order.filter((o) => o !== "무림초출");
  for (const type of ["공격무공", "심공", "경공"]) {
    for (const o of origins) {
      assert.equal(tops.filter((k) => DB.skills[k].type === type && DB.skills[k].origin === o).length, 1, `${o} ${type}`);
    }
    assert.ok(tops.some((k) => DB.skills[k].type === type && !DB.skills[k].origin), `공용 ${type}`);
  }
  const free = tops.filter((k) => DB.skills[k].type === "공격무공" && !DB.skills[k].origin).map((k) => DB.skills[k].category);
  assert.equal(new Set(free).size, 7, "강호 신공은 계열마다 하나");
  const problems = [];
  const scan = (node, req, where) => {
    if (Array.isArray(node)) return node.forEach((n) => scan(n, req, where));
    if (!node || typeof node !== "object") return undefined;
    const here = { origin: node.requires?.origin ?? req.origin, unlocked: node.requires?.unlocked ?? req.unlocked };
    const allowed = here.origin || here.unlocked;
    if (node.style_skill?.grade === "신공" && !allowed) problems.push(where);
    if (tops.includes(node.skill)) {
      const owner = DB.skills[node.skill].origin;
      if (owner ? here.origin !== owner : !allowed) problems.push(`${where}: ${node.skill}`);
    }
    return Object.values(node).forEach((v) => scan(v, here, where));
  };
  for (const [key, event] of Object.entries(DB.events)) scan(event, {}, key);
  for (const f of DB.fortunes) scan(f, {}, f.text);
  assert.deepEqual(problems, []);
  for (const k of tops) {
    assert.ok(!Object.values(DB.market).some((i) => i.effects.some((e) => e.skill === k)), `${k}는 장터에 없다`);
    assert.ok(!Object.values(DB.enemies).some((e) => e.drop?.skill === k), `${k}는 적이 떨구지 않는다`);
    const owner = DB.skills[k].origin;
    if (owner) assert.ok(Object.values(DB.events).some((e) => e.requires?.origin === owner && JSON.stringify(e).includes(`"${k}"`)), `${k} 출신 이야기`);
    else if (DB.skills[k].type !== "공격무공") assert.ok(Object.values(DB.events).some((e) => e.requires?.unlocked && JSON.stringify(e).includes(`"${k}"`)), `${k} 카르마 인연`);
  }
  assert.ok(Object.values(DB.events).some((e) => e.requires?.unlocked && JSON.stringify(e).includes('"grade":"신공"')), "강호 신공 카르마 인연");
  assert.ok(Object.values(DB.events).some((e) => e.requires?.origin === "무림초출" && JSON.stringify(e).includes('"grade":"신공"')), "강호초출 이야기");
});

test("주무공 계열 신공 보상은 다른 출신의 전용 신공을 주지 않고, 쓰던 심법은 그대로다", () => {
  const p = new Player();
  applyEffects(p, { style_skill: { grade: "신공" } });
  assert.ok(p.hasSkill("무극검결"));
  assert.ok(!p.hasSkill("제왕검형"));
  const toNap = p.skills.find((s) => s.type === "심공");
  toNap.grade = "일절";
  applyEffects(p, { skill: "혼원일기공" });
  assert.equal(p.bestOfType("심공").key, toNap.key, "새로 얻어도 쓰던 심법을 그대로 쓴다");
});

test("예전 저장의 신공은 일절로 바뀐다", () => {
  assert.equal(Skill.fromDict({ key: "무상도결", grade: "신공", mastery: 10 }).grade, "일절");
  assert.equal(Skill.fromDict({ key: "기초검법", grade: "천상", mastery: 10 }).grade, "일절");
  assert.equal(Skill.fromDict({ key: "제왕검형", grade: "신공", mastery: 10 }).grade, "신공");
});

test("카르마 인연의 신공은 주무공 계열로 받고, 이미 익혔으면 대신 무리가 오른다", () => {
  const p = new Player();
  const before = p.martial;
  applyEffects(p, { style_skill: { grade: "신공" } });
  assert.ok(p.hasSkill("무극검결"));
  applyEffects(p, { style_skill: { grade: "신공" } });
  assert.ok(p.martial > before);
});

test("새 장의 성장은 장마다, 회복은 해마다다", () => {
  const game = newGame();
  const p = game.player;
  p.traits = ["대기만성"];
  const before = p.external;
  p.turn = 12;
  game.startNextTurn();
  assert.equal(p.external, before, "1년이 지나도 대기만성은 그대로");
  p.turn = 24;
  game.event = null;
  game.startNextTurn();
  assert.equal(p.external, before + 40);
});

// ---------- 전체 플레이 ----------

for (const origin of DB.origins.order) {
  test(`${origin}: 무작위로 끝까지 플레이해도 오류가 없다`, () => {
    const data = loadMeta();
    data.unlocked_origins = Object.keys(DB.origins.origins);
    saveMeta(data);
    const pick = (list) => list[Math.floor(Math.random() * list.length)];
    for (let run = 0; run < 30; run++) {
      const game = new Game();
      game.start(origin);
      let steps = 0;
      while (game.player.alive) {
        assert.ok(steps++ < 8000, "게임이 끝나지 않는다");
        const p = game.player;
        if (game.event) {
          game.chooseEvent(pick(eventView(p, game.event.key).choices.filter((c) => !c.locked)).index);
        } else if (game.market) {
          for (const entry of game.market.stock) game.marketBuy(entry.key);
          game.marketLeave();
        } else if (game.battle) {
          const action = pick(["기본공격", "기본공격", "비기", "심법", "경공", "소비품", "도주"]);
          game.battleAction(action, Object.keys(p.inventory)[0] ?? null);
        } else if (game.pendingNext) {
          game.advanceTurn();
        } else {
          game.action(p.hp < p.maxHp() / 2 ? "휴식" : pick(["탐색", "수련", "명상"]));
        }
        assert.ok(p.hp >= 0 && p.qi >= 0 && p.silver >= 0 && Number.isInteger(p.hp));
        assert.ok(p.turn <= 120);
        for (const stat of ["external", "internal", "martial", "mind"]) {
          assert.ok(p[stat] >= 1 && p[stat] <= 1100, `${stat} ${p[stat]}`);
        }
        assert.ok(game.log.every((l) => typeof l === "string" && !l.includes("undefined") && !l.includes("NaN")));
      }
      assert.ok(["사망", "배드", "기본", "생사경", "귀순"].includes(game.ending.key));
      assert.ok(!JSON.stringify(game.ending).includes("undefined"));
    }
  });
}

// ---------- 배포 ----------

test("오프라인 파일 목록이 최신이다", () => {
  const www = new URL("../www", import.meta.url).pathname;
  const list = JSON.parse(readFileSync(`${www}/asset-list.json`, "utf-8"));
  assert.deepEqual(list, listAssets(www));
  assert.ok(list.includes("index.html") && readdirSync(`${www}/js`).every((f) => list.includes(`js/${f}`)));
});

test("내장 글꼴을 쓴다", () => {
  const css = readFileSync(new URL("../www/css/game.css", import.meta.url), "utf-8");
  assert.ok(css.includes("game-serif.woff2"));
});
