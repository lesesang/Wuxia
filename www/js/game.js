// 한 생의 진행을 맡는 상태 기계. 화면(ui.js)은 이 객체의 상태를 그리고 메서드를 부른다.
import { Battle, enemyPool, Enemy, statureEnemy, useConsumable } from "./battle.js";
import { GRADE_ORDER, Player, Skill, STAT_NAMES } from "./character.js";
import { DB } from "./data.js";
import { grantStartGear, grantStartSkills,
  advanceChain, applyEffects, failChain, checkRequires, dueChainEvent, enemyIntro, LAST_CHAIN_TURN, pickFortune, pickRandomEvent, resolveChoice,
  reactiveLine, startChain, storyEventForTurn, dueOriginEvent, pendingOriginEvents,
} from "./events.js";
import { bonusFor, buy, equipmentBonus, openMarket, sell } from "./market.js";
import {
  activeContent, addKarma, claimAchievements, clearCheckpoint, extraSlots, rewardTraits, loadCheckpoint, loadMeta, recordRun, saveCheckpoint,
  legacyPowers, storeLegacy, takeProvisions, updateGlobalCodex, updateKnown, upgradeTraits,
} from "./meta.js";
import { pick, pickWeighted, randInt, rng } from "./rng.js";
import {
  actionLine, ALIGNMENT_CAP, alignTier, applyGrowth, breakthroughBlock, byname, CHAPTER_STARTS, checkBreakthrough, checkGoodEnding, checkSaengsa,
  scaledGrowth, fameRank, FOCUS_DRIFT, focusedSide, getChapter, getChapterInfo, getMonth, getYear, isMarketTurn, monthLine, auraText, isNamed, perkTrait, realmFit, returnedLine, standIn, realmIndex, sumEffect, talkLine, traitSlots,
} from "./rules.js";
import { halpun, josa } from "./josa.js";

const FINAL_UNLEASH_FROM = 880; // 평균 기량이 이보다 높으면 천마가 숨긴 힘을 꺼낸다
const FINAL_UNLEASH_HP = 0.75;
const FINAL_UNLEASH_ATTACK = 0.35;
const NATURAL_REGEN = 5;
const MAX_TURN_REGEN = 30;
const EXPLORE_BATTLE = 0.35; // 나머지는 사건과 기연
const EXPLORE_EVENT = 0.45;
const SPARRING_CHANCE = 0.65;
const TRAIN_BONUS_BASE = 0.05;
const TRAIN_MASTERY_RATE = 2; // 수련이 주무공에
const MIND_MASTERY_RATE = 4; // 운기가 심법에
const INSIGHT_MASTERY_RATE = 1.5;
const ART_TRAIN_RATE = 3; // 수련이 경공에
const INSIGHT_CHANCE = 0.3;
const GAUNTLET_REST = 20;
const LOG_LIMIT = 40;
const LEGACY_LAST_TURN = 12; // 이어받을 유산은 첫 해 안에 찾는다
const LEGACY_FIND_RATE = 0.25;
const VALID_ACTIONS = ["수련", "명상", "탐색", "휴식"];
const SAME_SIDE_WEIGHT = 0.3;
const VALID_BATTLE_ACTIONS = ["기본공격", "비기", "심법", "경공", "소비품", "도주"];

/** 돌파의 대사. 경지마다 본문이 있고 출신, 성향, 주무공에 따른 반응이 한 줄씩 붙는다. */
function breakthroughLines(p, next) {
  const data = DB.realms.breakthrough?.[next];
  if (!data) return [];
  const lines = [...data.text];
  const side = p.dominantAlignment();
  const category = p.bestSkill()?.category;
  const fame = p.fame >= 60 ? data.fame?.높음 : p.fame <= 9 ? data.fame?.낮음 : null;
  for (const line of [data.flourish && pick(data.flourish), data.origin?.[p.originKey], p.sect && data.sect?.[p.sect], side && data.side?.[side], category && data.category?.[category], fame]) {
    if (line) lines.push(auraText(line, category));
  }
  return lines;
}

