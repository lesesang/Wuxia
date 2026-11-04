// 무공과 플레이어
import { DB } from "./data.js";
import { RENAMED_ORIGINS } from "./meta.js";
import { randInt } from "./rng.js";
import {
  ALIGN_CLASH, ALIGNMENT_CAP, ALIGNMENT_SCALE, alignValue, dominant, FOCUS_GAIN, hasEffect, newAlignment, ORIGIN_SECTS, sectBonus, perkTrait, realmPerks,
  startSkills, sumEffect,
} from "./rules.js";
import { josa } from "./josa.js";

export const GRADE_ORDER = ["기본", "명품", "상승", "일절", "신공"];
export const GIMMICK_GRADE = "상승"; // 이 품계부터 무공의 묘리가 드러난다
const SAME_GRADE_TRANSFER = 0.5;  // 같은 품계 무공의 성취를 옮기는 비율
const LOWER_GRADE_TRANSFER = 0.3; // 낮은 품계 무공의 성취를 옮기는 비율
const MAX_MASTERY = 100;
const GRADE_BONUS = 0.25;       // 승급 1단계당 위력 계수 증가
const MASTERY_BONUS = 0.003;    // 성취 1당 위력 계수 증가
const EFFECT_GRADE_BONUS = 0.2; // 심공·경공 승급 1단계당 효과 증가율

export const START_SILVER = 30;
export const HOME_ART_MASTERY = 40; // 출신이 오래 갈고닦은 무공의 처음 성취
const DUPLICATE_SKILL_MASTERY = 25;
const START_ARMORS = ["가죽호구", "철사갑의", "금사보의"]; // 겹쳐 받으면 한 단계씩 좋아진다
const SPARE_ARMOR_SILVER = 40; // 넘치는 갑의는 은자로 돌아온다
const CHRONICLE_LIMIT = 40;
export const STAT_CAP = 999;
// 이름을 고친 물건. 예전 저장의 물건을 새 이름으로 읽는다
const RENAMED_ITEMS = { 귀두도: "귀면도", 참마도: "항마대도", 적련수갑: "적련장갑", 빙화천수갑: "빙화장갑" };
const renamedItem = (key) => RENAMED_ITEMS[key] || key;

