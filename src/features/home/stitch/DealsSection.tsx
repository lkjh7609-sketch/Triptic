import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Flame } from 'lucide-react';
import { useCityImage } from '@/shared/hooks/useCityImage';
import { Skeleton } from '@/shared/ui/states/Skeleton';
import { captureError } from '@/shared/monitoring';
import { formatMonthDay, formatWon, openDeal, upcomingDeals, useFlightDeals, type FlightDeal } from '../flightDealsData';
import { DEAL_CITY_INFO, DEAL_PHOTOS } from './dealCities';
import { HOME_DEAL_COUNT, pickHomeDeals } from './homeUtils';
import shared from './shared.module.css';
import styles from './DealsSection.module.css';

function regionName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

function DealPhoto({ code, desktop }: { code: string; desktop: boolean }) {
  const info = DEAL_CITY_INFO[code];
  const fallback = useCityImage(DEAL_PHOTOS[code] ? null : info?.en);
  const photo = DEAL_PHOTOS[code];
  const src = photo ? (desktop ? photo.pc : photo.mobile) : fallback;
  return <img src={src} alt="" className={styles.photo} loading="lazy" decoding="async" />;
}

function DealCard({ deal, desktop }: { deal: FlightDeal; desktop: boolean }) {
  const { t, i18n } = useTranslation('home');
  const locale = i18n.language;
  const info = DEAL_CITY_INFO[deal.code];
  const city = t(`page.dealCity.${deal.code}`, { defaultValue: deal.city });
  const country = info ? regionName(info.country, locale) : '';
  const dates = `${formatMonthDay(deal.departDate)} - ${formatMonthDay(deal.returnDate)}`;
  const airline = deal.airlineName ?? '';
  const pct = deal.discountPct;

  function handleOpen() {
    openDeal(deal).catch((err) => captureError(err, { context: 'flightDeal' }));
  }

  return (
    <button
      type="button"
      className={`${shared.card} ${shared.cardLift} ${styles.card}`}
      onClick={handleOpen}
      aria-label={t('flights.deals.open', { city })}
    >
      <span className={styles.media}>
        <DealPhoto code={deal.code} desktop={desktop} />
        {pct ? <span className={styles.badge}>{t('page.deals.discount', { pct })}</span> : null}
        {desktop ? (
          <span className={styles.overlay}>
            <span className={styles.country}>{country}</span>
            <span className={styles.cityName}>{`${city} (${deal.code})`}</span>
          </span>
        ) : null}
      </span>
      <span className={styles.body}>
        {desktop ? (
          <>
            <span className={styles.lines}>
              <span className={styles.lineRow}>
                <span>{airline ? `${airline} · ${t('page.deals.direct')}` : t('page.deals.direct')}</span>
                <span>{dates}</span>
              </span>
              <span className={styles.basis}>{t('page.deals.basis')}</span>
            </span>
            <span className={styles.priceBand}>
              {deal.average && pct ? <span className={styles.was}>{t('page.deals.won', { price: formatWon(deal.average, locale) })}</span> : <span />}
              <span className={styles.price}>{t('flights.deals.priceFrom', { price: formatWon(deal.price, locale) })}</span>
            </span>
          </>
        ) : (
          <>
            <span className={styles.lines}>
              <span className={styles.lineRow}>
                <span className={styles.mCity}>{`${city} (${deal.code})`}</span>
                <span className={styles.direct}>{t('page.deals.direct')}</span>
              </span>
              <span className={styles.mMeta}>{airline ? `${airline} · ${dates}` : dates}</span>
            </span>
            <span className={styles.mPrice}>
              {deal.average && pct ? <span className={styles.was}>{t('page.deals.won', { price: formatWon(deal.average, locale) })}</span> : null}
              <span className={styles.price}>{t('flights.deals.priceFrom', { price: formatWon(deal.price, locale) })}</span>
            </span>
          </>
        )}
      </span>
    </button>
  );
}

/** "서울(인천) 출발 최저가 특가" — 마이리얼트립 최저가 캘린더의 특가 4개. 특가를 못 받으면 구역 전체를 숨긴다 */
export function DealsSection({ desktop }: { desktop: boolean }) {
  const { t } = useTranslation('home');
  const { data, isLoading } = useFlightDeals();
  const deals = pickHomeDeals(upcomingDeals(data ?? []));
  if (!isLoading && deals.length === 0) return null;

  return (
    <section className={shared.section} aria-labelledby="home-deals-title">
      <div className={shared.head}>
        <div className={shared.headText}>
          <div className={shared.titleRow}>
            {desktop ? null : <Flame size={20} aria-hidden="true" className={styles.flame} />}
            <h2 id="home-deals-title" className={shared.title}>
              {t('flights.deals.title')}
            </h2>
            {desktop ? <span className={shared.pill}>{t('page.deals.badge')}</span> : null}
          </div>
          <p className={shared.sub}>{desktop ? t('page.deals.notice') : t('page.deals.noticeMobile')}</p>
        </div>
        <Link to="/flights" className={shared.moreLink}>
          {desktop ? t('page.viewAll') : t('page.more')}
          <ChevronRight size={desktop ? 18 : 14} aria-hidden="true" />
        </Link>
      </div>
      <div className={styles.grid}>
        {isLoading
          ? Array.from({ length: HOME_DEAL_COUNT }, (_, i) => (
              <div key={i} className={`${shared.card} ${styles.card}`}>
                <Skeleton height={desktop ? '280px' : '200px'} />
              </div>
            ))
          : deals.map((deal) => <DealCard key={deal.code} deal={deal} desktop={desktop} />)}
      </div>
    </section>
  );
}
