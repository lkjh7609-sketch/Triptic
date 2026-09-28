import { describe, expect, it } from 'vitest';
import { aiLocale, cityDescCacheKey, nearbyCacheKeys, normalizeAiKey, sanitizeAiInput } from './aiCacheKeys';

// 서버 구현을 그대로 불러와 비교한다 — 키가 어긋나면 캐시를 못 찾고 매번 LLM을 부른다.
// api/는 tsconfig rootDir(src) 밖이라 정적 import 대신 런타임 경로로 불러온다.
const serverHttpPath: string = '../../../api/_lib/http.js';
const { normalizeKey, parseLocale, sanitizeInput } = (await import(/* @vite-ignore */ serverHttpPath)) as {
  normalizeKey: (value: string) => string;
  parseLocale: (value: string) => string;
  sanitizeInput: (value: string, maxLen: number) => string;
};

const serverKey = (value: string, maxLen: number) => normalizeKey(sanitizeInput(value, maxLen));

describe('AI 캐시 키는 서버(api/_lib/http.js)와 똑같다', () => {
  const inputs = [
    'Tokyo, Japan',
    '  Tokyo,   Japan  ',
    'ＴＯＫＹＯ　ｔｏｗｅｒ', // 전각(NFKC)
    '신주쿠 교엔 국립정원',
    'Sky Garden - Abeno Harukas 58th Floor',
    'line\nbreak\tand\u0007control',
    'x'.repeat(130),
  ];

  it.each(inputs)('%s', (value) => {
    expect(sanitizeAiInput(value, 100)).toBe(sanitizeInput(value, 100));
    expect(normalizeAiKey(value)).toBe(normalizeKey(value));
    expect(cityDescCacheKey(value)).toBe(serverKey(value, 60));
    expect(nearbyCacheKeys(value, value)).toEqual({ cityKey: serverKey(value, 60), placeKey: serverKey(value, 100) });
  });

  it.each(['ko', 'en', 'en-US', 'ja', 'ja-JP', 'zh-TW', 'zh-Hant', 'zh', 'fr', ''])('locale %s', (value) => {
    expect(aiLocale(value)).toBe(parseLocale(value));
  });

  it('실제 저장된 행의 키를 재현한다', () => {
    expect(cityDescCacheKey('Tokyo, Japan')).toBe('tokyo, japan');
    expect(nearbyCacheKeys('신주쿠 교엔 국립정원', 'Tokyo')).toEqual({ cityKey: 'tokyo', placeKey: '신주쿠 교엔 국립정원' });
  });
});
