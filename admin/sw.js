// Service Worker — Dashboard Admin Seminggu Satu
// Strategi: network-first (biar kode & data selalu fresh), fallback ke cache saat offline.
// Scope = folder /admin/, jadi TIDAK mengintervensi request ke Apps Script (beda origin).

const CACHE = "ss-admin-v2";
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

  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req).then((m) => m || caches.match("./index.html")))
  );
});
