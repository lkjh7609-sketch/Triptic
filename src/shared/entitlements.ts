/**
 * 기능 게이팅 단일 지점 (DEVELOPMENT_PLAN.md §13.3 ①)
 * 3.0에서는 전부 true를 반환한다 — 과금이 없으므로 모든 기능이 무료로 열려 있다.
 *
 * 규칙: 아래 기능들을 호출하는 모든 지점은 3.0에서도 can()을 거친다.
 * 항상 true를 반환하더라도 호출부를 지금 심어 둔다. 나중에 함수 본문만 바꾸면 끝난다.
 */
export type Feature =
  | 'trip.create' // 여행 생성
  | 'document.parse' // 서류 자동 인식
  | 'voucher.storage' // 바우처 보관 용량
  | 'offline.maps' // 오프라인 지도
  | 'trip.collaborate' // 동행자 공유
  | 'community.post'; // 커뮤니티 글쓰기(06-community.md)

export interface Ctx {
  userId: string | null;
}

export function can(_feature: Feature, _ctx: Ctx): boolean {
  // 3.0: 과금 없음 — 모든 기능 허용
  // 4.0: 여기서만 구독/여행별 결제 상태를 확인하면 된다
  return true;
}
