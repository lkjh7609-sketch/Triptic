import { describe, expect, it } from 'vitest';
import { carryPaidBy } from './expensePayer';

const stored = [
  { day_index: 1, description: '점심', amount: '1200', category: 'food', paid_by: 'u2' },
  { day_index: 1, description: '점심', amount: '1200', category: 'food', paid_by: 'u3' },
  { day_index: 2, description: '택시', amount: '500.00', category: 'transport', paid_by: null },
];

describe('carryPaidBy', () => {
  it('낸 사람 없이 들어온 경비를 DB의 같은 줄에서 채운다(옛 화면 보호)', () => {
    const r = carryPaidBy({ 1: [{ desc: '점심', amount: 1200, category: 'food' }] }, stored);
    expect(r[1][0].paidBy).toBe('u2');
  });

  it('같은 줄이 여러 개면 순서대로 하나씩 쓴다', () => {
    const r = carryPaidBy(
      {
        1: [
          { desc: '점심', amount: 1200, category: 'food' },
          { desc: '점심', amount: 1200, category: 'food' },
          { desc: '점심', amount: 1200, category: 'food' },
        ],
      },
      stored,
    );
    expect(r[1].map((e) => e.paidBy)).toEqual(['u2', 'u3', undefined]);
  });

  it('이미 낸 사람이 있으면 건드리지 않는다', () => {
    const r = carryPaidBy({ 1: [{ desc: '점심', amount: 1200, category: 'food', paidBy: 'me' }] }, stored);
    expect(r[1][0].paidBy).toBe('me');
  });

  it('DB에도 낸 사람이 없는 옛 경비는 그대로(= 여행 만든 사람 것)', () => {
    const r = carryPaidBy({ 2: [{ desc: '택시', amount: 500, category: 'transport' }] }, stored);
    expect(r[2][0].paidBy).toBeUndefined();
  });

  it('일차나 금액이 다르면 다른 줄로 본다', () => {
    const r = carryPaidBy({ 3: [{ desc: '점심', amount: 1200, category: 'food' }], 1: [{ desc: '점심', amount: 999, category: 'food' }] }, stored);
    expect(r[3][0].paidBy).toBeUndefined();
    expect(r[1][0].paidBy).toBeUndefined();
  });

  it('분류가 없으면 other로 비교한다', () => {
    const r = carryPaidBy({ 1: [{ desc: '메모', amount: 10 }] }, [{ day_index: 1, description: '메모', amount: 10, category: null, paid_by: 'u9' }]);
    expect(r[1][0].paidBy).toBe('u9');
  });

  it('DB에 낸 사람이 하나도 없으면 입력 그대로 돌려준다', () => {
    const input = { 1: [{ desc: 'a', amount: 1 }] };
    expect(carryPaidBy(input, [])).toBe(input);
  });
});
