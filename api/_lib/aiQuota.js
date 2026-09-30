// AI(LLM) 생성 호출의 로그인 사용자별 하루(최근 24시간) 한도.
// /api/recommend·/api/cityDesc가 "실제로 LLM을 부르기 직전"에 확인한다 — 캐시로 답하는 요청은 세지 않는다.
// 확인과 기록은 DB 함수 take_daily_quota(0066)가 원자적으로 한다(동시에 여러 번 눌러도 한도를 넘지 못함).
export const AI_KIND = 'ai.generate';
/** 무료 10회, 프로(프리미엄) 100회 — 프로도 무제한은 아니다(남용 방지). 운영자는 프로와 같다 */
export const AI_DAILY_LIMIT = { free: 10, pro: 100 };

export class DailyLimitError extends Error {
    constructor(limit, used) {
        super('daily_limit');
        this.name = 'DailyLimitError';
        this.limit = limit;
        this.used = used;
    }
}

export function limitFor(profile) {
    return profile?.plan === 'pro' || profile?.role === 'admin' ? AI_DAILY_LIMIT.pro : AI_DAILY_LIMIT.free;
}

/**
 * 한도 1회분을 쓴다. 통과하면 { limit, used }, 한도를 넘었으면 DailyLimitError.
 * 확인할 수 없으면(DB 없음·오류) 비용이 나가는 호출을 막기 위해 통과시키지 않는다(닫힌 쪽으로 실패).
 */
export async function takeAiQuota(db, userId, endpoint) {
    if (!db) throw new Error('quota unavailable');
    const { data: profile } = await db.from('profiles').select('plan, role').eq('id', userId).maybeSingle();
    const limit = limitFor(profile);
    const { data, error } = await db.rpc('take_daily_quota', { p_user_id: userId, p_kind: AI_KIND, p_limit: limit, p_meta: { endpoint } });
    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row) throw new Error('quota unavailable');
    if (!row.allowed) throw new DailyLimitError(limit, row.used);
    return { limit, used: row.used };
}
