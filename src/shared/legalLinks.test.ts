import { describe, expect, it } from 'vitest';
import { legalPath } from './legalLinks';

describe('legalPath', () => {
  it('앱 언어에 맞는 약관·방침 번역본으로 연결한다', () => {
    expect(legalPath('terms', 'en')).toBe('/terms-en.html');
    expect(legalPath('privacy', 'ja')).toBe('/privacy-ja.html');
    expect(legalPath('terms', 'zh-TW')).toBe('/terms-zh-TW.html');
  });
  it('한국어는 기본 주소에 ?lang=ko를 붙인다(자동 언어 이동 방지)', () => {
    expect(legalPath('privacy', 'ko')).toBe('/privacy.html?lang=ko');
  });
  it('지원하지 않는 언어는 기본(한국어)으로 — normalizeLocale 규칙', () => {
    expect(legalPath('terms', 'fr')).toBe('/terms.html?lang=ko');
    expect(legalPath('terms', 'en-AU')).toBe('/terms-en.html');
  });
});
