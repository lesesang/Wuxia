// 성향, 챕터, 경지, 특성, 문파, 명성처럼 상태를 갖지 않는 규칙들
import { DB } from "./data.js";
import { halpun, josa } from "./josa.js";
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
  정도: { names: ["정파 무인", "협객", "의협", "〈대협〉", "천하대협"], discount: [8, 10, 12, 14, 16], guard: [0, 1, 2, 3, 4] },
  사도: { names: ["사파 무인", "흑도 무인", "흑도 고수", "흑도 거두", "흑도의 대부"], silver: [25, 30, 35, 40, 50], crit: [2, 4, 6, 8, 10] },
  마도: { names: ["마도 무인", "마인", "마두", "대마두", "희대의 마두"], damage: [15, 20, 25, 30, 35], healCut: [3, 5, 6, 8, 10] },
};

/** 장이 뒤로 갈수록 기량이 더디게 오른다 */
/** 사건에서 몸이 축나는 정도. 경지와 기량이 높을수록 작다. 현경의 고수가 독버섯으로 죽어 가지는 않는다 */
const REALM_HARDINESS = { 절정: 0.8, 초절정: 0.6, 화경: 0.4, 현경: 0.25, 생사경: 0.15 };
export function eventToll(player) {
  const mean = (player.external + player.internal + player.martial + player.mind) / 4;
  return (REALM_HARDINESS[player.realm] ?? 1) * (1 - mean / 2000);
}

/** 호칭 자리표시. 앞은 남성, 뒤는 여성. 〈낱말〉 또는 〈낱말:을/를〉처럼 조사를 붙여 쓴다 */
const PERSON_WORDS = {
  대협: ["대협", "여협"], 소협: ["소협", "소저"], 공자: ["공자", "소저"], 도련님: ["도련님", "아가씨"], 형장: ["형장", "소저"],
  형님: ["형님", "누님"], 큰형님: ["큰형님", "큰누님"], 형제: ["형제", "누이"], 사제: ["사제", "사매"], 사형: ["사형", "사저"], 아들: ["아들", "딸"],
  형: ["형", "오라버니"], 형들: ["형들", "오라버니들"], 큰형: ["큰형", "큰오라버니"], 둘째형: ["둘째 형", "둘째 오라버니"], 넷째형: ["넷째 형", "넷째 오라버니"],
  네형: ["네 형", "네 오라버니"], 형수: ["형수", "올케"], 큰형수: ["큰형수", "큰올케"], 삼촌: ["삼촌", "고모"], 다섯형제: ["다섯 형제", "다섯 남매"],
  그: ["그", "그녀"], 사내: ["사내", "여인"], 놈: ["놈", "계집"], 네놈: ["네놈", "네년"], 첫째형: ["첫째 형", "첫째 오라버니"], 남매: ["형제", "남매"], 의형제: ["의형제", "의남매"], 의형제들: ["형제들", "의남매들"], 협객나리: ["협객 나리", "여협 나리"],
  손주사위: ["손녀사위", "손주며느리"], 저놈: ["저놈", "저년"], 이놈: ["이놈", "이년"], 미친놈: ["미친놈", "미친년"],
};

/** 자리표시를 이 무인의 성별과 이름으로 바꾼다. 무인이 없으면 남성의 말과 빈 이름으로 둔다 */
export function personalize(text, person = null) {
  if (!text || !text.includes("〈")) return text;
  const female = person?.gender === "여" ? 1 : 0;
  const names = { 성: person?.surname ?? "", 이름: person?.given || "무명", 성명: fullName(person) };
  return text.replace(/〈([^〉:]+)(?::([^〉]+))?〉/g, (whole, word, pair) => {
    let out;
    if (word === "성대협") out = names.성 ? `${names.성} ${PERSON_WORDS.대협[female]}` : PERSON_WORDS.대협[female];
    else if (word === "성소협") out = names.성 ? `${names.성} ${PERSON_WORDS.소협[female]}` : PERSON_WORDS.소협[female];
    else if (names[word] !== undefined) out = names[word];
    else if (PERSON_WORDS[word]) out = PERSON_WORDS[word][female];
    else return whole;
    return pair ? `${out}${josa(out, pair)}` : out;
  });
}

/** 두 글자 성은 띄어 적는다. 지난 저장에는 이름이 없어 무명으로 부른다 */
export const fullName = (person) => (person?.given ? `${person.surname || ""}${person.surname?.length > 1 ? " " : ""}${person.given}` : "무명");

