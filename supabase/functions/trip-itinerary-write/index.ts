/**
 * Supabase Edge Function: trip-itinerary-write (ADR-002 M7 준비, 구 sync-trip-normalized)
 *
 * POST { tripId, data, hotels, meals, expenses, flights, dayCities }
 * Authorization: 호출한 사용자의 세션 JWT — userClient로만 동작하므로
 * RLS(can_edit_trip)가 그대로 적용된다. 남의 트립은 애초에 쓰기가 안 된다.
 *
 * 예전엔 trips.snapshot(1차 데이터)을 읽어 정규화 테이블을 파생 프로젝션으로
 * fire-and-forget 재계산했지만(sync-trip-normalized), 지금은 **정규화
 * 테이블이 1차 데이터**다 — 요청 본문으로 받은 콘텐츠(예전에 snapshot에
 * 저장하던 것과 정확히 같은 모양)를 replace_trip_itinerary() RPC 한 번으로
 * trip_days/itinerary_items/legs/expenses에 원자적으로 반영한다. `bookings`
 * 테이블은 Document AI 파이프라인 소유이므로 여전히 건드리지 않는다.
 *
 * 호출 지점: src/shared/api/tripService.ts / src/services/supabaseService.js의
 * saveTrip() — 둘 다 이 함수를 await로 호출하고 실패 시 에러를 전파한다
 * (예전 fire-and-forget과 달리 이제 이 함수가 실패하면 저장 자체가 실패한다).
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
  extra?: Record<string, unknown> | null;
}

interface RequestBody {
  tripId?: string;
  data?: Record<number, PlaceItem[]>;
  hotels?: HotelsData;
  meals?: MealsData;
  expenses?: ExpensesData;
  flights?: FlightsData;
  dayCities?: DayCitiesData;
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

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: '잘못된 요청입니다.' }, 400, headers);
  }
  if (!body.tripId) return jsonResponse({ error: 'tripId가 필요합니다.' }, 400, headers);

  const { data: trip, error: tripErr } = await userClient
    .from('trips')
    .select('id, start_date, end_date, base_currency, city, city_lat, city_lng')
    .eq('id', body.tripId)
    .single();
  if (tripErr || !trip) return jsonResponse({ error: '여행을 찾을 수 없습니다.' }, 404, headers);
  if (!trip.start_date || !trip.end_date) {
    return jsonResponse({ error: '여행 기간이 설정되지 않았습니다.' }, 400, headers);
  }

  try {
    const totalDays = differenceInCalendarDays(parseISO(trip.end_date), parseISO(trip.start_date)) + 1;
    const dataByDay = body.data ?? {};
    const hotels: HotelsData = body.hotels ?? {};
    const meals: MealsData = body.meals ?? {};
    const expensesData: ExpensesData = body.expenses ?? {};
    const dayCities: DayCitiesData = body.dayCities ?? {};
    const flights: FlightsData = body.flights ?? { outbound: null, return: null };

    const tripCityRef = { name: trip.city, lat: trip.city_lat, lng: trip.city_lng };

    // 출발일 기준으로 항공편을 해당 일차에 배정 (04-document-ai.md dayIndexForDate 재사용)
    // leg를 같이 들고 다니는 이유: 읽기 재구성 시 outbound/return을 추측 없이
    // extra.leg만 보고 정확히 복원하기 위해서(itinerary_readwrite.ts 참고).
    const flightsByDay = new Map<number, { leg: 'outbound' | 'return'; flight: FlightInfo }[]>();
    (['outbound', 'return'] as const).forEach((leg) => {
      const flight = flights[leg];
      if (!flight) return;
      const idx = dayIndexForDate(flight.date, trip.start_date, totalDays);
      if (idx == null) return;
      const list = flightsByDay.get(idx) ?? [];
      list.push({ leg, flight });
      flightsByDay.set(idx, list);
    });

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

      for (const { leg, flight } of flightsByDay.get(day) ?? []) {
        tagged.push({
          source: {
            name: flight.flightNo,
            lat: flight.dep.lat ?? 0,
            lng: flight.dep.lng ?? 0,
            time: flight.dep.time,
          } as PlaceItem,
          kind: 'flight',
          subtitle: `${flight.dep.iata} → ${flight.arr.iata}`,
          // FlightInfo 원본 전체를 그대로 보존 — 구조화 컬럼(도착 좌표 등)에
          // 자리가 없는 필드까지 포함해 읽기 재구성이 outbound/return을
          // 무손실로 복원하도록 한다(leg는 추측 없이 바로 판정하기 위한 태그).
          extra: { leg, flight },
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

    // ── RPC 페이로드 구성 (실제 DB 반영은 replace_trip_itinerary 한 번으로 원자화) ──
    const daysPayload = dayRows.map((d) => ({
      day_index: d.day_index,
      date: d.date,
      city_name: d.city_name,
      city_lat: d.city_lat,
      city_lng: d.city_lng,
      timezone: d.timezone,
    }));

    const itemsPayload: Record<string, unknown>[] = [];
    const legsPayload: Record<string, unknown>[] = [];
    const dayMetaByIndex = new Map<number, DayRow>(dayRows.map((d) => [d.day_index, d]));

    for (const [dayIndex, tagged] of itemsByDayIndex.entries()) {
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
        itemsPayload.push({
          day_index: dayIndex,
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
          extra: t.extra ?? null,
        });
      });

      // legs: 같은 날짜 안에서 좌표가 있는 연속 항목 사이의 대권거리(haversine) 추정치
      for (let i = 0; i < tagged.length - 1; i++) {
        const from = tagged[i].source;
        const to = tagged[i + 1].source;
        if (from.lat == null || from.lng == null || to.lat == null || to.lng == null) continue;
        const km = haversineKm(from.lat, from.lng, to.lat, to.lng);
        legsPayload.push({
          day_index: dayIndex,
          from_position: i,
          to_position: i + 1,
          mode: 'unknown',
          distance_m: Math.round(km * 1000),
          duration_s: null,
          is_estimate: true,
          provider: 'haversine',
        });
      }
    }

    const baseCurrency = trip.base_currency ?? 'KRW';
    const expensesPayload: Record<string, unknown>[] = [];
    for (let day = 1; day <= totalDays; day++) {
      for (const exp of expensesData[day] ?? []) {
        const expCurrency = exp.currency ?? baseCurrency;
        expensesPayload.push({
          day_index: day,
          category: exp.category ?? 'other',
          description: exp.desc,
          amount: exp.amount,
          currency: expCurrency,
          fx_rate_to_base: expCurrency !== baseCurrency ? (exp.fxRateToBase ?? null) : null,
          payment_method: exp.paymentMethod ?? null,
        });
      }
    }

    const { error: rpcErr } = await userClient.rpc('replace_trip_itinerary', {
      p_trip_id: trip.id,
      p_days: daysPayload,
      p_items: itemsPayload,
      p_legs: legsPayload,
      p_expenses: expensesPayload,
    });
    if (rpcErr) throw rpcErr;

    return jsonResponse(
      {
        tripId: trip.id,
        dayCount: daysPayload.length,
        itemCount: itemsPayload.length,
        legCount: legsPayload.length,
        expenseCount: expensesPayload.length,
      },
      200,
      headers,
    );
  } catch (err) {
    console.error('[trip-itinerary-write] failed:', err instanceof Error ? err.message : err);
    return jsonResponse({ error: '일정 저장에 실패했습니다.' }, 500, headers);
  }
});
