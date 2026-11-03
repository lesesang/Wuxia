// 이벤트. 정해진 달의 줄거리와 탐색 중 사건을 JSON으로 관리한다. 형식은 docs/콘텐츠-가이드.md 참고.
import { GRADE_ORDER, Skill, STAT_NAMES } from "./character.js";
import { DB } from "./data.js";
import { bonusFor, equipmentBonus, styleWeight } from "./market.js";
import { updateKnown } from "./meta.js";
import { pick, pickWeighted, rng } from "./rng.js";
import { ALIGNMENTS, applyGrowth, fameRankChanged, getChapter, realmIndex, sumEffect } from "./rules.js";

export const EVENT_STAT_SCALE = 0.3; // 사건·기연의 기량 상승 배율 (밸런스 조정용)

/** 만족하지 못한 첫 조건의 설명. 모두 만족하면 null */
export function unmetReason(player, requires) {
  if (!requires) return null;
  const r = requires;
  if (r.origin && player.originKey !== r.origin) return "출신이 다르다";
  if (r.flag && !player.hasFlag(r.flag)) return "아직 인연이 닿지 않았다";
  if (r.not_flag && player.hasFlag(r.not_flag)) return "이미 지나간 일이다";
  if (r.any_flag && !r.any_flag.some((f) => player.hasFlag(f))) return "아직 인연이 닿지 않았다";
  if (r.min_silver && player.silver < r.min_silver) return `은자 ${r.min_silver} 필요`;
  if (r.realm_min && realmIndex(player.realm) < realmIndex(r.realm_min)) return `${r.realm_min} 이상 필요`;
  if (r.skill && !player.hasSkill(r.skill)) return "필요한 무공이 없다";
  if (r.no_skill && player.hasSkill(r.no_skill)) return "이미 익혔다";
  if (r.sect && player.sect !== r.sect) return "다른 문파의 일이다";
  if (r.no_sect && player.sect) return "이미 사문이 있다";
  if (r.has_sect && !player.sect) return "사문이 없다";
  // sect_side: 사문이 없거나, 사문의 성향이 이 값일 때만 그 세력에 설 수 있다
  if (r.sect_side && player.sect && DB.sects[player.sect]?.alignment !== r.sect_side) return "사문이 허락하지 않는다";
  if (r.item && !(player.inventory[r.item] > 0)) return `${DB.market[r.item].name} 필요`;
  if (r.equip && player.weapon !== r.equip && player.armor !== r.equip) return `${DB.market[r.equip].name} 필요`;
  if (r.any_skill && !r.any_skill.some((k) => player.hasSkill(k))) return "필요한 무공이 없다";
  if (r.injured && !player.injury) return "내상이 없다";
  if (r.main_category && player.bestSkill()?.category !== r.main_category) return `${r.main_category}을 쓰는 무인이 아니다`;
  if (r.trait && !player.traits.includes(r.trait)) return "타고난 바가 다르다";
  if (r.unlocked && !player.content.includes(r.unlocked)) return "아직 인연이 닿지 않았다";
  if (r.dominant && player.dominantAlignment() !== r.dominant) return `${r.dominant}의 길이 아니다`;
  if (r.min_fame && player.fame < r.min_fame) return `명성 ${r.min_fame} 필요`;
  for (const [name, value] of Object.entries(r.max_alignment || {})) {
    if ((player.alignment[name] || 0) > value) return `${name}의 기운이 너무 짙다`;
  }
  for (const [stat, value] of Object.entries(r.stat_min || {})) {
    if (player[stat] < value) return `${STAT_NAMES[stat]} ${value} 필요`;
  }
  for (const [name, value] of Object.entries(r.alignment_min || {})) {
    const current = player.alignment[name] || 0;
    if (current < value) return `${name} ${value} 필요 (현재 ${current})`;
  }
  return null;
}

export const checkRequires = (player, requires) => unmetReason(player, requires) === null;

export function storyEventForTurn(player) {
  for (const [key, event] of Object.entries(DB.storyEvents)) {
    if (event.turn === player.turn && !player.seenEvents.includes(key) && checkRequires(player, event.requires)) {
      return key;
    }
  }
  return null;
}

// ---------- 연계 인카운터 ----------

export const LAST_CHAIN_TURN = 119; // 천마봉(120달) 전에 모든 연계가 끝나야 한다
const CHAIN_SLACK = 2;              // 줄거리 전투로 달이 밀려도 끝낼 수 있게 남겨 두는 달
const MAX_ACTIVE_CHAINS = 2;

