import kixPc from '@/assets/home/deal-osaka.webp';
import fukPc from '@/assets/home/deal-fukuoka.webp';
import tpePc from '@/assets/home/deal-taipei.webp';
import dadPc from '@/assets/home/deal-danang.webp';
import kixM from '@/assets/home/m-deal-osaka.webp';
import fukM from '@/assets/home/m-deal-fukuoka.webp';
import tpeM from '@/assets/home/m-deal-taipei.webp';
import dadM from '@/assets/home/m-deal-danang.webp';

/** 특가 도착 공항 코드 → 영어 도시명(사진 검색용)·나라(ISO 지역 코드). 표시 이름은 번역 키 page.dealCity.{코드}.
 * 목록은 api/_lib/affiliates/myrealtrip.js의 DEAL_DESTINATIONS와 같다 */
export const DEAL_CITY_INFO: Record<string, { en: string; country: string }> = {
  KIX: { en: 'Osaka, Japan', country: 'JP' },
  NRT: { en: 'Tokyo, Japan', country: 'JP' },
  FUK: { en: 'Fukuoka, Japan', country: 'JP' },
  NGO: { en: 'Nagoya, Japan', country: 'JP' },
  CTS: { en: 'Sapporo, Japan', country: 'JP' },
  OKA: { en: 'Okinawa, Japan', country: 'JP' },
  BKK: { en: 'Bangkok, Thailand', country: 'TH' },
  DAD: { en: 'Da Nang, Vietnam', country: 'VN' },
  CXR: { en: 'Nha Trang, Vietnam', country: 'VN' },
  PQC: { en: 'Phu Quoc, Vietnam', country: 'VN' },
  SGN: { en: 'Ho Chi Minh City, Vietnam', country: 'VN' },
  HAN: { en: 'Hanoi, Vietnam', country: 'VN' },
  CEB: { en: 'Cebu, Philippines', country: 'PH' },
  BKI: { en: 'Kota Kinabalu, Malaysia', country: 'MY' },
  DPS: { en: 'Bali, Indonesia', country: 'ID' },
  SIN: { en: 'Singapore', country: 'SG' },
  TPE: { en: 'Taipei, Taiwan', country: 'TW' },
  HKG: { en: 'Hong Kong', country: 'HK' },
  GUM: { en: 'Guam', country: 'GU' },
  CDG: { en: 'Paris, France', country: 'FR' },
  LHR: { en: 'London, UK', country: 'GB' },
  FCO: { en: 'Rome, Italy', country: 'IT' },
  BCN: { en: 'Barcelona, Spain', country: 'ES' },
  JFK: { en: 'New York, USA', country: 'US' },
  LAX: { en: 'Los Angeles, USA', country: 'US' },
  SYD: { en: 'Sydney, Australia', country: 'AU' },
};

/** 시안에 사진이 있는 도시(PC/모바일 사진이 다르다). 나머지 도시는 기존 도시 사진(useCityImage)을 쓴다 */
export const DEAL_PHOTOS: Record<string, { pc: string; mobile: string }> = {
  KIX: { pc: kixPc, mobile: kixM },
  FUK: { pc: fukPc, mobile: fukM },
  TPE: { pc: tpePc, mobile: tpeM },
  DAD: { pc: dadPc, mobile: dadM },
};
