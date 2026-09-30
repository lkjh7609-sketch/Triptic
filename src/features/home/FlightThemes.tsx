import { useTranslation } from 'react-i18next';
import { captureError } from '@/shared/monitoring';
import { cheapestByTheme, formatWon, openDeal, upcomingDeals, useFlightDeals, type FlightDeal } from './flightDealsData';
import styles from './FlightThemes.module.css';

/** 테마 순서와 대표 사진(useCityImage의 큐레이션 이미지와 같은 것 — 오사카·다낭·파리) */
const THEMES: Array<{ theme: FlightDeal['theme']; image: string }> = [
  { theme: 'japan', image: 'https://images.unsplash.com/photo-1528698827591-e19ccd7bc23d?auto=format&fit=crop&w=900&q=80' },
  { theme: 'sea', image: 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?auto=format&fit=crop&w=900&q=80' },
  { theme: 'far', image: 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&w=900&q=80' },
];

/**
 * 항공 탭 "테마로 고르는 항공권" — 특가 목록(FlightDeals와 같은 요청)에서 테마마다 지금 가장 싼 도시 하나.
 * 인기·트렌드를 지어내지 않고, 실제 최저가가 있는 테마만 보여준다. 카드를 누르면 그 도시 특가 노선의 항공 결과가 열린다.
 */
export function FlightThemes() {
  const { t, i18n } = useTranslation('home');
  const { data } = useFlightDeals();
  const best = cheapestByTheme(upcomingDeals(data ?? []));
  const cards = THEMES.filter((th) => best[th.theme]);

  if (cards.length === 0) return null;

  return (
    <section className={styles.section} aria-labelledby="flight-themes-title">
      <h2 id="flight-themes-title" className={styles.title}>
        {t('flights.themes.title')}
      </h2>
      <p className={styles.subtitle}>{t('flights.themes.subtitle')}</p>
      <div className={styles.grid}>
        {cards.map(({ theme, image }) => {
          const deal = best[theme] as FlightDeal;
          const price = formatWon(deal.price, i18n.language);
          return (
            <button
              key={theme}
              type="button"
              className={styles.card}
              style={{ backgroundImage: `linear-gradient(to top, rgba(0, 0, 0, 0.78) 0%, rgba(0, 0, 0, 0.25) 55%, rgba(0, 0, 0, 0.1) 100%), url('${image}')` }}
              aria-label={t('flights.themes.open', { city: deal.city })}
              onClick={() => openDeal(deal).catch((err) => captureError(err, { context: 'flightTheme' }))}
            >
              <span className={styles.eyebrow}>{t(`flights.themes.${theme}`)}</span>
              <span className={styles.city}>{deal.city}</span>
              <span className={styles.meta}>
                {deal.airlineName ? t('flights.themes.metaAirline', { price, airline: deal.airlineName }) : t('flights.themes.meta', { price })}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
