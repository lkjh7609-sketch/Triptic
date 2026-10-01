import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { trip } = vi.hoisted(() => ({ trip: { value: undefined as undefined | { city: string; city_lat: number; city_lng: number } } }));
vi.mock('@/shared/hooks/useMediaQuery', () => ({ useMediaQuery: () => true }));
vi.mock('@/shared/hooks/useProfile', () => ({ useProfile: () => ({ data: { base_currency: 'KRW' } }) }));
vi.mock('@/shared/monitoring', () => ({ trackScreenView: () => {} }));
vi.mock('../useNearestTrip', () => ({ useNearestTrip: () => trip.value }));
vi.mock('../KlookToursWidget', () => ({ KlookToursWidget: () => <div data-testid="klook-widget" /> }));

import { ActivitiesScreen } from '../ActivitiesScreen';

const CATEGORIES = [
  { name: '투어', value: 'tour' },
  { name: '미식', value: 'delicacies' },
];

function product(i: number, over: Record<string, unknown> = {}) {
  return {
    id: String(i),
    title: `상품 ${i}`,
    category: '투어',
    imageUrl: null,
    price: 10000 * i,
    currency: 'KRW',
    rating: 4.9,
    reviewCount: 100 + i,
    tags: [],
    url: `https://experiences.myrealtrip.com/products/${i}`,
    ...over,
  };
}

const calls: URLSearchParams[] = [];

function stubFetch(handler: (params: URLSearchParams) => unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'http://localhost');
      if (url.pathname === '/api/partnerLink') return { ok: true, json: async () => ({ url: 'https://myrealt.rip/x', tracked: true }) };
      calls.push(url.searchParams);
      if (url.searchParams.get('kind') === 'categories') return { ok: true, json: async () => ({ categories: CATEGORIES }) };
      return { ok: true, json: async () => handler(url.searchParams) };
    }),
  );
}

function renderScreen() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <ActivitiesScreen />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** 상품 카드(버튼) 제목들 — 인기 검색어 칩에도 같은 상품명이 나오므로 카드 안만 본다 */
const cardTitles = () => screen.queryAllByRole('button').map((b) => b.querySelector('span[class*="title"]')?.textContent).filter(Boolean);
const findCard = (title: string) => waitFor(() => expect(cardTitles()).toContain(title));

const lists = () => calls.filter((p) => p.get('kind') === 'list');

