/** 서류 업로드 동의(§2 "동의 화면, 최초 1회, 이후 설정에서 재확인 가능") */
const KEY = 'tripticDocumentUploadConsent';

export function hasDocumentUploadConsent(): boolean {
  try {
    return localStorage.getItem(KEY) === 'true';
  } catch {
    return false;
  }
}

export function setDocumentUploadConsent(agreed: boolean): void {
  try {
    localStorage.setItem(KEY, agreed ? 'true' : 'false');
  } catch {
    /* localStorage 접근 불가(사파일 프라이빗 모드 등) — 다음에 다시 물어보는 것으로 충분하다 */
  }
}
