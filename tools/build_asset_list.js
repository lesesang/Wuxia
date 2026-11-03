// 오프라인 실행에 필요한 파일 목록(www/asset-list.json)을 만든다. www의 파일을 늘리면 다시 돌린다.
import { readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

export function listAssets(www) {
  const walk = (dir) => readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [relative(www, path).split("\\").join("/")];
  });
  return walk(www).filter((p) => !["sw.js", "asset-list.json", "CNAME", ".nojekyll"].includes(p)).sort();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const www = fileURLToPath(new URL("../www", import.meta.url));
  writeFileSync(join(www, "asset-list.json"), `${JSON.stringify(listAssets(www), null, 1)}\n`);
}
