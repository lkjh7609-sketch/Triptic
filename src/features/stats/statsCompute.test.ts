import { describe, expect, it } from 'vitest';
import { buildStats, computeBadges, haversineKm, nearestCity, type CityRef, type RawTrip } from './statsCompute';

const CITIES: CityRef[] = [
  { id: 'tokyo', name: '도쿄', country_code: 'JP', lat: 35.68, lng: 139.77 },
  { id: 'osaka', name: '오사카', country_code: 'JP', lat: 34.69, lng: 135.5 },
  { id: 'paris', name: '파리', country_code: 'FR', lat: 48.86, lng: 2.35 },
  { id: 'seoul', name: '서울', country_code: 'KR', lat: 37.57, lng: 126.98 },
  { id: 'jeju', name: '제주', country_code: 'KR', lat: 33.5, lng: 126.53 },
];

function trip(over: Partial<RawTrip> & { trip_id: string }): RawTrip {
  return {
    title: over.trip_id,
    city: null,
    city_lat: null,
    city_lng: null,
    start_date: '2026-01-10',
    end_date: '2026-01-14',
    total_days: 5,
    base_currency: 'KRW',
    member_count: 1,
    day_cities: [],
    place_count: 0,
    place_categories: {},
    expense_total: null,
    expense_unconverted: 0,
    expense_by_category: {},
    expense_by_payment: {},
    expense_by_day: {},
    flights: [],
    ...over,
  };
}

const rate = (c: string) => (c === 'KRW' ? 1 : c === 'JPY' ? 9.2 : c === 'EUR' ? 1500 : null);
const today = '2026-10-09';

describe('nearestCity', () => {
  it('120km 안의 가장 가까운 도시, 멀면 null', () => {
    expect(nearestCity(35.7, 139.7, CITIES)?.id).toBe('tokyo');
    expect(nearestCity(0, 0, CITIES)).toBeNull();
  });
});

describe('haversineKm', () => {
  it('서울-도쿄는 약 1,160km', () => {
    const km = haversineKm(37.57, 126.98, 35.68, 139.77);
    expect(km).toBeGreaterThan(1100);
    expect(km).toBeLessThan(1250);
  });
});

