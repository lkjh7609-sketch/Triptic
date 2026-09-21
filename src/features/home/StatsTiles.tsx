import type { TravelStats } from './useHomeStats';
import styles from './StatsTiles.module.css';

interface StatsTilesProps {
  stats: TravelStats;
}

/**
 * 나의 여행 기록 통계 타일 (02-screens.md §2.1, §2.2)
 * groundMeters가 null로 오는 경우(RPC 자체가 실패했거나 구형 응답)를 대비해
 * "0"이 아니라 "—"로 표시하는 방어 코드를 남겨둔다 — ADR-002 이관 후
 * get_user_travel_stats()는 실제로 항상 0 이상의 숫자를 반환한다
 * (useHomeStats.ts §5 coalesce 참고).
 */
export function StatsTiles({ stats }: StatsTilesProps) {
  const km = stats.groundMeters != null ? Math.round(stats.groundMeters / 1000).toLocaleString() : '—';
  return (
    <div className={styles.grid}>
      <Tile value={stats.tripCount} label="여행" />
      <Tile value={stats.countryCount} label="국가" />
      <Tile value={stats.dayCount} label="일수" />
      <Tile value={stats.cityCount} label="도시" />
      <Tile value={stats.placeCount} label="장소" />
      <Tile value={km} label="이동 km" />
    </div>
  );
}

function Tile({ value, label }: { value: number | string; label: string }) {
  return (
    <div className={styles.tile}>
      <span className={styles.value}>{typeof value === 'number' ? value.toLocaleString() : value}</span>
      <span className={styles.label}>{label}</span>
    </div>
  );
}
