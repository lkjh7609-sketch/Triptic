/**
 * @jest-environment jsdom
 */

import {
    generateHourOptions,
    generateMinuteOptions,
    isValidTimeFormat,
    addMinutes
} from '../utils/timeUtils.js';

describe('generateHourOptions', () => {
    test('24시간 옵션을 생성해야 함', () => {
        const html = generateHourOptions('10');
        expect(html).toContain('<option value="00"');
        expect(html).toContain('<option value="23"');
        expect(html).toContain('selected');
    });

    test('선택된 시간에 selected 속성이 있어야 함', () => {
        const html = generateHourOptions('15');
        expect(html).toContain('<option value="15" selected>15시</option>');
    });
});

describe('generateMinuteOptions', () => {
    test('5분 단위로 옵션을 생성해야 함', () => {
        const html = generateMinuteOptions('30');
        expect(html).toContain('<option value="00"');
        expect(html).toContain('<option value="30" selected');
        expect(html).toContain('<option value="55"');
        expect(html).not.toContain('<option value="31"'); // 5분 단위가 아님
    });
});

describe('isValidTimeFormat', () => {
    test('유효한 시간 형식을 인식해야 함', () => {
        expect(isValidTimeFormat('00:00')).toBe(true);
        expect(isValidTimeFormat('12:30')).toBe(true);
        expect(isValidTimeFormat('23:59')).toBe(true);
    });

    test('잘못된 시간 형식을 거부해야 함', () => {
        expect(isValidTimeFormat('24:00')).toBe(false); // 24시는 없음
        expect(isValidTimeFormat('12:60')).toBe(false); // 60분은 없음
        expect(isValidTimeFormat('1:30')).toBe(false);  // 한 자리 시간
        expect(isValidTimeFormat('12:5')).toBe(false);  // 한 자리 분
        expect(isValidTimeFormat('abc')).toBe(false);
    });
});

describe('addMinutes', () => {
    test('분을 올바르게 더해야 함', () => {
        expect(addMinutes('10:00', 30)).toBe('10:30');
        expect(addMinutes('10:30', 45)).toBe('11:15');
    });

    test('시간 넘김을 처리해야 함', () => {
        expect(addMinutes('23:30', 40)).toBe('00:10'); // 다음날로 넘어감
        expect(addMinutes('12:45', 20)).toBe('13:05');
    });

    test('음수 분도 처리해야 함', () => {
        expect(addMinutes('10:30', -30)).toBe('10:00');
        expect(addMinutes('00:15', -30)).toBe('23:45'); // 전날로
    });
});