const MONTH_TALK_RATE = 0.3;
const SAENGSA_STAT = 1000;

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
    this.afterBattle = null;    // 이기면 적용할 사건의 결과
    this.offerAfterBattle = null; // 이기면 이어지는 소속 제안
    this.pickingArts = false;   // 첫 달 전에 쓸 무공을 고르는 중
    this.giftsDone = false;
  }

  get active() { return this.player !== null; }

  get busy() {
    return !!(this.battle || this.market || this.event || this.pendingNext || this.pickingArts || !this.player?.alive);
  }

  setLog(lines) { this.log = lines.slice(-LOG_LIMIT); }
  addLog(lines) { this.setLog([...this.log, ...lines]); }

  // ---------- 시작과 복구 ----------

  /** 새 강호행 시작. 잠긴 출신이면 false */
  start(originKey = "무림초출", selectedTraits = [], legacyPicks = []) {
    const meta = loadMeta();
    if (!meta.unlocked_origins.includes(originKey) || !DB.origins.origins[originKey]) return false;
    const traits = [...new Set(selectedTraits)]
      .filter((t) => meta.unlocked_traits.includes(t) && (!DB.traits[t].origin || DB.traits[t].origin === originKey))
      .slice(0, traitSlots(meta.total_karma) + extraSlots(meta));

    this.reset();
    const provisions = takeProvisions();
    this.player = new Player(originKey, [...traits, ...upgradeTraits(meta, originKey), ...rewardTraits(meta), ...provisions.map((k) => `채비_${k}`)]);
    this.player.content = activeContent(meta);
    const giftLines = DB.origins.origins[originKey].choose_start ? [] : grantStartSkills(this.player);
    // 고른 유산은 바로 받지 않는다. 첫 해 안에 그 흔적을 찾아낸다
    if (meta.legacy_open) this.player.pendingLegacy = legacyPicks.map((i) => meta.legacies[i])
      .filter((e) => e && (e.kind === "skill" ? DB.skills[e.key] : DB.market[e.key])).slice(0, legacyPowers(meta).take);
    updateKnown(this.player.skills.map((s) => s.key));
    const intro = getChapterInfo(1);
    const provisionLines = provisions.length ? [`챙겨 온 채비: ${provisions.map((k) => DB.karma.provisions[k].name).join(", ")}`] : [];
    this.enterTurn([`${intro.title}, 1년차. ${intro.desc}`, ...provisionLines, ...giftLines]);
    return true;
  }

  /** 이번 강호행에서 유산으로 남길 수 있는 것들 */
  legacyOptions() {
    const p = this.player;
    const { divine } = legacyPowers();
    // 신공은 유산을 끝까지 강화해야 남길 수 있다
    const skills = p.skills.filter((s) => GRADE_ORDER.indexOf(s.grade) >= 1 && (divine || s.grade !== "신공"))
      .sort((a, b) => GRADE_ORDER.indexOf(b.grade) - GRADE_ORDER.indexOf(a.grade)).slice(0, 5)
      .map((s) => ({ kind: "skill", key: s.key, grade: s.grade, label: `${s.name} (${s.grade} 품계)` }));
    const gear = [p.weapon, p.armor, ...p.gear].filter((k, i, all) => DB.market[k] && DB.market[k].grade !== "범품" && all.indexOf(k) === i)
      .map((k) => ({ kind: "gear", key: k, label: `${DB.market[k].name} (${DB.market[k].grade})` }));
    return [...skills, ...gear];
  }

  /** 끝날 때 유산을 남긴다. 보관이 가득 찼으면 지울 것을 골라야 한다 */
  leaveLegacy(index, dropIndex = null) {
    if (!this.ending || this.ending.legacyLeft || !loadMeta().legacy_open) return false;
    const option = this.legacyOptions()[index];
    if (!option) return false;
    const name = byname(this.player);
    const entry = { kind: option.kind, key: option.key, grade: option.grade, label: option.label, from: name === "이름 없는 무인" ? "무명객" : name, origin: this.player.origin };
    if (!storeLegacy(entry, dropIndex)) return false;
    this.ending.legacyLeft = option.label;
    return true;
  }

  /** 새 달 공통 처리: 체크포인트를 저장하고 줄거리 이벤트를 연다. */
  enterTurn(log) {
    this.setLog(log);
    saveCheckpoint(this.player.toDict(), this.log);
    this.openStoryEvent();
  }

  /** 그달의 일을 마쳤다. 다시 열어도 달의 처음으로 돌아가지 않게 저장한다. */
  finishMonth() {
    this.pendingNext = true;
    this.saveMonthEnd();
  }

  /** 그달의 일을 마친 뒤의 저장. 결과 화면과 열린 장터로 돌아온다. */
  saveMonthEnd() {
    if (this.player?.alive && !this.ending) saveCheckpoint(this.player.toDict(), this.log, { pending: true, market: this.market });
  }

  /** 그달의 줄거리와 연계 인카운터를 연다. 천마봉 전에는 남은 연계를 먼저 끝낸다. */
  openStoryEvent() {
    const p = this.player;
    const urgent = p.turn >= LAST_CHAIN_TURN && p.chains.length > 0;
    const story = urgent ? null : storyEventForTurn(p);
    if (p.turn === 1 && !this.giftsDone && !(story && DB.events[story].prelude)) {
      // 번외 선택이 끝나면 쓸 무공을 먼저 정하고, 그에 맞는 행장을 받는다
      if (hasArtChoices(p)) {
        this.pickingArts = true;
        return;
      }
      this.settleGifts();
    }
    if (story) {
      this.event = { key: story, forced: true };
      return;
    }
    const chainKey = dueChainEvent(p);
    // 연계 한 편은 그달을 쓴다. 다만 마지막 달에 몰리면 달을 쓰지 않는다.
    if (chainKey) {
      this.event = { key: chainKey, forced: urgent };
      return;
    }
    // 출신의 이야기는 결전 전에 반드시 찾아온다
    const originKey = dueOriginEvent(p);
    if (originKey) {
      this.event = { key: originKey, forced: true };
      return;
    }
    // 싸움이 이어져 첫 해가 저물도록 못 찾았으면 달이 시작할 때 흔적이 먼저 찾아온다
    if (p.pendingLegacy.length && p.turn >= LEGACY_LAST_TURN) this.event = { key: "유산_발길", forced: true };
  }

  settleGifts() {
    this.giftsDone = true;
    const lines = grantStartGear(this.player);
    if (lines.length) this.addLog([lines.join(", ")]);
  }

  /** 쓸 무공을 다 골랐다. */
  finishArtsPick() {
    if (!this.pickingArts) return;
    this.pickingArts = false;
    this.settleGifts();
    this.openStoryEvent();
  }

  /** 저장된 달 시작 지점에서 이어 한다. 없으면 false */
  continueFromSave() {
    const checkpoint = loadCheckpoint();
    if (!checkpoint) return false;
    this.reset();
    this.player = Player.fromDict(checkpoint.player);
    this.setLog(checkpoint.log || []);
    if (checkpoint.pending) {
      // 그달의 일을 마친 뒤였으면 그 자리로 돌아온다
      this.giftsDone = true;
      this.pendingNext = true;
      this.market = checkpoint.market || null;
      return true;
    }
    this.openStoryEvent();
    return true;
  }

  restart() {
    this.reset();
    clearCheckpoint();
  }

  // ---------- 행동 ----------

  action(name) {
    if (this.pickingArts) this.finishArtsPick();
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
        this.addLog([`지나던 무인과 대련을 나누고 사례를 받았다. (실전 경험 +1, 은자 +${silver})`]);
      }
      const skill = p.bestSkill();
      if (skill) this.addLog(skill.gainMastery(p.masteryGainAmount() * TRAIN_MASTERY_RATE));
      // 수련하는 동안 걸음도 함께 닦인다
      const steps = p.bestOfType("경공");
      if (steps) this.addLog(steps.gainMastery(p.masteryGainAmount() * ART_TRAIN_RATE));
    } else if (name === "명상") {
      const internal = this.grow("internal");
      const mind = this.grow("mind");
      const [, qi] = p.healPercent(0, 15);
      this.addLog([actionLine("명상"), `내공+${internal}, 심경+${mind}, 내력+${qi}`]);
      const skill = p.bestOfType("심공");
      if (skill) this.addLog(skill.gainMastery(p.masteryGainAmount() * MIND_MASTERY_RATE));
      // 고요한 중에 깨달음이 오면 주무공도 함께 깊어진다
      if (rng.random() < INSIGHT_CHANCE && p.bestSkill()) {
        this.addLog(["문득 초식의 군더더기가 보였다.", ...p.bestSkill().gainMastery(Math.round(p.masteryGainAmount() * INSIGHT_MASTERY_RATE))]);
      }
    } else if (name === "휴식") {
      const rate = 1 + sumEffect(p.traits, "heal_rate", "percent") / 100;
      const [hp, qi] = p.healPercent(35 * rate, 45 * rate);
      let result = `체력+${hp}, 내력+${qi}`;
      if (p.injury) {
        p.addInjury(-1);
        result += `, 내상 ${p.injury ? `${p.injury}단계로 호전` : "완치"}`;
      }
      this.addLog([actionLine("휴식"), result]);
      // 몸을 돌보는 동안 숨도 고르게 된다
      const mind = p.bestOfType("심공");
      if (mind) this.addLog(mind.gainMastery(p.masteryGainAmount()));
    } else {
      this.explore();
    }
    if (!this.battle && !this.event) {
      if (this.legacyFound()) this.event = { key: `유산_${name}`, forced: false };
      else this.finishMonth();
    }
  }

  /** 이어받기로 한 유산의 흔적을 이번 달에 찾아내는가. 첫 해가 끝나기 전에는 반드시 찾는다 */
  legacyFound() {
    const left = this.player.pendingLegacy.length;
    if (!left) return false;
    return this.player.turn >= LEGACY_LAST_TURN - left || rng.random() < LEGACY_FIND_RATE;
  }

  grow(stat) {
    const p = this.player;
    let amount = randInt(8, 12);
    if (rng.random() < TRAIN_BONUS_BASE + p.mind / 5000) amount += randInt(7, 11); // 심경이 높으면 두 배 오를 때가 많아진다
    return p.gainStat(stat, applyGrowth(scaledGrowth(amount, p.turn), p.traits, stat));
  }

  explore() {
    // 돌아다니는 동안 걸음이 닦인다
    const steps = this.player.bestOfType("경공");
    if (steps) this.addLog(steps.gainMastery(this.player.masteryGainAmount()));
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
    this.addLog([`기연. ${fortune.text}`, [...summary, `은자+${silver}`].join(", ")]);
  }

  pickEnemy() {
    const p = this.player;
    // 성향과 명성에 따라 찾아오는 적이 있다. 같은 편은 덜 덤빈다
    const pool = enemyPool(getChapter(p.turn)).filter((k) => checkRequires(p, DB.enemies[k].requires));
    const mine = p.dominantAlignment() || DB.sects[p.sect]?.alignment;
    // 지금 시점(장)이 나올 수 있는 적을 정하고, 그중에서 내 경지와 가까운 적을 더 자주 만난다
    const weightOf = (k) => (mine && DB.enemies[k].side === mine ? SAME_SIDE_WEIGHT : 1) * DB.enemies[k].weight * realmFit(p.realm, DB.enemies[k].realm);
    // 정도를 걷는 무인을 정파가 까닭 없이 치지 않고, 제 소속은 제 사람을 치지 않는다
    const fitting = pool.filter((k) => !(mine === "정도" && DB.enemies[k].side === "정도") && DB.enemies[k].faction !== p.sect
      && !(isNamed(k) && p.slain.includes(k))); // 쓰러뜨린 이름 있는 적은 다시 만나지 않는다
    const list = fitting.length ? fitting : pool;
    return pickWeighted(list, list.map(weightOf));
  }

  /** foe를 주면 그 사건만의 상대다. 수치는 기존 적을 따르고 이름과 대사는 사건을 따른다 */
  startBattle(key, spar = false, foe = null) {
    // 지금 장에 어울리지 않는 적이면 같은 갈래에서 위상이 맞는 적으로 나온다
    // 이미 쓰러뜨린 이름 있는 적의 자리에는 대신할 적이 나온다. 그래도 없으면 그가 돌아온다. 비무 상대는 산 사람이다
    const stature = statureEnemy(key, getChapter(this.player.turn));
    const fitting = spar || foe ? stature : standIn(this.player, stature);
    const enemy = new Enemy(fitting, this.player.turn);
    this.player.recordEnemyEncounter(fitting);
    this.battle = new Battle(this.player, enemy);
    this.battle.spar = spar;
    this.battle.askStand = true;
    if (foe) {
      enemy.name = foe;
      enemy.title = null;
      enemy.desc = "";
      this.battle.oneOff = true;
    }
    const back = !spar && !foe && isNamed(fitting) && this.player.slain.includes(fitting);
    const intro = foe ? null : back ? returnedLine(fitting) : enemyIntro(this.player, fitting);
    const called = enemy.title ? `${enemy.title} ${enemy.name}` : enemy.name;
    this.addLog([spar ? `${called}${josa(called, "과/와")} 비무를 겨룬다. (${enemy.realm}, 져도 목숨은 잃지 않는다)` : `${called}${josa(called, "과/와")} 마주쳤다. (${enemy.realm})`, ...(intro ? [intro] : []), ...this.battle.log]);
    this.battle.log = [];
  }

  startFinalBattle() {
    const p = this.player;
    const enemy = new Enemy("천마");
    // 천마는 상대의 기량을 보고 숨겨 둔 힘을 꺼낸다
    const mean = (p.external + p.internal + p.martial + p.mind) / 4;
    const unleashed = Math.max(0, (mean - FINAL_UNLEASH_FROM) / 100);
    if (unleashed) {
      enemy.maxHp = Math.trunc(enemy.maxHp * (1 + unleashed * FINAL_UNLEASH_HP));
      enemy.hp = enemy.maxHp;
      enemy.attack = Math.trunc(enemy.attack * (1 + unleashed * FINAL_UNLEASH_ATTACK));
    }
    const weaken = p.bossWeaken;
    if (weaken) {
      const percent = Math.min(weaken, 60);
      enemy.maxHp = Math.trunc(enemy.maxHp * (100 - percent) / 100);
      enemy.hp = enemy.maxHp;
      this.addLog([`천마의 기세가 꺾인 채 싸움이 시작된다. (체력 ${halpun(percent)} 감소)`]);
    }
    if (unleashed > 0.3) this.addLog(["천마가 눈을 가늘게 뜬다. 내 기량을 보고 앉은 채 숨겨 두었던 힘을 끌어올린다."]);
    p.recordEnemyEncounter("천마");
    this.battle = new Battle(p, enemy, true);
    this.battle.askStand = true;
    for (const c of this.battle.companions) {
      this.battle.log.push(reactiveLine(p, c.joins, c.join));
      p.note(`결전에 ${c.name}${josa(c.name, "이/가")} 달려왔다.`);
    }
    const intro = enemyIntro(p, "천마");
    this.addLog(["강호행의 마지막 결전이 시작된다. 천마는 생사경의 경지에 있다.", ...(intro ? [intro] : []), ...this.battle.log]);
    this.battle.log = [];
  }

  // ---------- 이벤트 ----------

  chooseEvent(index) {
    if (!this.event) return;
    const state = this.event;
    const result = resolveChoice(this.player, state.key, index);
    if (!result) return;

    // lead가 붙은 문장은 싸움에 들어가는 말이고, 나머지는 싸움이 끝난 뒤의 이야기다
    const lines = [`${DB.events[state.key].title}`, ...(!result.deferred || result.lead ? [result.text] : [])];
    if (result.deferred) this.afterBattle = { key: state.key, text: result.lead ? null : result.text, effects: result.effects, forced: state.forced };
    if (DB.events[state.key].kind === "story") this.player.note(`${DB.events[state.key].title}: ${result.label}`);
    if (result.summary.length) lines.push(result.summary.join(", "));
    this.setLog(state.forced ? [...this.log, ...lines] : lines);
    this.event = null;

    const { effects } = result;
    const { chain } = DB.events[state.key];
    if (chain) {
      if (effects.chain_start) startChain(this.player, chain.id);
      // 비무가 걸린 편은 승패가 난 뒤에 넘어간다
      else if (chain.index > 0 && effects.spar && effects.battle) this.afterBattle.chainId = chain.id;
      else if (chain.index > 0) advanceChain(this.player, chain.id, !!effects.chain_abandon);
    }
    if (effects.ending) {
      this.finishGame(true, effects.ending);
      return;
    }
    // 도운 뒤에 받는 소속 제안. 받아야 소속이 된다
    if (effects.sect_offer && !effects.battle && this.player.sect === null) {
      this.event = { key: `제안_${effects.sect_offer}`, forced: state.forced };
      return;
    }
    if (effects.final_battle) {
      this.startFinalBattle();
    } else if (effects.battle) {
      this.startBattle(effects.battle, !!effects.spar, effects.foe);
    } else if (effects.gauntlet) {
      const { enemies, reward, name, spar } = effects.gauntlet;
      this.gauntlet = { name, enemies: enemies.slice(1), reward, round: 1, total: enemies.length, spar: !!spar };
      this.startBattle(enemies[0], !!spar);
    }
    if (this.battle) return;
    // 달을 쓰지 않는 사건 뒤에는 그달의 다음 사건으로 바로 이어진다
    if (state.forced) this.openStoryEvent();
    else if (this.chainsMustFinish()) this.openStoryEvent();
    else this.finishMonth();
  }

  // ---------- 전투 ----------

  /** 결전 막간의 선택 */
  battleInterlude(index) {
    if (!this.battle?.chooseInterlude(index)) return;
    this.addLog(this.battle.log);
    this.battle.log = [];
  }

  battleAction(action = "기본공격", itemKey = null) {
    if (!this.battle || !VALID_BATTLE_ACTIONS.includes(action)) return;
    const { battle, player } = this;
    if (action === "도주" && battle.isFinal) return;
    // 막간을 고르지 않고 합을 진행하면 첫 선택지를 따른다
    if (battle.interlude) this.battleInterlude(0);

    // 힘을 끌어모을지 고르지 않고 합을 진행하면 끌어모은다
    if (battle.standPending) {
      this.battleStand(true);
      return;
    }

    const result = battle.runRound(action, player.bestSkill(), itemKey);
    this.addLog(battle.log);
    battle.log = [];
    if (result) this.closeBattle(battle, result);
  }

  /** 쓰러지는 순간의 선택. 힘을 끌어모을지, 여기서 눈을 감을지 */
  battleStand(gather) {
    const { battle } = this;
    if (!battle?.standPending) return;
    const result = battle.answerStand(gather);
    this.addLog(battle.log);
    battle.log = [];
    if (result) this.closeBattle(battle, result);
  }

  closeBattle(battle, result) {
    const { player } = this;
    this.battle = null;
    this.settleAfterBattle(result);
    if (result.victory && this.gauntlet && !battle.isFinal) {
      if (this.continueGauntlet()) return;
    } else {
      this.gauntlet = null;
    }

    if (result.victory && !battle.spar && (["강적", "보스"].includes(battle.enemy.tier) || isNamed(battle.enemy.key))) player.note(`${battle.enemy.name}${josa(battle.enemy.name, "을/를")} 쓰러뜨렸다.`);
    if (!result.victory && !result.fled) player.note(battle.spar ? `${battle.enemy.name}에게 비무에서 졌다.` : `${battle.enemy.name}에게 쓰러졌다.`);
    if (result.fled) this.addLog(["가까스로 전장을 벗어났다."]);

    if (this.offerAfterBattle && player.hp > 0) {
      this.event = { key: this.offerAfterBattle, forced: false };
      this.offerAfterBattle = null;
    } else if (battle.isFinal || player.hp <= 0) this.finishGame(result.victory);
    else if (this.chainsMustFinish()) this.openStoryEvent();
    else this.finishMonth();
  }

  /** 싸움이 걸린 사건의 결과를 정리한다. 달아나면 나중에 다시 만날 수 있다. */
  settleAfterBattle(result) {
    const after = this.afterBattle;
    this.afterBattle = null;
    if (!after) return;
    const { player } = this;
    if (after.chainId) {
      if (result.victory) advanceChain(player, after.chainId);
      else {
        failChain(player, after.chainId);
        this.addLog([`${DB.chains[after.chainId].title} 일은 여기서 어그러졌다.`]);
      }
    }
    if (result.victory) {
      const summary = applyEffects(player, after.effects);
      this.addLog([...(after.text ? [after.text] : []), ...(summary.length ? [summary.join(", ")] : [])]);
      if (after.effects.sect_offer && player.sect === null) this.offerAfterBattle = `제안_${after.effects.sect_offer}`;
    } else if (result.fled && !DB.events[after.key].chain && !DB.events[after.key].turn) {
      player.seenEvents = player.seenEvents.filter((k) => k !== after.key);
    }
  }

  /** 천마봉 앞에서 끝나지 않은 연계가 남아 있으면 달을 넘기지 않는다. */
  chainsMustFinish() {
    const p = this.player;
    return p.turn >= LAST_CHAIN_TURN && (p.chains.length > 0 || pendingOriginEvents(p).length > 0);
  }

  continueGauntlet() {
    const { gauntlet, player } = this;
    if (gauntlet.enemies.length) {
      const next = gauntlet.enemies.shift();
      gauntlet.round += 1;
      player.healPercent(GAUNTLET_REST, GAUNTLET_REST);
      this.addLog([`잠시 숨을 고른다. (${gauntlet.name} ${gauntlet.round}/${gauntlet.total}전)`]);
      this.startBattle(next, gauntlet.spar);
      return true;
    }
    const summary = applyEffects(player, gauntlet.reward);
    player.note(`${gauntlet.name}${josa(gauntlet.name, "을/를")} 제패했다.`);
    this.addLog([`${gauntlet.name}${josa(gauntlet.name, "을/를")} 제패했다. 강호가 그 이름을 외친다.`, summary.join(", ")]);
    this.gauntlet = null;
    return false;
  }

  useItem(key) {
    if (DB.market[key]?.battle_only) return;
    if (!this.active || this.battle || !this.player.alive) return;
    if (DB.market[key] && this.player.inventory[key] > 0) {
      const name = DB.market[key].name;
      updateKnown([], [key]);
      const notes = useConsumable(this.player, key);
      this.addLog([`${name}${josa(name, "을/를")} 썼다.`, ...notes]);
      if (this.pendingNext) this.saveMonthEnd();
    }
  }

  /** 같은 계열 무공의 성취 일부를 주무공으로 옮긴다. 옮긴 무공의 성취는 0이 된다. */
  transferMastery(key) {
    if (!this.active || this.battle || !this.player.alive) return;
    const p = this.player;
    const from = p.getSkill(key);
    const main = p.bestSkill();
    const amount = from?.masteryFor(main);
    if (!amount) return;
    from.mastery = 0;
    this.addLog([`${from.name}의 이치를 ${main.name}에 녹였다. (성취 +${amount})`, ...main.gainMastery(amount)]);
  }

  setMainSkill(key) {
    if (!this.active || this.battle) return;
    const skill = this.player.getSkill(key);
    if (skill?.type === "공격무공") this.player.mainSkill = key;
    else if (skill) this.player.chosenArts[skill.type] = key;
  }

  // ---------- 달 넘김과 시장 ----------

  advanceTurn() {
    if (!this.active || !this.pendingNext || this.market) return;
    if (isMarketTurn(this.player.turn)) {
      this.market = openMarket(this.player.turn, this.player);
      this.saveMonthEnd();
      return;
    }
    this.startNextTurn();
  }

  startNextTurn() {
    const p = this.player;
    const lines = [...this.commitCodex(), ...this.checkRealm()];
    p.turn += 1;
    // 달마다 저절로 차는 양에도 끝이 있어 요양할 일이 남는다
    const hp = Math.min(MAX_TURN_REGEN, NATURAL_REGEN + sumEffect(p.traits, "turn_regen", "hp_pct"));
    const qi = Math.min(MAX_TURN_REGEN, NATURAL_REGEN + sumEffect(p.traits, "turn_regen", "qi_pct"));
    p.healPercent(hp, qi);
    lines.push(...this.alignmentMonth());
    if (CHAPTER_STARTS.includes(p.turn)) {
      const info = getChapterInfo(p.turn);
      lines.push(`${info.title}, ${getYear(p.turn)}년차. ${info.desc}`, ...this.chapterGrowth());
    }
    if (getMonth(p.turn) === 1) lines.push(...this.yearRest());
    const hint = breakthroughBlock(p);
    if (hint) lines.push(hint);
    if (p.injury) lines.push(`가슴 안쪽이 욱신거린다. (내상 ${p.injury}단계, 요양으로 낫는다)`);
    lines.push(monthLine(getMonth(p.turn)));
    if (rng.random() < MONTH_TALK_RATE) {
      const talk = talkLine(p, "month");
      if (talk) lines.push(talk);
    }
    this.pendingNext = false;
    this.enterTurn(lines);
  }

  /** 한 길에 집중한 무인은 달마다 그 길이 깊어진다. 단계가 오르면 알린다. */
  alignmentMonth() {
    const p = this.player;
    const side = focusedSide(p.alignment);
    if (side) p.alignment[side] = Math.min(ALIGNMENT_CAP, p.alignment[side] + FOCUS_DRIFT);
    const tier = alignTier(p.alignment);
    const mark = tier ? `${tier.side}${tier.step}` : null;
    if (!tier || p.alignMark === mark) {
      p.alignMark = mark;
      return [];
    }
    p.alignMark = mark;
    if (tier.step === 0) return [];
    p.note(`강호가 ${tier.name}${josa(tier.name, "이라고/라고")} 부르기 시작했다.`);
    return [`강호가 ${tier.name}${josa(tier.name, "이라고/라고")} 부르기 시작했다.`];
  }

  /** 새 장이 열릴 때의 성장 */
  chapterGrowth() {
    const p = this.player;
    const growth = sumEffect(p.traits, "chapter_growth", "amount");
    if (!growth) return [];
    for (const stat of Object.keys(STAT_NAMES)) p.gainStat(stat, growth);
    return [`대기만성: 모든 기량 +${growth}`];
  }

  /** 새해가 밝으면 쌓인 상처를 모두 털어 낸다. */
  yearRest() {
    const p = this.player;
    const hadInjury = p.injury > 0;
    p.injury = 0;
    p.hp = p.maxHp();
    p.qi = p.maxQi();
    return [`${getYear(p.turn)}년차가 밝았다. 몸을 추슬러 체력과 내력이 가득 차고 ${hadInjury ? "내상이 말끔히 나았다" : "몸이 가뿐하다"}.`];
  }

  /** 직전 달의 조우와 습득을 영구 도감에 반영한다. */
  commitCodex() {
    const added = this.player.commitPendingEncounters();
    // 이미 강호록에 있는 인물은 다시 알리지 않는다
    const known = loadMeta().global_codex;
    const fresh = added.filter((key) => !known.includes(key));
    updateGlobalCodex(fresh);
    updateKnown(this.player.skills.map((s) => s.key));
    return fresh.map((key) => `강호록에 ${DB.enemies[key]?.name ?? key}${josa(DB.enemies[key]?.name ?? key, "이/가")} 기록되었다.`);
  }

  checkRealm() {
    const p = this.player;
    const next = checkBreakthrough(p);
    if (!next) return [];
    const lines = [`경지 돌파. ${p.realm} → ${next}`, ...breakthroughLines(p, next)];
    p.realm = next;
    p.note(`${next}의 경지에 올랐다.`);
    const perk = DB.realms.perks[next];
    if (perk) {
      if (!p.traits.includes(perkTrait(next))) p.traits.push(perkTrait(next));
      const category = p.bestSkill()?.category;
      lines.push(`경지의 특전 ${auraText(perk.name, category)}: ${auraText(perk.desc, category)}`);
      // 지난 경지의 특전도 함께 깊어진다
      for (const [name, older] of Object.entries(DB.realms.perks)) {
        const growth = older.growth?.[next];
        if (!growth) continue;
        p.traits.push(`${perkTrait(name)}_${next}`);
        lines.push(`${name}의 특전이 깊어졌다. ${auraText(growth.desc, category)}`);
      }
    }
    // 심경이 충분히 높지 않으면 돌파가 거칠어 내상을 입는다
    if (rng.random() < Math.max(0, 600 - p.mind) * 0.001) {
      p.healPercent(-25, -25);
      lines.push("심경이 흔들려 기가 역류했다. 간신히 돌파했지만 내상을 입었다. (체력과 내력 -2할 5푼)");
    } else {
      p.healPercent(50, 50);
      lines.push("막혀 있던 혈맥이 뚫리며 온몸에 기운이 찬다. (체력과 내력 회복)");
    }
    return lines;
  }

  marketBuy(key) {
    if (!this.market) return;
    const [success, message] = buy(this.player, this.market, key);
    this.market.message = message;
    if (success) updateKnown([], [key]);
    this.saveMonthEnd();
  }

  marketSell(key) {
    if (!this.market) return;
    const [, message] = sell(this.player, key);
    this.market.message = message;
    this.saveMonthEnd();
  }

  /** 지닌 병장기로 바꿔 든다. 싸우는 중에는 못 바꾼다. */
  equipGear(key) {
    if (!this.active || this.battle || !this.player.gear.includes(key)) return;
    this.player.equipGear(key);
    if (this.market) this.market.message = `${DB.market[key].name}${josa(DB.market[key].name, "을/를")} 들었다.`;
    if (this.pendingNext) this.saveMonthEnd();
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
    const fresh = claimAchievements(p, key, victory && key !== "귀순");
    for (const item of fresh) {
      gain.lines.push(`공적 ${item.name}${item.karma ? ` +${item.karma}` : ""}`);
      gain.total += item.karma;
    }
    const before = loadMeta().total_karma;
    addKarma(gain.total);
    for (const reward of DB.karma.rewards) {
      if (before < reward.at && before + gain.total >= reward.at) gain.lines.push(`누적 보상 ${reward.name}${josa(reward.name, "을/를")} 받았다.`);
    }
    // 생사경은 천마를 넘어선 그 순간에만 이르는 경지다
    if (key === "생사경") {
      p.realm = "생사경";
      // 마지막 장면의 연출이다. 네 기량이 모두 끝을 넘어선다
      for (const stat of Object.keys(STAT_NAMES)) p[stat] = SAENGSA_STAT;
    }
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

/** 같은 갈래의 무공을 둘 이상 들고 있는가 */
function hasArtChoices(player) {
  return ["공격무공", "심공", "경공"].some((type) => player.skillsOfType(type).length > 1);
}

/** 천마까지 가지 못하면 도달한 장의 값을, 천마까지 갔으면 그 결과의 값을 받고 경지를 더한다. 생사경은 경지이자 결말이라 값 하나로 끝난다. */
function karmaGain(player, key, victory) {
  const lines = [];
  let total = 0;
  const add = (label, amount) => {
    if (amount > 0) {
      total += amount;
      lines.push(`${label} +${amount}`);
    }
  };
  if (key === "사망") add("도달한 장", getChapter(Math.min(player.turn, player.maxTurn)));
  else add(DB.endings.titles[key], DB.endings.karma[key]);
  if (key === "생사경") return { total, lines };
  add("경지", realmIndex(player.realm));
  return { total, lines };
}

export function buildEpilogue(player, ending) {
  // 묶음마다 주제가 하나다. 조건이 맞는 첫 문장만 쓰므로 같은 주제의 문장이 부딪치지 않는다
  return DB.endings.frames[ending].flatMap((group) => {
    if (Array.isArray(group)) {
      const line = reactiveLine(player, group);
      return line ? [line] : [];
    }
    return group.rows.filter((row) => checkRequires(player, row.requires)).slice(0, group.many).map((row) => row.text);
  });
}

export { Skill, STAT_NAMES };
