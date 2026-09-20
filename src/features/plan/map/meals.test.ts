import { describe, it, expect } from 'vitest';
import { syncMealItemsIntoDay } from './meals';
import type { DayMeals, PlaceItem } from '../types';

const lunch: DayMeals = {
  lunch: { skip: false, name: '라멘 타카하시', address: '', lat: 35.7, lng: 139.7 },
};

describe('syncMealItemsIntoDay', () => {
  it('건너뛰지 않고 이름이 있는 슬롯을 시간순 위치에 삽입한다', () => {
    const dayItems: PlaceItem[] = [
      { name: '아사쿠사', lat: 0, lng: 0, time: '09:00' },
      { name: '우에노 공원', lat: 0, lng: 0, time: '15:00' },
    ];
    const next = syncMealItemsIntoDay(dayItems, lunch);
    expect(next.map((i) => i.name)).toEqual(['아사쿠사', '라멘 타카하시', '우에노 공원']);
    expect(next[1].mealType).toBe('lunch');
  });

  it('건너뛴 슬롯은 삽입하지 않는다', () => {
    const skipped: DayMeals = { breakfast: { skip: true } };
    const next = syncMealItemsIntoDay([], skipped);
    expect(next).toEqual([]);
  });

  it('기존 식사 항목을 새 mealsData 기준으로 교체한다(중복 누적 방지)', () => {
    const dayItems: PlaceItem[] = [
      { name: '이전 점심집', lat: 0, lng: 0, time: '12:30', mealType: 'lunch' },
    ];
    const next = syncMealItemsIntoDay(dayItems, lunch);
    expect(next).toHaveLength(1);
    expect(next[0].name).toBe('라멘 타카하시');
  });

  it('이름이 없는 슬롯은 삽입하지 않는다', () => {
    const empty: DayMeals = { dinner: { skip: false } };
    expect(syncMealItemsIntoDay([], empty)).toEqual([]);
  });
});