const STAT_SOFT_CAP = 850;  // 기량이 이 값을 넘으면 더디게 오른다
const STAT_SOFT_RATE = 0.4;
export const STAT_SCALE = 10; // 기량 10이 예전 기량 1에 해당한다. 공식은 이 값으로 나누어 쓴다
export const MAX_INJURY = 3;
export const MAX_TURN = 120;
const SILVER_EASE = 1.1; // 얻는 은자의 기본 배율
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
    this.gimmick = data.gimmick || null;
    this.mastery = 0;

    const secret = data.secret_technique || {};
    this.secretName = secret.name || null;
    this.secretUnlockGrade = secret.unlock_grade || "상승";
    this.secretUnlockMastery = secret.unlock_mastery ?? 70;
    this.secretMultiplier = secret.multiplier ?? 2.0;
    this.secretQiCost = secret.qi_cost ?? 30;
    this.secretUnlocked = false;
  }

  /** 숙련도를 올리고, 승급·비기 터득이 일어나면 안내 문구 목록을 돌려준다. */
  gainMastery(amount) {
    const messages = [];
    // 성취가 100에 이른 뒤 더 쌓이면 승급한다. 정확히 100이면 다음 성취를 기다린다.
    if (this.mastery + amount > MAX_MASTERY && this.canEvolve()) {
      this.evolve();
      messages.push(`${this.name}${josa(this.name, "이/가")} ${this.grade} 품계로 승급했다`);
      if (this.grade === GIMMICK_GRADE && this.gimmick) messages.push(`묘리를 깨쳤다. ${this.gimmick.name}: ${this.gimmick.text}`);
    } else {
      this.mastery = Math.min(MAX_MASTERY, this.mastery + amount);
    }
    if (this.checkSecretUnlock()) messages.push(`비기 ${this.secretName}${josa(this.secretName, "이/가")} 터득되었다`);
    return messages;
  }

  /** 일절의 끝에 이른 무공이 큰 깨달음으로 신공의 경지에 오른다. 사건으로만 일어난다. */
  ascend() {
    if (this.grade !== "일절" || this.mastery < MAX_MASTERY) return false;
    this.grade = "신공";
    this.mastery = 30;
    this.ascended = true;
    return true;
  }

  /** 상승 품계 이상에서만 드러나는 그 무공만의 묘리 */
  activeGimmick() {
    return GRADE_ORDER.indexOf(this.grade) >= GRADE_ORDER.indexOf(GIMMICK_GRADE) ? this.gimmick : null;
  }

  /** 승급으로는 최고 품계(신공)에 오르지 못한다. 일절이 승급의 끝이다. */
  canEvolve() { return GRADE_ORDER.indexOf(this.grade) < GRADE_ORDER.length - 2; }

  /** 품계가 같거나 낮은 같은 계열 무공에서 주무공으로 옮길 수 있는 성취. 없으면 0 */
  masteryFor(main) {
    if (this.type !== "공격무공" || !main || main === this || main.category !== this.category) return 0;
    const gap = GRADE_ORDER.indexOf(main.grade) - GRADE_ORDER.indexOf(this.grade);
    if (gap < 0) return 0;
    return Math.floor(this.mastery * (gap === 0 ? SAME_GRADE_TRANSFER : LOWER_GRADE_TRANSFER));
  }

  evolve() {
    if (!this.canEvolve()) return false;
    this.grade = GRADE_ORDER[GRADE_ORDER.indexOf(this.grade) + 1];
    this.mastery = this.evolveMastery ?? 30;
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
    return { key: this.key, grade: this.grade, mastery: this.mastery, secret_unlocked: this.secretUnlocked, ascended: !!this.ascended };
  }

  static fromDict(d) {
    const skill = new Skill(d.key);
    skill.grade = d.grade ?? skill.grade;
    // 예전 저장: 옛 신공은 이제 일절이고, 신공 품계는 정해진 무공만 갖는다
    if (skill.grade === "천상" || (skill.grade === "신공" && DB.skills[d.key].grade !== "신공" && !d.ascended)) skill.grade = "일절";
    skill.ascended = !!d.ascended;
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

    // 특성의 시작 능력치 보정은 체력·기력 계산 전에 적용한다
    for (const key of traitKeys) {
      for (const effect of DB.traits[key]?.effects || []) {
        if (effect.type === "start_stat") this[effect.stat] += effect.amount;
      }
    }
    this.hp = this.maxHp();
    this.qi = this.maxQi();
    this.battles = sumEffect(traitKeys, "start_battles", "amount");
    this.encounteredEnemies = [];
    this.pendingEncounters = [];

    this.skills = [];
    this.mainSkill = null;
    this.chosenArts = {}; // 쓰는 심법과 경공
    for (const key of data.skills || []) {
      const skill = new Skill(key);
      skill.mastery = HOME_ART_MASTERY;
      this.learnSkill(skill);
    }
    for (const key of startSkills(traitKeys)) {
      // 같은 무공을 또 받으면 그만큼 깊어진다
      if (this.hasSkill(key)) this.getSkill(key).gainMastery(DUPLICATE_SKILL_MASTERY);
      else this.learnSkill(new Skill(key));
    }

    this.silver = START_SILVER + (data.silver || 0) + sumEffect(traitKeys, "start_silver", "amount");
    this.weapon = data.weapon || null;
    this.armor = null;
    this.gear = []; // 갈아 쓸 수 있게 챙겨 둔 병장기
    this.pendingLegacy = []; // 이어받기로 했지만 아직 흔적을 찾지 못한 유산
    this.inventory = { ...(data.items || {}) };
    for (const key of traitKeys) {
      for (const effect of DB.traits[key]?.effects || []) {
        if (effect.type === "start_item") this.inventory[effect.item] = (this.inventory[effect.item] || 0) + effect.amount;
      }
    }
    const armorTier = sumEffect(traitKeys, "start_armor", "tier");
    if (armorTier) {
      this.armor = START_ARMORS[Math.min(armorTier, START_ARMORS.length) - 1];
      this.silver += Math.max(0, armorTier - START_ARMORS.length) * SPARE_ARMOR_SILVER;
    }
    this.bossWeaken = 0;
    this.chronicle = [];
    this.slain = []; // 쓰러뜨린 이름 있는 적
    this.content = [];
    this.chains = [];
    this.chainsDone = 0;
    this.alignment = newAlignment();
    for (const key of traitKeys) {
      for (const effect of DB.traits[key]?.effects || []) {
        if (effect.type === "start_alignment") this.alignment[effect.side] += effect.amount;
      }
    }
    this.flags = [];
    this.seenEvents = [];
    this.kills = 0;
    this.alignMark = null;
    this.fame = sumEffect(traitKeys, "start_fame", "amount");
    this.sect = ORIGIN_SECTS[originKey] || null;
    this.injury = 0;
    this.turn = 1;
    this.maxTurn = MAX_TURN;
    this.alive = true;
    this.revives = 1 + sumEffect(traitKeys, "extra_revive", "amount");
  }

  maxHp() { return 100 + Math.trunc(this.external * 0.28 + this.internal * 0.17); }
  maxQi() { return 100 + Math.trunc(this.internal / 2); }
  dominantAlignment() { return dominant(this.alignment); }

  /** 능력치를 올리고 상한 999를 적용한다. 실제로 오른 양을 돌려준다. */
  gainStat(stat, amount) {
    const before = this[stat];
    // 끝에 가까울수록 더디게 오른다. 넘는 몫의 절반만 붙는다
    const raised = before + amount;
    const eased = raised > STAT_SOFT_CAP ? Math.max(before, STAT_SOFT_CAP) + Math.ceil((raised - Math.max(before, STAT_SOFT_CAP)) * STAT_SOFT_RATE) : raised;
    const after = Math.max(before, Math.min(STAT_CAP, eased));
    this[stat] = after;
    return after - before;
  }

  /** 정한 양만큼 회복한다. 마도의 회복 감소를 받는다. [체력 변화, 내력 변화] */
  healAmount(hp = 0, qi = 0) {
    const penalty = 1 - alignValue(this.alignment, "마도", "healCut") / 100;
    const hpBefore = this.hp;
    const qiBefore = this.qi;
    this.hp = Math.min(this.maxHp(), this.hp + Math.trunc(hp * penalty));
    this.qi = Math.min(this.maxQi(), this.qi + Math.trunc(qi * penalty));
    return [this.hp - hpBefore, this.qi - qiBefore];
  }

  /** 체력·기력을 최대치 비율로 바꾼다. 체력은 1 아래로 내려가지 않는다. [체력 변화, 기력 변화] */
  healPercent(hpPct = 0, qiPct = 0) {
    const penalty = 1 - alignValue(this.alignment, "마도", "healCut") / 100;
    const hpChange = Math.trunc(this.maxHp() * hpPct / 100 * (hpPct > 0 ? penalty : 1));
    const qiChange = Math.trunc(this.maxQi() * qiPct / 100 * (qiPct > 0 ? penalty : 1));
    const hpBefore = this.hp;
    const qiBefore = this.qi;
    this.hp = Math.max(1, Math.min(this.maxHp(), this.hp + hpChange));
    this.qi = Math.max(0, Math.min(this.maxQi(), this.qi + qiChange));
    return [this.hp - hpBefore, this.qi - qiBefore];
  }

  /** 기량이 줄어 최대치가 내려가면 남은 체력과 내력도 맞춘다. */
  clampVitals() {
    this.hp = Math.min(this.hp, this.maxHp());
    this.qi = Math.min(this.qi, this.maxQi());
  }

  gainSilver(amount) {
    let percent = sumEffect(this.traits, "silver_rate", "percent") + sectBonus(this, "silver");
    percent += alignValue(this.alignment, "사도", "silver");
    const gained = Math.trunc(amount * (1 + percent / 100) * SILVER_EASE);
    this.silver += gained;
    return gained;
  }

  addInjury(amount = 1) {
    if (amount > 0 && hasEffect(this.traits, "no_injury")) return;
    this.injury = Math.max(0, Math.min(MAX_INJURY, this.injury + amount));
  }

  adjustAlignment(name, amount) {
    // 그 길로 기운 자질이 있으면 오를 때 더 오른다
    const extra = amount > 0 ? this.traits.flatMap((k) => DB.traits[k]?.effects || [])
      .filter((e) => e.type === "alignment_gain" && e.side === name).reduce((sum, e) => sum + e.amount, 0) : 0;
    // 앞선 길은 더 쉽게 오른다
    const focus = amount > 0 && dominant(this.alignment) === name ? FOCUS_GAIN[name] : 1;
    const before = this.alignment[name] || 0;
    this.alignment[name] = Math.max(0, Math.min(ALIGNMENT_CAP, Math.round(before + amount * focus + extra)));
    const change = this.alignment[name] - before;
    // 한 길로 기울면 부딪치는 길은 물러난다
    if (change > 0) {
      for (const [other, rate] of Object.entries(ALIGN_CLASH[name] || {})) {
        this.alignment[other] = Math.max(0, Math.round((this.alignment[other] || 0) - change * rate));
      }
    }
    return change;
  }
  hasFlag(flag) { return this.flags.includes(flag); }
  addFlag(flag) { if (!this.hasFlag(flag)) this.flags.push(flag); }

  /** 같은 무공이거나 그 무공을 이어받은 더 깊은 갈래를 익혔으면 그 무공 */
  getSkill(key) {
    const same = this.skills.find((s) => s.key === key);
    if (same) return same;
    const { lineage, lineage_rank: rank } = DB.skills[key] || {};
    if (!lineage) return null;
    return this.skills.find((s) => DB.skills[s.key].lineage === lineage && DB.skills[s.key].lineage_rank >= rank) || null;
  }
  hasSkill(key) { return this.getSkill(key) !== null; }
  skillsOfType(type) { return this.skills.filter((s) => s.type === type); }

  /** 무공 습득. 이미 익혔으면 숙련도를 올린다. 안내 문구 목록을 돌려준다. */
  learnSkill(skill) {
    const owned = this.getSkill(skill.key);
    if (owned) {
      const lead = owned.key === skill.key ? `이미 아는 무공이다. ${owned.name}의 이해가 깊어졌다.` : `${skill.name}${josa(skill.name, "은/는")} 이미 ${owned.name}에 녹아 있다. 이해가 깊어졌다.`;
      return [`${lead} (성취 +${DUPLICATE_SKILL_MASTERY})`, ...owned.gainMastery(DUPLICATE_SKILL_MASTERY)];
    }
    const root = this.skills.find((s) => DB.skills[skill.key].lineage && DB.skills[s.key].lineage === DB.skills[skill.key].lineage);
    if (root) return this.inheritLineage(root, skill);
    // 새로 얻었거나 품계가 높아도 쓰던 무공을 바꾸지 않는다. 바꾸는 것은 플레이어의 몫이다
    const current = skill.type === "공격무공" ? this.getSkill(this.mainSkill) : this.bestOfType(skill.type);
    this.skills.push(skill);
    this.applyEvolveTrait(skill);
    if (!current) {
      if (skill.type === "공격무공") this.mainSkill = skill.key;
      else this.chosenArts[skill.type] = skill.key;
      return [];
    }
    return [`${skill.name}${josa(skill.name, "은/는")} 신상의 무공 칸에서 골라 쓸 수 있다.`];
  }

  /** 같은 갈래의 더 깊은 무공을 얻으면 따로 쌓지 않고 이어받는다. 성취와 오른 품계는 그대로 간다. */
  inheritLineage(root, skill) {
    skill.mastery = Math.max(skill.mastery, root.mastery);
    if (GRADE_ORDER.indexOf(root.grade) > GRADE_ORDER.indexOf(skill.grade)) skill.grade = root.grade;
    this.skills[this.skills.indexOf(root)] = skill;
    if (this.mainSkill === root.key) this.mainSkill = skill.key;
    for (const [type, key] of Object.entries(this.chosenArts)) if (key === root.key) this.chosenArts[type] = skill.key;
    this.applyEvolveTrait(skill);
    return [`${root.name}${josa(root.name, "이/가")} ${skill.name}${josa(skill.name, "으로")} 이어졌다. 쌓은 성취는 그대로다.`];
  }

  /** 승급 뒤 성취를 높여 주는 자질을 무공에 적어 둔다. */
  applyEvolveTrait(skill) {
    const amount = sumEffect(this.traits, "evolve_mastery", "amount");
    if (amount) skill.evolveMastery = amount;
  }

  bestSkill() {
    const current = this.mainSkill ? this.getSkill(this.mainSkill) : null;
    if (current && current.type === "공격무공") return current;
    const attacks = this.skillsOfType("공격무공");
    if (!attacks.length) return null;
    return attacks.reduce((a, b) => (b.effectiveMultiplier() > a.effectiveMultiplier() ? b : a));
  }

  bestOfType(type) {
    const chosen = this.getSkill(this.chosenArts[type]);
    return chosen && chosen.type === type ? chosen : this.skillsOfType(type)[0] ?? null;
  }

  /** 병장기를 든다. 들고 있던 것은 행낭에 챙긴다. */
  equipGear(key) {
    const slot = DB.market[key]?.effects.find((e) => e.type === "equip")?.slot;
    if (!slot) return false;
    const old = this[slot];
    this.gear = this.gear.filter((k) => k !== key);
    if (old && old !== key && !this.gear.includes(old)) this.gear.push(old);
    this[slot] = key;
    return true;
  }

  /** 지니고 있는 병장기인가 */
  ownsGear(key) { return this.weapon === key || this.armor === key || this.gear.includes(key); }

  addItem(key, count = 1) { this.inventory[key] = (this.inventory[key] || 0) + count; }
  masteryGainAmount() {
    const base = randInt(1, 2) + Math.floor(this.martial / 500);
    const rate = sumEffect(this.traits, "mastery_rate", "percent");
    return rate ? Math.round(base * (100 + rate) / 100) : base;
  }

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

  /** 이번 강호행의 굵직한 일을 적어 둔다. 판이 끝나면 돌아볼 수 있다. */
  note(text) {
    this.chronicle = [...this.chronicle, { turn: this.turn, text }].slice(-CHRONICLE_LIMIT);
  }

  toDict() {
    return {
      origin: this.origin, origin_key: this.originKey, realm: this.realm,
      stat_scale: STAT_SCALE, alignment_scale: ALIGNMENT_SCALE, external: this.external, internal: this.internal, martial: this.martial, mind: this.mind,
      hp: this.hp, qi: this.qi, battles: this.battles,
      encountered_enemies: this.encounteredEnemies, pending_encounters: this.pendingEncounters,
      skills: this.skills.map((s) => s.toDict()), main_skill: this.mainSkill, chosen_arts: this.chosenArts,
      traits: this.traits, slain: this.slain, silver: this.silver, weapon: this.weapon, armor: this.armor, gear: this.gear, pending_legacy: this.pendingLegacy,
      inventory: this.inventory, boss_weaken: this.bossWeaken, alignment: this.alignment,
      flags: this.flags, seen_events: this.seenEvents, kills: this.kills,
      fame: this.fame, sect: this.sect, injury: this.injury,
      align_mark: this.alignMark, revives: this.revives, turn: this.turn, max_turn: this.maxTurn, alive: this.alive, chronicle: this.chronicle, content: this.content, chains: this.chains, chains_done: this.chainsDone,
    };
  }

  /** 없는 값은 기본값으로 채워 이전 저장도 읽는다. */
  static fromDict(d) {
    const p = Object.create(Player.prototype);
    p.origin = DB.origins.origins[RENAMED_ORIGINS[d.origin_key] || d.origin_key]?.name ?? DB.origins.origins.무림초출.name;
    // 이름이 바뀐 출신은 새 이름으로, 없어진 출신은 무림초출로 이어 간다
    const key = RENAMED_ORIGINS[d.origin_key] || d.origin_key;
    p.originKey = DB.origins.origins[key] ? key : "무림초출";
    p.chronicle = d.chronicle ?? [];
    p.content = d.content ?? [];
    p.chains = (d.chains ?? []).filter((c) => DB.chains[c.id]);
    p.chainsDone = d.chains_done ?? 0;
    p.realm = d.realm;
    // 특전이 생기기 전의 기록도 그 경지의 특전을 받는다
    for (const perk of realmPerks(p.realm)) if (!(d.traits || []).includes(perkTrait(perk.realm))) (d.traits ||= []).push(perkTrait(perk.realm));
    p.external = d.external;
    p.internal = d.internal;
    p.martial = d.martial;
    p.mind = d.mind;
    // 기량 최대가 99이던 때의 저장은 단위를 맞춘다
    if (!d.stat_scale) for (const stat of ["external", "internal", "martial", "mind"]) p[stat] *= STAT_SCALE;
    p.hp = d.hp;
    p.qi = d.qi;
    p.battles = d.battles ?? 0;
    p.encounteredEnemies = [...(d.encountered_enemies || [])];
    p.pendingEncounters = [...(d.pending_encounters || [])];
    p.skills = (d.skills || []).filter((s) => DB.skills[s.key]).map((s) => Skill.fromDict(s));
    p.mainSkill = d.main_skill ?? null;
    p.chosenArts = { ...(d.chosen_arts || {}) };
    if (!d.chosen_arts) {
      // 예전 저장은 쓰던 대로 품계가 가장 높은 것을 고른 것으로 친다
      const score = (s) => GRADE_ORDER.indexOf(s.grade) * 1000 + Object.values(s.effect).reduce((t, v) => t + Math.max(v, 0), 0);
      for (const type of ["심공", "경공"]) {
        const options = p.skillsOfType(type);
        if (options.length) p.chosenArts[type] = options.reduce((a, b) => (score(b) > score(a) ? b : a)).key;
      }
    }
    p.traits = (d.traits || []).filter((k) => DB.traits[k]);
    p.slain = d.slain || [];
    p.skills.forEach((s) => p.applyEvolveTrait(s));
    p.silver = d.silver ?? 0;
    p.weapon = DB.market[renamedItem(d.weapon)] ? renamedItem(d.weapon) : null;
    p.armor = DB.market[d.armor] ? d.armor : null;
    p.gear = (d.gear || []).map(renamedItem).filter((k) => DB.market[k]);
    p.pendingLegacy = d.pending_legacy ?? [];
    p.inventory = Object.fromEntries(Object.entries(d.inventory || {}).filter(([k]) => DB.market[k]));
    p.bossWeaken = d.boss_weaken ?? 0;
    p.alignment = { ...newAlignment(), ...(d.alignment || {}) };
    if (!d.alignment_scale) for (const name of Object.keys(p.alignment)) p.alignment[name] = Math.min(ALIGNMENT_CAP, p.alignment[name] * ALIGNMENT_SCALE);
    p.flags = [...(d.flags || [])];
    p.seenEvents = [...(d.seen_events || [])];
    p.kills = d.kills ?? 0;
    p.alignMark = d.align_mark ?? null;
    p.revives = d.revives ?? 1 + sumEffect(d.traits || [], "extra_revive", "amount");
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
