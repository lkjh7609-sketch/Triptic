import { describe, it, expect, vi } from 'vitest';
import * as monitoring from '@/shared/monitoring';
import { mapConditionCode, weatherIcon } from './conditionMap';

describe('mapConditionCode', () => {
  it('알려진 WeatherKit 코드를 9종 내부 코드로 압축한다', () => {
    expect(mapConditionCode('MostlyClear')).toBe('clear');
    expect(mapConditionCode('PartlyCloudy')).toBe('partly_cloudy');
    expect(mapConditionCode('HeavyRain')).toBe('rain');
    expect(mapConditionCode('Thunderstorm')).toBe('thunderstorm');
    expect(mapConditionCode('Blizzard')).toBe('snow');
    expect(mapConditionCode('Windy')).toBe('wind');
  });

  it('매핑에 없는 코드는 unknown으로 처리하고 경고를 보낸다', () => {
    const spy = vi.spyOn(monitoring, 'captureError').mockImplementation(() => {});
    expect(mapConditionCode('SomeNewAppleCode')).toBe('unknown');
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});

describe('weatherIcon', () => {
  it('React 엘리먼트를 반환한다', () => {
    expect(weatherIcon('clear', true)).toBeDefined();
    expect(weatherIcon('clear', false)).toBeDefined();
    expect(weatherIcon('partly_cloudy', true)).toBeDefined();
    expect(weatherIcon('partly_cloudy', false)).toBeDefined();
  });
});
