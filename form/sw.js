/* ============================================================
   SAHA Form — Service Worker (PWA offline)
   ATURAN PIPELINE: SETIAP deploy yang menyentuh folder form/
   WAJIB menaikkan CACHE_NAME di bawah (v46 -> v47 dst).
   Strategi:
   - HTML / navigasi  : network-first (deploy langsung kebaca), fallback cache
   - Aset lokal (js/png/json) : cache-first + update diam-diam di belakang
   - gstatic/fonts    : cache-first (URL versi beku, aman)
   - firestore/API    : TIDAK disentuh SW (langsung network) — SDK punya antrian sendiri
   ============================================================ */
var CACHE_NAME = 'saha-form-v63';
var PRECACHE = [
  './', 'index.html',
  'chemsex.html', 'dast10.html', 'srq29.html', 'gabungan.html', 'ira.html',
  'gra.html', 'konseling.html', 'bulanan.html', 'prevkit.html', 'checkin.html',
  'papan.html', 'portal.html',
  'saha-data.js', 'saha-shared.js', 'saha-roster.js',
  'logo.png', 'manifest.json', 'icon-192.png', 'icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function (c) {
      /* addAll gagal total kalau 1 file gagal — pakai satu-satu supaya tangguh */
      return Promise.all(PRECACHE.map(function (u) {
        return c.add(u).catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) {
        return k.indexOf('saha-form-') === 0 && k !== CACHE_NAME;
      }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return; /* POST dll (Firestore) lewat langsung */
  var url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return;

  var sameOrigin = (url.origin === self.location.origin);
  var isGstatic = url.hostname === 'www.gstatic.com' || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';

  /* Firestore / auth / API Google lain: jangan disentuh */
  if (!sameOrigin && !isGstatic) return;

  var isHTML = req.mode === 'navigate' || url.pathname.slice(-5) === '.html' || url.pathname.slice(-1) === '/';

  if (sameOrigin && isHTML) {
    /* NETWORK-FIRST: deploy terbaru selalu menang saat online */
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE_NAME).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () {
        return caches.match(req).then(function (hit) {
          return hit || caches.match('index.html');
        });
      })
    );
    return;
  }

  /* CACHE-FIRST + refresh di belakang: aset lokal & gstatic */
  e.respondWith(
    caches.match(req).then(function (hit) {
      var net = fetch(req).then(function (res) {
        if (res && res.status === 200) {
          var copy = res.clone();
          caches.open(CACHE_NAME).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () { return hit; });
      return hit || net;
    })
  );
});
