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
const lookup = vi.hoisted(() => ({
  signedIn: true,
  result: null as unknown,
  calls: [] as unknown[][],
}));
vi.mock('./flightLookup/flightLookupService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./flightLookup/flightLookupService')>()),
  lookupFlightSchedule: async (no: string, date: string) => {
    lookup.calls.push([no, date]);
    if (lookup.result instanceof Error) throw lookup.result;
    return lookup.result;
  },
}));
vi.mock('@/features/auth/loginPrompt', () => ({ requireLogin: () => lookup.signedIn }));
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
  lookup.signedIn = true;
  lookup.result = null;
  lookup.calls = [];
});

function pick(box: HTMLElement, query: string) {
  fireEvent.change(box, { target: { value: query } });
  fireEvent.mouseDown(screen.getAllByRole('option')[0]);
}

/** 첫 화면은 편명·날짜·불러오기만 — 모든 카드의 [직접 입력하기]를 눌러 입력 칸을 펼친다 */
function openManualAll() {
  screen.getAllByRole('button', { name: '직접 입력하기' }).forEach((b) => fireEvent.click(b));
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
    expect(screen.queryAllByRole('combobox')).toHaveLength(0); // 처음엔 직접 입력 칸이 접혀 있다
    openManualAll();
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
    openManualAll();
    const boxes = screen.getAllByRole('combobox');
    fireEvent.change(screen.getAllByPlaceholderText('예: OZ102')[0], { target: { value: 'KE1' } });
    fireEvent.change(boxes[0], { target: { value: '인천' } });
    fireEvent.click(screen.getAllByRole('button', { name: '이 항공편 정보 적용' })[0]);
    expect(screen.getByText('출발·도착 공항은 목록에서 선택해 주세요.')).toBeInTheDocument();
  });

  it('목록에 없는 공항은 "추가 요청하기"로 문의하기 창이 열린다(검색어가 머리말에 담김)', () => {
    render(<FlightModal flightsData={empty} onClose={() => {}} onSave={vi.fn()} />);
    openManualAll();
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
    openManualAll();
    expect(screen.queryAllByRole('combobox')).toHaveLength(0);
    expect(screen.getAllByPlaceholderText('예: 인천국제공항').length).toBeGreaterThan(0);
    expect((state.autocompleteOptions.at(-1) as { enabled?: boolean }).enabled).toBe(true);
  });
});

