import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BedDouble, ChevronDown, Coffee, ExternalLink, MapPin, RefreshCw, ShieldCheck, SlidersHorizontal, Star, X } from 'lucide-react';
import { useProfile } from '@/shared/hooks/useProfile';
import { EXTERNAL_LINK_PROPS, formatMoney, kayakCurrency, kayakLang, type HotelQuery, type HotelSort, type KayakHotel } from '@/features/kayak/kayakApi';
import { HOTEL_SORTS, HotelFilters, NO_FILTERS, activeFilterCount, type HotelFilterState } from './HotelFilters';
import type { HotelSearch } from './hotelSearch';
import { useHotelResults } from './useHotelResults';
import styles from './HotelResults.module.css';

function Gallery({ images, name }: { images: string[]; name: string }) {
  const [broken, setBroken] = useState(false);
  const shown = images.slice(0, 5);
  if (shown.length === 0 || broken) {
    return (
      <div className={styles.noPhoto} aria-hidden="true">
        <BedDouble size={28} />
      </div>
    );
  }
  return (
    <div className={styles.gallery}>
      {shown.map((src, i) => (
        <img key={src + i} src={src} alt={i === 0 ? name : ''} className={styles.photo} loading="lazy" decoding="async" onError={() => setBroken(true)} />
      ))}
    </div>
  );
}

