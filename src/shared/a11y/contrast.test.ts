import { describe, expect, it } from 'vitest';
import { getContrastRatio, meetsContrastRequirement } from './contrast';

// 01-design-system.md §2.1에 문서화된 실측값과 대조 — 토큰 주석이 실제
// 계산값과 어긋나면(색을 바꾸고 주석을 안 고치는 흔한 실수) 이 테스트가 잡는다.
describe('getContrastRatio', () => {
  it('text-primary(#111827) vs surface-page(#FBFBF9) ≈ 17.12:1 (AAA)', () => {
    expect(getContrastRatio('#111827', '#FBFBF9')).toBeCloseTo(17.12, 1);
  });

  it('text-muted(#64748B) vs surface-page(#FBFBF9) ≈ 4.59:1 (AA)', () => {
    expect(getContrastRatio('#64748B', '#FBFBF9')).toBeCloseTo(4.59, 1);
  });

  it('brand(#2B4EE6) vs surface-page(#FBFBF9) ≈ 6.08:1 (AA)', () => {
    expect(getContrastRatio('#2B4EE6', '#FBFBF9')).toBeCloseTo(6.08, 1);
  });

  it('brand(#2B4EE6) vs 흰 글자(#FFFFFF) ≈ 6.30:1 (AA)', () => {
    expect(getContrastRatio('#2B4EE6', '#FFFFFF')).toBeCloseTo(6.3, 1);
  });

  it('동일 색상의 대비비는 1:1이다', () => {
    expect(getContrastRatio('#111827', '#111827')).toBeCloseTo(1, 5);
  });
});

// 다크 모드(01-design-system.md §2.2)도 라이트 모드와 동일하게 대비 검증을 통과해야 한다
// ("다크 모드는 부가 기능이 아니다", §1 원칙 4).
describe('getContrastRatio (다크 모드)', () => {
  it('text-primary(#E8EAF0) vs surface-page(#0E1116) ≈ 15.72:1 (AAA)', () => {
    expect(getContrastRatio('#E8EAF0', '#0E1116')).toBeCloseTo(15.72, 1);
  });

  it('text-body(#B3BAC7) vs surface-page(#0E1116) ≈ 9.69:1 (AAA)', () => {
    expect(getContrastRatio('#B3BAC7', '#0E1116')).toBeCloseTo(9.69, 1);
  });

  it('brand(#8AA4FF) vs surface-page(#0E1116) ≈ 7.96:1 (AAA)', () => {
    expect(getContrastRatio('#8AA4FF', '#0E1116')).toBeCloseTo(7.96, 1);
  });
});

describe('meetsContrastRequirement', () => {
  it('본문 텍스트는 4.5:1 이상이어야 통과한다', () => {
    expect(meetsContrastRequirement('#FBFBF9', '#111827')).toBe(true);
    expect(meetsContrastRequirement('#FBFBF9', '#94A3B8')).toBe(false); // placeholder, 본문 금지 색
  });

  it('큰 텍스트는 3:1 기준으로 완화된다 (3~4.5 사이 대비비에서 largeText만 통과)', () => {
    const bg = '#FFFFFF';
    const fg = '#949494';
    const ratio = getContrastRatio(bg, fg);
    expect(ratio).toBeGreaterThan(3);
    expect(ratio).toBeLessThan(4.5);
    expect(meetsContrastRequirement(bg, fg, false)).toBe(false);
    expect(meetsContrastRequirement(bg, fg, true)).toBe(true);
  });
});
