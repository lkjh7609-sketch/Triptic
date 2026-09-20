import { describe, it, expect } from 'vitest';
import { formatMoney, getDayExpenseTotal, getGrandExpenseTotal } from './expenses';

describe('formatMoney', () => {
  it('통화 단위를 붙여 천단위 구분 표시한다', () => {
    expect(formatMoney(12000, 'KRW')).toBe('12,000원');
    expect(formatMoney(500, 'JPY')).toBe('500엔');
  });

  it('알 수 없는 통화는 KRW로 폴백한다', () => {
    expect(formatMoney(1000, 'XXX')).toBe('1,000원');
  });
});

describe('getDayExpenseTotal', () => {
  it('하루 경비 목록의 금액 합계를 구한다', () => {
    expect(getDayExpenseTotal([{ desc: '점심', amount: 12000 }, { desc: '커피', amount: 5000 }])).toBe(17000);
  });

  it('빈 목록은 0을 반환한다', () => {
    expect(getDayExpenseTotal([])).toBe(0);
  });
});

describe('getGrandExpenseTotal', () => {
  it('전체 여행 기간의 경비 합계를 구한다', () => {
    const expensesData = {
      1: [{ desc: '점심', amount: 12000 }],
      2: [{ desc: '저녁', amount: 30000 }, { desc: '기념품', amount: 8000 }],
    };
    expect(getGrandExpenseTotal(expensesData)).toBe(50000);
  });

  it('비어있는 날짜가 섞여 있어도 합산한다', () => {
    expect(getGrandExpenseTotal({ 1: [], 3: [{ desc: '택시', amount: 4000 }] })).toBe(4000);
  });
});
