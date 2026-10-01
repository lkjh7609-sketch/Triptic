import { CONTINENT_KEYS, COUNTRY_KEYS, type ContinentKey } from '../destinationRegions';
import type { LocalizedText } from '../types';

/** 나라 코드가 속한 대륙(브레드크럼용). 목록에 없으면 null */
export function continentOf(countryCode: string): ContinentKey | null {
  return CONTINENT_KEYS.find((k) => COUNTRY_KEYS[k].includes(countryCode)) ?? null;
}

/** 한국어·영어 두 벌로 저장된 문구에서 현재 언어에 맞는 쪽 — 일·번체는 영어 */
export function pickText(text: LocalizedText | null | undefined, language: string): string {
  if (!text) return '';
  return language.startsWith('ko') ? text.ko : text.en;
}

/** 그 시각에 해당 시간대가 UTC보다 몇 분 앞서는지. 시간대 이름이 잘못되면 null */
export function tzOffsetMinutes(timeZone: string, at: Date): number | null {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    }).formatToParts(at);
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    const asUtc = Date.UTC(
      get('year'),
      get('month') - 1,
      get('day'),
      get('hour'),
      get('minute'),
      get('second'),
    );
    return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / 60_000);
  } catch {
    return null;
  }
}

/** 도시 시간대와 한국(Asia/Seoul)의 시차 — 양수면 한국보다 빠르다. 계산할 수 없으면 null */
export function koreaTimeDiffMinutes(timeZone: string, at: Date = new Date()): number | null {
  const dest = tzOffsetMinutes(timeZone, at);
  const seoul = tzOffsetMinutes('Asia/Seoul', at);
  if (dest == null || seoul == null) return null;
  return dest - seoul;
}

/** 시차를 시·분으로 쪼갠다(인도 3시간 30분처럼) */
export function splitDiff(diffMinutes: number): { hours: number; minutes: number; ahead: boolean } {
  const abs = Math.abs(diffMinutes);
  return { hours: Math.floor(abs / 60), minutes: abs % 60, ahead: diffMinutes > 0 };
}

/** Open-Meteo WMO 날씨 코드 → 문구 키(`channel.weather.<key>`) */
export type WeatherKey =
  'clear' | 'partly' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'thunder';

export function weatherKey(code: number | null | undefined): WeatherKey | null {
  if (code == null) return null;
  if (code === 0) return 'clear';
  if (code === 1 || code === 2) return 'partly';
  if (code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 57) return 'drizzle';
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'thunder';
  return null;
}

/** 현지 통화 금액 — 원화는 "4,500원/₩4,500", 그 밖에는 "11 MYR" */
export function formatLocalAmount(amount: number, currency: string, locale: string): string {
  if (currency === 'KRW') return formatKrw(amount, locale);
  const number = amount.toLocaleString(locale, { maximumFractionDigits: amount < 100 ? 1 : 0 });
  return `${number} ${currency}`;
}

export function formatKrw(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

/** 어림값이라 자릿수를 줄인다 — 1,000원 아래는 10원, 그 위는 100원 단위 */
export function roundKrw(amount: number): number {
  const unit = amount < 1000 ? 10 : 100;
  return Math.round(amount / unit) * unit;
}

/** 금액 범위("8~14 MYR") — max가 없으면 한 값 */
export function formatPriceRange(
  min: number,
  max: number | null,
  currency: string,
  locale: string,
): string {
  if (max == null || max === min) return formatLocalAmount(min, currency, locale);
  if (currency === 'KRW') return `${formatKrw(min, locale)}~${formatKrw(max, locale)}`;
  const fmt = (n: number) => n.toLocaleString(locale, { maximumFractionDigits: n < 100 ? 1 : 0 });
  return `${fmt(min)}~${fmt(max)} ${currency}`;
}

/** 원화 환산 어림값 — 범위면 양 끝을 각각 환산 */
export function formatKrwApprox(
  min: number,
  max: number | null,
  rateToKrw: number,
  locale: string,
): string {
  const lo = formatKrw(roundKrw(min * rateToKrw), locale);
  if (max == null || max === min) return `≈ ${lo}`;
  return `≈ ${lo}~${formatKrw(roundKrw(max * rateToKrw), locale)}`;
}

/** 계산기 입력("1,234.5")을 숫자로. 비었거나 숫자가 아니면 null */
export function parseAmount(text: string): number | null {
  const cleaned = text.replace(/,/g, '').trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** 본문 첫 줄을 제목처럼, 나머지를 요약으로 (글에는 제목 필드가 따로 없다) */
export function splitBody(body: string): { title: string; excerpt: string } {
  const trimmed = body.trim();
  const newline = trimmed.indexOf('\n');
  const firstLine = newline === -1 ? trimmed : trimmed.slice(0, newline);
  const title = firstLine.length > 90 ? `${firstLine.slice(0, 90)}…` : firstLine;
  const excerpt =
    newline === -1 ? (firstLine.length > 90 ? trimmed.slice(90) : '') : trimmed.slice(newline + 1);
  return { title, excerpt: excerpt.trim() };
}

/** 처음 보여줄 금액 — 원화로 1만~10만 원쯤 되는 10의 거듭제곱(MYR 100, USD 10, JPY 10,000) */
export function defaultForeignAmount(rateToKrw: number): number {
  return 10 ** Math.max(0, Math.ceil(Math.log10(10_000 / rateToKrw)));
}
