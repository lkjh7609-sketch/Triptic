/**
 * 표시 이름(닉네임) 규칙 — 쓰는 글자(언어)별 글자 수. 서버의 is_valid_display_name(0062)과 같은 구분·같은 범위이고,
 * 실제 경계는 서버다. 여기는 저장 버튼을 누르기 전에 미리 알려 주는 용도.
 *
 *   한글이 하나라도 있으면 한글 이름 4~8자 → 아니면 가나(히라가나·가타카나)가 있으면 일본어 4~12자
 *   → 아니면 한자가 있으면 중국어 2~6자 → 그 밖(영문·숫자 등) 영어 4~12자
 *
 * 글자 수는 이름 전체(숫자·공백·구분 기호 포함). 문자 구성(0060):
 *  · 문자·숫자로 시작하고 끝난다. 가운데는 문자·숫자·공백·점·밑줄·하이픈
 *  · 공백은 연달아 둘 이상 안 됨
 * 예약어·중복은 서버만 안다(사용 가능 확인 버튼이 서버에 묻는다).
 */
export type NameScript = 'hangul' | 'kana' | 'han' | 'other';

export const DISPLAY_NAME_LIMITS: Record<NameScript, { min: number; max: number }> = {
  hangul: { min: 4, max: 8 },
  kana: { min: 4, max: 12 },
  han: { min: 2, max: 6 },
  other: { min: 4, max: 12 },
};

/** 입력 칸에 넣는 최대 글자 수 — 가장 긴 범위(영어·일본어). 언어별 상한은 검사에서 */
export const DISPLAY_NAME_INPUT_MAX = 12;

const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힣]/; // i18n-exempt: 문자열이 아니라 한글 유니코드 범위를 검사하는 정규식
const KANA = /[぀-ヿㇰ-ㇿｦ-ﾟ]/;
const HAN = /[㐀-䶿一-鿿豈-﫿]/;
const NAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} ._-]*[\p{L}\p{N}]$/u;

export function nameScript(name: string): NameScript {
  if (HANGUL.test(name)) return 'hangul';
  if (KANA.test(name)) return 'kana';
  if (HAN.test(name)) return 'han';
  return 'other';
}

export function isValidDisplayName(name: string): boolean {
  const length = [...name].length; // 글자 수(이모지 등도 1자로)
  const { min, max } = DISPLAY_NAME_LIMITS[nameScript(name)];
  if (length < min || length > max) return false;
  if (name.includes('  ')) return false;
  return NAME_PATTERN.test(name);
}
