// 달제 전투. 적의 필살기는 직전 합에 예고되고, 경공으로 흘려낼 수 있다.
import { MAX_INJURY, Skill, STAT_NAMES } from "./character.js";
import { DB } from "./data.js";
import { checkRequires, reactiveLine } from "./events.js";
import { equipmentBonus } from "./market.js";
import { pick, randInt, rng, uniform } from "./rng.js";
import { applyGrowth, battleBuffs, hasEffect, MA_DAMAGE_BONUS, realmBonus, sectBonus, sumEffect } from "./rules.js";

const BASE_HIT = 0.88;
const SECRET_INTERNAL_RATE = 1.0;
const INTERNAL_ATTACK_RATE = 0.3;
const FLEE_BASE = 0.5;
export const INJURY_PENALTY = 7;
const FAME_BY_TIER = { 일반: 1, 난적: 2, 강적: 4, 보스: 10 };
const STAT_GROWTH_RANGE = { 일반: [1, 2], 난적: [1, 3], 강적: [2, 4], 보스: [5, 10] };

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
    this.intro = data.intro || null;
    this.outro = data.outro || null;
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
  }

  isAlive() { return this.hp > 0; }
  takeDamage(amount) { this.hp = Math.max(0, this.hp - amount); }
  attackMultiplier() { return this.phase === 0 ? 1 : this.phases[this.phase - 1].attack_mult; }

  /** 체력이 다음 단계 기준 아래로 내려가면 단계를 올리고 그 단계를 돌려준다. */
  advancePhase() {
    if (this.phase < this.phases.length) {
      const next = this.phases[this.phase];
      if (this.hp <= this.maxHp * next.hp_pct / 100) {
        this.phase += 1;
        if (next.specials) this.specials = next.specials;
        return next;
      }
    }
    return null;
  }

  /** 이 합의 필살기. 주기가 긴 것을 우선한다. */
  specialForRound(round) {
    let chosen = null;
    for (const special of this.specials) {
      if (round % special.every === 0 && (!chosen || special.every > chosen.every)) chosen = special;
    }
    return chosen;
  }
}

export const enemyPool = (chapter) =>
  Object.keys(DB.enemies).filter((k) => (DB.enemies[k].chapters || []).includes(chapter));

