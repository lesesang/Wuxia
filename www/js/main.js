// 시작점: 데이터를 읽고 첫 화면을 그린다.
import { installMusicTriggers } from "./audio.js";
import { loadDataInBrowser } from "./data.js";
import { applySavedFont, installInput, render } from "./ui.js";

async function boot() {
  applySavedFont();
  try {
    await loadDataInBrowser();
  } catch (error) {
    document.getElementById("app").innerHTML = `<div class="boot-message"><p>강호의 기록을 읽지 못했습니다.</p>
      <p>인터넷 연결을 확인한 뒤 다시 펼쳐 주세요.</p><button class="next-btn" onclick="location.reload()">다시 펼치기</button></div>`;
    throw error;
  }
  installInput();
  installMusicTriggers();
  render();

  // 기록이 브라우저 정리로 지워지지 않도록 요청하고, 오프라인 실행을 준비한다
  navigator.storage?.persist?.().catch(() => {});
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

boot();
