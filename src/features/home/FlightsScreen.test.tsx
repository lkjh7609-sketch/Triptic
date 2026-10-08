import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import i18n from '@/shared/i18n';

vi.mock('@/shared/monitoring', () => ({ trackScreenView: () => {} }));
vi.mock('./HomeSectionTabs', () => ({ HomeSectionTabs: () => null }));
vi.mock('./FlightDeals', () => ({ FlightDeals: () => <div data-testid="deals" /> }));
vi.mock('./FlightsEssentials', () => ({ FlightsEssentials: () => <div data-testid="essentials" /> }));
vi.mock('./FlightThemes', () => ({ FlightThemes: () => <div data-testid="themes" /> }));
vi.mock('./MyrealtripFlightSearch', () => ({
  MyrealtripFlightSearch: ({ onSearch }: { onSearch: (f: unknown) => void }) => (
    <button
      type="button"
      data-testid="form"
      onClick={() => onSearch({ origin: 'SEL', originType: 'city', destination: 'TYO', destinationType: 'city', departDate: '2099-01-10', returnDate: null, adults: 1 })}
    >
      검색
    </button>
  ),
}));
vi.mock('./flights/FlightResults', () => ({
  FlightResults: ({ search }: { search: { origin: string; destination: string; departDate: string } }) => (
    <div data-testid="results">{`${search.origin}-${search.destination}@${search.departDate}`}</div>
  ),
}));

import { FlightsScreen } from './FlightsScreen';
import { markFlightsAutoSearch } from '@/features/plan/flightsAutoSearch';

const at = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <FlightsScreen />
    </MemoryRouter>,
  );

describe('항공 탭 — 모든 언어가 우리 검색 + 결과, 한국어만 아래 특가·유심', () => {
  beforeEach(async () => {
    sessionStorage.clear();
    Element.prototype.scrollIntoView = vi.fn();
    await i18n.changeLanguage('ko');
  });

  it('한국어: 폼 + 아래 특가·유심·테마 영역', () => {
    at('/flights');
    expect(screen.getByTestId('form')).toBeInTheDocument();
    expect(screen.getByTestId('deals')).toBeInTheDocument();
    expect(screen.getByTestId('essentials')).toBeInTheDocument();
    expect(screen.getByTestId('themes')).toBeInTheDocument();
  });

  it('외국어: 폼은 있고 한국어 전용 영역은 없고 "준비 중" 카드도 없다', async () => {
    await i18n.changeLanguage('en');
    at('/flights');
    expect(screen.getByTestId('form')).toBeInTheDocument();
    expect(screen.queryByTestId('deals')).toBeNull();
    expect(screen.queryByTestId('essentials')).toBeNull();
    expect(screen.queryByTestId('themes')).toBeNull();
    expect(screen.queryByText(/coming soon/i)).toBeNull();
  });

  it('처음엔 결과가 없고, 폼에서 검색하면 그 조건으로 결과를 보여 준다', () => {
    at('/flights');
    expect(screen.queryByTestId('results')).toBeNull();
    fireEvent.click(screen.getByTestId('form'));
    expect(screen.getByTestId('results')).toHaveTextContent('SEL-TYO@2099-01-10');
  });

  it('주소에 조건이 있어도 그냥 열면 자동 검색하지 않는다(새로고침·공유 링크 — 유료 호출)', () => {
    at('/flights?origin=SEL&destination=OSA&depart_date=2099-03-01&return_date=2099-03-05&adults=1');
    expect(screen.queryByTestId('results')).toBeNull();
  });

  it('일정에서 넘어온 경우(표시 있음)만 한 번 바로 검색하고, 표시는 지운다', () => {
    markFlightsAutoSearch();
    at('/flights?origin=SEL&destination=OSA&depart_date=2099-03-01&return_date=2099-03-05&adults=1');
    expect(screen.getByTestId('results')).toHaveTextContent('SEL-OSA@2099-03-01');
    expect(sessionStorage.getItem('triptic-flights-autosearch')).toBeNull();
  });

  it('표시가 있어도 주소 조건이 틀리면(지난 날짜) 검색하지 않는다', () => {
    markFlightsAutoSearch();
    at('/flights?origin=SEL&destination=OSA&depart_date=2020-03-01');
    expect(screen.queryByTestId('results')).toBeNull();
  });
});
