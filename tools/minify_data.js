// 배포할 때만 www/data의 JSON을 한 줄로 줄인다. 원본은 고치기 편하게 들여쓴 채로 둔다.
//   node tools/minify_data.js [폴더]   (기본 www/data)
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2] || new URL("../www/data", import.meta.url).pathname;
let before = 0, after = 0;
for (const name of readdirSync(dir).filter((n) => n.endsWith(".json"))) {
  const path = join(dir, name);
  const raw = readFileSync(path, "utf-8");
  const mini = JSON.stringify(JSON.parse(raw));
  before += Buffer.byteLength(raw); after += Buffer.byteLength(mini);
  writeFileSync(path, mini);
}
console.log(`자료 ${Math.round(before / 1024)}KB → ${Math.round(after / 1024)}KB`);
