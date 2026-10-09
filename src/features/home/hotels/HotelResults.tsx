import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BedDouble, Coffee, ExternalLink, RefreshCw, SlidersHorizontal, Star, Wifi, X } from 'lucide-react';
import { useProfile } from '@/shared/hooks/useProfile';
import { isNativeApp } from '@/shared/platform';
import { HOTEL_SORTS, formatMoney, hotelCurrency, hotelLang, type Hotel, type HotelQuery, type HotelSort } from './hotelsApi';
import { HotelSearchWidget } from './HotelSearchWidget';
import { HotelFilters, NO_FILTERS, activeFilterCount, type HotelFilterState } from './HotelFilters';
import type { HotelSearch } from './hotelSearch';
import { useHotelResults } from './useHotelResults';
import styles from './HotelResults.module.css';

/** 예약 페이지로 — 새 탭(앱에서는 인앱 브라우저로 바뀐다), 추천인 정보 없이, 제휴 링크 표시 */
const EXTERNAL_LINK_PROPS = { target: '_blank', rel: 'sponsored noopener noreferrer' } as const;

function Photo({ src, name }: { src: string | null; name: string }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return (
      <div className={styles.noPhoto} aria-hidden="true">
        <BedDouble size={28} />
      </div>
    );
  }
  return (
    <div className={styles.gallery}>
      <img src={src} alt={name} className={styles.photo} loading="lazy" decoding="async" onError={() => setBroken(true)} />
    </div>
  );
}

function HotelCard({ hotel, currency, language, pinned = false }: { hotel: Hotel; currency: string; language: string; pinned?: boolean }) {
  const { t } = useTranslation('home');
  return (
    <li className={pinned ? `${styles.card} ${styles.cardPinned}` : styles.card}>
      <Photo src={hotel.image} name={hotel.name} />
      <div className={styles.info}>
        {pinned ? <span className={styles.pinnedTag}>{t('hotels.pinned.tag')}</span> : null}
        <div className={styles.titleRow}>
          <h3 className={styles.name}>{hotel.name}</h3>
          {hotel.reviewScore !== null ? (
            <span className={styles.rating} title={t('hotels.guestRating')}>
              {hotel.reviewScore.toFixed(1)}
            </span>
          ) : null}
        </div>
        {hotel.stars > 0 ? (
          <span className={styles.stars} aria-label={t('hotels.starsN', { count: hotel.stars })}>
            {Array.from({ length: Math.floor(hotel.stars) }, (_, i) => (
              <Star key={i} size={13} fill="currentColor" aria-hidden="true" />
            ))}
          </span>
        ) : null}
        {hotel.reviewCount ? (
          <p className={styles.meta}>
            <span className={styles.metaText}>{t('hotels.reviewsN', { count: hotel.reviewCount })}</span>
          </p>
        ) : null}
        <div className={styles.badges}>
          {hotel.discountPct ? <span className={styles.badgeGood}>{t('hotels.discountN', { pct: hotel.discountPct })}</span> : null}
          {hotel.breakfast ? (
            <span className={styles.badge}>
              <Coffee size={12} aria-hidden="true" /> {t('hotels.breakfast')}
            </span>
          ) : null}
          {hotel.wifi ? (
            <span className={styles.badge}>
              <Wifi size={12} aria-hidden="true" /> {t('hotels.wifi')}
            </span>
          ) : null}
        </div>
      </div>
      <div className={styles.buy}>
        {hotel.crossedOut ? <span className={styles.crossed}>{formatMoney(hotel.crossedOut, currency, language)}</span> : null}
        <span className={styles.price}>{formatMoney(hotel.price, currency, language)}</span>
        <span className={styles.perNight}>{t('hotels.perNight')}</span>
        <a className={styles.book} href={hotel.url} {...EXTERNAL_LINK_PROPS}>
          {t('hotels.book')} <ExternalLink size={14} aria-hidden="true" />
        </a>
      </div>
    </li>
  );
}

