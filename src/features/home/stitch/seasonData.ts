import kyotoPc from '@/assets/home/season-kyoto.webp';
import parisPc from '@/assets/home/season-paris.webp';
import newyorkPc from '@/assets/home/season-newyork.webp';
import londonPc from '@/assets/home/season-london.webp';
import romePc from '@/assets/home/season-rome.webp';
import tokyoPc from '@/assets/home/season-tokyo.webp';
import kyotoM from '@/assets/home/m-season-kyoto.webp';
import parisM from '@/assets/home/m-season-paris.webp';
import bangkokM from '@/assets/home/m-season-bangkok.webp';
import newyorkM from '@/assets/home/m-season-newyork.webp';
import londonM from '@/assets/home/m-season-london.webp';

/**
 * "지금 가기 좋은 여행지" 월별 큐레이션 — 12개월 × 6도시.
 * 일반적인 계절 상식(벚꽃·단풍·건기·우기 등)으로 정한 추천이라 해마다 정확한 시기는 조금씩 다르다.
 * 표시 문구(배지·한 줄 설명·도시 이름)는 번역 키 page.season.* 에 있다.
 */
export type SeasonCityId =
  | 'kyoto'
  | 'tokyo'
  | 'sapporo'
  | 'taipei'
  | 'bangkok'
  | 'danang'
  | 'bali'
  | 'sydney'
  | 'paris'
  | 'london'
  | 'rome'
  | 'barcelona'
  | 'newyork'
  | 'interlaken';

export interface SeasonCity {
  /** 여행 만들기·AI 소개에 넘기는 도시명(Google Places 검색이 잘 되는 영어 이름) */
  en: string;
  lat: number;
  lng: number;
  /** ISO 지역 코드(나라 이름은 Intl.DisplayNames로) */
  country: string;
  /** 시안에 있는 사진 — PC/모바일 사진이 따로 있는 도시만. 없으면 기존 도시 사진(useCityImage) */
  photo?: { pc?: string; mobile?: string };
}

export const SEASON_CITIES: Record<SeasonCityId, SeasonCity> = {
  kyoto: { en: 'Kyoto, Japan', lat: 35.0116, lng: 135.7681, country: 'JP', photo: { pc: kyotoPc, mobile: kyotoM } },
  tokyo: { en: 'Tokyo, Japan', lat: 35.6762, lng: 139.6503, country: 'JP', photo: { pc: tokyoPc } },
  sapporo: { en: 'Sapporo, Japan', lat: 43.0618, lng: 141.3545, country: 'JP' },
  taipei: { en: 'Taipei, Taiwan', lat: 25.033, lng: 121.5654, country: 'TW' },
  bangkok: { en: 'Bangkok, Thailand', lat: 13.7563, lng: 100.5018, country: 'TH', photo: { mobile: bangkokM } },
  danang: { en: 'Da Nang, Vietnam', lat: 16.0544, lng: 108.2022, country: 'VN' },
  bali: { en: 'Bali, Indonesia', lat: -8.4095, lng: 115.1889, country: 'ID' },
  sydney: { en: 'Sydney, Australia', lat: -33.8688, lng: 151.2093, country: 'AU' },
  paris: { en: 'Paris, France', lat: 48.8566, lng: 2.3522, country: 'FR', photo: { pc: parisPc, mobile: parisM } },
  london: { en: 'London, UK', lat: 51.5074, lng: -0.1278, country: 'GB', photo: { pc: londonPc, mobile: londonM } },
  rome: { en: 'Rome, Italy', lat: 41.9028, lng: 12.4964, country: 'IT', photo: { pc: romePc } },
  barcelona: { en: 'Barcelona, Spain', lat: 41.3874, lng: 2.1686, country: 'ES' },
  newyork: { en: 'New York, USA', lat: 40.7128, lng: -74.006, country: 'US', photo: { pc: newyorkPc, mobile: newyorkM } },
  interlaken: { en: 'Interlaken, Switzerland', lat: 46.6863, lng: 7.8632, country: 'CH' },
};

