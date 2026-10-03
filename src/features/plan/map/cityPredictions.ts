/** 여행 만들기 도시 자동완성 — 구글 예측 결과를 한 줄 문구로 만드는 규칙(순수 함수) */

export interface CityPredictionLike {
  place_id: string;
  description: string;
  structured_formatting?: { main_text?: string; secondary_text?: string };
}

/**
 * 한 줄 문구 — 구글이 나눠 준 도시 이름(main_text)과 그 아래 설명(secondary_text: 나라, 또는 "주, 나라")을 "도시(나라)"로 합친다.
 * 설명이 비어 있으면(싱가포르처럼 도시=나라) 도시 이름만.
 */
export function cityPredictionLabel(p: CityPredictionLike): string {
  const main = p.structured_formatting?.main_text?.trim() || p.description.trim();
  const secondary = p.structured_formatting?.secondary_text?.trim();
  return secondary && secondary !== main ? `${main}(${secondary})` : main;
}

/** 입력칸에 남길 글자 — 고른 도시 이름만 */
export function cityPredictionName(p: CityPredictionLike): string {
  return p.structured_formatting?.main_text?.trim() || p.description.trim();
}
