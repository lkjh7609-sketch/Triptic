import { describe, expect, it } from 'vitest';
import { applyCors, applyPublicCors } from './http.js';

function fakeRes() {
    const headers = {};
    return { headers, setHeader: (k, v) => { headers[k] = v; } };
}

describe('CORS 헤더', () => {
    it('공개 조회 응답은 출처가 없어도(웹·CDN 캐시를 채우는 요청) 모든 출처를 허용한다 — 캐시된 응답을 앱도 쓸 수 있게', () => {
        const res = fakeRes();
        applyPublicCors(res);
        expect(res.headers['Access-Control-Allow-Origin']).toBe('*');
        expect(res.headers['Access-Control-Allow-Methods']).toBe('GET,OPTIONS');
    });

    it('출처별 허용(applyCors)은 출처가 없으면 허용 헤더를 붙이지 않는다 — 그래서 캐시되는 공개 응답에는 쓰지 않는다', () => {
        const res = fakeRes();
        applyCors({ headers: {} }, res, 'GET,OPTIONS');
        expect(res.headers['Access-Control-Allow-Origin']).toBeUndefined();
        const app = fakeRes();
        applyCors({ headers: { origin: 'capacitor://localhost' } }, app, 'GET,OPTIONS');
        expect(app.headers['Access-Control-Allow-Origin']).toBe('capacitor://localhost');
    });
});
