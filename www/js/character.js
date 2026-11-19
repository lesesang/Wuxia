// 무공과 플레이어
import { DB } from "./data.js";
import { randInt, rng } from "./rng.js";
import {
  ALIGN_CLASH, ALIGN_EASE, MAX_FAME, ALIGNMENT_CAP, alignValue, dominant, FOCUS_GAIN, hasEffect, newAlignment, originSect, originBonus,
  startSkills, sumEffect,
} from "./rules.js";
import { josa } from "./josa.js";

export const GRADE_ORDER = ["기본", "명품", "상승", "일절", "신공"];
const GIMMICK_GRADE = "상승"; // 이 품계부터 무공의 묘리가 드러난다
const HIGHER_GRADE_TRANSFER = 0.7; // 높은 품계 무공의 성취를 옮기는 비율
const SAME_GRADE_TRANSFER = 0.5;  // 같은 품계 무공의 성취를 옮기는 비율
const LOWER_GRADE_TRANSFER = 0.3; // 낮은 품계 무공의 성취를 옮기는 비율
const MAX_MASTERY = 100;
const ATTACK_USE_RATE = 0.5;
const GRADE_BONUS = 0.25;       // 승급 1단계당 위력 계수 증가
const MASTERY_BONUS = 0.003;    // 성취 1당 위력 계수 증가
const EFFECT_GRADE_BONUS = 0.2; // 심공·경공 승급 1단계당 효과 증가율
const EVADE_GRADE_BONUS = 0.1;
const EVADE_MASTERY_BONUS = 0.001;

const START_SILVER = 30;
export const HOME_ART_MASTERY = 40; // 출신이 오래 갈고닦은 무공의 처음 성취
const DUPLICATE_SKILL_MASTERY = 25;
// 쓰지 않는 무공도 몸에 남아 보탬이 된다
const IDLE_ART_WEIGHT = { 기본: 0.5, 명품: 1, 상승: 1.5, 일절: 2, 신공: 3 };
const MAX_IDLE_BONUS = 10;      // 쓰지 않는 무공이 보태는 끝(위력, 내력, 회피)
const SAME_STYLE_MASTERY = 5;          // 주무공과 같은 계열의 무공 하나가 주무공 성취를 빠르게 하는 정도
const MAX_SAME_STYLE_MASTERY = 25;
const LORE_POINTS = { 기본: 1, 명품: 2, 상승: 3, 일절: 4, 신공: 5 };
const LORE_PER_BATTLE = 4;             // 익힌 무공의 품계 합이 이만큼마다 돌파에 드는 실전 하나를 덜어 준다
const MAX_LORE_RATE = 0.25;     // 덜어 주는 실전의 끝(필요 횟수 대비)
const START_ARMORS = ["가죽호구", "철사갑의", "금사보의"]; // 겹쳐 받으면 한 단계씩 좋아진다
const SPARE_ARMOR_SILVER = 40; // 넘치는 갑의는 은자로 돌아온다
const CHRONICLE_LIMIT = 40;
export const STAT_CAP = 999;
const STAT_KEYS = ["external", "internal", "martial", "mind"];

