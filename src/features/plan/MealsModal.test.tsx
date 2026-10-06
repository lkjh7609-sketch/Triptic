import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@/shared/i18n';
import type { PlaceItem } from './types';

const state = vi.hoisted(() => ({ callbacks: [] as Array<(p: unknown) => void> }));

// 구글 장소 검색 대신, 슬롯마다 받은 선택 콜백을 잡아 두었다가 시험에서 직접 부른다(아침→점심→저녁 순으로 호출됨)
vi.mock('./map/usePlaceAutocomplete', () => ({
  usePlaceAutocomplete: (onSelect: (p: unknown) => void) => {
    state.callbacks.push(onSelect);
    return { inputRef: { current: null }, fallback: { items: [], pick: () => {}, clear: () => {} } };
  },
}));
vi.mock('@/shared/a11y/useFocusTrap', () => ({ useFocusTrap: () => ({ current: null }) }));
vi.mock('@/shared/ui/TimeWheelPicker', () => ({
  TimeWheelPicker: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <button type="button" onClick={() => onChange('13:15')}>{`시간 ${value}`}</button>
  ),
}));

import { MealsModal } from './MealsModal';

const ramen = { name: '라멘 타카하시', address: '도쿄', lat: 35.7, lng: 139.7, placeId: 'p-ramen', types: ['restaurant'] };

beforeEach(() => {
  state.callbacks = [];
});

function renderModal(dayItems: PlaceItem[], onSave = vi.fn().mockResolvedValue(undefined)) {
  render(<MealsModal dayMeals={{}} dayItems={dayItems} onClose={vi.fn()} onSave={onSave} />);
  return onSave;
}

function pickLunch() {
  // 렌더가 다시 일어나도 마지막 렌더의 콜백이 최신 — 점심은 슬롯 순서상 두 번째
  const latest = state.callbacks.slice(-3);
  act(() => latest[1](ramen));
}

describe('MealsModal — 방문 시간 묻기', () => {
  it('새로 정한 식당은 저장 전에 방문 시간을 묻고, 고른 시간을 함께 저장한다', async () => {
    const onSave = renderModal([{ name: '아사쿠사', lat: 35.71, lng: 139.79, time: '09:00' }]);
    pickLunch();
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('몇 시에 방문할 예정인가요?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '시간 12:30' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '확인' }));
    });
    expect(onSave).toHaveBeenCalledTimes(1);
    const [meals, times] = onSave.mock.calls[0];
    expect(meals.lunch).toMatchObject({ name: '라멘 타카하시', placeId: 'p-ramen' });
    expect(times).toEqual({ lunch: '13:15' });
  });

  it('이미 아래 일정에 있는 식당이면 묻지 않고 바로 저장한다', async () => {
    const onSave = renderModal([{ name: '라멘 타카하시', lat: 35.7, lng: 139.7, placeId: 'p-ramen', time: '12:00' }]);
    pickLunch();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '저장' }));
    });
    expect(screen.queryByText('몇 시에 방문할 예정인가요?')).not.toBeInTheDocument();
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ lunch: expect.anything() }), {});
  });

  it('시간 단계에서 뒤로 가면 식당 고르는 화면으로 돌아간다', () => {
    renderModal([]);
    pickLunch();
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    fireEvent.click(screen.getByRole('button', { name: '뒤로' }));
    expect(screen.getByText('이 날의 식사')).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
  });
});
