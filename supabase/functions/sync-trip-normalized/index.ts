/**
 * Supabase Edge Function: sync-trip-normalized (03-data-model.md §6 M2/M5)
 *
 * POST { tripId: string }
 * Authorization: 호출한 사용자의 Supabase 세션 JWT — userClient로만 동작하므로
 * RLS(can_edit_trip)가 그대로 적용된다. 남의 트립은 애초에 조회조차 안 된다.
 *
 * `trips.snapshot`(1차 데이터, 변경 없음)을 읽어 정규화 테이블
 * (trip_days/itinerary_items/legs/expenses)을 **멱등하게 완전히 재계산**한다 —
 * 매번 해당 trip_id의 파생 행을 지우고 새로 만든다. `bookings` 테이블은 Document
 * AI 파이프라인(parse-booking)의 소유이므로 이 함수는 절대 건드리지 않는다.
 *
 * 호출 지점: src/shared/api/tripService.ts의 saveTrip() 성공 직후
 * (fire-and-forget) — 실제 트립을 만지는 모든 클라이언트 경로가 결국
 * saveTrip()을 거치므로 이 한 곳만으로 M5 "dual-write"를 만족한다.
 */
import { createClient } from '@supabase/supabase-js';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';
import tzlookup from 'tz-lookup';
import { getDayCity } from '../../../src/features/plan/dayCities.ts';
import { syncMealItemsIntoDay, MEAL_META } from '../../../src/features/plan/map/meals.ts';
import { haversineKm } from '../../../src/features/plan/map/geo.ts';
import { dayIndexForDate } from '../../../src/features/documents/commitBooking.ts';
import type {
  PlaceItem,
  HotelsData,
  MealsData,
  ExpensesData,
  DayCitiesData,
  FlightsData,
  FlightInfo,
} from '../../../src/features/plan/types.ts';

// 완벽한 역지오코딩은 스코프 밖 — trip.city/"City, Country" 문자열의 국가 부분만
// 흔한 나라 위주로 매핑한다. 매칭 안 되면 null(스펙상 nullable).
const COUNTRY_ISO: Record<string, string> = {
  JAPAN: 'JP',
  KOREA: 'KR',
  'SOUTH KOREA': 'KR',
  'REPUBLIC OF KOREA': 'KR',
  'UNITED STATES': 'US',
  USA: 'US',
  'UNITED STATES OF AMERICA': 'US',
  CHINA: 'CN',
  TAIWAN: 'TW',
  THAILAND: 'TH',
  VIETNAM: 'VN',
  'UNITED KINGDOM': 'GB',
  UK: 'GB',
  FRANCE: 'FR',
  ITALY: 'IT',
  SPAIN: 'ES',
  GERMANY: 'DE',
  NETHERLANDS: 'NL',
  SWITZERLAND: 'CH',
  AUSTRIA: 'AT',
  AUSTRALIA: 'AU',
  CANADA: 'CA',
  SINGAPORE: 'SG',
  MALAYSIA: 'MY',
  INDONESIA: 'ID',
  PHILIPPINES: 'PH',
  'HONG KONG': 'HK',
  MACAU: 'MO',
  MACAO: 'MO',
  PORTUGAL: 'PT',
  GREECE: 'GR',
  TURKEY: 'TR',
  'UNITED ARAB EMIRATES': 'AE',
};

function countryCodeFromCityString(cityString: string | null | undefined): string | null {
  if (!cityString) return null;
  const parts = cityString.split(',');
  const country = parts[parts.length - 1]?.trim().toUpperCase();
  return (country && COUNTRY_ISO[country]) || null;
}

function corsHeaders(origin: string | null) {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (origin) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Vary', 'Origin');
  }
  headers.set('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type');
  headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  return headers;
}

function jsonResponse(body: unknown, status: number, headers: Headers) {
  return new Response(JSON.stringify(body), { status, headers });
}

type ItemKind = 'place' | 'meal' | 'lodging' | 'flight';

interface TaggedItem {
  source: PlaceItem;
  kind: ItemKind;
  subtitle?: string | null;
}