/** 지금 시작해도 남은 달 안에 끝까지 갈 수 있는 연계인가 */
export function canStartChain(player, id) {
  if (player.chains.length >= MAX_ACTIVE_CHAINS) return false;
  const occupied = player.chains.reduce((sum, c) => sum + DB.chains[c.id].keys.length - c.next, 0);
  return player.turn + DB.chains[id].span + occupied + CHAIN_SLACK <= LAST_CHAIN_TURN;
}

/** 다음 편의 달. 남은 편수만큼 달을 남기도록 당겨 잡는다. */
function nextDue(player, id, next) {
  const left = DB.chains[id].keys.length - next;
  return Math.min(player.turn + DB.chains[id].gaps[next], LAST_CHAIN_TURN - left + 1);
}

export function startChain(player, id) {
  player.chains.push({ id, next: 1, due: nextDue(player, id, 1) });
  player.note(`「${DB.chains[id].title}」 일에 발을 들였다.`);
}

/** 고른 결과에 따라 연계를 다음 편으로 넘기거나 끝낸다. */
export function advanceChain(player, id, abandoned = false) {
  const chain = player.chains.find((c) => c.id === id);
  if (!chain) return;
  const finished = chain.next >= DB.chains[id].keys.length;
  if (abandoned || finished) {
    player.chains = player.chains.filter((c) => c.id !== id);
    if (!abandoned) player.chainsDone += 1;
    player.note(abandoned ? `「${DB.chains[id].title}」 일에서 손을 뗐다.` : `「${DB.chains[id].title}」 일을 끝맺었다.`);
    return;
  }
  chain.due = nextDue(player, id, chain.next);
}

/** 이번 달에 찾아와야 할 연계 편. 천마봉이 코앞이면 남은 것을 모두 불러낸다. */
export function dueChainEvent(player) {
  const urgent = player.turn >= LAST_CHAIN_TURN;
  const due = player.chains.filter((c) => urgent || c.due <= player.turn).sort((a, b) => a.due - b.due)[0];
  if (!due) return null;
  const key = DB.chains[due.id].keys[due.next];
  due.next += 1;
  return key;
}

/** 연계 데이터가 규칙을 지키는지 검사한다. */
export function validateChains() {
  const errors = [];
  for (const [id, chain] of Object.entries(DB.chains)) {
    chain.keys.forEach((key, i) => {
      const { choices } = DB.events[key];
      if (!choices.some((c) => !c.requires)) errors.push(`${key}: 조건 없는 선택지가 없다`);
      const last = i === chain.keys.length - 1;
      const has = (name) => choices.some((c) => c.outcomes.some((o) => o.effects?.[name]));
      if (i === 0 && !has("chain_start")) errors.push(`${key}: 시작 선택지가 없다`);
      if (i > 0 && !last && !has("chain_abandon")) errors.push(`${key}: 포기 선택지가 없다`);
      if (i > 0 && chain.gaps[i] < 1) errors.push(`${key}: 간격은 1달 이상`);
    });
    const latest = Math.max(...DB.events[chain.keys[0]].chapters) * 24;
    if (latest > 120) errors.push(`${id}: 장 범위 오류`);
  }
  return errors;
}

export function pickRandomEvent(player) {
  const chapter = getChapter(player.turn);
  const options = Object.keys(DB.randomEvents).filter((key) => {
    const event = DB.randomEvents[key];
    if (event.chain && !canStartChain(player, event.chain.id)) return false;
    return (event.chapters || []).includes(chapter) && !player.seenEvents.includes(key)
      && checkRequires(player, event.requires);
  });
  if (!options.length) return null;
  // 인연이 이어지는 이벤트를 먼저 만날 가능성을 높인다
  return pickWeighted(options, options.map((k) => (DB.randomEvents[k].requires || DB.randomEvents[k].chain ? 3 : 1)));
}

export function pickFortune(player) {
  const chapter = getChapter(player.turn);
  return pick(DB.fortunes.filter((f) => (f.chapters || [1, 2, 3, 4, 5]).includes(chapter)
    && checkRequires(player, f.requires)));
}

/**
 * 상황별 반응(variants)을 반영한 선택지 목록.
 * 조건이 맞는 반응의 선택지가 기본 선택지 앞에 붙는다. 선택 번호는 이 목록 기준이다.
 */
function eventChoices(player, key) {
  const event = DB.events[key];
  const extra = (event.variants || [])
    .filter((v) => v.choices && checkRequires(player, v.requires))
    .flatMap((v) => v.choices.map((c) => ({ ...c, tag: c.tag ?? v.tag ?? null })));
  return [...extra, ...event.choices];
}

