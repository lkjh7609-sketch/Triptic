/**
 * 표시 이름(닉네임) 규칙 — 언어와 무관하게 문자·숫자 2~16자. 서버의 guard_protected_columns 트리거(0060)와
 * 같은 규칙이고, 실제 경계는 서버다. 여기는 저장 버튼을 누르기 전에 미리 알려 주는 용도.
 *  · 문자·숫자로 시작하고 끝난다. 가운데는 문자·숫자·공백·점·밑줄·하이픈
 *  · 공백은 연달아 둘 이상 안 됨
 * 예약어·중복은 서버만 안다(사용 가능 확인 버튼이 서버에 묻는다).
 */
export const DISPLAY_NAME_MIN = 2;
export const DISPLAY_NAME_MAX = 16;

const NAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} ._-]*[\p{L}\p{N}]$/u;

export function isValidDisplayName(name: string): boolean {
  const length = [...name].length; // 글자 수(이모지 등도 1자로)
  if (length < DISPLAY_NAME_MIN || length > DISPLAY_NAME_MAX) return false;
  if (name.includes('  ')) return false;
  return NAME_PATTERN.test(name);
}
