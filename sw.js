// Bump this version string any time you deploy a change — it busts the cache.
const CACHE_VERSION = 'shared-bonsai-v3';
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './icon.png',
    './manifest.json'
];

// Install: cache all local assets
self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_VERSION).then((cache) => cache.addAll(ASSETS))
    );
});

// Activate: remove old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

// Fetch: network-first for app.js (keeps Firebase live), cache-first for everything else
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Always go network-first for the Firebase CDN and app.js so updates propagate
    const networkFirst = url.hostname.includes('firebase') ||
        url.pathname.endsWith('app.js') ||
        url.pathname.endsWith('index.html');

    if (networkFirst) {
        event.respondWith(
            fetch(event.request)
                .then((res) => {
                    // Cache a fresh copy
                    const clone = res.clone();
                    caches.open(CACHE_VERSION).then((c) => c.put(event.request, clone));
                    return res;
                })
                .catch(() => caches.match(event.request))
        );
    } else {
        // Cache-first for fonts, icons, CSS
        event.respondWith(
            caches.match(event.request).then((cached) => cached || fetch(event.request))
        );
    }
});
