// 난수 도우미. 테스트에서 고정할 수 있도록 한곳에 모았다.
export const rng = { random: Math.random };

export const randInt = (low, high) => low + Math.floor(rng.random() * (high - low + 1));
export const uniform = (low, high) => low + rng.random() * (high - low);
export const pick = (list) => list[Math.floor(rng.random() * list.length)];

export function pickWeighted(list, weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rng.random() * total;
  for (let i = 0; i < list.length; i++) {
    roll -= weights[i];
    if (roll < 0) return list[i];
  }
  return list[list.length - 1];
}

