import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
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

describe('로그인이 필요한 API의 CORS', () => {
    // 앱(capacitor://localhost)은 다른 출처라 Authorization을 보내기 전에 사전 요청(OPTIONS)을 한다.
    // 허용 헤더에 Authorization이 없으면 브라우저가 본 요청을 막는다(2026-10-17 앱 AI 다음 장소 추천이 항상 실패). 웹은 같은 출처라 드러나지 않는다.
    const apiDir = join(process.cwd(), 'api');
    const files = readdirSync(apiDir).filter((f) => f.endsWith('.js') && !f.endsWith('.test.js'));
    const authed = files.filter((f) => readFileSync(join(apiDir, f), 'utf8').includes('requireUser('));

    it('requireUser를 쓰는 API가 있다', () => {
        expect(authed).toContain('recommend.js');
    });

    it.each(authed)('%s 는 Authorization 헤더를 허용한다', (f) => {
        const src = readFileSync(join(apiDir, f), 'utf8');
        const calls = src.match(/applyCors\([^)]*\)/g) ?? [];
        expect(calls.length).toBeGreaterThan(0);
        for (const c of calls) expect(c).toMatch(/Authorization/);
    });
});
