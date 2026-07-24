// Service Worker — Sahabat (Member Hub) Seminggu Satu
// Strategi: network-first (kode & data selalu fresh), fallback ke cache saat offline.
// Scope = folder /sahabat/, jadi TIDAK mengintervensi request ke Apps Script (beda origin).

const CACHE = "ss-sahabat-v3";
const CORE = [
  "./index.html",
  "./main.js",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
  "./seal-paw.png",
  "./list_prompt.json"
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
  if (req.method !== "GET") return; // biarkan POST (login/submit) langsung ke jaringan
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // jangan intercept API (script.google.com)

  e.respondWith(
    fetch(req)
      .then((res) => {
        // jangan cache response gagal (mis. 404 pas deploy) — bikin error "nempel"
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      // fallback index.html cuma buat navigasi halaman, jangan buat JSON/gambar
      .catch(() => caches.match(req).then((m) => m || (req.mode === "navigate" ? caches.match("./index.html") : Response.error())))
  );
});
