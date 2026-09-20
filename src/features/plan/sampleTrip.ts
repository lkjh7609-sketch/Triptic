/**
 * 비로그인 샘플 여행 (02-screens.md §3.1, DEVELOPMENT_PLAN.md §10.3 "비로그인 샘플
 * 여행 둘러보기"). 원본: index.html SAMPLE_PROJECT_NAME/SAMPLE_PROJECT_DATA
 * (2026-09-21 기준 라인 3629~3809) — 도쿄 3박4일 일정을 데이터까지 그대로 이식한다.
 *
 * legacy 동작(openProject/saveData)과 동일하게: 로그인 없이 열어서 실제 여행처럼
 * 자유롭게 편집할 수 있지만 어디에도 저장되지 않고(Supabase 호출 없음, in-memory만
 * 갱신), 로비로 돌아가면 다음에 열 때 다시 초기 상태로 리셋된다. 공유·동행자 제안은
 * 지원하지 않는다(legacy updateProjectActionButtons(isSample=true)).
 */
import type { TripRow } from '@/shared/api/tripService';
import type {
  ExpensesData,
  FlightsData,
  HotelsData,
  MealsData,
  PlannerData,
} from './types';

export const SAMPLE_TRIP_ID = 'sample-tokyo-3n4d';
export const SAMPLE_TRIP_TITLE = '도쿄 3박 4일 감성 힐링 여행';
export const SAMPLE_TRIP_CITY = 'Tokyo, Japan';
export const SAMPLE_TRIP_START = '2026-10-15';
export const SAMPLE_TRIP_END = '2026-10-18';

const SAMPLE_DATA: PlannerData = {
  1: [
    {
      name: '하네다 국제공항 (HND)',
      address: 'Hanedakuko, Ota City, Tokyo 144-0041 일본',
      lat: 35.5494,
      lng: 139.7798,
      time: '11:30',
      memo: '도쿄 도착 후 게이큐선 또는 도쿄 모노레일 탑승',
    },
    {
      name: '호텔 그레이서리 신주쿠 (체크인)',
      address: '1-19-1 Kabukicho, Shinjuku City, Tokyo 160-8466 일본',
      lat: 35.6953,
      lng: 139.702,
      time: '14:00',
      memo: '짐 보관 후 신주쿠 교엔 정원 산책 출발',
    },
    {
      name: '신주쿠 교엔 국립정원',
      address: '11 Naitomachi, Shinjuku City, Tokyo 160-0014 일본',
      lat: 35.6852,
      lng: 139.7101,
      time: '15:30',
      memo: '도심 속 푸른 정원 산책 & 감성 테라스 카페',
    },
    {
      name: '신주쿠 오모이데요코초',
      address: '1 Chome-2 Nishishinjuku, Shinjuku City, Tokyo 160-0023 일본',
      lat: 35.6934,
      lng: 139.6998,
      time: '18:30',
      memo: '옛 쇼와 시대 정취의 야키토리 골목에서 시원한 생맥주',
    },
  ],
  2: [
    {
      name: '시부야 스카이 (SHIBUYA SKY)',
      address: '2 Chome-24-12 Shibuya, Shibuya City, Tokyo 150-0002 일본',
      lat: 35.6585,
      lng: 139.7022,
      time: '10:30',
      memo: '도쿄 시내가 360도 한눈에 내려다보이는 루프탑 전망대',
    },
    {
      name: '하라주쿠 캣스트리트 & 오모테산도',
      address: 'Jingumae, Shibuya City, Tokyo 150-0001 일본',
      lat: 35.6666,
      lng: 139.7093,
      time: '13:30',
      memo: '편집숍 & 감성 디저트 카페 거리 둘러보기',
    },
    {
      name: '메이지 신궁 산책로',
      address: '1-1 Yoyogikamizonocho, Shibuya City, Tokyo 151-8557 일본',
      lat: 35.6764,
      lng: 139.6993,
      time: '16:00',
      memo: '울창한 삼나무 숲길 힐링 산책',
    },
    {
      name: '시부야 스크램블 교차로 & 디너',
      address: '2 Chome-2 Shibuya, Shibuya City, Tokyo 150-0002 일본',
      lat: 35.6595,
      lng: 139.7005,
      time: '19:00',
      memo: '도쿄 야경과 함께하는 정통 와규 스키야키 디너',
    },
  ],
  3: [
    {
      name: '아사쿠사 센소지 (카미나리몬)',
      address: '2 Chome-3-1 Asakusa, Taito City, Tokyo 111-0032 일본',
      lat: 35.7148,
      lng: 139.7967,
      time: '10:00',
      memo: '나카미세도리 전통 길거리 간식(말차 아이스크림, 센베이)',
    },
    {
      name: '도쿄 스카이트리 & 소라마치',
      address: '1 Chome-1-2 Oshiage, Sumida City, Tokyo 131-0045 일본',
      lat: 35.7101,
      lng: 139.8107,
      time: '13:30',
      memo: '스카이트리 타운 쇼핑 및 기념품 구경',
    },
    {
      name: '긴자 식스 (GINZA SIX) & 옥상정원',
      address: '6 Chome-10-1 Ginza, Chuo City, Tokyo 104-0061 일본',
      lat: 35.6696,
      lng: 139.764,
      time: '17:00',
      memo: '츠타야 서점 아트북 라운지 & 긴자 명품거리 야경 산책',
    },
  ],
  4: [
    {
      name: '츠키지 장외시장',
      address: '4 Chome-16-2 Tsukiji, Chuo City, Tokyo 104-0045 일본',
      lat: 35.6655,
      lng: 139.7708,
      time: '09:30',
      memo: '신선한 우니 카이센동 & 타마고야키 브런치',
    },
    {
      name: '롯폰기 힐즈 모리 미술관',
      address: '6 Chome-10-1 Roppongi, Minato City, Tokyo 106-6150 일본',
      lat: 35.6605,
      lng: 139.7292,
      time: '12:30',
      memo: '모던 아트 전시 관람 및 도쿄 타워 전망',
    },
    {
      name: '하네다 국제공항 귀국 (HND)',
      address: 'Hanedakuko, Ota City, Tokyo 144-0041 일본',
      lat: 35.5494,
      lng: 139.7798,
      time: '16:00',
      memo: '면세점 쇼핑 후 서울행 항공편 탑승',
    },
  ],
};

