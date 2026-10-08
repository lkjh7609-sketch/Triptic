import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { format } from 'date-fns';
import '@/shared/i18n';
import { TripWeatherChip } from './TripWeatherChip';

// useProfile이 Supabase 클라이언트를 불러오는데 CI에는 환경변수가 없다 — 단위는 기본값 C로 고정
vi.mock('@/shared/hooks/useTempUnit', () => ({ useTempUnit: () => 'C' }));

const ymd = (offsetDays: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return format(d, 'yyyy-MM-dd');
};

function renderChip(trip: Parameters<typeof TripWeatherChip>[0]['trip']) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TripWeatherChip trip={trip} />
    </QueryClientProvider>,
  );
}

function stubWeather(daily: unknown[], ok = true) {
  const fetchMock = vi.fn(async () => ({ ok, status: ok ? 200 : 503, json: async () => ({ daily }) }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('TripWeatherChip — 여행 카드의 출발일 날씨', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('출발일의 최저/최고 기온을 보여준다', async () => {
    const start = ymd(5);
    stubWeather([
      { date: ymd(4), tempMinC: 1, tempMaxC: 2, conditionCode: 'Clear', precipChance: 0, source: 'forecast' },
      { date: start, tempMinC: 10.3, tempMaxC: 18.6, conditionCode: 'Drizzle', precipChance: 0.4, source: 'forecast' },
    ]);
    renderChip({ city_lat: -33.87, city_lng: 151.21, start_date: start, end_date: ymd(8) });
    expect(await screen.findByText(/10°\/19°/)).toBeInTheDocument();
  });

  it('이미 출발한 여행은 오늘 날씨를 보여준다', async () => {
    stubWeather([
      { date: ymd(0), tempMinC: 20, tempMaxC: 28, conditionCode: 'Clear', precipChance: 0, source: 'forecast' },
      { date: ymd(-2), tempMinC: 1, tempMaxC: 2, conditionCode: 'Clear', precipChance: 0, source: 'forecast' },
    ]);
    renderChip({ city_lat: 35.68, city_lng: 139.76, start_date: ymd(-2), end_date: ymd(3) });
    expect(await screen.findByText(/20°\/28°/)).toBeInTheDocument();
  });

  it('평년값이면 평년 배지가 붙는다', async () => {
    const start = ymd(30);
    stubWeather([{ date: start, tempMinC: 5, tempMaxC: 12, conditionCode: null, precipChance: null, source: 'climate_normal' }]);
    renderChip({ city_lat: 37.5, city_lng: 127, start_date: start, end_date: ymd(33) });
    expect(await screen.findByText('평년')).toBeInTheDocument();
  });

  it('서버가 실패하면 아무것도 그리지 않는다', async () => {
    const fetchMock = stubWeather([], false);
    const { container } = renderChip({ city_lat: 35.68, city_lng: 139.76, start_date: ymd(5), end_date: ymd(8) });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('도시 좌표나 날짜가 없으면 요청도 하지 않고 숨는다', () => {
    const fetchMock = stubWeather([]);
    const { container } = renderChip({ city_lat: null, city_lng: null, start_date: ymd(5), end_date: ymd(8) });
    expect(container).toBeEmptyDOMElement();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