const STAT_SOFT_CAP = 850;  // 기량이 이 값을 넘으면 더디게 오른다
const STAT_SOFT_RATE = 0.5;
export const STAT_SCALE = 10; // 전투와 성장 공식은 기량을 이 값으로 나누어 쓴다
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

  /** 쓰는 무공으로 옮길 수 있는 성취. 공격 무공은 같은 계열끼리, 심법과 경공은 같은 갈래끼리 옮긴다. 없으면 0 */
  masteryFor(target) {
    if (!target || target === this || target.type !== this.type || !this.mastery) return 0;
    if (target.mastery >= MAX_MASTERY && !target.canEvolve()) return 0; // 더 오를 데가 없는 무공에는 옮기지 않는다
    if (this.type === "공격무공" && target.category !== this.category) return 0;
    const gap = GRADE_ORDER.indexOf(target.grade) - GRADE_ORDER.indexOf(this.grade);
    const rate = gap < 0 ? HIGHER_GRADE_TRANSFER : gap === 0 ? SAME_GRADE_TRANSFER : LOWER_GRADE_TRANSFER;
    return Math.floor(this.mastery * rate);
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
    // 회피는 쉽게 끝에 닿지 않도록 더디게 는다
    if (name === "evade") return Math.trunc(value * (1 + this.gradesGained() * EVADE_GRADE_BONUS + this.mastery * EVADE_MASTERY_BONUS));
    return Math.trunc(value * (1 + this.gradesGained() * EFFECT_GRADE_BONUS + this.mastery * 0.002));
  }

  toDict() {
    return { key: this.key, grade: this.grade, mastery: this.mastery, secret_unlocked: this.secretUnlocked, ascended: !!this.ascended };
  }

  static fromDict(d) {
    const skill = new Skill(d.key);
    skill.grade = d.grade ?? skill.grade;
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
    this.person = { gender: "남", surname: "", given: "" };
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
    this.startStyle = null; // 강호초출이 처음 든 병기의 계열
    this.content = [];
    this.chains = [];
    this.chainsDone = 0;
    this.alignment = newAlignment();
    for (const key of traitKeys) {
      for (const effect of DB.traits[key]?.effects || []) {
        if (effect.type === "start_alignment") this.alignment[effect.side] += effect.amount;
      }
    }
    // 외전의 출신은 걸어온 길이 이미 한쪽으로 기울어 있다
    for (const [side, amount] of Object.entries(data.alignment || {})) this.alignment[side] += amount;
    this.flags = [];
    this.seenEvents = [];
    this.originTurn = -99; // 출신의 이야기가 마지막으로 찾아온 달
    this.manor = null;     // 문패를 챙긴 강호행이면 장원의 채 단계
    this.manorTurn = -99;  // 장원의 일이 마지막으로 찾아온 달
    this.difficulty = "강호"; // 이 강호행이 걷는 강호
    this.healCut = 0; // 싸우는 동안 회복을 끊는 적이 곁에 있다
    this.kills = 0;
    this.alignMark = null;
    this.alignMilestones = { 정도: 0, 사도: 0, 마도: 0 }; // 길마다 넘은 단계의 수
    this.rumors = []; // 들은 강호의 오랜 이야기
    this.fame = Math.min(MAX_FAME, sumEffect(traitKeys, "start_fame", "amount"));
    this.sect = originSect(originKey);
    this.injury = 0;
    this.pent = {}; // 경지의 끝에 막혀 쌓아 둔 기량
    this.turn = 1;
    this.maxTurn = MAX_TURN;
    this.alive = true;
    this.revives = 1 + sumEffect(traitKeys, "extra_revive", "amount");
  }

  maxHp() { return 100 + Math.trunc(this.external * 0.28 + this.internal * 0.17); }
  maxQi() { return Math.trunc((100 + Math.trunc(this.internal / 2)) * (1 + this.idleBonus("심공") / 100)); }
  dominantAlignment() { return dominant(this.alignment); }

  /** 지금 경지가 허락하는 기량의 끝 */
  statCap() { return DB.realms.stat_cap?.[this.realm] ?? STAT_CAP; }
  /** 경지의 끝에 막힌 기량들 */
  cappedStats() { return STAT_KEYS.filter((s) => this[s] >= this.statCap()); }

  /** 기량을 올린다. 경지의 끝에 막히면 그 몫을 쌓아 두고, 막힌 기량이 있으면 나머지가 더 빨리 오른다. 실제로 오른 양을 돌려준다 */
  gainStat(stat, amount) {
    const cap = this.statCap();
    if (amount > 0 && this[stat] >= cap) {
      if (cap < STAT_CAP) this.pent[stat] = (this.pent[stat] || 0) + amount;
      return 0;
    }
    if (amount > 0) {
      const boost = this.cappedStats().length * (DB.realms.cap_boost?.per_capped || 0);
      if (boost) {
        const exact = amount * (1 + boost / 100);
        amount = Math.floor(exact) + (rng.random() < exact - Math.floor(exact) ? 1 : 0);
      }
    }
    return this.raiseStat(stat, amount, cap);
  }

  /** 기량을 올리고 기록에 남길 말을 돌려준다. 끝에 막혀 쌓인 몫은 그렇게 적는다 */
  gainStatText(stat, amount) {
    const pentBefore = this.pent[stat] || 0;
    const gained = this.gainStat(stat, amount);
    const stored = (this.pent[stat] || 0) - pentBefore;
    if (stored > 0 && !gained) return `${STAT_NAMES[stat]} ${stored} 쌓임`;
    return `${STAT_NAMES[stat]}+${gained}${stored > 0 ? `(${stored} 쌓임)` : ""}`;
  }

  /** 끝을 지켜 기량을 올리고, 끝을 넘는 몫은 쌓아 둔다 */
  raiseStat(stat, amount, cap = this.statCap()) {
    const before = this[stat];
    const top = Math.min(cap, STAT_CAP);
    // 850을 넘으면 넘는 몫의 절반만 붙는다
    const eased = (from, raw) => (from + raw > STAT_SOFT_CAP ? Math.max(from, STAT_SOFT_CAP) + Math.ceil((from + raw - Math.max(from, STAT_SOFT_CAP)) * STAT_SOFT_RATE) : from + raw);
    let after = eased(before, amount);
    if (amount > 0 && after > top) {
      // 끝까지 오르는 데 든 몫을 빼고 남은 것은 다음 경지를 기다린다
      const spent = before >= STAT_SOFT_CAP ? Math.ceil((top - before) / STAT_SOFT_RATE)
        : top <= STAT_SOFT_CAP ? top - before : STAT_SOFT_CAP - before + Math.ceil((top - STAT_SOFT_CAP) / STAT_SOFT_RATE);
      if (cap < STAT_CAP) this.pent[stat] = (this.pent[stat] || 0) + Math.max(0, amount - spent);
      after = top;
    }
    after = Math.max(before, after);
    this[stat] = after;
    return after - before;
  }

  /** 경지가 올라 끝이 풀리면 쌓아 둔 몫이 오른다. 오른 양을 기량마다 돌려준다 */
  releasePent() {
    const gained = {};
    for (const stat of STAT_KEYS) {
      const stored = this.pent[stat] || 0;
      if (!stored || this[stat] >= this.statCap()) continue;
      this.pent[stat] = 0;
      const up = this.raiseStat(stat, stored);
      if (up) gained[stat] = up;
    }
    return gained;
  }

  /** 정한 양만큼 회복한다. 마도의 회복 감소를 받는다. [체력 변화, 내력 변화] */
  healAmount(hp = 0, qi = 0) {
    const penalty = (1 - alignValue(this.alignment, "마도", "healCut") / 100) * (1 - (this.healCut || 0) / 100) * (1 + alignValue(this.alignment, "정도", "heal") / 100);
    const hpBefore = this.hp;
    const qiBefore = this.qi;
    this.hp = Math.min(this.maxHp(), this.hp + Math.trunc(hp * penalty));
    this.qi = Math.min(this.maxQi(), this.qi + Math.trunc(qi * penalty));
    return [this.hp - hpBefore, this.qi - qiBefore];
  }

  /** 체력·기력을 최대치 비율로 바꾼다. 체력은 1 아래로 내려가지 않는다. [체력 변화, 기력 변화] */
  healPercent(hpPct = 0, qiPct = 0) {
    const penalty = (1 - alignValue(this.alignment, "마도", "healCut") / 100) * (1 - (this.healCut || 0) / 100) * (1 + alignValue(this.alignment, "정도", "heal") / 100);
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
    let percent = sumEffect(this.traits, "silver_rate", "percent") + originBonus(this, "silver");
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
    const focus = (amount > 0 ? ALIGN_EASE : 1) * (amount > 0 && dominant(this.alignment) === name ? FOCUS_GAIN[name] : 1);
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
    return [];
  }

  /** 같은 갈래의 더 깊은 무공을 얻으면 따로 쌓지 않고 이어받는다. 성취와 오른 품계는 그대로 간다. */
  inheritLineage(root, skill) {
    skill.mastery = Math.max(skill.mastery, root.mastery);
    if (GRADE_ORDER.indexOf(root.grade) > GRADE_ORDER.indexOf(skill.grade)) skill.grade = root.grade;
    this.skills[this.skills.indexOf(root)] = skill;
    if (this.mainSkill === root.key) this.mainSkill = skill.key;
    for (const [type, key] of Object.entries(this.chosenArts)) if (key === root.key) this.chosenArts[type] = skill.key;
    this.applyEvolveTrait(skill);
    return [`${root.name}${josa(root.name, "이/가")} ${skill.name}${josa(skill.name, "으로")} 이어졌다.`];
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
  /** 든 병장기를 내려놓아 행낭에 챙긴다. */
  unequipGear(slot) {
    const key = this[slot];
    if (!key) return false;
    if (!this.gear.includes(key)) this.gear.push(key);
    this[slot] = null;
    return true;
  }

  ownsGear(key) { return this.weapon === key || this.armor === key || this.gear.includes(key); }

  addItem(key, count = 1) { this.inventory[key] = (this.inventory[key] || 0) + count; }
  /** 쓰는 칸 밖의 무공들. 공격 무공은 주무공을 뺀 것 */
  idleArts(type) {
    if (!this.skills) return [];
    const active = type === "공격무공" ? this.bestSkill() : this.bestOfType(type);
    return this.skillsOfType(type).filter((s) => s !== active);
  }

  /** 쓰지 않는 무공이 보태는 몫(백분율). 공격은 위력, 심법은 최대 내력, 경공은 회피에 더한다.
   *  주무공과 같은 계열의 공격 무공은 검리를 넓혀 두 배로 친다. */
  idleBonus(type) {
    if (!this.skills) return 0;
    const main = this.bestSkill()?.category;
    const total = this.idleArts(type).reduce((sum, s) => {
      const same = type === "공격무공" && s.category === main ? 2 : 1;
      return sum + (IDLE_ART_WEIGHT[s.grade] || 0) * (0.5 + s.mastery / 200) * same;
    }, 0);
    return Math.min(MAX_IDLE_BONUS, Math.round(total));
  }

  /** 주무공과 같은 계열의 다른 무공을 익혀 두면 주무공의 성취가 빨리 쌓인다(백분율) */
  sameStyleMasteryRate() {
    const main = this.bestSkill();
    if (!main) return 0;
    return Math.min(MAX_SAME_STYLE_MASTERY, this.idleArts("공격무공").filter((s) => s.category === main.category).length * SAME_STYLE_MASTERY);
  }

  /** 견문이 넓을수록 벽을 넘기 쉽다. 경지를 넘는 데 드는 실전을 덜어 준다 */
  loreRelief(required) {
    const points = this.skills.reduce((sum, s) => sum + (LORE_POINTS[s.grade] || 0), 0);
    return Math.min(Math.floor(required * MAX_LORE_RATE), Math.floor(points / LORE_PER_BATTLE));
  }

  /** 공격 무공은 합마다 쓰므로 한 번에 쌓이는 성취가 적다 */
  attackMasteryGain() {
    const amount = this.masteryGainAmount() * ATTACK_USE_RATE * (1 + this.sameStyleMasteryRate() / 100);
    return Math.floor(amount) + (rng.random() < amount % 1 ? 1 : 0);
  }

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
      external: this.external, internal: this.internal, martial: this.martial, mind: this.mind, pent: { ...this.pent },
      hp: this.hp, qi: this.qi, battles: this.battles,
      encountered_enemies: this.encounteredEnemies, pending_encounters: this.pendingEncounters,
      skills: this.skills.map((s) => s.toDict()), main_skill: this.mainSkill, chosen_arts: this.chosenArts,
      traits: this.traits, slain: this.slain, start_style: this.startStyle, silver: this.silver, weapon: this.weapon, armor: this.armor, gear: this.gear, pending_legacy: this.pendingLegacy, person: this.person,
      inventory: this.inventory, boss_weaken: this.bossWeaken, alignment: this.alignment,
      flags: this.flags, seen_events: this.seenEvents, origin_turn: this.originTurn, manor: this.manor, manor_turn: this.manorTurn, difficulty: this.difficulty, kills: this.kills,
      fame: this.fame, sect: this.sect, injury: this.injury,
      align_mark: this.alignMark, align_milestones: this.alignMilestones, rumors: this.rumors, revives: this.revives, turn: this.turn, max_turn: this.maxTurn, alive: this.alive, chronicle: this.chronicle, content: this.content, chains: this.chains, chains_done: this.chainsDone,
    };
  }

  /** 저장한 기록에서 무인을 되살린다 */
  static fromDict(d) {
    const p = Object.create(Player.prototype);
    p.originKey = DB.origins.origins[d.origin_key] ? d.origin_key : "무림초출";
    p.origin = DB.origins.origins[p.originKey].name;
    p.chronicle = d.chronicle ?? [];
    p.content = d.content ?? [];
    p.chains = (d.chains ?? []).filter((c) => DB.chains[c.id]);
    p.chainsDone = d.chains_done ?? 0;
    p.originTurn = d.origin_turn ?? -99;
    p.manor = d.manor ?? null;
    p.manorTurn = d.manor_turn ?? -99;
    p.difficulty = DB.difficulty?.levels[d.difficulty] ? d.difficulty : "강호";
    p.healCut = 0;
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
    p.skills = (d.skills || []).filter((s) => DB.skills[s.key]).map((s) => Skill.fromDict(s));
    p.mainSkill = d.main_skill ?? null;
    p.chosenArts = { ...(d.chosen_arts || {}) };
    p.traits = (d.traits || []).filter((k) => DB.traits[k]);
    p.slain = (d.slain || []).map((k) => (k === "전대천마잔영" ? "백년천마잔영" : k)); // 예전 저장의 키
    p.startStyle = d.start_style ?? null;
    p.skills.forEach((s) => p.applyEvolveTrait(s));
    p.silver = d.silver ?? 0;
    p.weapon = DB.market[d.weapon] ? d.weapon : null;
    p.armor = DB.market[d.armor] ? d.armor : null;
    p.gear = (d.gear || []).filter((k) => DB.market[k]);
    p.pendingLegacy = d.pending_legacy ?? [];
    p.person = d.person ?? { gender: "남", surname: "", given: "" };
    p.inventory = Object.fromEntries(Object.entries(d.inventory || {}).filter(([k]) => DB.market[k]));
    p.bossWeaken = d.boss_weaken ?? 0;
    p.alignment = { ...newAlignment(), ...(d.alignment || {}) };
    p.flags = [...(d.flags || [])];
    p.seenEvents = [...(d.seen_events || [])];
    p.kills = d.kills ?? 0;
    p.alignMark = d.align_mark ?? null;
    p.rumors = d.rumors ?? [];
    p.alignMilestones = d.align_milestones ?? {};
    p.revives = d.revives ?? 1 + sumEffect(d.traits || [], "extra_revive", "amount");
    p.fame = d.fame ?? 0;
    p.sect = d.sect !== undefined ? d.sect : originSect(p.originKey);
    p.injury = d.injury ?? 0;
    p.pent = { ...(d.pent || {}) };
    p.turn = d.turn;
    // 외전은 출신마다 끝나는 달이 다르다
    p.maxTurn = DB.origins.origins[p.originKey]?.side ? DB.origins.origins[p.originKey].end_turn : MAX_TURN;
    p.alive = d.alive;
    return p;
  }
}
