// 달제 전투. 적의 필살기는 직전 합에 예고되고, 경공으로 흘려낼 수 있다.
import { MAX_INJURY, Skill, STAT_NAMES, STAT_SCALE } from "./character.js";
import { DB } from "./data.js";
import { checkRequires, reactiveLine } from "./events.js";
import { equipmentBonus, gearGimmick } from "./market.js";
import { pick, pickWeighted, randInt, rng, uniform } from "./rng.js";
import { activeCompanions, difficultyOf, quirkText, MAX_FAME, veteranBonus, applyGrowth, scaledGrowth, isNamed, battleBuffs, fameRankChanged, hasEffect, alignValue, dominant, KILL_ALIGN, realmBonus, realmIndex, sectBonus, sumEffect, talkLine, fameEffect } from "./rules.js";
import { halpun, josa } from "./josa.js";

const BASE_HIT = 0.88;
// 깊은 강호의 적이 지닌 괴공에도 끝이 있다
const MAX_HEAL_CUT = 50;
const MAX_MIRROR = 15;
const MAX_BLOODTHIRST = 30;
const MAX_FRENZY = 40;
// 위력에 들어가는 네 기량의 비중. 네 기량이 고루 값어치를 하도록 나눈다
const POWER_RATES = { external: 0.55, martial: 1.15, internal: 0.45, mind: 0.25 };
const SECRET_INTERNAL_RATE = 1.0;
const MIND_GUARD_RATE = 6000; // 심경이 이 값일 때 받는 피해가 모두 사라지는 비율
const MAX_MIND_GUARD = 0.15;
const FLEE_BASE = 0.5;
const DROP_MAIN_RATE = 3;    // 주무공과 같은 계열의 비급은 더 잘 떨어진다
const DROP_OTHER_RATE = 0.6;
const DROP_HINT_RATE = 0.6;      // 적이 품은 무공이 있으면 먼저 그것이 나온다
const DROP_MEDICINE_RATE = 0.05; // 약이 나올 확률
const WIN_ART_MASTERY = 5; // 이기면 쓰던 심법과 경공도 깊어진다
const WIN_MAIN_MASTERY = 1; // 이기면 쓰던 공격 무공도 아주 조금 깊어진다
const ART_USE_RATE = 2.5; // 심법과 경공은 자주 쓰지 않으므로 한 번에 더 쌓인다
const REVIVE_RATE = 0.5;
const MAX_SHRED = 40; // 깎아 낼 수 있는 적 방어의 끝(푼)
const MAX_BLEED_PCT = 6; // 한 합에 흐르는 피는 적 최대 체력의 이만큼까지
const MAX_AURA_GUARD = 25; // 호신강기가 줄이는 피해의 끝
const INNATE_POWER = 15; // 선천진기를 일으킨 싸움에서 오르는 위력과 줄어드는 피해
const VICTORY_TALK_RATE = 0.3;
const SPAR_LOSS_HP = 0.1; // 비무에 진 뒤 남는 체력
const MAX_KILL_POWER = 40; // 쓰러뜨린 적만큼 강해지는 자질의 끝
const MAX_DAMAGE_REDUCE = 45; // 자질과 기틀을 겹쳐도 받는 피해를 이 이상 줄이지 못한다
const MIN_THROUGH_ARMOR = 0.2; // 호신구를 뚫고 들어오는 최소 비율
const MAX_EVADE = 90; // 어떤 경공도 반드시 피하지는 못한다
const MAX_AUTO_EVADE = 50; // 경공을 펼치지 않고 저절로 피하는 끝
const MAX_START_WARD = 35; // 싸움을 시작할 때 두르는 호신 기운의 끝(최대 체력 대비)
const MAX_WARD = 40; // 싸우는 동안 쌓이는 호신 기운의 끝(최대 체력 대비)
const MAX_PASSIVE_GUARD = 15; // 심법이 늘 줄여 주는 피해의 끝
const MAX_THORNS = 30; // 받은 힘을 되돌리는 끝
const MAX_QI_SHIELD = 30; // 내력으로 대신 받는 피해의 끝
const MAX_SECOND_WIND = 25; // 한 싸움에 한 번 숨이 트일 때 채우는 체력의 끝
const MAX_LAST_GUARD = 20; // 몰렸을 때 갑의가 더 막아 주는 끝
const MAX_STEP_MOMENTUM = 30; // 피할수록 오르는 위력의 끝
const MIN_TAKEN = 0.2; // 피해를 줄이는 효과를 겹쳐도 호신구에 닿기 전의 힘은 이만큼 남는다
const MIN_FINAL_TAKEN = 0.1; // 호신구까지 겹쳐도 몸에 닿는 힘
const MIND_SURGE_EVERY = 4; // 심법이 숨을 모아 터뜨리는 주기(합)
const ECHO_RATE = 0.5; // 여운으로 한 번 더 닿는 힘
const ITEM_MIND_MASTERY_RATE = 8; // 영약과 서책으로 오른 기량 이만큼마다 심법 성취 1
const STEP_STREAK_PENALTY = 15; // 경공을 잇달아 펼치면 걸음을 읽혀 회피가 이만큼씩 떨어진다
const MIN_STREAK_EVADE = 30;
const BROKEN_CHARGE_MULT = 0.5; // 기세가 꺾인 필살기는 보통 공격의 절반 힘으로 닿는다
const NORMAL_COUNTER_RATE = 0.5; // 필살기가 아닌 공격을 흘리면 되갚는 힘이 절반이다
const REFUND_RATE = 0.5; // 다 피했을 때 되찾는 내력의 비율
const MAX_FLEE = 0.9;
const MAX_CRIT = 0.8;
const MAX_LIFESTEAL_PCT = 25; // 한 합에 흡수로 채우는 체력의 끝(최대 체력 대비)
const MAX_PASSIVE_REGEN = 30; // 합마다 저절로 차는 체력과 내력의 한 싸움 끝(최대치 대비)
const MAX_MIND_HP = 50; // 한 번의 운기로 채우는 체력의 끝
const MAX_MIND_QI = 70;
const MIND_STREAK_RATE = 0.5; // 운기를 잇달아 하면 회복이 이만큼으로 준다
export const INJURY_PENALTY = 7;
const FAME_BY_TIER = { 일반: 5, 난적: 10, 강적: 20, 보스: 50 };
const STAT_GROWTH_RANGE = { 일반: [9, 18], 난적: [10, 27], 강적: [18, 37], 보스: [50, 100] };

/** 표(12달 간격)에서 해당 달의 값을 읽는다. */
function curveAt(curve, turn) {
  const position = Math.max(0, Math.min(curve.length - 1, turn / 12));
  const low = Math.floor(position);
  const high = Math.min(curve.length - 1, low + 1);
  return curve[low] + (curve[high] - curve[low]) * (position - low);
}

export class Enemy {
  /** turn을 주면 그 시기에 맞게 강해진다. 데이터의 hp와 attack은 level 달 기준 값이다. */
  constructor(key, turn = null) {
    const data = DB.enemies[key];
    if (!data) throw new Error(`알 수 없는 적: ${key}`);
    this.key = key;
    this.name = data.name;
    this.title = data.title || null;
    this.beast = !!data.beast;
    this.side = data.side || null;
    this.tier = data.tier;
    this.realm = data.realm;
    this.maxHp = data.hp;
    this.hp = data.hp;
    this.attack = data.attack;
    this.expReward = data.exp_reward;
    this.armor = data.armor || 0;
    this.evasion = data.evasion || 0;
    this.specials = data.specials || [];
    this.phases = data.phases || [];
    this.outros = data.outros || [];
    this.drop = data.drop || null;
    this.quirks = (data.quirks || []).map((q) => ({ ...q })); // 깊은 강호의 적이 지닌 괴공
    this.accuracy = data.accuracy || 0; // 손이 빨라 피할 틈을 좁히는 정도(푼)
    this.barrier = 0;        // 호체강기로 두른 강기
    this.rage = 0;           // 광기로 오른 위력(푼)
    this.risen = false;      // 불사로 한 번 다시 일어섰는가
    this.notes = [];         // 피해를 받는 동안 생긴 일
    this.intro = data.intro || null;
    this.outro = data.outro || null;
    this.sparOutro = data.spar_outro || null; // 비무에서 꺾였을 때의 말
    this.desc = data.desc || "";
    this.growthRange = STAT_GROWTH_RANGE[this.tier] || [1, 3];
    this.silverRange = data.silver || [0, 0];
    this.phase = 0;
    if (turn !== null && data.tier !== "보스" && data.level) {
      const { hp_curve: hpCurve, attack_curve: attackCurve } = DB.balance;
      const hpScale = curveAt(hpCurve, turn) / curveAt(hpCurve, data.level);
      const attackScale = curveAt(attackCurve, turn) / curveAt(attackCurve, data.level);
      this.maxHp = Math.max(1, Math.round(this.maxHp * hpScale / 5) * 5);
      this.hp = this.maxHp;
      this.attack = Math.max(1, Math.round(this.attack * attackScale));
      this.armor = Math.round(this.armor * attackScale);
    }
    // 적은 오래 버티되 한 번에 덜 아프게 친다
    const scale = DB.balance.enemy_scale;
    if (scale && data.tier !== "보스") {
      this.maxHp = Math.max(1, Math.round(this.maxHp * scale.hp / 5) * 5);
      this.hp = this.maxHp;
      this.attack = Math.max(1, Math.round(this.attack * scale.attack));
      this.armor = Math.round(this.armor * scale.armor);
    }
  }

  isAlive() { return this.hp > 0; }
  quirk(type) { return this.quirks.find((q) => q.type === type) || null; }

