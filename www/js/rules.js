// 성향, 챕터, 경지, 특성, 문파, 명성처럼 상태를 갖지 않는 규칙들
import { DB } from "./data.js";
import { josa } from "./josa.js";
import { pick, rng } from "./rng.js";

// ---------- 성향 ----------
export const ALIGNMENTS = ["정도", "사도", "마도"];
export const ALIGNMENT_CAP = 999;
export const ALIGNMENT_SCALE = 20; // 성향이 낮은 수로 쌓이던 때의 저장을 옮길 때 쓴다
const DOMINANT_THRESHOLD = 60;
export const FOCUS_RATIO = 2;      // 한 길이 둘째 길의 이만큼을 넘으면 그 길에 집중한 것으로 친다
// 앞선 길은 사건에서 이만큼 더 오른다. 사건이 적은 길일수록 크다
export const FOCUS_GAIN = { 정도: 1.1, 사도: 1.35, 마도: 1.7 };
export const FOCUS_DRIFT = 1;       // 집중한 길은 달마다 저절로 오른다
// 한 길이 오르면 부딪치는 길이 그 비율만큼 깎인다
export const ALIGN_CLASH = { 정도: { 마도: 0.6, 사도: 0.3 }, 마도: { 정도: 0.6, 사도: 0.2 }, 사도: { 정도: 0.3, 마도: 0.15 } };
export const KILL_ALIGN = { 사도: 2, 마도: 5 }; // 싸워 이길수록 깊어지는 길
export const ALIGN_STEPS = [60, 200, 400, 600, 850];
const ALIGN_TABLE = {
  정도: { names: ["협행의 첫걸음", "협객", "대협", "협의 명숙", "강호의 등불"], discount: [8, 10, 12, 14, 16], guard: [0, 1, 2, 3, 4] },
  사도: { names: ["사파의 첫걸음", "사파 고수", "사파 거물", "사파 거두", "사파 제왕"], silver: [25, 30, 35, 40, 50], crit: [2, 4, 6, 8, 10] },
  마도: { names: ["마도의 첫걸음", "마인", "대마인", "마두", "천하 마존"], damage: [15, 20, 25, 30, 35], healCut: [3, 5, 6, 8, 10] },
};

export const newAlignment = () => ({ 정도: 0, 사도: 0, 마도: 0 });

/** 가장 높은 성향. 기준치 미만이거나 동률이면 null */
export function dominant(alignment) {
  const value = Math.max(...ALIGNMENTS.map((a) => alignment[a] || 0));
  if (value < DOMINANT_THRESHOLD) return null;
  const tops = ALIGNMENTS.filter((a) => (alignment[a] || 0) === value);
  return tops.length > 1 ? null : tops[0];
}

/** 가장 높은 길과 그 깊이(0부터). 어느 길에도 서지 않았으면 null */
export function alignTier(alignment) {
  const side = dominant(alignment);
  if (!side) return null;
  const step = ALIGN_STEPS.reduce((best, at, index) => (alignment[side] >= at ? index : best), 0);
  return { side, step, name: ALIGN_TABLE[side].names[step], ...Object.fromEntries(Object.entries(ALIGN_TABLE[side]).filter(([k]) => k !== "names").map(([k, list]) => [k, list[step]])) };
}

/** 그 길에서 받는 값. 다른 길이면 0 */
export function alignValue(alignment, side, field) {
  const tier = alignTier(alignment);
  return tier?.side === side ? tier[field] : 0;
}

/** 한 길에 집중하고 있으면 그 길 */
export function focusedSide(alignment) {
  const side = dominant(alignment);
  if (!side) return null;
  const others = ALIGNMENTS.filter((a) => a !== side).map((a) => alignment[a] || 0);
  return alignment[side] >= Math.max(...others) * FOCUS_RATIO ? side : null;
}

