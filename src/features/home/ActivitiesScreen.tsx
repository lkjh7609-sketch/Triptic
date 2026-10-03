import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, SlidersHorizontal } from 'lucide-react';
import { trackScreenView } from '@/shared/monitoring';
import { flagInvalid } from '@/shared/ui/invalidField';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery';
import { cityDisplayName } from '@/features/plan/cityName';
import { openExternal, openKlookSearch, openMyrealtripSearch, useKlookActivitiesLink, useMyrealtripLink } from '@/features/plan/partnerLinks';
import { ACTIVITY_PROVIDERS, readActivityProvider, saveActivityProvider, type ActivityProvider } from './activityProviders';
import { nearestKlookCityId } from './klookCities';
import { KlookToursWidget } from './KlookToursWidget';
import { useNearestTrip } from './useNearestTrip';
import { HomeSectionTabs } from './HomeSectionTabs';
import { ACTIVITY_CITIES, type ActivityCity } from './activities/activityCities';
import { ActivityEmpty, ActivityProductGrid, ProductSkeletonGrid } from './activities/ActivityProductGrid';
import { ActivityFilterDialog } from './activities/ActivityFilterDialog';
import { DEFAULT_FILTERS, SORTS, countActiveFilters, type ActivityFilters, type ActivitySort } from './activities/activityFilters';
import { useActivityList, useActivityPopularTitles } from './activities/useActivityList';
import styles from './ActivitiesScreen.module.css';

/** 여행도 고른 도시도 없을 때 마이리얼트립에서 보여 줄 도시(마이리얼트립은 한국어 이름으로 찾는다) */
const DEFAULT_CITY_KO = '서울'; // i18n-exempt: 마이리얼트립 검색에 쓰는 한국어 도시 이름(화면 문구 아님)
const POPULAR_SEARCH_COUNT = 4;

/** 도시 원형 — Klook 선택 시에는 그 도시의 Klook 투어 페이지로 나가는 링크(훅은 map 안에서 못 불러서 컴포넌트 단위) */
function KlookCityCircle({ city, label }: { city: ActivityCity; label: string }) {
  const { i18n } = useTranslation('home');
  const href = useKlookActivitiesLink(city.en, i18n.language, 'city');
  return (
    <a href={href} target="_blank" rel="sponsored noopener" className={styles.city}>
      <span className={styles.cityRing}>
        <img src={city.image} alt="" className={styles.cityImage} loading="lazy" />
      </span>
      <span className={styles.cityName}>{label}</span>
    </a>
  );
}

/**
 * 액티비티 탭 — 검색창(키워드 그대로 그 제휴사에서 검색, 외부로 이동)과 예약처 선택(마이리얼트립 | Klook),
 * 인기 여행지 원형, 추천 투어. 마이리얼트립은 상품 카드 + 정렬·상세 필터(카테고리·가격·평점·혜택),
 * Klook은 지금까지처럼 Klook 위젯. 인기 여행지 원형은 마이리얼트립에서는 추천 목록의 도시를 바꾸고, Klook에서는 Klook 도시 페이지로 나간다.
 */