/** 조건이 맞는 첫 반응의 본문. 없으면 기본 본문. */
function eventText(player, key) {
  const event = DB.events[key];
  const variant = (event.variants || []).find((v) => v.text && checkRequires(player, v.requires));
  return variant ? variant.text : event.text;
}

export function eventView(player, key) {
  const event = DB.events[key];
  const choices = [];
  eventChoices(player, key).forEach((choice, index) => {
    const locked = unmetReason(player, choice.requires);
    // hidden 선택지는 조건이 맞을 때만 보여 준다
    if (locked && choice.hidden) return;
    choices.push({ index, label: choice.label, locked, tag: choice.tag || null });
  });
  const title = event.chain ? `${event.title} (${event.chain.index + 1}/${event.chain.total})` : event.title;
  return { key, title, text: eventText(player, key), choices, chain: event.chain ? DB.chains[event.chain.id].title : null };
}

/** 적이 플레이어를 보고 하는 말. 상황에 맞는 대사가 있으면 그것을 쓴다. */
export function enemyIntro(player, enemyKey) {
  const data = DB.enemies[enemyKey];
  const special = (data.intros || []).find((i) => checkRequires(player, i.requires));
  return special ? special.text : (data.intro || null);
}

/** 선택을 처리하고 {text, summary, effects}를 돌려준다. 고를 수 없으면 null */
export function resolveChoice(player, key, index) {
  const choice = eventChoices(player, key)[index];
  if (!choice || !checkRequires(player, choice.requires)) return null;
  const outcome = pickWeighted(choice.outcomes, choice.outcomes.map((o) => o.weight ?? 1));
  const effects = outcome.effects || {};
  const summary = applyEffects(player, effects);
  if (!player.seenEvents.includes(key)) player.seenEvents.push(key);
  if (!DB.events[key].prelude) updateKnown([], [], [key]);
  return { text: outcome.text, label: choice.label, summary, effects };
}

/** 비급으로 파는 공격무공 중 하나를 고른다. 익힌 계열이 나올 가능성이 높다. */
function randomBookSkill(player, maxGrade) {
  const limit = GRADE_ORDER.indexOf(maxGrade);
  const keys = Object.keys(DB.market).filter((k) => {
    const effect = DB.market[k].effects.find((e) => e.type === "skill");
    const skill = effect && DB.skills[effect.skill];
    return skill && skill.type === "공격무공" && !DB.market[k].dominant
      && GRADE_ORDER.indexOf(skill.grade) <= limit && !player.hasSkill(effect.skill);
  });
  if (!keys.length) return null;
  const key = pickWeighted(keys, keys.map((k) => styleWeight(player, k)));
  return new Skill(DB.market[key].effects.find((e) => e.type === "skill").skill);
}

function equipReward(player, key) {
  const effect = DB.market[key].effects.find((e) => e.type === "equip");
  const name = DB.market[key].name;
  updateKnown([], [key]);
  if (bonusFor(player, key) > equipmentBonus(player, effect.slot)) {
    player[effect.slot] = key;
    return [`「${name}」 장착`];
  }
  return [`「${name}」을(를) 받았지만 지금 병장기가 더 좋다`];
}

const STARTER_WEAPONS = {
  검법: "낡은검", 도법: "낡은도", 창법: "낡은창", 봉법: "낡은곤봉", 권법: "낡은권대", 장법: "낡은장갑", 암기: "낡은비도",
};
const STARTER_SKILLS = {
  검법: "기초검법", 도법: "기초도법", 창법: "기초창법", 봉법: "기초봉법", 권법: "육합권", 장법: "기초장법", 암기: "유엽비도",
};

/** 시작 무기를 고른다. 계열이 다르면 그 계열의 기초 무공을 익혀 주무공으로 삼는다. */
function takeStartWeapon(player, style) {
  // 강호초출은 고른 병기에 맞는 무공 하나로 시작한다
  const key = STARTER_SKILLS[style];
  player.skills = player.skills.filter((s) => s.type !== "공격무공");
  const skill = new Skill(key);
  const summary = [`📕 무공 「${skill.name}」`, ...player.learnSkill(skill)];
  player.mainSkill = key;
  return [...summary, ...equipReward(player, STARTER_WEAPONS[style])];
}

/** 강호초출의 첫 심법을 정한다. */
function takeStartMindset(player, key) {
  player.skills = player.skills.filter((s) => s.type !== "심공");
  const skill = new Skill(key);
  return [`📕 심법 「${skill.name}」`, ...player.learnSkill(skill)];
}

const REWARD_BONUSES = [10, 26, 50, 80]; // 보상 병기의 네 단계

