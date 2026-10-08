import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import i18n from '@/shared/i18n';
import type { FlightOffer, FlightsResponse } from './flightsApi';
import { flightsQuery } from './flightsApi';

import { FlightResults } from './FlightResults';

const toast = vi.fn();
vi.mock('@/shared/ui/toast', () => ({ showToast: (...args: unknown[]) => toast(...args) }));

/** 실제 fetchFlights를 쓰고 서버 응답만 가짜로 — 요청 주소도 함께 확인한다 */
const fetchMock = vi.fn<(url: string) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>>();
const ok = (body: unknown) => async () => ({ ok: true, status: 200, json: async () => body });
const status = (code: number, body: unknown = {}) => async () => ({ ok: false, status: code, json: async () => body });
const lastParams = () => new URL(fetchMock.mock.calls.at(-1)![0], 'https://triptic.my').searchParams;

const search = { origin: 'SEL', originType: 'city', destination: 'TYO', destinationType: 'city', departDate: '2026-11-20', returnDate: '2026-11-25', adults: 2 } as const;
const BOOKING = 'https://kr.trip.com/flights/SEL-to-TYO/tickets-SEL-TYO?Allianceid=1&SID=2';

const leg = (code: string, name: string, dep: string, arr: string, stops = 0, minutes = 150, origin = 'ICN', destination = 'NRT') => ({
  carrier: { code, name },
  depart: `2026-11-20T${dep}:00`,
  arrive: `2026-11-20T${arr}:00`,
  origin,
  destination,
  minutes,
  stops,
  via: stops ? ['TPE'] : [],
  segments: [],
});
const offer = (id: string, price: number, over: Partial<FlightOffer> = {}): FlightOffer => ({
  id,
  price,
  perPerson: Math.round(price / 2),
  currency: 'KRW',
  verified: true,
  selfTransfer: false,
  legs: [leg('7C', '제주항공', '14:50', '17:15'), leg('7C', '제주항공', '18:00', '20:40', 0, 160, 'NRT', 'ICN')],
  ...over,
});
const response = (offers: FlightOffer[]): FlightsResponse => ({ currency: 'KRW', offers, observedAt: null, bookingUrl: BOOKING, tracked: true });
const times = () => screen.queryAllByRole('listitem').map((li) => li.textContent ?? '');

