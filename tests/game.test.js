import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { seed } from "./helpers.js";
import { listAssets } from "../tools/build_asset_list.js";
import { Battle, Enemy } from "../www/js/battle.js";
import { Player, Skill } from "../www/js/character.js";
import { DB } from "../www/js/data.js";
import { applyEffects, checkRequires, eventView, pickRandomEvent, validateEvents } from "../www/js/events.js";
import { Game } from "../www/js/game.js";
import { blockReason, buy, openMarket, priceOf } from "../www/js/market.js";
import {
  exportRecords, importRecords, loadCheckpoint, loadMeta, saveMeta, unlockOrigin,
} from "../www/js/meta.js";
import { applyGrowth, breakthroughBlock, byname, fameRank, getChapter, getYear, marketTurns, traitSlots } from "../www/js/rules.js";
import { storage } from "../www/js/storage.js";

function newGame(origin = "무림초출") {
  const game = new Game();
  game.start(origin);
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
  const prologues = new Set(stories.filter((e) => e.turn === 1).map((e) => e.requires.origin));
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

test("능력치 상한은 99", () => {
  const p = new Player();
  p.external = 98;
  assert.equal(p.gainStat("external", 5), 1);
  assert.equal(p.external, 99);
});

test("출신 해금 비용은 무림초출 0, 나머지 5", () => {
  for (const [key, o] of Object.entries(DB.origins.origins)) assert.equal(o.cost, key === "무림초출" ? 0 : 5);
});

test("턴은 다음 버튼으로만 넘어간다", () => {
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

test("도감은 다음 턴 시작에 기록된다", () => {
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
  assert.ok(gains.every((g) => g >= 0 && g <= 2));
});

// ---------- 전투 ----------

test("무공 진화와 비기 해방", () => {
  const skill = new Skill("기초검법");
  const multiplier = skill.effectiveMultiplier();
  const messages = skill.gainMastery(100);
  assert.equal(skill.grade, "명품");
  assert.equal(skill.mastery, 30);
  assert.ok(messages.some((m) => m.includes("진화")));
  assert.ok(skill.effectiveMultiplier() > multiplier);
  assert.ok(skill.gainMastery(20).some((m) => m.includes("해방")));
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
  assert.ok(battle.log.some((l) => l.includes("기력이 모자라")));
});

test("심법은 회복하고 점혈을 푼다", () => {
  const p = new Player("곤륜파");
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

test("필살기는 직전 라운드에 예고된다", () => {
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
  assert.equal(p.external, base + 5);
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

test("적 중독은 라운드마다 피해를 준다", () => {
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

test("25턴 줄거리는 행동을 쓰지 않고 고를 때까지 막는다", () => {
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

test("무작위 사건은 회차당 한 번", () => {
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

test("단목휘와 동맹이면 천마 체력이 줄어든다", () => {
  const game = newGame();
  toTurnEnd(game, 119);
  game.player.addFlag("단목휘_동맹");
  game.advanceTurn();
  game.marketLeave();
  game.chooseEvent(0);
  assert.equal(game.battle.enemy.maxHp, Math.trunc(DB.enemies.천마.hp * 0.85));
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
  assert.equal(new Player("곤륜파").sect, "곤륜");
});

test("비무대회는 세 번 싸우고 보상을 준다", () => {
  const game = newGame();
  const p = game.player;
  Object.assign(p, { external: 95, martial: 95, internal: 95, mind: 95, hp: 575, qi: 575 });
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

test("실전 경험만 모자라면 알려 준다", () => {
  const p = new Player();
  p.external = p.internal = p.martial = p.mind = 40;
  assert.ok(breakthroughBlock(p).includes("실전"));
  p.battles = 8;
  assert.equal(breakthroughBlock(p), null);
});

// ---------- 시장 ----------

test("시장은 턴을 쓰지 않고 소비품은 가방에 들어간다", () => {
  const game = newGame();
  const p = game.player;
  Object.assign(p, { turn: 12, silver: 200, hp: 50 });
  game.action("수련");
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
    assert.ok(keys.includes("철검") && keys.includes("가죽호구"));
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

test("비기를 해방한 주무공은 자동으로 바뀌지 않는다", () => {
  const p = new Player();
  const current = p.bestSkill();
  current.secretUnlocked = true;
  const messages = p.learnSkill(new Skill("태허검결"));
  assert.equal(p.mainSkill, current.key);
  assert.ok(messages.some((m) => m.includes("주무공")));
});

// ---------- 저장 ----------

test("저장은 턴 시작 지점으로 복구된다", () => {
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

test("120턴에서 복구하면 천마봉 선택부터", () => {
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
  assert.equal(game.event.key, "서장_무림초출");
  const fresh = new Game();
  fresh.continueFromSave();
  assert.equal(fresh.event.key, "서장_무림초출");
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
  assert.ok(importRecords(JSON.stringify({ current_karma: 3, total_karma: 9, unlocked_origins: ["무림초출", "곤륜파"], unlocked_traits: [] })));
  const data = loadMeta();
  assert.equal(data.total_karma, 9);
  assert.deepEqual(data.runs, []);
  assert.ok(data.unlocked_origins.includes("곤륜파"));
});

test("엉뚱한 파일은 거절한다", () => {
  assert.ok(!importRecords("안녕"));
  assert.ok(!importRecords(JSON.stringify({ a: 1 })));
});

// ---------- 메타 ----------

test("특성 슬롯은 누적 카르마로 늘어난다", () => {
  assert.deepEqual([0, 19, 20, 49, 50].map(traitSlots), [1, 1, 2, 2, 3]);
});

test("잠긴 출신과 슬롯을 넘는 특성은 막힌다", () => {
  const data = loadMeta();
  data.unlocked_traits = ["금전운", "철옹성"];
  saveMeta(data);
  const game = new Game();
  assert.equal(game.start("권마계승"), false);
  assert.equal(game.player, null);
  game.start("무림초출", ["금전운", "철옹성", "전투광"]);
  assert.deepEqual(game.player.traits, ["금전운"]);
});

test("카르마로 해금하면 차감된다", () => {
  const data = loadMeta();
  data.current_karma = 5;
  saveMeta(data);
  assert.ok(unlockOrigin("곤륜파", 5));
  assert.equal(loadMeta().current_karma, 0);
  assert.ok(!unlockOrigin("하오문", 5));
});

// ---------- 시간과 난이도 ----------

test("게임은 120턴, 10년이다", () => {
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

test("60턴 시절의 저장은 시간표를 늘려 이어 간다", () => {
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
  for (let i = 0; i < 1000; i++) total += applyGrowth(1, ["무골"], "external");
  assert.ok(total > 1050 && total < 1150, String(total));
});

// ---------- 전체 플레이 ----------

for (const origin of ["무림초출", "남궁세가", "곤륜파", "하오문", "권마계승"]) {
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
          assert.ok(p[stat] >= 1 && p[stat] <= 110, `${stat} ${p[stat]}`);
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
