/* McAleese Strength — service worker.
   Bump CACHE_VERSION whenever you edit the app or any program file,
   then push — clients pick up the new version on their next visit. */
const CACHE_VERSION = 'ms-v2';

const SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './programs/profiles.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    await cache.addAll(SHELL);
    // Cache every program file listed in profiles.json, so new people
    // added to the roster are picked up automatically.
    try {
      const res = await fetch('./programs/profiles.json', { cache: 'no-cache' });
      const data = await res.json();
      const files = (data.profiles || []).map(p => './' + p.file);
      await cache.addAll(files);
    } catch (e) { /* offline install — shell alone is fine */ }
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)));
    self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== location.origin) return;

  // Programs: network-first so edits show up quickly, cache fallback offline.
  if (url.pathname.includes('/programs/')) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_VERSION);
      try {
        const fresh = await fetch(event.request);
        cache.put(event.request, fresh.clone());
        return fresh;
      } catch (e) {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        throw e;
      }
    })());
    return;
  }

  // App shell: cache-first, with index.html as the navigation fallback.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_VERSION);
    const cached = await cache.match(event.request);
    if (cached) return cached;
    try {
      const fresh = await fetch(event.request);
      cache.put(event.request, fresh.clone());
      return fresh;
    } catch (e) {
      if (event.request.mode === 'navigate') {
        const shell = await cache.match('./index.html');
        if (shell) return shell;
      }
      throw e;
    }
  })());
});