export function benefitText(alignment) {
  const tier = alignTier(alignment);
  if (!tier) return "아직 어느 길에도 서지 않았다";
  const at = ALIGN_STEPS[tier.step + 1];
  const next = at ? ` 다음 단계는 ${at}.` : "";
  if (tier.side === "정도") return `${tier.name}: 장터 가격 ${tier.discount}% 할인${tier.guard ? `, 받는 피해 ${tier.guard}% 감소` : ""}.${next}`;
  if (tier.side === "사도") return `${tier.name}: 얻는 은자 ${tier.silver}% 증가${tier.crit ? `, 회심의 일격 확률 ${tier.crit}% 증가` : ""}.${next}`;
  return `${tier.name}: 주는 피해 ${tier.damage}% 증가, 회복 효율 ${tier.healCut}% 감소.${next}`;
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
const SLOT_THRESHOLDS = [[0, 1], [30, 2], [90, 3], [250, 4], [500, 5], [1000, 6]];

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
export const ORIGIN_SECTS = { 남궁세가: "남궁", 하오문: "하오문", 개방제자: "개방" };
export const sectBonus = (player, field) => DB.sects[player.sect]?.bonus?.[field] || 0;

// ---------- 경지 ----------
export const realmBonus = (realm) => DB.realms.combat_bonus[realm] || 0;
export const realmIndex = (realm) => DB.realms.order.indexOf(realm);
/** 적까지 포함한 경지의 높이. 이류는 적에게만 있다 */
export const enemyRealmIndex = (realm) => DB.realms.enemy_order.indexOf(realm);
/** 지금 시점에 나올 수 있는 적 가운데 이 경지 차이의 적을 만날 비중 */
export function realmFit(playerRealm, enemyRealm) {
  const table = DB.realms.encounter_fit;
  const gap = enemyRealmIndex(enemyRealm) - enemyRealmIndex(playerRealm);
  return table[String(Math.max(-3, Math.min(3, gap)))];
}
/** 그 경지까지 얻은 특전 */
export function realmPerks(realm) {
  const reached = realmIndex(realm);
  return DB.realms.order.filter((name, i) => i <= reached && DB.realms.perks[name]).map((name) => ({ realm: name, ...DB.realms.perks[name] }));
}
/** 이름 있는 적인가. 이름 없는 적은 몇 번이고 나와도 이상하지 않다 */
export const isNamed = (key) => { const e = DB.enemies[key]; return e?.named ?? !!e?.title; };

/** 이미 쓰러뜨린 이름 있는 적의 자리에 나올 적. 대신할 적이 없으면 그 적이 돌아온다 */
export function standIn(player, key) {
  let current = key;
  for (let i = 0; i < 8; i++) {
    if (!isNamed(current) || !player.slain.includes(current)) return current;
    const next = DB.enemies[current].stand_in;
    if (!next) return current;
    current = next;
  }
  return current;
}

/** 쓰러졌던 적이 돌아올 때의 말 */
export function returnedLine(key) {
  const e = DB.enemies[key];
  if (e.returned) return e.returned;
  const list = DB.flavor.returned[e.beast ? "짐승" : e.side] || DB.flavor.returned.기본;
  const name = e.name;
  return pick(list).replaceAll("〈이름〉", name).replaceAll("{이/가}", josa(name, "이/가"));
}

export const perkTrait = (realm) => `경지_${realm}`;

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
    return `${next}의 문턱이 보이지만 실전이 모자라다. (실전 경험 ${player.battles}/${req.battles}, 탐색에서 싸워야 는다)`;
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

/** 히든 엔딩. 일반 돌파로는 오르지 못하고 천마를 쓰러뜨린 그 순간에만 판정한다. */
export function checkSaengsa(player) {
  const req = DB.realms.saengsa;
  return Math.min(...statsOf(player)) >= req.min_stat && player.battles >= req.battles
    && player.hp >= player.maxHp() * req.hp_ratio && player.qi >= player.maxQi() * req.qi_ratio;
}

export function checkGoodEnding(player) {
  const req = DB.realms.good_ending;
  return realmIndex(player.realm) >= realmIndex(req.min_realm)
    && player.hp >= player.maxHp() * req.hp_ratio && player.qi >= player.maxQi() * req.qi_ratio;
}

// ---------- 분위기 문장, 명성, 별호 ----------
const DEEP_STEP = 2; // 이 단계부터 그 길이 깊어진 무인으로 대접받는다

/** 성향과 명성에 맞는 말투 표의 칸들. 깊을수록, 이름이 높을수록 앞에 온다 */
export function talkKeys(player) {
  const keys = [];
  const tier = alignTier(player.alignment);
  if (player.fame >= 100) keys.push("천하");
  else if (player.fame >= 40) keys.push("유명");
  else if (player.fame <= 9) keys.push("무명");
  if (tier) keys.push(tier.step >= DEEP_STEP ? `${tier.side}_깊음` : tier.side);
  return keys;
}

/** 말투 표에서 지금 무인에게 맞는 한 줄. seed를 주면 같은 값에는 같은 줄이 나온다 */
export function talkLine(player, table, seed = null) {
  const lists = talkKeys(player).map((k) => DB.flavor.talk[table]?.[k] || (k.endsWith("_깊음") ? DB.flavor.talk[table]?.[k.replace("_깊음", "")] : null)).filter(Boolean);
  if (!lists.length) return null;
  if (seed === null) return pick(pick(lists));
  const list = lists[seed % lists.length];
  return list[(seed >> 3) % list.length];
}

export const monthLine = (month) => pick(DB.flavor.months[String(month)]);
export const actionLine = (action) => pick(DB.flavor.actions[action]);

export function fameRank(fame) {
  let name = DB.flavor.fame_ranks[0][1];
  for (const [threshold, rank] of DB.flavor.fame_ranks) if (fame >= threshold) name = rank;
  return name;
}

export const fameRankChanged = (before, after) =>
  (fameRank(before) !== fameRank(after) ? fameRank(after) : null);

/**
 * 강호에서 불리는 별호. 앞글자는 성향과 그 깊이, 출신에서, 뒷글자는 주무공 계열과 명성에서 온다.
 * 이름이 알려지기 전에는 별호가 없다.
 */
export function byname(player) {
  if (player.fame < 10) return "이름 없는 무인";
  const names = DB.flavor.bynames;
  const tier = alignTier(player.alignment);
  const side = tier?.side ?? "중립";
  const depth = !tier || tier.step < 2 ? 0 : tier.step < 4 ? 1 : 2;
  const category = player.bestSkill()?.category || "맨손";
  const rank = player.fame < 40 ? 0 : player.fame < 100 ? 1 : 2;
  const home = names.origin_prefix[player.originKey];
  const seed = [...player.origin].reduce((total, c) => total + c.codePointAt(0), 0);
  const prefixes = names.prefix[side][depth] ?? names.prefix[side][0];
  // 깊이 물들기 전에는 집안의 이름으로 불리기도 한다
  const suffix = ((names.suffix[side] ?? names.suffix.중립)[category] ?? names.suffix.중립.맨손)[rank];
  // 앞뒤에 같은 글자가 겹치면 어색하므로 겹치지 않는 앞글자를 고른다
  const clean = (name) => ![...name].some((c) => suffix.includes(c));
  const rotated = prefixes.map((_, i) => prefixes[(seed + i) % prefixes.length]);
  const prefix = (home && depth === 0 && rank >= 1 && clean(home) ? home : rotated.find(clean)) ?? rotated[0];
  return prefix + suffix;
}
