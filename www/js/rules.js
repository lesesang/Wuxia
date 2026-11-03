// 성향, 챕터, 경지, 특성, 문파, 명성처럼 상태를 갖지 않는 규칙들
import { DB } from "./data.js";
import { pick, rng } from "./rng.js";

// ---------- 성향 ----------
export const ALIGNMENTS = ["정도", "사도", "마도"];
const DOMINANT_THRESHOLD = 3;
export const JUNG_DISCOUNT = 10;
export const SA_SILVER_BONUS = 25;
export const MA_DAMAGE_BONUS = 10;
export const MA_HEAL_PENALTY = 20;

export const newAlignment = () => ({ 정도: 0, 사도: 0, 마도: 0 });

/** 가장 높은 성향. 기준치 미만이거나 동률이면 null */
export function dominant(alignment) {
  const value = Math.max(...ALIGNMENTS.map((a) => alignment[a] || 0));
  if (value < DOMINANT_THRESHOLD) return null;
  const tops = ALIGNMENTS.filter((a) => (alignment[a] || 0) === value);
  return tops.length > 1 ? null : tops[0];
}

export function benefitText(alignment) {
  const top = dominant(alignment);
  if (top === "정도") return `시장 가격 ${JUNG_DISCOUNT}% 할인`;
  if (top === "사도") return `얻는 은자 ${SA_SILVER_BONUS}% 증가`;
  if (top === "마도") return `주는 피해 ${MA_DAMAGE_BONUS}% 증가, 회복 효율 ${MA_HEAL_PENALTY}% 감소`;
  return "아직 어느 길에도 서지 않았다";
}

// ---------- 챕터와 시장 ----------
export const CHAPTER_LENGTH = 24;
export const CHAPTER_STARTS = [25, 49, 73, 97];
export const getChapter = (turn) => Math.min(5, Math.floor((turn - 1) / CHAPTER_LENGTH) + 1);
export const getChapterInfo = (turn) => DB.chapters.chapters[String(getChapter(turn))];
export const getYear = (turn) => Math.ceil(turn / 12);
export const getMonth = (turn) => ((turn - 1) % 12) + 1;
export const marketTurns = () => Object.keys(DB.chapters.market_turns).map(Number).sort((a, b) => a - b);
export const isMarketTurn = (turn) => String(turn) in DB.chapters.market_turns;
export const marketName = (turn) => DB.chapters.market_turns[String(turn)];

// ---------- 특성 ----------
const SLOT_THRESHOLDS = [[0, 1], [30, 2], [90, 3]];

export function traitSlots(totalKarma) {
  let slots = 1;
  for (const [threshold, count] of SLOT_THRESHOLDS) if (totalKarma >= threshold) slots = count;
  return slots;
}

export function nextSlotThreshold(totalKarma) {
  for (const [threshold] of SLOT_THRESHOLDS) if (totalKarma < threshold) return threshold;
  return null;
}

function effectsOfType(traits, type) {
  return traits.flatMap((key) => DB.traits[key]?.effects || []).filter((e) => e.type === type);
}

export const sumEffect = (traits, type, field) =>
  effectsOfType(traits, type).reduce((total, e) => total + (e[field] || 0), 0);
export const hasEffect = (traits, type) => effectsOfType(traits, type).length > 0;
export const startSkills = (traits) => effectsOfType(traits, "start_skill").map((e) => e.skill);
export const battleBuffs = (traits, trigger) =>
  effectsOfType(traits, "battle_buff").filter((e) => e.trigger === trigger);

/** 특성의 성장률 보정. 소수점 아래는 그 확률로 1이 더 오른다. */
export function applyGrowth(amount, traits, stat) {
  const percent = effectsOfType(traits, "growth_rate")
    .filter((e) => e.stat === stat).reduce((total, e) => total + e.percent, 0);
  if (!percent) return amount;
  const exact = amount * (1 + percent / 100);
  const whole = Math.floor(exact);
  return whole + (rng.random() < exact - whole ? 1 : 0);
}

