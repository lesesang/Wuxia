// 달제 전투. 적의 필살기는 직전 합에 예고되고, 경공으로 흘려낼 수 있다.
import { MAX_INJURY, Skill, STAT_NAMES, STAT_SCALE } from "./character.js";
import { DB } from "./data.js";
import { checkRequires, reactiveLine } from "./events.js";
import { equipmentBonus } from "./market.js";
import { pick, pickWeighted, randInt, rng, uniform } from "./rng.js";
import { activeCompanions, applyGrowth, isNamed, battleBuffs, fameRankChanged, hasEffect, alignValue, dominant, KILL_ALIGN, realmBonus, realmIndex, sectBonus, sumEffect, talkLine } from "./rules.js";
import { josa } from "./josa.js";

const BASE_HIT = 0.88;
// 위력에 들어가는 네 기량의 비중. 네 기량이 고루 값어치를 하도록 나눈다
const POWER_RATES = { external: 0.55, martial: 1.15, internal: 0.45, mind: 0.25 };
const SECRET_INTERNAL_RATE = 1.0;
const MIND_GUARD_RATE = 6000; // 심경이 이 값일 때 받는 피해가 모두 사라지는 비율
const MAX_MIND_GUARD = 0.15;
const FLEE_BASE = 0.5;
const DROP_MAIN_RATE = 2;    // 주무공과 같은 계열의 비급은 더 잘 떨어진다
const DROP_OTHER_RATE = 0.7;
const DROP_HINT_RATE = 0.6;      // 적이 품은 무공이 있으면 먼저 그것이 나온다
const DROP_MEDICINE_RATE = 0.05; // 약이 나올 확률
const REVIVE_RATE = 0.5;
const MIN_THROUGH_GUARD = 0.3; // 호신강기를 뚫고 들어오는 최소 비율
const VICTORY_TALK_RATE = 0.3;
const SPAR_LOSS_HP = 0.1; // 비무에 진 뒤 남는 체력
const MAX_KILL_POWER = 40; // 쓰러뜨린 적만큼 강해지는 자질의 끝
const MAX_DAMAGE_REDUCE = 60; // 자질과 기틀을 겹쳐도 받는 피해를 이 이상 줄이지 못한다
export const INJURY_PENALTY = 7;
const FAME_BY_TIER = { 일반: 1, 난적: 2, 강적: 4, 보스: 10 };
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

/**
 * 장에 맞는 적을 찾는다. 적의 ranks는 어울리는 장의 범위이고, above와 below는 같은 갈래의
 * 윗길과 아랫길이다. 사문의 시험처럼 정해진 인물은 ranks가 없어 그대로 나온다.
 */
