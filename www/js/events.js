// 이벤트. 정해진 턴의 줄거리와 탐색 중 사건을 JSON으로 관리한다. 형식은 docs/콘텐츠-가이드.md 참고.
import { Skill, STAT_NAMES } from "./character.js";
import { DB } from "./data.js";
import { equipmentBonus } from "./market.js";
import { updateKnown } from "./meta.js";
import { pick, pickWeighted } from "./rng.js";
import { ALIGNMENTS, applyGrowth, fameRankChanged, getChapter, realmIndex } from "./rules.js";

export const EVENT_STAT_SCALE = 0.3; // 사건·기연의 능력치 상승 배율 (밸런스 조정용)

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

export function pickRandomEvent(player) {
  const chapter = getChapter(player.turn);
  const options = Object.keys(DB.randomEvents).filter((key) => {
    const event = DB.randomEvents[key];
    return (event.chapters || []).includes(chapter) && !player.seenEvents.includes(key)
      && checkRequires(player, event.requires);
  });
  if (!options.length) return null;
  // 인연이 이어지는 이벤트를 먼저 만날 가능성을 높인다
  return pickWeighted(options, options.map((k) => (DB.randomEvents[k].requires ? 3 : 1)));
}

export function pickFortune(player) {
  const chapter = getChapter(player.turn);
  return pick(DB.fortunes.filter((f) => (f.chapters || [1, 2, 3, 4, 5]).includes(chapter)
    && checkRequires(player, f.requires)));
}

export function eventView(player, key) {
  const event = DB.events[key];
  const choices = [];
  event.choices.forEach((choice, index) => {
    const locked = unmetReason(player, choice.requires);
    // 천마봉의 숨겨진 길은 조건이 맞을 때만 보여 준다
    if (locked && choice.label.startsWith("(") && event.kind === "final") return;
    choices.push({ index, label: choice.label, locked });
  });
  return { key, title: event.title, text: event.text, choices };
}

/** 선택을 처리하고 {text, summary, effects}를 돌려준다. 고를 수 없으면 null */
export function resolveChoice(player, key, index) {
  const choice = DB.events[key].choices[index];
  if (!choice || !checkRequires(player, choice.requires)) return null;
  const outcome = pickWeighted(choice.outcomes, choice.outcomes.map((o) => o.weight ?? 1));
  const effects = outcome.effects || {};
  const summary = applyEffects(player, effects);
  if (!player.seenEvents.includes(key)) player.seenEvents.push(key);
  return { text: outcome.text, summary, effects };
}

function equipReward(player, key) {
  const effect = DB.market[key].effects.find((e) => e.type === "equip");
  const name = DB.market[key].name;
  updateKnown([], [key]);
  if (effect.bonus > equipmentBonus(player, effect.slot)) {
    player[effect.slot] = key;
    return [`「${name}」 장착`];
  }
  return [`「${name}」을(를) 받았지만 지금 장비가 더 좋다`];
}

const signed = (n) => (n >= 0 ? `+${n}` : `${n}`);

/** 전투·엔딩을 제외한 효과를 적용하고 요약 문구 목록을 돌려준다. */
export function applyEffects(player, effects) {
  const summary = [];

  for (const [stat, amount] of Object.entries(effects.stats || {})) {
    if (amount >= 0) {
      const scaled = Math.max(1, Math.round(amount * EVENT_STAT_SCALE));
      summary.push(`${STAT_NAMES[stat]}+${player.gainStat(stat, applyGrowth(scaled, player.traits, stat))}`);
    } else {
      player[stat] = Math.max(1, player[stat] + amount);
      summary.push(`${STAT_NAMES[stat]}${amount}`);
    }
  }

  if ("hp_pct" in effects || "qi_pct" in effects) {
    const [hp, qi] = player.healPercent(effects.hp_pct || 0, effects.qi_pct || 0);
    if (hp) summary.push(`체력${signed(hp)}`);
    if (qi) summary.push(`기력${signed(qi)}`);
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
    if (rank) summary.push(`강호에서 「${rank}」로 불리기 시작했다`);
  }

  if ("injury" in effects) {
    player.addInjury(effects.injury);
    summary.push(`내상${signed(effects.injury)}`);
  }

  if (effects.join_sect) {
    player.sect = effects.join_sect;
    summary.push(`「${DB.sects[player.sect].name}」 입문`);
  }

  if (effects.mastery) {
    const skill = player.bestSkill();
    if (skill) {
      const messages = skill.gainMastery(effects.mastery);
      summary.push(`${skill.name} 숙련도+${effects.mastery}`, ...messages);
    }
  }

  if (effects.skill) {
    const skill = new Skill(effects.skill);
    const known = player.hasSkill(skill.key);
    const messages = player.learnSkill(skill);
    if (!known) summary.push(`📕 새 무공 「${skill.name}」`);
    summary.push(...messages);
  }

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
      if (!STAT_NAMES[stat]) errors.push(`${where}: 없는 능력치 ${stat}`);
    }
    for (const name of Object.keys(effects.alignment || {})) {
      if (!ALIGNMENTS.includes(name)) errors.push(`${where}: 없는 성향 ${name}`);
    }
  };
  for (const [key, event] of Object.entries(DB.events)) {
    for (const choice of event.choices) {
      for (const outcome of choice.outcomes) checkEffects(key, outcome.effects || {});
    }
  }
  DB.fortunes.forEach((fortune, i) => checkEffects(`기연 ${i}`, fortune.effects));
  return errors;
}
