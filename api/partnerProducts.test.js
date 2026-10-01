import { describe, expect, it } from 'vitest';
import { parseListFilters } from './partnerProducts.js';

describe('parseListFilters — 액티비티 탭 필터 검증', () => {
    it('안 준 값은 건너뛰고 page는 1', () => {
        expect(parseListFilters({})).toEqual({ page: 1 });
    });

    it('올바른 값은 그대로(숫자는 정수로)', () => {
        expect(parseListFilters({ category: 'ticket_v2', maxPrice: '200000', sort: 'selling_count_desc', page: '3' })).toEqual({
            category: 'ticket_v2',
            maxPrice: 200000,
            sort: 'selling_count_desc',
            page: 3,
        });
    });

    it.each([
        [{ category: 'all' }],
        [{ category: 'Tour' }],
        [{ category: 'a b' }],
        [{ category: ['tour'] }],
        [{ maxPrice: '5' }],
        [{ maxPrice: '12abc' }],
        [{ maxPrice: '99999999' }],
        [{ sort: 'popular' }],
        [{ page: '0' }],
        [{ page: '11' }],
        [{ page: 'x' }],
    ])('틀린 값은 null — %j', (query) => {
        expect(parseListFilters(query)).toBeNull();
    });
});
