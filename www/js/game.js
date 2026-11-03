// 한 생의 진행을 맡는 상태 기계. 화면(ui.js)은 이 객체의 상태를 그리고 메서드를 부른다.
import { Battle, enemyPool, Enemy, useConsumable } from "./battle.js";
import { GRADE_ORDER, Player, Skill, STAT_NAMES } from "./character.js";
import { DB } from "./data.js";
import {
  advanceChain, applyEffects, dueChainEvent, enemyIntro, LAST_CHAIN_TURN, pickFortune, pickRandomEvent, resolveChoice,
  startChain, storyEventForTurn,
} from "./events.js";
import { buy, openMarket } from "./market.js";
import {
  activeContent, addKarma, claimAchievements, claimMilestones, clearCheckpoint, extraSlots, loadCheckpoint, loadMeta, recordRun, saveCheckpoint,
  storeLegacy, takeLegacy, updateGlobalCodex, updateKnown, upgradeLevel, upgradeTraits,
} from "./meta.js";
import { pickWeighted, randInt, rng } from "./rng.js";
import {
  actionLine, applyGrowth, breakthroughBlock, byname, CHAPTER_STARTS, checkBreakthrough, checkGoodEnding, checkSaengsa,
  fameRank, getChapter, getChapterInfo, getMonth, getYear, isMarketTurn, monthLine, realmIndex, sumEffect, traitSlots,
} from "./rules.js";

const NATURAL_REGEN = 5;
const EXPLORE_BATTLE = 0.35; // 나머지는 사건과 기연
const EXPLORE_EVENT = 0.45;
const SPARRING_CHANCE = 0.65;
const TRAIN_BONUS_BASE = 0.05;
const TRAIN_MASTERY_RATE = 3;
const INSIGHT_CHANCE = 0.3;
const GAUNTLET_REST = 20;
const LOG_LIMIT = 40;
const VALID_ACTIONS = ["수련", "명상", "탐색", "휴식"];
const VALID_BATTLE_ACTIONS = ["기본공격", "비기", "심법", "경공", "소비품", "도주"];

export class Game {
  constructor() { this.reset(); }

  reset() {
    this.player = null;
    this.log = [];
    this.battle = null;
    this.market = null;
    this.event = null;          // {key, forced}
    this.gauntlet = null;
    this.ending = null;
    this.pendingNext = false;
  }

  get active() { return this.player !== null; }

  get busy() {
    return !!(this.battle || this.market || this.event || this.pendingNext || !this.player?.alive);
  }

  setLog(lines) { this.log = lines.slice(-LOG_LIMIT); }
  addLog(lines) { this.setLog([...this.log, ...lines]); }

  // ---------- 시작과 복구 ----------

  /** 새 생 시작. 잠긴 출신이면 false */
  start(originKey = "무림초출", selectedTraits = [], legacyIndex = null) {
    const meta = loadMeta();
    if (!meta.unlocked_origins.includes(originKey) || !DB.origins.origins[originKey]) return false;
    const traits = [...new Set(selectedTraits)].filter((t) => meta.unlocked_traits.includes(t))
      .slice(0, traitSlots(meta.total_karma) + extraSlots(meta));

    this.reset();
    this.player = new Player(originKey, [...traits, ...upgradeTraits(meta)]);
    this.player.content = activeContent(meta);
    const legacyLines = legacyIndex !== null && meta.legacy_open ? this.inheritLegacy(legacyIndex) : [];
    updateKnown(this.player.skills.map((s) => s.key));
    const intro = getChapterInfo(1);
    this.enterTurn([`📖 ${intro.title} (1년차) — ${intro.desc}`, ...legacyLines]);
    return true;
  }

