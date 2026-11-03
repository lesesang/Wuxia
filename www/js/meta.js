// 생을 넘어 남는 기록(공덕, 개방, 도감)과 달 체크포인트
import { storage } from "./storage.js";

const LEGEND_KEY = "wuxia-legend";
const SAVE_KEY = "wuxia-save";
const RUN_HISTORY_LIMIT = 10;

const defaults = () => ({
  current_karma: 0, total_karma: 0,
  unlocked_origins: ["무림초출"], unlocked_traits: [],
  global_codex: [], known_skills: [], known_items: [],
  endings_seen: [], runs: [], total_runs: 0,
});

export function loadMeta() {
  const raw = storage.get(LEGEND_KEY);
  if (raw) {
    try {
      const data = JSON.parse(raw);
      if (data && typeof data === "object") return { ...defaults(), ...data };
    } catch {
      // 손상된 기록은 지우지 않고 옆에 남겨 둔다
      storage.set(`${LEGEND_KEY}-broken`, raw);
    }
  }
  return defaults();
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

export function updateKnown(skillKeys = [], itemKeys = []) {
  addToList("known_skills", skillKeys);
  addToList("known_items", itemKeys);
}

export function recordRun(summary) {
  const data = loadMeta();
  data.total_runs += 1;
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
  return JSON.stringify({ format: "wuxia-records", version: 1, legend: loadMeta(), save: loadCheckpoint() }, null, 2);
}

/** 내보낸 파일과 예전 PC 버전의 legend_data.json을 모두 받는다. 성공하면 true */
export function importRecords(text) {
  let data;
  try { data = JSON.parse(text); } catch { return false; }
  const legend = data?.format === "wuxia-records" ? data.legend : data;
  if (!legend || typeof legend.current_karma !== "number" || typeof legend.total_karma !== "number") return false;
  const merged = { ...defaults(), ...legend };
  for (const key of ["unlocked_origins", "unlocked_traits", "global_codex", "known_skills", "known_items", "endings_seen", "runs"]) {
    if (!Array.isArray(merged[key])) merged[key] = defaults()[key];
  }
  saveMeta(merged);
  if (data?.format === "wuxia-records" && data.save?.player) storage.set(SAVE_KEY, JSON.stringify(data.save));
  return true;
}
