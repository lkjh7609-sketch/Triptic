/* i18n-exempt-file: 샘플 여행 콘텐츠를 4개 언어로 모두 담은 데이터 테이블이다. */
/**
 * 비로그인 샘플 여행 (02-screens.md §3.1, DEVELOPMENT_PLAN.md §10.3 "비로그인 샘플
 * 여행 둘러보기"). 원본: index.html SAMPLE_PROJECT_NAME/SAMPLE_PROJECT_DATA
 * (2026-09-21 기준 라인 3629~3809) — 도쿄 3박4일 일정을 그대로 이식하고, 장소명·메모·
 * 항공·경비 문구를 표시 언어(ko/en/zh-TW/ja)별로 준비했다.
 *
 * legacy 동작(openProject/saveData)과 동일하게: 로그인 없이 열어서 실제 여행처럼
 * 자유롭게 편집할 수 있지만 어디에도 저장되지 않고(Supabase 호출 없음, in-memory만
 * 갱신), 목록으로 돌아가거나 표시 언어를 바꾸면 다시 초기 상태로 리셋된다. 공유·동행자
 * 제안은 지원하지 않는다(legacy updateProjectActionButtons(isSample=true)).
 */
import i18next, { normalizeLocale, type SupportedLocale } from '@/shared/i18n';
import type { TripRow } from '@/shared/api/tripService';
import type { ExpensesData, FlightsData, HotelsData, MealsData, PlannerData } from './types';

export const SAMPLE_TRIP_ID = 'sample-tokyo-3n4d';
export const SAMPLE_TRIP_CITY = 'Tokyo, Japan';
export const SAMPLE_TRIP_START = '2026-10-15';
export const SAMPLE_TRIP_END = '2026-10-18';

type L10n = Record<SupportedLocale, string>;

interface SamplePlace {
  name: L10n;
  memo: L10n;
  address: string;
  lat: number;
  lng: number;
  time: string;
}

const TITLE: L10n = {
  ko: '도쿄 3박 4일 감성 힐링 여행',
  en: '4 Days in Tokyo: A Relaxed City Escape',
  'zh-TW': '東京四天三夜療癒之旅',
  ja: '東京3泊4日 癒やしの旅',
};

const HANEDA = { lat: 35.5494, lng: 139.7798 };

