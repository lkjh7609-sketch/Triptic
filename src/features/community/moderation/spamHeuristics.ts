/**
 * 스팸 휴리스틱 (06-community.md §5.1: "동일 문구 반복, 외부 링크 과다, 연락처 노출")
 */
export function spamScore(text: string): number {
  let score = 0;

  const urlCount = (text.match(/https?:\/\/|www\./gi) ?? []).length;
  if (urlCount >= 3) score = Math.max(score, 0.5);
  else if (urlCount >= 1) score = Math.max(score, 0.2);

  if (/01[016-9]-?\d{3,4}-?\d{4}/.test(text)) score = Math.max(score, 0.25);
  if (/[\w.+-]+@[\w-]+\.[a-z]{2,}/i.test(text)) score = Math.max(score, 0.15);

  // 4자 이상 문구가 3회 이상 연속 반복
  if (/(.{4,}?)\1{2,}/.test(text)) score = Math.max(score, 0.4);

  return Math.min(score, 1);
}
