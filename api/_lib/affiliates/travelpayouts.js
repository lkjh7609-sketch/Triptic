// Travelpayouts 링크 변환 API — Travelpayouts에 연결된 브랜드(지금은 항공의 Kiwi.com, 2026-10-09 다시 연결)의 주소를 제휴 링크로.
// 토큰(TRAVELPAYOUTS_API_TOKEN)은 서버 환경변수로만. 10-04에 뺐던 모듈을 그대로 되살렸다(c5dfa1f^).

// 프로젝트 ID(trs)와 파트너 ID(marker)는 비밀이 아니다(제휴 링크에 그대로 드러남)
const TP_TRS = Number(process.env.TRAVELPAYOUTS_TRS || 578749);
const TP_MARKER = Number(process.env.TRAVELPAYOUTS_MARKER || 782766);

export function isConfigured() {
    return Boolean(process.env.TRAVELPAYOUTS_API_TOKEN);
}

/** sub_id는 Travelpayouts 리포트에서 어디서 누른 링크인지 구분하는 꼬리표 */
export async function convert(url, subId) {
    const res = await fetch('https://api.travelpayouts.com/links/v1/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Access-Token': process.env.TRAVELPAYOUTS_API_TOKEN },
        body: JSON.stringify({ trs: TP_TRS, marker: TP_MARKER, shorten: true, links: [{ url, sub_id: subId }] }),
        signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`travelpayouts HTTP ${res.status}`);
    const data = await res.json();
    const link = data?.result?.links?.[0];
    if (link?.code !== 'success' || typeof link.partner_url !== 'string' || !link.partner_url) {
        throw new Error(`travelpayouts conversion failed: ${link?.message ?? data?.error ?? 'unknown'}`);
    }
    return { partnerUrl: link.partner_url, externalId: null };
}
