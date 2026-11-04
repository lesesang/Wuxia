// 은자와 시장. 품목은 data/market.json 에 있으며 항목 추가만으로 늘어난다.
import { Skill, STAT_CAP } from "./character.js";
import { DB } from "./data.js";
import { loadMeta, spendKarma } from "./meta.js";
import { pickWeighted } from "./rng.js";
import { getChapter, hasEffect, JUNG_DISCOUNT, marketName, sumEffect } from "./rules.js";
import { josa } from "./josa.js";

const STOCK_SIZE = 10;
const MAX_BOSS_WEAKEN = 60; // 천마의 체력은 이 이상 깎이지 않는다
const MAX_DISCOUNT = 70;

const LAST_MARKET_TURN = 119;

/** 시장 등급 1~4는 챕터를 따르고, 5는 마지막의 수상한 누군가 */
const marketNumber = (turn) => (turn === LAST_MARKET_TURN ? 5 : Math.min(4, getChapter(turn)));

const MISMATCH_RATE = 0.75; // 주무공과 맞지 않는 병기는 위력이 이만큼만 나온다
const MAIN_STYLE_WEIGHT = 3; // 주무공 계열 품목이 장터에 나올 비중
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
  if (player.bestSkill()?.category === style) return MAIN_STYLE_WEIGHT;
  return player.skillsOfType("공격무공").some((s) => s.category === style) ? KNOWN_STYLE_WEIGHT : 1;
}

const SHELVES = [["약", 3], ["내공과 경공", 1], ["공격 비급", 2], ["도구", 1]];

function shelfOf(key) {
  const item = DB.market[key];
  if (item.category === "영약" || item.category === "소비품") return "약";
  if (item.category === "도구") return "도구";
  const effect = item.effects.find((e) => e.type === "skill");
  if (!effect) return "기타";
  return DB.skills[effect.skill]?.type === "공격무공" ? "공격 비급" : "내공과 경공";
}

function weightedSample(list, weightOf, count) {
  const pool = [...list];
  const picked = [];
  while (pool.length && picked.length < count) {
    const key = pickWeighted(pool, pool.map(weightOf));
    picked.push(key);
    pool.splice(pool.indexOf(key), 1);
  }
  return picked;
}

/** 무기와 방어구는 지금 것보다 나은 물건을 하나씩 꼭 진열한다. */
function gearForSale(pool, player) {
  const picks = [];
  for (const slot of ["weapon", "armor"]) {
    const better = pool.filter((k) => DB.market[k].effects.some(
      (e) => e.type === "equip" && e.slot === slot && bonusFor(player, k) > equipmentBonus(player, slot)));
    if (better.length) picks.push(...weightedSample(better, (k) => styleWeight(player, k), slot === "weapon" ? 2 : 1));
  }
  return picks;
}

export function openMarket(turn, player) {
  const number = marketNumber(turn);
  const top = player.dominantAlignment();
  const pool = Object.keys(DB.market).filter((k) => {
    const item = DB.market[k];
    if (!item.markets.includes(number)) return false;
    if (item.dominant && item.dominant !== top) return false;
    // 이미 익힌 무공의 비급은 진열하지 않는다
    return !item.effects.some((e) => e.type === "skill" && player.hasSkill(e.skill));
  });
  const stock = pool.filter((k) => DB.market[k].always);
  for (const key of gearForSale(pool, player)) if (!stock.includes(key)) stock.push(key);
  // 무기와 비급이 많아도 약과 심법, 경공이 밀려나지 않도록 칸을 나눠 고른다
  for (const [shelf, size] of SHELVES) {
    const items = pool.filter((k) => !stock.includes(k) && shelfOf(k) === shelf);
    stock.push(...weightedSample(items, (k) => styleWeight(player, k), size));
  }
  const others = pool.filter((k) => !stock.includes(k));
  stock.push(...weightedSample(others, (k) => styleWeight(player, k), Math.max(0, STOCK_SIZE - stock.length) + sumEffect(player.traits, "extra_stock", "amount")));
  return {
    name: marketName(turn),
    special: number === 5,
    stock: stock.map((key) => ({ key, left: DB.market[key].stock_qty || 1 })),
    message: null,
  };
}

export function priceOf(player, key) {
  let percent = sumEffect(player.traits, "market_discount", "percent");
  if (player.dominantAlignment() === "정도") percent += JUNG_DISCOUNT;
  return Math.max(1, Math.trunc(DB.market[key].price * (100 - Math.min(percent, MAX_DISCOUNT)) / 100));
}

function effectIsUseful(player, effect, key) {
  if (effect.type === "equip") return bonusFor(player, key) > equipmentBonus(player, effect.slot);
  switch (effect.type) {
    case "heal": case "cure": case "mastery": case "atk_buff": return (effect.percent ?? 1) > 0;
    case "stat": return player[effect.stat] < STAT_CAP;
    case "skill": return !player.hasSkill(effect.skill);
    case "boss_weaken": return player.bossWeaken < MAX_BOSS_WEAKEN;
    default: return false;
  }
}

export function blockReason(player, key) {
  if (!DB.market[key].effects.some((e) => effectIsUseful(player, e, key))) return "효과 없음";
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
    case "equip": player[effect.slot] = key; break;
    case "skill": player.learnSkill(new Skill(effect.skill)); break;
    case "boss_weaken": player.bossWeaken += effect.percent; break;
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
    for (const effect of item.effects) applyEffect(player, key, effect);
    return [true, `「${item.name}」${josa(item.name, "을/를")} 거래했다. (카르마 -${item.karma_price})`];
  }
  const price = priceOf(player, key);
  player.silver -= price;
  entry.left -= 1;
  if (item.consumable) {
    player.addItem(key);
    return [true, `「${item.name}」${josa(item.name, "을/를")} 샀다. (은자 -${price}) 행낭에 넣었다.`];
  }
  for (const effect of item.effects) applyEffect(player, key, effect);
  return [true, `「${item.name}」${josa(item.name, "을/를")} 샀다. (은자 -${price})`];
}

export function stockView(player, market) {
  return market.stock.map((entry) => {
    const item = DB.market[entry.key];
    const sold = entry.left <= 0;
    return {
      key: entry.key, name: item.name, category: item.category, desc: item.desc,
      price: priceOf(player, entry.key), karma: item.karma_price || 0, left: entry.left,
      stackable: (item.stock_qty || 1) > 1, sold,
      blocked: sold ? null : blockReason(player, entry.key),
    };
  });
}

export const itemName = (key) => DB.market[key]?.name ?? null;
