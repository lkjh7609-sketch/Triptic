import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildFlightBody, normalizeFlights, parseFlightQuery } from './flights.js';
import { buildHotelQuery, normalizeHotels, parseHotelQuery, roomsParam } from './hotels.js';
import { normalizeFlightPlaces, normalizeHotelPlaces } from './places.js';
import { safeUrl, userTrackId } from './client.js';

afterEach(() => vi.unstubAllEnvs());

describe('parseFlightQuery', () => {
    const ok = { origin: 'sel', destination: 'TYO', depart: '2026-11-20', return: '2026-11-25', adults: '2', children: '1', infants: '1', cabin: 'BUSINESS', currency: 'krw', sort: 'price', stops: '0' };

    it('검색 조건을 검증해 Kayak 값으로 바꾼다', () => {
        expect(parseFlightQuery(ok)).toMatchObject({ origin: 'SEL', destination: 'TYO', return: '2026-11-25', adults: 2, children: 1, infants: 1, cabin: 'business', currency: 'KRW', kayakSort: 'price', stops: 0 });
    });

    it('틀린 값은 null — 같은 출발·도착, 오는 날이 가는 날보다 앞, 좌석 9석 초과, 유아가 성인보다 많음, 모르는 등급', () => {
        for (const bad of [{ destination: 'SEL' }, { return: '2026-11-19' }, { adults: '8', children: '2' }, { adults: '1', infants: '2' }, { cabin: 'COACH' }, { origin: 'SEOUL' }, { depart: '11/20' }, { stops: '3' }, { currency: 'WON1' }, { sort: 'cheap' }]) {
            expect(parseFlightQuery({ ...ok, ...bad })).toBeNull();
        }
    });

    it('이어받기는 searchId·cluster만 있으면 되고 모양을 확인한다', () => {
        expect(parseFlightQuery({ searchId: 'abc_123-XY', cluster: '4' })).toMatchObject({ searchId: 'abc_123-XY', cluster: '4' });
        expect(parseFlightQuery({ searchId: 'abc_123-XY' })).toBeNull();
        expect(parseFlightQuery({ searchId: '../x', cluster: '4' })).toBeNull();
    });
});

describe('buildFlightBody', () => {
    it('왕복 = 다리 2개, 승객 종류별로, 결과 설정은 resultParameters 안에', () => {
        const body = buildFlightBody(parseFlightQuery({ origin: 'ICN', destination: 'NRT', depart: '2026-11-20', return: '2026-11-25', adults: '2', infants: '1', stops: '1' }));
        expect(body.searchStartParameters.passengers).toEqual(['ADT', 'ADT', 'INL']);
        expect(body.searchStartParameters.legs).toHaveLength(2);
        expect(body.searchStartParameters.legs[1].origin.airports).toEqual(['NRT']);
        expect(body.resultParameters).toMatchObject({ currency: 'USD', maxStops: 1, sort: { key: 'bestValue', direction: 'asc' } });
        expect(body.currency).toBeUndefined();
    });

    it('이어받기 본문은 searchId + resultParameters', () => {
        expect(buildFlightBody(parseFlightQuery({ searchId: 'abcd', cluster: '4', sort: 'duration' }))).toMatchObject({ searchId: 'abcd', resultParameters: { sort: { key: 'duration' } } });
    });
});

const RAW_FLIGHT = {
    status: 'complete',
    searchId: 'abcd',
    cluster: '4',
    totalCount: 1,
    currency: 'KRW',
    results: [
        {
            id: 'r1',
            legs: [{ id: 'L1' }],
            bookingOptions: [
                { displayPrice: { price: 300 }, providerCode: 'B', bookingUrl: 'https://affiliates.kayak.com/b', badges: [{ code: 'freeCancellation' }], fees: { carryOnBag: [{ restriction: 'included' }], checkedBag: [{ restriction: 'fee' }] }, fareFamilies: [{ displayName: 'Basic' }] },
                { displayPrice: { price: 250 }, providerCode: 'A', bookingUrl: 'https://affiliates.kayak.com/a' },
                { displayPrice: { price: 100 }, providerCode: 'A', bookingUrl: 'javascript:alert(1)' },
            ],
        },
        { id: 'r2', legs: [{ id: 'MISSING' }], bookingOptions: [{ displayPrice: { price: 1 }, bookingUrl: 'https://x.test/' }] },
    ],
    legs: { L1: { duration: 145, departureTime: '2026-11-20T07:55:00', arrivalTime: '2026-11-20T10:35:00', segments: [{ id: 's1' }, { id: 's2' }] } },
    segments: {
        s1: { airline: 'LJ', flightNumber: '203', origin: 'ICN', destination: 'OSA', departureTime: '2026-11-20T07:55:00', arrivalTime: '2026-11-20T09:00:00' },
        s2: { airline: 'LJ', flightNumber: '12', origin: 'OSA', destination: 'NRT', departureTime: '2026-11-20T09:50:00', arrivalTime: '2026-11-20T10:35:00' },
    },
    airlines: { LJ: { displayName: 'Jin Air', logoUrl: 'https://x.test/lj.png' } },
    providers: { A: { displayName: 'Agency A', logoUrls: { imageUrl: 'https://x.test/a.png' } }, B: { displayName: 'Agency B' } },
    airports: { ICN: { displayName: 'Incheon' } },
};

