/**
 * 앱이 지원하는 통화 목록 — 경비 입력, 여행 기본 통화, 환율 갱신(supabase/functions/
 * fx-refresh)이 모두 이 목록 하나를 쓴다. Edge Function(Deno)도 import하므로 브라우저
 * 전용 API나 다른 모듈을 import하지 않는다.
 * 통화 이름은 하드코딩하지 않고 Intl.DisplayNames로 표시 언어에 맞게 만든다(expenses.ts).
 */
export const SUPPORTED_CURRENCIES = [
  'KRW', 'USD', 'JPY', 'EUR', 'CNY', 'GBP', 'AUD', 'CAD', 'HKD', 'SGD',
  'TWD', 'THB', 'VND', 'PHP', 'MYR', 'IDR', 'INR', 'CHF', 'NZD', 'MXN',
] as const;

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];

export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  KRW: '₩',
  USD: '$',
  JPY: '¥',
  EUR: '€',
  CNY: '¥',
  GBP: '£',
  AUD: 'A$',
  CAD: 'C$',
  HKD: 'HK$',
  SGD: 'S$',
  TWD: 'NT$',
  THB: '฿',
  VND: '₫',
  PHP: '₱',
  MYR: 'RM',
  IDR: 'Rp',
  INR: '₹',
  CHF: 'Fr',
  NZD: 'NZ$',
  MXN: 'Mex$',
};

export function isSupportedCurrency(code: string): code is CurrencyCode {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(code);
}
