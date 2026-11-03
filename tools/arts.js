// 측정용 봇이 사람처럼 가장 센 무공을 골라 쓰게 한다. 게임은 무공을 저절로 바꾸지 않는다.
export function pickArts(p) {
  const attacks = p.skillsOfType("공격무공");
  if (attacks.length) p.mainSkill = attacks.reduce((a, b) => (b.effectiveMultiplier() > a.effectiveMultiplier() ? b : a)).key;
  const score = (s) => Object.values(s.effect).reduce((t, v) => t + Math.max(v, 0), 0);
  for (const type of ["심공", "경공"]) {
    const options = p.skillsOfType(type);
    if (options.length) p.chosenArts[type] = options.reduce((a, b) => (score(b) > score(a) ? b : a)).key;
  }
}
