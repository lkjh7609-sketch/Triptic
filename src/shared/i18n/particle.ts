/**
 * 한글 조사(을/를, 이/가, 은/는, 와/과) 선택 헬퍼 (07-i18n.md §3.1)
 * 문장 조합은 가능하면 조사가 필요 없는 구조로 다시 쓰는 게 우선이다 —
 * 이 함수는 불가피할 때만 쓴다.
 */
export function particle(word: string, withBatchim: string, without: string): string {
  const last = word.trimEnd().at(-1);
  if (!last) return without;
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return without; // 한글 음절이 아님
  return (code - 0xac00) % 28 === 0 ? without : withBatchim;
}
