const CACHE_NAME = "super-rc-v16";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./chapters.json",
  "./chapters/第01章-最后一秒.md",
  "./chapters/第02章-退队通知.md",
  "./chapters/第03章-第一台车.md",
  "./chapters/第04章-残阵.md",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
      .then(() =>
        self.clients
          .matchAll({ type: "window", includeUncontrolled: true })
          .then((clients) =>
            Promise.all(
              clients.map((client) => client.navigate(client.url).catch(() => {}))
            )
          )
      )
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);

  // 跨域请求（GitHub API / raw 文件）不拦截
  if (url.origin !== self.location.origin) return;

  // 密钥列表不缓存，始终优先获取最新版本
  if (url.pathname.endsWith("/admin-keys.json")) {
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
    return;
  }

  // 应用外壳：网络优先，确保更新立即生效；离线时回退缓存
  const isShell =
    event.request.mode === "navigate" ||
    url.pathname.endsWith("/index.html") ||
    url.pathname.endsWith("/styles.css") ||
    url.pathname.endsWith("/app.js") ||
    url.pathname.endsWith("/manifest.webmanifest") ||
    url.pathname.endsWith("/chapters.json");

  if (isShell) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(event.request, copy))
            .catch(() => {});
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // 其余资源（章节正文、图标）：缓存优先，离线可用
  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ||
        fetch(event.request).then((response) => {
          const copy = response.clone();
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(event.request, copy))
            .catch(() => {});
          return response;
        })
    )
  );
});
