// Mochi Paint service worker.
// Core app shell is precached on install so the app opens and works fully
// offline (a Play Store requirement — never show a browser error page).
// Runtime strategy stays network-first: fresh files whenever online, cached
// copy when the network is gone.
var CACHE = "mochi-paint-v24";
var CORE = [
  "/",
  "/home",
  "/home.html",
  "/theme",
  "/theme.html",
  "/privacy.html",
  "/data-deletion.html",
  "/app.js",
  "/pals.js",
  "/style.css",
  "/animations.css",
  "/fonts.css",
  "/parental-gate.css",
  "/parental-gate.js",
  "/fonts/poppins-400.woff2",
  "/fonts/poppins-500.woff2",
  "/fonts/poppins-600.woff2",
  "/fonts/poppins-700.woff2",
  "/fonts/baloo-2-latin.woff2",
  "/fonts/nunito-latin.woff2",
  "/fonts/quicksand-latin.woff2",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-512-maskable.png",
  "/hero-pals.png",
  "/coloring-pages/meadow/usagi-bunny.png",
  "/coloring-pages/meadow/previews/usagi-bunny-color.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(CORE); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request)
      .then(function (res) {
        if (res.ok && e.request.url.indexOf(self.location.origin) === 0) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        }
        return res;
      })
      .catch(function () {
        // Offline: serve the cached copy. Deep links like /?pal=usagi must
        // still resolve to the cached studio shell, so navigations ignore
        // the query string and finally fall back to the app root.
        // ignoreSearch lets versioned URLs (app.js?v=2) hit the precached
        // bare paths, and deep links (/?pal=usagi) hit the cached shell.
        if (e.request.mode === "navigate") {
          return caches.match(e.request, { ignoreSearch: true }).then(function (r) {
            return r || caches.match("/");
          });
        }
        return caches.match(e.request, { ignoreSearch: true }).then(function (r) {
          return r || new Response("This asset is not available offline yet.", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" }
          });
        });
      })
  );
});
