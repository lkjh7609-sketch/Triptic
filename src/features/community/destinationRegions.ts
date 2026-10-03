import type { Destination } from './types';

/** 대륙 버킷 — 국가명 자체는 번역 키로 안 들고 Intl.DisplayNames로 표시 언어에 맞춰 그때그때 렌더한다
 * (100개 도시로 늘면서 57개국을 4개 언어로 손으로 번역해 넣는 건 유지비가 너무 크고 오타 위험도 크다) */
export const CONTINENT_KEYS = ['AS', 'EU', 'NA', 'SA', 'AF', 'OC'] as const;
export type ContinentKey = (typeof CONTINENT_KEYS)[number];

export const COUNTRY_KEYS: Record<ContinentKey, string[]> = {
  AS: ['KR', 'JP', 'VN', 'TH', 'PH', 'MY', 'SG', 'ID', 'TW', 'HK', 'MO', 'CN', 'KH', 'IN', 'NP', 'MV', 'AE', 'QA', 'IL', 'MN'],
  EU: ['FR', 'GB', 'IT', 'ES', 'CZ', 'AT', 'CH', 'NL', 'PT', 'TR', 'DE', 'GR', 'HR', 'HU', 'PL', 'DK', 'SE', 'IE', 'BE'],
  NA: ['US', 'CA', 'MX', 'CU'],
  SA: ['BR', 'AR', 'PE', 'CL'],
  AF: ['ZA', 'MA', 'EG', 'KE', 'TZ'],
  OC: ['AU', 'GU', 'MP', 'NZ', 'FJ'],
};

/** 여행지 선택 창의 탭 — 한국·일본은 따로, 나머지는 대륙 묶음(아시아는 한국·일본을 뺀 나머지) */
export const PICKER_TABS = ['all', 'kr', 'jp', 'asia', 'eu', 'am', 'other'] as const;
export type PickerTab = (typeof PICKER_TABS)[number];

/** 나라 코드 → 탭(전체 제외). 목록에 없는 나라는 '기타' */
export function tabOf(countryCode: string): Exclude<PickerTab, 'all'> {
  if (countryCode === 'KR') return 'kr';
  if (countryCode === 'JP') return 'jp';
  if (COUNTRY_KEYS.AS.includes(countryCode)) return 'asia';
  if (COUNTRY_KEYS.EU.includes(countryCode)) return 'eu';
  if (COUNTRY_KEYS.NA.includes(countryCode) || COUNTRY_KEYS.SA.includes(countryCode)) return 'am';
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

// ── 하위 지역(여행지 선택 창: 아시아·유럽·미주·기타 탭은 먼저 하위 지역 카드를 보여 준다) ──────────
export type GroupedTab = 'asia' | 'eu' | 'am' | 'other';
export const GROUPED_TABS: readonly PickerTab[] = ['asia', 'eu', 'am', 'other'];

export function isGroupedTab(tab: PickerTab): tab is GroupedTab {
  return GROUPED_TABS.includes(tab);
}

/** 탭별 하위 지역과 그에 속한 나라. 한국·일본은 자기 탭이 따로 있어 아시아 하위 지역에 넣지 않는다.
 * 유럽은 한국 여행 상품의 구분을 따랐다(오스트리아·체코·헝가리·폴란드=동유럽, 튀르키예는 남유럽 묶음). */
export const SUBREGIONS: Record<GroupedTab, { key: string; countries: string[] }[]> = {
  asia: [
    { key: 'eastAsia', countries: ['TW', 'HK', 'MO', 'CN', 'MN'] },
    { key: 'southeastAsia', countries: ['VN', 'TH', 'PH', 'MY', 'SG', 'ID', 'KH'] },
    { key: 'southAsia', countries: ['IN', 'NP', 'MV'] },
    { key: 'middleEast', countries: ['AE', 'QA', 'IL'] },
  ],
  eu: [
    { key: 'westernEurope', countries: ['FR', 'GB', 'IE', 'NL', 'BE', 'DE', 'CH'] },
    { key: 'northernEurope', countries: ['DK', 'SE'] },
    { key: 'southernEurope', countries: ['IT', 'ES', 'PT', 'GR', 'HR', 'TR'] },
    { key: 'easternEurope', countries: ['CZ', 'AT', 'HU', 'PL'] },
  ],
  am: [
    { key: 'northAmerica', countries: ['US', 'CA'] },
    { key: 'centralAmerica', countries: ['MX', 'CU'] },
    { key: 'southAmerica', countries: ['BR', 'AR', 'PE', 'CL'] },
  ],
  other: [
    { key: 'northAfrica', countries: ['MA', 'EG'] },
    { key: 'subSaharanAfrica', countries: ['KE', 'TZ', 'ZA'] },
    { key: 'oceania', countries: ['AU', 'NZ', 'FJ'] },
    { key: 'guamSaipan', countries: ['GU', 'MP'] },
  ],
};

/** 어느 하위 지역에도 없는 나라(나중에 새로 생긴 도시)가 들어가는 묶음 */
export const OTHER_SUBREGION = 'etc';

export function subregionOf(tab: GroupedTab, countryCode: string): string {
  return SUBREGIONS[tab].find((r) => r.countries.includes(countryCode))?.key ?? OTHER_SUBREGION;
}

/** 탭 안의 도시를 하위 지역별로 묶는다 — 도시가 하나도 없는 지역은 뺀다. 도시는 추천 → 정렬 순서 */
export function groupBySubregion(destinations: Destination[], tab: GroupedTab): { key: string; destinations: Destination[] }[] {
  const inTab = destinations.filter((d) => tabOf(d.country_code) === tab).sort(byFeaturedThenOrder);
  const keys = [...SUBREGIONS[tab].map((r) => r.key), OTHER_SUBREGION];
  return keys
    .map((key) => ({ key, destinations: inTab.filter((d) => subregionOf(tab, d.country_code) === key) }))
    .filter((g) => g.destinations.length > 0);
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
