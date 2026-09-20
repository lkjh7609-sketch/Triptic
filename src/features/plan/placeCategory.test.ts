import { describe, it, expect } from 'vitest';
import { inferPlaceCategory } from './placeCategory';

describe('inferPlaceCategory', () => {
  it('lodging → 숙소', () => {
    expect(inferPlaceCategory(['lodging', 'point_of_interest'])).toBe('lodging');
  });

  it('restaurant → 식당', () => {
    expect(inferPlaceCategory(['restaurant', 'food', 'point_of_interest'])).toBe('restaurant');
  });

  it('cafe → 카페 (restaurant보다 우선 매칭되어야 함)', () => {
    expect(inferPlaceCategory(['cafe', 'food'])).toBe('cafe');
  });

  it('tourist_attraction → 관광', () => {
    expect(inferPlaceCategory(['tourist_attraction', 'point_of_interest', 'establishment'])).toBe('sight');
  });

  it('transit_station → 교통', () => {
    expect(inferPlaceCategory(['transit_station', 'train_station'])).toBe('transport');
  });

  it('shopping_mall → 쇼핑', () => {
    expect(inferPlaceCategory(['shopping_mall'])).toBe('shopping');
  });

  it('일치하는 타입이 없으면 other', () => {
    expect(inferPlaceCategory(['establishment', 'point_of_interest'])).toBe('other');
  });

  it('types가 없으면 other', () => {
    expect(inferPlaceCategory(undefined)).toBe('other');
    expect(inferPlaceCategory(null)).toBe('other');
    expect(inferPlaceCategory([])).toBe('other');
  });
});
