import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@/shared/i18n';

const state = vi.hoisted(() => ({ data: undefined as unknown, desktop: true }));
vi.mock('./useAirportBoard', () => ({
  useAirportBoard: () => ({ data: state.data, isLoading: false }),
  useKstMinutes: () => 600,
  useNowMs: () => Date.now(),
}));
vi.mock('@/shared/hooks/useMediaQuery', () => ({ useMediaQuery: () => state.desktop }));
vi.mock('@/shared/hooks/useSession', () => ({ useSession: () => ({ user: null, loading: false }) }));

import { AirportScreen } from './AirportScreen';

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AirportScreen />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  state.desktop = true;
  state.data = {
    departures: [],
    arrivals: [],
    fetchedAt: new Date().toISOString(),
    stale: false,
  };
});

describe('AirportScreen — 공항 메뉴', () => {
  it('공항 칸은 인천국제공항·대구·김해·제주 순이고, 처음엔 인천이 골라져 인천 전광판이 보인다', () => {
    renderScreen();
    const tabs = screen.getAllByRole('button').filter((b) => ['인천국제공항', '대구', '김해', '제주'].includes(b.textContent ?? ''));
    expect(tabs.map((b) => b.textContent)).toEqual(['인천국제공항', '대구', '김해', '제주']);
    expect(screen.getByRole('button', { name: '인천국제공항' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('heading', { level: 2, name: '인천공항 실시간 출·도착' })).toBeInTheDocument();
  });

  it('대구·김해·제주를 누르면 준비 중 안내가 나오고, 인천을 다시 누르면 전광판이 돌아온다', () => {
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: '김해' }));
    expect(screen.getByRole('button', { name: '김해' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('heading', { level: 2, name: '김해국제공항 실시간 출·도착은 준비 중이에요' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '인천공항 실시간 출·도착' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '인천국제공항' }));
    expect(screen.getByRole('heading', { level: 2, name: '인천공항 실시간 출·도착' })).toBeInTheDocument();
  });

  it('인천 데이터를 못 받았으면 빈 화면 대신 안내 문장을 보여 준다(모바일도 같은 구성)', () => {
    state.data = undefined;
    state.desktop = false;
    renderScreen();
    expect(screen.getByText('전광판 정보를 아직 받지 못했어요. 잠시 뒤 다시 확인해 주세요.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '제주' })).toBeInTheDocument();
  });
});
