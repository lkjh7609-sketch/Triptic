import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Destination } from '@/features/community/types';

const DESTS: Destination[] = [
  { id: 'd1', slug: 'tokyo', name: '도쿄', country_code: 'JP', lat: 35.6762, lng: 139.6503, timezone: 'Asia/Tokyo', currency: 'JPY', cover_url: null, is_featured: true, sort_order: 0, post_count: 0 },
  { id: 'd2', slug: 'osaka', name: '오사카', country_code: 'JP', lat: 34.6937, lng: 135.5023, timezone: 'Asia/Tokyo', currency: 'JPY', cover_url: null, is_featured: true, sort_order: 1, post_count: 0 },
  { id: 'd3', slug: 'paris', name: '파리', country_code: 'FR', lat: 48.8566, lng: 2.3522, timezone: 'Europe/Paris', currency: 'EUR', cover_url: null, is_featured: true, sort_order: 32, post_count: 0 },
];

vi.mock('@/features/community/hooks/useDestinations', () => ({ useDestinations: () => ({ data: DESTS }) }));
const tripMock = vi.hoisted(() => ({ value: undefined as unknown }));
vi.mock('./useNearestTrip', () => ({ useNearestTrip: () => tripMock.value }));
const openExternal = vi.hoisted(() => vi.fn());
vi.mock('@/features/plan/partnerLinks', () => ({ openExternal }));

import { HotelSearchForm } from './HotelSearchForm';

function renderForm() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <HotelSearchForm />
    </QueryClientProvider>,
  );
}

const destinationInput = () => screen.getByRole('combobox');

describe('HotelSearchForm', () => {
  beforeEach(() => {
    openExternal.mockClear();
    tripMock.value = undefined;
  });

  it('여행지를 고르지 않고 검색하면 트립닷컴을 열지 않는다', () => {
    renderForm();
    fireEvent.click(screen.getByRole('button', { name: '호텔 검색' }));
    expect(openExternal).not.toHaveBeenCalled();
  });

  it('여행지를 목록에서 골라 검색하면 그 도시의 트립닷컴 결과를 제휴 값과 함께 연다', () => {
    renderForm();
    fireEvent.focus(destinationInput());
    fireEvent.change(destinationInput(), { target: { value: '도' } });
    fireEvent.mouseDown(screen.getByRole('option', { name: /도쿄/ }));
    fireEvent.click(screen.getByRole('button', { name: '호텔 검색' }));

    expect(openExternal).toHaveBeenCalledTimes(1);
    const url = new URL(openExternal.mock.calls[0][0] as string);
    expect(url.host).toBe('kr.trip.com');
    expect(url.pathname).toBe('/hotels/list');
    expect(url.searchParams.get('city')).toBe('228');
    expect(url.searchParams.get('cityName')).toBe('도쿄');
    expect(url.searchParams.get('adult')).toBe('2');
    expect(url.searchParams.get('crn')).toBe('1');
    expect(url.searchParams.get('trip_sub1')).toBe('home_hotels');
    expect(url.searchParams.get('checkOut')! > url.searchParams.get('checkIn')!).toBe(true);
  });

  it('이름을 목록에서 안 고르고 그대로 다 쳐도 그 여행지로 인정한다', () => {
    renderForm();
    fireEvent.focus(destinationInput());
    fireEvent.change(destinationInput(), { target: { value: '파리' } });
    fireEvent.blur(destinationInput());
    fireEvent.click(screen.getByRole('button', { name: '호텔 검색' }));
    expect(new URL(openExternal.mock.calls[0][0] as string).searchParams.get('city')).toBe('192');
  });

  it('목록에 없는 글자는 검색되지 않고 안내가 뜬다', () => {
    renderForm();
    fireEvent.focus(destinationInput());
    fireEvent.change(destinationInput(), { target: { value: '아틀란티스' } });
    expect(screen.getByText('찾는 여행지가 없어요')).toBeInTheDocument();
    fireEvent.blur(destinationInput());
    fireEvent.click(screen.getByRole('button', { name: '호텔 검색' }));
    expect(openExternal).not.toHaveBeenCalled();
  });

  it('도시 목록에 없는 글자(지역·호텔 이름)로 검색하면 조용히 넘어가지 않고 안내와 트립닷컴 직접 검색 링크를 보여 준다', () => {
    renderForm();
    fireEvent.focus(destinationInput());
    fireEvent.change(destinationInput(), { target: { value: '신주쿠' } });
    fireEvent.blur(destinationInput());
    fireEvent.click(screen.getByRole('button', { name: '호텔 검색' }));

    expect(openExternal).not.toHaveBeenCalled();
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('목록에서 도시를 골라 주세요');
    const link = screen.getByRole('link', { name: /트립닷컴에서 검색/ });
    expect(link).toHaveAttribute(
      'href',
      'https://kr.trip.com/hotels/?Allianceid=10792895&SID=332524291&trip_sub1=home_hotels&trip_sub3=D20018770',
    );
    expect(link).toHaveAttribute('rel', 'sponsored noopener');

    // 도시를 고르면 안내가 사라진다
    fireEvent.focus(destinationInput());
    fireEvent.change(destinationInput(), { target: { value: '도' } });
    fireEvent.mouseDown(screen.getByRole('option', { name: /도쿄/ }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('객실은 성인 수를 넘길 수 없고, 성인을 줄이면 객실도 같이 줄어든다', () => {
    renderForm();
    fireEvent.click(screen.getByRole('button', { name: '성인 더하기' })); // 3명
    fireEvent.click(screen.getByRole('button', { name: '객실 더하기' })); // 2실
    fireEvent.click(screen.getByRole('button', { name: '객실 더하기' })); // 3실
    expect(screen.getByRole('button', { name: '객실 더하기' })).toBeDisabled(); // 성인 3명 → 최대 3실
    fireEvent.click(screen.getByRole('button', { name: '성인 빼기' })); // 2명 → 객실도 2실
    fireEvent.click(screen.getByRole('button', { name: '성인 빼기' })); // 1명 → 객실 1실
    expect(screen.getByRole('button', { name: '객실 빼기' })).toBeDisabled();
  });

  it('다음 여행이 있으면 그 도시와 기간을 미리 채운다', () => {
    const future = new Date();
    future.setDate(future.getDate() + 40);
    const start = future.toISOString().slice(0, 10);
    const end = new Date(future.getTime() + 3 * 86_400_000).toISOString().slice(0, 10);
    tripMock.value = { city_lat: 34.7, city_lng: 135.5, start_date: start, end_date: end }; // 오사카 근처
    renderForm();
    expect(destinationInput()).toHaveValue('오사카');
    fireEvent.click(screen.getByRole('button', { name: '호텔 검색' }));
    const url = new URL(openExternal.mock.calls[0][0] as string);
    expect(url.searchParams.get('city')).toBe('219');
    expect(url.searchParams.get('checkIn')).toBe(start);
    expect(url.searchParams.get('checkOut')).toBe(end);
  });
});
