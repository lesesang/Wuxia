// 앞말의 받침에 맞는 조사를 고른다.

const DIGIT_FINALS = { 0: true, 1: true, 2: false, 3: true, 4: false, 5: false, 6: true, 7: true, 8: true, 9: false };
const RIEUL = 8;

function finalOf(word) {
  const last = String(word).trim().replace(/[』〉"')\]]+$/, "").slice(-1);
  const code = last.charCodeAt(0) - 0xac00;
  if (code >= 0 && code <= 11171) return code % 28;
  return DIGIT_FINALS[last] ? 1 : 0;
}

/** josa("천마", "을/를") → "를". 받침 있을 때 쓸 말을 앞에 적는다. */
export function josa(word, pair) {
  const [withFinal, withoutFinal] = pair.split("/");
  const final = finalOf(word);
  if (withFinal === "으로") return final && final !== RIEUL ? "으로" : "로";
  return final ? withFinal : withoutFinal;
}

/** 비율을 할과 푼으로 적는다. 30은 3할, 8은 8푼, 25는 2할 5푼이다. */
export function halpun(percent) {
  const tenths = Math.round(Math.abs(percent) * 10);
  const hal = Math.floor(tenths / 100);
  const pun = Math.floor((tenths % 100) / 10);
  const ri = tenths % 10;
  const parts = [hal && `${hal}할`, pun && `${pun}푼`, ri && `${ri}리`].filter(Boolean);
  return `${percent < 0 ? "-" : ""}${parts.join(" ") || "0푼"}`;
}
