// Service worker GameBOVH : rend la console installable et rapide à rouvrir.
// - Fichiers de build (assets/, noms avec empreinte) : servis depuis le cache.
// - Page, config.js, manifeste : réseau d'abord, cache si hors ligne.
// - WebSocket (/ws) et /health : jamais interceptés.
// Changer ce nom vide l'ancien cache chez tous les joueurs à la prochaine visite.
const CACHE = 'gamebovh-v2';
const SHELL = ['./', './index.html', './config.js', './manifest.webmanifest', './icon-192.png', './icon-512.png', './favicon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('/ws') || url.pathname.endsWith('/health')) return;

  if (url.pathname.includes('/assets/')) {
    // Cache d'abord : ces fichiers ne changent jamais (leur nom change à chaque build)
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((response) => {
            // Ne jamais garder une page HTML à la place d'un script ou d'une feuille de style
            const type = response.headers.get('content-type') || '';
            if (response.ok && !type.includes('text/html')) {
              const copy = response.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  // Réseau d'abord, pour toujours avoir la dernière version en ligne
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then((hit) => hit || (request.mode === 'navigate' ? caches.match('./index.html') : undefined)),
      ),
  );
});
