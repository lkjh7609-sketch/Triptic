// 아고다 제휴 검색 API(Long Tail Search) 호출 공통부 — 문서: partners.agoda.com Affiliate Lite API
// 키는 서버 환경변수 AGODA_API_KEY("사이트ID:API키")로만 두고 앱에는 내려보내지 않는다. 예약 링크(landingURL)의 cid가 우리 제휴 번호라
// 링크는 받은 그대로 쓴다(바꾸면 수수료가 잡히지 않는다).
const ENDPOINT = 'http://affiliateapi7643.agoda.com/affiliateservice/lt_v1';

export function isConfigured() {
    return /^\d+:[0-9a-f-]{20,}$/i.test(process.env.AGODA_API_KEY ?? '');
}

/**
 * @param {object} criteria 아고다 요청의 criteria 객체
 * @returns {Promise<{ status: number, json: any }>} JSON이 아니면 json은 null
 */
export async function agodaRequest(criteria, { timeoutMs = 12_000 } = {}) {
    const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'accept-encoding': 'gzip,deflate',
            authorization: process.env.AGODA_API_KEY,
        },
        body: JSON.stringify({ criteria }),
        signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await res.text();
    let json = null;
    try {
        json = text ? JSON.parse(text) : null;
    } catch {
        json = null;
    }
    return { status: res.status, json };
}
