import { describe, expect, it, vi, afterEach } from 'vitest';
import { boundsAround, cacheKey, mapGooglePlace, placeSearch } from './placeSearch.js';

const bias = { lat: -33.87, lng: 151.21 };

describe('placeSearch', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('캐시 키는 언어·도시권·정규화한 검색어로 정해진다', () => {
        expect(cacheKey('ko', ' 동물원 ', bias)).toBe(cacheKey('ko', '동물원', { lat: -33.9, lng: 151.2 }));
        expect(cacheKey('ko', '동물원', bias)).not.toBe(cacheKey('en', '동물원', bias));
        expect(cacheKey('ko', '동물원', null)).toContain('none');
    });

    it('범위는 중심에서 200km 사각형', () => {
        const b = boundsAround(0, 0);
        expect(b.north).toBeCloseTo(200 / 111, 3);
        expect(b.east).toBeCloseTo(200 / 111, 3);
    });

    it('구글 응답을 앱 모양으로 바꾸고, 좌표·이름이 없으면 버린다', () => {
        const ok = mapGooglePlace({ id: 'p1', displayName: { text: '타롱가 동물원' }, formattedAddress: '시드니', location: { latitude: -33.84, longitude: 151.24 }, types: ['zoo'], addressComponents: [{ types: ['country'], shortText: 'AU' }] });
        expect(ok).toMatchObject({ name: '타롱가 동물원', placeId: 'p1', lat: -33.84, countryCode: 'AU' });
        expect(mapGooglePlace({ id: 'x', displayName: { text: 'a' } })).toBeNull();
    });

    it('서버 키가 없고 캐시·풀도 비면 unavailable', async () => {
        expect(await placeSearch({ db: null, apiKey: undefined, q: '동물원', locale: 'ko', bias, takeQuota: async () => {} })).toEqual({ unavailable: true });
    });

    it('하루 한도를 넘으면 구글을 부르지 않는다', async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        const out = await placeSearch({ db: null, apiKey: 'k', q: '동물원', locale: 'ko', bias, takeQuota: async () => { throw new Error('daily_limit'); } });
        expect(out).toMatchObject({ limited: true, results: [] });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('구글 결과를 돌려준다', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ places: [{ id: 'p1', displayName: { text: '타롱가 동물원' }, location: { latitude: -33.84, longitude: 151.24 } }] }) }));
        const out = await placeSearch({ db: null, apiKey: 'k', q: '동물원', locale: 'ko', bias, takeQuota: async () => {} });
        expect(out.source).toBe('google');
        expect(out.results[0].name).toBe('타롱가 동물원');
    });
});
