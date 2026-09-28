import { describe, expect, it } from 'vitest';
import {
    airWebResultsUrl,
    isMyrealtripUrl,
    kstToday,
    normalizeProduct,
    normalizeReservation,
    normalizeRevenue,
    parseFlightQuery,
    searchUrl,
    splitRange,
} from './myrealtrip.js';

const TODAY = '2026-09-28';

describe('parseFlightQuery', () => {
    const base = { origin: 'sel', destination: 'OSA', depart_date: '2026-11-10', return_date: '2026-11-15' };

    it('왕복 — 코드는 대문자, 종류 기본값은 도시, 성인 기본 1명', () => {
        expect(parseFlightQuery(base, TODAY)).toEqual({
            origin: 'SEL',
            originType: 'city',
            destination: 'OSA',
            destinationType: 'city',
            departDate: '2026-11-10',
            returnDate: '2026-11-15',
            adults: 1,
        });
    });

    it('편도 + 공항 코드 + 인원', () => {
        const f = parseFlightQuery({ origin: 'ICN', origin_type: 'airport', destination: 'KIX', destination_type: 'airport', depart_date: '2026-11-10', adults: '3' }, TODAY);
        expect(f).toMatchObject({ originType: 'airport', destinationType: 'airport', returnDate: null, adults: 3 });
    });

    it.each([
        ['코드 형식', { ...base, origin: 'SE1' }],
        ['출발=도착', { ...base, destination: 'SEL' }],
        ['없는 날짜', { ...base, depart_date: '2026-02-30' }],
        ['지난 날짜', { ...base, depart_date: '2026-09-20' }],
        ['1년 넘게 뒤', { ...base, depart_date: '2027-12-01', return_date: '' }],
        ['귀국이 출발보다 먼저', { ...base, return_date: '2026-11-09' }],
        ['성인 0명', { ...base, adults: '0' }],
        ['성인 10명', { ...base, adults: '10' }],
        ['성인 소수', { ...base, adults: '1.5' }],
    ])('거절: %s', (_label, query) => {
        expect(parseFlightQuery(query, TODAY)).toBeNull();
    });

    it('시차 대비 어제 출발까지는 받는다', () => {
        expect(parseFlightQuery({ ...base, depart_date: '2026-09-27', return_date: '' }, TODAY)).not.toBeNull();
    });
});

describe('airWebResultsUrl', () => {
    it('랜딩 API가 주던 모양 그대로(왕복, 도시 코드)', () => {
        const url = airWebResultsUrl({ origin: 'SEL', originType: 'city', destination: 'OSA', destinationType: 'city', departDate: '2026-11-10', returnDate: '2026-11-15', adults: 1 });
        expect(url).toBe('https://air-web.myrealtrip.com/results?trip=C.SEL.C.OSA.2026-11-10%2FC.OSA.C.SEL.2026-11-15&adult=1&tripType=ROUND_TRIP');
    });

    it('편도, 공항 코드는 A.', () => {
        const url = airWebResultsUrl({ origin: 'ICN', originType: 'airport', destination: 'KIX', destinationType: 'airport', departDate: '2026-11-10', returnDate: null, adults: 2 });
        expect(url).toBe('https://air-web.myrealtrip.com/results?trip=A.ICN.A.KIX.2026-11-10&adult=2&tripType=ONE_WAY');
    });
});

describe('links', () => {
    it('검색 주소는 q 파라미터', () => {
        expect(searchUrl('오사카 유니버설')).toBe('https://www.myrealtrip.com/search?q=%EC%98%A4%EC%82%AC%EC%B9%B4%20%EC%9C%A0%EB%8B%88%EB%B2%84%EC%84%A4');
    });

    it('마이링크 대상은 마이리얼트립 https 주소만', () => {
        expect(isMyrealtripUrl('https://experiences.myrealtrip.com/products/5869248')).toBe(true);
        expect(isMyrealtripUrl('https://www.myrealtrip.com/offers/3467')).toBe(true);
        expect(isMyrealtripUrl('http://www.myrealtrip.com/offers/3467')).toBe(false);
        expect(isMyrealtripUrl('https://myrealtrip.com.evil.example/x')).toBe(false);
        expect(isMyrealtripUrl('https://evilmyrealtrip.com/x')).toBe(false);
        expect(isMyrealtripUrl(`https://www.myrealtrip.com/?q=${'a'.repeat(2000)}`)).toBe(false);
        expect(isMyrealtripUrl(undefined)).toBe(false);
    });
});

