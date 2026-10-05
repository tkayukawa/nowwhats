/*
 * オフラインでも画面を開けるようにする Service Worker（ステップ 4-3）。
 * - インストール時: precache-manifest.json に列挙されたビルド成果物をまとめてキャッシュする
 * - 画面の読み込み（navigate）: ネットワーク優先。失敗したらキャッシュした index.html を返す
 * - その他の同一オリジンの GET: キャッシュ優先（ファイル名にハッシュが含まれるため内容は変わらない）
 * - /api: キャッシュしない（同期は Outbox と同期処理が担う）
 */
const CACHE_PREFIX = "nowwhats-";
const META_CACHE = `${CACHE_PREFIX}meta`;
const VERSION_KEY = "/__precache-version";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const res = await fetch("/precache-manifest.json", { cache: "no-store" });
      const { version, files } = await res.json();
      const cache = await caches.open(CACHE_PREFIX + version);
      await cache.addAll(files);
      const meta = await caches.open(META_CACHE);
      await meta.put(VERSION_KEY, new Response(version));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const current = await currentCacheName();
      for (const name of await caches.keys()) {
        if (name.startsWith(CACHE_PREFIX) && name !== META_CACHE && name !== current) {
          await caches.delete(name);
        }
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/")
  ) {
    return;
  }
  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request));
    return;
  }
  event.respondWith(cacheFirst(request));
});

const currentCacheName = async () => {
  const meta = await caches.open(META_CACHE);
  const res = await meta.match(VERSION_KEY);
  return res === undefined ? null : CACHE_PREFIX + (await res.text());
};

const networkFirstPage = async (request) => {
  try {
    return await fetch(request);
  } catch (e) {
    const name = await currentCacheName();
    const cached = name === null ? undefined : await (await caches.open(name)).match("/");
    if (cached !== undefined) return cached;
    throw e;
  }
};

const cacheFirst = async (request) => {
  const cached = await caches.match(request);
  return cached ?? fetch(request);
};
