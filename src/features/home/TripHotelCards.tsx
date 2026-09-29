import { useTranslation } from 'react-i18next';
import { TRIP_CARD_SIZE, TRIP_HOTEL_CARDS, tripHotelCardSrc } from './tripPartner';
import styles from './TripHotelCards.module.css';

/**
 * 호텔 화면 검색창 아래 추천 호텔 배너 3개 + "Powered by Trip.com".
 * 트립닷컴 배너(iframe)라 화면을 열 때 트립닷컴에서 불러온다 — 아래쪽이라 lazy로, 좁은 화면은 가로로 넘겨 본다.
 * sandbox는 걸지 않는다(걸면 배너가 예약 화면을 못 연다).
 */
export function TripHotelCards() {
  const { t, i18n } = useTranslation('home');
  return (
    <section className={styles.section} aria-label={t('hotels.cards.label')}>
      <div className={styles.row}>
        {TRIP_HOTEL_CARDS.map((card, i) => (
          <div key={card.code} className={styles.card}>
            <iframe
              className={styles.iframe}
              src={tripHotelCardSrc(card, i18n.language)}
              title={t('hotels.cards.title', { n: i + 1 })}
              width={TRIP_CARD_SIZE.width}
              height={TRIP_CARD_SIZE.height}
              frameBorder="0"
              scrolling="no"
              loading="lazy"
            />
          </div>
        ))}
      </div>
      <p className={styles.powered}>
        Powered by <span className={styles.wordmark}>Trip.com</span>
      </p>
    </section>
  );
}