describe('splitRange', () => {
    it('양끝 포함, maxDays일씩', () => {
        expect(splitRange('2026-01-01', '2026-03-01', 28)).toEqual([
            ['2026-01-01', '2026-01-28'],
            ['2026-01-29', '2026-02-25'],
            ['2026-02-26', '2026-03-01'],
        ]);
        expect(splitRange('2026-09-28', '2026-09-28', 28)).toEqual([['2026-09-28', '2026-09-28']]);
    });
});

describe('kstToday', () => {
    it('UTC 15시 이후는 한국 다음 날', () => {
        expect(kstToday(new Date('2026-09-28T14:59:00Z'))).toBe('2026-09-28');
        expect(kstToday(new Date('2026-09-28T15:00:00Z'))).toBe('2026-09-29');
    });
});

// 아래 입력은 docs.myrealtrip.com 응답 예시 그대로
describe('normalizers', () => {
    it('상품 검색 결과', () => {
        expect(
            normalizeProduct({
                gid: '5869248',
                itemName: '오사카 난카이 라피트 편도 E-티켓',
                description: '오사카 ∙ 이동·교통',
                salePrice: 12657,
                priceDisplay: '12,657원',
                category: '이동·교통',
                reviewScore: 4.83,
                reviewCount: 1250,
                imageUrl: 'https://d6bztw1vgnv55.cloudfront.net/experiences/products/5869248/thumbnail.jpg',
                productUrl: 'https://experiences.myrealtrip.com/products/5869248',
                deepLink: 'mrt://experiences/detail/5869248',
                tags: ['즉시 확정'],
            }),
        ).toEqual({
            id: '5869248',
            title: '오사카 난카이 라피트 편도 E-티켓',
            category: '이동·교통',
            imageUrl: 'https://d6bztw1vgnv55.cloudfront.net/experiences/products/5869248/thumbnail.jpg',
            price: 12657,
            currency: 'KRW',
            rating: 4.83,
            reviewCount: 1250,
            url: 'https://experiences.myrealtrip.com/products/5869248',
        });
        expect(normalizeProduct({ gid: '1', itemName: 'x', productUrl: 'https://example.com/p' })).toBeNull();
    });

    it('수익 — 환불은 음수 수익, commissionBase가 없으면 판매가', () => {
        const row = normalizeRevenue(
            { linkId: '1000001', reservationNo: 'TNA-1', quantity: 2, salePrice: 150000, commissionBase: null, settlementCriteriaDate: '2025-01-15', commission: -14700, commissionRate: 10, closingType: '환불완료', reservedAt: '2025-01-15T14:30:00', productTitle: '박물관 입장권' },
            'tna',
        );
        expect(row).toEqual({
            kind: 'tna',
            reservationNo: 'TNA-1',
            linkId: '1000001',
            title: '박물관 입장권',
            closingType: '환불완료',
            amount: 150000,
            commission: -14700,
            commissionRate: 10,
            date: '2025-01-15',
            reservedAt: '2025-01-15T14:30:00',
        });
    });

    it('항공 수익 — 예약번호가 flightReservationNo로만 와도', () => {
        expect(normalizeRevenue({ flightReservationNo: 'F1ABCD', linkId: 1426528, salePrice: 450000, commission: 4500 }, 'flight')).toMatchObject({
            reservationNo: 'F1ABCD',
            linkId: '1426528',
            amount: 450000,
            commission: 4500,
        });
    });

    it('예약 — 투어/항공', () => {
        expect(
            normalizeReservation(
                { reservedAt: '2025-01-15T14:30:00', reservationNo: 'TNA-1', status: 'CONFIRM', statusKor: '예약확정', salePrice: 150000, commissionBase: 142500, city: 'Seoul', linkId: '1000001', productTitle: '박물관 입장권', productCategory: 'TICKET', quantity: 2, canceledAt: null },
                'tna',
            ),
        ).toEqual({
            kind: 'tna',
            reservationNo: 'TNA-1',
            linkId: '1000001',
            title: '박물관 입장권',
            category: 'TICKET',
            status: 'CONFIRM',
            statusLabel: '예약확정',
            amount: 142500,
            quantity: 2,
            city: 'Seoul',
            reservedAt: '2025-01-15T14:30:00',
            canceledAt: null,
        });
        expect(
            normalizeReservation(
                { reservationNo: 'YEETUD', status: 'CANCELLED', statusKor: '예약취소', airline: '7C', airlineName: '제주항공', reservedAt: '2026-02-06T14:40:39', cancelledAt: '2026-02-06T15:14:07', categoryCode: 'AIR_JEJU_INT', linkId: '1426528', issueNet: 305490 },
                'flight',
            ),
        ).toMatchObject({ title: '제주항공', category: 'AIR_JEJU_INT', status: 'CANCELLED', amount: 305490, canceledAt: '2026-02-06T15:14:07' });
    });
});
