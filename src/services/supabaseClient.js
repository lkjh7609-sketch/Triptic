/**
 * Supabase 클라이언트 싱글톤
 * - 앱 전체(인증, 데이터 동기화)가 동일한 GoTrueClient 인스턴스를 공유하도록 함
 *   (클라이언트를 여러 번 생성하면 "Multiple GoTrueClient instances" 경고와 함께
 *   세션 상태가 어긋날 수 있음)
 * - index.html <head>에서 이미 UMD 빌드(https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2)를
 *   classic <script>로 로드해 두므로, 이 모듈은 그 window.supabase 전역을 재사용한다.
 *   (모듈 스크립트는 파싱 완료 후 실행되므로, 앞선 classic 스크립트가 먼저 끝나 있음)
 *   혹시 없는 실행 환경(예: 순서가 바뀐 경우)을 대비해 동적 로드 폴백도 둔다.
 * - 환경변수는 /api/env(Vercel) 또는 Vite 개발 서버 미들웨어가 주입하는
 *   window.ENV를 사용한다.
 */

const SUPABASE_SDK_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';

let clientPromise = null;

/**
 * window.__envPromise(index.html에서 미리 시작해 둔 fetch)가 있으면 그 결과를,
 * 없으면 window.ENV를 즉시 사용한다.
 * @private
 */
async function resolveEnv() {
    if (typeof window === 'undefined') return {};
    if (window.__envPromise) {
        try {
            return (await window.__envPromise) || window.ENV || {};
        } catch {
            return window.ENV || {};
        }
    }
    return window.ENV || {};
}

/**
 * window.supabase(UMD 전역)가 아직 없으면 CDN에서 동적으로 로드한다.
 * @private
 */
function ensureSupabaseSdk() {
    if (typeof window !== 'undefined' && window.supabase) {
        return Promise.resolve(window.supabase);
    }
    return new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[src^="${SUPABASE_SDK_URL}"]`);
        const script = existing || document.createElement('script');
        script.addEventListener('load', () => resolve(window.supabase), { once: true });
        script.addEventListener('error', reject, { once: true });
        if (!existing) {
            script.src = SUPABASE_SDK_URL;
            document.head.appendChild(script);
        } else if (window.supabase) {
            resolve(window.supabase);
        }
    });
}

/**
 * Supabase 클라이언트를 비동기로 얻는다. 최초 호출 시 한 번만 생성하고 이후에는
 * 캐시된 Promise를 재사용한다.
 * @returns {Promise<import('@supabase/supabase-js').SupabaseClient>}
 */
export function getSupabaseClient() {
    if (typeof window !== 'undefined' && window.supabaseClient) {
        return Promise.resolve(window.supabaseClient);
    }
    if (!clientPromise) {
        clientPromise = (async () => {
            const [env, sdk] = await Promise.all([resolveEnv(), ensureSupabaseSdk()]);
            const url = env?.SUPABASE_URL;
            const key = env?.SUPABASE_ANON_KEY;
            if (!url || !key) {
                throw new Error('Supabase 환경 변수(SUPABASE_URL/SUPABASE_ANON_KEY)를 불러오지 못했습니다.');
            }
            const client = sdk.createClient(url, key);
            if (typeof window !== 'undefined') {
                window.supabaseClient = client;
            }
            return client;
        })();
    }
    return clientPromise;
}

export default getSupabaseClient;
