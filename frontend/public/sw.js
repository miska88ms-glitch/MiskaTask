/* global self, caches, clients */
// Only public assets are cached. Never cache HTML sessions, API data or bundles.
const CACHE = "family-task-public-v1";
const PUBLIC_ASSETS = ["/offline.html", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/icon-180.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PUBLIC_ASSETS)));
  // An update waits for consent; a first installation activates normally.
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "ACTIVATE_UPDATE") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    await Promise.all((await caches.keys())
      .filter((key) => key.startsWith("family-task-public-") && key !== CACHE)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin ||
      url.pathname === "/api" || url.pathname.startsWith("/api/") ||
      request.headers.has("Authorization")) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(async () =>
      (await caches.match("/offline.html")) || new Response("Connessione assente. Riprova quando sei online.", {
        status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" },
      })));
  } else if (PUBLIC_ASSETS.includes(url.pathname) && !url.search) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
  }
});

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data?.json() || {}; } catch { /* Always show a visible notification. */ }
  event.waitUntil(self.registration.showNotification(data.title || "Family Task", {
    body: data.message || "Ci sono novità nella tua famiglia.",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { action_url: data.action_url || "/" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const raw = event.notification.data?.action_url;
  // Push can only open known in-app pages, never an external site or an API.
  const path = typeof raw === "string" && (/^\/task\/[a-zA-Z0-9_-]+$/.test(raw) || raw === "/rewards") ? raw : "/";
  const target = new URL(path, self.location.origin);
  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find((client) => new URL(client.url).origin === target.origin);
    if (existing) {
      await existing.navigate(target.href);
      await existing.focus();
    } else await clients.openWindow(target.href);
  })());
});