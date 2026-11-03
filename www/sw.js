// 오프라인 실행을 맡는 서비스 워커.
// 인터넷이 되면 항상 새 파일을 받고, 안 되거나 느리면 저장해 둔 파일로 실행한다.
const CACHE = "wuxia-v1";
const NETWORK_TIMEOUT = 4000;

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const list = await (await fetch("asset-list.json", { cache: "no-store" })).json();
    const cache = await caches.open(CACHE);
    await cache.addAll(list);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) if (name !== CACHE) await caches.delete(name);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request, { ignoreSearch: true });
    const network = fetch(request).then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    });
    if (!cached) return network.catch(async () => (await cache.match("index.html")) || Response.error());
    const timeout = new Promise((resolve) => { setTimeout(() => resolve(cached), NETWORK_TIMEOUT); });
    return Promise.race([network.catch(() => cached), timeout]);
  })());
});