  takeDamage(amount) {
    // 두른 강기가 먼저 받아 낸다
    if (this.barrier > 0 && amount > 0) {
      const absorbed = Math.min(this.barrier, amount);
      this.barrier -= absorbed;
      amount -= absorbed;
      this.notes.push(`(${this.name}의 강기가 ${absorbed}만큼 막아 냈다.${this.barrier ? "" : " 강기가 깨졌다."})`);
    }
    this.hp = Math.max(0, this.hp - amount);
    const undying = this.quirk("undying");
    if (this.hp <= 0 && undying && !this.risen) {
      this.risen = true;
      this.rising = Boolean(undying.stagger); // 몸을 일으키느라 한 합을 쉬는가
      this.hp = Math.max(1, Math.trunc(this.maxHp * undying.percent / 100));
      this.notes.push(`${undying.rise || `${this.name}${josa(this.name, "이/가")} 쓰러졌다가 다시 일어선다.`} (체력 ${this.hp})`);
    }
  }

  /** 두를 강기를 채운다 */
  raiseBarrier() {
    const barrier = this.quirk("barrier");
    if (!barrier) return 0;
    this.barrier = Math.max(this.barrier, Math.trunc(this.maxHp * barrier.percent / 100));
    return this.barrier;
  }

  attackMultiplier() { return (this.phase === 0 ? 1 : this.phases[this.phase - 1].attack_mult) * (1 + this.rage / 100); }

  /** 체력이 다음 단계 기준 아래로 내려가면 단계를 올리고 그 단계를 돌려준다. */
  advancePhase() {
    if (this.phase < this.phases.length) {
      const next = this.phases[this.phase];
      if (this.hp <= this.maxHp * next.hp_pct / 100) {
        this.phase += 1;
        if (next.specials) this.specials = next.specials;
        // 단계가 바뀌면 숨겨 둔 괴공을 꺼낸다. 같은 괴공은 새것으로 바꾼다
        for (const q of next.quirks || []) {
          this.quirks = [...this.quirks.filter((own) => own.type !== q.type), { ...q }];
        }
        return next;
      }
    }
    return null;
  }

  /** 기세를 꺾으려면 그 합에 깎아야 하는 체력. 꺾을 수 없는 필살기면 0 */
  breakNeed(special) { return special?.break_pct ? Math.max(1, Math.trunc(this.maxHp * special.break_pct / 100)) : 0; }

  /** 이 합의 필살기. 주기가 긴 것을 우선한다. */
  specialForRound(round) {
    let chosen = null;
    for (const special of this.specials) {
      if (round % special.every === 0 && (!chosen || special.every > chosen.every)) chosen = special;
    }
    return chosen;
  }
}

/**
 * 장에 맞는 적을 찾는다. 적의 ranks는 어울리는 장의 범위이고, above와 below는 같은 갈래의
 * 윗길과 아랫길이다. 사문의 시험처럼 정해진 인물은 ranks가 없어 그대로 나온다.
 */
/** 떨어질 비급. 적이 품은 무공이 있으면 그것을, 없으면 그 경지의 품계에서 고른다. 주무공 계열일수록 잘 나온다. */
const HIGH_SCHOOL_GRADES = ["상승", "일절", "신공"]; // 문파의 높은 무공은 소속의 사건에서만 나온다

export function dropSkill(player, hint, grades, faction = null) {
  if (hint && rng.random() < DROP_HINT_RATE && grades.includes(DB.skills[hint].grade)) return hint;
  const main = player.bestSkill()?.category;
  const pool = Object.keys(DB.skills).filter((k) => {
    const s = DB.skills[k];
    // 문파의 무공은 그 문파 사람만 지니고 있다
    return grades.includes(s.grade) && !s.origin && !s.legend && !s.reserved && (!s.school || (s.school === faction && !HIGH_SCHOOL_GRADES.includes(s.grade)));
  });
  if (!pool.length) return null;
  const counts = {};
  for (const k of pool) counts[DB.skills[k].category] = (counts[DB.skills[k].category] || 0) + 1;
  const luck = 1 + sumEffect(player.traits, "main_style_luck", "percent") / 100;
  return pickWeighted(pool, pool.map((k) => (DB.skills[k].category === main ? DROP_MAIN_RATE * luck : DROP_OTHER_RATE) / counts[DB.skills[k].category]));
}

export function statureEnemy(key, chapter) {
  let current = key;
  for (let i = 0; i < 8; i++) {
    const { ranks, above, below } = DB.enemies[current];
    if (!ranks) return current;
    if (chapter > ranks[1] && above) current = above;
    else if (chapter < ranks[0] && below) current = below;
    else return current;
  }
  return current;
}

export const enemyPool = (chapter) =>
  Object.keys(DB.enemies).filter((k) => (DB.enemies[k].chapters || []).includes(chapter));

export function useConsumable(player, key) {
  const rate = 1 + sumEffect(player.traits, "consumable_rate", "percent") / 100;
  const notes = [];
  for (const effect of DB.market[key].effects) {
    if (effect.type === "heal") {
      if (effect.stat === "hp") player.healPercent(effect.percent * rate, 0);
      else player.healPercent(0, effect.percent * rate);
    } else if (effect.type === "mastery") {
      const main = player.bestSkill();
      if (main) notes.push(...main.gainMastery(!effect.style || main.category === effect.style ? effect.amount : Math.floor(effect.amount / 2)));
    } else if (effect.type === "cure" && effect.what === "injury") {
      player.addInjury(-(effect.amount ?? 1));
    } else if (effect.type === "stat") {
      notes.push(`${STAT_NAMES[effect.stat]}+${player.gainStat(effect.stat, effect.amount)}`);
    }
  }
  // 영약을 삼키거나 서책을 읽으면 그 기운을 갈무리하며 심법도 깊어진다
  const raised = DB.market[key].effects.filter((e) => e.type === "stat" && e.amount > 0).reduce((sum, e) => sum + e.amount, 0);
  const mind = raised && player.bestOfType("심공");
  if (mind) notes.push(...mind.gainMastery(Math.max(1, Math.round(raised / ITEM_MIND_MASTERY_RATE))));
  player.inventory[key] -= 1;
  if (player.inventory[key] <= 0) delete player.inventory[key];
  return notes;
}

export class Battle {
  constructor(player, enemy, isFinal = false) {
    this.player = player;
    this.enemy = enemy;
    this.log = [];
    this.roundNum = 0;
    this.isFinal = isFinal;
    this.tempBuffs = [];
    this.poison = null;
    this.atkBuff = null;
    this.counterPct = 0;
    this.sealed = 0;
    this.enemyPoison = null;
    this.interlude = null;   // 결전의 막간. 고르기 전에는 합이 진행되지 않는다
    this.guard = null;
    this.alliesSeen = [];
    this.spar = false;       // 비무. 져도 죽지 않고 보상이 없다
    this.oneOff = false;     // 사건만의 상대. 이름 있는 적으로 치지 않는다
    this.guardedLast = 0;
    this.chainStacks = 0;    // 끊이지 않고 이어 맞힌 수
    this.forceCrit = false;  // 다음 공격은 회심
    this.enemyStun = false;  // 다음 합에 적이 움직이지 못한다
    this.enemyWeaken = null; // 적의 위력 감소
    this.burn = null;        // 적이 입는 지속 피해
    this.bleed = null;       // 칼자국에서 흐르는 피. 겹쳐 쌓인다
    this.shred = 0;          // 깎아 낸 적의 방어(푼)
    this.beats = 0;          // 장단을 타는 무공을 펼친 수
    this.ward = 0;           // 피해를 대신 받는 호신 기운
    this.regen = null;       // 합마다 차오르는 체력과 내력
    this.reflect = null;     // 받은 피해를 되돌림
    this.lifestealBuff = null;
    this.askStand = false;      // 쓰러지는 순간 선천진기를 일으킬지 플레이어에게 묻는다
    this.standPending = false;
    this.stepStreak = 0;     // 경공을 잇달아 펼친 수
    this.mindStreak = 0;     // 운기를 잇달아 한 수
    this.stolen = 0;         // 이번 합에 흡수한 체력
    this.regenUsedHp = 0;    // 이번 싸움에 저절로 찬 체력
    this.regenUsedQi = 0;
    this.stunRest = false;   // 굳었다 풀린 다음 합
    this.companions = isFinal ? activeCompanions(player) : [];
    this.innate = false; // 선천진기를 일으켰는가
    this.freeItemUsed = false;  // 한 합에 도구 하나는 합을 쓰지 않는다
    this.weaponG = gearGimmick(player, "weapon");
    this.armorG = gearGimmick(player, "armor");
    // 심법의 묘리는 운기하지 않아도 늘 몸에 흐른다
    this.mindG = player.bestOfType("심공")?.activeGimmick() || null;
    this.marks = 0;          // 표식을 새긴 수
    this.momentum = 0;       // 피할 때마다 쌓인 기세(푼)
    this.afterimage = 0;     // 잔상이 남아 다음 합에 저절로 피할 몫
    this.secondWind = false; // 한 싸움에 한 번 숨이 트였는가
    this.dealt = 0;          // 이번 합에 적에게 쏟은 힘
    const ward = Math.min(MAX_START_WARD, sumEffect(player.traits, "battle_start_ward", "percent") + (this.armorG?.start_ward || 0) + (this.mindG?.ward || 0));
    if (ward) {
      this.ward = Math.trunc(player.maxHp() * ward / 100);
      this.log.push(`(몸 둘레에 호신 기운이 선다. ${this.ward})`);
    }
    // 깊은 강호의 적이 지닌 괴공
    player.healCut = 0;
    for (const q of enemy.quirks || []) {
      this.log.push(`(괴공 ${quirkText(q)})`);
      if (q.type === "sever") player.healCut = Math.min(MAX_HEAL_CUT, q.percent);
    }
    if (enemy.raiseBarrier?.()) this.log.push(`(${enemy.name}${josa(enemy.name, "이/가")} 강기를 두른다. ${enemy.barrier})`);
    // 전투 시작 시 발동하는 특성 효과 (한계 무시, 전투가 끝나면 되돌림)
    const raised = new Map();
    for (const buff of battleBuffs(player.traits, "on_battle_start")) {
      player[buff.stat] += buff.amount;
      this.tempBuffs.push([buff.stat, buff.amount]);
      raised.set(buff.amount, [...(raised.get(buff.amount) ?? []), STAT_NAMES[buff.stat]]);
    }
    for (const [amount, names] of raised) {
      this.log.push(`(자질 효과: ${names.length === 4 ? "네 기량" : names.join(", ")} 전투 중 +${amount})`);
    }
  }

