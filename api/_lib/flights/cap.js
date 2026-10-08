// Ignav 월(UTC) 호출 상한 — 서버 전체 합계. 유료 호출(첫 1,000건 이후 1,000건당 $2) 직전에 takeIgnavCall을 부른다.
// 한도는 환경 변수 IGNAV_MONTHLY_CAP(기본 2,500건 ≈ $5)로 바꾼다. 사용량: Supabase google_api_calls 표의 kind='ignav' 줄
// (구글 상한과 같은 표·함수 take_google_call을 쓴다 — 종류 제한이 없어 새 마이그레이션은 필요 없다).

export const DEFAULT_IGNAV_CAP = 2500;

export class IgnavCapError extends Error {
    constructor(limit, used) {
        super('ignav_cap');
        this.name = 'IgnavCapError';
        this.limit = limit;
        this.used = used;
    }
}

export function ignavCap(env = process.env) {
    const raw = Number(env.IGNAV_MONTHLY_CAP);
    return Number.isInteger(raw) && raw >= 0 ? raw : DEFAULT_IGNAV_CAP;
}

/**
 * 호출 count회분을 쓴다(왕복은 편도 2번). 이번 달 한도를 넘으면 IgnavCapError.
 * 확인할 수 없으면(DB 없음·오류) 돈이 나가는 호출을 막기 위해 통과시키지 않는다(닫힌 쪽으로 실패).
 */
export async function takeIgnavCall(db, count = 1) {
    if (!db) throw new Error('ignav cap unavailable');
    const limit = ignavCap();
    if (limit === 0) throw new IgnavCapError(0, 0);
    const { data, error } = await db.rpc('take_google_call', { p_kind: 'ignav', p_limit: limit, p_count: count });
    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row) throw new Error('ignav cap unavailable');
    if (!row.allowed) throw new IgnavCapError(limit, row.used);
    return { limit, used: row.used };
}