export function ActivitiesScreen() {
  const { t, i18n } = useTranslation('home');
  const desktop = useMediaQuery('(min-width: 1024px)');
  const step = desktop ? 8 : 4;
  const [keyword, setKeyword] = useState('');
  const searchFormRef = useRef<HTMLFormElement>(null);
  const [provider, setProvider] = useState<ActivityProvider>(() => readActivityProvider(i18n.language));
  // 마이리얼트립 검색은 입력이 잠깐 멈추면 링크를 미리 받아 둔다 — 검색을 누르면 바로 열리게
  const [typedKeyword, setTypedKeyword] = useState('');
  useEffect(() => {
    const id = window.setTimeout(() => setTypedKeyword(keyword.trim()), 600);
    return () => window.clearTimeout(id);
  }, [keyword]);
  const prefetchedSearch = useMyrealtripLink(
    provider === 'myrealtrip' && typedKeyword.length >= 2 ? { kind: 'search', q: typedKeyword, placement: 'search' } : null,
  );
  const nearestTrip = useNearestTrip();
  const tripCityId = nearestTrip ? nearestKlookCityId(nearestTrip.city_lat!, nearestTrip.city_lng!) : null;
  const tripCity = nearestTrip ? cityDisplayName(nearestTrip.city) : '';

  // 마이리얼트립 추천 목록의 상태
  const [cityOverride, setCityOverride] = useState<ActivityCity | null>(null);
  const [sort, setSort] = useState<ActivitySort>('recommended');
  const [filters, setFilters] = useState<ActivityFilters>(DEFAULT_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);

  const isMrt = provider === 'myrealtrip';
  const activeCity = cityOverride
    ? { ko: cityOverride.ko, label: t(`activities.city.${cityOverride.key}`), isTrip: false }
    : tripCity
      ? { ko: tripCity, label: tripCity, isTrip: true }
      : { ko: DEFAULT_CITY_KO, label: t('activities.myrealtripDefaultKeyword'), isTrip: false };

  // 화면에 보여 주는 개수 — 도시·정렬·필터가 바뀌면 처음(PC 8·모바일 4)부터
  const viewKey = `${activeCity.ko}|${sort}|${JSON.stringify(filters)}|${step}`;
  const [shownState, setShownState] = useState({ key: viewKey, n: step });
  const shown = shownState.key === viewKey ? shownState.n : step;

  const list = useActivityList({ city: activeCity.ko, sort, filters, shown, enabled: isMrt });
  const visible = list.items.slice(0, shown);
  const filterCount = countActiveFilters(filters);

  // 인기 검색어 — 이 도시 기본 추천 목록 맨 앞 상품 이름(누르면 마이리얼트립 검색으로 나간다)
  const popularSearches = useActivityPopularTitles(activeCity.ko, isMrt, POPULAR_SEARCH_COUNT);

  useEffect(() => {
    trackScreenView('activities');
  }, []);

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    const q = keyword.trim();
    if (!q) {
      flagInvalid(searchFormRef.current);
      return;
    }
    if (isMrt) {
      if (prefetchedSearch && typedKeyword === q) openExternal(prefetchedSearch);
      else void openMyrealtripSearch(q, 'search');
    } else void openKlookSearch(q, i18n.language);
  }

  function chooseProvider(next: ActivityProvider) {
    setProvider(next);
    saveActivityProvider(next);
  }

  function chooseCity(city: ActivityCity) {
    setCityOverride(city);
    // 카테고리 값은 도시마다 다르다
    setFilters((f) => (f.category ? { ...f, category: null } : f));
  }

  const subtitle = activeCity.isTrip ? t('activities.subForTrip', { city: activeCity.label }) : t('activities.subForCity', { city: activeCity.label });
  const klookCityLabel = tripCityId && tripCity ? tripCity : t('activities.myrealtripDefaultKeyword');
  const klookSubtitle = tripCityId && tripCity ? t('activities.subForTrip', { city: tripCity }) : t('activities.subForCity', { city: klookCityLabel });
  const showSkeleton = isMrt && (list.isLoading || (list.items.length === 0 && (list.hasMore || list.isLoadingMore)));

  return (
    <div className={styles.page}>
      <HomeSectionTabs />
      <div className={styles.wrap}>
        <section className={styles.hero}>
          <h1 className={styles.heading}>{t('activities.heading')}</h1>
          <div className={styles.searchRow}>
            <form ref={searchFormRef} className={styles.searchForm} onSubmit={handleSearch} role="search">
              <Search size={18} className={styles.searchIcon} aria-hidden="true" />
              <input
                type="search"
                className={styles.searchInput}
                placeholder={t('activities.searchPlaceholder')}
                aria-label={t('activities.searchPlaceholder')}
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                enterKeyHint="search"
              />
              <button type="submit" className={styles.searchButton}>
                {t('activities.searchButton')}
              </button>
            </form>
            <div className={styles.provider}>
              <span className={styles.providerLabel}>{t('activities.providerShort')}</span>
              <div className={styles.providerToggle} role="group" aria-label={t('activities.providerLabel')}>
                {ACTIVITY_PROVIDERS.map((p) => (
                  <button key={p} type="button" aria-pressed={provider === p} className={provider === p ? styles.providerOn : styles.providerOff} onClick={() => chooseProvider(p)}>
                    {t(`activities.provider.${p}`)}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {isMrt && popularSearches.length > 0 ? (
            <div className={styles.keywords}>
              <span className={styles.keywordsLabel}>{t('activities.popularSearch')}</span>
              <div className={styles.keywordList}>
                {popularSearches.map((title) => (
                  <button key={title} type="button" className={styles.keyword} title={title} onClick={() => void openMyrealtripSearch(title, 'search')}>
                    {title}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <section className={styles.cities} aria-labelledby="activity-cities-title">
          <div className={styles.sectionHead}>
            <h2 id="activity-cities-title" className={styles.sectionTitle}>
              {t('activities.popularCities')}
            </h2>
            <span className={styles.sectionHint}>{t('activities.popularCitiesHint')}</span>
          </div>
          <div className={styles.cityRow}>
            {ACTIVITY_CITIES.map((city) => {
              const label = t(`activities.city.${city.key}`);
              if (!isMrt) return <KlookCityCircle key={city.key} city={city} label={label} />;
              const selected = activeCity.ko === city.ko;
              return (
                <button key={city.key} type="button" className={`${styles.city} ${selected ? styles.citySelected : ''}`} aria-pressed={selected} onClick={() => chooseCity(city)}>
                  <span className={styles.cityRing}>
                    <img src={city.image} alt="" className={styles.cityImage} loading="lazy" />
                  </span>
                  <span className={styles.cityName}>{label}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section aria-labelledby="activity-recommend-title">
          <div className={styles.recommendHead}>
            <div className={styles.recommendTitleRow}>
              <h2 id="activity-recommend-title" className={styles.recommendTitle}>
                {t('activities.recommendedTours')}
              </h2>
              <p className={styles.recommendSub}>{isMrt ? subtitle : klookSubtitle}</p>
            </div>
            {isMrt ? (
              <div className={styles.tools}>
                <div className={styles.sorts} role="group" aria-label={t('activities.sortLabel')}>
                  {SORTS.map((s) => (
                    <button key={s} type="button" className={sort === s ? styles.sortOn : styles.sortOff} aria-pressed={sort === s} onClick={() => setSort(s)}>
                      {t(`activities.sort.${s}`)}
                    </button>
                  ))}
                </div>
                <button type="button" className={styles.filterButton} onClick={() => setFilterOpen(true)} aria-haspopup="dialog">
                  <SlidersHorizontal size={14} aria-hidden="true" />
                  {t('activities.filter.button')}
                  {filterCount > 0 ? <span className={styles.filterBadge}>{filterCount}</span> : null}
                </button>
              </div>
            ) : null}
          </div>

          {isMrt ? (
            showSkeleton ? (
              <ProductSkeletonGrid count={step} />
            ) : list.isError ? (
              <ActivityEmpty kind="error" city={activeCity.ko} filtersActive={filterCount > 0} onResetFilters={() => setFilters(DEFAULT_FILTERS)} onRetry={() => void list.refetch()} />
            ) : visible.length === 0 ? (
              <ActivityEmpty kind="empty" city={activeCity.ko} filtersActive={filterCount > 0} onResetFilters={() => setFilters(DEFAULT_FILTERS)} onRetry={() => void list.refetch()} />
            ) : (
              <ActivityProductGrid
                products={visible}
                hasMore={list.hasMore}
                loadingMore={list.isLoadingMore}
                onMore={() => setShownState({ key: viewKey, n: shown + step })}
              />
            )
          ) : (
            <KlookToursWidget city={klookCityLabel} locale={i18n.language} />
          )}
          <p className={styles.providedBy}>{t('activities.providedBy', { provider: t(`activities.provider.${provider}`) })}</p>
        </section>
      </div>

      {filterOpen ? (
        <ActivityFilterDialog
          cityKo={activeCity.ko}
          cityLabel={activeCity.label}
          sort={sort}
          value={filters}
          onApply={setFilters}
          onClose={() => setFilterOpen(false)}
        />
      ) : null}
    </div>
  );
}
