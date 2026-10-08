import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildIgnavBody, normalizeIgnav } from './ignav.js';
import { kiwiFlightUrl, tripcomFlightUrl } from './deeplinks.js';
import { ignavCap, takeIgnavCall, IgnavCapError } from './cap.js';

const search = { origin: 'SEL', destination: 'TYO', departDate: '2026-11-20', returnDate: '2026-11-25', adults: 2, children: 1, infants: 1, cabin: 'BUSINESS' };

// 2026-10-09 실제 응답(ICN→NRT 왕복)을 줄인 모양
const seg = (code, no, from, to, dep, arr, min = 150) => ({
    marketing_carrier_code: code,
    flight_number: no,
    operating_carrier_name: code === '7C' ? 'Jeju Air' : code === 'BX' ? 'Air Busan' : 'Korean Air',
    departure_airport: from,
    departure_time_local: dep,
    arrival_airport: to,
    arrival_time_local: arr,
    duration_minutes: min,
});
const itinerary = (id, amount, code, no, extra = {}) => ({
    price: { amount, currency: 'KRW', status: 'verified' },
    outbound: { carrier: code, duration_minutes: 150, segments: [seg(code, no, 'ICN', 'NRT', '2026-11-20T15:35:00', '2026-11-20T18:10:00')] },
    inbound: { carrier: code, duration_minutes: 180, segments: [seg(code, String(Number(no) + 1), 'NRT', 'ICN', '2026-11-25T19:05:00', '2026-11-25T22:05:00', 180)] },
    cabin_class: 'economy',
    requires_self_transfer: false,
    ignav_id: id,
    ...extra,
});

describe('buildIgnavBody', () => {
    it('검색 조건을 Ignav 필드로 바꾼다(유아는 무릎 유아, 좌석 등급·시장 포함)', () => {
        expect(buildIgnavBody(search, 'ja')).toEqual({
            origin: 'SEL',
            destination: 'TYO',
            departure_date: '2026-11-20',
            return_date: '2026-11-25',
            adults: 2,
            children: 1,
            infants_on_lap: 1,
            market: 'JP',
            cabin_class: 'business',
        });
    });

    it('편도·기본값: 귀국일·아동·유아 필드를 보내지 않고, 시장은 언어로 정한다', () => {
        const body = buildIgnavBody({ origin: 'ICN', destination: 'NRT', departDate: '2026-11-20', returnDate: null, adults: 1 }, 'ko');
        expect(body).toEqual({ origin: 'ICN', destination: 'NRT', departure_date: '2026-11-20', adults: 1, market: 'KR', cabin_class: 'economy' });
        expect(buildIgnavBody({ ...search, cabin: undefined }, 'zh-TW').market).toBe('TW');
        expect(buildIgnavBody(search, 'en').market).toBe('US');
    });
});

