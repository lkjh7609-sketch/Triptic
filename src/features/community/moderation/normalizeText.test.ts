import { describe, expect, it } from 'vitest';
import { normalizeForModeration } from './normalizeText';

describe('normalizeForModeration', () => {
  it('공백/특수문자/숫자를 제거한다', () => {
    expect(normalizeForModeration('씨 1 발')).toBe('씨발');
    expect(normalizeForModeration('시-발!')).toBe('시발');
  });

  it('대문자를 소문자로 바꾼다', () => {
    expect(normalizeForModeration('FUCK')).toBe('fuck');
  });

  it('NFC/NFD 조합이 달라도 같은 결과로 정규화한다', () => {
    const nfc = 'é'.normalize('NFC'); // é (조합형)
    const nfd = 'é'; // e + combining acute (분해형)
    expect(normalizeForModeration(nfc)).toBe(normalizeForModeration(nfd));
  });
});
