// 게임 데이터(JSON) 저장소. 시작할 때 한 번 읽어 DB에 넣는다.
export const DB = {};

const FILES = ["skills", "enemies", "market", "traits", "sects", "flavor", "fortunes", "origins",
  "chapters", "realms", "endings", "balance", "karma", "companions", "difficulty", "events_chains", "events_story", "events_random", "events_sect", "events_jianghu",
  "events_action", "events_deep"];

/** read(파일이름)은 해당 JSON 내용을 돌려주는 비동기 함수 */
export async function loadData(read) {
  const results = await Promise.all(FILES.map((name) => read(name)));
  FILES.forEach((name, i) => { DB[name] = results[i]; });
  DB.storyEvents = DB.events_story;
  // 수련, 운기, 요양 중의 사건(action)과 깊은 강호의 사건도 여기에 함께 둔다. 탐색에는 action 사건이 나오지 않는다
  DB.randomEvents = { ...DB.events_random, ...DB.events_sect, ...DB.events_jianghu, ...DB.events_action, ...DB.events_deep };
  DB.events = { ...DB.storyEvents, ...DB.randomEvents };
  // 연계 인카운터: 첫 편만 탐색에 나오고 나머지는 정해진 달에 찾아온다
  DB.chains = {};
  for (const [id, chain] of Object.entries(DB.events_chains)) {
    const keys = chain.steps.map((_, i) => `연계_${id}_${i}`);
    DB.chains[id] = {
      title: chain.title, keys, gaps: chain.steps.map((s) => s.gap),
      span: chain.steps.reduce((sum, s) => sum + s.gap, 0),
    };
    chain.steps.forEach((step, i) => {
      const { gap, ...event } = step;
      const entry = { ...event, chain: { id, index: i, total: keys.length } };
      if (i === 0) {
        entry.chapters = chain.chapters;
        if (chain.requires) entry.requires = chain.requires;
        DB.randomEvents[keys[i]] = entry;
      }
      DB.events[keys[i]] = entry;
    });
  }
  // 한 사건 안의 다음 장면. 그 사건의 키 뒤에 장면 이름을 붙인다. 탐색에는 나오지 않는다
  for (const [key, event] of Object.entries({ ...DB.events })) {
    for (const [scene, body] of Object.entries(event.parts || {})) {
      DB.events[`${key}:${scene}`] = { title: event.title, ...body, scene_of: key };
    }
  }
  // 경지 특전도 숨은 특성으로 적용한다
  for (const [realm, perk] of Object.entries(DB.realms.perks)) {
    DB.traits[`경지_${realm}`] = { name: perk.name, desc: perk.desc, hidden: true, effects: perk.effects };
    // 더 높은 경지에 오르면 지난 경지의 특전도 깊어진다
    for (const [next, growth] of Object.entries(perk.growth || {})) {
      DB.traits[`경지_${realm}_${next}`] = { name: perk.name, desc: growth.desc, hidden: true, effects: growth.effects };
    }
  }
  // 기틀과 누적 보상은 숨은 특성으로 등록해 특성과 같은 방식으로 적용한다
  for (const [key, upgrade] of Object.entries(DB.karma.upgrades)) {
    upgrade.costs.forEach((_, i) => {
      DB.traits[`환생_${key}_${i + 1}`] = { name: upgrade.name, desc: upgrade.desc, hidden: true, effects: upgrade.effects };
    });
  }
  for (const [key, item] of Object.entries(DB.karma.provisions)) {
    DB.traits[`채비_${key}`] = { name: item.name, desc: item.desc, hidden: true, effects: item.effects };
  }
  // 깊은 강호에서는 기량이 조금 더디게 오른다. 숨은 특성으로 적용한다
  for (const [key, level] of Object.entries(DB.difficulty.levels)) {
    if (!level.growth) continue;
    DB.traits[`강호_${key}`] = { name: level.name, desc: level.desc, hidden: true,
      effects: ["external", "internal", "martial", "mind"].map((stat) => ({ type: "growth_rate", stat, percent: level.growth })) };
  }
  // 한 길의 단계를 처음 넘을 때 얻는 깨달음도 숨은 특성으로 적용한다
  for (const [side, path] of Object.entries(DB.balance.paths)) {
    path.steps.forEach((step, i) => { DB.traits[`길_${side}_${i + 1}`] = { ...step, path: path.name, hidden: true }; });
  }
  for (const reward of DB.karma.rewards) {
    DB.traits[`누적_${reward.at}`] = { name: reward.name, desc: reward.desc, hidden: true, effects: reward.effects };
  }
}

export function loadDataInBrowser() {
  return loadData(async (name) => {
    const response = await fetch(`data/${name}.json`);
    if (!response.ok) throw new Error(`데이터를 읽지 못했습니다: ${name}`);
    return response.json();
  });
}
