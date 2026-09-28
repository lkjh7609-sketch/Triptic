import { isSupportedCurrency, type CurrencyCode } from './currencies';

const EURO_COUNTRIES = [
  'AD', 'AT', 'BE', 'CY', 'DE', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'IE', 'IT',
  'LT', 'LU', 'LV', 'MC', 'ME', 'MT', 'NL', 'PT', 'SI', 'SK', 'SM', 'VA', 'XK',
];

const USD_COUNTRIES = ['US', 'PR', 'GU', 'VI', 'AS', 'MP', 'EC', 'SV', 'PA', 'TL'];

const BY_COUNTRY: Record<string, CurrencyCode> = {
  KR: 'KRW', JP: 'JPY', CN: 'CNY', GB: 'GBP', AU: 'AUD', CA: 'CAD', HK: 'HKD',
  SG: 'SGD', TW: 'TWD', TH: 'THB', VN: 'VND', PH: 'PHP', MY: 'MYR', ID: 'IDR',
  IN: 'INR', CH: 'CHF', LI: 'CHF', NZ: 'NZD', MX: 'MXN',
  ...Object.fromEntries(EURO_COUNTRIES.map((c) => [c, 'EUR' as const])),
  ...Object.fromEntries(USD_COUNTRIES.map((c) => [c, 'USD' as const])),
};

/** 앱이 지원하는 통화(currencies.ts) 밖의 나라이거나 국가를 모르면 기본값 */
export const DEFAULT_TRIP_CURRENCY: CurrencyCode = 'KRW';

/** ISO 3166-1 alpha-2 국가 코드 → 그 나라 통화. 지원하지 않는 통화면 KRW. */
export function currencyForCountry(countryCode: string | null | undefined): CurrencyCode {
  const code = countryCode?.trim().toUpperCase();
  const currency = code ? BY_COUNTRY[code] : undefined;
  return currency && isSupportedCurrency(currency) ? currency : DEFAULT_TRIP_CURRENCY;
}
