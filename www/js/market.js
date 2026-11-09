// 은자와 시장. 품목은 data/market.json 에 있으며 항목 추가만으로 늘어난다.
import { Skill, STAT_CAP } from "./character.js";
import { DB } from "./data.js";
import { loadMeta, spendKarma } from "./meta.js";
import { pick, pickWeighted } from "./rng.js";
import { alignValue, getChapter, hasEffect, marketName, sumEffect, talkLine } from "./rules.js";
import { josa } from "./josa.js";

export const ITEM_GRADES = ["범품", "양품", "명품", "보물", "신물"];
const SELL_RATE = 0.4; // 장터에 되팔 때 받는 값의 비율
const SELL_BY_GRADE = { 범품: 5, 양품: 40, 명품: 120, 보물: 300, 신물: 600 }; // 값이 없는 물건을 되팔 때

const STOCK_SIZE = 10;
const MAX_BOSS_WEAKEN = 60; // 천마의 체력은 이 이상 깎이지 않는다
const MAX_DISCOUNT = 70;

const LAST_MARKET_TURN = 119;
const LAST_MARKET_MARKUP = 1.3;

/** 시장 등급 1~4는 챕터를 따르고, 5는 마지막의 수상한 누군가 */
const marketNumber = (turn) => (turn === LAST_MARKET_TURN ? 5 : Math.min(4, getChapter(turn)));

const MISMATCH_RATE = 0.75; // 주무공과 맞지 않는 병기는 위력이 이만큼만 나온다
const MAIN_STYLE_WEIGHT = 6; // 주무공 계열 품목이 장터에 나올 비중. 계열마다 품목 수가 달라도 같은 값이 되게 나눈다
const KNOWN_STYLE_WEIGHT = 1.5; // 익힌 다른 무공 계열 품목의 비중

/** 이 플레이어가 그 장비에서 실제로 얻는 수치 */
export function bonusFor(player, key) {
  const effect = DB.market[key]?.effects.find((e) => e.type === "equip");
  if (!effect) return 0;
  if (effect.slot !== "weapon" || !effect.style) return effect.bonus;
  const main = player.bestSkill();
  if (main?.category === effect.style) {
    return Math.floor(effect.bonus * (100 + sumEffect(player.traits, "main_weapon_bonus", "percent")) / 100);
  }
  return !main || hasEffect(player.traits, "no_mismatch") ? effect.bonus : Math.floor(effect.bonus * MISMATCH_RATE);
}

export function equipmentBonus(player, slot) {
  return bonusFor(player, player[slot]);
}

/** 무기와 비급이 어느 무공 계열의 것인지. 계열이 없으면 null */
function itemStyle(key) {
  for (const effect of DB.market[key].effects) {
    if (effect.style) return effect.style;
    if (effect.type === "skill" && DB.skills[effect.skill]?.type === "공격무공") return DB.skills[effect.skill].category;
  }
  return null;
}

/** 익힌 무공과 맞는 품목일수록 진열될 가능성이 높다. */
export function styleWeight(player, key) {
  const style = itemStyle(key);
  if (!style) return 1;
  if (player.bestSkill()?.category === style) return MAIN_STYLE_WEIGHT * (1 + sumEffect(player.traits, "main_style_luck", "percent") / 100);
  return player.skillsOfType("공격무공").some((s) => s.category === style) ? KNOWN_STYLE_WEIGHT : 1;
}

const TOOL_GRADE_LIFT = 0.6; // 장터가 하나 뒤로 갈 때마다 품계 한 단계에 더하는 가중치

const SHELVES = [["약", 3], ["심법", 1], ["보법", 1], ["공격 비급", 3], ["도구", 2]];

function shelfOf(key) {
  const item = DB.market[key];
  if (item.category === "영약" || item.category === "소비품") return "약";
  if (item.category === "도구") return "도구";
  const effect = item.effects.find((e) => e.type === "skill");
  if (!effect) return "기타";
  const type = DB.skills[effect.skill]?.type;
  return type === "공격무공" ? "공격 비급" : type === "심공" ? "심법" : "보법";
}

/** 계열마다 품목 수가 달라도 계열이 뽑힐 확률이 같도록 품목 수로 나눈다. */
export function weightsByStyle(list, weightOf) {
  const counts = {};
  for (const k of list) {
    const style = itemStyle(k);
    if (style) counts[style] = (counts[style] || 0) + 1;
  }
  return list.map((k) => weightOf(k) / (counts[itemStyle(k)] || 1));
}

function weightedSample(list, weightOf, count) {
  const pool = [...list];
  const picked = [];
  while (pool.length && picked.length < count) {
    const key = pickWeighted(pool, weightsByStyle(pool, weightOf));
    picked.push(key);
    pool.splice(pool.indexOf(key), 1);
  }
  return picked;
}

