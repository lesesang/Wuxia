// 저장소. 지금은 브라우저의 localStorage를 쓴다.
// 앱으로 포장할 때 네이티브 저장소로 바꾸려면 이 파일만 고치면 된다.
const memory = new Map();

function backend() {
  try { return globalThis.localStorage || null; } catch { return null; }
}

export const storage = {
  get(key) {
    try {
      const store = backend();
      if (store) return store.getItem(key);
    } catch { /* 아래 메모리 값을 쓴다 */ }
    return memory.has(key) ? memory.get(key) : null;
  },
  set(key, value) {
    memory.set(key, value);
    try { backend()?.setItem(key, value); } catch { /* 저장 공간이 없어도 게임은 계속된다 */ }
  },
  remove(key) {
    memory.delete(key);
    try { backend()?.removeItem(key); } catch { /* 무시 */ }
  },
  clearMemory() { memory.clear(); },
};
