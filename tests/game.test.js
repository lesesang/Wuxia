import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { seed } from "./helpers.js";
import { listAssets } from "../tools/build_asset_list.js";
import { Battle, dropSkill, Enemy, statureEnemy, useConsumable } from "../www/js/battle.js";
import { GRADE_ORDER, Player, Skill } from "../www/js/character.js";
import { DB } from "../www/js/data.js";
import { applyEffects, dueOriginEvent, pendingOriginEvents, grantStartGear, grantStartGifts, canStartChain, checkRequires, enemyIntro, eventView, LAST_CHAIN_TURN, pickRandomEvent, resolveChoice, storyEventForTurn, validateChains, validateEvents } from "../www/js/events.js";
import { buildEpilogue, Game, settlePerson } from "../www/js/game.js";
import { halpun, josa } from "../www/js/josa.js";
import { blockReason, buy, equipmentBonus, ITEM_GRADES, openMarket, priceOf, sell } from "../www/js/market.js";
import {
  activeContent, resetSetupChoices, upgradeUse, legacyPowers, upgradeLegacy, setUpgradeUse, upgradeLevel, addKarma, buyContent, buyProvision, refundProvision, upgradeTraits, buyUpgrade, exportRecords, importRecords, extraSlots, loadCheckpoint, legacyAvailable, loadEventLog, loadMeta, nextReward, recordEventPick, openLegacy, saveMeta, toggleContent, unlockOrigin,
} from "../www/js/meta.js";
import { personalize, fullName, alignTier, applyGrowth, breakthroughBlock, focusedSide, byname, fameRank, getChapter, getYear, marketTurns, sumEffect, talkLine, traitSlots } from "../www/js/rules.js";
import { rng } from "../www/js/rng.js";
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
    assert.ok(Object.values(DB.randomEvents).filter((e) => (e.chapters || []).includes(chapter)).length >= 5);
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
  assert.equal(p.external, base + 60);
  battle.finish(false, true);
  assert.equal(p.external, base);
});

test("무적에 가까운 조합을 막는 끝이 있다", () => {
  const rig = (keys, enemy = "천마") => {
    const p = new Player("무림초출");
    Object.assign(p, { external: 900, internal: 900, martial: 900, mind: 900, realm: "현경", traits: ["경지_현경"] });
    p.skills = keys.map((k) => Skill.fromDict({ key: k, grade: DB.skills[k].grade, mastery: 100 }));
    p.mainSkill = keys[0];
    p.hp = p.maxHp();
    p.qi = p.maxQi();
    p.revives = 0;
    return [p, new Battle(p, new Enemy(enemy), enemy === "천마")];
  };
  // 경공만 눌러서는 버티지 못한다
  let survived = 0;
  for (let run = 0; run < 30; run++) {
    const [p, b] = rig(["무영비도", "부운무종보"]);
    let result = null;
    for (let r = 0; r < 200 && !result && p.hp > 0; r++) {
      if (b.interlude) { b.chooseInterlude(0); continue; }
      result = b.runRound(p.qi >= p.bestOfType("경공").qiCost ? "경공" : "기본공격");
    }
    if (p.hp > 0) survived += 1;
  }
  assert.ok(survived <= 3, `${survived}`);
  // 되찾는 내력은 절반이고 되받아치기는 빈틈의 힘을 쓰지 않는다
  const [p1, b1] = rig(["권왕패천", "패왕보"]);
  b1.counterPct = 0;
  b1.afterEvade(p1.bestOfType("경공"), { strike: 90, name: "시험" });
  assert.equal(b1.counterPct, 0);
  const [p2, b2] = rig(["무영비도", "부운무종보"]);
  p2.qi = 100;
  b2.afterEvade(p2.bestOfType("경공"), DB.skills.부운무종보.gimmick);
  assert.equal(p2.qi, 105);
  // 흡수는 한 합에 끝이 있다
  const [p3, b3] = rig(["적혈신장", "혈영신법"]);
  p3.hp = 1;
  b3.applyGimmickOnHit({ lifesteal: 18 }, 999999);
  assert.equal(p3.hp, 1 + Math.trunc(p3.maxHp() * 0.25));
  // 저절로 차는 기운은 한 싸움에 3할까지다
  const [p4, b4] = rig(["무영비도", "혼원일기공"]);
  p4.hp = 10;
  for (let i = 0; i < 40; i++) b4.tickEffects();
  assert.ok(p4.hp <= 10 + Math.ceil(p4.maxHp() * 0.31), `${p4.hp}`);
  // 운기 한 번은 5할까지, 잇달아 하면 절반이다
  const [p5, b5] = rig(["무영비도", "철마금신공"]);
  p5.traits.push("맑은정신", "글읽는무인");
  p5.hp = 1;
  b5.useMindset();
  assert.ok(p5.hp <= 2 + p5.maxHp() * 0.5, `${p5.hp}`);
  p5.hp = 1;
  b5.mindStreak = 1;
  b5.useMindset();
  assert.ok(p5.hp <= 2 + p5.maxHp() * 0.25, `${p5.hp}`);
  // 굳었다 풀린 다음 합에는 다시 굳지 않는다
  const [, b6] = rig(["타구신봉", "경신보"].map((k) => (DB.skills[k] ? k : "초상비")), "낭인");
  b6.stunRest = true;
  b6.applyGimmickOnHit({ stun: 100 }, 1);
  assert.ok(!b6.enemyStun);
  // 도주와 호신구에도 끝이 있다
  const [p7, b7] = rig(["무영비도", "부운무종보"], "낭인");
  p7.traits.push("구름걸음", "표로의다리");
  let failed = 0;
  for (let i = 0; i < 300; i++) if (!b7.flee()) failed += 1;
  assert.ok(failed > 0, "반드시 달아나지는 못한다");
  p7.armor = "금강불괴갑";
  b7.enemy.attack = 100;
  assert.ok(b7.incoming() > 1, "호신구가 아무리 좋아도 조금은 들어온다");
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
  assert.ok(battle.log.some((l) => /제\d초 /.test(l)));
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
  assert.ok(game.player.alignment.정도 >= 60 && game.player.hasFlag("무림맹"));
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
  p.alignment.정도 = 100;
  assert.equal(priceOf(p, "호골주"), Math.trunc(DB.market.호골주.price * 0.92));
  p = new Player();
  p.alignment.사도 = 100;
  assert.equal(p.gainSilver(100), 137);
  p = new Player();
  p.alignment.마도 = 100;
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
  game.player.alignment = { 정도: 0, 사도: 0, 마도: 500 };
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
  assert.ok(battle.enemy.hp <= before - Math.trunc(battle.enemy.maxHp * 0.15), "연무휘가 끼어든다");
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
  assert.ok(p.hasFlag("대회우승") && p.fame >= 70);
  assert.ok(p.gear.includes("태산신검"), "상품 병기는 행낭에 든다");
});

test("도망치면 대회가 끝난다", () => {
  const game = newGame();
  game.gauntlet = { name: "대회", enemies: ["비무철권"], reward: { fame: 45 }, round: 1, total: 2 };
  game.startBattle("산적");
  seed(0);
  for (let i = 0; i < 40 && game.battle; i++) game.battleAction("도주");
  assert.equal(game.gauntlet, null);
  assert.ok(game.player.fame < 45);
});

test("별호와 명성", () => {
  const p = new Player();
  assert.equal(byname(p), "이름 없는 무인");
  assert.equal(fameRank(p), "무명소졸");
  p.fame = 200;
  p.alignment.정도 = 100;
  assert.ok(byname(p).endsWith("검협"));
  assert.equal(fameRank(p), "젊은 협객");
});

test("명성의 이름은 성향과 경지를 따르고 천하제일인은 천마를 넘어선 사람뿐이다", () => {
  const p = new Player();
  p.fame = 999;
  assert.equal(fameRank(p), "신진고수", "일류가 아무리 이름나도 일방의 고수는 아니다");
  p.realm = "화경";
  assert.equal(fameRank(p), "당대의 고수");
  p.alignment.정도 = 300;
  assert.equal(fameRank(p), "당대의 〈대협〉");
  p.alignment.정도 = 0;
  p.alignment.마도 = 300;
  assert.equal(fameRank(p), "천하공적");
  p.realm = "현경";
  assert.notEqual(fameRank(p), "천하제일인");
  p.slain.push("천마");
  assert.equal(fameRank(p), "천하제일인");
  for (const rank of DB.flavor.fame_ranks) assert.ok(rank.names.기본);
});