const PLACES: Record<number, SamplePlace[]> = {
  1: [
    {
      name: { ko: '하네다 국제공항 (HND)', en: 'Haneda Airport (HND)', 'zh-TW': '羽田機場 (HND)', ja: '羽田空港 (HND)' },
      memo: {
        ko: '도쿄 도착 후 게이큐선 또는 도쿄 모노레일 탑승',
        en: 'Arrive in Tokyo and take the Keikyu Line or Tokyo Monorail',
        'zh-TW': '抵達東京後搭乘京急線或東京單軌電車',
        ja: '東京到着後、京急線または東京モノレールに乗車',
      },
      address: 'Hanedakuko, Ota City, Tokyo 144-0041',
      ...HANEDA,
      time: '11:30',
    },
    {
      name: {
        ko: '호텔 그레이서리 신주쿠 (체크인)',
        en: 'Hotel Gracery Shinjuku (check-in)',
        'zh-TW': '新宿格拉斯麗飯店（入住）',
        ja: 'ホテルグレイスリー新宿（チェックイン）',
      },
      memo: {
        ko: '짐 보관 후 신주쿠 교엔 정원 산책 출발',
        en: 'Drop off luggage, then head out for a walk in Shinjuku Gyoen',
        'zh-TW': '寄放行李後前往新宿御苑散步',
        ja: '荷物を預けて新宿御苑へ散歩に出発',
      },
      address: '1-19-1 Kabukicho, Shinjuku City, Tokyo 160-8466',
      lat: 35.6953,
      lng: 139.702,
      time: '14:00',
    },
    {
      name: { ko: '신주쿠 교엔 국립정원', en: 'Shinjuku Gyoen National Garden', 'zh-TW': '新宿御苑', ja: '新宿御苑' },
      memo: {
        ko: '도심 속 푸른 정원 산책 & 감성 테라스 카페',
        en: 'A green garden stroll in the city & a cozy terrace café',
        'zh-TW': '在市中心的綠色庭園散步＆氣氛滿分的露臺咖啡廳',
        ja: '都心の緑あふれる庭園散策＆おしゃれなテラスカフェ',
      },
      address: '11 Naitomachi, Shinjuku City, Tokyo 160-0014',
      lat: 35.6852,
      lng: 139.7101,
      time: '15:30',
    },
    {
      name: { ko: '신주쿠 오모이데요코초', en: 'Omoide Yokocho, Shinjuku', 'zh-TW': '新宿回憶橫丁', ja: '新宿 思い出横丁' },
      memo: {
        ko: '옛 쇼와 시대 정취의 야키토리 골목에서 시원한 생맥주',
        en: 'Cold draft beer in a Showa-era yakitori alley',
        'zh-TW': '在昭和風情的烤雞串小巷喝杯冰涼生啤酒',
        ja: '昭和レトロな焼き鳥横丁で冷たい生ビール',
      },
      address: '1 Chome-2 Nishishinjuku, Shinjuku City, Tokyo 160-0023',
      lat: 35.6934,
      lng: 139.6998,
      time: '18:30',
    },
  ],
  2: [
    {
      name: { ko: '시부야 스카이 (SHIBUYA SKY)', en: 'SHIBUYA SKY', 'zh-TW': '澀谷 SKY (SHIBUYA SKY)', ja: '渋谷スカイ (SHIBUYA SKY)' },
      memo: {
        ko: '도쿄 시내가 360도 한눈에 내려다보이는 루프탑 전망대',
        en: 'Rooftop observation deck with 360° views over Tokyo',
        'zh-TW': '可 360 度俯瞰東京市區的頂樓展望台',
        ja: '東京を360度見渡せる屋上展望台',
      },
      address: '2 Chome-24-12 Shibuya, Shibuya City, Tokyo 150-0002',
      lat: 35.6585,
      lng: 139.7022,
      time: '10:30',
    },
    {
      name: {
        ko: '하라주쿠 캣스트리트 & 오모테산도',
        en: 'Harajuku Cat Street & Omotesando',
        'zh-TW': '原宿貓街＆表參道',
        ja: '原宿キャットストリート＆表参道',
      },
      memo: {
        ko: '편집숍 & 감성 디저트 카페 거리 둘러보기',
        en: 'Browse select shops and dessert cafés',
        'zh-TW': '逛逛選品店與甜點咖啡廳',
        ja: 'セレクトショップとスイーツカフェ巡り',
      },
      address: 'Jingumae, Shibuya City, Tokyo 150-0001',
      lat: 35.6666,
      lng: 139.7093,
      time: '13:30',
    },
    {
      name: { ko: '메이지 신궁 산책로', en: 'Meiji Jingu forest path', 'zh-TW': '明治神宮參道', ja: '明治神宮の参道' },
      memo: {
        ko: '울창한 삼나무 숲길 힐링 산책',
        en: 'A relaxing walk through the dense cedar forest',
        'zh-TW': '在茂密杉木林中療癒散步',
        ja: '杉の森の小道で癒やしの散歩',
      },
      address: '1-1 Yoyogikamizonocho, Shibuya City, Tokyo 151-8557',
      lat: 35.6764,
      lng: 139.6993,
      time: '16:00',
    },
    {
      name: {
        ko: '시부야 스크램블 교차로 & 디너',
        en: 'Shibuya Scramble Crossing & dinner',
        'zh-TW': '澀谷十字路口＆晚餐',
        ja: '渋谷スクランブル交差点＆ディナー',
      },
      memo: {
        ko: '도쿄 야경과 함께하는 정통 와규 스키야키 디너',
        en: 'Authentic wagyu sukiyaki dinner with Tokyo night views',
        'zh-TW': '伴著東京夜景享用道地和牛壽喜燒晚餐',
        ja: '東京の夜景と本格和牛すき焼きディナー',
      },
      address: '2 Chome-2 Shibuya, Shibuya City, Tokyo 150-0002',
      lat: 35.6595,
      lng: 139.7005,
      time: '19:00',
    },
  ],
  3: [
    {
      name: { ko: '아사쿠사 센소지 (카미나리몬)', en: 'Senso-ji, Asakusa (Kaminarimon)', 'zh-TW': '淺草寺（雷門）', ja: '浅草寺（雷門）' },
      memo: {
        ko: '나카미세도리 전통 길거리 간식(말차 아이스크림, 센베이)',
        en: 'Street snacks on Nakamise-dori (matcha ice cream, senbei)',
        'zh-TW': '仲見世通傳統小吃（抹茶冰淇淋、仙貝）',
        ja: '仲見世通りの食べ歩き（抹茶アイス、せんべい）',
      },
      address: '2 Chome-3-1 Asakusa, Taito City, Tokyo 111-0032',
      lat: 35.7148,
      lng: 139.7967,
      time: '10:00',
    },
    {
      name: { ko: '도쿄 스카이트리 & 소라마치', en: 'Tokyo Skytree & Solamachi', 'zh-TW': '東京晴空塔＆晴空街道', ja: '東京スカイツリー＆ソラマチ' },
      memo: {
        ko: '스카이트리 타운 쇼핑 및 기념품 구경',
        en: 'Shopping and souvenirs at Skytree Town',
        'zh-TW': '在晴空塔城購物、逛紀念品',
        ja: 'スカイツリータウンでショッピングとお土産探し',
      },
      address: '1 Chome-1-2 Oshiage, Sumida City, Tokyo 131-0045',
      lat: 35.7101,
      lng: 139.8107,
      time: '13:30',
    },
    {
      name: { ko: '긴자 식스 (GINZA SIX) & 옥상정원', en: 'GINZA SIX & rooftop garden', 'zh-TW': 'GINZA SIX＆頂樓花園', ja: 'GINZA SIX＆屋上庭園' },
      memo: {
        ko: '츠타야 서점 아트북 라운지 & 긴자 명품거리 야경 산책',
        en: "Art-book lounge at Tsutaya Books & an evening walk down Ginza's main street",
        'zh-TW': '蔦屋書店藝術書區＆銀座名牌街夜景散步',
        ja: '蔦屋書店のアートブックラウンジ＆銀座の夜景散歩',
      },
      address: '6 Chome-10-1 Ginza, Chuo City, Tokyo 104-0061',
      lat: 35.6696,
      lng: 139.764,
      time: '17:00',
    },
  ],
  4: [
    {
      name: { ko: '츠키지 장외시장', en: 'Tsukiji Outer Market', 'zh-TW': '築地場外市場', ja: '築地場外市場' },
      memo: {
        ko: '신선한 우니 카이센동 & 타마고야키 브런치',
        en: 'Fresh sea urchin kaisendon & tamagoyaki brunch',
        'zh-TW': '新鮮海膽海鮮丼＆玉子燒早午餐',
        ja: '新鮮なうに海鮮丼＆玉子焼きのブランチ',
      },
      address: '4 Chome-16-2 Tsukiji, Chuo City, Tokyo 104-0045',
      lat: 35.6655,
      lng: 139.7708,
      time: '09:30',
    },
    {
      name: { ko: '롯폰기 힐즈 모리 미술관', en: 'Mori Art Museum, Roppongi Hills', 'zh-TW': '六本木之丘森美術館', ja: '六本木ヒルズ 森美術館' },
      memo: {
        ko: '모던 아트 전시 관람 및 도쿄 타워 전망',
        en: 'Modern art exhibitions and views of Tokyo Tower',
        'zh-TW': '欣賞現代藝術展並眺望東京鐵塔',
        ja: '現代アート鑑賞と東京タワーの眺め',
      },
      address: '6 Chome-10-1 Roppongi, Minato City, Tokyo 106-6150',
      lat: 35.6605,
      lng: 139.7292,
      time: '12:30',
    },
    {
      name: { ko: '하네다 국제공항 귀국 (HND)', en: 'Haneda Airport – flight home (HND)', 'zh-TW': '羽田機場 回程 (HND)', ja: '羽田空港から帰国 (HND)' },
      memo: {
        ko: '면세점 쇼핑 후 서울행 항공편 탑승',
        en: 'Duty-free shopping, then board the flight to Seoul',
        'zh-TW': '免稅店購物後搭乘飛往首爾的班機',
        ja: '免税店で買い物をしてソウル行きの便に搭乗',
      },
      address: 'Hanedakuko, Ota City, Tokyo 144-0041',
      ...HANEDA,
      time: '16:00',
    },
  ],
};

