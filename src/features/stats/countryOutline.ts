import { pathBBox, type BBox } from './mapView';

export interface CountryShapeData {
  d: string;
  box: BBox;
}

/**
 * 지도가 위도·경도를 그대로 펴 놓은 모양이라 고위도 나라가 가로로 늘어난다.
 * 모양 가운데 위도의 cos 값만큼 가로를 줄여 실제 모양에 가깝게 한다(0.2 아래로는 안 줄인다).
 */
export function lonScale(box: BBox, mapHeight: number, latTop: number, latBottom: number): number {
  const midY = (box.minY + box.maxY) / 2;
  const lat = latTop - (midY / mapHeight) * (latTop - latBottom);
  return Math.max(0.2, Math.cos((lat * Math.PI) / 180));
}

function area(b: BBox): number {
  return (b.maxX - b.minX) * (b.maxY - b.minY);
}

/**
 * 나라 아이콘에 그릴 모양: 가장 큰 땅 + 그 근처(큰 땅 크기의 40% 안)의 땅만 남긴다.
 * 미국의 알래스카·하와이, 프랑스령 기아나처럼 멀리 떨어진 땅이 끼면 본토가 점처럼 작아지기 때문.
 * 경로가 없거나 점이 없으면 null.
 */
export function mainShape(path: string | undefined): CountryShapeData | null {
  if (!path) return null;
  const parts = path
    .split('M')
    .filter((p) => p.trim() !== '')
    .map((p) => {
      const d = `M${p}`;
      return { d, box: pathBBox(d) };
    })
    .filter((p): p is { d: string; box: BBox } => p.box !== null);
  if (parts.length === 0) return null;

  const main = parts.reduce((best, p) => (area(p.box) > area(best.box) ? p : best));
  const mw = main.box.maxX - main.box.minX;
  const mh = main.box.maxY - main.box.minY;
  const mx = Math.max(mw, mh) * 0.4;
  const near = {
    minX: main.box.minX - mx,
    maxX: main.box.maxX + mx,
    minY: main.box.minY - mx,
    maxY: main.box.maxY + mx,
  };
  const kept = parts.filter((p) => {
    const cx = (p.box.minX + p.box.maxX) / 2;
    const cy = (p.box.minY + p.box.maxY) / 2;
    return cx >= near.minX && cx <= near.maxX && cy >= near.minY && cy <= near.maxY;
  });

  return {
    d: kept.map((p) => p.d).join(''),
    box: {
      minX: Math.min(...kept.map((p) => p.box.minX)),
      minY: Math.min(...kept.map((p) => p.box.minY)),
      maxX: Math.max(...kept.map((p) => p.box.maxX)),
      maxY: Math.max(...kept.map((p) => p.box.maxY)),
    },
  };
}
