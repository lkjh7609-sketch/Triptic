import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@/shared/i18n';
import type { HotelsResponse } from './hotelsApi';

vi.mock('@/shared/hooks/useProfile', () => ({ useProfile: () => ({ data: { base_currency: 'KRW' } }) }));

import { HotelResults } from './HotelResults';

/** 실제 fetchHotels를 쓰고 서버 응답만 가짜로 — 요청 주소도 함께 확인한다 */
const fetchMock = vi.fn<(url: string) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>>();
const ok = (body: unknown) => async () => ({ ok: true, status: 200, json: async () => body });
const fail = (status: number) => async () => ({ ok: false, status, json: async () => ({}) });
const lastParams = () => new URL(fetchMock.mock.calls.at(-1)![0], 'https://triptic.my').searchParams;

const search = { name: '방콕', lat: 13.7563, lng: 100.5018, checkin: '2026-11-20', checkout: '2026-11-22', adults: 2, childAges: [] };
const hotel = (over: Record<string, unknown> = {}) => ({
  id: '1',
  name: '그란데 센터 포인트',
  stars: 5,
  reviewScore: 9.1,
  reviewCount: 4209,
  price: 169367,
  crossedOut: 227876,
  discountPct: 26,
  breakfast: true,
  wifi: true,
  image: null,
  lat: 13.7,
  lng: 100.5,
  url: 'https://www.agoda.com/ko-kr/partners/partnersearch.aspx?cid=1&hid=1',
  ...over,
});
const response = (hotels: unknown[], city: HotelsResponse['city'] = { id: 9395, name: '방콕', country: 'TH', distanceKm: 5 }): HotelsResponse =>
  ({ city, hotels, nights: 2, currency: 'KRW' }) as HotelsResponse;

describe('HotelResults — 우리 화면의 호텔 결과', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('호텔 카드: 이름·평점·후기·할인·조식·와이파이·가격과 예약 링크(받은 주소 그대로, 제휴 표시)', async () => {
    fetchMock.mockImplementation(ok(response([hotel()])));
    const { container } = render(<HotelResults search={search} />);
    expect(await screen.findByText('그란데 센터 포인트')).toBeInTheDocument();
    expect(screen.getByText('9.1')).toBeInTheDocument();
    expect(screen.getByText('26% 할인')).toBeInTheDocument();
    expect(screen.getByText('조식 포함')).toBeInTheDocument();
    expect(screen.getByText('무료 Wi-Fi')).toBeInTheDocument();
    expect(screen.getByText('₩169,367')).toBeInTheDocument();
    expect(screen.getByText('₩227,876')).toBeInTheDocument(); // 할인 전 가격
    const link = screen.getByRole('link', { name: /예약하기/ });
    expect(link).toHaveAttribute('href', hotel().url);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.getAttribute('rel')).toContain('sponsored');
    // 화면 어디에도 제휴사 이름을 쓰지 않는다
    expect(container.textContent?.toLowerCase()).not.toContain('agoda');
    expect(container.textContent?.toLowerCase()).not.toContain('kayak');
  });

  it('조건(좌표·날짜·인원·통화·언어)을 서버에 그대로 보낸다', async () => {
    fetchMock.mockImplementation(ok(response([hotel()])));
    render(<HotelResults search={{ ...search, adults: 3, childAges: [5] }} />);
    await screen.findByText('그란데 센터 포인트');
    const p = lastParams();
    expect(Object.fromEntries(p)).toEqual({ provider: 'agoda', kind: 'hotels', lat: '13.7563', lng: '100.5018', checkin: '2026-11-20', checkout: '2026-11-22', adults: '3', childAges: '5', currency: 'KRW', lang: 'ko', sort: 'recommended' });
  });

  it('정렬과 필터를 바꾸면 서버에 다시 묻는다', async () => {
    fetchMock.mockImplementation(ok(response([hotel()])));
    render(<HotelResults search={search} />);
    await screen.findByText('그란데 센터 포인트');
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'priceAsc' } });
    await waitFor(() => expect(lastParams().get('sort')).toBe('priceAsc'));
    fireEvent.click(screen.getAllByRole('button', { name: /4성 이상/ })[0]);
    await waitFor(() => expect(lastParams().get('minStars')).toBe('4'));
    fireEvent.click(screen.getAllByRole('checkbox', { name: '할인 상품만' })[0]);
    await waitFor(() => expect(lastParams().get('discountOnly')).toBe('1'));
  });

  it('결과가 없으면 안내', async () => {
    fetchMock.mockImplementation(ok(response([])));
    render(<HotelResults search={search} />);
    expect(await screen.findByText(/조건에 맞는 숙소가 없어요/)).toBeInTheDocument();
  });

  it('근처에 도시가 없으면 다른 지역을 안내', async () => {
    fetchMock.mockImplementation(ok(response([], null)));
    render(<HotelResults search={search} />);
    expect(await screen.findByText('이 지역 근처의 숙소를 찾지 못했어요')).toBeInTheDocument();
  });

  it('서버에 제휴 키가 없으면(503) 준비 중 안내', async () => {
    fetchMock.mockImplementation(fail(503));
    render(<HotelResults search={search} />);
    expect(await screen.findByText('숙소 검색을 준비하고 있어요')).toBeInTheDocument();
  });

  it('호출이 실패하면 오류 안내', async () => {
    fetchMock.mockImplementation(fail(500));
    render(<HotelResults search={search} />);
    expect(await screen.findByText(/숙소를 불러오지 못했어요/)).toBeInTheDocument();
  });
});