  /** 보관한 유산을 이어받는다. 한 번 쓰면 사라지고 전성기만은 못하다. */
  inheritLegacy(index) {
    const entry = takeLegacy(index);
    if (!entry) return [];
    const p = this.player;
    let name;
    if (entry.kind === "skill") {
      const skill = Skill.fromDict({ key: entry.key, grade: inheritedGrade(entry.grade), mastery: 0 });
      name = skill.name;
      if (!p.hasSkill(skill.key)) p.learnSkill(skill);
      if (skill.type === "공격무공") p.mainSkill = skill.key;
    } else {
      const key = inheritedGear(entry.key);
      name = DB.market[key].name;
      p[DB.market[key].effects.find((e) => e.type === "equip").slot] = key;
    }
    p.note(`전대 「${entry.from}」의 유산 「${name}」을(를) 이어받았다.`);
    return [`🏺 전대 「${entry.from}」이(가) 남긴 「${name}」을(를) 이어받았다. 세월에 조금 무뎌졌지만 아직 쓸 만하다.`];
  }

  /** 이번 강호행에서 유산으로 남길 수 있는 것들 */
  legacyOptions() {
    const p = this.player;
    const skills = p.skills.filter((s) => GRADE_ORDER.indexOf(s.grade) >= 1)
      .sort((a, b) => GRADE_ORDER.indexOf(b.grade) - GRADE_ORDER.indexOf(a.grade)).slice(0, 4)
      .map((s) => ({ kind: "skill", key: s.key, grade: s.grade, label: `${s.name} (${s.grade} 등급)` }));
    const gear = [p.weapon, p.armor].filter((k) => DB.market[k]?.markets.length)
      .map((k) => ({ kind: "gear", key: k, label: DB.market[k].name }));
    return [...skills, ...gear];
  }

  leaveLegacy(index) {
    if (!this.ending || this.ending.legacyLeft || !loadMeta().legacy_open) return;
    const option = this.legacyOptions()[index];
    if (!option) return;
    storeLegacy({ kind: option.kind, key: option.key, grade: option.grade, label: option.label, from: byname(this.player), origin: this.player.origin });
    this.ending.legacyLeft = option.label;
  }

  /** 새 달 공통 처리: 체크포인트를 저장하고 줄거리 이벤트를 연다. */
  enterTurn(log) {
    this.setLog(log);
    saveCheckpoint(this.player.toDict(), this.log);
    this.openStoryEvent();
  }

  /** 그달의 줄거리와 연계 인카운터를 연다. 천마봉 전에는 남은 연계를 먼저 끝낸다. */
  openStoryEvent() {
    const p = this.player;
    const urgent = p.turn >= LAST_CHAIN_TURN && p.chains.length > 0;
    const story = urgent ? null : storyEventForTurn(p);
    if (story) {
      this.event = { key: story, forced: true };
      return;
    }
    const chainKey = dueChainEvent(p);
    // 연계 한 편은 그달을 쓴다. 다만 마지막 달에 몰리면 달을 쓰지 않는다.
    if (chainKey) this.event = { key: chainKey, forced: urgent };
  }

  /** 저장된 달 시작 지점에서 이어 한다. 없으면 false */
  continueFromSave() {
    const checkpoint = loadCheckpoint();
    if (!checkpoint) return false;
    this.reset();
    this.player = Player.fromDict(checkpoint.player);
    this.setLog(checkpoint.log || []);
    this.openStoryEvent();
    return true;
  }

  restart() {
    this.reset();
    clearCheckpoint();
  }

  // ---------- 행동 ----------

