import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HotelsScreen } from './HotelsScreen';

describe('HotelsScreen', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('화면 전환이 끝나기 전에는 iframe을 부르지 않는다(위젯 → 배너 순서)', () => {
    vi.useFakeTimers();
    const { container } = render(
      <MemoryRouter>
        <HotelsScreen />
      </MemoryRouter>,
    );
    expect(container.querySelectorAll('iframe')).toHaveLength(0);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(container.querySelectorAll('iframe')).toHaveLength(1);
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(container.querySelectorAll('iframe')).toHaveLength(4);
  });

  it('트립닷컴 검색 위젯(430×645)과 추천 호텔 배너 3개(300×250), Powered by Trip.com이 있다', () => {
    vi.useFakeTimers();
    const { container } = render(
      <MemoryRouter>
        <HotelsScreen />
      </MemoryRouter>,
    );
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    const widget = screen.getByTitle('트립닷컴 호텔 검색');
    expect(widget).toHaveAttribute('src', 'https://kr.trip.com/partners/ad/S20018532?Allianceid=10792895&SID=332524291&trip_sub1=home_hotels');
    expect(widget).toHaveAttribute('width', '430');
    expect(widget).toHaveAttribute('height', '645');
    expect(widget).not.toHaveAttribute('sandbox'); // 걸면 위젯이 결과 창을 못 연다

    const all = Array.from(container.querySelectorAll('iframe'));
    expect(all).toHaveLength(4);
    const cards = all.filter((f) => f !== widget);
    expect(cards.map((f) => new URL(f.src).searchParams.get('trip_sub1'))).toEqual(['home_hotels_card1', 'home_hotels_card2', 'home_hotels_card3']);
    expect(cards.map((f) => new URL(f.src).pathname)).toEqual(['/partners/ad/DB20019386', '/partners/ad/DB20019407', '/partners/ad/DB20019414']);
    for (const f of cards) {
      expect(f).toHaveAttribute('width', '300');
      expect(f).toHaveAttribute('height', '250');
      expect(f).toHaveAttribute('loading', 'lazy');
    }
    expect(screen.getByText(/Powered by/)).toBeInTheDocument();
    expect(screen.getByText('Trip.com')).toBeInTheDocument();
  });
});
