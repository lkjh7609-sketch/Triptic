import { afterEach, describe, expect, it } from 'vitest';
import type { Destination } from './types';
import catalog from '../../../supabase/data/destination_catalog.json';
import {
  COUNTRY_KEYS,
  MAX_RECENT,
  OTHER_SUBREGION,
  groupBySubregion,
  isGroupedTab,
  subregionOf,
  filterDestinations,
  forgetRecentDestination,
  readRecentDestinationIds,
  rememberDestination,
  tabOf,
} from './destinationRegions';

function dest(
  over: Partial<Destination> & Pick<Destination, 'id' | 'name' | 'country_code'>,
): Destination {
  return {
    slug: over.name.toLowerCase(),
    lat: 0,
    lng: 0,
    timezone: 'UTC',
    currency: null,
    cover_url: null,
    is_featured: false,
    sort_order: 0,
    post_count: 0,
    ...over,
  };
}

const list = [
  dest({
    id: 'tokyo',
    name: '도쿄',
    slug: 'tokyo',
    country_code: 'JP',
    is_featured: true,
    sort_order: 1,
  }),
  dest({ id: 'osaka', name: '오사카', slug: 'osaka', country_code: 'JP', sort_order: 5 }),
  dest({
    id: 'paris',
    name: '파리',
    slug: 'paris',
    country_code: 'FR',
    is_featured: true,
    sort_order: 2,
  }),
  dest({
    id: 'bangkok',
    name: '방콕',
    slug: 'bangkok',
    country_code: 'TH',
    is_featured: true,
    sort_order: 3,
  }),
  dest({ id: 'seoul', name: '서울', slug: 'seoul', country_code: 'KR', sort_order: 4 }),
  dest({ id: 'ny', name: '뉴욕', slug: 'new-york', country_code: 'US', sort_order: 6 }),
  dest({ id: 'sydney', name: '시드니', slug: 'sydney', country_code: 'AU', sort_order: 7 }),
];
const countryName = (code: string) =>
  ({ JP: '일본', FR: '프랑스', TH: '태국', KR: '대한민국', US: '미국', AU: '호주' })[code] ?? code;

describe('tabOf', () => {
  it('한국·일본은 따로, 나머지는 대륙 묶음', () => {
    expect(tabOf('KR')).toBe('kr');
    expect(tabOf('JP')).toBe('jp');
    expect(tabOf('TH')).toBe('asia');
    expect(tabOf('FR')).toBe('eu');
    expect(tabOf('US')).toBe('am');
    expect(tabOf('BR')).toBe('am');
    expect(tabOf('AU')).toBe('other');
    expect(tabOf('ZZ')).toBe('other');
  });
});

describe('filterDestinations', () => {
  it('전체 탭에 검색어가 없으면 추천 도시만, 정렬 순서대로', () => {
    expect(
      filterDestinations(list, { tab: 'all', query: '', countryName }).map((d) => d.id),
    ).toEqual(['tokyo', 'paris', 'bangkok']);
  });

  it('탭을 고르면 그 탭의 모든 도시(추천 먼저)', () => {
    expect(
      filterDestinations(list, { tab: 'jp', query: '', countryName }).map((d) => d.id),
    ).toEqual(['tokyo', 'osaka']);
    expect(
      filterDestinations(list, { tab: 'other', query: '', countryName }).map((d) => d.id),
    ).toEqual(['sydney']);
  });

  it('검색은 이름·slug·나라 이름에서, 이름이 검색어로 시작하는 것을 앞에', () => {
    expect(
      filterDestinations(list, { tab: 'all', query: '도', countryName }).map((d) => d.id),
    ).toEqual(['tokyo']);
    expect(
      filterDestinations(list, { tab: 'all', query: 'new york', countryName }).map((d) => d.id),
    ).toEqual(['ny']);
    expect(
      filterDestinations(list, { tab: 'all', query: '일본', countryName }).map((d) => d.id),
    ).toEqual(['tokyo', 'osaka']);
  });

  it('검색은 탭 안에서만', () => {
    expect(filterDestinations(list, { tab: 'eu', query: '도쿄', countryName })).toEqual([]);
  });
});

