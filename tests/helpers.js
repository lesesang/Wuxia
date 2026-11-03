import { readFile } from "node:fs/promises";
import { beforeEach } from "node:test";
import { loadData } from "../www/js/data.js";
import { rng } from "../www/js/rng.js";
import { storage } from "../www/js/storage.js";

await loadData(async (name) => JSON.parse(await readFile(new URL(`../www/data/${name}.json`, import.meta.url), "utf-8")));

beforeEach(() => {
  storage.clearMemory();
  rng.random = Math.random;
});

/** 시드로 재현 가능한 난수 */
export function seed(value) {
  let state = value >>> 0;
  rng.random = () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
