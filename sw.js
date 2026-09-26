/**
 * Triptic Service Worker
 *
 * Requirements:
 * 1. App shell caching: index.html, manifest.json, icons
 * 2. External CDN caching: Pretendard font
 * 3. Network-first for Google Maps API calls; /api/* and Supabase (except public images) are network-only
 * 4. Cache-first strategy for static assets
 * 5. Offline fallback: serve cached index.html when offline
 * 6. Cache versioning (bump CACHE_NAME to force refresh)
 * 7. Old cache cleanup on activate
 * 8. Graceful handling for Google Maps API script
 *
 * ⚠️ 이 파일이 원본이다 — scripts/build.js가 매 dev/build 실행 시 이 파일을
 * public/sw.js로 그대로 복사한다(→ dist/).
 */

const CACHE_NAME = 'triptic-v3.0.0-dev.52';
/** 외부 이미지(도시 사진·위키백과 썸네일·커뮤니티 사진 등) 전용 — 개수 제한으로 무한히 커지지 않게 */
const IMAGE_CACHE_NAME = 'triptic-images-v1';
const IMAGE_CACHE_MAX_ENTRIES = 150;

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
  'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css',
  'https://cdn.jsdelivr.net/gh/sun-typeface/SUIT/fonts/variable/woff2/SUIT-Variable.css'
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
  return false;
}

/**
 * 캐시하면 안 되는 요청 — 네트워크로만 보낸다.
 * - 같은 오리진 /api/*: 날씨·AI 추천 등 매번 달라야 하는 응답(예전엔 정적 자산으로 분류돼
 *   한 번 받은 응답이 SW 버전이 바뀔 때까지 계속 쓰였다)
 * - Supabase REST/Auth/Functions/서명 URL: 사용자별 개인 데이터. URL만으로 캐시하면 로그아웃
 *   후에도 남아 같은 기기의 다음 사용자에게 보일 수 있다. 오프라인 열람은 TanStack Query
 *   영속 캐시(IndexedDB, 로그아웃 시 삭제)가 담당한다.
 * - 공개 버킷 이미지(/storage/v1/object/public/)는 개인 데이터가 아니라 이미지 캐시로 보낸다.
 */
function isNetworkOnly(url) {
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) return true;
  if (url.hostname.endsWith('.supabase.co') && !url.pathname.startsWith('/storage/v1/object/public/')) return true;
  return false;
}

function isImageRequest(request, url) {
  return request.destination === 'image' && url.origin !== self.location.origin;
}

/** 오래된 항목부터 지워 개수를 제한한다(Cache API의 keys()는 삽입 순서) */
async function trimCache(name, maxEntries) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - maxEntries; i++) {
    await cache.delete(keys[i]);
  }
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
          .filter((name) => name !== CACHE_NAME && name !== IMAGE_CACHE_NAME)
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

  // 0. 개인 데이터·동적 API: 캐시 없이 네트워크로만
  if (isNetworkOnly(url)) return;

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

  // 4. 외부 이미지: 캐시 우선 + 개수 제한
  if (isImageRequest(event.request, url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(IMAGE_CACHE_NAME);
        const cached = await cache.match(event.request);
        if (cached) return cached;
        const response = await fetch(event.request);
        if (response.ok || response.type === 'opaque') {
          await cache.put(event.request, response.clone());
          event.waitUntil(trimCache(IMAGE_CACHE_NAME, IMAGE_CACHE_MAX_ENTRIES));
        }
        return response;
      })()
    );
    return;
  }

  // 5. Static assets: Cache-first
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
