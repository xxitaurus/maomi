/* 猫咪打卡 Service Worker
   策略：
   - HTML 用「网络优先 + 断网回退缓存」→ 保证每次打开都拿到最新版本
   - 静态资源（图标/manifest）用缓存优先
   这样你更新了服务器上的 index.html，用户下次打开就是新版，无需重装。 */

const CACHE = "cat-checkin-v1";
const SHELL = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL).catch(() => {})));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // 云端接口（Supabase）不缓存，直接走网络
  if (url.hostname.includes("supabase.co") || url.port === "8899") return;

  const isDoc = req.mode === "navigate" || /\.html?$/.test(url.pathname) || url.pathname.endsWith("/");

  if (isDoc) {
    // 网络优先：确保拿到最新版
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(req).then(r => r || caches.match("./index.html")))
    );
    return;
  }

  // 其他静态资源：缓存优先
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => hit))
  );
});
