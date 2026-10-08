import type { Grid } from './pixelArt';

/** 도트 그림을 SVG로 — pixel은 도트 한 칸의 화면 크기(px). 칸 경계가 번지지 않게 crispEdges, 같은 줄의 같은 색은 한 사각형으로 합친다 */
export function PixelSprite({ grid, pixel, className, label }: { grid: Grid; pixel: number; className?: string; label?: string }) {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const rects: { x: number; y: number; w: number; color: string }[] = [];
  grid.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const color = row[x];
      if (!color) {
        x += 1;
        continue;
      }
      let w = 1;
      while (x + w < row.length && row[x + w] === color) w += 1;
      rects.push({ x, y, w, color });
      x += w;
    }
  });
  return (
    <svg
      className={className}
      width={cols * pixel}
      height={rows * pixel}
      viewBox={`0 0 ${cols} ${rows}`}
      shapeRendering="crispEdges"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {rects.map((r) => (
        <rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={r.w} height={1.02} fill={r.color} />
      ))}
    </svg>
  );
}
