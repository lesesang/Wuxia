// 은자와 시장. 품목은 data/market.json 에 있으며 항목 추가만으로 늘어난다.
import { Skill, STAT_CAP } from "./character.js";
import { DB } from "./data.js";
import { pick, shuffled } from "./rng.js";
import { getChapter, JUNG_DISCOUNT, marketName, sumEffect } from "./rules.js";

const STOCK_SIZE = 8;

const LAST_MARKET_TURN = 119;

/** 시장 등급 1~4는 챕터를 따르고, 5는 마지막의 수상한 누군가 */
const marketNumber = (turn) => (turn === LAST_MARKET_TURN ? 5 : Math.min(4, getChapter(turn)));

export function equipmentBonus(player, slot) {
  const item = DB.market[player[slot]];
  return item?.effects.find((e) => e.type === "equip")?.bonus || 0;
}

/** 무기와 방어구는 지금 것보다 나은 물건을 하나씩 꼭 진열한다. */
function gearForSale(pool, player) {
  const picks = [];
  for (const slot of ["weapon", "armor"]) {
    const better = pool.filter((k) => DB.market[k].effects.some(
      (e) => e.type === "equip" && e.slot === slot && e.bonus > equipmentBonus(player, slot)));
    if (better.length) picks.push(pick(better));
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
  const others = shuffled(pool.filter((k) => !stock.includes(k)));
  stock.push(...others.slice(0, Math.max(0, STOCK_SIZE - stock.length)));
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
  return Math.max(1, Math.trunc(DB.market[key].price * (100 - percent) / 100));
}

function effectIsUseful(player, effect) {
  switch (effect.type) {
    case "heal": case "cure": return (effect.percent ?? 1) > 0;
    case "stat": return player[effect.stat] < STAT_CAP;
    case "equip": return effect.bonus > equipmentBonus(player, effect.slot);
    case "skill": return !player.hasSkill(effect.skill);
    case "boss_weaken": return player.bossWeaken === 0;
    default: return false;
  }
}

export function blockReason(player, key) {
  if (!DB.market[key].effects.some((e) => effectIsUseful(player, e))) return "효과 없음";
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
  const price = priceOf(player, key);
  player.silver -= price;
  entry.left -= 1;
  if (item.consumable) {
    player.addItem(key);
    return [true, `「${item.name}」을(를) 샀다. (은자 -${price}) 가방에 넣었다.`];
  }
  for (const effect of item.effects) applyEffect(player, key, effect);
  return [true, `「${item.name}」을(를) 샀다. (은자 -${price})`];
}

export function stockView(player, market) {
  return market.stock.map((entry) => {
    const item = DB.market[entry.key];
    const sold = entry.left <= 0;
    return {
      key: entry.key, name: item.name, category: item.category, desc: item.desc,
      price: priceOf(player, entry.key), left: entry.left,
      stackable: (item.stock_qty || 1) > 1, sold,
      blocked: sold ? null : blockReason(player, entry.key),
    };
  });
}

export const itemName = (key) => DB.market[key]?.name ?? null;
