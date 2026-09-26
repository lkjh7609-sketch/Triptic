/**
 * 식사 슬롯 동기화 로직 (index.html에서 이식 — ADR-001)
 * 원본: index.html syncMealItemsIntoList (2026-09-20 기준 라인 6067~6094)의 알고리즘을
 * 그대로 옮겼다 — 전역 변수(plannerData, mealsData, currentDay) 의존만 인자로 바꿨다.
 */
import type { DayMeals, MealSlot, PlaceItem } from '../types.ts';

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

/**
 * 그 날의 일정 목록에서 식사 슬롯 항목을 mealsData 기준으로 다시 생성해 끼워 넣는다.
 * 건너뛰지 않고 이름이 있는 슬롯만 시간순 위치에 삽입한다 (원본과 동일한 알고리즘).
 */
export function syncMealItemsIntoDay(dayItems: PlaceItem[], dayMeals: DayMeals): PlaceItem[] {
  const next = dayItems.filter((item) => !item.mealType);

  (Object.keys(MEAL_META) as MealSlot[]).forEach((slot) => {
    const info = dayMeals[slot];
    if (info && info.name && !info.skip) {
      const newMeal: PlaceItem = {
        name: info.name,
        address: info.address || '',
        lat: info.lat ?? 0,
        lng: info.lng ?? 0,
        time: MEAL_META[slot].time,
        memo: '',
        mealType: slot,
      };

      const insertIdx = next.findIndex((item) => (item.time || '00:00') > newMeal.time!);
      if (insertIdx === -1) {
        next.push(newMeal);
      } else {
        next.splice(insertIdx, 0, newMeal);
      }
    }
  });

  return next;
}
