import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WeatherIcon } from './weatherIcon';

function iconClass(code: number | null | undefined) {
  const { container } = render(<WeatherIcon code={code} />);
  return container.querySelector('svg')?.getAttribute('class') ?? '';
}

describe('WeatherIcon', () => {
  it('날씨 코드마다 다른 아이콘', () => {
    expect(iconClass(0)).toContain('lucide-sun');
    expect(iconClass(2)).toContain('lucide-cloud-sun');
    expect(iconClass(45)).toContain('lucide-cloud-fog');
    expect(iconClass(53)).toContain('lucide-cloud-drizzle');
    expect(iconClass(63)).toContain('lucide-cloud-rain');
    expect(iconClass(73)).toContain('lucide-snowflake');
    expect(iconClass(95)).toContain('lucide-cloud-lightning');
  });

  it('코드가 없으면 구름', () => {
    expect(iconClass(null)).toContain('lucide-cloud');
    expect(iconClass(undefined)).toContain('lucide-cloud');
  });
});