  revertTempBuffs() {
    for (const [stat, amount] of this.tempBuffs) this.player[stat] -= amount;
    this.tempBuffs = [];
    this.player.clampVitals();
  }

  applyBattleEndBuffs() {
    for (const buff of battleBuffs(this.player.traits, "on_battle_end")) {
      if (buff.stat === "hp") {
        const [healed] = this.player.healPercent(buff.percent, 0);
        this.log.push(`(자질 효과: 체력 +${healed})`);
      } else if (buff.stat === "qi") {
        const [, healed] = this.player.healPercent(0, buff.percent);
        this.log.push(`(자질 효과: 내력 +${healed})`);
      }
    }
  }

  // ---------- 피해 계산 ----------

  attackScale() {
    const p = this.player;
    let scale = 1 + realmBonus(p.realm);
    scale *= 1 + veteranBonus(p).damage / 100;
    if (this.innate) scale *= 1 + INNATE_POWER / 100;
    scale *= 1 + sumEffect(p.traits, "damage_bonus", "percent") / 100;
    scale *= 1 + Math.min(MAX_KILL_POWER, p.kills * sumEffect(p.traits, "kill_power", "percent")) / 100;
    scale *= 1 + sectBonus(p, "damage") / 100;
    scale *= 1 - p.injury * INJURY_PENALTY / 100;
    scale *= 1 + alignValue(p.alignment, "마도", "damage") / 100;
    for (const c of this.companions) scale *= 1 + (c.help.atk || 0) / 100;
    if (this.atkBuff) scale *= 1 + this.atkBuff.percent / 100;
    if (this.momentum) scale *= 1 + this.momentum / 100;
    scale *= 1 + p.idleBonus("공격무공") / 100;
    return scale;
  }

  attackPower(skill = null) {
    const p = this.player;
    let base = (p.external * POWER_RATES.external + p.martial * POWER_RATES.martial + p.internal * POWER_RATES.internal + p.mind * POWER_RATES.mind) / STAT_SCALE + equipmentBonus(p, "weapon");
    if (skill) base *= skill.effectiveMultiplier();
    return Math.max(1, Math.trunc(base * this.attackScale()));
  }

  secretPower(skill) {
    const p = this.player;
    const base = (p.external * POWER_RATES.external + p.martial * POWER_RATES.martial + p.internal * SECRET_INTERNAL_RATE + p.mind * POWER_RATES.mind) / STAT_SCALE + equipmentBonus(p, "weapon");
    return Math.max(1, Math.trunc(base * skill.effectiveMultiplier() * skill.secretMultiplier * this.attackScale()
      * (1 + sumEffect(p.traits, "secret_power", "percent") / 100)));
  }

  hits(accuracy = 0) {
    const bonus = sumEffect(this.player.traits, "hit_bonus", "percent") / 100;
    return rng.random() < BASE_HIT + bonus + accuracy / 100 + this.player.martial * 0.0001 - this.enemy.evasion;
  }

  critChance() {
    const p = this.player;
    return Math.min(MAX_CRIT, p.mind / 4000 + (sumEffect(p.traits, "crit", "percent") + sectBonus(p, "crit") + alignValue(p.alignment, "사도", "crit") + (this.mindG?.focus || 0)) / 100);
  }

  /** 무공의 묘리에 병기의 영기를 더한다 */
  strikeGimmick(skill) {
    const own = skill?.activeGimmick() || {};
    const gear = this.weaponG;
    if (!gear) return own;
    const merged = { ...own };
    for (const [k, v] of Object.entries(gear)) {
      if (typeof v === "number") merged[k] = (merged[k] || 0) + v;
      else if (!merged[k]) merged[k] = v;
    }
    return merged;
  }

  strike(power, label, skill = null) {
    const g = this.strikeGimmick(skill);
    if (!this.hits(g.accuracy || 0)) {
      this.log.push(`${label}${josa(label, "을/를")} 펼쳤지만 ${this.enemy.name}${josa(this.enemy.name, "이/가")} 몸을 틀어 피했다.`);
      this.counterPct = 0;
      this.chainStacks = 0;
      return 0;
    }
    let damage = power * uniform(0.9, 1.1);
    const notes = [];
    const p = this.player;
    if (g.power) damage *= 1 + g.power / 100;
    if (g.opening && this.roundNum <= 1) damage *= 1 + g.opening / 100;
    if (g.low_hp && p.hp <= p.maxHp() / 2) damage *= 1 + g.low_hp / 100;
    if (g.vs_side && g.vs_side[this.enemy.side]) damage *= 1 + g.vs_side[this.enemy.side] / 100;
    if (g.execute && this.enemy.hp <= this.enemy.maxHp * g.execute.below / 100) {
      damage *= 1 + g.execute.percent / 100;
      notes.push(this.spar ? "흔들린 빈틈을 파고들었다." : "숨통을 노렸다.");
    }
    if (g.chain) {
      damage *= 1 + Math.min(g.chain_max, this.chainStacks * g.chain) / 100;
      this.chainStacks += 1;
    }
    if (this.roundNum <= 1) damage *= 1 + sumEffect(p.traits, "first_strike", "percent") / 100;
    // 몰릴수록 강해지는 효과는 조건이 맞는 것끼리 더한다
    const desperate = p.traits.flatMap((k) => DB.traits[k]?.effects || [])
      .filter((e) => e.type === "low_hp_power" && p.hp <= p.maxHp() * e.below / 100)
      .reduce((sum, e) => sum + e.percent, 0);
    if (desperate) {
      damage *= 1 + desperate / 100;
      notes.push("배수진이다.");
    }
    if (this.counterPct) {
      damage *= 1 + this.counterPct / 100;
      notes.push("빈틈을 찔렀다.");
      this.counterPct = 0;
    }
    let crit = false;
    if (this.forceCrit || rng.random() < Math.min(MAX_CRIT, this.critChance() + (g.crit || 0) / 100)) {
      crit = true;
      this.forceCrit = false;
      damage *= 1.5 + (sumEffect(p.traits, "crit_power", "percent") + (g.crit_power || 0)) / 100;
      notes.push("회심의 일격이다.");
    }
    const pierce = Math.min(100, (g.pierce || 0) + sumEffect(p.traits, "pierce_all", "percent"));
    damage = Math.max(1, Math.trunc(damage) - Math.trunc(this.enemy.armor * (1 - this.shred / 100) * (1 - pierce / 100)));
    // 표식이 정해진 수만큼 쌓이면 방어를 무시하고 터진다
    if (g.mark) {
      this.marks += 1;
      if (this.marks % g.mark.every === 0) {
        const burst = Math.max(1, Math.trunc(damage * g.mark.percent / 100));
        damage += burst;
        notes.push(`쌓인 표식이 터졌다(+${burst}).`);
      }
    }
    this.enemy.takeDamage(damage);
    const suffix = notes.length ? ` ${notes.join(" ")}` : "";
    this.log.push(`${label}${josa(label, "으로")} ${this.enemy.name}에게 ${damage}의 피해를 입혔다.${suffix}`);
    this.flushEnemyNotes();
    const mirror = this.enemy.quirk("mirror");
    if (mirror) {
      // 되돌아온 힘으로는 쓰러지지 않는다
      const back = Math.min(Math.max(0, p.hp - 1), Math.trunc(damage * Math.min(MAX_MIRROR, mirror.percent) / 100));
      if (back > 0) {
        p.hp -= back;
        this.log.push(`(${this.enemy.name}의 몸이 힘을 되돌려 보냈다. 체력 -${back})`);
      }
    }
    this.applyPoisonOnHit(skill, g);
    this.applyGimmickOnHit(g, damage);
    if (crit && g.crit_ward) this.addWard(Math.trunc(damage * g.crit_ward / 100), "회심의 기운이 몸을 두른다");
    // 여운이 남는 초식은 때로 한 번 더 닿는다. 여운은 다시 여운을 낳지 않는다
    if (g.echo && !this.echoing && this.enemy.isAlive() && rng.random() * 100 < g.echo) {
      this.echoing = true;
      damage += this.strike(Math.max(1, Math.trunc(power * ECHO_RATE)), "남은 여운", skill);
      this.echoing = false;
    }
    return damage;
  }

  /** 호신 기운을 더한다. 쌓을 수 있는 양에는 끝이 있다 */
  addWard(amount, why) {
    const cap = Math.trunc(this.player.maxHp() * MAX_WARD / 100);
    const before = this.ward;
    this.ward = Math.min(cap, this.ward + Math.max(0, amount));
    if (this.ward > before) this.log.push(`(${why}. 호신 기운 ${this.ward})`);
  }

