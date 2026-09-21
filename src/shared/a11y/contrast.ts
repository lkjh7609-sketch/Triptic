/**
 * WCAG 2.1 상대 휘도/대비비 계산 (01-design-system.md §1 "모든 색은 대비 검증을
 * 통과한다", §8 체크리스트 "텍스트 대비 AA 본문 4.5:1, 큰 글씨 3:1").
 * 새 색상 토큰을 추가할 때 이 함수로 계산해 주석으로 남긴다.
 */
function relativeLuminance(hex: string): number {
  const rgb = parseInt(hex.replace('#', ''), 16);
  const r = (rgb >> 16) & 0xff;
  const g = (rgb >> 8) & 0xff;
  const b = rgb & 0xff;

  const [rs, gs, bs] = [r, g, b].map((c) => {
    const channel = c / 255;
    return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

export function getContrastRatio(color1: string, color2: string): number {
  const l1 = relativeLuminance(color1);
  const l2 = relativeLuminance(color2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function meetsContrastRequirement(bgColor: string, textColor: string, largeText = false): boolean {
  const ratio = getContrastRatio(bgColor, textColor);
  const minRatio = largeText ? 3 : 4.5;
  return ratio >= minRatio;
}
