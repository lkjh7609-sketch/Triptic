import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@/shared/i18n';
import i18n from '@/shared/i18n';
import type { BoardFlight } from './boardParse';

const state = vi.hoisted(() => ({ data: undefined as unknown, isLoading: false, nowMin: 600, kac: undefined as unknown }));
vi.mock('./useAirportBoard', () => ({
  useAirportBoard: () => ({ data: state.data, isLoading: state.isLoading }),
  useKstMinutes: () => state.nowMin,
  useNowMs: () => Date.now(),
}));

vi.mock('./useKacBoard', () => ({
  useKacBoard: () => ({ data: state.kac, isLoading: false }),
}));

import { AirportBoard } from './AirportBoard';

const f = (over: Partial<BoardFlight>): BoardFlight => ({
  id: 'KE1',
  airline: '대한항공',
  scheduled: '1010',
  estimated: '1010',
  city: '도쿄/나리타',
  airportCode: 'NRT',
  terminal: 'P03',
  gate: '254',
  counter: 'A01-A08',
  carousel: '',
  exit: '',
  remark: '탑승준비',
  codeshares: [],
  stopovers: [],
  ...over,
});

function setBoard(
  over: Partial<{
    departures: BoardFlight[];
    arrivals: BoardFlight[];
    fetchedAt: string | null;
  }> = {},
) {
  state.data = {
    departures: [
      f({}),
      f({
        id: 'OZ2',
        airline: '아시아나항공',
        scheduled: '1020',
        estimated: '1100',
        remark: '지연',
        city: '오사카',
        airportCode: 'KIX',
        codeshares: [{ id: 'NH9', airline: '전일본공수' }],
      }),
      f({ id: 'OLD', scheduled: '0900', estimated: '0900', remark: '출발' }),
    ],
    arrivals: [
      f({
        id: 'CX426',
        airline: '캐세이퍼시픽항공',
        city: '홍콩',
        airportCode: 'HKG',
        carousel: '6',
        exit: 'B',
        gate: '24',
        remark: '도착',
        scheduled: '0950',
        estimated: '0950',
      }),
    ],
    fetchedAt: new Date().toISOString(),
    ...over,
  };
}

beforeEach(async () => {
  await i18n.changeLanguage('ko');
  state.isLoading = false;
  state.nowMin = 600; // 10:00
  setBoard();
});

