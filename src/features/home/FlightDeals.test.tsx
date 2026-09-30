import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@/shared/i18n';
import { FlightDeals } from './FlightDeals';
import { FlightThemes } from './FlightThemes';

const future = (offsetDays: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};

const deals = [
  { code: 'KIX', city: '오사카', airport: '간사이 국제공항', theme: 'japan', price: 214800, currency: 'KRW', departDate: future(20), returnDate: future(24), airline: '7C', airlineName: '제주항공', average: 300000, discountPct: 28 },
  { code: 'DAD', city: '다낭', airport: '다낭 국제공항', theme: 'sea', price: 298500, currency: 'KRW', departDate: future(30), returnDate: future(34), airline: null, airlineName: null, average: null, discountPct: null },
];

function renderWith(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('항공 특가·테마', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('특가 카드 — 도시·항공사·가격·할인율, 그리고 실시간이 아니라는 안내', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ items: deals }) })));
    renderWith(<FlightDeals />);
    expect(await screen.findByText('오사카')).toBeInTheDocument();
    expect(screen.getByText('제주항공')).toBeInTheDocument();
    expect(screen.getByText('214,800원~')).toBeInTheDocument();
    expect(screen.getByText('평균보다 28% 저렴')).toBeInTheDocument();
    expect(screen.getByText('왕복 최저가')).toBeInTheDocument();
    expect(screen.getByText(/실시간이 아니라/)).toBeInTheDocument();
  });

  it('특가를 못 받으면 구역이 통째로 숨는다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) })));
    const { container } = renderWith(<FlightDeals />);
    // 훅이 한 번 재시도(1초)한 뒤 실패로 확정되면 숨는다
    await vi.waitFor(() => expect(container.querySelector('section')).toBeNull(), { timeout: 5000 });
  });

  it('테마 카드 — 테마마다 가장 싼 도시, 데이터가 없는 테마는 안 나온다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ items: deals }) })));
    renderWith(<FlightThemes />);
    expect(await screen.findByText('가까운 일본')).toBeInTheDocument();
    expect(screen.getByText('아시아 휴양')).toBeInTheDocument();
    expect(screen.queryByText('유럽·미주·호주')).not.toBeInTheDocument();
    expect(screen.getByText('왕복 최저 214,800원~ · 제주항공')).toBeInTheDocument();
  });
});
