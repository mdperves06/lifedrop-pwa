/* LifeDrop service worker — offline fallback, static caching, web push. */
const VERSION = "v1";
const STATIC_CACHE = `ld-static-${VERSION}`;
const PAGE_CACHE = `ld-pages-${VERSION}`;
const OFFLINE_URL = "/offline";
const PRECACHE = [OFFLINE_URL, "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/badge-72.png"];
// Only public, non-personal pages are cached for offline reading.
const PUBLIC_PAGES = ["/", "/learn", "/eligibility", "/centers", "/inventory", "/campaigns"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => ![STATIC_CACHE, PAGE_CACHE].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
  if (event.data?.type === "CLEAR_PRIVATE") caches.delete(PAGE_CACHE);
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // never cache API data

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname.startsWith("/images/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC_CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  if (req.mode === "navigate") {
    const cacheable = PUBLIC_PAGES.includes(url.pathname);
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (cacheable && res.ok) {
            const copy = res.clone();
            caches.open(PAGE_CACHE).then((c) => c.put(url.pathname, copy));
          }
          return res;
        })
        .catch(async () => (cacheable && (await caches.match(url.pathname))) || (await caches.match(OFFLINE_URL)) || Response.error()),
    );
  }
});

// ─────────────────────────────── Push ───────────────────────────────

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "LifeDrop", body: event.data ? event.data.text() : "" };
  }
  const actions = data.donationRequestId
    ? [
        { action: "accept", title: "Accept" },
        { action: "decline", title: "Decline" },
      ]
    : [];
  event.waitUntil(
    (async () => {
      await self.registration.showNotification(data.title || "LifeDrop", {
        body: data.body || "",
        icon: "/icons/icon-192.png",
        badge: "/icons/badge-72.png",
        tag: data.tag,
        renotify: !!data.urgent,
        requireInteraction: !!data.urgent,
        vibrate: data.urgent ? [200, 100, 200] : undefined,
        actions,
        data: { url: data.url || "/notifications", donationRequestId: data.donationRequestId },
      });
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      clients.forEach((c) => c.postMessage({ type: "push-received" }));
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const { url, donationRequestId } = event.notification.data || {};
  const respond = async (action) => {
    try {
      const res = await fetch(`/api/donation-requests/${donationRequestId}/respond`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const ok = res.ok;
      await self.registration.showNotification(ok ? (action === "ACCEPT" ? "Thank you for accepting!" : "Response sent") : "Couldn't send your response", {
        body: ok ? (action === "ACCEPT" ? "The requester can now contact you. Open LifeDrop for details." : "We've let the requester know.") : "Open LifeDrop to respond.",
        icon: "/icons/icon-192.png",
        badge: "/icons/badge-72.png",
        data: { url },
      });
    } catch {
      await openUrl(url);
    }
  };
  if (donationRequestId && event.action === "accept") return event.waitUntil(respond("ACCEPT"));
  if (donationRequestId && event.action === "decline") return event.waitUntil(respond("DECLINE"));
  event.waitUntil(openUrl(url || "/"));
});

async function openUrl(url) {
  const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const c of all) {
    if ("focus" in c) {
      await c.focus();
      if ("navigate" in c) return c.navigate(url);
      return;
    }
  }
  return self.clients.openWindow(url);
}
