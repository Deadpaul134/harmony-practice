/* Harmona service worker: versioned app-shell cache for offline; network-first HTML.
   Bump VERSION on every release that changes cached files. */
"use strict";
var VERSION = "ha-v2";
var APP = "ha-app-" + VERSION;
var FILES = [
  "./",
  "index.html",
  "privacy.html",
  "manifest.webmanifest",
  "js/game-core.js",
  "js/game-audio.js",
  "js/game-ui.js",
  "assets/icons/logo.svg",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
  "assets/icons/maskable-192.png",
  "assets/icons/maskable-512.png",
  "assets/icons/favicon-32.png",
  "assets/icons/apple-touch-180.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(APP).then(function (c) {
      return c.addAll(FILES.map(function (f) { return new Request(f, { cache: "reload" }); }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== APP; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function isAuthOrFirebase(url) {
  return /googleapis\.com|gstatic\.com|firebaseio\.com|firebaseapp\.com|firestore\.googleapis\.com|identitytoolkit|securetoken|accounts\.google\.com/.test(url);
}

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = req.url;
  if (isAuthOrFirebase(url)) return; // never cache Google/Firebase auth or API
  if (new URL(url).origin !== self.location.origin) return;

  if (req.mode === "navigate" || req.headers.get("accept") && req.headers.get("accept").indexOf("text/html") !== -1) {
    // network-first for HTML so updates arrive; offline → cached shell
    e.respondWith(
      fetch(req).then(function (r) {
        var cp = r.clone();
        caches.open(APP).then(function (c) {
          var path = new URL(req.url).pathname;
          if (path === "/" || path.endsWith("/index.html") || path.endsWith("/")) c.put("index.html", cp);
          else if (path.indexOf("privacy") !== -1) c.put("privacy.html", cp);
        });
        return r;
      }).catch(function () {
        var path = new URL(req.url).pathname;
        if (path.indexOf("privacy") !== -1) {
          return caches.match("privacy.html", { ignoreSearch: true }).then(function (h) {
            return h || caches.match("index.html", { ignoreSearch: true });
          });
        }
        return caches.match("index.html", { ignoreSearch: true });
      })
    );
    return;
  }

  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(function (hit) {
      return hit || fetch(req).then(function (r) {
        // cache same-origin static assets on first use
        if (r && r.ok) {
          var cp = r.clone();
          caches.open(APP).then(function (c) { c.put(req, cp); });
        }
        return r;
      });
    })
  );
});
