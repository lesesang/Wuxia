// 무공과 플레이어
import { DB } from "./data.js";
import { randInt } from "./rng.js";
import {
  dominant, hasEffect, MA_HEAL_PENALTY, newAlignment, ORIGIN_SECTS, SA_SILVER_BONUS, sectBonus,
  startSkills, sumEffect,
} from "./rules.js";

export const GRADE_ORDER = ["기본", "명품", "상승", "신공", "천상"];
const GRADE_BONUS = 0.25;       // 승급 1단계당 위력 계수 증가
const MASTERY_BONUS = 0.003;    // 성취 1당 위력 계수 증가
const EFFECT_GRADE_BONUS = 0.2; // 심공·경공 승급 1단계당 효과 증가율

export const START_SILVER = 30;
export const STAT_CAP = 99;
export const MAX_INJURY = 3;
export const MAX_TURN = 120;
export const STAT_NAMES = { external: "외공", internal: "내공", martial: "무리", mind: "심경" };

export class Skill {
  constructor(key) {
    const data = DB.skills[key];
    if (!data) throw new Error(`알 수 없는 무공: ${key}`);
    this.key = key;
    this.name = data.name;
    this.type = data.type;
    this.category = data.category;
    this.grade = data.grade;
    this.startGrade = data.grade;
    this.baseMultiplier = data.base_multiplier;
    this.qiCost = data.qi_cost || 0;
    this.desc = data.desc || "";
    this.effect = data.effect || {};
    this.forms = data.forms || [];
    this.risky = !!data.risky;
    this.inflict = data.inflict || null;
    this.mastery = 0;

    const secret = data.secret_technique || {};
    this.secretName = secret.name || null;
    this.secretUnlockGrade = secret.unlock_grade || "상승";
    this.secretUnlockMastery = secret.unlock_mastery ?? 70;
    this.secretMultiplier = secret.multiplier ?? 2.0;
    this.secretQiCost = secret.qi_cost ?? 30;
    this.secretUnlocked = false;
  }

  /** 성취를 올리고, 승급·비기 터득이 일어나면 안내 문구 목록을 돌려준다. */
  gainMastery(amount) {
    const messages = [];
    this.mastery = Math.min(100, this.mastery + amount);
    if (this.canEvolve()) {
      this.evolve();
      messages.push(`🌟 ${this.name}이(가) ${this.grade} 품계로 승급했다!`);
    }
    if (this.checkSecretUnlock()) messages.push(`✨ 비기 「${this.secretName}」이(가) 터득되었다!`);
    return messages;
  }

  canEvolve() { return this.grade !== "천상" && this.mastery >= 100; }

  evolve() {
    if (!this.canEvolve()) return false;
    this.grade = GRADE_ORDER[GRADE_ORDER.indexOf(this.grade) + 1];
    this.mastery = 30;
    return true;
  }

  gradesGained() { return GRADE_ORDER.indexOf(this.grade) - GRADE_ORDER.indexOf(this.startGrade); }

  checkSecretUnlock() {
    if (this.secretUnlocked || !this.secretName) return false;
    const gradeOk = GRADE_ORDER.indexOf(this.grade) >= GRADE_ORDER.indexOf(this.secretUnlockGrade);
    if (gradeOk && this.mastery >= this.secretUnlockMastery) {
      this.secretUnlocked = true;
      return true;
    }
    return false;
  }

  effectiveMultiplier() {
    return this.baseMultiplier + this.gradesGained() * GRADE_BONUS + this.mastery * MASTERY_BONUS;
  }

  /** 심공·경공 효과 수치. 승급할수록 강해지며 양수만 증가한다. */
  effectValue(name) {
    const value = this.effect[name] || 0;
    if (value <= 0) return value;
    return Math.trunc(value * (1 + this.gradesGained() * EFFECT_GRADE_BONUS + this.mastery * 0.002));
  }

  toDict() {
    return { key: this.key, grade: this.grade, mastery: this.mastery, secret_unlocked: this.secretUnlocked };
  }

  static fromDict(d) {
    const skill = new Skill(d.key);
    skill.grade = d.grade ?? skill.grade;
    skill.mastery = d.mastery ?? 0;
    skill.secretUnlocked = !!d.secret_unlocked;
    return skill;
  }
}