// ---------- 문파 ----------
export const ORIGIN_SECTS = { 곤륜파: "곤륜", 남궁세가: "남궁", 하오문: "하오문" };
export const sectBonus = (player, field) => DB.sects[player.sect]?.bonus?.[field] || 0;

// ---------- 경지 ----------
export const realmBonus = (realm) => DB.realms.combat_bonus[realm] || 0;
export const realmIndex = (realm) => DB.realms.order.indexOf(realm);

export function nextRealm(realm) {
  if (realm === "현경" || realm === "생사경") return null;
  return DB.realms.order[realmIndex(realm) + 1];
}

const statsOf = (p) => [p.external, p.internal, p.martial, p.mind];
const average = (list) => list.reduce((a, b) => a + b, 0) / list.length;

export function checkBreakthrough(player) {
  const next = nextRealm(player.realm);
  if (!next) return null;
  const req = DB.realms.requirements[next];
  const stats = statsOf(player);
  const ok = average(stats) >= req.avg && Math.min(...stats) >= req.min_stat && player.battles >= req.battles;
  return ok ? next : null;
}

/** 능력치는 찼는데 전투 경험만 모자라면 안내 문구 */
export function breakthroughBlock(player) {
  const next = nextRealm(player.realm);
  if (!next) return null;
  const req = DB.realms.requirements[next];
  const stats = statsOf(player);
  if (average(stats) >= req.avg && Math.min(...stats) >= req.min_stat && player.battles < req.battles) {
    return `${next}의 문턱이 보이지만 실전이 모자라다. (전투 경험 ${player.battles}/${req.battles}, 탐색에서 싸워야 는다)`;
  }
  return null;
}

export function realmProgress(player) {
  const next = nextRealm(player.realm);
  if (!next) return null;
  const req = DB.realms.requirements[next];
  const stats = statsOf(player);
  return {
    next, avg: Math.round(average(stats) * 10) / 10, avgRequired: req.avg,
    min: Math.min(...stats), minRequired: req.min_stat,
    battles: player.battles, battlesRequired: req.battles,
  };
}

const SAENGSA_GATE_BONUS = 10; // 생사의 문을 지나면 생사경의 능력치 조건이 낮아진다

export function checkSaengsa(player) {
  const req = DB.realms.saengsa;
  const minStat = req.min_stat - (player.hasFlag("생사의문") ? SAENGSA_GATE_BONUS : 0);
  return Math.min(...statsOf(player)) >= minStat && player.battles >= req.battles
    && player.hp >= player.maxHp() * req.hp_ratio && player.qi >= player.maxQi() * req.qi_ratio;
}

export function checkGoodEnding(player) {
  const req = DB.realms.good_ending;
  return realmIndex(player.realm) >= realmIndex(req.min_realm)
    && player.hp >= player.maxHp() * req.hp_ratio && player.qi >= player.maxQi() * req.qi_ratio;
}

// ---------- 분위기 문장, 명성, 별호 ----------
export const monthLine = (month) => pick(DB.flavor.months[String(month)]);
export const actionLine = (action) => pick(DB.flavor.actions[action]);

export function fameRank(fame) {
  let name = DB.flavor.fame_ranks[0][1];
  for (const [threshold, rank] of DB.flavor.fame_ranks) if (fame >= threshold) name = rank;
  return name;
}

export const fameRankChanged = (before, after) =>
  (fameRank(before) !== fameRank(after) ? fameRank(after) : null);

/** 강호에서 불리는 별호. 성향과 주무공 계열로 정해지고 명성이 오르면 뒷글자가 무거워진다. */
export function byname(player) {
  if (player.fame < 10) return "이름 없는 무인";
  const top = dominant(player.alignment) || "중립";
  const category = player.bestSkill()?.category || "맨손";
  const names = DB.flavor.bynames;
  const prefixes = names.prefix[top];
  const seed = [...player.origin].reduce((total, c) => total + c.codePointAt(0), 0);
  const suffixes = names.suffix[category] || names.suffix.맨손;
  const tier = player.fame < 40 ? 0 : player.fame < 100 ? 1 : 2;
  return prefixes[seed % prefixes.length] + suffixes[tier];
}
