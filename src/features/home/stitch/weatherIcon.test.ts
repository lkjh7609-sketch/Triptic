import { Cloud, CloudFog, CloudLightning, CloudRain, CloudSun, Snowflake, Sun } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { weatherIcon } from './weatherIcon';

describe('weatherIcon', () => {
  it('날씨 코드를 아이콘으로', () => {
    expect(weatherIcon(0)).toBe(Sun);
    expect(weatherIcon(2)).toBe(CloudSun);
    expect(weatherIcon(3)).toBe(Cloud);
    expect(weatherIcon(45)).toBe(CloudFog);
    expect(weatherIcon(63)).toBe(CloudRain);
    expect(weatherIcon(73)).toBe(Snowflake);
    expect(weatherIcon(95)).toBe(CloudLightning);
  });

  it('코드가 없거나 모르면 구름', () => {
    expect(weatherIcon(null)).toBe(Cloud);
    expect(weatherIcon(1234)).toBe(CloudLightning); // 95 이상은 천둥 계열
    expect(weatherIcon(undefined)).toBe(Cloud);
  });
});
