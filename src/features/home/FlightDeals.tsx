import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, TrendingUp } from 'lucide-react';
import { Skeleton } from '@/shared/ui/states/Skeleton';
import { captureError } from '@/shared/monitoring';
import { formatMonthDay, formatWon, openDeal, upcomingDeals, useFlightDeals, type FlightDeal } from './flightDealsData';
import styles from './FlightDeals.module.css';

const MAX_CARDS = 8;

/**
 * 항공 탭 "서울(인천) 출발 최저가 특가" — 마이리얼트립 최저가 캘린더에서 인기 노선마다 가장 싼 왕복 하나.
 * 값은 실시간이 아니라 저장된 최저가라서 그렇게 밝히고, 카드를 누르면 그 노선·날짜로 마이리얼트립 항공 결과가 새 탭으로 열린다.
 * 특가를 못 받거나 없으면 이 구역은 통째로 숨긴다(빈 제목만 남지 않게).
 */
export function FlightDeals() {
  const { t, i18n } = useTranslation('home');
  const { data, isLoading } = useFlightDeals();
  const trackRef = useRef<HTMLDivElement>(null);
  const deals = upcomingDeals(data ?? []).slice(0, MAX_CARDS);

  if (!isLoading && deals.length === 0) return null;

  function scroll(direction: -1 | 1) {
    const el = trackRef.current;
    if (el) el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: 'smooth' });
  }

  function handleOpen(deal: FlightDeal) {
    openDeal(deal).catch((err) => captureError(err, { context: 'flightDeal' }));
  }

  return (
    <section className={styles.section} aria-labelledby="flight-deals-title">
      <div className={styles.head}>
        <div className={styles.headText}>
          <h2 id="flight-deals-title" className={styles.title}>
            <TrendingUp size={22} aria-hidden="true" className={styles.titleIcon} />
            {t('flights.deals.title')}
          </h2>
          <p className={styles.notice}>{t('flights.deals.notice')}</p>
        </div>
        <div className={styles.arrows}>
          <button type="button" className={styles.arrow} onClick={() => scroll(-1)} aria-label={t('flights.deals.prev')}>
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <button type="button" className={styles.arrow} onClick={() => scroll(1)} aria-label={t('flights.deals.next')}>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div ref={trackRef} className={styles.track}>
        {isLoading
          ? Array.from({ length: 4 }, (_, i) => (
              <div key={i} className={styles.card}>
                <Skeleton height="148px" />
              </div>
            ))
          : deals.map((deal) => (
              <button key={deal.code} type="button" className={styles.card} onClick={() => handleOpen(deal)} aria-label={t('flights.deals.open', { city: deal.city })}>
                <span className={styles.cardTop}>
                  <span className={deal.discountPct ? styles.tagDiscount : styles.tagPlain}>
                    {deal.discountPct ? t('flights.deals.discount', { pct: deal.discountPct }) : t('flights.deals.plain')}
                  </span>
                  {deal.airlineName ? <span className={styles.airline}>{deal.airlineName}</span> : null}
                </span>
                <span className={styles.city}>{deal.city}</span>
                <span className={styles.airport}>
                  {deal.airport} ({deal.code})
                </span>
                <span className={styles.cardBottom}>
                  <span className={styles.dates}>{t('flights.deals.dates', { start: formatMonthDay(deal.departDate), end: formatMonthDay(deal.returnDate) })}</span>
                  <span className={styles.priceBox}>
                    <span className={styles.priceLabel}>{t('flights.deals.lowest')}</span>
                    <span className={styles.price}>{t('flights.deals.priceFrom', { price: formatWon(deal.price, i18n.language) })}</span>
                  </span>
                </span>
              </button>
            ))}
      </div>
    </section>
  );
}
