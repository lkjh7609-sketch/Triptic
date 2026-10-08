import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@/shared/i18n';
import i18n from '@/shared/i18n';
import { DestinationChannelScreen } from './DestinationChannelScreen';
import type { Destination, DestinationGuide } from './types';

const KL: Destination = {
  id: 'kl',
  slug: 'kualalumpur',
  name: '쿠알라룸푸르',
  nameEn: 'Kuala Lumpur',
  country_code: 'MY',
  lat: 3.14,
  lng: 101.69,
  timezone: 'Asia/Kuala_Lumpur',
  currency: 'MYR',
  cover_url: null,
  is_featured: true,
  sort_order: 1,
  post_count: 428,
};

const GUIDE: DestinationGuide = {
  destination_id: 'kl',
  landmarks: [
    { ko: '페트로나스 트윈 타워', en: 'Petronas Twin Towers' },
    { ko: '바투 동굴', en: 'Batu Caves' },
  ],
  trip_length: { ko: '3박 4일', en: '3 nights' },
  best_season: { ko: '5월~9월(건기)', en: 'May–Sep (dry season)' },
  prices: [
    { key: 'coffee', min: 11, max: null },
    { key: 'taxi', min: 8, max: 14 },
    { key: 'meal', label: { ko: '나시르막 한 끼', en: 'Nasi lemak' }, min: 6, max: 10 },
  ],
};

const state = vi.hoisted(() => ({
  destination: undefined as unknown,
  guide: undefined as unknown,
  fx: undefined as unknown,
  postsArgs: [] as unknown[],
  companionsArgs: [] as unknown[],
  pinned: null as unknown,
  popularTags: [] as unknown[],
  posts: [] as unknown[],
}));

