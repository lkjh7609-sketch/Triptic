import { Suspense } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import '@/shared/i18n';
import { WorldSection } from './StatsSections';
import type { TravelStats } from './statsCompute';

function stats(countries: { code: string; trips: number }[]): TravelStats {
  return {
    visited: [],
    countries,
    countryCount: countries.length,
    countryPercentOfWorld: 1,
    continents: [{ key: 'AS', trips: 3, percent: 100 }],
    unknownPlaces: 0,
  } as unknown as TravelStats;
}

// stats 번역은 비동기로 불러오므로 Suspense 안에서 그려지길 기다린다
async function renderSection(countries: { code: string; trips: number }[]) {
  render(
    <Suspense fallback={null}>
      <WorldSection stats={stats(countries)} />
    </Suspense>,
  );
  await screen.findByText('다녀온 곳');
}

describe('WorldSection — 다녀온 나라 팝업', () => {
  it('나라 칩은 지도 아래에 늘어놓지 않고, 버튼을 눌러야 팝업으로 모아 보인다', async () => {
    await renderSection([
      { code: 'JP', trips: 2 },
      { code: 'KR', trips: 1 },
    ]);
    expect(screen.queryByText(/일본 · /)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '다녀온 나라 2곳 보기' }));
    const dialog = screen.getByRole('dialog', { name: '다녀온 나라' });
    expect(within(dialog).getByText(/일본 · 2번/)).toBeInTheDocument();
    expect(within(dialog).getByText(/대한민국 · 1번/)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: '닫기' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('대륙별 비율은 그대로 보인다', async () => {
    await renderSection([{ code: 'JP', trips: 2 }]);
    expect(screen.getByText('대륙별 비율')).toBeInTheDocument();
  });

  it('다녀온 나라가 없으면 버튼이 없다', async () => {
    await renderSection([]);
    expect(screen.queryByRole('button', { name: /다녀온 나라/ })).not.toBeInTheDocument();
  });
});
