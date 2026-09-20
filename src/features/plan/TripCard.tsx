import { Link } from 'react-router';
import type { TripRow } from '@/shared/api/tripService';
import { getDDay } from './tripStatus';
import styles from './TripCard.module.css';

interface TripCardProps {
  trip: TripRow;
}

/** 여행 목록 카드 (02-screens.md §3.1): 여행명 · 기간 · D-day 배지 · 도시 칩 */
export function TripCard({ trip }: TripCardProps) {
  const dday = getDDay(trip.start_date);
  return (
    <Link to={`/plan/${trip.id}`} className={styles.card}>
      <div className={styles.header}>
        <h3 className={styles.title}>{trip.title}</h3>
        {dday !== null ? (
          <span className={styles.dday}>{dday === 0 ? 'D-DAY' : `D-${dday}`}</span>
        ) : null}
      </div>
      <p className={styles.dates}>
        {trip.start_date && trip.end_date ? `${trip.start_date} ~ ${trip.end_date}` : '기간 미정'}
      </p>
      {trip.city ? (
        <div className={styles.chips}>
          <span className={styles.chip}>{trip.city}</span>
        </div>
      ) : null}
    </Link>
  );
}