  action(name) {
    if (!this.active || this.busy || !VALID_ACTIONS.includes(name)) return;
    this.setLog([]);
    const p = this.player;
    if (name === "수련") {
      const ext = this.grow("external");
      const mar = this.grow("martial");
      this.addLog([actionLine("수련"), `외공+${ext}, 무리+${mar}`]);
      if (rng.random() < SPARRING_CHANCE) {
        const silver = p.gainSilver(randInt(6, 10) * getChapter(p.turn));
        p.battles += 1;
        this.addLog([`지나던 무인과 대련을 나누고 사례를 받았다. (전투 경험 +1, 은자 +${silver})`]);
      }
      const skill = p.bestSkill();
      if (skill) this.addLog(skill.gainMastery(p.masteryGainAmount() * TRAIN_MASTERY_RATE));
    } else if (name === "명상") {
      const internal = this.grow("internal");
      const mind = this.grow("mind");
      const [, qi] = p.healPercent(0, 15);
      this.addLog([actionLine("명상"), `내공+${internal}, 심경+${mind}, 기력+${qi}`]);
      const skill = p.bestOfType("심공");
      if (skill) this.addLog(skill.gainMastery(p.masteryGainAmount()));
      // 고요한 중에 깨달음이 오면 주무공도 함께 깊어진다
      if (rng.random() < INSIGHT_CHANCE && p.bestSkill()) {
        this.addLog(["문득 초식의 군더더기가 보였다.", ...p.bestSkill().gainMastery(p.masteryGainAmount() * TRAIN_MASTERY_RATE)]);
      }
    } else if (name === "휴식") {
      const rate = 1 + sumEffect(p.traits, "heal_rate", "percent") / 100;
      const [hp, qi] = p.healPercent(35 * rate, 45 * rate);
      let result = `체력+${hp}, 기력+${qi}`;
      if (p.injury) {
        p.addInjury(-1);
        result += `, 내상 ${p.injury ? `${p.injury}단계로 호전` : "완치"}`;
      }
      this.addLog([actionLine("휴식"), result]);
    } else {
      this.explore();
    }
    if (!this.battle && !this.event) this.pendingNext = true;
  }

  grow(stat) {
    const p = this.player;
    let amount = 1;
    if (rng.random() < TRAIN_BONUS_BASE + p.mind / 500) amount += 1; // 심경이 높으면 2 오를 때가 많아진다
    return p.gainStat(stat, applyGrowth(amount, p.traits, stat));
  }

  explore() {
    const roll = rng.random();
    const bonus = sumEffect(this.player.traits, "fortune_rate", "percent") / 100;
    if (roll < bonus) return this.fortune();
    if (roll < EXPLORE_BATTLE + bonus) return this.startBattle(this.pickEnemy());
    if (roll < EXPLORE_BATTLE + EXPLORE_EVENT) {
      const key = pickRandomEvent(this.player);
      if (key) {
        this.event = { key, forced: false };
        return undefined;
      }
    }
    return this.fortune();
  }

  fortune() {
    const p = this.player;
    const fortune = pickFortune(p);
    const summary = applyEffects(p, fortune.effects);
    const silver = p.gainSilver(randInt(6, 12) * getChapter(p.turn));
    this.addLog([`기연! ${fortune.text}`, [...summary, `은자+${silver}`].join(", ")]);
  }

  pickEnemy() {
    let pool = enemyPool(getChapter(this.player.turn));
    if (realmIndex(this.player.realm) < realmIndex("초절정")) {
      const easier = pool.filter((k) => DB.enemies[k].tier !== "강적");
      if (easier.length) pool = easier;
    }
    return pickWeighted(pool, pool.map((k) => DB.enemies[k].weight));
  }

  startBattle(key) {
    const enemy = new Enemy(key, this.player.turn);
    this.player.recordEnemyEncounter(key);
    this.battle = new Battle(this.player, enemy);
    const intro = enemyIntro(this.player, key);
    this.addLog([`⚔️ ${enemy.name}과(와) 마주쳤다!`, ...(intro ? [intro] : []), ...this.battle.log]);
    this.battle.log = [];
  }

  startFinalBattle() {
    const p = this.player;
    const enemy = new Enemy("천마");
    let weaken = p.bossWeaken;
    if (p.hasFlag("단목휘_동맹")) {
      weaken += 15;
      this.addLog(["🗡️ 뒤에서 익숙한 웃음소리가 들렸다. \"다리 값 받으러 왔소.\" 단목휘의 검이 천마의 옆구리를 스쳤다!"]);
    }
    if (weaken) {
      const percent = Math.min(weaken, 60);
      enemy.maxHp = Math.trunc(enemy.maxHp * (100 - percent) / 100);
      enemy.hp = enemy.maxHp;
      this.addLog([`천마의 기세가 꺾인 채 싸움이 시작된다. (체력 ${percent}% 감소)`]);
    }
    p.recordEnemyEncounter("천마");
    this.battle = new Battle(p, enemy, true);
    const intro = enemyIntro(p, "천마");
    this.addLog(["⚡ 강호행의 마지막 결전이 시작된다.", ...(intro ? [intro] : []), ...this.battle.log]);
    this.battle.log = [];
  }

