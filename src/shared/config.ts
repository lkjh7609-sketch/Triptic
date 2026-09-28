/** 고객 문의 메일 — privacy.html/terms.html에 적힌 연락처와 같아야 한다 */
export const CONTACT_EMAIL = 'javerdose@yahoo.com';

/** 제휴(어필리에이트) 링크 — Travelpayouts에서 발급한 추적 링크. 바꿀 때는 여기만 */
export const AFFILIATE_LINKS = {
  /** 홈 "액티비티" 버튼 → Klook 딜 페이지 */
  klookActivities: 'https://klook.tp.st/B43lPtzP',
  /** 출발 전 체크리스트 eSIM — 제휴 변환(api/partnerLink.js LANDING.yesim)이 안 되면 이 주소로 */
  esimFallback: 'https://yesim.app/',
  /** 출발 전 체크리스트 여행자보험 — Travelpayouts에서 보험 브랜드를 연결하면 제휴 링크를 넣는다 */
  insurance: null as string | null,
} as const;