beforeEach(() => {
  calls.length = 0;
  trip.value = undefined;
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ActivitiesScreen — 마이리얼트립', () => {
  it('한국어에서는 마이리얼트립이 기본, 처음 PC 8개를 보여 주고 더 보기로 8개씩', async () => {
    stubFetch(() => ({ items: Array.from({ length: 20 }, (_, i) => product(i + 1)), hasNextPage: false, totalCount: 20 }));
    renderScreen();
    await findCard('상품 1');
    expect(screen.getByRole('button', { name: /마이리얼트립/, pressed: true })).toBeInTheDocument();
    expect(cardTitles()).toHaveLength(8);
    await userEvent.click(screen.getByRole('button', { name: /더 보기/ }));
    expect(cardTitles()).toHaveLength(16);
  });

  it('여행이 있으면 그 도시로 시안 문구, 도시 원형을 누르면 그 도시(한국어 이름)로 바뀐다', async () => {
    trip.value = { city: '시드니', city_lat: -33.87, city_lng: 151.21 };
    stubFetch(() => ({ items: [product(1)], hasNextPage: false, totalCount: 1 }));
    renderScreen();
    expect(await screen.findByText('다음 시드니 여행에 맞춰 골랐어요')).toBeInTheDocument();
    expect(lists()[0].get('q')).toBe('시드니');
    await userEvent.click(screen.getByRole('button', { name: '파리' }));
    expect(await screen.findByText('파리 인기 투어·티켓')).toBeInTheDocument();
    await waitFor(() => expect(lists().some((p) => p.get('q') === '파리')).toBe(true));
    expect(screen.getByRole('button', { name: '파리', pressed: true })).toBeInTheDocument();
  });

  it('필터: 카테고리·가격은 서버로, 평점은 받은 결과에서 거르고 배지는 필터 종류 수', async () => {
    stubFetch((p) => {
      const items = [product(1, { rating: 4.95 }), product(2, { rating: 4.6 }), product(3, { rating: 4.85 })];
      return { items, hasNextPage: false, totalCount: p.get('category') ? 2 : 3 };
    });
    renderScreen();
    await findCard('상품 1');
    await userEvent.click(screen.getByRole('button', { name: /^필터/ }));
    const dialog = await screen.findByRole('dialog', { name: /상세 필터/ });
    await userEvent.click(await within(dialog).findByRole('button', { name: '투어' }));
    await userEvent.click(within(dialog).getByRole('button', { name: /4\.8\+/ }));
    // 평점이 켜져 있으면 받은 목록 안에서 센 값
    await within(dialog).findByRole('button', { name: /2개 결과 보기/ });
    await userEvent.click(within(dialog).getByRole('button', { name: /결과 보기/ }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(cardTitles()).toEqual(['상품 1', '상품 3']);
    expect(screen.getByRole('button', { name: /^필터\s*2$/ })).toBeInTheDocument();
    const last = lists().at(-1)!;
    expect(last.get('category')).toBe('tour');
    expect(last.has('minRating')).toBe(false);
  });

  it('바깥을 눌러도 모달이 닫히지 않고 Esc로 닫힌다', async () => {
    stubFetch(() => ({ items: [product(1)], hasNextPage: false, totalCount: 1 }));
    renderScreen();
    await findCard('상품 1');
    await userEvent.click(screen.getByRole('button', { name: /^필터/ }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(dialog.parentElement!);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('정렬을 바꾸면 그 정렬 값으로 다시 부른다', async () => {
    stubFetch(() => ({ items: [product(1)], hasNextPage: false, totalCount: 1 }));
    renderScreen();
    await findCard('상품 1');
    await userEvent.click(screen.getByRole('button', { name: '낮은 가격순' }));
    await waitFor(() => expect(lists().some((p) => p.get('sort') === 'price_asc')).toBe(true));
  });

  it('인기 검색어는 기본 추천 목록 맨 앞 4개 — 정렬을 바꿔도 그대로', async () => {
    stubFetch((p) => {
      const base = Array.from({ length: 6 }, (_, i) => product(i + 1));
      return { items: p.get('sort') === 'price_asc' ? [...base].reverse() : base, hasNextPage: false, totalCount: 6 };
    });
    renderScreen();
    await findCard('상품 1');
    const chips = () => within(screen.getByText('인기 검색어').parentElement!).getAllByRole('button').map((b) => b.textContent);
    expect(chips()).toEqual(['상품 1', '상품 2', '상품 3', '상품 4']);
    await userEvent.click(screen.getByRole('button', { name: '낮은 가격순' }));
    await waitFor(() => expect(cardTitles()[0]).toBe('상품 6'));
    expect(chips()).toEqual(['상품 1', '상품 2', '상품 3', '상품 4']);
  });

  it('마이링크는 카드를 누를 때만 만든다(화면에 나올 때는 만들지 않는다)', async () => {
    stubFetch(() => ({ items: [product(1), product(2)], hasNextPage: false, totalCount: 2 }));
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    renderScreen();
    await findCard('상품 1');
    const fetchMock = vi.mocked(fetch);
    const linkCalls = () => fetchMock.mock.calls.filter(([url]) => String(url).includes('/api/partnerLink'));
    expect(linkCalls()).toHaveLength(0);
    await userEvent.click(screen.getAllByRole('button').find((b) => b.querySelector('span[class*="title"]')?.textContent === '상품 2')!);
    await waitFor(() => expect(linkCalls()).toHaveLength(1));
    expect(String(linkCalls()[0][0])).toContain('products%2F2');
    open.mockRestore();
  });

  it('필터 없는 기본 목록은 받지 못해도 마지막으로 잘 받은 상품을 보여 주고, 필터를 건 결과는 빈 채로 둔다', async () => {
    stubFetch(() => ({ items: [product(1)], hasNextPage: false, totalCount: 1 }));
    const first = renderScreen();
    await findCard('상품 1');
    first.unmount();
    // 이번에는 서버가 빈 목록을 준다
    stubFetch((p) => ({ items: [], hasNextPage: false, totalCount: 0, _p: p.toString() }));
    renderScreen();
    await findCard('상품 1');
    await userEvent.click(screen.getByRole('button', { name: '낮은 가격순' }));
    expect(await screen.findByText('조건에 맞는 상품이 없어요')).toBeInTheDocument();
  });

  it('결과가 없으면 안내와 마이리얼트립 검색으로 가는 길', async () => {
    stubFetch(() => ({ items: [], hasNextPage: false, totalCount: 0 }));
    renderScreen();
    expect(await screen.findByText('조건에 맞는 상품이 없어요')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /마이리얼트립에서 서울 보기/ })).toBeInTheDocument();
  });

  it('Klook을 고르면 필터·정렬 없이 위젯만', async () => {
    stubFetch(() => ({ items: [product(1)], hasNextPage: false, totalCount: 1 }));
    renderScreen();
    await findCard('상품 1');
    await userEvent.click(screen.getByRole('button', { name: 'Klook' }));
    expect(screen.getByTestId('klook-widget')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^필터/ })).not.toBeInTheDocument();
    expect(screen.queryByText('인기 검색어')).not.toBeInTheDocument();
    expect(screen.getByText('Klook 제공')).toBeInTheDocument();
  });
});
