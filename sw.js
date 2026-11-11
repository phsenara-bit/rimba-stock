const CACHE_NAME = "rimba-alam-v5.6";
const ASSETS = [
  "./",
  "./index.html",
  "./css/app.css",
  "./js/catalog-data.js",
  "./js/data-service.js",
  "./js/auth-service.js",
  "./js/app.js",
  "./manifest.json",
  "./img/logo-full-white.png",
  "./img/top-bar-icon.png",
  "./img/icon-192.png",
  "./img/icon-512.png",
  "./img/favicon.png"
];

// Install: Cache core assets for offline usage
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS).catch((err) => {
        console.warn("[SW] Cache addAll warning:", err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate: Clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Network-first for dynamic data, cache fallback for offline
self.addEventListener("fetch", (event) => {
  // Biarkan request API Google Apps Script atau proxy langsung tembus jaringan
  if (event.request.url.includes("script.google.com") || event.request.url.includes("/api/")) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Simpan salinan terbaru ke cache jika berhasil
        if (response && response.status === 200 && response.type === "basic") {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Jika offline, ambil dari cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          if (event.request.headers.get("accept")?.includes("text/html")) {
            return caches.match("./index.html");
          }
        });
      })
  );
});
