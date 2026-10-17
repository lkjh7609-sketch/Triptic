import { describe, expect, it } from 'vitest';
import { placeByTime } from './itemOrder';
import type { PlaceItem } from './types';

const p = (name: string, time?: string): PlaceItem => ({ key: name, name, lat: 0, lng: 0, time }) as PlaceItem;
const names = (items: PlaceItem[]) => items.map((i) => i.name);

describe('placeByTime — 시각을 정한 항목을 그 시각 자리로', () => {
  const day = [p('성', '12:00'), p('전망대', '14:00'), p('호텔')];

  it('더 이른 시각으로 바꾸면 앞으로, 늦은 시각이면 뒤로(시각 없는 호텔은 끝에 그대로)', () => {
    expect(names(placeByTime([...day.slice(0, 1), { ...day[1], time: '11:00' }, day[2]], 1))).toEqual(['전망대', '성', '호텔']);
    expect(names(placeByTime([{ ...day[0], time: '15:00' }, day[1], day[2]], 0))).toEqual(['전망대', '성', '호텔']);
  });

  it('새로 추가(맨 끝)한 12:00 장소는 14:00 앞으로', () => {
    const added = [...day, p('시장', '12:00')];
    expect(names(placeByTime(added, 3))).toEqual(['성', '시장', '전망대', '호텔']);
  });

  it('같은 시각이면 기존 항목 뒤, 맨 이른 시각이면 시각 있는 첫 항목 앞', () => {
    expect(names(placeByTime([...day, p('카페', '14:00')], 3))).toEqual(['성', '전망대', '카페', '호텔']);
    expect(names(placeByTime([p('메모'), ...day, p('아침', '08:00')], 4))).toEqual(['메모', '아침', '성', '전망대', '호텔']);
  });

  it('시각이 없거나 다른 항목에 시각이 없으면 그대로', () => {
    const noTime = [...day, p('추가')];
    expect(placeByTime(noTime, 3)).toBe(noTime);
    const alone = [p('a'), p('b', '10:00')];
    expect(placeByTime(alone, 1)).toBe(alone);
  });
});