  // ---------- 이벤트 ----------

  chooseEvent(index) {
    if (!this.event) return;
    const state = this.event;
    const result = resolveChoice(this.player, state.key, index);
    if (!result) return;

    const lines = [`「${DB.events[state.key].title}」`, result.text];
    if (DB.events[state.key].kind === "story") this.player.note(`${DB.events[state.key].title}: ${result.label}`);
    if (result.summary.length) lines.push(result.summary.join(", "));
    this.setLog(state.forced ? [...this.log, ...lines] : lines);
    this.event = null;

    const { effects } = result;
    const { chain } = DB.events[state.key];
    if (chain) {
      if (effects.chain_start) startChain(this.player, chain.id);
      else if (chain.index > 0) advanceChain(this.player, chain.id, !!effects.chain_abandon);
    }
    if (effects.ending) {
      this.finishGame(true, effects.ending);
      return;
    }
    if (effects.final_battle) {
      this.startFinalBattle();
    } else if (effects.battle) {
      this.startBattle(effects.battle);
    } else if (effects.gauntlet) {
      const { enemies, reward, name } = effects.gauntlet;
      this.gauntlet = { name, enemies: enemies.slice(1), reward, round: 1, total: enemies.length };
      this.startBattle(enemies[0]);
    }
    if (this.battle) return;
    // 달을 쓰지 않는 사건 뒤에는 그달의 다음 사건으로 바로 이어진다
    if (state.forced) this.openStoryEvent();
    else if (this.chainsMustFinish()) this.openStoryEvent();
    else this.pendingNext = true;
  }

  // ---------- 전투 ----------

  battleAction(action = "기본공격", itemKey = null) {
    if (!this.battle || !VALID_BATTLE_ACTIONS.includes(action)) return;
    const { battle, player } = this;
    if (action === "도주" && battle.isFinal) return;

    const result = battle.runRound(action, player.bestSkill(), itemKey);
    this.addLog(battle.log);
    battle.log = [];
    if (!result) return;

    this.battle = null;
    if (result.victory && this.gauntlet && !battle.isFinal) {
      if (this.continueGauntlet()) return;
    } else {
      this.gauntlet = null;
    }

    if (result.victory && ["강적", "보스"].includes(battle.enemy.tier)) player.note(`${battle.enemy.name}을(를) 쓰러뜨렸다.`);
    if (!result.victory && !result.fled) player.note(`${battle.enemy.name}에게 쓰러졌다.`);
    if (result.victory) this.addLog([`승리! (전투 경험 +${result.exp})`]);
    else if (result.fled) this.addLog(["가까스로 전장을 벗어났다."]);
    else this.addLog(["패배..."]);

    if (battle.isFinal || player.hp <= 0) this.finishGame(result.victory);
    else if (this.chainsMustFinish()) this.openStoryEvent();
    else this.pendingNext = true;
  }

  /** 천마봉 앞에서 끝나지 않은 연계가 남아 있으면 달을 넘기지 않는다. */
  chainsMustFinish() {
    return this.player.turn >= LAST_CHAIN_TURN && this.player.chains.length > 0;
  }

  continueGauntlet() {
    const { gauntlet, player } = this;
    if (gauntlet.enemies.length) {
      const next = gauntlet.enemies.shift();
      gauntlet.round += 1;
      player.healPercent(GAUNTLET_REST, GAUNTLET_REST);
      this.addLog([`잠시 숨을 고른다. (${gauntlet.name} ${gauntlet.round}/${gauntlet.total}전)`]);
      this.startBattle(next);
      return true;
    }
    const summary = applyEffects(player, gauntlet.reward);
    player.note(`${gauntlet.name}을(를) 제패했다.`);
    this.addLog([`🏆 ${gauntlet.name}을(를) 제패했다! 강호가 그 이름을 외친다.`, summary.join(", ")]);
    this.gauntlet = null;
    return false;
  }