describe('normalizeFlights', () => {
    const out = normalizeFlights(RAW_FLIGHT);

    it('최저가 예약처가 앞, 위험한 주소는 버리고, 다리가 없는 결과는 뺀다', () => {
        expect(out.offers).toHaveLength(1);
        expect(out.offers[0].price).toBe(250);
        expect(out.offers[0].options.map((o) => o.providerName)).toEqual(['Agency A', 'Agency B']);
        expect(out.offers[0].options.every((o) => o.bookingUrl.startsWith('https://'))).toBe(true);
    });

    it('경유·항공사 이름·수하물·무료취소를 담는다', () => {
        const leg = out.offers[0].legs[0];
        expect(leg).toMatchObject({ origin: 'ICN', destination: 'NRT', stops: 1, via: ['OSA'], minutes: 145 });
        expect(leg.segments[0]).toMatchObject({ airlineName: 'Jin Air', flightNumber: 'LJ203' });
        const b = out.offers[0].options[1];
        expect(b).toMatchObject({ carryOn: 'included', checked: 'fee', freeCancel: true, fare: 'Basic' });
        expect(out).toMatchObject({ status: 'complete', searchId: 'abcd', cluster: '4', currency: 'KRW' });
    });
});

describe('parseHotelQuery / roomsParam / buildHotelQuery', () => {
    const ok = { destination: 'kplace:22327', checkin: '2026-11-20', checkout: '2026-11-22', adults: '3', rooms: '2', childAges: '5|9', currency: 'krw', lang: 'zh-TW', sort: 'price', stars: '4|5', guestRating: '8', minPrice: '10000', maxPrice: '300000', facilities: '12|13' };

    it('조건을 검증하고 Kayak 질의로 바꾼다', () => {
        const f = parseHotelQuery(ok);
        expect(f).toMatchObject({ rooms: 2, adults: 3, ages: [5, 9], currency: 'KRW', lang: 'zh_TW', stars: ['4', '5'], guestRating: 8 });
        const q = buildHotelQuery(f);
        expect(q).toMatchObject({ destination: 'kplace:22327', rooms: '2:5,9|1', sortField: 'minRate', sortDirection: 'ascending', starRating: '4|5', guestRatings: 8, minPrice: 10000, features: '12|13', onlyIfComplete: 'true' });
    });

    it('방마다 어른을 나누고 아이는 첫 방에', () => {
        expect(roomsParam({ adults: 5, rooms: 2, ages: [] })).toBe('3|2');
        expect(roomsParam({ adults: 2, rooms: 1, ages: [7] })).toBe('2:7');
    });

    it('틀린 값은 null — 목적지 모양, 체크아웃이 앞, 31박, 방보다 적은 어른, 별 6개', () => {
        for (const bad of [{ destination: 'Osaka' }, { checkout: '2026-11-20' }, { checkout: '2026-12-25' }, { adults: '1', rooms: '2' }, { stars: '6' }, { lang: 'fr' }, { sort: 'x' }, { childAges: '5|5|5|5|5' }, { guestRating: '11' }]) {
            expect(parseHotelQuery({ ...ok, ...bad })).toBeNull();
        }
    });
});