/** 주무공 계열에 맞는 무기를 단계(1~4)에 따라 준다. */
function styleWeaponReward(player, tier) {
  const style = player.bestSkill()?.category;
  const weapons = Object.keys(DB.market)
    .filter((k) => DB.market[k].markets.length && DB.market[k].effects.some((e) => e.slot === "weapon" && e.style === style && REWARD_BONUSES.includes(e.bonus)))
    .sort((a, b) => DB.market[a].price - DB.market[b].price);
  if (!weapons.length) return [`은자+${player.gainSilver(DB.market.운철보검.price)}`];
  return equipReward(player, weapons[Math.min(tier, weapons.length) - 1]);
}

const signed = (n) => (n >= 0 ? `+${n}` : `${n}`);

/** 전투·엔딩을 제외한 효과를 적용하고 요약 문구 목록을 돌려준다. */
export function applyEffects(player, effects) {
  const summary = [];

  for (const [stat, amount] of Object.entries(effects.stats || {})) {
    if (amount >= 0) {
      const rate = EVENT_STAT_SCALE * (100 + sumEffect(player.traits, "event_growth", "percent")) / 100;
      const scaled = Math.max(1, Math.round(amount * rate));
      summary.push(`${STAT_NAMES[stat]}+${player.gainStat(stat, applyGrowth(scaled, player.traits, stat))}`);
    } else {
      player[stat] = Math.max(1, player[stat] + amount);
      summary.push(`${STAT_NAMES[stat]}${amount}`);
    }
  }

  if ("hp_pct" in effects || "qi_pct" in effects) {
    const [hp, qi] = player.healPercent(effects.hp_pct || 0, effects.qi_pct || 0);
    if (hp) summary.push(`체력${signed(hp)}`);
    if (qi) summary.push(`내력${signed(qi)}`);
  }

  if ("set_silver" in effects) {
    const lost = player.silver - effects.set_silver;
    player.silver = effects.set_silver;
    if (lost) summary.push(`은자-${lost}`);
  }

  if ("silver" in effects) {
    if (effects.silver >= 0) {
      summary.push(`은자+${player.gainSilver(effects.silver)}`);
    } else {
      const spent = Math.min(player.silver, -effects.silver);
      player.silver -= spent;
      summary.push(`은자-${spent}`);
    }
  }

  for (const [name, amount] of Object.entries(effects.alignment || {})) {
    player.adjustAlignment(name, amount);
    summary.push(`${name}${signed(amount)}`);
  }

  for (const flag of effects.flags || []) player.addFlag(flag);
  if (effects.boss_weaken) player.bossWeaken += effects.boss_weaken;

  if ("fame" in effects) {
    const before = player.fame;
    player.fame = Math.max(0, player.fame + effects.fame);
    summary.push(`명성${signed(effects.fame)}`);
    const rank = fameRankChanged(before, player.fame);
    if (rank) {
      summary.push(`강호에서 「${rank}」로 불리기 시작했다`);
      player.note(`강호에서 「${rank}」로 불리기 시작했다.`);
    }
  }

  if ("injury" in effects) {
    player.addInjury(effects.injury);
    summary.push(`내상${signed(effects.injury)}`);
  }

  if (effects.join_sect && !player.sect) {
    player.sect = effects.join_sect;
    summary.push(`「${DB.sects[player.sect].name}」 입문`);
    player.note(`${DB.sects[player.sect].name}에 들어갔다.`);
  }

  if (effects.leave_sect && player.sect) {
    summary.push(`「${DB.sects[player.sect].name}」을(를) 떠남`);
    player.note(`${DB.sects[player.sect].name}을(를) 떠났다.`);
    player.sect = null;
  }

  if (effects.consume_item && player.inventory[effects.consume_item] > 0) {
    player.inventory[effects.consume_item] -= 1;
    if (player.inventory[effects.consume_item] <= 0) delete player.inventory[effects.consume_item];
    summary.push(`「${DB.market[effects.consume_item].name}」 사용`);
  }

  if (effects.mastery) {
    const skill = player.bestSkill();
    if (skill) {
      const messages = skill.gainMastery(effects.mastery);
      summary.push(`${skill.name} 성취+${effects.mastery}`, ...messages);
    }
  }

  if (effects.skill) {
    const skill = new Skill(effects.skill);
    const known = player.hasSkill(skill.key);
    const messages = player.learnSkill(skill);
    if (!known) summary.push(`📕 새 무공 「${skill.name}」`);
    summary.push(...messages);
  }

  if (effects.main_skill && player.hasSkill(effects.main_skill)) player.mainSkill = effects.main_skill;

  if (effects.random_skill) {
    const skill = randomBookSkill(player, effects.random_skill.max_grade);
    if (skill) {
      summary.push(`📕 새 무공 「${skill.name}」`, ...player.learnSkill(skill));
    } else {
      summary.push(`무리+${player.gainStat("martial", 2)}`);
    }
  }

  if (effects.style_skill) {
    const main = player.bestSkill()?.category;
    const list = Object.keys(DB.skills).filter((k) => DB.skills[k].legend && DB.skills[k].category === main && !player.hasSkill(k));
    if (list.length) {
      const skill = new Skill(list[Math.floor(rng.random() * list.length)]);
      summary.push(`📕 새 무공 「${skill.name}」`, ...player.learnSkill(skill));
      player.note(`전설의 무공 「${skill.name}」을(를) 얻었다.`);
    } else {
      summary.push(`무리+${player.gainStat("martial", 4)}`);
    }
  }

  if (effects.start_weapon) summary.push(...takeStartWeapon(player, effects.start_weapon));
  if (effects.start_mindset) summary.push(...takeStartMindset(player, effects.start_mindset));
  if (effects.style_weapon) summary.push(...styleWeaponReward(player, effects.style_weapon));
  if (effects.equip) summary.push(...equipReward(player, effects.equip));

  if (effects.item) {
    player.addItem(effects.item);
    summary.push(`「${DB.market[effects.item].name}」 획득`);
  }

  return summary;
}

