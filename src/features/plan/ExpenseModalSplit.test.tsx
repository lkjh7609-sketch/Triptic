import type { ReactElement } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { ExpenseModal } from './ExpenseModal';
import { buildMyExpenses, type Person, type TripSplitExpense } from './split/splitModel';
import type { TripPeople } from './split/useTripPeople';
import type { ExpensesData } from './types';

const ME = 'me';
const OWNER = 'owner';
const FRIEND = 'friend';

const members: Person[] = [
  { id: ME, name: '나나', seed: ME, left: false },
  { id: OWNER, name: '만든이', seed: OWNER, left: false },
  { id: FRIEND, name: '친구', seed: FRIEND, left: false },
];
const people: TripPeople = {
  members,
  byId: (id) => members.find((m) => m.id === id) ?? { id, name: null, seed: id, left: true },
  loading: false,
};

const split: TripSplitExpense = {
  id: 's1',
  trip_id: 't1',
  day_index: 1,
  category: 'food',
  description: '저녁 같이',
  amount: 30000,
  currency: 'KRW',
  fx_rate_to_base: null,
  payer_id: FRIEND,
  split_among: [ME, FRIEND, OWNER],
  created_by: FRIEND,
  created_at: '',
  updated_at: '',
};

// 같은 날 세 사람의 경비가 한 목록에 섞여 있다(0번: 일행, 1번: 나, 2번: 만든 사람의 옛 경비)
const expensesData: ExpensesData = {
  1: [
    { desc: '일행 커피', amount: 4000, paidBy: FRIEND },
    { desc: '내 커피', amount: 5000, paidBy: ME },
    { desc: '옛 경비', amount: 700 },
  ],
};

function renderModal(over: Partial<React.ComponentProps<typeof ExpenseModal>> = {}) {
  const onSave = vi.fn().mockResolvedValue(undefined);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ui: ReactElement = (
    <QueryClientProvider client={client}>
      <ExpenseModal
        currentDay={1}
        totalDays={3}
        currency="KRW"
        expensesData={expensesData}
        myExpenses={buildMyExpenses(expensesData, [split], ME, OWNER, 'KRW')}
        meId={ME}
        ownerId={OWNER}
        split={{ tripId: 't1', people, onOpenSplit: vi.fn() }}
        onClose={vi.fn()}
        onSave={onSave}
        {...over}
      />
    </QueryClientProvider>
  );
  render(ui);
  return { onSave };
}

describe('ExpenseModal — 일행과 가는 여행(내 지출만)', () => {
  it('내 경비와 내 더치페이 몫만 보이고, 일행·옛 경비는 안 보인다', () => {
    renderModal();
    expect(screen.getByText('내 커피')).toBeInTheDocument();
    expect(screen.queryByText('일행 커피')).not.toBeInTheDocument();
    expect(screen.queryByText('옛 경비')).not.toBeInTheDocument();
    // 30,000원을 3명이 나눈 내 몫 10,000원 + 더치페이 표시
    expect(screen.getByText('저녁 같이')).toBeInTheDocument();
    expect(screen.getByText('더치페이')).toBeInTheDocument();
    expect(screen.getByText(/3명이 나눔 · 친구 결제/)).toBeInTheDocument();
    // 이 날 합계 = 내 커피 5,000 + 내 몫 10,000
    expect(screen.getByText('이 날 합계').nextElementSibling).toHaveTextContent('₩15,000');
  });

  it('입력칸은 처음엔 닫혀 있고, + 경비 추가 → 종류를 먼저 묻는다', () => {
    renderModal();
    expect(screen.queryByPlaceholderText('사용처 (예: 점심 식사)')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /경비 추가/ }));
    const dialog = screen.getByRole('dialog', { name: '어떤 경비인가요?' });
    expect(within(dialog).getByText('혼자 쓴 금액')).toBeInTheDocument();
    expect(within(dialog).getByText('일행과 더치페이')).toBeInTheDocument();
  });

  it('혼자 쓴 금액을 고르면 입력칸이 열리고, 저장하면 낸 사람이 나로 붙고 일행 경비는 그대로 남는다', async () => {
    const { onSave } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: /경비 추가/ }));
    fireEvent.click(screen.getByText('혼자 쓴 금액'));
    fireEvent.change(screen.getByPlaceholderText('사용처 (예: 점심 식사)'), { target: { value: '기념품' } });
    fireEvent.change(screen.getByPlaceholderText(/금액/), { target: { value: '8000' } });
    fireEvent.click(screen.getByRole('button', { name: '추가' }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const saved = onSave.mock.calls[0][0];
    expect(saved).toHaveLength(4);
    expect(saved.map((e: { desc: string }) => e.desc)).toEqual(['일행 커피', '내 커피', '옛 경비', '기념품']);
    expect(saved[3]).toMatchObject({ desc: '기념품', amount: 8000, paidBy: ME });
  });

  it('내 경비를 지워도 일행·옛 경비는 지워지지 않는다(원래 순번으로 삭제)', async () => {
    const { onSave } = renderModal();
    const row = screen.getByText('내 커피').closest('div') as HTMLElement;
    fireEvent.click(within(row.parentElement as HTMLElement).getByRole('button', { name: '삭제' }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const saved = onSave.mock.calls[0][0] as { desc: string }[];
    expect(saved.map((e) => e.desc)).toEqual(['일행 커피', '옛 경비']);
  });

  it('더치페이를 고르면 나눌 사람을 도트 캐릭터 + 이름으로 고르는 창이 열린다', () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /경비 추가/ }));
    fireEvent.click(screen.getByText('일행과 더치페이'));
    expect(screen.getByRole('dialog', { name: '더치페이 추가' })).toBeInTheDocument();
    // 처음엔 일행 전원 선택
    const group = screen.getByRole('group', { name: '누구와 나눌까요?' });
    const buttons = within(group).getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(['나', '만든이', '친구'].map((n) => expect.stringContaining(n)));
    expect(buttons.every((b) => b.getAttribute('aria-pressed') === 'true')).toBe(true);
  });
});

describe('ExpenseModal — 일행 없는 여행', () => {
  it('종류를 묻지 않고 처음부터 입력칸이 열려 있다(예전 그대로)', () => {
    renderModal({ split: undefined, meId: ME, ownerId: ME, expensesData: {}, myExpenses: {} });
    expect(screen.getByPlaceholderText('사용처 (예: 점심 식사)')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /경비 추가/ })).not.toBeInTheDocument();
  });
});
