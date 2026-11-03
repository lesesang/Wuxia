// 게임 데이터(JSON) 저장소. 시작할 때 한 번 읽어 DB에 넣는다.
export const DB = {};

const FILES = ["skills", "enemies", "market", "traits", "sects", "flavor", "fortunes", "origins",
  "chapters", "realms", "endings", "balance", "karma", "events_chains", "events_story", "events_random", "events_sect", "events_jianghu"];

/** read(파일이름)은 해당 JSON 내용을 돌려주는 비동기 함수 */
export async function loadData(read) {
  const results = await Promise.all(FILES.map((name) => read(name)));
  FILES.forEach((name, i) => { DB[name] = results[i]; });
  DB.storyEvents = DB.events_story;
  DB.randomEvents = { ...DB.events_random, ...DB.events_sect, ...DB.events_jianghu };
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
  // 기틀과 누적 보상은 숨은 특성으로 등록해 특성과 같은 방식으로 적용한다
  for (const [key, upgrade] of Object.entries(DB.karma.upgrades)) {
    upgrade.costs.forEach((_, i) => {
      DB.traits[`환생_${key}_${i + 1}`] = { name: upgrade.name, desc: upgrade.desc, hidden: true, effects: upgrade.effects };
    });
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
