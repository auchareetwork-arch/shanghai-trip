// Offline support: the page opens without internet after the first visit.
// Same-origin files: network first (so updates arrive), cached copy if offline or slow (>3s).
// Google Fonts: cache first.
const CACHE = 'shanghai-trip-v1';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function fromCache(req) {
  return caches.match(req, { ignoreSearch: true })
    .then((r) => r || caches.match('./index.html'))
    .then((r) => r || Response.error());
}

function networkFirst(req) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (p) => { if (!done) { done = true; resolve(p); } };
    const timer = setTimeout(() => {
      caches.match(req, { ignoreSearch: true }).then((r) => { if (r) finish(r); });
    }, 3000);
    fetch(req)
      .then((res) => {
        clearTimeout(timer);
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        finish(res);
      })
      .catch(() => { clearTimeout(timer); finish(fromCache(req)); });
  });
}

function cacheFirst(req) {
  return caches.match(req).then((r) => r || fetch(req).then((res) => {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(req, copy));
    return res;
  }));
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) e.respondWith(networkFirst(req));
  else if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') e.respondWith(cacheFirst(req));
});