/** 호텔 검색 결과 — 목록·필터·정렬은 우리 화면 안에, 예약은 예약 페이지 링크. PC는 왼쪽 필터, 모바일은 필터 시트 */
export function HotelResults({ search }: { search: HotelSearch }) {
  const { t, i18n } = useTranslation('home');
  const { data: profile } = useProfile();
  const currency = hotelCurrency(profile?.base_currency, i18n.language);
  const [sort, setSort] = useState<HotelSort>('recommended');
  const [filters, setFilters] = useState<HotelFilterState>(NO_FILTERS);
  const [sheetOpen, setSheetOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  const query: HotelQuery = useMemo(
    () => ({
      lat: search.lat,
      lng: search.lng,
      checkin: search.checkin,
      checkout: search.checkout,
      adults: search.adults,
      childAges: search.childAges,
      currency,
      lang: hotelLang(i18n.language),
      sort,
      minStars: filters.minStars,
      minReview: filters.minReview,
      minPrice: null,
      maxPrice: filters.maxPrice,
      discountOnly: filters.discountOnly,
      ...(search.hotelId ? { hotelId: search.hotelId } : {}),
    }),
    [search, currency, i18n.language, sort, filters],
  );
  const r = useHotelResults(query);
  const filterCount = activeFilterCount(filters);
  const setF = useCallback((f: HotelFilterState) => setFilters(f), []);
  const hotels = r.data?.hotels ?? [];
  const pinned = r.data?.pinned ?? null;
  const resultCurrency = r.data?.currency ?? currency;

  // 시트가 열리면 안으로 포커스, Esc로 닫기(바깥 눌러도 닫히지 않는다 — 앱 공통 규칙)
  useEffect(() => {
    if (!sheetOpen) return;
    sheetRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSheetOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [sheetOpen]);

  if (r.error === 'unavailable') {
    // 우리 검색을 못 쓸 때(제휴 키 없음 등) 웹은 제휴사 검색창 위젯으로 대신하고, 앱은 준비 중 안내
    if (!isNativeApp()) return <HotelSearchWidget />;
    return (
      <section className={styles.state} aria-live="polite">
        <BedDouble size={24} aria-hidden="true" />
        <h2 className={styles.stateTitle}>{t('hotels.comingSoon.title')}</h2>
        <p className={styles.stateBody}>{t('hotels.comingSoon.body')}</p>
      </section>
    );
  }

  // 그 좌표 근처에 도시가 없는 장소(바다 한가운데 등)
  if (r.data && r.data.city === null) {
    return (
      <section className={styles.state} aria-live="polite">
        <BedDouble size={24} aria-hidden="true" />
        <h2 className={styles.stateTitle}>{t('hotels.noCity.title')}</h2>
        <p className={styles.stateBody}>{t('hotels.noCity.body')}</p>
      </section>
    );
  }

  return (
    <section className={styles.wrap} aria-label={t('hotels.results')} aria-busy={r.loading}>
      <div className={styles.layout}>
        <aside className={styles.sidebar} aria-label={t('hotels.filters.title')}>
          <div className={styles.sideHead}>
            <h2 className={styles.sideTitle}>{t('hotels.filters.title')}</h2>
            {filterCount > 0 ? (
              <button type="button" className={styles.reset} onClick={() => setF(NO_FILTERS)}>
                {t('hotels.filters.reset')}
              </button>
            ) : null}
          </div>
          <HotelFilters facets={r.facets} value={filters} currency={resultCurrency} onChange={setF} />
        </aside>

        <div className={styles.main}>
          <div className={styles.toolbar}>
            <p className={styles.count} role="status">
              {r.loading ? (
                <>
                  <RefreshCw size={14} aria-hidden="true" className={styles.spin} /> {t('hotels.searching')}
                </>
              ) : (
                t('hotels.countN', { count: hotels.length + (pinned ? 1 : 0) })
              )}
            </p>
            <div className={styles.tools}>
              <button type="button" className={styles.filterButton} onClick={() => setSheetOpen(true)} aria-haspopup="dialog">
                <SlidersHorizontal size={16} aria-hidden="true" />
                {t('hotels.filters.title')}
                {filterCount > 0 ? <span className={styles.filterBadge}>{filterCount}</span> : null}
              </button>
              <label className={styles.sortLabel}>
                <span className={styles.srOnly}>{t('hotels.sortLabel')}</span>
                <select className={styles.sortSelect} value={sort} onChange={(e) => setSort(e.target.value as HotelSort)}>
                  {HOTEL_SORTS.map((s) => (
                    <option key={s} value={s}>
                      {t(`hotels.sort.${s}`)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {r.error === 'failed' ? <p className={styles.error}>{t('hotels.error')}</p> : null}

          {r.loading && hotels.length === 0 ? (
            <ul className={styles.list} aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <li key={i} className={styles.skeleton} />
              ))}
            </ul>
          ) : pinned || hotels.length > 0 ? (
            <>
              {/* 호텔 이름으로 고른 검색 — 그 호텔은 필터와 상관없이 맨 위에, 같은 도시 추천은 그 아래에 */}
              {r.data?.pinnedId && !pinned ? <p className={styles.pinnedMissing}>{t('hotels.pinned.unavailable', { name: search.name })}</p> : null}
              {pinned ? (
                <ul className={styles.list}>
                  <HotelCard hotel={pinned} currency={resultCurrency} language={i18n.language} pinned />
                </ul>
              ) : null}
              {pinned && hotels.length > 0 ? <h3 className={styles.recommendTitle}>{t('hotels.pinned.more', { city: r.data?.city?.name ?? '' })}</h3> : null}
              <ul className={styles.list}>
                {hotels.map((h) => (
                  <HotelCard key={h.id} hotel={h} currency={resultCurrency} language={i18n.language} />
                ))}
              </ul>
              <p className={styles.note}>{t('hotels.priceNote')}</p>
            </>
          ) : !r.loading && !r.error ? (
            <p className={styles.empty}>{t('hotels.empty')}</p>
          ) : null}
        </div>
      </div>

      {sheetOpen ? (
        <div className={styles.sheetOverlay}>
          <div ref={sheetRef} className={styles.sheet} role="dialog" aria-modal="true" aria-label={t('hotels.filters.title')} tabIndex={-1}>
            <div className={styles.sheetHead}>
              <h2 className={styles.sideTitle}>{t('hotels.filters.title')}</h2>
              <button type="button" className={styles.sheetClose} onClick={() => setSheetOpen(false)} aria-label={t('action.close', { ns: 'common' })}>
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <div className={styles.sheetBody}>
              <HotelFilters facets={r.facets} value={filters} currency={resultCurrency} onChange={setF} />
            </div>
            <div className={styles.sheetFoot}>
              <button type="button" className={styles.reset} onClick={() => setF(NO_FILTERS)} disabled={filterCount === 0}>
                {t('hotels.filters.reset')}
              </button>
              <button type="button" className={styles.apply} onClick={() => setSheetOpen(false)}>
                {t('hotels.filters.showResults', { count: hotels.length })}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
