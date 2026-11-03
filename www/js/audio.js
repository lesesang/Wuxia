// BGM: 음원 파일 없이 오음계 가락을 즉석에서 연주한다. 설정은 기기에 남는다.
import { storage } from "./storage.js";

const SCALES = {
  calm: [196, 220, 261.6, 293.7, 329.6, 392, 440, 523.3],
  battle: [146.8, 174.6, 196, 220, 261.6, 293.7],
  market: [261.6, 293.7, 329.6, 392, 440, 523.3, 587.3],
};
const TEMPO = { calm: 1500, battle: 480, market: 900 };

let ctx = null;
let master = null;
let playing = false;
let timer = null;
let mood = "calm";

export const getVolume = () => parseInt(storage.get("wuxia-volume") || "0", 10);

function pluck(freq, when, gainValue, length, type) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(gainValue, when + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + length);
  osc.connect(gain);
  gain.connect(master);
  osc.start(when);
  osc.stop(when + length + 0.05);
}

function nextNote() {
  const scale = SCALES[mood] || SCALES.calm;
  const now = ctx.currentTime + 0.02;
  const freq = scale[Math.floor(Math.random() * scale.length)];
  if (mood === "battle") {
    pluck(70, now, 0.5, 0.25, "sine");
    if (Math.random() < 0.6) pluck(freq, now, 0.16, 0.5, "triangle");
  } else {
    pluck(freq, now, 0.3, 2.4, "triangle");
    pluck(freq * 2, now, 0.05, 1.2, "sine");
    if (Math.random() < 0.25) pluck(freq * 1.5, now + 0.28, 0.14, 1.8, "triangle");
  }
  timer = setTimeout(nextNote, TEMPO[mood] * (0.75 + Math.random() * 0.6));
}

function applyVolume() { if (master) master.gain.value = getVolume() / 100 * 0.7; }

export function startMusic() {
  if (playing || !getVolume()) return;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  ctx = ctx || new AudioCtx();
  if (ctx.state === "suspended") ctx.resume();
  if (!master) {
    master = ctx.createGain();
    master.connect(ctx.destination);
  }
  applyVolume();
  playing = true;
  nextNote();
}

export function stopMusic() {
  playing = false;
  clearTimeout(timer);
}

export function setVolume(value) {
  storage.set("wuxia-volume", String(value));
  if (value === 0) stopMusic();
  else {
    startMusic();
    applyVolume();
  }
}

export function setMood(next) { mood = next; }

// 브라우저 정책상 소리는 사용자의 입력 뒤에만 시작할 수 있다
export function installMusicTriggers() {
  document.addEventListener("pointerdown", startMusic, { once: true });
  document.addEventListener("keydown", startMusic, { once: true });
  // 앱이 뒤로 가면 소리를 멈춘다
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopMusic();
      ctx?.suspend();
    } else {
      startMusic();
    }
  });
}
