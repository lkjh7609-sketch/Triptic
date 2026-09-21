/**
 * 한국어 우회 표현 정규화 (06-community.md §5.1)
 * "ㅅㅂ", "씨1발", "시 발" 같은 자소분리·특수문자삽입·공백삽입 우회를 무력화한다.
 * NFC 정규화 → 특수문자/숫자/공백 제거 → 소문자화 순서.
 * 원본은 그대로 두고 이 정규화된 문자열에서만 금칙어를 매칭한다.
 */
export function normalizeForModeration(text: string): string {
  return text
    .normalize('NFC')
    .toLowerCase()
    .replace(/[\s\-_.,!@#$%^&*()+=[\]{}|\\:;"'<>/?~`0-9]/g, '');
}
