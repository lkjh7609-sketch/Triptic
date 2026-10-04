/** 공항 탭의 칸 — 인천이 처음(사용자 결정: 인천·김포·대구·김해·제주) */
export const AIRPORT_KEYS = ['icn', 'gmp', 'tae', 'pus', 'cju'] as const;
export type AirportKey = (typeof AIRPORT_KEYS)[number];

/** 탭 → 공항 IATA 코드(한국공항공사 전광판 응답이 이 코드로 공항을 나눈다) */
export const AIRPORT_IATA: Record<AirportKey, string> = { icn: 'ICN', gmp: 'GMP', tae: 'TAE', pus: 'PUS', cju: 'CJU' };