const HOTEL_NAME: L10n = {
  ko: '호텔 그레이서리 신주쿠',
  en: 'Hotel Gracery Shinjuku',
  'zh-TW': '新宿格拉斯麗飯店',
  ja: 'ホテルグレイスリー新宿',
};

const MEALS: Record<number, Partial<Record<'breakfast' | 'lunch' | 'dinner', L10n>>> = {
  1: { dinner: { ko: '신주쿠 오모이데요코초 카부토', en: 'Kabuto, Omoide Yokocho', 'zh-TW': '回憶橫丁 Kabuto', ja: '思い出横丁 カブト' } },
  2: {
    lunch: { ko: '블루보틀 커피 아오야마', en: 'Blue Bottle Coffee Aoyama', 'zh-TW': '藍瓶咖啡 青山店', ja: 'ブルーボトルコーヒー 青山' },
    dinner: { ko: '이마한 스키야키 신주쿠점', en: 'Imahan Sukiyaki, Shinjuku', 'zh-TW': '今半壽喜燒 新宿店', ja: '今半 新宿店（すき焼き）' },
  },
  3: {
    breakfast: { ko: '나카미세도리 전통 간식', en: 'Street snacks on Nakamise-dori', 'zh-TW': '仲見世通傳統小吃', ja: '仲見世通りの食べ歩き' },
    lunch: { ko: '소라마치 라멘 스트리트', en: 'Solamachi ramen street', 'zh-TW': '晴空街道拉麵街', ja: 'ソラマチのラーメン街' },
  },
  4: { breakfast: { ko: '츠키지 토라즈시 (카이센동)', en: 'Kaisendon at Tsukiji', 'zh-TW': '築地海鮮丼', ja: '築地の海鮮丼' } },
};

