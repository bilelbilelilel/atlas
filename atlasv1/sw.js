// ATLAS — service worker. Hors-ligne complet : le moteur tourne en local,
// sans un seul appel réseau obligatoire.

const CACHE = 'atlas-v3';
const SHELL = [
  './', './index.html', './manifest.webmanifest',
  './css/style.css',
  './fonts/archivo-var.woff2', './fonts/silkscreen-400.woff2',
  './fonts/spacemono-400.woff2', './fonts/spacemono-700.woff2',
  './js/app.js', './js/ui.js', './js/store.js', './js/program.js',
  './js/engine.js', './js/inventory.js', './js/nutrition.js',
  './js/sprites.js', './js/charts.js', './js/inventaire-editor.js',
  './js/screens/onboarding.js', './js/screens/home.js', './js/screens/seance.js',
  './js/screens/progression.js', './js/screens/corps.js', './js/screens/bilan.js',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Cache-first pour le shell ; les polices Google passent en cache au premier usage.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      const url = new URL(e.request.url);
      const cacheable = url.origin === location.origin || url.hostname.endsWith('gstatic.com') || url.hostname.endsWith('googleapis.com');
      if (res.ok && cacheable) {
        const clone = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, clone));
      }
      return res;
    }).catch(() => caches.match('./index.html'))),
  );
});