export class Player {
  constructor(originKey = "무림초출", traitKeys = []) {
    const data = DB.origins.origins[originKey];
    this.origin = data.name;
    this.originKey = originKey;
    this.realm = "일류";
    this.external = data.external;
    this.internal = data.internal;
    this.martial = data.martial;
    this.mind = data.mind;
    this.traits = traitKeys;

    // 천품의 시작 기량 보정은 기혈·내력 계산 전에 적용한다
    for (const key of traitKeys) {
      for (const effect of DB.traits[key]?.effects || []) {
        if (effect.type === "start_stat") this[effect.stat] += effect.amount;
      }
    }
    this.hp = this.maxHp();
    this.qi = this.maxQi();
    this.battles = 0;
    this.encounteredEnemies = [];
    this.pendingEncounters = [];

    this.skills = [];
    this.mainSkill = null;
    for (const key of [...(data.skills || []), ...startSkills(traitKeys)]) {
      if (!this.hasSkill(key)) this.learnSkill(new Skill(key));
    }

    this.silver = START_SILVER + sumEffect(traitKeys, "start_silver", "amount");
    this.weapon = null;
    this.armor = null;
    this.inventory = {};
    this.bossWeaken = 0;
    this.alignment = newAlignment();
    this.flags = [];
    this.seenEvents = [];
    this.kills = 0;
    this.fame = sumEffect(traitKeys, "start_fame", "amount");
    this.sect = ORIGIN_SECTS[originKey] || null;
    this.injury = 0;
    this.turn = 1;
    this.maxTurn = MAX_TURN;
    this.alive = true;
  }

  maxHp() { return 100 + this.external * 5; }
  maxQi() { return 100 + this.internal * 5; }
  dominantAlignment() { return dominant(this.alignment); }

  /** 기량을 올리고 상한 99를 적용한다. 실제로 오른 양을 돌려준다. */
  gainStat(stat, amount) {
    const before = this[stat];
    const after = Math.max(before, Math.min(STAT_CAP, before + amount));
    this[stat] = after;
    return after - before;
  }

  /** 기혈·내력을 최대치 비율로 바꾼다. 기혈은 1 아래로 내려가지 않는다. [기혈 변화, 내력 변화] */
  healPercent(hpPct = 0, qiPct = 0) {
    const penalty = this.dominantAlignment() === "마도" ? 1 - MA_HEAL_PENALTY / 100 : 1;
    const hpChange = Math.trunc(this.maxHp() * hpPct / 100 * (hpPct > 0 ? penalty : 1));
    const qiChange = Math.trunc(this.maxQi() * qiPct / 100 * (qiPct > 0 ? penalty : 1));
    const hpBefore = this.hp;
    const qiBefore = this.qi;
    this.hp = Math.max(1, Math.min(this.maxHp(), this.hp + hpChange));
    this.qi = Math.max(0, Math.min(this.maxQi(), this.qi + qiChange));
    return [this.hp - hpBefore, this.qi - qiBefore];
  }

  gainSilver(amount) {
    let percent = sumEffect(this.traits, "silver_rate", "percent") + sectBonus(this, "silver");
    if (this.dominantAlignment() === "사도") percent += SA_SILVER_BONUS;
    const gained = Math.trunc(amount * (1 + percent / 100));
    this.silver += gained;
    return gained;
  }

  addInjury(amount = 1) {
    if (amount > 0 && hasEffect(this.traits, "no_injury")) return;
    this.injury = Math.max(0, Math.min(MAX_INJURY, this.injury + amount));
  }

  adjustAlignment(name, amount) { this.alignment[name] = Math.max(0, (this.alignment[name] || 0) + amount); }
  hasFlag(flag) { return this.flags.includes(flag); }
  addFlag(flag) { if (!this.hasFlag(flag)) this.flags.push(flag); }

  hasSkill(key) { return this.skills.some((s) => s.key === key); }
  getSkill(key) { return this.skills.find((s) => s.key === key) || null; }
  skillsOfType(type) { return this.skills.filter((s) => s.type === type); }

  /** 무공 습득. 이미 익혔으면 성취를 올린다. 안내 문구 목록을 돌려준다. */
  learnSkill(skill) {
    const owned = this.getSkill(skill.key);
    if (owned) return [`이미 아는 무공이다. ${owned.name}의 이해가 깊어졌다.`, ...owned.gainMastery(25)];
    this.skills.push(skill);
    if (skill.type !== "공격무공") return [];
    const current = this.mainSkill ? this.getSkill(this.mainSkill) : null;
    if (!current) {
      this.mainSkill = skill.key;
    } else if (skill.effectiveMultiplier() > current.effectiveMultiplier()) {
      // 비기까지 터득한 무공은 함부로 바꾸지 않고 플레이어에게 맡긴다
      if (current.secretUnlocked) return [`상태 창에서 「${skill.name}」을(를) 주무공으로 바꿀 수 있다.`];
      this.mainSkill = skill.key;
    }
    return [];
  }

