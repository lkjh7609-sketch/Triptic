/**
 * @jest-environment jsdom
 */

import {
    formatDate,
    calculateDaysBetween,
    getWeekday
} from '../utils/dateUtils.js';

describe('formatDate', () => {
    test('날짜를 YYYY-MM-DD 형식으로 포맷해야 함', () => {
        const date = new Date('2026-09-18');
        expect(formatDate(date)).toBe('2026-09-18');
    });

    test('문자열 날짜도 처리해야 함', () => {
        expect(formatDate('2026-12-25')).toBe('2026-12-25');
    });

    test('한 자리 월/일을 0으로 패딩해야 함', () => {
        const date = new Date('2026-01-05');
        expect(formatDate(date)).toBe('2026-01-05');
    });
});

describe('calculateDaysBetween', () => {
    test('같은 날짜는 1일을 반환해야 함', () => {
        expect(calculateDaysBetween('2026-09-18', '2026-09-18')).toBe(1);
    });

    test('연속된 날짜의 일수를 계산해야 함', () => {
        expect(calculateDaysBetween('2026-09-16', '2026-09-23')).toBe(8);
    });

    test('역순으로 입력해도 양수를 반환해야 함', () => {
        expect(calculateDaysBetween('2026-09-23', '2026-09-16')).toBe(8);
    });
});

describe('getWeekday', () => {
    test('올바른 요일을 반환해야 함', () => {
        // 2026-09-18은 금요일
        const date = new Date('2026-09-18');
        expect(getWeekday(date)).toBe('금');
    });

    test('일요일을 올바르게 처리해야 함', () => {
        const sunday = new Date('2026-09-20'); // 일요일
        expect(getWeekday(sunday)).toBe('일');
    });
});
