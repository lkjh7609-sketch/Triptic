import { describe, it, expect } from 'vitest';
import { ownPaths, secretMatches } from './paths.ts';

describe('ownPaths', () => {
  it('작성자 폴더 안의 경로만 남긴다', () => {
    expect(ownPaths('u1', ['u1/a.webp', 'u2/b.webp', 'u1x/c.webp', 'u1/../u2/d.webp'])).toEqual(['u1/a.webp']);
  });
});

describe('secretMatches', () => {
  it('같을 때만 통과', () => {
    expect(secretMatches('abc', 'abc')).toBe(true);
    expect(secretMatches('abd', 'abc')).toBe(false);
    expect(secretMatches('ab', 'abc')).toBe(false);
    expect(secretMatches(null, 'abc')).toBe(false);
  });
  it('서버 비밀값이 없으면 항상 거부', () => {
    expect(secretMatches('', undefined)).toBe(false);
    expect(secretMatches('', '')).toBe(false);
  });
});
