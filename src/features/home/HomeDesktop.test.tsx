import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const isDesktopMock = vi.hoisted(() => ({ value: true }));

vi.mock('@/shared/hooks/useMediaQuery', () => ({ useMediaQuery: () => isDesktopMock.value }));
vi.mock('@/features/community/hooks/useDestinations', () => ({ useDestinations: () => ({ data: [] }) }));
vi.mock('./cityDescription', () => ({
  cityDescQueryKey: (city: string, locale: string) => ['cityDesc', city, locale],
  fetchCityDescription: vi.fn().mockResolvedValue(null),
  readCachedCityDescriptions: vi.fn().mockResolvedValue({}),
}));
// 항공 폼은 무겁고 이 테스트와 상관없다
vi.mock('./MyrealtripFlightSearch', () => ({ MyrealtripFlightSearch: () => <div data-testid="flight-form" /> }));

import { HomeDesktop } from './HomeDesktop';

function renderHome() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <HomeDesktop />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('HomeDesktop 히어로 검색 탭', () => {
  beforeEach(() => {
    isDesktopMock.value = true;
    // jsdom에는 matchMedia가 없다 — 추천 카드 자동 스크롤이 "움직임 줄이기"를 확인할 때 쓴다(줄이기로 답해 루프를 안 돌린다)
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('PC에서는 여행 계획 · 항공 · 호텔 · 액티비티 탭이 보이고 처음엔 여행 계획 검색이 열려 있다', () => {
    renderHome();
    const group = screen.getByRole('group', { name: '검색 종류' });
    expect(group.querySelectorAll('button')).toHaveLength(4);
    expect(screen.getByRole('button', { name: '여행 계획' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByPlaceholderText('어디로 떠나고 싶으신가요?')).toBeVisible();
  });

  it('탭을 고르면 그 종류의 패널로 바뀌고, 여행 계획으로 돌아와도 입력한 글이 남는다', async () => {
    renderHome();
    const plan = screen.getByPlaceholderText('어디로 떠나고 싶으신가요?');
    fireEvent.change(plan, { target: { value: '도쿄' } });

    fireEvent.click(within('항공'));
    expect(await screen.findByTestId('flight-form')).toBeVisible();
    expect(plan).not.toBeVisible();

    fireEvent.click(within('호텔'));
    expect(screen.getByRole('link', { name: /아고다에서 숙소 찾기/ })).toHaveAttribute('href', 'https://www.agoda.com/');

    fireEvent.click(within('액티비티'));
    expect(screen.getByRole('search')).toBeVisible();

    fireEvent.click(within('여행 계획'));
    expect(plan).toBeVisible();
    expect(plan).toHaveValue('도쿄');
  });

  it('모바일(1024px 미만)에서는 탭 없이 여행 계획 검색만 보인다 — 이동은 위의 HomeSectionTabs가 맡는다', () => {
    isDesktopMock.value = false;
    renderHome();
    expect(screen.queryByRole('group', { name: '검색 종류' })).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('어디로 떠나고 싶으신가요?')).toBeVisible();
    expect(screen.queryByTestId('flight-form')).not.toBeInTheDocument();
  });
});

/** 히어로 탭 줄 안의 탭 버튼(위쪽 HomeSectionTabs 링크와 이름이 같아서 이 안에서만 찾는다) */
function within(name: string): HTMLElement {
  const group = screen.getByRole('group', { name: '검색 종류' });
  const button = Array.from(group.querySelectorAll('button')).find((b) => b.textContent?.includes(name));
  if (!button) throw new Error(`탭 없음: ${name}`);
  return button;
}