export const growthScale = (turn) => DB.balance.growth_by_chapter[getChapter(turn) - 1];
/** 양을 성장 배율대로 줄인다. 소수점 아래는 그 확률로 1이 더 오른다. */
export function scaledGrowth(amount, turn) {
  const exact = amount * growthScale(turn);
  const whole = Math.floor(exact);
  return whole + (rng.random() < exact - whole ? 1 : 0);
}

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
  if (tier.side === "정도") return `${tier.name}: 장터 가격 ${halpun(tier.discount)} 할인${tier.guard ? `, 받는 피해 ${halpun(tier.guard)} 감소` : ""}.${next}`;
  if (tier.side === "사도") return `${tier.name}: 얻는 은자 ${halpun(tier.silver)} 증가${tier.crit ? `, 회심의 일격 확률 ${halpun(tier.crit)} 증가` : ""}.${next}`;
  return `${tier.name}: 주는 피해 ${halpun(tier.damage)} 증가, 회복 효율 ${halpun(tier.healCut)} 감소.${next}`;
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
/** 특전의 글에 주무공 계열의 기운 이름을 넣는다. 검이면 검기와 검강, 권이면 권기와 권강이다 */
export function auraText(text, category = "검법") {
  const [qi, gang, cut] = DB.realms.aura[category] || DB.realms.aura.검법;
  return text.replaceAll("〈기상인〉", cut).replaceAll("〈기〉", qi).replaceAll("〈강〉", gang);
}

/** 그 경지까지 얻은 특전 */
export function realmPerks(realm, category = "검법") {
  const reached = realmIndex(realm);
  return DB.realms.order.filter((name, i) => i <= reached && DB.realms.perks[name]).map((name) => {
    const perk = DB.realms.perks[name];
    const grown = Object.entries(perk.growth || {}).filter(([next]) => realmIndex(next) <= reached);
    return { realm: name, ...perk, name: auraText(perk.name, category), desc: auraText(perk.desc, category), grown: grown.map(([next, g]) => ({ realm: next, desc: auraText(g.desc, category) })) };
  });
}

/** 그 경지까지 깊어진 특전의 숨은 특성 */
export function perkGrowthTraits(realm) {
  const reached = realmIndex(realm);
  return Object.entries(DB.realms.perks).flatMap(([name, perk]) => Object.keys(perk.growth || {})
    .filter((next) => realmIndex(next) <= reached).map((next) => `${perkTrait(name)}_${next}`));
}

/** 결전에 달려올 인연. 조건을 채운 사람 가운데 앞에서부터 정해진 수만 온다 */
export const MAX_COMPANIONS = 3;
export function activeCompanions(player) {
  return Object.entries(DB.companions).filter(([, c]) => player.hasFlag(c.flag)).slice(0, MAX_COMPANIONS).map(([key, c]) => ({ key, ...c }));
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
  // 이름이 나기 전에는 내 성향을 아는 사람이 없다
  if (tier && player.fame >= 10) keys.push(tier.step >= DEEP_STEP ? `${tier.side}_깊음` : tier.side);
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

/** 명성으로 불리는 이름. 이름값과 성향을 함께 따르고, 높은 이름은 경지가 받쳐야 한다. 천하제일인은 천마를 넘어선 사람뿐이다 */
export function fameRank(player, fame = player.fame) {
  if (player.realm === "생사경" || player.slain.includes("천마")) return DB.flavor.fame_top;
  const side = dominant(player.alignment);
  let names = DB.flavor.fame_ranks[0].names;
  for (const rank of DB.flavor.fame_ranks) {
    if (fame >= rank.at && (!rank.realm_min || realmIndex(player.realm) >= realmIndex(rank.realm_min))) names = rank.names;
  }
  return names[side] ?? names.기본;
}

export const fameRankChanged = (player, before, after) =>
  (fameRank(player, before) !== fameRank(player, after) ? fameRank(player, after) : null);

/**
 * 강호에서 불리는 별호. 앞글자는 성향과 그 깊이, 출신에서, 뒷글자는 주무공 계열과 명성에서 온다.
 * 이름이 알려지기 전에는 별호가 없다.
 */
export function byname(player) {
  if (player.fame < 10) return "이름 없는 무인";
  return personalize(bynameOf(player), player.person);
}

function bynameOf(player) {
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
