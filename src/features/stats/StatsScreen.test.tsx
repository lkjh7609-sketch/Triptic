import { Suspense } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import '@/shared/i18n';

vi.mock('@/shared/monitoring', () => ({ trackScreenView: () => {}, captureError: () => {} }));
vi.mock('@/shared/hooks/useSession', () => ({ useSession: () => ({ user: null }) }));
vi.mock('@/shared/hooks/useProfile', () => ({ useProfile: () => ({ data: null }) }));
vi.mock('@/features/plan/hooks/useTripMembers', () => ({ useTripMembers: () => ({ data: undefined }) }));
vi.mock('./StatsSections', () => ({
  BadgesSection: () => null,
  CompanionsSection: () => null,
  ExpenseSection: () => null,
  HabitsSection: () => null,
  SummaryStrip: () => null,
  TripsSection: () => null,
  WorldSection: () => null,
}));

const stats = vi.hoisted(() => ({ value: null as unknown }));
vi.mock('./useTravelStats', () => ({ useTravelStats: () => ({ stats: stats.value, isLoading: false, isError: false, refetch: () => {} }) }));

import { StatsScreen } from './StatsScreen';

const baseStats = { pastCount: 0, upcomingCount: 0, trips: [], badges: [] };

// 번역(stats 네임스페이스)을 비동기로 불러오므로 Suspense 안에서 그려지길 기다린다
const renderScreen = () =>
  render(
    <MemoryRouter>
      <Suspense fallback={null}>
        <StatsScreen />
      </Suspense>
    </MemoryRouter>,
  );

describe('통계 탭 — 다녀온 여행이 없을 때 안내 배너', () => {
  it('제목과 설명, 내 여행 보러 가기 버튼을 보여 주고, 예정된 여행이 있어도 건수 문구는 붙이지 않는다(2026-10-09 사용자 결정)', async () => {
    stats.value = { ...baseStats, upcomingCount: 1 };
    renderScreen();
    const banner = await screen.findByRole('status');
    expect(banner).toHaveTextContent('아직 다녀온 여행이 없어요');
    expect(banner).toHaveTextContent('여행이 끝나면 여기에 통계가 쌓여요. 종료일이 지난 여행부터 센답니다.');
    expect(banner.textContent).not.toMatch(/예정된 여행/);
    expect(screen.getByRole('link', { name: '내 여행 보러 가기' })).toHaveAttribute('href', '/plan');
  });

  it('다녀온 여행이 있으면 안내 배너가 없다', async () => {
    stats.value = { ...baseStats, pastCount: 2 };
    renderScreen();
    // 제목이 그려진 뒤(번역 로드 완료)에 배너가 없는지 본다
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('status')).toBeNull();
  });
});
