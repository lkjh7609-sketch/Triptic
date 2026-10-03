import { fireEvent, render, screen, within } from '@testing-library/react';
import { useRef } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@/shared/i18n';
import i18n from '@/shared/i18n';
import type { Airport } from './airports/airportData';

const state = vi.hoisted(() => ({
  airports: undefined as Airport[] | undefined,
  loading: false,
  autocompleteOptions: [] as unknown[],
}));
vi.mock('./airports/useAirports', () => ({
  useAirports: () => ({ data: state.airports, isLoading: state.loading }),
}));
vi.mock('./map/usePlaceAutocomplete', () => ({
  usePlaceAutocomplete: (_: unknown, options: unknown) => {
    state.autocompleteOptions.push(options);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return { inputRef: useRef<HTMLInputElement>(null), ready: true };
  },
}));
vi.mock('@/features/settings/FeedbackModal', () => ({
  FeedbackModal: ({ initialBody }: { initialBody?: string }) => (
    <div data-testid="feedback">{initialBody}</div>
  ),
}));

import { FlightModal } from './FlightModal';

const airports: Airport[] = [
  {
    iata: 'ICN',
    country_code: 'KR',
    name: { ko: '인천국제공항', en: 'Incheon International Airport' },
    city: { ko: '서울', en: 'Seoul' },
    lat: 37.46,
    lng: 126.44,
    timezone: 'Asia/Seoul',
  },
  {
    iata: 'NRT',
    country_code: 'JP',
    name: { ko: '나리타 국제공항', en: 'Narita International Airport' },
    city: { ko: '도쿄', en: 'Tokyo' },
    lat: 35.77,
    lng: 140.39,
    timezone: 'Asia/Tokyo',
  },
];

const empty = { outbound: null, return: null };

beforeEach(async () => {
  await i18n.changeLanguage('ko');
  state.airports = airports;
  state.loading = false;
  state.autocompleteOptions = [];
});

function pick(box: HTMLElement, query: string) {
  fireEvent.change(box, { target: { value: query } });
  fireEvent.mouseDown(screen.getAllByRole('option')[0]);
}

describe('FlightModal — 공항은 목록에서', () => {
  it('목록에서 출발·도착 공항을 고르면 공항 코드와 함께 저장된다', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <FlightModal
        flightsData={empty}
        startDate="2026-11-01"
        endDate="2026-11-05"
        onClose={() => {}}
        onSave={onSave}
      />,
    );
    const outboundCard = screen.getByText('출국').closest('div')!.parentElement as HTMLElement;
    const boxes = screen.getAllByRole('combobox');
    expect(boxes).toHaveLength(4); // 출국(출발·도착) + 귀국(출발·도착)
    fireEvent.change(screen.getAllByPlaceholderText('예: OZ102')[0], {
      target: { value: 'oz102' },
    });
    pick(boxes[0], 'icn');
    pick(boxes[1], 'nrt');
    fireEvent.click(within(outboundCard).getByRole('button', { name: '이 항공편 정보 적용' }));
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await Promise.resolve();
    const saved = onSave.mock.calls[0][0];
    expect(saved.outbound.flightNo).toBe('OZ102');
    expect(saved.outbound.dep).toMatchObject({ iata: 'ICN', lat: 37.46, lng: 126.44 });
    expect(saved.outbound.arr).toMatchObject({ iata: 'NRT' });
  });

  it('목록에서 고르지 않고 글자만 쓰면 적용되지 않고 안내가 뜬다', () => {
    render(<FlightModal flightsData={empty} onClose={() => {}} onSave={vi.fn()} />);
    const boxes = screen.getAllByRole('combobox');
    fireEvent.change(screen.getAllByPlaceholderText('예: OZ102')[0], { target: { value: 'KE1' } });
    fireEvent.change(boxes[0], { target: { value: '인천' } });
    fireEvent.click(screen.getAllByRole('button', { name: '이 항공편 정보 적용' })[0]);
    expect(screen.getByText('출발·도착 공항은 목록에서 선택해 주세요.')).toBeInTheDocument();
  });

  it('목록에 없는 공항은 "추가 요청하기"로 문의하기 창이 열린다(검색어가 머리말에 담김)', () => {
    render(<FlightModal flightsData={empty} onClose={() => {}} onSave={vi.fn()} />);
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: '없는공항' } });
    fireEvent.click(screen.getByRole('button', { name: '추가 요청하기' }));
    expect(screen.getByTestId('feedback')).toHaveTextContent('[공항 추가 요청] 없는공항');
  });

  it('목록을 쓰는 동안 Google 검색 스크립트는 켜지 않는다', () => {
    render(<FlightModal flightsData={empty} onClose={() => {}} onSave={vi.fn()} />);
    expect(
      state.autocompleteOptions.every((o) => (o as { enabled?: boolean }).enabled === false),
    ).toBe(true);
  });

  it('공항 목록을 못 받으면(표 없음·오류) 예전 Google 입력칸으로 돌아간다', () => {
    state.airports = undefined;
    render(<FlightModal flightsData={empty} onClose={() => {}} onSave={vi.fn()} />);
    expect(screen.queryAllByRole('combobox')).toHaveLength(0);
    expect(screen.getAllByPlaceholderText('예: 인천국제공항').length).toBeGreaterThan(0);
    expect((state.autocompleteOptions.at(-1) as { enabled?: boolean }).enabled).toBe(true);
  });
});