describe('normalizeIgnav', () => {
    it('가격순으로 정렬하고 1인 가격(성인+아동 몫)·구간 요약을 만든다', () => {
        const out = normalizeIgnav({ itineraries: [itinerary('b', 600000, 'KE', '703'), itinerary('a', 300000, '7C', '1107')], observed_at: '2026-10-08T18:00:00Z' }, { adults: 2, children: 1 });
        expect(out.currency).toBe('KRW');
        expect(out.observedAt).toBe('2026-10-08T18:00:00Z');
        expect(out.offers.map((o) => o.id)).toEqual(['a', 'b']);
        const first = out.offers[0];
        expect(first).toMatchObject({ price: 300000, perPerson: 100000, verified: true, selfTransfer: false });
        expect(first.legs).toHaveLength(2);
        expect(first.legs[0]).toMatchObject({
            carrier: { code: '7C', name: 'Jeju Air' },
            origin: 'ICN',
            destination: 'NRT',
            depart: '2026-11-20T15:35:00',
            stops: 0,
            via: [],
            minutes: 150,
        });
        expect(first.legs[0].segments[0].flightNo).toBe('7C1107');
    });

    it('경유는 구간 수-1, 경유지를 담고 자가 환승·미확인 가격을 표시한다', () => {
        const via = {
            price: { amount: 100, currency: 'USD', status: 'unverified' },
            outbound: { duration_minutes: 600, segments: [seg('KE', '1', 'ICN', 'TPE', '2026-11-20T10:00:00', '2026-11-20T12:00:00'), seg('BR', '2', 'TPE', 'NRT', '2026-11-20T14:00:00', '2026-11-20T18:00:00')] },
            requires_self_transfer: true,
            ignav_id: 'via',
        };
        const [o] = normalizeIgnav({ itineraries: [via] }, { adults: 1 }).offers;
        expect(o.legs).toHaveLength(1);
        expect(o.legs[0]).toMatchObject({ stops: 1, via: ['TPE'], origin: 'ICN', destination: 'NRT' });
        expect(o).toMatchObject({ verified: false, selfTransfer: true });
    });

    it('가격이 없거나 구간이 비면 빼고, 같은 비행 조합은 싼 것 하나만 남긴다', () => {
        const dupe = itinerary('dupe', 400000, '7C', '1107');
        const out = normalizeIgnav(
            {
                itineraries: [
                    itinerary('a', 300000, '7C', '1107'),
                    dupe,
                    { ...itinerary('nop', 1, 'KE', '9'), price: { amount: null, currency: 'KRW' } },
                    { ...itinerary('empty', 1, 'KE', '9'), outbound: { segments: [] } },
                ],
            },
            { adults: 1 },
        );
        expect(out.offers.map((o) => o.id)).toEqual(['a']);
    });

    it('확인된 가격이 있으면 비현실적으로 낮은 미확인 가격은 뺀다(없을 때만 남겨 \'약\' 표시)', () => {
        const unverified = (id, amount) => itinerary(id, amount, 'KE', String(Number(id.slice(1)) * 10), { price: { amount, currency: 'KRW', status: 'unverified' } });
        const mixed = normalizeIgnav({ itineraries: [unverified('u1', 100), itinerary('v', 300000, '7C', '1107')] }, { adults: 1 });
        expect(mixed.offers.map((o) => o.id)).toEqual(['v']);
        const onlyUnverified = normalizeIgnav({ itineraries: [unverified('u1', 100), unverified('u2', 200)] }, { adults: 1 });
        expect(onlyUnverified.offers.map((o) => [o.id, o.verified])).toEqual([['u1', false], ['u2', false]]);
    });

    it('1,000건이 와도 가격순 앞쪽 + 항공사별 몇 개로 추려 100건을 넘기지 않는다(비싼 항공사도 남는다)', () => {
        const many = Array.from({ length: 1000 }, (_, i) => itinerary(`i${i}`, 100000 + i * 100, '7C', String(1000 + i * 2)));
        many.push(itinerary('ke', 9_000_000, 'KE', '703'));
        const out = normalizeIgnav({ itineraries: many }, { adults: 1 });
        expect(out.offers.length).toBeLessThanOrEqual(100);
        expect(out.offers[0].id).toBe('i0');
        expect(out.offers.some((o) => o.id === 'ke')).toBe(true);
    });

    it('결과가 없으면 빈 목록과 통화 없음', () => {
        expect(normalizeIgnav({ itineraries: [] }, { adults: 1 })).toEqual({ currency: null, offers: [], observedAt: null });
        expect(normalizeIgnav(null, { adults: 1 }).offers).toEqual([]);
    });
});

