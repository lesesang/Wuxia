// 강호행을 넘어 남는 기록(카르마, 해금, 강화, 유산, 도감)과 달 체크포인트
import { DB } from "./data.js";
import { storage } from "./storage.js";

const LEGEND_KEY = "wuxia-legend";
const SAVE_KEY = "wuxia-save";
const EVENT_LOG_KEY = "wuxia-event-log";
const RUN_HISTORY_LIMIT = 10;
// 게임에서 빠진 출신을 해금했던 기록은 지우고 카르마를 돌려준다
// 이름이 바뀐 출신은 해금을 그대로 옮겨 준다
export const RENAMED_ORIGINS = { 마교탈주: "혈지생환", 소교주: "혈지생환", 신교사자: "혈지생환", 개방후개: "개방제자" };
const REMOVED_ORIGINS = { 곤륜파: 5, 금군교두: 5, 낙방서생: 5, 녹림소채주: 5, 녹림채주: 5, 녹림후계: 5, 당가무사: 5, 당가방계: 5, 당가소주: 5, 대장간자식: 5, 백호대장: 5, 백호무관: 5, 살막살수: 5, 살막탈주: 5, 살문탈주: 5, 세외도객: 5, 소림속가: 5, 소림수제자: 5, 소막주: 5, 악가서자: 5, 악가소장주: 5, 악가전인: 5, 양가서자: 5, 육선문포두: 5, 의원제자: 5, 점소이: 5, 탈영병: 5, 황보막내: 5, 회귀자: 5 };

// 없어진 자질은 산 값을 돌려준다
const REMOVED_TRAITS = { 무골: 5, 기재: 5, 넓은단전: 5, 맑은마음: 5, 맷집: 7, 경공의재능: 4, 줄행랑: 2, 손에익은병기: 6, 약손: 3 };
const SPLIT_UPGRADES = { 근골: ["강골", "혜안"], 심지: ["원기", "명경"] };

const defaults = () => ({
  current_karma: 0, total_karma: 0,
  unlocked_origins: ["무림초출"], unlocked_traits: [],
  global_codex: [], known_skills: [], known_items: [],
  endings_seen: [], runs: [], total_runs: 0,
  upgrades: {}, content: [], content_off: [], legacy_open: false, legacies: [], milestones: [],
  known_events: [], achievements: [], origin_wins: [], total_wins: 0, best_turn: 0,
});

export function loadMeta() {
  const raw = storage.get(LEGEND_KEY);
  if (raw) {
    try {
      const data = JSON.parse(raw);
      if (data && typeof data === "object") return refundRemoved({ ...defaults(), ...data });
    } catch {
      // 손상된 기록은 지우지 않고 옆에 남겨 둔다
      storage.set(`${LEGEND_KEY}-broken`, raw);
    }
  }
  return defaults();
}

function refundRemoved(data) {
  for (const [key, cost] of Object.entries(REMOVED_TRAITS)) {
    if (data.unlocked_traits.includes(key)) {
      data.unlocked_traits = data.unlocked_traits.filter((k) => k !== key);
      data.current_karma += cost;
      storage.set(LEGEND_KEY, JSON.stringify(data));
    }
  }
  // 둘씩 묶여 있던 시작 능력치 강화는 같은 단계의 낱개 강화로 옮긴다
  let moved = false;
  for (const [oldKey, parts] of Object.entries(SPLIT_UPGRADES)) {
    const level = data.upgrades[oldKey];
    if (level) {
      for (const part of parts) data.upgrades[part] = Math.max(data.upgrades[part] || 0, level);
      moved = true;
    }
    if (oldKey in data.upgrades) delete data.upgrades[oldKey];
  }
  if (moved) storage.set(LEGEND_KEY, JSON.stringify(data));
  // 없어진 강화(윤회의 고리)에 쓴 카르마를 돌려준다
  if (data.upgrades.윤회) {
    data.current_karma += [5, 10, 18].slice(0, data.upgrades.윤회).reduce((a, b) => a + b, 0);
    delete data.upgrades.윤회;
    storage.set(LEGEND_KEY, JSON.stringify(data));
  }
  if (data.unlocked_origins.some((k) => RENAMED_ORIGINS[k])) {
    data.unlocked_origins = [...new Set(data.unlocked_origins.map((k) => RENAMED_ORIGINS[k] || k))];
    storage.set(LEGEND_KEY, JSON.stringify(data));
  }
  for (const [key, cost] of Object.entries(REMOVED_ORIGINS)) {
    if (data.unlocked_origins.includes(key)) {
      data.unlocked_origins = data.unlocked_origins.filter((k) => k !== key);
      data.current_karma += cost;
      storage.set(LEGEND_KEY, JSON.stringify(data));
    }
  }
  return data;
}