/** 병기와 호신구는 늘 진열한다. 주무공에 맞는 병기가 먼저고, 이미 지닌 물건은 빠진다. 더 나은 것이 앞선다. */
function gearForSale(pool, player) {
  const picks = [];
  const slotOf = (k) => DB.market[k].effects.find((e) => e.type === "equip")?.slot;
  const better = (k, slot) => (bonusFor(player, k) > equipmentBonus(player, slot) ? 3 : 1);
  const main = player.bestSkill()?.category;
  const weapons = pool.filter((k) => slotOf(k) === "weapon");
  const fitting = weapons.filter((k) => itemStyle(k) === main);
  picks.push(...weightedSample(fitting, (k) => better(k, "weapon"), 2));
  const others = weapons.filter((k) => !picks.includes(k) && itemStyle(k) !== main);
  picks.push(...weightedSample(others, (k) => styleWeight(player, k), 1));
  picks.push(...weightedSample(pool.filter((k) => slotOf(k) === "armor"), (k) => better(k, "armor"), 2));
  return picks;
}

/** 수상한 누군가는 누가 오든 같은 얼굴이다 */
const pickLastMarketLine = () => pick(DB.flavor.talk.last_market);

export function openMarket(turn, player) {
  const number = marketNumber(turn);
  const top = player.dominantAlignment();
  const pool = Object.keys(DB.market).filter((k) => {
    const item = DB.market[k];
    if (!item.markets.includes(number)) return false;
    if (item.dominant && item.dominant !== top) return false;
    // 이미 익힌 무공의 비급과 이미 지닌 병장기는 진열하지 않는다
    if (player.ownsGear(k)) return false;
    return !item.effects.some((e) => e.type === "skill" && player.hasSkill(e.skill));
  });
  const stock = pool.filter((k) => DB.market[k].always);
  for (const key of gearForSale(pool, player)) if (!stock.includes(key)) stock.push(key);
  // 무기와 비급이 많아도 약과 심법, 경공이 밀려나지 않도록 칸을 나눠 고른다
  for (const [shelf, size] of SHELVES) {
    const items = pool.filter((k) => !stock.includes(k) && shelfOf(k) === shelf);
    // 도구는 뒤쪽 장터일수록 좋은 품계가 나온다
    const lift = shelf === "도구" ? (k) => 1 + TOOL_GRADE_LIFT * ITEM_GRADES.indexOf(DB.market[k].grade) * (number - 1) : () => 1;
    stock.push(...weightedSample(items, (k) => styleWeight(player, k) * lift(k), size));
  }
  const others = pool.filter((k) => !stock.includes(k));
  stock.push(...weightedSample(others, (k) => styleWeight(player, k), Math.max(0, STOCK_SIZE - stock.length) + sumEffect(player.traits, "extra_stock", "amount")));
  return {
    name: marketName(turn),
    special: number === 5,
    stock: stock.map((key) => ({ key, left: DB.market[key].stock_qty || 1 })),
    message: number === 5 ? pickLastMarketLine() : talkLine(player, "market"),
  };
}

export function priceOf(player, key) {
  let percent = sumEffect(player.traits, "market_discount", "percent");
  percent += alignValue(player.alignment, "정도", "discount");
  // 수상한 누군가는 흔한 물건도 비싸게 내놓는다
  const markup = player.turn === LAST_MARKET_TURN && !DB.market[key].always ? LAST_MARKET_MARKUP : 1;
  return Math.max(1, Math.trunc(DB.market[key].price * markup * (100 - Math.min(percent, MAX_DISCOUNT)) / 100));
}

/** 신물 병장기를 내어 주는 증표가 가리키는 물건. 병기는 주무공에 맞는 것이다 */
function gearFromToken(player, { grade, slot = "weapon" }) {
  const main = player.bestSkill()?.category;
  return Object.keys(DB.market).find((k) => {
    const equip = DB.market[k].effects.find((e) => e.type === "equip");
    return equip && equip.slot === slot && DB.market[k].grade === grade && (slot !== "weapon" || equip.style === main);
  }) ?? null;
}

function effectIsUseful(player, effect, key) {
  if (effect.type === "equip") return !player.ownsGear(key);
  if (effect.type === "main_gear") {
    const target = gearFromToken(player, effect);
    return !!target && !player.ownsGear(target);
  }
  switch (effect.type) {
    case "heal": case "cure": case "mastery": case "atk_buff": return (effect.percent ?? 1) > 0;
    case "stat": return player[effect.stat] < STAT_CAP;
    case "skill": return !player.hasSkill(effect.skill);
    case "boss_weaken": return player.bossWeaken < MAX_BOSS_WEAKEN;
    default: return false;
  }
}

export function blockReason(player, key) {
  // 행낭에 넣는 물건은 쓸 때 효과가 나므로 언제든 살 수 있다
  if (!DB.market[key].consumable && !DB.market[key].effects.some((e) => effectIsUseful(player, e, key))) return "효과 없음";
  if (DB.market[key].karma_price) return loadMeta().current_karma < DB.market[key].karma_price ? "카르마 부족" : null;
  if (player.silver < priceOf(player, key)) return "은자 부족";
  return null;
}

