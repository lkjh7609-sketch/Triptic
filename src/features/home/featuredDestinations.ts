/** 홈 추천 여행지 카드 + 액티비티 탭 인기 도시 */
export interface FeaturedDestination {
  /** 번역 키 접미사 (home:desktop.dest{key}/desc{key}) */
  key: 'Kyoto' | 'Paris' | 'NY' | 'London' | 'Rome' | 'Tokyo';
  /** 여행 만들기·AI 소개에 넘기는 도시명(Google Places 검색이 잘 되는 영어 이름) */
  city: string;
}

export const FEATURED: FeaturedDestination[] = [
  { key: 'Kyoto', city: 'Kyoto, Japan' },
  { key: 'Paris', city: 'Paris, France' },
  { key: 'NY', city: 'New York, USA' },
  { key: 'London', city: 'London, UK' },
  { key: 'Rome', city: 'Rome, Italy' },
  { key: 'Tokyo', city: 'Tokyo, Japan' },
];