  useItem(key) {
    if (DB.market[key]?.battle_only) return;
    if (!this.active || this.battle || !this.player.alive) return;
    if (DB.market[key] && this.player.inventory[key] > 0) useConsumable(this.player, key);
  }

  setMainSkill(key) {
    if (!this.active || this.battle) return;
    const skill = this.player.getSkill(key);
    if (skill?.type === "공격무공") this.player.mainSkill = key;
  }

  // ---------- 달 넘김과 시장 ----------

  advanceTurn() {
    if (!this.active || !this.pendingNext || this.market) return;
    if (isMarketTurn(this.player.turn)) {
      this.market = openMarket(this.player.turn, this.player);
      return;
    }
    this.startNextTurn();
  }

  startNextTurn() {
    const p = this.player;
    const lines = [...this.commitCodex(), ...this.checkRealm()];
    p.turn += 1;
    const hp = NATURAL_REGEN + sumEffect(p.traits, "turn_regen", "hp_pct");
    const qi = NATURAL_REGEN + sumEffect(p.traits, "turn_regen", "qi_pct");
    p.healPercent(hp, qi);
    if (CHAPTER_STARTS.includes(p.turn)) {
      const info = getChapterInfo(p.turn);
      lines.push(`📖 ${info.title} (${getYear(p.turn)}년차) — ${info.desc}`, ...this.chapterRest());
    }
    const hint = breakthroughBlock(p);
    if (hint) lines.push(hint);
    if (p.injury) lines.push(`가슴 안쪽이 욱신거린다. (내상 ${p.injury}단계, 회복으로 낫는다)`);
    lines.push(monthLine(getMonth(p.turn)));
    this.pendingNext = false;
    this.enterTurn(lines);
  }

  /** 장이 끝나면 쌓인 상처를 모두 털어 낸다. */
  chapterRest() {
    const p = this.player;
    const lines = [];
    const growth = sumEffect(p.traits, "chapter_growth", "amount");
    if (growth) {
      for (const stat of Object.keys(STAT_NAMES)) p.gainStat(stat, growth);
      lines.push(`대기만성: 모든 능력치 +${growth}`);
    }
    const hadInjury = p.injury > 0;
    p.injury = 0;
    p.hp = p.maxHp();
    p.qi = p.maxQi();
    lines.push(`🌟 한 시절을 마치고 몸을 추슬렀다. 체력과 기력이 가득 차고 ${hadInjury ? "내상이 말끔히 나았다" : "몸이 가뿐하다"}.`);
    return lines;
  }

  /** 직전 달의 조우와 습득을 영구 도감에 반영한다. */
  commitCodex() {
    const added = this.player.commitPendingEncounters();
    updateGlobalCodex(added);
    updateKnown(this.player.skills.map((s) => s.key));
    return added.map((key) => `📖 강호 도감에 「${DB.enemies[key]?.name ?? key}」이(가) 기록되었다.`);
  }

  checkRealm() {
    const p = this.player;
    const next = checkBreakthrough(p);
    if (!next) return [];
    const lines = [`🌟 경지 돌파! ${p.realm} → ${next}`];
    p.realm = next;
    p.note(`${next}의 경지에 올랐다.`);
    // 심경이 충분히 높지 않으면 돌파가 거칠어 내상을 입는다
    if (rng.random() < Math.max(0, 60 - p.mind) * 0.01) {
      p.healPercent(-25, -25);
      lines.push("심경이 흔들려 기가 역류했다. 간신히 돌파했지만 내상을 입었다. (체력·기력 -25%)");
    } else {
      p.healPercent(50, 50);
      lines.push("막혀 있던 혈맥이 뚫리며 온몸에 기운이 찬다. (체력·기력 회복)");
    }
    return lines;
  }

  marketBuy(key) {
    if (!this.market) return;
    const [success, message] = buy(this.player, this.market, key);
    this.market.message = message;
    if (success) updateKnown([], [key]);
  }

