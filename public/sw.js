/* The meal planner's service worker. It does three small things:
 *  1. keeps the app's own build files (JS, CSS, icons) so pages open fast and without signal;
 *  2. keeps the in-store shopping list page, so it opens with no signal in the store;
 *  3. shows a simple "you're offline" page, with a button to that list, when a page cannot load.
 * Everything else goes straight to the network. Nothing here changes what the app does while you are online.
 */
const VERSION = "v1";
const STATIC = `mp-static-${VERSION}`;
const PAGES = `mp-pages-${VERSION}`;
const IN_STORE = "/shopping/store";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        if (name !== STATIC && name !== PAGES) await caches.delete(name);
      }
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(req));
    return;
  }
  if (req.mode === "navigate") event.respondWith(navigate(req, url));
});

async function cacheFirst(req) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

// Network first, but give up after a few seconds so a weak signal does not leave a blank screen.
function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error("slow")), ms))]);
}

async function navigate(req, url) {
  const isList = url.pathname === IN_STORE;
  try {
    const res = await withTimeout(fetch(req), isList ? 4000 : 15000);
    if (isList && res.ok && !res.redirected) {
      const cache = await caches.open(PAGES);
      await cache.put(req.url, res.clone());
      void cacheAssetsOf(res.clone());
    }
    return res;
  } catch {
    if (isList) {
      // The exact page if we kept it. Otherwise the list we kept most recently (the home screen shortcut has no week).
      const cache = await caches.open(PAGES);
      const hit = (await cache.match(req.url)) || (await cache.match(req.url, { ignoreSearch: true }));
      if (hit) return hit;
    }
    return offlinePage();
  }
}

// Also keep the build files a page uses, so the page works when it opens with no signal.
async function cacheAssetsOf(res) {
  try {
    const html = await res.text();
    const cache = await caches.open(STATIC);
    const urls = new Set(html.match(/\/_next\/static\/[^"'\\\s)]+\.(?:js|css)/g) || []);
    await Promise.all([...urls].map(async (u) => ((await cache.match(u)) ? null : cache.add(u).catch(() => null))));
  } catch {
    // keeping extra files is a bonus
  }
}

async function offlinePage() {
  const keys = await (await caches.open(PAGES)).keys();
  const last = keys.length ? new URL(keys[keys.length - 1].url) : null;
  const link = last
    ? `<a class="go" href="${last.pathname}${last.search}">Open your shopping list</a>`
    : `<p>Open the app once with signal, then the shopping list will be ready for the store.</p>`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline</title>
<style>:root{color-scheme:light dark}body{font:18px/1.45 system-ui,sans-serif;margin:0;padding:2rem 1.25rem;max-width:30rem;margin-inline:auto}
h1{font-size:1.5rem}.go{display:block;text-align:center;background:#15803d;color:#fff;padding:1rem;border-radius:.75rem;text-decoration:none;font-weight:600;margin:1.25rem 0}
button{font:inherit;padding:.75rem 1rem;border-radius:.75rem;border:1px solid #888;background:transparent;color:inherit}</style></head>
<body><h1>You're offline</h1><p>This page needs a connection.</p>${link}<button onclick="location.reload()">Try again</button></body></html>`;
  return new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "cache-page" && typeof data.url === "string") {
    event.waitUntil(cachePage(data.url));
  }
  if (data.type === "clear") {
    event.waitUntil(Promise.all([caches.delete(PAGES), caches.delete(STATIC)]));
  }
});

async function cachePage(path) {
  try {
    const url = new URL(path, self.location.origin);
    if (url.origin !== self.location.origin || url.pathname !== IN_STORE) return;
    const res = await fetch(url.href, { credentials: "same-origin" });
    if (!res.ok || res.redirected) return;
    const cache = await caches.open(PAGES);
    await cache.put(url.href, res.clone());
    await cacheAssetsOf(res.clone());
  } catch {
    // no signal right now; try again next time
  }
}
