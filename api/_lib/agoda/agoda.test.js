import { afterEach, describe, expect, it, vi } from 'vitest';
import { nearestCity, MAX_DISTANCE_KM } from './cities.js';
import { buildCriteria, httpsImage, normalizeHotels, parseHotelQuery, safeUrl, searchHotels } from './hotels.js';
import { isConfigured } from './client.js';

afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
});

describe('nearestCity — 구글이 준 좌표 → 가장 가까운 아고다 도시', () => {
    it('대표 장소가 올바른 도시로 연결된다', () => {
        expect(nearestCity(37.5665, 126.978)?.id).toBe(14690); // 서울 시청
        expect(nearestCity(35.658, 139.7016)?.id).toBe(5085); // 도쿄 시부야
        expect(nearestCity(-33.8568, 151.2153)?.name).toBe('시드니');
        expect(nearestCity(33.4996, 126.5312)?.name).toBe('제주');
        expect(nearestCity(13.7563, 100.5018)?.id).toBe(9395); // 방콕
    });

    it('거리(km)를 함께 돌려준다', () => {
        const c = nearestCity(37.5665, 126.978);
        expect(c.distanceKm).toBeLessThan(2);
    });

    it('바다 한가운데처럼 가까운 도시가 없으면 null', () => {
        expect(nearestCity(0, -140)).toBeNull();
        expect(MAX_DISTANCE_KM).toBe(80);
    });

    it('좌표가 이상하면 null', () => {
        expect(nearestCity(NaN, 10)).toBeNull();
        expect(nearestCity(95, 10)).toBeNull();
        expect(nearestCity(10, 200)).toBeNull();
    });
});

describe('parseHotelQuery', () => {
    const ok = { lat: '13.75', lng: '100.5', checkin: '2026-11-20', checkout: '2026-11-22', adults: '2', childAges: '5|8', currency: 'krw', lang: 'ko', sort: 'priceAsc', minStars: '4', minReview: '8', maxPrice: '300000', discountOnly: '1' };

    it('검색 조건을 검증해 아고다 값으로 바꾼다', () => {
        expect(parseHotelQuery(ok)).toMatchObject({ lat: 13.75, lng: 100.5, adults: 2, childAges: [5, 8], currency: 'KRW', language: 'ko-kr', sort: 'PriceAsc', minStars: 4, minReview: 8, maxPrice: 300000, discountOnly: true });
    });

    it('안 준 값은 기본값(성인 2·KRW·한국어·추천순)', () => {
        const q = parseHotelQuery({ lat: '1', lng: '2', checkin: '2026-11-20', checkout: '2026-11-21' });
        expect(q).toMatchObject({ adults: 2, currency: 'KRW', language: 'ko-kr', sort: 'Recommended', childAges: [], discountOnly: false });
    });

    it('틀린 값은 null', () => {
        for (const bad of [{ lat: '' }, { lat: '91' }, { checkout: '2026-11-19' }, { checkout: '2026-12-25' }, { adults: '0' }, { adults: '9' }, { childAges: '1|2|3|4|5' }, { childAges: '18' }, { currency: 'WON' }, { lang: 'fr' }, { sort: 'cheap' }, { minStars: '6' }, { minReview: '11' }, { minPrice: '500', maxPrice: '100' }, { checkin: '11/20' }]) {
            expect(parseHotelQuery({ ...ok, ...bad })).toBeNull();
        }
    });
});

describe('buildCriteria', () => {
    it('필터가 있으면 해당 항목만 넣는다', () => {
        const f = parseHotelQuery({ lat: '1', lng: '2', checkin: '2026-11-20', checkout: '2026-11-22', minStars: '4', maxPrice: '200000', childAges: '7' });
        const c = buildCriteria(f, 9395);
        expect(c).toMatchObject({ cityId: 9395, checkInDate: '2026-11-20', checkOutDate: '2026-11-22' });
        expect(c.additional).toMatchObject({ currency: 'KRW', language: 'ko-kr', maxResult: 30, sortBy: 'Recommended', discountOnly: false, minimumStarRating: 4, dailyRate: { minimum: 0, maximum: 200000 } });
        expect(c.additional.occupancy).toEqual({ numberOfAdult: 2, numberOfChildren: 1, childrenAges: [7] });
        expect(c.additional).not.toHaveProperty('minimumReviewScore');
    });

    it('필터가 없으면 별·점수·가격 항목이 없다', () => {
        const c = buildCriteria(parseHotelQuery({ lat: '1', lng: '2', checkin: '2026-11-20', checkout: '2026-11-22' }), 1);
        expect(c.additional).not.toHaveProperty('minimumStarRating');
        expect(c.additional).not.toHaveProperty('dailyRate');
    });
});