function HotelCard({ hotel, currency, language }: { hotel: KayakHotel; currency: string; language: string }) {
  const { t } = useTranslation('home');
  const [open, setOpen] = useState(false);
  const best = hotel.rates[0];
  const perNight = hotel.lowest / hotel.nights;
  const breakfast = hotel.rates.some((r) => r.breakfast);
  return (
    <li className={styles.card}>
      <Gallery images={hotel.images} name={hotel.name} />
      <div className={styles.info}>
        <div className={styles.titleRow}>
          <h3 className={styles.name}>{hotel.name}</h3>
          {hotel.guestRating !== null ? (
            <span className={styles.rating} title={t('hotels.guestRating')}>
              {hotel.guestRating.toFixed(1)}
            </span>
          ) : null}
        </div>
        {hotel.stars > 0 ? (
          <span className={styles.stars} aria-label={t('hotels.starsN', { count: hotel.stars })}>
            {Array.from({ length: hotel.stars }, (_, i) => (
              <Star key={i} size={13} fill="currentColor" aria-hidden="true" />
            ))}
          </span>
        ) : null}
        <p className={styles.meta}>
          <MapPin size={13} aria-hidden="true" />
          <span className={styles.metaText}>
            {hotel.distanceM !== null ? t('hotels.fromCenter', { km: (hotel.distanceM / 1000).toFixed(1) }) : hotel.address}
            {hotel.reviews ? ` · ${t('hotels.reviewsN', { count: hotel.reviews })}` : ''}
          </span>
        </p>
        <div className={styles.badges}>
          {hotel.freeCancel ? (
            <span className={styles.badgeGood}>
              <ShieldCheck size={12} aria-hidden="true" /> {t('hotels.freeCancel')}
            </span>
          ) : null}
          {breakfast ? (
            <span className={styles.badge}>
              <Coffee size={12} aria-hidden="true" /> {t('hotels.breakfast')}
            </span>
          ) : null}
        </div>
      </div>
      <div className={styles.buy}>
        <span className={styles.price}>{formatMoney(perNight, currency, language)}</span>
        <span className={styles.perNight}>{t('hotels.perNight')}</span>
        <span className={styles.total}>{t('hotels.totalFor', { nights: hotel.nights, price: formatMoney(hotel.lowest, currency, language) })}</span>
        <a className={styles.book} href={best.url} {...EXTERNAL_LINK_PROPS}>
          {t('hotels.book')} <ExternalLink size={14} aria-hidden="true" />
        </a>
        <span className={styles.via}>{t('hotels.via', { provider: best.provider })}</span>
        {hotel.rates.length > 1 ? (
          <button type="button" className={styles.more} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            {t('hotels.compareRooms', { count: hotel.rates.length })}
            <ChevronDown size={14} aria-hidden="true" className={open ? styles.chevOpen : undefined} />
          </button>
        ) : null}
      </div>
      {open ? (
        <ul className={styles.rates}>
          {hotel.rates.map((r, i) => (
            <li key={i} className={styles.rate}>
              <span className={styles.rateMain}>
                <span className={styles.roomName}>{r.room || t('hotels.room')}</span>
                <span className={styles.rateBadges}>
                  {r.freeCancel ? <span className={styles.badgeGood}>{t('hotels.freeCancel')}</span> : null}
                  {r.breakfast ? <span className={styles.badge}>{t('hotels.breakfast')}</span> : null}
                  {r.payLater ? <span className={styles.badge}>{t('hotels.payLater')}</span> : null}
                </span>
                <span className={styles.rateProvider}>{r.provider}</span>
              </span>
              <span className={styles.ratePrice}>{formatMoney(r.total, currency, language)}</span>
              <a className={styles.rateBook} href={r.url} {...EXTERNAL_LINK_PROPS}>
                {t('hotels.book')} <ExternalLink size={12} aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/** 호텔 검색 결과 — 목록은 우리 화면 안에, 예약은 Kayak(호텔스컴바인 포함) 예약 링크. PC는 왼쪽 필터, 모바일은 필터 시트 */
export function HotelResults({ search }: { search: HotelSearch }) {
  const { t, i18n } = useTranslation('home');
  const { data: profile } = useProfile();
  const currency = kayakCurrency(profile?.base_currency, i18n.language);
  const [sort, setSort] = useState<HotelSort>('popularity');
  const [filters, setFilters] = useState<HotelFilterState>(NO_FILTERS);
  const [sheetOpen, setSheetOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  const query: HotelQuery = useMemo(
    () => ({
      destination: search.destination,
      checkin: search.checkin,
      checkout: search.checkout,
      adults: search.adults,
      rooms: search.rooms,
      childAges: search.childAges,
      currency,
      lang: kayakLang(i18n.language),
      sort,
      stars: filters.stars,
      guestRating: filters.guestRating,
      minPrice: null,
      maxPrice: filters.maxPrice,
      propertyTypes: filters.propertyTypes,
      facilities: filters.facilities,
    }),
    [search, currency, i18n.language, sort, filters],
  );
  const r = useHotelResults(query);
  const filterCount = activeFilterCount(filters);
  const setF = useCallback((f: HotelFilterState) => setFilters(f), []);

  // 시트가 열리면 안으로 포커스, Esc로 닫기(바깥 눌러도 닫히지 않는다 — 앱 공통 규칙)
  useEffect(() => {
    if (!sheetOpen) return;
    sheetRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSheetOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [sheetOpen]);

  if (r.error === 'unavailable') {
    return (
      <section className={styles.state} aria-live="polite">
        <BedDouble size={24} aria-hidden="true" />
        <h2 className={styles.stateTitle}>{t('hotels.comingSoon.title')}</h2>
        <p className={styles.stateBody}>{t('hotels.comingSoon.body')}</p>
      </section>
    );
  }

  const facets = r.facets;
  return (
    <section className={styles.wrap} aria-label={t('hotels.results')} aria-busy={r.loading}>
      <div className={styles.layout}>
        {facets ? (
          <aside className={styles.sidebar} aria-label={t('hotels.filters.title')}>
            <div className={styles.sideHead}>
              <h2 className={styles.sideTitle}>{t('hotels.filters.title')}</h2>
              {filterCount > 0 ? (
                <button type="button" className={styles.reset} onClick={() => setF(NO_FILTERS)}>
                  {t('hotels.filters.reset')}
                </button>
              ) : null}
            </div>
            <HotelFilters facets={facets} value={filters} currency={r.currency || currency} onChange={setF} />
          </aside>
        ) : null}

        <div className={styles.main}>
          <div className={styles.toolbar}>
            <p className={styles.count} role="status">
              {r.loading ? (
                <>
                  <RefreshCw size={14} aria-hidden="true" className={styles.spin} /> {t('hotels.searching')}
                </>
              ) : (
                t('hotels.countN', { count: r.total })
              )}
            </p>
            <div className={styles.tools}>
              {facets ? (
                <button type="button" className={styles.filterButton} onClick={() => setSheetOpen(true)} aria-haspopup="dialog">
                  <SlidersHorizontal size={16} aria-hidden="true" />
                  {t('hotels.filters.title')}
                  {filterCount > 0 ? <span className={styles.filterBadge}>{filterCount}</span> : null}
                </button>
              ) : null}
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

          {r.sandbox ? <p className={styles.sandbox}>{t('hotels.sandbox')}</p> : null}
          {r.error === 'failed' ? <p className={styles.error}>{t('hotels.error')}</p> : null}

          {r.loading && r.hotels.length === 0 ? (
            <ul className={styles.list} aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <li key={i} className={styles.skeleton} />
              ))}
            </ul>
          ) : r.hotels.length > 0 ? (
            <>
              <ul className={styles.list}>
                {r.hotels.map((h) => (
                  <HotelCard key={h.id} hotel={h} currency={r.currency || currency} language={i18n.language} />
                ))}
              </ul>
              {r.hasMore ? (
                <button type="button" className={styles.loadMore} disabled={r.loadingMore} onClick={r.loadMore}>
                  {r.loadingMore ? t('hotels.loadingMore') : t('hotels.loadMore')}
                </button>
              ) : null}
              <p className={styles.note}>{t('hotels.priceNote')}</p>
            </>
          ) : !r.loading && !r.error ? (
            <p className={styles.empty}>{t('hotels.empty')}</p>
          ) : null}
        </div>
      </div>

      {sheetOpen && facets ? (
        <div className={styles.sheetOverlay}>
          <div ref={sheetRef} className={styles.sheet} role="dialog" aria-modal="true" aria-label={t('hotels.filters.title')} tabIndex={-1}>
            <div className={styles.sheetHead}>
              <h2 className={styles.sideTitle}>{t('hotels.filters.title')}</h2>
              <button type="button" className={styles.sheetClose} onClick={() => setSheetOpen(false)} aria-label={t('action.close', { ns: 'common' })}>
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <div className={styles.sheetBody}>
              <HotelFilters facets={facets} value={filters} currency={r.currency || currency} onChange={setF} />
            </div>
            <div className={styles.sheetFoot}>
              <button type="button" className={styles.reset} onClick={() => setF(NO_FILTERS)} disabled={filterCount === 0}>
                {t('hotels.filters.reset')}
              </button>
              <button type="button" className={styles.apply} onClick={() => setSheetOpen(false)}>
                {t('hotels.filters.showResults', { count: r.total })}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
