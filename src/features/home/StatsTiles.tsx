import type { TravelStats } from './useHomeStats';
import styles from './StatsTiles.module.css';

interface StatsTilesProps {
  stats: TravelStats;
}

/**
 * 나의 여행 기록 통계 타일 (02-screens.md §2.1, §2.2)
 * 값이 없는 지표(현재는 groundMeters — snapshot 스키마엔 구간 거리가 없다,
 * useHomeStats.ts 참고)는 "0"이 아니라 "—"로 표시한다 — 실제로 0이라는
 * 뜻이 아니라 아직 계산할 수 없다는 뜻이라서다.
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
