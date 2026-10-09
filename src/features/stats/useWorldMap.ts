import { useEffect, useState } from 'react';

export interface WorldData {
  width: number;
  height: number;
  latTop: number;
  latBottom: number;
  paths: Record<string, string>;
}

let cached: WorldData | null = null;
let loading: Promise<WorldData> | null = null;

function load(): Promise<WorldData> {
  if (cached) return Promise.resolve(cached);
  loading ??= import('./worldMap.json').then((m) => {
    cached = m.default as unknown as WorldData;
    return cached;
  });
  return loading;
}

/** 세계 지도 데이터(113KB) — 통계 화면 안에서 한 번만 받아 지도·나라 모양 아이콘이 같이 쓴다 */
export function useWorldMap(): WorldData | null {
  const [world, setWorld] = useState<WorldData | null>(cached);
  useEffect(() => {
    if (cached) return;
    let cancelled = false;
    void load().then((w) => {
      if (!cancelled) setWorld(w);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return world;
}