describe('최근 선택', () => {
  afterEach(() => localStorage.clear());

  it('최근 것을 앞에 두고 중복은 끌어올리고 5개까지만 남긴다', () => {
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f']) rememberDestination(id);
    expect(readRecentDestinationIds()).toEqual(['f', 'e', 'd', 'c', 'b']);
    expect(rememberDestination('c')).toEqual(['c', 'f', 'e', 'd', 'b']);
    expect(readRecentDestinationIds()).toHaveLength(MAX_RECENT);
  });

  it('하나 지울 수 있고, 깨진 저장값은 빈 목록', () => {
    rememberDestination('a');
    rememberDestination('b');
    expect(forgetRecentDestination('a')).toEqual(['b']);
    localStorage.setItem('triptic-recent-destinations', '{oops');
    expect(readRecentDestinationIds()).toEqual([]);
  });
});

describe('하위 지역', () => {
  it('등록하려는 여행지 300곳의 모든 나라가 대륙·하위 지역에 들어 있다 — 새 나라를 넣고 빠뜨리면 여기서 걸린다', () => {
    const countries = [...new Set(catalog.cities.map((c) => c.country))];
    for (const code of countries) {
      if (code === 'KR' || code === 'JP') continue;
      const tab = tabOf(code);
      expect(isGroupedTab(tab), code).toBe(true);
      if (isGroupedTab(tab)) expect(subregionOf(tab, code), code).not.toBe(OTHER_SUBREGION);
    }
  });

  it('앱에 등록된 모든 나라(한국·일본 제외)가 어느 하위 지역엔가 들어 있다 — 새 나라를 넣고 빠뜨리면 여기서 걸린다', () => {
    for (const codes of Object.values(COUNTRY_KEYS)) {
      for (const code of codes.filter((c) => c !== 'KR' && c !== 'JP')) {
        const tab = tabOf(code);
        expect(isGroupedTab(tab), code).toBe(true);
        if (isGroupedTab(tab)) expect(subregionOf(tab, code), code).not.toBe(OTHER_SUBREGION);
      }
    }
  });

  it('한 나라가 두 하위 지역에 겹쳐 있지 않다', () => {
    const seen = new Set<string>();
    for (const tab of ['asia', 'eu', 'am', 'other'] as const) {
      for (const code of [
        'TW',
        'HK',
        'VN',
        'IN',
        'AE',
        'FR',
        'AT',
        'TR',
        'US',
        'MX',
        'BR',
        'MA',
        'KE',
        'AU',
        'GU',
      ]) {
        if (tabOf(code) === tab) {
          expect(seen.has(code)).toBe(false);
          seen.add(code);
        }
      }
    }
    expect(subregionOf('asia', 'MN')).toBe('eastAsia');
    expect(subregionOf('eu', 'AT')).toBe('easternEurope');
    expect(subregionOf('other', 'GU')).toBe('guamSaipan');
  });

  it('탭 안의 도시를 하위 지역별로 묶고 비어 있는 지역은 뺀다. 모르는 나라는 마지막 "기타" 묶음', () => {
    const cities = [
      dest({ id: 'bkk', name: '방콕', country_code: 'TH', is_featured: true, sort_order: 2 }),
      dest({ id: 'dad', name: '다낭', country_code: 'VN', sort_order: 1 }),
      dest({ id: 'tpe', name: '타이페이', country_code: 'TW', sort_order: 3 }),
      dest({ id: 'tok', name: '도쿄', country_code: 'JP' }),
    ];
    const groups = groupBySubregion(cities, 'asia');
    expect(groups.map((g) => g.key)).toEqual(['eastAsia', 'southeastAsia']);
    expect(groups[1].destinations.map((d) => d.id)).toEqual(['bkk', 'dad']); // 추천 도시가 먼저
    expect(
      groupBySubregion([dest({ id: 'x', name: '어딘가', country_code: 'ZZ' })], 'other').map(
        (g) => g.key,
      ),
    ).toEqual([OTHER_SUBREGION]);
  });
});