describe('buildStats', () => {
  const trips: RawTrip[] = [
    trip({
      trip_id: 'a', title: '도쿄 여행', start_date: '2026-03-01', end_date: '2026-03-05', total_days: 5, base_currency: 'JPY',
      city_lat: 35.68, city_lng: 139.77, day_cities: [{ name: '도쿄', lat: 35.68, lng: 139.77 }, { name: '도쿄', lat: 35.681, lng: 139.771 }],
      place_count: 10, place_categories: { meal: 5, sight: 5 }, expense_total: 50000, expense_by_category: { food: 30000, transport: 20000 },
      expense_by_payment: { card: 40000, unknown: 10000 }, expense_by_day: { '1': 20000, '2': 30000 },
      flights: [{ airline: '대한항공', dep: { lat: 37.47, lng: 126.45 }, arr: { lat: 35.55, lng: 139.78 } }, { airline: '대한항공', dep: { lat: 35.55, lng: 139.78 }, arr: { lat: 37.47, lng: 126.45 } }],
    }),
    trip({ trip_id: 'b', title: '파리', start_date: '2025-06-01', end_date: '2025-06-10', total_days: 10, base_currency: 'EUR', city_lat: 48.86, city_lng: 2.35, member_count: 2, expense_total: 2000, expense_by_category: { shopping: 2000 }, expense_by_day: { '1': 2000 } }),
    trip({ trip_id: 'c', title: '제주', start_date: '2026-05-01', end_date: '2026-05-03', total_days: 3, city_lat: 33.5, city_lng: 126.53 }),
    trip({ trip_id: 'future', title: '곧', start_date: '2026-12-01', end_date: '2026-12-05' }),
    trip({ trip_id: 'nodate', title: '날짜없음', start_date: null, end_date: null }),
    trip({ trip_id: 'x', title: '알 수 없는 곳', start_date: '2026-02-01', end_date: '2026-02-02', total_days: 2, city_lat: 0, city_lng: 0, city: 'Nowhere' }),
  ];
  const stats = buildStats({ trips, cities: CITIES, krwRate: rate, today });

  it('종료일이 지난 여행만 센다 — 예정은 따로', () => {
    expect(stats.pastCount).toBe(4);
    expect(stats.upcomingCount).toBe(1);
  });

  it('나라·대륙 — 도시를 못 찾은 곳은 빼고 센다', () => {
    expect(stats.countries.map((c) => c.code).sort()).toEqual(['FR', 'JP', 'KR']);
    expect(stats.unknownPlaces).toBe(1);
    const asia = stats.continents.find((c) => c.key === 'AS');
    const europe = stats.continents.find((c) => c.key === 'EU');
    expect(asia?.percent).toBe(67);
    expect(europe?.percent).toBe(33);
  });

  it('같은 도시는 한 번만 센다(좌표가 조금 달라도)', () => {
    const tokyo = stats.trips.find((t) => t.id === 'a')!;
    expect(tokyo.places).toHaveLength(1);
    expect(stats.cityCount).toBe(4); // 도쿄·파리·제주 + 이름 모를 곳
  });

  it('경비는 현재 환율로 원화 환산 — 기록 없는 여행은 평균에서 뺀다', () => {
    const tokyo = stats.trips.find((t) => t.id === 'a')!;
    expect(tokyo.expenseKrw).toBeCloseTo(50000 * 9.2);
    expect(tokyo.expenseByDay[2]).toBeCloseTo(30000 * 9.2);
    expect(stats.expense.tripsWithExpense).toBe(2);
    expect(stats.expense.tripsWithoutExpense).toBe(2);
    expect(stats.expense.totalKrw).toBeCloseTo(50000 * 9.2 + 2000 * 1500);
    expect(stats.expense.perTripKrw).toBeCloseTo((50000 * 9.2 + 2000 * 1500) / 2);
    expect(stats.expense.perDayKrw).toBeCloseTo((50000 * 9.2 + 2000 * 1500) / 15);
    expect(stats.expense.mostExpensive?.id).toBe('b');
    expect(stats.expense.byCategory[0]?.key).toBe('shopping');
  });

  it('환율을 모르는 통화의 여행은 합계에서 빼고 센다', () => {
    const s = buildStats({ trips: [trip({ trip_id: 'z', base_currency: 'XXX', expense_total: 100 })], cities: CITIES, krwRate: rate, today });
    expect(s.expense.noRate).toBe(1);
    expect(s.expense.totalKrw).toBe(0);
    expect(s.expense.tripsWithExpense).toBe(0);
  });

  it('이동 거리 — 항공 구간이 있으면 그 합, 없고 해외면 인천 왕복, 국내는 0', () => {
    const tokyo = stats.trips.find((t) => t.id === 'a')!;
    expect(tokyo.distanceKm).toBeGreaterThan(2000);
    expect(tokyo.distanceKm).toBeLessThan(2500);
    expect(stats.trips.find((t) => t.id === 'b')!.distanceKm).toBeGreaterThan(14000); // 인천↔파리 왕복
    expect(stats.trips.find((t) => t.id === 'c')!.distanceKm).toBe(0);
    expect(stats.laps).toBeCloseTo(stats.totalKm / 40075);
  });

  it('습관 — 월별·연도별·성향·자주 간 도시', () => {
    expect(stats.habits.byMonth[2]).toBe(1); // 3월
    expect(stats.habits.byMonth[5]).toBe(1); // 6월
    expect(stats.habits.byYear.map((y) => y.year)).toEqual([2026, 2025]);
    expect(stats.habits.longest?.id).toBe('b');
    expect(stats.habits.style).toBe('food'); // 방문 장소 10곳 중 식사 5곳(50%)
    expect(stats.habits.topCities.length).toBeLessThanOrEqual(3);
  });

  it('장소가 5곳보다 적으면 성향을 말하지 않는다', () => {
    const s = buildStats({ trips: [trip({ trip_id: 'q', place_count: 2, place_categories: { meal: 2 } })], cities: CITIES, krwRate: rate, today });
    expect(s.habits.style).toBeNull();
  });

  it('여행이 없으면 빈 통계', () => {
    const s = buildStats({ trips: [], cities: CITIES, krwRate: rate, today });
    expect(s.pastCount).toBe(0);
    expect(s.laps).toBe(0);
    expect(s.badges).toEqual([]);
  });
});

describe('computeBadges', () => {
  it('처음 넘긴 여행의 종료일을 날짜로 남긴다', () => {
    const mk = (id: string, end: string, countries: string[], days = 4, km = 0, companions = false) => ({
      id, title: id, city: id, startDate: end, endDate: end, days, places: [], countries, placeCount: 0, placeCategories: {}, flights: 0, airlines: [],
      distanceKm: km, companions, expenseKrw: null, expenseByCategory: {}, expenseByPayment: {}, expenseByDay: {},
    });
    const badges = computeBadges([
      mk('t1', '2025-01-05', ['KR']),
      mk('t2', '2025-03-05', ['JP'], 4, 1500, true),
      mk('t3', '2025-06-05', ['FR'], 4, 20000),
      mk('t4', '2025-09-05', ['US'], 4, 20000),
    ]);
    const at = (k: string) => badges.find((b) => b.key === k)?.date;
    expect(at('firstTrip')).toBe('2025-01-05');
    expect(at('firstAbroad')).toBe('2025-03-05');
    expect(at('firstCompanion')).toBe('2025-03-05');
    expect(at('countries3')).toBe('2025-06-05'); // KR·JP·FR
    expect(at('oneLap')).toBe('2025-09-05'); // 누적 41,500km
    expect(at('trips5')).toBeUndefined();
  });
});
