import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@/shared/i18n';
import { dotWindow, FEED_PAGE_SIZE, PagedFeed, pageNumbers } from './PagedFeed';

function stubMatchMedia(matches: boolean) {
  window.matchMedia = ((query: string) => ({
    matches,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

const makeItems = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, title: `글 ${i + 1}` }));

function renderFeed(n: number, extra: Partial<{ hasMore: boolean; fetchMore: () => void; isFetchingMore: boolean }> = {}) {
  const fetchMore = extra.fetchMore ?? vi.fn();
  render(
    <PagedFeed
      items={makeItems(n)}
      getKey={(i) => i.id}
      renderItem={(i) => <div>{i.title}</div>}
      hasMore={extra.hasMore ?? false}
      isFetchingMore={extra.isFetchingMore ?? false}
      fetchMore={fetchMore}
      gridClassName="grid"
      listClassName="list"
    />,
  );
  return fetchMore;
}

describe('pageNumbers / dotWindow', () => {
  it('쪽이 7개 이하면 전부, 많으면 처음·끝·지금 앞뒤만 남기고 줄임표로 접는다', () => {
    expect(pageNumbers(0, 5)).toEqual([0, 1, 2, 3, 4]);
    expect(pageNumbers(0, 12)).toEqual([0, 1, 'gap', 11]);
    expect(pageNumbers(5, 12)).toEqual([0, 'gap', 4, 5, 6, 'gap', 11]);
    expect(pageNumbers(11, 12)).toEqual([0, 'gap', 10, 11]);
  });

  it('점은 최대 7개이고 지금 쪽이 가운데로 오게 밀린다', () => {
    expect(dotWindow(0, 3)).toEqual({ start: 0, count: 3 });
    expect(dotWindow(0, 20)).toEqual({ start: 0, count: 7 });
    expect(dotWindow(10, 20)).toEqual({ start: 7, count: 7 });
    expect(dotWindow(19, 20)).toEqual({ start: 13, count: 7 });
  });
});

describe('PagedFeed — PC', () => {
  beforeEach(() => stubMatchMedia(true));

  it(`${FEED_PAGE_SIZE}개씩 보이고 번호로 쪽을 넘긴다`, () => {
    renderFeed(14);
    expect(screen.getAllByText(/^글 \d+$/)).toHaveLength(6);
    expect(screen.getByText('글 1')).toBeInTheDocument();
    expect(screen.queryByText('글 7')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '2페이지' }));
    expect(screen.getByText('글 7')).toBeInTheDocument();
    expect(screen.queryByText('글 1')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '3페이지' }));
    expect(screen.getAllByText(/^글 \d+$/)).toHaveLength(2); // 마지막 쪽은 남은 2개
    expect(screen.getByRole('button', { name: '다음 페이지' })).toBeDisabled();
  });

  it('쪽이 하나뿐이면 쪽 넘김을 그리지 않는다', () => {
    renderFeed(4);
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('끝 쪽에 가까워지면(끝에서 한 쪽 안) 다음 묶음을 미리 불러온다', () => {
    const fetchMore = renderFeed(12, { hasMore: true });
    // 2쪽 분량 — 첫 쪽이 이미 '끝에서 한 쪽 안'이라 바로 불러온다
    expect(fetchMore).toHaveBeenCalled();
  });

  it('멀리 있으면 아직 불러오지 않는다', () => {
    const fetchMore = renderFeed(30, { hasMore: true });
    expect(fetchMore).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '4페이지' }));
    expect(fetchMore).toHaveBeenCalled();
  });
});

describe('PagedFeed — 모바일', () => {
  beforeEach(() => stubMatchMedia(false));

  it('쪽마다 6개씩 한 장으로 묶고, 아래 점이 쪽 수만큼 나온다', () => {
    renderFeed(14);
    expect(screen.getAllByText(/^글 \d+$/)).toHaveLength(14); // 옆으로 밀어 넘기는 줄이라 모두 그려져 있다
    const dots = screen.getAllByRole('button', { name: /페이지$/ });
    expect(dots).toHaveLength(3);
    expect(dots[0]).toHaveAttribute('aria-current', 'page');
  });

  it('점을 누르면 그 쪽이 현재 쪽이 된다', () => {
    renderFeed(14);
    fireEvent.click(screen.getByRole('button', { name: '3페이지' }));
    expect(screen.getByRole('button', { name: '3페이지' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: '1페이지' })).not.toHaveAttribute('aria-current');
  });

  it('쪽이 하나뿐이면 점이 없다', () => {
    renderFeed(6);
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
  });
});
