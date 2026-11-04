// 화면 그리기와 입력 처리. 게임 규칙은 game.js에 있고 여기서는 보여 주기만 한다.
import { getVolume, setMood, setVolume } from "./audio.js";
import { INJURY_PENALTY } from "./battle.js";
import { DB } from "./data.js";
import { eventView } from "./events.js";
import { Game } from "./game.js";
import { bonusFor, equipmentBonus, itemName, stockView } from "./market.js";
import {
  buyContent, buyProvision, buyUpgrade, exportRecords, extraSlots, importRecords, legacyAvailable, loadCheckpoint, loadEventLog, loadMeta, nextReward, openLegacy, refundProvision, setUpgradeUse, upgradeUse,
  toggleContent, unlockOrigin, unlockTrait, upgradeLevel,
} from "./meta.js";
import {
  ALIGNMENTS, benefitText, byname, fameRank, getChapterInfo, getMonth, getYear, marketTurns, nextSlotThreshold,
  ORIGIN_SECTS, realmProgress, traitSlots,
} from "./rules.js";
import { MAX_TURN } from "./character.js";
import { storage } from "./storage.js";
import { josa } from "./josa.js";

const game = new Game();
const ui = {
  screen: "title", setupTab: "origin", origin: "무림초출", traits: new Set(),
  traitFilter: "전체", codexQuery: "", codexFilter: "전체", codexRead: null, legacy: null, shopTab: "origin", shopFrom: "title", modal: null, tab: "enemies", statusTab: "stats", notice: null, lastTyped: "", bars: null,
};
let installPrompt = null;
const app = () => document.getElementById("app");

