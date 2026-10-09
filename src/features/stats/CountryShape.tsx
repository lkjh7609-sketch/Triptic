import { useMemo } from 'react';
import { lonScale, mainShape } from './countryOutline';
import { useWorldMap } from './useWorldMap';
import styles from './Stats.module.css';

/**
 * 나라 모양 아이콘 — 국기 이모지 대신. 지도 데이터(Natural Earth 110m)에서 그 나라의 큰 땅을 한 색으로 그린다.
 * 지도에 모양이 없는 작은 나라(싱가포르·홍콩 등)는 같은 크기의 동그라미.
 */
export function CountryShape({ code, size = 16 }: { code: string; size?: number }) {
  const world = useWorldMap();
  const shape = useMemo(() => (world ? mainShape(world.paths[code]) : null), [world, code]);

  // 데이터를 받기 전에도 자리를 잡아 글자가 밀리지 않게
  if (!world) return <span className={styles.shape} style={{ width: size, height: size }} aria-hidden="true" />;

  if (!shape) {
    return (
      <svg className={styles.shape} width={size} height={size} viewBox="0 0 10 10" aria-hidden="true">
        <circle cx="5" cy="5" r="3.2" className={styles.shapeFill} />
      </svg>
    );
  }

  // 가로 보정: 경로 전체에 scale(k, 1)을 걸고, 보기 영역도 보정한 좌표로 계산한다
  const k = lonScale(shape.box, world.height, world.latTop, world.latBottom);
  const w = (shape.box.maxX - shape.box.minX) * k;
  const h = shape.box.maxY - shape.box.minY;
  const side = Math.max(w, h, 1e-6);
  const pad = side * 0.06;
  // 정사각형 칸 안에 가운데 맞춤
  const minX = shape.box.minX * k - (side - w) / 2 - pad;
  const minY = shape.box.minY - (side - h) / 2 - pad;
  return (
    <svg
      className={styles.shape}
      width={size}
      height={size}
      viewBox={`${minX} ${minY} ${side + pad * 2} ${side + pad * 2}`}
      aria-hidden="true"
    >
      <path d={shape.d} transform={`scale(${k} 1)`} className={styles.shapeFill} />
    </svg>
  );
}
