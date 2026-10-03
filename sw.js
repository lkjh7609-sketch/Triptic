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

// scripts/build.js가 매 빌드마다 이 자리를 실제 값으로 치환한다(빌드 시각 기반) —
// 사람이 수동으로 버전 문자열을 올리는 걸 깜빡하면, 배포마다 새로 생기는 해시된
// JS/CSS 청크가 "5. Static assets: Cache-first" 규칙으로 옛 배포분과 함께 이
// 캐시에 영원히 쌓인다(청크는 개수 제한이 없다 — IMAGE_CACHE_NAME과 다름).
// 매 빌드마다 이름 자체가 달라지면 activate 핸들러가 이전 이름의 캐시를 통째로
// 지워서 이 문제가 구조적으로 재발하지 않는다.
const CACHE_NAME = '__BUILD_ID__';
/**
 * 외부 이미지(도시 사진·위키백과 썸네일·커뮤니티 사진 등) 전용 — 개수 제한으로 무한히 커지지 않게.
 *
 * ⚠️ opaque 응답(cross-origin no-cors)은 절대 저장하지 않는다. 브라우저는 내용을 볼 수 없는
 * opaque 응답의 용량을 정보 유출 방지용으로 항목당 수 MB(Chrome은 약 7MB)씩 부풀려 계산한다 —
 * 실제로는 수백 KB인 사진 150장이 설정 화면에 1GB 가까운 "오프라인 캐시"로 찍히던 원인이었다.
 * 이름을 v2로 올린 것도 그 때문이다: activate 핸들러가 v1(부풀려진 옛 캐시)을 통째로 지운다.
 */
const IMAGE_CACHE_NAME = 'triptic-images-v2';
const IMAGE_CACHE_MAX_ENTRIES = 100;

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
  'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css'
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

/**
 * 저장해 둔 앱 화면(index.html)이 가리키는 파일까지 이 캐시에 다 있다는 표시 — 설치 때 index.html을 읽어 그 안의
 * /assets/ 파일(첫 JS·CSS·홈 청크·번역 파일)을 같이 저장하고, 전부 성공하면 남긴다.
 * 예전엔 index.html만 저장해서, 네트워크가 안 될 때 꺼내 준 화면이 이미 없어진(이전 배포의) 파일을 찾다가
 * 아무것도 못 그리고 흰 화면으로 멈출 수 있었다(2026-10-04 아이폰 흰 화면 의심 원인).
 */
const SHELL_COMPLETE_KEY = './__shell-complete';

/** index.html 안의 /assets/ 파일 주소(모듈 스크립트·CSS·미리받기 목록·번역 파일 목록) */
function shellAssetUrls(html) {
  return [...new Set(html.match(/\/assets\/[A-Za-z0-9._-]+\.(?:js|css)/g) || [])];
}

/** 오프라인·멈춘 연결 폴백 — 파일까지 다 저장된 앱 화면만 돌려준다(아니면 undefined) */
async function getOfflineFallback() {
  const cache = await caches.open(CACHE_NAME);
  if (!(await cache.match(SHELL_COMPLETE_KEY))) return undefined;
  return (
    (await cache.match('./index.html')) ||
    (await cache.match('index.html')) ||
    (await cache.match('./'))
  );
}

/** 이동(페이지) 요청이 이 시간 안에 응답이 없으면 저장해 둔 앱 화면을 먼저 보여 준다(응답은 뒤에서 받아 캐시만 갱신) */
const NAVIGATION_TIMEOUT_MS = 4000;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

        // 이 index.html이 가리키는 파일도 같이 — 해시 이름이라 HTTP 캐시에 있으면 그대로 쓴다(대부분 방금 받은 것)
        const assets = shellAssetUrls(await indexResp.clone().text());
        const results = await Promise.allSettled(
          assets.map(async (url) => {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`${response.status} ${url}`);
            await cache.put(url, response);
          })
        );
        if (assets.length > 0 && results.every((r) => r.status === 'fulfilled')) {
          await cache.put(SHELL_COMPLETE_KEY, new Response('1'));
        } else {
          console.warn('[SW] App shell assets incomplete — offline fallback disabled for this version');
        }
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

  // 2. Navigation / HTML: Network-first. 응답이 4초 안에 없으면(멈춘 연결) 저장해 둔 앱 화면, 실패하면 한 번 더 시도 후
  //    저장해 둔 앱 화면. 휴대폰이 잠들었다 깬 직후 첫 요청은 죽은 연결에 실려 멈추거나 바로 실패하곤 한다.
  if (event.request.mode === 'navigate' || event.request.headers.get('accept')?.includes('text/html')) {
    const fromNetwork = () =>
      fetch(event.request).then(async (networkResponse) => {
        if (networkResponse.ok) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(event.request, networkResponse.clone());
        }
        return networkResponse;
      });
    event.respondWith(
      (async () => {
        const network = fromNetwork();
        try {
          const first = await Promise.race([network, delay(NAVIGATION_TIMEOUT_MS).then(() => null)]);
          if (first) return first;
          const fallback = await getOfflineFallback();
          if (fallback) {
            event.waitUntil(network.catch(() => {}));
            return fallback;
          }
          return await network;
        } catch {
          try {
            await delay(300);
            return await fromNetwork();
          } catch (err) {
            const fallback = await getOfflineFallback();
            if (fallback) return fallback;
            throw err;
          }
        }
      })()
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

  // 4. 외부 이미지: 캐시 우선 + 개수 제한. CORS로 받아 실제 크기가 보이는 응답만 저장한다
  if (isImageRequest(event.request, url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(IMAGE_CACHE_NAME);
        const cached = await cache.match(event.request);
        if (cached) return cached;
        try {
          const response = await fetch(event.request.url, {
            mode: 'cors',
            credentials: 'omit',
            referrerPolicy: event.request.referrerPolicy,
          });
          if (response.ok) {
            await cache.put(event.request, response.clone());
            event.waitUntil(trimCache(IMAGE_CACHE_NAME, IMAGE_CACHE_MAX_ENTRIES));
          }
          return response;
        } catch {
          // CORS 헤더가 없는 서버 — 화면에는 그대로 보여 주되 저장은 하지 않는다(opaque)
          return fetch(event.request);
        }
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
        // opaque(제3자 스크립트 등)는 저장하지 않는다 — 위 IMAGE_CACHE_NAME 주석 참고
        if (networkResponse.ok) {
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
