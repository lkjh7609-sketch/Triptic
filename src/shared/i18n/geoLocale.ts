import { apiUrl } from '@/shared/api/apiUrl';
import type { SupportedLocale } from './index';

/** 접속 국가 → 첫 표시 언어. 한국이면 한국어, 그 밖의 나라는 영어. 모르면 null(브라우저 언어 유지) */
export function localeForCountry(country: string | null | undefined): SupportedLocale | null {
  if (!country) return null;
  return country.toUpperCase() === 'KR' ? 'ko' : 'en';
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
