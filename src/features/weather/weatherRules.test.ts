import { describe, it, expect } from 'vitest';
import { shouldUseClimateNormal, formatTemp, celsiusToFahrenheit } from './weatherRules';

describe('shouldUseClimateNormal', () => {
  it('10일 이내는 예보(false)를 쓴다', () => {
    expect(shouldUseClimateNormal('2026-05-30', '2026-05-20')).toBe(false); // +10일
    expect(shouldUseClimateNormal('2026-05-20', '2026-05-20')).toBe(false); // 오늘
  });

  it('11일 뒤 날짜는 평년값 소스로 표시한다', () => {
    expect(shouldUseClimateNormal('2026-05-31', '2026-05-20')).toBe(true); // +11일
  });

  it('과거 날짜는 평년값 규칙 대상이 아니다', () => {
    expect(shouldUseClimateNormal('2026-05-01', '2026-05-20')).toBe(false);
  });
});

describe('formatTemp', () => {
  it('데이터가 없으면 0°가 아니라 null(빈 영역)을 반환한다', () => {
    expect(formatTemp(null)).toBeNull();
    expect(formatTemp(undefined)).toBeNull();
  });

  it('°C는 그대로 반올림한다', () => {
    expect(formatTemp(23.4, 'C')).toBe('23°');
  });

  it('°F 설정이면 화씨로 변환한다', () => {
    expect(formatTemp(0, 'F')).toBe('32°');
    expect(formatTemp(100, 'F')).toBe('212°');
  });
});

describe('celsiusToFahrenheit', () => {
  it('섭씨를 화씨로 변환한다', () => {
    expect(celsiusToFahrenheit(0)).toBe(32);
    expect(celsiusToFahrenheit(100)).toBe(212);
  });
});