/** 데이터 오류를 찾아 목록으로 돌려준다. */
export function validateEvents() {
  const errors = [];
  const checkEffects = (where, effects) => {
    if (effects.battle && !DB.enemies[effects.battle]) errors.push(`${where}: 없는 적 ${effects.battle}`);
    for (const enemy of effects.gauntlet?.enemies || []) {
      if (!DB.enemies[enemy]) errors.push(`${where}: 없는 적 ${enemy}`);
    }
    if (effects.gauntlet) checkEffects(where, effects.gauntlet.reward);
    if (effects.skill && !DB.skills[effects.skill]) errors.push(`${where}: 없는 무공 ${effects.skill}`);
    if (effects.item && !DB.market[effects.item]) errors.push(`${where}: 없는 품목 ${effects.item}`);
    if (effects.equip && !DB.market[effects.equip]) errors.push(`${where}: 없는 품목 ${effects.equip}`);
    if (effects.join_sect && !DB.sects[effects.join_sect]) errors.push(`${where}: 없는 문파 ${effects.join_sect}`);
    for (const stat of Object.keys(effects.stats || {})) {
      if (!STAT_NAMES[stat]) errors.push(`${where}: 없는 기량 ${stat}`);
    }
    for (const name of Object.keys(effects.alignment || {})) {
      if (!ALIGNMENTS.includes(name)) errors.push(`${where}: 없는 성향 ${name}`);
    }
  };
  const checkRequiresData = (where, r = {}) => {
    for (const item of [r.item, r.equip].filter(Boolean)) {
      if (!DB.market[item]) errors.push(`${where}: 없는 품목 ${item}`);
    }
    for (const skill of [r.skill, r.no_skill, ...(r.any_skill || [])].filter(Boolean)) {
      if (!DB.skills[skill]) errors.push(`${where}: 없는 무공 ${skill}`);
    }
    if (r.sect && !DB.sects[r.sect]) errors.push(`${where}: 없는 문파 ${r.sect}`);
    if (r.origin && !DB.origins.origins[r.origin]) errors.push(`${where}: 없는 출신 ${r.origin}`);
    if (r.trait && !DB.traits[r.trait]) errors.push(`${where}: 없는 자질 ${r.trait}`);
  };
  for (const [key, event] of Object.entries(DB.events)) {
    checkRequiresData(key, event.requires);
    const allChoices = [...event.choices, ...(event.variants || []).flatMap((v) => v.choices || [])];
    for (const variant of event.variants || []) checkRequiresData(key, variant.requires);
    for (const choice of allChoices) {
      checkRequiresData(key, choice.requires);
      for (const outcome of choice.outcomes) {
        checkEffects(key, outcome.effects || {});
        const item = outcome.effects?.consume_item;
        if (item && !DB.market[item]) errors.push(`${key}: 없는 품목 ${item}`);
      }
    }
  }
  for (const [key, enemy] of Object.entries(DB.enemies)) {
    for (const intro of enemy.intros || []) checkRequiresData(key, intro.requires);
  }
  DB.fortunes.forEach((fortune, i) => checkEffects(`기연 ${i}`, fortune.effects));
  return errors;
}