  /** 맞힌 뒤에 드러나는 무공의 묘리 */
  applyGimmickOnHit(g, damage) {
    const p = this.player;
    const steal = (g.lifesteal || 0) + (this.lifestealBuff?.percent || 0) + (this.mindG?.lifesteal_buff ? Math.floor(this.mindG.lifesteal_buff.percent / 2) : 0);
    if (steal) {
      // 큰 피해를 주어도 한 합에 빨아들이는 양에는 끝이 있다
      const room = Math.max(0, Math.trunc(p.maxHp() * MAX_LIFESTEAL_PCT / 100) - this.stolen);
      const [healed] = p.healAmount(Math.min(room, Math.trunc(damage * steal / 100)), 0);
      this.stolen += Math.max(0, healed);
      if (healed > 0) this.log.push(`(기운을 빨아들였다. 체력 +${healed})`);
    }
    if (g.qi_back) p.healPercent(0, g.qi_back);
    if (g.burn) this.burn = { damage: Math.max(1, Math.trunc(damage * g.burn / 100)), rounds: 2 };
    if (g.bleed) {
      // 베인 자리에 또 베이면 피가 더 흐른다. 다만 한 번에 흐르는 양에는 끝이 있다
      const add = Math.max(1, Math.trunc(damage * g.bleed / 100));
      const cap = Math.trunc(this.enemy.maxHp * MAX_BLEED_PCT / 100);
      this.bleed = { damage: Math.min(cap, (this.bleed?.damage || 0) + add), rounds: 3 };
    }
    if (g.shatter && this.shred < MAX_SHRED) {
      this.shred = Math.min(MAX_SHRED, this.shred + g.shatter);
      this.log.push(`(${this.enemy.name}의 방어가 깎였다. 지금까지 ${halpun(this.shred)})`);
    }
    if (g.weaken) {
      this.enemyWeaken = { percent: g.weaken.percent, rounds: g.weaken.rounds };
      this.log.push(`(${this.enemy.name}의 기세가 꺾였다.)`);
    }
    if (g.guard) this.guard = { percent: Math.max(g.guard, this.guard?.percent || 0), rounds: 1 };
    if (g.stun && !this.enemyStun && !this.stunRest && rng.random() * 100 < (this.isFinal ? g.stun / 2 : g.stun)) {
      this.enemyStun = true;
      this.log.push(`(${this.enemy.name}의 몸이 굳었다.)`);
    }
  }

  applyPoisonOnHit(skill, g = null) {
    let power = sectBonus(this.player, "poison");
    if (skill?.inflict) power += skill.inflict.poison || 0;
    power += g ? g.poison || 0 : skill?.activeGimmick()?.poison || 0;
    power += sumEffect(this.player.traits, "inflict_poison", "power");
    if (power) this.enemyPoison = { damage: power + Math.floor(this.player.internal / 50), rounds: 3 };
  }

  skillLabel(skill) {
    // 경지가 오르면 초식에 검기나 검강 같은 기운이 실린다
    const aura = this.auraName(skill);
    const lead = aura ? `${aura}${josa(aura, "을/를")} 실은 ` : "";
    if (!skill.forms.length) return `${lead}${skill.name}`;
    const index = randInt(0, skill.forms.length - 1);
    return `${lead}${skill.name} 제${index + 1}초 ${skill.forms[index]}`;
  }

  auraName(skill) {
    const names = DB.realms.aura?.[skill.category];
    const step = realmIndex(this.player.realm);
    if (!names || step < 1) return null;
    return names[step >= 2 ? 1 : 0];
  }

  // ---------- 플레이어 행동 ----------

  basicAttack() { return this.strike(this.attackPower(), "맨손 일격"); }

  /** 자질을 뺀 공격무공의 내력 소모 */
  artCost(skill) {
    return Math.ceil(skill.qiCost * (1 - sumEffect(this.player.traits, "qi_cost_cut", "percent") / 100));
  }

  useSkill(skill) {
    if (this.sealed) {
      this.log.push("혈도가 막혀 무공을 펼칠 수 없다.");
      return this.basicAttack();
    }
    if (this.player.qi < this.artCost(skill)) {
      this.log.push(`내력이 모자라 ${skill.name}${josa(skill.name, "을/를")} 펼치지 못했다.`);
      return this.basicAttack();
    }
    this.player.qi -= this.artCost(skill);
    const g = skill.activeGimmick();
    const count = g?.hits || 1;
    const label = this.skillLabel(skill);
    // 장단을 타는 무공은 정해진 수마다 초식이 맺혀 크게 터진다
    this.beats += g?.rhythm ? 1 : 0;
    const beat = g?.rhythm && this.beats % g.rhythm.every === 0 ? 1 + g.rhythm.percent / 100 : 1;
    if (beat > 1) this.log.push(`${skill.name}의 초식이 맺혔다.`);
    let damage = 0;
    // 나눠 치는 무공은 한 번마다 명중과 회심을 따로 가린다
    for (let i = 0; i < count && this.enemy.isAlive(); i++) {
      const power = Math.max(1, Math.trunc(this.attackPower(skill) * (g?.hit_rate || 1) * beat));
      // 나눠 칠 때 초식 이름은 첫 타에만 쓴다
      damage += this.strike(power, count > 1 ? `${i === 0 ? `${label} ` : ""}제${i + 1}타` : label, skill);
    }
    this.applyRecoil(g);
    this.log.push(...skill.gainMastery(this.player.attackMasteryGain()));
    return damage;
  }

  useSecret(skill) {
    if (!skill.secretUnlocked) {
      this.log.push(`${skill.name}의 비기는 아직 터득되지 않았다.`);
      return 0;
    }
    if (this.player.qi < skill.secretQiCost) {
      this.log.push(`내력이 모자라 비기를 펼치지 못했다. (내력 ${skill.secretQiCost} 필요)`);
      return 0;
    }
    if (this.sealed) {
      this.log.push("혈도가 막혀 비기를 펼칠 수 없다.");
      return 0;
    }
    this.player.qi -= skill.secretQiCost;
    const damage = this.strike(this.secretPower(skill), `비기 ${skill.secretName}`, skill);
    this.applyRecoil(skill.activeGimmick());
    this.checkQiDeviation(skill);
    this.log.push(...skill.gainMastery(this.player.attackMasteryGain()));
    return damage;
  }

  /** 몸을 태워 힘을 내는 무공의 대가. 이것으로 쓰러지지는 않는다. */
  applyRecoil(g) {
    if (!g?.recoil) return;
    const p = this.player;
    const lost = Math.min(p.hp - 1, Math.trunc(p.maxHp() * g.recoil / 100));
    if (lost > 0) {
      p.hp -= lost;
      this.log.push(`(기운이 몸을 태운다. 체력 -${lost})`);
    }
  }

  /** 주화입마: 마공의 비기는 심경이 700보다 낮을수록 위험하다. */
  checkQiDeviation(skill) {
    if (!skill.risky) return;
    if (rng.random() < Math.max(0, 700 - this.player.mind) * 0.0015) {
      this.player.addInjury(1);
      this.log.push(`기가 역류한다. 주화입마의 기운에 내상을 입었다. (내상 ${this.player.injury}단계)`);
    }
  }

  useMindset() {
    const p = this.player;
    const skill = p.bestOfType("심공");
    if (!skill) {
      this.log.push("아직 익힌 심법이 없다.");
      return;
    }
    const boost = 1 + (sectBonus(p, "heal_bonus") + sumEffect(p.traits, "mindset_power", "percent")) / 100;
    const hpValue = skill.effectValue("heal_hp_pct");
    const qiValue = skill.effectValue("heal_qi_pct");
    // 운기 한 번에 채우는 양에는 끝이 있고, 잇달아 운기하면 숨이 얕아진다
    const shallow = this.mindStreak > 0 ? MIND_STREAK_RATE : 1;
    const hpGain = hpValue > 0 ? Math.min(MAX_MIND_HP, hpValue * boost) * shallow : hpValue;
    const [hpChange, qiChange] = p.healPercent(hpGain, Math.min(MAX_MIND_QI, qiValue * boost) * shallow);
    const signed = (n) => (n >= 0 ? `+${n}` : `${n}`);
    this.log.push(`${skill.name}${josa(skill.name, "을/를")} 운기했다. (체력 ${signed(hpChange)}, 내력 ${signed(qiChange)})`);
    if (this.sealed) {
      this.sealed = 0;
      this.log.push("막혔던 혈도가 풀렸다.");
    }
    const percent = skill.effectValue("atk_buff_pct");
    const rounds = skill.effect.buff_rounds || 0;
    if (percent > 0 && rounds > 0) {
      this.atkBuff = { percent, rounds: rounds + 1 };
      this.log.push(`기세가 오른다. (${rounds}합 동안 위력 +${halpun(percent)})`);
    }
    this.log.push(...skill.gainMastery(p.masteryGainAmount() * ART_USE_RATE));
  }

  /** 심법의 묘리는 늘 흐른다. 정해진 합마다 모은 숨을 터뜨린다 */
  mindSurge() {
    const g = this.mindG;
    if (!g || this.roundNum % MIND_SURGE_EVERY !== 0) return;
    if (g.next_power) {
      this.counterPct = Math.max(this.counterPct, g.next_power);
      this.log.push(`(${g.name}: 모은 숨이 차올랐다. 이번 공격 +${halpun(g.next_power)})`);
    }
    if (g.next_crit) {
      this.forceCrit = true;
      this.log.push(`(${g.name}: 숨이 한 점에 모였다. 이번 공격은 반드시 회심)`);
    }
  }