const AIRLINE: L10n = { ko: '아시아나항공', en: 'Asiana Airlines', 'zh-TW': '韓亞航空', ja: 'アシアナ航空' };
const GIMPO: L10n = { ko: '김포국제공항', en: 'Gimpo International Airport', 'zh-TW': '金浦國際機場', ja: '金浦国際空港' };
const HANEDA_NAME: L10n = { ko: '하네다 국제공항', en: 'Haneda Airport', 'zh-TW': '羽田機場', ja: '羽田空港' };

const EXPENSES: Record<number, Array<{ desc: L10n; amount: number }>> = {
  1: [
    { desc: { ko: '공항 모노레일 & 스이카 충전', en: 'Airport monorail & Suica top-up', 'zh-TW': '機場單軌電車＆Suica 儲值', ja: '空港モノレール＆Suicaチャージ' }, amount: 3000 },
    { desc: { ko: '오모이데요코초 야키토리', en: 'Yakitori at Omoide Yokocho', 'zh-TW': '回憶橫丁烤雞串', ja: '思い出横丁の焼き鳥' }, amount: 4500 },
  ],
  2: [
    { desc: { ko: '시부야 스카이 입장권', en: 'SHIBUYA SKY ticket', 'zh-TW': '澀谷 SKY 門票', ja: '渋谷スカイ入場券' }, amount: 2200 },
    { desc: { ko: '이마한 와규 스키야키', en: 'Imahan wagyu sukiyaki', 'zh-TW': '今半和牛壽喜燒', ja: '今半の和牛すき焼き' }, amount: 9800 },
  ],
  3: [{ desc: { ko: '도쿄 스카이트리 전망대', en: 'Tokyo Skytree observation deck', 'zh-TW': '東京晴空塔展望台', ja: '東京スカイツリー展望台' }, amount: 3100 }],
};

function currentLocale(): SupportedLocale {
  return normalizeLocale(i18next.language);
}