describe('normalizeHotels', () => {
    const raw = {
        isComplete: true,
        totalFilteredResults: 45,
        currencyCode: 'KRW',
        lowestTotalRate: 100,
        highestTotalRate: 900,
        providers: [{ name: '아고다', logo: 'https://x.test/ag.png' }, { name: '부킹닷컴' }],
        starRatings: [{ key: 0, value: 5 }, { key: 4, value: 30 }],
        propertyTypes: [{ id: 0, name: '호텔', hotelCount: 20 }, { id: 1, name: '모텔', hotelCount: 0 }],
        facilities: [{ id: 5, name: '와이파이', hotelCount: 9 }, { id: 6, name: '수영장', hotelCount: 20 }],
        results: [
            {
                id: 1,
                name: 'Hotel A',
                translatedName: '호텔 A',
                address: 'Osaka',
                starRating: 4,
                guestRating: 8.7,
                numberOfReviews: 120,
                distance: 900,
                images: [{ large: 'https://x.test/1.jpg' }, { large: 'http://insecure.test/2.jpg' }],
                rates: [
                    { roomName: 'Twin', totalRate: 500, providerIndex: 1, hasFreeCancellation: false, bookUri: 'https://x.test/b', inclusions: [0] },
                    { roomName: 'Double', totalRate: 300, providerIndex: 0, hasFreeCancellation: true, bookUri: 'https://x.test/a', inclusions: [] },
                    { roomName: 'Bad', totalRate: 100, providerIndex: 0, bookUri: 'ftp://x.test' },
                ],
            },
            { id: 2, name: 'No rates', rates: [] },
        ],
    };
    const out = normalizeHotels(raw, parseHotelQuery({ destination: 'kplace:1', checkin: '2026-11-20', checkout: '2026-11-22' }));

    it('호텔 이름·사진·최저가·예약처를 정리한다', () => {
        expect(out.hotels).toHaveLength(1);
        const h = out.hotels[0];
        expect(h).toMatchObject({ name: '호텔 A', stars: 4, lowest: 300, nights: 2, freeCancel: true });
        expect(h.images).toEqual(['https://x.test/1.jpg']);
        expect(h.rates.map((r) => [r.provider, r.total, r.breakfast])).toEqual([['아고다', 300, false], ['부킹닷컴', 500, true]]);
    });

    it('필터 목록: 별(0 제외)·건수 0인 종류 제외·편의시설은 많은 순', () => {
        expect(out.filters.stars).toEqual([{ key: 4, count: 30 }]);
        expect(out.filters.propertyTypes).toEqual([{ id: 0, name: '호텔', count: 20 }]);
        expect(out.filters.facilities.map((f) => f.name)).toEqual(['수영장', '와이파이']);
        expect(out).toMatchObject({ total: 45, hasMore: true, complete: true, currency: 'KRW' });
    });
});

describe('자동완성·공용', () => {
    it('항공: 모든 공항(도시)은 city, 공항은 airport, 코드가 없는 항목은 버린다', () => {
        const items = normalizeFlightPlaces({ results: [
            { iataCode: 'SEL', isMetro: true, primaryPlaceType: 'city', name: 'All airports', cityName: 'Seoul', countryName: 'South Korea' },
            { iataCode: 'ICN', isMetro: false, primaryPlaceType: 'airport', name: 'Incheon Intl', cityName: 'Incheon', countryName: 'South Korea' },
            { name: 'Seoul Station', primaryPlaceType: 'trainstation' },
        ] });
        expect(items).toEqual([
            { code: 'SEL', type: 'city', name: 'Seoul', detail: 'South Korea' },
            { code: 'ICN', type: 'airport', name: 'Incheon Intl', detail: 'Incheon, South Korea' },
        ]);
    });

    it('호텔: entityKey 모양만 받는다', () => {
        const items = normalizeHotelPlaces({ results: [
            { entityKey: 'kplace:22327', primaryPlaceType: 'city', name: 'Osaka', cityName: 'Osaka', regionName: 'Osaka Prefecture', countryName: 'Japan' },
            { entityKey: 'evil:1', name: 'x' },
        ] });
        expect(items).toEqual([{ key: 'kplace:22327', kind: 'city', name: 'Osaka', detail: 'Osaka Prefecture, Japan' }]);
    });

    it('safeUrl은 https만, userTrackId는 UUID만 받는다', () => {
        expect(safeUrl('https://a.test/x')).toBe('https://a.test/x');
        expect(safeUrl('http://a.test')).toBeNull();
        expect(safeUrl('javascript:1')).toBeNull();
        expect(userTrackId('3F2504E0-4F89-41D3-9A0C-0305E82C3301')).toBe('3f2504e0-4f89-41d3-9a0c-0305e82c3301');
        expect(userTrackId('nope')).toMatch(/^[0-9a-f-]{36}$/);
    });
});