  marketLeave() {
    if (!this.market) return;
    this.market = null;
    this.startNextTurn();
  }

  // ---------- 엔딩 ----------

  finishGame(victory, forced = null) {
    const p = this.player;
    this.addLog(this.commitCodex());
    const key = forced
      || ((!victory || p.hp <= 0) ? "사망"
        : checkSaengsa(p) ? "생사경"
          : checkGoodEnding(p) ? "기본" : "배드");
    const { endings } = DB;
    const gain = karmaGain(p, key, victory);
    const fresh = claimAchievements(p, key, victory);
    for (const item of fresh) {
      gain.lines.push(`업적 「${item.name}」${item.karma ? ` +${item.karma}` : ""}`);
      gain.total += item.karma;
    }
    addKarma(gain.total);
    p.alive = false;
    this.ending = {
      key, title: endings.titles[key], seal: endings.seals[key], karma: gain.total, karmaLines: gain.lines,
      text: endings.text[key], epilogue: buildEpilogue(p, key),
    };
    recordRun({
      ending: key, origin: p.origin, realm: p.realm, turn: Math.min(p.turn, p.maxTurn),
      kills: p.kills, title: byname(p), fame: fameRank(p.fame),
    });
    this.pendingNext = false;
    this.battle = null;
    this.event = null;
    this.market = null;
    clearCheckpoint();
  }
}

/** 엔딩 값에 도달한 장과 경지, 처음 이룬 일을 더한다. */
function karmaGain(player, key, victory) {
  const lines = [`${DB.endings.titles[key]} +${DB.endings.karma[key]}`];
  let total = DB.endings.karma[key];
  const add = (label, amount) => {
    if (amount > 0) {
      total += amount;
      lines.push(`${label} +${amount}`);
    }
  };
  add("도달한 장", getChapter(Math.min(player.turn, player.maxTurn)) - 1);
  add("경지", realmIndex(player.realm));
  add("윤회의 고리", upgradeLevel("윤회"));
  const { realm, 생사경: saengsa, 격파: win } = DB.karma.milestones;
  const reached = Object.keys(realm).filter((k) => realmIndex(player.realm) >= realmIndex(k));
  const wants = [...reached, ...(victory ? ["격파"] : []), ...(key === "생사경" ? ["생사경"] : [])];
  for (const k of claimMilestones(wants)) {
    add(k === "격파" ? "첫 천마 격파" : `처음 오른 ${k}`, k === "격파" ? win : k === "생사경" ? saengsa : realm[k]);
  }
  return { total, lines };
}

/** 유산 무공은 한 등급 낮아지고 상승을 넘지 않는다. */
function inheritedGrade(grade) {
  const index = Math.max(0, GRADE_ORDER.indexOf(grade) - 1);
  return GRADE_ORDER[Math.min(index, GRADE_ORDER.indexOf("상승"))];
}

/** 유산 장비는 같은 종류의 낮은 단계로 돌아온다. */
function inheritedGear(key) {
  const effect = DB.market[key].effects.find((e) => e.type === "equip");
  const same = Object.keys(DB.market).filter((k) => {
    const e = DB.market[k].effects.find((x) => x.type === "equip");
    return e && DB.market[k].markets.length && e.slot === effect.slot && e.style === effect.style;
  }).sort((a, b) => DB.market[a].price - DB.market[b].price);
  const position = Math.min(same.indexOf(key), DB.karma.legacy.gear_tier - 1);
  return same[Math.max(0, position)];
}

export function buildEpilogue(player, ending) {
  if (!["기본", "생사경", "배드"].includes(ending)) return [];
  const { endings } = DB;
  const lines = [endings.epilogue[player.dominantAlignment() || "중립"]];
  if (endings.sect_epilogue[player.sect]) lines.push(endings.sect_epilogue[player.sect]);
  if (endings.origin_epilogue[player.originKey]) lines.push(endings.origin_epilogue[player.originKey]);
  for (const [flag, text] of endings.flag_epilogue) if (player.hasFlag(flag)) lines.push(text);
  return lines;
}

export { Skill, STAT_NAMES };