function applyEffect(player, key, effect) {
  switch (effect.type) {
    case "heal":
      if (effect.stat === "hp") player.healPercent(effect.percent, 0);
      else player.healPercent(0, effect.percent);
      break;
    case "stat": player.gainStat(effect.stat, effect.amount); break;
    case "equip":
      // 빈손일 때만 바로 들고, 아니면 행낭에 챙긴다. 바꿔 드는 것은 플레이어의 몫이다
      if (!player[effect.slot]) player.equipGear(key);
      else if (!player.gear.includes(key)) player.gear.push(key);
      break;
    case "skill": player.learnSkill(new Skill(effect.skill)); break;
    case "boss_weaken": player.bossWeaken += effect.percent; break;
    case "main_gear": {
      const target = gearFromToken(player, effect);
      if (target && !player.ownsGear(target)) {
        const { slot } = DB.market[target].effects.find((e) => e.type === "equip");
        if (!player[slot]) player.equipGear(target);
        else player.gear.push(target);
      }
      break;
    }
    default:
  }
}

/** 구매 처리. [성공 여부, 안내 문구] */
export function buy(player, market, key) {
  const entry = market.stock.find((s) => s.key === key && s.left > 0);
  if (!entry) return [false, "진열대에 없는 물건이다."];
  const reason = blockReason(player, key);
  if (reason) return [false, `살 수 없다. (${reason})`];

  const item = DB.market[key];
  if (item.karma_price) {
    spendKarma(item.karma_price);
    entry.left -= 1;
    if (item.consumable) {
      player.addItem(key);
      return [true, `${item.name}${josa(item.name, "을/를")} 거래했다. (카르마 -${item.karma_price}) 행낭에 넣었다.`];
    }
    for (const effect of item.effects) applyEffect(player, key, effect);
    return [true, `${item.name}${josa(item.name, "을/를")} 거래했다. (카르마 -${item.karma_price})`];
  }
  const price = priceOf(player, key);
  player.silver -= price;
  entry.left -= 1;
  if (item.consumable) {
    player.addItem(key);
    return [true, `${item.name}${josa(item.name, "을/를")} 샀다. (은자 -${price}) 행낭에 넣었다.`];
  }
  for (const effect of item.effects) applyEffect(player, key, effect);
  return [true, `${item.name}${josa(item.name, "을/를")} 샀다. (은자 -${price})`];
}

/** 비급이면 그 무공의 품계 */
function skillGradeOf(key) {
  const effect = DB.market[key].effects.find((e) => e.type === "skill");
  return effect ? DB.skills[effect.skill]?.grade : null;
}

export function stockView(player, market) {
  return market.stock.map((entry) => {
    const item = DB.market[entry.key];
    const sold = entry.left <= 0;
    return {
      key: entry.key, name: item.name, category: item.category, desc: item.desc, grade: skillGradeOf(entry.key) ?? itemGrade(entry.key),
      price: priceOf(player, entry.key), karma: item.karma_price || 0, left: entry.left,
      stackable: (item.stock_qty || 1) > 1, sold,
      blocked: sold ? null : blockReason(player, entry.key),
    };
  });
}

export const itemGrade = (key) => DB.market[key]?.grade ?? "범품";

/** 장터에 되팔 때 받는 은자 */
export function sellPrice(key) {
  const item = DB.market[key];
  if (!item) return 0;
  if (item.price > 0) return Math.max(1, Math.floor(item.price * SELL_RATE));
  return SELL_BY_GRADE[item.grade] ?? 5;
}

/** 지금 되팔 수 있는 것들. 든 병장기는 내려놓아야 판다. */
export function sellableView(player) {
  const gear = player.gear.filter((k) => DB.market[k]).map((key) => ({ key, kind: "gear", name: DB.market[key].name, grade: itemGrade(key), category: DB.market[key].category, price: sellPrice(key), count: 1, desc: DB.market[key].desc }));
  const items = Object.entries(player.inventory).filter(([k, n]) => DB.market[k] && n > 0).map(([key, count]) => ({ key, kind: "item", name: DB.market[key].name, grade: itemGrade(key), category: DB.market[key].category, price: sellPrice(key), count, desc: DB.market[key].desc }));
  return [...gear, ...items];
}

/** 되판다. [성공 여부, 안내 문구] */
export function sell(player, key) {
  const name = DB.market[key]?.name;
  if (!name) return [false, "없는 물건이다."];
  if (player.gear.includes(key)) player.gear = player.gear.filter((k) => k !== key);
  else if (player.inventory[key] > 0) {
    player.inventory[key] -= 1;
    if (player.inventory[key] <= 0) delete player.inventory[key];
  } else return [false, "지니고 있지 않은 물건이다."];
  const price = sellPrice(key);
  player.silver += price;
  return [true, `${name}${josa(name, "을/를")} 팔았다. (은자 +${price})`];
}

/** 이 병장기가 지금 영기가 살아 있는가. 병기는 주무공과 맞아야 한다. */
export function gearGimmick(player, slot) {
  const item = DB.market[player[slot]];
  if (!item?.gimmick) return null;
  const effect = item.effects.find((e) => e.type === "equip");
  if (slot === "weapon" && effect.style && player.bestSkill()?.category !== effect.style && !hasEffect(player.traits, "no_mismatch")) return null;
  return item.gimmick;
}

export const itemName = (key) => DB.market[key]?.name ?? null;