describe('예약 링크 주소', () => {
    it('Trip.com KR: 노선·날짜·인원·좌석과 제휴 값(Allianceid·SID)을 붙인다', () => {
        const url = new URL(tripcomFlightUrl(search));
        expect(url.origin + url.pathname).toBe('https://kr.trip.com/flights/SEL-to-TYO/tickets-SEL-TYO');
        const p = url.searchParams;
        expect(Object.fromEntries(p)).toMatchObject({
            flighttype: 'RT',
            dcity: 'SEL',
            acity: 'TYO',
            ddate: '2026-11-20',
            rdate: '2026-11-25',
            class: 'c',
            quantity: '2',
            childqty: '1',
            babyqty: '1',
            Allianceid: '10792895',
            SID: '332524291',
            trip_sub1: 'flights_results',
        });
    });

    it('Trip.com KR 편도: rdate 없이 OW', () => {
        const p = new URL(tripcomFlightUrl({ ...search, returnDate: null })).searchParams;
        expect(p.get('flighttype')).toBe('OW');
        expect(p.has('rdate')).toBe(false);
    });

    it('Kiwi /deep: 코드 그대로, 왕복은 return, 언어·통화·좌석 등급(번체 언어는 tw)', () => {
        const url = new URL(kiwiFlightUrl(search, 'en'));
        expect(url.origin + url.pathname).toBe('https://www.kiwi.com/deep');
        expect(Object.fromEntries(url.searchParams)).toEqual({
            from: 'SEL',
            to: 'TYO',
            departure: '2026-11-20',
            return: '2026-11-25',
            adults: '2',
            children: '1',
            infants: '1',
            cabinClass: 'business',
            lang: 'en',
            currency: 'usd',
        });
        const oneWay = new URL(kiwiFlightUrl({ ...search, returnDate: null, cabin: 'PREMIUM_ECONOMY' }, 'ja')).searchParams;
        expect(oneWay.has('return')).toBe(false);
        expect([oneWay.get('lang'), oneWay.get('currency'), oneWay.get('cabinClass')]).toEqual(['ja', 'jpy', 'premium']);
        expect(new URL(kiwiFlightUrl(search, 'zh-TW')).searchParams.get('lang')).toBe('tw');
    });
});

describe('월 상한', () => {
    it('기본 2,500건, 환경 변수로 바꾸되 잘못된 값은 기본값', () => {
        expect(ignavCap({})).toBe(2500);
        expect(ignavCap({ IGNAV_MONTHLY_CAP: '100' })).toBe(100);
        expect(ignavCap({ IGNAV_MONTHLY_CAP: '0' })).toBe(0);
        expect(ignavCap({ IGNAV_MONTHLY_CAP: 'abc' })).toBe(2500);
        expect(ignavCap({ IGNAV_MONTHLY_CAP: '-5' })).toBe(2500);
    });

    it('DB를 확인할 수 없으면 통과시키지 않는다(닫힌 쪽으로 실패)', async () => {
        await expect(takeIgnavCall(null)).rejects.toThrow('ignav cap unavailable');
        await expect(takeIgnavCall({ rpc: async () => ({ data: null, error: { message: 'x' } }) })).rejects.toThrow('ignav cap unavailable');
    });

    it('한도에 닿으면 IgnavCapError, 아니면 사용량을 돌려준다', async () => {
        const rpc = vi.fn(async () => ({ data: [{ allowed: true, used: 7 }], error: null }));
        await expect(takeIgnavCall({ rpc })).resolves.toEqual({ limit: 2500, used: 7 });
        expect(rpc).toHaveBeenCalledWith('take_google_call', { p_kind: 'ignav', p_limit: 2500, p_count: 1 });
        await expect(takeIgnavCall({ rpc: async () => ({ data: [{ allowed: false, used: 2500 }], error: null }) })).rejects.toBeInstanceOf(IgnavCapError);
    });
});

