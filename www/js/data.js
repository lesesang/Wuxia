// 게임 데이터(JSON) 저장소. 시작할 때 한 번 읽어 DB에 넣는다.
export const DB = {};

const FILES = ["skills", "enemies", "market", "traits", "sects", "flavor", "fortunes", "origins",
  "chapters", "realms", "endings", "events_story", "events_random", "events_sect", "events_jianghu"];

/** read(파일이름)은 해당 JSON 내용을 돌려주는 비동기 함수 */
export async function loadData(read) {
  const results = await Promise.all(FILES.map((name) => read(name)));
  FILES.forEach((name, i) => { DB[name] = results[i]; });
  DB.storyEvents = DB.events_story;
  DB.randomEvents = { ...DB.events_random, ...DB.events_sect, ...DB.events_jianghu };
  DB.events = { ...DB.storyEvents, ...DB.randomEvents };
}

export function loadDataInBrowser() {
  return loadData(async (name) => {
    const response = await fetch(`data/${name}.json`);
    if (!response.ok) throw new Error(`데이터를 읽지 못했습니다: ${name}`);
    return response.json();
  });
}
