/**
 * Triptic Service Worker
 * Version: triptic-v2
 *
 * Requirements implemented:
 * 1. App shell caching: index.html, manifest.json, icon-180.png, icon-192.png, icon-512.png
 * 2. External CDN caching: SortableJS, jsPDF, lz-string (versioned URLs)
 * 3. Network-first strategy for API calls (Google Maps API, Firebase, aviationstack)
 * 4. Cache-first strategy for static assets
 * 5. Offline fallback: serve cached index.html when offline
 * 6. Cache versioning: 'triptic-v2'
 * 7. Old cache cleanup on activate
 * 8. Graceful handling for Google Maps API script (bypass cache, fail naturally when offline)
 */

const CACHE_NAME = 'triptic-v4';

// 1. App shell files
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
  './icon-1024.png'
];

// 2. Versioned external CDN resources
const CDN_ASSETS = [
  'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css',
  'https://cdn.jsdelivr.net/npm/sortablejs@1.15.6/Sortable.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/lz-string/1.5.0/lz-string.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

// Combined assets to precache during install
const PRECACHE_ASSETS = [...APP_SHELL, ...CDN_ASSETS];

/**
 * Helper to identify Google Maps bootstrap script
 * (maps.googleapis.com/maps/api/js...)
 */
function isGoogleMapsScript(url) {
  return (
    url.hostname.includes('maps.googleapis.com') &&
    (url.pathname.includes('/maps/api/js') || url.pathname.includes('/api/js'))
  );
}

/**
 * Helper to identify API requests (Google Maps API calls, Firebase, aviationstack)
 */
function isApiRequest(url) {
  // Exclude the Google Maps bootstrap script (handled separately)
  if (isGoogleMapsScript(url)) {
    return false;
  }

  // Google Maps API runtime requests (places, geocode, directions, tiles, etc.)
  if (url.hostname.includes('maps.googleapis.com') || url.hostname.includes('maps.gstatic.com')) {
    return true;
  }

  // Firebase Realtime Database REST API
  if (url.hostname.includes('firebasedatabase.app') || url.hostname.includes('firebaseio.com')) {
    return true;
  }

  // aviationstack flight data API
  if (url.hostname.includes('aviationstack.com')) {
    return true;
  }

  return false;
}

/**
 * Helper to get cached index.html offline fallback
 */
async function getOfflineFallback() {
  const cache = await caches.open(CACHE_NAME);
  return (
    (await cache.match('./index.html')) ||
    (await cache.match('index.html')) ||
    (await cache.match('./'))
  );
}

/**
 * Install Event: Precache app shell and CDN resources
 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Precache assets resiliently
      await Promise.allSettled(
        PRECACHE_ASSETS.map(async (url) => {
          try {
            const response = await fetch(url, { cache: 'reload' });
            if (response.ok) {
              await cache.put(url, response);
            } else {
              console.warn(`[SW] Precache responded with status ${response.status} for ${url}`);
            }
          } catch (err) {
            console.warn(`[SW] Precache failed to fetch ${url}:`, err);
          }
        })
      );

      // Ensure index.html is accessible via './', './index.html', and 'index.html' keys
      const indexResp = await cache.match('./index.html');
      if (indexResp) {
        const rootResp = await cache.match('./');
        if (!rootResp) {
          await cache.put('./', indexResp.clone());
        }
        const plainIndex = await cache.match('index.html');
        if (!plainIndex) {
          await cache.put('index.html', indexResp.clone());
        }
      }
    }).then(() => self.skipWaiting())
  );
});

/**
 * Activate Event: Clean up outdated caches and claim clients
 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log(`[SW] Deleting old cache: ${name}`);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

/**
 * Fetch Event: Route requests according to caching strategies
 */
self.addEventListener('fetch', (event) => {
  // Only intercept GET requests; pass all other methods (POST, PUT, DELETE) directly to network
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);

  // 1. Google Maps API script: do not cache, let it fail naturally when offline
  if (isGoogleMapsScript(url)) {
    event.respondWith(
      fetch(event.request).catch((err) => {
        console.warn('[SW] Google Maps script failed to load (offline):', err.message);
        return Promise.reject(err);
      })
    );
    return;
  }

  // 2. Navigation / HTML requests: Network-first strategy (always fetch fresh HTML, offline fallback)
  if (event.request.mode === 'navigate' || event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then(async (networkResponse) => {
          if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        })
        .catch(async () => {
          return await getOfflineFallback();
        })
    );
    return;
  }

  // 3. API calls (Google Maps, Firebase, aviationstack): Network-first strategy
  if (isApiRequest(url)) {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        } catch (error) {
          console.warn('[SW] API network request failed, falling back to cache:', event.request.url);
          const cachedResponse = await caches.match(event.request);
          if (cachedResponse) {
            return cachedResponse;
          }
          throw error;
        }
      })()
    );
    return;
  }

  // 4. Static assets (JS, CSS, images, icons, manifest, fonts): Cache-first strategy
  event.respondWith(
    (async () => {
      // Check cache first
      const cachedResponse = await caches.match(event.request);
      if (cachedResponse) {
        return cachedResponse;
      }

      // Fetch from network if not in cache
      try {
        const networkResponse = await fetch(event.request);
        if (networkResponse.ok || networkResponse.type === 'opaque') {
          const cache = await caches.open(CACHE_NAME);
          cache.put(event.request, networkResponse.clone());
        }
        return networkResponse;
      } catch (error) {
        // Fallback to index.html if offline and requesting HTML document
        if (event.request.mode === 'navigate' || event.request.headers.get('accept')?.includes('text/html')) {
          const fallback = await getOfflineFallback();
          if (fallback) {
            return fallback;
          }
        }
        throw error;
      }
    })()
  );
});

// Support skipWaiting message from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});