describe('FlightModal — 편명으로 불러오기', () => {
  const found = {
    found: true,
    flight: {
      flightNo: 'KE623',
      date: '2026-11-01',
      airlineKo: '대한항공',
      airlineCode: 'KE',
      dep: { iata: 'ICN', nameKo: '인천', time: '18:50', terminal: 't2' },
      arr: { iata: 'NRT', nameKo: '나리타', time: '21:05', terminal: null },
      source: 'icn',
    },
  };

  it('불러오면 항공사·공항·시간·터미널이 채워지고, 적용·저장하면 터미널과 항공사 코드가 함께 저장된다', async () => {
    lookup.result = found;
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<FlightModal flightsData={empty} startDate="2026-11-01" endDate="2026-11-05" onClose={() => {}} onSave={onSave} />);
    const outboundCard = screen.getByText('출국').closest('div')!.parentElement as HTMLElement;
    fireEvent.change(screen.getAllByPlaceholderText('예: OZ102')[0], { target: { value: 'ke623' } });
    fireEvent.click(within(outboundCard).getByRole('button', { name: '편명으로 불러오기' }));
    expect(await screen.findByText('불러왔어요. 내용을 확인하고 필요하면 고쳐 주세요.')).toBeInTheDocument();
    expect(lookup.calls).toEqual([['KE623', '2026-11-01']]);
    // 불러온 결과는 요약 한 줄로 — 입력 칸은 접힌 채 [적용]·[직접 수정]
    expect(within(outboundCard).getByText(/ICN T2 18:50 출발 → NRT 21:05 도착/)).toBeInTheDocument();
    expect(screen.queryAllByRole('combobox')).toHaveLength(0);
    fireEvent.click(within(outboundCard).getByRole('button', { name: '이 항공편 정보 적용' }));
    expect(screen.getByText(/ICN T2 18:50 출발 → NRT 21:05 도착/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await Promise.resolve();
    const saved = onSave.mock.calls[0][0].outbound;
    expect(saved).toMatchObject({ flightNo: 'KE623', date: '2026-11-01', airline: '대한항공', airlineCode: 'KE', manual: false });
    expect(saved.dep).toMatchObject({ iata: 'ICN', time: '18:50', terminal: 't2' });
    expect(saved.arr).toMatchObject({ iata: 'NRT', time: '21:05' });
    expect(saved.arr.terminal).toBeUndefined();
  });

  it('영어 화면에서는 저장된 한국어 대신 항공사 공식 영어 이름이 요약에 나온다', async () => {
    lookup.result = found;
    await i18n.changeLanguage('en');
    render(<FlightModal flightsData={empty} startDate="2026-11-01" onClose={() => {}} onSave={vi.fn()} />);
    fireEvent.change(screen.getAllByPlaceholderText('e.g. OZ102')[0], { target: { value: 'KE623' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Look up by flight number' })[0]);
    await screen.findByText(/Loaded\./);
    fireEvent.click(screen.getAllByRole('button', { name: /Apply/ })[0]);
    expect(screen.getByText(/^Korean Air · /)).toBeInTheDocument();
  });

  it('스케줄이 아직 공개되지 않은 날짜면 안내가 뜨고 입력칸은 그대로 남는다', async () => {
    lookup.result = { found: false, reason: 'not_published' };
    render(<FlightModal flightsData={empty} startDate="2027-02-01" onClose={() => {}} onSave={vi.fn()} />);
    fireEvent.change(screen.getAllByPlaceholderText('예: OZ102')[0], { target: { value: 'KE623' } });
    fireEvent.click(screen.getAllByRole('button', { name: '편명으로 불러오기' })[0]);
    expect(await screen.findByText('이 날짜의 스케줄은 아직 공개되지 않았어요. 아래에 직접 입력해 주세요.')).toBeInTheDocument();
    // 못 찾으면 그 카드의 직접 입력 칸(출발·도착 공항)이 저절로 펼쳐진다
    expect(screen.getAllByRole('combobox')).toHaveLength(2);
  });

  it('로그인하지 않았으면 조회하지 않고 로그인 안내로 넘어간다', () => {
    lookup.signedIn = false;
    render(<FlightModal flightsData={empty} startDate="2026-11-01" onClose={() => {}} onSave={vi.fn()} />);
    fireEvent.change(screen.getAllByPlaceholderText('예: OZ102')[0], { target: { value: 'KE623' } });
    fireEvent.click(screen.getAllByRole('button', { name: '편명으로 불러오기' })[0]);
    expect(lookup.calls).toEqual([]);
  });

  it('편명을 비워 두면 안내만 뜨고 조회하지 않는다', () => {
    render(<FlightModal flightsData={empty} startDate="2026-11-01" onClose={() => {}} onSave={vi.fn()} />);
    fireEvent.click(screen.getAllByRole('button', { name: '편명으로 불러오기' })[0]);
    expect(screen.getAllByText('편명을 입력해 주세요.').length).toBeGreaterThan(0);
    expect(lookup.calls).toEqual([]);
  });

  it('불러온 뒤 시간을 고쳐 저장하면 직접 입력으로 표시된다', async () => {
    lookup.result = found;
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<FlightModal flightsData={empty} startDate="2026-11-01" onClose={() => {}} onSave={onSave} />);
    const outboundCard = screen.getByText('출국').closest('div')!.parentElement as HTMLElement;
    fireEvent.change(screen.getAllByPlaceholderText('예: OZ102')[0], { target: { value: 'KE623' } });
    fireEvent.click(within(outboundCard).getByRole('button', { name: '편명으로 불러오기' }));
    await screen.findByText('불러왔어요. 내용을 확인하고 필요하면 고쳐 주세요.');
    fireEvent.click(within(outboundCard).getByRole('button', { name: '직접 수정' }));
    fireEvent.change(within(outboundCard).getByLabelText('출발 시각'), { target: { value: '19:10' } });
    fireEvent.click(within(outboundCard).getByRole('button', { name: '이 항공편 정보 적용' }));
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await Promise.resolve();
    expect(onSave.mock.calls[0][0].outbound).toMatchObject({ manual: true });
    expect(onSave.mock.calls[0][0].outbound.dep.time).toBe('19:10');
  });

  it('밤새 인천에 도착하는 귀국편은 날짜가 인천 도착일로 맞춰지고 안내가 뜬다', async () => {
    lookup.result = { ...found, flight: { ...found.flight, flightNo: 'KE644', date: '2026-11-06' } };
    render(<FlightModal flightsData={empty} startDate="2026-11-01" endDate="2026-11-05" onClose={() => {}} onSave={vi.fn()} />);
    const returnCard = screen.getByText('귀국').closest('div')!.parentElement as HTMLElement;
    fireEvent.change(within(returnCard).getByPlaceholderText('예: OZ102'), { target: { value: 'KE644' } });
    fireEvent.click(within(returnCard).getByRole('button', { name: '편명으로 불러오기' }));
    expect(await screen.findByText(/인천 도착일은 2026-11-06이에요/)).toBeInTheDocument();
    expect(lookup.calls).toEqual([['KE644', '2026-11-05']]);
    expect(within(returnCard).getByRole('button', { name: /비행 날짜/ })).toHaveTextContent('11월 6일');
  });

  it('날짜 칸을 누르면 달력 시트가 열리고, 하루를 고르면 닫히며 그 날짜로 조회한다', async () => {
    lookup.result = { ...found, flight: { ...found.flight, date: '2026-11-03' } };
    render(<FlightModal flightsData={empty} startDate="2026-11-01" endDate="2026-11-05" onClose={() => {}} onSave={vi.fn()} />);
    const outboundCard = screen.getByText('출국').closest('div')!.parentElement as HTMLElement;
    fireEvent.click(within(outboundCard).getByRole('button', { name: /비행 날짜/ }));
    const sheet = screen.getByRole('dialog', { name: '날짜 선택' });
    fireEvent.click(within(sheet).getByRole('button', { name: '3' }));
    expect(screen.queryByRole('dialog', { name: '날짜 선택' })).not.toBeInTheDocument();
    expect(within(outboundCard).getByRole('button', { name: /비행 날짜/ })).toHaveTextContent('11월 3일');
    fireEvent.change(within(outboundCard).getByPlaceholderText('예: OZ102'), { target: { value: 'KE623' } });
    fireEvent.click(within(outboundCard).getByRole('button', { name: '편명으로 불러오기' }));
    await screen.findByText(/불러왔어요/);
    expect(lookup.calls).toEqual([['KE623', '2026-11-03']]);
  });
});
