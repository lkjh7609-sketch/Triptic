import { describe, expect, it } from 'vitest';
import { groupOf, isMixComplete, missingCounts, pickBalanced } from './nearbyMix.js';

const row = (name, category) => ({ name, category });
const names = (rows) => rows.map((r) => r.name);

describe('주변 추천 구성(식당 3·카페 3·볼거리 3)', () => {
    it('문화·명소는 모두 볼거리 묶음', () => {
        expect(['restaurant', 'cafe', 'culture', 'spot', undefined].map(groupOf)).toEqual(['restaurant', 'cafe', 'sight', 'sight', 'sight']);
    });

    it('묶음마다 3곳 이상이면 충분하고, 아니면 모자란 만큼 센다', () => {
        const rows = [row('r1', 'restaurant'), row('r2', 'restaurant'), row('r3', 'restaurant'), row('c1', 'cafe'), row('s1', 'culture'), row('s2', 'spot'), row('s3', 'spot')];
        expect(isMixComplete(rows)).toBe(false);
        expect(missingCounts(rows)).toEqual({ restaurant: 0, cafe: 2, sight: 0 });
        expect(isMixComplete([...rows, row('c2', 'cafe'), row('c3', 'cafe')])).toBe(true);
    });

    const noShuffle = () => 0.999999; // Fisher–Yates가 아무것도 바꾸지 않는 값(항상 마지막 칸 선택)

    it('묶음마다 3곳씩 골라 식당 → 카페 → 볼거리 순으로 돌려준다(섞지 않으면 앞에 있는 것부터)', () => {
        const rows = [
            row('s1', 'spot'), row('r1', 'restaurant'), row('r2', 'restaurant'), row('c1', 'cafe'), row('r3', 'restaurant'), row('r4', 'restaurant'),
            row('c2', 'cafe'), row('s2', 'culture'), row('c3', 'cafe'), row('c4', 'cafe'), row('s3', 'spot'), row('s4', 'spot'),
        ];
        expect(names(pickBalanced(rows, noShuffle))).toEqual(['r1', 'r2', 'r3', 'c1', 'c2', 'c3', 's1', 's2', 's3']);
    });

    it('무작위로 고르므로 호출마다 다른 조합이 나오고, 구성(3·3·3)은 항상 지킨다', () => {
        const rows = [
            ...Array.from({ length: 8 }, (_, i) => row(`r${i}`, 'restaurant')),
            ...Array.from({ length: 8 }, (_, i) => row(`c${i}`, 'cafe')),
            ...Array.from({ length: 8 }, (_, i) => row(`s${i}`, i % 2 ? 'spot' : 'culture')),
        ];
        const seen = new Set();
        for (let n = 0; n < 30; n++) {
            const picked = pickBalanced(rows);
            expect(picked).toHaveLength(9);
            expect(picked.slice(0, 3).every((r) => groupOf(r.category) === 'restaurant')).toBe(true);
            expect(picked.slice(3, 6).every((r) => groupOf(r.category) === 'cafe')).toBe(true);
            expect(picked.slice(6).every((r) => groupOf(r.category) === 'sight')).toBe(true);
            seen.add(names(picked).join());
        }
        expect(seen.size).toBeGreaterThan(5);
    });

    it('한 묶음이 모자라면 남은 곳으로 채운다(최대 9곳)', () => {
        const rows = [row('r1', 'restaurant'), row('r2', 'restaurant'), row('r3', 'restaurant'), row('r4', 'restaurant'), row('r5', 'restaurant'), row('c1', 'cafe'), row('s1', 'spot')];
        expect(names(pickBalanced(rows, noShuffle))).toEqual(['r1', 'r2', 'r3', 'c1', 's1', 'r4', 'r5']);
        const many = Array.from({ length: 20 }, (_, i) => row(`r${i}`, 'restaurant'));
        expect(pickBalanced(many)).toHaveLength(9);
    });

    it('비어 있으면 빈 목록', () => {
        expect(pickBalanced([])).toEqual([]);
        expect(missingCounts([])).toEqual({ restaurant: 3, cafe: 3, sight: 3 });
    });
});
