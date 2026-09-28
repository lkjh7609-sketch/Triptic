/** 홈 추천 여행지 카드 + 액티비티 탭 인기 도시 */
export interface FeaturedDestination {
  /** 번역 키 접미사 (home:desktop.dest{key}/desc{key}) */
  key: 'Kyoto' | 'Paris' | 'NY' | 'London' | 'Rome' | 'Tokyo';
  /** 여행 만들기·AI 소개에 넘기는 도시명(Google Places 검색이 잘 되는 영어 이름) */
  city: string;
  image: string;
}

export const FEATURED: FeaturedDestination[] = [
  { key: 'Kyoto', city: 'Kyoto, Japan', image: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1000&auto=format&fit=crop' },
  { key: 'Paris', city: 'Paris, France', image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?q=80&w=1000&auto=format&fit=crop' },
  { key: 'NY', city: 'New York, USA', image: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?q=80&w=1000&auto=format&fit=crop' },
  { key: 'London', city: 'London, UK', image: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?q=80&w=1000&auto=format&fit=crop' },
  { key: 'Rome', city: 'Rome, Italy', image: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?q=80&w=1000&auto=format&fit=crop' },
  { key: 'Tokyo', city: 'Tokyo, Japan', image: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?q=80&w=1000&auto=format&fit=crop' },
];