  /** 심법이 늘 줄여 주는 피해 */
  mindGuard() {
    const g = this.mindG;
    return g?.guard ? Math.min(MAX_PASSIVE_GUARD, Math.floor(g.guard.percent / 2)) : 0;
  }

  useMovement() {
    const skill = this.player.bestOfType("경공");
    if (!skill) {
      this.log.push("아직 익힌 경공이 없다.");
      return null;
    }
    if (this.player.qi < skill.qiCost) {
      this.log.push("내력이 모자라 경공을 펼치지 못했다.");
      return null;
    }
    this.player.qi -= skill.qiCost;
    this.log.push(`${skill.name}${josa(skill.name, "으로")} 몸을 띄웠다.`);
    this.log.push(...skill.gainMastery(this.player.masteryGainAmount() * ART_USE_RATE));
    return skill;
  }

  useItem(key, free = false) {
    if (!(this.player.inventory[key] > 0) || !DB.market[key]) {
      this.log.push("행낭에 없는 물건이다.");
      return;
    }
    const item = DB.market[key];
    if (item.effects.some((e) => e.type === "cure" && e.what === "poison")) this.poison = null;
    const extra = free ? 0 : 1; // 합을 쓰지 않으면 이번 합의 몫을 덜 깎인다
    const tool = item.effects.find((e) => e.type === "atk_buff");
    if (tool) {
      const full = !tool.style || this.player.bestSkill()?.category === tool.style;
      this.atkBuff = { percent: full ? tool.percent : Math.floor(tool.percent / 2), rounds: tool.rounds + extra };
    }
    for (const e of item.effects) {
      if (e.type === "ward") this.ward = Math.max(this.ward, Math.trunc(this.player.maxHp() * Math.min(MAX_WARD, e.percent) / 100));
      if (e.type === "guard_buff") this.guard = { percent: e.percent, rounds: e.rounds + extra };
      if (e.type === "enemy_weaken") this.enemyWeaken = { percent: e.percent, rounds: e.rounds + extra };
      if (e.type === "enemy_stun") this.enemyStun = true;
      if (e.type === "next_crit") this.forceCrit = true;
      if (e.type === "burst") {
        const damage = Math.trunc(this.enemy.maxHp * (this.isFinal ? e.percent / 3 : e.percent) / 100);
        this.enemy.takeDamage(damage);
        this.log.push(`${item.name}${josa(item.name, "이/가")} 터졌다. ${this.enemy.name}에게 ${damage}의 피해를 입혔다.`);
      }
    }
    const notes = useConsumable(this.player, key);
    this.log.push(`${item.name}${josa(item.name, "을/를")} 썼다. (${item.desc})`, ...notes);
  }

  flee() {
    let chance = FLEE_BASE;
    const skill = this.player.bestOfType("경공");
    if (skill) chance += skill.effectValue("flee_bonus") / 100;
    chance += sumEffect(this.player.traits, "flee_rate", "percent") / 100;
    if (rng.random() < Math.min(MAX_FLEE, chance)) {
      this.log.push("도주에 성공했다.");
      return true;
    }
    this.log.push("도주에 실패했다.");
    return false;
  }

  // ---------- 적 행동 ----------

  incoming(multiplier = 1) {
    const full = this.enemy.attack * this.enemy.attackMultiplier() * multiplier;
    let base = full;
    if (this.enemyWeaken) base *= 1 - this.enemyWeaken.percent / 100;
    base *= 1 - realmBonus(this.player.realm) / 2;
    base *= 1 - veteranBonus(this.player).reduce / 100;
    if (this.innate) base *= 1 - INNATE_POWER / 100;
    base *= 1 - Math.min(MAX_MIND_GUARD, this.player.mind / MIND_GUARD_RATE);
    base *= 1 - sectBonus(this.player, "damage_reduce") / 100;
    base *= 1 - alignValue(this.player.alignment, "정도", "guard") / 100;
    base *= 1 - Math.min(MAX_DAMAGE_REDUCE, sumEffect(this.player.traits, "damage_reduce", "percent") + fameEffect(this.player, "fame_guard")) / 100;
    base *= 1 - fameEffect(this.player, "fame_dread") / 100;
    if (this.guard) base *= 1 - this.guard.percent / 100;
    if (this.armorG?.guard_pct) base *= 1 - this.armorG.guard_pct / 100;
    for (const c of this.companions) base *= 1 - (c.help.guard || 0) / 100;
    base *= 1 - this.mindGuard() / 100;
    const last = this.armorG?.last_guard;
    if (last && this.player.hp <= this.player.maxHp() * last.below / 100) base *= 1 - Math.min(MAX_LAST_GUARD, last.percent) / 100;
    // 무엇을 겹쳐도 무적이 되지는 않는다
    base = Math.max(base, full * MIN_TAKEN);
    const blow = Math.trunc(base * uniform(0.9, 1.1));
    const raw = Math.max(1, Math.ceil(blow * MIN_THROUGH_ARMOR), blow - equipmentBonus(this.player, "armor"));
    // 호신강기는 맞는 피해를 몇 푼 줄인다
    const guard = Math.min(MAX_AURA_GUARD, sumEffect(this.player.traits, "aura_guard", "percent"));
    const taken = guard ? Math.round(raw * (1 - guard / 100)) : raw;
    this.guardedLast = raw - taken;
    // 호신구와 호신강기까지 겹쳐도 맞는 힘의 1할은 몸에 닿는다
    return Math.max(1, taken, Math.ceil(full * MIN_FINAL_TAKEN));
  }

  enemyAttack(evadeSkill = null) {
    if (this.enemy.rising) {
      this.enemy.rising = false;
      this.log.push(`${this.enemy.name}${josa(this.enemy.name, "이/가")} 몸을 일으키느라 이번 합에 손을 쓰지 못했다.`);
      return 0;
    }
    let special = this.enemy.specialForRound(this.roundNum);
    const need = this.enemy.breakNeed(special);
    let multiplier = special ? special.mult : 1;
    if (need && this.dealt > need && !this.enemyStun) {
      // 끌어올리던 기세가 쏟아진 힘에 꺾였다
      this.log.push(`쏟아부은 ${this.dealt}의 힘에 ${special.name}의 기세가 꺾였다.`);
      multiplier = special.break_mult ?? BROKEN_CHARGE_MULT;
      special = null;
    }
    const name = special ? `${special.name}` : "공격";
    if (this.enemyStun) {
      this.enemyStun = false;
      this.stunRest = true; // 풀린 다음 합에는 다시 굳지 않는다
      this.log.push(`${this.enemy.name}${josa(this.enemy.name, "이/가")} 몸을 추스르느라 이번 합에 손을 쓰지 못했다.`);
      return 0;
    }
    this.stunRest = false;

    const g = evadeSkill?.activeGimmick();
    if (evadeSkill) {
      // 잇달아 펼치면 걸음을 읽힌다
      const chance = this.evadeChance(evadeSkill, this.roundNum, this.stepStreak);
      if (this.stepStreak > 1) this.log.push(`${this.enemy.name}${josa(this.enemy.name, "이/가")} 걸음을 읽기 시작했다.`);
      if (special?.accuracy) this.log.push(`${name}${josa(name, "은/는")} 피할 틈이 좁다.`);
      if (randInt(1, 100) <= chance) {
        const counter = Math.trunc(evadeSkill.effectValue("counter_pct") * (special ? 1 : NORMAL_COUNTER_RATE));
        this.log.push(`${this.enemy.name}의 ${name}${josa(name, "을/를")} 흘려냈다. (다음 공격 +${halpun(counter)})`);
        // 되받아치기는 빈틈을 찌르는 힘을 쓰지 않는다. 그 힘은 다음 공격의 몫이다
        this.afterEvade(evadeSkill, g);
        this.counterPct = counter;
        return 0;
      }
    } else {
      // 묘리를 깨친 경공은 때로 몸이 먼저 움직인다
      const steps = this.player.bestOfType("경공");
      const auto = Math.min(MAX_AUTO_EVADE, (steps?.activeGimmick()?.auto_evade || 0) + (this.armorG?.auto_evade || 0) + this.afterimage);
      this.afterimage = 0;
      if (auto && !this.sealed && rng.random() * 100 < auto) {
        this.log.push(`몸이 저절로 움직였다. ${this.enemy.name}의 ${name}${josa(name, "이/가")} 빗나갔다.`);
        return 0;
      }
    }

    let damage = this.incoming(multiplier);
    if (evadeSkill) {
      // 다 피하지 못해도 몸을 띄운 만큼 덜 맞는다
      const rate = g?.partial ?? 0.5;
      damage = Math.max(1, Math.floor(damage * rate));
      this.log.push(`다 피하지는 못했지만 몸을 띄운 덕에 위력이 ${halpun(Math.round((1 - rate) * 100))} 줄었다.`);
    }
    const shield = Math.min(MAX_QI_SHIELD, this.mindG?.qi_shield || 0);
    if (shield && this.player.qi > 0) {
      const paid = Math.min(this.player.qi, Math.trunc(damage * shield / 100));
      if (paid > 0) {
        this.player.qi -= paid;
        damage -= paid;
        this.log.push(`(내력으로 ${paid}의 힘을 받아 냈다.)`);
      }
    }
    if (this.ward > 0) {
      const absorbed = Math.min(this.ward, damage);
      this.ward -= absorbed;
      damage -= absorbed;
      this.log.push(`호신 기운이 ${absorbed}만큼 대신 받아 냈다.${this.ward ? "" : " 호신 기운이 흩어졌다."}`);
    }
    this.player.hp = Math.max(0, this.player.hp - damage);
    this.log.push(`${this.enemy.name}의 ${name}${josa(name, "에/에")} ${damage}의 피해를 입었다.${special && this.guardedLast ? ` (호신강기가 ${this.guardedLast}을 막았다)` : ""}`);
    const thirst = this.enemy.quirk("bloodthirst");
    if (thirst && damage > 0 && this.enemy.hp < this.enemy.maxHp) {
      const drink = Math.min(this.enemy.maxHp - this.enemy.hp, Math.trunc(damage * Math.min(MAX_BLOODTHIRST, thirst.percent) / 100));
      if (drink > 0) {
        this.enemy.hp += drink;
        this.log.push(`(${this.enemy.name}${josa(this.enemy.name, "이/가")} 흘린 피를 삼켰다. 체력 +${drink})`);
      }
    }
    const thorns = Math.min(MAX_THORNS, (this.reflect?.percent || 0) + (this.armorG?.thorns || 0) + (this.mindG?.reflect ? Math.floor(this.mindG.reflect.percent / 2) : 0));
    if (thorns && damage > 0) {
      const back = Math.max(1, Math.trunc(damage * thorns / 100));
      this.enemy.takeDamage(back);
      this.log.push(`받은 힘이 되돌아갔다. ${this.enemy.name}에게 ${back}의 피해.`);
    }
    const wind = this.mindG?.second_wind;
    if (wind && !this.secondWind && this.player.hp > 0 && this.player.hp <= this.player.maxHp() * wind.below / 100) {
      this.secondWind = true;
      const [healed] = this.player.healPercent(Math.min(MAX_SECOND_WIND, wind.percent), 0);
      this.log.push(`(${this.mindG.name}: 막혔던 숨이 트였다. 체력 +${healed})`);
    }
    this.checkRevive();
    if (special && !this.standPending) this.applySpecialEffects(special);
    return damage;
  }

