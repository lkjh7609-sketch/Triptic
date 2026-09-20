import { LegLabel } from './LegLabel';
import type { RouteLeg } from './map/useTripRoutes';
import type { FlightInfo } from './types';
import styles from './FixedPointCard.module.css';

/**
 * 여정의 고정 지점(숙소·항공편) 카드 (index.html .fixed-item 이식 — ADR-001)
 * TripDetailScreen(편집 가능)과 SharedTripScreen(읽기 전용 공유 뷰)이 함께 쓴다.
 */

/** 구간 라벨 래퍼 — 대응하는 leg가 없으면(고정 지점 사이 등) 아무것도 그리지 않는다 */
export function LegBetween({ leg }: { leg: RouteLeg | undefined }) {
  if (!leg) return null;
  return <LegLabel leg={leg} />;
}

interface FixedPointCardProps {
  icon: string;
  label: string;
  name: string;
  address?: string;
}

/** 숙소 등 고정 지점 카드 (index.html .fixed-item 이식) */
export function FixedPointCard({ icon, label, name, address }: FixedPointCardProps) {
  return (
    <div className={styles.fixedItem}>
      <span className={styles.fixedLabel}>
        {icon} {label}
      </span>
      <span className={styles.fixedName}>{name}</span>
      {address ? <span className={styles.fixedAddress}>{address}</span> : null}
    </div>
  );
}

/** 항공편 카드 (index.html .fixed-item.flight-item 이식) */
export function FlightPointCard({ flight }: { flight: FlightInfo }) {
  const airlineTag = flight.airline ? ` (${flight.airline})` : '';
  return (
    <div className={styles.fixedItem}>
      <span className={styles.fixedLabel}>✈️ {flight.flightNo}</span>
      <span className={styles.fixedName}>
        {flight.dep.name || flight.dep.iata || '?'} → {flight.arr.name || flight.arr.iata || '?'}
        {airlineTag}
      </span>
      <span className={styles.fixedAddress}>
        {flight.dep.time || ''} 출발 → {flight.arr.time || ''} 도착
      </span>
    </div>
  );
}
