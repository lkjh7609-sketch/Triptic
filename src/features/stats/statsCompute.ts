/**
 * 통계 탭 계산 — 서버 RPC(get_travel_stats, 0104)가 준 여행별 집계에 도시 목록·환율을 붙여 화면용 통계로 바꾼다.
 * 전부 순수 함수라 시험할 수 있다(statsCompute.test.ts).
 *
 * 규칙(2026-10-09 사용자 확정):
 *  · '다녀온 여행' = 종료일이 오늘보다 앞선 여행. 예정·진행 중은 '예정 N건'으로만 센다.
 *  · 나라·대륙은 여행 도시 좌표에서 가장 가까운 등록 도시(destinations, 120km 안)로 정한다. 못 찾으면 '알 수 없음'으로 빼고 센다.
 *  · 경비는 서버가 여행 기본 통화로 환산해 준 값을 현재 환율로 원화로 바꾼다(환율이 없는 통화의 여행은 합계에서 뺀다).
 *  · 이동 거리: 항공 구간이 있으면 구간의 직선거리 합, 없고 해외면 인천 왕복 직선거리.
 */
import { continentOf } from '@/features/community/channel/channelHelpers';
import type { ContinentKey } from '@/features/community/destinationRegions';

export interface RawFlight {
  airline?: string | null;
  dep?: { iata?: string; lat?: number | null; lng?: number | null } | null;
  arr?: { iata?: string; lat?: number | null; lng?: number | null } | null;
}

export interface RawTrip {
  trip_id: string;
  title: string;
  city: string | null;
  city_lat: number | null;
  city_lng: number | null;
  start_date: string | null;
  end_date: string | null;
  total_days: number | null;
  base_currency: string | null;
  member_count: number;
  day_cities: { name: string | null; lat: number | null; lng: number | null }[];
  place_count: number;
  place_categories: Record<string, number>;
  expense_total: number | null;
  expense_unconverted: number;
  expense_by_category: Record<string, number>;
  expense_by_payment: Record<string, number>;
  expense_by_day: Record<string, number>;
  flights: RawFlight[];
}

export interface CityRef {
  id: string;
  name: string;
  country_code: string;
  lat: number;
  lng: number;
}

export interface VisitedPlace {
  key: string;
  /** 등록 도시와 맞았으면 그 이름, 아니면 여행에 적힌 도시 이름 */
  name: string;
  country: string | null;
  lat: number;
  lng: number;
}

export interface TripStat {
  id: string;
  title: string;
  city: string;
  startDate: string;
  endDate: string;
  days: number;
  places: VisitedPlace[];
  countries: string[];
  placeCount: number;
  placeCategories: Record<string, number>;
  flights: number;
  airlines: string[];
  distanceKm: number;
  companions: boolean;
  /** 원화 환산. 경비 기록이 없거나 환율이 없으면 null */
  expenseKrw: number | null;
  expenseByCategory: Record<string, number>;
  expenseByPayment: Record<string, number>;
  /** 일차(1부터) → 원화 */
  expenseByDay: Record<number, number>;
}

export interface Badge {
  key: 'firstTrip' | 'firstAbroad' | 'countries3' | 'countries5' | 'countries10' | 'trips5' | 'trips10' | 'trips20' | 'days30' | 'days100' | 'oneLap' | 'firstCompanion';
  /** 달성한 여행의 종료일 */
  date: string;
}

export interface TravelStats {
  upcomingCount: number;
  pastCount: number;
  trips: TripStat[];
  totalDays: number;
  cityCount: number;
  countryCount: number;
  /** 나라를 못 정한 장소 수(통계에서 빠진다) */
  unknownPlaces: number;
  totalKm: number;
  /** 지구 둘레(40,075km) 몇 바퀴 */
  laps: number;
  visited: VisitedPlace[];
  countries: { code: string; trips: number }[];
  continents: { key: ContinentKey; trips: number; percent: number }[];
  countryPercentOfWorld: number;
  expense: {
    tripsWithExpense: number;
    tripsWithoutExpense: number;
    totalKrw: number;
    perDayKrw: number | null;
    perTripKrw: number | null;
    mostExpensive: TripStat | null;
    byCategory: { key: string; krw: number }[];
    byPayment: { key: string; krw: number }[];
    /** 환율이 없어 합계에서 빠진 여행 수 */
    noRate: number;
  };
  habits: {
    byMonth: number[];
    byYear: { year: number; trips: number; days: number; krw: number }[];
    avgDays: number;
    longest: TripStat | null;
    topCities: { name: string; trips: number }[];
    placesPerDay: number;
    placeCategories: { key: string; count: number }[];
    style: 'food' | 'sightseeing' | 'balanced' | null;
  };
  badges: Badge[];
}

