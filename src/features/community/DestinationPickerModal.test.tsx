import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@/shared/i18n';
import { DestinationPickerModal } from './DestinationPickerModal';
import type { Destination } from './types';

function dest(id: string, name: string, country_code: string, over: Partial<Destination> = {}): Destination {
  return { id, name, country_code, slug: id, lat: 0, lng: 0, timezone: 'UTC', currency: null, cover_url: null, is_featured: false, sort_order: 0, post_count: 0, ...over };
}

const list = [
  dest('tokyo', '도쿄', 'JP', { is_featured: true, sort_order: 1 }),
  dest('osaka', '오사카', 'JP', { sort_order: 5 }),
  dest('paris', '파리', 'FR', { is_featured: true, sort_order: 2 }),
  dest('seoul', '서울', 'KR', { sort_order: 4 }),
  dest('bangkok', '방콕', 'TH', { sort_order: 8 }),
  dest('taipei', '타이페이', 'TW', { sort_order: 9 }),
  dest('danang', '다낭', 'VN', { sort_order: 10 }),
];

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
});
afterEach(() => {
  act(() => {
    vi.runAllTimers();
  });
  vi.useRealTimers();
});

function open(over: { selectedId?: string | null } = {}) {
  const onConfirm = vi.fn();
  const onClose = vi.fn();
  render(<DestinationPickerModal destinations={list} selectedId={over.selectedId ?? null} onConfirm={onConfirm} onClose={onClose} />);
  return { onConfirm, onClose };
}

describe('DestinationPickerModal', () => {
  it('처음엔 추천 도시만 보이고, 탭을 누르면 그 지역 도시가 보인다', () => {
    open();
    expect(screen.getByText('도쿄')).toBeInTheDocument();
    expect(screen.getByText('파리')).toBeInTheDocument();
    expect(screen.queryByText('오사카')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: '일본' }));
    expect(screen.getByText('오사카')).toBeInTheDocument();
    expect(screen.queryByText('파리')).not.toBeInTheDocument();
  });

  it('아시아 탭은 하위 지역 카드부터 보여 주고, 지역을 누르면 그 지역 도시가 나오며, 뒤로 가기로 카드로 돌아온다', () => {
    open();
    fireEvent.click(screen.getByRole('tab', { name: '아시아' }));
    expect(screen.getByRole('button', { name: /동남아시아/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /동아시아/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /남아시아 / })).not.toBeInTheDocument(); // 도시가 없는 지역은 카드가 없다
    expect(screen.queryByText('방콕')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /동남아시아/ }));
    expect(screen.getByText('방콕')).toBeInTheDocument();
    expect(screen.getByText('다낭')).toBeInTheDocument();
    expect(screen.queryByText('타이페이')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /아시아 지역 전체/ }));
    expect(screen.queryByText('방콕')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /동아시아/ })).toBeInTheDocument();
  });

  it('다른 탭으로 옮기면 하위 지역 선택이 풀리고, 검색하면 지역과 상관없이 결과가 나온다', () => {
    open();
    fireEvent.click(screen.getByRole('tab', { name: '아시아' }));
    fireEvent.click(screen.getByRole('button', { name: /동남아시아/ }));
    fireEvent.click(screen.getByRole('tab', { name: '유럽' }));
    expect(screen.getByRole('button', { name: /서유럽/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: '아시아' }));
    expect(screen.getByRole('button', { name: /동남아시아/ })).toBeInTheDocument(); // 다시 카드부터
    fireEvent.change(screen.getByPlaceholderText(/국가, 도시 검색/), { target: { value: '타이' } });
    expect(screen.getByText('타이페이')).toBeInTheDocument();
  });

  it('한국·일본 탭은 하위 지역 없이 바로 도시 목록', () => {
    open();
    fireEvent.click(screen.getByRole('tab', { name: '일본' }));
    expect(screen.getByText('오사카')).toBeInTheDocument();
  });

  it('검색하면 결과가 좁혀지고 지우면 돌아온다', () => {
    open();
    fireEvent.change(screen.getByPlaceholderText(/국가, 도시 검색/), { target: { value: '오사' } });
    expect(screen.getByText('오사카')).toBeInTheDocument();
    expect(screen.queryByText('도쿄')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '검색어 지우기' }));
    expect(screen.getByText('도쿄')).toBeInTheDocument();
  });

  it('카드를 눌러 고르고 "선택 완료"를 눌러야 반영된다', () => {
    const { onConfirm } = open();
    expect(screen.getByRole('button', { name: '선택 완료' })).toBeDisabled();
    fireEvent.click(screen.getByText('파리'));
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '선택 완료' }));
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ id: 'paris' }));
    expect(JSON.parse(localStorage.getItem('triptic-recent-destinations') ?? '[]')).toEqual(['paris']);
  });

  it('이미 고른 도시가 있으면 처음부터 선택돼 있다', () => {
    open({ selectedId: 'tokyo' });
    expect(screen.getByRole('button', { name: '선택 완료' })).toBeEnabled();
    expect(screen.getByText(/도쿄, /)).toBeInTheDocument();
  });

  it('배경을 눌러도 닫히지 않고, 닫기 버튼으로는 닫힌다(반영 없이)', () => {
    const { onConfirm, onClose } = open();
    fireEvent.click(document.querySelector('[role="dialog"]')!.parentElement!);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole('button', { name: '닫기' })[1]);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('최근 선택 칩을 누르면 고르고, ×로 지운다', () => {
    localStorage.setItem('triptic-recent-destinations', JSON.stringify(['seoul']));
    open();
    fireEvent.click(screen.getByRole('button', { name: '#서울' }));
    expect(screen.getByRole('button', { name: '선택 완료' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: '서울 지우기' }));
    expect(screen.queryByRole('button', { name: '#서울' })).not.toBeInTheDocument();
  });
});
