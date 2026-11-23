/* Harmona service worker: versioned app-shell cache for offline; network-first HTML.
   Bump VERSION on every release that changes cached files. */
"use strict";
var VERSION = "ha-v9";
var APP = "ha-app-" + VERSION;
// piano samples live in their own cache that survives app version bumps;
// rename it only when the sample files themselves change.
var PIANO = "ha-piano-v1";
var PIANO_RE = /\/assets\/piano\/[A-Za-z0-9]+\.mp3$/;
// best-effort precache of the core samples (~230 KB); the rest are cached on first use
var PIANO_CORE = ["Fs3", "A3", "C4", "Ds4", "Fs4", "A4", "C5", "Ds5"].map(function (n) {
  return "assets/piano/" + n + ".mp3";
});
var FILES = [
  "./",
  "index.html",
  "privacy.html",
  "manifest.webmanifest",
  "css/kids.css",
  "js/game-core.js",
  "js/sync-math.js",
  "js/piano-sampler.js",
  "js/game-audio.js",
  "js/game-ui.js",
  "js/kids-music.js",
  "js/kids-lessons.js",
  "js/kids-core.js",
  "js/kids-ui.js",
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
    }).then(precachePiano).then(function () { return self.skipWaiting(); })
  );
});

// fetch only core samples not cached yet; never fails the install
function precachePiano() {
  return caches.open(PIANO).then(function (c) {
    return Promise.all(PIANO_CORE.map(function (f) {
      return c.match(f).then(function (hit) {
        if (hit) return;
        return fetch(f).then(function (r) { if (r && r.ok && r.status === 200) return c.put(f, r); });
      }).catch(function () {});
    }));
  }).catch(function () {});
}

function pianoFetch(req) {
  return caches.open(PIANO).then(function (c) {
    return c.match(req, { ignoreSearch: true }).then(function (hit) {
      return hit || fetch(req).then(function (r) {
        if (r && r.ok && r.status === 200) c.put(req, r.clone()).catch(function () {});
        return r;
      });
    });
  });
}

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== APP && k !== PIANO; }).map(function (k) { return caches.delete(k); }));
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

  if (PIANO_RE.test(new URL(url).pathname)) { e.respondWith(pianoFetch(req)); return; } // cache-first

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