const SAMPLE_HOTELS: HotelsData = {
  1: { name: '호텔 그레이서리 신주쿠', address: '1-19-1 Kabukicho, Shinjuku, Tokyo', lat: 35.6953, lng: 139.702 },
  2: { name: '호텔 그레이서리 신주쿠', address: '1-19-1 Kabukicho, Shinjuku, Tokyo', lat: 35.6953, lng: 139.702 },
  3: { name: '호텔 그레이서리 신주쿠', address: '1-19-1 Kabukicho, Shinjuku, Tokyo', lat: 35.6953, lng: 139.702 },
};

const SAMPLE_MEALS: MealsData = {
  1: {
    dinner: { name: '신주쿠 오모이데요코초 카부토', skip: false },
  },
  2: {
    lunch: { name: '블루보틀 커피 아오야마', skip: false },
    dinner: { name: '이마한 스키야키 신주쿠점', skip: false },
  },
  3: {
    breakfast: { name: '나카미세도리 전통 간식', skip: false },
    lunch: { name: '소라마치 라멘 스트리트', skip: false },
  },
  4: {
    breakfast: { name: '츠키지 토라즈시 (카이센동)', skip: false },
  },
};

const SAMPLE_FLIGHTS: FlightsData = {
  outbound: {
    flightNo: 'OZ102',
    date: SAMPLE_TRIP_START,
    airline: '아시아나항공',
    dep: { iata: 'GMP', name: '김포국제공항', lat: 37.5583, lng: 126.7906, time: '09:00' },
    arr: { iata: 'HND', name: '하네다 국제공항', lat: 35.5494, lng: 139.7798, time: '11:15' },
  },
  return: {
    flightNo: 'OZ101',
    date: SAMPLE_TRIP_END,
    airline: '아시아나항공',
    dep: { iata: 'HND', name: '하네다 국제공항', lat: 35.5494, lng: 139.7798, time: '18:00' },
    arr: { iata: 'GMP', name: '김포국제공항', lat: 37.5583, lng: 126.7906, time: '20:30' },
  },
};

const SAMPLE_EXPENSES: ExpensesData = {
  1: [
    { desc: '공항 모노레일 & 스이카 충전', amount: 3000 },
    { desc: '오모이데요코초 야키토리', amount: 4500 },
  ],
  2: [
    { desc: '시부야 스카이 입장권', amount: 2200 },
    { desc: '이마한 와규 스키야키', amount: 9800 },
  ],
  3: [{ desc: '도쿄 스카이트리 전망대', amount: 3100 }],
};

function buildSampleRow(): TripRow {
  const now = new Date().toISOString();
  return {
    id: SAMPLE_TRIP_ID,
    owner_id: 'sample',
    title: SAMPLE_TRIP_TITLE,
    city: SAMPLE_TRIP_CITY,
    city_lat: 35.6762,
    city_lng: 139.6503,
    start_date: SAMPLE_TRIP_START,
    end_date: SAMPLE_TRIP_END,
    total_days: 4,
    base_currency: 'JPY',
    status: 'planning',
    snapshot: {
      data: structuredClone(SAMPLE_DATA),
      hotels: structuredClone(SAMPLE_HOTELS),
      meals: structuredClone(SAMPLE_MEALS),
      expenses: structuredClone(SAMPLE_EXPENSES),
      flights: structuredClone(SAMPLE_FLIGHTS),
      dayCities: {},
    },
    created_at: now,
    updated_at: now,
  };
}

let sampleTripRow: TripRow = buildSampleRow();

/** 로비(여행 목록)로 돌아갈 때 호출 — legacy renderLobby가 매번 allProjects[SAMPLE]을
 * 원본으로 다시 채우던 것과 동일하게, 둘러보던 중 만든 변경은 버리고 초기화한다. */
export function resetSampleTrip(): void {
  sampleTripRow = buildSampleRow();
}

export function getSampleTripRow(): TripRow {
  return sampleTripRow;
}

/** TripDetailScreen의 저장 훅이 호출한다 — Supabase에는 절대 쓰지 않고 메모리에만 반영한다
 * (legacy saveData의 `if (activeProjectName === SAMPLE_PROJECT_NAME) return;`과 동일한 효과). */
export function updateSampleTripSnapshot(snapshot: TripRow['snapshot']): TripRow {
  sampleTripRow = {
    ...sampleTripRow,
    snapshot,
    updated_at: new Date().toISOString(),
  };
  return sampleTripRow;
}

export function getSampleTripPlaceCount(): number {
  return Object.values(SAMPLE_DATA).reduce((sum, items) => sum + items.length, 0);
}
