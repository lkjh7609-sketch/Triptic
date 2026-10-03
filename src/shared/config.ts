/** 고객 문의 메일 — privacy.html/terms.html에 적힌 연락처와 같아야 한다 */
export const CONTACT_EMAIL = 'admin@triptic.my';

/** 제휴(어필리에이트) 링크. 바꿀 때는 여기만 */
export const AFFILIATE_LINKS = {
  /** Klook 링크를 못 받았을 때 대신 여는 주소 — 제휴 연결 전이라 Klook 첫 화면(예전 트래블페이아웃 딜 링크는 2026-10-04에 뺐다) */
  klookActivities: 'https://www.klook.com/',
  /** 출발 전 체크리스트 eSIM — 제휴 변환(api/partnerLink.js LANDING.yesim)이 안 되면 이 주소로 */
  esimFallback: 'https://yesim.app/',
  /** 유심사 제휴 링크(항공 탭 유심·eSIM) */
  usimsa: 'https://www.usimsa.com/affiliate/3657',
  /** 출발 전 체크리스트 여행자보험 — Travelpayouts에서 보험 브랜드를 연결하면 제휴 링크를 넣는다 */
  insurance: null as string | null,
} as const;