describe('FlightResults — 우리 화면의 항공 운임 결과', () => {
  beforeEach(async () => {
    fetchMock.mockReset();
    toast.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    await i18n.changeLanguage('ko');
  });
  afterEach(() => vi.unstubAllGlobals());

  it('카드: 항공사·시각·직항, 1인 가격 크게+총액 작게, 예약 링크(검색 단위 하나, 제휴 표시)와 이동 토스트', async () => {
    fetchMock.mockImplementation(ok(response([offer('a', 300000)])));
    const { container } = render(<FlightResults search={search} />);
    expect(await screen.findByText('₩150,000')).toBeInTheDocument(); // 1인
    expect(screen.getByText('총 ₩300,000')).toBeInTheDocument();
    expect(screen.getAllByText('제주항공')).toHaveLength(2);
    expect(screen.getByText('14:50')).toBeInTheDocument();
    expect(screen.getAllByText('직항').length).toBeGreaterThan(0);
    const link = screen.getByRole('link', { name: /예약하기/ });
    expect(link).toHaveAttribute('href', BOOKING);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.getAttribute('rel')).toContain('sponsored');
    expect(link.getAttribute('rel')).toContain('noopener');
    fireEvent.click(link);
    expect(toast).toHaveBeenCalledWith('선택하신 항공권의 예약 페이지로 이동합니다.');
    // 실시간 변동 고지 + 제휴사 이름은 화면에 쓰지 않는다
    expect(screen.getByText(/실시간 좌석 변동 및 결제 수단/)).toBeInTheDocument();
    const text = container.textContent?.toLowerCase() ?? '';
    for (const name of ['trip.com', 'kiwi', 'ignav', 'travelpayouts', '마이리얼트립']) expect(text).not.toContain(name);
  });

  it('1명이면 총액 줄을 생략하고, 가격이 확인 안 된 카드는 "약"', async () => {
    fetchMock.mockImplementation(ok(response([offer('a', 150000, { perPerson: 150000, verified: false })])));
    render(<FlightResults search={{ ...search, adults: 1 }} />);
    expect(await screen.findByText(/₩150,000/)).toBeInTheDocument();
    expect(screen.queryByText(/^총 /)).toBeNull();
    expect(screen.getByText('약')).toBeInTheDocument();
  });

  it('요청: 서버 주소·검색 조건(왕복·인원·좌석)·화면 언어를 보낸다', async () => {
    fetchMock.mockImplementation(ok(response([offer('a', 1)])));
    render(<FlightResults search={{ ...search, children: 1, infants: 1, cabin: 'BUSINESS' }} />);
    await screen.findByRole('link', { name: /예약하기/ });
    expect(fetchMock.mock.calls[0][0]).toMatch(/^\/api\/partnerProducts\?|^https?:\/\/.*\/api\/partnerProducts\?/);
    expect(Object.fromEntries(lastParams())).toEqual({
      provider: 'flights',
      kind: 'search',
      origin: 'SEL',
      destination: 'TYO',
      depart_date: '2026-11-20',
      return_date: '2026-11-25',
      adults: '2',
      children: '1',
      infants: '1',
      cabin: 'BUSINESS',
      locale: 'ko',
    });
  });

  it('정렬(최저가·최단 시간·출발 빠른 순)은 드롭다운, 필터는 접이식 — 받은 결과 안에서 거르고 다시 호출하지 않는다', async () => {
    const slow = offer('slow', 200000, { legs: [leg('KE', '대한항공', '09:00', '14:00', 1, 300), leg('KE', '대한항공', '10:00', '15:00', 1, 300, 'NRT', 'ICN')] });
    const fast = offer('fast', 400000, { legs: [leg('OZ', '아시아나항공', '18:00', '20:30', 0, 150), leg('OZ', '아시아나항공', '19:00', '21:30', 0, 150, 'NRT', 'ICN')] });
    const mid = offer('mid', 300000, { legs: [leg('7C', '제주항공', '12:00', '14:30', 0, 160), leg('7C', '제주항공', '13:00', '15:40', 0, 160, 'NRT', 'ICN')] });
    fetchMock.mockImplementation(ok(response([fast, slow, mid])));
    render(<FlightResults search={search} />);
    await screen.findAllByRole('listitem');
    const order = () => times().map((t) => (t.includes('대한항공') ? 'slow' : t.includes('아시아나') ? 'fast' : 'mid'));
    expect(screen.getByText('항공편 3개')).toBeInTheDocument();
    // 처음엔 필터가 접혀 있다
    expect(screen.queryByRole('group', { name: '항공사' })).toBeNull();
    expect(order()).toEqual(['slow', 'mid', 'fast']); // 최저가순(기본)
    fireEvent.change(screen.getByLabelText('정렬'), { target: { value: 'duration' } });
    expect(order()).toEqual(['fast', 'mid', 'slow']); // 왕복 합계 300 < 320 < 600분
    fireEvent.change(screen.getByLabelText('정렬'), { target: { value: 'depart' } });
    expect(order()).toEqual(['slow', 'mid', 'fast']);

    fireEvent.click(screen.getByRole('button', { name: /^필터/ }));
    fireEvent.click(screen.getByRole('button', { name: '직항만' }));
    expect(order()).toEqual(['mid', 'fast']);
    expect(screen.getByText('항공편 2개')).toBeInTheDocument();
    // 출발 시간대(가는 편 출발) — 복수 선택
    fireEvent.click(screen.getByRole('button', { name: '저녁 18–24시' }));
    expect(order()).toEqual(['fast']);
    fireEvent.click(screen.getByRole('button', { name: '오후 12–18시' }));
    expect(order()).toEqual(['mid', 'fast']);
    fireEvent.click(screen.getByRole('button', { name: '저녁 18–24시' }));
    // 항공사 — 복수 선택
    const airlines = screen.getByRole('group', { name: '항공사' });
    fireEvent.click(within(airlines).getByRole('button', { name: '아시아나항공' }));
    expect(order()).toEqual([]); // 오후 + 아시아나(저녁 출발) = 없음
    fireEvent.click(within(airlines).getByRole('button', { name: '제주항공' }));
    expect(order()).toEqual(['mid']);
    expect(screen.getByRole('button', { name: /^필터/ })).toHaveTextContent('4'); // 직항 + 오후 + 항공사 2
    // 접으면 걸린 필터가 칩으로 남고, 눌러서 해제한다
    fireEvent.click(screen.getByRole('button', { name: '완료' }));
    expect(screen.queryByRole('group', { name: '항공사' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '직항만 필터 해제' }));
    expect(screen.queryByRole('button', { name: '직항만 필터 해제' })).toBeNull();
    expect(screen.getByRole('button', { name: /^필터/ })).toHaveTextContent('3');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('필터에 맞는 게 없으면 안내와 초기화(결과 자체가 없는 것과 구분)', async () => {
    const via = offer('v', 200000, { legs: [leg('KE', '대한항공', '09:00', '14:00', 1, 300)] });
    fetchMock.mockImplementation(ok(response([via])));
    render(<FlightResults search={search} />);
    await screen.findByRole('link', { name: /예약하기/ });
    fireEvent.click(screen.getByRole('button', { name: /^필터/ }));
    fireEvent.click(screen.getByRole('button', { name: '직항만' }));
    expect(screen.getByText(/이 조건에 맞는 항공편이 없어요/)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: '초기화' })[0]);
    expect(await screen.findByRole('link', { name: /예약하기/ })).toBeInTheDocument();
  });

  it('아동·유아가 있으면 1인 가격 라벨을 "평균"으로 정직하게', async () => {
    fetchMock.mockImplementation(ok(response([offer('a', 300000)])));
    render(<FlightResults search={{ ...search, children: 1 }} />);
    expect(await screen.findByText(/1인 평균\(아동·유아 포함\)/)).toBeInTheDocument();
  });

  it('경유·자가 환승 표시', async () => {
    const via = offer('v', 200000, { selfTransfer: true, legs: [leg('KE', '대한항공', '09:00', '14:00', 1, 300)] });
    fetchMock.mockImplementation(ok(response([via])));
    render(<FlightResults search={search} />);
    expect(await screen.findByText(/경유 1회 · TPE/)).toBeInTheDocument();
    expect(screen.getByText(/별도 발권/)).toBeInTheDocument();
  });

  it('결과가 0건이면 안내와 예약 사이트 검색 링크', async () => {
    fetchMock.mockImplementation(ok(response([])));
    render(<FlightResults search={search} />);
    expect(await screen.findByText(/조건에 맞는 항공편을 찾지 못했어요/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /예약 사이트에서 검색/ })).toHaveAttribute('href', BOOKING);
  });

  it('서버가 못 쓰는 상태(키 없음·상한·장애)면 목록 대신 안내 + 예약 사이트 링크', async () => {
    fetchMock.mockImplementation(status(503, { error: 'flights_cap', bookingUrl: BOOKING }));
    render(<FlightResults search={search} />);
    expect(await screen.findByText('지금은 항공권 목록을 보여드릴 수 없어요')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /예약 사이트에서 검색/ })).toHaveAttribute('href', BOOKING);
    expect(screen.queryByRole('button', { name: /^필터/ })).toBeNull();
  });

  it('그 밖의 오류는 다시 시도 안내(링크가 없으면 링크 없이)', async () => {
    fetchMock.mockImplementation(status(500));
    render(<FlightResults search={search} />);
    expect(await screen.findByText('항공권을 불러오지 못했어요')).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('불러오는 동안 진행 안내(처음 검색은 느릴 수 있다)', async () => {
    fetchMock.mockImplementation(() => new Promise(() => {}));
    render(<FlightResults search={search} />);
    expect(await screen.findByRole('status')).toHaveTextContent('20초');
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });

  it('외국어 화면에서는 서버에 그 언어를 알리고 통화는 서버 응답을 따른다', async () => {
    await i18n.changeLanguage('en');
    fetchMock.mockImplementation(ok({ ...response([offer('a', 300, { currency: 'USD', perPerson: 150 })]), currency: 'USD' }));
    render(<FlightResults search={search} />);
    expect(await screen.findByText('$150')).toBeInTheDocument();
    expect(lastParams().get('locale')).toBe('en');
    expect(screen.getByRole('link', { name: /Book/ })).toBeInTheDocument();
  });
});

describe('flightsQuery', () => {
  it('같은 검색은 항상 같은 주소(CDN 적중), 편도·기본값은 매개변수를 싣지 않는다', () => {
    const a = flightsQuery({ ...search, returnDate: null }, 'ko');
    expect(a).toBe('provider=flights&kind=search&origin=SEL&destination=TYO&depart_date=2026-11-20&adults=2&locale=ko');
    expect(flightsQuery({ ...search, returnDate: null, cabin: 'ECONOMY' }, 'ko')).toBe(a);
  });
});
