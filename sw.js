const CACHE_NAME = 'scheffmap-v3';
const TILE_CACHE = 'tacmap-tiles-v1';
const MAX_TILES = 2000;
const CORE_ASSETS = ['tacmap-v8.html', 'manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(CORE_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => 
    Promise.all(keys.filter(k => k !== CACHE_NAME && k !== TILE_CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Tile requests — cache first
  if (url.hostname.includes('tile') || url.hostname.includes('arcgisonline') || 
      url.hostname.includes('opentopomap') || url.hostname.includes('nationalmap') ||
      url.hostname.includes('stadiamaps')) {
    e.respondWith(caches.open(TILE_CACHE).then(async cache => {
      const cached = await cache.match(e.request);
      if (cached) return cached;
      try {
        const resp = await fetch(e.request);
        if (resp.ok) {
          cache.put(e.request, resp.clone());
          // Prune if over limit
          const keys = await cache.keys();
          if (keys.length > MAX_TILES) {
            for (let i = 0; i < keys.length - MAX_TILES; i++) cache.delete(keys[i]);
          }
        }
        return resp;
      } catch (err) { return cached || new Response('', { status: 503 }); }
    }));
    return;
  }
  // App files — stale while revalidate
  if (url.origin === self.location.origin) {
    e.respondWith(caches.open(CACHE_NAME).then(async cache => {
      const cached = await cache.match(e.request);
      const fetchPromise = fetch(e.request).then(resp => {
        if (resp.ok) cache.put(e.request, resp.clone());
        return resp;
      }).catch(() => cached);
      return cached || fetchPromise;
    }));
  }
});