  bestSkill() {
    const current = this.mainSkill ? this.getSkill(this.mainSkill) : null;
    if (current && current.type === "공격무공") return current;
    const attacks = this.skillsOfType("공격무공");
    if (!attacks.length) return null;
    return attacks.reduce((a, b) => (b.effectiveMultiplier() > a.effectiveMultiplier() ? b : a));
  }

  bestOfType(type) {
    const score = (s) => s.gradesGained() * 1000 + Object.values(s.effect).reduce((t, v) => t + Math.max(v, 0), 0);
    const options = this.skillsOfType(type);
    if (!options.length) return null;
    return options.reduce((a, b) => (score(b) > score(a) ? b : a));
  }

  addItem(key, count = 1) { this.inventory[key] = (this.inventory[key] || 0) + count; }
  masteryGainAmount() { return randInt(1, 2) + Math.floor(this.martial / 50); }

  recordEnemyEncounter(key) {
    if (!this.encounteredEnemies.includes(key) && !this.pendingEncounters.includes(key)) {
      this.pendingEncounters.push(key);
    }
  }

  commitPendingEncounters() {
    const added = this.pendingEncounters.filter((k) => !this.encounteredEnemies.includes(k));
    this.encounteredEnemies.push(...added);
    this.pendingEncounters = [];
    return added;
  }

  toDict() {
    return {
      origin: this.origin, origin_key: this.originKey, realm: this.realm,
      external: this.external, internal: this.internal, martial: this.martial, mind: this.mind,
      hp: this.hp, qi: this.qi, battles: this.battles,
      encountered_enemies: this.encounteredEnemies, pending_encounters: this.pendingEncounters,
      skills: this.skills.map((s) => s.toDict()), main_skill: this.mainSkill,
      traits: this.traits, silver: this.silver, weapon: this.weapon, armor: this.armor,
      inventory: this.inventory, boss_weaken: this.bossWeaken, alignment: this.alignment,
      flags: this.flags, seen_events: this.seenEvents, kills: this.kills,
      fame: this.fame, sect: this.sect, injury: this.injury,
      turn: this.turn, max_turn: this.maxTurn, alive: this.alive,
    };
  }

  /** 없는 값은 기본값으로 채워 이전 저장도 읽는다. */
  static fromDict(d) {
    const p = Object.create(Player.prototype);
    p.origin = d.origin;
    p.originKey = d.origin_key ?? "무림초출";
    p.realm = d.realm;
    p.external = d.external;
    p.internal = d.internal;
    p.martial = d.martial;
    p.mind = d.mind;
    p.hp = d.hp;
    p.qi = d.qi;
    p.battles = d.battles ?? 0;
    p.encounteredEnemies = [...(d.encountered_enemies || [])];
    p.pendingEncounters = [...(d.pending_encounters || [])];
    p.skills = (d.skills || []).map((s) => Skill.fromDict(s));
    p.mainSkill = d.main_skill ?? null;
    p.traits = [...(d.traits || [])];
    p.silver = d.silver ?? 0;
    p.weapon = d.weapon ?? null;
    p.armor = d.armor ?? null;
    p.inventory = { ...(d.inventory || {}) };
    p.bossWeaken = d.boss_weaken ?? 0;
    p.alignment = { ...newAlignment(), ...(d.alignment || {}) };
    p.flags = [...(d.flags || [])];
    p.seenEvents = [...(d.seen_events || [])];
    p.kills = d.kills ?? 0;
    p.fame = d.fame ?? 0;
    p.sect = d.sect !== undefined ? d.sect : (ORIGIN_SECTS[p.originKey] || null);
    p.injury = d.injury ?? 0;
    p.turn = d.turn;
    p.maxTurn = MAX_TURN;
    p.alive = d.alive;
    // 60달 시절의 저장은 시간표를 두 배로 늘려 이어 간다
    if (d.max_turn === 60) {
      p.turn = d.turn * 2 - 1;
      p.battles *= 2;
    }
    return p;
  }
}