describe('AirportBoard', () => {
  it('출발은 지금+40분 이후 편에서 시작하고(그 앞 편은 이전 쪽), 지난 지 오래된 편은 빠진다', () => {
    render(<AirportBoard desktop />);
    expect(screen.getByRole('heading', { name: '인천공항 실시간 출·도착' })).toBeInTheDocument();
    // 10:00 기준 — KE1(10:10)은 40분 안쪽이라 앞 쪽, OZ2(변경 11:00)부터 첫 화면
    expect(
      screen.getAllByRole('button', { name: /KE\d|OZ\d|OLD/ }).map((r) => r.textContent),
    ).toEqual([expect.stringContaining('OZ2')]);
    expect(screen.getByRole('button', { name: '2페이지' })).toHaveAttribute('aria-current', 'true');
    fireEvent.click(screen.getByRole('button', { name: '이전 페이지' }));
    expect(screen.getByRole('button', { name: /KE1/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /OLD/ })).not.toBeInTheDocument();
  });

  it('늦춰진 편은 예정 시각에 취소선, 변경 시각을 따로 보여 주고 상태 칩에 "지연"', () => {
    render(<AirportBoard desktop />);
    const row = screen.getByRole('button', { name: /OZ2/ });
    expect(within(row).getByText('10:20').className).toMatch(/timeOld/);
    expect(within(row).getByText('11:00')).toBeInTheDocument();
    expect(within(row).getByText('지연')).toBeInTheDocument();
    expect(within(row).getByText(/공동운항 1편/)).toBeInTheDocument();
  });

  it('앞당겨진 편은 취소선 없이 바뀐 시각만 보여 주고, 이미 떠난 편은 흐리게', () => {
    state.data = {
      departures: [f({ id: 'EARLY', scheduled: '1010', estimated: '1005', remark: '출발' })],
      arrivals: [],
      fetchedAt: new Date().toISOString(),
    };
    render(<AirportBoard desktop />);
    const row = screen.getByRole('button', { name: /EARLY/ });
    expect(within(row).getByText('10:05').className).toMatch(/timeMain/);
    expect(within(row).queryByText('10:10')).not.toBeInTheDocument();
    expect(row.className).toMatch(/rowDone/);
  });

  it('도착 탭으로 바꾸면 도착편과 수취대를 보여 준다', () => {
    render(<AirportBoard desktop />);
    fireEvent.click(screen.getByRole('button', { name: '도착' }));
    const row = screen.getByRole('button', { name: /CX426/ });
    expect(within(row).getByText('홍콩')).toBeInTheDocument();
    expect(within(row).getByText('6')).toBeInTheDocument();
    expect(screen.getByText('수취대')).toBeInTheDocument();
  });

  it('줄을 누르면 상세가 열리고(공동운항 편 포함), 닫기로 닫힌다. 바깥을 눌러도 닫히지 않는다', () => {
    render(<AirportBoard desktop />);
    fireEvent.click(screen.getByRole('button', { name: /OZ2/ }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('OZ2')).toBeInTheDocument();
    expect(within(dialog).getByText('제2터미널')).toBeInTheDocument();
    expect(within(dialog).getByText('NH9')).toBeInTheDocument();
    expect(within(dialog).getByText('체크인 카운터')).toBeInTheDocument();
    fireEvent.click(dialog.parentElement!);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('5줄씩 쪽으로 나뉘고 양옆 화살표와 아래 점으로 넘긴다 — 첫/끝 쪽에서는 화살표가 꺼진다', () => {
    state.data = {
      departures: Array.from({ length: 12 }, (_, i) =>
        f({ id: `KE${i + 10}`, scheduled: '1100', estimated: '1100' }),
      ),
      arrivals: [],
      fetchedAt: new Date().toISOString(),
    };
    render(<AirportBoard desktop />);
    const rows = () => screen.getAllByRole('button', { name: /KE\d+/ });
    expect(rows()).toHaveLength(5);
    expect(screen.getByRole('button', { name: '이전 페이지' })).toBeDisabled();
    expect(screen.getAllByRole('button', { name: /^\d+페이지$/ })).toHaveLength(3); // 점 3개(쪽 3개)
    fireEvent.click(screen.getByRole('button', { name: '다음 페이지' }));
    expect(rows()).toHaveLength(5);
    expect(screen.getByRole('button', { name: '2페이지' })).toHaveAttribute('aria-current', 'true');
    fireEvent.click(screen.getByRole('button', { name: '3페이지' })); // 점을 눌러도 간다
    expect(rows()).toHaveLength(2);
    expect(screen.getByRole('button', { name: '다음 페이지' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: '더 보기' })).not.toBeInTheDocument();
  });

  it('쪽 번호 글자는 없다 — 점만', () => {
    state.data = {
      departures: Array.from({ length: 12 }, (_, i) =>
        f({ id: `KE${i + 10}`, scheduled: '1100', estimated: '1100' }),
      ),
      arrivals: [],
      fetchedAt: new Date().toISOString(),
    };
    render(<AirportBoard desktop />);
    const dots = screen.getByRole('group', { name: '페이지' });
    expect(dots.textContent).toBe('');
  });

  it('모바일은 화살표 없이 점과 밀어 넘기기(스크롤 위치로 쪽이 바뀐다)', () => {
    state.data = {
      departures: Array.from({ length: 12 }, (_, i) =>
        f({ id: `KE${i + 10}`, scheduled: '1100', estimated: '1100' }),
      ),
      arrivals: [],
      fetchedAt: new Date().toISOString(),
    };
    const { container } = render(<AirportBoard desktop={false} />);
    expect(screen.queryByRole('button', { name: '다음 페이지' })).not.toBeInTheDocument();
    const track = container.querySelector('[class*="track"]') as HTMLElement;
    Object.defineProperty(track, 'clientWidth', { configurable: true, value: 300 });
    track.scrollLeft = 300;
    fireEvent.scroll(track);
    expect(screen.getByRole('button', { name: '2페이지' })).toHaveAttribute('aria-current', 'true');
    track.scrollLeft = 610;
    fireEvent.scroll(track);
    expect(screen.getByRole('button', { name: '3페이지' })).toHaveAttribute('aria-current', 'true');
  });

  it('지금 보이는 쪽 밖의 줄은 키보드·스크린리더에서 빠진다(inert)', () => {
    state.data = {
      departures: Array.from({ length: 12 }, (_, i) =>
        f({ id: `KE${i + 10}`, scheduled: '1100', estimated: '1100' }),
      ),
      arrivals: [],
      fetchedAt: new Date().toISOString(),
    };
    const { container } = render(<AirportBoard desktop />);
    const slides = container.querySelectorAll('[class*="slide"]');
    expect(slides).toHaveLength(3);
    expect(slides[0]).not.toHaveAttribute('inert');
    expect(slides[1]).toHaveAttribute('inert');
  });

  it('한 쪽이면 점이 없다. 탭을 바꾸면 처음 쪽으로 돌아온다', () => {
    render(<AirportBoard desktop />);
    fireEvent.click(screen.getByRole('button', { name: '이전 페이지' }));
    fireEvent.click(screen.getByRole('button', { name: '도착' }));
    expect(screen.queryByRole('group', { name: '페이지' })).not.toBeInTheDocument(); // 도착 1편뿐
    fireEvent.click(screen.getByRole('button', { name: '출발' }));
    expect(screen.getByRole('button', { name: '2페이지' })).toHaveAttribute('aria-current', 'true'); // 다시 +40분 쪽
  });

  it('도착은 +40분 기준 없이 맨 앞부터', () => {
    state.data = {
      departures: [],
      arrivals: [
        f({ id: 'AR1', scheduled: '1005', estimated: '1005', remark: '도착' }),
        f({ id: 'AR2', scheduled: '1100', estimated: '1100' }),
      ],
      fetchedAt: new Date().toISOString(),
    };
    render(<AirportBoard desktop />);
    fireEvent.click(screen.getByRole('button', { name: '도착' }));
    expect(screen.getAllByRole('button', { name: /AR\d/ })).toHaveLength(2);
    expect(screen.queryByRole('navigation', { name: '페이지' })).not.toBeInTheDocument();
  });

  it('받은 값이 없으면 섹션을 그리지 않는다. 받는 중에는 빈 틀(스켈레톤)만', () => {
    state.data = undefined;
    const { container, rerender } = render(<AirportBoard desktop />);
    expect(container).toBeEmptyDOMElement();
    state.data = { departures: [], arrivals: [], fetchedAt: null };
    rerender(<AirportBoard desktop />);
    expect(container).toBeEmptyDOMElement();
    state.isLoading = true;
    rerender(<AirportBoard desktop />);
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('오래 갱신하지 못했으면 마지막으로 받은 시각과 함께 안내한다', () => {
    setBoard({ fetchedAt: new Date(Date.now() - 40 * 60_000).toISOString() });
    render(<AirportBoard desktop />);
    expect(screen.getByText(/최근 정보를 받지 못하고 있어요/)).toBeInTheDocument();
  });

  it('지금 이후 편이 없으면 안내 문구', () => {
    state.nowMin = 1300;
    render(<AirportBoard desktop />);
    expect(screen.getByText('지금 이후 출발 예정 편이 없어요.')).toBeInTheDocument();
  });

  it('영어에서는 공항 코드를 크게, 이름(한국어)을 작게 보여 준다', async () => {
    await i18n.changeLanguage('en');
    render(<AirportBoard desktop />);
    const row = screen.getByRole('button', { name: /OZ2/ });
    expect(within(row).getByText('KIX').className).toMatch(/city/);
    expect(within(row).getByText('오사카')).toBeInTheDocument();
    expect(within(row).getByText('Delayed')).toBeInTheDocument();
  });

  it('모바일에서도 같은 줄이 나오고 터미널·게이트는 상태 아래 작은 글씨로', () => {
    render(<AirportBoard desktop={false} />);
    const row = screen.getByRole('button', { name: /OZ2/ }); // 처음 쪽은 지금+40분 편부터
    expect(within(row).getByText('T2 · 254')).toBeInTheDocument();
    expect(screen.queryByText('터미널')).not.toBeInTheDocument(); // 열 머리줄은 PC만
  });

  it('김포 등 한국공항공사 공항 — 제목·출처가 그 공항으로, 터미널 칸은 국내선/국제선, 도착 칸은 게이트', async () => {
    state.kac = {
      boards: {
        GMP: {
          departures: [f({ id: 'LJ513', airline: '진에어', city: '제주', airportCode: 'CJU', terminal: 'DOM', gate: '6', counter: '', remark: '수속중', codeshares: [{ id: 'KE5213', airline: '대한항공' }] })],
          arrivals: [f({ id: '7C130', airline: '제주항공', city: '제주', airportCode: 'CJU', terminal: 'DOM', gate: '4', carousel: '', exit: '', remark: '도착', scheduled: '0950', estimated: '0950' })],
        },
      },
      fetchedAt: new Date().toISOString(),
      stale: false,
    };
    render(<AirportBoard desktop airport="gmp" />);
    expect(screen.getByRole('heading', { level: 2, name: '김포국제공항 실시간 출·도착' })).toBeInTheDocument();
    expect(screen.getByText(/출처: 한국공항공사/)).toBeInTheDocument();
    const row = screen.getByRole('button', { name: /LJ513/ });
    expect(row).toHaveTextContent('국내선');
    expect(row).toHaveTextContent('수속 중');
    expect(row).toHaveTextContent('공동운항 1편');
    fireEvent.click(screen.getByRole('button', { name: '도착' }));
    expect(screen.getByText('게이트')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /7C130/ })).toHaveTextContent('4');
    fireEvent.click(screen.getByRole('button', { name: /7C130/ }));
    expect(within(screen.getByRole('dialog')).getByText(/한국공항공사 공공데이터 기준/)).toBeInTheDocument();
  });

  it('한국공항공사 응답에 그 공항이 없으면(지금 운항 없음) 빈 전광판 안내', () => {
    state.kac = { boards: {}, fetchedAt: new Date().toISOString(), stale: false };
    render(<AirportBoard desktop airport="tae" />);
    expect(screen.getByText('지금 이후 출발 예정 편이 없어요.')).toBeInTheDocument();
  });
});
