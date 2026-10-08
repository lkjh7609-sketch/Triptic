import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { MapPin } from 'lucide-react';
import { useTrips } from '@/features/plan/hooks/useTrips';
import { useDestinations } from '@/features/community/hooks/useDestinations';
import { cityDisplayName } from '@/features/plan/cityName';
import { useCityImage } from '@/shared/hooks/useCityImage';
import { defaultDates, type HotelSearch } from './hotelSearch';
import { recommendedDestinations, type RecommendedItem } from './recommendPicks';
import styles from './RecommendedDestinations.module.css';

function Card({ item, onPick }: { item: RecommendedItem; onPick: (item: RecommendedItem) => void }) {
  const { t } = useTranslation('home');
  const fallback = useCityImage(item.name);
  const image = item.cover ?? fallback;
  return (
    <li className={styles.item}>
      <button type="button" className={styles.card} onClick={() => onPick(item)} style={{ backgroundImage: `url('${image}')` }}>
        <span className={styles.shade} aria-hidden="true" />
        {item.fromTrip ? <span className={styles.tag}>{t('hotels.recommend.myTrip')}</span> : null}
        <span className={styles.name}>
          <MapPin size={14} aria-hidden="true" /> {item.name}
        </span>
      </button>
    </li>
  );
}

/**
 * 호텔 검색 아래 추천 여행지 — 내 일정의 도시(그 여행 날짜로)를 먼저, 모자라면 인기 도시. 누르면 그 도시로 바로 검색한다.
 * 앱 화면 전용(웹은 위젯만 쓴다).
 */
export function RecommendedDestinations({ adults, onSearch }: { adults: number; onSearch: (s: HotelSearch) => void }) {
  const { t } = useTranslation('home');
  const trips = useTrips();
  const destinations = useDestinations();
  const today = format(new Date(), 'yyyy-MM-dd');
  const items = useMemo(
    () => recommendedDestinations(trips.data ?? [], destinations.data ?? [], today, cityDisplayName),
    [trips.data, destinations.data, today],
  );
  if (items.length === 0) return null;

  function pick(item: RecommendedItem) {
    const dates = item.dates ?? defaultDates();
    onSearch({ name: item.name, lat: item.lat, lng: item.lng, checkin: dates.checkin, checkout: dates.checkout, adults, childAges: [] });
  }

  return (
    <section className={styles.wrap} aria-labelledby="hotel-recommend-title">
      <h2 id="hotel-recommend-title" className={styles.title}>
        {t('hotels.recommend.title')}
      </h2>
      <p className={styles.sub}>{t('hotels.recommend.sub')}</p>
      <ul className={styles.list}>
        {items.map((item) => (
          <Card key={item.key} item={item} onPick={pick} />
        ))}
      </ul>
    </section>
  );
}
