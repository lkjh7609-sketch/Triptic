/**
 * get_trip_itinerary_raw() RPC 결과를 예전 trips.snapshot이 갖던 모양
 * ({data, hotels, meals, expenses, flights, dayCities})으로 되돌린다.
 * `supabase/functions/trip-itinerary-write/index.ts`의 변환과 정확히
 * 역대칭이어야 한다(ADR-002 M7 준비, docs/specs/03-data-model.md §6.2).
 *
 * 알려진 손실(둘 다 스펙 §6.2가 요구하지 않는, 의도적으로 받아들인 한계):
 * - 식사 슬롯의 "건너뛰기(skip)" 상태는 복원되지 않는다(건너뛴 슬롯은 애초에
 *   itinerary_items에 행이 없다 — syncMealItemsIntoDay 자체가 skip과
 *   미설정을 구분하지 않는다).
 * - 좌표 없이 방어적으로 보존된 `type='note'` 항목은 편집 모델(PlaceItem은
 *   좌표 필수)에 자리가 없어 재구성 대상에서 제외한다(DB에는 그대로 남음).
 */
import { MEAL_META } from './map/meals';
import type { PlaceCategory } from './placeCategory';
import type {
  DayCitiesData,
  DayMeals,
  ExpenseCategory,
  ExpenseItem,
  ExpensePaymentMethod,
  ExpensesData,
  FlightInfo,
  FlightsData,
  HotelsData,
  MealSlot,
  MealsData,
  PlaceItem,
  PlannerData,
} from './types';

export interface TripDayRow {
  id: string;
  day_index: number;
  city_name: string | null;
  city_lat: number | null;
  city_lng: number | null;
}

export interface ItineraryItemRow {
  day_id: string;
  position: number;
  type: string;
  title: string;
  subtitle: string | null;
  category: string | null;
  google_place_id: string | null;
  lat: number | null;
  lng: number | null;
  address: string | null;
  start_local: string | null;
  memo: string | null;
  extra: unknown;
}

export interface ExpenseRow {
  day_id: string | null;
  category: string | null;
  description: string;
  amount: number;
  currency: string;
  fx_rate_to_base: number | null;
  payment_method: string | null;
}

export interface TripItineraryRaw {
  days: TripDayRow[];
  items: ItineraryItemRow[];
  expenses: ExpenseRow[];
}

export interface ReconstructedTripContent {
  data: PlannerData;
  hotels: HotelsData;
  meals: MealsData;
  expenses: ExpensesData;
  flights: FlightsData;
  dayCities: DayCitiesData;
}

const MEAL_LABEL_TO_SLOT: Record<string, MealSlot> = Object.fromEntries(
  (Object.keys(MEAL_META) as MealSlot[]).map((slot) => [MEAL_META[slot].label, slot]),
);

function extractTime(startLocal: string | null): string | undefined {
  if (!startLocal) return undefined;
  const idx = startLocal.indexOf('T');
  return idx === -1 ? undefined : startLocal.slice(idx + 1);
}

export function reconstructTripContent(
  raw: TripItineraryRaw,
  tripCity: { name: string | null; lat: number | null; lng: number | null },
): ReconstructedTripContent {
  const dayIndexById = new Map(raw.days.map((d) => [d.id, d.day_index]));

  const data: PlannerData = {};
  const hotels: HotelsData = {};
  const meals: MealsData = {};
  const flights: FlightsData = { outbound: null, return: null };

  for (const day of raw.days) data[day.day_index] = data[day.day_index] ?? [];

  for (const item of raw.items) {
    const dayIndex = dayIndexById.get(item.day_id);
    if (dayIndex == null) continue;

    if (item.type === 'lodging') {
      hotels[dayIndex] = {
        name: item.title,
        address: item.address ?? undefined,
        lat: item.lat ?? 0,
        lng: item.lng ?? 0,
      };
      continue;
    }

    if (item.type === 'flight') {
      const extra = item.extra as { leg?: 'outbound' | 'return'; flight?: FlightInfo } | null;
      if (extra?.leg && extra.flight) flights[extra.leg] = extra.flight;
      continue;
    }

    if (item.type === 'note') continue;

    const placeItem: PlaceItem = {
      name: item.title,
      address: item.address ?? undefined,
      lat: item.lat ?? 0,
      lng: item.lng ?? 0,
      time: extractTime(item.start_local),
      memo: item.memo ?? undefined,
      placeId: item.google_place_id ?? undefined,
      category: (item.category as PlaceCategory | null) ?? undefined,
    };

    if (item.type === 'meal') {
      const slot = item.subtitle ? MEAL_LABEL_TO_SLOT[item.subtitle] : undefined;
      if (slot) {
        placeItem.mealType = slot;
        const dayMeals: DayMeals = meals[dayIndex] ?? {};
        dayMeals[slot] = {
          skip: false,
          name: item.title,
          address: item.address ?? undefined,
          lat: item.lat ?? undefined,
          lng: item.lng ?? undefined,
        };
        meals[dayIndex] = dayMeals;
      }
    }

    data[dayIndex].push(placeItem);
  }

  const dayCities: DayCitiesData = {};
  for (const day of raw.days) {
    if (day.city_name && day.city_name !== tripCity.name) {
      dayCities[day.day_index] = { name: day.city_name, lat: day.city_lat, lng: day.city_lng };
    }
  }

  const expenses: ExpensesData = {};
  for (const exp of raw.expenses) {
    if (exp.day_id == null) continue;
    const dayIndex = dayIndexById.get(exp.day_id);
    if (dayIndex == null) continue;
    const item: ExpenseItem = {
      desc: exp.description,
      amount: Number(exp.amount),
      currency: exp.currency,
      category: (exp.category as ExpenseCategory | null) ?? undefined,
      paymentMethod: (exp.payment_method as ExpensePaymentMethod | null) ?? undefined,
      fxRateToBase: exp.fx_rate_to_base != null ? Number(exp.fx_rate_to_base) : undefined,
    };
    expenses[dayIndex] = expenses[dayIndex] ?? [];
    expenses[dayIndex].push(item);
  }

  return { data, hotels, meals, expenses, flights, dayCities };
}