Deno.serve(async (req) => {
  const headers = corsHeaders(req.headers.get('origin'));
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method Not Allowed' }, 405, headers);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonResponse({ error: '인증이 필요합니다.' }, 401, headers);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) return jsonResponse({ error: '인증이 유효하지 않습니다.' }, 401, headers);

  let body: { tripId?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: '잘못된 요청입니다.' }, 400, headers);
  }
  if (!body.tripId) return jsonResponse({ error: 'tripId가 필요합니다.' }, 400, headers);

  const { data: trip, error: tripErr } = await userClient
    .from('trips')
    .select('id, start_date, end_date, base_currency, city, city_lat, city_lng, snapshot')
    .eq('id', body.tripId)
    .single();
  if (tripErr || !trip) return jsonResponse({ error: '여행을 찾을 수 없습니다.' }, 404, headers);
  if (!trip.start_date || !trip.end_date) {
    return jsonResponse({ error: '여행 기간이 설정되지 않았습니다.' }, 400, headers);
  }

  try {
    const totalDays = differenceInCalendarDays(parseISO(trip.end_date), parseISO(trip.start_date)) + 1;
    const snap = (trip.snapshot ?? {}) as {
      data?: Record<number, PlaceItem[]>;
      hotels?: HotelsData;
      meals?: MealsData;
      expenses?: ExpensesData;
      dayCities?: DayCitiesData;
      flights?: FlightsData;
    };
    const dataByDay = snap.data ?? {};
    const hotels: HotelsData = snap.hotels ?? {};
    const meals: MealsData = snap.meals ?? {};
    const expensesData: ExpensesData = snap.expenses ?? {};
    const dayCities: DayCitiesData = snap.dayCities ?? {};
    const flights: FlightsData = snap.flights ?? { outbound: null, return: null };

    const tripCityRef = { name: trip.city, lat: trip.city_lat, lng: trip.city_lng };

    // 출발일 기준으로 항공편을 해당 일차에 배정 (04-document-ai.md dayIndexForDate 재사용)
    const flightsByDay = new Map<number, FlightInfo[]>();
    for (const flight of [flights.outbound, flights.return]) {
      if (!flight) continue;
      const idx = dayIndexForDate(flight.date, trip.start_date, totalDays);
      if (idx == null) continue;
      const list = flightsByDay.get(idx) ?? [];
      list.push(flight);
      flightsByDay.set(idx, list);
    }

    interface DayRow {
      day_index: number;
      date: string;
      city_name: string | null;
      city_lat: number | null;
      city_lng: number | null;
      timezone: string | null;
      countryCode: string | null;
    }
    const dayRows: DayRow[] = [];
    const itemsByDayIndex = new Map<number, TaggedItem[]>();

    for (let day = 1; day <= totalDays; day++) {
      const dayDate = new Date(parseISO(trip.start_date).getTime() + (day - 1) * 86_400_000);
      const dateStr = dayDate.toISOString().slice(0, 10);
      const city = getDayCity(day, dayCities, tripCityRef);

      let timezone: string | null = null;
      if (city.lat != null && city.lng != null) {
        try {
          timezone = tzlookup(city.lat, city.lng);
        } catch {
          timezone = null;
        }
      }
      const countryCode = countryCodeFromCityString(city.name);

      dayRows.push({
        day_index: day,
        date: dateStr,
        city_name: city.name || null,
        city_lat: city.lat,
        city_lng: city.lng,
        timezone,
        countryCode,
      });

      const placesAndMeals = syncMealItemsIntoDay(dataByDay[day] ?? [], meals[day] ?? {});
      const tagged: TaggedItem[] = placesAndMeals.map((item) => ({
        source: item,
        kind: item.mealType ? 'meal' : 'place',
        subtitle: item.mealType ? MEAL_META[item.mealType].label : null,
      }));

      for (const flight of flightsByDay.get(day) ?? []) {
        tagged.push({
          source: {
            name: flight.flightNo,
            lat: flight.dep.lat ?? 0,
            lng: flight.dep.lng ?? 0,
            time: flight.dep.time,
          } as PlaceItem,
          kind: 'flight',
          subtitle: `${flight.dep.iata} → ${flight.arr.iata}`,
        });
      }

      // 시간순 정렬(없으면 맨 뒤) — syncMealItemsIntoDay와 동일한 비교 규칙
      tagged.sort((a, b) => (a.source.time || '99:99').localeCompare(b.source.time || '99:99'));

      // 호텔은 항상 그 날 맨 앞(§6.2)
      const hotel = hotels[day];
      if (hotel && hotel.name) {
        tagged.unshift({
          source: { name: hotel.name, address: hotel.address, lat: hotel.lat, lng: hotel.lng } as PlaceItem,
          kind: 'lodging',
        });
      }

      itemsByDayIndex.set(day, tagged);
    }

    // ── 멱등 재동기화: 기존 파생 행 삭제 (bookings는 손대지 않음) ──────────────
    await userClient.from('expenses').delete().eq('trip_id', trip.id);
    const { error: deleteDaysErr } = await userClient.from('trip_days').delete().eq('trip_id', trip.id);
    if (deleteDaysErr) throw deleteDaysErr;

    if (totalDays <= 0) {
      return jsonResponse({ tripId: trip.id, dayCount: 0, itemCount: 0, legCount: 0, expenseCount: 0 }, 200, headers);
    }

    const { data: insertedDays, error: daysErr } = await userClient
      .from('trip_days')
      .insert(
        dayRows.map((d) => ({
          trip_id: trip.id,
          day_index: d.day_index,
          date: d.date,
          city_name: d.city_name,
          city_lat: d.city_lat,
          city_lng: d.city_lng,
          timezone: d.timezone,
        })),
      )
      .select('id, day_index');
    if (daysErr) throw daysErr;

    const dayIdByIndex = new Map<number, string>(insertedDays!.map((d) => [d.day_index, d.id]));
    const dayMetaByIndex = new Map<number, DayRow>(dayRows.map((d) => [d.day_index, d]));

    const itemRows: Record<string, unknown>[] = [];
    for (const [dayIndex, tagged] of itemsByDayIndex.entries()) {
      const dayId = dayIdByIndex.get(dayIndex)!;
      const meta = dayMetaByIndex.get(dayIndex)!;
      tagged.forEach((t, position) => {
        const hasCoords = t.source.lat != null && t.source.lng != null;
        const startLocal = t.source.time ? `${meta.date}T${t.source.time}` : null;
        let startAt: string | null = null;
        if (startLocal && meta.timezone) {
          try {
            startAt = fromZonedTime(startLocal, meta.timezone).toISOString();
          } catch {
            startAt = null;
          }
        }
        itemRows.push({
          trip_id: trip.id,
          day_id: dayId,
          position,
          type: hasCoords ? t.kind : 'note',
          title: t.source.name,
          subtitle: t.subtitle ?? null,
          category: t.source.category ?? null,
          google_place_id: t.source.placeId ?? null,
          lat: hasCoords ? t.source.lat : null,
          lng: hasCoords ? t.source.lng : null,
          address: t.source.address || null,
          country_code: meta.countryCode,
          start_local: startLocal,
          timezone: meta.timezone,
          start_at: startAt,
          memo: t.source.memo || null,
          created_by: user.id,
        });
      });
    }

    let insertedItems: { id: string; day_id: string; position: number; lat: number | null; lng: number | null }[] = [];
    if (itemRows.length > 0) {
      const { data: itemsData, error: itemsErr } = await userClient
        .from('itinerary_items')
        .insert(itemRows)
        .select('id, day_id, position, lat, lng');
      if (itemsErr) throw itemsErr;
      insertedItems = itemsData!;
    }

    // ── legs: 같은 날짜 안에서 연속된 두 항목의 대권거리(haversine) 추정치 ──────
    const byDayId = new Map<string, typeof insertedItems>();
    for (const it of insertedItems) {
      const arr = byDayId.get(it.day_id) ?? [];
      arr.push(it);
      byDayId.set(it.day_id, arr);
    }
    const legRows: Record<string, unknown>[] = [];
    for (const arr of byDayId.values()) {
      arr.sort((a, b) => a.position - b.position);
      for (let i = 0; i < arr.length - 1; i++) {
        const from = arr[i];
        const to = arr[i + 1];
        if (from.lat == null || from.lng == null || to.lat == null || to.lng == null) continue;
        const km = haversineKm(from.lat, from.lng, to.lat, to.lng);
        legRows.push({
          trip_id: trip.id,
          from_item_id: from.id,
          to_item_id: to.id,
          mode: 'unknown',
          distance_m: Math.round(km * 1000),
          duration_s: null,
          is_estimate: true,
          provider: 'haversine',
        });
      }
    }
    if (legRows.length > 0) {
      const { error: legsErr } = await userClient.from('legs').insert(legRows);
      if (legsErr) throw legsErr;
    }

    // ── expenses ────────────────────────────────────────────────────────────
    const expenseRows: Record<string, unknown>[] = [];
    for (let day = 1; day <= totalDays; day++) {
      const dayId = dayIdByIndex.get(day)!;
      for (const exp of expensesData[day] ?? []) {
        expenseRows.push({
          trip_id: trip.id,
          day_id: dayId,
          category: 'other',
          description: exp.desc,
          amount: exp.amount,
          currency: trip.base_currency ?? 'KRW',
        });
      }
    }
    if (expenseRows.length > 0) {
      const { error: expErr } = await userClient.from('expenses').insert(expenseRows);
      if (expErr) throw expErr;
    }

    return jsonResponse(
      {
        tripId: trip.id,
        dayCount: dayRows.length,
        itemCount: insertedItems.length,
        legCount: legRows.length,
        expenseCount: expenseRows.length,
      },
      200,
      headers,
    );
  } catch (err) {
    console.error('[sync-trip-normalized] failed:', err instanceof Error ? err.message : err);
    return jsonResponse({ error: '정규화 테이블 동기화에 실패했습니다.' }, 500, headers);
  }
});