  /** 경공으로 다 피한 뒤의 묘리 */
  afterEvade(skill, g) {
    if (!g) return;
    const p = this.player;
    if (g.refund) {
      p.qi = Math.min(p.maxQi(), p.qi + Math.floor(skill.qiCost * REFUND_RATE));
      this.log.push("(힘을 들이지 않았다. 쓴 내력의 절반을 되찾았다.)");
    }
    if (g.next_crit) this.forceCrit = true;
    if (g.afterimage) {
      this.afterimage = g.afterimage;
      this.log.push("(잔상이 남았다. 다음 합에는 몸이 먼저 움직일 수 있다.)");
    }
    if (g.momentum && this.momentum < MAX_STEP_MOMENTUM) {
      this.momentum = Math.min(MAX_STEP_MOMENTUM, this.momentum + g.momentum);
      this.log.push(`(피할수록 기세가 오른다. 위력 +${halpun(this.momentum)})`);
    }
    if (g.next_power) {
      this.counterPct = Math.max(this.counterPct, g.next_power);
      this.log.push(`(몸을 비튼 힘이 남았다. 다음 공격 +${halpun(g.next_power)})`);
    }
    if (g.step_heal) {
      const [healed] = p.healPercent(g.step_heal, 0);
      if (healed > 0) this.log.push(`(숨을 돌렸다. 체력 +${healed})`);
    }
    if (g.strike) {
      const main = p.bestSkill();
      const power = Math.max(1, Math.trunc(this.attackPower(main) * g.strike / 100));
      this.strike(power, `되받아친 ${g.name}`, null);
    }
  }

  applySpecialEffects(special) {
    const p = this.player;
    if (special.seal && (hasEffect(this.player.traits, "seal_immune") || this.armorG?.seal_immune)) {
      this.log.push("혈도를 노렸지만 기운이 막히지 않았다.");
    } else if (special.seal && this.mindG?.clear_mind && rng.random() * 100 < this.mindG.clear_mind) {
      this.log.push(`(${this.mindG.name}: 맑은 숨이 혈도를 지켰다.)`);
    } else if (special.seal) {
      this.sealed = special.seal + 1;
      this.log.push(`혈도를 짚였다. (${special.seal}합 동안 무공 봉쇄, 심법으로 풀 수 있다)`);
    }
    if (special.injury && this.mindG?.injury && rng.random() * 100 < this.mindG.injury) {
      this.log.push(`(${this.mindG.name}: 흔들린 기혈을 숨이 다잡았다.)`);
    } else if (special.injury && p.injury < MAX_INJURY) {
      p.addInjury(1);
      this.log.push(`장력이 내부를 흔든다. (내상 ${p.injury}단계)`);
    }
    if (special.poison && (hasEffect(this.player.traits, "poison_immune") || this.armorG?.poison_immune)) {
      this.log.push("독이 들었지만 몸이 아무렇지 않다.");
    } else if (special.poison) {
      this.poison = { ...special.poison };
      // 독을 밀어내는 심법이면 독이 한 합을 넘기지 못한다
      if (this.mindG?.cleanse) this.poison.rounds = 1;
      this.log.push(`독이 퍼진다. (${this.poison.rounds}합 동안 매 합 ${this.poison.damage} 피해)`);
    }
    if (special.qi_drain) {
      const drained = Math.trunc(p.maxQi() * special.qi_drain / 100);
      p.qi = Math.max(0, p.qi - drained);
      this.log.push(`내력을 빼앗겼다. (내력 -${drained})`);
    }
    if (special.heal_pct) {
      const healed = Math.trunc(this.enemy.maxHp * special.heal_pct / 100);
      this.enemy.hp = Math.min(this.enemy.maxHp, this.enemy.hp + healed);
      this.log.push(`${this.enemy.name}의 상처가 아문다. (체력 +${healed})`);
    }
  }

  /** 쓰러지는 순간 남은 기회가 있으면 선천진기를 일으킨다. 플레이어가 고르게 되어 있으면 먼저 묻는다. */
  checkRevive() {
    const p = this.player;
    if (this.spar || p.hp > 0 || p.revives <= 0 || this.standPending) return;
    if (this.askStand) {
      this.standPending = true;
      return;
    }
    this.gatherLastStrength();
  }

  /** 물음에 답한다. 선천진기를 일으키면 null, 눈을 감으면 전투 결과를 돌려준다 */
  answerStand(gather) {
    if (!this.standPending) return null;
    this.standPending = false;
    this.stepStreak = 0;     // 경공을 잇달아 펼친 수
    this.mindStreak = 0;     // 운기를 잇달아 한 수
    this.stolen = 0;         // 이번 합에 흡수한 체력
    this.regenUsedHp = 0;    // 이번 싸움에 저절로 찬 체력
    this.regenUsedQi = 0;
    this.stunRest = false;   // 굳었다 풀린 다음 합
    if (!gather) {
      this.log.push("단전 깊은 곳의 선천진기를 건드리지 않았다. 눈이 감긴다.");
      return this.finish(false);
    }
    this.gatherLastStrength();
    return null;
  }

  /** 체력은 최대의 절반, 내력은 최대의 절반만큼 차오른다. */
  gatherLastStrength() {
    const p = this.player;
    p.revives -= 1;
    p.hp = Math.max(1, Math.trunc(p.maxHp() * REVIVE_RATE));
    p.qi = Math.min(p.maxQi(), p.qi + Math.trunc(p.maxQi() * REVIVE_RATE));
    this.innate = true;
    p.note(`${this.enemy.name} 앞에서 쓰러지려다 선천진기를 일으켜 버텼다.`);
    this.log.push(`단전 깊이 잠든 선천진기를 깨웠다. 타고난 기운이 온몸에 차오른다. 이 싸움 동안 위력이 ${halpun(INNATE_POWER)} 오르고 받는 피해가 ${halpun(INNATE_POWER)} 준다. (체력 ${p.hp}, 내력 ${p.qi}, 남은 선천진기 ${p.revives})`);
  }

  nextSpecialWarning() { return this.enemy.specialForRound(this.roundNum + 1)?.name ?? null; }
  /** 다음 합의 필살기를 꺾는 데 드는 힘. 꺾을 수 없으면 0 */
  nextBreakNeed() { return this.enemy.breakNeed(this.enemy.specialForRound(this.roundNum + 1)); }

  /**
   * 경공으로 흘릴 확률(푼). 잇달아 펼치면 걸음을 읽히고, 상대의 필살기가 날카로우면 피할 틈이 좁아진다.
   * 화면에 보이는 회피도 이 값을 쓴다.
   */
  evadeChance(evadeSkill, round = this.roundNum + 1, streak = this.stepStreak + 1) {
    if (!evadeSkill) return 0;
    const own = evadeSkill.effectValue("evade") + sectBonus(this.player, "evade") + this.player.idleBonus("경공") + alignValue(this.player.alignment, "사도", "evade");
    const base = Math.min(MAX_EVADE, own);
    const read = Math.max(0, streak - 1) * STEP_STREAK_PENALTY;
    const chance = Math.max(Math.min(base, MIN_STREAK_EVADE), base - read);
    const special = this.enemy.specialForRound(round);
    const sharp = (special?.accuracy || 0) + (this.enemy.accuracy || 0);
    return Math.max(0, chance - sharp);
  }

