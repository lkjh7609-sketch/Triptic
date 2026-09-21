import { describe, it, expect } from 'vitest';
import {
  convertToBase,
  formatMoney,
  getCategoryTotalsSeries,
  getDayExpenseTotal,
  getDayTotalsSeries,
  getGrandExpenseTotal,
} from './expenses';

describe('formatMoney', () => {
  it('통화 단위를 붙여 천단위 구분 표시한다', () => {
    expect(formatMoney(12000, 'KRW')).toBe('12,000원');
    expect(formatMoney(500, 'JPY')).toBe('500엔');
  });

  it('알 수 없는 통화는 KRW로 폴백한다', () => {
    expect(formatMoney(1000, 'XXX')).toBe('1,000원');
  });
});

describe('convertToBase', () => {
  it('통화가 없거나 기본 통화와 같으면 그대로 반환한다', () => {
    expect(convertToBase({ desc: '점심', amount: 12000 }, 'KRW')).toBe(12000);
    expect(convertToBase({ desc: '점심', amount: 12000, currency: 'KRW' }, 'KRW')).toBe(12000);
  });

  it('통화가 다르고 fxRateToBase가 있으면 환산한다', () => {
    expect(convertToBase({ desc: '스시', amount: 1000, currency: 'JPY', fxRateToBase: 9.5 }, 'KRW')).toBe(9500);
  });

  it('통화가 다른데 fxRateToBase가 없으면(조회 실패) null을 반환한다', () => {
    expect(convertToBase({ desc: '스시', amount: 1000, currency: 'JPY' }, 'KRW')).toBeNull();
  });
});

describe('getDayExpenseTotal', () => {
  it('하루 경비 목록의 금액 합계를 구한다', () => {
    expect(
      getDayExpenseTotal([{ desc: '점심', amount: 12000 }, { desc: '커피', amount: 5000 }], 'KRW'),
    ).toEqual({ total: 17000, unconverted: 0 });
  });

  it('빈 목록은 0을 반환한다', () => {
    expect(getDayExpenseTotal([], 'KRW')).toEqual({ total: 0, unconverted: 0 });
  });

  it('환산 불가 항목은 합계에서 빼고 개수만 센다', () => {
    expect(
      getDayExpenseTotal(
        [
          { desc: '점심', amount: 12000 },
          { desc: '스시', amount: 1000, currency: 'JPY' },
        ],
        'KRW',
      ),
    ).toEqual({ total: 12000, unconverted: 1 });
  });
});

describe('getGrandExpenseTotal', () => {
  it('전체 여행 기간의 경비 합계를 구한다', () => {
    const expensesData = {
      1: [{ desc: '점심', amount: 12000 }],
      2: [{ desc: '저녁', amount: 30000 }, { desc: '기념품', amount: 8000 }],
    };
    expect(getGrandExpenseTotal(expensesData, 'KRW')).toEqual({ total: 50000, unconverted: 0 });
  });

  it('비어있는 날짜가 섞여 있어도 합산한다', () => {
    expect(getGrandExpenseTotal({ 1: [], 3: [{ desc: '택시', amount: 4000 }] }, 'KRW')).toEqual({
      total: 4000,
      unconverted: 0,
    });
  });
});

describe('getDayTotalsSeries', () => {
  it('여행 전체 일수만큼 일자별 합계를 만든다(빈 날은 0)', () => {
    const expensesData = { 1: [{ desc: '점심', amount: 10000 }] };
    expect(getDayTotalsSeries(expensesData, 3, 'KRW')).toEqual([
      { label: 'Day 1', value: 10000 },
      { label: 'Day 2', value: 0 },
      { label: 'Day 3', value: 0 },
    ]);
  });
});

describe('getCategoryTotalsSeries', () => {
  it('카테고리별 합계를 구하고 0원인 카테고리는 제외한다', () => {
    const expensesData = {
      1: [
        { desc: '점심', amount: 12000, category: 'food' as const },
        { desc: '지하철', amount: 3000, category: 'transport' as const },
        { desc: '저녁', amount: 8000, category: 'food' as const },
      ],
    };
    expect(getCategoryTotalsSeries(expensesData, 'KRW')).toEqual([
      { label: '식비', value: 20000 },
      { label: '교통', value: 3000 },
    ]);
  });

  it('category가 없는 기존 데이터는 기타로 집계한다', () => {
    const expensesData = { 1: [{ desc: '기념품', amount: 5000 }] };
    expect(getCategoryTotalsSeries(expensesData, 'KRW')).toEqual([{ label: '기타', value: 5000 }]);
  });
});
