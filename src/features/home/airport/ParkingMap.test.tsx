import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@/shared/i18n';
import type { ParkingLot } from './parkingParse';

const state = vi.hoisted(() => ({ data: undefined as unknown, isLoading: false, desktop: true }));
vi.mock('./useAirportParking', () => ({
  useAirportParking: () => ({ data: state.data, isLoading: state.isLoading }),
}));
vi.mock('@/shared/hooks/useMediaQuery', () => ({
  // 움직임 줄이기 질의는 true(세어 올라가기·막대 애니메이션 없이 바로 최종 값)
  useMediaQuery: (q: string) => (q.includes('reduced-motion') ? true : state.desktop),
}));

import { ParkingMap } from './ParkingMap';

const lot = (over: Partial<ParkingLot> & Pick<ParkingLot, 'airport' | 'name'>): ParkingLot => ({
  total: 1000,
  occupied: 500,
  congestion: 'smooth',
  updatedAt: '2026-10-04T19:32:00+09:00',
  ...over,
});

function setLots(lots: ParkingLot[]) {
  state.data = { lots, fetchedAt: { kac: '2026-10-04T10:32:00Z', icn: '2026-10-04T10:32:00Z' }, stale: { kac: false, icn: false } };
}

beforeEach(() => {
  state.isLoading = false;
  state.desktop = true;
  setLots([
    lot({ airport: 'ICN', name: 'T1 단기주차장지상층', total: 1052, occupied: 1139, congestion: 'full' }),
    lot({ airport: 'ICN', name: 'T1 단기주차장지하1층', total: 520, occupied: 557, congestion: 'full' }),
    lot({ airport: 'ICN', name: 'T1 단기주차장지하2층', total: 1334, occupied: 1456, congestion: 'full' }),
    lot({ airport: 'ICN', name: 'T1 단기주차장지하3층', total: 639, occupied: 389, congestion: 'smooth' }),
    lot({ airport: 'ICN', name: 'T1 장기 P1 주차장', total: 2769, occupied: 2700, congestion: 'full' }),
    lot({ airport: 'ICN', name: 'T2 예약 주차장', total: 3779, occupied: 2321, congestion: 'smooth' }),
    lot({ airport: 'GMP', name: '국내선 제1주차장', total: 2279, occupied: 2057, congestion: 'busy' }),
    lot({ airport: 'GMP', name: '화물청사', total: 737, occupied: 243 }),
    lot({ airport: 'GMP', name: '국내선 제3주차장', total: 300, occupied: 100 }),
  ]);
});

describe('ParkingMap — 주차장 평면도', () => {
  it('블록마다 남은 자리와 혼잡도를 글자로도 알리고(초과 주차는 0대·만차), 오른쪽 목록과 합계가 같다', () => {
    render(<ParkingMap airport="icn" />);
    // 단기주차장: 층마다 0 아래로 자른 뒤 더한다 — 1F·B1·B2는 넘쳐서 0, B3만 250
    const short = screen.getByRole('button', { name: '단기주차장, 남은 자리 250대, 혼잡' });
    expect(short).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /P1 장기주차장, 남은 자리 69대, 만차/ })).toBeInTheDocument();
    // 데이터가 없는 블록은 '–'
    expect(screen.getByRole('button', { name: /P3 장기주차장, 남은 자리 0대/ })).toHaveTextContent('–');
    // 인천 전체(T1+T2) 여객 주차장 합계
    expect(screen.getByText('여객 주차장 남은 자리 1,777대')).toBeInTheDocument();
    expect(screen.getByText('19:32 기준 · 출처: 인천국제공항공사')).toBeInTheDocument();
  });

  it('블록을 누르면 상세(남은 자리·점유율·층별 스택)가 열리고, 다시 누르거나 닫기로 접힌다', () => {
    render(<ParkingMap airport="icn" />);
    const short = screen.getByRole('button', { name: /^단기주차장, 남은 자리/ });
    fireEvent.click(short);
    expect(short).toHaveAttribute('aria-pressed', 'true');
    const detail = screen.getByRole('region', { name: '단기주차장' });
    expect(within(detail).getByText('250')).toBeInTheDocument();
    expect(within(detail).getByText(/점유율 93%/)).toBeInTheDocument();
    const floors = within(detail).getAllByRole('listitem');
    expect(floors.map((f) => f.textContent)).toEqual(['1F0대만차', 'B10대만차', 'B20대만차', 'B3250대원활']);
    fireEvent.click(within(detail).getByRole('button', { name: '닫기' }));
    expect(screen.queryByRole('region', { name: '단기주차장' })).not.toBeInTheDocument();
  });

  it('키보드로도 고른다(Enter·Space), Esc로 푼다', () => {
    render(<ParkingMap airport="icn" />);
    const p1 = screen.getByRole('button', { name: /^P1 장기주차장, 남은 자리/ });
    expect(p1).toHaveAttribute('tabindex', '0');
    fireEvent.keyDown(p1, { key: 'Enter' });
    expect(screen.getByRole('region', { name: 'P1 장기주차장' })).toBeInTheDocument();
    fireEvent.keyDown(p1, { key: 'Escape' });
    expect(screen.queryByRole('region', { name: 'P1 장기주차장' })).not.toBeInTheDocument();
    fireEvent.keyDown(p1, { key: ' ' });
    expect(screen.getByRole('region', { name: 'P1 장기주차장' })).toBeInTheDocument();
  });

  it('인천은 T1/T2 전환 — T2로 바꾸면 T2 주차장만 그리고 선택은 풀린다', () => {
    render(<ParkingMap airport="icn" />);
    fireEvent.click(screen.getByRole('button', { name: /^단기주차장, 남은 자리/ }));
    fireEvent.click(screen.getByRole('button', { name: '제2여객터미널' }));
    expect(screen.getByRole('button', { name: '제2여객터미널' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /^예약주차장, 남은 자리 1,458대, 원활/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^P1 장기주차장/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '단기주차장' })).not.toBeInTheDocument();
  });

  it('화물은 숨기고, 배치에 없는 새 주차장은 기타 주차장 목록으로 보여 준다', () => {
    render(<ParkingMap airport="gmp" />);
    expect(screen.getByRole('button', { name: /^국내선 제1주차장, 남은 자리 222대, 혼잡/ })).toBeInTheDocument();
    expect(screen.queryByText('화물청사', { selector: 'li *' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '기타 주차장' })).toBeInTheDocument();
    expect(screen.getByText('국내선 제3주차장')).toBeInTheDocument();
    // 한 평면도뿐이면 터미널 전환 버튼이 없다
    expect(screen.queryByRole('group', { name: '터미널 선택' })).not.toBeInTheDocument();
  });

  it('받은 값이 없으면 안내, 평면도가 없는 공항이면 아무것도 그리지 않는다', () => {
    setLots([]);
    render(<ParkingMap airport="tae" />);
    expect(screen.getByText('주차 정보를 아직 받지 못했어요. 잠시 뒤 다시 확인해 주세요.')).toBeInTheDocument();
    const { container } = render(<ParkingMap airport="zzz" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('모바일은 평면도에 숫자만, 이름은 아래 목록으로', () => {
    state.desktop = false;
    render(<ParkingMap airport="gmp" />);
    const block = screen.getByRole('button', { name: /^국내선 제1주차장, 남은 자리/ });
    expect(block).toHaveTextContent('222');
    expect(block).not.toHaveTextContent('국내선 제1주차장');
    expect(screen.getAllByRole('button', { name: /국내선 제1주차장/ }).length).toBe(2); // 블록 + 목록 줄
  });
});
