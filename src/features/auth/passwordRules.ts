export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 15;

export interface PasswordChecks {
  length: boolean;
  upper: boolean;
  digit: boolean;
}

/** 가입 비밀번호 규칙: 8~15자, 대문자 1개 이상, 숫자 1개 이상 */
export function checkPassword(password: string): PasswordChecks {
  return {
    length: password.length >= PASSWORD_MIN_LENGTH && password.length <= PASSWORD_MAX_LENGTH,
    upper: /[A-Z]/.test(password),
    digit: /\d/.test(password),
  };
}

export function isPasswordValid(password: string): boolean {
  const c = checkPassword(password);
  return c.length && c.upper && c.digit;
}