vi.mock('./hooks/useDestinations', () => ({
  useDestination: () => ({
    data: state.destination,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));
vi.mock('./hooks/useCommunitySafety', () => ({
  useFollowedDestinationIds: () => ({ data: [] }),
  useToggleFollow: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('@/features/weather/destinationWeather', () => ({
  useDestinationWeather: () => ({ destinationId: 'd1', date: '2026-10-08', tmaxC: 29.4, tminC: 24.2, conditionCode: 'Clear', precipChance: 0.1, updatedAt: new Date().toISOString() }),
}));
vi.mock('./hooks/useDestinationChannel', () => ({
  useDestinationGuide: () => ({ data: state.guide }),
  useDestinationFollowerCount: () => ({ data: 1248 }),
  useUrgentCompanions: () => ({ data: [] }),
  usePinnedPost: () => ({ data: state.pinned }),
  usePopularTags: () => ({ data: state.popularTags }),
  useChannelPosts: (args: unknown) => {
    state.postsArgs.push(args);
    return {
      data: { pages: [{ posts: state.posts }] },
      isLoading: false,
      isError: false,
      hasNextPage: false,
    };
  },
  useChannelCompanions: (args: unknown) => {
    state.companionsArgs.push(args);
    return {
      data: { pages: [{ posts: [] }] },
      isLoading: false,
      isError: false,
      hasNextPage: false,
    };
  },
}));
// 카드 자체는 따로 시험한다 — 여기서는 화면이 카드를 어떻게 이어 붙이는지만 본다
vi.mock('./channel/ChannelPostCard', () => ({
  ChannelPostCard: ({
    post,
    onTagClick,
  }: {
    post: { id: string; tags: string[] };
    onTagClick: (t: string) => void;
  }) => (
    <div data-testid="post-card">
      {post.id}
      {post.tags.map((tag) => (
        <button key={tag} type="button" onClick={() => onTagClick(tag)}>
          #{tag}
        </button>
      ))}
    </div>
  ),
}));
vi.mock('./channel/ChannelPinnedCard', () => ({
  ChannelPinnedCard: ({ post }: { post: { id: string } }) => (
    <div data-testid="pinned-card">{post.id}</div>
  ),
}));
vi.mock('@/features/plan/useFxRates', () => ({ useFxRates: () => ({ data: state.fx }) }));
vi.mock('@/shared/hooks/useSession', () => ({ useSession: () => ({ user: null }) }));
vi.mock('@/shared/hooks/useTempUnit', () => ({ useTempUnit: () => 'C' }));
vi.mock('@/features/auth/loginPrompt', () => ({ useRequireLogin: () => () => true }));

function renderScreen() {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/community/d/kualalumpur']}>
        <Routes>
          <Route path="/community/d/:slug" element={<DestinationChannelScreen />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(async () => {
  vi.useFakeTimers();
  Element.prototype.scrollIntoView = vi.fn(); // jsdom에는 없다
  state.destination = KL;
  state.guide = GUIDE;
  state.fx = { perUsd: { USD: 1, MYR: 4.5, KRW: 1405.8 }, newestAt: null };
  state.postsArgs = [];
  state.companionsArgs = [];
  state.pinned = null;
  state.popularTags = [];
  state.posts = [];
  await i18n.changeLanguage('ko');
});
afterEach(() => {
  vi.useRealTimers();
});

describe('DestinationChannelScreen', () => {
  it('영문 이름을 크게, 현재 언어 이름을 작게 보여주고 팔로워·스토리·환율·날씨 줄을 그린다', () => {
    renderScreen();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Kuala Lumpur');
    expect(screen.getAllByText('쿠알라룸푸르').length).toBeGreaterThan(0);
    expect(screen.getByText(/팔로워 1,248명/)).toBeInTheDocument();
    expect(screen.getByText(/스토리 428개/)).toBeInTheDocument();
    expect(screen.getByText(/1 MYR ≈ 312\.\d KRW/)).toBeInTheDocument();
    expect(screen.getByText(/오늘 24°\/29° 맑음/)).toBeInTheDocument();
  });

  it('대표 사진이 있으면 머리말 뒤에 깔고, 없으면 깔지 않는다', () => {
    const { unmount } = renderScreen();
    expect(screen.queryByTestId('channel-cover')).not.toBeInTheDocument();
    unmount();
    state.destination = { ...KL, cover_url: 'https://example.com/kl.webp' };
    renderScreen();
    expect(screen.getByTestId('channel-cover')).toHaveStyle({
      backgroundImage: 'url("https://example.com/kl.webp")',
    });
  });

  it('브레드크럼은 전체 목록과 대륙 탭으로 이어진다', () => {
    renderScreen();
    expect(screen.getByRole('link', { name: /전체 도시 목록/ })).toHaveAttribute(
      'href',
      '/community',
    );
    expect(screen.getByRole('link', { name: '아시아' })).toHaveAttribute(
      'href',
      '/community?continent=AS',
    );
  });

  it('일정 카드에 추천 기간·최적 시기·한국 기준 시차가 나온다', () => {
    renderScreen();
    expect(screen.getByText('3박 4일')).toBeInTheDocument();
    expect(screen.getByText('5월~9월(건기)')).toBeInTheDocument();
    expect(screen.getByText('한국보다 1시간 느림')).toBeInTheDocument();
  });

  it('물가 예시는 현지 금액과 원화 어림값을 함께 보여준다', () => {
    renderScreen();
    expect(screen.getByText('8~14 MYR')).toBeInTheDocument();
    expect(screen.getByText('나시르막 한 끼')).toBeInTheDocument();
    expect(screen.getByText('실시간 환율 계산기')).toBeInTheDocument();
  });

  it('환율 테이블에 없는 통화 도시는 환율 줄·계산기를 숨기고 현지 금액 물가만 둔다', () => {
    state.destination = { ...KL, currency: 'BRL' };
    renderScreen();
    expect(screen.queryByText(/KRW$/)).not.toBeInTheDocument();
    expect(screen.queryByText('실시간 환율 계산기')).not.toBeInTheDocument();
    expect(screen.getByText('8~14 BRL')).toBeInTheDocument();
  });

  it('내용이 아직 없는 도시는 대표 명소·일정 칸을 숨긴다', () => {
    state.guide = null;
    renderScreen();
    expect(screen.queryByText('대표 명소')).not.toBeInTheDocument();
    expect(screen.queryByText('추천 여행 기간')).not.toBeInTheDocument();
    expect(screen.getByText('한국보다 1시간 느림')).toBeInTheDocument();
  });

  it('대표 명소를 누르면 그 이름으로 이 도시 글을 검색한다(입력이 잠깐 멈추면 조회)', () => {
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: '"바투 동굴" 글 찾기' }));
    expect(screen.getByRole('searchbox')).toHaveValue('바투 동굴');
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(state.postsArgs.at(-1)).toMatchObject({
      destinationId: 'kl',
      search: '바투 동굴',
      sort: 'latest',
    });
  });

  it('동행 탭에서는 정렬이 최신순·출발 임박순이고 인기·댓글순은 없다', () => {
    renderScreen();
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      '최신순',
      '인기순',
      '댓글순',
    ]);
    fireEvent.click(screen.getByRole('button', { name: '동행 구하기' }));
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      '최신순',
      '출발 임박순',
    ]);
  });

  it('영어일 때는 이름이 같으면 하나만, 일정 문구는 영어 쪽을 쓴다', async () => {
    await i18n.changeLanguage('en');
    state.destination = { ...KL, name: 'Kuala Lumpur' };
    renderScreen();
    expect(screen.getAllByText('Kuala Lumpur')).toHaveLength(2); // 제목 + 브레드크럼
    expect(screen.getByText('3 nights')).toBeInTheDocument();
    expect(screen.getByText('1h behind Korea')).toBeInTheDocument();
  });

  it('분류 탭은 전체·여행기·Q&A·동행·꿀팁·맛집 순이고, 누르면 그 분류로 글을 조회한다', () => {
    renderScreen();
    const tabs = screen.getByRole('group', { name: '글 분류' });
    expect(Array.from(tabs.querySelectorAll('button')).map((b) => b.textContent)).toEqual([
      '전체',
      '여행기·후기',
      '질문·Q&A',
      '동행 구하기',
      '여행 꿀팁·환전',
      '로컬 맛집·숙소',
    ]);
    expect(state.postsArgs.at(-1)).toMatchObject({ category: undefined });
    fireEvent.click(screen.getByRole('button', { name: '질문·Q&A' }));
    expect(state.postsArgs.at(-1)).toMatchObject({ category: 'qna' });
    fireEvent.click(screen.getByRole('button', { name: '전체' }));
    expect(state.postsArgs.at(-1)).toMatchObject({ category: undefined });
  });

  it('고정 글(공식 가이드)은 모든 탭에서 맨 위에 보인다', () => {
    state.pinned = { id: 'pin1', tags: [] };
    renderScreen();
    expect(screen.getByTestId('pinned-card')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '질문·Q&A' }));
    expect(screen.getByTestId('pinned-card')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '동행 구하기' }));
    expect(screen.getByTestId('pinned-card')).toBeInTheDocument();
  });

  it('고정 글이 없으면 카드를 그리지 않는다', () => {
    renderScreen();
    expect(screen.queryByTestId('pinned-card')).not.toBeInTheDocument();
  });

  it('카드의 태그를 누르면 그 태그로 조회하고 필터 표시가 뜨며, 지우면 풀린다', () => {
    state.posts = [{ id: 'p1', tags: ['바투동굴'] }];
    renderScreen();
    fireEvent.click(
      within(screen.getByTestId('post-card')).getByRole('button', { name: '#바투동굴' }),
    );
    expect(state.postsArgs.at(-1)).toMatchObject({ tag: '바투동굴' });
    expect(screen.getByText('#바투동굴 글만 보는 중')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '태그 필터 지우기' }));
    expect(state.postsArgs.at(-1)).toMatchObject({ tag: undefined });
  });

  it('인기 태그 카드는 태그가 있을 때만 나오고, 누르면 그 태그로 조회한다', () => {
    renderScreen();
    expect(screen.queryByText('쿠알라룸푸르 인기 태그')).not.toBeInTheDocument();
    cleanup();
    state.popularTags = [{ tag: 'KLIA익스프레스', uses: 5 }];
    renderScreen();
    expect(screen.getByText('쿠알라룸푸르 인기 태그')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '#KLIA익스프레스' }));
    expect(state.postsArgs.at(-1)).toMatchObject({ tag: 'KLIA익스프레스' });
  });
});