describe('normalizeHotels', () => {
    const row = { hotelId: 44842960, hotelName: '그란데 센터 포인트', starRating: 5, reviewScore: 9.1, reviewCount: 4209, currency: 'KRW', dailyRate: 169367, crossedOutRate: 227876, discountPercentage: 25.4, includeBreakfast: true, freeWifi: true, imageURL: 'http://pix8.agoda.net/a.jpg?s=800x600', landingURL: 'https://www.agoda.com/ko-kr/partners/partnersearch.aspx?cid=1&hid=44842960', latitude: 13.7, longitude: 100.5 };

    it('화면에 쓸 값만 남기고 사진은 https로, 링크는 그대로', () => {
        const [h] = normalizeHotels({ results: [row] });
        expect(h).toMatchObject({ id: '44842960', name: '그란데 센터 포인트', stars: 5, reviewScore: 9.1, reviewCount: 4209, price: 169367, crossedOut: 227876, discountPct: 25, breakfast: true, wifi: true, lat: 13.7, lng: 100.5 });
        expect(h.image).toBe('https://pix8.agoda.net/a.jpg?s=800x600');
        expect(h.url).toBe(row.landingURL);
    });

    it('정가가 없거나 판매가 이하이면 취소선 가격·할인율은 없다', () => {
        const [h] = normalizeHotels({ results: [{ ...row, crossedOutRate: 0, discountPercentage: 0 }] });
        expect(h.crossedOut).toBeNull();
        expect(h.discountPct).toBeNull();
    });

    it('예약 링크가 https가 아니거나 가격이 없으면 그 호텔은 뺀다', () => {
        const out = normalizeHotels({ results: [{ ...row, landingURL: 'javascript:alert(1)' }, { ...row, dailyRate: null }, row] });
        expect(out).toHaveLength(1);
    });

    it('결과가 없거나 모양이 다르면 빈 목록', () => {
        expect(normalizeHotels(null)).toEqual([]);
        expect(normalizeHotels({ error: { id: 911 } })).toEqual([]);
    });

    it('safeUrl·httpsImage', () => {
        expect(safeUrl('http://x.com')).toBeNull();
        expect(safeUrl('https://x.com/a')).toBe('https://x.com/a');
        expect(httpsImage('http://pix.agoda.net/a.jpg')).toBe('https://pix.agoda.net/a.jpg');
        expect(httpsImage(null)).toBeNull();
    });
});

describe('searchHotels', () => {
    const f = parseHotelQuery({ lat: '13.7563', lng: '100.5018', checkin: '2026-11-20', checkout: '2026-11-22' });

    function stubFetch(status, body) {
        const fetchMock = vi.fn(async () => ({ status, text: async () => JSON.stringify(body) }));
        vi.stubGlobal('fetch', fetchMock);
        return fetchMock;
    }

    it('가까운 도시 ID로 아고다를 부르고 결과를 돌려준다(키는 Authorization 헤더로만)', async () => {
        vi.stubEnv('AGODA_API_KEY', '1234567:00000000-0000-0000-0000-000000000000');
        const fetchMock = stubFetch(200, { results: [{ hotelId: 1, hotelName: 'A', dailyRate: 100, landingURL: 'https://www.agoda.com/x' }] });
        const out = await searchHotels(f);
        expect(out.city.id).toBe(9395);
        expect(out.nights).toBe(2);
        expect(out.hotels).toHaveLength(1);
        const [url, init] = fetchMock.mock.calls[0];
        expect(String(url)).toContain('affiliateservice/lt_v1');
        expect(init.headers.authorization).toBe(process.env.AGODA_API_KEY);
        expect(JSON.parse(init.body).criteria.cityId).toBe(9395);
        expect(init.body).not.toContain('00000000'); // 키가 요청 본문에 새지 않는다
    });

    it('아고다가 "결과 없음(911)"이면 실패가 아니라 빈 목록', async () => {
        stubFetch(200, { error: { id: 911, message: 'No search result' } });
        const out = await searchHotels(f);
        expect(out.hotels).toEqual([]);
        expect(out.city.id).toBe(9395);
    });

    it('아고다 서버 오류는 던진다', async () => {
        stubFetch(500, { error: { id: 500 } });
        await expect(searchHotels(f)).rejects.toThrow(/agoda HTTP 500/);
    });

    it('가까운 도시가 없으면 아고다를 부르지 않고 빈 결과', async () => {
        const fetchMock = stubFetch(200, {});
        const out = await searchHotels(parseHotelQuery({ lat: '0', lng: '-140', checkin: '2026-11-20', checkout: '2026-11-22' }));
        expect(out.city).toBeNull();
        expect(fetchMock).not.toHaveBeenCalled();
    });
});

describe('isConfigured', () => {
    it('"숫자:키" 모양일 때만 설정된 것', () => {
        vi.stubEnv('AGODA_API_KEY', '');
        expect(isConfigured()).toBe(false);
        vi.stubEnv('AGODA_API_KEY', 'abc');
        expect(isConfigured()).toBe(false);
        vi.stubEnv('AGODA_API_KEY', '1234567:00000000-0000-0000-0000-000000000000');
        expect(isConfigured()).toBe(true);
    });
});