describe('핸들러', () => {
    const fakeDb = (allowed = true) => ({ rpc: async () => ({ data: [{ allowed, used: 1 }], error: null }) });
    let db;
    let fetchMock;

    async function call(query) {
        vi.resetModules();
        vi.doMock('../supabaseAdmin.js', () => ({ supabaseAdmin: () => db }));
        const { handleFlights } = await import('./index.js');
        const res = { statusCode: 200, headers: {}, body: null };
        res.status = (c) => ((res.statusCode = c), res);
        res.json = (b) => ((res.body = b), res);
        res.setHeader = (k, v) => (res.headers[k.toLowerCase()] = v);
        await handleFlights({ query }, res);
        return res;
    }

    const future = () => {
        const d = new Date(Date.now() + 40 * 86400_000);
        return d.toISOString().slice(0, 10);
    };
    const q = () => ({ kind: 'search', origin: 'ICN', destination: 'NRT', depart_date: future(), adults: '1', locale: 'ko' });

    beforeEach(() => {
        db = fakeDb();
        process.env.IGNAV_API_KEY = 'test-key';
        delete process.env.TRAVELPAYOUTS_API_TOKEN;
        fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ itineraries: [itinerary('a', 300000, '7C', '1107')], observed_at: 'now' }) }));
        vi.stubGlobal('fetch', fetchMock);
    });

    it('틀린 요청은 400 — Ignav를 부르지 않는다', async () => {
        for (const bad of [{ ...q(), kind: 'x' }, { ...q(), origin: 'icn1' }, { ...q(), depart_date: '2020-01-01' }, { ...q(), adults: '0' }, { ...q(), destination: 'ICN' }]) {
            const res = await call(bad);
            expect(res.statusCode).toBe(400);
        }
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('성공: 한국어는 Trip.com 링크와 함께, CDN 캐시 3분', async () => {
        const res = await call(q());
        expect(res.statusCode).toBe(200);
        expect(res.body.offers).toHaveLength(1);
        expect(res.body.bookingUrl).toContain('kr.trip.com/flights/');
        expect(res.headers['cache-control']).toBe('public, s-maxage=180, stale-while-revalidate=300');
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe('https://ignav.com/api/fares/one-way');
        expect(init.headers['X-Api-Key']).toBe('test-key');
        expect(JSON.parse(init.body).market).toBe('KR');
    });

    it('외국어는 Kiwi 링크(토큰이 없으면 변환 없이 tracked:false)', async () => {
        const res = await call({ ...q(), locale: 'en' });
        expect(res.body.bookingUrl).toContain('https://www.kiwi.com/deep?from=ICN&to=NRT');
        expect(res.body.tracked).toBe(false);
    });

    it('결과가 0건이면 캐시하지 않는다', async () => {
        fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ itineraries: [] }) });
        const res = await call(q());
        expect(res.statusCode).toBe(200);
        expect(res.body.offers).toEqual([]);
        expect(res.headers['cache-control']).toBe('no-store');
    });

    it('키가 없으면 503 not_configured + 예약 사이트 링크, 월 상한이면 503 flights_cap — 둘 다 Ignav를 부르지 않는다', async () => {
        delete process.env.IGNAV_API_KEY;
        let res = await call(q());
        expect([res.statusCode, res.body.error, typeof res.body.bookingUrl]).toEqual([503, 'not_configured', 'string']);
        process.env.IGNAV_API_KEY = 'test-key';
        db = fakeDb(false);
        res = await call(q());
        expect([res.statusCode, res.body.error, typeof res.body.bookingUrl]).toEqual([503, 'flights_cap', 'string']);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('DB가 없으면(상한 확인 불가) 돈이 나가는 호출을 하지 않는다', async () => {
        db = null;
        const res = await call(q());
        expect(res.statusCode).toBe(503);
        expect(res.body.error).toBe('flights_unavailable');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('Ignav가 실패하면 502 flights_failed + 링크', async () => {
        fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: { code: 'x' } }) });
        const res = await call(q());
        expect([res.statusCode, res.body.error, typeof res.body.bookingUrl]).toEqual([502, 'flights_failed', 'string']);
    });
});
