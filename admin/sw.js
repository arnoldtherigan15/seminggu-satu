// Service Worker — Dashboard Admin Seminggu Satu
// Strategi: network-first (biar kode & data selalu fresh), fallback ke cache saat offline.
// Scope = folder /admin/, jadi TIDAK mengintervensi request ke Apps Script (beda origin).

const CACHE = "ss-admin-v4";
const CORE = [
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return; // biarkan POST (submit/login) langsung ke jaringan
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // jangan intercept API (script.google.com)

  // halaman & file admin selalu dicek ulang ke server (bukan cache browser 10 menit
  // dari GitHub Pages) -- biar update baru langsung kepake begitu app dibuka
  const fresh = req.mode === "navigate" || /\.(html|css|js)$/.test(url.pathname);
  e.respondWith(
    fetch(fresh ? new Request(req, { cache: "no-cache" }) : req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req).then((m) => m || caches.match("./index.html")))
  );
});

// ---- Push notif (dikirim admin-api / notif Telegram, lihat _shared/admin-push.ts) ----
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { title: "Seminggu Satu", body: e.data ? e.data.text() : "" }; }
  const title = d.title || "Seminggu Satu";
  e.waitUntil((async () => {
    await self.registration.showNotification(title, {
      body: d.body || "",
      icon: "./icon-192.png",
      badge: "./icon-192.png",
      tag: d.tag || undefined,
      data: { url: d.url || "./#activity" },
    });
    // titik merah di ikon app (kalau didukung)
    try { if (self.navigator.setAppBadge) await self.navigator.setAppBadge(); } catch (err) {}
  })());
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const target = new URL((e.notification.data && e.notification.data.url) || "./#activity", self.location.origin + "/admin/").href;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const w of wins) {
      if (w.url.includes("/admin/")) { await w.focus(); try { await w.navigate(target); } catch (err) { w.postMessage({ type: "nav", url: target }); } return; }
    }
    await self.clients.openWindow(target);
  })());
});
