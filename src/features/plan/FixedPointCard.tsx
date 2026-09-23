import { useTranslation } from 'react-i18next';
import { LegLabel } from './LegLabel';
import type { RouteLeg } from './map/useTripRoutes';
import type { FlightInfo } from './types';
import styles from './FixedPointCard.module.css';
import { Plane, ExternalLink } from 'lucide-react';

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
  icon: React.ReactNode;
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
  const { t } = useTranslation('plan');
  const airlineTag = flight.airline ? ` (${flight.airline})` : '';
  return (
    <div className={styles.fixedItem}>
      <span className={styles.fixedLabel}><span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Plane size={16} /> {flight.flightNo}</span></span>
      <span className={styles.fixedName}>
        {flight.dep.name || flight.dep.iata || '?'}
        {flight.dep.lat && flight.dep.lng ? (
          <a href={`https://www.google.com/maps/search/?api=1&query=${flight.dep.lat},${flight.dep.lng}`} target="_blank" rel="noopener" style={{ marginLeft: 4, color: 'var(--brand)', textDecoration: 'none' }}>
            <ExternalLink size={12} />
          </a>
        ) : null}
        {" → "}
        {flight.arr.name || flight.arr.iata || '?'}
        {flight.arr.lat && flight.arr.lng ? (
          <a href={`https://www.google.com/maps/search/?api=1&query=${flight.arr.lat},${flight.arr.lng}`} target="_blank" rel="noopener" style={{ marginLeft: 4, color: 'var(--brand)', textDecoration: 'none' }}>
            <ExternalLink size={12} />
          </a>
        ) : null}
        {airlineTag}
      </span>
      <span className={styles.fixedAddress}>
        {t('flightCard.schedule', { depTime: flight.dep.time || '', arrTime: flight.arr.time || '' })}
      </span>
    </div>
  );
}