export const saveMeta = (data) => storage.set(LEGEND_KEY, JSON.stringify(data));

export function addKarma(amount) {
  const data = loadMeta();
  data.current_karma += amount;
  data.total_karma += amount;
  saveMeta(data);
}

function unlock(listName, key, cost) {
  const data = loadMeta();
  if (data[listName].includes(key) || data.current_karma < cost) return false;
  data.current_karma -= cost;
  data[listName].push(key);
  saveMeta(data);
  return true;
}

export function spendKarma(cost) {
  const data = loadMeta();
  if (data.current_karma < cost) return false;
  data.current_karma -= cost;
  saveMeta(data);
  return true;
}

export function upgradeLevel(key, data = loadMeta()) { return data.upgrades[key] || 0; }

/** 기틀을 한 단계 올린다. */
export function buyUpgrade(key) {
  const data = loadMeta();
  const level = data.upgrades[key] || 0;
  const cost = DB.karma.upgrades[key]?.costs[level];
  if (cost === undefined || data.current_karma < cost) return false;
  data.current_karma -= cost;
  data.upgrades[key] = level + 1;
  saveMeta(data);
  return true;
}

/** 강화 단계에 해당하는 숨은 특성 목록 */
export function upgradeTraits(data = loadMeta()) {
  return Object.entries(data.upgrades).flatMap(([key, level]) =>
    Array.from({ length: level }, (_, i) => `환생_${key}_${i + 1}`)).filter((k) => DB.traits[k]);
}

export const extraSlots = (data = loadMeta()) => data.upgrades.그릇 || 0;

/** 누적 카르마로 받은 보상의 숨은 특성 목록 */
export const rewardTraits = (data = loadMeta()) => DB.karma.rewards
  .filter((r) => data.total_karma >= r.at && r.effects.length).map((r) => `누적_${r.at}`);

export const nextReward = (data = loadMeta()) => DB.karma.rewards.find((r) => data.total_karma < r.at) || null;

export function buyContent(key) {
  const data = loadMeta();
  const cost = DB.karma.content[key]?.cost;
  if (cost === undefined || data.content.includes(key) || data.current_karma < cost) return false;
  data.current_karma -= cost;
  data.content.push(key);
  saveMeta(data);
  return true;
}

export function toggleContent(key) {
  const data = loadMeta();
  data.content_off = data.content_off.includes(key)
    ? data.content_off.filter((k) => k !== key) : [...data.content_off, key];
  saveMeta(data);
}

export const activeContent = (data = loadMeta()) => data.content.filter((k) => !data.content_off.includes(k));

// ---------- 전설의 유산 ----------

const WIN_ENDINGS = ["기본", "배드", "생사경"];
export const legacyAvailable = (data = loadMeta()) => data.endings_seen.some((k) => WIN_ENDINGS.includes(k));

export function openLegacy() {
  const data = loadMeta();
  const { cost } = DB.karma.legacy;
  if (data.legacy_open || !legacyAvailable(data) || data.current_karma < cost) return false;
  data.current_karma -= cost;
  data.legacy_open = true;
  saveMeta(data);
  return true;
}

/** 유산을 보관한다. 자리가 차면 가장 오래된 것이 사라진다. */
export function storeLegacy(entry) {
  const data = loadMeta();
  data.legacies = [...data.legacies, entry].slice(-DB.karma.legacy.shelf);
  saveMeta(data);
}

export function takeLegacy(index) {
  const data = loadMeta();
  const [entry] = data.legacies.splice(index, 1);
  saveMeta(data);
  return entry || null;
}

export const unlockOrigin = (key, cost) => unlock("unlocked_origins", key, cost);
export const unlockTrait = (key, cost) => unlock("unlocked_traits", key, cost);

function addToList(listName, keys) {
  if (!keys.length) return;
  const data = loadMeta();
  const added = [...new Set(keys)].filter((k) => !data[listName].includes(k));
  if (added.length) {
    data[listName].push(...added);
    saveMeta(data);
  }
}

export const updateGlobalCodex = (keys) => addToList("global_codex", keys);

export function updateKnown(skillKeys = [], itemKeys = [], eventKeys = []) {
  addToList("known_skills", skillKeys);
  addToList("known_items", itemKeys);
  addToList("known_events", eventKeys);
}

// 사건 기록은 커질 수 있어 따로 저장한다. 매번 읽고 쓰지 않도록 메모리에 들고 있는다.
let eventLogCache = null;

