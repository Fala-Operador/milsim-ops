// Service Worker do MilSim Ops: mantém os arquivos da aplicação para uso sem internet.
// Estratégia: rede primeiro; sem conexão, responde com a cópia guardada.
const CACHE = "milsim-offline-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("message", (e) => {
  if (!e.data || e.data.tipo !== "cachear") return;
  const urls = e.data.urls || [];
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(urls.map((u) => fetch(u, { cache: "reload" }).then((r) => (r.ok ? c.put(u, r) : null)).catch(() => null))))
      .then(async (res) => {
        const ok = res.filter(Boolean).length;
        e.source && e.source.postMessage({ tipo: "cacheado", ok, total: urls.length });
      }),
  );
});

self.addEventListener("fetch", (e) => {
  const r = e.request;
  if (r.method !== "GET") return;
  const u = new URL(r.url);
  if (u.origin !== self.location.origin || u.pathname.startsWith("/_serverFn")) return;
  e.respondWith(
    fetch(r)
      .then((res) => {
        if (res.ok && res.type === "basic") {
          const copia = res.clone();
          caches.open(CACHE).then((c) => c.put(r, copia));
        }
        return res;
      })
      .catch(() =>
        caches.match(r, { ignoreSearch: r.mode === "navigate" }).then((m) => m || (r.mode === "navigate" ? caches.match(u.pathname) : undefined)).then((m) => m || Response.error()),
      ),
  );
});
