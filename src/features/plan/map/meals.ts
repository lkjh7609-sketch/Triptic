/**
 * 식사 슬롯 동기화 로직 (index.html에서 이식 — ADR-001)
 * 원본: index.html syncMealItemsIntoList (2026-09-20 기준 라인 6067~6094)의 알고리즘을
 * 그대로 옮겼다 — 전역 변수(plannerData, mealsData, currentDay) 의존만 인자로 바꿨다.
 */
import type { DayMeals, MealSlot, MealSlotInfo, PlaceItem } from '../types.ts';

/**
 * label은 화면 표시용이 아니라 legacy 데이터 호환용이다 — 예전 앱이 식사 항목 이름/메모에
 * '아침'·'점심'·'저녁'을 그대로 저장해서 itineraryTransform이 이 문자열로 슬롯을 역추적한다.
 * 화면·PDF의 식사 이름은 plan:meals.* 번역 키를 쓴다.
 */
export const MEAL_META: Record<MealSlot, { label: string; time: string }> = {
  breakfast: { label: '아침', time: '08:00' }, // i18n-exempt: legacy 데이터 키
  lunch: { label: '점심', time: '12:30' }, // i18n-exempt: legacy 데이터 키
  dinner: { label: '저녁', time: '18:30' }, // i18n-exempt: legacy 데이터 키
};

type MealPlaceLike = { name?: string; lat?: number; lng?: number; placeId?: string | null };

const NEAR_DEG = 0.0015; // 위도·경도 약 150m

function hasCoord(p: { lat?: number; lng?: number }): boolean {
  return typeof p.lat === 'number' && typeof p.lng === 'number' && !(p.lat === 0 && p.lng === 0);
}

/** 같은 장소인가 — placeId가 둘 다 있으면 그것으로, 없으면 이름이 같고 좌표가 가까울 때(좌표를 모르면 이름만) */
export function isSamePlace(a: MealPlaceLike, b: MealPlaceLike): boolean {
  if (a.placeId && b.placeId) return a.placeId === b.placeId;
  const an = (a.name ?? '').replace(/\s+/g, '').toLowerCase();
  const bn = (b.name ?? '').replace(/\s+/g, '').toLowerCase();
  if (!an || an !== bn) return false;
  if (hasCoord(a) && hasCoord(b)) return Math.abs(a.lat! - b.lat!) < NEAR_DEG && Math.abs(a.lng! - b.lng!) < NEAR_DEG;
  return true;
}

/** 이 슬롯에 지금 지정된 식당(건너뛰기·빈 칸이면 null) */
function filled(info: MealSlotInfo | undefined): MealSlotInfo | null {
  return info && !info.skip && info.name ? info : null;
}

/** 이 날 일정에 이미 있는 같은 장소(식사 표시가 아직 없는 항목)의 위치 */
function findExistingIndex(dayItems: PlaceItem[], info: MealSlotInfo): number {
  return dayItems.findIndex((item) => !item.mealType && isSamePlace(item, info));
}

/** 방문 시간을 새로 물어야 하는 슬롯 — 새로 정했거나 바꾼 식당이고, 아래 일정에 아직 없는 것만 (이미 있으면 묻지 않는다) */
export function slotsNeedingTime(dayItems: PlaceItem[], before: DayMeals, after: DayMeals): MealSlot[] {
  return (Object.keys(MEAL_META) as MealSlot[]).filter((slot) => {
    const next = filled(after[slot]);
    if (!next) return false;
    const prev = filled(before[slot]);
    if (prev && isSamePlace(prev, next)) return false;
    return findExistingIndex(dayItems, next) === -1;
  });
}

function insertByTime(items: PlaceItem[], item: PlaceItem): void {
  const idx = items.findIndex((it) => (it.time || '00:00') > (item.time || '00:00'));
  if (idx === -1) items.push(item);
  else items.splice(idx, 0, item);
}

/**
 * 식사 슬롯 저장 결과를 그 날 일정에 맞춘다(일정 ↔ 식사 두 방향 연동의 "식사 → 일정" 쪽).
 * - 바뀌지 않은 슬롯은 건드리지 않는다(사용자가 고친 시간·순서·메모가 그대로 남는다).
 * - 바뀐 슬롯은 예전 식사 항목을 빼고, 새 식당이 이미 일정에 있으면 그 항목에 식사 표시만 붙이고(시간 묻지 않음),
 *   없으면 times[슬롯](없으면 기본 시각)에 새 항목으로 시간순 삽입한다.
 * - 건너뛰기·비우기는 그 슬롯의 식사 항목을 일정에서 뺀다.
 */
export function applyMealChanges(
  dayItems: PlaceItem[],
  before: DayMeals,
  after: DayMeals,
  times: Partial<Record<MealSlot, string>> = {},
): PlaceItem[] {
  let next = dayItems.slice();
  (Object.keys(MEAL_META) as MealSlot[]).forEach((slot) => {
    const prev = filled(before[slot]);
    const cur = filled(after[slot]);
    // 바뀌지 않은 슬롯 — 일정에 항목이 없더라도(예전에 일정에서 지운 것) 되살리지 않는다
    if (prev && cur && isSamePlace(prev, cur)) return;
    if (!prev && !cur && !next.some((it) => it.mealType === slot)) return;

    next = next.filter((it) => it.mealType !== slot);
    if (!cur) return;

    const existing = findExistingIndex(next, cur);
    if (existing !== -1) {
      next[existing] = { ...next[existing], mealType: slot };
      return;
    }
    insertByTime(next, {
      name: cur.name!,
      address: cur.address || '',
      lat: cur.lat ?? 0,
      lng: cur.lng ?? 0,
      placeId: cur.placeId ?? null,
      time: times[slot] || MEAL_META[slot].time,
      memo: '',
      mealType: slot,
      category: 'restaurant',
    });
  });
  return next;
}

/** 일정에서 식사 항목을 지웠을 때 — 그 슬롯을 비운 식사 목록(1/3 숫자가 같이 줄어든다) */
export function clearMealSlot(meals: DayMeals, slot: MealSlot): DayMeals {
  const rest = { ...meals };
  delete rest[slot];
  return rest;
}
