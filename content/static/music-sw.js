// Service Worker for Boss Fights Music Player
// Enables offline playback of music

const CACHE_NAME = 'boss-fights-v2';

// Assets to cache on install
const PRECACHE_ASSETS = [
  '/music',
  '/content/static/player.js',
  '/content/static/seamless-loop-player.js',
  '/scripts/Konami.js',
  '/content/static/favicon-scroller.js',
  
  // Music files
  '/assets/music/boss-fights/Fungal Floor.mp3',
  '/assets/music/boss-fights/Bassaline.mp3',
  '/assets/music/boss-fights/M W Highs.mp3',
  '/assets/music/boss-fights/Dug Fork.mp3',
  '/assets/music/boss-fights/15M.mp3',
  '/assets/music/boss-fights/SF.mp3',
  '/assets/music/boss-fights/Twinning.mp3',
  '/assets/music/boss-fights/HARPIN.mp3',
  '/assets/music/boss-fights/H I H.mp3',
  '/assets/music/boss-fights/WONK2A.mp3',
  '/assets/music/boss-fights/Crabbin.mp3',
  
  // Icons
  '/assets/img/bossfights/walkman.png',
  '/assets/img/bossfights/play.png',
  '/assets/img/bossfights/pause.png',
  '/assets/img/bossfights/next.png',
  '/assets/img/bossfights/prev.png',
  '/assets/img/bossfights/note.png',
  '/assets/img/bossfights/mushroom.png',
  '/assets/img/bossfights/crowd.png',
  '/assets/img/bossfights/shadows.png',
  '/assets/img/bossfights/hallway.png',
  '/assets/img/bossfights/elevator.png',
  '/assets/img/bossfights/pow.png',
  '/assets/img/bossfights/mouse.png',
  '/assets/img/bossfights/gate.png',
  '/assets/img/bossfights/boulder.png',
  '/assets/img/bossfights/waves.png',
  '/assets/img/bossfights/cane.png',
  
  // Favicon
  '/assets/favicon/favicon.ico'
];

// Install: precache all assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing and caching assets...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => {
        console.log('[SW] All assets cached!');
        return self.skipWaiting();
      })
      .catch((err) => {
        console.error('[SW] Failed to cache:', err);
      })
  );
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: serve from cache, fall back to network
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;
  
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          // Return cached version
          return cachedResponse;
        }
        
        // Not in cache, fetch from network
        return fetch(event.request).then((response) => {
          // Don't cache non-ok responses or external resources
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          
          // Cache the fetched resource for future use
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          
          return response;
        });
      })
      .catch(() => {
        // Network failed and not in cache - you could return a fallback here
        console.log('[SW] Fetch failed for:', event.request.url);
      })
  );
});

// Listen for messages from the page
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
