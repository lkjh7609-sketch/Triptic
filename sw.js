/**
 * Triptic Service Worker
 *
 * Requirements:
 * 1. App shell caching: index.html, manifest.json, icons
 * 2. External CDN caching: Pretendard font
 * 3. Network-first strategy for API calls (Google Maps API, Supabase)
 * 4. Cache-first strategy for static assets
 * 5. Offline fallback: serve cached index.html when offline
 * 6. Cache versioning (bump CACHE_NAME to force refresh)
 * 7. Old cache cleanup on activate
 * 8. Graceful handling for Google Maps API script
 *
 * ⚠️ 이 파일이 원본이다 — scripts/build.js가 매 dev/build 실행 시 이 파일을
 * www/sw.js, public/sw.js로 그대로 복사한다.
 */

const CACHE_NAME = 'triptic-v3.0.0-dev.50';

// App shell files
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
  './icon-1024.png'
];

// External CDN resources
const CDN_ASSETS = [
  'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css'
];

const PRECACHE_ASSETS = [...APP_SHELL, ...CDN_ASSETS];

/** Google Maps bootstrap script 판별 */
function isGoogleMapsScript(url) {
  return (
    url.hostname.includes('maps.googleapis.com') &&
    (url.pathname.includes('/maps/api/js') || url.pathname.includes('/api/js'))
  );
}

/**
 * API 요청 판별 (Google Maps, Supabase)
 * 지도 타일(gstatic)과 access_key 요청은 캐시하지 않는다.
 */
function isApiRequest(url) {
  if (isGoogleMapsScript(url)) return false;
  if (url.hostname.includes('maps.gstatic.com')) return false;
  if (url.searchParams.has('access_key') || url.searchParams.has('key')) return false;
  if (url.hostname.includes('maps.googleapis.com')) return true;
  if (url.hostname.endsWith('.supabase.co')) return true;
  return false;
}

/** 오프라인 폴백 — 캐시된 index.html 반환 */
async function getOfflineFallback() {
  const cache = await caches.open(CACHE_NAME);
  return (
    (await cache.match('./index.html')) ||
    (await cache.match('index.html')) ||
    (await cache.match('./'))
  );
}

/** Install: Precache app shell and CDN resources */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
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

      const indexResp = await cache.match('./index.html');
      if (indexResp) {
        const rootResp = await cache.match('./');
        if (!rootResp) await cache.put('./', indexResp.clone());
        const plainIndex = await cache.match('index.html');
        if (!plainIndex) await cache.put('index.html', indexResp.clone());
      }
    }).then(() => self.skipWaiting())
  );
});

/** Activate: Clean up outdated caches */
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

/** Fetch: Route requests according to caching strategies */
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // 1. Google Maps API script: bypass cache
  if (isGoogleMapsScript(url)) {
    event.respondWith(
      fetch(event.request).catch((err) => {
        console.warn('[SW] Google Maps script failed to load (offline):', err.message);
        return Promise.reject(err);
      })
    );
    return;
  }

  // 2. Navigation / HTML: Network-first with offline fallback
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

  // 3. API calls (Google Maps, Supabase): Network-first
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
          if (cachedResponse) return cachedResponse;
          throw error;
        }
      })()
    );
    return;
  }

  // 4. Static assets: Cache-first
  event.respondWith(
    (async () => {
      const cachedResponse = await caches.match(event.request);
      if (cachedResponse) return cachedResponse;

      try {
        const networkResponse = await fetch(event.request);
        if (networkResponse.ok || networkResponse.type === 'opaque') {
          const cache = await caches.open(CACHE_NAME);
          cache.put(event.request, networkResponse.clone());
        }
        return networkResponse;
      } catch (error) {
        if (event.request.mode === 'navigate' || event.request.headers.get('accept')?.includes('text/html')) {
          const fallback = await getOfflineFallback();
          if (fallback) return fallback;
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
