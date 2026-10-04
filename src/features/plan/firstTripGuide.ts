/**
 * 가입하고 처음 '새 여행 만들기'를 누를 때 "처음이시네요! 가이드를 보시겠어요?"를 한 번만 묻는다(2026-10-05 사용자 요청).
 * 이미 여행이 있는 회원에게는 묻지 않고, 한 번 답하면(보기·바로 만들기 어느 쪽이든) 다시 묻지 않는다. 답은 이 기기에 기록한다.
 */
const KEY_PREFIX = 'triptic-first-trip-guide:';

export function hasAnsweredFirstTripGuide(userId: string): boolean {
  try {
    return localStorage.getItem(KEY_PREFIX + userId) === '1';
  } catch {
    return false;
  }
}

export function markFirstTripGuideAnswered(userId: string): void {
  try {
    localStorage.setItem(KEY_PREFIX + userId, '1');
  } catch {
    // 저장이 막힌 환경 — 이번 접속에서만 한 번 묻는다(컴포넌트 상태가 막아 준다)
  }
}

/** 지금 물어야 하는가 — 로그인한 회원, 만든 여행이 없고, 아직 답하지 않았을 때 */
export function shouldAskFirstTripGuide(userId: string | null | undefined, tripCount: number, answeredInSession: boolean): boolean {
  if (!userId || tripCount > 0 || answeredInSession) return false;
  return !hasAnsweredFirstTripGuide(userId);
}
