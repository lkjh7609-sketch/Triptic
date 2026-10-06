import { describe, expect, it } from 'vitest';
import { applyBlurbs, buildBlurbPrompt, selectCandidates, KEEP_PER_GROUP } from './nearbyGoogle.js';

const place = (id, group, over = {}) => ({
    id,
    group,
    displayName: { text: `장소 ${id}` },
    formattedAddress: '주소',
    location: { latitude: 35.0, longitude: 139.0 },
    types: [],
    primaryType: group === 'restaurant' ? 'restaurant' : 'park',
    rating: 4.4,
    userRatingCount: 300,
    businessStatus: 'OPERATIONAL',
    ...over,
});

describe('selectCandidates', () => {
    it('평점 4.0 미만·리뷰 50개 미만·영업 안 하는 곳·숙소·기준 장소를 뺀다', () => {
        const out = selectCandidates(
            [
                place('ok', 'restaurant'),
                place('lowRating', 'restaurant', { rating: 3.9 }),
                place('fewReviews', 'restaurant', { userRatingCount: 49 }),
                place('closed', 'restaurant', { businessStatus: 'CLOSED_PERMANENTLY' }),
                place('hotel', 'sight', { types: ['lodging'] }),
                place('base', 'cafe'),
                place('noCoords', 'cafe', { location: undefined }),
            ],
            { basePlaceId: 'base' },
        );
        expect(out.map((c) => c.placeId)).toEqual(['ok']);
    });

    it('묶음마다 평가가 좋은 순으로 KEEP_PER_GROUP곳까지만, 같은 장소는 한 번만', () => {
        const many = Array.from({ length: 10 }, (_, i) => place(`r${i}`, 'restaurant', { rating: 4.0 + i * 0.05 }));
        const out = selectCandidates([...many, place('r9', 'restaurant', { rating: 4.45 })]);
        expect(out).toHaveLength(KEEP_PER_GROUP);
        expect(out[0].placeId).toBe('r9');
    });

    it('9곳이 안 채워져도 찾은 만큼만 돌려준다(지어내서 채우지 않음)', () => {
        const out = selectCandidates([place('a', 'restaurant'), place('b', 'sight')]);
        expect(out.map((c) => c.category)).toEqual(['restaurant', 'spot']);
    });

    it('박물관·미술관·유적은 culture, 나머지 볼거리는 spot', () => {
        const out = selectCandidates([place('m', 'sight', { primaryType: 'museum' }), place('p', 'sight', { primaryType: 'park' })]);
        expect(out.map((c) => c.category).sort()).toEqual(['culture', 'spot']);
    });
});

describe('applyBlurbs', () => {
    const candidates = [{ placeId: 'a', name: 'A' }, { placeId: 'b', name: 'B' }];

    it('index로 문구를 붙이고, 없으면 빈 문구로 둔다', () => {
        const out = applyBlurbs(candidates, { places: [{ index: 1, reason: '좋아요', tip: '일찍 가세요' }] });
        expect(out[0]).toMatchObject({ placeId: 'a', reason: '', tip: '' });
        expect(out[1]).toMatchObject({ placeId: 'b', reason: '좋아요', tip: '일찍 가세요' });
    });

    it('AI 응답이 없어도 장소는 그대로', () => {
        expect(applyBlurbs(candidates, null).map((c) => c.placeId)).toEqual(['a', 'b']);
    });

    it('프롬프트는 장소를 더하거나 바꾸지 못하게 하고 모르면 비우라고 한다', () => {
        const prompt = buildBlurbPrompt({ candidates: [{ name: 'A', category: 'cafe', rating: 4.5, reviews: 100, address: 'x' }], placeName: '역', city: '도쿄', languageName: 'Korean' });
        expect(prompt).toContain('Do not add, remove or rename places');
        expect(prompt).toContain('empty string');
    });
});
