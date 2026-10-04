import { describe, it, expect } from 'vitest';
import { applyMealChanges, clearMealSlot, isSamePlace, slotsNeedingTime } from './meals';
import type { DayMeals, PlaceItem } from '../types';

const ramen = { skip: false, name: '라멘 타카하시', address: '', lat: 35.7, lng: 139.7, placeId: 'p-ramen' };
const lunch: DayMeals = { lunch: ramen };

const day = (): PlaceItem[] => [
  { name: '아사쿠사', lat: 35.71, lng: 139.79, time: '09:00' },
  { name: '우에노 공원', lat: 35.71, lng: 139.77, time: '15:00' },
];

describe('isSamePlace', () => {
  it('placeId가 둘 다 있으면 그것으로 가른다', () => {
    expect(isSamePlace({ name: 'A', placeId: 'x' }, { name: 'B', placeId: 'x' })).toBe(true);
    expect(isSamePlace({ name: 'A', placeId: 'x' }, { name: 'A', placeId: 'y' })).toBe(false);
  });
  it('placeId가 없으면 이름이 같고 좌표가 가까울 때(공백·대소문자 무시)', () => {
    expect(isSamePlace({ name: '라멘 타카하시', lat: 35.7, lng: 139.7 }, { name: '라멘타카하시', lat: 35.7004, lng: 139.7004 })).toBe(true);
    expect(isSamePlace({ name: '라멘', lat: 35.7, lng: 139.7 }, { name: '라멘', lat: 35.8, lng: 139.7 })).toBe(false);
    expect(isSamePlace({ name: '라멘', lat: 0, lng: 0 }, { name: '라멘', lat: 35.8, lng: 139.7 })).toBe(true);
  });
});

describe('slotsNeedingTime — 새로 정한 식당만 시간을 묻는다', () => {
  it('새로 지정한 슬롯은 묻는다', () => {
    expect(slotsNeedingTime(day(), {}, lunch)).toEqual(['lunch']);
  });
  it('이미 같은 식당으로 지정돼 있으면 묻지 않는다', () => {
    expect(slotsNeedingTime(day(), lunch, lunch)).toEqual([]);
  });
  it('식당을 바꾸면 다시 묻는다', () => {
    expect(slotsNeedingTime(day(), lunch, { lunch: { ...ramen, name: '다른 집', placeId: 'p2' } })).toEqual(['lunch']);
  });
  it('아래 일정에 이미 있는 장소면 묻지 않는다', () => {
    const items = [...day(), { name: '라멘 타카하시', lat: 35.7, lng: 139.7, placeId: 'p-ramen', time: '12:00' }];
    expect(slotsNeedingTime(items, {}, lunch)).toEqual([]);
  });
  it('건너뛰기·비움은 묻지 않는다', () => {
    expect(slotsNeedingTime(day(), lunch, { lunch: { skip: true } })).toEqual([]);
  });
});

describe('applyMealChanges', () => {
  it('고른 시간에 식사 표시를 달아 시간순으로 넣는다', () => {
    const next = applyMealChanges(day(), {}, lunch, { lunch: '13:00' });
    expect(next.map((i) => i.name)).toEqual(['아사쿠사', '라멘 타카하시', '우에노 공원']);
    expect(next[1]).toMatchObject({ mealType: 'lunch', time: '13:00', category: 'restaurant', placeId: 'p-ramen' });
  });

  it('시간을 안 주면 기본 시각', () => {
    expect(applyMealChanges([], {}, lunch)[0].time).toBe('12:30');
  });

  it('이미 일정에 있는 식당은 새로 넣지 않고 그 항목에 식사 표시만 붙인다(시간 유지)', () => {
    const items = [...day(), { name: '라멘 타카하시', lat: 35.7, lng: 139.7, placeId: 'p-ramen', time: '16:00' }];
    const next = applyMealChanges(items, {}, lunch, {});
    expect(next).toHaveLength(3);
    expect(next[2]).toMatchObject({ name: '라멘 타카하시', time: '16:00', mealType: 'lunch' });
  });

  it('식당을 바꾸면 예전 식사 항목은 빠지고 새 항목이 들어간다(중복 누적 없음)', () => {
    const first = applyMealChanges(day(), {}, lunch, { lunch: '12:00' });
    const changed: DayMeals = { lunch: { skip: false, name: '다른 집', lat: 35.6, lng: 139.6, placeId: 'p2' } };
    const next = applyMealChanges(first, lunch, changed, { lunch: '12:45' });
    expect(next.filter((i) => i.mealType === 'lunch')).toHaveLength(1);
    expect(next.find((i) => i.mealType === 'lunch')).toMatchObject({ name: '다른 집', time: '12:45' });
  });

  it('바뀌지 않은 슬롯은 그대로 둔다 — 사용자가 고친 시간이 남는다', () => {
    const first = applyMealChanges(day(), {}, lunch, { lunch: '12:00' });
    first.find((i) => i.mealType === 'lunch')!.time = '14:10';
    const next = applyMealChanges(first, lunch, lunch);
    expect(next.find((i) => i.mealType === 'lunch')!.time).toBe('14:10');
  });

  it('건너뛰기·비우기는 그 식사 항목을 일정에서 뺀다', () => {
    const first = applyMealChanges(day(), {}, lunch, { lunch: '12:00' });
    expect(applyMealChanges(first, lunch, { lunch: { skip: true } }).some((i) => i.mealType)).toBe(false);
    expect(applyMealChanges(first, lunch, {}).some((i) => i.mealType)).toBe(false);
  });

  it('일정에 이미 없는 식사 슬롯이 바뀌지 않았으면 되살리지 않는다', () => {
    expect(applyMealChanges(day(), lunch, lunch)).toEqual(day());
  });
});

describe('clearMealSlot', () => {
  it('그 슬롯만 지운다', () => {
    const meals: DayMeals = { ...lunch, dinner: { skip: false, name: '스시' } };
    expect(clearMealSlot(meals, 'lunch')).toEqual({ dinner: { skip: false, name: '스시' } });
  });
});