  tickEffects() {
    if (this.poison) {
      this.player.hp = Math.max(0, this.player.hp - this.poison.damage);
      this.log.push(`독이 살을 태운다. (${this.poison.damage} 피해)`);
      this.checkRevive();
      this.poison.rounds -= 1;
      if (this.poison.rounds <= 0) this.poison = null;
    }
    if (this.enemyPoison) {
      this.enemy.takeDamage(this.enemyPoison.damage);
      this.log.push(`독이 ${this.enemy.name}의 혈맥을 태운다. (${this.enemyPoison.damage} 피해)`);
      this.enemyPoison.rounds -= 1;
      if (this.enemyPoison.rounds <= 0) this.enemyPoison = null;
    }
    if (this.bleed) {
      this.enemy.takeDamage(this.bleed.damage);
      this.log.push(`${this.enemy.name}의 칼자국에서 피가 흐른다. (${this.bleed.damage} 피해)`);
      this.bleed.rounds -= 1;
      if (this.bleed.rounds <= 0) this.bleed = null;
    }
    if (this.burn) {
      this.enemy.takeDamage(this.burn.damage);
      this.log.push(`${this.enemy.name}의 상처에서 기운이 번진다. (${this.burn.damage} 피해)`);
      this.burn.rounds -= 1;
      if (this.burn.rounds <= 0) this.burn = null;
    }
    // 저절로 차오르는 기운은 한 싸움에 일정한 양까지다
    const mindHp = this.mindG?.regen ? Math.max(1, Math.floor(this.mindG.regen.percent / 2)) : 0;
    const mindQi = this.mindG?.regen_qi ? Math.max(1, Math.floor(this.mindG.regen_qi.percent / 2)) : 0;
    const regen = Math.min(MAX_PASSIVE_REGEN - this.regenUsedHp, sumEffect(this.player.traits, "round_regen", "hp_pct") + (this.armorG?.regen || 0) + mindHp);
    const regenQi = Math.min(MAX_PASSIVE_REGEN - this.regenUsedQi, sumEffect(this.player.traits, "round_regen", "qi_pct") + mindQi);
    if ((regen > 0 || regenQi > 0) && this.player.hp > 0) {
      this.player.healPercent(regen, regenQi);
      this.regenUsedHp += regen;
      this.regenUsedQi += regenQi;
    }
    if (this.regen && this.player.hp > 0) {
      this.player.healPercent(this.regen.hp, this.regen.qi);
      this.regen.rounds -= 1;
      if (this.regen.rounds <= 0) this.regen = null;
    }
    for (const field of ["enemyWeaken", "reflect", "lifestealBuff"]) {
      if (this[field]) {
        this[field].rounds -= 1;
        if (this[field].rounds <= 0) this[field] = null;
      }
    }
    this.companionsAct();
    if (this.sealed) this.sealed -= 1;
    if (this.atkBuff) {
      this.atkBuff.rounds -= 1;
      if (this.atkBuff.rounds <= 0) this.atkBuff = null;
    }
    if (this.guard) {
      this.guard.rounds -= 1;
      if (this.guard.rounds <= 0) this.guard = null;
    }
  }

  /** 결전에 달려온 인연들이 저마다의 주기로 돕는다. */
  companionsAct() {
    const p = this.player;
    if (p.hp <= 0) return;
    for (const c of this.companions) {
      const { help } = c;
      if (!help.every || this.roundNum % help.every !== 0) continue;
      const line = pick(c.lines);
      if (help.strike) {
        const damage = Math.max(1, Math.trunc(this.attackPower(p.bestSkill()) * help.strike / 100));
        this.enemy.takeDamage(damage);
        this.log.push(`${line} (${this.enemy.name}에게 ${damage}의 피해)`);
      } else if (help.hp || help.qi) {
        const [hp, qi] = p.healPercent(help.hp || 0, help.qi || 0);
        this.log.push(`${line} (${hp ? `체력 +${hp}` : ""}${hp && qi ? ", " : ""}${qi ? `내력 +${qi}` : ""})`);
      } else if (help.stun) {
        if (rng.random() * 100 < help.stun) {
          this.enemyStun = true;
          this.log.push(`${line} (${this.enemy.name}의 몸이 굳었다.)`);
        }
      } else if (help.weaken) {
        this.enemyWeaken = { percent: help.weaken, rounds: help.rounds || 2 };
        this.log.push(`${line} (${help.rounds || 2}합 동안 ${this.enemy.name}의 위력 -${halpun(help.weaken)})`);
      } else if (help.poison) {
        const damage = Math.max(1, Math.trunc(this.attackPower(p.bestSkill()) * help.poison / 100));
        this.burn = { damage, rounds: 3 };
        this.log.push(`${line} (세 합 동안 ${this.enemy.name}에게 ${damage}의 피해)`);
      }
    }
  }

  // ---------- 결전의 막간 ----------

  /** 단계가 바뀔 때 막간을 연다. 맺은 인연이 끼어들고, 다음 합을 어떻게 맞을지 고른다. */
  openInterlude(phase) {
    const data = phase.interlude;
    if (!data) return false;
    let joined = 0;
    for (const ally of data.allies || []) {
      if (joined >= (data.max_allies ?? 2)) break;
      if (this.alliesSeen.includes(ally.key) || !checkRequires(this.player, ally.requires)) continue;
      this.alliesSeen.push(ally.key);
      this.log.push(ally.text);
      this.applyInterludeEffects(ally.effects);
      joined += 1;
    }
    const choices = data.choices.filter((c) => checkRequires(this.player, c.requires));
    this.interlude = { title: data.title, text: reactiveLine(this.player, data.texts, data.text), choices };
    return true;
  }

  chooseInterlude(index) {
    const choice = this.interlude?.choices[index];
    if (!choice) return false;
    this.interlude = null;
    this.log.push(choice.text);
    this.applyInterludeEffects(choice.effects);
    return true;
  }

  applyInterludeEffects(fx = {}) {
    const p = this.player;
    if (fx.boss_hp_pct) {
      const damage = Math.trunc(this.enemy.maxHp * fx.boss_hp_pct / 100);
      this.enemy.hp = Math.max(1, this.enemy.hp - damage);
      this.log.push(`${this.enemy.name}의 체력이 ${damage} 깎였다.`);
    }
    if (fx.hp_pct > 0 || fx.qi_pct > 0) {
      p.healPercent(Math.max(fx.hp_pct || 0, 0), Math.max(fx.qi_pct || 0, 0));
    }
    if (fx.hp_pct < 0) p.hp = Math.max(1, p.hp + Math.trunc(p.maxHp() * fx.hp_pct / 100));
    if (fx.atk_buff) this.atkBuff = { percent: fx.atk_buff.percent, rounds: fx.atk_buff.rounds + 1 };
    if (fx.guard) this.guard = { percent: fx.guard.percent, rounds: fx.guard.rounds + 1 };
    if (fx.counter_pct) this.counterPct = fx.counter_pct;
    if (fx.clear) {
      this.sealed = 0;
      this.poison = null;
    }
    for (const flag of fx.flags || []) p.addFlag(flag);
  }

  // ---------- 진행 ----------

  /** 한 합 진행. 전투가 끝나면 결과를, 계속되면 null을 돌려준다. */
  runRound(action = "기본공격", skill = null, itemKey = null) {
    // 도구 하나는 합을 쓰지 않는다. 같은 합에 하나 더 쓰면 그때는 합이 지나간다
    if (action === "소비품" && !this.freeItemUsed && this.player.inventory[itemKey] > 0) {
      this.freeItemUsed = true;
      this.useItem(itemKey, true);
      return this.enemy.isAlive() ? null : this.finish(true);
    }
    this.freeItemUsed = false;
    this.roundNum += 1;
    this.stolen = 0;
    this.mindSurge();
    this.enemyQuirksRound();
    // 이 합에 쏟은 힘을 잰다. 큰 초식은 그 힘으로 기세를 꺾을 수 있다
    const force = this.enemy.hp + this.enemy.barrier;
    // 다른 일을 하면 잇달아 쓴 것이 끊긴다. 운기는 쓴 뒤에 세어 이번 운기가 앞의 운기를 볼 수 있게 한다
    this.stepStreak = action === "경공" ? this.stepStreak + 1 : 0;
    const mindNow = action === "심법";
    let evadeSkill = null;

    if (action === "도주" && !this.isFinal) {
      if (this.flee()) return this.finish(false, true);
    } else if (action === "비기" && skill) {
      this.useSecret(skill);
    } else if (action === "심법") {
      this.useMindset();
    } else if (action === "경공") {
      evadeSkill = this.useMovement();
    } else if (action === "소비품") {
      this.useItem(itemKey);
    } else if (skill) {
      this.useSkill(skill);
    } else {
      this.basicAttack();
    }

    this.mindStreak = mindNow ? this.mindStreak + 1 : 0;
    if (!this.enemy.isAlive()) return this.finish(true);

    this.dealt = Math.max(0, force - this.enemy.hp - this.enemy.barrier);
    const phase = this.enemy.advancePhase();
    if (phase) {
      this.log.push(`${reactiveLine(this.player, phase.texts, phase.text)}`);
      this.phaseQuirks(phase);
    }
    // 막간이 열리는 합에는 적도 기세를 고른다
    if (phase && this.openInterlude(phase)) return null;

    this.enemyAttack(evadeSkill);
    this.flushEnemyNotes();
    if (this.standPending) return null;
    if (this.player.hp > 0) this.tickEffects();
    if (this.standPending) return null;
    if (this.player.hp <= 0) return this.finish(false);
    if (!this.enemy.isAlive()) return this.finish(true);

    this.flushEnemyNotes();
    const warning = this.nextSpecialWarning();
    if (warning) {
      const need = this.enemy.breakNeed(this.enemy.specialForRound(this.roundNum + 1));
      this.log.push(`${this.enemy.name}${josa(this.enemy.name, "이/가")} ${warning}의 기세를 끌어올린다.${need ? ` 다음 합에 ${need} 넘게 깎으면 꺾을 수 있다.` : ""}`);
    }
    return null;
  }

