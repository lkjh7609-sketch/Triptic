import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { isDesktop, session, board } = vi.hoisted(() => ({
  isDesktop: { value: false },
  session: { user: null as null | { id: string } },
  board: { data: undefined as unknown },
}));
vi.mock('../airport/useAirportBoard', () => ({
  useAirportBoard: () => ({ data: board.data, isLoading: false }),
  useKstMinutes: () => 600,
  useNowMs: () => Date.now(),
}));
vi.mock('@/shared/hooks/useMediaQuery', () => ({ useMediaQuery: () => isDesktop.value }));
vi.mock('@/shared/hooks/useSession', () => ({
  useSession: () => ({ user: session.user, loading: false }),
}));
vi.mock('@/shared/hooks/useTempUnit', () => ({ useTempUnit: () => 'C' }));
vi.mock('@/shared/hooks/useCityImage', () => ({ useCityImage: () => '/city.jpg' }));
vi.mock('@/features/plan/hooks/useTrips', () => ({
  useTrips: () => ({ data: [], isLoading: false }),
  useTripSummaries: () => ({ data: {} }),
}));
vi.mock('@/features/plan/hooks/useTripMembers', () => ({
  useTripMembers: () => ({ data: {} }),
  initialsOf: (name: string | null) => (name ?? '?').slice(0, 1),
}));
vi.mock('@/features/community/hooks/usePosts', () => ({
  usePopularPosts: () => ({ data: [], isLoading: false }),
}));
vi.mock('@/features/community/hooks/useCompanionPosts', () => ({
  useCompanionPostsFeed: () => ({ data: { pages: [] }, isLoading: false }),
}));
vi.mock('../flightDealsData', async () => ({
  ...(await vi.importActual<typeof import('../flightDealsData')>('../flightDealsData')),
  useFlightDeals: () => ({ data: [], isLoading: false }),
}));
vi.mock('./seasonService', () => ({
  useSeasonPicks: () => ({
    data: [{ id: 'd-kyoto', slug: 'kyoto', country: 'JP', lat: 35, lng: 135, cover: null, featured: true, stat: [24, 14, 120], kind: 'pleasant', name: '교토', nameEn: 'Kyoto' }],
  }),
}));
vi.mock('@/features/weather/destinationWeather', () => ({
  useDestinationWeathers: () => ({ data: { 'd-kyoto': { destinationId: 'd-kyoto', date: '2026-10-08', tmaxC: 24, tminC: 16, conditionCode: 'Clear', precipChance: 0.1, updatedAt: new Date().toISOString() } } }),
}));
vi.mock('../cityDescription', async () => ({
  ...(await vi.importActual<typeof import('../cityDescription')>('../cityDescription')),
  readCachedCityDescriptions: async () => ({}),
}));
vi.mock('@/features/settings/FeedbackModal', () => ({ FeedbackModal: () => null }));

import { HomePage } from './HomePage';

function renderHome() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function headings() {
  return screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
}

beforeEach(() => {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
  session.user = null;
  board.data = undefined;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('HomePage — 시안(Stitch) 구성', () => {
  it('모바일: 캡슐 탭 → 내 일정 → 지금 가기 좋은 여행지 → 같이 갈 사람 → 인기 여행기 → 이렇게 써요 순서, 큰 히어로·시작 배너 없음', () => {
    isDesktop.value = false;
    renderHome();
    expect(screen.getByRole('button', { name: '항공' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
    expect(headings()).toEqual([
      '내 일정 & 추천 샘플',
      '지금 가기 좋은 여행지',
      '같이 갈 사람 찾기',
      '인기 여행기',
      '트립틱 이렇게 써요',
    ]);
    expect(screen.queryByText('지금 바로 다음 여행을 계획해 보세요')).not.toBeInTheDocument();
  });

  it('인천공항 전광판은 홈에 없다 — 맨 위 메뉴 "공항"으로 옮겼다(PC·모바일)', () => {
    board.data = {
      departures: [],
      arrivals: [],
      fetchedAt: new Date().toISOString(),
      stale: false,
    };
    isDesktop.value = false;
    const mobile = renderHome();
    expect(headings()).not.toContain('인천공항 실시간 출·도착');
    mobile.unmount();
    isDesktop.value = true;
    renderHome();
    expect(headings()).not.toContain('인천공항 실시간 출·도착');
  });

  it('모바일: 오늘 날씨(최저/최고)는 사진 위가 아니라 도시 이름·배지 아래 글자 줄로(날씨 아이콘과 함께)', () => {
    isDesktop.value = false;
    renderHome();
    const temp = screen.getByText('16°/24°');
    expect(temp.className).toMatch(/circleWeather/);
    expect(temp.querySelector('svg')).not.toBeNull();
    // 사진(동그라미) 안에는 기온 글자가 없다
    expect(temp.closest('[class*="circleMedia"]')).toBeNull();
    // 배지는 그 달 기후로 고른다 — 평균 최고 24°는 '쾌적한 날씨'
    expect(screen.getByText('쾌적한 날씨')).toBeInTheDocument();
  });

  it('모바일: 캡슐 탭은 처음엔 아무것도 채워지지 않는다', () => {
    isDesktop.value = false;
    renderHome();
    for (const name of ['항공', '호텔', '투어·액티비티']) {
      expect(screen.getByRole('button', { name }).className).not.toMatch(/tabOn/);
    }
  });

  it('PC: 히어로 제목과 섹션 순서(내 일정 → 인기 여행기 → 지금 가기 좋은 여행지 → 같이 갈 사람 → 이렇게 써요 → 시작 배너)', () => {
    isDesktop.value = true;
    renderHome();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      '예약서 한 장으로 완성되는 여행의 모든 순간',
    );
    expect(headings()).toEqual([
      '내 일정 & 추천 샘플',
      '인기 여행기 (최근 30일 추천)',
      '지금 가기 좋은 여행지',
      '같이 갈 사람 찾기',
      '트립틱 이렇게 써요',
      '지금 바로 다음 여행을 계획해 보세요',
    ]);
  });

  it('데이터가 없으면 지어내지 않고 빈 상태 카드를 보여준다', () => {
    isDesktop.value = true;
    renderHome();
    expect(screen.getByText('아직 예정된 여행이 없어요')).toBeInTheDocument();
    expect(screen.getByText('아직 인기 여행기가 없어요')).toBeInTheDocument();
    expect(screen.getByText('아직 모집 중인 동행이 없어요')).toBeInTheDocument();
  });

  it('로그인한 사람에게는 하단 시작 배너가 보이지 않는다', () => {
    isDesktop.value = true;
    session.user = { id: 'u1' };
    renderHome();
    expect(screen.queryByText('지금 바로 다음 여행을 계획해 보세요')).not.toBeInTheDocument();
  });

  it('푸터: 이용약관·개인정보처리방침·고객센터·제휴문의', () => {
    isDesktop.value = true;
    renderHome();
    for (const name of ['이용약관', '개인정보처리방침', '고객센터', '제휴문의']) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
  });
});
