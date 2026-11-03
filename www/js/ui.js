// 화면 그리기와 입력 처리. 게임 규칙은 game.js에 있고 여기서는 보여 주기만 한다.
import { getVolume, setMood, setVolume } from "./audio.js";
import { INJURY_PENALTY } from "./battle.js";
import { DB } from "./data.js";
import { eventView } from "./events.js";
import { Game } from "./game.js";
import { equipmentBonus, itemName, stockView } from "./market.js";
import {
  exportRecords, importRecords, loadCheckpoint, loadMeta, unlockOrigin, unlockTrait,
} from "./meta.js";
import {
  ALIGNMENTS, benefitText, byname, fameRank, getChapterInfo, getMonth, getYear, marketTurns, nextSlotThreshold,
  realmProgress, traitSlots,
} from "./rules.js";
import { storage } from "./storage.js";

const game = new Game();
const ui = { origin: "무림초출", traits: new Set(), modal: null, tab: "enemies", notice: null, lastTyped: "" };
let installPrompt = null;
const app = () => document.getElementById("app");

const esc = (value) => String(value ?? "").replace(/[&<>"']/g,
  (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const percent = (part, whole) => Math.min(100, Math.trunc(part / whole * 100));

// ---------- 공통 조각 ----------

function modalShell(id, title, body) {
  return `<div class="modal-overlay${ui.modal === id ? " open" : ""}" id="${id}" role="dialog" aria-label="${esc(title)}">
    <div class="modal-box">
      <div class="modal-head"><h3>${esc(title)}</h3><button class="modal-close" data-act="close-modal" aria-label="닫기">✕</button></div>
      ${body}
    </div></div>`;
}

function codexModal() {
  const meta = loadMeta();
  const list = (items, empty, row) => (items.length ? items.map(row).join("") : `<p class="codex-empty">${empty}</p>`);
  const entry = (name, meta2, desc) => `<div class="codex-item"><div class="codex-name">${esc(name)}</div>
    <div class="codex-meta">${esc(meta2)}</div>${desc ? `<div>${esc(desc)}</div>` : ""}</div>`;
  const enemies = meta.global_codex.filter((k) => DB.enemies[k]);
  const skills = meta.known_skills.filter((k) => DB.skills[k]);
  const items = meta.known_items.filter((k) => DB.market[k]);
  const tabs = [
    ["enemies", `인물 ${enemies.length}/${Object.keys(DB.enemies).length}`],
    ["skills", `무공 ${skills.length}/${Object.keys(DB.skills).length}`],
    ["items", `보물 ${items.length}/${Object.keys(DB.market).length}`],
    ["endings", "결말"],
    ["runs", "회차 기록"],
  ];
  const panels = {
    enemies: list(enemies, "탐색에서 적을 만나면 다음 턴에 이곳에 기록됩니다.", (k) => {
      const e = DB.enemies[k];
      return entry(e.name, `${e.tier}, ${e.realm} 경지, 체력 ${e.hp}, 공격력 ${e.attack}`, e.desc);
    }),
    skills: list(skills, "무공을 익히면 이곳에 기록됩니다.", (k) => {
      const s = DB.skills[k];
      return entry(s.name, `${s.type}, ${s.grade} 등급`, s.desc);
    }),
    items: list(items, "시장에서 물건을 사면 이곳에 기록됩니다.", (k) => {
      const i = DB.market[k];
      return entry(i.name, i.category, i.desc);
    }),
    endings: Object.keys(DB.endings.titles).map((k) => entry(
      meta.endings_seen.includes(k) ? DB.endings.titles[k] : "아직 보지 못한 결말", `카르마 +${DB.endings.karma[k]}`)).join(""),
    runs: `<p class="codex-meta">끝낸 강호행 ${meta.total_runs}회</p>${list(meta.runs, "강호행을 끝내면 이곳에 기록됩니다.", (r) => entry(
      DB.endings.titles[r.ending] || r.ending, `${r.origin}, ${r.realm}, ${r.title}`, `${r.turn}턴까지 진행, ${r.kills}명 처치`))}`,
  };
  return modalShell("codex-modal", "강호 도감", `
    <div class="tabs">${tabs.map(([key, label]) => `<button class="tab-btn${ui.tab === key ? " active" : ""}" data-act="tab" data-tab="${key}">${esc(label)}</button>`).join("")}</div>
    <div class="tab-panel active">${panels[ui.tab]}</div>`);
}

function settingsModal() {
  const speed = storage.get("wuxia-speed") ?? "18";
  const font = storage.get("wuxia-font") ?? "normal";
  const option = (value, label, current) => `<option value="${value}"${value === current ? " selected" : ""}>${label}</option>`;
  return modalShell("settings-modal", "게임 설정", `
    <div class="setting-row"><label for="set-volume">BGM 볼륨</label>
      <input type="range" id="set-volume" min="0" max="100" step="5" value="${getVolume()}"></div>
    <div class="setting-row"><label for="set-speed">텍스트 속도</label>
      <select id="set-speed">${option("0", "바로 표시", speed)}${option("35", "느리게", speed)}${option("18", "보통", speed)}${option("7", "빠르게", speed)}</select></div>
    <div class="setting-row"><label for="set-font">글자 크기</label>
      <select id="set-font">${option("small", "작게", font)}${option("normal", "보통", font)}${option("large", "크게", font)}</select></div>
    <div class="setting-row"><span>언어</span><span class="muted">한국어</span></div>
    ${installPrompt ? `<div class="setting-row"><span>앱처럼 쓰기</span><button class="mini-btn" data-act="install">홈 화면에 추가</button></div>` : ""}
    <div class="setting-row"><span>기록 옮기기<br><small class="muted">카르마, 도감, 진행 중인 턴</small></span>
      <span class="setting-buttons"><button class="mini-btn" data-act="export">내보내기</button>
      <label class="mini-btn file-btn">가져오기<input type="file" id="import-file" accept=".json,application/json"></label></span></div>
    ${ui.notice ? `<p class="market-message">${esc(ui.notice)}</p>` : ""}`);
}

// ---------- 메인 화면 ----------

function renderHome() {
  document.body.className = "home";
  setMood("calm");
  const meta = loadMeta();
  const slots = traitSlots(meta.total_karma);
  const next = nextSlotThreshold(meta.total_karma);
  const hasSave = loadCheckpoint() !== null;
  ui.traits = new Set([...ui.traits].filter((t) => meta.unlocked_traits.includes(t)));
  if (!meta.unlocked_origins.includes(ui.origin)) ui.origin = "무림초출";

  const statLine = (o) => `외공 ${o.external}, 내공 ${o.internal}, 무리 ${o.martial}, 심경 ${o.mind}`;
  const origins = DB.origins.order.map((key) => {
    const o = DB.origins.origins[key];
    const skillNames = o.skills.map((s) => DB.skills[s].name).join(", ");
    if (!meta.unlocked_origins.includes(key)) {
      return `<div class="pick-row locked"><div class="pick-main">
        <div class="pick-name">🔒 ${esc(o.name)}</div><p class="pick-desc">${esc(o.desc)}</p>
        <div class="pick-stats">${statLine(o)}</div><div class="pick-stats">시작 무공: ${esc(skillNames)}</div></div>
        <button class="unlock-btn" data-act="unlock-origin" data-key="${esc(key)}" ${meta.current_karma < o.cost ? "disabled" : ""}>카르마 ${o.cost}로 해금</button></div>`;
    }
    return `<div class="pick-row"><label class="pick-label">
      <input type="radio" name="origin" value="${esc(key)}" ${ui.origin === key ? "checked" : ""}>
      <span class="pick-main"><span class="pick-name">${esc(o.name)}</span>
      <span class="pick-desc block">${esc(o.desc)}</span>
      <span class="pick-stats block">${statLine(o)}</span>
      <span class="pick-stats block">시작 무공: ${esc(skillNames)}</span></span></label></div>`;
  }).join("");

  const traits = Object.keys(DB.traits).map((key) => {
    const t = DB.traits[key];
    const title = `${esc(t.name)}<span class="rarity rarity-${esc(t.rarity)}">${esc(t.rarity)}</span>`;
    if (!meta.unlocked_traits.includes(key)) {
      return `<div class="pick-row locked"><div class="pick-main"><div class="pick-name">🔒 ${title}</div><p class="pick-desc">${esc(t.desc)}</p></div>
        <button class="unlock-btn" data-act="unlock-trait" data-key="${esc(key)}" ${meta.current_karma < t.cost ? "disabled" : ""}>카르마 ${t.cost}로 해금</button></div>`;
    }
    const checked = ui.traits.has(key);
    return `<div class="pick-row"><label class="pick-label">
      <input type="checkbox" name="trait" value="${esc(key)}" ${checked ? "checked" : ""} ${!checked && ui.traits.size >= slots ? "disabled" : ""}>
      <span class="pick-main"><span class="pick-name">${title}</span><span class="pick-desc block">${esc(t.desc)}</span></span></label></div>`;
  }).join("");

  app().innerHTML = `<div class="home-wrap">
    <header class="hero"><h1>무협<br>로그라이크</h1>
      <div class="hero-side">
        <p class="hero-line">다섯 해 뒤 겨울, 천마봉에서 누군가 기다린다.<br>그때까지 어떤 무인이 될지는 당신이 정한다.</p>
        <p class="karma-display">💠 카르마 ${meta.current_karma} (누적 ${meta.total_karma})</p>
        ${hasSave ? `<button class="continue-btn" data-act="continue">📜 저장된 턴부터 이어하기</button>` : ""}
      </div></header>
    <h2 class="section-title">출신</h2>${origins}
    <h2 class="section-title">특성 <span class="slot-count">${ui.traits.size} / ${slots}</span></h2>
    <p class="section-note">${next ? `누적 카르마 ${next}이 되면 특성을 하나 더 장착할 수 있습니다.` : "특성 슬롯이 모두 열렸습니다."}</p>
    ${traits}
    <button class="start-btn" data-act="${hasSave ? "confirm-start" : "start"}">강호로 나선다</button>
  </div>
  <div class="main-sidebar">
    <button data-act="open" data-modal="codex-modal">📖<span class="sb-label">도감</span></button>
    <button data-act="open" data-modal="settings-modal">⚙️<span class="sb-label">설정</span></button>
  </div>
  ${codexModal()}${settingsModal()}
  ${modalShell("confirm-start-modal", "새 강호행을 시작할까요?", `
    <p class="modal-text">저장된 진행이 사라집니다. 카르마와 도감은 남습니다.</p>
    <button class="danger-btn" data-act="start">새로 시작</button>`)}`;
}

// ---------- 게임 화면 ----------

function sidebar() {
  return `<div class="sidebar">
    <button data-act="open" data-modal="status-modal">🧍<span class="sb-label">상태</span></button>
    <button data-act="open" data-modal="codex-modal">📖<span class="sb-label">도감</span></button>
    <button data-act="open" data-modal="settings-modal">⚙️<span class="sb-label">설정</span></button>
    <button data-act="open" data-modal="reset-modal">🔄<span class="sb-label">초기화</span></button>
  </div>`;
}

function statusModal() {
  const p = game.player;
  const row = (label, value) => `<div class="stat-row"><span>${esc(label)}</span><span>${esc(value)}</span></div>`;
  const sect = DB.sects[p.sect];
  const progress = realmProgress(p);
  const weapon = itemName(p.weapon);
  const armor = itemName(p.armor);
  const main = p.bestSkill();
  const inventory = Object.entries(p.inventory).filter(([k]) => DB.market[k]);
  const traits = p.traits.map((k) => DB.traits[k]).filter(Boolean);

  const skills = p.skills.map((s) => {
    const isMain = main?.key === s.key;
    const button = s.type === "공격무공" && !game.battle
      ? `<button class="mini-btn${isMain ? " on" : ""}" data-act="main-skill" data-key="${esc(s.key)}" ${isMain ? "disabled" : ""}>${isMain ? "주무공" : "주무공으로"}</button>` : "";
    const secret = s.secretName
      ? `, 비기 「${esc(s.secretName)}」 ${s.secretUnlocked ? "해방" : `${esc(s.secretUnlockGrade)} 등급 숙련도 ${s.secretUnlockMastery}에 해방`}` : "";
    return `<div class="skill-row"><div class="skill-head"><span>${esc(s.name)} <span class="skill-meta">${esc(s.type)}, ${esc(s.grade)}</span></span>${button}</div>
      <div class="skill-meta">숙련도 ${s.mastery}/100${secret}</div><div class="skill-meta">${esc(s.desc)}</div></div>`;
  }).join("") || `<p class="codex-empty">아직 익힌 무공이 없습니다.</p>`;

  const bag = inventory.map(([key, count]) => `<div class="skill-row"><div class="skill-head">
    <span>${esc(DB.market[key].name)} ×${count}<br><span class="skill-meta">${esc(DB.market[key].desc)}</span></span>
    ${!game.battle && p.alive ? `<button class="mini-btn" data-act="use-item" data-key="${esc(key)}">사용</button>` : ""}</div></div>`).join("")
    || `<p class="codex-empty">시장에서 산 소비품이 이곳에 들어옵니다.</p>`;

  return modalShell("status-modal", "캐릭터 상태", `
    <div class="modal-section">
      ${row("출신", p.origin)}${row("사문", sect ? sect.name : "없음")}
      ${sect ? row("사문의 은혜", sect.bonus_text) : ""}
      ${row("경지", p.realm)}${row("명성", `${p.fame} (${fameRank(p.fame)})`)}
      ${p.injury ? row("내상", `${p.injury}단계 (주는 피해 -${p.injury * INJURY_PENALTY}%, 회복으로 치료)`) : ""}
      ${row("전투 경험", `${p.battles} (${p.kills}명 처치)`)}${row("은자", p.silver)}
      ${row("무기", weapon ? `${weapon} (공격력 +${equipmentBonus(p, "weapon")})` : "없음")}
      ${row("방어구", armor ? `${armor} (받는 피해 -${equipmentBonus(p, "armor")})` : "없음")}
    </div>
    <div class="modal-section"><h4>능력치</h4>
      ${row("외공 (체력, 공격력)", p.external)}${row("내공 (기력, 비기 위력)", p.internal)}
      ${row("무리 (공격력, 명중, 숙련도)", p.martial)}${row("심경 (치명타, 수련 효율, 돌파)", p.mind)}
    </div>
    <div class="modal-section"><h4>별호: ${esc(byname(p))}</h4>
      ${ALIGNMENTS.map((name) => `<div class="align-row"><span>${name}</span><div class="align-track"><div class="a-${name}" style="width:${Math.min(p.alignment[name] * 5, 100)}%"></div></div><span>${p.alignment[name]}</span></div>`).join("")}
      <p class="skill-meta">${esc(benefitText(p.alignment))}</p>
    </div>
    ${progress ? `<div class="modal-section"><h4>다음 경지: ${esc(progress.next)}</h4>
      ${row("평균 능력치", `${progress.avg} / ${progress.avgRequired}`)}
      ${row("최저 능력치", `${progress.min} / ${progress.minRequired}`)}
      ${row("전투 경험", `${progress.battles} / ${progress.battlesRequired}`)}</div>` : ""}
    <div class="modal-section"><h4>무공</h4>${skills}</div>
    <div class="modal-section"><h4>가방</h4>${bag}</div>
    ${traits.length ? `<div class="modal-section"><h4>특성</h4>${traits.map((t) => `<div class="skill-row">${esc(t.name)}<div class="skill-meta">${esc(t.desc)}</div></div>`).join("")}</div>` : ""}`);
}

function gameModals() {
  return `${statusModal()}${codexModal()}${settingsModal()}
  ${modalShell("reset-modal", "강호행을 초기화할까요?", `
    <p class="modal-text">이번 회차의 진행이 사라지고 메인 화면으로 돌아갑니다. 카르마와 도감은 남습니다.</p>
    <button class="danger-btn" data-act="restart">초기화하고 메인으로</button>`)}`;
}

function renderBattle() {
  document.body.className = "in-battle";
  setMood("battle");
  const { player: p, battle: b, gauntlet } = game;
  const skill = p.bestSkill();
  const mindset = p.bestOfType("심공");
  const movement = p.bestOfType("경공");
  const warning = b.nextSpecialWarning();
  const secretReady = skill?.secretUnlocked && p.qi >= skill.secretQiCost;
  const state = [`제 ${b.roundNum + 1} 라운드`];
  if (b.poison) state.push(`중독 ${b.poison.rounds}라운드`);
  if (b.atkBuff) state.push(`공격력 +${b.atkBuff.percent}%`);
  if (b.counterPct) state.push(`다음 공격 +${b.counterPct}%`);
  if (b.sealed) state.push("혈도 봉쇄");
  if (p.injury) state.push(`내상 ${p.injury}단계`);
  if (b.enemyPoison) state.push("적 중독");
  if (gauntlet) state.push(`${gauntlet.name} ${gauntlet.round}/${gauntlet.total}전`);

  const secretNote = !skill ? "무공 없음"
    : skill.secretUnlocked ? `기력 ${skill.secretQiCost}`
      : `${skill.secretUnlockGrade} 등급, 숙련도 ${skill.secretUnlockMastery}에 해방`;
  const items = Object.entries(p.inventory).filter(([k]) => DB.market[k]);

  app().innerHTML = `<div class="battle-screen">
    <h1 class="battle-title">전 투${b.isFinal ? `<span class="battle-final-tag">천마와의 결전</span>` : ""}</h1>
    <div class="vs-row">
      <div class="combatant"><div class="name">${esc(p.origin)}</div>
        <div class="hpbar-outer"><div class="hpbar-inner mine" style="width:${percent(p.hp, p.maxHp())}%"></div></div>
        <div class="qibar"><div style="width:${percent(p.qi, p.maxQi())}%"></div></div>
        <div class="hpnum">체력 ${p.hp}/${p.maxHp()}, 기력 ${p.qi}/${p.maxQi()}</div></div>
      <div class="vs-mark">VS</div>
      <div class="combatant"><div class="name">${esc(b.enemy.name)}</div>
        <div class="hpbar-outer"><div class="hpbar-inner enemy" style="width:${percent(b.enemy.hp, b.enemy.maxHp)}%"></div></div>
        <div class="hpnum">${b.enemy.hp} / ${b.enemy.maxHp}</div></div>
    </div>
    ${b.roundNum === 0 ? `<p class="enemy-desc">${esc(b.enemy.desc)}</p>` : ""}
    <p class="battle-state">${esc(state.join(", "))}</p>
    ${warning ? `<p class="battle-warning">⚠️ 다음은 「${esc(warning)}」! 경공으로 흘려낼 수 있다.</p>` : ""}
    <div class="battle-log">${game.log.slice(-10).map((l) => `<p>${esc(l)}</p>`).join("")}</div>
    <div class="battle-actions">
      <button class="bt-btn" data-act="battle" data-action="기본공격">⚔️ ${skill ? esc(skill.name) : "맨손 공격"}
        <small>${skill ? `기력 ${skill.qiCost}${p.qi < skill.qiCost ? ", 부족해서 맨손 공격" : ""}` : "기력 소모 없음"}</small></button>
      <button class="bt-btn" data-act="battle" data-action="비기" ${secretReady ? "" : "disabled"}>✨ ${skill?.secretUnlocked ? esc(skill.secretName) : "비기"}
        <small>${esc(secretNote)}</small></button>
      <button class="bt-btn" data-act="battle" data-action="심법" ${mindset ? "" : "disabled"}>🧘 ${mindset ? esc(mindset.name) : "심법"}
        <small>${mindset ? "숨을 고르며 회복" : "익힌 심공 없음"}</small></button>
      <button class="bt-btn" data-act="battle" data-action="경공" ${movement && p.qi >= movement.qiCost ? "" : "disabled"}>💨 ${movement ? esc(movement.name) : "경공"}
        <small>${movement ? `기력 ${movement.qiCost}, 회피 ${movement.effectValue("evade")}%` : "익힌 경공 없음"}</small></button>
      ${b.isFinal ? "" : `<button class="bt-btn flee" data-act="battle" data-action="도주">🏃 도주</button>`}
    </div>
    ${items.length ? `<div class="battle-items">${items.map(([key, count]) => `<button class="item-btn" data-act="battle" data-action="소비품" data-key="${esc(key)}">${esc(DB.market[key].name)} ×${count}</button>`).join("")}</div>` : ""}
    ${sidebar()}
  </div>${gameModals()}`;
  const log = document.querySelector(".battle-log");
  if (log) log.scrollTop = log.scrollHeight;
}

function topbar() {
  const p = game.player;
  const turn = Math.min(p.turn, p.maxTurn);
  return `<div class="topbar"><div class="topbar-inner">
    <div class="topbar-row1">
      <span class="turn-info">${esc(getChapterInfo(turn).title)}, ${getYear(turn)}년차 ${getMonth(turn)}월 (턴 ${p.turn}/${p.maxTurn})</span>
      <span class="realm-info">${esc(byname(p))}, ${esc(p.realm)}</span>
    </div>
    <div class="topbar-row2">
      <div class="resource"><span class="label">체력</span><div class="bar-track"><div class="bar-fill bar-hp" style="width:${percent(p.hp, p.maxHp())}%"></div></div><span class="num">${p.hp}/${p.maxHp()}</span></div>
      <div class="resource"><span class="label">기력</span><div class="bar-track"><div class="bar-fill bar-qi" style="width:${percent(p.qi, p.maxQi())}%"></div></div><span class="num">${p.qi}/${p.maxQi()}</span></div>
    </div>
    <div class="topbar-stats">
      <span>외공 <b>${p.external}</b></span><span>내공 <b>${p.internal}</b></span>
      <span>무리 <b>${p.martial}</b></span><span>심경 <b>${p.mind}</b></span>
      <span class="silver">은자 <b>${p.silver}</b></span>
      ${p.injury ? `<span class="injury">내상 <b>${p.injury}</b></span>` : ""}
    </div></div></div>`;
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
      <p class="karma-gain">💠 카르마 +${ending.karma} (보유 ${meta.current_karma}, 누적 ${meta.total_karma})</p>
      <div class="run-facts">
        <div><b>${esc(p.realm)}</b>경지</div><div><b>${esc(byname(p))}</b>별호</div>
        <div><b>${Math.min(p.turn, p.maxTurn)}턴</b>진행</div><div><b>${p.kills}명</b>처치</div>
        <div><b>${esc(fameRank(p.fame))}</b>명성</div>
      </div></div></div>
    <div class="action-area"><div class="action-inner"><button class="next-btn" data-act="restart">메인 화면으로</button></div></div>`;
}

function renderMarket() {
  const { market } = game;
  const stock = stockView(game.player, market).map((item) => {
    const label = item.sold ? "판매 완료" : item.blocked === "효과 없음" ? "효과 없음" : `은자 ${item.price}`;
    return `<div class="market-item${item.sold ? " sold" : ""}"><div class="item-info">
      <div class="item-name">${esc(item.name)}<span class="item-category">${esc(item.category)}${item.stackable && !item.sold ? `, ${item.left}개 남음` : ""}</span></div>
      <div class="item-desc">${esc(item.desc)}</div></div>
      <button class="buy-btn" data-act="buy" data-key="${esc(item.key)}" ${item.sold || item.blocked ? "disabled" : ""}>${label}</button></div>`;
  }).join("");
  return `<div class="stage market-stage${market.special ? " market-special" : ""}"><div class="market-inner">
      <h2 class="market-title">${market.special ? "🌑" : "🏪"} ${esc(market.name)}</h2>
      <p class="market-sub">${market.special ? "결전을 앞둔 밤, 누군가 말없이 보따리를 풀어 놓는다." : "턴을 쓰지 않고 둘러볼 수 있다."}</p>
      ${market.message ? `<p class="market-message">${esc(market.message)}</p>` : ""}
      ${stock}</div></div>
    <div class="action-area"><div class="action-inner"><button class="next-btn" data-act="leave-market">${market.special ? "⚔️ 떠나서 결전으로" : "▶️ 시장을 떠난다"}</button></div></div>`;
}

function renderEvent() {
  const p = game.player;
  const view = eventView(p, game.event.key);
  return `<div class="stage"><div class="stage-inner"><div class="event-sheet">
      <h2 class="event-title">${esc(view.title)}</h2>
      <div class="event-body"><p class="event-text" data-type>${esc(view.text)}</p>
        ${view.choices.map((c) => `<button class="choice-btn" data-act="choose" data-index="${c.index}" ${c.locked ? "disabled" : ""}>${esc(c.label)}${c.locked ? `<small>${esc(c.locked)}</small>` : ""}</button>`).join("")}
      </div></div></div></div>
    <div class="action-area"><div class="action-inner"><p class="hint flush">${p.turn >= p.maxTurn ? "이 선택 뒤에는 돌아갈 수 없다." : "선택지의 결과는 고르기 전까지 알 수 없다."}</p></div></div>`;
}

function renderTurn() {
  const p = game.player;
  const lines = game.log.slice(-8);
  const nextMarket = marketTurns().find((t) => t >= p.turn);
  const body = lines.length
    ? lines.map((l, i) => `<p class="log-line${i === lines.length - 1 ? " latest" : ""}" data-type>${esc(l)}</p>`).join("")
    : `<p class="log-line muted">강호의 첫걸음을 내딛으려 한다...</p>`;
  const action = (value, label, note) => `<button class="act-btn" data-act="action" data-action="${value}">${label}<small>${note}</small></button>`;
  const controls = game.pendingNext
    ? `<button class="next-btn" data-act="next">▶️ 다음</button>`
    : `<div class="actions">
        ${action("탐색", "🗺️ 탐색", "전투, 사건, 기연")}${action("수련", "⚔️ 수련", "외공, 무리, 숙련도")}
        ${action("명상", "🧘 명상", "내공, 심경, 기력")}${action("휴식", "💤 회복", "체력, 기력, 내상")}
      </div>
      ${nextMarket ? `<p class="hint">${nextMarket === p.turn ? "이번 달 말에 시장이 열린다." : `다음 시장까지 ${nextMarket - p.turn}개월`}</p>` : ""}`;
  return `<div class="stage"><div class="stage-inner">${body}</div></div>
    <div class="action-area"><div class="action-inner">${controls}</div></div>`;
}

function renderPlay() {
  document.body.className = "play";
  setMood(game.market ? "market" : "calm");
  let middle;
  if (!game.player.alive) middle = renderEnding();
  else if (game.market) middle = renderMarket();
  else if (game.event) middle = renderEvent();
  else middle = renderTurn();
  app().innerHTML = `${topbar()}${middle}${sidebar()}${gameModals()}`;
}

// ---------- 글자 효과 ----------

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
  let index = 0;
  let count = 0;
  const finish = () => {
    clearInterval(timer);
    nodes.forEach((n, k) => { n.textContent = full[k]; });
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
  if (!game.active) renderHome();
  else if (game.battle) renderBattle();
  else renderPlay();
  const nextStage = document.querySelector(".market-stage");
  if (nextStage) nextStage.scrollTop = scroll;
  const nextBox = document.querySelector(".modal-overlay.open .modal-box");
  if (nextBox) nextBox.scrollTop = boxScroll;
  if (document.body.classList.contains("home")) window.scrollTo(0, homeScroll);
  else if (!document.body.classList.contains("in-battle")) window.scrollTo(0, 0);
  typeText();
}

// ---------- 입력 ----------

function openModal(id) {
  ui.modal = id;
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
  link.download = "무협로그라이크-기록.json";
  link.click();
  URL.revokeObjectURL(link.href);
  ui.notice = "기록 파일을 내려받았습니다.";
  render();
}

const actions = {
  open: (el) => { openModal(el.dataset.modal); },
  "close-modal": closeModal,
  tab: (el) => { ui.tab = el.dataset.tab; render(); },
  start: () => {
    closeModalQuietly();
    game.start(ui.origin, [...ui.traits]);
    render();
  },
  "confirm-start": () => { openModal("confirm-start-modal"); },
  continue: () => { game.continueFromSave(); render(); },
  "unlock-origin": (el) => { unlockOrigin(el.dataset.key, DB.origins.origins[el.dataset.key].cost); render(); },
  "unlock-trait": (el) => { unlockTrait(el.dataset.key, DB.traits[el.dataset.key].cost); render(); },
  action: (el) => { game.action(el.dataset.action); render(); },
  next: () => { game.advanceTurn(); render(); },
  choose: (el) => { game.chooseEvent(Number(el.dataset.index)); render(); },
  battle: (el) => { game.battleAction(el.dataset.action, el.dataset.key ?? null); render(); },
  buy: (el) => { game.marketBuy(el.dataset.key); render(); },
  "leave-market": () => { game.marketLeave(); render(); },
  "main-skill": (el) => { game.setMainSkill(el.dataset.key); render(); },
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

  document.addEventListener("change", async (event) => {
    const { target } = event;
    if (target.name === "origin") {
      ui.origin = target.value;
    } else if (target.name === "trait") {
      if (target.checked) ui.traits.add(target.value);
      else ui.traits.delete(target.value);
      render();
    } else if (target.id === "set-speed") {
      storage.set("wuxia-speed", target.value);
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