  /** 단계가 바뀌며 꺼낸 괴공을 알리고 곧바로 몸에 두른다 */
  phaseQuirks(phase) {
    const { enemy, player } = this;
    for (const q of phase.quirks || []) {
      this.log.push(`(괴공 ${quirkText(q)})`);
      if (q.type === "sever") player.healCut = Math.max(player.healCut || 0, Math.min(MAX_HEAL_CUT, q.percent));
      if (q.type === "barrier") this.log.push(`(${enemy.name}${josa(enemy.name, "이/가")} 강기를 두른다. ${enemy.raiseBarrier()})`);
    }
  }

  /** 괴공 가운데 합마다 일어나는 것 */
  enemyQuirksRound() {
    const { enemy } = this;
    const frenzy = enemy.quirk("frenzy");
    if (frenzy && this.roundNum > 1 && enemy.rage < Math.min(MAX_FRENZY, frenzy.max)) {
      enemy.rage = Math.min(MAX_FRENZY, frenzy.max, enemy.rage + frenzy.percent);
      this.log.push(`(${enemy.name}의 광기가 짙어진다. 위력 +${halpun(enemy.rage)})`);
    }
    const barrier = enemy.quirk("barrier");
    if (barrier && this.roundNum > 1 && (this.roundNum - 1) % barrier.every === 0 && enemy.barrier < enemy.maxHp * barrier.percent / 100) {
      this.log.push(`(${enemy.name}${josa(enemy.name, "이/가")} 강기를 다시 두른다. ${enemy.raiseBarrier()})`);
    }
  }

  flushEnemyNotes() {
    if (!this.enemy.notes?.length) return;
    this.log.push(...this.enemy.notes);
    this.enemy.notes = [];
  }

  finish(victory, fled = false) {
    this.resultFrom = this.log.length; // 여기서부터가 싸움의 뒷이야기다
    this.revertTempBuffs();
    this.player.healCut = 0;
    this.flushEnemyNotes();
    if (fled) return { victory: false, fled: true, exp: 0 };

    const exp = victory ? this.enemy.expReward + sumEffect(this.player.traits, "battle_exp", "amount") : 0;
    if (victory) {
      this.player.battles += exp;
      // 비무는 사람을 죽이는 싸움이 아니다
      if (!this.spar) {
        this.player.kills += 1;
        if (!this.oneOff && isNamed(this.enemy.key) && !this.player.slain.includes(this.enemy.key)) this.player.slain.push(this.enemy.key);
        if (this.isFinal && !this.player.slain.includes("천마")) this.player.slain.push("천마"); // 이제 천하제일인이라 불린다
        const flag = DB.enemies[this.enemy.key].kill_flag;
        if (flag) this.player.addFlag(flag);
        const side = dominant(this.player.alignment);
        if (KILL_ALIGN[side]) this.player.adjustAlignment(side, KILL_ALIGN[side] / 2); // 앞선 길은 두 배로 오른다
        const drink = alignValue(this.player.alignment, "마도", "kill_heal");
        if (drink && this.player.hp > 0) {
          const [hp] = this.player.healPercent(drink, 0);
          if (hp) this.log.push(`쓰러진 자의 기운을 거두었다. (체력 +${hp})`);
        }
      }
      // 비무는 칼끝을 멈추는 싸움이라 쓰러지는 문장을 쓰지 않는다
      const outro = this.spar ? this.enemy.sparOutro : reactiveLine(this.player, this.enemy.outros, this.enemy.outro);
      if (outro) this.log.push(outro);
      else if (!this.enemy.beast && !this.spar && rng.random() < VICTORY_TALK_RATE) {
        const talk = talkLine(this.player, "victory");
        if (talk) this.log.push(talk);
      }
      this.log.push(this.spar ? `${this.enemy.name}${josa(this.enemy.name, "을/를")} 꺾었다. 실전 경험 +${exp}` : `${this.enemy.name}${josa(this.enemy.name, "을/를")} 쓰러뜨렸다. 실전 경험 +${exp}`);
      const fameBefore = this.player.fame;
      this.player.fame = Math.min(MAX_FAME, this.player.fame + (FAME_BY_TIER[this.enemy.tier] || 0));
      const rank = fameRankChanged(this.player, fameBefore, this.player.fame);
      if (rank) {
        this.log.push(`강호에서 ${rank}${josa(rank, "으로")} 불리기 시작했다.`);
        this.player.note(`강호에서 ${rank}${josa(rank, "으로")} 불리기 시작했다.`);
      }
      this.applyStatGrowth();
      const fought = this.player.bestSkill();
      if (fought) this.log.push(...fought.gainMastery(WIN_MAIN_MASTERY));
      for (const art of [this.player.bestOfType("심공"), this.player.bestOfType("경공")]) {
        if (art) this.log.push(...art.gainMastery(WIN_ART_MASTERY + this.player.masteryGainAmount()));
      }
      this.gainSilver();
      this.rollDrop();
      this.applyBattleEndBuffs();
    } else if (this.spar) {
      // 비무에 지면 체력이 조금 남고 얻는 것이 없다
      this.player.hp = Math.max(1, Math.trunc(this.player.maxHp() * SPAR_LOSS_HP));
      this.log.push(`${this.enemy.name}${josa(this.enemy.name, "이/가")} 칼끝을 멈췄다. 비무에 졌다. 얻은 것은 없고 몸만 상했다. (체력 ${this.player.hp})`);
    } else {
      this.log.push(`${this.enemy.name}에게 패배했다.`);
    }
    return { victory, fled: false, exp };
  }

  /** 깊은 강호일수록 쓰러진 자의 품에서 나오는 것이 적다 */
  dropRate() { return difficultyOf(this.player).drop; }

  gainSilver() {
    const [low, high] = this.enemy.silverRange;
    const amount = randInt(low, high);
    if (amount > 0) this.log.push(`은자 +${this.player.gainSilver(amount)}`);
  }

  /** 적의 경지에 맞는 비급과 약이 떨어진다. 산적이 명품 비급을 품고 다니지는 않는다. */
  rollDrop() {
    if (this.enemy.beast) {
      // 짐승은 비급을 품지 않는다. 쓸개나 내단이 나온다
      // 고등급 영물은 쓰러뜨리면 반드시 내단을 남긴다
      const { loot, spirit } = DB.enemies[this.enemy.key];
      if (loot && (spirit || rng.random() < loot.chance * this.dropRate())) {
        this.player.addItem(loot.item);
        const name = DB.market[loot.item].name;
        this.log.push(`${name}${josa(name, "을/를")} 거두었다.`);
      }
      return;
    }
    const table = DB.balance.drops[this.enemy.realm];
    if (!table || this.enemy.tier === "보스") return;
    const tierRate = (DB.balance.drop_tier_rate[this.enemy.tier] ?? 1) * this.dropRate();
    if (table.medicine?.length && rng.random() < DROP_MEDICINE_RATE * tierRate) {
      const item = pick(table.medicine);
      this.player.addItem(item);
      this.log.push(`품에서 ${DB.market[item].name}${josa(DB.market[item].name, "이/가")} 나왔다.`);
    }
    this.rollGearDrop(table, tierRate);
    if (rng.random() >= table.book * tierRate) return;
    const key = dropSkill(this.player, this.enemy.drop?.skill, table.grades, DB.enemies[this.enemy.key].faction);
    if (!key) return;
    const known = this.player.hasSkill(key);
    const skill = new Skill(key);
    const notes = this.player.learnSkill(skill);
    this.log.push(known ? `품에서 비급이 떨어졌다. ${skill.name}, 아는 무공이다.` : `품에서 비급이 떨어졌다. 새 무공 ${skill.name}${josa(skill.name, "을/를")} 얻었다.`, ...notes);
  }

  /** 적이 지닌 병장기. 경지가 높을수록 좋은 물건이고 주무공에 맞는 병기가 더 잘 나온다. */
  rollGearDrop(table, tierRate) {
    const { gear } = table;
    if (!gear || rng.random() >= gear.chance * tierRate) return;
    const p = this.player;
    const main = p.bestSkill()?.category;
    const pool = Object.keys(DB.market).filter((k) => {
      const item = DB.market[k];
      return gear.grades.includes(item.grade) && !item.no_drop && item.effects.some((e) => e.type === "equip") && !p.ownsGear(k);
    });
    if (!pool.length) return;
    const luck = 1 + sumEffect(p.traits, "main_style_luck", "percent") / 100;
    const key = pickWeighted(pool, pool.map((k) => {
      const { style } = DB.market[k].effects.find((e) => e.type === "equip");
      return style === main ? DROP_MAIN_RATE * 4 * luck : style ? DROP_OTHER_RATE : 2;
    }));
    const { name } = DB.market[key];
    p.gear.push(key);
    this.log.push(`쓰러진 자의 ${name}${josa(name, "을/를")} 챙겼다. (${DB.market[key].grade})`);
  }

  /** 승리 시 4개 능력치 중 랜덤 2개가 적 등급 범위만큼 오른다. */
  applyStatGrowth() {
    const stats = ["external", "internal", "martial", "mind"];
    const first = pick(stats);
    const second = pick(stats.filter((s) => s !== first));
    const [low, high] = this.enemy.growthRange;
    const gains = [first, second].map((stat) => {
      const gained = this.player.gainStat(stat, applyGrowth(scaledGrowth(randInt(low, high), this.player.turn), this.player.traits, stat));
      return `${STAT_NAMES[stat]}+${gained}`;
    });
    this.log.push(`성장: ${gains.join(", ")}`);
  }
}
