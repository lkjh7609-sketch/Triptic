import { describe, expect, it, vi } from 'vitest';

// 예전에 저장된 변환 결과(트래블페이아웃 klook.tp.st 링크)가 표에 남아 있는 상황
const maybeSingle = vi.fn(async () => ({ data: { partner_url: 'https://klook.tp.st/old' }, error: null }));
vi.mock('../supabaseAdmin.js', () => ({
    supabaseAdmin: () => ({ from: () => ({ select: () => ({ match: () => ({ maybeSingle }) }), upsert: async () => ({ error: null }) }) }),
}));

const { default: handler } = await import('../../partnerLink.js');

function call(query) {
    const res = { statusCode: 200, headers: {}, body: null };
    res.status = (c) => ((res.statusCode = c), res);
    res.json = (b) => ((res.body = b), res);
    res.end = () => res;
    res.setHeader = (k, v) => (res.headers[k.toLowerCase()] = v);
    return handler({ method: 'GET', query, headers: {} }, res).then(() => res);
}

describe('partnerLink — 제휴 연결 전 브랜드(Klook)', () => {
    it('원래 Klook 검색 주소를 그대로 주고, 저장된 예전 변환 결과(트래블페이아웃 링크)는 쓰지 않는다', async () => {
        const res = await call({ brand: 'klook', q: '오사카', locale: 'ko', placement: 'city' });
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({ url: 'https://www.klook.com/ko/search/result/?query=%EC%98%A4%EC%82%AC%EC%B9%B4', tracked: false });
        expect(maybeSingle).not.toHaveBeenCalled();
    });
});
