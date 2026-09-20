/**
 * Triptic Service Worker
 *
 * Requirements implemented:
 * 1. App shell caching: index.html, manifest.json, icon-180.png, icon-192.png, icon-512.png
 * 2. External CDN caching: SortableJS, jsPDF, lz-string (versioned URLs)
 * 3. Network-first strategy for API calls (Google Maps API, Supabase)
 * 4. Cache-first strategy for static assets
 * 5. Offline fallback: serve cached index.html when offline
 * 6. Cache versioning (bump CACHE_NAME to force clients to refresh)
 * 7. Old cache cleanup on activate
 * 8. Graceful handling for Google Maps API script (bypass cache, fail naturally when offline)
 *
 * ⚠️ ADR-001(Strangler): 이 하나의 sw.js가 루트(legacy)와 /preview/(새 React 앱)
 * 둘 다를 맡는다. 두 앱은 오프라인 폴백 셸이 다르므로(legacy는 ./index.html,
 * 새 앱은 ./preview/index.html) getOfflineFallback이 요청 경로를 보고 골라야
 * 한다 — 하드코딩해서 legacy만 반환하면 /preview/ 경로가 오프라인일 때 엉뚱한
 * legacy 화면이 뜬다.
 *
 * ⚠️ 이 파일이 원본이다 — scripts/build.js가 매 dev/build 실행 시 이 파일을
 * www/sw.js, public/sw.js로 그대로 복사한다. public/sw.js를 직접 고치면 다음
 * 빌드에서 덮어써진다(2026-09-21 세션에서 실제로 이걸로 한 번 고침이 사라졌다
 * — 반드시 이 루트 파일을 고칠 것).
 */

const CACHE_NAME = 'triptic-v6';

// 1. App shell files (legacy 루트 + 새 React 앱(/preview/) 둘 다 프리캐시)
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
  './icon-1024.png',
  './preview/index.html'
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
 * Helper to identify API requests (Google Maps API calls, Supabase)
 *
 * 지도 타일(gstatic)과 access_key가 실린 요청(aviationstack)은 캐시하지 않는다:
 * 타일은 무제한으로 쌓여 캐시가 계속 커지고, access_key가 붙은 URL을 캐시 키로
 * 쓰면 API 키가 디스크에 평문으로 영구 저장되기 때문이다.
 */
function isApiRequest(url) {
  // Exclude the Google Maps bootstrap script (handled separately)
  if (isGoogleMapsScript(url)) {
    return false;
  }

  // 지도 타일 등은 무제한으로 쌓이므로 캐시하지 않음 (네트워크 직행)
  if (url.hostname.includes('maps.gstatic.com')) {
    return false;
  }

  // access_key/API 키가 쿼리스트링에 실리는 요청은 캐시 키에 키가 그대로 남으므로 제외
  if (url.searchParams.has('access_key') || url.searchParams.has('key')) {
    return false;
  }

  // Google Maps API runtime requests (places, geocode, directions 등)
  if (url.hostname.includes('maps.googleapis.com')) {
    return true;
  }

  // Supabase REST/Auth API (공유 일정 조회 등은 오프라인 열람 가치가 있어 캐시)
  if (url.hostname.endsWith('.supabase.co')) {
    return true;
  }

  return false;
}

/**
 * Helper to get the cached offline-fallback shell — /preview/ 경로 요청이면 새
 * React 앱 셸을, 그 외(legacy)는 루트 index.html을 돌려준다.
 */
async function getOfflineFallback(request) {
  const cache = await caches.open(CACHE_NAME);
  const pathname = request ? new URL(request.url).pathname : '';
  if (pathname.startsWith('/preview/')) {
    return (
      (await cache.match('./preview/index.html')) ||
      (await cache.match('/preview/index.html'))
    );
  }
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
          return await getOfflineFallback(event.request);
        })
    );
    return;
  }

  // 3. API calls (Google Maps, Supabase): Network-first strategy
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
          const fallback = await getOfflineFallback(event.request);
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