export function loadEventLog() {
  if (eventLogCache) return eventLogCache;
  try {
    eventLogCache = JSON.parse(storage.get(EVENT_LOG_KEY) || "{}") || {};
  } catch {
    eventLogCache = {};
  }
  return eventLogCache;
}

/** 사건에서 본 본문과 고른 선택, 그 결과를 강호록에 남긴다. 새로운 것이 있을 때만 쓴다. */
export function recordEventPick(key, text, label, outcome) {
  const log = loadEventLog();
  const entry = log[key] || { texts: [], picks: {} };
  const results = entry.picks[label] || [];
  if (entry.texts.includes(text) && results.includes(outcome)) return;
  if (!entry.texts.includes(text)) entry.texts.push(text);
  if (!results.includes(outcome)) results.push(outcome);
  entry.picks[label] = results;
  log[key] = entry;
  storage.set(EVENT_LOG_KEY, JSON.stringify(log));
}

/** 강호행 끝에 새로 이룬 업적을 기록하고 돌려준다. */
export function claimAchievements(player, ending, victory) {
  const data = loadMeta();
  if (victory && !data.origin_wins.includes(player.originKey)) data.origin_wins.push(player.originKey);
  const fresh = DB.karma.achievements.filter((a) => !data.achievements.includes(a.key) && achievementMet(a, player, ending, victory, data));
  data.achievements.push(...fresh.map((a) => a.key));
  saveMeta(data);
  return fresh;
}

function achievementMet(a, p, ending, victory, data) {
  const visibleTraits = p.traits.filter((k) => !DB.traits[k]?.hidden);
  const attacks = p.skills.filter((s) => s.type === "공격무공").length;
  switch (a.type) {
    case "win": return victory;
    case "win_plain": return victory && !visibleTraits.length;
    case "ending": return ending === a.value;
    case "kills": return p.kills >= a.value;
    case "fame": return p.fame >= a.value;
    case "sect": return !!p.sect;
    case "chains": return p.chainsDone >= a.value;
    case "attacks": return attacks >= a.value;
    case "legend": return p.skills.some((s) => DB.skills[s.key].legend || s.grade === "신공");
    case "origins": return data.origin_wins.length >= a.value;
    case "runs": return data.total_runs + 1 >= a.value;
    case "silver": return p.silver >= a.value;
    case "events": return data.known_events.length >= a.value;
    default: return false;
  }
}

export function recordRun(summary) {
  const data = loadMeta();
  data.total_runs += 1;
  if (WIN_ENDINGS.includes(summary.ending)) data.total_wins = (data.total_wins || 0) + 1;
  data.best_turn = Math.max(data.best_turn || 0, summary.turn || 0);
  data.runs = [summary, ...data.runs].slice(0, RUN_HISTORY_LIMIT);
  if (!data.endings_seen.includes(summary.ending)) data.endings_seen.push(summary.ending);
  saveMeta(data);
}

// ---------- 달 체크포인트 ----------

export const saveCheckpoint = (playerDict, log) =>
  storage.set(SAVE_KEY, JSON.stringify({ player: playerDict, log }));

export function loadCheckpoint() {
  const raw = storage.get(SAVE_KEY);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    return data && data.player ? data : null;
  } catch {
    return null;
  }
}

export const clearCheckpoint = () => storage.remove(SAVE_KEY);

// ---------- 기록 내보내기와 가져오기 ----------

export function exportRecords() {
  return JSON.stringify({ format: "wuxia-records", version: 1, legend: loadMeta(), save: loadCheckpoint(), event_log: loadEventLog() }, null, 2);
}

/** 내보낸 파일과 예전 PC 버전의 legend_data.json을 모두 받는다. 성공하면 true */
export function importRecords(text) {
  let data;
  try { data = JSON.parse(text); } catch { return false; }
  const legend = data?.format === "wuxia-records" ? data.legend : data;
  if (!legend || typeof legend.current_karma !== "number" || typeof legend.total_karma !== "number") return false;
  const merged = { ...defaults(), ...legend };
  for (const key of ["unlocked_origins", "unlocked_traits", "global_codex", "known_skills", "known_items", "endings_seen", "runs", "content", "content_off", "legacies", "milestones", "known_events", "achievements", "origin_wins"]) {
    if (!Array.isArray(merged[key])) merged[key] = defaults()[key];
  }
  saveMeta(merged);
  const log = data?.event_log;
  eventLogCache = log && typeof log === "object" && !Array.isArray(log) ? log : {};
  storage.set(EVENT_LOG_KEY, JSON.stringify(eventLogCache));
  if (data?.format === "wuxia-records" && data.save?.player) storage.set(SAVE_KEY, JSON.stringify(data.save));
  return true;
}