test("전투 경험만 모자라면 알려 준다", () => {
  const p = new Player();
  p.external = p.internal = p.martial = p.mind = 400;
  assert.ok(breakthroughBlock(p).includes("실전"));
  p.battles = 12;
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
  for (let i = 0; i < 30; i++) assert.ok(!openMarket(60, p).stock.some((s) => s.key === "혈영도법비급"));
  p.alignment.마도 = 100;
  assert.ok(Array.from({ length: 30 }, () => openMarket(60, p)).some((m) => m.stock.some((s) => s.key === "혈영도법비급")));
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

test("이미 지닌 장비는 효과 없음, 낮은 장비도 살 수는 있다", () => {
  const p = new Player();
  p.silver = 999;
  p.weapon = "운철보검";
  assert.equal(blockReason(p, "운철보검"), "효과 없음");
  assert.equal(blockReason(p, "철검"), null);
});

test("비기를 터득한 주무공은 자동으로 바뀌지 않는다", () => {
  const p = new Player();
  const current = p.bestSkill();
  current.secretUnlocked = true;
  const messages = p.learnSkill(new Skill("태허검결"));
  assert.equal(p.mainSkill, current.key);
  assert.ok(!messages.some((m) => m.includes("골라 쓸 수")), "바꾸는 법은 입문서에서만 알린다");
});

// ---------- 저장 ----------

test("저장은 달 시작 지점으로 복구된다", () => {
  const game = newGame();
  game.player.silver = 77;
  game.pendingNext = true;
  game.advanceTurn();
  assert.equal(loadCheckpoint().player.turn, 2);
  // 일을 마치기 전에 끊기면 그달의 처음이다
  const early = new Game();
  assert.ok(early.continueFromSave());
  assert.equal(early.player.turn, 2);
  assert.equal(early.player.silver, 77);
  assert.equal(early.pendingNext, false);
  // 그달의 일을 마친 뒤라도 다음 달로 넘어가기 전에 끊기면 그달의 처음이다
  const before = game.player.external;
  game.action("수련");
  const fresh = new Game();
  assert.ok(fresh.continueFromSave());
  assert.equal(fresh.player.turn, 2);
  assert.equal(fresh.player.external, before);
  assert.equal(fresh.pendingNext, false);
  game.advanceTurn();
  assert.equal(loadCheckpoint().player.turn, 3);
});

test("장터에서 끊기면 그달의 처음으로 돌아간다", () => {
  const game = newGame();
  toTurnEnd(game, 12);
  const turn = loadCheckpoint().player.turn;
  game.player.silver = 500;
  game.advanceTurn();
  assert.ok(game.market);
  const key = game.market.stock.map((s) => s.key).find((k) => !blockReason(game.player, k));
  game.marketBuy(key);
  const fresh = new Game();
  assert.ok(fresh.continueFromSave());
  assert.ok(!fresh.market);
  assert.equal(fresh.player.turn, turn);
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
  assert.equal(early.maxHp, Math.round(DB.enemies.낭인.hp * DB.balance.enemy_scale.hp / 5) * 5);
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
  assert.ok(total > 1150 && total < 1250, String(total));
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
  poison.sect = "하오문";
  assert.ok(!labels(poison).includes("무림맹") && labels(poison).includes("사도련"));
  const tang = new Player();
  tang.sect = "당가";
  assert.ok(labels(tang).includes("무림맹"), "당가는 정파다");
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
    if (event.variants?.length || event.reacts?.length) reactive += 1;
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
  p.fame = 750;
  assert.ok(eventView(p, "수로채").text.includes("대협"));
  p.fame = 0;
  assert.ok(eventView(p, "살막의명부").text.includes("두 냥"));
  p.external = 700;
  assert.ok(eventView(p, "철권씨름").choices.some((c) => c.label.includes("한 손으로")));
});

test("적의 대사가 명성과 경지에 따라 달라진다", () => {
  const p = new Player();
  p.fame = 750;
  assert.ok(enemyIntro(p, "산적").includes("이름은"));
  p.fame = 0;
  assert.ok(/초행길|아무도 없는/.test(enemyIntro(p, "산적")));
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
    assert.equal(weapons.length, 7, style);
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
  assert.equal(equipmentBonus(lone, "weapon"), 16);
  const herb = new Player("무림초출", ["약초꾼"]);
  assert.equal(herb.inventory.금창약, 3);
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
  assert.equal(game.player.external, 330);
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
    assert.ok(single.some((t) => t.effects.some((e) => e.type === "start_stat" && e.stat === stat && e.amount === 60)
      && t.effects.some((e) => e.type === "growth_rate" && e.stat === stat && e.percent === 25)), stat);
  }
});

test("새로 얻거나 품계가 높아도 쓰던 무공이 바뀌지 않는다", () => {
  const p = new Player("하북팽가");
  const main = p.mainSkill;
  const mind = p.bestOfType("심공").key;
  assert.deepEqual(p.learnSkill(new Skill("패천도결")), []);
  p.learnSkill(new Skill("혼원일기공"));
  p.learnSkill(new Skill("이형환위"));
  assert.equal(p.mainSkill, main);
  assert.equal(p.bestOfType("심공").key, mind);
  assert.equal(p.bestOfType("경공").key, "이형환위", "처음 익힌 경공은 바로 쓴다");
  p.learnSkill(new Skill("초상비"));
  assert.equal(p.bestOfType("경공").key, "이형환위");
  const game = new Game();
  game.player = p;
  game.setMainSkill("패천도결");
  game.setMainSkill("혼원일기공");
  assert.equal(p.bestSkill().key, "패천도결");
  assert.equal(p.bestOfType("심공").key, "혼원일기공");
  const again = Player.fromDict(p.toDict());
  assert.equal(again.bestOfType("심공").key, "혼원일기공");
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
  const dark = seen((p) => { p.alignment.마도 = 200; });
  assert.ok(dark.has("구파협객"), "마도를 걸으면 정파 협객이 나온다");
  assert.ok(!dark.has("사파복수귀"));
  const right = seen((p) => { p.alignment.정도 = 200; });
  assert.ok(right.has("사파복수귀"));
  assert.ok(!right.has("구파협객"), "정도에게는 정파 협객이 덤비지 않는다");
  const shady = seen((p) => { p.alignment.사도 = 200; });
  assert.ok(shady.has("포도대장"));
  const plain = seen(() => {});
  assert.ok(!plain.has("구파협객") && !plain.has("포도대장") && !plain.has("사파복수귀"));
  const famous = seen((p) => { p.fame = 750; p.realm = "화경"; }, 80);
  assert.ok(famous.has("십대고수"), "이름이 높으면 고수가 찾아온다");
  const nameless = seen((p) => { p.fame = 0; }, 30);
  assert.ok(nameless.has("무명사냥꾼"), "이름이 없으면 얕보인다");
  for (const dominant of ["마도", "정도", "사도"]) {
    for (const chapter of [2, 3, 4, 5]) {
      assert.ok(Object.values(DB.enemies).some((e) => e.requires?.dominant === dominant && (e.chapters || []).includes(chapter)), `${dominant} ${chapter}장`);
    }
  }
});

test("성향과 명성에 따라 사건이 달라진다", () => {
  const p = new Player();
  p.alignment.마도 = 200;
  p.fame = 50;
  assert.ok(eventView(p, "쫓기는소녀").text.includes("뒤가 더 무서운지"));
  assert.ok(checkRequires(p, DB.events.마도_토벌령.requires));
  assert.ok(!checkRequires(p, DB.events.정도_은인.requires));
  const events = Object.values(DB.events);
  for (const dominant of ["마도", "정도", "사도"]) {
    assert.ok(events.filter((e) => e.requires?.dominant === dominant).length >= 2, dominant);
    assert.ok(events.filter((e) => (e.variants || []).some((v) => v.requires?.dominant === dominant)).length >= 4, `${dominant} 반응`);
  }
  assert.ok(events.filter((e) => e.requires?.min_fame >= 300).length >= 3);
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
  assert.equal(loadMeta().current_karma, 48);
  const first = new Game();
  first.start("무림초출");
  const second = new Game();
  second.start("무림초출");
  assert.equal(first.player.external, second.player.external, "채비의 영약은 행낭에 들어간다");
  assert.equal(first.player.inventory.호골주, 1);
  assert.equal(first.player.inventory.금창약, (second.player.inventory.금창약 || 0) + 3);
  assert.deepEqual(loadMeta().provisions, []);
  assert.ok(Object.values(DB.karma.provisions).every((p) => p.cost <= 3));
  const singles = Object.values(DB.karma.provisions).map((p) => p.effects).filter((e) => e.length === 1 && e[0].type === "start_item" && DB.market[e[0].item].effects.length === 1 && DB.market[e[0].item].effects[0].type === "stat")
    .map((e) => DB.market[e[0].item].effects[0]);
  assert.deepEqual(singles.map((e) => e.stat).sort(), ["external", "internal", "martial", "mind"].sort());
  assert.equal(new Set(singles.map((e) => e.amount)).size, 1);
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
  // 출신마다 전용 인연은 둘이고 값이 같다. 강호초출은 사부의 신공을 주는 인연이 하나 더 있다
  for (const origin of DB.origins.order) {
    const own = Object.values(DB.karma.content).filter((c) => c.origin === origin);
    assert.equal(own.length, 2, origin);
    assert.ok(own.every((c) => c.cost === 8), origin);
  }
});

test("누적 카르마는 마지막 보상을 넘어도 계속 쌓인다", () => {
  withKarma(0);
  addKarma(1500);
  assert.equal(loadMeta().total_karma, 1500);
  assert.equal(loadMeta().current_karma, 1500);
  withKarma(0);
});

test("싸움이 걸린 결과는 이긴 뒤에 적용되고, 달아나면 다시 만날 수 있다", () => {
  const key = "비무초친";
  const play = (flee) => {
    const game = newGame();
    game.event = null;
    game.pendingNext = false;
    game.event = { key, forced: false };
    const before = game.player.silver;
    game.chooseEvent(0);
    assert.ok(game.battle);
    assert.equal(game.player.silver, before, "싸우기 전에는 받지 않는다");
    assert.ok(!game.log.some((l) => l.includes("오늘은 재미있었어요")));
    game.player.qi = 0;
    if (flee) {
      rng.random = () => 0;
      game.battleAction("도주");
      assert.ok(!game.player.seenEvents.includes(key));
      assert.equal(game.player.silver, before);
    } else {
      game.battle.enemy.hp = 1;
      rng.random = () => 0.5;
      game.battleAction("기본공격");
      assert.ok(game.player.silver > before);
      assert.ok(game.log.some((l) => l.includes("오늘은 재미있었어요")));
    }
  };
  play(false);
  play(true);
});

test("강호초출이 이어받은 공격 무공은 첫 병기를 골라도 사라지지 않는다", () => {
  const p = new Player("무림초출");
  p.learnSkill(new Skill("천뢰검법"));
  applyEffects(p, { start_weapon: "도법" });
  assert.ok(p.hasSkill("천뢰검법"));
  assert.equal(p.bestSkill().category, "도법");
  assert.ok(!p.hasSkill("기초검법"));
});

test("전투가 끝나면 전투 중 오른 기량만큼 늘어난 체력을 넘지 않는다", () => {
  const p = new Player("무림초출", ["전투광"]);
  const battle = new Battle(p, new Enemy("낭인"));
  p.hp = p.maxHp();
  battle.finish(false, true);
  assert.ok(p.hp <= p.maxHp());
});

test("천마를 약하게 하는 물건은 사건으로 약해져 있어도 살 수 있다", () => {
  const p = new Player();
  p.silver = 100000;
  p.bossWeaken = 10;
  const key = Object.keys(DB.market).find((k) => DB.market[k].effects.some((e) => e.type === "boss_weaken") && !DB.market[k].karma_price);
  assert.notEqual(blockReason(p, key), "효과 없음");
});

test("빠진 항목이 남은 저장을 읽어도 깨지지 않는다", () => {
  const p = new Player();
  const d = p.toDict();
  d.skills.push({ key: "없는무공", grade: "기본", mastery: 0 });
  d.chains = [{ id: "없는연계", next: 1, due: 5 }];
  d.inventory.없는물건 = 2;
  const q = Player.fromDict(d);
  assert.ok(!q.hasSkill("없는무공"));
  assert.deepEqual(q.chains, []);
  assert.equal(q.inventory.없는물건, undefined);
});

test("시작 병기와 갑의, 비급, 무공은 겹쳐도 효과가 사라지지 않는다", () => {
  const armor = (traits) => new Player("무림초출", traits).armor;
  assert.equal(armor(["환생_호구_1"]), "가죽호구");
  assert.equal(armor(["가보의호구"]), "철사갑의");
  assert.equal(armor(["가보의호구", "환생_호구_1"]), "금사보의");
  const twoBooks = new Player("하북팽가", ["가전비급", "채비_명품비급"]);
  const before = twoBooks.bestSkill().mastery;
  assert.equal(grantStartGifts(twoBooks).length > 0, true);
  assert.equal(twoBooks.bestSkill().mastery, before + 30);
  const weapons = new Player("하북팽가", ["병기광", "환생_병기_1", "환생_병기_2", "채비_쓸만한병기"]);
  const silver = weapons.silver;
  grantStartGear(weapons);
  assert.equal(weapons.silver, silver + 60);
  assert.equal(equipmentBonus(weapons, "weapon") >= 50, true);
  const seen = {};
  for (const t of Object.values(DB.traits).filter((x) => !x.origin)) {
    for (const e of t.effects || []) if (e.type === "start_skill") { assert.ok(!seen[e.skill], e.skill); seen[e.skill] = true; }
  }
  const low = new Player("하북팽가", ["배수진", "네형의칼"]);
  const battle = new Battle(low, new Enemy("낭인"));
  low.hp = 1;
  rng.random = () => 0.5;
  battle.strike(100, "시험");
  assert.ok(battle.enemy.maxHp - battle.enemy.hp > 150, "몰릴 때의 효과는 더해진다");
});

test("무공을 여럿 들고 시작하면 달이 가기 전에 쓸 무공을 고르고 그에 맞춰 행장을 받는다", () => {
  const data = loadMeta();
  data.unlocked_origins = Object.keys(DB.origins.origins);
  data.unlocked_traits = ["가전비급", "수련도구"];
  data.total_karma = 40;
  saveMeta(data);
  const game = new Game();
  game.start("하북팽가", ["가전비급", "수련도구"]);
  assert.ok(game.pickingArts);
  assert.equal(game.event, null);
  const other = game.player.skillsOfType("공격무공").find((s) => s.key !== game.player.mainSkill);
  game.setMainSkill(other.key);
  game.finishArtsPick();
  assert.ok(!game.pickingArts);
  assert.equal(game.player.mainSkill, other.key);
  assert.equal(game.event?.key, "서장_하북팽가");
  const plain = new Game();
  plain.start("하북팽가");
  assert.ok(!plain.pickingArts);
  withKarma(0);
});

test("성향 자질은 희귀 이상이고 오를 때 더 오른다", () => {
  for (const t of Object.values(DB.traits)) {
    if (t.effects?.some((e) => e.type === "start_alignment" || e.type === "alignment_gain")) assert.ok(["희귀", "전설"].includes(t.rarity), t.name);
  }
  const p = new Player("무림초출", ["호연지기"]);
  assert.equal(p.alignment.정도, 70);
  p.adjustAlignment("정도", 40);
  assert.ok(p.alignment.정도 > 120, "오를 때 더 오른다");
  p.adjustAlignment("정도", 5000);
  assert.equal(p.alignment.정도, 999);
  const killer = new Player("무림초출", ["천살성"]);
  const b = new Battle(killer, new Enemy("낭인"));
  const base = b.attackScale();
  killer.kills = 1000;
  assert.ok(Math.abs(b.attackScale() / base - 1.4) < 0.01);
});

test("기틀은 이번에 쓸 단계만 고를 수 있다", () => {
  withKarma(100);
  const data = loadMeta();
  data.upgrades = { 강골: 3, 그릇: 2 };
  saveMeta(data);
  const external = () => { const g = new Game(); g.start("무림초출"); return g.player.external; };
  const full = external();
  setUpgradeUse("강골", 1);
  assert.equal(external(), full - 40);
  setUpgradeUse("강골", 0);
  assert.equal(external(), full - 60);
  assert.equal(upgradeLevel("강골"), 3);
  setUpgradeUse("그릇", 1);
  assert.equal(extraSlots(), 1);
  withKarma(0);
});

test("누적 보상은 자질과 기틀, 채비의 시작 병기와 갑의, 비급을 대신하지 않는다", () => {
  const types = ["start_style_weapon", "start_armor", "start_style_skill", "start_skill"];
  for (const r of DB.karma.rewards) assert.ok(!r.effects.some((e) => types.includes(e.type)), r.name);
});

test("강호초출이 고른 무공과 심법은 십 년 갈고닦은 성취가 있다", () => {
  const p = new Player("무림초출");
  applyEffects(p, { start_weapon: "권법", start_mindset: "양생공" });
  assert.ok(p.bestSkill().mastery >= 40);
  assert.ok(p.getSkill("양생공").mastery >= 40);
  assert.match(DB.events.시작_병기고.text, /문하에 든 날/);
});

test("성향은 단계마다 혜택이 커지고 한 길에 집중하면 더 잘 오른다", () => {
  const low = new Player(); low.alignment.정도 = 100;
  const high = new Player(); high.alignment.정도 = 960;
  assert.ok(priceOf(high, "호골주") < priceOf(low, "호골주"));
  assert.equal(alignTier(high.alignment).name, "정도의 기둥");
  const clash = new Player(); clash.alignment.마도 = 200; clash.alignment.정도 = 10;
  clash.adjustAlignment("정도", 100);
  assert.equal(clash.alignment.마도, 134);
  assert.ok(applyEffects(clash, { alignment: { 정도: 20 } }).some((l) => l.startsWith("마도-")));
  const enemy = new Enemy("낭인");
  const damage = (p) => { rng.random = () => 0.5; return new Battle(p, enemy).incoming(1); };
  assert.ok(damage(high) < damage(new Player()));
  const rich = new Player(); rich.alignment.사도 = 960;
  assert.equal(rich.gainSilver(100), 165);
  const dark = new Player(); dark.alignment.마도 = 960;
  assert.ok(new Battle(dark, enemy).attackScale() > new Battle(new Player(), enemy).attackScale() * 1.2);
  const even = new Player(); even.alignment.정도 = 100; even.alignment.사도 = 90;
  assert.equal(focusedSide(even.alignment), null);
  assert.equal(even.adjustAlignment("사도", 20), 22, "성향은 조금 쉽게 오른다");
  const keen = new Player(); keen.alignment.정도 = 100;
  assert.equal(keen.adjustAlignment("정도", 20), 24);
  const game = newGame();
  game.player.alignment = { 정도: 300, 사도: 0, 마도: 0 };
  game.alignmentMonth();
  assert.equal(game.player.alignment.정도, 301);
  assert.ok(game.player.chronicle.some((c) => c.text.includes("협사")));
});

test("출신의 기본 무공은 오래 갈고닦은 성취를 지닌다", () => {
  for (const key of DB.origins.order) {
    if (DB.origins.origins[key].choose_start) continue;
    const p = new Player(key);
    for (const s of DB.origins.origins[key].skills) assert.equal(p.getSkill(s).mastery, 40, s);
  }
});

test("별호는 성향과 출신, 계열, 명성을 따르고 어색한 뒷글자가 없다", () => {
  const p = new Player("남궁세가");
  assert.equal(byname(p), "이름 없는 무인");
  p.fame = 250;
  assert.ok(byname(p).startsWith("창궁"));
  p.alignment.마도 = 900;
  assert.ok(byname(p).endsWith("마검"));
  p.fame = 1000;
  assert.ok(byname(p).endsWith("검마"));
  for (const side of Object.values(DB.flavor.bynames.suffix)) {
    for (const list of Object.values(side)) assert.equal(list.length, 3);
    assert.ok(!Object.values(side).flat().includes("장마"));
  }
});

test("쓰러지면 강호행마다 한 번 되살아나고 기틀로 한 번 더 얻는다", () => {
  const p = new Player();
  p.qi = 10;
  const battle = new Battle(p, new Enemy("낭인"));
  p.hp = 0;
  battle.checkRevive();
  assert.equal(p.hp, Math.trunc(p.maxHp() * 0.5));
  assert.equal(p.qi, 10 + Math.trunc(p.maxQi() * 0.5));
  assert.equal(p.revives, 0);
  p.hp = 0;
  battle.checkRevive();
  assert.equal(p.hp, 0);
  p.qi = p.maxQi();
  const q = new Player("무림초출", ["환생_구사일생_1"]);
  assert.equal(q.revives, 2);
  q.qi = q.maxQi();
  const b2 = new Battle(q, new Enemy("낭인"));
  q.hp = 0;
  b2.checkRevive();
  assert.equal(q.qi, q.maxQi());
  assert.equal(Player.fromDict(q.toDict()).revives, 1);
});

test("불사지체는 합마다 체력을 되찾는다", () => {
  const p = new Player("무림초출", ["불굴"]);
  const battle = new Battle(p, new Enemy("낭인"));
  p.hp = 50;
  battle.tickEffects();
  assert.ok(p.hp > 50);
});

test("돕고 난 뒤의 제안을 받아야 소속이 된다", () => {
  for (const event of Object.keys(DB.events).filter((k) => k.endsWith("_입문") || k === "마교_입교")) {
    assert.ok(!JSON.stringify(DB.events[event]).includes("join_sect"), event);
    assert.ok(JSON.stringify(DB.events[event]).includes("sect_offer"), event);
  }
  const game = newGame();
  game.event = null;
  game.pendingNext = false;
  game.player.sect = null;
  game.event = { key: "무당_입문", forced: false };
  const index = eventView(game.player, "무당_입문").choices.find((c) => c.label === "제자를 업고 달린다").index;
  game.chooseEvent(index);
  assert.equal(game.player.sect, null);
  assert.equal(game.event.key, "제안_무당");
  game.chooseEvent(1);
  assert.equal(game.player.sect, null);
  assert.ok(game.pendingNext);
  const other = newGame();
  other.event = { key: "제안_녹림맹", forced: false };
  other.pendingNext = false;
  other.player.sect = null;
  other.chooseEvent(0);
  assert.equal(other.player.sect, "녹림맹");
  assert.ok(DB.sects.사도련 && DB.sects.녹림맹);
});

test("싸움으로 도운 뒤에도 제안이 온다", () => {
  const game = newGame();
  game.pendingNext = false;
  game.player.sect = null;
  game.event = { key: "아미_입문", forced: false };
  const index = eventView(game.player, "아미_입문").choices.find((c) => c.label === "함께 산채를 친다").index;
  game.chooseEvent(index);
  assert.ok(game.battle);
  game.battle.enemy.hp = 1;
  game.player.hp = game.player.maxHp();
  rng.random = () => 0.5;
  game.battleAction("기본공격");
  assert.equal(game.event?.key, "제안_아미");
  assert.equal(game.player.sect, null);
});

test("성향이 맞서면 도움 대신 적대하는 사건이 온다", () => {
  const dark = new Player();
  dark.alignment.마도 = 300;
  assert.ok(checkRequires(dark, DB.events.소림_적대.requires));
  assert.ok(!checkRequires(dark, DB.events.소림_입문.requires));
  const bright = new Player();
  bright.alignment.정도 = 300;
  bright.fame = 50;
  assert.ok(checkRequires(bright, DB.events.사도련_적대.requires));
  assert.ok(!checkRequires(bright, DB.events.사도련_입문.requires));
});

test("장터와 무작위 비급은 주무공 계열을 계열별로 같은 비중으로 더 자주 준다", () => {
  for (const [origin, main] of [["남궁세가", "검법"], ["권마계승", "권법"], ["표국표사", "창법"]]) {
    let hits = 0;
    let total = 0;
    for (let i = 0; i < 300; i++) {
      const p = new Player(origin);
      const before = p.skills.length;
      applyEffects(p, { random_skill: { max_grade: "상승" } });
      if (p.skills.length > before) { total += 1; if (p.skills[p.skills.length - 1].category === main) hits += 1; }
    }
    assert.ok(hits / total > 0.28, `${origin} ${hits}/${total}`);
    const weapon = new Player(origin);
    const stock = openMarket(48, weapon).stock.map((s) => s.key);
    assert.ok(stock.some((k) => DB.market[k].effects.some((e) => e.slot === "weapon" && e.style === main)), `${origin} 맞는 병기`);
  }
});

test("조사는 받침에 맞게 붙는다", () => {
  assert.equal(josa("천마", "을/를"), "를");
  assert.equal(josa("낭인", "을/를"), "을");
  assert.equal(josa("백보신권", "이/가"), "이");
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
    p.battles = 80;
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
  const attacks = Object.keys(DB.skills).filter((k) => DB.skills[k].grade === "신공" && DB.skills[k].type === "공격무공" && !DB.skills[k].reserved);
  for (const k of attacks) assert.ok(endingRows("기본").some((r) => r.requires.main_skill === k), k);
});

test("결말 문장은 상황을 따르고 서로 부딪치지 않는다", () => {
  const text = (origin, setup, ending) => {
    const p = new Player(origin);
    setup(p);
    return buildEpilogue(p, ending).join(" ");
  };
  assert.notEqual(text("남궁세가", () => {}, "사망"), text("하오문", () => {}, "사망"));
  assert.ok(text("하오문", (p) => { p.fame = 750; p.turn = 100; }, "사망").includes("잔이 하나씩"));
  assert.ok(text("하오문", (p) => { p.fame = 0; }, "사망").includes("무명"));
  assert.ok(text("하오문", (p) => { p.alignment.마도 = 200; }, "사망").includes("잔치"));
  assert.ok(text("하북팽가", () => {}, "귀순").includes("〈네형"));
  // 이벤트 결과를 겪지 않았으면 겪은 것처럼 말하지 않는다
  assert.ok(text("개방제자", () => {}, "기본").includes("범인은 아직"));
  assert.ok(text("개방제자", (p) => p.addFlag("개방_범인"), "기본").includes("범인은 찾았소"));
  assert.ok(!text("남궁세가", (p) => p.addFlag("가문복수"), "기본").includes("창궁의 깃발"));
  assert.ok(!text("표국표사", () => {}, "배드").includes("표물은 닿았다"));
  // 쓰는 무공을 따른다. 익히기만 한 신공은 말하지 않는다
  const p = new Player("남궁세가");
  p.learnSkill(new Skill("기초검법"));
  p.mainSkill = "기초검법";
  p.learnSkill(new Skill("제왕검형"));
  assert.ok(!buildEpilogue(p, "기본").join(" ").includes("제왕검형"));
  p.mainSkill = "제왕검형";
  assert.ok(buildEpilogue(p, "기본").join(" ").includes("제왕검형"));
  // 모든 경우를 돌려 빈 값이나 겹친 문장, 어긋나는 명성 문장이 없는지 본다
  const famousWords = ["천하가", "별호"];
  for (const key of Object.keys(DB.endings.titles)) {
    for (const origin of DB.origins.order) {
      for (const side of [null, "정도", "사도", "마도"]) {
        for (const fame of [0, 100, 200, 350, 750]) {
          const q = new Player(origin);
          q.fame = fame;
          if (side) q.alignment[side] = 500;
          q.turn = 120;
          for (const flag of ["찬탈", "단목휘_죽음", "단목휘_동맹", "제자_완성", "가문재건"]) if (fame === 750) q.addFlag(flag);
          const lines = buildEpilogue(q, key);
          assert.ok(lines.length >= 2, `${key} ${origin}`);
          assert.equal(new Set(lines).size, lines.length, `${key} 겹친 문장`);
          for (const line of lines) {
            assert.ok(typeof line === "string" && line.length > 3 && !/undefined|null|NaN/.test(line), line);
          }
          if (fame <= 149) for (const w of famousWords) assert.ok(!lines.join(" ").includes(w), `${key} 무명인데 ${w}`);
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
  assert.equal(veteran.battles, 12);
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
  assert.equal(game.player.skills.find((s) => s.key === "창궁검법").mastery, 80);
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
  assert.equal(p.inventory.베기짚단, 5);
  assert.equal(p.inventory.맹호도유, 5);
  assert.ok(p.skills.some((s) => s.category === "도법" && s.grade === "명품" && s.key !== "오호단문도"));
  const drifter = new Player("무림초출", ["수련도구", "현기의호흡"]);
  applyEffects(drifter, { start_weapon: "창법", start_mindset: "양생공" });
  grantStartGear(drifter);
  assert.equal(drifter.inventory.납창추, 5, "강호초출은 첫 병기를 고른 뒤 받는다");
  assert.ok(!drifter.hasSkill("곤륜현기공"), "곤륜의 호흡은 심법을 주지 않는다");
  assert.ok(drifter.bestOfType("심공").mastery >= 40, "고른 첫 심법이 성취를 쌓은 채로 시작한다");
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

test("유산은 천마를 쓰러뜨린 뒤 열리고, 이어받아도 남으며, 첫 해 안에 찾아낸다", () => {
  withKarma(100);
  assert.ok(!openLegacy(), "아직 천마를 쓰러뜨리지 못했다");
  withKarma(100, { endings_seen: ["기본"] });
  assert.ok(openLegacy());
  const first = new Game();
  first.start("무림초출");
  first.player.learnSkill(Skill.fromDict({ key: "양가창법", grade: "일절", mastery: 80 }));
  first.player.weapon = "운철보검";
  first.finishGame(true, "기본");
  const options = first.legacyOptions();
  assert.ok(first.leaveLegacy(options.findIndex((o) => o.key === "양가창법")));
  assert.ok(!first.leaveLegacy(0), "한 판에 하나만 남긴다");
  first.ending.legacyLeft = null;
  assert.ok(!first.legacyOptions().some((o) => o.key === "양가창법"), "같은 무공은 둘 보관하지 않는다");
  first.ending.legacyLeft = "양가창법";
  assert.equal(loadMeta().legacies.length, 1);

  const next = new Game();
  next.start("무림초출", [], [0]);
  assert.ok(!next.player.hasSkill("양가창법"), "시작할 때 받지 않는다");
  assert.equal(next.player.pendingLegacy.length, 1);
  assert.equal(loadMeta().legacies.length, 1, "이어받아도 사라지지 않는다");
  if (next.pickingArts) next.finishArtsPick();
  // 어느 행동이든 찾을 수 있고, 첫 해가 끝나기 전에는 반드시 찾는다
  next.player.turn = 11;
  next.event = null;
  next.action("휴식");
  assert.equal(next.event?.key, "유산_휴식");
  const view = eventView(next.player, "유산_휴식");
  assert.ok(view.text.includes(loadMeta().legacies[0].from), "별호가 드러난다");
  assert.ok(!view.text.includes("〈"), view.text);
  next.chooseEvent(0);
  const skill = next.player.skills.find((s) => s.key === "양가창법");
  assert.equal(skill.grade, "상승", "한 품계 낮아지고 상승을 넘지 않는다");
  assert.notEqual(next.player.mainSkill, "양가창법", "이어받아도 쓰던 주무공은 그대로다");
  assert.equal(next.player.pendingLegacy.length, 0);

  // 달이 시작할 때도 찾아온다
  const late = new Game();
  late.start("무림초출", [], [0]);
  late.player.turn = 12;
  late.event = null;
  late.pickingArts = false;
  late.openStoryEvent();
  assert.equal(late.event?.key, "유산_발길");

  // 보관이 차면 지울 것을 골라야 한다
  withKarma(0, { endings_seen: ["기본"], legacy_open: true, legacies: [1, 2, 3].map((n) => ({ kind: "skill", key: "양가창법", grade: "명품", label: `유산${n}`, from: "무명객", origin: "무림초출" })) });
  first.ending.legacyLeft = null;
  const gearIndex = first.legacyOptions().findIndex((o) => o.key === "운철보검");
  assert.ok(!first.leaveLegacy(gearIndex), "지울 것을 고르지 않으면 남기지 못한다");
  assert.ok(first.leaveLegacy(gearIndex, 0));
  assert.deepEqual(loadMeta().legacies.map((l) => l.label), ["유산2", "유산3", first.ending.legacyLeft]);
  const third = new Game();
  third.start("무림초출", [], [2]);
  third.player.turn = 11;
  third.player.weapon = "낡은검";
  third.pickingArts = false;
  third.giftsDone = true;
  third.event = null;
  third.action("휴식");
  third.chooseEvent(0);
  assert.ok(third.player.gear.includes("강철검"), "병장기는 낮은 단계로 돌아온다");
  withKarma(0);
});

test("유산 강화: 이어받을 수와 보관 수가 늘고, 단계와 품계가 그대로 오며, 신공을 남긴다", () => {
  withKarma(500, { endings_seen: ["기본"], legacy_open: true, legacy_level: 0 });
  const stages = [];
  for (let i = 0; i < 5; i++) {
    assert.ok(upgradeLegacy());
    stages.push(legacyPowers());
  }
  assert.ok(!upgradeLegacy(), "다섯 단계가 끝이다");
  assert.deepEqual(stages.map((p) => [p.take, p.shelf]), [[2, 4], [2, 4], [3, 5], [3, 5], [3, 5]]);
  assert.ok(stages[1].keepGear && !stages[0].keepGear);
  assert.ok(stages[3].keepGrade && !stages[2].keepGrade);
  assert.ok(stages[4].divine && !stages[3].divine);

  const g = new Game();
  g.start("무림초출");
  g.player.learnSkill(Skill.fromDict({ key: "무극검결", grade: "신공", mastery: 10 }));
  g.player.weapon = "운철보검";
  g.finishGame(true, "기본");
  assert.ok(g.legacyOptions().some((o) => o.key === "무극검결"));
  g.leaveLegacy(g.legacyOptions().findIndex((o) => o.key === "무극검결"));
  g.ending.legacyLeft = null;
  g.leaveLegacy(g.legacyOptions().findIndex((o) => o.key === "운철보검"));
  const n = new Game();
  n.start("무림초출", [], [0, 1]);
  n.pickingArts = false;
  n.giftsDone = true;
  n.player.turn = 11;
  n.event = null;
  n.action("휴식");
  n.chooseEvent(0);
  // 고른 유산은 한 자리에서 한꺼번에 이어받는다
  assert.equal(n.player.skills.find((s) => s.key === "무극검결").grade, "신공");
  assert.ok(n.player.weapon === "운철보검" || n.player.gear.includes("운철보검"));
  assert.equal(n.player.pendingLegacy.length, 0);
  withKarma(0);
});

test("장터의 값은 같은 효과면 같은 기준을 따른다", () => {
  const skillOf = (i) => i.effects.find((e) => e.type === "skill")?.skill;
  const books = {};
  for (const i of Object.values(DB.market)) {
    const key = skillOf(i);
    if (!key) continue;
    const id = `${DB.skills[key].type === "공격무공" ? "공격" : "심법과 보법"} ${DB.skills[key].grade}`;
    (books[id] ||= new Set()).add(i.price);
  }
  for (const [id, prices] of Object.entries(books)) assert.equal(prices.size, 1, id);
  // 기량을 올리는 약은 오르는 양에 맞는 값이다
  for (const [k, i] of Object.entries(DB.market)) {
    const stats = i.effects.filter((e) => e.type === "stat").reduce((t, e) => t + e.amount, 0);
    if (!stats || i.karma_price || k === "혈마단") continue;
    const heal = i.effects.filter((e) => e.type === "heal").reduce((t, e) => t + Math.max(0, e.percent), 0);
    assert.ok(Math.abs(i.price - stats * 3.2 - heal * (["보물", "신물"].includes(i.grade) ? 1.7 : 0.7)) <= 5, k);
  }
  // 천마를 깎는 밀서는 깎는 양에 비례한다
  const per = (k) => DB.market[k].price / DB.market[k].effects[0].percent;
  assert.equal(per("천마약점기록"), per("천마봉지도"));
  // 위력과 방어가 높을수록 값이 비싸다
  for (const slot of ["weapon", "armor"]) {
    const list = Object.values(DB.market).filter((i) => i.markets.length && i.price && i.effects.some((e) => e.slot === slot))
      .map((i) => [i.effects[0].bonus, i.price]).sort((a, b) => a[0] - b[0]);
    list.forEach(([, price], n) => { if (n) assert.ok(price >= list[n - 1][1], slot); });
  }
});

test("병장기를 내려놓으면 행낭에 남고 다시 들 수 있다", () => {
  const game = newGame();
  const p = game.player;
  p.equipGear("강철검");
  game.pendingNext = true;
  game.unequipGear("weapon");
  assert.equal(p.weapon, null);
  assert.ok(p.gear.includes("강철검"));
  game.equipGear("강철검");
  assert.equal(p.weapon, "강철검");
  assert.ok(!p.gear.includes("강철검"));
});

test("이기면 쓰지 않은 무공도 성취가 쌓이고, 심법과 보법이 더 많이 쌓인다", () => {
  seed(5);
  const p = new Player("무림초출");
  p.skills = ["기초검법", "토납법", "초상비"].map((k) => Skill.fromDict({ key: k, grade: DB.skills[k].grade, mastery: 0 }));
  p.mainSkill = "기초검법";
  const b = new Battle(p, new Enemy("산적"));
  b.enemy.hp = 0;
  b.finish(true);
  const [attack, mind, step] = p.skills.map((s) => s.mastery);
  assert.equal(attack, 1);
  assert.ok(mind >= 5 && step >= 5, `${mind} ${step}`);
});

test("명성이 높아도 마도와 사도의 무인을 대협으로 떠받들지 않고, 낮으면 소문을 말하지 않는다", () => {
  const p = new Player("무림초출");
  p.fame = 600;
  p.alignment = { 정도: 0, 사도: 0, 마도: 500 };
  assert.ok(!eventView(p, "표국호위").text.includes("대협"));
  p.alignment = { 정도: 500, 사도: 0, 마도: 0 };
  assert.ok(eventView(p, "표국호위").text.includes("대협"));
  // 이름이 나기 전에는 나를 알아보는 반응이 나오지 않는다
  p.fame = 15;
  assert.ok(!eventView(p, "화적떼").text.includes("알아보고"));
  assert.ok(!eventView(p, "주막싸움").text.includes("알아보고"));
  // 사건마다 맞지 않는 일반 말투 줄은 붙지 않는다
  assert.equal(DB.flavor.talk.event, undefined);
  p.fame = 200;
  assert.ok(!eventView(p, "도객의술내기").text.includes("상대가"));
});

test("마지막 장터는 보물과 신물만 내놓는다", () => {
  const game = new Game();
  game.start("무림초출");
  game.player.turn = 119;
  for (const key of Object.keys(DB.market)) {
    if (!DB.market[key].markets.includes(5)) continue;
    const skill = DB.market[key].effects.find((e) => e.type === "skill");
    if (skill) assert.ok(["상승", "일절"].includes(DB.skills[skill.skill].grade), key);
    else assert.ok(["보물", "신물"].includes(DB.market[key].grade), `${key} ${DB.market[key].grade}`);
  }
  const specials = Object.values(DB.market).filter((i) => i.markets.includes(5) && i.always);
  assert.ok(specials.length >= 8, "특별한 물건이 넉넉하다");
  assert.ok(specials.filter((i) => i.karma_price).every((i) => i.karma_price <= 3), "카르마 값이 싸다");
});

test("사건에서 축나는 몸은 경지와 기량이 높을수록 적다", () => {
  const game = new Game();
  game.start("무림초출");
  const p = game.player;
  const lost = () => {
    p.hp = p.maxHp();
    p.turn = 40;
    const before = p.hp;
    applyEffects(p, { hp_pct: -30 });
    return (before - p.hp) / p.maxHp();
  };
  const low = lost();
  Object.assign(p, { realm: "현경", external: 900, internal: 900, martial: 900, mind: 900 });
  const high = lost();
  assert.ok(low > 0.2, `${low}`);
  assert.ok(high < 0.06, `${high}`);
  assert.ok(high > 0, "그래도 조금은 축난다");
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
  withKarma(1);
  const game = new Game();
  game.start("무림초출");
  const market = openMarket(119, game.player);
  assert.ok(market.stock.some((s) => s.key === "생사단"));
  assert.equal(blockReason(game.player, "역천부"), "카르마 부족");
  const before = game.player.external;
  assert.ok(buy(game.player, market, "생사단")[0]);
  assert.equal(game.player.external, before, "영약은 행낭에 넣었다가 원할 때 먹는다");
  assert.equal(game.player.inventory.생사단, 1);
  game.useItem("생사단");
  assert.equal(game.player.external, before + 30);
  assert.equal(loadMeta().current_karma, 0);
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
  p.chains = [{ id: "과부의복수", next: 1, due: 5 }, { id: "장강수로", next: 1, due: 5 }];
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
  p.chains = [{ id: "과부의복수", next: 1, due: 9 }];
  assert.deepEqual(Player.fromDict(p.toDict()).chains, p.chains);
});

// ---------- 무공과 출신의 고른 분포 ----------

test("무기 계열마다 무공 수가 같고 등급이 고르다", () => {
  const styles = ["검법", "도법", "창법", "봉법", "권법", "장법", "암기"];
  // 문파의 최고 무공(reserved)은 아직 얻을 수 없으므로 세지 않는다
  const attacks = Object.values(DB.skills).filter((s) => s.type === "공격무공" && !s.reserved);
  for (const style of styles) {
    const list = attacks.filter((s) => s.category === style);
    assert.equal(list.length, 19, style);
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
  const start = main.mastery;
  useConsumable(p, "매화숫돌");
  assert.equal(main.mastery, start + 25);
  useConsumable(p, "베기짚단");
  assert.equal(main.mastery, start + 37);
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
  assert.deepEqual([req.min_stat, req.battles, req.hp_ratio, req.qi_ratio], [950, 75, 0.8, 0.8]);
  const hero = () => {
    const g = newGame();
    const p = g.player;
    p.external = p.internal = p.martial = p.mind = 999;
    p.realm = "현경";
    p.battles = 80;
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
  const low = new Skill("양의검법");
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
  const low = new Skill("양의검법");
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
  const tops = Object.keys(DB.skills).filter((k) => DB.skills[k].grade === "신공" && !DB.skills[k].reserved);
  const origins = DB.origins.order.filter((o) => o !== "무림초출");
  for (const type of ["공격무공", "심공", "경공"]) {
    for (const o of origins) {
      assert.equal(tops.filter((k) => DB.skills[k].type === type && DB.skills[k].origin === o).length, 1, `${o} ${type}`);
    }
    // 강호초출은 사부의 심법과 보법 하나씩, 공격 무공은 계열마다 하나씩
    const drifter = tops.filter((k) => DB.skills[k].type === type && DB.skills[k].origin === "무림초출");
    assert.equal(drifter.length, type === "공격무공" ? 7 : 1, `무림초출 ${type}`);
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
    // 강호초출의 공격 신공은 사부가 제자의 병기에 맞춰 준다
    const fitted = (e) => DB.skills[k].type === "공격무공" && JSON.stringify(e).includes(`"origin":"${owner}"}`);
    if (owner) assert.ok(Object.values(DB.events).some((e) => e.requires?.origin === owner && (JSON.stringify(e).includes(`"${k}"`) || fitted(e))), `${k} 출신 이야기`);
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
  applyEffects(p, { skill: "호체공" });
  assert.equal(p.bestOfType("심공").key, toNap.key, "새로 얻어도 쓰던 심법을 그대로 쓴다");
  applyEffects(p, { skill: "혼원일기공" });
  assert.equal(p.bestOfType("심공").key, "혼원일기공", "같은 갈래의 심법은 성취를 이어받는다");
  assert.equal(p.bestOfType("심공").mastery, toNap.mastery);
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

test("같은 갈래의 더 깊은 무공은 이어받고 같은 무공은 성취가 된다", () => {
  const p = new Player("남궁세가");
  const before = p.getSkill("창궁검법");
  before.mastery = 30;
  const notes = p.learnSkill(new Skill("제왕검형"));
  assert.ok(notes[0].includes("이어졌다"));
  assert.equal(p.skills.filter((s) => DB.skills[s.key].lineage === "창궁검").length, 1);
  assert.equal(p.mainSkill, "제왕검형");
  assert.equal(p.getSkill("제왕검형").mastery, 30);
  assert.ok(p.hasSkill("창궁검법"), "이어받은 무공은 옛 무공을 익힌 것으로 친다");
  // 얕은 쪽을 또 얻으면 성취가 된다
  const m = p.getSkill("제왕검형").mastery;
  p.learnSkill(new Skill("창궁검법"));
  assert.ok(p.getSkill("제왕검형").mastery > m);
  assert.equal(p.skills.filter((s) => s.key === "창궁검법").length, 0);
  // 갈래에는 빈 차례가 없다. 신공 규칙과 부딪치지 않는다
  for (const [k, s] of Object.entries(DB.skills)) if (s.lineage) assert.ok(s.lineage_rank >= 1, k);
});

test("적의 경지와 이름, 품은 비급이 세계관에 맞는다", () => {
  const nameless = ["무명노인", "권마의그림자", "혈마잔영", "생사문지기", "천마", "묘지기"];
  const banned = ["멸절", "호연패", "단목휘"];
  for (const [k, e] of Object.entries(DB.enemies)) {
    assert.ok(DB.realms.enemy_order.includes(e.realm), k);
    if (!nameless.includes(k) && DB.realms.enemy_order.indexOf(e.realm) >= DB.realms.enemy_order.indexOf("초절정")) assert.ok(e.title, `${k}: 초절정 이상은 이름과 소속이 있다`);
    if (e.drop) {
      assert.ok(DB.balance.drops[e.realm].grades.includes(DB.skills[e.drop.skill].grade), `${k}: ${e.drop.skill}`);
      assert.ok(!DB.skills[e.drop.skill].origin, k);
    }
    for (const w of banned) assert.ok(!e.name.includes(w), k);
    if (e.chapters?.length && e.tier === "일반" && e.chapters[0] === 1) assert.ok(["이류", "일류"].includes(e.realm), `${k}: 1장 일반 적은 이류나 일류다`);
  }
  for (const realm of ["이류", "일류"]) assert.ok(!DB.balance.drops[realm].grades.includes("명품"), realm);
  for (const table of Object.values(DB.balance.drops)) for (const g of ["일절", "신공"]) assert.ok(!table.grades.includes(g));
});

test("적은 시점으로 정하고 경지로 비중을 나눈다", () => {
  const count = (realm, turn, key, n = 1500) => {
    const game = newGame();
    Object.assign(game.player, { realm, turn });
    let hits = 0;
    for (let i = 0; i < n; i++) if (game.pickEnemy() === key) hits += 1;
    return hits;
  };
  assert.ok(count("현경", 10, "산적") > 0, "1장에는 경지가 높아도 1장의 적만 나온다");
  assert.equal(count("일류", 10, "십이마장", 300), 0);
  assert.ok(count("화경", 80, "십이마장") > count("일류", 80, "십이마장"), "경지가 가까울수록 자주 만난다");
  assert.ok(count("일류", 30, "녹림호걸") > count("화경", 30, "녹림호걸"));
});

test("적의 비급과 약은 경지를 따르고 아는 무공이면 성취가 오른다", () => {
  const p = new Player("하북팽가");
  for (let i = 0; i < 200; i++) {
    const key = dropSkill(p, null, DB.balance.drops.일류.grades);
    assert.equal(DB.skills[key].grade, "기본");
    assert.ok(!DB.skills[key].origin && !DB.skills[key].legend);
  }
  const battle = new Battle(p, new Enemy("마교장로"));
  battle.enemy.drop = { skill: "현빙장" };
  DB.balance.drops.화경.book = 1;
  p.learnSkill(new Skill("현빙장"));
  const mastery = () => p.skills.reduce((t, s) => t + s.mastery, 0) + p.skills.length;
  const before = mastery();
  for (let i = 0; i < 12; i++) battle.rollDrop();
  DB.balance.drops.화경.book = 0.06;
  assert.ok(mastery() > before);
  assert.ok(new Set(p.skills.map((s) => s.key)).size === p.skills.length, "같은 무공이 둘이 되지 않는다");
});

test("3년 차에 소속 없는 무인은 문을 두드리고 혼자 가면 문파의 손길이 줄어든다", () => {
  const event = DB.events.문을_두드리다;
  assert.deepEqual(event.turn_range, [29, 31]);
  const p = new Player("표국표사");
  p.turn = 28;
  assert.notEqual(storyEventForTurn(p), "문을_두드리다");
  p.turn = 31;
  assert.equal(storyEventForTurn(p), "문을_두드리다", "마지막 달에는 반드시 온다");
  p.turn = 32;
  assert.notEqual(storyEventForTurn(p), "문을_두드리다");
  p.turn = 31;
  p.sect = "소림";
  assert.notEqual(storyEventForTurn(new Player("남궁세가")), "문을_두드리다");
  assert.notEqual(storyEventForTurn(p), "문을_두드리다");
  // 성향에 맞는 문만 보인다
  const labels = (setup) => { const q = new Player("표국표사"); setup(q); return eventView(q, "문을_두드리다").choices.map((c) => c.label); };
  const right = labels((q) => { q.alignment.정도 = 300; });
  assert.ok(right.some((l) => l.includes("소림사")) && !right.some((l) => l.includes("천마신교")) && right.some((l) => l.includes("혼자")));
  const dark = labels((q) => { q.alignment.마도 = 300; });
  assert.ok(dark.some((l) => l.includes("천마신교")) && dark.some((l) => l.includes("혼자")) && !dark.some((l) => l.includes("소림사")));
  const none = labels(() => {});
  assert.ok(none.some((l) => l.includes("거지")) && !none.some((l) => l.includes("소림사")) && !none.some((l) => l.includes("천마신교")));
  const son = labels((q) => { q.originKey = "하북팽가"; q.alignment.마도 = 300; });
  assert.ok(!son.some((l) => l.includes("천마신교")), "원수의 문은 두드리지 않는다");
  // 혼자 가면 입문 사건이 드물어진다
  const gates = (alone) => {
    const q = new Player("표국표사");
    q.turn = 40;
    q.alignment.사도 = 100;
    if (alone) q.addFlag("홀로_간다");
    let hits = 0;
    for (let i = 0; i < 1500; i++) if (DB.events[pickRandomEvent(q)]?.sect_gate) hits += 1;
    return hits;
  };
  assert.ok(gates(true) < gates(false) * 0.5);
});

test("소속은 세력마다 입문, 제안, 적대를 갖추고 사파와 마도도 넉넉하다", () => {
  for (const key of Object.keys(DB.sects)) {
    if (["남궁"].includes(key)) continue;
    assert.ok(DB.events[`제안_${key}`], key);
    assert.ok(DB.events[`${key}_적대`], key);
  }
  const by = (side) => Object.values(DB.sects).filter((s) => s.alignment === side).length;
  assert.ok(by("사도") >= 5 && by("마도") >= 3);
  for (const key of ["소림", "무당", "화산", "아미", "곤륜", "종남", "점창", "청성", "공동", "개방", "당가", "모용", "제갈"]) {
    assert.equal(DB.sects[key].alignment, "정도", key);
    assert.ok(DB.events.문을_두드리다.choices.some((c) => c.outcomes[0].effects.sect_offer === key), key);
    assert.ok(DB.realms.breakthrough.현경.sect[key], key);
  }
  // 피 연못에서 살아 나온 무인은 혈교에 들지 않는다
  const q = new Player("혈지생환");
  q.alignment.마도 = 300;
  assert.ok(!checkRequires(q, DB.events.혈교_입문.requires));
});

test("경지가 오르면 대사와 특전이 따른다", () => {
  const game = newGame();
  const p = game.player;
  Object.assign(p, { external: 400, internal: 400, martial: 400, mind: 400, battles: 12 });
  const before = new Battle(p, new Enemy("낭인")).player.traits.length;
  const lines = game.checkRealm();
  assert.equal(p.realm, "절정");
  assert.ok(lines.length >= 6, "돌파의 대사가 넉넉하다");
  assert.ok(lines.some((l) => l.includes("상인")));
  assert.equal(p.traits.length, before + 1);
  assert.ok(sumEffect(p.traits, "qi_cost_cut", "percent") >= 10);
  for (const realm of ["절정", "초절정", "화경", "현경"]) {
    const data = DB.realms.breakthrough[realm];
    assert.ok(data.text.length >= 3 && Object.keys(data.origin).length === 8 && Object.keys(data.side).length === 3 && Object.keys(data.category).length === 7, realm);
  }
  // 저장했다 불러도 특전이 남는다
  assert.ok(Player.fromDict(p.toDict()).traits.includes("경지_절정"));
});

test("비무에 지면 죽지 않고 체력 10%만 남으며 얻는 것이 없다", () => {
  const game = newGame();
  const p = game.player;
  p.revives = 1;
  const before = { silver: p.silver, fame: p.fame, kills: p.kills, battles: p.battles };
  game.event = { key: "구파비무회", forced: false };
  const index = eventView(p, "구파비무회").choices.find((c) => !c.locked).index;
  game.chooseEvent(index);
  assert.equal(game.battle.spar, true);
  p.hp = 1;
  game.battle.enemy.attack = 99999;
  game.battle.enemy.hp = game.battle.enemy.maxHp = 1e7;
  game.battleAction("심법");
  game.battleAction("심법");
  while (game.battle) { p.hp = 1; game.battleAction("심법"); }
  assert.ok(p.alive);
  assert.equal(p.hp, Math.trunc(p.maxHp() * 0.1));
  assert.equal(p.revives, 1, "비무에서는 되살아날 기회를 쓰지 않는다");
  assert.equal(p.fame, before.fame);
  assert.equal(p.kills, before.kills);
  assert.equal(p.battles, before.battles);
});

test("이어지는 일의 비무에서 지면 그 일이 어그러지고 이기면 이어진다", () => {
  const run = (win) => {
    const game = newGame();
    const p = game.player;
    p.turn = 30;
    p.chains = [{ id: "구파비무행", next: 2, due: 30 }];
    game.event = { key: DB.chains.구파비무행.keys[1], forced: false };
    game.chooseEvent(eventView(p, game.event.key).choices.find((c) => c.label.includes("맨손")).index);
    assert.equal(game.battle.spar, true);
    if (win) { game.battle.enemy.hp = 1; game.battle.enemy.evasion = -9; while (game.battle) game.battleAction("기본공격"); }
    else { game.battle.enemy.attack = 1e6; game.battle.enemy.hp = game.battle.enemy.maxHp = 1e7; while (game.battle) game.battleAction("심법"); }
    return p;
  };
  assert.equal(run(false).chains.length, 0);
  assert.equal(run(true).chains.length, 1);
});

test("상승 이상의 무공에만 묘리가 드러나고 모든 무공에 묘리가 있다", () => {
  for (const [k, s] of Object.entries(DB.skills)) assert.ok(s.gimmick?.name && s.gimmick?.text, k);
  const low = new Skill("매화검법");
  low.grade = "명품";
  assert.equal(low.activeGimmick(), null);
  low.grade = "상승";
  assert.equal(low.activeGimmick().hits, 3);
  // 승급으로 상승에 이르면 묘리를 깨친다
  const up = new Skill("기초검법");
  up.grade = "명품";
  up.mastery = 100;
  assert.ok(up.gainMastery(5).some((l) => l.includes("묘리")));
  // 나눠 치는 무공은 합마다 여러 번 때린다
  const p = new Player("무림초출");
  p.skills.push(low);
  const battle = new Battle(p, new Enemy("천마"));
  battle.enemy.evasion = -9;
  const hp = battle.enemy.hp;
  p.qi = 999;
  battle.roundNum = 1;
  battle.useSkill(low);
  assert.equal(battle.log.filter((l) => /제\d타/.test(l)).length, 3);
  assert.ok(battle.enemy.hp < hp);
  // 흡수, 호신, 저절로 피하기
  const blood = new Skill("혈영도법");
  blood.grade = "상승";
  const b2 = new Battle(p, new Enemy("천마"));
  b2.enemy.evasion = -9;
  p.hp = 10;
  p.qi = 999;
  b2.useSkill(blood);
  assert.ok(p.hp !== 10);
  // 심법의 묘리는 운기하지 않아도 늘 흐른다
  const mind = new Skill("철마금신공");
  p.skills.push(mind);
  p.chosenArts.심공 = "철마금신공";
  const b3 = new Battle(p, new Enemy("낭인"));
  assert.ok(b3.ward > 0 && b3.mindGuard() > 0);
  p.hp = p.maxHp();
  b3.roundNum = 1;
  b3.enemyAttack();
  assert.ok(b3.log.some((l) => l.includes("호신 기운")));
});

test("일부만 상쇄한 경공은 흘려냈다고 하지 않는다", () => {
  const p = new Player("표국표사");
  const b = new Battle(p, new Enemy("낭인"));
  b.roundNum = 1;
  const steps = new Skill("초상비");
  steps.effect = { ...steps.effect, evade: 0 };
  p.hp = p.maxHp();
  b.enemyAttack(steps);
  assert.ok(b.log.every((l) => !l.includes("흘려") && !l.includes("흘렸")));
  assert.ok(b.log.some((l) => l.includes("줄었다")));
});

test("정도를 걷는 무인에게 금의위와 정파가 까닭 없이 덤비지 않고 제 소속도 덤비지 않는다", () => {
  const seen = (setup, turn = 30, n = 500) => {
    const game = newGame();
    setup(game.player);
    game.player.turn = turn;
    const names = new Set();
    for (let i = 0; i < n; i++) names.add(game.pickEnemy());
    return names;
  };
  const right = seen((p) => { p.alignment.정도 = 300; });
  assert.ok(!right.has("금의위밀정") && !right.has("종남검수"));
  assert.ok(!seen((p) => { p.alignment.정도 = 300; }, 60).has("동창번자"));
  const member = seen((p) => { p.sect = "녹림맹"; });
  assert.ok(!member.has("녹림호걸") && !member.has("녹림채주"));
  const dark = seen((p) => { p.sect = "마교"; p.alignment.마도 = 500; }, 100);
  assert.ok(![...dark].some((k) => DB.enemies[k].faction === "마교"));
  assert.ok(dark.size > 0);
});

test("짐승은 다양하고 내단을 남기며 삼키면 기량이 오른다", () => {
  const beasts = Object.values(DB.enemies).filter((e) => e.beast);
  assert.ok(beasts.length >= 10);
  for (const chapter of [1, 2, 3, 4, 5]) assert.ok(beasts.filter((e) => e.chapters?.includes(chapter)).length >= 2, `${chapter}장`);
  const p = new Player("표국표사");
  const battle = new Battle(p, new Enemy("이무기"));
  DB.enemies.이무기.loot.chance = 1;
  battle.rollDrop();
  DB.enemies.이무기.loot.chance = 0.6;
  assert.ok(p.inventory.천년내단 > 0);
  const before = p.external;
  useConsumable(p, "천년내단");
  assert.equal(p.external, before + 40);
  assert.ok(!p.inventory.천년내단);
});

test("대사가 성향과 명성을 따른다", () => {
  const p = new Player("무림초출");
  p.fame = 100;
  p.alignment.정도 = 300;
  for (const key of ["산적", "낭인", "녹림호걸", "마교장로"]) {
    assert.ok(DB.enemies[key].intros.some((i) => i.requires.dominant === "정도"), key);
    assert.ok(DB.enemies[key].intros.some((i) => i.requires.min_fame), key);
  }
  assert.ok(enemyIntro(p, "산적").includes("협객"));
  p.alignment.정도 = 0; p.alignment.마도 = 300;
  assert.ok(enemyIntro(p, "산적").includes("피 냄새"));
  assert.ok(eventView(p, "주막싸움").text.includes("말소리"));
  const known = new Player("무림초출");
  known.fame = 750;
  assert.ok(talkLine(known, "month"));
});

test("시장에 내지 않는 내단은 장터에 나오지 않는다", () => {
  const game = newGame();
  for (const turn of [12, 24, 60, 119]) {
    const market = openMarket(turn, game.player);
    // 천년 내단은 수상한 누군가만 내놓는다
    assert.ok(!market.stock.some((s) => ["금안", "호주", "호골", ...(turn === 119 ? [] : ["천년내단"])].includes(s.key)));
  }
});

test("천마는 상대의 기량을 보고 힘을 더 꺼내지만 낮은 기량에는 그대로다", () => {
  const fight = (stat) => {
    const game = newGame();
    Object.assign(game.player, { external: stat, internal: stat, martial: stat, mind: stat, bossWeaken: 0 });
    game.startFinalBattle();
    return game.battle.enemy;
  };
  const low = fight(800);
  assert.equal(low.maxHp, DB.enemies.천마.hp);
  assert.equal(low.attack, DB.enemies.천마.attack);
  const high = fight(990);
  assert.ok(high.maxHp > low.maxHp && high.attack > low.attack);
});

test("경지가 오르면 지난 경지의 특전도 깊어지고 저장해도 남는다", () => {
  const p = new Player("무림초출");
  const damage = () => sumEffect(p.traits, "damage_bonus", "percent");
  p.traits.push("경지_절정");
  const before = damage();
  p.realm = "초절정";
  const saved = Player.fromDict(p.toDict());
  assert.ok(saved.traits.includes("경지_절정_초절정"), "예전 저장도 받는다");
  assert.ok(sumEffect(saved.traits, "damage_bonus", "percent") > before);
  const game = newGame();
  const g = game.player;
  Object.assign(g, { external: 700, internal: 700, martial: 700, mind: 700, battles: 500, turn: 60, realm: "절정" });
  const lines = game.checkRealm();
  assert.ok(lines.some((l) => l.includes("특전이 깊어졌다")), lines.join("/"));
  assert.equal(new Set(g.traits).size, g.traits.length, "같은 특전을 두 번 받지 않는다");
  for (const r of ["절정", "초절정", "화경"]) {
    for (const [next, growth] of Object.entries(DB.realms.perks[r].growth)) {
      assert.ok(DB.realms.order.indexOf(next) > DB.realms.order.indexOf(r), r);
      assert.ok(growth.desc && growth.effects.length, r);
    }
  }
});

test("성취는 공격 무공이 합마다 조금씩, 심법과 경공은 쓸 때 더 많이 쌓인다", () => {
  const p = new Player("무림초출");
  p.martial = 100;
  let attack = 0;
  let art = 0;
  for (let i = 0; i < 500; i++) { attack += p.attackMasteryGain(); art += p.masteryGainAmount() * 2; }
  assert.ok(attack < art / 2.5, `${attack} ${art}`);
});

test("경지마다 특전이 뚜렷하고 호신강기는 맞을 때마다 피해를 막는다", () => {
  for (const realm of ["절정", "초절정", "화경", "현경"]) assert.ok(DB.realms.perks[realm].effects.length >= 2, realm);
  const hit = (traits) => {
    const p = new Player("표국표사");
    p.traits.push(...traits);
    const b = new Battle(p, new Enemy("낭인", 1));
    let total = 0;
    for (let i = 0; i < 300; i++) total += b.incoming();
    return total / 300;
  };
  assert.ok(hit(["경지_초절정"]) < hit([]), "호신강기가 막는다");
  assert.ok(hit(["경지_초절정"]) >= 1);
  const strong = (traits) => { const p = new Player("표국표사"); p.traits.push(...traits); return new Battle(p, new Enemy("낭인", 1)).attackPower(); };
  assert.ok(strong(["경지_절정"]) > strong([]), "병기에 기운을 실으면 강해진다");
  const p = new Player("표국표사");
  p.traits.push("경지_화경");
  assert.ok(new Battle(p, new Enemy("낭인", 1)).ward > 0, "화경은 호신 기운을 두르고 싸움을 시작한다");
  p.realm = "초절정";
  assert.ok(new Battle(p, new Enemy("낭인", 1)).skillLabel(p.bestSkill()).includes("창강"));
});

test("문파의 무공은 다른 문파 사람에게서 나오지 않는다", () => {
  const p = new Player("표국표사");
  for (let i = 0; i < 400; i++) {
    const key = dropSkill(p, null, ["기본", "명품"], "종남");
    assert.ok(!DB.skills[key].school, key);
  }
  for (const [k, e] of Object.entries(DB.enemies)) {
    const school = e.drop && DB.skills[e.drop.skill].school;
    if (school) assert.equal(school, e.faction, k);
  }
});

test("출신과 사문에 어긋나는 사건이 나오지 않는다", () => {
  const dark = new Player("혈지생환");
  dark.alignment.마도 = 300;
  assert.ok(!checkRequires(dark, DB.events.마교_입교.requires), "피 연못 출신은 신교에 들지 않는다");
  assert.ok(!checkRequires(new Player("남궁세가"), DB.events.첫살인.requires), "일류까지 오른 표두나 세가 무인에게 첫 살인은 없다");
  const member = new Player("표국표사");
  member.sect = "혈교";
  assert.ok(!checkRequires(member, DB.events.혈교제단.requires));
  for (const origin of DB.origins.order) {
    if (origin === "무림초출") continue;
    const text = eventView(new Player(origin), "옛사부의편지").text;
    assert.ok(!text.includes("떠나온 날"), origin);
  }
  const quiet = new Player("표국표사");
  quiet.fame = 0;
  assert.ok(!checkRequires(quiet, DB.events.강호의소문.requires), "이름이 없으면 소문에 별호가 섞이지 않는다");
});

test("힘의 기준대로 경지가 나뉜다", () => {
  assert.equal(DB.enemies.천마.realm, "생사경");
  assert.ok(!Object.entries(DB.enemies).some(([k, e]) => k !== "천마" && e.realm === "생사경"), "생사경은 천마뿐이다");
  for (const k of ["십이마장", "십이마장귀곡", "혈수라", "무영"]) assert.equal(DB.enemies[k].realm, "현경", k);
  assert.equal(DB.enemies.마교장로.realm, "화경");
  for (const k of ["화산장로", "아미사태", "독문고수"]) assert.equal(DB.enemies[k].realm, "초절정", k);
  for (const k of ["비무청성", "녹림채주"]) assert.equal(DB.enemies[k].realm, "절정", k);
});

test("쓰러뜨린 이름 있는 적은 다시 나오지 않고 대신할 자가 나오거나 돌아온 대사를 한다", () => {
  const game = newGame();
  const p = game.player;
  p.turn = 30;
  const key = "녹림채주";
  game.startBattle(key);
  game.battle.enemy.hp = 1;
  game.battle.enemy.evasion = -9;
  while (game.battle) game.battleAction("기본공격");
  assert.ok(p.slain.includes(key));
  assert.ok(Player.fromDict(p.toDict()).slain.includes(key), "저장해도 남는다");
  // 뽑기에서 빠진다
  for (let i = 0; i < 300; i++) assert.notEqual(game.pickEnemy(), key);
  // 사건에서 불러도 대신할 자가 나온다
  game.pendingNext = false;
  game.startBattle(key);
  assert.equal(game.battle.enemy.key, DB.enemies[key].stand_in);
  game.battle = null;
  // 대신할 자가 없으면 돌아온다
  p.slain.push("당가배신자");
  game.startBattle("당가배신자");
  assert.equal(game.battle.enemy.key, "당가배신자");
  assert.ok(game.log.some((l) => /분명 내 손에|쓰러뜨린 줄|묻어 주지|쓰러졌던|살아 돌아온/.test(l)), "돌아온 대사");
  game.battle = null;
  // 이름 없는 적은 몇 번이고 나온다
  p.turn = 5;
  game.startBattle("산적");
  assert.equal(game.battle.enemy.key, "산적");
  // 4, 5장에도 이름 없는 적이 있어 나올 적이 마르지 않는다
  for (const chapter of [1, 2, 3, 4, 5]) {
    assert.ok(Object.entries(DB.enemies).some(([k, e]) => e.chapters?.includes(chapter) && !e.title && !e.requires), `${chapter}장`);
  }
  // 비무에 이겨도 그 사람은 살아 있다
  const g2 = newGame();
  g2.player.turn = 30;
  g2.startBattle("호적수", true);
  g2.battle.enemy.hp = 1;
  g2.battle.enemy.evasion = -9;
  while (g2.battle) g2.battleAction("기본공격");
  assert.ok(!g2.player.slain.includes("호적수"));
});

test("산 인연은 일반 인연보다 자주 찾아오고 새 인연은 이야기가 이어진다", () => {
  const p = new Player("표국표사");
  p.turn = 20;
  p.content = ["설서인"];
  let bought = 0; let plain = 0;
  for (let i = 0; i < 3000; i++) {
    const k = pickRandomEvent(p);
    if (k === "설서_첫자리") bought += 1;
    if (k === "술도가") plain += 1;
  }
  assert.ok(bought > plain, "인연이 더 자주 온다");
  for (const key of ["새끼영물", "호적수", "길의원", "칠보지도", "끊어진문파", "설서인"]) {
    assert.ok(DB.karma.content[key].cost > 0);
    assert.ok(Object.values(DB.events).filter((e) => e.requires?.unlocked === key).length >= 2, key);
  }
});

test("쓰러지는 순간 힘을 끌어모을지 고른다", () => {
  const make = () => {
    const game = newGame();
    const p = game.player;
    game.startBattle("산적");
    game.battle.enemy.attack = 1e6;
    game.battle.enemy.hp = game.battle.enemy.maxHp = 1e7;
    p.revives = 1;
    game.battle.runRound("심법");
    return game;
  };
  const yes = make();
  assert.equal(yes.battle.standPending, true);
  assert.equal(yes.player.hp, 0);
  yes.battleStand(true);
  assert.equal(yes.battle.standPending, false);
  assert.ok(yes.player.hp > 0);
  assert.equal(yes.player.revives, 0);
  assert.ok(!yes.log.join().includes("부활"));
  const no = make();
  no.battleStand(false);
  assert.equal(no.battle, null);
  assert.equal(no.player.alive, false);
});

test("결전에 달려온 사람이 저마다 돕는다", () => {
  assert.ok(Object.keys(DB.companions).length >= 8);
  for (const [k, c] of Object.entries(DB.companions)) assert.ok(c.flag && c.join && c.help_text && c.lines.length, k);
  const free = Object.values(DB.companions).filter((c) => !Object.values(DB.events).some((e) => e.requires?.unlocked && JSON.stringify(e).includes(`"${c.flag}"`)));
  assert.ok(free.length < Object.keys(DB.companions).length / 2, "대부분 카르마로 산 인연이다");
  const p = new Player("표국표사");
  const base = new Battle(p, new Enemy("천마"), true);
  const power = base.attackPower();
  p.addFlag("묘아_친구");
  p.addFlag("노병_맹세");
  p.addFlag("호적수_약속");
  p.addFlag("장칠_의리");
  const b = new Battle(p, new Enemy("천마"), true);
  assert.equal(b.companions.length, 3, "세 사람까지 온다");
  const q = new Player("표국표사");
  q.addFlag("묘아_친구");
  q.addFlag("적연_동행");
  q.addFlag("길의원_은혜");
  const c = new Battle(q, new Enemy("천마"), true);
  assert.ok(c.attackPower() > power, "묘아가 빈틈을 일러 준다");
  c.roundNum = 12;
  q.hp = 10;
  const hp = c.enemy.hp;
  c.companionsAct();
  assert.ok(c.burn, "적연이 혈맥을 태운다");
  assert.ok(q.hp > 10, "의원이 채운다");
  assert.equal(hp, c.enemy.hp);
  assert.equal(new Battle(q, new Enemy("낭인")).companions.length, 0, "결전에만 온다");
  const w = new Player("표국표사");
  w.addFlag("호적수_약속");
  const d = new Battle(w, new Enemy("천마"), true);
  d.roundNum = 3;
  const before = d.enemy.hp;
  d.companionsAct();
  assert.ok(d.enemy.hp < before, "위무결이 대신 벤다");
});

test("사도나 마도를 걷는 무인에게는 무림맹주도 적으로 나온다", () => {
  assert.equal(DB.enemies.무림맹주.realm, "현경");
  const seen = (setup) => {
    const game = newGame();
    setup(game.player);
    game.player.turn = 100;
    const names = new Set();
    for (let i = 0; i < 600; i++) names.add(game.pickEnemy());
    return names;
  };
  assert.ok(seen((p) => { p.alignment.마도 = 500; }).has("무림맹주"));
  assert.ok(seen((p) => { p.alignment.사도 = 500; }).has("무림맹주"));
  assert.ok(!seen((p) => { p.alignment.정도 = 500; }).has("무림맹주"));
  assert.ok(!seen(() => {}).has("무림맹주"));
});

test("문파의 최고 무공은 신공이고 아직 얻을 수 없으며, 문파의 고등급 무공은 그 소속의 사건에서만 나온다", () => {
  const reserved = Object.keys(DB.skills).filter((k) => DB.skills[k].reserved);
  assert.ok(reserved.length >= 15);
  for (const k of reserved) {
    assert.equal(DB.skills[k].grade, "신공", k);
    assert.ok(DB.skills[k].school, k);
    assert.ok(!Object.values(DB.market).some((i) => i.effects.some((e) => e.skill === k)), `${k} 장터`);
    assert.ok(!Object.values(DB.enemies).some((e) => e.drop?.skill === k), `${k} 드롭`);
  }
  const problems = [];
  const scan = (node, sect, where) => {
    if (Array.isArray(node)) return node.forEach((n) => scan(n, sect, where));
    if (!node || typeof node !== "object") return undefined;
    const here = node.requires?.sect ?? sect;
    const skill = DB.skills[node.skill];
    if (skill && !node.requires && node.skill) {
      if (skill.reserved) problems.push(`${where}: ${node.skill}`);
      const high = ["상승", "일절", "신공"].includes(skill.grade);
      if (high && skill.school && here !== skill.school && !allowedOutside.includes(node.skill)) problems.push(`${where}: ${node.skill} (${here})`);
    }
    return Object.entries(node).forEach(([key, v]) => { if (key !== "requires") scan(v, here, where); });
  };
  // 이 무공들은 소속 밖의 사건에도 그 소속이 얽혀 있다. 혈마의 유적, 개방의 신물을 지키는 사건이다
  const allowedOutside = ["혈마심공", "타구봉법"];
  for (const [k, e] of Object.entries(DB.events)) scan(e, e.requires?.sect ?? null, k);
  assert.deepEqual(problems, []);
  for (const [k, s] of Object.entries(DB.skills)) {
    if (s.school && ["상승", "일절", "신공"].includes(s.grade)) assert.ok(!Object.values(DB.enemies).some((e) => e.drop?.skill === k), `${k} 드롭`);
    if (s.school && ["상승", "일절", "신공"].includes(s.grade)) assert.ok(!Object.values(DB.market).some((i) => i.effects.some((e) => e.skill === k)), `${k} 장터`);
  }
});

test("무공의 품계가 위상에 맞는다", () => {
  for (const [k, g] of [["타구봉법", "일절"], ["백보신권", "신공"], ["만천화우", "신공"], ["역근공", "일절"], ["달마심공", "신공"], ["태극검", "신공"], ["이십사수매화검법", "신공"], ["매화검법", "일절"], ["파산권", "명품"]]) assert.equal(DB.skills[k].grade, g, k);
  // 문파의 비전은 장터에 나오지 않는다
  for (const k of ["매화검법", "역근공", "태극검", "타구봉법"]) assert.ok(!Object.values(DB.market).some((i) => i.effects.some((e) => e.skill === k)), k);
  assert.equal(DB.events.제안_개방.choices[0].outcomes[0].effects.skill, "오호곤법", "개방에 들어가자마자 방주의 봉법을 주지 않는다");
  assert.equal(DB.events.제안_무당.choices[0].outcomes[0].effects.skill, "양의검법");
  for (const [k, s] of Object.entries(DB.skills)) assert.ok(s.gimmick?.text, k);
  const p = new Player("개방제자");
  p.learnSkill(new Skill("타구봉법"));
  assert.equal(p.mainSkill, "타구봉법", "걸개곤법이 이어진다");
});

test("사건의 전투는 그 사건만의 이름으로 나오고 이름 있는 적으로 치지 않는다", () => {
  const game = newGame();
  game.player.turn = 30;
  game.startBattle("낭인", false, "고리대의 왈패 대장");
  assert.equal(game.battle.enemy.name, "고리대의 왈패 대장");
  assert.equal(game.battle.enemy.desc, "");
  assert.ok(game.log.some((l) => l.includes("왈패 대장")));
  const g2 = newGame();
  g2.player.turn = 30;
  g2.startBattle("녹림채주", false, "이웃 채의 채주");
  g2.battle.enemy.hp = 1;
  g2.battle.enemy.evasion = -9;
  while (g2.battle) g2.battleAction("기본공격");
  assert.ok(!g2.player.slain.includes("녹림채주"), "사건 상대를 쓰러뜨려도 그 이름 있는 적이 죽은 것은 아니다");
  // 사건 전투 대부분이 이름을 갖는다
  let total = 0; let named = 0;
  const walk = (o) => {
    if (Array.isArray(o)) o.forEach(walk);
    else if (o && typeof o === "object") {
      if (o.battle) { total += 1; if (o.foe) named += 1; }
      Object.values(o).forEach(walk);
    }
  };
  for (const e of Object.values(DB.events)) walk(e.choices), walk(e.variants);
  assert.ok(named / total > 0.7, `${named}/${total}`);
});

test("사건 인물이 무작위로 나오는 적의 이름과 대사를 그대로 쓰지 않는다", () => {
  const bad = [];
  const walk = (key, o) => {
    if (Array.isArray(o)) o.forEach((v) => walk(key, v));
    else if (o && typeof o === "object") {
      if (typeof o.battle === "string" && DB.enemies[o.battle].weight > 0 && !o.foe && !o.foe_line && o.battle !== "무림맹주") bad.push(`${key}: ${o.battle}`);
      Object.values(o).forEach((v) => walk(key, v));
    }
  };
  for (const [key, e] of Object.entries(DB.events)) walk(key, e);
  assert.deepEqual(bad, []);
  const game = newGame();
  game.startBattle("혈교혈승", false, "혈교 탁발승 적염주 혈념", "보시를 마저 받겠습니다.");
  assert.equal(game.battle.enemy.name, "혈교 탁발승 적염주 혈념");
  assert.ok(game.log.some((l) => l.includes("보시를 마저 받겠습니다.")));
  assert.ok(!game.log.some((l) => l.includes("혈불") || l.includes("이건 거짓말이오")));
  const p = new Player();
  assert.ok(checkRequires(p, DB.events.산군의제사.requires));
  p.slain.push("백액호");
  assert.ok(!checkRequires(p, DB.events.산군의제사.requires));
});

test("화면 글에 이모티콘을 쓰지 않는다", () => {
  const emoji = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{2712}\u{2714}\u{2716}-\u{27BF}]/u;
  const walk = (o, where) => {
    if (typeof o === "string") assert.ok(!emoji.test(o), `${where}: ${o}`);
    else if (Array.isArray(o)) o.forEach((v) => walk(v, where));
    else if (o && typeof o === "object") Object.values(o).forEach((v) => walk(v, where));
  };
  for (const name of ["events", "enemies", "companions", "endings", "karma", "traits", "fortunes", "flavor", "realms"]) walk(DB[name], name);
});

test("결전에 오는 사람은 고수다", () => {
  for (const [k, c] of Object.entries(DB.companions)) assert.ok(!/점소이|소매치기|군졸/.test(c.name), k);
  assert.ok(DB.companions.왕백로.help_text.includes("천하십대고수"));
});

test("장식 부호를 쓰지 않는다", () => {
  const deco = /[「」『』·—…]/;
  const walk = (o, where) => {
    if (typeof o === "string") assert.ok(!deco.test(o), `${where}: ${o}`);
    else if (Array.isArray(o)) o.forEach((v) => walk(v, where));
    else if (o && typeof o === "object") Object.values(o).forEach((v) => walk(v, where));
  };
  for (const name of ["events", "enemies", "companions", "endings", "karma", "traits", "fortunes", "flavor", "realms", "skills", "market"]) walk(DB[name], name);
});

test("비율은 할과 푼으로 적는다", () => {
  assert.equal(halpun(30), "3할");
  assert.equal(halpun(8), "8푼");
  assert.equal(halpun(25), "2할 5푼");
  assert.equal(halpun(-5), "-5푼");
  const walk = (o, where) => {
    if (typeof o === "string") assert.ok(!/\d\s*%/.test(o), `${where}: ${o}`);
    else if (Array.isArray(o)) o.forEach((v) => walk(v, where));
    else if (o && typeof o === "object") Object.values(o).forEach((v) => walk(v, where));
  };
  for (const name of ["events", "enemies", "companions", "endings", "karma", "traits", "fortunes", "flavor", "realms", "skills", "market", "sects"]) walk(DB[name], name);
  
});

test("도구 하나는 합을 쓰지 않고 둘째는 합을 쓴다", () => {
  const p = new Player();
  p.addItem("금창약", 3);
  const b = new Battle(p, new Enemy("낭인", 10));
  b.runRound("소비품", null, "금창약");
  assert.equal(b.roundNum, 0, "첫 도구는 합이 지나가지 않는다");
  assert.equal(p.inventory.금창약, 2);
  b.runRound("소비품", null, "금창약");
  assert.equal(b.roundNum, 1, "같은 합에 둘째를 쓰면 합이 지나간다");
  b.runRound("소비품", null, "금창약");
  assert.equal(b.roundNum, 1, "새 합의 첫 도구는 다시 합을 쓰지 않는다");
});

test("병장기는 바꿔 들고 되팔 수 있으며 진열은 주무공 병기를 앞세운다", () => {
  const p = new Player("무림초출");
  p.learnSkill(new Skill("기초검법"));
  p.mainSkill = "기초검법";
  p.weapon = "철검";
  p.silver = 1000;
  const market = { stock: [{ key: "강철검", left: 1 }] };
  assert.ok(buy(p, market, "강철검")[0]);
  assert.equal(p.weapon, "철검", "더 좋아도 저절로 바꿔 들지 않는다");
  assert.ok(p.gear.includes("강철검"));
  p.equipGear("강철검");
  assert.ok(p.gear.includes("철검"), "들던 것은 행낭에 챙긴다");
  const before = p.silver;
  assert.ok(sell(p, "철검")[0]);
  assert.ok(p.silver > before && !p.gear.includes("철검"));
  const restored = Player.fromDict(JSON.parse(JSON.stringify(p.toDict())));
  assert.deepEqual(restored.gear, p.gear);
  // 지닌 병기가 가장 좋아도 다른 병기와 보법이 진열된다
  p.weapon = "운철보검";
  p.learnSkill(new Skill("초상비"));
  for (let i = 0; i < 20; i++) {
    const keys = openMarket(60, p).stock.map((s) => s.key);
    assert.ok(keys.some((k) => DB.market[k].effects.some((e) => e.slot === "weapon" && e.style === "검법")), "주무공 병기");
    assert.ok(keys.some((k) => DB.market[k].effects.some((e) => e.type === "skill" && DB.skills[e.skill].type === "경공")), "보법");
    assert.ok(keys.some((k) => DB.market[k].effects.some((e) => e.slot === "armor")), "호신구");
  }
});

test("물건에 품계가 있고 높은 품계의 병장기에는 묘리가 있다", () => {
  for (const [k, item] of Object.entries(DB.market)) {
    if (item.category === "비급") continue;
    assert.ok(ITEM_GRADES.includes(item.grade), k);
    if (item.effects.some((e) => e.type === "equip") && ["명품", "보물", "신물"].includes(item.grade)) assert.ok(item.gimmick?.text, k);
  }
  const p = new Player();
  p.learnSkill(new Skill("기초검법"));
  p.mainSkill = "기초검법";
  p.equipGear("태아검");
  assert.ok(new Battle(p, new Enemy("낭인", 10)).weaponG.pierce === 40);
  p.mainSkill = null;
  p.skills = [new Skill("육합권")];
  assert.equal(new Battle(p, new Enemy("낭인", 10)).weaponG, null, "주무공과 맞지 않으면 묘리가 쉰다");
});

test("일절의 끝에 이른 무공은 사건으로 신공에 오른다", () => {
  const p = new Player();
  const s = new Skill("태허검결");
  p.learnSkill(s);
  p.mainSkill = "태허검결";
  assert.ok(!checkRequires(p, DB.events.깨달음_공격.requires));
  s.mastery = 100;
  assert.ok(checkRequires(p, DB.events.깨달음_공격.requires));
  applyEffects(p, { ascend: "공격무공" });
  assert.equal(p.getSkill("태허검결").grade, "신공");
  const again = Player.fromDict(JSON.parse(JSON.stringify(p.toDict())));
  assert.equal(again.getSkill("태허검결").grade, "신공", "저장해도 그대로다");
});

test("출신의 이야기는 결전 전에 모두 찾아오고 조건을 못 채우면 나오지 않는다", () => {
  const p = new Player("표국표사");
  p.content = ["표기재건"];
  p.turn = 118;
  p.realm = "현경";
  const keys = pendingOriginEvents(p);
  assert.ok(keys.includes("표기_열셋"), "켜 둔 인연");
  assert.ok(!keys.includes("표기_창"), "앞 편을 못 만나면 뒷 편은 나오지 않는다");
  assert.ok(dueOriginEvent(p), "마지막 달에는 반드시 연다");
  // 조건을 채우면 확정으로 찾아오되, 지난 이야기에서 몇 달 띄운다
  p.turn = 50;
  p.originTurn = 48;
  assert.equal(dueOriginEvent(p), null);
  p.turn = 52;
  assert.ok(dueOriginEvent(p));
  p.seenEvents = [];
  p.content = [];
  p.turn = 118;
  assert.ok(!pendingOriginEvents(p).includes("표기_열셋"), "켜지 않은 인연");
});

test("생사경 결말에서는 네 기량이 1000으로 나온다", () => {
  const game = newGame();
  const p = game.player;
  for (const stat of ["external", "internal", "martial", "mind"]) p[stat] = 999;
  p.battles = 100;
  game.finishGame(true, "생사경");
  assert.deepEqual([p.external, p.internal, p.martial, p.mind], [1000, 1000, 1000, 1000]);
});

test("심법과 보법의 성취가 함께 오른다", () => {
  const game = newGame();
  const p = game.player;
  p.learnSkill(new Skill("초상비"));
  const steps = p.bestOfType("경공");
  const mind = p.bestOfType("심공");
  const [a, b] = [steps.mastery, mind.mastery];
  game.pendingNext = false;
  game.event = null;
  game.action("수련");
  assert.ok(steps.mastery > a);
  game.pendingNext = false;
  game.battle = null;
  game.action("명상");
  assert.ok(mind.mastery >= b + 3);
});

test("절정 이상의 적은 이름이나 부대의 이름을 갖고 약한 세가 패거리는 없다", () => {
  for (const [k, e] of Object.entries(DB.enemies)) {
    if (DB.realms.enemy_order.indexOf(e.realm) >= DB.realms.enemy_order.indexOf("절정")) assert.ok(!/^(절정의|소림 나한승|세가의|동창의|살막의)/.test(e.name), k);
    if (e.realm === "이류") assert.ok(!/오대세가|구파/.test(e.name), k);
  }
  assert.equal(DB.enemies.왕지네.name.startsWith("묵은"), false);
});

test("호칭은 성별과 이름을 따르고 받침에 맞는 조사를 쓴다", () => {
  const he = { gender: "남", surname: "남궁", given: "무진" };
  const she = { gender: "여", surname: "팽", given: "서린" };
  assert.equal(fullName(he), "남궁 무진");
  assert.equal(fullName(she), "팽서린");
  assert.equal(personalize("〈성대협〉, 드시오", he), "남궁 대협, 드시오");
  assert.equal(personalize("〈성대협〉, 드시오", she), "팽 여협, 드시오");
  assert.equal(personalize("〈넷째형:은/는〉 왼발", he), "넷째 형은 왼발");
  assert.equal(personalize("〈넷째형:은/는〉 왼발", she), "넷째 오라버니는 왼발");
  assert.equal(personalize("〈이름:아/야〉", he), "무진아");
  assert.equal(personalize("〈이름:아/야〉", she), "서린아");
  assert.equal(personalize("〈네놈〉", she), "네년");
  // 이름을 모르는 예전 저장
  assert.equal(personalize("〈성명〉 〈대협〉", null), "무명 대협");
});

test("데이터의 자리표시는 모두 뜻이 있다", () => {
  const leftovers = new Set(["별호", "별호들", "유산", "이름", "기", "강", "기상인"]);
  const person = { gender: "여", surname: "위", given: "서린" };
  const walk = (value) => {
    if (typeof value === "string") {
      for (const m of personalize(value, person).matchAll(/〈([^〉]*)〉/g)) assert.ok(leftovers.has(m[1]), `${m[0]}: ${value}`);
    } else if (value && typeof value === "object") Object.values(value).forEach(walk);
  };
  Object.values(DB).forEach(walk);
});

test("가문의 성씨는 고정이고 비운 칸은 저절로 채운다", () => {
  assert.equal(settlePerson("남궁세가", { surname: "김", given: "철수" }).surname, "남궁");
  assert.equal(settlePerson("하북팽가", { gender: "여", given: "서린" }).surname, "팽");
  const free = settlePerson("무림초출", { gender: "여", surname: "연<b>", given: "" });
  assert.equal(free.surname, "연b");
  assert.ok(DB.flavor.names.female.includes(free.given));
  const male = settlePerson("표국표사", {});
  assert.equal(male.gender, "남");
  assert.ok(male.surname && male.given);
});

test("시작할 때 정한 성별과 이름이 저장을 거쳐 남고 성별 조건을 따른다", () => {
  const game = new Game();
  game.start("무림초출", [], [], { gender: "여", surname: "김", given: "서린" });
  const p = game.player;
  assert.deepEqual(p.person, { gender: "여", surname: "김", given: "서린" });
  const again = Player.fromDict(p.toDict());
  assert.equal(again.person.given, "서린");
  assert.equal(checkRequires(p, { gender: "여" }), true);
  assert.equal(checkRequires(p, { gender: "남" }), false);
  assert.equal(eventView(p, "비무초친").text.includes("여인"), true);
});

test("명성이 낮을 때 성향을 아는 듯한 반응을 붙이지 않고 무명 푸념 말투를 쓰지 않는다", () => {
  for (const table of ["month", "victory", "market"]) assert.equal(DB.flavor.talk[table].무명, undefined);
  for (const [key, e] of Object.entries(DB.events)) {
    for (const r of e.reacts ?? []) {
      if (r.requires?.dominant || r.requires?.dominant_in) assert.ok(r.requires.min_fame >= 50, `${key}: ${r.text}`);
    }
  }
});

test("사도와 마도 선택지가 정도에 크게 뒤지지 않는다", () => {
  const count = { 정도: 0, 사도: 0, 마도: 0 };
  const walk = (o) => {
    if (!o || typeof o !== "object") return;
    if (o.alignment) for (const side of Object.keys(count)) if (o.alignment[side] > 0) count[side] += 1;
    Object.values(o).forEach(walk);
  };
  walk(DB.events);
  walk(DB.chains);
  assert.ok(count.사도 >= count.정도 * 0.85, JSON.stringify(count));
  assert.ok(count.마도 >= count.정도 * 0.85, JSON.stringify(count));
});

test("사문이 있으면 2장 술자리의 본문과 선택지가 그 세력에 맞는다", () => {
  const game = newGame();
  const p = game.player;
  p.fame = 100;
  p.sect = "소림";
  const view = eventView(p, "2장_세력");
  assert.ok(view.text.includes("무림맹"));
  assert.ok(!view.text.includes("세 사람"));
  const labels = view.choices.map((c) => c.label);
  assert.ok(labels.includes("무림맹의 잔을 받는다"));
  assert.ok(labels.includes("잔을 사양하고 술값을 낸다"));
  assert.ok(!labels.some((l) => l.includes("셋 다") || l.includes("사도련") || l.includes("붉은 옷")));
  p.sect = null;
  const free = eventView(p, "2장_세력").choices.map((c) => c.label);
  assert.ok(free.includes("셋 다 거절하고 술값을 낸다"));
  assert.ok(!free.includes("잔을 사양하고 술값을 낸다"));
});

test("설정을 처음으로 돌리면 기틀은 산 단계를 모두 쓰고 인연은 모두 켠다", () => {
  const data = loadMeta();
  data.upgrades = { 그릇: 2 };
  data.upgrade_use = { 그릇: 0 };
  data.content = Object.keys(DB.karma.content).slice(0, 2);
  data.content_off = [...data.content];
  saveMeta(data);
  resetSetupChoices();
  const after = loadMeta();
  assert.equal(upgradeUse("그릇", after), 2);
  assert.deepEqual(after.content_off, []);
});

test("새 묘리: 방어 깎기, 겹치는 칼자국, 장단", () => {
  seed(4);
  const game = newGame();
  const p = game.player;
  p.learnSkill(new Skill("패왕창법"));
  const spear = p.getSkill("패왕창법");
  spear.grade = "상승";
  const b = new Battle(p, new Enemy("낭인"));
  b.enemy.armor = 50;
  b.enemy.hp = b.enemy.maxHp = 99999;
  for (let i = 0; i < 6; i++) b.strike(100, "시험", spear);
  assert.equal(b.shred, 40, "방어는 4할까지만 깎인다");
  const blade = new Skill("칠성도법"); blade.grade = "상승";
  b.strike(1000, "시험", blade);
  b.strike(1000, "시험", blade);
  assert.ok(b.bleed && b.bleed.damage <= Math.trunc(b.enemy.maxHp * 0.06));
  const fist = new Skill("구궁권"); fist.grade = "상승";
  p.skills.push(fist);
  p.qi = 9999;
  b.beats = 0;
  b.useSkill(fist); b.useSkill(fist); b.useSkill(fist);
  assert.ok(b.log.some((l) => l.includes("초식이 맺혔다")));
  assert.equal(DB.realms.movement_tiers.상승[0], "답설무흔");
  assert.ok(!Object.values(DB.skills).some((s) => ["초상비", "등평도수", "답설무흔", "능공허도", "이형환위"].includes(s.name)), "경공의 경지는 무공 이름이 아니다");
});

test("한 사건 안에서 여러 번 고르고, 사도의 동맹은 이름이 높으면 맹주를 직접 만난다", () => {
  const game = newGame();
  const p = game.player;
  p.alignment.사도 = 400;
  p.fame = 450;
  game.event = { key: "사도_임시동맹", forced: false };
  const meet = eventView(p, "사도_임시동맹").choices.findIndex((c) => c.label === "맹주를 만나러 간다");
  assert.ok(meet >= 0);
  game.chooseEvent(meet);
  assert.equal(game.event.key, "사도_임시동맹:대면");
  const join = eventView(p, "사도_임시동맹:대면").choices.findIndex((c) => c.label === "사파의 이름으로 동맹에 선다");
  const before = p.alignment.정도;
  game.chooseEvent(join);
  assert.ok(p.hasFlag("정사동맹_대표") && p.alignment.정도 > before);
  assert.ok(!checkRequires(p, DB.events.사도_임시동맹.requires), "한 번 정한 동맹은 다시 오지 않는다");
  const low = new Player();
  low.alignment.사도 = 400;
  low.fame = 160;
  assert.ok(!eventView(low, "사도_임시동맹").choices.some((c) => c.label === "맹주를 만나러 간다"));
});

test("지는 것이 정해진 일도 경지에 따라 모습이 다르고, 달빛 아래의 여인은 결전의 동료가 된다", () => {
  const p = new Player();
  p.realm = "현경";
  const game = newGame();
  game.player = p;
  game.event = { key: "기인_첫판", forced: false };
  const i = eventView(p, "기인_첫판").choices.findIndex((c) => c.label === "바둑돌을 잡는다");
  game.chooseEvent(i);
  assert.ok(game.log.some((l) => l.includes("이 판은 자네가 이겼네")));
  assert.ok(DB.companions.은비_약조);
  assert.ok(DB.events["은호의저녁:약조"].choices.some((c) => c.outcomes[0].effects.flags?.includes("은비_약조")));
  assert.ok(!DB.enemies.은호.desc.includes("늙은"));
  assert.ok(!DB.events_story["5장_결전"].text.includes("머리맡"), "천마가 몰래 다녀가지 않는다");
});

test("같은 계열의 명품 이상 무공은 묘리의 짜임이 겹치지 않는다", () => {
  const seen = new Map();
  for (const [key, s] of Object.entries(DB.skills)) {
    if (!s.gimmick || !["명품", "상승", "일절", "신공"].includes(s.grade)) continue;
    const sig = `${s.category || s.type}:${Object.keys(s.gimmick).filter((k) => k !== "name" && k !== "text").sort().join(",")}`;
    assert.ok(!seen.has(sig), `${key}와 ${seen.get(sig)}의 묘리가 같다`);
    seen.set(sig, key);
  }
});

test("유산으로 귀한 물건도 남기고, 출신마다 결전의 조력이 하나씩 있다", () => {
  const game = newGame();
  game.player.addItem("설삼");
  game.finishGame(true, "기본");
  assert.ok(game.legacyOptions().some((o) => o.kind === "item" && o.key === "설삼"));
  const allyFlags = DB.enemies.천마.phases[0].interlude.allies.map((a) => a.requires.flag).filter(Boolean);
  for (const flag of ["창궁_깃발", "조카_합류", "표사_옛동료", "분타_합류", "권마_그림자", "삼백_비석", "소문_매복", "초출_벗"]) assert.ok(allyFlags.includes(flag), flag);
  assert.ok(DB.events.백록의길 && DB.events.해치의눈);
  assert.ok(!DB.enemies.궁기 && DB.enemies.불가사리);
});

test("천마는 한 사람이고 맹주 사건은 맹주의 아들 이야기 중에 나오지 않는다", () => {
  const p = new Player();
  assert.equal(checkRequires(p, { not_chain: "맹주의아들" }), true);
  p.chains.push({ id: "맹주의아들", step: 0 });
  assert.equal(checkRequires(p, { not_chain: "맹주의아들" }), false);
  assert.equal(DB.events.무림맹회의.requires.not_chain, "맹주의아들");
  const all = JSON.stringify([DB.events, DB.enemies, DB.karma, DB.companions]);
  assert.ok(!all.includes("첫 천마") && !all.includes("전대 천마"));
  assert.ok(!DB.companions.은비 && DB.companions.설백);
});

test("십이마장 열두 자리와 천마의 일지가 모두 채워져 있다", () => {
  const text = JSON.stringify([DB.enemies, DB.events]);
  const seats = [...text.matchAll(/제([일이삼사오육칠팔구십]{1,3})마장 /g)].map((m) => m[1]);
  assert.equal(new Set(seats).size, 12);
  assert.ok(DB.enemies.천마.intros.some((i) => i.requires.flag === "천마_일지"));
  assert.ok(DB.enemies.천마.outros.some((i) => i.requires.flag === "천마_일지"));
  for (const sect of ["소림", "무당", "화산", "아미", "곤륜", "종남", "점창", "청성", "공동", "개방"]) assert.ok(DB.events[`문파대사_${sect}`], sect);
});

test("개방 방주의 생사는 출신과 상관없이 같다", () => {
  assert.ok(!DB.events.문파대사_개방.requires);
  assert.ok(!DB.events.개방_비전.text.startsWith("방주가"));
  assert.ok(DB.sects.개방.desc.includes("쓰러진 뒤"));
});

test("유산은 천마를 쓰러뜨린 강호행에서만 남긴다", () => {
  withKarma(100, { endings_seen: ["기본"], legacy_open: true });
  const g = new Game();
  g.start("무림초출");
  g.player.learnSkill(Skill.fromDict({ key: "양가창법", grade: "일절", mastery: 80 }));
  g.finishGame(false);
  assert.equal(g.legacyOptions().length, 0);
  assert.ok(!g.leaveLegacy(0));
  withKarma(0);
});

test("새 묘리: 표식, 여운, 회심의 호신, 잔상, 기세, 늘 흐르는 심법", () => {
  seed(9);
  const p = new Player("무림초출");
  p.qi = 9999;
  const dart = new Skill("만리추혼"); dart.grade = "일절";
  const b = new Battle(p, new Enemy("낭인"));
  b.enemy.evasion = -9;
  b.enemy.hp = b.enemy.maxHp = 999999;
  for (let i = 0; i < 3; i++) b.strike(100, "시험", dart);
  assert.ok(b.log.some((l) => l.includes("표식이 터졌다")));
  const plum = new Skill("매화검법"); plum.grade = "상승";
  for (let i = 0; i < 20; i++) b.strike(100, "시험", plum);
  assert.ok(b.log.some((l) => l.includes("남은 여운")));
  const palm = new Skill("대력금강장"); palm.grade = "상승";
  b.forceCrit = true;
  b.strike(1000, "시험", palm);
  assert.ok(b.ward > 0 && b.ward <= p.maxHp() * 0.4);
  // 잔상과 기세
  const step = new Skill("제운종"); step.grade = "상승";
  b.afterEvade(step, step.activeGimmick());
  b.afterEvade(step, step.activeGimmick());
  b.afterEvade(step, step.activeGimmick());
  b.afterEvade(step, step.activeGimmick());
  assert.equal(b.momentum, 30, "기세는 3할까지");
  // 늘 흐르는 심법: 숨이 트이는 것은 한 번뿐이다
  const q = new Player("무림초출");
  const breath = new Skill("달마심공");
  q.skills.push(breath);
  q.chosenArts.심공 = "달마심공";
  const c = new Battle(q, new Enemy("낭인"));
  c.roundNum = 1;
  q.hp = Math.floor(q.maxHp() * 0.2);
  c.enemy.attack = 1;
  c.enemyAttack();
  const after = q.hp;
  assert.ok(c.secondWind && after > Math.floor(q.maxHp() * 0.2));
  q.hp = Math.floor(q.maxHp() * 0.2);
  c.enemyAttack();
  assert.ok(q.hp <= Math.floor(q.maxHp() * 0.2));
});

test("무엇을 겹쳐도 무적이 되지 않는다", () => {
  const p = new Player("무림초출");
  p.mind = 999;
  p.realm = "현경";
  p.traits.push(...Object.keys(DB.traits).filter((k) => DB.traits[k].effects?.some((e) => ["damage_reduce", "aura_guard"].includes(e.type))));
  p.armor = "금강불괴갑";
  const mind = new Skill("달마심공");
  p.skills.push(mind);
  p.chosenArts.심공 = "달마심공";
  const b = new Battle(p, new Enemy("천마"), true);
  b.guard = { percent: 90, rounds: 9 };
  b.enemyWeaken = { percent: 90, rounds: 9 };
  p.hp = 1;
  const full = b.enemy.attack * b.enemy.attackMultiplier();
  assert.ok(b.incoming() >= Math.ceil(full * 0.1), "맞는 힘의 1할은 닿는다");
  // 저절로 피하는 것에도 끝이 있다
  const steps = new Skill("이형환위");
  p.skills.push(steps);
  p.chosenArts.경공 = "이형환위";
  p.armor = "운룡보의";
  const c = new Battle(p, new Enemy("낭인"));
  c.afterimage = 99;
  c.roundNum = 1;
  p.hp = p.maxHp();
  let dodged = 0;
  for (let i = 0; i < 400; i++) {
    c.afterimage = 99;
    c.log = [];
    c.enemyAttack();
    if (c.log.some((l) => l.includes("저절로"))) dodged += 1;
    p.hp = p.maxHp();
  }
  assert.ok(dodged < 400 * 0.6, String(dodged));
  for (const s of Object.values(DB.skills)) if (s.type === "경공") assert.ok(s.effect.evade <= 92, s.name);
});

test("씨름판은 경지와 기량에 따라 결과가 다르고, 곤륜의 호흡은 심법 성취를 쌓은 채로 시작한다", () => {
  const p = new Player("무림초출");
  p.realm = "초절정";
  for (let i = 0; i < 20; i++) {
    const r = resolveChoice(p, "철권씨름", 0);
    assert.ok(r.text.includes("무릎이 먼저 꺾였다"), r.text);
    p.seenEvents = [];
  }
  const weak = new Player("무림초출");
  weak.external = 100;
  const texts = new Set();
  for (let i = 0; i < 40; i++) texts.add(resolveChoice(weak, "철권씨름", 0).text);
  assert.ok([...texts].some((t) => t.includes("하늘이 돌았다")));
  const base = new Player("하북팽가");
  const breath = new Player("하북팽가", ["현기의호흡"]);
  grantStartGear(base);
  grantStartGear(breath);
  assert.equal(breath.skills.length, base.skills.length, "심법을 따로 주지 않는다");
  assert.equal(breath.bestOfType("심공").mastery, Math.min(100, base.bestOfType("심공").mastery + 40));
  withKarma(0);
});

test("영약을 쓰면 심법 성취가 오른다", () => {
  const p = new Player("무림초출");
  const mind = p.bestOfType("심공");
  const before = mind.mastery;
  p.addItem("소환단");
  useConsumable(p, "소환단");
  assert.ok(mind.mastery > before);
});

test("달이 사건으로 바로 열려도 경지에 오른 소식이 보인다", () => {
  const game = newGame();
  const p = game.player;
  for (const s of ["external", "internal", "martial", "mind"]) p[s] = 700;
  p.battles = 99;
  p.turn = 24;
  game.event = null;
  game.startNextTurn();
  assert.ok(game.event, "줄거리 사건이 열린다");
  assert.ok(game.notice?.some((l) => l.includes("경지 돌파")), JSON.stringify(game.notice));
  game.chooseEvent(0);
  assert.equal(game.notice, null);
});

test("세가의 무인에게 사문으로서 하는 선택지가 보이지 않는다", () => {
  const p = new Player("남궁세가");
  assert.ok(DB.sects[p.sect]?.house);
  const view = eventView(p, "사형제싸움");
  assert.ok(view.choices.every((c) => !c.label.includes("사문")), JSON.stringify(view.choices.map((c) => c.label)));
  // 사문을 내세우는 선택지는 모두 세가를 뺀다
  for (const [key, e] of Object.entries(DB.events)) {
    for (const v of e.variants || []) {
      for (const c of v.choices || []) {
        if (/사문/.test(c.label) && v.requires?.has_sect) assert.ok(v.requires.no_house, key);
      }
    }
  }
});

test("강호초출은 사부의 마지막 가르침 인연으로 출신 신공 셋을 얻고, 공격 무공은 내 병기에 맞춘다", () => {
  const p = new Player("무림초출");
  p.skills = p.skills.filter((s) => s.type !== "공격무공");
  p.learnSkill(Skill.fromDict({ key: "기초창법", grade: "기본", mastery: 0 }));
  applyEffects(p, { style_skill: { grade: "신공", origin: "무림초출" } });
  assert.ok(p.hasSkill("무명창결"), p.skills.map((s) => s.key).join(","));
  for (const k of ["초출_심법", "초출_보법", "초출_비급"]) assert.equal(DB.events[k].requires.unlocked, "사부의유산");
  assert.ok(JSON.stringify(DB.events.초출_심법).includes("무명청허공"));
  assert.ok(JSON.stringify(DB.events.초출_보법).includes("무명행운보"));
});
