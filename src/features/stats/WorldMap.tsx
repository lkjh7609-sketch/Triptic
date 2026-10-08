import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { VisitedPlace } from './statsCompute';
import styles from './Stats.module.css';

interface WorldData {
  width: number;
  height: number;
  latTop: number;
  latBottom: number;
  paths: Record<string, string>;
}

/**
 * 다녀온 곳 세계 지도 — 구글 지도를 부르지 않는 정적 SVG(나라 모양은 Natural Earth 110m, 파일 한 번 받으면 끝).
 * 다녀온 나라는 브랜드색으로 칠하고, 도시는 점으로 찍는다.
 */
export function WorldMap({ countries, places }: { countries: string[]; places: VisitedPlace[] }) {
  const { t } = useTranslation('stats');
  const [world, setWorld] = useState<WorldData | null>(null);

  useEffect(() => {
    let cancelled = false;
    void import('./worldMap.json').then((m) => {
      if (!cancelled) setWorld(m.default as unknown as WorldData);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!world) return <div className={styles.mapSkeleton} aria-hidden="true" />;

  const visited = new Set(countries);
  const x = (lng: number) => ((lng + 180) / 360) * world.width;
  const y = (lat: number) => ((world.latTop - Math.max(world.latBottom, Math.min(world.latTop, lat))) / (world.latTop - world.latBottom)) * world.height;

  return (
    <svg className={styles.map} viewBox={`0 0 ${world.width} ${world.height}`} role="img" aria-label={t('map.aria')}>
      <g>
        {Object.entries(world.paths).map(([code, d]) => (
          <path key={code} d={d} className={visited.has(code) ? styles.landVisited : styles.land} />
        ))}
      </g>
      <g>
        {places.map((p) => (
          <circle key={p.key} cx={x(p.lng)} cy={y(p.lat)} r={5} className={styles.dot} />
        ))}
      </g>
    </svg>
  );
}