/** 떨어질 비급. 적이 품은 무공이 있으면 그것을, 없으면 그 경지의 품계에서 고른다. 주무공 계열일수록 잘 나온다. */
export function dropSkill(player, hint, grades, faction = null) {
  if (hint && rng.random() < DROP_HINT_RATE && grades.includes(DB.skills[hint].grade)) return hint;
  const main = player.bestSkill()?.category;
  const pool = Object.keys(DB.skills).filter((k) => {
    const s = DB.skills[k];
    // 문파의 무공은 그 문파 사람만 지니고 있다
    return grades.includes(s.grade) && !s.origin && !s.legend && (!s.school || s.school === faction);
  });
  if (!pool.length) return null;
  const counts = {};
  for (const k of pool) counts[DB.skills[k].category] = (counts[DB.skills[k].category] || 0) + 1;
  return pickWeighted(pool, pool.map((k) => (DB.skills[k].category === main ? DROP_MAIN_RATE : DROP_OTHER_RATE) / counts[DB.skills[k].category]));
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
      if (main) notes.push(...main.gainMastery(main.category === effect.style ? effect.amount : Math.floor(effect.amount / 2)));
    } else if (effect.type === "cure" && effect.what === "injury") {
      player.addInjury(-(effect.amount ?? 1));
    } else if (effect.type === "stat") {
      notes.push(`${STAT_NAMES[effect.stat]}+${player.gainStat(effect.stat, effect.amount)}`);
    }
  }
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
    this.guardedLast = 0;
    this.chainStacks = 0;    // 끊이지 않고 이어 맞힌 수
    this.forceCrit = false;  // 다음 공격은 회심
    this.enemyStun = false;  // 다음 합에 적이 움직이지 못한다
    this.enemyWeaken = null; // 적의 위력 감소
    this.burn = null;        // 적이 입는 지속 피해
    this.ward = 0;           // 피해를 대신 받는 호신 기운
    this.regen = null;       // 합마다 차오르는 체력과 내력
    this.reflect = null;     // 받은 피해를 되돌림
    this.lifestealBuff = null;
    this.askStand = false;      // 쓰러지는 순간 힘을 끌어모을지 플레이어에게 묻는다
    this.standPending = false;
    this.companions = isFinal ? activeCompanions(player) : [];
    const ward = sumEffect(player.traits, "battle_start_ward", "percent");
    if (ward) {
      this.ward = Math.trunc(player.maxHp() * ward / 100);
      this.log.push(`(몸 둘레에 호신 기운이 선다. ${this.ward})`);
    }
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
    scale *= 1 + sumEffect(p.traits, "damage_bonus", "percent") / 100;
    scale *= 1 + Math.min(MAX_KILL_POWER, p.kills * sumEffect(p.traits, "kill_power", "percent")) / 100;
    scale *= 1 + sectBonus(p, "damage") / 100;
    scale *= 1 - p.injury * INJURY_PENALTY / 100;
    scale *= 1 + alignValue(p.alignment, "마도", "damage") / 100;
    for (const c of this.companions) scale *= 1 + (c.help.atk || 0) / 100;
    if (this.atkBuff) scale *= 1 + this.atkBuff.percent / 100;
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
    return p.mind / 4000 + (sumEffect(p.traits, "crit", "percent") + sectBonus(p, "crit") + alignValue(p.alignment, "사도", "crit")) / 100;
  }

  strike(power, label, skill = null) {
    const g = skill?.activeGimmick() || {};
    if (!this.hits(g.accuracy || 0)) {
      this.log.push(`${label} — 그러나 ${this.enemy.name}${josa(this.enemy.name, "이/가")} 몸을 틀어 피했다.`);
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
      notes.push("숨통을 노렸다!");
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
      notes.push("배수진!");
    }
    if (this.counterPct) {
      damage *= 1 + this.counterPct / 100;
      notes.push("빈틈을 찔렀다!");
      this.counterPct = 0;
    }
    if (this.forceCrit || rng.random() < this.critChance() + (g.crit || 0) / 100) {
      this.forceCrit = false;
      damage *= 1.5 + (sumEffect(p.traits, "crit_power", "percent") + (g.crit_power || 0)) / 100;
      notes.push("회심의 일격!");
    }
    const pierce = Math.min(100, (g.pierce || 0) + sumEffect(p.traits, "pierce_all", "percent"));
    damage = Math.max(1, Math.trunc(damage) - Math.trunc(this.enemy.armor * (1 - pierce / 100)));
    this.enemy.takeDamage(damage);
    const suffix = notes.length ? ` ${notes.join(" ")}` : "";
    this.log.push(`${label} ${this.enemy.name}에게 ${damage}의 피해.${suffix}`);
    this.applyPoisonOnHit(skill);
    this.applyGimmickOnHit(g, damage);
    return damage;
  }

  /** 맞힌 뒤에 드러나는 무공의 묘리 */
  applyGimmickOnHit(g, damage) {
    const p = this.player;
    const steal = (g.lifesteal || 0) + (this.lifestealBuff?.percent || 0);
    if (steal) {
      const [healed] = p.healAmount(Math.trunc(damage * steal / 100), 0);
      if (healed > 0) this.log.push(`(기운을 빨아들였다. 체력 +${healed})`);
    }
    if (g.qi_back) p.healPercent(0, g.qi_back);
    if (g.burn) this.burn = { damage: Math.max(1, Math.trunc(damage * g.burn / 100)), rounds: 2 };
    if (g.weaken) {
      this.enemyWeaken = { percent: g.weaken.percent, rounds: g.weaken.rounds };
      this.log.push(`(${this.enemy.name}의 기세가 꺾였다.)`);
    }
    if (g.guard) this.guard = { percent: Math.max(g.guard, this.guard?.percent || 0), rounds: 1 };
    if (g.stun && !this.enemyStun && rng.random() * 100 < (this.isFinal ? g.stun / 2 : g.stun)) {
      this.enemyStun = true;
      this.log.push(`(${this.enemy.name}의 몸이 굳었다!)`);
    }
  }

  applyPoisonOnHit(skill) {
    let power = sectBonus(this.player, "poison");
    if (skill?.inflict) power += skill.inflict.poison || 0;
    power += skill?.activeGimmick()?.poison || 0;
    power += sumEffect(this.player.traits, "inflict_poison", "power");
    if (power) this.enemyPoison = { damage: power + Math.floor(this.player.internal / 50), rounds: 3 };
  }

  skillLabel(skill) {
    // 경지가 오르면 초식에 검기나 검강 같은 기운이 실린다
    const aura = this.auraName(skill);
    const lead = aura ? `${aura}${josa(aura, "을/를")} 실은 ` : "";
    if (!skill.forms.length) return `${lead}${skill.name}!`;
    const index = randInt(0, skill.forms.length - 1);
    return `${lead}${skill.name} 제${index + 1}초 「${skill.forms[index]}」!`;
  }

  auraName(skill) {
    const names = DB.realms.aura?.[skill.category];
    const step = realmIndex(this.player.realm);
    if (!names || step < 1) return null;
    return names[step >= 2 ? 1 : 0];
  }

  // ---------- 플레이어 행동 ----------

  basicAttack() { return this.strike(this.attackPower(), "맨손으로 일격!"); }

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
    let damage = 0;
    // 나눠 치는 무공은 한 번마다 명중과 회심을 따로 가린다
    for (let i = 0; i < count && this.enemy.isAlive(); i++) {
      const power = Math.max(1, Math.trunc(this.attackPower(skill) * (g?.hit_rate || 1)));
      damage += this.strike(power, count > 1 ? `${label} 제${i + 1}타,` : label, skill);
    }
    this.applyRecoil(g);
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
    this.applyRecoil(skill.activeGimmick());
    this.checkQiDeviation(skill);
    this.log.push(...skill.gainMastery(this.player.masteryGainAmount()));
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

  /** 주화입마: 마공의 비기는 심경이 70보다 낮을수록 위험하다. */
  checkQiDeviation(skill) {
    if (!skill.risky) return;
    if (rng.random() < Math.max(0, 700 - this.player.mind) * 0.0015) {
      this.player.addInjury(1);
      this.log.push(`🩸 기가 역류한다! 주화입마의 기운에 내상을 입었다. (내상 ${this.player.injury}단계)`);
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
    const [hpChange, qiChange] = p.healPercent(hpValue > 0 ? hpValue * boost : hpValue, qiValue * boost);
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
      this.log.push(`기세가 오른다. (${rounds}합 동안 위력 +${percent}%)`);
    }
    this.applyMindGimmick(skill);
    this.log.push(...skill.gainMastery(p.masteryGainAmount()));
  }

  /** 심법의 묘리. 운기할 때 드러난다. */
  applyMindGimmick(skill) {
    const g = skill.activeGimmick();
    if (!g) return;
    const p = this.player;
    const notes = [];
    if (g.cleanse && this.poison) {
      this.poison = null;
      notes.push("독을 밀어냈다");
    }
    if (g.injury && p.injury && rng.random() * 100 < g.injury) {
      p.addInjury(-1);
      notes.push("내상이 한 단계 가라앉았다");
    }
    if (g.ward) {
      this.ward = Math.max(this.ward, Math.trunc(p.maxHp() * g.ward / 100));
      notes.push(`호신 기운 ${this.ward}`);
    }
    if (g.guard) {
      this.guard = { percent: g.guard.percent, rounds: g.guard.rounds };
      notes.push(`${g.guard.rounds}합 동안 받는 피해 -${g.guard.percent}%`);
    }
    if (g.regen || g.regen_qi) {
      this.regen = { hp: g.regen?.percent || 0, qi: g.regen_qi?.percent || 0, rounds: Math.max(g.regen?.rounds || 0, g.regen_qi?.rounds || 0) };
      notes.push(`${this.regen.rounds}합 동안 기운이 차오른다`);
    }
    if (g.reflect) {
      this.reflect = { percent: g.reflect.percent, rounds: g.reflect.rounds };
      notes.push(`${g.reflect.rounds}합 동안 받은 힘의 ${g.reflect.percent}%를 되돌린다`);
    }
    if (g.lifesteal_buff) {
      this.lifestealBuff = { percent: g.lifesteal_buff.percent, rounds: g.lifesteal_buff.rounds + 1 };
      notes.push(`${g.lifesteal_buff.rounds}합 동안 준 피해의 ${g.lifesteal_buff.percent}%를 흡수한다`);
    }
    if (g.next_power) {
      this.counterPct = Math.max(this.counterPct, g.next_power);
      notes.push(`다음 공격 +${g.next_power}%`);
    }
    if (g.next_crit) {
      this.forceCrit = true;
      notes.push("다음 공격은 반드시 회심");
    }
    if (notes.length) this.log.push(`(묘리 「${g.name}」: ${notes.join(", ")})`);
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
    const notes = useConsumable(this.player, key);
    this.log.push(`${item.name}${josa(item.name, "을/를")} 썼다. (${item.desc})`, ...notes);
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
    if (this.enemyWeaken) base *= 1 - this.enemyWeaken.percent / 100;
    base *= 1 - realmBonus(this.player.realm) / 2;
    base *= 1 - Math.min(MAX_MIND_GUARD, this.player.mind / MIND_GUARD_RATE);
    base *= 1 - sectBonus(this.player, "damage_reduce") / 100;
    base *= 1 - alignValue(this.player.alignment, "정도", "guard") / 100;
    base *= 1 - Math.min(MAX_DAMAGE_REDUCE, sumEffect(this.player.traits, "damage_reduce", "percent")) / 100;
    if (this.guard) base *= 1 - this.guard.percent / 100;
    for (const c of this.companions) base *= 1 - (c.help.guard || 0) / 100;
    const raw = Math.max(1, Math.trunc(base * uniform(0.9, 1.1)) - equipmentBonus(this.player, "armor"));
    // 호신강기는 맞을 때마다 일정한 양을 막는다. 다만 아무리 약한 공격도 조금은 들어온다
    const guard = sumEffect(this.player.traits, "flat_guard", "amount");
    const taken = guard ? Math.max(Math.ceil(raw * MIN_THROUGH_GUARD), raw - guard) : raw;
    this.guardedLast = raw - taken;
    return Math.max(1, taken);
  }

  enemyAttack(evadeSkill = null) {
    const special = this.enemy.specialForRound(this.roundNum);
    const multiplier = special ? special.mult : 1;
    const name = special ? `「${special.name}」` : "공격";
    if (this.enemyStun) {
      this.enemyStun = false;
      this.log.push(`${this.enemy.name}${josa(this.enemy.name, "이/가")} 몸을 추스르느라 이번 합에 손을 쓰지 못했다.`);
      return 0;
    }

    const g = evadeSkill?.activeGimmick();
    if (evadeSkill) {
      const chance = evadeSkill.effectValue("evade") + sectBonus(this.player, "evade");
      if (randInt(1, 100) <= chance) {
        this.counterPct = evadeSkill.effectValue("counter_pct");
        this.log.push(`${this.enemy.name}의 ${name}${josa(name, "을/를")} 흘려냈다! (다음 공격 +${this.counterPct}%)`);
        this.afterEvade(evadeSkill, g);
        return 0;
      }
    } else {
      // 묘리를 깨친 경공은 때로 몸이 먼저 움직인다
      const steps = this.player.bestOfType("경공");
      const auto = steps?.activeGimmick()?.auto_evade || 0;
      if (auto && !this.sealed && rng.random() * 100 < auto) {
        this.log.push(`${steps.name}${josa(steps.name, "이/가")} 저절로 몸을 옮겼다. ${this.enemy.name}의 ${name}${josa(name, "이/가")} 빗나갔다.`);
        return 0;
      }
    }

    let damage = this.incoming(multiplier);
    if (evadeSkill) {
      // 다 피하지 못해도 몸을 띄운 만큼 덜 맞는다
      const rate = g?.partial ?? 0.5;
      damage = Math.max(1, Math.floor(damage * rate));
      this.log.push(`다 피하지는 못했지만 몸을 띄운 덕에 위력이 ${Math.round((1 - rate) * 100)}% 줄었다.`);
    }
    if (this.ward > 0) {
      const absorbed = Math.min(this.ward, damage);
      this.ward -= absorbed;
      damage -= absorbed;
      this.log.push(`호신 기운이 ${absorbed}만큼 대신 받아 냈다.${this.ward ? "" : " 호신 기운이 흩어졌다."}`);
    }
    this.player.hp = Math.max(0, this.player.hp - damage);
    this.log.push(`${this.enemy.name}의 ${name}! ${damage}의 피해를 입었다.${special && this.guardedLast ? ` (호신강기가 ${this.guardedLast}을 막았다)` : ""}`);
    if (this.reflect && damage > 0) {
      const back = Math.max(1, Math.trunc(damage * this.reflect.percent / 100));
      this.enemy.takeDamage(back);
      this.log.push(`받은 힘이 되돌아갔다. ${this.enemy.name}에게 ${back}의 피해.`);
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
      p.qi = Math.min(p.maxQi(), p.qi + skill.qiCost);
      this.log.push("(힘을 들이지 않았다. 쓴 내력을 되찾았다.)");
    }
    if (g.next_crit) this.forceCrit = true;
    if (g.step_heal) {
      const [healed] = p.healPercent(g.step_heal, 0);
      if (healed > 0) this.log.push(`(숨을 돌렸다. 체력 +${healed})`);
    }
    if (g.strike) {
      const main = p.bestSkill();
      const power = Math.max(1, Math.trunc(this.attackPower(main) * g.strike / 100));
      this.strike(power, `「${g.name}」, 몸을 돌려 되받아쳤다!`, null);
    }
  }

  applySpecialEffects(special) {
    const p = this.player;
    if (special.seal && hasEffect(this.player.traits, "seal_immune")) {
      this.log.push("혈도를 노렸지만 기운이 막히지 않았다.");
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

  /** 쓰러지는 순간 남은 기회가 있으면 마지막 힘을 끌어모은다. 플레이어가 고르게 되어 있으면 먼저 묻는다. */
  checkRevive() {
    const p = this.player;
    if (this.spar || p.hp > 0 || p.revives <= 0 || this.standPending) return;
    if (this.askStand) {
      this.standPending = true;
      return;
    }
    this.gatherLastStrength();
  }

  /** 물음에 답한다. 힘을 끌어모으면 null, 눈을 감으면 전투 결과를 돌려준다 */
  answerStand(gather) {
    if (!this.standPending) return null;
    this.standPending = false;
    if (!gather) {
      this.log.push("끌어모을 수 있는 힘을 그대로 놓았다. 눈이 감긴다.");
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
    p.note(`${this.enemy.name} 앞에서 쓰러지려다 마지막 힘을 끌어모아 버텼다.`);
    this.log.push(`🕯️ 꺼져 가던 단전의 불씨를 어떻게든 끌어모았다. 몸이 다시 움직인다! (체력 ${p.hp}, 내력 ${p.qi}, 남은 기회 ${p.revives})`);
  }

  nextSpecialWarning() { return this.enemy.specialForRound(this.roundNum + 1)?.name ?? null; }

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
    if (this.burn) {
      this.enemy.takeDamage(this.burn.damage);
      this.log.push(`${this.enemy.name}의 상처에서 기운이 번진다. (${this.burn.damage} 피해)`);
      this.burn.rounds -= 1;
      if (this.burn.rounds <= 0) this.burn = null;
    }
    const regen = sumEffect(this.player.traits, "round_regen", "hp_pct");
    const regenQi = sumEffect(this.player.traits, "round_regen", "qi_pct");
    if ((regen || regenQi) && this.player.hp > 0) this.player.healPercent(regen, regenQi);
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
          this.log.push(`${line} (${this.enemy.name}의 몸이 굳었다!)`);
        }
      } else if (help.weaken) {
        this.enemyWeaken = { percent: help.weaken, rounds: help.rounds || 2 };
        this.log.push(`${line} (${help.rounds || 2}합 동안 ${this.enemy.name}의 위력 -${help.weaken}%)`);
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
    if (this.standPending) return null;
    if (this.player.hp > 0) this.tickEffects();
    if (this.standPending) return null;
    if (this.player.hp <= 0) return this.finish(false);
    if (!this.enemy.isAlive()) return this.finish(true);

    const warning = this.nextSpecialWarning();
    if (warning) this.log.push(`⚠️ ${this.enemy.name}${josa(this.enemy.name, "이/가")} 「${warning}」의 기세를 끌어올린다!`);
    return null;
  }

  finish(victory, fled = false) {
    this.revertTempBuffs();
    if (fled) return { victory: false, fled: true, exp: 0 };

    const exp = victory ? this.enemy.expReward + sumEffect(this.player.traits, "battle_exp", "amount") : 0;
    if (victory) {
      this.player.battles += exp;
      // 비무는 사람을 죽이는 싸움이 아니다
      if (!this.spar) {
        this.player.kills += 1;
        if (isNamed(this.enemy.key) && !this.player.slain.includes(this.enemy.key)) this.player.slain.push(this.enemy.key);
        const flag = DB.enemies[this.enemy.key].kill_flag;
        if (flag) this.player.addFlag(flag);
        const side = dominant(this.player.alignment);
        if (KILL_ALIGN[side]) this.player.adjustAlignment(side, KILL_ALIGN[side] / 2); // 앞선 길은 두 배로 오른다
      }
      const outro = reactiveLine(this.player, this.enemy.outros, this.enemy.outro);
      if (outro) this.log.push(outro);
      else if (!this.enemy.beast && !this.spar && rng.random() < VICTORY_TALK_RATE) {
        const talk = talkLine(this.player, "victory");
        if (talk) this.log.push(talk);
      }
      this.log.push(this.spar ? `${this.enemy.name}${josa(this.enemy.name, "을/를")} 꺾었다! 실전 경험 +${exp}` : `${this.enemy.name}${josa(this.enemy.name, "을/를")} 쓰러뜨렸다! 실전 경험 +${exp}`);
      const fameBefore = this.player.fame;
      this.player.fame += FAME_BY_TIER[this.enemy.tier] || 0;
      const rank = fameRankChanged(fameBefore, this.player.fame);
      if (rank) {
        this.log.push(`강호에서 「${rank}」${josa(rank, "으로")} 불리기 시작했다.`);
        this.player.note(`강호에서 「${rank}」${josa(rank, "으로")} 불리기 시작했다.`);
      }
      this.applyStatGrowth();
      this.gainSilver();
      this.rollDrop();
      this.applyBattleEndBuffs();
    } else if (this.spar) {
      // 비무에 지면 체력이 조금 남고 얻는 것이 없다
      this.player.hp = Math.max(1, Math.trunc(this.player.maxHp() * SPAR_LOSS_HP));
      this.log.push(`${this.enemy.name}${josa(this.enemy.name, "이/가")} 칼끝을 멈췄다. 비무에 졌다. 얻은 것은 없고 몸만 상했다. (체력 ${this.player.hp})`);
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

  /** 적의 경지에 맞는 비급과 약이 떨어진다. 산적이 명품 비급을 품고 다니지는 않는다. */
  rollDrop() {
    if (this.enemy.beast) {
      // 짐승은 비급을 품지 않는다. 쓸개나 내단이 나온다
      const { loot } = DB.enemies[this.enemy.key];
      if (loot && rng.random() < loot.chance) {
        this.player.addItem(loot.item);
        const name = DB.market[loot.item].name;
        this.log.push(`🐾 ${name}${josa(name, "을/를")} 거두었다. 행낭에 넣었다.`);
      }
      return;
    }
    const table = DB.balance.drops[this.enemy.realm];
    if (!table || this.enemy.tier === "보스") return;
    const tierRate = DB.balance.drop_tier_rate[this.enemy.tier] ?? 1;
    if (table.medicine?.length && rng.random() < DROP_MEDICINE_RATE * tierRate) {
      const item = pick(table.medicine);
      this.player.addItem(item);
      this.log.push(`🧪 품에서 ${DB.market[item].name}${josa(DB.market[item].name, "이/가")} 나왔다. 행낭에 넣었다.`);
    }
    if (rng.random() >= table.book * tierRate) return;
    const key = dropSkill(this.player, this.enemy.drop?.skill, table.grades, DB.enemies[this.enemy.key].faction);
    if (!key) return;
    const known = this.player.hasSkill(key);
    const skill = new Skill(key);
    const notes = this.player.learnSkill(skill);
    this.log.push(known ? `📕 품에서 비급이 떨어졌다. 「${skill.name}」, 아는 무공이다.` : `📕 품에서 비급이 떨어졌다. 새 무공 「${skill.name}」${josa(skill.name, "을/를")} 얻었다!`, ...notes);
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
