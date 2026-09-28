/**
 * AI 캐시(ai_recommendation_cache) 키를 앱에서 서버와 똑같이 만든다.
 * api/_lib/http.js의 sanitizeInput → normalizeKey, parseLocale을 그대로 옮긴 것 —
 * 한 글자라도 다르면 캐시를 영영 못 찾고 매번 /api(LLM)로 빠지므로
 * aiCacheKeys.test.ts가 서버 구현과 직접 비교해 고정한다.
 */
export type AiLocale = 'ko' | 'en' | 'zh-TW' | 'ja';

const SUPPORTED: AiLocale[] = ['ko', 'en', 'zh-TW', 'ja'];

export function sanitizeAiInput(value: string, maxLen: number): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\r\n\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLen);
}

export function normalizeAiKey(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function aiLocale(value: string): AiLocale {
  if (SUPPORTED.includes(value as AiLocale)) return value as AiLocale;
  if (value.toLowerCase().startsWith('zh')) return 'zh-TW';
  const base = value.split('-')[0];
  return SUPPORTED.includes(base as AiLocale) ? (base as AiLocale) : 'ko';
}

/** api/cityDesc.js: sanitizeInput(city, 60) */
export function cityDescCacheKey(city: string): string {
  return normalizeAiKey(sanitizeAiInput(city, 60));
}

/** api/recommend.js: sanitizeInput(placeName, 100), sanitizeInput(city, 60) */
export function nearbyCacheKeys(placeName: string, city: string): { cityKey: string; placeKey: string } {
  return {
    cityKey: normalizeAiKey(sanitizeAiInput(city, 60)),
    placeKey: normalizeAiKey(sanitizeAiInput(placeName, 100)),
  };
}
