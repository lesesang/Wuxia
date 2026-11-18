// 그림 고르기. 어떤 화면에 어떤 그림을 쓸지는 data/art.json(tools/art/build_art.py가 만든다)을 따른다.
import { DB } from "./data.js";
import { storage } from "./storage.js";

const KEY = "wuxia-art";
export const artOn = () => storage.get(KEY) !== "off";
export const setArt = (on) => storage.set(KEY, on ? "on" : "off");

const path = (p) => (p ? `img/${encodeURI(p)}.webp` : null);
const art = () => DB.art || {};

/** 주인공의 초상. 출신과 성별을 따른다 */
export function portraitOf(origin, gender) {
  if (!artOn() || !origin) return null;
  return path(`p/${origin}_${gender === "여" || gender === "녀" ? "녀" : "남"}`);
}

/** 전투 상대의 그림. 사건만의 상대는 그 이름으로, 아니면 적의 키로 찾는다 */
export function enemyArt(enemy) {
  if (!artOn() || !enemy) return null;
  return path(art().foe?.[enemy.name] || art().enemy?.[enemy.key]);
}

export function companionArt(key) {
  return artOn() ? path(art().companion?.[key]) : null;
}

const hit = (text, words) => words.some((w) => text.includes(w));

/** 사건의 배경. 제목에서 먼저 찾고, 없으면 글에서 찾는다 */
export function sceneOf(title = "", text = "", fallback = null) {
  if (!artOn()) return null;
  const scenes = art().scene || [];
  const found = scenes.find(([words]) => hit(title, words)) || scenes.find(([words]) => hit(text, words));
  return path(`b/${found ? found[1] : fallback || "고갯길"}`);
}

export function backdrop(name) {
  return artOn() && name ? path(`b/${name}`) : null;
}

/** 이번 달의 배경. 마지막으로 한 일이나 장을 따른다 */
export function turnScene(action, chapter) {
  const name = art().action?.[action] || art().chapter?.[String(chapter)] || "고갯길";
  return backdrop(name);
}

/** 사건 글에 이름이 나오는 사람의 그림. 제목에서 먼저 찾는다. 셋째 칸이 t면 제목에서만 찾는다 */
export function npcOf(title = "", text = "") {
  if (!artOn()) return null;
  const list = art().npc || [];
  const found = list.find(([name]) => title.includes(name)) || list.find(([name, , only]) => only !== "t" && text.includes(name));
  return found ? path(found[1]) : null;
}

/** 그림을 미리 받아 둔다. 다음 화면에서 깜박이지 않게 한다 */
export function preload(...urls) {
  for (const url of urls) if (url) { const img = new Image(); img.src = url; }
}

/** 조연 그림 하나. 이름은 art/조연의 파일 이름이다 */
export const castArt = (name) => (artOn() ? path(`c/${name}`) : null);
