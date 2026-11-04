// 앞말의 받침에 맞는 조사를 고른다.

const DIGIT_FINALS = { 0: true, 1: true, 2: false, 3: true, 4: false, 5: false, 6: true, 7: true, 8: true, 9: false };
const RIEUL = 8;

function finalOf(word) {
  const last = String(word).trim().replace(/[』"')\]]+$/, "").slice(-1);
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
