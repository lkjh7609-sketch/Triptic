/* i18n-exempt-file: 마이리얼트립 검색·카테고리 조회에 보내는 한국어 도시 이름 데이터(화면에는 번역 키 activities.city.*를 쓴다) */
import { homePhotoSlug, homePhotoThumbUrl } from '../homePhotos';

/** 액티비티 탭 "인기 여행지" 원형 8곳. 마이리얼트립은 한국어 도시 이름으로 찾아야 해서 ko를 함께 둔다 */
export interface ActivityCity {
  /** 번역 키 접미사 — home:activities.city.{key} */
  key: 'Kyoto' | 'Paris' | 'NY' | 'London' | 'Rome' | 'Tokyo' | 'Bangkok' | 'Danang';
  /** 마이리얼트립 검색·카테고리에 쓰는 한국어 이름(UI 언어와 무관) */
  ko: string;
  /** Klook 도시 검색용 영어 이름("도시, 나라" — 홈 FEATURED와 같은 모양) */
  en: string;
  image: string;
}

/** 원형 칸용 작은 사진(우리 저장소 home/thumbs) */
const thumb = (en: string): string => {
  const slug = homePhotoSlug(en);
  return slug ? homePhotoThumbUrl(slug) : '';
};

export const ACTIVITY_CITIES: readonly ActivityCity[] = [
  { key: 'Kyoto', ko: '교토', en: 'Kyoto, Japan', image: thumb('Kyoto, Japan') },
  { key: 'Paris', ko: '파리', en: 'Paris, France', image: thumb('Paris, France') },
  { key: 'NY', ko: '뉴욕', en: 'New York, USA', image: thumb('New York, USA') },
  { key: 'London', ko: '런던', en: 'London, UK', image: thumb('London, UK') },
  { key: 'Rome', ko: '로마', en: 'Rome, Italy', image: thumb('Rome, Italy') },
  { key: 'Tokyo', ko: '도쿄', en: 'Tokyo, Japan', image: thumb('Tokyo, Japan') },
  { key: 'Bangkok', ko: '방콕', en: 'Bangkok, Thailand', image: thumb('Bangkok, Thailand') },
  { key: 'Danang', ko: '다낭', en: 'Da Nang, Vietnam', image: thumb('Da Nang, Vietnam') },
];