export function useConsumable(player, key) {
  const rate = 1 + sumEffect(player.traits, "consumable_rate", "percent") / 100;
  for (const effect of DB.market[key].effects) {
    if (effect.type === "heal") {
      if (effect.stat === "hp") player.healPercent(effect.percent * rate, 0);
      else player.healPercent(0, effect.percent * rate);
    } else if (effect.type === "mastery") {
      const main = player.bestSkill();
      if (main) main.gainMastery(main.category === effect.style ? effect.amount : Math.floor(effect.amount / 2));
    } else if (effect.type === "cure" && effect.what === "injury") {
      player.addInjury(-(effect.amount ?? 1));
    }
  }
  player.inventory[key] -= 1;
  if (player.inventory[key] <= 0) delete player.inventory[key];
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
    this.standUsed = false;
    this.interlude = null;   // 결전의 막간. 고르기 전에는 합이 진행되지 않는다
    this.guard = null;
    this.alliesSeen = [];
    // 전투 시작 시 발동하는 특성 효과 (99 한계 무시, 전투가 끝나면 되돌림)
    for (const buff of battleBuffs(player.traits, "on_battle_start")) {
      player[buff.stat] += buff.amount;
      this.tempBuffs.push([buff.stat, buff.amount]);
      this.log.push(`(자질 효과: ${STAT_NAMES[buff.stat]} 임시 +${buff.amount})`);
    }
  }

  revertTempBuffs() {
    for (const [stat, amount] of this.tempBuffs) this.player[stat] -= amount;
    this.tempBuffs = [];
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
    scale *= 1 + sumEffect(p.traits, "damage_bonus", "percent") / 100;
    scale *= 1 + sectBonus(p, "damage") / 100;
    scale *= 1 - p.injury * INJURY_PENALTY / 100;
    if (p.dominantAlignment() === "마도") scale *= 1 + MA_DAMAGE_BONUS / 100;
    if (this.atkBuff) scale *= 1 + this.atkBuff.percent / 100;
    return scale;
  }

  attackPower(skill = null) {
    const p = this.player;
    let base = p.external + p.martial + equipmentBonus(p, "weapon") + p.internal * INTERNAL_ATTACK_RATE;
    if (skill) base *= skill.effectiveMultiplier();
    return Math.max(1, Math.trunc(base * this.attackScale()));
  }

  secretPower(skill) {
    const p = this.player;
    const base = p.external + p.martial + equipmentBonus(p, "weapon") + p.internal * SECRET_INTERNAL_RATE;
    return Math.max(1, Math.trunc(base * skill.effectiveMultiplier() * skill.secretMultiplier * this.attackScale()
      * (1 + sumEffect(p.traits, "secret_power", "percent") / 100)));
  }

  hits() {
    const bonus = sumEffect(this.player.traits, "hit_bonus", "percent") / 100;
    return rng.random() < BASE_HIT + bonus + this.player.martial * 0.001 - this.enemy.evasion;
  }

  critChance() {
    const p = this.player;
    return p.mind / 400 + (sumEffect(p.traits, "crit", "percent") + sectBonus(p, "crit")) / 100;
  }

  strike(power, label, skill = null) {
    if (!this.hits()) {
      this.log.push(`${label} — 그러나 ${this.enemy.name}이(가) 몸을 틀어 피했다.`);
      this.counterPct = 0;
      return 0;
    }
    let damage = power * uniform(0.9, 1.1);
    const notes = [];
    const p = this.player;
    if (this.roundNum <= 1) damage *= 1 + sumEffect(p.traits, "first_strike", "percent") / 100;
    const desperate = p.traits.flatMap((k) => DB.traits[k]?.effects || []).find((e) => e.type === "low_hp_power");
    if (desperate && p.hp <= p.maxHp() * desperate.below / 100) {
      damage *= 1 + desperate.percent / 100;
      notes.push("배수진!");
    }
    if (this.counterPct) {
      damage *= 1 + this.counterPct / 100;
      notes.push("빈틈을 찔렀다!");
      this.counterPct = 0;
    }
    if (rng.random() < this.critChance()) {
      damage *= 1.5 + sumEffect(p.traits, "crit_power", "percent") / 100;
      notes.push("회심의 일격!");
    }
    damage = Math.max(1, Math.trunc(damage) - this.enemy.armor);
    this.enemy.takeDamage(damage);
    const suffix = notes.length ? ` ${notes.join(" ")}` : "";
    this.log.push(`${label} ${this.enemy.name}에게 ${damage}의 피해.${suffix}`);
    this.applyPoisonOnHit(skill);
    return damage;
  }

  applyPoisonOnHit(skill) {
    let power = sectBonus(this.player, "poison");
    if (skill?.inflict) power += skill.inflict.poison || 0;
    if (power) this.enemyPoison = { damage: power + Math.floor(this.player.internal / 5), rounds: 3 };
  }

  skillLabel(skill) {
    if (!skill.forms.length) return `${skill.name}!`;
    const index = randInt(0, skill.forms.length - 1);
    return `${skill.name} 제${index + 1}초 「${skill.forms[index]}」!`;
  }

  // ---------- 플레이어 행동 ----------

  basicAttack() { return this.strike(this.attackPower(), "맨손으로 일격!"); }

  useSkill(skill) {
    if (this.sealed) {
      this.log.push("혈도가 막혀 무공을 펼칠 수 없다.");
      return this.basicAttack();
    }
    if (this.player.qi < skill.qiCost) {
      this.log.push(`내력이 모자라 ${skill.name}을(를) 펼치지 못했다.`);
      return this.basicAttack();
    }
    this.player.qi -= skill.qiCost;
    const damage = this.strike(this.attackPower(skill), this.skillLabel(skill), skill);
    this.log.push(...skill.gainMastery(this.player.masteryGainAmount()));
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
    const damage = this.strike(this.secretPower(skill), `비기 「${skill.secretName}」!`, skill);
    this.checkQiDeviation(skill);
    this.log.push(...skill.gainMastery(this.player.masteryGainAmount()));
    return damage;
  }

  /** 주화입마: 마공의 비기는 심경이 70보다 낮을수록 위험하다. */
  checkQiDeviation(skill) {
    if (!skill.risky) return;
    if (rng.random() < Math.max(0, 70 - this.player.mind) * 0.015) {
      this.player.addInjury(1);
      this.log.push(`🩸 기가 역류한다! 주화입마의 기운에 내상을 입었다. (내상 ${this.player.injury}단계)`);
    }
  }

  useMindset() {
    const p = this.player;
    const skill = p.bestOfType("심공");
    if (!skill) {
      this.log.push("아직 익힌 심공이 없다.");
      return;
    }
    const boost = 1 + sectBonus(p, "heal_bonus") / 100;
    const hpValue = skill.effectValue("heal_hp_pct");
    const qiValue = skill.effectValue("heal_qi_pct");
    const [hpChange, qiChange] = p.healPercent(hpValue > 0 ? hpValue * boost : hpValue, qiValue * boost);
    const signed = (n) => (n >= 0 ? `+${n}` : `${n}`);
    this.log.push(`${skill.name}을(를) 운기했다. (체력 ${signed(hpChange)}, 내력 ${signed(qiChange)})`);
    if (this.sealed) {
      this.sealed = 0;
      this.log.push("막혔던 혈도가 풀렸다.");
    }
    const percent = skill.effectValue("atk_buff_pct");
    const rounds = skill.effect.buff_rounds || 0;
    if (percent > 0 && rounds > 0) {
      this.atkBuff = { percent, rounds: rounds + 1 };
      this.log.push(`기세가 오른다. (${rounds}합 동안 위력 +${percent}%)`);
    }
    this.log.push(...skill.gainMastery(p.masteryGainAmount()));
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
    this.log.push(`${skill.name}으로 몸을 띄웠다.`);
    this.log.push(...skill.gainMastery(this.player.masteryGainAmount()));
    return skill;
  }

  useItem(key) {
    if (!(this.player.inventory[key] > 0) || !DB.market[key]) {
      this.log.push("행낭에 없는 물건이다.");
      return;
    }
    const item = DB.market[key];
    if (item.effects.some((e) => e.type === "cure" && e.what === "poison")) this.poison = null;
    const tool = item.effects.find((e) => e.type === "atk_buff");
    if (tool) {
      const full = this.player.bestSkill()?.category === tool.style;
      this.atkBuff = { percent: full ? tool.percent : Math.floor(tool.percent / 2), rounds: tool.rounds + 1 };
    }
    useConsumable(this.player, key);
    this.log.push(`${item.name}을(를) 썼다. (${item.desc})`);
  }

  flee() {
    let chance = FLEE_BASE;
    const skill = this.player.bestOfType("경공");
    if (skill) chance += skill.effectValue("flee_bonus") / 100;
    chance += sumEffect(this.player.traits, "flee_rate", "percent") / 100;
    if (rng.random() < chance) {
      this.log.push("도주에 성공했다.");
      return true;
    }
    this.log.push("도주에 실패했다!");
    return false;
  }

  // ---------- 적 행동 ----------

  incoming(multiplier = 1) {
    let base = this.enemy.attack * this.enemy.attackMultiplier() * multiplier;
    base *= 1 - realmBonus(this.player.realm) / 2;
    base *= 1 - sectBonus(this.player, "damage_reduce") / 100;
    base *= 1 - sumEffect(this.player.traits, "damage_reduce", "percent") / 100;
    if (this.guard) base *= 1 - this.guard.percent / 100;
    return Math.max(1, Math.trunc(base * uniform(0.9, 1.1)) - equipmentBonus(this.player, "armor"));
  }

  enemyAttack(evadeSkill = null) {
    const special = this.enemy.specialForRound(this.roundNum);
    const multiplier = special ? special.mult : 1;
    const name = special ? `「${special.name}」` : "공격";

    if (evadeSkill) {
      const chance = evadeSkill.effectValue("evade") + sectBonus(this.player, "evade");
      if (randInt(1, 100) <= chance) {
        this.counterPct = evadeSkill.effectValue("counter_pct");
        this.log.push(`${this.enemy.name}의 ${name}을(를) 흘려냈다! (다음 공격 +${this.counterPct}%)`);
        return 0;
      }
    }

    let damage = this.incoming(multiplier);
    if (evadeSkill) {
      // 다 피하지 못해도 몸을 띄운 만큼 위력을 흘린다
      damage = Math.max(1, Math.floor(damage / 2));
      this.log.push("완전히 피하지는 못했지만 위력을 절반 흘렸다.");
    }
    this.player.hp = Math.max(0, this.player.hp - damage);
    this.log.push(`${this.enemy.name}의 ${name}! ${damage}의 피해를 입었다.`);
    this.checkLastStand();
    if (special) this.applySpecialEffects(special);
    return damage;
  }

  applySpecialEffects(special) {
    const p = this.player;
    if (special.seal && hasEffect(this.player.traits, "seal_immune")) {
      this.log.push("혈도를 노렸지만 정신이 맑아 흘려보냈다.");
    } else if (special.seal) {
      this.sealed = special.seal + 1;
      this.log.push(`혈도를 짚였다! (${special.seal}합 동안 무공 봉쇄, 심법으로 풀 수 있다)`);
    }
    if (special.injury && p.injury < MAX_INJURY) {
      p.addInjury(1);
      this.log.push(`장력이 내부를 흔든다! (내상 ${p.injury}단계)`);
    }
    if (special.poison && hasEffect(this.player.traits, "poison_immune")) {
      this.log.push("독이 들었지만 몸이 아무렇지 않다.");
    } else if (special.poison) {
      this.poison = { ...special.poison };
      this.log.push(`독이 퍼진다. (${this.poison.rounds}합 동안 매 합 ${this.poison.damage} 피해)`);
    }
    if (special.qi_drain) {
      const drained = Math.trunc(p.maxQi() * special.qi_drain / 100);
      p.qi = Math.max(0, p.qi - drained);
      this.log.push(`내력을 빼앗겼다! (내력 -${drained})`);
    }
    if (special.heal_pct) {
      const healed = Math.trunc(this.enemy.maxHp * special.heal_pct / 100);
      this.enemy.hp = Math.min(this.enemy.maxHp, this.enemy.hp + healed);
      this.log.push(`${this.enemy.name}의 상처가 아문다. (체력 +${healed})`);
    }
  }

  checkLastStand() {
    if (this.player.hp <= 0 && !this.standUsed && hasEffect(this.player.traits, "last_stand")) {
      this.standUsed = true;
      this.player.hp = 1;
      this.log.push("🔥 쓰러지지 않았다! 불굴의 의지로 다시 일어선다.");
    }
  }

  nextSpecialWarning() { return this.enemy.specialForRound(this.roundNum + 1)?.name ?? null; }

  tickEffects() {
    if (this.poison) {
      this.player.hp = Math.max(0, this.player.hp - this.poison.damage);
      this.log.push(`독이 살을 태운다. (${this.poison.damage} 피해)`);
      this.checkLastStand();
      this.poison.rounds -= 1;
      if (this.poison.rounds <= 0) this.poison = null;
    }
    if (this.enemyPoison) {
      this.enemy.takeDamage(this.enemyPoison.damage);
      this.log.push(`독이 ${this.enemy.name}의 혈맥을 태운다. (${this.enemyPoison.damage} 피해)`);
      this.enemyPoison.rounds -= 1;
      if (this.enemyPoison.rounds <= 0) this.enemyPoison = null;
    }
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
    this.roundNum += 1;
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

    if (!this.enemy.isAlive()) return this.finish(true);

    const phase = this.enemy.advancePhase();
    if (phase) this.log.push(`⚠️ ${reactiveLine(this.player, phase.texts, phase.text)}`);
    // 막간이 열리는 합에는 적도 기세를 고른다
    if (phase && this.openInterlude(phase)) return null;

    this.enemyAttack(evadeSkill);
    if (this.player.hp > 0) this.tickEffects();
    if (this.player.hp <= 0) return this.finish(false);
    if (!this.enemy.isAlive()) return this.finish(true);

    const warning = this.nextSpecialWarning();
    if (warning) this.log.push(`⚠️ ${this.enemy.name}이(가) 「${warning}」의 기세를 끌어올린다!`);
    return null;
  }

  finish(victory, fled = false) {
    this.revertTempBuffs();
    if (fled) return { victory: false, fled: true, exp: 0 };

    const exp = victory ? this.enemy.expReward + sumEffect(this.player.traits, "battle_exp", "amount") : 0;
    if (victory) {
      this.player.battles += exp;
      this.player.kills += 1;
      const outro = reactiveLine(this.player, this.enemy.outros, this.enemy.outro);
      if (outro) this.log.push(outro);
      this.log.push(`${this.enemy.name}을(를) 쓰러뜨렸다! 실전 경험 +${exp}`);
      this.player.fame += FAME_BY_TIER[this.enemy.tier] || 0;
      this.applyStatGrowth();
      this.gainSilver();
      this.rollDrop();
      this.applyBattleEndBuffs();
    } else {
      this.log.push(`${this.enemy.name}에게 패배했다...`);
    }
    return { victory, fled: false, exp };
  }

  gainSilver() {
    const [low, high] = this.enemy.silverRange;
    const amount = randInt(low, high);
    if (amount > 0) this.log.push(`은자 +${this.player.gainSilver(amount)}`);
  }

  rollDrop() {
    const { drop } = this.enemy;
    if (drop && rng.random() < drop.chance && !this.player.hasSkill(drop.skill)) {
      const skill = new Skill(drop.skill);
      this.log.push(...this.player.learnSkill(skill));
      this.log.push(`📕 품에서 비급이 떨어졌다. 새 무공 「${skill.name}」을(를) 익혔다!`);
    }
  }

  /** 승리 시 4개 능력치 중 랜덤 2개가 적 등급 범위만큼 오른다. */
  applyStatGrowth() {
    const stats = ["external", "internal", "martial", "mind"];
    const first = pick(stats);
    const second = pick(stats.filter((s) => s !== first));
    const [low, high] = this.enemy.growthRange;
    const gains = [first, second].map((stat) => {
      const gained = this.player.gainStat(stat, applyGrowth(randInt(low, high), this.player.traits, stat));
      return `${STAT_NAMES[stat]}+${gained}`;
    });
    this.log.push(`성장: ${gains.join(", ")}`);
  }
}