const esc = (value) => String(value ?? "").replace(/[&<>"']/g,
  (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const TIER_NAMES = { 일반: "일반", 난적: "난적", 강적: "강적", 보스: "마두" };
const percent = (part, whole) => Math.min(100, Math.trunc(part / whole * 100));

// ---------- 공통 조각 ----------

function modalShell(id, title, body) {
  return `<div class="modal-overlay${ui.modal === id ? " open" : ""}" id="${id}" role="dialog" aria-label="${esc(title)}">
    <div class="modal-box">
      <div class="modal-head"><h3>${esc(title)}</h3><button class="modal-close" data-act="close-modal" aria-label="닫기">✕</button></div>
      ${body}
    </div></div>`;
}

// ---------- 강호록 ----------

const GRADE_LIST = ["기본", "명품", "상승", "일절", "신공"];

/** 사건의 갈래 이름. 분류와 표시에 함께 쓴다. */
function eventKind(e) {
  if (e.chain) return "이어지는 인연";
  if (e.kind === "story" || e.kind === "final") return "줄거리";
  if (e.requires?.unlocked) return "카르마 인연";
  if (e.requires?.origin) return "출신 이야기";
  if (e.requires?.sect || e.requires?.no_sect) return "사문";
  return "강호 사건";
}

function skillDetail(s) {
  const lines = [];
  if (s.type === "공격무공") {
    lines.push(`위력 ${s.base_multiplier}배, 내력 ${s.qi_cost}`);
    if (s.forms?.length) lines.push(`초식: ${s.forms.join(", ")}`);
    if (s.secret_technique) lines.push(`비기 「${s.secret_technique.name}」: ${s.secret_technique.unlock_grade} 품계, 성취 ${s.secret_technique.unlock_mastery}, 위력 ${s.secret_technique.multiplier}배, 내력 ${s.secret_technique.qi_cost}`);
  } else if (s.type === "심공") {
    const e = s.effect;
    lines.push(`체력 ${e.heal_hp_pct}%, 내력 ${e.heal_qi_pct}% 회복${e.atk_buff_pct ? `, ${e.buff_rounds}합 동안 위력 +${e.atk_buff_pct}%` : ""}`);
  } else {
    const e = s.effect;
    lines.push(`회피 ${e.evade}%, 다음 공격 +${e.counter_pct}%, 도주 +${e.flee_bonus}%, 내력 ${s.qi_cost}`);
  }
  if (s.origin) lines.push(`${DB.origins.origins[s.origin].name} 전용`);
  return lines;
}

function enemyDetail(e) {
  const lines = [`체력 ${e.hp}, 위력 ${e.attack}${e.armor ? `, 방어 ${e.armor}` : ""}`];
  if (e.specials?.length) lines.push(`필살기: ${e.specials.map((x) => x.name).join(", ")}`);
  if (e.chapters?.length) lines.push(`나오는 곳: ${e.chapters.join(", ")}장`);
  return lines;
}

/** 탭마다 줄 목록과 분류 이름을 만든다. */
function codexRows(tab, meta) {
  if (tab === "enemies") {
    return {
      total: Object.keys(DB.enemies).length, filterLabel: "갈래", filters: ["일반", "난적", "강적", "마두"], empty: "적을 만나면 다음 달에 이곳에 기록됩니다.",
      rows: meta.global_codex.filter((k) => DB.enemies[k]).map((k) => {
        const e = DB.enemies[k];
        const tier = TIER_NAMES[e.tier] || e.tier;
        return { key: k, name: e.name, meta: `${tier}, ${e.realm} 경지`, desc: e.desc, more: enemyDetail(e), cats: [tier] };
      }),
    };
  }
  if (tab === "skills") {
    const cats = [...new Set(Object.values(DB.skills).map((s) => s.category))];
    return {
      total: Object.keys(DB.skills).length, filterLabel: "갈래", filters: [...cats, ...GRADE_LIST], empty: "무공을 익히면 이곳에 기록됩니다.",
      rows: meta.known_skills.filter((k) => DB.skills[k]).map((k) => {
        const s = DB.skills[k];
        return { key: k, name: s.name, meta: `${s.category}, ${s.grade} 품계`, desc: s.desc, more: skillDetail(s), cats: [s.category, s.grade] };
      }),
    };
  }
  if (tab === "items") {
    const cats = [...new Set(Object.values(DB.market).map((i) => categoryName(i.category)))];
    return {
      total: Object.keys(DB.market).length, filterLabel: "종류", filters: cats, empty: "장터에서 물건을 사면 이곳에 기록됩니다.",
      rows: meta.known_items.filter((k) => DB.market[k]).map((k) => {
        const i = DB.market[k];
        return { key: k, name: i.name, meta: categoryName(i.category), desc: i.desc, cats: [categoryName(i.category)] };
      }),
    };
  }
  if (tab === "events") {
    const kinds = ["줄거리", "강호 사건", "출신 이야기", "사문", "이어지는 인연", "카르마 인연"];
    return {
      total: Object.keys(DB.events).length, filterLabel: "갈래", filters: kinds, empty: "강호에서 겪은 사건이 이곳에 기록됩니다.",
      rows: meta.known_events.filter((k) => DB.events[k]).map((k) => {
        const e = DB.events[k];
        const kind = eventKind(e);
        const log = loadEventLog()[k];
        const picks = log ? Object.keys(log.picks).length : 0;
        const label = e.chain ? `${kind}, 「${DB.chains[e.chain.id].title}」 ${e.chain.index + 1}/${e.chain.total}편` : kind;
        return { key: k, name: e.title, meta: `${label}${picks ? `, 고른 선택 ${picks}가지` : ""}`, desc: e.text.split(/(?<=[.?!"])\s/)[0], read: true, cats: [kind], search: `${e.text} ${log ? JSON.stringify(log) : ""}` };
      }),
    };
  }
  if (tab === "achievements") {
    return {
      total: DB.karma.achievements.filter((a) => !a.hidden).length, filterLabel: "상태", filters: ["이룸", "아직"], empty: "",
      rows: DB.karma.achievements.filter((a) => !a.hidden || meta.achievements.includes(a.key)).map((a) => {
        const done = meta.achievements.includes(a.key);
        return { key: a.key, name: `${done ? "✓ " : ""}${a.name}`, meta: a.karma ? `카르마 +${a.karma}` : "", desc: a.desc, cats: [done ? "이룸" : "아직"] };
      }),
    };
  }
  if (tab === "endings") {
    return {
      total: Object.keys(DB.endings.titles).length - 1, filterLabel: "", filters: [], empty: "",
      rows: Object.keys(DB.endings.titles).filter((k) => k !== "생사경" || meta.endings_seen.includes(k)).map((k) => {
        const seen = meta.endings_seen.includes(k);
        return { key: k, name: seen ? DB.endings.titles[k] : "아직 보지 못한 결말", meta: k === "사망" ? "도달한 장만큼 카르마" : `카르마 +${DB.endings.karma[k]}`, desc: seen ? DB.endings.text[k] : "", cats: [] };
      }),
    };
  }
  return {
    total: meta.total_runs, filterLabel: "", filters: [], empty: "강호행을 끝내면 이곳에 기록됩니다.",
    note: `끝낸 강호행 ${meta.total_runs}회, 천마 격파 ${meta.total_wins || 0}회, 가장 오래 간 달 ${meta.best_turn || 0}달`,
    rows: meta.runs.map((r, i) => ({ key: i, name: DB.endings.titles[r.ending] || r.ending, meta: `${r.origin}, ${r.realm}, ${r.title}`, desc: `${r.turn}달까지 진행, ${r.kills}명 처치`, cats: [] })),
  };
}

function codexRowHtml(row) {
  const more = row.more ? `<details class="codex-more"><summary>자세히</summary>${row.more.map((l) => `<p>${esc(l)}</p>`).join("")}</details>` : "";
  const read = row.read ? `<button class="mini-btn codex-read" data-act="codex-read" data-key="${esc(row.key)}">다시 읽기</button>` : "";
  return `<div class="codex-item"><div class="codex-name">${esc(row.name)}</div><div class="codex-meta">${esc(row.meta)}</div>${row.desc ? `<div>${esc(row.desc)}</div>` : ""}${more}${read}</div>`;
}

function codexListHtml(data) {
  const query = ui.codexQuery.trim().toLowerCase();
  const rows = data.rows.filter((r) => (ui.codexFilter === "전체" || r.cats.includes(ui.codexFilter))
    && (!query || `${r.name} ${r.meta} ${r.desc || ""} ${r.search || ""} ${(r.more || []).join(" ")}`.toLowerCase().includes(query)));
  if (!data.rows.length) return `<p class="codex-empty">${data.empty}</p>`;
  if (!rows.length) return `<p class="codex-empty">찾는 기록이 없습니다.</p>`;
  return `<p class="codex-count">${rows.length}개</p>${rows.map(codexRowHtml).join("")}`;
}

/** 한 사건에서 본 모든 문장과 고른 선택의 결과를 다시 읽는다. */
function codexReader(key) {
  const e = DB.events[key];
  const log = loadEventLog()[key];
  const texts = log?.texts?.length ? log.texts : [e.text];
  const picks = log ? Object.entries(log.picks) : [];
  const allChoices = new Set([...e.choices, ...(e.variants || []).flatMap((v) => v.choices || [])].map((c) => c.label));
  const left = [...allChoices].filter((l) => !log?.picks[l]).length;
  return `<button class="mini-btn" data-act="codex-back">← 목록으로</button>
    <h4 class="codex-title">${esc(e.title)}</h4>
    <p class="codex-meta">${esc(eventKind(e))}${e.chain ? `, 「${esc(DB.chains[e.chain.id].title)}」 ${e.chain.index + 1}/${e.chain.total}편` : ""}</p>
    ${texts.map((t) => `<p class="codex-body-text">${esc(t)}</p>`).join("")}
    ${picks.length ? picks.map(([label, results]) => `<div class="codex-pick"><div class="codex-pick-label">▸ ${esc(label)}</div>${results.map((r) => `<p>${esc(r)}</p>`).join("")}</div>`).join("") : `<p class="codex-empty">이 사건의 선택은 아직 기록되지 않았습니다. 다시 겪으면 이곳에 남습니다.</p>`}
    ${left ? `<p class="codex-meta">아직 고르지 않은 선택 ${left}가지가 더 있습니다.</p>` : `<p class="codex-meta">이 사건의 선택을 모두 보았습니다.</p>`}`;
}

function codexBody() {
  if (ui.codexRead && DB.events[ui.codexRead]) return codexReader(ui.codexRead);
  const meta = loadMeta();
  const titles = { enemies: "인물", skills: "무공", items: "물건", events: "사건", achievements: "공적", endings: "결말", runs: "강호행" };
  const data = codexRows(ui.tab, meta);
  const tabCount = (key) => {
    if (key === "enemies") return `${meta.global_codex.filter((k) => DB.enemies[k]).length}/${Object.keys(DB.enemies).length}`;
    if (key === "skills") return `${meta.known_skills.filter((k) => DB.skills[k]).length}/${Object.keys(DB.skills).length}`;
    if (key === "items") return `${meta.known_items.filter((k) => DB.market[k]).length}/${Object.keys(DB.market).length}`;
    if (key === "events") return `${meta.known_events.filter((k) => DB.events[k]).length}/${Object.keys(DB.events).length}`;
    if (key === "achievements") return `${meta.achievements.length}`;
    return "";
  };
  const searchable = !["endings", "runs"].includes(ui.tab);
  return `<div class="tabs codex-tabs">${Object.entries(titles).map(([key, label]) => `<button class="tab-btn${ui.tab === key ? " active" : ""}" data-act="tab" data-tab="${key}">${esc(label)} ${tabCount(key)}</button>`).join("")}</div>
    ${data.note ? `<p class="codex-meta">${esc(data.note)}</p>` : ""}
    ${searchable ? `<div class="codex-tools"><input type="search" id="codex-search" class="codex-search" placeholder="이름이나 문장으로 찾기" value="${esc(ui.codexQuery)}" aria-label="강호록 찾기">
      ${data.filters.length ? `<select id="codex-filter" class="codex-select" aria-label="${esc(data.filterLabel)}"><option value="전체">${esc(data.filterLabel)} 전체</option>${data.filters.map((f) => `<option value="${esc(f)}" ${ui.codexFilter === f ? "selected" : ""}>${esc(f)}</option>`).join("")}</select>` : ""}</div>` : ""}
    <div class="codex-list tab-panel active">${codexListHtml(data)}</div>`;
}

/** 강호록은 열 때만 그린다. 창이 닫혀 있으면 내용을 만들지 않는다. */
function codexModal() {
  return modalShell("codex-modal", "강호록", `<div class="codex-body">${ui.modal === "codex-modal" ? codexBody() : ""}</div>`);
}

function refreshCodex() {
  const body = document.querySelector("#codex-modal .codex-body");
  if (body) body.innerHTML = codexBody();
}

function refreshCodexList() {
  const list = document.querySelector("#codex-modal .codex-list");
  if (list) list.innerHTML = codexListHtml(codexRows(ui.tab, loadMeta()));
}

function helpModal() {
  const section = (title, lines) => `<div class="modal-section"><h4>${title}</h4>${lines.map((l) => `<p class="help-line">${l}</p>`).join("")}</div>`;
  return modalShell("help-modal", "강호 입문서", `
    ${section("목표", ["10년(120달) 뒤 겨울, 천마봉에서 천마를 쓰러뜨립니다.", "처음에는 어렵습니다. 죽어도 카르마가 남고, 멀리 갈수록 많이 받습니다.", "카르마로 출신과 자질, 항상 적용되는 기틀, 새 인연을 얻을 수 있습니다. 쌓인 카르마가 늘면 누적 보상도 저절로 받습니다. 채비는 다음 강호행 한 번에만 쓰는 값싼 준비물입니다. 천마를 한 번 쓰러뜨리면 전설의 유산도 열 수 있습니다."])}
    ${section("매달 하는 일", [
    "<b>탐색</b>: 강호를 떠돌며 전투, 사건, 기연 중 하나를 만납니다. 가장 크게 성장하지만 위험합니다.",
    "<b>수련</b>: 외공과 무리, 주무공 성취가 오릅니다. 대련으로 실전 경험을 얻기도 합니다.",
    "<b>운기</b>: 내공과 심경이 오르고 내력을 되찾습니다. 초식을 깨치기도 합니다.",
    "<b>요양</b>: 체력과 내력을 채우고 내상을 치료합니다. 싸우기 전에 몸을 챙기세요."])}
    ${section("경지", ["기량과 <b>실전 경험</b>이 함께 차야 돌파합니다. 위쪽 띠에서 남은 조건을 볼 수 있습니다.", "경지가 오르면 주는 피해가 크게 늘고 받는 피해가 줄어듭니다."])}
    ${section("전투", [
    "무공은 내력을 씁니다. 내력이 없으면 맨손으로 싸웁니다.",
    "적의 필살기는 한 합 전에 ⚠️로 예고됩니다. <b>경공</b>으로 흘려내면 다음 공격이 강해집니다.",
    "<b>심법</b>은 숨을 고르며 회복하고 점혈을 풉니다. 위험하면 <b>도주</b>도 방법입니다.",
    "내상은 전투가 끝나도 남고 주는 피해를 줄입니다."])}
    ${section("장터와 성장", ["매년 말 장터가 열리고 달을 쓰지 않습니다. 더 나은 병기와 호신구가 항상 진열되고, 익힌 무공과 맞는 물건이 더 자주 나옵니다.", "도구는 계열이 맞으면 제 효과를 내고 맞지 않으면 절반입니다. 수련 도구는 언제든, 전투 도구는 전투 중에 씁니다.", "같은 계열 무공의 성취는 품계가 같으면 절반, 낮으면 3할을 주무공으로 옮길 수 있습니다. 신상의 무공 칸에서 합니다.", "새해가 밝으면 체력과 내력이 가득 차고 내상이 낫습니다.", "무공은 성취 100을 넘겨 더 쌓으면 다음 품계로 승급합니다. 일절이 승급의 끝입니다. 신공은 출신의 이야기나 카르마로 연 인연에서만 얻습니다.", "병기는 주무공과 계열이 맞아야 제 힘을 냅니다. 맞지 않으면 3/4만 나옵니다.", "사건의 선택으로 정도, 사도, 마도 성향이 최대 999까지 쌓입니다. 60, 250, 500, 750, 950에서 단계가 오르며 혜택이 커지고, 사람들의 대접과 사건, 결말이 달라집니다. 가장 앞선 길은 두 배로 오르고, 한 길에 집중하면 달마다 저절로 깊어집니다."])}
    ${section("카르마를 얻는 길", [
    "<b>도달한 장</b>: 천마까지 가지 못하고 끝나면 1장 +1부터 5장 +5까지 받습니다. 천마에게 져도 +5입니다.",
    `<b>결말</b>: 천마까지 가면 장 대신 받습니다. ${Object.entries(DB.endings.karma).filter(([k]) => !["생사경", "사망"].includes(k)).map(([k, v]) => `${esc(DB.endings.titles[k])} +${v}`).join(", ")}`,
    "<b>경지</b>: 어느 쪽이든 오른 경지에 따라 더 받습니다. 절정 +1, 초절정 +2, 화경 +3, 현경 +4",
    "<b>공적</b>: 처음 이룰 때 한 번 더 받습니다. 강호록의 공적 칸에서 볼 수 있습니다.",
    "카르마는 써도 누적은 줄지 않고, 누적 보상을 다 받은 뒤에도 계속 쌓입니다."])}
    ${section("생사경", [
    "현경 너머의 숨은 경지이자 가장 높은 결말입니다. 돌파로는 오르지 못하고, 천마를 쓰러뜨린 바로 그 순간에만 판가름 납니다.",
    "네 기량이 끝에 가깝고 실전이 충분히 쌓인 무인이, 체력과 내력을 넉넉히 남긴 채 천마를 넘어서면 이릅니다. 카르마는 모두 25를 받습니다."])}
    ${section("겹쳐 받을 때", ["자질, 기틀, 채비, 누적 보상에서 받는 시작 병기와 갑의는 겹칠수록 한 단계씩 좋아지고, 끝을 넘으면 은자로 돌아옵니다. 같은 비급과 무공이 겹치면 성취가 됩니다."])}
    ${section("저장", ["매달 초 자동으로 저장됩니다. 도중에 끄면 그달의 처음부터 이어 합니다."])}
    <label class="guide-off"><input type="checkbox" id="guide-off" class="toggle" ${storage.get("wuxia-show-guide") === "off" ? "checked" : ""}> 강호행을 시작할 때 이 안내문을 보지 않기</label>`);
}

function settingsModal() {
  const speed = storage.get("wuxia-speed") ?? "18";
  const font = storage.get("wuxia-font") ?? "normal";
  const option = (value, label, current) => `<option value="${value}"${value === current ? " selected" : ""}>${label}</option>`;
  return modalShell("settings-modal", "설정", `
    <div class="setting-row"><label for="set-volume">배경 음악</label>
      <input type="range" id="set-volume" min="0" max="100" step="5" value="${getVolume()}"></div>
    <div class="setting-row"><label for="set-speed">글자 나오는 속도</label>
      <select id="set-speed">${option("0", "바로 표시", speed)}${option("35", "느리게", speed)}${option("18", "보통", speed)}${option("7", "빠르게", speed)}</select></div>
    <div class="setting-row"><label for="set-font">글자 크기</label>
      <select id="set-font">${option("small", "작게", font)}${option("normal", "보통", font)}${option("large", "크게", font)}</select></div>
    <div class="setting-row"><span>언어</span><span class="muted">한국어</span></div>
    ${installPrompt ? `<div class="setting-row"><span>앱처럼 쓰기</span><button class="mini-btn" data-act="install">홈 화면에 추가</button></div>` : ""}
    <div class="setting-row"><span>기록 옮기기<br><small class="muted">카르마, 강호록, 진행 중인 달을 파일로</small></span>
      <span class="setting-buttons"><button class="mini-btn" data-act="export">내보내기</button>
      <label class="mini-btn file-btn">가져오기<input type="file" id="import-file" accept=".json,application/json"></label></span></div>
    <div class="setting-row"><label for="set-guide">강호행 시작 때 안내문 보기</label>
      <input type="checkbox" id="set-guide" class="toggle" ${storage.get("wuxia-show-guide") === "off" ? "" : "checked"}></div>
    <div class="setting-row"><span>입문서</span><button class="mini-btn" data-act="open" data-modal="help-modal">보기</button></div>
    ${ui.notice ? `<p class="market-message">${esc(ui.notice)}</p>` : ""}
    ${game.active && game.player.alive ? `<div class="setting-row danger-row"><span>이번 강호행 포기<br><small class="muted">카르마와 강호록은 남습니다</small></span>
      <button class="mini-btn danger-mini" data-act="open" data-modal="reset-modal">포기하기</button></div>` : ""}`);
}

// ---------- 메인 화면 ----------

function renderTitle() {
  document.body.className = "home title-screen";
  setMood("calm");
  const meta = loadMeta();
  const hasSave = loadCheckpoint() !== null;
  const save = hasSave ? loadCheckpoint().player : null;
  app().innerHTML = `<div class="title-wrap">
    <h1 class="title-name">강호행</h1>
    <p class="hero-line">십 년 뒤 겨울, 천마봉에서 누군가 기다린다.<br>그때까지 어떤 무인이 될지는 당신이 정한다.</p>
    <div class="title-actions">
      ${hasSave ? `<button class="start-btn" data-act="continue">이어하기<small>${esc(save.origin)}, ${esc(save.realm)}, ${Math.min(save.turn, MAX_TURN)}달째</small></button>` : ""}
      <button class="${hasSave ? "continue-btn" : "start-btn"}" data-act="setup">새 강호행</button>
    </div>
    <p class="karma-display">💠 카르마 ${meta.current_karma} (누적 ${meta.total_karma})${nextReward(meta) ? `, 다음 누적 보상까지 ${nextReward(meta).at - meta.total_karma}` : ""}</p>
    <div class="title-links">
      <button class="link-btn" data-act="shop">💠 카르마 상점${affordableCount(meta) ? ` (살 수 있는 것 ${affordableCount(meta)})` : ""}</button>
      <button class="link-btn" data-act="open" data-modal="help-modal">❓ 입문서</button>
      <button class="link-btn" data-act="open" data-modal="codex-modal">📖 강호록</button>
      <button class="link-btn" data-act="open" data-modal="settings-modal">⚙️ 설정</button>
    </div>
  </div>
  ${helpModal()}${codexModal()}${settingsModal()}`;
}

function statBars(o) {
  const bar = (label, value) => `<span class="mini-stat"><span>${label}</span><span class="mini-track"><span style="width:${value / 5}%"></span></span><span>${value}</span></span>`;
  return `<span class="mini-stats">${bar("외공", o.external)}${bar("내공", o.internal)}${bar("무리", o.martial)}${bar("심경", o.mind)}</span>`;
}

function originDetail(key) {
  const o = DB.origins.origins[key];
  const skillNames = o.choose_start ? "첫 병기에 맞는 무공과 고른 심법" : o.skills.map((k) => DB.skills[k].name).join(", ");
  const sect = ORIGIN_SECTS[key] ? DB.sects[ORIGIN_SECTS[key]] : null;
  return `<span class="pick-desc block">${esc(o.desc)}</span>${statBars(o)}
    <span class="pick-stats block">시작 무공: ${esc(skillNames)}</span>
    ${sect ? `<span class="pick-stats block">사문: ${esc(sect.name)} (${esc(sect.bonus_text)})</span>` : ""}`;
}

const traitName = (t) => `${esc(t.name)}<span class="rarity rarity-${esc(t.rarity)}">${esc(t.rarity)}</span>`;

const RARITY_ORDER = ["일반", "희귀", "전설"];

/** 자질을 등급별 칸으로 묶어 그린다. 칸 안의 순서는 traits.json의 순서를 따른다. */
function byRarity(keys, row) {
  const common = RARITY_ORDER.map((rarity) => {
    const rows = keys.filter((key) => DB.traits[key].rarity === rarity && !DB.traits[key].origin);
    return rows.length ? `<h4 class="shop-group">${rarity}</h4>${rows.map(row).join("")}` : "";
  }).join("");
  const own = byOrigin(keys.filter((key) => DB.traits[key].origin), (key) => DB.traits[key].origin);
  return common + (own.length ? `<h4 class="shop-group">출신 전용</h4>${own.map(row).join("")}` : "");
}

/** 출신 전용 항목은 출신 차례대로 모은다. 같은 출신끼리는 원래 순서를 지킨다. */
function byOrigin(keys, originOf) {
  const rank = (key) => DB.origins.order.indexOf(originOf(key));
  return [...keys].sort((a, b) => rank(a) - rank(b));
}

function filterRow() {
  return `<div class="filter-row">${["전체", "능력", "물건과 무공", "사건 반응", "출신 전용"].map((r) => `<button class="filter-btn${ui.traitFilter === r ? " on" : ""}" data-act="trait-filter" data-key="${r}">${r}</button>`).join("")}</div>`;
}

const GIFT_EFFECTS = ["start_item", "start_armor", "start_skill", "start_style_weapon", "start_style_tool", "start_battle_tool", "start_style_skill"];

/** 자질의 갈래. 고르는 화면과 상점의 분류에 쓴다. */
function traitKind(t) {
  if (t.origin) return "출신 전용";
  if (t.reacts) return "사건 반응";
  if (t.effects.some((e) => GIFT_EFFECTS.includes(e.type))) return "물건과 무공";
  return "능력";
}

const visibleTraits = (origin = null) => Object.keys(DB.traits).filter((key) => {
  const t = DB.traits[key];
  if (t.hidden || (origin && t.origin && t.origin !== origin)) return false;
  return ui.traitFilter === "전체" || traitKind(t) === ui.traitFilter;
});

const originOnly = (key) => (key ? `<span class="pick-stats block">${esc(DB.origins.origins[key].name)} 전용</span>` : "");

function shopRow(name, desc, act, key, cost, meta, label = "해금") {
  return `<div class="pick-row locked"><div class="pick-main"><div class="pick-name">${name}</div>${desc}</div>
    <button class="unlock-btn" data-act="${act}" data-key="${esc(key)}" ${meta.current_karma < cost ? "disabled" : ""}>💠 ${cost}<br>${label}</button></div>`;
}

const emptyNote = (text) => `<p class="codex-empty">${text}</p>`;

function shopPanels(meta) {
  const origins = DB.origins.order.filter((k) => !meta.unlocked_origins.includes(k))
    .map((k) => shopRow(esc(DB.origins.origins[k].name), originDetail(k), "unlock-origin", k, DB.origins.origins[k].cost, meta)).join("");
  const traits = byRarity(visibleTraits().filter((k) => !meta.unlocked_traits.includes(k)),
    (k) => shopRow(traitName(DB.traits[k]), `<p class="pick-desc">${esc(DB.traits[k].desc)}</p>${originOnly(DB.traits[k].origin)}`, "unlock-trait", k, DB.traits[k].cost, meta));
  const groups = [...new Set(Object.values(DB.karma.upgrades).map((u) => u.group))];
  const upgradeEntries = (g) => {
    const entries = Object.entries(DB.karma.upgrades).filter(([, u]) => u.group === g);
    return g === "출신 전용" ? byOrigin(entries, ([, u]) => u.origin) : entries;
  };
  const upgradeRow = ([key, u]) => {
    const level = upgradeLevel(key, meta);
    const cost = u.costs[level];
    const name = `${esc(u.name)} <span class="rarity">${level}/${u.costs.length}단계</span>`;
    const desc = `<p class="pick-desc">${esc(u.desc)}</p>${originOnly(u.origin)}`;
    if (cost === undefined) return `<div class="pick-row"><div class="pick-main"><div class="pick-name">${name}</div>${desc}</div><span class="pick-stats">다 올림</span></div>`;
    return shopRow(name, desc, "buy-upgrade", key, cost, meta, "올리기");
  };
  const upgrades = groups.map((g) => `<h4 class="shop-group">${esc(g)}</h4>${upgradeEntries(g).map(upgradeRow).join("")}`).join("");
  const contentRow = ([k, c]) => shopRow(esc(c.name), `<p class="pick-desc">${esc(c.desc)}</p>${originOnly(c.origin)}`, "buy-content", k, c.cost, meta);
  const contentLeft = Object.entries(DB.karma.content).filter(([k]) => !meta.content.includes(k));
  const contentOwn = byOrigin(contentLeft.filter(([, c]) => c.origin), ([, c]) => c.origin);
  const content = contentLeft.filter(([, c]) => !c.origin).map(contentRow).join("")
    + (contentOwn.length ? `<h4 class="shop-group">출신 전용</h4>${contentOwn.map(contentRow).join("")}` : "");
  const { cost } = DB.karma.legacy;
  const legacy = meta.legacy_open ? emptyNote("이미 열었습니다. 강호행을 시작할 때 유산을 고를 수 있습니다.")
    : !legacyAvailable(meta) ? emptyNote("천마를 한 번 쓰러뜨리면 살 수 있습니다.")
      : shopRow("전설의 유산", `<p class="pick-desc">강호행이 끝날 때 무공이나 병장기 하나를 남기고, 다음 강호행에서 이어받습니다.</p>`, "open-legacy", "", cost, meta);
  const provisionGroups = [...new Set(Object.values(DB.karma.provisions).map((p) => p.group))];
  const provisionRow = ([key, p]) => {
    const desc = `<p class="pick-desc">${esc(p.desc)}</p>`;
    if (!meta.provisions.includes(key)) return shopRow(esc(p.name), desc, "buy-provision", key, p.cost, meta, "챙기기");
    return `<div class="pick-row"><div class="pick-main"><div class="pick-name">${esc(p.name)} <span class="rarity">챙겨 둠</span></div>${desc}</div>
      <button class="unlock-btn" data-act="refund-provision" data-key="${esc(key)}">💠 ${p.cost}<br>물리기</button></div>`;
  };
  const provisions = provisionGroups.map((g) => `<h4 class="shop-group">${esc(g)}</h4>${Object.entries(DB.karma.provisions).filter(([, p]) => p.group === g).map(provisionRow).join("")}`).join("");
  return {
    provision: `<p class="section-note">채비는 다음 강호행 한 번에만 쓰입니다. 시작할 때 저절로 꺼내 쓰고, 그 전에는 물릴 수 있습니다.</p>${provisions}`,
    origin: origins || emptyNote("모든 출신을 해금했습니다."),
    trait: filterRow() + `<p class="section-note">시작 병기와 갑의, 비급은 자질과 기틀, 채비가 겹치면 더 좋아집니다. 입문서를 보세요.</p>` + (traits || emptyNote("이 갈래의 자질을 모두 해금했습니다.")),
    upgrade: `<p class="section-note">기틀은 장착하지 않아도 모든 강호행에 적용됩니다.</p>${upgrades}`,
    content: `<p class="section-note">해금한 인연은 강호에서 만날 수 있습니다.</p>${content || emptyNote("모든 인연을 해금했습니다.")}`,
    legacy,
    reward: rewardPanel(meta),
  };
}

/** 누적 카르마 보상과 카르마를 얻는 길을 한눈에 보여 준다. */
function rewardPanel(meta) {
  const next = nextReward(meta);
  const last = DB.karma.rewards[DB.karma.rewards.length - 1].at;
  const rows = DB.karma.rewards.map((r) => {
    const done = meta.total_karma >= r.at;
    return `<div class="reward-row${done ? " done" : ""}"><span class="reward-at">${r.at}</span><span class="reward-main"><b>${done ? "✓ " : ""}${esc(r.name)}</b><span class="pick-desc block">${esc(r.desc)}</span></span></div>`;
  }).join("");
  return `<p class="section-note">카르마를 써도 줄지 않는 누적 카르마가 쌓이면 저절로 받습니다. 사거나 장착할 필요가 없습니다.</p>
    <div class="reward-progress"><div class="reward-track"><span style="width:${percent(Math.min(meta.total_karma, last), last)}%"></span></div>
      <p>누적 카르마 <b>${meta.total_karma}</b>${next ? `, 다음 「${esc(next.name)}」까지 ${next.at - meta.total_karma}` : ", 보상은 모두 받았습니다. 카르마는 계속 쌓이고 상점에서 쓸 수 있습니다"}</p></div>
    ${rows}`;
}

function affordableCount(meta) {
  const k = meta.current_karma;
  const origins = DB.origins.order.filter((o) => !meta.unlocked_origins.includes(o) && DB.origins.origins[o].cost <= k).length;
  const traits = Object.keys(DB.traits).filter((t) => !DB.traits[t].hidden && !meta.unlocked_traits.includes(t) && DB.traits[t].cost <= k).length;
  const ups = Object.entries(DB.karma.upgrades).filter(([key, u]) => u.costs[upgradeLevel(key, meta)] <= k).length;
  const content = Object.entries(DB.karma.content).filter(([key, c]) => !meta.content.includes(key) && c.cost <= k).length;
  return origins + traits + ups + content;
}

function renderShop() {
  document.body.className = "home setup-screen";
  setMood("calm");
  const meta = loadMeta();
  const tabs = [["origin", "출신"], ["trait", "자질"], ["upgrade", "기틀"], ["content", "인연"], ["provision", "채비"], ["legacy", "유산"], ["reward", "누적"]];
  app().innerHTML = `<div class="setup-head">
      <button class="back-btn" data-act="shop-back" aria-label="뒤로">←</button>
      <h2>카르마 상점</h2>
      <span class="setup-karma">💠 ${meta.current_karma}</span>
    </div>
    <div class="setup-tabs">${tabs.map(([key, label]) => `<button class="tab-btn${ui.shopTab === key ? " active" : ""}" data-act="shop-tab" data-tab="${key}">${label}</button>`).join("")}</div>
    <div class="home-wrap">${shopPanels(meta)[ui.shopTab]}</div>`;
}

function chosenLegacy(meta) { return ui.legacy === null ? null : meta.legacies[ui.legacy] || null; }

function contentSetup(meta) {
  const rows = meta.content.filter((key) => !DB.karma.content[key].origin || DB.karma.content[key].origin === ui.origin)
    .sort((a, b) => Number(!!DB.karma.content[a].origin) - Number(!!DB.karma.content[b].origin)).map((key) => `<div class="pick-row"><div class="pick-main"><div class="pick-name">${esc(DB.karma.content[key].name)}</div><p class="pick-desc">${esc(DB.karma.content[key].desc)}</p></div>
    <label class="content-toggle"><input type="checkbox" class="toggle" data-content="${esc(key)}" ${meta.content_off.includes(key) ? "" : "checked"}> 등장</label></div>`).join("");
  return rows ? `<p class="section-note">이번에 만나고 싶지 않은 인연은 꺼 둘 수 있습니다.</p>${rows}` : emptyNote("아직 해금한 인연이 없습니다. 카르마 상점에서 살 수 있습니다.");
}

/** 산 기틀 중 이번 강호행에 쓸 단계를 고른다. */
function upgradeSetup(meta) {
  const rows = Object.entries(DB.karma.upgrades)
    .filter(([key, u]) => upgradeLevel(key, meta) > 0 && (!u.origin || u.origin === ui.origin))
    .map(([key, u]) => {
      const level = upgradeLevel(key, meta);
      const use = upgradeUse(key, meta);
      return `<div class="pick-row"><div class="pick-main"><div class="pick-name">${esc(u.name)}</div><p class="pick-desc">${esc(u.desc)}</p></div>
        <div class="step-box"><button class="mini-btn" data-act="upgrade-use" data-key="${esc(key)}" data-level="${use - 1}" ${use <= 0 ? "disabled" : ""} aria-label="내리기">−</button><span class="step-num">${use}/${level}</span><button class="mini-btn" data-act="upgrade-use" data-key="${esc(key)}" data-level="${use + 1}" ${use >= level ? "disabled" : ""} aria-label="올리기">+</button></div></div>`;
    }).join("");
  return rows ? `<p class="section-note">이번에 쓸 단계만 남길 수 있습니다. 내려도 산 단계는 그대로이고 언제든 되돌릴 수 있습니다.</p>${rows}` : emptyNote("아직 올린 기틀이 없습니다. 카르마 상점에서 살 수 있습니다.");
}

function legacySetup(meta) {
  if (!meta.legacy_open) return emptyNote("전설의 유산은 카르마 상점에서 열 수 있습니다.");
  const { shelf } = DB.karma.legacy;
  const rows = meta.legacies.map((l, i) => `<div class="pick-row"><label class="pick-label"><input type="radio" name="legacy" value="${i}" ${ui.legacy === i ? "checked" : ""}>
    <span class="pick-main"><span class="pick-name">${esc(l.label)}</span><span class="pick-desc block">전대 「${esc(l.from)}」, ${esc(l.origin)}</span></span></label></div>`).join("");
  return `<p class="section-note">강호행이 끝날 때 하나를 남깁니다. ${shelf}개까지 보관하고, 이어받으면 사라집니다. 무공은 한 품계 낮아지고 병장기는 낮은 단계로 돌아옵니다.</p>
    ${rows ? `<div class="pick-row"><label class="pick-label"><input type="radio" name="legacy" value="" ${ui.legacy === null ? "checked" : ""}><span class="pick-main"><span class="pick-name">이어받지 않는다</span></span></label></div>${rows}` : emptyNote("아직 남겨 둔 유산이 없습니다.")}`;
}

function renderSetup() {
  document.body.className = "home setup-screen";
  setMood("calm");
  const meta = loadMeta();
  const slots = traitSlots(meta.total_karma) + extraSlots(meta);
  const next = nextSlotThreshold(meta.total_karma);
  const hasSave = loadCheckpoint() !== null;
  ui.traits = new Set([...ui.traits].filter((t) => meta.unlocked_traits.includes(t) && (!DB.traits[t].origin || DB.traits[t].origin === ui.origin)).slice(0, slots));
  if (!meta.unlocked_origins.includes(ui.origin)) ui.origin = "무림초출";

  const origins = DB.origins.order.filter((key) => meta.unlocked_origins.includes(key)).map((key) => `<div class="pick-row"><label class="pick-label"><input type="radio" name="origin" value="${esc(key)}" ${ui.origin === key ? "checked" : ""}>
      <span class="pick-main"><span class="pick-name">${esc(DB.origins.origins[key].name)}${meta.origin_wins.includes(key) ? ` <span class="rarity">천마 격파</span>` : ""}</span>${originDetail(key)}</span></label></div>`).join("");

  const ownedTraits = byRarity(visibleTraits(ui.origin).filter((key) => meta.unlocked_traits.includes(key)),
    (key) => `<div class="pick-row"><label class="pick-label"><input type="checkbox" name="trait" value="${esc(key)}" ${ui.traits.has(key) ? "checked" : ""} ${!ui.traits.has(key) && ui.traits.size >= slots ? "disabled" : ""}>
        <span class="pick-main"><span class="pick-name">${traitName(DB.traits[key])}</span><span class="pick-desc block">${esc(DB.traits[key].desc)}</span></span></label></div>`);
  const traits = ownedTraits || emptyNote("이 갈래에 해금한 자질이 없습니다. 카르마 상점에서 살 수 있습니다.");

  const originName = DB.origins.origins[ui.origin].name;
  app().innerHTML = `<div class="setup-head">
      <button class="back-btn" data-act="title" aria-label="뒤로">←</button>
      <h2>어떤 무인으로 시작할까</h2>
      <button class="shop-link" data-act="shop">💠 ${meta.current_karma} 상점</button>
    </div>
    <div class="setup-tabs">
      <button class="tab-btn${ui.setupTab === "origin" ? " active" : ""}" data-act="setup-tab" data-tab="origin">출신</button>
      <button class="tab-btn${ui.setupTab === "trait" ? " active" : ""}" data-act="setup-tab" data-tab="trait">자질 ${ui.traits.size}/${slots}</button>
      <button class="tab-btn${ui.setupTab === "upgrade" ? " active" : ""}" data-act="setup-tab" data-tab="upgrade">기틀</button>
      <button class="tab-btn${ui.setupTab === "content" ? " active" : ""}" data-act="setup-tab" data-tab="content">인연</button>
      <button class="tab-btn${ui.setupTab === "legacy" ? " active" : ""}" data-act="setup-tab" data-tab="legacy">유산</button>
    </div>
    <div class="home-wrap">
      ${ui.setupTab === "upgrade" ? upgradeSetup(meta) : ui.setupTab === "content" ? contentSetup(meta) : ui.setupTab === "legacy" ? legacySetup(meta) : ui.setupTab === "origin" ? origins : `<p class="section-note">${next ? `자질을 ${slots}개 장착할 수 있습니다. 누적 카르마 ${next}이 되면 하나 더 열립니다. 누적 보상은 상점에서 볼 수 있습니다.` : "자질 칸이 모두 열렸습니다."}</p>${filterRow()}${traits}`}
    </div>
    <div class="setup-bar"><div class="setup-summary">${esc(originName)}${ui.traits.size ? `, 자질 ${ui.traits.size}개` : ""}${chosenLegacy(meta) ? `, 유산 「${esc(chosenLegacy(meta).label)}」` : ""}${meta.provisions.length ? `, 채비 ${meta.provisions.length}개` : ""}</div>
      <button class="start-btn" data-act="${hasSave ? "confirm-start" : "start"}">강호로 나선다</button></div>
    ${modalShell("confirm-start-modal", "새 강호행을 시작할까요?", `
      <p class="modal-text">저장된 진행이 사라집니다. 카르마와 강호록은 남습니다.</p>
      <button class="danger-btn" data-act="start">새로 시작</button>`)}`;
}

// ---------- 게임 화면 ----------

function sidebar() {
  const bag = Object.values(game.player.inventory).reduce((a, b) => a + b, 0);
  return `<div class="sidebar">
    <button data-act="open-status" data-tab="stats">🧍<span class="sb-label">신상</span></button>
    <button data-act="open-status" data-tab="skills">🥋<span class="sb-label">무공</span></button>
    <button data-act="open-status" data-tab="bag">🎒<span class="sb-label">행낭${bag ? ` ${bag}` : ""}</span></button>
    <button data-act="open" data-modal="codex-modal">📖<span class="sb-label">강호록</span></button>
    <button data-act="open" data-modal="settings-modal">⚙️<span class="sb-label">설정</span></button>
  </div>`;
}

function chronicleList(p) {
  return p.chronicle.map((c) => `<div class="chronicle-row"><span class="chronicle-date">${getYear(c.turn)}년차 ${getMonth(c.turn)}월</span><span>${esc(c.text)}</span></div>`).join("");
}

function statusModal() {
  const p = game.player;
  const row = (label, value) => `<div class="stat-row"><span>${esc(label)}</span><span>${esc(value)}</span></div>`;
  const statRow = (name, value, note) => `<div class="stat-line"><span class="stat-name">${name}<small>${note}</small></span>
    <span class="stat-track"><span style="width:${Math.min(value / 10, 100)}%"></span></span><span class="stat-value">${value}</span></div>`;
  const sect = DB.sects[p.sect];
  const progress = realmProgress(p);
  const weapon = itemName(p.weapon);
  const armor = itemName(p.armor);
  const main = p.bestSkill();
  const inventory = Object.entries(p.inventory).filter(([k]) => DB.market[k]);
  const traits = p.traits.map((k) => DB.traits[k]).filter((t) => t && !t.hidden);

  const skills = p.skills.map((s) => {
    const inUse = { 공격무공: main, 심공: p.bestOfType("심공"), 경공: p.bestOfType("경공") }[s.type];
    const isMain = inUse?.key === s.key;
    const names = { 공격무공: "주무공", 심공: "쓰는 심법", 경공: "쓰는 경공" };
    const button = !game.battle
      ? `<button class="mini-btn${isMain ? " on" : ""}" data-act="main-skill" data-key="${esc(s.key)}" ${isMain ? "disabled" : ""}>${isMain ? names[s.type] : `${names[s.type]}으로`}</button>` : "";
    const moved = !game.battle && p.alive ? s.masteryFor(main) : 0;
    const transfer = moved ? `<button class="mini-btn transfer-btn" data-act="transfer-mastery" data-key="${esc(s.key)}">주무공에 성취 +${moved} 옮기기</button>` : "";
    const secret = s.secretName
      ? `<div class="skill-meta">비기 「${esc(s.secretName)}」: ${s.secretUnlocked ? "터득함" : `${esc(s.secretUnlockGrade)} 품계, 성취 ${s.secretUnlockMastery}에 터득`}</div>` : "";
    return `<div class="skill-row"><div class="skill-head"><span>${esc(s.name)} <span class="skill-meta">${esc(s.type === "심공" ? "심법" : s.type)}, ${esc(s.grade)}</span></span>${button}</div>
      <div class="mastery"><span class="stat-track"><span style="width:${s.mastery}%"></span></span><span class="skill-meta">성취 ${s.mastery}${s.mastery >= 100 ? (s.canEvolve() ? ", 다음 성취에 승급" : ", 더 오르지 않음") : ""}</span></div>
      ${secret}<div class="skill-meta">${esc(s.desc)}</div>${transfer}</div>`;
  }).join("") || `<p class="codex-empty">아직 익힌 무공이 없습니다.</p>`;

  const bag = inventory.map(([key, count]) => `<div class="skill-row"><div class="skill-head">
    <span>${esc(DB.market[key].name)} ×${count}<br><span class="skill-meta">${esc(DB.market[key].desc)}</span></span>
    ${!game.battle && p.alive && !DB.market[key].battle_only ? `<button class="mini-btn" data-act="use-item" data-key="${esc(key)}">사용</button>` : ""}</div></div>`).join("")
    || `<p class="codex-empty">장터에서 산 상비약과 도구가 이곳에 들어옵니다.</p>`;

  const panels = {
    stats: `<div class="modal-section">
        ${statRow("외공", p.external, "체력, 위력")}${statRow("내공", p.internal, "내력, 체력, 비기 위력")}
        ${statRow("무리", p.martial, "위력, 명중, 성취")}${statRow("심경", p.mind, "회심의 일격, 받는 피해, 수련, 돌파")}
      </div>
      <div class="modal-section">
        ${row("출신", p.origin)}${row("사문", sect ? `${sect.name} (${sect.bonus_text})` : "없음")}
        ${row("명성", `${p.fame} (${fameRank(p.fame)})`)}
        ${p.injury ? row("내상", `${p.injury}단계, 주는 피해 -${p.injury * INJURY_PENALTY}%, 요양으로 치료`) : ""}
        ${row("실전 경험", `${p.battles} (${p.kills}명 처치)`)}
      </div>
      ${progress ? `<div class="modal-section"><h4>다음 경지: ${esc(progress.next)}</h4>
        ${row("평균 기량", `${progress.avg} / ${progress.avgRequired}`)}
        ${row("최저 기량", `${progress.min} / ${progress.minRequired}`)}
        ${row("실전 경험", `${progress.battles} / ${progress.battlesRequired}`)}</div>` : ""}
      <div class="modal-section"><h4>성향과 별호: ${esc(byname(p))}</h4>
        ${ALIGNMENTS.map((name) => `<div class="align-row"><span>${name}</span><div class="align-track"><div class="a-${name}" style="width:${Math.min(p.alignment[name] / 10, 100)}%"></div></div><span>${p.alignment[name]}</span></div>`).join("")}
        <p class="skill-meta">${esc(benefitText(p.alignment))}</p>
      </div>
      ${traits.length ? `<div class="modal-section"><h4>자질</h4>${traits.map((t) => `<div class="skill-row">${esc(t.name)}<div class="skill-meta">${esc(t.desc)}</div></div>`).join("")}</div>` : ""}`,
    skills: skills,
    history: chronicleList(p) || `<p class="codex-empty">아직 남길 만한 일이 없습니다.</p>`,
    bag: `<div class="modal-section">
        ${row("은자", p.silver)}
        ${row("병기", weapon ? `${weapon} (위력 +${equipmentBonus(p, "weapon")})` : "없음")}
        ${row("호신구", armor ? `${armor} (받는 피해 -${equipmentBonus(p, "armor")})` : "없음")}
      </div><div class="modal-section"><h4>상비약과 도구</h4>${bag}</div>`,
  };
  const tabs = [["stats", "기량"], ["skills", "무공"], ["bag", "행낭"], ["history", "기록"]];
  return modalShell("status-modal", "신상", `
    <div class="tabs">${tabs.map(([key, label]) => `<button class="tab-btn${ui.statusTab === key ? " active" : ""}" data-act="status-tab" data-tab="${key}">${label}</button>`).join("")}</div>
    <div class="tab-panel active">${panels[ui.statusTab]}</div>`);
}

function gameModals() {
  return `${statusModal()}${codexModal()}${settingsModal()}${helpModal()}
  ${modalShell("reset-modal", "이번 강호행을 포기할까요?", `
    <p class="modal-text">이번 강호행의 진행이 사라지고 첫 화면으로 돌아갑니다. 카르마와 강호록은 남습니다.</p>
    <button class="danger-btn" data-act="restart">포기하고 첫 화면으로</button>`)}`;
}

function renderBattle() {
  document.body.className = "in-battle";
  setMood("battle");
  const { player: p, battle: b, gauntlet } = game;
  const skill = p.bestSkill();
  const mindset = p.bestOfType("심공");
  const movement = p.bestOfType("경공");
  const warning = b.nextSpecialWarning();
  const secretReady = skill?.secretUnlocked && p.qi >= skill.secretQiCost && !b.sealed;
  const state = [`제 ${b.roundNum + 1} 합`];
  if (gauntlet) state.push(`${gauntlet.name} ${gauntlet.round}/${gauntlet.total}전`);
  const tags = [];
  if (b.poison) tags.push(["bad", `중독 ${b.poison.rounds}`]);
  if (b.sealed) tags.push(["bad", "혈도 봉쇄"]);
  if (p.injury) tags.push(["bad", `내상 ${p.injury}`]);
  if (b.atkBuff) tags.push(["good", `위력 +${b.atkBuff.percent}%`]);
  if (b.counterPct) tags.push(["good", `반격 +${b.counterPct}%`]);
  if (b.enemyPoison) tags.push(["good", "적 중독"]);
  const lowHp = p.hp < p.maxHp() * 0.3;

  const secretNote = !skill ? "무공 없음"
    : skill.secretUnlocked ? `내력 ${skill.secretQiCost}`
      : `${skill.secretUnlockGrade}, 성취 ${skill.secretUnlockMastery} 터득`;
  const items = Object.entries(p.inventory).filter(([k]) => DB.market[k]);
  const attackNote = !skill ? "내력 소모 없음"
    : b.sealed ? "혈도가 막혀 맨손 공격"
      : p.qi < b.artCost(skill) ? "내력이 모자라 맨손 공격" : `내력 ${b.artCost(skill)}`;

  const actName = b.isFinal ? `천마와의 결전, 제${["일", "이", "삼"][b.enemy.phase] ?? "삼"}막` : "전투";
  const interlude = b.interlude ? `<div class="battle-panel interlude">
      <h2 class="interlude-title">${esc(b.interlude.title)}</h2>
      <p class="interlude-text">${esc(b.interlude.text)}</p>
      ${b.interlude.choices.map((c, i) => `<button class="choice-btn${c.tag ? " special" : ""}" data-act="interlude" data-key="${i}">${c.tag ? `<span class="choice-tag">${esc(c.tag)}</span> ` : ""}${esc(c.label)}</button>`).join("")}
    </div>` : null;
  app().innerHTML = `<div class="battle-top">
      <h1 class="battle-title">${actName}<small>${esc(state.join(", "))}</small></h1>
      <button class="round-menu" data-act="open-status" data-tab="stats" aria-label="신상 보기">🧍</button>
    </div>
    <div class="vs-row">
      <div class="combatant" data-side="player"><div class="name">${esc(p.origin)}</div>
        <div class="hpbar-outer${lowHp ? " danger" : ""}"><div class="hpbar-inner mine" data-bar="player" style="width:${percent(p.hp, p.maxHp())}%"></div></div>
        <div class="hpnum">체력 <b>${p.hp}</b>/${p.maxHp()}</div>
        <div class="qibar"><div style="width:${percent(p.qi, p.maxQi())}%"></div></div>
        <div class="hpnum">내력 ${p.qi}/${p.maxQi()}</div></div>
      <div class="vs-mark">대</div>
      <div class="combatant" data-side="enemy"><div class="name">${esc(b.enemy.name)}</div>
        <div class="hpbar-outer"><div class="hpbar-inner enemy" data-bar="enemy" style="width:${percent(b.enemy.hp, b.enemy.maxHp)}%"></div></div>
        <div class="hpnum">체력 <b>${b.enemy.hp}</b>/${b.enemy.maxHp}</div>
        <div class="enemy-tier">${esc(TIER_NAMES[b.enemy.tier] || b.enemy.tier)}${b.enemy.armor ? `, 방어 ${b.enemy.armor}` : ""}</div></div>
    </div>
    ${tags.length ? `<div class="battle-tags">${tags.map(([kind, label]) => `<span class="tag ${kind}">${esc(label)}</span>`).join("")}</div>` : ""}
    ${warning ? `<p class="battle-warning">⚠️ 다음은 「${esc(warning)}」${movement ? " — 경공으로 흘려낼 수 있다" : ""}</p>` : ""}
    <div class="battle-log" aria-live="polite">${b.roundNum === 0 ? `<p class="enemy-desc">${esc(b.enemy.desc)}</p>` : ""}${game.log.slice(-12).map((l) => `<p>${esc(l)}</p>`).join("")}</div>
    ${interlude ?? `<div class="battle-panel">
      <button class="bt-btn main" data-act="battle" data-action="기본공격">⚔️ ${skill ? esc(skill.name) : "맨손 공격"}<small>${esc(attackNote)}</small></button>
      <div class="battle-actions">
        <button class="bt-btn" data-act="battle" data-action="비기" ${secretReady ? "" : "disabled"}>✨ ${skill?.secretUnlocked ? esc(skill.secretName) : "비기"}<small>${esc(secretNote)}</small></button>
        <button class="bt-btn${b.sealed ? " suggest" : ""}" data-act="battle" data-action="심법" ${mindset ? "" : "disabled"}>🧘 ${mindset ? esc(mindset.name) : "심법"}<small>${mindset ? "회복, 점혈 해제" : "익힌 심법 없음"}</small></button>
        <button class="bt-btn${warning && movement ? " suggest" : ""}" data-act="battle" data-action="경공" ${movement && p.qi >= movement.qiCost ? "" : "disabled"}>💨 ${movement ? esc(movement.name) : "경공"}<small>${movement ? `내력 ${movement.qiCost}, 회피 ${movement.effectValue("evade")}%` : "익힌 경공 없음"}</small></button>
        ${b.isFinal ? "" : `<button class="bt-btn flee" data-act="battle" data-action="도주">🏃 도주<small>실패하면 공격받음</small></button>`}
      </div>
      ${items.length ? `<div class="battle-items">${items.map(([key, count]) => `<button class="item-btn${lowHp && DB.market[key].effects.some((e) => e.type === "heal") ? " suggest" : ""}" data-act="battle" data-action="소비품" data-key="${esc(key)}">${esc(DB.market[key].name)} ×${count}</button>`).join("")}</div>` : ""}
    </div>`}${gameModals()}`;
  const log = document.querySelector(".battle-log");
  if (log) log.scrollTop = log.scrollHeight;
  animateBars(p.hp, p.maxHp(), b.enemy.hp, b.enemy.maxHp, b);
}

/** 체력 막대가 깎이는 모습과 피해 숫자를 보여 준다. */
function animateBars(playerHp, playerMax, enemyHp, enemyMax, battle) {
  const previous = ui.bars?.battle === battle ? ui.bars : null;
  ui.bars = { battle, playerHp, enemyHp };
  if (!previous || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  const apply = (side, before, after, max) => {
    const bar = document.querySelector(`[data-bar="${side}"]`);
    if (!bar || before === after) return;
    const target = bar.style.width;
    bar.style.transition = "none";
    bar.style.width = `${percent(Math.max(before, 0), max)}%`;
    void bar.offsetWidth;
    bar.style.transition = "";
    bar.style.width = target;
    const float = document.createElement("span");
    float.className = `float ${after < before ? "down" : "up"}`;
    float.textContent = after < before ? `-${before - after}` : `+${after - before}`;
    document.querySelector(`[data-side="${side}"]`)?.appendChild(float);
  };
  apply("player", previous.playerHp, playerHp, playerMax);
  apply("enemy", previous.enemyHp, enemyHp, enemyMax);
}

function chainStrip(p) {
  if (!p.chains.length) return "";
  return `<div class="chain-strip">${p.chains.map((c) => {
    const months = Math.max(0, c.due - p.turn);
    return `🔗 ${esc(DB.chains[c.id].title)} ${c.next + 1 > DB.chains[c.id].keys.length ? "" : `${c.next + 1}/${DB.chains[c.id].keys.length}편`} ${months ? `${months}달 뒤` : "이번 달"}`;
  }).join("<br>")}</div>`;
}

function goalStrip() {
  const p = game.player;
  const progress = realmProgress(p);
  if (!progress) return `<div class="goal">천마봉까지 ${Math.max(0, p.maxTurn - p.turn)}개월</div>`;
  const part = (label, now, need) => `<span class="${now >= need ? "done" : ""}">${label} ${now}/${need}</span>`;
  return `<div class="goal"><b>${esc(progress.next)}까지</b>
    ${part("평균", progress.avg, progress.avgRequired)}${part("최저", progress.min, progress.minRequired)}${part("실전 경험", progress.battles, progress.battlesRequired)}</div>`;
}

function topbar() {
  const p = game.player;
  const turn = Math.min(p.turn, p.maxTurn);
  return `<div class="topbar"><div class="topbar-inner">
    <div class="topbar-row1">
      <span class="turn-info">${getYear(turn)}년차 ${getMonth(turn)}월<small>${esc(getChapterInfo(turn).title)}, ${p.turn}/${p.maxTurn}달</small></span>
      <span class="realm-info">${esc(p.realm)}<small>${esc(byname(p))}</small></span>
    </div>
    <div class="turn-track"><span style="width:${percent(turn, p.maxTurn)}%"></span></div>
    <div class="topbar-row2">
      <div class="resource${p.hp < p.maxHp() * 0.35 ? " danger" : ""}"><span class="label">체력</span><div class="bar-track"><div class="bar-fill bar-hp" style="width:${percent(p.hp, p.maxHp())}%"></div></div><span class="num">${p.hp}/${p.maxHp()}</span></div>
      <div class="resource"><span class="label">내력</span><div class="bar-track"><div class="bar-fill bar-qi" style="width:${percent(p.qi, p.maxQi())}%"></div></div><span class="num">${p.qi}/${p.maxQi()}</span></div>
    </div>
    <div class="topbar-stats">
      <span>외공 <b>${p.external}</b></span><span>내공 <b>${p.internal}</b></span>
      <span>무리 <b>${p.martial}</b></span><span>심경 <b>${p.mind}</b></span>
      <span class="silver">은자 <b>${p.silver}</b></span>
      ${p.injury ? `<span class="injury">내상 <b>${p.injury}</b></span>` : ""}
    </div>
    ${p.alive ? goalStrip() + chainStrip(p) : ""}</div></div>`;
}

function legacyPanel() {
  const { ending } = game;
  if (!loadMeta().legacy_open) return "";
  if (ending.legacyLeft) return `<p class="legacy-note">🏺 「${esc(ending.legacyLeft)}」${josa(esc(ending.legacyLeft), "을/를")} 다음 강호행에 남겼습니다.</p>`;
  const options = game.legacyOptions();
  if (!options.length) return `<p class="legacy-note">남길 만한 것이 없습니다.</p>`;
  return `<div class="legacy-panel"><h4>🏺 전설의 유산: 하나를 남긴다</h4>
    ${options.map((o, i) => `<button class="choice-btn" data-act="leave-legacy" data-key="${i}">${esc(o.label)}</button>`).join("")}</div>`;
}

function renderEnding() {
  const p = game.player;
  const { ending } = game;
  const meta = loadMeta();
  return `<div class="stage"><div class="stage-inner ending-sheet">
      <div class="seal seal-${esc(ending.key)}">${esc(ending.seal)}</div>
      <h2 class="ending-title">${esc(ending.title)}</h2>
      <p class="ending-text">${esc(ending.text)}</p>
      ${ending.epilogue.map((l) => `<p class="epilogue">${esc(l)}</p>`).join("")}
      ${p.chronicle.length ? `<details class="chronicle"><summary>이번 강호행 돌아보기</summary>${chronicleList(p)}</details>` : ""}
      ${legacyPanel()}
      <p class="karma-gain">💠 카르마 +${ending.karma} (보유 ${meta.current_karma}, 누적 ${meta.total_karma})</p>
      <p class="karma-lines">${(ending.karmaLines || []).map(esc).join(", ")}</p>
      <p class="ending-hint">카르마로 출신과 자질, 기틀, 인연, 유산을 얻어 다시 도전할 수 있습니다. 첫 화면의 상점에서 살 수 있습니다.</p>
      <div class="run-facts">
        <div><b>${esc(p.realm)}</b>경지</div><div><b>${esc(byname(p))}</b>별호</div>
        <div><b>${Math.min(p.turn, p.maxTurn)}달</b>진행</div><div><b>${p.kills}명</b>처치</div>
        <div><b>${esc(fameRank(p.fame))}</b>명성</div>
      </div></div></div>
    <div class="action-area"><div class="action-inner"><button class="next-btn" data-act="restart">다시 강호로</button></div></div>`;
}

function compareNote(player, key) {
  const effect = DB.market[key].effects.find((e) => e.type === "equip");
  if (!effect) {
    if (player.inventory[key]) return `행낭에 ${player.inventory[key]}개`;
    const skill = DB.market[key].effects.find((e) => e.type === "skill");
    const main = player.bestSkill();
    return skill && DB.skills[skill.skill].category === main?.category ? "주무공과 같은 계열" : "";
  }
  const label = effect.slot === "weapon" ? "위력" : "호신력";
  const note = `지금 ${label} +${equipmentBonus(player, effect.slot)} → +${bonusFor(player, key)}`;
  if (effect.slot !== "weapon" || !effect.style) return note;
  return player.bestSkill()?.category === effect.style ? `${note}, 주무공과 맞음` : `${note}, 주무공과 달라 3/4만 적용`;
}

const CATEGORY_NAMES = { 무기: "병기", 방어구: "호신구", 소비품: "상비약" };
const categoryName = (c) => CATEGORY_NAMES[c] || c;

function renderMarket() {
  const { market, player } = game;
  const GROUPS = [["병장기", ["무기", "방어구"]], ["비급", ["비급"]], ["약", ["소비품", "영약"]], ["도구", ["도구"]]];
  const main = player.bestSkill()?.category;
  const views = stockView(player, market);
  const fits = (item) => (compareNote(player, item.key).includes("맞음") || compareNote(player, item.key).includes("같은 계열") || (DB.market[item.key].effects[0]?.style === main) ? 0 : 1);
  const row = (item) => {
    const label = item.sold ? "품절" : item.blocked === "효과 없음" ? "필요 없음" : item.karma ? `💠 ${item.karma}` : `은자 ${item.price}`;
    const note = item.sold ? "" : compareNote(player, item.key);
    return `<div class="market-item${item.sold ? " sold" : ""}"><div class="item-info">
      <div class="item-name">${esc(item.name)}<span class="item-category">${esc(categoryName(item.category))}${item.stackable && !item.sold ? `, ${item.left}개 남음` : ""}</span></div>
      <div class="item-desc">${esc(item.desc)}</div>${note ? `<div class="item-note">${esc(note)}</div>` : ""}</div>
      <button class="buy-btn${item.blocked === "은자 부족" ? " poor" : ""}" data-act="buy" data-key="${esc(item.key)}" ${item.sold || item.blocked ? "disabled" : ""}>${label}</button></div>`;
  };
  const known = GROUPS.flatMap(([, cats]) => cats);
  const sections = GROUPS.map(([title, cats]) => {
    const list = views.filter((v) => cats.includes(v.category)).sort((a, b) => fits(a) - fits(b));
    return list.length ? `<h4 class="market-group">${title}</h4>${list.map(row).join("")}` : "";
  });
  const rest = views.filter((v) => !known.includes(v.category));
  const stock = sections.join("") + (rest.length ? `<h4 class="market-group">특별한 물건</h4>${rest.map(row).join("")}` : "");
  return `<div class="stage market-stage${market.special ? " market-special" : ""}"><div class="market-inner">
      <h2 class="market-title">${market.special ? "🌑" : "🏪"} ${esc(market.name)}</h2>
      <p class="market-sub">${market.special ? "결전을 앞둔 밤, 누군가 말없이 보따리를 풀어 놓는다." : "달을 쓰지 않습니다. 다음 장터는 일 년 뒤입니다."}</p>
      ${market.message ? `<p class="market-message">${esc(market.message)}</p>` : ""}
      ${stock}</div></div>
    <div class="action-area"><div class="action-inner"><button class="next-btn" data-act="leave-market">${market.special ? "⚔️ 떠나서 결전으로" : `▶️ 장터를 떠난다 (은자 ${player.silver})`}</button></div></div>`;
}

/** 첫 달 전에 쓸 무공을 고르는 화면. 시간이 지나지 않는다. */
function renderArtsPick() {
  const p = game.player;
  const names = { 공격무공: "주무공", 심공: "심법", 경공: "경공" };
  const groups = Object.entries(names).filter(([type]) => p.skillsOfType(type).length).map(([type, label]) => {
    const inUse = type === "공격무공" ? p.bestSkill() : p.bestOfType(type);
    const rows = p.skillsOfType(type).map((s) => {
      const on = inUse?.key === s.key;
      const stat = s.type === "공격무공" ? `위력 ${s.effectiveMultiplier().toFixed(2)}배, 내력 ${s.qiCost}` : "";
      return `<button class="choice-btn${on ? " special" : ""}" data-act="main-skill" data-key="${esc(s.key)}" ${on ? "disabled" : ""}>${on ? `<span class="choice-tag">쓰는 무공</span>` : ""}${esc(s.name)} <small>${esc(s.grade)}${stat ? `, ${esc(stat)}` : ""}<br>${esc(s.desc)}</small></button>`;
    }).join("");
    return `<h4 class="market-group">${label}</h4>${rows}`;
  }).join("");
  return `<div class="stage"><div class="stage-inner"><div class="event-sheet">
      <h2 class="event-title">쓸 무공을 정한다</h2>
      <div class="event-body"><p class="event-text">무공을 여럿 지니고 길을 나선다. 무엇을 앞세울지 먼저 정한다. 병기와 도구, 성취는 주무공에 맞춰 받는다.</p>
      ${groups}</div></div></div></div>
    <div class="action-area"><div class="action-inner"><button class="next-btn" data-act="finish-arts">▶️ 이대로 나선다</button><p class="hint flush">달이 지나지 않는 번외 시간입니다. 나중에도 신상에서 바꿀 수 있습니다.</p></div></div>`;
}

function renderEvent() {
  const p = game.player;
  const view = eventView(p, game.event.key);
  return `<div class="stage"><div class="stage-inner"><div class="event-sheet">
      <h2 class="event-title">${esc(view.title)}</h2>
      <div class="event-body"><p class="event-text" data-type>${esc(view.text)}</p>
        ${view.choices.map((c) => `<button class="choice-btn${c.tag ? " special" : ""}" data-act="choose" data-index="${c.index}" ${c.locked ? "disabled" : ""}>${c.tag ? `<span class="choice-tag">${esc(c.tag)}</span>` : ""}${esc(c.label)}${c.locked ? `<small>${esc(c.locked)}</small>` : ""}</button>`).join("")}
      </div></div></div></div>
    <div class="action-area"><div class="action-inner"><p class="hint flush">${DB.events[game.event.key].chain ? `이어지는 인연 「${esc(view.chain)}」입니다. 한 편마다 그달을 씁니다. 시작하면 손을 떼거나 죽지 않는 한 천마봉 전에 끝납니다.` : DB.events[game.event.key].prelude ? "십 년 전, 사부의 문하에 든 날의 일입니다. 달이 지나지 않습니다. 고른 병기와 심법을 십 년 갈고닦은 채로 산을 내려갑니다." : p.turn >= p.maxTurn ? "이 선택 뒤에는 돌아갈 수 없다." : "선택지의 결과는 고르기 전까지 알 수 없다."}</p></div></div>`;
}

const MAJOR_LINE = /^(🌟|✨|🏆|📕|📖|⚠️|🩸|⚔️|⚡|🗡️)/;
const RESULT_PART = /[+-]\d|단계|완치|입문|획득|장착|새 무공|받았지만|불리기/;

/** "외공+2, 은자+10" 같은 결과 줄은 표로, 나머지는 문장으로 보여 준다. */
function logLine(line, isLast) {
  const text = line.replace(/^성장: /, "");
  const parts = text.split(", ");
  if (parts.length && parts.every((p) => RESULT_PART.test(p) && p.length < 34)) {
    const chips = parts.map((part) => {
      const kind = /-\d/.test(part) ? "down" : /\+\d|입문|획득|장착|새 무공|완치|호전/.test(part) ? "up" : "";
      return `<span class="chip ${kind}">${esc(part)}</span>`;
    }).join("");
    return `<p class="chips">${chips}</p>`;
  }
  const major = MAJOR_LINE.test(line);
  const title = /^「.*」$/.test(line);
  return `<p class="log-line${major ? " major" : ""}${title ? " log-title" : ""}${isLast && !major ? " latest" : ""}" data-type>${esc(line)}</p>`;
}

function renderTurn() {
  const p = game.player;
  const lines = game.log.slice(-12);
  const nextMarket = marketTurns().find((t) => t >= p.turn);
  const body = lines.length
    ? lines.map((l, i) => logLine(l, i === lines.length - 1)).join("")
    : `<p class="log-line muted">강호의 첫걸음을 내딛으려 한다...</p>`;
  const lowHp = p.hp < p.maxHp() * 0.45;
  const lowQi = p.qi < p.maxQi() * 0.25;
  const needRest = lowHp || lowQi || p.injury >= 2;
  const advice = lowHp ? "체력이 낮습니다. 탐색 전에 요양하는 것이 안전합니다."
    : p.injury >= 2 ? "내상이 깊습니다. 요양하면 나아집니다."
      : lowQi ? "내력이 부족합니다. 요양이나 운기로 채우세요." : null;
  const action = (value, label, note, extra = "") => `<button class="act-btn${extra}" data-act="action" data-action="${value}">${label}<small>${note}</small></button>`;
  const market = nextMarket ? (nextMarket === p.turn ? "이번 달 말에 장터가 열립니다." : `다음 장터까지 ${nextMarket - p.turn}개월`) : "";
  const controls = game.pendingNext
    ? `<button class="next-btn" data-act="next">${nextMarket === p.turn ? "🏪 장터로" : "▶️ 다음 달로"}</button>`
    : `${advice ? `<p class="advice">${advice}</p>` : ""}<div class="actions">
        ${action("탐색", "🗺️ 탐색", "전투, 사건, 기연")}${action("수련", "⚔️ 수련", "외공, 무리, 성취")}
        ${action("명상", "🧘 운기", "내공, 심경, 내력")}${action("휴식", "💤 요양", "체력, 내력, 내상", needRest ? " suggest" : "")}
      </div>
      ${market ? `<p class="hint">${market}</p>` : ""}`;
  return `<div class="stage" aria-live="polite"><div class="stage-inner">${body}</div></div>
    <div class="action-area"><div class="action-inner">${controls}</div></div>`;
}

function renderPlay() {
  document.body.className = "play";
  setMood(game.market ? "market" : "calm");
  let middle;
  if (!game.player.alive) middle = renderEnding();
  else if (game.pickingArts) middle = renderArtsPick();
  else if (game.market) middle = renderMarket();
  else if (game.event) middle = renderEvent();
  else middle = renderTurn();
  app().innerHTML = `${topbar()}${middle}${sidebar()}${gameModals()}`;
}

// ---------- 글자 효과 ----------

/** 기록이 길면 가장 최근 줄이 보이도록 내려 준다. */
function followLog() {
  const stage = document.querySelector('.stage[aria-live="polite"]');
  if (stage) stage.scrollTop = stage.scrollHeight;
}

function typeText() {
  const nodes = [...document.querySelectorAll("[data-type]")];
  const delay = parseInt(storage.get("wuxia-speed") ?? "18", 10);
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (!nodes.length) return;
  const full = nodes.map((n) => n.textContent);
  const signature = full.join("|");
  if (signature === ui.lastTyped) return;
  ui.lastTyped = signature;
  if (!delay || reduced) return;

  nodes.forEach((n) => { n.textContent = ""; });
  document.body.classList.add("typing");
  let index = 0;
  let count = 0;
  const finish = () => {
    clearInterval(timer);
    document.body.classList.remove("typing");
    nodes.forEach((n, k) => { n.textContent = full[k]; });
    followLog();
    document.removeEventListener("pointerdown", finish, true);
    document.removeEventListener("keydown", finish, true);
  };
  document.addEventListener("pointerdown", finish, true);
  document.addEventListener("keydown", finish, true);
  const timer = setInterval(() => {
    if (index >= nodes.length) {
      finish();
      return;
    }
    count += 1;
    nodes[index].textContent = full[index].slice(0, count);
    followLog();
    if (count >= full[index].length) {
      index += 1;
      count = 0;
    }
  }, delay);
}

// ---------- 그리기 ----------

export function render() {
  const stage = document.querySelector(".market-stage");
  const scroll = stage ? stage.scrollTop : 0;
  const box = document.querySelector(".modal-overlay.open .modal-box");
  const boxScroll = box ? box.scrollTop : 0;
  const homeScroll = document.body.classList.contains("home") ? window.scrollY : 0;
  if (!game.active) (ui.screen === "shop" ? renderShop : ui.screen === "setup" ? renderSetup : renderTitle)();
  else if (game.battle) renderBattle();
  else renderPlay();
  const nextStage = document.querySelector(".market-stage");
  if (nextStage) nextStage.scrollTop = scroll;
  const nextBox = document.querySelector(".modal-overlay.open .modal-box");
  if (nextBox) nextBox.scrollTop = boxScroll;
  if (document.body.classList.contains("home")) window.scrollTo(0, homeScroll);
  else if (!document.body.classList.contains("in-battle")) window.scrollTo(0, 0);
  typeText();
  followLog();
}

// ---------- 입력 ----------

function openModal(id) {
  ui.modal = id;
  if (id === "codex-modal") refreshCodex();
  // 안드로이드 뒤로 가기로 창을 닫을 수 있게 기록을 하나 남긴다
  history.pushState({ modal: id }, "");
  document.getElementById(id)?.classList.add("open");
}

function closeModal() {
  if (!ui.modal) return;
  document.getElementById(ui.modal)?.classList.remove("open");
  ui.modal = null;
  ui.notice = null;
  if (history.state?.modal) history.back();
}

function downloadRecords() {
  const blob = new Blob([exportRecords()], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "강호행-기록.json";
  link.click();
  URL.revokeObjectURL(link.href);
  ui.notice = "기록을 내려받았습니다.";
  render();
}

const actions = {
  open: (el) => { openModal(el.dataset.modal); },
  "close-modal": closeModal,
  tab: (el) => {
    ui.tab = el.dataset.tab;
    ui.codexFilter = "전체";
    ui.codexQuery = "";
    refreshCodex();
  },
  "codex-read": (el) => {
    ui.codexRead = el.dataset.key;
    refreshCodex();
    document.querySelector("#codex-modal .modal-box").scrollTop = 0;
  },
  "codex-back": () => {
    ui.codexRead = null;
    refreshCodex();
  },
  "open-status": (el) => {
    ui.statusTab = el.dataset.tab;
    render();
    openModal("status-modal");
  },
  "status-tab": (el) => { ui.statusTab = el.dataset.tab; render(); },
  "trait-filter": (el) => { ui.traitFilter = el.dataset.key; render(); },
  "setup-tab": (el) => { ui.setupTab = el.dataset.tab; render(); window.scrollTo(0, 0); },
  setup: () => { ui.screen = "setup"; render(); window.scrollTo(0, 0); },
  shop: () => { ui.shopFrom = ui.screen; ui.screen = "shop"; render(); window.scrollTo(0, 0); },
  "shop-back": () => { ui.screen = ui.shopFrom || "title"; render(); window.scrollTo(0, 0); },
  "shop-tab": (el) => { ui.shopTab = el.dataset.tab; render(); window.scrollTo(0, 0); },
  title: () => { ui.screen = "title"; render(); },
  start: () => {
    closeModalQuietly();
    game.start(ui.origin, [...ui.traits], ui.legacy);
    ui.legacy = null;
    ui.screen = "title";
    render();
    // 처음 하는 사람에게는 입문서를 먼저 보여 준다
    if (storage.get("wuxia-show-guide") !== "off") openModal("help-modal");
  },
  "confirm-start": () => { openModal("confirm-start-modal"); },
  continue: () => { game.continueFromSave(); render(); },
  "upgrade-use": (el) => { setUpgradeUse(el.dataset.key, Number(el.dataset.level)); render(); },
  "buy-upgrade": (el) => { buyUpgrade(el.dataset.key); render(); },
  "buy-content": (el) => { buyContent(el.dataset.key); render(); },
  "buy-provision": (el) => { buyProvision(el.dataset.key); render(); },
  "refund-provision": (el) => { refundProvision(el.dataset.key); render(); },
  "open-legacy": () => { openLegacy(); render(); },
  "leave-legacy": (el) => { game.leaveLegacy(Number(el.dataset.key)); render(); },
  "unlock-origin": (el) => { unlockOrigin(el.dataset.key, DB.origins.origins[el.dataset.key].cost); render(); },
  "unlock-trait": (el) => { unlockTrait(el.dataset.key, DB.traits[el.dataset.key].cost); render(); },
  action: (el) => { game.action(el.dataset.action); render(); },
  next: () => { game.advanceTurn(); render(); },
  choose: (el) => { game.chooseEvent(Number(el.dataset.index)); render(); },
  battle: (el) => { game.battleAction(el.dataset.action, el.dataset.key ?? null); render(); },
  interlude: (el) => { game.battleInterlude(Number(el.dataset.key)); render(); },
  buy: (el) => { game.marketBuy(el.dataset.key); render(); },
  "leave-market": () => { game.marketLeave(); render(); },
  "finish-arts": () => { game.finishArtsPick(); render(); },
  "main-skill": (el) => { game.setMainSkill(el.dataset.key); render(); },
  "transfer-mastery": (el) => { game.transferMastery(el.dataset.key); render(); },
  "use-item": (el) => { game.useItem(el.dataset.key); render(); },
  restart: () => {
    closeModalQuietly();
    game.restart();
    render();
  },
  export: downloadRecords,
  install: async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    render();
  },
};

function closeModalQuietly() {
  ui.modal = null;
  ui.notice = null;
}

export function installInput() {
  document.addEventListener("click", (event) => {
    const overlay = event.target.classList?.contains("modal-overlay");
    if (overlay) {
      closeModal();
      return;
    }
    const el = event.target.closest("[data-act]");
    if (!el || el.disabled) return;
    actions[el.dataset.act]?.(el);
  });

  document.addEventListener("input", (event) => {
    if (event.target.id === "codex-search") {
      ui.codexQuery = event.target.value;
      refreshCodexList();
    }
  });

  document.addEventListener("change", async (event) => {
    const { target } = event;
    if (target.id === "codex-filter") {
      ui.codexFilter = target.value;
      refreshCodexList();
      return;
    }
    if (target.name === "origin") {
      ui.origin = target.value;
      render();
    } else if (target.name === "trait") {
      if (target.checked) ui.traits.add(target.value);
      else ui.traits.delete(target.value);
      render();
    } else if (target.id === "set-speed") {
      storage.set("wuxia-speed", target.value);
    } else if (target.name === "legacy") {
      ui.legacy = target.value === "" ? null : Number(target.value);
      render();
    } else if (target.dataset.content) {
      toggleContent(target.dataset.content);
    } else if (target.id === "set-guide") {
      storage.set("wuxia-show-guide", target.checked ? "on" : "off");
    } else if (target.id === "guide-off") {
      storage.set("wuxia-show-guide", target.checked ? "off" : "on");
      const other = document.getElementById("set-guide");
      if (other) other.checked = !target.checked;
    } else if (target.id === "set-font") {
      storage.set("wuxia-font", target.value);
      document.documentElement.dataset.font = target.value;
    } else if (target.id === "import-file" && target.files[0]) {
      const ok = importRecords(await target.files[0].text());
      ui.notice = ok ? "기록을 가져왔습니다." : "이 파일은 게임 기록이 아닙니다.";
      render();
    }
  });

  document.addEventListener("input", (event) => {
    if (event.target.id === "set-volume") setVolume(parseInt(event.target.value, 10));
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeModal();
  });

  window.addEventListener("popstate", () => {
    if (ui.modal) {
      document.getElementById(ui.modal)?.classList.remove("open");
      ui.modal = null;
      ui.notice = null;
    }
  });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
  });
}

export function applySavedFont() {
  document.documentElement.dataset.font = storage.get("wuxia-font") ?? "normal";
}
