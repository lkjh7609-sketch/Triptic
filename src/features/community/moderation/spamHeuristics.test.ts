import { describe, expect, it } from 'vitest';
import { spamScore } from './spamHeuristics';

describe('spamScore', () => {
  it('평범한 텍스트는 낮은 점수를 반환한다', () => {
    expect(spamScore('도쿄 타워 야경 정말 예뻤어요')).toBe(0);
  });

  it('외부 링크가 많으면 점수가 올라간다', () => {
    const text = 'http://a.com http://b.com http://c.com 방문하세요';
    expect(spamScore(text)).toBeGreaterThanOrEqual(0.5);
  });

  it('전화번호가 노출되면 점수가 올라간다', () => {
    expect(spamScore('연락주세요 010-1234-5678')).toBeGreaterThanOrEqual(0.25);
  });

  it('이메일이 노출되면 점수가 올라간다', () => {
    expect(spamScore('문의: test@example.com')).toBeGreaterThanOrEqual(0.15);
  });

  it('동일 문구 반복은 점수가 올라간다', () => {
    expect(spamScore('싸게드려요싸게드려요싸게드려요싸게드려요')).toBeGreaterThanOrEqual(0.4);
  });
});
