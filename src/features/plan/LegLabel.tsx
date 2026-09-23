import { Skeleton } from '@/shared/ui/states/Skeleton';
import { haversineKm, type GeoPoint } from './map/geo';
import { buildTransitDeepLinkUrl } from './map/deepLink';
import type { RouteLeg } from './map/useTripRoutes';
import styles from './LegLabel.module.css';

interface LegLabelProps {
  leg: RouteLeg;
}

/** km 값을 스펙 표기(73.2km / 900m)로 포맷한다 */
function formatDistanceKm(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km.toFixed(1)}km`;
}

/**
 * 구간 라벨 (01-design-system.md §6.3)
 * 로딩 중엔 스켈레톤, 실패 시 Haversine 직선거리에 ≈ 접두사, 성공 시 실제 대중교통
 * 거리/시간. 탭하면 Google Maps 길찾기 딥링크로 이동한다 (기존 buildDeepLinkHTML 동작 유지).
 */
export function LegLabel({ leg }: LegLabelProps) {
  if (leg.status === 'loading') {
    return (
      <div className={styles.wrap}>
        <Skeleton height="14px" width="64px" />
      </div>
    );
  }

  const url = buildTransitDeepLinkUrl(leg.from as GeoPoint, leg.to as GeoPoint);

  if (leg.status === 'estimate') {
    const km = haversineKm(leg.from.lat, leg.from.lng, leg.to.lat, leg.to.lng);
    return (
      <div className={styles.wrap}>
        <a href={url} target="_blank" rel="noopener" className={`${styles.link} ${styles.estimate}`}>
          ≈ {formatDistanceKm(km)}
        </a>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <a href={url} target="_blank" rel="noopener" className={styles.link}>
        {leg.distanceText}
      </a>
    </div>
  );
}
