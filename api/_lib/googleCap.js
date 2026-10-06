// 서버가 부르는 모든 구글 API의 월(UTC) 호출 상한 — 서버 전체 합계. 돈이 드는 호출 직전에 takeGoogleCall을 부른다.
// 한도는 환경 변수 GOOGLE_CAP_<종류>(예: GOOGLE_CAP_PLACES_NEARBY=2000)로 바꿀 수 있다. 사용량: Supabase google_api_calls 표.
// 브라우저가 직접 부르는 구글(지도·자동완성)은 서버가 막을 수 없다 — 구글 클라우드 콘솔의 할당량으로만 제한된다.

/** 기본 월 한도 — 무료 구간(Text Search Pro 5,000·Nearby Enterprise 1,000·Vision 1,000)을 넘으면 요금이 나간다 */
export const DEFAULT_GOOGLE_CAPS = {
    places_text_search: 5000,
    places_nearby: 3000,
    places_find: 3000,
    vision: 5000,
};

export class GoogleCapError extends Error {
    constructor(kind, limit, used) {
        super('google_cap');
        this.name = 'GoogleCapError';
        this.kind = kind;
        this.limit = limit;
        this.used = used;
    }
}

export function capFor(kind, env = process.env) {
    const raw = Number(env[`GOOGLE_CAP_${kind.toUpperCase()}`]);
    if (Number.isInteger(raw) && raw >= 0) return raw;
    return DEFAULT_GOOGLE_CAPS[kind] ?? 0;
}

/**
 * 구글 호출 1회분(또는 count회)을 쓴다. 통과하면 { limit, used }, 이번 달 한도를 넘으면 GoogleCapError.
 * 확인할 수 없으면(DB 없음·오류) 돈이 나가는 호출을 막기 위해 통과시키지 않는다(닫힌 쪽으로 실패).
 */
export async function takeGoogleCall(db, kind, count = 1) {
    if (!db) throw new Error('google cap unavailable');
    const limit = capFor(kind);
    const { data, error } = await db.rpc('take_google_call', { p_kind: kind, p_limit: limit, p_count: count });
    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row) throw new Error('google cap unavailable');
    if (!row.allowed) throw new GoogleCapError(kind, limit, row.used);
    return { limit, used: row.used };
}