const SEOUL = { lat: 37.4691, lng: 126.451 };
const EARTH_KM = 40075;
const MATCH_KM = 120;
const WORLD_COUNTRIES = 195;

export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** 가장 가까운 등록 도시(MATCH_KM 안). 없으면 null */
export function nearestCity(lat: number, lng: number, cities: CityRef[]): CityRef | null {
  let best: CityRef | null = null;
  let bestKm = MATCH_KM;
  for (const c of cities) {
    const km = haversineKm(lat, lng, c.lat, c.lng);
    if (km <= bestKm) {
      best = c;
      bestKm = km;
    }
  }
  return best;
}

function inclusiveDays(start: string, end: string): number {
  const ms = new Date(`${end}T00:00:00Z`).getTime() - new Date(`${start}T00:00:00Z`).getTime();
  return Math.max(1, Math.round(ms / 86_400_000) + 1);
}

function tripPlaces(raw: RawTrip, cities: CityRef[]): VisitedPlace[] {
  const coords: { lat: number; lng: number; name: string | null }[] = [];
  for (const c of raw.day_cities ?? []) if (c.lat != null && c.lng != null) coords.push({ lat: c.lat, lng: c.lng, name: c.name });
  if (raw.city_lat != null && raw.city_lng != null) coords.push({ lat: raw.city_lat, lng: raw.city_lng, name: raw.city });
  const seen = new Set<string>();
  const out: VisitedPlace[] = [];
  for (const c of coords) {
    const key = `${c.lat.toFixed(1)},${c.lng.toFixed(1)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const match = nearestCity(c.lat, c.lng, cities);
    out.push({
      key: match ? `d:${match.id}` : `c:${key}`,
      name: match?.name ?? c.name ?? raw.city ?? raw.title,
      country: match?.country_code ?? null,
      lat: c.lat,
      lng: c.lng,
    });
  }
  // 같은 등록 도시로 합쳐진 것은 한 번만
  const uniq = new Map<string, VisitedPlace>();
  for (const p of out) if (!uniq.has(p.key)) uniq.set(p.key, p);
  return [...uniq.values()];
}

function tripDistanceKm(raw: RawTrip, places: VisitedPlace[]): number {
  let km = 0;
  let legs = 0;
  for (const f of raw.flights ?? []) {
    const a = f.dep;
    const b = f.arr;
    if (a?.lat != null && a.lng != null && b?.lat != null && b.lng != null) {
      km += haversineKm(a.lat, a.lng, b.lat, b.lng);
      legs += 1;
    }
  }
  if (legs > 0) return km;
  const abroad = places.find((p) => p.country && p.country !== 'KR');
  return abroad ? 2 * haversineKm(SEOUL.lat, SEOUL.lng, abroad.lat, abroad.lng) : 0;
}

function scale(map: Record<string, number> | null | undefined, rate: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(map ?? {})) out[k] = Number(v) * rate;
  return out;
}

function addTo(target: Record<string, number>, src: Record<string, number>) {
  for (const [k, v] of Object.entries(src)) target[k] = (target[k] ?? 0) + v;
}

function sortedEntries(map: Record<string, number>): { key: string; value: number }[] {
  return Object.entries(map)
    .map(([key, value]) => ({ key, value }))
    .filter((e) => e.value > 0)
    .sort((a, b) => b.value - a.value);
}

export function buildStats(input: {
  trips: RawTrip[];
  cities: CityRef[];
  /** 기본 통화 → 원화 환율(1단위 = 몇 원). 모르면 null */
  krwRate: (currency: string) => number | null;
  today: string;
}): TravelStats {
  const { cities, krwRate, today } = input;
  const dated = input.trips.filter((t) => t.start_date && t.end_date);
  const past = dated
    .filter((t) => t.end_date! < today)
    .sort((a, b) => (a.end_date! < b.end_date! ? -1 : a.end_date! > b.end_date! ? 1 : 0));
  const upcomingCount = dated.length - past.length;

  let noRate = 0;
  const trips: TripStat[] = past.map((raw) => {
    const places = tripPlaces(raw, cities);
    const hasExpense = raw.expense_total != null && Number(raw.expense_total) > 0;
    const rate = hasExpense ? krwRate(raw.base_currency ?? 'KRW') : null;
    if (hasExpense && rate == null) noRate += 1;
    const byDay: Record<number, number> = {};
    if (rate != null) for (const [k, v] of Object.entries(raw.expense_by_day ?? {})) if (Number(k) > 0) byDay[Number(k)] = Number(v) * rate;
    return {
      id: raw.trip_id,
      title: raw.title,
      city: raw.city ?? raw.title,
      startDate: raw.start_date!,
      endDate: raw.end_date!,
      days: raw.total_days && raw.total_days > 0 ? raw.total_days : inclusiveDays(raw.start_date!, raw.end_date!),
      places,
      countries: [...new Set(places.map((p) => p.country).filter((c): c is string => !!c))],
      placeCount: raw.place_count ?? 0,
      placeCategories: raw.place_categories ?? {},
      flights: (raw.flights ?? []).length,
      airlines: [...new Set((raw.flights ?? []).map((f) => f.airline).filter((a): a is string => !!a))],
      distanceKm: tripDistanceKm(raw, places),
      companions: (raw.member_count ?? 0) > 1,
      expenseKrw: rate != null ? Number(raw.expense_total) * rate : null,
      expenseByCategory: rate != null ? scale(raw.expense_by_category, rate) : {},
      expenseByPayment: rate != null ? scale(raw.expense_by_payment, rate) : {},
      expenseByDay: byDay,
    };
  });

  // ── 장소·나라·대륙 ──
  const visitedMap = new Map<string, VisitedPlace>();
  const countryTrips: Record<string, number> = {};
  let unknownPlaces = 0;
  for (const t of trips) {
    for (const p of t.places) {
      visitedMap.set(p.key, p);
      if (!p.country) unknownPlaces += 1;
    }
    for (const c of t.countries) countryTrips[c] = (countryTrips[c] ?? 0) + 1;
  }
  const countries = Object.entries(countryTrips)
    .map(([code, n]) => ({ code, trips: n }))
    .sort((a, b) => b.trips - a.trips);
  const continentTrips: Partial<Record<ContinentKey, number>> = {};
  for (const c of countries) {
    const k = continentOf(c.code);
    if (k) continentTrips[k] = (continentTrips[k] ?? 0) + c.trips;
  }
  const continentTotal = Object.values(continentTrips).reduce((s, n) => s + (n ?? 0), 0);
  const continents = (Object.entries(continentTrips) as [ContinentKey, number][])
    .map(([key, n]) => ({ key, trips: n, percent: continentTotal > 0 ? Math.round((n / continentTotal) * 100) : 0 }))
    .sort((a, b) => b.trips - a.trips);

  const totalKm = trips.reduce((s, t) => s + t.distanceKm, 0);
  const totalDays = trips.reduce((s, t) => s + t.days, 0);

  // ── 경비 ──
  const withExp = trips.filter((t) => t.expenseKrw != null && t.expenseKrw > 0);
  const totalKrw = withExp.reduce((s, t) => s + (t.expenseKrw ?? 0), 0);
  const catAll: Record<string, number> = {};
  const payAll: Record<string, number> = {};
  for (const t of withExp) {
    addTo(catAll, t.expenseByCategory);
    addTo(payAll, t.expenseByPayment);
  }
  const expDays = withExp.reduce((s, t) => s + t.days, 0);
  const mostExpensive = withExp.reduce<TripStat | null>((best, t) => (!best || (t.expenseKrw ?? 0) > (best.expenseKrw ?? 0) ? t : best), null);

  // ── 습관 ──
  const byMonth = Array.from({ length: 12 }, () => 0);
  const yearMap = new Map<number, { year: number; trips: number; days: number; krw: number }>();
  for (const t of trips) {
    const y = Number(t.startDate.slice(0, 4));
    const m = Number(t.startDate.slice(5, 7));
    if (m >= 1 && m <= 12) byMonth[m - 1]! += 1;
    const cur = yearMap.get(y) ?? { year: y, trips: 0, days: 0, krw: 0 };
    cur.trips += 1;
    cur.days += t.days;
    cur.krw += t.expenseKrw ?? 0;
    yearMap.set(y, cur);
  }
  const cityTrips: Record<string, { name: string; trips: number }> = {};
  for (const t of trips) {
    for (const p of t.places) {
      const e = cityTrips[p.key] ?? { name: p.name, trips: 0 };
      e.trips += 1;
      cityTrips[p.key] = e;
    }
  }
  const catCount: Record<string, number> = {};
  for (const t of trips) addTo(catCount, t.placeCategories);
  const placeTotal = trips.reduce((s, t) => s + t.placeCount, 0);
  const catEntries = sortedEntries(catCount).map((e) => ({ key: e.key, count: e.value }));
  const mealShare = placeTotal > 0 ? (catCount['meal'] ?? 0) / placeTotal : 0;
  const sightShare = placeTotal > 0 ? (catCount['sight'] ?? 0) / placeTotal : 0;
  const style: TravelStats['habits']['style'] = placeTotal < 5 ? null : mealShare >= 0.35 ? 'food' : sightShare >= 0.5 ? 'sightseeing' : 'balanced';

  return {
    upcomingCount,
    pastCount: trips.length,
    trips: [...trips].sort((a, b) => (a.startDate < b.startDate ? 1 : -1)),
    totalDays,
    cityCount: visitedMap.size,
    countryCount: countries.length,
    unknownPlaces,
    totalKm,
    laps: totalKm / EARTH_KM,
    visited: [...visitedMap.values()],
    countries,
    continents,
    countryPercentOfWorld: Math.round((countries.length / WORLD_COUNTRIES) * 100),
    expense: {
      tripsWithExpense: withExp.length,
      tripsWithoutExpense: trips.length - withExp.length,
      totalKrw,
      perDayKrw: expDays > 0 ? totalKrw / expDays : null,
      perTripKrw: withExp.length > 0 ? totalKrw / withExp.length : null,
      mostExpensive,
      byCategory: sortedEntries(catAll).map((e) => ({ key: e.key, krw: e.value })),
      byPayment: sortedEntries(payAll).map((e) => ({ key: e.key, krw: e.value })),
      noRate,
    },
    habits: {
      byMonth,
      byYear: [...yearMap.values()].sort((a, b) => b.year - a.year),
      avgDays: trips.length > 0 ? totalDays / trips.length : 0,
      longest: trips.reduce<TripStat | null>((best, t) => (!best || t.days > best.days ? t : best), null),
      topCities: Object.values(cityTrips)
        .sort((a, b) => b.trips - a.trips || a.name.localeCompare(b.name))
        .slice(0, 3),
      placesPerDay: totalDays > 0 ? placeTotal / totalDays : 0,
      placeCategories: catEntries,
      style,
    },
    badges: computeBadges(trips),
  };
}

/** 이정표 — 종료일 순으로 훑으며 처음 넘긴 여행의 종료일을 날짜로 남긴다 */
export function computeBadges(tripsAsc: TripStat[]): Badge[] {
  const out: Badge[] = [];
  const done = new Set<Badge['key']>();
  const award = (key: Badge['key'], date: string) => {
    if (!done.has(key)) {
      done.add(key);
      out.push({ key, date });
    }
  };
  const seenCountries = new Set<string>();
  let count = 0;
  let days = 0;
  let km = 0;
  const ordered = [...tripsAsc].sort((a, b) => (a.endDate < b.endDate ? -1 : a.endDate > b.endDate ? 1 : 0));
  for (const t of ordered) {
    count += 1;
    days += t.days;
    km += t.distanceKm;
    for (const c of t.countries) seenCountries.add(c);
    award('firstTrip', t.endDate);
    if (t.countries.some((c) => c !== 'KR')) award('firstAbroad', t.endDate);
    if (t.companions) award('firstCompanion', t.endDate);
    if (seenCountries.size >= 3) award('countries3', t.endDate);
    if (seenCountries.size >= 5) award('countries5', t.endDate);
    if (seenCountries.size >= 10) award('countries10', t.endDate);
    if (count >= 5) award('trips5', t.endDate);
    if (count >= 10) award('trips10', t.endDate);
    if (count >= 20) award('trips20', t.endDate);
    if (days >= 30) award('days30', t.endDate);
    if (days >= 100) award('days100', t.endDate);
    if (km >= EARTH_KM) award('oneLap', t.endDate);
  }
  return out;
}
