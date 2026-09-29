import { apiUrl } from '@/shared/api/apiUrl';
import type { SupportedLocale } from './index';

/** 번체 중국어를 쓰는 곳 — 대만·홍콩·마카오 */
const TRADITIONAL_CHINESE_COUNTRIES = new Set(['TW', 'HK', 'MO']);

/** 접속 국가 → 첫 표시 언어. 한국 → 한국어, 일본 → 일본어, 대만(·홍콩·마카오) → 번체 중국어,
 * 그 밖의 나라는 영어. 모르면 null(브라우저 언어 유지) */
export function localeForCountry(country: string | null | undefined): SupportedLocale | null {
  if (!country) return null;
  const code = country.toUpperCase();
  if (code === 'KR') return 'ko';
  if (code === 'JP') return 'ja';
  if (TRADITIONAL_CHINESE_COUNTRIES.has(code)) return 'zh-TW';
  return 'en';
}

/** 접속 IP의 국가로 첫 표시 언어를 정한다(/api/geo). 느리거나 실패하면 null */
export async function detectLocaleByIp(timeoutMs = 2500): Promise<SupportedLocale | null> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(apiUrl('/api/geo'), { signal: controller.signal, cache: 'no-store' });
    if (!res.ok) return null;
    const { country } = (await res.json()) as { country?: string | null };
    return localeForCountry(country);
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}
