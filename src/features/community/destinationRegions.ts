import type { Destination } from './types';

/** 대륙 버킷 — 국가명 자체는 번역 키로 안 들고 Intl.DisplayNames로 표시 언어에 맞춰 그때그때 렌더한다
 * (100개 도시로 늘면서 57개국을 4개 언어로 손으로 번역해 넣는 건 유지비가 너무 크고 오타 위험도 크다) */
export const CONTINENT_KEYS = ['AS', 'EU', 'NA', 'SA', 'AF', 'OC'] as const;
export type ContinentKey = (typeof CONTINENT_KEYS)[number];

export const COUNTRY_KEYS: Record<ContinentKey, string[]> = {
  AS: ['KR', 'JP', 'VN', 'TH', 'PH', 'MY', 'SG', 'ID', 'TW', 'HK', 'MO', 'CN', 'KH', 'IN', 'NP', 'MV', 'AE', 'QA', 'IL', 'MN', 'LA', 'MM', 'BN', 'LK', 'UZ', 'KZ', 'KG', 'GE', 'AM', 'AZ', 'OM', 'JO', 'RU'],
  EU: ['FR', 'GB', 'IT', 'ES', 'CZ', 'AT', 'CH', 'NL', 'PT', 'TR', 'DE', 'GR', 'HR', 'HU', 'PL', 'DK', 'SE', 'IE', 'BE', 'FI', 'NO', 'IS', 'EE', 'LV', 'LT', 'SI', 'SK', 'MT'],
  // 괌·사이판은 미국령이라 미주 안에 둔다(여행지 선택 창의 미주 탭, 도시 채널 브레드크럼도 같은 대륙)
  NA: ['US', 'CA', 'MX', 'CU', 'PA', 'GU', 'MP'],
  SA: ['BR', 'AR', 'PE', 'CL', 'CO'],
  AF: ['ZA', 'MA', 'EG', 'KE', 'TZ', 'ET', 'MU', 'ZW'],
  OC: ['AU', 'NZ', 'FJ', 'PF', 'PW'],
};

/** 여행지 선택 창의 탭 — 한국·일본은 따로, 나머지는 대륙 묶음(아시아는 한국·일본을 뺀 나머지, 오세아니아는 미주 옆) */
export const PICKER_TABS = ['all', 'kr', 'jp', 'asia', 'eu', 'am', 'oc', 'other'] as const;
export type PickerTab = (typeof PICKER_TABS)[number];

/** 나라 코드 → 탭(전체 제외). 목록에 없는 나라는 '기타' */
export function tabOf(countryCode: string): Exclude<PickerTab, 'all'> {
  if (countryCode === 'KR') return 'kr';
  if (countryCode === 'JP') return 'jp';
  if (COUNTRY_KEYS.AS.includes(countryCode)) return 'asia';
  if (COUNTRY_KEYS.EU.includes(countryCode)) return 'eu';
  if (COUNTRY_KEYS.NA.includes(countryCode) || COUNTRY_KEYS.SA.includes(countryCode)) return 'am';
  if (COUNTRY_KEYS.OC.includes(countryCode)) return 'oc';
  return 'other';
}

function byFeaturedThenOrder(a: Destination, b: Destination): number {
  if (a.is_featured !== b.is_featured) return a.is_featured ? -1 : 1;
  return a.sort_order - b.sort_order || a.name.localeCompare(b.name);
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[-_\s]+/g, '');
}

export interface PickerFilter {
  tab: PickerTab;
  query: string;
  /** 나라 코드 → 현재 언어의 나라 이름(검색에 쓴다) */
  countryName: (code: string) => string;
}

/**
 * 여행지 선택 창에 보여줄 도시 — 검색어가 있으면 도시 이름·slug·나라 이름에 들어 있는 것(이름이 검색어로 시작하는 것을 앞에),
 * 없으면 탭 안에서 추천 도시 → 정렬 순서로. 탭 '전체'에 검색어가 없으면 추천 도시만("인기 추천 여행지")
 */
export function filterDestinations(destinations: Destination[], { tab, query, countryName }: PickerFilter): Destination[] {
  const q = normalize(query.trim());
  const inTab = destinations.filter((d) => tab === 'all' || tabOf(d.country_code) === tab);
  if (q) {
    const matches = inTab.filter((d) => normalize(d.name).includes(q) || normalize(d.slug).includes(q) || normalize(countryName(d.country_code)).includes(q));
    return matches.sort((a, b) => {
      const aStarts = normalize(a.name).startsWith(q) ? 0 : 1;
      const bStarts = normalize(b.name).startsWith(q) ? 0 : 1;
      return aStarts - bStarts || byFeaturedThenOrder(a, b);
    });
  }
  const sorted = [...inTab].sort(byFeaturedThenOrder);
  return tab === 'all' ? sorted.filter((d) => d.is_featured) : sorted;
}

// ── 나라별 묶음(여행지 선택 창: 아시아·유럽·미주·오세아니아·기타 탭은 먼저 나라 카드를 보여 주고, 나라를 누르면 그 나라의 도시) ──────────
export type GroupedTab = 'asia' | 'eu' | 'am' | 'oc' | 'other';
export const GROUPED_TABS: readonly PickerTab[] = ['asia', 'eu', 'am', 'oc', 'other'];

export function isGroupedTab(tab: PickerTab): tab is GroupedTab {
  return GROUPED_TABS.includes(tab);
}

/** 탭 안의 도시를 나라별로 묶는다 — 나라는 현재 언어의 이름 순(가나다·ABC), 도시는 추천 → 정렬 순서 */
export function groupByCountry(
  destinations: Destination[],
  tab: GroupedTab,
  countryName: (code: string) => string,
  locale?: string,
): { code: string; destinations: Destination[] }[] {
  const byCountry = new Map<string, Destination[]>();
  for (const d of destinations.filter((x) => tabOf(x.country_code) === tab).sort(byFeaturedThenOrder)) {
    byCountry.set(d.country_code, [...(byCountry.get(d.country_code) ?? []), d]);
  }
  return [...byCountry]
    .map(([code, list]) => ({ code, destinations: list }))
    .sort((a, b) => countryName(a.code).localeCompare(countryName(b.code), locale));
}

// ── 최근 선택한 여행지(이 기기에만 저장, 최대 5개) ─────────────────────────────
const RECENT_KEY = 'triptic-recent-destinations';
export const MAX_RECENT = 5;

export function readRecentDestinationIds(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as unknown;
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string').slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

function writeRecent(ids: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(ids.slice(0, MAX_RECENT)));
  } catch {
    // 저장이 막힌 환경 — 없어도 동작한다
  }
}

/** 방금 고른 도시를 맨 앞으로(이미 있으면 끌어올리고 5개까지만) */
export function rememberDestination(id: string): string[] {
  const next = [id, ...readRecentDestinationIds().filter((v) => v !== id)].slice(0, MAX_RECENT);
  writeRecent(next);
  return next;
}

export function forgetRecentDestination(id: string): string[] {
  const next = readRecentDestinationIds().filter((v) => v !== id);
  writeRecent(next);
  return next;
}