/** 도시마다 "이 달엔 이게 좋다"는 시기 항목 — id는 번역 키 page.season.{도시}.{id}.badge/desc */
export const SEASON_ENTRIES: Record<SeasonCityId, { id: string; months: number[] }[]> = {
  kyoto: [
    { id: 'spring', months: [3, 4] },
    { id: 'autumn', months: [10, 11] },
    { id: 'winter', months: [12, 1, 2] },
  ],
  tokyo: [
    { id: 'sakura', months: [3, 4] },
    { id: 'walk', months: [9, 10, 11] },
    { id: 'lights', months: [12, 1, 2] },
  ],
  sapporo: [
    { id: 'snow', months: [12, 1, 2, 3] },
    { id: 'summer', months: [6, 7, 8] },
    { id: 'autumn', months: [9, 10] },
  ],
  taipei: [
    { id: 'night', months: [10, 11, 12] },
    { id: 'lantern', months: [1, 2, 3] },
  ],
  bangkok: [{ id: 'dry', months: [11, 12, 1, 2] }],
  danang: [{ id: 'beach', months: [2, 3, 4, 5] }],
  bali: [{ id: 'dry', months: [5, 6, 7, 8, 9, 10] }],
  sydney: [
    { id: 'summer', months: [12, 1, 2] },
    { id: 'jacaranda', months: [9, 10, 11] },
  ],
  paris: [
    { id: 'picnic', months: [4, 5, 6, 7, 8, 9] },
    { id: 'market', months: [11, 12] },
  ],
  london: [
    { id: 'sunny', months: [5, 6, 7, 8] },
    { id: 'autumn', months: [9, 10] },
    { id: 'xmas', months: [11, 12] },
  ],
  rome: [
    { id: 'food', months: [4, 5, 6] },
    { id: 'autumn', months: [9, 10] },
  ],
  barcelona: [{ id: 'beach', months: [5, 6, 7, 8, 9, 10] }],
  newyork: [
    { id: 'park', months: [4, 5] },
    { id: 'fall', months: [9, 10] },
    { id: 'holiday', months: [11, 12] },
  ],
  interlaken: [
    { id: 'hike', months: [6, 7, 8, 9] },
    { id: 'snow', months: [12, 1, 2, 3] },
  ],
};

/** 달(1~12)마다 보여줄 6도시 — 순서대로 카드가 놓인다 */
export const MONTH_PICKS: Record<number, SeasonCityId[]> = {
  1: ['sapporo', 'bangkok', 'sydney', 'taipei', 'interlaken', 'tokyo'],
  2: ['sapporo', 'danang', 'bangkok', 'sydney', 'taipei', 'kyoto'],
  3: ['kyoto', 'tokyo', 'danang', 'taipei', 'interlaken', 'sapporo'],
  4: ['kyoto', 'tokyo', 'paris', 'rome', 'newyork', 'danang'],
  5: ['paris', 'london', 'rome', 'barcelona', 'bali', 'danang'],
  6: ['paris', 'london', 'rome', 'bali', 'interlaken', 'barcelona'],
  7: ['sapporo', 'interlaken', 'bali', 'london', 'barcelona', 'paris'],
  8: ['sapporo', 'interlaken', 'bali', 'london', 'barcelona', 'paris'],
  9: ['paris', 'rome', 'barcelona', 'interlaken', 'sapporo', 'tokyo'],
  10: ['kyoto', 'tokyo', 'newyork', 'rome', 'sapporo', 'sydney'],
  11: ['kyoto', 'tokyo', 'newyork', 'bangkok', 'taipei', 'paris'],
  12: ['paris', 'london', 'newyork', 'bangkok', 'sydney', 'sapporo'],
};

export interface SeasonPick {
  id: SeasonCityId;
  city: SeasonCity;
  /** 번역 키 page.season.{id}.{entry}.* 의 entry */
  entry: string;
}

/** 그 달의 추천 6도시(각 도시의 그 달 항목과 함께) */
export function seasonPicksFor(month: number): SeasonPick[] {
  return (MONTH_PICKS[month] ?? []).flatMap((id) => {
    const entry = SEASON_ENTRIES[id].find((e) => e.months.includes(month));
    return entry ? [{ id, city: SEASON_CITIES[id], entry: entry.id }] : [];
  });
}