export function getSampleTripTitle(locale: SupportedLocale = currentLocale()): string {
  return TITLE[locale];
}

function buildSampleRow(locale: SupportedLocale): TripRow {
  const now = new Date().toISOString();

  const data: PlannerData = {};
  for (const [day, places] of Object.entries(PLACES)) {
    data[Number(day)] = places.map((p) => ({
      name: p.name[locale],
      address: p.address,
      lat: p.lat,
      lng: p.lng,
      time: p.time,
      memo: p.memo[locale],
    }));
  }

  const hotel = { name: HOTEL_NAME[locale], address: '1-19-1 Kabukicho, Shinjuku, Tokyo', lat: 35.6953, lng: 139.702 };
  const hotels: HotelsData = { 1: { ...hotel }, 2: { ...hotel }, 3: { ...hotel } };

  const meals: MealsData = {};
  for (const [day, slots] of Object.entries(MEALS)) {
    meals[Number(day)] = Object.fromEntries(
      Object.entries(slots).map(([slot, name]) => [slot, { name: name[locale], skip: false }]),
    );
  }

  const flights: FlightsData = {
    outbound: {
      flightNo: 'OZ102',
      date: SAMPLE_TRIP_START,
      airline: AIRLINE[locale],
      dep: { iata: 'GMP', name: GIMPO[locale], lat: 37.5583, lng: 126.7906, time: '09:00' },
      arr: { iata: 'HND', name: HANEDA_NAME[locale], ...HANEDA, time: '11:15' },
    },
    return: {
      flightNo: 'OZ101',
      date: SAMPLE_TRIP_END,
      airline: AIRLINE[locale],
      dep: { iata: 'HND', name: HANEDA_NAME[locale], ...HANEDA, time: '18:00' },
      arr: { iata: 'GMP', name: GIMPO[locale], lat: 37.5583, lng: 126.7906, time: '20:30' },
    },
  };

  const expenses: ExpensesData = {};
  for (const [day, list] of Object.entries(EXPENSES)) {
    expenses[Number(day)] = list.map((e) => ({ desc: e.desc[locale], amount: e.amount }));
  }

  return {
    id: SAMPLE_TRIP_ID,
    owner_id: 'sample',
    title: TITLE[locale],
    city: SAMPLE_TRIP_CITY,
    city_lat: 35.6762,
    city_lng: 139.6503,
    start_date: SAMPLE_TRIP_START,
    end_date: SAMPLE_TRIP_END,
    total_days: 4,
    base_currency: 'JPY',
    status: 'planning',
    content: { data, hotels, meals, expenses, flights, dayCities: {} },
    created_at: now,
    updated_at: now,
  };
}

let sampleLocale: SupportedLocale = currentLocale();
let sampleTripRow: TripRow = buildSampleRow(sampleLocale);

/** 로비(여행 목록)로 돌아갈 때 호출 — legacy renderLobby가 매번 allProjects[SAMPLE]을
 * 원본으로 다시 채우던 것과 동일하게, 둘러보던 중 만든 변경은 버리고 초기화한다. */
export function resetSampleTrip(): void {
  sampleLocale = currentLocale();
  sampleTripRow = buildSampleRow(sampleLocale);
}

/** 표시 언어가 바뀌었으면 그 언어로 다시 만든다(편집 중이던 변경은 초기화) */
export function getSampleTripRow(): TripRow {
  if (sampleLocale !== currentLocale()) resetSampleTrip();
  return sampleTripRow;
}

/** TripDetailScreen의 저장 훅이 호출한다 — Supabase에는 절대 쓰지 않고 메모리에만 반영한다
 * (legacy saveData의 `if (activeProjectName === SAMPLE_PROJECT_NAME) return;`과 동일한 효과). */
export function updateSampleTripSnapshot(content: TripRow['content']): TripRow {
  sampleTripRow = {
    ...sampleTripRow,
    content,
    updated_at: new Date().toISOString(),
  };
  return sampleTripRow;
}

export function getSampleTripPlaceCount(): number {
  return Object.values(PLACES).reduce((sum, items) => sum + items.length, 0);
}
