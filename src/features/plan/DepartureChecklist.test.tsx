import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TripRow } from '@/shared/api/tripService';
import { CHECKLIST_PAGES, firstIncompletePage, isPageComplete, migrateChecked, requiredItems } from './checklistData';

vi.mock('@/shared/api/tripService', () => ({
  tripService: { toLocalProject: () => ({ flights: { outbound: null, return: null }, hotels: {} }) },
}));
vi.mock('./flightsSearchLink', () => ({ openFlightsSearchForTrip: async () => {}, useTripFlightsLink: () => undefined }));

import { DepartureChecklist } from './DepartureChecklist';

const trip = { id: 'trip-1' } as TripRow;

function renderChecklist() {
  return render(
    <MemoryRouter>
      <DepartureChecklist trip={trip} />
    </MemoryRouter>,
  );
}

/** 지금 페이지의 선택 안 한 체크박스를 전부 체크한다 */
function checkAllVisible() {
  for (const box of screen.getAllByRole('checkbox')) {
    if (!(box as HTMLInputElement).checked) fireEvent.click(box);
  }
}

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('checklistData', () => {
  it('4페이지, 선택(꿀템) 항목은 마치는 데 필요 없다', () => {
    expect(CHECKLIST_PAGES).toHaveLength(4);
    const last = CHECKLIST_PAGES[3];
    const required = requiredItems(last).map((i) => i.key);
    expect(required).toEqual(['basicMeds', 'topicals', 'prescription']);
    expect(isPageComplete(last, (key) => required.includes(key))).toBe(true);
  });

  it('항목 키는 겹치지 않는다', () => {
    const keys = CHECKLIST_PAGES.flatMap((p) => p.groups.flatMap((g) => g.items.map((i) => i.key)));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('예전 "환전·카드"(money) 체크는 카드·환전 둘 다로 옮겨진다', () => {
    expect(migrateChecked(['passport', 'money'])).toEqual(expect.arrayContaining(['passport', 'card', 'cash']));
    expect(migrateChecked(['passport', 'money'])).not.toContain('money');
  });

  it('처음엔 안 마친 첫 페이지, 다 마쳤으면 마지막', () => {
    expect(firstIncompletePage(() => false)).toBe(0);
    expect(firstIncompletePage(() => true)).toBe(3);
    const page1 = new Set(requiredItems(CHECKLIST_PAGES[0]).map((i) => i.key));
    expect(firstIncompletePage((key) => page1.has(key))).toBe(1);
  });
});

describe('DepartureChecklist', () => {
  it('1/4부터 시작하고 이전·다음 버튼으로 오간다', () => {
    renderChecklist();
    expect(screen.getByText('1/4')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '필수 서류 및 결제 수단' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /이전/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /다음/ }));
    expect(screen.getByText('2/4')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '전자기기 및 통신' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /이전/ }));
    expect(screen.getByText('1/4')).toBeInTheDocument();
  });

  it('한 페이지를 다 체크하면 잠깐 뒤 다음 페이지로 넘어간다', () => {
    renderChecklist();
    checkAllVisible();
    expect(screen.getByText('1/4')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(screen.getByText('2/4')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('triptic.checklist.trip-1')!)).toContain('passport');
  });

  it('전자기기 페이지: 기내/위탁 표시가 붙는다', () => {
    renderChecklist();
    fireEvent.click(screen.getByRole('button', { name: /다음/ }));
    expect(screen.getAllByText('기내').length).toBeGreaterThanOrEqual(4);
    expect(screen.getAllByText('위탁').length).toBeGreaterThanOrEqual(3);
  });

  it('마지막 페이지: 선택 항목은 체크 안 해도 마치고, 마치면 마지막 확인 경고가 나타나 확인이 저장된다', () => {
    localStorage.setItem(
      'triptic.checklist.trip-1',
      JSON.stringify(CHECKLIST_PAGES.slice(0, 3).flatMap((p) => requiredItems(p).map((i) => i.key))),
    );
    renderChecklist();
    // 앞 3페이지는 마쳤으니 4/4에서 시작
    expect(screen.getByText('4/4')).toBeInTheDocument();
    expect(screen.queryByText('출발 전 마지막 확인')).not.toBeInTheDocument();
    for (const name of [/기본 상비약/, /외용제/, /개인 처방약/]) fireEvent.click(screen.getByRole('checkbox', { name }));
    expect(screen.getByText('선택')).toBeInTheDocument();
    expect(screen.getByText('출발 전 마지막 확인')).toBeInTheDocument();
    expect(screen.getByText(/개당 100ml 이하, 총 1L 지퍼백 1개/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '확인했어요' }));
    expect(screen.getByText('모두 챙겼어요')).toBeInTheDocument();
    expect(localStorage.getItem('triptic.checklist.trip-1.ack')).toBe('1');
  });

  it('예전에 저장한 "환전·카드" 체크는 새 목록에서도 체크돼 있다', () => {
    localStorage.setItem('triptic.checklist.trip-1', JSON.stringify(['money', 'passport']));
    renderChecklist();
    expect(screen.getByRole('checkbox', { name: /해외 결제 가능한 신용/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /현지 화폐 소액 환전/ })).toBeChecked();
  });
});
