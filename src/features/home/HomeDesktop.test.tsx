import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { isDesktop } = vi.hoisted(() => ({ isDesktop: { value: false } }));
vi.mock('@/shared/hooks/useMediaQuery', () => ({ useMediaQuery: () => isDesktop.value }));
vi.mock('@/features/community/hooks/useDestinations', () => ({ useDestinations: () => ({ data: [] }) }));
vi.mock('./cityDescription', async () => ({
  ...(await vi.importActual<typeof import('./cityDescription')>('./cityDescription')),
  readCachedCityDescriptions: async () => ({}),
}));

import { HomeDesktop } from './HomeDesktop';

function renderHome() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <HomeDesktop />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
});

describe('HomeDesktop — 모바일/PC 구성', () => {
  it('모바일: 검색창 없이 추천 여행지 → 트립틱 시작하기 3단계 순서', () => {
    isDesktop.value = false;
    renderHome();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByText('여행 계획하기')).not.toBeInTheDocument();
    const featured = screen.getByText('추천 여행지');
    const steps = screen.getByText('트립틱 시작하기');
    expect(featured.compareDocumentPosition(steps) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    for (const label of ['서류 올리기', '일정 자동 완성', '함께 편집하기']) expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('PC: 기존처럼 검색창이 있고 시작하기 안내는 없다', () => {
    isDesktop.value = true;
    renderHome();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByText('여행 계획하기')).toBeInTheDocument();
    expect(screen.queryByText('트립틱 시작하기')).not.toBeInTheDocument();
  });
});
